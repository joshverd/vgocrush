
import { Router } from 'express'
import config from 'config'
import request from 'request'
import crypto from 'crypto'
import numeral from 'numeral'
import co from 'co'

import r from 'lib/database'
import sockets from 'lib/sockets'
import { ensureAuthenticated } from 'lib/middleware'
import logger from 'lib/logger'
import Order from 'document/order'
import { addStats } from 'document/stats'
import Player, { givePlayerBalance } from 'document/player'
import redis from 'lib/redis'

// GET /api/g2a/order
function getOrder(req, res) {
  const { secret, hash, merchantEmail } = config.g2a

  if(req.user.lockDeposits) {
    return res.status(400).send(req.__('TRY_AGAIN_LATER'))
  }

  const amount = req.body.amount ? parseInt(req.body.amount) : 0
  if(amount < 2) {
    return res.status(400).send('The minimum deposit amount is $2.00')
  }

  co(function* () {

    const disabled = yield redis.getAsync('kingdom:disable:deposit')
    if(disabled) {
      return res.status(400).send('Depositing is currently disabled')
    }

    const { generated_keys } = yield Order.insert({
      amount,
      completed: false,
      createdAt: new Date(),
      playerId: req.user.id,
      method: 'g2a'
    }).run()

    const orderHash = crypto.createHash('sha256').update(`${generated_keys[0]}${amount}USD${secret}`).digest('hex')

    request({
      method: 'POST',
      url: 'https://checkout.pay.g2a.com/index/createQuote',
      json: true,
      headers: {
        Authorization: `${hash};${orderHash}`
      },
      form: {
        api_hash: hash,
        hash: orderHash,
        order_id: generated_keys[0],
        amount: amount,
        currency: 'USD',
        email: req.user.email ? req.user.email : null,
        url_failure: config.app.url,
        url_ok: config.app.url,
        security_steam_id: req.user.id,
        security_user_logged_in: 1,
        items: [{
          amount,
          sku: 1,
          id: 1,
          name: `Balance Refill`,
          type: 'item_type',
          qty: 1,
          price: amount,
          url: config.app.url
        }]
      }
    }, (err, response, body) => {
      if(err) {
        logger.error(`getOrder() cannot get request: ${err}`)
        return res.status(400).send(req.__('TRY_AGAIN_LATER'))
      }

      res.json({
        url: `https://checkout.pay.g2a.com/index/gateway?token=${body.token}`
      })
    })

  })

  .catch(err => {
    logger.error(`getOrder() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function getNotification(req, res) {
  const { type, transactionId, userOrderId, amount, status, orderCompleteAt, orderCreatedAt, refundedAmount, provisionAmount, hash } = req.body

  const orderHash = crypto.createHash('sha256').update(`${transactionId}${userOrderId}${amount}${config.g2a.secret}`).digest('hex')
  if(orderHash !== hash) {
    logger.error('g2a.getNotification() orderHash !== hash', {
      status,
      userOrderId
    })

    return res.status(400).send(req.__('TRY_AGAIN_LATER'))
  }

  co(function* () {
    switch(status) {
      case 'complete':
        let order = yield Order.get(userOrderId).run()
        if(!order || order.completed) {
          logger.error('g2a.getNotification() cannot find completed order', {
            status,
            transactionId,
            userOrderId
          })

          return res.status(400).send(req.__('TRY_AGAIN_LATER'))
        }

        const { replaced, changes } = yield givePlayerBalance(order.playerId, order.amount, {
          g2aTransactionId: transactionId,

        }, () => ({
          g2aTransactions: r.row('g2aTransactions').default([]).append(transactionId),
          totalDeposit: r.row('totalDeposit').default(0).add(order.amount)
        }))

        sockets.to(order.playerId).emit('depositComplete', order.amount)

        yield addStats({
          counters: {
            totalDeposits: 1,
            totalDeposited: order.amount,

            totalG2ADeposits: 1,
            totalG2ADeposited: order.amount
          }
        })

        Order.get(userOrderId).update({
          completed: true
        }).run()
        res.send('OK')
        break

      case 'pending':
        res.send('OK')
        break

      case 'refunded':
        order = yield Order.get(userOrderId).run()
        if(!order) {
          logger.error('g2a.getNotification() cannot find refund order', {
            status,
            transactionId,
            userOrderId
          })

          return res.status(400).send(req.__('TRY_AGAIN_LATER'))
        }

        logger.error(`g2a.getNotification() Got status ${status}`, {
          status,
          transactionId,
          userOrderId,
          playerId: order.playerId
        })

        yield Order.get(userOrderId).delete().run()
        res.send('OK')
        break

      default:
        logger.error(`g2a.getNotification() Got status ${status}`, {
          status,
          transactionId,
          userOrderId
        })

        res.send('OK')
        break

    }

  })

  .catch(err => {
    logger.error(`g2a.getNotification() ${err}`, {
      status,
      transactionId,
      userOrderId
    })

    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.post('/notification', getNotification)
  router.post('/order', ensureAuthenticated, getOrder)
  return router
}
