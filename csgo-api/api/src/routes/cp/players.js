
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import is from 'is_js'

import redis from 'lib/redis'
import r from 'lib/database'
import Player, { PlayerHistory } from 'document/player'
import { PlayerItems, addPlayerItem, removePlayerItem, updatePlayerItem, getPlayerItemPrice } from 'plugins/inventory/documents/player'
import { generateRandomItems } from 'plugins/crash'
import CrashGames from 'plugins/crash/documents/crash'
import { runPluginHook } from 'plugins'
import { Items, TradeOffers, PendingOffers, getItems } from 'lib/sknexchange'
import logger from 'lib/logger'
import { ensureAdmin, auditLog } from 'lib/middleware'




// route handlers
import getPlayerNotesHandler        from "./players/getPlayerNotesHandler.js";
import getPlayerAuditLogsHandler    from "./players/getPlayerAuditLogsHandler.js";
import addPlayerNotesHandler        from "./players/addPlayerNotesHandler.js";

function getPlayer(req, res) {

  try {

  }catch(err){
    logger.error('GET /cp/players/player', query, err);
    res.status(400).send(err.message || err)
  }
}

function getSearch(req, res) {
  const { query } = req.params

  co(function* () {
    let players = yield Player.getAll(query)

    if(!players.length && !req.query.single) {
      const byName = yield Player.filter(r.row('displayName').match(query))
      players = players.concat(byName)
    }

    players = _.uniq(players, p => p.id)

    res.json({
      players
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/search', query, err)
    res.status(400).send(err.message || err)
  })
}

function getPlayerItems(req, res) {
  const { playerId } = req.params

  co(function* () {
    const playerItems = yield PlayerItems
      .getAll(playerId, { index: 'playerId' })

    const items = yield getItems(_.uniq(_.pluck(playerItems, 'name')))

    res.json({
      playerItems: playerItems.map(playerItem => {
        if(!playerItem.type || playerItem.type === 'skin') {
          const item = _.findWhere(items, { name: playerItem.name })
          playerItem.price = !!item ? getPlayerItemPrice(item, playerItem.mode) : 0
        }

        return playerItem
      })
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/items', playerId, err)
    res.status(400).send(err.message || err)
  })
}

function getPlayerHistory(req, res) {
  const { playerId } = req.params

  let page = Math.max(1, parseInt(req.query.page) || 0)
  const perPage = 50

  co(function* () {
    const total = yield PlayerHistory.getAll(playerId, { index: 'playerId' }).count()
    const totalPages = Math.ceil(total / perPage)

    if(page > totalPages) {
      page = totalPages
    }

    const startIndex = (page - 1) * perPage
    const history = yield PlayerHistory
      .between([ playerId, r.minval ], [ playerId, r.now() ], { index: 'playerIdCreatedAt' })
      .orderBy({ index: r.desc('playerIdCreatedAt') })
      .slice(startIndex, startIndex + perPage)

    res.json({
      history
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/history', playerId, err)
    res.status(400).send(err.message || err)
  })
}

function getPlayerTradeOffers(req, res) {
  const { playerId } = req.params

  co(function* () {
    const tradeOffers = yield TradeOffers
      .getAll(playerId, { index: 'steamId64' })
      .orderBy(r.desc('createdAt'))
      .limit(500)

    res.json({
      tradeOffers
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/offers', playerId, err)
    res.status(400).send(err.message || err)
  })
}

function getPlayerVirtualOffers(req, res) {
  const { playerId } = req.params

  let page = Math.max(1, parseInt(req.query.page) || 0)
  const perPage = 50

  co(function* () {
    const total = yield PendingOffers.getAll(playerId, { index: 'steamId' }).count()
    const totalPages = Math.ceil(total / perPage)

    if(page > totalPages) {
      page = totalPages
    }

    const startIndex = (page - 1) * perPage
    const virtualOffers = yield PendingOffers
      .getAll(playerId, { index: 'steamId' })
      .orderBy(r.desc('createdAt'))
      .slice(startIndex, startIndex + perPage)

    res.json({
      virtualOffers
    })
  })
  .catch(err => {
    logger.error('GET /cp/players/offers', playerId, err)
    res.status(400).send(err.message || err)
  })
}

function postUpdatePlayer(req, res) {
  const { playerId } = req.params
  const canUpdate = [ 'lockDeposits', 'lockWithdraws', 'muted', 'banned', 'streamer', 'muteExpiration', 'maxWithdrawAmount' ]

  const update = _.chain(canUpdate)
    .filter(k => typeof req.body[k] !== 'undefined')
    .map(k => [ k, req.body[k] ])
    .object()
    .value()

  if(!!update.muted && update.muted) {
    update.muteExpiration = new Date(Date.now() + (60000 * 60))
  }

  co(function* () {
    const { replaced, changes } = yield Player.get(playerId).update(update, {
      returnChanges: true
    })

    res.json({
      player: replaced > 0 ? _.pick(changes[0].new_val, ...canUpdate) : {}
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/offers', playerId, err)
    res.status(400).send(err.message || err)
  })
}

function postRemovePlayerItem(req, res) {
  const { playerItemIds } = req.body

  if(!is.array(playerItemIds)) {
    return res.status(400).send('Invalid request')
  }

  co(function* () {
    res.json(yield removePlayerItem(playerItemIds, {
      fromAdmin: true,
      removedBy: req.user.id
    }))
  })

  .catch(err => {
    logger.error('GET /cp/players/removeItem', playerItemId, err)
    res.status(400).send(err.message || err)
  })
}

function postUpdatePlayerItem(req, res) {
  const { playerItemIds } = req.body

  const canUpdate = [ 'state' ]

  const update = _.chain(canUpdate)
    .filter(k => typeof req.body[k] !== 'undefined')
    .map(k => [ k, req.body[k] ])
    .object()
    .value()

  co(function* () {
    const { replaced, changes } = yield updatePlayerItem(playerItemIds, update, {
      fromAdmin: true,
      adminId: req.user.id
    })

    res.json({
      playerItems: _.pluck(changes, 'new_val')
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/updateItem', playerItemId, err)
    res.status(400).send(err.message || err)
  })
}

function postAddPlayerItem(req, res) {
  const { playerId } = req.params
  const { itemName } = req.body

  co(function* () {
    let items = []

    if(itemName.indexOf('$') === 0) {
      const usdValue = parseFloat(itemName.slice(1))
      const generated = yield generateRandomItems(usdValue, 'price')

      if(generated.items.length <= 0) {
        return res.status(400).send('Invalid USD value')
      }

      items = generated.items
    } else {
      items = yield Items.getAll(itemName, { index: 'name' })
    }

    if(items.length <= 0) {
      return res.status(400).send('Cannot find item to add')
    }

    const response = yield addPlayerItem(playerId, _.pluck(items, 'name'), {
      givenBy: req.user.id
    }, {
      returnChanges: true
    })

    res.json({
      playerItems: _.pluck(response.changes, 'new_val')
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/addItem', playerId, itemName, err)
    res.status(400).send(err.message || err)
  })
}

function getPlayerCrashHistory(req, res) {
  const { playerId } = req.params

  co(function* () {
    const games = yield CrashGames
      .getAll(playerId, { index: 'playerIds' })
      .filter({ state: 'Over' })
      .orderBy(r.desc('createdAt'))
      .limit(500)
      .map(c => c.merge({
        wager: c('players')(playerId)
      }))
      .pluck('id', 'hash', 'crashPoint', 'createdAt', 'wager')

    res.json({
      games
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/crash/history', playerId, err)
    res.status(400).send(err.message || err)
  })
}

export default () => {
  const ensureAdmin = (req, res, next) =>
    !!req.user && (req.user.admin || req.user.allowACPInventory) ? next() : res.status(400).send('No access')
  const router = Router()
  router.get('/search/:query', getSearch)
  router.get('/items/:playerId', getPlayerItems)
  router.get('/notes/:playerId', getPlayerNotesHandler)
  router.post('/notes/:playerId', addPlayerNotesHandler)
  router.get('/audit_logs/player/:playerId/:type/:source', getPlayerAuditLogsHandler)
  router.get('/audit_logs/source/:sourceId/:playerId/:type', getPlayerAuditLogsHandler)
  router.get('/history/:playerId', getPlayerHistory)

  router.get('/crash/history/:playerId', getPlayerCrashHistory)

  router.get('/tradeOffers/:playerId', getPlayerTradeOffers)
  router.get('/virtualOffers/:playerId', getPlayerVirtualOffers)
  router.post('/update/:playerId', auditLog, postUpdatePlayer)
  router.post('/removeItem', ensureAdmin, auditLog, postRemovePlayerItem)
  router.post('/updateItem', ensureAdmin, auditLog, postUpdatePlayerItem)
  router.post('/addItem/:playerId/', ensureAdmin, auditLog, postAddPlayerItem)
  return router
}
