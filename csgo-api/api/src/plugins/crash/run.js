
/*
 * Chris [3:04 PM]
 * just comment above em
 * // chris is annoying so this means x
 *
 * EVENT        PURPOSE
 *
 * ocsg         onCrashStarting
 * ocs          onCrashStart
 * occ          onCrashCashout
 * oce          onCrashEnd
 * oct          onCrashTick
 * ocb          onPlayerBet
 **/

import 'babel-polyfill'

import co from 'co'
import is from 'is_js'
import _ from 'underscore'
import config from 'config'
import { parallelLimit } from 'async'
import http from 'http'
import socketIO from 'socket.io'
import uuidV4 from 'uuid/v4'

import r from 'lib/database'
import logger from 'lib/logger'
import sockets from 'lib/sockets'
import redis from 'lib/redis'
import { addStats } from 'document/stats'
import { loadItems, getAvailableItems, getCachedItemsHash, getRandomAvailableItems } from 'lib/items'

import { PlayerItems, formatPlayerItem, addPlayerItem, removePlayerItem, updatePlayerItem } from 'plugins/inventory/documents/player'
import CrashGames, { CrashGameHashes } from './documents/crash'
import { StateOver, StateStarting, StateBlocking, StateInProgress } from './constant/states'
import { isBonusRound, lastBonusRound, crashPointFromHash, joinCrashGame } from './'
import { formatGameHistory, formatPlayerBet, formatPlayerBetItems } from './lib/game'

const server = http.createServer()
const io = socketIO(server)

const crashOptions = config.plugins.options.crash

const tickRate        = 150
const startWaitTime   = 4000
const restartWaitTime = 9000

const growthFunc = ms => Math.floor(100 * Math.pow(Math.E, 0.00006 * ms))
const inverseGrowth = result => (16666.666667) * Math.log(0.01 * result)

let _lastGameIndex        = 1e6
let _gameState            = StateOver
let _gameCrashPoint       = null
let _gameHash             = null
let _lastGameHash         = null
let _gameStartedAt        = null
let _gamePlayers          = {}
let _gamePending          = {}
let _gamePendingCount     = 0
let _gameDuration         = null
let _game                 = null
let _gameForcePoint       = null
let _gameShuttingDown     = false

let _pendingBets          = []

let _lastAvailableItemsHash = null
let _maxWin               = 3000000

const emitPlayerBets = _.throttle(_emitPendingBets, 600)

function _emitPendingBets() {
  const bets = _pendingBets
  _pendingBets = []

  sockets.to('crash').emit('opb',  bets)
}

function* createGame(gameIndex) {
  const [ hash ] = yield CrashGameHashes.getAll(gameIndex, { index: 'gameIndex' })
  if(!hash) {
    return Promise.reject(`Could not find hash for game: ${gameIndex}`)
  }

  const _game = {
    hash
  }

  const result = yield CrashGames.insert({
    gameIndex,

    createdAt: r.now(),
    crashPoint: crashPointFromHash(hash.hash),
    bonusRound: false, //isBonusRound(hash.hash),
    state: StateStarting,
    hash: hash.hash,
    previousHash: !!_gameHash ? _gameHash : null,

    pendingJoins: {},

    playerIds: [],
    players: {}
  }, {
    returnChanges: true
  })

  if(result.inserted <= 0) {
    return Promise.reject(`Could not create game for ${gameIndex}`)
  }

  const history = yield CrashGames
    .between([ 'Over', 0 ], [ 'Over', r.maxval ], { index: 'stateCreatedAt' })
    .orderBy({
      index: r.desc('stateCreatedAt')
    })
    .limit(35)

  redis.set('crash:history', JSON.stringify(history.map(formatGameHistory)))

  return result.changes[0].new_val
}

function* runGame() {
  _game = yield createGame(_lastGameIndex + 1)
  if(!_game) {
    return Promise.reject(`runGame() cannot create new game`)
  }

  _gameState = StateStarting
  _gameCrashPoint = _game.crashPoint
  _gameHash = _game.hash
  _lastGameIndex++
  _gameStartedAt = new Date(Date.now() + restartWaitTime)
  _gamePlayers = {}
  _gameDuration = Math.ceil(inverseGrowth(_gameCrashPoint + 1))

  yield CrashGames.get(_game.id).update({
    startedAt: _gameStartedAt
  })

  yield redis.setAsync('crash:lastGameId', _game.id)
  yield redis.setAsync('crash:lastGameIndex', _lastGameIndex)

  emitStarting()
}

