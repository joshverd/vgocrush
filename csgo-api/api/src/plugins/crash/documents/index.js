
import r from 'lib/database'
import { eachSeries } from 'async'

import CrashGames, { CrashGameHashes } from './crash'

export default [
  r.tableCreate('CrashGameHashes'),
  CrashGameHashes.wait(),
  CrashGameHashes.indexCreate('gameIndex'),
  CrashGameHashes.indexWait(),

  r.tableCreate('CrashGames'),
  CrashGames.wait(),
  CrashGames.indexCreate('hash'),
  CrashGames.indexCreate('state'),
  CrashGames.indexCreate('playerIds', { multi: true }),
  CrashGames.indexCreate('stateCreatedAt', c => ([ c('state'), c('createdAt') ])),
  CrashGames.indexCreate('idState', c => ([ c('id'), c('state') ])),
  CrashGames.indexWait()
]
