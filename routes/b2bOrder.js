/*
 * Copyright (c) 2014-2020 Bjoern Kimminich.
 * SPDX-License-Identifier: MIT
 */

const utils = require('../lib/utils')
const insecurity = require('../lib/insecurity')

module.exports = function b2bOrder () {
  return ({ body }, res, next) => {
    if (!utils.disableOnContainerEnv()) {
      const orderLinesData = body.orderLinesData || '[]'
      try {
        orderLinesData = JSON.parse(orderLinesData);
        res.json({ cid: body.cid, orderNo: uniqueOrderNumber(), paymentDue: dateTwoWeeksFromNow() })
      } catch (err) {
        next(err)
      }
    } else {
      res.json({ cid: body.cid, orderNo: uniqueOrderNumber(), paymentDue: dateTwoWeeksFromNow() })
    }
  }

  function uniqueOrderNumber () {
    return insecurity.hash(new Date() + '_B2B')
  }

  function dateTwoWeeksFromNow () {
    return new Date(new Date().getTime() + (14 * 24 * 60 * 60 * 1000)).toISOString()
  }
}
