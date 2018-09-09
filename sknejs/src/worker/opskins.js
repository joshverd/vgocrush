/*
 * OPSkins Worker
 *
 */

import 'babel-polyfill'
import co from 'co'
import _ from 'underscore'
import { mapSeries, eachSeries, parallelLimit } from 'async'
import numeral from 'numeral'
import moment from 'moment'
import request from 'request'
import speakeasy from 'speakeasy'
import config from 'config'

import {
  TRADE_TYPE_DEPOSIT,
  TRADE_STATE_QUEUED,
  TRADE_STATE_DECLINED,
  TRADE_STATE_SENT,
  TRADE_STATE_ACCEPTED,
  TRADE_STATE_PENDING
} from 'constant/trade'

import {
  BOT_ITEM_STATE_AVAILABLE
} from 'constant/item'

import r from 'lib/database'
import logger from 'lib/logger'
import { migrateDocuments } from 'lib/documents'
import { amqpConnect, amqpCh, publishNotification  } from 'lib/amqp'
import { callRPC } from 'api/rpc'
import opskins, { OPSkinsAPI } from 'lib/opskins'
import { addStats } from 'document/stats'
import { decryptString } from 'lib/rsa'

import TradeOffers, { PendingOffers } from 'document/offer'
import Items, { ItemListings, ItemSales } from 'document/item'
import Bots, { BotItems } from 'document/bot'
import redis from 'lib/redis'
import botConfig, { loadBotConfig, watchConfigChanges } from 'bot/lib/botConfig'
import minimist from 'minimist'

let opskinsClient = null

const recentPurchases = {}
const cachedSales = {}

const OP_TOTP = process.env.OP_TOTP || ''
logger.info(`OP_TOTP: ${OP_TOTP}`)

const pollInterval = 5000
let lastPoll = 0
let pollTimer = 0

