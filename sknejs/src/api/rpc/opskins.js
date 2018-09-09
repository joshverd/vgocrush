
import co from 'co'
import _ from 'underscore'
import r from 'rethinkdb'
import { mapSeries } from 'async'
import request from 'request'

import { connection } from '../../lib/database'
import { Items } from '../../lib/documents'
import Bots from 'document/bot'
import opskins, { OPSkinsAPI } from '../../lib/opskins'
import { decryptString } from 'lib/rsa'
import redis from 'lib/redis'
import { canAcceptItem } from 'lib/bot'

import Items2 from 'document/item'
import r2 from 'lib/database'

import config from 'config'

const client = opskins[0]

function* purchase([{ itemNames, maxPrice }]) {
  const itemCounts = _.countBy(itemNames, name => name)

  for(let k in itemCounts) {
    if(itemCounts[k] > 100) {
      return Promise.reject('Maximum amount of purchases per item is 100')
    }
  }

  const allItems = _
    .chain(yield Items
      .getAll(r.args(_.uniq(itemNames)), { index: 'name' })
      .coerceTo('array')
      .run(connection())
    )
    .map(item => [item.name, item])
    .object()
    .value()

  const totalBasePrice = itemNames.reduce((t, n) => t + allItems[n].basePrice, 0)

  // const balance = yield new Promise((resolve, reject) => {
  //   client.getBalance((err, balance) => !!err ? reject(err) : resolve(balance / 100))
  // })
  //
  // if(balance < totalBasePrice) {
  //   return Promise.reject({
  //     message: `Not funds (${balance} < ${totalBasePrice})`,
  //     unavailableName: itemNames,
  //     unavailableItemNames: itemNames.map(itemName => {
  //       const item = allItems[itemName]
  //
  //       return {
  //         name: item.name,
  //         basePrice: item.basePrice,
  //         price: item.price,
  //       }
  //     })
  //   })
  // }

  if(!Object.keys(allItems).length) {
    return Promise.reject({
      message: 'Cannot find items',
      itemNames: [],
      unavailableItemNames: itemNames,
      unavailableItems: itemNames.map(itemName => {
        const item = allItems[itemName]

        return {
          name: item.name,
          basePrice: item.basePrice,
          price: item.price,
        }
      })
    })
  } else if(_.uniq(itemNames).length !== Object.keys(allItems).length) {
    return Promise.reject({
      message: 'Item length mismatch',
      itemNames: [],
      unavailableItemNames: itemNames,
      unavailableItems: itemNames.map(itemName => {
        const item = allItems[itemName]

        return {
          name: item.name,
          basePrice: item.basePrice,
          price: item.price,
        }
      })
    })
  }

  const itemsOnSale = yield new Promise((resolve, reject) => {
    mapSeries(_.uniq(itemNames), (itemName, done) => {
      const amount = itemCounts[itemName]

      // Don't even know why this would ever be true
      if(amount <= 0) {
        return done(null, [itemName, []])
      }

      const item = allItems[itemName]
      if(item.extra) { // Temp
        return done(null, [itemName, []])
      }

      let searchName = itemName
      let options = {}

      // Custom searching for opskins
      if(!!item.opskins) {
        searchName = item.opskins.name
        options = item.opskins.options
      }

      if(item.wear === 5) {
        options.vanilla = true
      }

      // var maxPrice = 0;
      // maxPrice = item.basePrice*0.75;
      // if(item.basePrice > 1) {
      //   maxPrice = item.basePrice*0.8
      // }
      // if(item.basePrice > 100) {
      //   maxPrice = item.basePrice*0.85
      // }

      client.search({
        ...options,

        app: '730',
        search_item: `"${searchName}"`,
        max: item.sellPrice*1.15
      }, (err, items) => {
        if(!!err) {
          return done(err)
        }

        const validItems = items.filter(i =>
          i.amount <= item.basePrice * 100 && i.market_name === searchName
        )

        done(null, [itemName, validItems.slice(0, amount)])
      })

    }, (err, itemsOnSale) => !!err ? reject(err) : resolve(_.object(itemsOnSale)))
  })

  const saleItemIdsMap = _
    .chain(itemsOnSale)
    .map((sales, key) => sales.map(s => [ s.id, key ]))
    .reduce((a, s) => a.concat(s), [])
    .object()
    .value()

  const itemsOnSaleCounts = _
    .chain(itemsOnSale)
    .map((sales, key) => [key, sales.length])
    .object()
    .value()

  const unavailableCounts = _
    .chain(itemCounts)
    .map((value, key) => [key, value - (itemsOnSaleCounts[key] || 0)])
    .object()
    .value()

  const unavailableItemNames = _
    .chain(unavailableCounts)
    .map((count, key) => Array.from({ length: count }, () => key))
    .reduce((a, n) => [ ...a, ...n ], [])
    .value()

  const unavailableItems = unavailableItemNames.map(itemName => {
    const item = allItems[itemName]

    return {
      name: item.name,
      basePrice: item.basePrice,
      price: item.price,
    }
  })

  const saleIds = _.reduce(itemsOnSale, (ids, items) => [...ids, ..._.pluck(items, 'id')], [])
  const saleAmount = _.reduce(itemsOnSale, (total, items) => total + items.reduce((t, i) => t + i.amount, 0), 0)

  if(saleIds.length <= 0) {
    return Promise.reject({
      unavailableItemNames,
      unavailableItems,

      message: 'Could not find items to purchase'
    })
  }

  const buyResponse = yield new Promise((resolve, reject) => {
    client.buyItems(saleIds, saleAmount, (err, response) => {
      if(err) {
        return reject({
          buyItemsError: true,
          noFunds: err.message.indexOf('do not have enough wallet funds to complete this transaction') >= 0,
          message: err.message,
          itemNames: [],
          unavailableItemNames: itemNames,
          unavailableItems: itemNames.map(itemName => {
            const item = allItems[itemName]

            return {
              name: item.name,
              basePrice: item.basePrice,
              price: item.price,
            }
          })
        })
      }

      resolve(response)
    })
  })

  const purchasedItemNames = buyResponse.map(item =>
    saleItemIdsMap[item.saleid]
  )

  return {
    buyResponse,
    saleAmount: saleAmount/100,
    unavailableItemNames,
    unavailableItems,
    itemNames: purchasedItemNames,
    items: buyResponse.map(item => ({
      id: item.new_itemid,
      saleId: item.saleid,
      name: item.name,
      botId: item.bot_id
    }))
  }
}

