
import co from 'co'
import EventEmitter from 'eventemitter3'
import Immutable from 'seamless-immutable'
import _ from 'underscore'

import { resolveItem, updateItemsCache, getItemsCacheHash, getItemsCache } from 'lib/items'

import socket from './socket'
import api from './api'
import store from '../store'

export const events = new EventEmitter()

export let gameState   = 'NotStarted'
export let startTime    = null
export let startingIn   = null
export let lastTick     = null
export let lastCrash    = null
export let lag          = false

export let gameHistory  = Immutable([])

export let players      = []
export let playerBetSum = 0
export let playerId     = null
export let playerBet    = null
export let wasBonusRound = false
export let lastBonusRound = 0

export let options      = {}

export let availableItems    = []
let acs               = ''

let tickTimer     = null

export const growthFunc = ms => Math.pow(Math.E, 0.00006 * ms)

function getPlayerId() {
  if(!!playerId) {
    return playerId
  }

  const { currentUser } = store.getState()

  if(!!currentUser) {
    playerId = currentUser.id
  }

  return playerId
}

export function resetCrash() {
  gameState   = 'NotStarted'
  startTime    = null
  startingIn   = null
  lastTick     = null
  lastCrash    = null
  lag          = false

  gameHistory  = Immutable([])

  players      = []
  playerBetSum = 0
  playerBet    = null
  wasBonusRound = false
  lastBonusRound = 0

  if(tickTimer) {
    clearTimeout(tickTimer)
  }

  tickTimer     = null

  events.emit('onCrashStateChange', gameState)
}

export async function loadCrash() {
  playerId = getPlayerId()

  const { history, currentGame, options: options_, itemCacheHash } = await getCrashData({
    includeHistory: true,
    includeOptions: true
  })

  gameHistory = Immutable(history)
  players = sortBets(currentGame.players)
  options = options_
  startTime = new Date(Date.now() - currentGame.elapsed)

  playerBet = _.findWhere(currentGame.players, {
    playerId
  })

  console.log(playerBet)

  if(currentGame.state === 'Over') {
    lastCrash = currentGame.crashPoint / 100
  } else if(currentGame.state === 'Starting') {
    startingIn = (startTime - Date.now()) / 1000
  }

  gameState = currentGame.state

  events.emit('onCrashStateChange', gameState)
  events.emit('onCrashInit', gameHistory)
}

export function calculateGamePayout(ms) {
  const gamePayout = Math.floor(100 * growthFunc(ms)) / 100
  console.assert(isFinite(gamePayout))
  return Math.max(gamePayout, 1)
}

export function getElapsedTimeWithLag() {
  if(gameState == 'InProgress') {
    let elapsed = 0

    if(lag) {
      elapsed = lastTick - startTime + 500
    } else {
      elapsed = getElapsedTime(startTime)
    }

    return elapsed
  }

  return 0
}

export function getElapsedTime(startTime) {
  return Date.now() - startTime
}

function deconstructObject(obj, props) {
  if(!obj) {
    return null
  }

  const newObj = {}

  for(let k in props) {
    newObj[k] = typeof props[k] === 'function' ? props[k](obj) : obj[props[k]]
  }

  return newObj
}

function formatGameHistory(game) {
  return deconstructObject(game, {
    id: 'i',
    createdAt: 'c',
    hash: 'h',
    crashPoint: 'p'
  })
}

function formatGame(game) {
  return deconstructObject(game, {
    id: 'i',
    state: 's',
    startedAt: 't',
    elapsed: 'e',
    crashPoint: 'c',
    hash: 'h',
    players: ({ p }) => p.map(formatPlayerBet)
  })
}

export function getCrashData(opts = {}) {
  return api(`crash/data?${$.param(opts)}`).then(data => ({
    history: (data.h || []).map(formatGameHistory),
    currentGame: formatGame(data.c),
    options: data.o,
    itemCacheHash: data.i
  }))
}

export function generateRandomItems(maxValue) {
  let remaining = maxValue
  let items = availableItems.filter(i => i.priceU <= remaining)

  const chosenItems = []

  while (remaining > 0) {
    items = items.filter(i => i.priceU <= remaining)

    let possible = _.sortBy(items, 'priceU')
    if(!possible.length) {
      break
    }

    let item = possible[possible.length - 1]
    remaining -= item.priceU

    chosenItems.push(item)
  }

  return {
    remaining,

    items: chosenItems,
    value: maxValue - remaining
  }
}

export function joinGame(options) {
  return new Promise((resolve, reject) => {
    socket.emit('joinCrash', options, (err, result) => {
      if(!!err) {
        return reject(err)
      }

      result = formatPlayerBet(result)
      playerBet = result

      resolve(result)

      events.emit('joinedCrash', playerBet);
      ga('send','event','crash_bet','crash_bet');
    })
  })
}

export function cashoutGame() {
  return new Promise((resolve, reject) => {
    socket.emit('cashoutGame', (err, result) => {
      if(!!err) {
        return reject(err)
      }

      if(!!playerBet) {
        playerBet = {
          ...playerBet,
          ...result
        }
      }

      resolve(playerBet)
      ga('send','event','crash_cashout','crash_cashout');
    })
  })
}

function onCrashStart() {
  startTime = Date.now()
  gameState = 'InProgress'
  lastTick = startTime
  lag = false
  startingIn = null

  events.emit('onCrashStateChange', gameState)
  events.emit('onCrashStart')
}

