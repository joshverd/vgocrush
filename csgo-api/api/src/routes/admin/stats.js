
import { Router } from 'express'
import _ from 'underscore'
import config from 'config'
import co from 'co'
import r from '../../lib/database'
import moment from 'moment'

import Order from '../../document/order'
// import Case from 'plugins/cases/documents/case'
// import { CaseStats } from 'plugins/cases/documents/stats'
import Stats from '../../document/stats'
import { PlayerOpens } from 'plugins/cases/documents/player'
import { PlayerWithdrawHistory } from '../../document/player'
import logger from '../../lib/logger'

function getStats(req, res) {
  let startDate = r.time(r.now().year(), r.now().month(), r.now().day(), "Z").toISO8601()

  switch(req.query.timespan) {
    case 'weekly':
      startDate = moment().startOf("week").toISOString();
      break

    case 'monthly':
      startDate = moment().startOf("month").toISOString();
      break

    case 'lifetime':
      startDate = moment().subtract(5,'years').toISOString();
      break
  }

  co(function* () {
    const stats = yield Stats
      .between(startDate, r.maxval)

      .run()

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

    // const cases = yield CaseStats
    //   .between(r.now().sub(60*60*24), r.now() ,{index:"createdAt"})
    //   .orderBy(r[req.query.caseOrder](req.query.caseSort))
    //   .limit(25)
    //   .eqJoin('caseId', Case)
    //   .zip()
    //   .run()

    res.json({
      stats,
      mergedStats,
      cases: []
    })
  })

  .catch(err => {
    logger.error(`getStats() ${err}`)
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.get('/', getStats)
  return router
}
