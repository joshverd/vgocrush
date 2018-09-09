
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'

import redis from 'lib/redis'
import r from 'lib/database'
import Stats from 'document/stats'
import { runPluginHook } from 'plugins'
import logger from 'lib/logger'
import { setToggle } from 'lib/toggles'

const availableToggles = [{
  key: 'kingdom:disable:chat',
  name: 'Chat'
}, {
  group: 'Promotions',
  key: 'disable:promotionRedeem',
  name: 'Promotion: Redeem'
}, {
  group: 'Raffles',
  key: 'disable:raffle',
  name: 'Raffles'
}, {
  group: 'Banner',
  key: 'enable:banner',
  name: 'Disable Banner',
  hasCustomMessage: true
}, {
  group: 'Withdraw',
  key: 'enable:pic',
  name: 'Experiment: Pending Item Count Check',
  defaultDisabled: true
}, {
  group: 'Withdraw',
  key: 'enable:wli',
  name: 'Expiriment: Use listed items for withdraw',
  defaultDisabled: true
},{
  group: 'Auth',
  key: 'enable:alternateAuth',
  name: 'Disable Alternate Authentication'
}]

function getToggles(req, res) {
  co(function* () {
    const extraToggles = (yield runPluginHook('toggles')).reduce((a, t) => a.concat(t), [])
    const toggles = availableToggles.concat(extraToggles)

    const values = yield redis.mgetAsync(_.pluck(toggles, 'key'))

    res.json({
      availableToggles: toggles.map((t, i) => ({
        ...t,
        value: values[i] || ''
      })),
      disabled: toggles
        .filter((_, i) => !!values[i])
        .map(t => t.key)
    })
  })

  .catch(err => {
    logger.error('GET /cp/toggles', err)
    res.status(400).json(err.message || err)
  })
}

function postToggles(req, res) {
  co(function* () {
    const value = yield redis.getAsync(req.body.toggle)
    const enabled = !(!!value)

    yield setToggle(req.body.toggle, enabled, req.body.customMessage)

    res.json({
      enabled,

      success: true
    })
  })

  .catch(err => {
    logger.error('POST /cp/toggles', err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.get('/', getToggles)
  router.post('/', postToggles)
  return router
}
