
import 'babel-polyfill'

import co from 'co'
import config from 'config'
import { parallel } from 'async'
import _ from 'underscore'

import r from 'lib/database'
import logger from 'lib/logger'

import { CrashGameHashes } from './documents/crash'
import { generateHash } from './'

const offset    = 1e6
const games     = 1e6
let game      = games

let serverSeed = config.plugins.options.crash.serverSeed

function* loop(done) {
  const n = Math.min(game, 1000)

  const inserts = _.range(n).map(() => ({
    geneatedAt: r.now(),
    gameIndex: (offset + (--game)),
    hash: (serverSeed = generateHash(serverSeed))
  }))

  yield CrashGameHashes.insert(inserts)

  const pct = 100 * (games - game) / games

  if(pct % 1 === 0) {
    logger.info(`Processed: ${games-game} / ${games} (${pct.toFixed(2)}%)`)
  }

  if(game > 0) {
    process.nextTick(() =>
      co(loop, done).catch(err => {
        throw err
      })
    )
  } else {
    done()
  }
}

co(loop, () => {
  logger.info(`Inserted ${games} games...`)
  process.exit()
})

.catch(err => {
  logger.error(`Startup error: ${err}`)
})
