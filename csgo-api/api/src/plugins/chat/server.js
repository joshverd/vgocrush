
import 'babel-polyfill'

import co from 'co'
import express from 'express'
import socketIO from 'socket.io'
import config from 'config'
import redis from 'socket.io-redis'
import session from 'express-session'
import http from 'http'
import parseDuration from 'parse-duration'
import cors from 'cors'

import connectRedis from 'connect-redis'
const RedisStore = connectRedis(session)

import r from 'lib/database'
import Player from 'document/player'
import logger from 'lib/logger'

import ChatHistory from './documents/chatHistory'
import { deleteMessage, defaultRoom, rooms, getMessageHistory, publishMessage, deleteMessages } from './lib/chat'

const chatOptions = config.plugins.options.chat

const app     = express()
const server  = new http.Server(app)

const io      = socketIO(server, {
  path: '/chat'
})

io.adapter(redis(config.redis))
io.origins('*:*')

logger.info('CS:GO API Chat Server')

const interval = 1000;
const lag = require('event-loop-lag')(interval);

setInterval(()=>{
  logger.info('event loop lag is %d', lag());
}, 2000);


// Express sessions
const sessionMiddleware = session({
  secret: config.app.sessionSecret,
  store: new RedisStore(config.redis),
  name: 'session',
  resave: true,
  saveUninitialized: true
})

app.use(cors({
  origin: [ config.app.url ],
  credentials: true
}))

const nsp = io.of('/chat')

nsp.use((socket, next) => sessionMiddleware(socket.request, {}, next))

nsp.on('connection', socket => {
  const { session: { passport }, locale } = socket.request

  if(!passport || !passport.user) {
    return socket.disconnect(true)
  }

  Player.get(passport.user).then(player => {
    if(!player) {
      return socket.disconnect(true)
    }

    // logger.info('io', 'connection', player.id, player.displayName)

    socket._player = player
    socket._room = defaultRoom

    getMessageHistory(socket._room).then(messages => {
      socket.emit('ready', {
        messages,
        channel: socket._room
      })

      socket.join(socket._room)
      socket.join(player.id)
    })

    socket.on('updateChannel', (room, fn) => {
      if(rooms.indexOf(room) < 0) {
        return
      }

      socket.leave(socket._room)
      socket._room = room
      socket.join(socket._room)
    })

    socket.on('chatMessage', (message, fn) => {
      if(typeof message !== 'string') {
        return
      }

      message = message.substring(0, 255).trim()

      if((player.mod || player.admin) && message.indexOf('/') === 0) {
        const parts = message.substring(1).split(' ')
        const command = parts[0]

        if(player.mod || player.admin) {
          if(command === 'clear' && parts.length ===  2) {
            deleteMessages(socket._room, parts[1])
          } else if(command === 'clearSingle' && parts.length === 2) {
            deleteMessage(socket._room, parts[1])
          } else if(command === 'permMute' && parts.length ===  2) {
            deleteMessages(socket._room, parts[1])

            const clients = nsp.clients().sockets
            const muteExpiration = new Date(Date.now() + (86400 * 365))

            for(let client in clients) {
              if(!clients[client]._player || clients[client]._player.id !== parts[1]) {
                continue
              }

              clients[client]._player.muted = true
              clients[client]._player.muteExpiration = muteExpiration
            }

            Player.get(parts[1]).update({
              muteExpiration,
              muted: true
            }).run()
          } else if(command === 'm' && parts.length === 3) {
            const ms = parseDuration(parts[2])
            deleteMessages(socket._room, parts[1])

            const clients = nsp.clients().sockets
            const muteExpiration = new Date(Date.now() + ms)

            for(let client in clients) {
              if(!clients[client]._player || clients[client]._player.id !== parts[1]) {
                continue
              }

              clients[client]._player.muted = true
              clients[client]._player.muteExpiration = muteExpiration
            }

            Player.get(parts[1]).update({
              muteExpiration,
              muted: true
            }).run()
          }
        }

        if(!!fn) {
          fn()
        }

        return
      }

      const defer = publishMessage(socket._room, message, socket._player)

      if(!!fn) {
        defer.then(() => fn(), err => fn(err))
      }
    })
  })
})

function clearOldMessages() {
  return ChatHistory
    .between(0, r.now().sub(7200), { index: 'createdAt' })
    .delete()
    .then(({ deleted }) => {

      if(deleted > 0) {
        logger.info('clearOldMessages', deleted, 'messages cleared')
      }

      setTimeout(clearOldMessages, 1000)
    })
}

const { httpPort } = chatOptions
server.listen(httpPort, () => {
  logger.info(`Binded port :${httpPort}`)

  clearOldMessages()
})