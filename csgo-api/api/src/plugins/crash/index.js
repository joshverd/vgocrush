
import { Router } from 'express'
import crypto from 'crypto'
import co from 'co'
import config from 'config'
import is from 'is_js'
import _ from 'underscore'
import numeral from 'numeral'
import ipc from 'node-ipc'
import io from 'socket.io-client'

import r from 'lib/database'
import logger from 'lib/logger'
import redis from 'lib/redis'
import sockets from 'lib/sockets'
import { ensureAuthenticated } from 'lib/middleware'
import { Items } from 'lib/sknexchange'
import { isVersionOutdated } from 'lib/version'

import { PlayerItems, formatPlayerItem, addPlayerItem, removePlayerItem, updatePlayerItem } from 'plugins/inventory/documents/player'

import AvailableItems from 'document/items'
import Player from 'document/player'
import { addStats } from 'document/stats'
import { hashCode } from 'lib/string'
import { getAvailableItems, getRandomAvailableItems, getItems } from 'lib/items'

import CrashGames from './documents/crash'
import documents from './documents'
import { formatGameHistory, formatGame, rgrowthFunc } from './lib/game'

const crashOptions = config.plugins.options.crash
const InstaRate = 20
const BonusRate = crashOptions.bonusRate

let runner = null

export function generateHash(serverSeed) {
  return crypto.createHash('sha256').update(serverSeed).digest('hex')
}

function isHashDivisible(hash, mod) {
  let val = 0
  let o = hash.length % 4

  for (let i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
    val = ((val << 16) + parseInt(hash.substring(i, i+4), 16)) % mod
  }

  return val === 0
}

export function crashPointFromHash(serverSeed) {
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update('000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a')
    .digest('hex')

    if (isHashDivisible(hash, InstaRate)) {
      return 100
    }

    // Use the most significant 52-bit from the hash to calculate the crash point
    const h = parseInt(hash.slice(0, 52 / 4), 16)
    const e = Math.pow(2, 52)

    return Math.floor((100 * e - h) / (e - h))
}

export function isBonusRound(serverSeed) {
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update('000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a')
    .digest('hex')

    return isHashDivisible(hash, BonusRate)
}

export function lastBonusRound(lastHash) {
  let i = 0

  while(true) {
    if(isBonusRound(lastHash)) {
      return i
    }

    i++
    lastHash = generateHash(lastHash)
  }

  return -1
}

function* getCrash(socket, gameId) {
  let currentGame = null
  let lastGameId = gameId

  if(!lastGameId) {
    lastGameId = yield redis.getAsync('crash:lastGameId')
  }

  let players = []
  let playerBet = null


  if(lastGameId) {
    const lastGame = yield CrashGames.get(lastGameId)

    if(lastGame) {
      currentGame = {
        id: lastGame.id,
        state: lastGame.state,
        startedAt: lastGame.startedAt,
        elapsed: Date.now() - lastGame.startedAt,
        createdAt: lastGame.createdAt,
        lastBonusRound: !!lastGame.previousHash ? lastBonusRound(lastGame.previousHash) : 0
      }

      if(!!lastGame.players[socket._playerId]) {
        playerBet = _.pick(lastGame.players[socket._playerId], 'playerId', 'avatarFull', 'name', 'wagerTotal', 'wagerItems', 'status', 'stoppedAtItems', 'stoppedAt', 'stoppedAtItemsTotal', 'targetItemNames', 'targetItems', 'autoCashOut', 'avatarColor')
      }

      players = _.map(lastGame.players, b => _.pick(b, 'playerId', 'avatarFull', 'name', 'wagerTotal', 'wagerItems', 'status', 'stoppedAtItems', 'stoppedAt', 'stoppedAtItemsTotal', 'avatarColor'))

      if(lastGame.state === 'Over') {
        currentGame.hash = lastGame.hash
        currentGame.crashPoint = lastGame.crashPoint
        currentGame.bonusRound = lastGame.bonusRound
        currentGame.lastBonusRound = lastBonusRound(lastGame.hash)
      }
    }
  }

  let history = []

  if(!gameId) {
    const cachedHistory = yield redis.getAsync('crash:history')

    if(!!cachedHistory) {
      history = JSON.parse(cachedHistory)
    }

  }

  return {
    currentGame,
    players,
    playerBet,

    history: history.map(h => ({
      id: h.id,
      createdAt: h.createdAt,
      hash: h.hash,
      crashPoint: h.crashPoint / 100,
      bonusRound: h.bonusRound
    }))
  }
}

