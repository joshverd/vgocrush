
import { Router } from 'express'
import co from 'co'

import { getAvailableItems } from 'lib/items'
import logger from 'lib/logger'
import { formatPlayerItem } from 'plugins/inventory/documents/player'
import redis from 'lib/redis'

function getItems(req, res) {
  co(function* () {
    const { items, hash } = yield getAvailableItems({hash: req.params.hash})

    res.json({
      hash,
      
      items: items.map(i => {
        const formatted = formatPlayerItem(null, i)
        formatted.blocked = i.blocked
        return formatted
      })
    })
  })

  .catch(err => {
    logger.error('GET /items', err)
    res.status(400).send('Please try again later')
  })
}

export default () => {
  const router = Router()

  router.get('/:hash', getItems)
  return router
}
