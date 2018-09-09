
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
import AvailableItems from 'document/items'

import { PlayerItems, PLAYER_ITEM_OUT_OF_STOCK, PLAYER_ITEM_AVAILABLE, PLAYER_ITEM_BUSY, formatPlayerItem } from '../documents/player'

// GET /api/users/virtualWithdraw
export function getVirtualInventory(req, res) {
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

      if(!!err) {
        logger.error('GET /api/users/virtualInventory', err)
        res.status(400).send(req.__('TRY_AGAIN_LATER'))
        return
      }

      res.json(items)
    })
  })

  .catch(err => {
    logger.error('GET /api/users/virtualInventory', err)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// export function postWithdrawItems(req, res) {
//   const { items } = req.body
//
//   if(!req.user.totalDeposit || req.user.totalDeposit < 2) {
//     return res.status(400).send('You need to deposit at least $2.00 to withdraw')
//   }
//
//   if(req.user.lockWithdraws) {
//     return res.status(400).send(req.__('TRY_AGAIN_LATER'))
//   }
//
//   if(!is.array(items)) {
//     return res.status(400).send('Invalid items')
//   }
//
//   let playerItemIds = null
//
//   co(function* (){
//     const disabled = yield redis.getAsync('kingdom:disable:withdraw')
//     if(disabled) {
//       return res.status(400).send('Withdraw is currently disabled')
//     }
//
//     const { id, tradeUrl } = req.user
//     if(!tradeUrl || !tradeUrl.length) {
//       return res.status(400).send(req.__('TRADE_URL_REQUIRED'))
//     }
//
//     //
//     // const mobileAuth = yield runBotExecute('hasMobileAuth', tradeUrl)
//     // if(!mobileAuth.success) {
//     //   return res.status(400).send(mobileAuth.error)
//     // }
//
//     const grouped = yield PlayerItems
//       .getAll(r.args(_.uniq(items).map(item => [ item, req.user.id, PLAYER_ITEM_AVAILABLE ])), { index: 'namePlayerIdState' })
//       .group('name')
//
//       .run()
//
//     const available = _
//       .chain(grouped)
//       .map(group => [group.group, group.reduction])
//       .object()
//       .value()
//
//     const withdrawItems = []
//     for(let item of items) {
//       if(!available[item] || !available[item].length) {
//         continue
//       }
//
//       const take = available[item].splice(0, 1)[0]
//       withdrawItems.push(take.id)
//
//       if(!available[item].length) {
//         delete available[item]
//       }
//     }
//
//     if(!withdrawItems.length) {
//       return res.status(400).send(req.__('NO_ITEMS_WITHDRAW'))
//     } else if(withdrawItems.length > config.maxWithdrawsItems) {
//       return res.status(400).send(`The maximum amount of items you can withdraw at a time is ${config.maxWithdrawsItems}`)
//     }
//
//     const { changes, replaced } = yield PlayerItems
//       .getAll(r.args(withdrawItems.map(id => [id, req.user.id, PLAYER_ITEM_AVAILABLE ])), { index: 'idPlayerIdState' })
//       .update(r.branch(r.row('state').eq(PLAYER_ITEM_AVAILABLE), {
//           state: PLAYER_ITEM_BUSY,
//           withdrawAt: new Date()
//         }, {})
//       , { returnChanges: true })
//       .run()
//
//     if(replaced === 0) {
//       return res.status(400).send(req.__('NO_ITEMS_WITHDRAW'))
//     }
//
//     playerItemIds = changes.reduce((items, c) => [...items, {
//       id: c.new_val.id,
//       name: c.new_val.name
//     }], [])
//
//     const itemNames = changes.reduce((items, c) => [...items, c.new_val.name], [])
//
//     const response = yield virtualWithdraw({
//       itemNames,
//       tradeUrl,
//
//       steamId: id,
//       meta: {
//         playerItemIds
//       }
//     })
//
//     res.json({
//       success: true
//     })
//   })
//
//   .catch(error => {
//     if((playerItemIds != null && !!error.code || error.code === 'ECONNREFUSED')) {
//       PlayerItems
//         .getAll(r.args(_.pluck(playerItemIds, 'id')))
//         .update(r.branch(r.row('state').eq(PLAYER_ITEM_BUSY), {
//             state: PLAYER_ITEM_AVAILABLE
//           }, {})
//         , { returnChanges: true })
//         .run()
//     }
//
//
//     logger.error(`postWithdrawItems() ${error.stack || error}`, {
//       playerId: req.user.id
//     })
//
//     res.status(400).send(req.__('TRY_AGAIN_LATER'))
//   })
// }
