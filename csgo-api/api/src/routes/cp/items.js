
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import momenttz from 'moment-timezone'

import redis from 'lib/redis'
import r from 'lib/database'
import { runPluginHook } from 'plugins'
import { Items, TradeOffers } from 'lib/sknexchange'
import logger from 'lib/logger'
import { ensureAdmin } from 'lib/middleware'

function getSearch(req, res) {
  const { query } = req.query

  co(function* () {
    let items = []

    if(query.length) {
      items = yield Items.filter(r.row('name').downcase().match(query.toLowerCase()))
    }

    res.json({
      items
    })
  })

  .catch(err => {
    logger.error('GET /cp/items/search', query, err)
    res.status(400).send(err.message || err)
  })
}

function postUpdateItem(req, res) {
  const { itemId } = req.params
  const canUpdate = [ 'blocked' ]

  const update = _.chain(canUpdate)
    .filter(k => typeof req.body[k] !== 'undefined')
    .map(k => [ k, req.body[k] ])
    .object()
    .value()

  if(typeof update.blocked !== 'undefined') {
    update.forceBlocked = update.blocked
  }

  co(function* () {
    const { replaced, changes } = yield Items.get(itemId).update(update, {
      returnChanges: true
    })

    res.json({
      item: replaced > 0 ? changes[0].new_val : {}
    })
  })

  .catch(err => {
    logger.error('GET /cp/items/update', itemId, err)
    res.status(400).send(err.message || err)
  })
}

function getItemStats(req, res) {
  const start = momenttz().startOf('day').tz('America/Los_Angeles')
  const end = momenttz().endOf('day').tz('America/Los_Angeles')

  co(function* () {

    const stats = _
      .chain(offers)
      .value()

    console.log(stats)
  })

  .catch(err => {
    logger.error('GET /cp/items/stats', err)
    res.status(400).send(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.get('/search', getSearch)
  router.post('/update/:itemId', postUpdateItem)
  router.get('/stats', getItemStats)
  return router
}
