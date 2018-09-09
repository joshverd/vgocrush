
import co from 'co'
import config from 'config'
import jayson from 'jayson'
import requestIp from 'request-ip'

import logger from 'lib/logger'
import sockets from 'lib/sockets'
import { runPluginHook } from 'plugins'
import { formatPendingOffer } from 'lib/sknexchange'
import { getAvailableItems } from 'lib/items'

// import numeral from 'numeral'
//
// import logger from '../lib/logger'
// import Player, { PlayerWithdrawHistory, PlayerBalanceHistory, givePlayerBalance } from '../document/player'
// import { PlayerItems, PLAYER_ITEM_BUSY, PLAYER_ITEM_AVAILABLE, PLAYER_ITEM_OUT_OF_STOCK } from 'plugins/cases/documents/player'
// import Order from '../document/order'
// import Campaign from '../document/campaign'
// import sockets from '../lib/sockets'
// import { addStats } from '../document/stats'
// import { getLevelReward } from '../lib/campaign'
//
// import { getItems, storeItems, fetchInventory } from '../lib/sknexchange'
//
// function* onVirtualOfferChange(offer) {
//
//   if(offer.state === 'ERROR') {
//     yield addStats({
//       counters: {
//         totalErrorOffers: 1
//       }
//     })
//   }
//
//   // Refund on:
//   //
//   // - Error without purchasing (no funds)
//   // - Purchased, but has unavailable items
//   if((offer.state === 'ERROR' && offer.previousState === 'QUEUED' && offer.hasError && (offer.error.noFunds || offer.error.buyItemsError))
//       || (offer.state === 'ERROR' && offer.previousState === 'QUEUED' && !offer.error.hasPurchaseResponse && !offer.error.buyItemsError)
//       || (offer.state === 'ESCROW' && !offer.hasError && offer.hasPurchaseResponse && offer.purchaseResponse.unavailableItemNames.length > 0)) {
//
//     let refundItems = []
//
//     if(!offer.hasPurchaseResponse) {
//       refundItems = !!offer.error.unavailableItemNames ? offer.error.unavailableItemNames : offer.itemNames
//     } else {
//       refundItems = offer.purchaseResponse.unavailableItemNames
//     }
//
//     let allowSwap = true
//
//     if(offer.state === 'ERROR' && offer.previousState === 'QUEUED' && (typeof offer.hasPurchaseResponse !== 'undefined' && !offer.hasPurchaseResponse) && !offer.error.buyItemsError) {
//       refundItems = offer.itemNames
//       allowSwap = false
//     }
//
//     if(offer.state === 'ERROR' && !!offer.error.message && offer.error.message.indexOf('Could not find items to purchase') >= 0 && offer.itemNames.length === 1) {
//       allowSwap = true
//     }
//
//     if(refundItems.length > 0) {
//       const refundItemCounts = _.countBy(refundItems)
//
//       for(let item in refundItemCounts) {
//         const { replaced } = yield PlayerItems
//           .getAll([ item, offer.steamId, PLAYER_ITEM_BUSY ], { index: 'namePlayerIdState' })
//           .limit(refundItemCounts[item])
//           .update({
//             state: allowSwap ? PLAYER_ITEM_OUT_OF_STOCK : PLAYER_ITEM_AVAILABLE
//           }, {
//             returnChanges: true
//           })
//           .run()
//       }
//
//       sockets.to(offer.steamId).emit('offer:refunded', refundItems)
//     }
//   }
//
//   if(offer.state === 'ACCEPTED') {
//
//     yield addStats({
//       counters: {
//         totalWithdrawn: (!!offer.purchaseResponse ? offer.purchaseResponse.saleAmount : offer.subtotal) || offer.subtotal,
//         totalWithdrawnItems: offer.itemNames.length,
//         totalWithdrawals: 1
//       }
//     })
//
//     const items = yield getItems(offer.itemNames)
//     const tradeOfferItems = _
//       .chain(items)
//       .map(item => [item.name, item])
//       .object()
//       .value()
//
//     yield PlayerWithdrawHistory.insert({
//       tradeOfferItemNames: offer.itemNames,
//       createdAt: new Date(),
//       playerId: offer.steamId,
//       tradeOfferId: offer.id,
//       amount: items.reduce((s, i) => s + i.price, 0),
//       items: offer.itemNames.map(name => {
//         const item = tradeOfferItems[name]
//
//         return {
//           id: item.id,
//           icon_url: item.icon.substring(8),
//           name_color: item.nameColor,
//           quality_color: item.qualityColor,
//           market_hash_name: item.name,
//           price: item.price
//         }
//       })
//     }).run()
//
//     const takenItemCounts = _.countBy(offer.itemNames)
//
//     for(let item in takenItemCounts) {
//       yield PlayerItems
//         .getAll([ item, offer.steamId, PLAYER_ITEM_BUSY ], { index: 'namePlayerIdState' })
//         .limit(takenItemCounts[item])
//         .delete()
//         .run()
//     }
//
//     yield PlayerBalanceHistory.insert({
//         meta: {
//           name: 'Withdraw',
//           tradeOfferItemNames: offer.itemNames
//         },
//         playerId: offer.steamId,
//         date: new Date(),
//         balance: 0
//       }).run()
//
//   }
//
//   if(offer.state === 'SENT') {
//     sockets.to(offer.steamId).emit('notification', {
//       message: `Your withdraw offer has been sent! <a href="${offer.tradeOfferUrl}" target="_blank">View it</a>`,
//       duration: 7000
//     })
//   }
//
// }
//
const rpcServer = jayson.server({
  'offer.change': (offer, done) => {
    logger.info(`Virtual Offer ${offer.id}\t${offer.steamId}\t${offer.state}`)

    sockets.to(offer.steamId).emit('offer:change', formatPendingOffer(offer))

    runPluginHook('onVirtualOfferChange', offer)
      .then(() => done())
      .catch(err => logger.error('rpc trade.onVirtualOfferChange', err))
  },

  'trade.OnTradeOfferStateChange': (offer, done) => {
    const { steamId64: steamId } = offer
    logger.info(`Trade Offer ${offer.id}\t${steamId}\t${offer.state}\t${offer.itemNames.join(', ')}`)

    sockets.to(steamId).emit('tradeOffer:change', {
      id: offer.id,
      state: offer.state,
      tradeOfferUrl: offer.tradeOfferUrl,
      type: offer.type,
      subtotal: offer.baseSubtotalPrice,
      error: offer.state === 'DECLINED' ? offer.hasError ? offer.error : 'Deposit offer was declined' : null
    })

    runPluginHook('onTradeOfferStateChange', offer)
      .then(() => done())
      .catch(err => logger.error('rpc trade.OnTradeOfferStateChange', err))
  },

  'prices.updated': (result, done) => {

    sockets.of('/').adapter.customRequest({ event: 'updateItems' }, err => {
      if(!!err) {
        logger.error('rpc prices.updated', err)
        return done(err.message)
      }

      done()
    })
  }
})

