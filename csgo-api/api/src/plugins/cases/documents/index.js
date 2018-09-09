
import r from 'lib/database'
import { eachSeries } from 'async'

import Case, { CaseItems } from './case'
import { CaseStats } from './stats'
import Player, { PlayerLikes, PlayerOpens, PlayerItems } from './player'

export default [
  r.tableCreate('CaseStats'),
  CaseStats.wait(),
  CaseStats.indexCreate('createdAt'),
  CaseStats.indexCreate('caseId'),
  CaseStats.indexCreate('officialPriceCreatedAt', p => ([ p('official'), p('price'), p('createdAt') ])),
  CaseStats.indexWait(),

  r.tableCreate('CaseItems'),
  CaseItems.wait(),

  r.tableCreate('Case'),
  Case.wait(),
  // Case.indexCreate('free'),
  Case.indexCreate('createdAt'),
  Case.indexCreate('openingsCount24'),
  Case.indexCreate('official'),
  Case.indexCreate('playerId'),
  Case.indexCreate('freeDisabledOfficial', p => ([ p('free'), p('disabled'), p('official') ])),
  Case.indexCreate('slugDisabled', p => ([ p('slug'), p('disabled') ])),
  Case.indexCreate('playerIdSlug', p => ([ p('playerId'), p('slug') ])),
  Case.indexCreate('playerIdCreatedAt', p => ([ p('playerId'), p('createdAt') ])),
  Case.indexCreate('idOfficial', p => ([ p('id'), p('official') ])),
  Case.indexCreate('officialDisabled', p => ([ p('official'), p('disabled') ])),
  Case.indexCreate('officialCreatedAt', p => ([ p('official'), p('createdAt') ])),
  Case.indexWait(),

  r.tableCreate('PlayerLikes'),
  PlayerLikes.wait(),
  PlayerLikes.indexCreate('caseId'),
  PlayerLikes.indexCreate('playerId'),
  PlayerLikes.indexCreate('playerIdCase', p => ([ p('playerId'), p('caseId') ])),
  PlayerLikes.indexWait(),

  r.tableCreate('PlayerOpens'),
  PlayerOpens.wait(),
  PlayerOpens.indexCreate('caseId'),
  PlayerOpens.indexCreate('createdAt'),
  PlayerOpens.indexCreate('playerId'),
  PlayerOpens.indexCreate('prize'),
  PlayerOpens.indexCreate('idCreatedAt', p => ([ p('id'), p('createdAt') ])),
  PlayerOpens.indexCreate('caseIdCreatedAt', p => ([ p('caseId'), p('createdAt') ])),
  PlayerOpens.indexWait(),

  r.tableCreate('PlayerItems'),
  PlayerItems.indexCreate('playerId'),
  PlayerItems.indexCreate('name'),
  PlayerItems.indexCreate('nameState', p => ([ p('name'), p('state') ])),
  PlayerItems.indexCreate('playerIdState', p => ([ p('playerId'), p('state') ])),
  PlayerItems.indexCreate('idPlayerIdState', p => ([ p('id'), p('playerId'), p('state') ])),
  PlayerItems.indexCreate('idPlayerId', p => ([ p('id'), p('playerId') ])),
  PlayerItems.indexCreate('namePlayerIdState', p => ([ p('name'), p('playerId'), p('state') ])),
  PlayerItems.indexCreate('namePlayerId', p => ([ p('name'), p('playerId') ])),
  PlayerItems.wait(),
  PlayerItems.indexWait()
]
