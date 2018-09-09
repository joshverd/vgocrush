/*
 * Required SKNE Worker
 *
 * - Watches BotItems with lockedUntil
 */

import 'babel-polyfill'
import co from 'co'

import r from 'lib/database'
import { BotItems } from 'document/bot'
import TradeOffers, { PendingOffers } from 'document/offer'
import { BOT_ITEM_STATE_AVAILABLE, BOT_ITEM_STATE_IN_USE } from 'constant/item'
import logger from 'lib/logger'
import { amqpConnect, publishNotification } from 'lib/amqp'

import {
  TRADE_STATE_SENT,
  TRADE_TYPE_INCOMING,
  TRADE_TYPE_WITHDRAW,
  TRADE_STATE_DECLINED,
  TRADE_TYPE_STORAGE,
  TRADE_TYPE_DEPOSIT,
  TRADE_STATE_QUEUED,
  TRADE_STATE_ERROR,
  TRADE_STATE_ACCEPTED,
  TRADE_STATE_ESCROW,
  TRADE_STATE_CONFIRM,

  TRADE_ITEM_STATE_PENDING,
  TRADE_ITEM_STATE_INSERTED,

  TRADE_VERIFICATION_STEP_PENDING
} from 'constant/trade'

function pollLockedBotItems() {
  return co(function* () {
    const { replaced } = yield BotItems
      .getAll(BOT_ITEM_STATE_IN_USE, { index: 'state' })
      .filter(r.row.hasFields('lockedUntil').and(r.row('lockedUntil').lt(r.now())))
      .replace(r.row.merge(botItem => ({
        state: BOT_ITEM_STATE_AVAILABLE,
        previouslyLocked: true
       })).without('lockedUntil'))

    if(replaced > 0) {
      logger.info('pollLockedBotItems', `unlocked ${replaced} locked items`)
    }

    setTimeout(pollLockedBotItems, 30000)
  })

  .catch(err => {
    logger.error('pollLockedBotItems', err)
  })
}

function broadcastOfferChange(offer) {

  // Virtual Deposits
  if(!!offer.meta && !!offer.meta.pendingOfferId) {
    let update = {}

    if(offer.state === TRADE_STATE_DECLINED || offer.state === TRADE_STATE_ERROR) {
      update = {
        state: TRADE_STATE_DECLINED,
        hasTradeOfferError: offer.state === TRADE_STATE_ERROR,
        retry: true
      }
    } else if(offer.state === TRADE_STATE_SENT) {
      update = {
        state: TRADE_STATE_SENT,
        tradeOfferUrl: offer.tradeOfferUrl
      }
    } else if(offer.state === TRADE_STATE_ACCEPTED) {
      update = {
        state: TRADE_STATE_ACCEPTED,
        acceptedAt: new Date()
      }
    }

    if(Object.keys(update).length > 0) {
      PendingOffers
        .get(offer.meta.pendingOfferId)
        .update(update, { returnChanges: true })
        .run()
        .then(({ replaced, changes }) => {
          if(replaced > 0) {
            publishNotification(changes[0].new_val)
          }
        })
    }
  }

  publishNotification(offer, 'trade.OnTradeOfferStateChange')
}

function fixSentPendingOffers() {
  return co(function* () {
    const offers = yield PendingOffers
      .getAll('SENT', { index: 'state' })
      .map(o => o.merge({
        tradeOffer: TradeOffers.get(o('tradeOfferId'))
      }))
      .filter(r.row('tradeOffer')('state').eq('ACCEPTED'))

    for(let offer of offers) {
      logger.info(offer.id, offer.tradeOffer.id, offer.steamId, `[${offer.itemNames.join(', ')}]`)
      broadcastOfferChange(offer.tradeOffer)
    }

    setTimeout(fixSentPendingOffers, 30000)
  })

  .catch(err => {
    logger.error('fixSentPendingOffers', err)
  })
}

co(function* () {
  logger.info('SknExchange Worker')

  yield amqpConnect()

  yield pollLockedBotItems()
  yield fixSentPendingOffers()
})

.catch(err => {
  logger.error('Startup error', err)
})
