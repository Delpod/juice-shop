/*
 * Copyright (c) 2014-2020 Bjoern Kimminich.
 * SPDX-License-Identifier: MIT
 */

const utils = require('../lib/utils')
const challenges = require('../data/datacache').challenges
const db = require('../data/mongodb')
const insecurity = require('../lib/insecurity')

module.exports = function productReviews () {
  return (req, res, next) => {
    const id = Number(req.body.id)

    if (!isFinite(id)) {
      return res.status(400).send(res.__('Invalid id'))
    }

    const user = insecurity.authenticatedUsers.from(req)
    db.reviews.update(
      { _id: id, author: user.data.email },
      { $set: { message: req.body.message } },
    ).then(
      result => {
        utils.solveIf(challenges.noSqlReviewsChallenge, () => { return result.modified > 1 })
        res.json(result)
      }, err => {
        res.status(500).json(err)
      })
  }
}
