
import co from 'co'
import _ from 'underscore'
import is from 'is_js'
import { Router } from 'express'
import { mapSeries } from 'async'

import { ITEM_WEAR } from 'constant/item'
import { getItems } from 'lib/sknexchange'
import r from 'lib/database'
import { addPlayerHistory } from 'document/player'
import logger from 'lib/logger'

export const PlayerItems                    = r.table('PlayerItems')
export const PLAYER_ITEM_AVAILABLE          = 'AVAILABLE'
export const PLAYER_ITEM_BUSY               = 'BUSY'
export const PLAYER_ITEM_OUT_OF_STOCK       = 'OUT_OF_STOCK'

const playerItemModePrice = {
  exchange: 'exchangePrice',
  deposit: 'depositPrice',
  upgrade: 'upgradePrice',
}

export function getPlayerItemPrice(item, mode) {
  mode = mode || 'deposit'
  return item[playerItemModePrice[mode]] || item.depositPrice
}

export function isPlayerItemSkin(playerItem) {
  return !playerItem.type || playerItem.type === 'skin'
}

export function isPlayerItemGift(playerItem) {
  return playerItem.type === 'gift'
}

export function formatPlayerItem(playerItem, skin, mode, opts = {}) {

  if(!!playerItem && isPlayerItemGift(playerItem)) {
    return _.pick(playerItem, 'id', 'name', 'description', 'shortDescription', 'type', 'wear', 'giftName')
  }

  mode = mode || 'deposit'

  const formattedItem = {
    type: 'skin',

    name: skin.name,
    price: getPlayerItemPrice(skin, mode),
    priceE: skin.exchangePrice,
    priceU: skin.upgradePrice,
    iconUrl: skin.icon,
    nameColor: skin.nameColor,
    wear: ITEM_WEAR[skin.wear] || '',
    qualityColor: skin.qualityColor,
    cleanName: skin.cleanName
  }

  if(!!opts.includeMode) {
    formattedItem.mode = mode
  }

  if(!!playerItem) {
    formattedItem.price = getPlayerItemPrice(skin, playerItem.mode || mode)
    formattedItem.id = playerItem.id
    formattedItem.state = playerItem.state
  }

  return formattedItem
}

export function getPlayerInventory(id) {
  return co(function* () {
    const playerItems = yield PlayerItems
      .getAll(id, { index: 'playerId' })

    const skinItemNames = _
      .chain(playerItems)
      .filter(isPlayerItemSkin)
      .pluck('name')
      .uniq()
      .value()

    const skins = yield getItems(skinItemNames)

    return playerItems

      .map(playerItem => {

        if(isPlayerItemSkin(playerItem)) {
          const skin = _.findWhere(skins, { name: playerItem.name })
          if(!skin) {
            logger.error('getPlayerInventory', 'cannot find skin', playerItem.name, {
              playerItemId: playerItem.id,
              playerId: playerItem.playerId
            })

            return null
          }

          return formatPlayerItem(playerItem, skin)
        }

        return formatPlayerItem(playerItem)
      })

      .filter(playerItem => playerItem !== null)
  })
}

export function addPlayerItem(playerId, playerItems, meta = {}, insertOptions = {}, options = {}) {
  insertOptions.returnChanges = true

  return PlayerItems

    .insert(playerItems.map(p => {
      p = typeof p === 'string' ? { name: p, type: 'skin' } : p

      if(!!p.id && !options.includeId) {
        delete p['id']
      }

      return {
        playerId,

        createdAt: new Date(),
        state: 'AVAILABLE',

        ...p
      }
    }), insertOptions)
    .run()
    .then(result => {
      const { inserted, changes } = result

      if(inserted > 0) {
        addPlayerHistory(playerId, changes.map(({ new_val }) => ({
          ...meta,

          type: 'addPlayerItem',
          playerItemId: new_val.id,
          change: new_val.name
        })))
      }

      return result
    })
}

export function removePlayerItem(playerItemIds, meta = {}) {
  return PlayerItems
    .getAll(r.args(playerItemIds))
    .delete({ returnChanges: true })
    .run()

    .then(result => {
      addRemovePlayerItemHistory(result, meta)
      return result
    })
}

export function addRemovePlayerItemHistory(result, meta) {
  if(result.deleted > 0) {
    addPlayerHistory(null, result.changes.map(({ old_val }) => ({
      ...meta,

      playerId: old_val.playerId,
      playerItemId: old_val.id,
      type: 'removePlayerItem',
      change: old_val.name
    })))
  }
}

export function updatePlayerItem(playerItemIds, update, meta = {}, updateOptions = {}) {
  let q = PlayerItems.getAll(r.args(playerItemIds))

  if(!is.array(playerItemIds)) {
    q = PlayerItems.getAll(r.args(playerItemIds.ids), playerItemIds.options)
  }

  return q
    .update(update, {
      ...updateOptions,
      returnChanges: true
    })
    .run()

    .then(result => {

      addUpdatePlayerItemHistory(result, meta)

      return result
    })
}

export function addUpdatePlayerItemHistory(result, meta = {}) {
  if(result.replaced > 0) {
    addPlayerHistory(null, result.changes.map(({ new_val, old_val }) => ({
      ...meta,

      playerId: new_val.playerId,
      playerItemId: new_val.id,
      type: 'updatePlayerItem',
      change: new_val.state
    })))
  }
}
