
import 'babel-polyfill'

import co from 'co'
import http from 'http'
import Koa from 'koa'
import config from 'config'
import bodyParser from 'koa-bodyparser'

import logger from 'lib/logger'
import r from 'lib/database'
import { migrateDocuments } from '../document'

import api from './api'

const app     = new Koa()
const server  = new http.Server(app.callback())

co(function* () {
  logger.info('SknExchange Administration')

  yield migrateDocuments()

  app.use(bodyParser())

  app.use(async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      ctx.status = err.status || 500;
      ctx.body = err.message
      ctx.app.emit('error', err, ctx)
    }
  })

  app.use(api())

  const { httpPort } = config.administration
  server.listen(httpPort, () => logger.info(`Binded to 0.0.0.0:${httpPort}`))
})

.catch(err => {
  logger.error(`startup error: ${err}`)
})
