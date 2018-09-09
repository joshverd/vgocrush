
import co from 'co'
import socketIO from 'socket.io'
import config from 'config'
import redis from 'socket.io-redis'
import _ from 'underscore'

import * as chat from './chat'
import redisClient from './redis'
import Player from 'document/player'
import logger from 'lib/logger'
import { runPluginHook } from '../plugins'
import { getToggles } from 'lib/toggles'
import pkg from 'lib/pkg'
import { isVersionOutdated } from 'lib/version'
import { getBanner } from 'lib/server/banner'
import { getAvailableItems, clearItemsCache, getCachedItemsHash } from 'lib/items'

const io = global.sockets = socketIO()
io.adapter(redis(config.redis))

io.of('/').adapter.customHook = (msg, cb) => {
  switch(msg.event) {
    case 'updateItems':
      logger.info('Prices has been updated!')

      getAvailableItems({ ignoreCache: true }).then(({ hash }) => {
        io.local.emit('up', hash)
        cb()
      })

      break

    default:
      cb();
  }
}

export default io

let _lastOnlineCount = 0

export const lastOnlineCount = () => _lastOnlineCount

function broadcastOnlineCount() {
  io.of('/').adapter.clients((err, clients) => {
    _lastOnlineCount = clients.length
    io.local.emit('onlineCount', _lastOnlineCount)
  })
}

const _broadcastOnlineCount = _.throttle(broadcastOnlineCount, 5000)

io.on('connection', socket => {
  const { session: { passport }, locale } = socket.request

  if(!passport || !passport.user) {
    return
  }

  Player.get(passport.user).then(player => {
    if(!player) {
      logger.error('plugin', 'chat', 'onSocketConnection', 'Cannot get user', { playerId: passport.user })
      return
    }

    socket._watchGame = game => {
      if(!!socket._currentGame) {
        socket.leave(socket._currentGame)
      }

      if(!!game) {
        socket._currentGame = game
        socket.join(game)
      }
    }

    socket._playerId = passport.user
    socket._player = player

    socket.join(passport.user)

    socket.on('watchGame', game => socket._watchGame(game))
    socket.on('disconnect', () => _broadcastOnlineCount())

    broadcastOnlineCount()

    co(function* () {
      yield runPluginHook('onSocketConnection', socket)

      const toggles = yield getToggles({
        camelCase: true
      })

      const cachedItemsHash = yield getCachedItemsHash()

      socket.emit('ready', {
        cachedItemsHash,
        toggles,

        version: pkg.version,
        playerId: socket._playerId
      })

    })

    .catch(err =>
      logger.error('sockets', 'connection', err)
    )

  })
})
