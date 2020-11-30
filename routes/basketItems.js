/*
 * Copyright (c) 2014-2020 Bjoern Kimminich.
 * SPDX-License-Identifier: MIT
 */

const utils = require('../lib/utils')
const challenges = require('../data/datacache').challenges
const insecurity = require('../lib/insecurity')
const models = require('../models/index')

module.exports.addBasketItem = function addBasketItem () {
  return (req, res, next) => {
    const { BasketId, ProductId, quantity } = req.body;

    const user = insecurity.authenticatedUsers.from(req)
    if (!user || !BasketId || user.bid !== BasketId) { // eslint-disable-line eqeqeq
      res.status(401).send('{\'error\' : \'Invalid BasketId\'}')
    } else {
      const basketItem = {
        ProductId,
        BasketId,
        quantity
      }
      utils.solveIf(challenges.basketManipulateChallenge, () => { return user && basketItem.BasketId && basketItem.BasketId !== 'undefined' && user.bid != basketItem.BasketId }) // eslint-disable-line eqeqeq

      const basketItemInstance = models.BasketItem.build(basketItem)
      basketItemInstance.save().then((basketItem) => {
        basketItem = {
          status: 'success',
          data: basketItem
        }
        res.json(basketItem)
      }).catch(error => {
        next(error)
      })
    }
  }
}

module.exports.quantityCheckBeforeBasketItemAddition = function quantityCheckBeforeBasketItemAddition () {
  return (req, res, next) => {
    checkIfDeleted(res, next, req.body.ProductId)
    quantityCheck(req, res, next, req.body.ProductId, req.body.quantity)
  }
}

module.exports.quantityCheckBeforeBasketItemUpdate = function quantityCheckBeforeBasketItemUpdate () {
  return (req, res, next) => {
    models.BasketItem.findOne({ where: { id: req.params.id } }).then((item) => {
      const user = insecurity.authenticatedUsers.from(req)
      utils.solveIf(challenges.basketManipulateChallenge, () => { return user && req.body.BasketId && user.bid != req.body.BasketId }) // eslint-disable-line eqeqeq
      if (req.body.quantity) {
        quantityCheck(req, res, next, item.ProductId, req.body.quantity)
      } else {
        next()
      }
    }).catch(error => {
      next(error)
    })
  }
}

async function checkIfDeleted(res, next, id) {
  const product = await models.Product.findOne({ where: { id }});
  
  if (!product || product.deletedAt) {
    res.status(400).json({ error: res.__('This product is not available.') })
  } else {
    next();
  }
}

async function quantityCheck (req, res, next, id, quantity) {
  const record = await models.PurchaseQuantity.findOne({ where: { ProductId: id, UserId: req.body.UserId } })

  const previousPurchase = record ? record.quantity : 0

  const product = await models.Quantity.findOne({ where: { ProductId: id } })

  if (quantity < 1) {
    return res.status(400).json({ error: res.__('Quantity must be bigger than 0.') })
  }

  if (!product.limitPerUser || (product.limitPerUser && (product.limitPerUser - previousPurchase) >= quantity) || insecurity.isDeluxe(req)) {
    if (product.quantity >= quantity) {
      next()
    } else {
      res.status(400).json({ error: res.__('We are out of stock! Sorry for the inconvenience.') })
    }
  } else {
    res.status(400).json({ error: res.__('You can order only up to {{quantity}} items of this product.', { quantity: product.limitPerUser }) })
  }
}
