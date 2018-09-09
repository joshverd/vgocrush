
import { Router } from 'express'
import co from 'co'
import is from 'is_js'
import _ from 'underscore'
import config from 'config'
import numeral from 'numeral'

import sockets from 'lib/sockets'
import r from 'lib/database'
import { ensureAuthenticated } from 'lib/middleware'
import logger from 'lib/logger'
import redis from 'lib/redis'
import AvailableItems from 'document/items'
import Players from 'document/player'
import { Items, getItems, virtualWithdraw } from 'lib/sknexchange'
import { addStats } from 'document/stats'
import { PLAYER_ITEM_BUSY, PLAYER_ITEM_AVAILABLE, PlayerItems, getPlayerItemPrice, getPlayerInventory, formatPlayerItem, addPlayerItem, removePlayerItem, updatePlayerItem } from '../documents/player'
import { isValidTradeUrl } from 'lib/steam'
import { PendingOffers } from 'lib/sknexchange'
import { getRandomAvailableItems } from 'lib/items'

import exchange from './exchange'

const inventoryConfig = config.plugins.options.inventory || {}
const exchangeDiscount = 1 - inventoryConfig.exchangeFee

function getInventory(req, res) {
  co(function* () {
    res.json({
      items: yield getPlayerInventory(req.user.id)
    })
  })

  .catch(err => {
    logger.error('GET /api/inventory', err)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function postWithdrawItems(req, res) {
  const { items } = req.body

  if(req.user.withdrawRequirement > 0) {
    return res.status(400).send(`You need to wager at least 75% of your deposit (${numeral(req.user.withdrawRequirement).format('$0,0.00')})`)
  } else if(req.user.lockWithdraws) {
    return res.status(400).send('Please try again later')
  } else if(!is.array(items)) {
    return res.status(400).send('Invalid items')
  }

  let playerItemIds = null

  co(function* (){
    const disabled = yield redis.getAsync('kingdom:disable:withdraw')
    if(disabled && !req.user.admin) {
      return res.status(400).send('Withdraw is currently disabled')
    }

    const lockKey = 'csgoapi:lock:withdraw:' + req.user.id
    const timeout = yield redis.setnxAsync(lockKey, Date.now())

    if(!req.user.admin && !timeout) {
      // return res.status(400).send('Please wait a minute before requesting another withdrawal')
    }

    redis.expire(lockKey, 60)

    const { id, tradeUrl } = req.user
    /*if(!tradeUrl || !tradeUrl.length) {
      return res.status(400).send('Please set a valid Steam trade URL first')
    }

    if(!isValidTradeUrl(tradeUrl, { steamId: req.user.id })) {
      return res.status(400).send('An invalid Steam trade url was given')
    }*/

    const pendingItemsCount = yield PendingOffers
      .getAll('QUEUED', 'PENDING', { index: 'state' })
      .map(t => t('itemNames').count())
      .sum()

    const pic = yield redis.getAsync('enable:pic')

    if(pendingItemsCount >= 300 && pic) {
      return res.status(400).send('Steam is having issues at the moment, please try again in a couple minutes')
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

      /*
      const withdrawCount = yield redis.getAsync(`withdrawCount:${req.user.id}:${item}`)
      const withdrawnToday = withdrawCount ? parseInt(withdrawCount) + 1 : 1;
      yield redis.setAsync(`withdrawCount:${req.user.id}:${item}`, withdrawnToday, 'EX', 60 * 60 * 24)
      console.log('withdrawnToday', withdrawnToday, 'item', item);
      if (withdrawnToday > 10) {
        return res.status(400).send(`You have reached your maximum withdraw of ${item} for today`)
      }
      */

      const take = available[item].splice(0, 1)[0]
      withdrawItems.push(take.id)

      if(!available[item].length) {
        delete available[item]
      }
    }


    if(!withdrawItems.length) {
      return res.status(400).send('Could not find items to withdraw')
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
      return res.status(400).send('Could not find items to withdraw')
    }

    playerItemIds = changes.reduce((items, c) => [...items, {
      id: c.new_val.id,
      name: c.new_val.name
    }], [])

    const itemNames = changes.reduce((items, c) => [...items, c.new_val.name], [])
    const changesItems = yield Items.getAll(r.args(itemNames), { index: 'name' })

    const subtotal = _
      .chain(changes)
      .map(playerItem => {
        const item = _.findWhere(changesItems, { name: playerItem.new_val.name })
        return getPlayerItemPrice(item, playerItem.new_val.mode)
      })
      .reduce((t, i) => t + i, 0)
      .value()

    if(!!req.user.maxWithdrawAmount && typeof req.user.maxWithdrawAmount === 'number') {
      const { replaced } = yield Players.get(req.user.id).update(p => {
        const maxWithdrawAmount = p('maxWithdrawAmount').default(0)

        return r.branch(maxWithdrawAmount.sub(subtotal).gt(0), {
          maxWithdrawAmount: maxWithdrawAmount.sub(subtotal)
        }, {})
      })

      if(replaced <= 0) {
        yield PlayerItems
          .getAll(r.args(_.pluck(playerItemIds, 'id')))
          .update(r.branch(r.row('state').eq(PLAYER_ITEM_BUSY), {
              state: PLAYER_ITEM_AVAILABLE
            }, {})
          , { returnChanges: true })
          .run()

        return res.status(400).send('Please try again later')
      }
    }

    const response = yield virtualWithdraw({
      itemNames,
      tradeUrl,

      steamId: id,
      meta: {
        subtotal,
        playerItemIds,
        requestIp: req.clientIp
      },

      useListedItems: true // !!(yield redis.getAsync('enable:wli')) || req.user.admin
    })

    sockets.to(req.user.id).emit('updatePlayerItem', _.pluck(playerItemIds, 'id'), {
      state: 'BUSY'
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

    res.status(400).send('Please try again later')
  })
}

function postOpen(req, res) {
  const { id } = req.params

  if(!is.string(id)) {
    return res.status(400).send('Invalid gift')
  }

  co(function* () {
    const [ gift ] = yield PlayerItems.getAll([ id, req.user.id, 'AVAILABLE' ], {
      index: 'idPlayerIdState'
    })

    if(!gift) {
      return res.status(400).send('Cannot find gift to open')
    }

    const { deleted, changes } = yield removePlayerItem([ gift.id ], {
      openedGift: gift.id
    })

    if(deleted <= 0) {
      return res.status(400).send('Cannot find gift to open')
    }

    const { contains } = changes[0].old_val

    if(contains.type === 'items') {
      yield addPlayerItem(req.user.id, contains.itemNames, {
        fromGift: gift.id,
        giftName: gift.name,
        giftDescription: gift.shortDescription
      })
    } else if(contains.type === 'amount') {
      const items = yield getRandomAvailableItems({
        maxValue: contains.amount
      })

      yield addPlayerItem(req.user.id, _.pluck(items.items, 'name'))
    }

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error('inventory', 'postOpen', err, {
      playerItemId: id,
      playerId: req.user.id
    })

    res.status(400).send('Please try again later')
  })
}

export default router => {
  const group = Router()

  group.get('/', getInventory)
  group.post('/open/:id', postOpen)

  group.use('/exchange', exchange())

  group.post('/withdraw', postWithdrawItems)
  router.use('/inventory', ensureAuthenticated, group)
}
