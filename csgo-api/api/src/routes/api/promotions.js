
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'

import logger from 'lib/logger'
import r from 'lib/database'
import { addPlayerItem } from 'plugins/inventory/documents/player'
import { generateRandomItems } from 'plugins/crash'
import redis from 'lib/redis'
import Promotions from 'document/promotion'
import Player from 'document/player'
import { getRandomAvailableItems } from 'lib/items'

function postRedeem(req, res) {
  const code = req.params.code.toLowerCase()

  co(function* () {
    const disabled = yield redis.getAsync('disable:promotionRedeem')

    if(disabled) {
      return res.status(400).send('Redeeming codes is currently disabled, please try again at a later time')
    }

    const [ promotion ] = yield Promotions.getAll(code, { index: 'code' })

    if(!promotion) {
      return res.status(400).send('An invalid code was given')
    } else if(promotion.maxUsages > 0 && promotion.usages >= promotion.maxUsages) {
      return res.status(400).send('An invalid code was given')
    }

    const promotionUpdate = yield Promotions
      .get(promotion.id)
      .update(r.branch(
        r.row('redeemedIds').default([]).contains(req.user.id),
        r.error('already redeemed'),

        r.row.hasFields('maxUsages')
          .and(r.row('maxUsages').gt(0))
          .and(r.row('usages').default(0).ge(r.row('maxUsages'))),
        r.error('max usages reached'),

        {
          redeemedIds: r.row('redeemedIds').default([]).append(req.user.id),
          usages: r.row('usages').default(0).add(1)
        }
      ))

    if(promotionUpdate.replaced <= 0) {
      return res.status(400).send('You have already redeemed this code before')
    }

    const winningItems = yield getRandomAvailableItems({ maxValue: promotion.value })

    yield addPlayerItem(req.user.id, [{
      type: 'gift',
      name: promotion.name,
      shortDescription: `Code: ${promotion.code}`,
      contains: {
        type: 'items',
        itemNames: _.pluck(winningItems.items, 'name')
      }
    }])

    res.json({
      name: promotion.name,
      value: promotion.value
    })
  })

  .catch(err => {
    logger.error('POST /api/promotions/redeem', code, err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.post('/redeem/:code', postRedeem)
  return router
}
