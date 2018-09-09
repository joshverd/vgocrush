
import r from '../lib/database'
import crypto from 'crypto'
import randomstring from 'randomstring'
import _ from 'underscore'

// import sockets from '../lib/sockets'

const Player = r.table('Player')
export default Player

export const PlayerHistory            = r.table('PlayerHistory')

export const PlayerBalanceHistory     = r.table('PlayerBalanceHistory')
export const PlayerWithdrawHistory    = r.table('PlayerWithdrawHistory')
export const PlayerExternalAccounts   = r.table('PlayerExternalAccounts')
export const PlayerIp                 = r.table('PlayerIp')

// takePlayerBalance
export function takePlayerBalance(id, amount, meta = {}, extraUpdate) {
  return Player
    .get(id)
    .update(player => {
      return r.branch(player('balance').ge(amount), {
        ...(!!extraUpdate ? extraUpdate(player) : {}),
        balance: player('balance').sub(amount),
      }, r.error('not enough balance'))
    }, {
      returnChanges: !!extraUpdate,
      // ... bad idea?
      durability: 'soft'
    })

    .run()

    .then(response => {
      if(response.replaced > 0) {
        PlayerBalanceHistory.insert({
          meta,
          playerId: id,
          date: new Date(),
          balance: -amount
        }).run()
      }

      return response
    })
}

// givePlayerBalance
export function givePlayerBalance(id, amount, meta = {}, extraUpdate) {
  return Player
    .get(id)
    .update({
      ...(!!extraUpdate ? extraUpdate() : {}),
      balance: r.row('balance').add(amount),
    }, { returnChanges: true })

    .run()

    .then(response => {
      if(response.replaced > 0) {
        PlayerBalanceHistory.insert({
          meta,
          playerId: id,
          date: new Date(),
          balance: amount
        }).run()

        sockets.to(id).emit('user:update', {
          balance: response.changes[0].new_val.balance
        })
      }

      return response
    })
}

// logPlayerBalanceChange
export function logPlayerBalanceChange(id, amount, meta = {}) {
  return PlayerBalanceHistory.insert({
    meta,
    playerId: id,
    date: new Date(),
    balance: amount
  }).run()
}

// addPlayerFlash
export function addPlayerFlash(id, flashes) {
  flashes = Array.isArray(flashes) ? flashes : [ flashes ]

  return Player.get(id).update({
    sessionFlashes: r.row('sessionFlash').default({})
      .merge(_.object(flashes.map(f => [f, true])))
  })
}


export function addPlayerHistory(playerId, changes) {
  const now = new Date()

  return PlayerHistory.insert(changes.map(c => ({
    ...c,

    playerId: playerId || c.playerId,
    createdAt: new Date()
  }))).run()
}