function emitStarting() {
  logger.info(`Starting new game for ${_gameCrashPoint / 100} (${_gameHash})`, {
    bonusRound: _game.bonusRound
  })

  _gameState = StateStarting

  co(function* () {
    const { hash } = yield getAvailableItems()

    sockets.to('crash').emit('ocsg', {
      h: hash,
      t: restartWaitTime
    })

    setTimeout(blockGame, restartWaitTime - 1000)
  })

  .catch(err =>
    logger.error('emitStarting', err)
  )
}

function blockGame() {
  _gameState = StateBlocking

  // logger.info('Blocking game', _game.id)

  // CrashGames.get(_game.id).update({
  //   state: StateBlocking
  // }).run()

  let wasDisabled = false

  const loop = () => {
    const ids = Object.keys(_gamePending)

    redis.get('disable:crash', (e, v) => {
      if(!!e || !!v) {
        logger.info('Delaying game while disabled')
        wasDisabled = true
        return setTimeout(loop, 1000)
      }

      if(_gamePendingCount > 0) {
        logger.info(`Delaying game while waiting for ${ids.length} (${ids.join(', ')}) join(s)`)
        return setTimeout(loop, 50)
      }

      if(wasDisabled) {
        _gameStartedAt = new Date(Date.now() + restartWaitTime)
        emitStarting()
        return
      }

      startGame()
    })
  }

  loop()
}

function startGame() {
  _gameState = StateInProgress
  _gameStartedAt = new Date()
  _gamePending = {}
  _gamePendingCount = 0

  // logger.info("Starting Game")

  CrashGames.get(_game.id).update({
    state: StateInProgress,
    startedAt: _gameStartedAt
  }).run()

  sockets.to('crash').emit('ocs', {})

  setForcePoint()
  callTick(0)
}

function callTick(elapsed) {
  const left = _gameDuration - elapsed
  const nextTick = Math.max(0, Math.min(left, tickRate))

  setTimeout(runTick, nextTick)
}

function runTick() {
  const elapsed = new Date() - _gameStartedAt
  const at = growthFunc(elapsed)

  runCashOuts(at)

  if(_gameForcePoint <= at && _gameForcePoint <= _gameCrashPoint) {
    cashoutAll(at, err => {
      if(!!err) {
        logger.error('Force cashout error', err)
      }

      logger.info('Forced cashout everyone at ', _gameForcePoint)
      endGame(true)
    })

    return
  }

  if(at > _gameCrashPoint) {
    endGame(false)
  } else {
    tick(elapsed)
  }
}

function cashoutAll(at, cb) {
  if(_gameState !== StateInProgress) {
    return cb()
  }

  logger.info('Cashing everyone out at:', at)

  if(at <= 100) {
    return cb()
  }

  runCashOuts(at)

  if(at > _gameCrashPoint) {
    return cb()
  }

  const tasks = []

  _.each(_game.players, play => {
    if (play.status === 'playing') {
      tasks.push(done => {
        if (play.status === 'playing') {
          doCashOut(play.playerId, at, done)
        } else {
          done()
        }
      })
    }
  })

  logger.info('Needing to force cash out: ', tasks.length, ' players');

  parallelLimit(tasks, 4, err => {
    if(!!err) {
      logger.error('Unable to cashout all players in', _game.id, ' at ', at)
      cb(err)
      return
    }

    logger.info('Emergency cashed out all players in game id: ', _game.id)
    cb()
  })
}

