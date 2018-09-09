
import config from 'config'
import { Router } from 'express'

import { ensureStaff } from '../lib/middleware'
import api from './api'
import cp from './cp'
import rpc from './rpc'

import admin from './admin'

function getRef(req, res) {
  res.redirect(`${config.app.url}/?utm_source=referral&utm_term=csgo&utm_content=${req.params.name}`)
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()

  router.use((req, res, next) => {
    res.sendError = err => res.status(500).send(err)
    next()
  })

  router.get('/ref/:name', getRef)
  router.use('/__cp', ensureStaff, cp())
  router.use('/_acp', ensureStaff, admin())

  router.use('/api', api())
  router.post('/skne', rpc)

  return router
}
