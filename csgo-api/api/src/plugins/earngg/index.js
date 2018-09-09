
import config from 'config'
import is from 'is_js'
import co from 'co'

import Player, { takePlayerBalance, givePlayerBalance } from 'document/player'
import Order from 'document/order'
import { addStats } from 'document/stats'
import logger from 'lib/logger'
import r from 'lib/database'

function postEarnCallback(req, res) {
  let { steamId, secret, amount } = req.body
  const { earngg } = config.get('plugins.options')

  if(!is.string(steamId)) {
    return res.json({
      success: false,
      err: 'Invalid steam id'
    })
  } else if(!is.number(amount) || amount <= 0) {
    return res.json({
      success: false,
      err: 'Invalid amount'
    })
  } else if(!is.string(secret) || secret !== earngg.secret) {
    return res.json({
      success: false,
      err: 'Invalid secret'
    })
  }

  co(function* () {
    const existsCount = yield Player.getAll(steamId).count()
    if(existsCount <= 0) {
      return res.json({
        success: false,
        err: `You must first create a ${earngg.name} account.`
      })
    }

    const { replaced } = yield takePlayerBalance(earngg.bankAccount, amount, {
      name: `EarnGG: Take from bank`,
      creditTo: steamId
    })

    if(replaced <= 0) {
      //this is the actual error that's shown on earn.gg client
      return res.json({
        success: false,
        err: 'Withdrawals are temporarily offline.'
      })
    }

    yield givePlayerBalance(steamId, amount, {
      name: 'EarnGG: Deposit'
    }, player => ({
      totalDeposit: r.row('totalDeposit').default(0).add(amount)
    }))

    yield Order.insert({
      amount,
      completed: true,
      createdAt: new Date(),
      playerId: steamId,
      method: 'earngg',
      noTrack: true
    })

    yield addStats({
      counters: {
        totalDeposits: 1,
        totalDeposited: amount,

        totalEarnDeposits: 1,
        totalEarnDeposited: amount
      }
    })

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error(`postEarnCallback() ${err}`)

    res.json({
      success: false,
      err: err.message
    })
  })
}

export default {
  name: 'Earn.GG Postback',

  hooks: {
    afterApiRouteCreated(router) {
      router.post('/earncb', postEarnCallback)
    }
  }
}
