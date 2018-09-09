
import r from 'lib/database'
import { eachSeries } from 'async'

import JackpotGames from './jackpotGame'

export default [
  r.tableCreate('JackpotGames'),
  JackpotGames.wait(),
  JackpotGames.indexCreate('modeState', j => ([ j('mode'), j('state') ])),
  JackpotGames.indexCreate('modeStateCreatedAt', j => ([ j('mode'), j('state'), j('createdAt') ])),
  JackpotGames.indexWait()
]