export function generateRandomItems(maxValue, mode = 'upgradePrice') {
  return co(function* () {
    let remaining = maxValue

    const availableItems = AvailableItems.map(i => i('name')).coerceTo('array')
    const items = yield Items
      .getAll(r.args(availableItems.map(name => ([ name, false ]))), { index: 'nameBlocked' })
      .filter(r.row(mode).le(remaining))

    const chosenItems = []

    while (remaining > 0) {
      let possible = _.sortBy(items.filter(i => i[mode] <= remaining), mode)

      if(!possible.length) {
        break
      }

      let item = possible[possible.length - 1]
      remaining -= item[mode]

      chosenItems.push(item)
    }

    return {
      remaining,

      items: chosenItems,
      value: maxValue - remaining
    }
  })
}

export function joinCrashGame(gameId, player, options = {}) {
  let { itemIds, targetItemNames, target } = options

  return co(function* () {

    const { replaced: playerItemReplaced, changes: playerItemChanges } = yield updatePlayerItem({
      ids: itemIds.map(id => [ id, player.id, 'AVAILABLE' ]),
      options: { index: 'idPlayerIdState' }
    }, item =>
      r.branch(item('state').eq('AVAILABLE').and(item('type').default('skin').eq('skin')), {
        state: 'BUSY',
        attemptJoinGameId: gameId,
        attemptJoinAt: r.now()
      }, r.error('state !== AVAILABLE'))
    , {
      crashGameId: gameId
    })

    if(playerItemReplaced <= 0) {
      return Promise.reject('Cannot items to wager')
    }

    const changed = (playerItemChanges || []).map(c => c.new_val)
    const itemNames = _.pluck(changed, 'name')

    itemIds = _.pluck(changed, 'id')

    const refundItems = () => PlayerItems
      .getAll(r.args(itemIds))
      .replace(p => p
        .without({
          attemptJoinAt: true,
          attemptJoinGameId: true
        })

        .merge({
          state: 'AVAILABLE'
        })
      , { returnChanges: true })

    if(playerItemReplaced !== itemIds.length) {

      if(playerItemReplaced > 0) {
        yield refundItems()
      }

      return Promise.reject(`Some items were no longer found in your inventory`)
    }

    const items = yield getItems(itemNames)

    if(items.length !== itemIds.length) {
      yield refundItems()
      return Promise.reject('Cannot find items')
    }

    // const { items: availableItems } = yield getAvailableItems()
    // const availableItemNames = _.pluck(availableItems, 'name')
    //
    // for(let i of itemNames) {
    //   if(availableItemNames.indexOf(i) < 0) {
    //     if(playerItemReplaced > 0) {
    //       yield refundItems()
    //     }
    //
    //     return Promise.reject(`${i} cannot be wagered, please exchange it for a different item`)
    //   }
    // }

    const playerItems = changed.map(playerItem => {
      const item = _.findWhere(items, {
        name: playerItem.name
      })

      return formatPlayerItem(playerItem, item, playerItem.mode, {
        includeMode: true
      })
    })

    let itemsSubtotal = playerItems.reduce((t, i) => t + i.price, 0)

    if(itemsSubtotal > crashOptions.maxBet) {
      yield refundItems()
      return Promise.reject(`The maximum bet is ${numeral(crashOptions.maxBet).format('$0,0.00')}`)
    }

    let targetItems = []
    let autoCashOut = -1

    if(target > 100) {
      // let amountNeeded = itemsSubtotal * (target / 100)

      // const generated = yield generateRandomItems(amountNeeded)
      //
      // if(generated.remaining > 1) {
      //   yield refundItems()
      //   return Promise.reject('Cannot find target items for desired cashout')
      // }
      //
      // targetItems = generated.items
      autoCashOut = target
      // autoCashOut = Math.ceil((generated.value / itemsSubtotal) * 100) // target
    } else if(!!targetItemNames && targetItemNames.length > 0) {

      targetItems = yield AvailableItems
        .getAll(r.args(targetItemNames), { index: 'name' })
        .eqJoin(i => ([ i('name'), false ]), Items, { index: 'nameBlocked' })
        .zip()

      if(targetItems.length === 0 || targetItems.length !== targetItemNames.length) {
        yield refundItems()
        return Promise.reject('Cannot find target items')
      }

      const targetItemsSubtotal = targetItems.reduce((t, i) => t + i.upgradePrice, 0)

      // const extra = targetItemsSubtotal - itemsSubtotal
      //
      // if(extra >= 0.03) {
      //   const subItems = yield generateRandomItems(extra)
      //   targetItems = targetItems.concat(subItems.items)
      // }

      // if(autoCashOut <= 100) {
        autoCashOut = parseInt((targetItemsSubtotal / itemsSubtotal) * 100)
      // }

      if(autoCashOut < 101) {
        yield refundItems()
        return Promise.reject(`Target items must be valued at least 1.00% more than than bet (${numeral(itemsSubtotal * 1.01).format('$0,0.00')})`)
      }
    }

    const newBet = {
      autoCashOut,

      createdAt: new Date(),
      playerId: player.id,
      avatarFull: player.avatarFull,
      // avatarColor: player.avatarColor,
      name: player.displayName,
      playerItemIds: itemIds,
      wagerTotal: itemsSubtotal,
      wagerItems: playerItems,
      wagerItemsNames: _.pluck(items, 'name'),
      targetItems: targetItems.map(i => formatPlayerItem(null, i, 'upgrade')),
      targetItemsRaw: targetItems.map(item => _.pick(item, 'icon', 'name', 'upgradePrice')),
      targetItemNames: _.pluck(targetItems, 'name'),

      status: 'playing'
    }

    CrashGames
      .get(gameId)
      .update({
        playerIds: r.row('playerIds').append(player.id),
        players: r.row('players').merge({
          [player.id]: newBet
        })
      }).run()

    addStats({
      counters: {
        totalCrashJoins: 1,
        totalCrashWagered: itemsSubtotal
      }
    })

    Player.get(player.id).update({
      withdrawRequirement: r.expr([ r.row('withdrawRequirement').sub(itemsSubtotal), 0 ]).max()
    }).run()

    return newBet
  })
}