function onPurchaseOrder(msg) {
  const ch = amqpCh()
  const purchaseOrderId = msg.content.toString()

  function giveError(rawError, friendlyError, update = {}) {
   if(!friendlyError) {
      friendlyError = rawError
    }

    logger.error('onPurchaseOrder', purchaseOrderId, rawError)

    PendingOffers
      .get(purchaseOrderId)
      .update({
        ...update,

        rawError,
        friendlyError,

        state: 'ERROR'
      }, { returnChanges: true })
      .run()
      .then(({ replaced, changes }) => {
        if(replaced > 0) {
          publishNotification(changes[0].new_val)
        }
      })

    ch.nack(msg, false, false)
  }

  co(function* () {
    const [ purchaseOrder ] = yield PendingOffers
      .getAll(purchaseOrderId)
      .filter({ state: 'QUEUED' })

    if(!purchaseOrder) {
      logger.error('onPurchaseOrder', 'could not find order', purchaseOrderId)
      ch.nack(msg, false, false)
      return
    }

    const itemByName = _.countBy(purchaseOrder.itemNames)
    const unavailableItemCounts = _.countBy(purchaseOrder.itemNames)

    const allItems = _
      .chain(yield Items.getAll(r.args(Object.keys(itemByName)), { index: 'name' }))
      .map(item => [item.name, item])
      .object()
      .value()

    if(Object.keys(allItems).length !== Object.keys(itemByName).length) {
      return giveError('Cannot find all items', {
        unavailableItemNames: purchaseOrder.itemNames
      })
    }

    const cachedItemListings = yield new Promise((resolve, reject) => {
      if(typeof purchaseOrder.useListedItems !== 'undefined' && !purchaseOrder.useListedItems) {
        return resolve([])
      }

      mapSeries(Object.keys(itemByName), (itemName, done) => {

        co(function* () {
          const { replaced, changes } = yield ItemListings
            .getAll([ opskinsClient._steamId, itemName ], { index: 'steamIdItemName' })
            .filter(r.row('removed').default(false).eq(false))
            .limit(itemByName[itemName])
            .update({
              removed: r.branch(r.row('removed').default(false).eq(false), true, r.row('removed'))
            }, { returnChanges: true })

          if(replaced <= 0) {
            return done(null, [])
          }

          done(null, _.pluck(changes, 'new_val'))
        })

        .catch(done)

      }, (err, result) => {
        if(!!err) {
          return reject(err)
        }

        resolve(result.reduce((arr, a) => arr.concat(a), []))
      })
    })

    const cachedItems = yield new Promise(resolve => {
      const saleIds = _.pluck(cachedItemListings, 'saleId')

      if(!saleIds.length) {
        return resolve([])
      }

      opskinsClient.returnItemsToInventory(saleIds, err => {
        if(!!err) {
          return resolve([])
        }

        const offersListings = cachedItemListings

        offersListings.forEach(list => {
          itemByName[list.itemName]--
          unavailableItemCounts[list.itemName]--
        })

        ItemListings
          .getAll(r.args(saleIds), { index: 'saleId' })
          .delete()

        resolve(offersListings)
      })
    })

    const sales = yield new Promise((resolve, reject) => {
      mapSeries(Object.keys(itemByName), (itemName, done) => {
        const count = itemByName[itemName]

        if(count <= 0) {
          return done(null, [])
        }

        const item = allItems[itemName]
        const searchName = item.name
        const MAX_BUY_PRICE_MULTIPLIER = 1.20;

        const maxPrice = item.sellPrice * MAX_BUY_PRICE_MULTIPLIER;

        let searchOptions = {
          app: '1912_1',
          search_item: `"${searchName}"`,
          max: maxPrice
        }

        if(item.wear === 5) {
          searchOptions.vanilla = true
        }

        opskinsClient.search(searchOptions, (err, items) => {
          if(!!err) {
            return done(null, [])
          }

          const validItems = items.filter((i) => {
            // console.log('buying', i.market_name, 'for',  i.amount, 'checking <= ', ((item.sellPrice * MAX_BUY_PRICE_MULTIPLIER) * 100))
            return i.amount <= ((item.sellPrice * MAX_BUY_PRICE_MULTIPLIER) * 100) && i.market_name === searchName
              && (typeof recentPurchases[i.id] === 'undefined')
          })

          if (items.length && validItems.length == 0) {
            console.log('setting redis', `outofstock:${items[0].market_name}`)
            redis.setAsync(`outofstock:${items[0].market_name}`, true, 'EX', 60*60*2)
          }

          items = validItems.slice(0, count)

          for(let item of items) {
            recentPurchases[item.id] = Date.now()
          }

          done(null, items)
        })
      }, (err, sales) => {
        if(!!err) {
          return reject(err)
        }

        resolve(sales.reduce((arr, a) => arr.concat(a), []))
      })
    })

    const saleIds = _.pluck(sales, 'id')

    if(!saleIds.length && !cachedItems.length) {
      return giveError('Cannot find any sales', 'Items are currently out of stock', {
        unavailableItemNames: purchaseOrder.itemNames
      })
    }

    const receipt = {
      subtotal: cachedItems.reduce((t, i) => t + allItems[i.itemName].sellPrice, 0),
      saleIds: _.pluck(cachedItems, 'saleId'),
      sales: cachedItems.map(item => ({
        name: item.itemName,
        saleId: item.saleId,
        itemId: item.saleId,
        fromCache: true
      }))
    }

    if(saleIds.length > 0) {
      const saleTotal = sales.reduce((t, s) => t + s.amount, 0)

      yield new Promise((resolve, reject) => {
        let maxPurchaseAttempts = 0
        let purchaseAttempts = 0

        function purchase() {
          opskinsClient.buyItems(saleIds, saleTotal, (err, response) => {
            if(!!err) {

              if(err.message.indexOf('wait until your previous purchase attempt completes') >= 0) {
                maxPurchaseAttempts = 3
              }

              if(maxPurchaseAttempts === 0 || purchaseAttempts >= maxPurchaseAttempts) {
                logger.error('onPurchaseOrder', 'buyItems', err.message, err, err.ray)
                receipt.purchaseError = err.message
                return resolve()
              }

              purchaseAttempts++
              setTimeout(purchase, 800)
              return
            }

            receipt.sales.push(...response.map(i => ({
              name: i.name,
              saleId: i.saleid,
              itemId: i.new_itemid
            })))

            for(let sale of response) {
              unavailableItemCounts[sale.name]--
            }

            receipt.subtotal += (saleTotal / 100)
            resolve()
          })
        }

        purchase()
      })
    }

    if(!receipt.sales.length && !cachedItems.length) {
      return giveError('Cannot find any receipt sales', 'Items are currently unavailable', {
        receipt,
        unavailableItemNames: purchaseOrder.itemNames
      })
    }

    const unavailableItemNames = Object
      .keys(unavailableItemCounts)
      .map(k => Array.from({ length: unavailableItemCounts[k] }, () => k))
      .reduce((arr, a) => arr.concat(a), [])

    const purchasedItemNames = _.pluck(receipt.sales, 'name')

    receipt.itemNames = purchasedItemNames

    const { replaced, changes } = yield PendingOffers
      .get(purchaseOrderId)
      .update({
        bot: opskinsClient._steamId,
        receipt,
        unavailableItemNames,

        state: 'PENDING',
        hasReceipt: true,
        purchasedAt: r.now(),
        pendingAt: r.now(),

        purchaseElapsed: r.now().sub(r.row('startedAt'))
      }, { returnChanges: true })

    if(replaced > 0) {
      publishNotification(changes[0].new_val)
    }

    ch.ack(msg)
  })

  .catch(err => {
    logger.error('onPurchaseOrder', err)
    giveError(err.message || err, 'An internal error occurred')
  })
}

