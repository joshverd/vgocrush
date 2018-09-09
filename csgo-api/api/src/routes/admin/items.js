
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import config from 'config'

import { getItems, searchItems } from '../../lib/sknexchange'
import logger from '../../lib/logger'
import { getWear, cleanItemName } from '../../lib/item'
import { determineCaseData } from 'plugins/cases'
import { ITEM_WEAR, ITEM_SHORT_WEAR } from '../../constant/item'

// GET /_manage/items/find
function getFind(req, res) {
  searchItems(req.query.search || '')
    .then(({ result }) => {
      res.json({
        results: result
      })
    }, error => {
      res.json({ error })
    })
}

function postAutoPrice(req, res) {
  const { items } = req.body

  co(function* () {
    const itemNames = _.uniq(_.pluck(items, 'name'))

    const itemDescriptions = _
      .chain(yield getItems(itemNames))
      .map(item => [item.name, item])
      .object()
      .value()

    if(Object.keys(itemDescriptions).length !== itemNames.length) {
      return res.status(400).send('Cannot find some of the items requested')
    }

    const caseItems = _
      .chain(items)
      .map(item => {
        return {
          name: item.name,
          odds: item.odds,
          sum: itemDescriptions[item.name].base * (item.odds/100)
        }
      })
      .value()

    const { price } = yield determineCaseData(caseItems, {
      allowAnyItems: true
    })

    res.json({
      price
    })
  })

  .catch(err => {
    logger.info(`postCreate()`, err)
    res.status(400).send('Internal error, contact an administrator')
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.get('/find', getFind)
  router.post('/autoPrice', postAutoPrice)
  return router
}