function doCashOut(playerId, elapsed, cb) {
  if(_game.players[playerId].status !== 'playing') {
    return cb()
  }

  _game.players[playerId].status = 'cashed_out'
  _game.players[playerId].stoppedAt = elapsed

  const play = _game.players[playerId]

  co(function* () {
    let winningItems = play.autoCashOut === play.stoppedAt ? play.targetItemsRaw : []

    if(winningItems.length === 0) {
      const total = play.wagerTotal * (play.stoppedAt / 100)
      const generated = yield getRandomAvailableItems({
        mode: 'upgradePrice',
        maxValue: total
      })

      winningItems = generated.items
    }

    winningItems = winningItems.map(i => ({
      ...i,
      id: `${playerId}-${uuidV4()}`
    }))

    _game.players[playerId].stoppedAtItems = winningItems.map(item => {
      return formatPlayerItem(item, _.findWhere(winningItems, {
        name: item.name
      }))
    })

    _game.players[playerId].stoppedAtItemsTotal = winningItems.reduce((t, i) => t + i.upgradePrice, 0)

    cb(null, _game.players[playerId])

    const { status, stoppedAt, stoppedAtItems, stoppedAtItemsTotal } = _game.players[playerId]

    sockets.to('crash').emit('occ', {
      p: playerId,
      s: status,

      a: stoppedAt,
      i: formatPlayerBetItems(stoppedAtItems),
      t: stoppedAtItemsTotal
    })

    yield removePlayerItem(play.playerItemIds, { crashGameId: _game.id })

    yield addPlayerItem(playerId, winningItems.map(({ id, name }) => ({
      id,
      name,
      mode: 'upgrade'
    })), {
      crashGameId: _game.id
    }, {}, {
      includeId: true
    })

    addStats({
      counters: {
        totalCrashCashed: 1
      }
    })

    yield CrashGames.get(_game.id).update(c => {
      return {
        players: c('players').merge({
          [playerId]: c('players')(playerId).merge(_game.players[playerId])
        })
      }
    })
  })

  .catch(cb)
}

function runCashOuts(elapsed) {
  let update = false

  _.map(_game.players, (play, id) => {

    if(play.status !== 'playing') {
      return
    }

    if(play.autoCashOut >= 101 && play.autoCashOut <= elapsed && play.autoCashOut <= _gameCrashPoint && play.autoCashOut <= _gameForcePoint) {
      doCashOut(play.playerId, play.autoCashOut, err => {
        if(!!err) {
          logger.error('runCashouts doCashOut', err)
        }
      })

      update = true
    }
  })

  if(update) {
    setForcePoint()
  }
}

function setForcePoint() {
  let totalBet = 0
  let totalCashedOut = 0

  _.each(_game.players, (play, id) => {
    if(play.status === 'cashed_out') {
      totalCashedOut += play.wagerTotal + ((play.stoppedAt - 100) / 100)
    } else if(play.status === 'playing') {
      totalBet += play.wagerTotal
    }
  })

  if(totalBet === 0) {
    _gameForcePoint = Infinity
  } else {
    const left = crashOptions.maxProfit - totalCashedOut - totalBet
    const ratio =  (left + totalBet) / totalBet

    _gameForcePoint = Math.max(Math.floor(ratio * 100), 101)
  }
}

function endGame(forced) {
  logger.info(`Ending game at ${_gameCrashPoint/100} (${_gameHash}) (forced ${forced ? 'Y' : 'N'})`)

  const crashTime = Date.now()

  let profit = 0

  _.map(_game.players, player => {
    if(player.status !== 'cashed_out') {
      profit += player.wagerTotal

      removePlayerItem(player.playerItemIds, { crashGameId: _game.id })
    }
  })

  _gameState = StateOver

  sockets.to('crash').emit('oce', {
    i: _game.id,
    // forced,
    // elapsed: _gameDuration,
    c: _gameCrashPoint,
    h: _gameHash,
    // bonusRound: _game.bonusRound,
    // lastBonusRound: lastBonusRound(_gameHash)
  })

  if(_gameShuttingDown) {
    logger.info('Shutting down game')
  } else {
    setTimeout(() => {
      co(runGame).catch(logger.error)
    }, (crashTime + startWaitTime) - Date.now())
  }

  CrashGames.get(_game.id).update({
    state: StateOver
  }).run()
}

function tick(elapsed) {
  sockets.to('crash').emit('oct', elapsed)
  callTick(elapsed)
}