function getSales(page = 1, opts = {}) {
  return new Promise((resolve, reject) => {
    opskinsClient.getSales({
      page,
      type: 2,

      ...opts
    }, (err, pages, sales) => {
      if(!!err) {

        if(err.message.indexOf('No matching sales were found on your account.') >= 0) {
          return resolve({
            pages: 1,
            sales: []
          })
        }

        return reject(err)
      }

      return resolve({
        pages,
        sales
      })
    })
  })
}

function cacheSales() {
  return co(function* () {
    const { pages, sales } = yield getSales()

    for(let page = 2; page <= pages; page++) {
      let { sales: pageSales } = yield getSales(page)
      sales.push(...pageSales)
    }

    const cachedListings = yield ItemListings.getAll(opskinsClient._steamId, { index: 'steamId' })
    const tasks = []

    // Out with the old...
    const removed = cachedListings.filter(listing =>
      !_.findWhere(sales, { id: listing.saleId })
    )

    if(removed.length > 0) {
      const removedSaleIds = _.pluck(removed, 'saleId')

      yield ItemListings
        .getAll(r.args(removedSaleIds), { index: 'saleId' })
        .update({ removed: true })

      const lowestSaleId = removed.reduce((lowest, listing) => listing.saleId < lowest ? listing.saleId : lowest, removed[0].saleId)

      let { sales: completedSales } = yield getSales(1, {
        type: 4,
        after_saleid: lowestSaleId - 1
      })

      const soldSales = completedSales.filter(sale => removedSaleIds.indexOf(sale.id) >= 0)
      const soldSalesIds = _.pluck(soldSales, 'id')
      const soldSalesValue = soldSales.reduce((t, s) => t + s.price, 0) / 100

      if(soldSalesValue > 0) {
        logger.info('Sold', soldSales.length, 'items for', numeral(soldSalesValue).format('$0,0.00'))
      }

      yield ItemListings
        .getAll(r.args(soldSalesIds), { index: 'saleId' })
        .delete()

      yield addStats({
        counters: {
          totalItemsSold: soldSales.length,
          totalItemSoldValue: soldSalesValue,
        }
      })
    }

    // & in with the new =]

    const added = sales.filter(sale =>
      !_.findWhere(cachedListings, { saleId: sale.id })
    )

    if(added.length > 0) {
      logger.info('Adding', added.length, 'listings')
    }

    for(let sale of sales) {
      tasks.push((sale => done => {
        const update = {
          id: `${opskinsClient._steamId}-${sale.id}`,
          saleId: sale.id,
          itemName: sale.name,
          price: sale.price / 100,
          steamId: opskinsClient._steamId,
          listedAt: new Date(sale.list_time * 1000),
          lastUpdatedAt: new Date(sale.last_updated * 1000),
        }

        ItemListings
          .get(update.id)
          .replace(s => r.branch(s.eq(null), update, s.merge(update)))
          .run()
          .then(() => done(), done)
      })(sale))
    }

    yield new Promise((resolve, reject) =>
      parallelLimit(tasks, 250, err => {
        if(!!err) {
          return reject(err)
        }

        resolve()
      })
    )

    const totalValue = (sales.reduce((t, s) => t + s.price, 0) / 100) * 0.95
    logger.info('Updated', sales.length, `(${numeral(totalValue).format('$0,0.00')})`, 'listings!')

    setTimeout(cacheSales, 60 * 1000)
  })

  .catch(err => {
    logger.error('cacheSales', err)
    setTimeout(cacheSales, 15000)
  })
}

