
import { Router } from 'express'
import co from 'co'

import FAQ from 'document/faq'

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
  return router
}
