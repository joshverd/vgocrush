
import 'babel-polyfill'
import co from 'co'

import r from '../lib/database'
import TradeOffers, { PendingOffers } from '../document/offer'
import { amqpConnect, amqpCh, amqpConnection } from '../lib/amqp'
import logger from '../lib/logger'
import { TRADE_STATE_QUEUED, TRADE_TYPE_WITHDRAW, TRADE_VERIFICATION_STEP_PENDING } from '../constant/trade'

co(function* () {
  yield amqpConnect()

  const pendingOffers = yield PendingOffers.getAll(TRADE_STATE_QUEUED, 'ESCROW', { index: 'state' })

  for(let offer of pendingOffers) {
    logger.info('Queueing pending offer', offer.id)

    amqpCh().publish('skne.withdraw', offer.provider, new Buffer(offer.id), {
      persistent: true
    })
  }

  // const offers = yield TradeOffers.getAll([ TRADE_TYPE_WITHDRAW, TRADE_STATE_QUEUED ], { index: 'typeState' })
  //
  // for(let offer of offers) {
  //   logger.info(`Queueing trade offer ${offer.id} (${offer.bot}) for ${offer.steamId64}`)
  //   amqpCh().publish('skne.withdraw', offer.bot, new Buffer(offer.id), { persistent: true })
  // }

  // logger.info(`Queued ${offers.length} offers...`)
})

.catch(logger.error)
