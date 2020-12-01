/*
 * Copyright (c) 2014-2020 Bjoern Kimminich.
 * SPDX-License-Identifier: MIT
 */

const db = require('../data/mongodb')
const utils = require('../lib/utils')
const challenges = require('../data/datacache').challenges
const insecurity = require('../lib/insecurity')

module.exports = function productReviews () {
  return (req, res, next) => {
    const id = Number(req.params.id)

    if (!isFinite(id)) {
      return res.status(400).send(res.__('Invalid id'))
    }

    const user = insecurity.authenticatedUsers.from(req)
    db.reviews.insert({
      product: id,
      message: req.body.message,
      author: user.data.email,
      likesCount: 0,
      likedBy: []
    }).then(result => {
      res.status(201).json({ status: 'success' })
    }, err => {
      res.status(500).json(err)
    })
  }
}