function* withdraw([{ itemIds }]) {
  return yield new Promise((resolve, reject) =>
    client.withdrawInventoryItems(itemIds, (err, response) => {
      !!err ? reject(err) : resolve(response)
    })
  )
}

function* remoteInventory([{ steamId, tradeUrl, discount, refresh, details }]) {
  discount = discount || 0

  const cacheKey = `inventory:${steamId}:${discount}`

  if(!refresh) {
    // Check if this inventory has been cached first
    const cached = yield redis.getAsync(cacheKey)

    if(cached) {
      return JSON.parse(cached)
    }
  }

  const [ bot ] = yield Bots
    .getAll([ 'Available', true ], { index: 'stateOpskinsEnabled' })
    .limit(1)

  if(!bot) {
    return Promise.reject('At least 1 opskins bot must be available')
  }

  const inventory = yield new Promise((resolve, reject) =>
    request({
      url: `${config.opskins.trade.baseUrl}/ITrade/GetUserInventoryFromSteamId/v1/`,
      json: true,
      qs: {
        key: decryptString(bot.opskins.apiKey),
        steam_id: steamId,
        app_id: 1
      }
    }, (err, res, body) => {
      if(!!err) {
        return reject(err)
      }

      resolve(body.response)
    })
  )

  const items = yield Items2
    .getAll(r2.args(_.pluck(inventory.items, 'name')), { index: 'name' })

  const validItems = inventory.items

    .map(({ name, id, trade_hold_expires }) => {
      const item = items.filter(item => item.name === name)

      if(!item.length) {
        return null
      }

      return {
        ...item[0],
        id,
        trade_hold_expires,
        assetId: id,
      }
    })

    .filter(item => !!item)

    .map(item => {
      let price = item.price

      if(discount > 0) {
        price = item.basePrice * discount
        item.tokens = (item.baseTokens * discount)
      }

      return {
        ...item,
        price,
        canAccept: canAcceptItem(item)
      }
    })

  const response = {
    items: validItems,
    cannotAccept: validItems.filter(item => !item.canAccept).length
  }

  // Cache inventory
  redis.set(cacheKey, JSON.stringify(response))
  redis.expire(cacheKey, 600)

  redis.set(`inventoryItems:${steamId}:${discount}`, JSON.stringify(validItems))
  redis.expire(`inventoryItems:${steamId}:${discount}`, 600)

  return response
}

export default {
  purchase,
  withdraw,
  remoteInventory
}