function onCrashStarting(info) {
  const { t: timeUntilStart, h: cachedItemsHash } = info

  startTime = new Date(Date.now() + timeUntilStart)
  startingIn = (this.startTime - Date.now()) / 1000
  lastCrash = null
  gameState = 'Starting'
  wasBonusRound = false

  players = []
  playerBetSum = 0
  playerBet = null

  const currentItemsCacheHash = getItemsCacheHash()

  if(!currentItemsCacheHash || cachedItemsHash !== currentItemsCacheHash) {
    console.log('item cache hash mismatch', `${currentItemsCacheHash} !== ${cachedItemsHash}`)

    api('items/' + cachedItemsHash).then(({ items, hash }) => {
      updateItemsCache(items, hash)

      availableItems = getItemsCache()
      acs = getItemsCacheHash()
    })
  }

  events.emit('onCrashStateChange', gameState)
  events.emit('onCrashStarting')
}

function onCrashEnd(result) {
  const { i: id, h: hash, c: crashPoint, b: bonusRound } = result

  lastCrash = crashPoint/100
  gameState = 'Over'
  startingIn = null

  const lastGame = {
    id,
    hash,
    bonusRound,
    crashPoint: crashPoint / 100
  }

  gameHistory = Immutable([ lastGame ]).concat(gameHistory)

  wasBonusRound = bonusRound
  events.emit('onCrashStateChange', gameState)
  events.emit('onCrashEnd', lastGame)
}

let _lastDebugTick = Date.now()

function onCrashTick(elapsed) {

  if(gameState !== 'InProgress') {
    return
  }

  lastTick = Date.now()

  if(lag) {
    lag = false
  }

  // Correct the time of startTime every gameTick
  const currentLatencyStartTime = lastTick - elapsed

  if(startTime > currentLatencyStartTime) {
    startTime = currentLatencyStartTime
  }

  if(tickTimer) {
    clearTimeout(tickTimer)
  }

  tickTimer = setTimeout(checkForLag, 500)

  // if(Date.now() - _lastDebugTick > 100) {
  //   console.log('onCrashTick', lag, Date.now() - _lastDebugTick, lastTick-elapsed, startTime, currentLatencyStartTime)
  //   _lastDebugTick = Date.now()
  // }

  events.emit('onCrashTick')
}

function checkForLag() {
  lag = true
}

function sortBets(bets) {
  return bets.sort((a, b) => b.wagerTotal - a.wagerTotal)
}

function formatItem(item) {
  return deconstructObject(item, {
    id: 'i',
    name: 'n',
    cleanName: 'c',
    iconUrl: 'u',
    price: 'p',
    wear: 'w'
  })
}

function formatPlayerItems(items) {
  return _
    .map(items, (v, k) =>
      !Array.isArray(v) ? [ formatItem(v) ] :
      v.map(i => {
        const r = resolveItem(k, i[1])
        r.id = i[0]
        return r
      })
    )
    .reduce((a, b) => a.concat(b), [])
}

function formatPlayerBet(bet) {
  let avatarFull = bet.a

  if(avatarFull.indexOf('http') < 0) {
    avatarFull = `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/${avatarFull}`
  }

  const formatted = {
    avatarFull,

    playerId: bet.p,
    name: bet.n,
    wagerTotal: bet.w,
    status: bet.s,
    wagerItems: formatPlayerItems(bet.wi)
  }

  if(bet.s !== 'playing') {
    formatted.stoppedAt = bet.sa
    formatted.stoppedAtItemsTotal = bet.st
    formatted.stoppedAtItems = formatPlayerItems(bet.si)
  }

  return formatted
}

function onPlayerBet(bets) {
  for(let b of bets) {
    let bet = formatPlayerBet(b)

    players = sortBets(players.concat([ bet ]))
    playerBetSum += bet.wagerTotal

    events.emit('onPlayerBet', bet, players)
  }
}

function onPlayerCashout(bet) {
  const { p: playerId, s: status, a: stoppedAt, i: stoppedAtItems, t: stoppedAtItemsTotal } = bet

  bet = {
    playerId,
    status,
    stoppedAt,
    stoppedAtItems: formatPlayerItems(stoppedAtItems),
    stoppedAtItemsTotal
  }

  players = sortBets(players.map(p =>
    p.playerId === playerId ? Object.assign(p, bet) : p
  ))

  if(!!playerBet && bet.playerId === playerBet.playerId) {
    playerBet = {
      ...playerBet,
      ...bet
    }
  }

  events.emit('onPlayerCashout', bet, players)
}

socket.on('ready', ({ cachedItemsHash, playerId: playerId_, version, toggles }) => {

  co(function* () {
    const currentItemsCacheHash = getItemsCacheHash()

    if(!currentItemsCacheHash || cachedItemsHash !== currentItemsCacheHash) {
      console.log('item cache hash mismatch', `${currentItemsCacheHash} !== ${cachedItemsHash}`)

      const { items, hash } = yield api('items/' + cachedItemsHash)
      updateItemsCache(items, hash)
    }

    availableItems = getItemsCache()
    acs = getItemsCacheHash()

    playerId = playerId_
  })

  .catch(err =>
    console.error('socket', 'ready', err)
  )
})

socket.on('disconnect', () => {
  gameState = 'NotStarted'
  events.emit('onCrashStateChange', gameState)
  startTime = null
})

socket.on('up',  cachedItemsHash => {
  console.log('item cache has been updated')
  clearItemsCache()

  api('items/' + cachedItemsHash).then(({ items, hash }) => {
    updateItemsCache(items, hash)

    availableItems = getItemsCache()
    acs = getItemsCacheHash()
  })
})

socket.on('ocs', onCrashStart)
socket.on('ocsg', onCrashStarting)
socket.on('oce', onCrashEnd)
socket.on('oct', onCrashTick)

socket.on('opb', onPlayerBet)
socket.on('occ', onPlayerCashout)
