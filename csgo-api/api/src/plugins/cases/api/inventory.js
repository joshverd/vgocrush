
import co from 'co'
import _ from 'underscore'
import is from 'is_js'
import { mapSeries } from 'async'
import config from 'config'

import { Items, getItems, virtualWithdraw } from 'lib/sknexchange'
import r from 'lib/database'
import redis from 'lib/redis'
import logger from 'lib/logger'
import { ITEM_WEAR } from 'constant/item'
import { givePlayerBalance, logPlayerBalanceChange } from 'document/player'
import { addStats } from 'document/stats'

import { PlayerItems, PLAYER_ITEM_OUT_OF_STOCK, PLAYER_ITEM_AVAILABLE, PLAYER_ITEM_BUSY } from '../documents/player'
import Case, { CaseItems } from '../documents/case'

// GET /api/users/inventory
export function getInventory(req, res) {
  const { user }  = req.user

  co(function* () {
    const playerItems = yield PlayerItems
      .getAll([ req.user.id, PLAYER_ITEM_AVAILABLE ], [ req.user.id, PLAYER_ITEM_OUT_OF_STOCK ], { index: 'playerIdState' })

    const itemNames = _.uniq(_.pluck(playerItems, 'name'))

    const items = _
      .chain(yield getItems(itemNames))
      .map(item => [item.name, item])
      .object()
      .value()

    mapSeries(playerItems, (playerItem, done) => {
      const item = items[playerItem.name]
      if(!item) {
        return done(`Cannot find item: ${group.group}`)
      }

      done(null, {
        id: playerItem.id,
        name: item.name,
        price: item.price,
        icon_url: item.icon,
        name_color: item.nameColor,
        wear: ITEM_WEAR[item.wear] || '',
        other_price: null,
        quality_color: item.qualityColor,
        market_hash_name: item.cleanName,
        state: playerItem.state
      })
    }, (err, items) => {
      if(err) {
        logger.error(`getInventory() ${err}`)
        res.status(400).send(req.__('TRY_AGAIN_LATER'))
        return
      }

      res.json(items)
    })
  })

  .catch(err => {
    logger.error(`getInventory() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

export function getAvailableSwap(req, res) {
  const { item } = req.query
  if(!item || !item.length) {
    return res.status(400).send('Cannot find item')
  }

  co(function* () {

    const swapItems = yield getItems([ item ])
    if(!swapItems.length) {
      return res.status(400).send('Cannot find item to swap')
    }

    const swapItem = swapItems[0]
    const maxPrice = swapItem.price;

    const cases = yield Case
      .getAll([ true, false ], { index: 'officialDisabled' })
      .pluck('items')

    const extraCaseItems = _.pluck(yield CaseItems, 'itemName')

    const itemNames  = _
      .chain(cases)
      .reduce((items, c) => [
        ...items,
        ...c.items.reduce((items, item) => {
          if(item.type === 'cash') {
            return items
          }

          return [ ...items, item.name ]
        }, [])
      ], extraCaseItems)
      .uniq()
      .value()

    let q = Items
      .getAll(r.args(itemNames), { index: 'name' })
      .filter(item => item('price').le(maxPrice))
      .orderBy(r[req.query.order === 'asc' ? 'asc' : 'desc']('price'))

    const filters = {}

    if(!!req.query.category) {
      filters.category = req.query.category
    }

    if(Object.keys(filters).length > 0) {
      q = q.filter(filters)
    }

    if(!!req.query.query && req.query.query.length > 0) {
      q = q.filter(r.row('name').match(`(?i)${req.query.query}`))
    }

    const perPage = 10
    let page = parseInt(req.query.page) || 1
    if(page < 1) {
      page = 1
    }

    const count = yield q.count()
    const pages = Math.ceil(count / perPage)
    if(page > pages) {
      page = pages
    }

    const start = (page - 1) * perPage

    if(pages > 1) {
      q = q.slice(start, start + perPage)
    }

    const items = yield q

    res.json({
      pages,
      page,

      items: items.map(item => ({
        id: item.name,
        price: item.price,
        category: item.category,
        icon_url: item.icon,
        quality_color: item.qualityColor,
        market_hash_name: item.cleanName,
        wear: ITEM_WEAR[item.wear] || ''
      }))
    })
  })

  .catch(err => {
    logger.error(`getAvailableSwap() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

export function postSwapItems(req, res) {
  const { id, items } = req.body
  if(!id || !is.string(id)) {
    return res.status(400).send('Cannot find your item')
  } else if(!items || !Array.isArray(items) || !items.length) {
    return res.status(400).send('Invalid items to swap with')
  }

  co(function* () {
    const playerItems = yield PlayerItems
      .getAll([ id, req.user.id, PLAYER_ITEM_OUT_OF_STOCK ], { index: 'idPlayerIdState' })

    if(!playerItems.length) {
      return res.status(400).send('Cannot find your item')
    }

    const playerItem = yield getItems([ playerItems[0].name ])
    if(!playerItem.length) {
      return res.status(400).send('Cannot find your item')
    }

    const maxPrice = playerItem[0].price;

    const swapItems = yield getItems(_.uniq(items))
    if(!swapItems.length || swapItems.length !== items.length) {
      return res.status(400).send('Cannot find items to swap with')
    }

    const totalSwapItemsPrice = swapItems.reduce((s, i) => s + i.price, 0)
    if(totalSwapItemsPrice <= 0) {
      return res.status(400).send('Invalid items to swap with')
    }

    if(totalSwapItemsPrice > maxPrice) {
      return res.status(400).send('Price of items to swap with is too high')
    }

    const { deleted } = yield PlayerItems
      .getAll([ id, req.user.id, PLAYER_ITEM_OUT_OF_STOCK ], { index: 'idPlayerIdState' })
      .delete()
      .run()

    if(deleted <= 0) {
      return res.status(400).send('Cannot find items to swap with')
    }

    const newItems = swapItems.map(item => ({
      name: item.name,
      state: PLAYER_ITEM_AVAILABLE,
      createdAt: r.now(),
      wasSwapped: true,
      swappedFrom: playerItem[0].name,
      playerId: req.user.id
    }))

    const newItemNames = _.pluck(swapItems, 'name')

    logPlayerBalanceChange(req.user.id, 0, {
      newItemNames,

      name: `Item Swap: ${playerItem[0].name} for ${newItemNames.join(', ')}`,
      swappedItemName: playerItem[0].name
    })

    const { generated_keys } = yield PlayerItems.insert(newItems).run()

    res.json({
      ids: generated_keys
    })
  })

  .catch(err => {
    logger.error(`postSwapItems() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// POST /api/users/sell
export function postSellItems(req, res) {
  const { items } = req.body
  if(!is.array(items)) {
    return res.status(400).send('Invalid items')
  }

  co(function* () {
    const disabled = yield redis.getAsync('kingdom:disable:selling')
    if(disabled) {
      return res.status(400).send('Selling is currently disabled')
    }

    const grouped = yield PlayerItems
      .getAll(r.args(_.uniq(items).map(item => [ item, req.user.id, PLAYER_ITEM_AVAILABLE ])), { index: 'namePlayerIdState' })
      .group('name')

    const available = _
      .chain(grouped)
      .map(group => [group.group, group.reduction])
      .object()
      .value()

    const prices = _
      .chain(yield getItems(grouped.map((g => g.group))))
      .map(item => [item.name, item])
      .object()
      .value()

    const sell = []
    for(let item of items) {
      if(!available[item] || !available[item].length) {
        return res.status(400).status(`One of the requested items is no longer in your inventory (${item})`)
      }

      const take = available[item].splice(0, 1)[0]
      sell.push(take.id)

      if(!available[item].length) {
        delete available[item]
      }
    }

    const { changes, replaced } = yield PlayerItems
      .getAll(r.args(sell.map(id => [id, req.user.id, PLAYER_ITEM_AVAILABLE ])), { index: 'idPlayerIdState' })
      .update(r.branch(r.row('state').eq(PLAYER_ITEM_AVAILABLE), {
          state: PLAYER_ITEM_BUSY,
          soldAt: new Date()
        }, {})
      , { returnChanges: true })
      .run()

    if(replaced !== items.length) {
      // Some of the items requested are no longer available
    }

    const total = changes.reduce((total, c) => total + prices[c.new_val.name].price, 0)

    const { changes:playerChanges } = yield givePlayerBalance(req.user.id, total, {
      name: `Sold ${items.length} item(s)`,
      soldItems: items,
    })

    if(!changes || !changes.length) {
      return res.status(400).send('1 or more of the requested items are no longer available')
    }

    yield PlayerItems.getAll(r.args(changes.map(change => change.new_val.id))).delete().run()

    yield addStats({
      counters: {
        itemsSold: changes.length
      }
    })

    res.json({
      user: {
        balance: playerChanges[0].new_val.balance
      }
    })
  })

  .catch(err => {
    logger.error(`postSellItems() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

export function postWithdrawItems(req, res) {
  const { items } = req.body

  if(!req.user.totalDeposit || req.user.totalDeposit < 2) {
    return res.status(400).send('You need to deposit at least $2.00 to withdraw')
  }

  if(req.user.lockWithdraws) {
    return res.status(400).send(req.__('TRY_AGAIN_LATER'))
  }

  if(!is.array(items)) {
    return res.status(400).send('Invalid items')
  }

  let playerItemIds = null

  co(function* (){
    const disabled = yield redis.getAsync('kingdom:disable:withdraw')
    if(disabled) {
      return res.status(400).send('Withdraw is currently disabled')
    }

    const { id, tradeUrl } = req.user
    if(!tradeUrl || !tradeUrl.length) {
      return res.status(400).send(req.__('TRADE_URL_REQUIRED'))
    }

    //
    // const mobileAuth = yield runBotExecute('hasMobileAuth', tradeUrl)
    // if(!mobileAuth.success) {
    //   return res.status(400).send(mobileAuth.error)
    // }

    const grouped = yield PlayerItems
      .getAll(r.args(_.uniq(items).map(item => [ item, req.user.id, PLAYER_ITEM_AVAILABLE ])), { index: 'namePlayerIdState' })
      .group('name')

      .run()

    const available = _
      .chain(grouped)
      .map(group => [group.group, group.reduction])
      .object()
      .value()

    const withdrawItems = []
    for(let item of items) {
      if(!available[item] || !available[item].length) {
        continue
      }

      const take = available[item].splice(0, 1)[0]
      withdrawItems.push(take.id)

      if(!available[item].length) {
        delete available[item]
      }
    }

    if(!withdrawItems.length) {
      return res.status(400).send(req.__('NO_ITEMS_WITHDRAW'))
    } else if(withdrawItems.length > config.maxWithdrawsItems) {
      return res.status(400).send(`The maximum amount of items you can withdraw at a time is ${config.maxWithdrawsItems}`)
    }

    const { changes, replaced } = yield PlayerItems
      .getAll(r.args(withdrawItems.map(id => [id, req.user.id, PLAYER_ITEM_AVAILABLE ])), { index: 'idPlayerIdState' })
      .update(r.branch(r.row('state').eq(PLAYER_ITEM_AVAILABLE), {
          state: PLAYER_ITEM_BUSY,
          withdrawAt: new Date()
        }, {})
      , { returnChanges: true })
      .run()

    if(replaced === 0) {
      return res.status(400).send(req.__('NO_ITEMS_WITHDRAW'))
    }

    playerItemIds = changes.reduce((items, c) => [...items, {
      id: c.new_val.id,
      name: c.new_val.name
    }], [])

    const itemNames = changes.reduce((items, c) => [...items, c.new_val.name], [])

    const response = yield virtualWithdraw({
      itemNames,
      tradeUrl,

      steamId: id,
      meta: {
        playerItemIds
      }
    })

    res.json({
      success: true
    })
  })

  .catch(error => {
    if((playerItemIds != null && !!error.code || error.code === 'ECONNREFUSED')) {
      PlayerItems
        .getAll(r.args(_.pluck(playerItemIds, 'id')))
        .update(r.branch(r.row('state').eq(PLAYER_ITEM_BUSY), {
            state: PLAYER_ITEM_AVAILABLE
          }, {})
        , { returnChanges: true })
        .run()
    }


    logger.error(`postWithdrawItems() ${error.stack || error}`, {
      playerId: req.user.id
    })

    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

export function postKeepItem(req, res) {
  const { id } = req.body

  co(function* () {
    const { replaced } = yield PlayerItems
      .getAll([ id, req.user.id, PLAYER_ITEM_OUT_OF_STOCK ], { index: 'idPlayerIdState' })
      .update({
        state: PLAYER_ITEM_AVAILABLE
      })
      .run()


    if(replaced <= 0) {
      return res.status(400).send('Cannot find item')
    }

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error(`postKeepItem()`, {
      err
    })

    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}