function onIpcEvent(event, cb) {
  if(typeof event !== 'object') {
    return cb({ error: 'Invalid request' })
  }

  const giveError = error => cb({ error })
  const { player, options } = event

  co(function* () {

    if(event.name === 'joinCrash') {
      if(_gameState !== StateStarting) {
        return giveError('Game is currently in progress')
      }

      if(!is.array(options.itemIds) || !options.itemIds.length) {
        return giveError('An invalid bet was given')
      } else if(!!options.targetItemNames && !is.array(options.targetItemNames)) {
        return giveError('An invalid auto cashout was given')
      } else if(!!options.targetItemNames && options.targetItemNames.length > 10) {
        return giveError('The max target items you can enter is 10')
      } else if(!!options.target && (!is.number(options.target) || options.target < 101)) {
        return giveError('Invalid auto cashout value')
      }

      options.itemIds = _.uniq(options.itemIds)

      if(options.itemIds.length > 10) {
        return Promise.reject('The max amount of items you can bet at once is 10')
      }

      if(!!_gamePending[player.id] || !!_gamePlayers[player.id]) {
        return giveError('You have already joined this game')
      }

      // Block game

      _gamePending[player.id] = {
        targetItemNames: options.targetItemNames,
        playerItemIds: options.itemIds,
        name: player.displayName
      }

      _gamePendingCount++

      let joinError = null
      let joinResponse = null

      try {
        const newBet = yield joinCrashGame(_game.id, player, options)

        _game.players[player.id] = newBet
        _gamePendingCount--

        joinResponse = formatPlayerBet(newBet)
        _pendingBets.push(joinResponse)
        emitPlayerBets()
      } catch(e) {
        joinError = e

        delete _gamePending[player.id]
        _gamePendingCount--
      }


      if(!!joinError) {
        return Promise.reject(joinError)
      }

      cb(joinResponse)

    } else if(event.name === 'cashout') {

      if(_gameState !== StateInProgress) {
        return giveError('Game has already ended')
      }

      const elapsed = new Date(event.now) - _gameStartedAt
      let at = growthFunc(elapsed)

      if(at < 101) {
        return giveError('The minimum cashout is 1.01x')
      }

      const play = _game.players[player.id] || null
      if(!play) {
        return giveError('Could not find your bet')
      }

      if(play.autoCashOut > 100 && play.autoCashOut <= at) {
        at = play.autoCashOut
      }

      if(_gameForcePoint <= at) {
        at = _gameForcePoint
      }

      if(at > _gameCrashPoint) {
        return giveError('The game has already ended')
      } else if(play.status !== 'playing') {
        return giveError('You have already cashed out')
      }

      doCashOut(play.playerId, at, (err, result) => {
        if(!!err) {
          logger.error('cannot cashout', err, {
            at,
            gameId: _game.id,
            playerId: player.id,
          })
        }

        cb(result)
      })

      setForcePoint()
    } else {
      cb({ error: 'Invalid request' })
    }

  })

  .catch(err => {
    if(!is.string(err)) {
      logger.error(event.name, err, {
        options,
        playerId: player.id,
      })
    }

    cb({ error: is.string(err) ? err : 'Please try again later' })
  })
}

function refundGames(games) {
  return co(function* () {
    for(let game of games) {
      logger.info('Refunding game ', game.id)

      let refundedPlayers = []

      for(let playerId in game.players) {
        let play = game.players[playerId]

        if(play.status === 'playing') {
          refundedPlayers.push(play.playerId)

          logger.info('Refunding', play.playerId, play.wagerTotal, _.pluck(play.wagerItems, 'name').join(', '))

          yield PlayerItems.getAll(r.args(play.playerItemIds)).update({
            state: 'AVAILABLE'
          })

          // try {
          //   yield updatePlayerItem(play.playerItemIds, {
          //     state: 'AVAILABLE'
          //   }, {
          //     crashGameId: game.id
          //   })
          // } catch(e) {
          //   logger.error('Cannot refund', play.playerId, play.wagerTotal, _.pluck(play.wagerItems, 'name').join(', '), e)
          // }
        }
      }

      yield CrashGames.get(game.id).update({
        refundedPlayers,
        state: StateOver
      })
    }
  })
}

