
import r from '../lib/database'
import { eachSeries } from 'async'

import FAQ from './faq'
import Promotions from './promotion'
import Campaign from './campaign'
import Order from './order'
import Stats from './stats'
import AvailableItems from './items'
import Raffles, { RaffleEntries } from './raffles'
import Player, { PlayerHistory, PlayerBalanceHistory, PlayerWithdrawHistory, PlayerExternalAccounts, PlayerIp } from './player'

const requiredDocuments = [
  r.tableCreate('Raffles'),
  Raffles.indexCreate('raffleId'),
  Raffles.indexWait(),

  r.tableCreate('PlayerIp'),
  PlayerIp.indexCreate("ip"),
  PlayerIp.indexCreate("playerId"),
  PlayerIp.indexWait(),

  r.tableCreate('Promotions'),
  Promotions.indexCreate('code'),
  Promotions.indexWait(),

  r.tableCreate('FAQ'),
  FAQ.indexCreate('raffleId'),
  FAQ.indexWait(),

  r.tableCreate('RaffleEntries'),
  RaffleEntries.indexCreate('raffleId'),
  RaffleEntries.indexCreate('raffleIdTicketNumber', e => [e('raffleId'), e('ticketNumber')]),
  RaffleEntries.indexCreate('playerIdRaffleIdCreatedAt', e => [e('playerId'), e('raffleId'), e('createdAt')]),
  RaffleEntries.indexCreate('playerIdRaffleId', e => [e('playerId'), e('raffleId')]),
  RaffleEntries.indexWait(),

  r.tableCreate('PlayerHistory'),
  PlayerHistory.wait(),
  PlayerHistory.indexCreate('playerId'),
  PlayerHistory.indexCreate('playerIdCreatedAt', p => ([ p('playerId'), p('createdAt') ])),
  PlayerHistory.indexWait(),

  r.tableCreate('AvailableItems'),
  AvailableItems.wait(),
  AvailableItems.indexCreate('name'),
  AvailableItems.indexWait(),

  r.tableCreate('Stats'),
  Stats.wait(),
  Stats.indexCreate('createdAt'),
  Stats.indexWait(),

  r.tableCreate('Campaign'),
  Campaign.wait(),
  Campaign.indexCreate('playerId'),
  Campaign.indexCreate('code'),
  Campaign.indexCreate('caseId'),
  Campaign.indexCreate('type'),
  Campaign.indexWait(),

  r.tableCreate('Order'),
  Order.wait(),
  Order.indexCreate('method'),
  Order.indexCreate('createdAt'),
  Order.indexCreate('playerId'),
  Order.indexCreate('completed'),
  Order.indexCreate('transactionId'),
  Order.indexCreate('playerIdCompleted', p => ([ p('playerId'), p('completed') ])),
  Order.indexCreate('playerIdCompletedCreatedAt', p => ([ p('playerId'), p('completed'), p('createdAt') ])),
  Order.indexCreate('playerIdMethod', p => ([ p('playerId'), p('method') ])),
  Order.indexCreate('methodCompleted', p => ([ p('method'), p('completed') ])),
  Order.indexCreate('methodCreatedAt', p => ([ p('method'), p('createdAt') ])),
  Order.indexCreate('completedCreatedAt', p => ([ p('completed'), p('createdAt') ])),
  Order.indexWait(),

  r.tableCreate('BadIP'),

  r.tableCreate('Player'),
  Player.wait(),
  Player.indexCreate('totalDeposit'),
  Player.indexCreate('lastTrackedOrders'),
  Player.indexCreate('idTotalDeposit', p => ([ p('id'), p('totalDeposit') ])),
  Player.indexWait(),

  r.tableCreate('PlayerBalanceHistory'),
  PlayerBalanceHistory.wait(),
  PlayerBalanceHistory.indexCreate('playerId'),
  PlayerBalanceHistory.indexWait(),

  r.tableCreate('PlayerWithdrawHistory'),
  PlayerWithdrawHistory.indexCreate('playerId'),
  PlayerWithdrawHistory.indexCreate('createdAt'),
  PlayerWithdrawHistory.indexCreate('caseId'),
  PlayerWithdrawHistory.wait(),
  PlayerWithdrawHistory.indexWait(),

  r.tableCreate('PlayerExternalAccounts'),
  PlayerExternalAccounts.indexCreate('playerId'),
  PlayerExternalAccounts.indexCreate('provider'),
  PlayerExternalAccounts.wait(),
  PlayerExternalAccounts.indexWait(),

  r.tableCreate("AuditLogs"),

  r.table("AuditLogs")
    .indexCreate("action__createdAt", [r.row("action"), r.row("createdAt")]),

  r.table("AuditLogs")
    .indexCreate("type__createdAt", [r.row("type"), r.row("createdAt")]),

  r.table("AuditLogs")
    .indexCreate("target_playerId__type__createdAt", [r.row("target")("playerId"), r.row("type"), r.row("createdAt")]),
  r.table("AuditLogs")
    .indexCreate("source_playerId__type__createdAt", [r.row("source")("playerId"), r.row("type"), r.row("createdAt")]),

  r.table("AuditLogs")
    .indexCreate("source_playerId__createdAt", [r.row("source")("playerId"), r.row("createdAt")]),

  r.table("AuditLogs")
    .indexCreate("target_playerId__createdAt", [r.row("target")("playerId"), r.row("createdAt")]),


  r.table("AuditLogs")
    .indexCreate("source_playerId__action__createdAt", [r.row("source")("playerId"), r.row("action"), r.row("createdAt")]),
  r.table("AuditLogs")
    .indexCreate("target_playerId__action__createdAt", [r.row("target")("playerId"), r.row("action"), r.row("createdAt")]),

  r.table('AuditLogs').wait(),
  r.table('AuditLogs').indexWait(),

  r.tableCreate('PlayerNotes'),
  r.table('PlayerNotes').indexCreate("playerId__createdAt", [r.row("playerId"), r.row("createdAt")]),

  r.table('PlayerNotes').wait(),
  r.table('PlayerNotes').indexWait()
]

export function migrateRequiredDocuments() {
  return migrateDocuments(requiredDocuments)
}

/**
 * Migrate documents
 * @param  {Object} connection
 * @return {Promise}
 */
export function migrateDocuments(steps) {
  return new Promise((resolve, reject) => {
    eachSeries(steps, (query, done) =>
      query.run().then(() => done(), () => done())
    , () => resolve())
  })
}
