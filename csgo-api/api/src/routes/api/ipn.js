
import { Router } from 'express'
import config from 'config'
import request from 'request'
import crypto from 'crypto'
import numeral from 'numeral'
import co from 'co'

import r from 'lib/database'
import sockets from 'lib/sockets'

import logger from 'lib/logger'
import Order from 'document/order'
import { addStats } from 'document/stats'

import Player, { logPlayerBalanceChange } from 'document/player'
import redis from 'lib/redis'

function postPayGardenNotifification(req, res) {
  const { paygarden } = config
  const { 'api-key': apiKey, 'account-id': accountId, 'txn-type': txnType, 'txn-id': txnId, 'just-testing': justTesting,
    'units-sold': unitsSold, payout } = req.body

  if(process.env.NODE_ENV === 'production' && justTesting) {
    throw new Error('justTesting === true in production')
  }

  if(!apiKey || apiKey !== paygarden.apiKey) {
    throw new Error('api key mismatch')
  }

  co(function* () {

    if(txnType === 'cancel') {
      const [ order ] = yield Order.getAll(txnId, { index: 'transactionId' })
      if(!order) {
        throw new Error('cannot find txn order')
      }

      yield Player.get(accountId).update({
        disableOpeningCase: true,
        lockWithdraws: true,
        lockDeposits: true,

        hasFraud: true,
        fraudWarning: 'Gift card fraud'
      })

      res.json({
        success: true
      })

      return
    }

    if(txnType !== 'initial') {
      throw new Error('type !== initial')
    }

    const reward = unitsSold / 100

    const { replaced, changes } = yield Player
      .get(accountId)
      .update(r.branch(r.row('acceptedGiftDeposits').default([]).contains(txnId).not(), {
        balance: r.row('balance').add(reward),
        acceptedGiftDeposits: r.row('acceptedGiftDeposits').default([]).append(txnId),
        totalDeposit: r.row('totalDeposit').default(0).add(reward)
      }, {}), {
        returnChanges: true
      })

    if(replaced <= 0) {
      throw new Error('Cannot find player to update')
    }

    yield logPlayerBalanceChange(accountId, reward, {
      meta: {
        name: 'Deposit: Gift Card',
        transactionId: txnId
      }
    })

    yield Order.insert({
      amount: reward,
      completed: true,
      createdAt: new Date(),
      playerId: accountId,
      method: 'paygarden',
      transactionId: txnId
    })

    yield addStats({
      counters: {
        totalDeposits: 1,
        totalDeposited: reward,

        totalGiftDeposits: 1,
        totalGiftDeposited: reward
      }
    })

    sockets.to(accountId).emit('user:update', {
      balance: changes[0].new_val.balance
    })

    sockets.to(accountId).emit('notification', {
      message: `Gift card deposit has been accepted, you have been credited \$${numeral(reward).format('0,0.00')}!`,
      duration: 7000
    })

    sockets.to(accountId).emit('depositComplete', reward)

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error(`postPayGardenNotifification() ${err}`, {
      txnId,
      accountId
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
  router.post('/pg', postPayGardenNotifification)
  return router
}