//
//     sockets.to(offer.steamId).emit('offer:change', {
//       createdAt: offer.createdAt,
//       tradeOfferId: offer.tradeOfferId,
//       id: offer.id,
//       state: offer.state,
//       itemNames: offer.itemNames,
//       subtotal: offer.subtotal,
//       retry: offer.retry,
//       previousState: offer.previousState,
//       tradeOfferUrl: offer.tradeOfferUrl,
//       // Sigh...... i know.
//       unavailableItemNames: (offer.hasError ? offer.error.unavailableItemNames : offer.hasPurchaseResponse ? offer.purchaseResponse.unavailableItemNames : [])
//     })
//
//     co(onVirtualOfferChange, offer)
//       .then(() => done(), err => {
//         logger.error(`rpcServer() offer.change`, {
//           offerId: offer.id,
//           err: err.stack || (err.message || err)
//         })
//
//         done(err.stack || (err.message || err))
//       })
//   },
//
//   'trade.OnTradeOfferStateChange': (offer, callback) => {
//     let steamId = offer.meta.steamId64 || offer.steamId64
//
//     sockets.to(steamId).emit('tradeOffer:change', {
//       id: offer.id,
//       state: offer.state,
//       tradeOfferUrl: offer.tradeOfferUrl,
//       error: offer.state === 'DECLINED' ? offer.hasError ? offer.error : 'Deposit offer was declined' : null
//     })
//
//     co(function* () {
//
//       if(!!offer.meta.playerItemIds && offer.type === 'WITHDRAW') {
//         return callback()
//
//         const counts = _.countBy(offer.itemNames, item => {
//           return item
//         })
//
//         const playerItemIds = _
//           .chain(offer.meta.playerItemIds)
//           .groupBy(item => {
//             return item.name
//           })
//           .map((item, key) => {
//             return [ key, item.reduce((a, i) => [ ...a, i.id ], []) ]
//           })
//           .object()
//           .value()
//
//         if(offer.state === 'ACCEPTED') {
//
//           const items = yield getItems(offer.itemNames)
//           const tradeOfferItems = _
//             .chain(items)
//             .map(item => [item.name, item])
//             .object()
//             .value()
//
//           yield PlayerWithdrawHistory.insert({
//             tradeOfferItemNames: offer.itemNames,
//             createdAt: new Date(),
//             playerId: offer.steamId64,
//             tradeOfferId: offer.id,
//             amount: items.reduce((s, i) => s + i.price, 0),
//             items: offer.itemNames.map(name => {
//               const item = tradeOfferItems[name]
//
//               return {
//                 id: item.id,
//                 icon_url: item.icon.substring(8),
//                 name_color: item.nameColor,
//                 quality_color: item.qualityColor,
//                 market_hash_name: item.name,
//                 price: item.price
//               }
//             })
//           }).run()
//
//           for(let name in counts) {
//             yield PlayerItems
//               .getAll(r.args(playerItemIds[name]))
//               .limit(counts[name])
//               .delete()
//               .run()
//           }
//
//           yield PlayerBalanceHistory.insert({
//               meta: {
//                 name: 'Withdraw',
//                 tradeOfferItemNames: offer.itemNames
//               },
//               playerId: offer.steamId64,
//               date: new Date(),
//               balance: 0
//             }).run()
//
//           callback()
//         } else if(offer.state === 'DECLINED' && offer.retryCount === offer.maxRetries) {
//           for(let name in counts) {
//             const { changes, replaced } = yield PlayerItems
//               .getAll(r.args(playerItemIds[name]))
//               .limit(counts[name])
//               .update({
//                 state: PLAYER_ITEM_AVAILABLE
//               }, { returnChanges: true })
//               .run()
//
//             if(replaced <= 0) {
//               return callback()
//             }
//
//             yield PlayerBalanceHistory.insert({
//                 meta: {
//                   name: 'Refunded',
//                   playerItemIds: changes.map(c => c.new_val.id),
//                   tradeOfferItemNames: offer.itemNames
//                 },
//                 playerId: steamId,
//                 date: new Date(),
//                 balance: 0
//               }).run()
//
//             // Safegaurd?
//             if(replaced > offer.itemNames.length) {
//               logger.error(`postWithdrawItems() SAFEGAURD: Made more than needed items from busy to available`, {
//                 name,
//                 ids: changes.map(c => c.new_val.id),
//                 playerId: steamId
//               })
//
//               yield PlayerItems.getAll(r.args(changes.map(c => c.new_val.id))).update({
//                 state: PLAYER_ITEM_BUSY
//               }).run()
//             }
//           }
//
//           callback()
//         } else {
//           callback()
//         }
//
//         return
//       } else if(offer.type === 'DEPOSIT') {
//
//         switch(offer.state) {
//           case 'ACCEPTED':
//             let subtotal = offer.subtotalPrice
//
//             const { replaced, changes } = yield Player
//               .get(steamId)
//               .update(r.branch(r.row('acceptedDeposits').default([]).contains(offer.id).not(), {
//                 balance: r.row('balance').add(subtotal),
//                 acceptedDeposits: r.row('acceptedDeposits').default([]).append(offer.id),
//                 totalDeposit: r.row('totalDeposit').default(0).add(offer.subtotalPrice)
//               }, {}), {
//                 returnChanges: true
//               })
//               .run()
//
//             if(replaced <= 0) {
//               break
//             }
//
//             yield addStats({
//               counters: {
//                 totalDeposits: 1,
//                 totalDeposited: offer.baseSubtotalPrice,
//
//                 totalSkinDeposits: 1,
//                 totalSkinDeposited: offer.baseSubtotalPrice,
//                 totalSkinsDeposited: offer.itemNames.length,
//                 totalSkinDepositProfit: offer.baseSubtotalPrice - offer.subtotalPrice
//               }
//             })
//
//             yield fetchInventory(steamId, {
//               discount: 0.9,
//               refresh: true
//             })
//
//             yield Order.insert({
//               amount: offer.subtotalPrice,
//               completed: true,
//               createdAt: new Date(),
//               playerId: steamId,
//               method: 'skins',
//               tradeOfferId: offer.id,
//               tradeOfferItemNames: offer.itemNames
//             }).run()
//
//             yield PlayerBalanceHistory.insert({
//               meta: {
//                 name: 'Skin deposit',
//                 offerId: offer.id,
//                 itemNames: offer.itemNames,
//               },
//               playerId: steamId,
//               date: new Date(),
//               balance: offer.subtotalPrice
//             }).run()
//
//             sockets.to(steamId).emit('user:update', {
//               balance: changes[0].new_val.balance
//             })
//
//             sockets.to(steamId).emit('notification', {
//               message: `Deposit offer has been accepted, you have been credited \$${numeral(subtotal).format('0,0.00')}!`,
//               duration: 7000
//             })
//
//             sockets.to(steamId).emit('depositComplete', offer.baseSubtotalPrice*0.7)
//
//             // if(replaced > 0 && (!changes[0].old_val.totalDeposit || changes[0].old_val.totalDeposit <= 0)) {
//             //   subtotal += offer.subtotalPrice * 0.2
//             //   // stats.decrement('players.depositBonus', offer.subtotalPrice * 0.2)
//             //
//             //   yield insertProfit(steamId, 'Deposit Bonus', -(offer.subtotalPrice * 0.2), {
//             //     tradeOfferId: offer.id
//             //   })
//             //
//             //   yield givePlayerBalance(steamId, offer.subtotalPrice * 0.2, {
//             //     name: 'Deposit bonus',
//             //     offerId: offer.id,
//             //     amount: offer.subtotalPrice
//             //   })
//             // }
//
//             const player = yield Player.get(steamId).run()
//             if(player && player.hasRedeemedPromo) {
//
//                 const campaigns = yield Campaign
//                   .getAll(player.redeemedPromo.toLowerCase(), { index: 'code' })
//                   .run()
//
//                 if(campaigns.length) {
//                   const campaign = campaigns[0]
//                   const campaignPlayer = yield Player
//                     .get(campaign.playerId)
//                     .run()
//
//                   if(campaignPlayer) {
//                     const reward = getLevelReward(campaignPlayer.level)
//                     const comission = subtotal * (reward.commission / 100)
//
//                     yield Campaign.get(campaign.id).update({
//                       balance: r.row('balance').default(0).add(comission),
//                       totalEarned: r.row('totalEarned').default(0).add(comission),
//                       totalDeposits: r.row('totalDeposits').default(0).add(1),
//                       totalDeposited: r.row('totalDeposited').default(0).add(subtotal)
//                     }).run()
//                   }
//                 }
//             }
//
//             break
//
//           case 'SENT':
//             sockets.to(steamId).emit('notification', {
//               message: `Your deposit offer has been sent with the security token ${offer.securityToken}. <a href="${offer.tradeOfferUrl}" target="_blank">View it</a>`,
//               duration: 7000
//             })
//
//             break
//
//           case 'DECLINED':
//
//             sockets.to(steamId).emit('notification', {
//               status: 'error',
//               message: offer.hasError ? `Cannot send deposit offer: ${offer.error}` : 'Deposit offer was declined',
//               duration: 7000
//             })
//
//             break
//         }
//
//         return callback()
//       }
//
//       callback()
//     })
//
//     .catch(err => logger.error(`RPC: ${err}`, {
//       id: offer.id,
//       status: offer.type,
//       state: offer.state,
//       playerId: steamId
//     }))
//   }
// })

export default function(req, res) {
  const key = req.headers['x-rpc-key']

  if(!key || config.sknexchange.rpcKey !== key) {
    return res.status(400).send('Invalid Key')
  }
  
  const rpcMw = rpcServer.middleware()
  rpcMw(req, res)
}
