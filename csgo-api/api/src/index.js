
import 'babel-polyfill'
import 'datejs'

import express from 'express'
import co from 'co'
import cors from 'cors'
import config from 'config'
import bodyParser from 'body-parser'
import passport from 'passport'
import session from 'express-session'
import i18n from 'i18n'
import cookieParser from 'cookie-parser'
import path from 'path'
import compression from 'compression'
import morgan from 'morgan'
import http from 'http'
import helmet from 'helmet'
import requestIp from 'request-ip'
import minimist from 'minimist'

import connectRedis from 'connect-redis'
const RedisStore = connectRedis(session)

import './lib/math'

import r from './lib/database'
import logger from './lib/logger'
import routes from './routes'
import sockets from './lib/sockets'

import { loadItems } from './lib/items'
import * as amqp from './lib/amqp'
import * as database from './lib/database'
import { migrateRequiredDocuments } from './document'
import Player from './document/player'

import { discoverPlugins, runPluginHook } from './plugins'

import './lib/passport'

const argv = minimist(process.argv.slice(2))
global.argv = argv

// Express app
const app     = express()
const server  = new http.Server(app)

if(config.morgan) {
  app.use(morgan('tiny'))
}

// Express sessions
const sessionMiddleware = session({
  secret: config.app.sessionSecret,
  store: new RedisStore(config.redis),
  name: 'session',
  resave: true,
  saveUninitialized: true
})

// const interval = 1000;
// const lag = require('event-loop-lag')(interval);
//
// setInterval(()=>{
//   logger.info('event loop lag is %d', lag());
// }, 2000);

co(function* () {
  logger.info(`${config.app.name} ¯\_(ツ)_/¯`)

  yield migrateRequiredDocuments()
  yield loadItems()
  yield discoverPlugins()

  // yield amqp.connect()

  app.use(cors({
    origin: [ config.app.url, ...config.app.domains ],
    credentials: true
  }))

  // Session
  app.use(cookieParser())
  app.use(sessionMiddleware)
  app.use(requestIp.mw())

  // i18n

  i18n.configure({
    locales: ['en', 'ru', 'pl', 'fr', 'cn', 'tr', 'th', 'jp', 'es'],
    updateFiles: false,
    cookie: 'lang',
    directory: path.join(process.cwd(), 'resources', 'locales')
  })

  app.use(i18n.init)
  sockets.use((socket, next) => i18n.init(socket.request, {}, next))

  // Passport
  app.use(passport.initialize())
  app.use(passport.session())

  // Compression
  app.use(compression())

  // Body parser
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  // Static files
  app.use('/vendor', express.static(path.join(process.cwd(), 'resources', 'bower_components')))
  app.use('/management', express.static(path.join(process.cwd(), 'resources', 'static', 'management')))

  app.use(express.static(path.join('public')))

  app.use((req, res, next) => {
    if(req.user) {
      req.setLocale(req.user.language || 'en')
    }

    next()
  })

  // Routes
  app.use(routes())
  runPluginHook('attachRoutes', app)

  // EJS
  app.set('view engine', 'ejs')
  app.set('views', path.join(process.cwd(), 'resources', 'views'))

  // Error handling
  app.use(function(err, req, res, next) {
    if(err) {
      logger.error(err)

      if(req.xhr) {
        return res.json({ error: 'Please try again later' })
      }

      res.status(400).send('Please try again later')
      return
    }

    next()
  })

  runPluginHook('ready')

  // Socket.IO
  sockets.use((socket, next) => sessionMiddleware(socket.request, {}, next))
  sockets.use((socket, next) => passport.initialize()(socket.request, {}, next))
  sockets.use((socket, next) => passport.session()(socket.request, {}, next))
  sockets.listen(server)

  let offset = argv.offset || 0
  const httpPort = config.app.httpPort + offset

  server.listen(httpPort, () => logger.info(`Binded port :${httpPort}`))
})

.catch(err => {
  logger.error('Error starting up', err)
})
