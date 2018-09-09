
import co from 'co'
import Limiter from 'ratelimiter'

import Player from '../document/player'

import redis from './redis'
import logger from './logger'
import sockets from './sockets'

// Available chat rooms
export const rooms        = [ 'en', 'ru' ]

// Default chat room
export const defaultRoom  = 'en'

// Chat history
const chatHistorySize = 50
let messages        = {}

// getMessageHistory
export function getMessageHistory(room) {
  return co(function* () {
    const messages = yield redis.lrangeAsync(`kingdom:chat:${room}:history`, 0, 50)
    return messages.map(JSON.parse)
  })
}

// deleteMessages
export function deleteMessages(room, userId) {
  co(function* () {
    sockets.to(`chat:${room}`).emit('deleteMessages', userId)

    const messages = yield redis.lrangeAsync(`kingdom:chat:${room}:history`, 0, 50)

    yield redis.delAsync(`kingdom:chat:${room}:history`)

    messages.map(JSON.parse).forEach((message, i) => {
      if(message.userid !== userId) {
        redis.rpush(`kingdom:chat:${room}:history`, JSON.stringify(message))
      }
    })
  })
}

// publishMessage
export function publishMessage(room, message, user) {
  return co(function* () {
    const disabled = yield redis.getAsync('kingdom:disable:chat')
    if(disabled) {
      return Promise.reject('Chat is currently disabled')
    }

    const push = {
      room,
      message,
      timestamp: new Date()
    }

    if(!!user) {
      if(user.banned) {
        return Promise.reject(`You are banned.`)
      }
      if(user.muted && user.muteExpiration > new Date()) {
        const seconds = parseInt((user.muteExpiration - Date.now()) / 1000)
        return Promise.reject(`You are muted for ${seconds} seconds`)
      }

      if(message.indexOf('/') === 0) {
        const parts = message.substring(1).split(' ')
        const command = parts[0]

        if(user.mod || user.admin) {
          if(command === 'm' && parts.length === 3) {
            const seconds = parseInt(parts[2])
            deleteMessages(room, parts[1])
            yield Player.get(parts[1]).update({
              muted: true,
              muteExpiration: new Date(Date.now() + (seconds * 1000))
            }).run()
          }
        }

        return
      }

      if(!user.totalDeposit || user.totalDeposit < 0.50) {
        if(!user.admin && !user.mod) return Promise.reject('You need to deposit at least 0.50 to use the chat')
      }

      const limiter = new Limiter({
        max: 4,
        duration: 3000,
        id: `chat:${user.id}`,
        db: redis
      })

      yield new Promise((resolve, reject) => {
        limiter.get((err, limit) => {
          if(err) {
            logger.error(`chat.publishMessage() ${err}`)
            return reject('Please try again later')
          }

          if(!limit.remaining) {
            return reject('Slow down! You are talking too fast!')
          }

          resolve()
        })
      })

      push.userid = user.id
      push.username = user.displayName
      push.avatars = {
        medium: user.avatarMedium
      }

      if(user.admin) {
        push.tag = {
          color: '#eca263',
          prefix: 'admin'
        }
      } else if(user.mod) {
        push.tag = {
          color: '#86b4ff',
          prefix: 'mod'
        }
      }

      redis.incr(`kingdom:user:${user.id}:messageCount`)
    }

    redis.rpush(`kingdom:chat:${room}:history`, JSON.stringify(push))
    redis.ltrim(`kingdom:chat:${room}:history`, -50, -1)

    // if(typeof messages[room] === 'undefined') {
    //   messages[room] = []
    // }
    //
    // messages[room].push(push)
    // if(messages[room].length > chatHistorySize) {
    //   messages[room].splice(0, messages[room].length - chatHistorySize)
    // }

    sockets.to(`chat:${room}`).emit('msg', push)
  })
}