async function withdrawPendingItems() {
  const pendingOffers = await PendingOffers
    .getAll('PENDING', { index: 'state' })

  const pendingItemsCount = pendingOffers
    .map(o => o.receipt.sales.length)
    .reduce((n, i) => n + i, 0)

  logger.info('withdrawPendingItems', pendingOffers.length, 'pending offers', `(${pendingItemsCount} items)`)

  if(pendingItemsCount <= 0) {
    return
  }

  const inventory = await new Promise((resolve, reject) =>
    opskinsClient.getInventory2((e, r) => !!e ? reject(e) : resolve(r.items))
  )

  const pendingOffersByProvider = _.groupBy(pendingOffers, 'providerId')

  let inventoryItemIds = inventory
    .filter(i => (!i.offer_id) && !i.requires_support && !i.can_repair)
    .map(i => i.id)

  for(let providerId in pendingOffersByProvider) {
    let itemIds = (await PendingOffers
      .getAll(r.args(inventoryItemIds), { index: 'receiptSaleIds' })
      .filter({ providerId })
      .map(o => o('receipt')('sales').map(s => s('itemId')))).reduce((arr, a) => arr.concat(a), [])

    let availableItemIds = inventory
      .filter(i => itemIds.indexOf(i.id) >= 0 && (!i.offer_id) && !i.requires_support && !i.can_repair)
      .map(i => i.id)
      .slice(0, 50)

    logger.info('withdrawPendingItems', 'withdrawing', availableItemIds.length, 'to', providerId)

    if(!availableItemIds.length) {
      continue
    }

    let bot = await Bots.get(providerId)

    if(!bot) {
      logger.info('withdrawPendingItems', 'cannot find bot', providerId)
      continue
    }

    try {
      await withdrawItems(availableItemIds, _.pick(bot, 'id', 'tradeToken'))
    } catch(e) {
      logger.error('withdrawPendingItems', 'withdrawItems', providerId, e)
    }
  }

  logger.info('withdrawPendingItems', 'complete')
}

async function withdrawItems(itemIds, bot) {
  logger.info('withdrawItems', itemIds.join(','), bot)

  const { opskins } = botConfig()

  if(opskins.isMaster) {
    return new Promise((resolve, reject) =>
      opskinsClient.withdrawInventoryItemsOther(itemIds.join(','), bot.id, bot.tradeToken, (err, res) =>
        !!err ? reject(err) : resolve(res)
      )
    )
  }

  return new Promise((resolve, reject) =>
    opskinsClient.withdrawInventoryItems(items, (err, res) =>
      !!err ? reject(err) : resolve(res)
    )
  )
}

function withdrawOPInventory() {
  return co(function* () {
    const inventory = yield new Promise((resolve, reject) =>
      opskinsClient.getInventory2((e, r) => !!e ? reject(e) : resolve(r.items))
    )

    const pendingOffers = yield PendingOffers
      .getAll('PENDING', { index: 'state' })
  })

  .catch(err => {
    logger.error('withdrawOPInventory', err)
    setTimeout(withdrawOPInventory, 60000)
  })
}

let lastProviderId = ''

function withdrawInventoryItems(itemIds) {
  co(function* () {
    let providerId = ''

    const [ pendingOffer ] = yield PendingOffers.getAll(r.args(itemIds), { index: 'receiptSaleIds' })

    if(!!pendingOffer && pendingOffer.providerId) {
      providerId = pendingOffer.providerId
    } else {
      logger.error('withdrawInventoryItems', 'cannot find items', itemIds.join(', '))
    }

    if(!providerId.length) {
      return
    }

    const bot = yield Bots.get(providerId)

    if(!bot) {
      logger.error('withdrawInventoryItems', 'cannot find bot', providerId)
      return
    }

    lastProviderId = providerId

    logger.info('withdrawInventoryItems', bot.id, itemIds.join(','))

    yield new Promise((resolve, reject) =>
      opskinsClient.withdrawInventoryItemsOther(itemIds.join(','), bot.id, bot.tradeToken, (err, res) =>
        !!err ? reject(err) : resolve(res)
      )
    )
  })

  .catch(err => {
    logger.error('withdrawInventoryItems', itemIds.join(','), err)
  })
}