function getBets(req, res) {
  co(function* () {
    const games = yield CrashGames
      .getAll(req.user.id, { index: 'playerIds' })
      .filter({ state: 'Over' })
      .orderBy(r.desc('createdAt'))
      .limit(10)

    res.json(games.map(g => {
      const bet = _.filter(g.players, b => b.playerId === req.user.id)[0]

      return {
        id: g.id,
        hash: g.hash,
        createdAt: g.createdAt,
        status: bet.status,
        itemNames: _.pluck((bet.status === 'cashed_out' ? bet.stoppedAtItems : bet.wagerItems), 'name'),
        itemsTotal: bet.status === 'cashed_out' ? bet.stoppedAtItemsTotal : bet.wagerTotal,
        stoppedAt: bet.status === 'cashed_out' ? bet.stoppedAt : null
      }
    }))
  })

  .catch(err => {
    logger.error('GET /crash/bets', err, {
      playerId: req.user.id
    })
  })
}

function getCrashData(req, res) {
  co(function* () {
    let gameId = req.query.gameId
    const showHistory = !!req.query.includeHistory

    if(!gameId) {
      gameId = yield redis.getAsync('crash:lastGameId')
    }

    if(!gameId) {
      return res.status(400).send('Could not get current crash')
    }

    const game = yield CrashGames.get(gameId)

    if(!game) {
      return res.status(400).send('Could not find game')
    }

    const response = {
      c: formatGame(game),
      i: yield redis.getAsync('pricing:hash')
    }

    if(showHistory) {
      const cachedHistory = yield redis.getAsync('crash:history')

      if(!!cachedHistory) {
        response.h = JSON.parse(cachedHistory)
      }
    }

    if(!!req.query.includeOptions) {
      response.o = _.pick(crashOptions, 'maxBet', 'maxProfit')
    }

    res.json(response)
  })

  .catch(err => {
    logger.error('GET /crash/bets', err, {
      playerId: req.user.id
    })
  })
}

function sendCrashRequest(eventName, args, fn) {
  // if(!fn || typeof fn !== 'function') {
  //   return fn('Please try again later')
  // }
  //
  // co(function* () {
  //   let disabled = yield redis.getAsync('disable:crash')
  //   if(eventName !== 'cashout' && disabled) {
  //     return fn('Crash is currently disabled')
  //   }
  //
  //   disabled = yield redis.getAsync('disable:crashBets')
  //   if(eventName !== 'cashout' && disabled) {
  //     return fn('Crash is currently disabled')
  //   }
  //
  //   ipc.of.api.once(`${eventName}:${args.player.id}`, response => {
  //     if(!response) {
  //       logger.error('crash', eventName, 'could not find a response')
  //       return fn('Please try again later')
  //     } else if(!!response.error) {
  //       return fn(response.error)
  //     }
  //
  //     if(!!fn) {
  //       fn(null, response)
  //     }
  //   })
  //
  //   ipc.of.api.emit(eventName, args)
  // })
  //
  // .catch(err => {
  //   logger.error('sendCrashRequest', err)
  // })
}

