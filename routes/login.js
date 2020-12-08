/*
 * Copyright (c) 2014-2020 Bjoern Kimminich.
 * SPDX-License-Identifier: MIT
 */

const axios = require('axios')
const utils = require('../lib/utils')
const insecurity = require('../lib/insecurity')
const models = require('../models/index')
const challenges = require('../data/datacache').challenges
const users = require('../data/datacache').users
const config = require('config')

async function verifyToken(token) {

  try {
    const response = await axios.get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`)
  } catch (_) {
    return null;
  }

  if (response.data.issued_to !== process.env.OAUTH_CLIENT_ID) {
    return null
  }

  return response.data
}

async function loginOuath(token) {
  const user = await verifyToken(token)

  if (!user || !user.email) {
    throw new Error('Cannot verify access token')
  }

  let userDb = await models.User.findOne({
    where: {
      email: user.email,
    },
    plain: true
  })

  if (userDb) {
    return userDb
  }

  userDb = await models.User.create({
    email: user.email,
    passport: user.email + process.env.OAUTH_SALT,
  }).then((result) => result.get({ plain: true }));

  return userDb
}

module.exports = function login () {
  function afterLogin (user, longLivedToken, res, next) {
    verifyPostLoginChallenges(user)
    models.Basket.findOrCreate({ where: { UserId: user.data.id }, defaults: {} })
      .then(([basket]) => {
        const token = insecurity.authorize(user, longLivedToken)
        user.bid = basket.id // keep track of original basket for challenge solution check
        insecurity.authenticatedUsers.put(token, user)
        res.json({ authentication: { token, bid: basket.id, umail: user.data.email } })
      }).catch(error => {
        next(error)
      })
  }

  return (req, res, next) => {
    if (!req.body.password || req.body.password.length < 5) {
      return res.status(401).send(res.__('Password too short'))
    }

    verifyPreLoginChallenges(req);

    (
      req.body.oauth
        ? loginOuath(req.body.accessToken)
        : models.User.findOne({
          where: {
            email: req.body.email || '',
            password: insecurity.hash(`${req.body.password}-${process.env.PASSWORD_SALT}`),
            isActive: true
          },
          plain: true
        })
    ).then(async (authenticatedUser) => {
        let user = utils.queryResultToJson(authenticatedUser)
        if (user.data && user.data.id && user.data.totpSecret !== '') {
          res.status(401).json({
            status: 'totp_token_required',
            data: {
              tmpToken: insecurity.authorize({
                userId: user.data.id,
                type: 'password_valid_needs_second_factor_token'
              })
            }
          })
        } else if (user.data && user.data.id) {
          afterLogin(user, req.body.rememberMe, res, next)
        } else {
          res.status(401).send(res.__('Invalid email or password.'))
        }
      }).catch(error => {
        next(error)
      })
  }

  function verifyPreLoginChallenges (req) {
    utils.solveIf(challenges.weakPasswordChallenge, () => { return req.body.email === 'admin@' + config.get('application.domain') && req.body.password === 'admin1995' })
    utils.solveIf(challenges.weakPasswordChallenge, () => { return req.body.email === 'adminek@' + config.get('application.domain') && req.body.password === '1995adminek' })
    utils.solveIf(challenges.loginSupportChallenge, () => { return req.body.email === 'support@' + config.get('application.domain') && req.body.password === 'J6aVjTgOpRs$?5l+Zkq2AYnCE@RF§P' })
    utils.solveIf(challenges.loginRapperChallenge, () => { return req.body.email === 'mc.safesearch@' + config.get('application.domain') && req.body.password === 'Mr. N00dles' })
    utils.solveIf(challenges.loginAmyChallenge, () => { return req.body.email === 'amy@' + config.get('application.domain') && req.body.password === 'K1f.....................' })
    utils.solveIf(challenges.dlpPasswordSprayingChallenge, () => { return req.body.email === 'J12934@' + config.get('application.domain') && req.body.password === '0Y8rMnww$*9VFYE§59-!Fg1L6t&6lB' })
    utils.solveIf(challenges.oauthUserPasswordChallenge, () => { return req.body.email === 'bjoern.kimminich@gmail.com' && req.body.password === 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=' })
  }

  function verifyPostLoginChallenges (user) {
    utils.solveIf(challenges.loginAdminChallenge, () => { return user.data.id === users.admin.id })
    utils.solveIf(challenges.loginJimChallenge, () => { return user.data.id === users.jim.id })
    utils.solveIf(challenges.loginBenderChallenge, () => { return user.data.id === users.bender.id })
    utils.solveIf(challenges.ghostLoginChallenge, () => { return user.data.id === users.chris.id })
    if (utils.notSolved(challenges.ephemeralAccountantChallenge) && user.data.email === 'acc0unt4nt@' + config.get('application.domain') && user.data.role === 'accounting') {
      models.User.count({ where: { email: 'acc0unt4nt@' + config.get('application.domain') } }).then(count => {
        if (count === 0) {
          utils.solve(challenges.ephemeralAccountantChallenge)
        }
      })
    }
  }
}