function manageSales() {
  co(function* () {
    const lowestPricesPUBG = yield new Promise((resolve, reject) =>
      opskinsClient.getLowestPrices(1912, (err, prices) =>
        !!err ? reject(err) : resolve(prices)
      )
    )

    const pricesByName = _.indexBy(yield Items.run(), 'name')

    const { pages, sales } = yield getSales()

    if(pages > 1) {
      for(let page = 2; page <= pages; page++) {
        let { sales: pageSales } = yield getSales(page)
        sales.push(...pageSales)
      }
    }

    const updatedPrices = []

    for(let sale of sales) {
      let v = yield redis.getAsync(`skne:op:priceUpdate:${sale.id}`)
      if(!!v) {
        continue
      }

      let hoursSinceList = Math.abs(moment() - moment.unix(sale.list_time)) / 1000.0 / 60 / 60;
      let hourSinceUpdate = moment().subtract(1, 'hours').toISOString() > moment.unix(sale.last_updated).toISOString()
      if (sale.price === 2) { continue; }
      if (pricesByName[sale.name] && hourSinceUpdate >= 1) {
        const hourlyDiscount = 0.0050; // 20% per day
        const sellPrice = pricesByName[sale.name].sellPrice
        const OPSKINS_MULTIPLIER = 100; // cents multiplier
        let sellPriceDiscounted;
        if (pricesByName[sale.name].blocked || pricesByName[sale.name].unstable) {
          sellPriceDiscounted = Math.round(sellPrice * (1 - hourlyDiscount * hoursSinceList) * OPSKINS_MULTIPLIER) // dont go any lower than deposit price which is the lowest price anyway based on our algorithm
        // if we've been trying to sell it forever, slightly discount it below lowest at 1% per day
        } else {
          const hourlyLowestDiscount = hourlyDiscount / 20;
          sellPriceDiscounted = Math.round(lowestPricesPUBG[sale.name].price * (1 - hourlyLowestDiscount * hoursSinceList))
          console.log('lowest price for', sale.name, lowestPricesPUBG[sale.name].price, 'hours', hoursSinceList)
        }
        yield ItemSales.getAll(sale.id, {index: 'saleId'}).update({price: sellPriceDiscounted}).run()
        // console.log('discounting sale', sale.id, sale.name, 'from', sale.price, 'to', sellPriceDiscounted);
        updatedPrices.push([ sale.id, Math.max(2,  sellPriceDiscounted)])
      }
    }

    if(updatedPrices.length <= 0) {
      return setTimeout(manageSales, 15000)
    }

    // Don't update again for a while
    for(let k of updatedPrices) {
      yield redis.setAsync(`skne:op:priceUpdate:${k[0]}`, Date.now(), 'EX', 60 * 60)
    }

    for(let i = 0; i < Math.ceil(updatedPrices.length / 450); i++) {
      let startIndex = i * 450
      let sales = updatedPrices.slice(startIndex, startIndex + 450)

      yield new Promise((resolve, reject) => {
        opskinsClient.editPrices(_.object(sales), (err, res) =>
          !!err ? reject(err) : resolve(res)
        )
      })
    }

    logger.info('manageSales', 'updated', updatedPrices.length, 'active sales')
    setTimeout(manageSales, 30000)
  })

  .catch(err => {
    logger.error('manageSales', err)
    setTimeout(manageSales, 60000)
  })
}

async function onDepositMessage(message) {
  const id  = message.content.toString()

  const [ tradeOffer ] = await TradeOffers
    .getAll(id)
    .filter({
      type: TRADE_TYPE_DEPOSIT,
      state: TRADE_STATE_QUEUED
    })

  if(!tradeOffer) {
    amqpCh().ack(message)
    return
  }

  let result

  try {
    result = await new Promise((resolve, reject) => {
      request({
        method: 'POST',
        url: `${config.opskins.trade.baseUrl}/ITrade/SendOfferToSteamId/v1/`,
        json: true,
        form: {
          key: opskinsClient.key,
          twofactor_code: speakeasy.totp({
            secret: OP_TOTP,
            encoding: 'base32'
          }),
          steam_id: tradeOffer.steamId64,
          items: tradeOffer.assetIds.join(',')
        }
      }, (err, res, body) => {
        if(!!err) {
          return resolve({
            error: err.message || 'Unknown error'
          })
        }

        if(!!body && !!body.status && body.status !== 1) {
          return resolve({
            error: body.message || 'Unknown error'
          })
        }

        resolve({ offer: body.response.offer })
      })
    })
  } catch(e) {
    logger.error('onDepositMessage', tradeOffer.id, e.message)
    amqpCh().ack(message)
    return
  }

  if(!!result.error) {
    TradeOffers
      .get(tradeOffer.id)
      .update({
          bot: botConfig().steamId,
          state: TRADE_STATE_DECLINED,
          hasError: true,
          error: result.error,
          offerId: null,
          tradeOfferId: tradeOffer.id
      }, { returnChanges: true })
      .run()
      .then(({ replaced, changes }) => {
        if(replaced > 0) {
          publishNotification(changes[0].new_val, 'trade.OnTradeOfferStateChange')
        }
      })

    amqpCh().ack(message)
    return
  }

  const { offer } = result

  TradeOffers
    .get(tradeOffer.id)
    .update({
      bot: botConfig().steamId,
      state: TRADE_STATE_SENT,
      offerId: offer.id,
      tradeOfferUrl: `https://trade.opskins.com/trade-offers#${offer.id}/`
    }, { returnChanges: true })
    .run()
    .then(({ replaced, changes }) => {
      if(replaced > 0) {
        publishNotification(changes[0].new_val, 'trade.OnTradeOfferStateChange')
      }
    })

  logger.info('onDepositMessage', tradeOffer.id, 'has been sent to', tradeOffer.steamId64, `($${tradeOffer.subtotal})`)
  amqpCh().ack(message)
}

function resetPollTimer() {
  lastPoll = Date.now()
  clearTimeout(pollTimer)
}

