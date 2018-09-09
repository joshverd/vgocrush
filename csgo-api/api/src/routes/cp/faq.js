
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'

import FAQ from 'document/faq'
import r from 'lib/database'
import logger from 'lib/logger'


function postSave(req, res) {
  const { id, question, answer } = req.body

  co(function* () {
    if(!!id) {
      yield FAQ.get(id).update({
        question,
        answer,

        updatedAt: r.now()
      })

      return res.json({
        success: true
      })
    }

    const { generated_keys } = yield FAQ.insert({
      createdAt: r.now(),
      question,
      answer
    })

    res.json({
      id: generated_keys[0],
      success: true
    })
  })

  .catch(err => {
    logger.error('POST /cp/faq/save', err)
    res.status(400).json(err.message || err)
  })
}

function getFAQ(req, res) {
  co(function* () {
    const questions = yield FAQ

    res.json({
      questions
    })
  })

  .catch(err => {
    logger.error('POST /cp/faq', err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.get('/', getFAQ)
  router.post('/save', postSave)
  return router
}
