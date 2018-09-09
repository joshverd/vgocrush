
import logger from 'lib/logger'
import redis from 'lib/redis'
import r from 'lib/database'
import _ from 'underscore'
import co from 'co'

import documents from './documents'
import Player, { PlayerWithdrawHistory, PlayerBalanceHistory } from 'document/player'
import { PlayerItems, PLAYER_ITEM_AVAILABLE, PLAYER_ITEM_BUSY, getPlayerInventory, formatPlayerItem, addPlayerItem, removePlayerItem, addUpdatePlayerItemHistory, addRemovePlayerItemHistory } from './documents/player'
import { getItems } from 'lib/sknexchange'
import sockets from 'lib/sockets'

import { addStats } from 'document/stats'
import afterApiRouteCreated from './api'

function* onVirtualOfferChange(offer) {
  const { id, steamId, type, state, meta } = offer

  if(offer.state === 'ERROR') {
    yield addStats({
      counters: {
        totalErrorOffers: 1
      }
    })
  }

  const playerItemIds = _.pluck(offer.meta.playerItemIds, 'id')

  if(!offer.hadRetry && (offer.state === 'PENDING' || offer.state === 'ERROR')) {
    if(!!offer.unavailableItemNames && offer.unavailableItemNames.length > 0) {
      const refunds = _.countBy(offer.unavailableItemNames)

      for(let name in refunds) {
        let refundedOffers = r.row('refundedOffers').default([])

        let result = yield PlayerItems
          .getAll(r.args(playerItemIds.map(id => ([ id, offer.steamId, PLAYER_ITEM_BUSY ]))), { index: 'idPlayerIdState' })
          .filter({ name })
          .limit(refunds[name])
          .update(r.branch(r.row('state').eq(PLAYER_ITEM_BUSY).and(refundedOffers.contains(offer.id).not()), {
            state: PLAYER_ITEM_AVAILABLE,
            refundedOffers: refundedOffers.append(offer.id)
          }, {}), { returnChanges: true })

        addUpdatePlayerItemHistory(result, {
          refundedOffer: offer.id
        })

        if(result.replaced > 0) {
          let playerItemIds = _.pluck(_.pluck(result.changes, 'new_val'), 'id')

          sockets.to(offer.steamId).emit('updatePlayerItem', playerItemIds, {
            state: PLAYER_ITEM_AVAILABLE
          })
        }
      }
    }
  }

  if(offer.state === 'SENT' && !offer.hadRetry) {
    sockets.to(offer.steamId).emit('notification', `Your withdraw offer has been sent!`)

    yield addStats({
      totalSentOffers: 1,
      totalSentOfferWithdrawElapsed: offer.withdrawElapsed
    })
  }

  if(offer.state === 'ACCEPTED') {

    yield Player.get(offer.steamId).update({
      totalWithdrawn: r.row('totalWithdrawn').default(0).add(offer.receipt.subtotal)
    })

    yield addStats({
      counters: {
        totalWithdrawn: offer.receipt.subtotal,
        totalWithdrawnItems: offer.itemNames.length,
        totalWithdrawals: 1
      }
    })

    const withdrawnItems = _.countBy(offer.receipt.itemNames)

    for(let name in withdrawnItems) {
      let result = yield PlayerItems
        .getAll(r.args(playerItemIds.map(id => ([ id, offer.steamId, PLAYER_ITEM_BUSY ]))), { index: 'idPlayerIdState' })
        .filter({ name })
        .limit(withdrawnItems[name])
        .delete({ returnChanges: true })

      addRemovePlayerItemHistory(result, {
        pendingOfferId: offer.id
      })
    }
  }
}