function getOffers(page, qs = {}) {
  return new Promise((resolve, reject) => {
    request({
      url: `${config.opskins.trade.baseUrl}/ITrade/GetOffers/v1/`,
      json: true,
      qs: {
        key: opskinsClient.key,
        ...qs
      }
    }, (err, res, body) => {
      if(!!err) {
        return reject(err)
      } else if(!!body && !!body.message) {
        return reject(body.message)
      }

      resolve({
        ...body.response,
        current_page: body.current_page,
        total_pages: body.total_pages
      })
    })
  })
}

async function pollTrades() {
  resetPollTimer()

  const tradeOfferIds = await TradeOffers
    .getAll('QUEUED', 'SENT', { index: 'state' })
    .filter(r.row('bot').eq(botConfig().steamId).and(r.row('offerId').eq(null).ne(null)))
    .map(t => t('offerId'))

  const pendingOfferIds = await PendingOffers
    .getAll('SENT', { index: 'state' })
    .filter(r.row('providerId').eq(botConfig().steamId).and(r.row('offerId').eq(null).ne(null)))
    .map(t => t('offerId'))

  const ids = tradeOfferIds.concat(pendingOfferIds)

  if(!ids.length) {
    resetPollTimer()
    pollTimer = setTimeout(pollTrades, pollInterval)
    return
  }

  const state = '3,5,6,7,8'

  try {
    let { offers, current_page, total_pages } = await getOffers(1, {
      state,
      ids: ids.join(',')
    })

    if(total_pages > 1) {
      for(let page = 2; page <= total_pages; page++) {
        const more = await getOffers(page, {
          state,
          ids: ids.join(',')
        })

        offers.push(...more.offers)
      }
    }

    const declinedStates = [
      5, 6, 7, 8
    ]

    for(let offer of offers) {
      const isWithdraw = pendingOfferIds.indexOf(offer.id) >= 0

      let newState = null

      if(offer.state === 3) {
        newState = TRADE_STATE_ACCEPTED
      } else if(declinedStates.indexOf(offer.state) >= 0) {
        newState = TRADE_STATE_DECLINED
      } else {
        logger.error('pollTrades', 'cannot handle state', offer.state, 'for offer', offer.id)
        continue
      }

      if(isWithdraw) {
        let pendingOfferUpdate = {}
        console.log(offer.id, newState)

        if(newState === TRADE_STATE_ACCEPTED) {
          pendingOfferUpdate = {
            state: TRADE_STATE_ACCEPTED,
            acceptedAt: new Date()
          }
        } else if(newState === TRADE_STATE_DECLINED) {
          pendingOfferUpdate = {
            state: TRADE_STATE_DECLINED,
            hasTradeOfferError: false,
            retry: true
          }
        }

        if(Object.keys(pendingOfferUpdate).length > 0) {
          const result = await PendingOffers
            .getAll(offer.id, { index: 'offerId' })
            .update(pendingOfferUpdate, { returnChanges: true })

          if(result.replaced > 0) {
            publishNotification(result.changes[0].new_val)
          }
        }

        continue
      }

      const update = {
        state: newState,
        rawState: offer.state,
        meta: r.row('meta').default({})
      }

      const { replaced, changes }  = await TradeOffers
        .getAll(offer.id, { index: 'offerId' })
        .update(r.branch(r.row('state').ne(newState), update, {}), { returnChanges: true })

      if(replaced === 0) {
        continue
      }

      const tradeOffer = changes[0].new_val

      if(tradeOffer.state === TRADE_STATE_ACCEPTED) {
        redis.del(`inventory:${tradeOffer.steamId64}`)

        if(offer.recipient.items.length > 0) {
          const itemCache = {}
          const acceptedItems = []
          const acceptedItemIds = []

          for(let item of offer.recipient.items) {
            let description = itemCache[item.name] || null

            if(!description) {
              description = (await Items
                .getAll(item.name, { index: 'name' }))[0]
            }

            if(!description) {
              logger.error('pollTrades', 'cannot find item', item.name, 'from offer', offer.id)
              break
            }

            itemCache[item.name] = description

            const newItem = {
              ..._.pick(description, 'name', 'assetId', 'nameColor', 'tokens', 'basePrice', 'price', 'wear', 'icon', 'cleanName'),

              offerId: offer.id,
              bot: botConfig().steamId,
              createdAt: new Date(),
              state: BOT_ITEM_STATE_AVAILABLE,
              assetId: item.id,
              name: item.name,
              type: null,
              groups: botConfig().groups
            }

            const existsCount = await BotItems
              .getAll(item.id, { index: 'assetId' })
              .filter({ offerId: offer.id })
              .count()

            if(existsCount > 0) {
              logger.info('pollTrades', 'item', item.name, item.id, 'already has been inserted from offer', offer.id)
              continue
            }

            const { generated_keys, inserted } = await BotItems.insert(newItem)

            if(inserted === 0) {
              logger.info('pollTrades', 'item', item.name, item.id, 'inserted === 0 from offer', offer.id)
              continue
            }

            acceptedItems.push({
              ..._.pick(description, 'name', 'assetId', 'nameColor', 'basePrice', 'price', 'wear', 'icon', 'cleanName'),
              assetId: item.id,
              botItemId: generated_keys[0]
            })
          }

          const updateResult = await TradeOffers
            .getAll(offer.id, { index: 'offerId' })
            .update({
              botItemIds: _.pluck(acceptedItems, 'botItemId'),
              items: acceptedItems,
              // itemState: 'INSERTED',
              assetIds: _.pluck(acceptedItems, 'assetId')
            }, { returnChanges: true })

          if(updateResult.replaced > 0) {
            publishNotification(updateResult.changes[0].new_val, 'trade.OnTradeOfferStateChange')
          }
        }
      }

      if(tradeOffer.state !== TRADE_STATE_ACCEPTED) {
        publishNotification(tradeOffer, 'trade.OnTradeOfferStateChange')
      }
    }

    lastPoll = Date.now()
    pollTimer = setTimeout(pollTrades, pollInterval)
  } catch(e) {
    logger.error('pollTrades', e)

    resetPollTimer()
    pollTimer = setTimeout(pollTrades, pollInterval)
  }
}

