
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'

import FAQ from 'document/faq'
import r from 'lib/database'
import logger from 'lib/logger'
import { lookupSteamOffer } from 'lib/sknexchange'

function getOffer(req, res) {
  const { id } = req.params

  co(function* () {
    const details = yield lookupSteamOffer({
      tradeOfferId: id
    })

    res.json({
      details
    })
  })

  .catch(err => {
    logger.error('GET /cp/steam/offer', id, err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.get('/getOffer/:id', getOffer)
  return router
}