// ipc.serveNet('0.0.0.0', crashOptions.runnerIpc.port, () => {
//   ipc.server.on('joinCrash', (data, socket) =>
//     onIpcEvent(Object.assign({ name: 'joinCrash' }, data), response => {
//       ipc.server.emit(socket, `joinCrash:${data.player.id}`, Object.assign({
//         playerId: data.player.id
//       }, response))
//     })
//   )
//
//   ipc.server.on('cashout', (data, socket) =>
//     onIpcEvent(Object.assign({ name: 'cashout' }, data), response => {
//       ipc.server.emit(socket, `cashout:${data.player.id}`, Object.assign({
//         playerId: data.player.id
//       }, response))
//     })
//   )
// })

io.on('connection', socket => {
  socket.on('cashout', async function({ now, player }, fn) {
    if(_gameState !== StateInProgress) {
      return fn('Game has already ended')
    }

    const elapsed = new Date(now) - _gameStartedAt
    let at = growthFunc(elapsed)

    if(at < 101) {
      return fn('The minimum cashout is 1.01x')
    }

    const play = _game.players[player.id] || null
    if(!play) {
      return fn('Could not find your bet')
    }

    if(play.autoCashOut > 100 && play.autoCashOut <= at) {
      at = play.autoCashOut
    }

    if(_gameForcePoint <= at) {
      at = _gameForcePoint
    }

    if(at > _gameCrashPoint) {
      return fn('The game has already ended')
    } else if(play.status !== 'playing') {
      return fn('You have already cashed out')
    }

    doCashOut(play.playerId, at, (err, result) => {
      if(!!err) {
        logger.error('cannot cashout', err, {
          at,
          gameId: _game.id,
          playerId: player.id,
        })
      }

      fn(null, result)
    })

    setForcePoint()
  })

  socket.on('join', async function({ options, player }, fn) {
    if(_gameState !== StateStarting) {
      return fn('Game is currently in progress')
    } else if(!!_gamePending[player.id] || !!_gamePlayers[player.id]) {
      return fn('You have already joined this game')
    }

    // Block game

    _gamePending[player.id] = {
      targetItemNames: options.targetItemNames,
      playerItemIds: options.itemIds,
      name: player.displayName
    }

    _gamePendingCount++

    let joinError = null
    let joinResponse = null

    try {
      const newBet = await joinCrashGame(_game.id, player, options)

      _game.players[player.id] = newBet
      _gamePendingCount--

      joinResponse = formatPlayerBet(newBet)
      _pendingBets.push(joinResponse)
      emitPlayerBets()
    } catch(e) {
      joinError = e

      delete _gamePending[player.id]
      _gamePendingCount--
    }


    if(!!joinError) {
      return fn(joinError)
    }

    fn(null, joinResponse)
  })
})

co(function* () {
  logger.info('crash', 'starting up')

  const unfinishedGames = yield CrashGames.getAll(StateStarting, StateBlocking, StateInProgress, { index: 'state' })

  if(unfinishedGames.length > 0) {
    logger.info('crash', 'ending ', unfinishedGames.length, ' unfinished games')
    yield refundGames(unfinishedGames)
  }

  const lastGameIndex = yield redis.getAsync('crash:lastGameIndex')
  if(lastGameIndex) {
    _lastGameIndex = parseInt(lastGameIndex)
  }

  // const cursor = yield CrashGames.changes({
    // includeTypes: true
  // }).filter(r.row('type').eq('change').and(r.row('new_val')('state').eq('InProgress')))

  // cursor.each((err, change) => {
  //   if(!!err) {
  //     logger.error(`CrashGames cursor`, err)
  //     return
  //   }
  //
  //   const { new_val: game } = change
  //
  //   for(let k in _game.players) {
  //     _game.players[k] = {
  //       ..._game.players[k],
  //       ...game.players[k]
  //     }
  //   }
  // })

  yield loadItems()
  yield runGame()

  server.listen(crashOptions.runnerIpc.port, () => {
    logger.info('crash', 'runner started', `:${crashOptions.runnerIpc.port}`)
  })
})

.catch(err => {
  logger.error('crash', 'startup error', err)
})