function transferToOP(itemIds) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: `${config.opskins.trade.baseUrl}/IItem/WithdrawToOpskins/v1/`,
      json: true,
      form: {
        key: opskinsClient.key,
        item_id: itemIds.join(',')
      }
    }, (err, res, body) => {
      if(!!err) {
        return reject(err.message || 'Unknown error')
      }

      if(!!body && !!body.status && body.status !== 1) {
        return reject(body.message || 'Unknown error')
      }

      resolve(body.response)
    })
  })
}

async function getTradeInventory(opts = {}) {
  return new Promise((resolve, reject) => {
    request({
      url: `${config.opskins.trade.baseUrl}/IUser/GetInventory/v1/`,
      json: true,
      qs: {
        ...opts,

        key: opskinsClient.key,
        app_id: 1
      }
    }, (err, res, body) => {
      if(!!err) {
        return reject(err.message || 'Unknown error')
      }

      if(!!body && !!body.status && body.status !== 1) {
        return reject(body.message || 'Unknown error')
      }

      resolve(body.response)
    })
  })
}

async function listTradeItems() {
  try {
    const inventory = await getTradeInventory()
    const inventoryItems = _.pluck(inventory.items, 'id').slice(0, 25)

    if(inventoryItems.length > 0) {
      const { results: { response: { sales } } } = await transferToOP(inventoryItems)
      const saleIds = _.pluck(sales, 'id')
      const saleNames = _.uniq(_.pluck(sales, 'market_hash_name'))

      const itemDescriptions = _
        .chain(await Items.getAll(r.args(saleNames), { index: 'name' }))
        .map(item => [item.name, item])
        .object()
        .value()

      const listItems = {}

      for(let sale of sales) {
        const description = itemDescriptions[sale.market_hash_name] || null

        if(!description) {
          logger.info('listTradeItems', 'could not find item', sale.market_hash_name, sale.id)
          continue
        }

        if(description.sellPrice < 0.02) {
          continue
        }

        listItems[sale.id] = Math.max(2, parseInt((description.sellPrice * 1.02) * 100))
      }

      logger.info('listTradeItems', 'transfering and listing', Object.keys(listItems).length, 'of', sales.length, 'item(s) for sale')

      await new Promise((resolve, reject) => {
        opskinsClient.editPrices(listItems, (err, res) =>
          !!err ? reject(err) : resolve(res)
        )
      })
    }

    setTimeout(listTradeItems, 5000)
  } catch(e) {
    logger.error('listTradeItems', e)
    setTimeout(listTradeItems, 5000)
  }
}

