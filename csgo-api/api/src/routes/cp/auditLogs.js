
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import is from 'is_js'

import redis from 'lib/redis'
import r from 'lib/database'
import logger from 'lib/logger'
import getFetcher  from 'lib/auditLogs/logFetcher'
import { ensureAdmin } from 'lib/middleware'

function getAuditLogs(req, res) {
  const { playerId, page, type, source } = req.query

  co(function* () {
    const auditLogs = yield getFetcher(type, source)(playerId, page * 20, 20)

    res.json({
      auditLogs
    })
  })

  .catch(err => {
    logger.error('GET /cp/players/crash/history', playerId, err)
    res.status(400).send(err.message || err)
  })
}

export default () => {
  const ensureAdmin = (req, res, next) =>
    !!req.user && (req.user.admin || req.user.allowACPInventory) ? next() : res.status(400).send('No access')
  const router = Router()
  router.get('/', getAuditLogs)
  return router
}
