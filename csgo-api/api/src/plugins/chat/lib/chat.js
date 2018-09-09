import co from 'co'
import Limiter from 'ratelimiter'
import is from 'is_js'
import urlRegex from 'url-regex'
import parseDuration from 'parse-duration'

import Player from 'document/player'
import ChatHistory from '../documents/chatHistory'

import redis from 'lib/redis'
import logger from 'lib/logger'
import sockets from 'lib/sockets'
import r from 'lib/database'

const domainRegex = urlRegex({ exact: false, strict: false })
const riggedRegex = /(r|R)(\s+)?(I|i|1)?(\s+)?(g|G)(\s+)?(g|G)(\s+)?(e|E|3)(\s+)?(d|D)/g

// Available chat rooms
export const rooms        = [ 'en', 'ru', 'pt', 'chn', 'vnm', 'tur' ]

// Default chat room
export const defaultRoom  = 'en'

// Chat history
const chatHistorySize = 50
let messages        = {}

// getMessageHistory
export function getMessageHistory(room) {
  if(!is.string(room) || rooms.indexOf(room) < 0) {
    room = rooms[0]
  }

  return co(function* () {
    const cached = yield redis.getAsync(`chat:${room}:history`)
    if(!!cached) {
      return JSON.parse(cached)
    }

    const history = yield ChatHistory
      .between([ room, r.now().sub(86400) ], [ room, r.maxval ], { index: 'chatRoomCreatedAt' })
      .orderBy({ index: r.desc('chatRoomCreatedAt') })
      .limit(40)

    const messages = history.reverse()
    yield redis.setAsync(`chat:${room}:history`, JSON.stringify(messages), 'EX', 5)
    return messages
  })

  .catch(err =>
    logger.error(`getChatHistory() ${err}`)
  )
}

// deleteMessages
export function deleteMessages(room, userId) {
  sockets.of('/chat').to(room).emit('deleteMessages', userId)
  ChatHistory.getAll(userId, { index: 'userId' }).delete().run()
}

// deleteMessage
export function deleteMessage(room, id) {
  sockets.of('/chat').to(room).emit('deleteMessage', id)
  ChatHistory.get(id).delete().run()
}

// publishMessage
export function publishMessage(room, message, user) {
  return co(function* () {
    const lowercase = message.toLowerCase()
    const blacklist = yield redis.smembersAsync('chat:blacklistPatterns')

    for(let pattern of blacklist) {
      if(lowercase.indexOf(pattern.toLowerCase()) >= 0) {
        return Promise.reject(`The word ${pattern} is not allowed to be used in chat`)
      }
    }

    const push = {
      room,
      timestamp: new Date()
    }

    if(!!user) {
      if(!user.admin) {
        const disabled = yield redis.getAsync('kingdom:disable:chat')

        if(disabled || user.banned) {
          return Promise.reject('Chat is currently disabled')
        }
      }

      if(!user.totalDeposit || user.totalDeposit <= 0.50) {
        return Promise.reject('You need to deposit at least 0.50 credits to chat')
      }

      if(user.muted && user.muteExpiration > new Date()) {
        const seconds = parseInt((user.muteExpiration - Date.now()) / 1000)
        return Promise.reject(`You are muted for ${seconds} seconds`)
      } else if(user.muted) {
        user.muted = false
        Player.getAll(user.id).update({ muted: false }).run()
      }

      // if((!user.admin && !user.mod) && !user.totalWagered || user.totalWagered < 20) {
      //   return Promise.reject('You need to wager at least 20$ to use the chat!')
      // }

      const limiter = new Limiter({
        max: 1,
        duration: 1100,
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

      let username = user.displayName.replace(domainRegex, '').trim()

      if(!username.length) {
        username = `Player${user.id.substring(user.id.length - 5)}*`
      }

      push.username = username
      push.userId = user.id

      push.avatars = {
        medium: user.avatarMedium
      }

      if(user.streamer) {
        push.color = '#9575cd'
      }

      if(user.admin) {
        // push.tag = {
        //   color: '#fd2b69',
        //   prefix: 'admin'
        // }
      } else if(user.mod) {
        push.tag = {
          color: '#197adf',
          prefix: 'mod'
        }
      }

      if(!!user.chatTag && typeof user.chatTag === 'object') {
        push.tag = {
          color: 'linear-gradient(to right, #197adf, #fd2b69)',

          ...user.chatTag
        }
      }
    }

    const niceWords = ['cool', 'great', 'sexy', 'OP', 'amazing']
    push.message = message.replace(riggedRegex, niceWords[Math.floor(Math.random() * niceWords.length)])

    const { changes } = yield ChatHistory.insert({
      ...push,

      createdAt: r.now()
    }, {
      durability: 'soft',
      returnChanges: true
    })

    sockets.of('/chat').to(room).emit('chatMessage', changes[0].new_val)

  })
}
