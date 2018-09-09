
import { Router } from 'express'
import co from 'co'
import config from 'config'
import is from 'is_js'
import _ from 'underscore'

import AvailableItems from 'document/items'
import { Items } from 'lib/sknexchange'
import { PLAYER_ITEM_BUSY, PLAYER_ITEM_AVAILABLE, PlayerItems, getPlayerInventory, formatPlayerItem, addPlayerItem, removePlayerItem, updatePlayerItem } from '../documents/player'
import logger from 'lib/logger'
import redis from 'lib/redis'
import r from 'lib/database'
import { addStats } from 'document/stats'

const inventoryConfig = config.plugins.options.inventory || {}
const exchangeDiscount = -1 - inventoryConfig.exchangeFee

function postExchange(req, res) {
  if(!is.array(req.body.playerItemIds) || !is.array(req.body.targetItemNames)) {
    return res.status(400).send('Invalid exchange')
  }

  const playerItemIds = _.uniq(req.body.playerItemIds)
  if(!playerItemIds.length || playerItemIds.length !== req.body.playerItemIds.length) {
    return res.status(400).send('Invalid items')
  }

  const targetItemNames = _.uniq(req.body.targetItemNames)
  if(!targetItemNames.length || targetItemNames.length !== req.body.targetItemNames.length) {
    return res.status(400).send('Invalid target items')
  }

  co(function* () {
    const disabled = yield redis.getAsync('disable:exchange')
    if(disabled) {
      return res.status(400).send('Exchanging is currently disabled')
    }

    const { replaced, changes } = yield updatePlayerItem({
      ids: playerItemIds.map(id => [ id, req.user.id, PLAYER_ITEM_AVAILABLE ]),
      options: {
        index: 'idPlayerIdState'
      }
    }, item =>
      r.branch(item('state').eq('AVAILABLE').and(item('type').default('skin').eq('skin')), {
        state: PLAYER_ITEM_BUSY
      }, r.error('state !== AVAILABLE'))
    , {
      exchanging: true
    })

    if(replaced <= 0) {
      return Promise.reject('replaced === 0')
    }

    const playerItems = _.pluck(changes, 'new_val')
    const updatedPlayerItemIds = _.pluck(playerItems, 'id')

    const refund = refundReason => updatePlayerItem(updatedPlayerItemIds, {
      state: PLAYER_ITEM_AVAILABLE
    }, {
      refundReason,

      exchangeRefund: true
    })

    if(playerItemIds.length !== updatedPlayerItemIds.length) {
      refund('some items are no longer available')
      return res.status(400).send('Some of your items are no longer available')
    }

    const items = yield Items.getAll(r.args(_.pluck(playerItems, 'name')), { index: 'name' })
    if(!items.length) {
      refund('could not find items')
      return res.status(400).send('Cannot find your items')
    }

    const exchangeItems = playerItems.map(playerItem => {
      const item = _.findWhere(items, {
        name: playerItem.name
      })

      return formatPlayerItem(playerItem, item)
    })

    const exchangeItemsTotal = exchangeItems.reduce((t, i) => t + i.price, 0)
    const exchangeCredit = exchangeItemsTotal// * exchangeDiscount

    // const targetItems = yield AvailableItems
    //   .getAll(r.args(targetItemNames), { index: 'name' })
    //   .eqJoin(i => ([ i('name'), false ]), Items, { index: 'nameBlocked' })
    //   .zip()

    const targetItems = yield Items
      .getAll(r.args(targetItemNames), { index: 'name' })
      .coerceTo('array')

    if(!targetItems.length || targetItems.length !== targetItemNames.length) {
      refund('cannot find target items')
      return res.status(400).send('Cannot find target item(s)')
    }

    const targetItemsPrice = targetItems.reduce((s, i) => s + i.exchangePrice, 0)

    if(targetItemsPrice <= 0) {
      refund('targetItemsPrice <= 0')
      return res.status(400).send('Cannot find target item(s)')
    } else if(targetItemsPrice > exchangeCredit) {
      refund('targetItemsPrice > exchangeCredit')
      return res.status(400).send('Prices of target items are higher than available exchange credit')
    }

    yield removePlayerItem(updatedPlayerItemIds, {
      exchangedFor: _.pluck(targetItems, 'name', 'price')
    })

    yield addPlayerItem(req.user.id, _.pluck(targetItems, 'name').map(name => ({
      name,
      mode: 'exchange'
    })), {
      exchangedFrom: _.pluck(exchangeItems, 'name', 'price')
    })

    yield addStats({
      counters: {
        totalExchanges: 1,
        totalExchanged: targetItemsPrice,
        totalExchangeProfit: exchangeCredit - targetItemsPrice
      }
    })

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error('POST /inventory/exchange', err, {
      playerItemIds,
      targetItemNames,

      playerId: req.user.id
    })

    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

export default router => {
  const group = Router()
  group.post('/', postExchange)
  return group
}
