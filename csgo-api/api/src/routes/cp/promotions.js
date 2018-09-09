
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import is from 'is_js'

import Promotions from 'document/promotion'
import r from 'lib/database'
import logger from 'lib/logger'

function getPromotions(req, res) {
  co(function* () {
    res.json({
      promotions: yield Promotions.orderBy({ index: r.asc('code') })
    })
  })

  .catch(err => {
    logger.error('GET /cp/promotions', err)
    res.status(400).json(err.message || err)
  })
}

function postSave(req, res) {
  let { code, maxUsages, prizeValue, name } = req.body

  if(!is.string(code) || !code.length || !is.number(maxUsages) || !is.number(prizeValue) || prizeValue <= 0
    || !is.string(name) || !name.length) {
    return res.status(400).send('Invalid request')
  }

  co(function* () {
    const existsCount = yield Promotions
      .getAll(code, { index: 'code' })
      .count()

    if(existsCount > 0) {
      return res.status(400).send(`The code "${code}" already exists`)
    }

    code = code.toLowerCase().trim()

    if(!code.length) {
      return res.status(400).send('Invalid code')
    }

    const newPromotion = {
      maxUsages,
      code,
      name,

      type: 'gift',
      createdAt: r.now(),
      slug: code,
      value: prizeValue,

      usages: 0
    }

    yield Promotions.insert(newPromotion)

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error('POST /cp/promotions/save', err)
    res.status(400).json(err.message || err)
  })
}

function postDelete(req, res) {
  let { id } = req.body

  co(function* () {
    yield Promotions.get(id).delete()

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error('POST /cp/promotions/delete', id, err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.get('/', getPromotions)
  router.post('/save', postSave)
  router.post('/delete', postDelete)
  return router
}
