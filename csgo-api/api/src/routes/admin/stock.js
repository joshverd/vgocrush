
import { Router } from 'express'
import co from 'co'
import r from '../../lib/database'
import _ from 'underscore'
import { mapSeries } from 'async'

import Player from '../../document/player'
import { PlayerItems, PLAYER_ITEM_AVAILABLE } from 'plugins/cases/documents/player'
import { ITEM_SHORT_WEAR } from '../../constant/item'
import { cleanItemName } from '../../lib/item'
import Case from 'plugins/cases/documents/case'
import { getItems, getBots, restockItems } from '../../lib/sknexchange'

let _stockPromise = null
let _lastStockRefresh = null
let _lastStock = null

let _autoRefreshTimeout = null

function getOwners(req, res) {
  co(function* () {
    const owners = _.uniq(yield PlayerItems
      .getAll([ req.params.item, PLAYER_ITEM_AVAILABLE ], { index: 'nameState' })
      .map(item =>
        Player
          .between([ item('playerId'), 2 ], [ item('playerId'), r.maxval ], { index: 'idTotalDeposit' })
          .pluck('id', 'displayName')
          .coerceTo('array')
      )

      .reduce((left, right) =>
        left.add(right)
      )

      .coerceTo('array')
      .run(), (p) => p.id)

    res.json(owners)
  })

  .catch(console.log)
}

function refreshStock(force) {
  if(_stockPromise !== null) {
    return _stockPromise
  }

  if(_autoRefreshTimeout) {
    clearTimeout(_autoRefreshTimeout)
    _autoRefreshTimeout = null
  }

  _stockPromise = new Promise((resolve, reject) => {

    co(function* () {

      const cases = yield Case
        .pluck('items')
        .coerceTo('array')
        .run()

      const itemNames  = cases
        .reduce((items, c) => [
          ...items,
          ...c.items.reduce((items, item) => {
            if(item.type === 'cash') {
              return items
            }

            if(item.wearsArray && item.wearsArray.length) {
              const cleanName = cleanItemName(item.name)
              const names = item.wearsArray.map(wear => `${cleanName} (${ITEM_SHORT_WEAR[wear]})`)
              return items.concat(names)
            }

            return [ ...items, item.name ]
          }, [])
        ], [])

        const items = yield getItems(_.uniq(itemNames), {
          includeBotItemCount: true
        }, false)

        mapSeries(items, (item, done) => {

          co(function* () {
            item.demand = yield PlayerItems
              .getAll([ item.name, PLAYER_ITEM_AVAILABLE ], { index: 'nameState' })
              .filter(item =>
                Player
                  .between([ item('playerId'), 2 ], [ item('playerId'), r.maxval ], { index: 'idTotalDeposit' })
                  .count()
                  .gt(0)
              )
              .count()
              .run()

            done(null, item)
          })
      }, (err, items) => {
        _stockPromise = null
        _lastStockRefresh = new Date()
        _lastStock = items

        _autoRefreshTimeout = setTimeout(() => refreshStock(), 30000)

        resolve(items)
      })
    })

    .catch(reject)

  })

  return _stockPromise
}

// GET /_manage/stock
function getStock(req, res) {

  co(function* () {
    if(_lastStock === null || !!req.query.update) {
      yield refreshStock(true)
    }

    res.json({
      lastUpdated: _lastStockRefresh,
      items: _lastStock,
      lowItems: _lastStock.filter(item =>
        item.demand > 0 && item.demand >= (item.botItemCount * 0.8)
      )
    })
  })

  .catch(console.log)
}


function postRestock(req, res) {
  const { itemName, amount } = req.body

  co(function* () {
    yield restockItems(itemName, amount)

    res.json({
      success: true
    })
  })

  .catch(error => {
    res.status(400).json({
      success: true,
      error
    })
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.get('/', getStock)
  router.get('/owners/:item', getOwners)
  router.post('/restock', postRestock)
  return router
}
