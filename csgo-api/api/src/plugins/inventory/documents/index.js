
import r from 'lib/database'
import { eachSeries } from 'async'

import { PlayerItems } from './player'

export default [
  r.tableCreate('PlayerItems'),
  PlayerItems.indexCreate('playerId'),
  PlayerItems.indexCreate('name'),
  PlayerItems.indexCreate('nameState', p => ([ p('name'), p('state') ])),
  PlayerItems.indexCreate('playerIdState', p => ([ p('playerId'), p('state') ])),
  PlayerItems.indexCreate('idPlayerIdState', p => ([ p('id'), p('playerId'), p('state') ])),
  PlayerItems.indexCreate('idPlayerId', p => ([ p('id'), p('playerId') ])),
  PlayerItems.indexCreate('namePlayerIdState', p => ([ p('name'), p('playerId'), p('state') ])),
  PlayerItems.indexCreate('idPlayerIdState', p => ([ p('id'), p('playerId'), p('state') ])),
  PlayerItems.indexCreate('namePlayerId', p => ([ p('name'), p('playerId') ])),
  PlayerItems.wait(),
  PlayerItems.indexWait()
]
