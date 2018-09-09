
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'

import FAQ from 'document/faq'
import r from 'lib/database'
import logger from 'lib/logger'
import { resendOfferNotification } from 'lib/sknexchange'

function postResendNotification(req, res) {
  const { id, state } = req.body

  co(function* () {
    yield resendOfferNotification({
      id,
      state
    })

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error('POST /cp/offers/resendNotification', err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()

  const ensureAdmin = (req, res, next) =>
    !!req.user && (req.user.admin || req.user.allowACPInventory) ? next() : res.status(400).send('No access')

  router.post('/resendNotification', ensureAdmin, postResendNotification)
  return router
}
