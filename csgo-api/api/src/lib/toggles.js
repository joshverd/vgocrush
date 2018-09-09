
import co from 'co'
import _ from 'underscore'
import camelCase from 'camelcase'

import sockets from 'lib/sockets'
import redis from 'lib/redis'
import { runPluginHook } from 'plugins'

const availableToggles = [{
  key: 'kingdom:disable:chat',
  name: 'Chat'
}, {
  group: 'Banner',
  key: 'enable:banner',
  name: 'Disable Banner'
}, {
  group: 'Auth',
  key: 'enable:alternateAuth',
  name: 'Disable Alternate Authentication'
}]

export function getToggles(opts = {}) {
  return co(function* () {
    const extraToggles = (yield runPluginHook('toggles')).reduce((a, t) => a.concat(t), [])
    const toggles = availableToggles.concat(extraToggles)

    const values = yield redis.mgetAsync(_.pluck(toggles, 'key'))

    return toggles.map((toggle, i) => ({
      ...toggle,
      key: opts.camelCase ? camelCase(...toggle.key.split(':')) : toggle.key,
      enabled: !!values[i],
      value: values[i] || ''
    }))
  })
}

export function setToggle(k, enabled, customMessage = null) {
  return co(function* () {
    if(!enabled) {
      yield redis.delAsync(k)
    } else {
      yield redis.setAsync(k, customMessage || Date.now())
    }

    sockets.emit('setToggle', {
      [camelCase(...k.split(':'))]: enabled ? customMessage || enabled : false
    })

    return enabled
  })
}
