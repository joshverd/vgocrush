
import { Router } from 'express'
import co from 'co'
import r from '../../lib/database'

import { setToggle } from 'lib/toggles'
import redis from '../../lib/redis'

const settingsMap = {
  disableOpeningCase: 'kingdom:disable:opencase',
  disableWithdraw: 'kingdom:disable:withdraw',
  disableDeposit: 'kingdom:disable:deposit',
  disableChat: 'kingdom:disable:chat',
  disableSelling: 'kingdom:disable:selling',
  disableRedeeming: 'kingdom:disable:redeem',
  disableFreeSpin: 'kingdom:disable:freespin',
  disableCaseCreator: 'kingdom:disable:casecreator',
  disableCustomCases: 'kingdom:disable:customcase',
  disableCrash: 'disable:crash',
  disableExchange: 'disable:exchange'
}

function getSettings(req, res) {
  co(function* () {
    const settings = {}

    for(let k in settingsMap) {
      const v = yield redis.getAsync(settingsMap[k])
      settings[k] = !!v
    }

    res.json(settings)
  })
}

function postSettings(req, res) {
  co(function* () {
    for(let k in settingsMap) {
      if(typeof req.body[k] !== 'undefined') {
        yield setToggle(settingsMap[k], req.body[k])
      }
    }

    res.json({
      success: true
    })
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.get('/', getSettings)
  router.post('/', postSettings)
  return router
}
