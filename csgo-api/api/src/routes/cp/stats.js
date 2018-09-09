
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import { mapSeries } from 'async'

import { CaseStats } from  'plugins/cases/documents/stats'
import Case from 'plugins/cases/documents/case'

import { ItemListings } from 'lib/sknexchange'
import r from 'lib/database'
import Stats from 'document/stats'
import logger from 'lib/logger'

// handlers
import getLargestInventories from "./stats/getLargestInventoriesHandler.js";

function formatStat(stat, done) {
  co(function* () {
    stat.totalSkinDepositedUSD = (stat.totalSkinDeposited*0.95 || 0);
    stat.estimatedProfit = (stat.totalG2ADeposited || 0) + (stat.totalSkinDepositedUSD) - (stat.totalWithdrawn || 0)

    done(null, stat)
  })

  .catch(done)
}

function timespanToDate(timespan) {
  let startDate = r.time(r.now().year(), r.now().month(), r.now().day(), 'Z')

  if(timespan === 'weekly') {
    startDate = r.now().sub(r.now().dayOfWeek().sub(1).mul(86400))
  } else if(timespan === 'monthly') {
    startDate = r.time(r.now().year(), r.now().month(), 1, 'Z')
  } else if(timespan === 'lifetime') {
    startDate = 0
  }

  return startDate
}

function getStats(req, res) {
  const timespan = req.query.ts || 'realtime'

  co(function* () {
    let startDate = timespanToDate(timespan)

    const stats = yield Stats
      .between(startDate, r.maxval, { index: 'createdAt' })
      .orderBy({
        index: r.asc('createdAt')
      })

    const mergedStats = _
      .chain(stats)

      // TODO: Can probably do this in rethinkdb?
      .reduce((f, s) => {

        // TODO: This will probably need to be updated to be recursive when
        // or if we start nesting
        for(let k in s) {
          if(typeof s[k] === 'number') {
            f[k] = (f[k] || 0) + s[k]
          }
        }

        return f
      }, {})
      .value()

    const formattedMergedStats = yield new Promise((resolve, reject) =>
      mapSeries([ mergedStats ], formatStat, (err, stats) => !!err ? reject(err) : resolve(stats))
    )

    const formattedStats = yield new Promise((resolve, reject) =>
      mapSeries(stats, formatStat, (err, stats) => !!err ? reject(err) : resolve(stats))
    )

    const itemListingsCount = yield ItemListings.count()
    const itemListingsValue = yield ItemListings
      .map(item => item('price'))
      .reduce((l, r) => l.add(r))
      .default(0)

    res.json({
      mergedStats: {
        ...formattedMergedStats[0],

        itemListingsCount,
        itemListingsValue
      },
      stats: formattedStats
    })
  })

  .catch(err => {
    logger.error('GET /cp/stats', err)
    res.status(400).json(err.message || err)
  })
}

function getCaseStats(req, res) {
  const timespan = req.query.ts || 'daily'
  const order = req.query.order || 'desc'
  const sort = req.query.sort || 'totalOpenings'

  co(function* () {
    let startDate = timespanToDate(timespan)

    const stats = yield CaseStats
      .between(startDate, r.maxval, { index: 'createdAt' })
      .orderBy(r[order](sort))
      .limit(25)
      .eqJoin('caseId', Case)
      .zip()

    res.json({
      stats
    })
  })
  .catch(err => {
    logger.error('GET /cp/stats/cases', err)
    res.status(400).json(err.message || err)
  })
}
export default () => {
  const router = Router()
  router.get('/', getStats)
  router.get('/largest_inventories', getLargestInventories);

  router.get('/cases', getCaseStats)
  return router
}