export default {
  documents,

  name: 'Crash',
  hooks: {
    ready() {
      logger.info('crash', 'ready', {
        bonusRate: BonusRate
      })

      logger.info(`http://${crashOptions.runnerIpc.host}:${crashOptions.runnerIpc.port}`)

      runner = io(`http://${crashOptions.runnerIpc.host}:${crashOptions.runnerIpc.port}`)

      runner.on('connect', () => {
        logger.info('crash', 'connected to runner')
      })
    },

    toggles() {
      return [{
        group: 'Crash',
        key: 'disable:crash',
        name: 'Crash'
      }, {
        group: 'Crash',
        key: 'disable:crashBets',
        name: 'Crash Bets'
      }]
    },

    afterApiRouteCreated(router) {
      const group = Router()

      group.get('/availableItems/:paramName', (req, res) => res.status(400).send('Client outdated'))
      group.get('/data', ensureAuthenticated, getCrashData)

      group.get('/bets', ensureAuthenticated, getBets)

      group.get('/abc123/:amount', ensureAuthenticated, (req, res) => {
        if(!req.user.admin) {
          return res.status(400).send('.')
        }

        const amount = Math.max(1, parseInt(req.params.amount))

        getRandomAvailableItems({ maxValue: amount }).then(({ items }) => {

          addPlayerItem(req.user.id, _.pluck(items, 'name'), {
            givenBy: req.user.id
          })

          res.json(_.pluck(items, 'name'))
        })
      })

      router.use('/crash', group)
    },

    onSocketConnection: function* (socket) {
      if(!socket._playerId) {
        return
      }

      const player = yield Player.get(socket._playerId)

      // socket._watchGame('crash')

      // Get info on the current game
      socket.on('getCrash', (opts, fn) => {
        if(!fn) {
          fn = opts
          opts = {}
        }

        const { hash, acs } = opts

        let lastGameId = null

        co(function* () {

          if(!!hash) {
            const [ game ] = yield CrashGames.getAll(hash, { index: 'hash' })

            if(!!game) {
              lastGameId = game.id
            }
          }

          const result = yield getCrash(socket, lastGameId)
          result.playerId = socket._playerId

          result.availableItemsHash = yield redis.getAsync('pricing:hash');
          result.options = _.pick(crashOptions, 'maxBet', 'maxProfit')

          fn(result)
        })

        .catch(err => {
          logger.error('socket getCrashInfo', err)

          fn({
            error: 'Please try again later'
          })
        })
      })

      // Join crash game
      socket.on('joinCrash', async function(options, fn) {
        if(!fn || typeof fn !== 'function') {
          return
        }

        let disabled = await redis.getAsync('disable:crash')

        if(disabled) {
          return fn('Crash is currently disabled')
        }

        disabled = await redis.getAsync('disable:crashBets')
        if(disabled) {
          return fn('Crash is currently disabled')
        }

        if(!runner || !runner.connected) {
          logger.error('crash', 'joinCrash', 'runner is not connected')
          return fn('Please try again later')
        }

        if(!options) {
          return fn('Invalid request')
        } else if(!is.array(options.itemIds) || !options.itemIds.length) {
          return fn('An invalid bet was given')
        } else if(!!options.targetItemNames && !is.array(options.targetItemNames)) {
          return fn('An invalid auto cashout was given')
        } else if(!!options.targetItemNames && options.targetItemNames.length > 10) {
          return fn('The max target items you can enter is 10')
        } else if(!!options.target && (!is.number(options.target) || options.target < 101)) {
          return fn('Invalid auto cashout value')
        }

        options.itemIds = _.uniq(options.itemIds)

        if(options.itemIds.length > 10) {
          return fn('The max amount of items you can bet at once is 10')
        }

        runner.emit('join', {
          options,
          player: _.pick(player, 'id', 'displayName', 'avatarFull')
        }, fn)
      })

      // Cashout crash game
      socket.on('cashoutGame', fn => {
        const now = Date.now()

        if(!fn || typeof fn !== 'function') {
          return
        } else if(!runner || !runner.connected) {
          logger.error('crash', 'cashoutGame', 'runner is not connected', {
            playerId: player.id
          })

          return fn('Please try again later')
        }

        runner.emit('cashout', {
          now,
          player: _.pick(player, 'id')
        }, fn)
      })
    }
  }
}
