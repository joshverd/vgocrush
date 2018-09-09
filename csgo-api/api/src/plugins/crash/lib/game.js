
import r from 'lib/database'
import _ from 'underscore'

export const growthFunc = ms => Math.floor(100 * Math.pow(Math.E, 0.00006 * ms))
export const rgrowthFunc = r.js('(function (ms) { return Math.floor(100 * Math.pow(Math.E, 0.00006 * ms)); })')
export const inverseGrowth = result => (16666.666667) * Math.log(0.01 * result)

export function formatPlayerBetItems(items) {
  return _
    .chain(items)
    .groupBy('name')
    .map((v, k) => ([ k, v.map(v =>
      [ v.id, !!v.mode ? v.mode.charAt(0) : '' ]
    )]))
    .object()
    .value()
}

export function formatPlayerBet(bet) {
  let avatar = bet.avatarFull

  const needle = 'public/images/avatars'
  const idx = avatar.indexOf(needle)

  if(idx >= 0) {
    avatar = avatar.substring(idx + needle.length + 1)
  }

  const formatted = {
    // Player ID
    p: bet.playerId,

    // Player avatar
    a: avatar,

    // Player name
    n: bet.name,

    // Wager total
    w: bet.wagerTotal,

    // Wager items
    wi: bet.wagerItems.map(i => ({
      i: i.id,
      n: i.name,
      c: i.cleanName,
      u: i.iconUrl,
      p: i.price,
      w: i.wear
    })),// formatPlayerBetItems(bet.wagerItems),

    // Status
    s: bet.status
  }

  if(bet.status !== 'playing') {
    formatted.sa = bet.stoppedAt
    formatted.st = bet.stoppedAtItemsTotal
    formatted.si = formatPlayerBetItems(bet.stoppedAtItems)
  }

  return formatted
}

export function formatGame(game, opts = {}) {

  const formatted = {
    // Game ID
    i: game.id,

    // Current state
    s: game.state,

    // Started at
    t: game.startedAt,

    // Elapsed
    e: Date.now() - game.startedAt,

    // Players
    p: _.map(game.players, p => formatPlayerBet(p))
  }

  if(game.state === 'Over') {
    formatted.h = game.hash
    formatted.c = game.crashPoint
  }

  return formatted
}

export function formatGameHistory(game) {
  return {
    // Game id
    i: game.id,

    // Date created
    c: game.createdAt,

    // Game hash
    h: game.hash,

    // Crash point
    p: game.crashPoint / 100
  }
}
