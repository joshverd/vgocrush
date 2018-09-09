
import jayson from 'jayson'
import config from 'config'
//import he from 'he'
import url from 'url'
import co from 'co'

import r from './database'
import redis from './redis'

export const database = r.db(config.sknexchange.database)
export const Items = database.table('Items')
export const ItemListings = database.table('ItemListings')
export const BotItems = database.table('BotItems')
export const PendingOffers = database.table('PendingOffers')
export const TradeOffers = database.table('TradeOffers')
export const Bots = database.table('Bots')

const options = url.parse(config.sknexchange.rpcUrl)
const client = jayson.client[options.protocol.substring(0, options.protocol.length - 1)]({
  ...options,

  headers: {
    'x-api-key': config.sknexchange.apiKey,
  },

  replacer: (key, value) => {
    return value
  }
})

function doRequest(method, args) {
  return new Promise((resolve, reject) => {
    client.request(method, args, (err, response) => {
      console.log(method, args, err)
      if(!!err || !!response.error) {
        return reject(err || response.error)
      }

      resolve(response.result)
    })
  })
}

// lookupSteamOffer
export function lookupSteamOffer(params) {
  return doRequest('offers.steamLookup', [params])
}

// virtualWithdraw
export function virtualWithdraw(params) {
  return doRequest('inventory.virtualWithdraw', [{
    ...params,
    notifyUrl: config.sknexchange.notifyUrl
  }])
}

// resendOfferNotification
export function resendOfferNotification(params) {
  return doRequest('offers.resendNotification', [params])
}

// getPendingOffers
export function getPendingOffers(params) {
  return doRequest('offers.pending', [params])
}

// retryOffer
export function retryOffer(params) {
  return doRequest('offers.retry', [params])
}

// retryVirtualOffer
export function retryVirtualOffer(params) {
  return doRequest('offers.retryVirtual', [params])
}

// runBotExecute
export function runBotExecute(method, ...params) {
  return doRequest('bot.execute', [{ method, params }])
}

// opskinsPurchase
export function opskinsPurchase(itemNames, maxItems) {
  return doRequest('opskins.purchase', {
    itemNames,
    maxItems
  })
}

// searchItems
export function searchItems(query) {
  return new Promise((resolve, reject) => {
    client.request('items.search', [{ query }], function(err, result) {
      if(err || result.error) {
        return reject(err || result.error)
      }

      resolve(result)
    })
  })
}

// getItems
export function getItems(itemNames, options = {}, cache) {
  itemNames = itemNames.filter(name => name !== 'Money')

  return co(function* () {
    const items = []

    if(typeof cache === 'undefined' || cache) {
      for(let i = itemNames.length - 1; i >= 0; i--) {
        let key = `kingdom:item:${itemNames[i]}`
        let cached = yield redis.getAsync(key)
        let ttl = yield redis.ttlAsync(key)

        if(cached && ttl > 0) {
          items.push(JSON.parse(cached))
          itemNames.splice(i, 1)
        }
      }
    }

    if(itemNames.length) {
      let query = Items
        .getAll(r.args(itemNames), {
          index: !!options.byCleanName && options.byCleanName ? 'cleanName' : 'name'
        })

      if(options.includeBotItemCount) {
        query = query.map(item =>
          item.merge({
            botItemCount: BotItems.getAll(item('name'), { index: 'name' }).filter({ state: 'AVAILABLE' }).count()
          })
        )
      }

      const uncached = yield query

      for(let item of uncached) {
        let key = `kingdom:item:${item.name}`
        yield redis.setAsync(key, JSON.stringify(item))
        redis.expire(key, 300)
      }

      items.push(...uncached)
    }

    return items
  })

  // console.log(itemNames)
  // return new Promise((resolve, reject) => {
  //   client.request('items.getAll', [{ itemNames, options }], function(err, response) {
  //     if(err || response.error) {
  //       return reject(err || response.error)
  //     }
  //
  //     resolve(response.result)
  //   })
  // })
}

export function getBots() {
  return Bots.filter({ state: 'Available' }).map(bot =>
    bot.merge({
      itemCount: BotItems.getAll(bot('steamId64'), { index: 'bot' }).count(),
      estimatedValue: BotItems
        .getAll(bot('steamId64'), { index: 'bot' })
        .eqJoin('name', Items, { index: 'name' })
        .zip()
        .sum('price')
    })
  )
}

// withdraw
export function withdraw(params, options = {}) {
  return new Promise((resolve, reject) => {
    client.request('inventory.withdraw', [params], function(err, response) {
      if(err || response.error) {
        return reject(err || response.error)
      }

      resolve(response.result)
    })
  })
}

// restockItems
export function restockItems(itemName, amount) {
  return new Promise((resolve, reject) => {
    client.request('inventory.restock', [{ itemName, amount }], function(err, response) {
      if(err || response.error) {
        return reject(err || response.error)
      }

      resolve(response.result)
    })
  })
}

// fetchInventory
export function fetchInventory(id, options = {}) {
  return new Promise((resolve, reject) => {
    client.request('opskins.remoteInventory', [{ steamId: id, details: true, ...options }], function(err, result) {
      if(err || result.error) {
        return reject(err || result.error)
      }

      resolve(result.result)
    })
  })
}

// deposit
export function deposit(params) {
  return new Promise((resolve, reject) => {
    client.request('inventory.deposit', [params], function(err, result) {
      console.log(err)
      console.log(result)
      if(err || result.error) {
        return reject(err || result.error)
      }

      resolve(result)
    })
  })
}

// storeItems
export function storeItems(params) {
  return new Promise((resolve, reject) => {
    client.request('inventory.store', [{
      ...params,
      notifyUrl: config.sknexchange.notifyUrl
    }], function(err, result) {
      if(err || result.error) {
        return reject(err || result.error)
      }

      resolve(result)
    })
  })
}

export function formatPendingOffer(offer) {
  const itemNames = offer.hasReceipt ? offer.receipt.itemNames : offer.itemNames
  const subtotal = !!offer.meta.subtotal ? offer.meta.subtotal : offer.hasReceipt ? offer.receipt.subtotal : offer.subtotal

  return {
    itemNames,
    subtotal,
    unavailableItemNames: offer.unavailableItemNames || [],

    createdAt: offer.createdAt,
    tradeOfferId: offer.tradeOfferId,
    id: offer.id,
    state: offer.state,
    tradeOfferUrl: offer.tradeOfferUrl,
    retry: offer.retry,
  }
}

export default {
  Items
}
