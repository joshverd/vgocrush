
import { Router } from 'express'
import co from 'co'

import { getBots } from 'lib/sknexchange'
import { ensureStaff, ensureAdmin } from 'lib/middleware'
import logger from 'lib/logger'

import stats from './stats'
import toggles from './toggles'
import players from './players'
import auditLogs from './auditLogs'
import items from './items'
import raffles from './raffles'
import faq from './faq'
import chat from './chat'
import steam from './steam'
import promotions from './promotions'
import offers from './offers'

function getStorage(req, res) {
  co(function* () {
    const bots = yield getBots()

    res.json({
      bots
    })
  })

  .catch(err => {
    logger.error('GET /cp/storage', err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.use('/offers', ensureStaff, offers())
  router.use('/steam', ensureStaff, steam())
  router.use('/chat', ensureStaff, chat())
  router.use('/faq', ensureAdmin, faq())
  router.use('/stats', ensureAdmin, stats())
  router.use('/toggles', ensureAdmin, toggles())
  router.use('/auditLogs', ensureAdmin, auditLogs())
  router.use('/players', ensureStaff, players())
  router.use('/items', ensureAdmin, items())
  router.use('/raffles', ensureAdmin, raffles())
  router.use('/promotions', ensureAdmin, promotions())
  router.get('/storage', ensureAdmin, getStorage)
  return router
}
