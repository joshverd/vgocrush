
import co from 'co'
import _ from 'underscore'

import logger from 'lib/logger'
import redis from 'lib/redis'
import r from 'lib/database'
import Bots, { BotItems } from 'document/bot'
import { BOT_ITEM_STATE_AVAILABLE, BOT_ITEM_STATE_IN_USE } from 'constant/item'
import * as bitskins from 'lib/bitskins'

import steamClient from '../lib/steamClient'
import botConfig from '../lib/botConfig'

// if(groups().indexOf('opskins') >= 0 && !!botConfig.opskinsApiKey) {
//   logger.info('Automatically selling items')
//
//   opskinsClient = new OPSkinsAPI(botConfig.opskinsApiKey)
//
//   if(botConfig.autoSellInventory) {
//     autoSellInventory()
//   }
// }

/*
function autoSellInventory() {
  co(function* () {
    const activeTradeOffers = yield new Promise((resolve, reject) =>
      opskinsClient.getActiveTradeOffers((e, d) => !!e ? reject(e) : resolve(d))
    )

    const pickupOffersCount = _.filter(activeTradeOffers, o => o.type && o.type === 'pickup' && o.saleids.indexOf(288755354) < 0 && o.saleids.indexOf(289001631) < 0).length
    if(pickupOffersCount > 10) {
      logger.info('autoSellInventory', 'pickupOffersCount', pickupOffersCount)
      return setTimeout(autoSellInventory, 2500)
    }

    const lowestPrices = yield new Promise((resolve, reject) => {
      redis.get('opskins:lowestPrices', (err, cached) => {
        if(!!err) {
          return reject(err)
        }

        if(!!cached) {
          return resolve(JSON.parse(cached))
        }

        opskinsClient.getLowestPrices(730, (err, prices) => {
          redis.set('opskins:lowestPrices', JSON.stringify(prices))
          redis.expire('opskins:lowestPrices', 30)
          resolve(prices)
        })
      })
    })

    const listingLimit = 25 //yield new Promise((resolve, reject) =>
      //opskinsClient.getListingLimit((e, d) => !!e ? reject(e) : resolve(d))
  //  )

    const botItems = _.uniq(yield BotItems.getAll([ steamClient.steamID.getSteamID64(), BOT_ITEM_STATE_AVAILABLE ], { index: 'botState' }), botItem => botItem.assetId)

    if(!botItems.length) {
      logger.info('autoSellInventory', 'botItems', botItems.length)
      return setTimeout(autoSellInventory, 10000)
    }

    const itemsToList = _.uniq(botItems
      .filter(i => !!lowestPrices[i.name] && lowestPrices[i.name].price >= 10)
      .map(i => ({
        appid: 730,
        contextid: 2,
        assetid: i.assetId,
        price: Math.max(2, lowestPrices[i.name].price)
      })), b => b.assetid)
      .slice(0, listingLimit)

    if(!itemsToList.length) {
      logger.info('autoSellInventory', 'itemsToList', itemsToList)
      return setTimeout(autoSellInventory, 10000)
    }

    yield BotItems.getAll(r.args(_.pluck(itemsToList, 'assetid')), { index: 'assetId' }).update({
      // sellingAt: r.now(),
      lockedUntil: r.now().add(300),
      state: BOT_ITEM_STATE_IN_USE
    })

    try {
      const response = yield new Promise((resolve, reject) =>
        opskinsClient.listItems(itemsToList, (e, d) => !!e ? reject(e) : resolve(d))
      )

      logger.info('autoSellInventory', `Listed ${response.sales.length} for sale`)
      setTimeout(autoSellInventory, 10000)
    } catch(e) {
      // yield BotItems.getAll(_.pluck(itemsToList, 'assetid'), { index: 'assetId' }).update({
      //   sellingAt: null,
      //   state: BOT_ITEM_STATE_AVAILABLE
      // })

      logger.info('autoSellInventory', 'cannot list items', e)
      setTimeout(autoSellInventory, 10000)
    }

    console.log(Date.now() - lastReloadInventory)

    if(Date.now() - lastReloadInventory >= 15000) {
      lastReloadInventory = Date.now()
      yield reloadInventory()
    }
  })

  .catch(err => {
    logger.error('autoSellInventory', err)
    setTimeout(autoSellInventory, 10000)
  })
}
 */
function onReady() {
  poll()
}

function isReady() {
  return co(function* () {
    return true
  })
}

function getPrices() {
  const config = botConfig()

  return co(function* () {

    if(config.groups.indexOf('bitskins') >= 0) {
      const { items } = yield bitskins.getItemsOnSalePriceData(config.bitskins)

      return _.chain(items)
        .map(item => [ item.market_hash_name, {
          price: parseFloat(!!item.recent_sales_info ? item.recent_sales_info.average_price : item.lowest_price)
        }])
        .object()
        .value()
    }

    return Promise.reject('cannot find manager to get prices')
  })
}

function listItems(botItems) {
  const config = botConfig()

  return co(function* () {
    if(config.groups.indexOf('bitskins') >= 0) {
      const itemIds = botItems.map(b => b.assetId)
      const prices = botItems.map(b => b.price)

      return yield bitskins.listItemsForSale(itemIds, prices, config.bitskins)
    }

    return Promise.reject('cannot find manager to list prices')
  })
}

function poll() {
  return co(function* () {
    const ready = yield isReady()

    if(!ready) {
      return setTimeout(poll, 5000)
    }

    const botItems = _.uniq(yield BotItems.getAll([ steamClient.steamID.getSteamID64(), BOT_ITEM_STATE_AVAILABLE ], { index: 'botState' }), botItem => botItem.assetId)

    if(!botItems.length) {
      return setTimeout(poll, 10000)
    }

    const prices = yield getPrices()
    const listingLimit = 25

    const itemsToList = _
      .chain(botItems)
      .uniq(b => b.assetId)
      .filter(i => !!prices[i.name] && prices[i.name].price >= 0.10)
      .map(b => ({
        ...b,

        price: prices[b.name].price
      }))
      .value()
      .slice(0, listingLimit)

    yield BotItems.getAll(r.args(_.pluck(itemsToList, 'assetId')), { index: 'assetId' }).update({
      lockedUntil: r.now().add(300),
      state: BOT_ITEM_STATE_IN_USE
    })

    yield listItems(itemsToList)

    logger.info('features', 'autoSellInventory', `listed ${itemsToList.length} items for sale`)
    setTimeout(poll, 5000)
  })

  .catch(err => {
    logger.error('features', 'autoSellInventory', err)
    setTimeout(poll, 10000)
  })
}

export default () => {
  steamClient.on('skne:ready', onReady)
}
