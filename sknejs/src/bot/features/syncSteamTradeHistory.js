
import co from 'co'
import _ from 'underscore'
import request from 'request'
import async from 'async'

import logger from 'lib/logger'
import redis from 'lib/redis'
import r from 'lib/database'
import TradeOffers, { SteamTradeHistory } from 'document/offer'
import { EOfferFilter } from 'steam-tradeoffer-manager'

import steamClient, { tradeManager } from '../lib/steamClient'
import botConfig from '../lib/botConfig'

let steamId = ''
let apiKey = ''

function onReady() {
  const config = botConfig()

  apiKey = config.apiKey
  steamId = steamClient.steamID.getSteamID64()

  sync()
}

function sync(startAfterTime = 0, startAfterTrade = 0) {
  co(function* () {
    const [ latestOffer ] = yield SteamTradeHistory
      .getAll(steamId, { index: 'bot' })
      .orderBy(r.desc('createdAt'))
      .limit(1)

    if(!startAfterTime) {
      startAfterTime = !!latestOffer ? latestOffer.initiatedAtUnix : startAfterTime
      console.log(startAfterTime)
    }

    const response = yield new Promise((resolve, reject) =>
      request({
        url: 'http://api.steampowered.com/IEconService/GetTradeHistory/v1/',
        json: true,
        qs: {
          key: apiKey,
          max_trades: 100,
          start_after_time: startAfterTime,
          start_after_tradeid: startAfterTrade,
          navigating_back: 1,
          get_descriptions: 1,
          include_failed: 0
        }
      }, (err, res, body) => !!err ? reject(err) : resolve(body.response))
    )

    if(typeof response.more === 'undefined') {
      return setTimeout(() => sync(startAfterTime, startAfterTrade), 15000)
    }

    console.log(steamId, startAfterTime, response.trades.length)

    const tasks = []
    const updated = []

    for(let offer of response.trades) {
      let itemsTaken = offer.assets_received || []

      tasks.push((offer => done => {
        let update = {
          id: offer.tradeid,
          bot: steamId,
          initiatedAt: new Date(offer.time_init * 1000),
          initiatedAtUnix: offer.time_init,
          partnerId: offer.steamid_other,
          itemsGiven: offer.assets_given || [],
          itemsTaken: itemsTaken,
          itemsTakenAssetIds: itemsTaken.map(a => parseInt(a.assetid))
          // raw: offer
        }

        SteamTradeHistory
          .get(offer.tradeid)
          .replace(s => r.branch(s.eq(null), update, s.merge(update)))
          .then(res => {
            if(res.inserted > 0 || res.replaced > 0) {
              updated.push(update)
            }

            done()
          }, err => {
            console.log(err, update)
            console.log(offer)
            done(err)
          })
      })(offer))
    }

    logger.info('features', 'syncSteamTradeHistory', 'syncing', tasks.length)

    yield new Promise((resolve, reject) =>
      async.parallelLimit(tasks, 50, err => {
        !!err ? reject(err) : resolve()
      })
    )

    if(updated.length > 0) {
      logger.info('features', 'syncSteamTradeHistory', 'updating', updated.length)

      const tradeOffers = yield TradeOffers
        .getAll(r.args(_.pluck(updated, 'id')), { index: 'tradeID' })

      const tradeOfferIds = _.pluck(tradeOffers, 'tradeID')
      const updatedOfferIds = _.pluck(updated, 'id')
      const missing = _.difference(updatedOfferIds, tradeOfferIds)

      if(missing.length > 0) {
        logger.info('syncSteamTradeHistory', 'missing', missing.length, 'offer(s)')
        // console.log(updated[0])
        // console.log(replaced.filter(r => missing.indexOf(r.tradeOfferId) >= 0))
        // console.log(missing)
      }
    }

    if(response.more) {
      const firstTrade = response.trades[0]
      console.log(firstTrade.time_init, firstTrade.tradeid)
      setTimeout(() => sync(firstTrade.time_init, firstTrade.tradeid), 2000)
      return
    }

    setTimeout(sync, 30000)
  })

  .catch(err => {
    logger.error('features', 'syncSteamTradeHistory', 'sync', err)
    setTimeout(sync, 10000)
  })
}

export default () => {
  steamClient.on('skne:afterSetCookies', onReady)
}