function* onTradeOfferStateChange(offer) {
  const { id, steamId64: steamId, type, state, itemNames, baseSubtotal } = offer

  if(state === 'ACCEPTED') {
    const keys = yield redis.keysAsync(`inventory:${steamId}:*`)

    for(let key of keys) {
      yield redis.delAsync(key)
    }
  }

  if(type === 'DEPOSIT') {
    if(state === 'ACCEPTED') {
      const result = yield Player.get(steamId).update(p =>
        r.branch(p('acceptedTradeOfferIds').default([]).contains(id).not(), {
          acceptedTradeOfferIds: p('acceptedTradeOfferIds').default([]).append(id),
          withdrawRequirement: p('withdrawRequirement').default(0).add(offer.baseSubtotalPrice * 0.75),
          totalDeposit: p('totalDeposit').default(0).add(offer.baseSubtotalPrice)
        }, r.error('already inserted'))
      )

      if(result.replaced <= 0) {
        logger.error(`Offer has already been accepted and credited`, {
          id,
          steamId,
          itemNames
        })

        return
      }

      // sockets.to(steamId).emit('depositComplete', offer.baseSubtotalPrice*0.7)

      const items = yield getItems(itemNames)

      const { changes } = yield PlayerItems.insert(itemNames.map(itemName => ({
        createdAt: r.now(),
        playerId: steamId,
        offerId: id,
        name: itemName,
        state: PLAYER_ITEM_AVAILABLE,

        disableWithdraw: true,
        disableExchange: true
      })), { returnChanges: true })

      yield addStats({
        counters: {
          totalDeposits: 1,
          totalDeposited: offer.sellPrice,

          totalSkinDeposits: 1,
          totalSkinDeposited: offer.sellPrice,
          totalSkinsDeposited: offer.itemNames.length,
          totalSkinDepositProfit: offer.sellPrice - offer.baseSubtotalPrice
        }
      })

      logger.info(`Accepted deposit of ${itemNames.join(', ')}`, {
        id,
        steamId
      })
    }
  } else if(type === 'WITHDRAW') {

    // if(offer.state === 'SENT') {
    //   sockets.to(steamId).emit('notification', `Your withdraw offer has been sent! <a href="${offer.tradeOfferUrl}" target="_blank">View it</a>`)
    // } else if(offer.state === 'ACCEPTED') {
    //   yield Player.get(steamId).update({
    //     totalWithdrawn: r.row('totalWithdrawn').default(0).add(offer.subtotal)
    //   })
    // }
  }
}

function* onSessionRequest(req, session) {

  if(!!session.user) {
    session.inventory = yield getPlayerInventory(session.user.id)
  }

  return session
}

function* watchPlayerItems() {
  const cursor = yield PlayerItems.changes({
    includeTypes: true
  })

  cursor.each((err, change) => {
    co(function* () {
      if(change.type === 'add' || change.type === 'change') {
        const { new_val: playerItem, old_val } = change

        if(!!old_val && playerItem.state !== old_val.state) {
          sockets.local.to(playerItem.playerId).emit('updatePlayerItem', [ playerItem.id ], {
            state: playerItem.state
          })

          return
        }

        const [ item ] = yield getItems([ playerItem.name ])

        sockets.local.to(playerItem.playerId).emit('addPlayerItem', [ formatPlayerItem(playerItem, item) ])
      } else if(change.type === 'remove') {
        sockets.local.to(change.old_val.playerId).emit('removePlayerItem', [ change.old_val.id ])
      }
    })

    .catch(err => {
      logger.error('watchPlayerItems', change.type, err)
    })
  })
}

export default {
  name: 'Inventory',

  documents,

  hooks: {
    afterApiRouteCreated,
    onTradeOfferStateChange,
    onVirtualOfferChange,
    onSessionRequest,

    ready: function* () {
      yield watchPlayerItems()
    },

    toggles() {
      return [{
        group: 'Inventory',
        key: 'disable:exchange',
        name: 'Exchange'
      }, {
        group: 'Inventory',
        key: 'kingdom:disable:withdraw',
        name: 'Withdraw'
      }, {
        group: 'Inventory',
        key: 'kingdom:disable:deposit',
        name: 'Deposit'
      }, {
        group: 'Inventory',
        key: 'kingdom:disable:selling',
        name: 'Selling'
      }]
    },
  }
}
