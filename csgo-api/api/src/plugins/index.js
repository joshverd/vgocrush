
import pkginfo from 'pkginfo'
import fs from 'fs'
import path from 'path'
import _ from 'underscore'

import { eachSeries } from 'async'
import config from 'config'
import co from 'co'

import logger from 'lib/logger'
import { migrateDocuments } from 'document'

const _registeredPlugins = {}
const _hooks = {}

export function discoverPlugins() {
  logger.info('Discovering plugins...')

  return new Promise((resolve, reject) => {
    const plugins = config
      .plugins
      .enabled
      .filter(name => {
        const location = path.join(__dirname, name)

        return fs.lstatSync(location).isDirectory()
      })

    eachSeries(plugins, (pluginLocation, done) => {
      let plugin = null

      try {
        plugin = require(path.join(__dirname, pluginLocation, 'index.js'))['default']
      } catch(e) {
        return done(e)
      }

      co(function*() {
        if(!!plugin.register) {
          yield co(plugin.register)
        }

        if(!!plugin.documents) {
          yield migrateDocuments(plugin.documents)
        }
      })

      .then(() => {
        if(!!plugin.hooks) {
          for(let key in plugin.hooks) {
            if(!_hooks[key]) {
              _hooks[key] = []
            }

            _hooks[key].push(plugin.hooks[key])
          }
        }

        _registeredPlugins[pluginLocation] = plugin
        done()
      }, done)
    }, err => {
      if(!!err) {
        return reject(`discoverPlugins() ${err.stack || err}`)
      }

      const pluginNames = _.map(_registeredPlugins, p => p.name)
      logger.info(`Loaded ${pluginNames.length} plugins: ${pluginNames.join(', ')}`)

      resolve()
    })
  })

  .catch(console.log)
}

export function runPluginHook(fn, ...args) {
  return new Promise((resolve, reject) => {
    const hooks = _hooks[fn]

    if(!hooks) {
      return resolve([])
    }

    let lastResult = null
    let results = []

    // logger.info('runPluginHook', fn, hooks.length)

    eachSeries(hooks, (hook, done) => {
      co(hook, ...args, lastResult).then(response => {
        lastResult = response
        results.push(response)

        done()
      }, done)
    }, err => {
      if(!!err) {
        return reject(`runPluginHook() ${fn}: ${err.stack || err}`)
      }

      resolve(results)
    })
  })
}