async function sendPendingOffers() {
  const pendingOffers = await PendingOffers
    .getAll(TRADE_STATE_PENDING, { index: 'state' })
    .filter({ bot: botConfig().steamId, hasReceipt: true })

  if(!pendingOffers.length) {
    return setTimeout(sendPendingOffers, 5000)
  }

  const inventory = await new Promise((resolve, reject) =>
    opskinsClient.getInventory2((e, r) => !!e ? reject(e) : resolve(r.items))
  )

  const tradeInventory = await getTradeInventory()
  const inventoryItemIds = _.pluck(inventory, 'id')

  const available = _
    .chain(tradeInventory.items)
    .groupBy('name')
    .value()

  for(let offer of pendingOffers) {
    // Check if some of the items are in op inventory
    const foundInInventory = inventoryItemIds.filter(i =>
      _.pluck(offer.receipt.sales, 'itemId').indexOf(i) >= 0
    )

    if(foundInInventory.length) {
      try {
        await opskinsClient.transferToTradeSite(foundInInventory)
      } catch(e) {
        logger.info('sendPendingOffers', 'cannot transfer to trade site', e, {
          foundInInventory
        })
      }
    }

    const unavailable = offer.receipt.itemNames.slice(0)
    const items = []

    for(let itemName of offer.receipt.itemNames) {
      if(!available[itemName] || !available[itemName].length) {
        continue
      }

      let idx = unavailable.indexOf(itemName)
      unavailable.splice(idx, 1)

      let item = available[itemName].splice(0, 1)[0]
      items.push(item.id)

      if(!available[itemName].length) {
        delete available[itemName]
      }
    }

    if(unavailable.length > 0) {
      continue
    }

    try {
      const result = await sendOfferToSteamId(offer.steamId, items)

      if(!!result.error) {
        throw new Error(result.error)
      }

      logger.info('sendPendingOffers', 'offer', result.offer.id, 'has been sent to', offer.steamId)

      const { replaced, changes } = await PendingOffers
        .get(offer.id)
        .update({
          state: 'SENT',
          offerId: result.offer.id
        }, { returnChanges: true })

      if(replaced > 0) {
        publishNotification(changes[0].new_val)
      }
    } catch(e) {
      logger.info('sendPendingOffers', 'cannot send withdraw', items.join(','), 'to', offer.steamId, e)
    }
  }

  return setTimeout(sendPendingOffers, 5000)
}

function sendOfferToSteamId(steamId, items) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: `${config.opskins.trade.baseUrl}/ITrade/SendOfferToSteamId/v1/`,
      json: true,
      form: {
        key: opskinsClient.key,
        twofactor_code: speakeasy.totp({
          secret: OP_TOTP,
          encoding: 'base32'
        }),
        steam_id: steamId,
        items: items.join(',')
      }
    }, (err, res, body) => {
      if(!!err) {
        return resolve({
          error: err.message || 'Unknown error'
        })
      }

      if(!!body && !!body.status && body.status !== 1) {
        return resolve({
          error: body.message || 'Unknown error'
        })
      }

      resolve({ offer: body.response.offer })
    })
  })
}

co(function* () {
  logger.info('SknExchange', 'OPSkins Worker')

  const argv = minimist(process.argv.slice(2), {
    string: ['bot']
  })

  if(!argv.bot) {
    throw new Error('Invalid usage (./workers/opskins --bot [steamid])')
  }

  yield loadBotConfig(argv.bot)
  yield watchConfigChanges()

  const { displayName, opskins, steamId, identifier, groups } = botConfig()

  if(!opskins.enabled) {
    throw new Error('OPSkins is not enabled for ' + identifier)
  }

  opskinsClient = new OPSkinsAPI(opskins.apiKey)
  opskinsClient._steamId = steamId // Compatability

  logger.info('startup', displayName, `(${steamId})`)
  logger.info('master:', opskins.isMaster ? 'Yes' : 'No')
  logger.info('groups:', groups.join(','))

  yield amqpConnect()

  const ch = amqpCh()

  ch.prefetch(2)
  ch.assertExchange('skne.order', 'direct', { durable: true })

  const q = yield ch.assertQueue('skne.provider.opskins', { durable: true })

  if(groups.indexOf('withdraw') >= 0) {
    yield ch.bindQueue(q.queue, 'skne.withdraw', 'opskins')
    // yield ch.bindQueue(q.queue, 'skne.order', 'opskins')
    ch.consume(q.queue, onPurchaseOrder)
  }

  if(groups.indexOf('deposit') >= 0) {
    ch.consume('skne.deposit', onDepositMessage)
  }

  cacheSales()

  if(groups.indexOf('deposit') >= 0 && opskins.autoSellItems) {
    logger.info('Automatically selling items')
    listTradeItems()
  }

  pollTrades()
  sendPendingOffers()
  manageSales()

  setInterval(() => {
    const now = Date.now()
    const keys = Object.keys(recentPurchases)

    for(let i = 0; i < keys.length; i++) {
      const k = keys[i]

      if(now - recentPurchases[k] > 60000) {
        delete recentPurchases[k]
      }
    }
  }, 5000)
})

.catch(err => {
  logger.error('Startup error', err)
})
