
import _ from 'underscore'
import minimist from 'minimist'
import config from 'config'

import Bots from 'document/bot'
import logger from 'lib/logger'
import { decryptString } from 'lib/rsa'

let _botConfig = null

export async function loadBotConfig(identifier) {
  if(!!_botConfig) {
    return
  }

  // Check remote config
  const [ existingBot ] = await Bots.getAll(identifier, { index: 'identifier' })

  if(!!existingBot) {
    logger.info('botConfig', 'loadBotConfig', identifier, 'reading remote config')

    if(existingBot.opskins.enabled) {
      existingBot.opskins.apiKey = decryptString(existingBot.opskins.apiKey)
    }

    _botConfig = {
      ...existingBot,

      // Compatability...
      opskinsApiKey: existingBot.opskins.enabled ? existingBot.opskins.apiKey : null,
      autoSellInventory: existingBot.opskins.enabled ? existingBot.opskins.autoSellItems : false
    }
  } else if(!_botConfig && !!config.bots[identifier]) { // Check local config
    logger.info('botConfig', 'loadBotConfig', identifier, 'reading local config')
    _botConfig = config.bots[identifier]
  }

  if(!_botConfig) {
    throw new Error(`Cannot find bot config for ${identifier}`)
  }

  _botConfig = {
    features: [],
    groups: [],

    ..._botConfig
  }
}

export async function watchConfigChanges(cb) {
  const autoRestartOn = ['identifier', 'state', 'displayName']
  const autoRestartOnOp = ['enabled', 'isMaster', 'autoSellItems']
  const cursor = await Bots
    .filter({ id: _botConfig.id })
    .changes({ includeTypes: true })

  cursor.each((err, change) => {
    if(!!err) {
      logger.error('watchConfigChanges', err)
      return
    }

    _botConfig = change.new_val

    if(change.type === 'change') {
      if(_.difference(change.new_val.groups, change.old_val.groups).length) {
        cb && cb(change.new_val, 'groups change')
      } else if(_.difference(change.new_val.groups, change.old_val.groups).length) {
        cb && cb(change.new_val, 'features change')
      }

      for(let p of autoRestartOnOp) {
        if(_.difference(change.new_val.opskins.slaves || [], change.old_val.opskins.slaves || []).length) {
          cb && cb(change.new_val, 'op slaves changed')
        }

        if(change.new_val.opskins[p] !== change.old_val.opskins[p]) {
          cb && cb(change.new_val, 'op config changed: ' + p)
        }
      }

      for(let p of autoRestartOn) {
        if(change.new_val[p] !== change.old_val[p]) {
          cb && cb(change.new_val, 'config changed: ' + p)
        }
      }
    }
  })
}

export default () => _botConfig
