
import { Router } from 'express'
import co from 'co'
import is from 'is_js'
import _ from 'underscore'

import FAQ from 'document/faq'
import r from 'lib/database'
import logger from 'lib/logger'
import redis from 'lib/redis'

function postAddBlacklist(req, res) {
  const { newPattern } = req.body

  if(!is.string(newPattern) || !newPattern.length) {
    return res.status(400).send('Invalid request')
  }

  co(function* () {
    const r = yield redis.saddAsync('chat:blacklistPatterns', newPattern)
    if(!r) {
      return res.status(400).send('Pattern already exists')
    }

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error('POST /cp/chat/addBlacklist', err)
    res.status(400).json(err.message || err)
  })
}

function getBlacklist(req, res) {
  co(function* () {
    const blacklist = yield redis.smembersAsync('chat:blacklistPatterns')

    res.json({
      blacklist: blacklist.map(pattern => ({ pattern }))
    })
  })

  .catch(err => {
    logger.error('GET /cp/chat', err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.get('/blacklist', getBlacklist)
  router.post('/addBlacklist', postAddBlacklist)
  return router
}
