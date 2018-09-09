
import config from 'config'
import is from 'is_js'
import co from 'co'

import Player, { takePlayerBalance, givePlayerBalance } from 'document/player'
import Order from 'document/order'
import { addStats } from 'document/stats'
import logger from 'lib/logger'
import { ensureAuthenticated } from 'lib/middleware'
import r from 'lib/database'
import sockets from 'lib/sockets'

import documents from './documents'
import { publishMessage, getMessageHistory } from './lib/chat'

function postChatMessage(req, res) {
  // return res.status(400).send('Please refresh first to use the chat')
  //
  // const { user } = req
  // let { message } = req.body
  //
  // if(!is.string(message)) {
  //   return res.sendError('Invalid message')
  // }
  //
  // message = message.trim().substring(0, 255)
  //
  // if(message.length <= 0) {
  //   return res.sendError('Invalid message')
  // }
  //
  // publishMessage('en', message, user).then(() => res.send('1'), err => res.status(400).send(err))
}

function getChatHistory(req, res) {
  getMessageHistory(req.params.room)
    .then(messages =>
      res.json({
        messages
      })
    )
}

function* watchPlayers() {
  const cursor = yield Player
    .changes({ includeTypes: true })
    .filter(r.row('type').eq('change'))

  cursor.each((err, change) => {
    if(!!err) {
      logger.error('chat', 'watchPlayers', err)
      return
    }

    const clients = sockets.clients().sockets

    for(let client in clients) {
      if(!clients[client]._player) {
        continue
      }

      if(clients[client]._player.id !== change.new_val.id) {
        continue
      }

      clients[client]._player.totalDeposit = change.new_val.totalDeposit
      clients[client]._player.banned = change.new_val.banned
      clients[client]._player.muted = change.new_val.muted
      clients[client]._player.muteExpiration = change.new_val.muteExpiration
    }
  })
}

export default {
  documents,

  name: 'Public Chat',

  hooks: {

    ready: function* () {
      // yield watchPlayers()
    },

    afterApiRouteCreated(router) {
      // router.post('/chat', ensureAuthenticated, postChatMessage)
      router.get('/chatMessages/:room', getChatHistory)
    },

    onSocketConnection(socket) {
      socket.join('en')

      socket.on('chatMessage', (message, fn) => {
        fn('Please refresh first to use the chat')
        // const defer = publishMessage('en', message, socket._player)
        //
        // if(!!fn) {
        //   defer.then(() => fn(), err => fn(err))
        // }
      })
    }
  }
}
