
import r from 'lib/database'
import crypto from 'crypto'
import randomstring from 'randomstring'
import _ from 'underscore'

import sockets from 'lib/sockets'

export const PlayerOpens              = r.table('PlayerOpens')
export const PlayerLikes              = r.table('PlayerLikes')

export const PlayerItems                    = r.table('PlayerItems')
export const PLAYER_ITEM_AVAILABLE          = 'AVAILABLE'
export const PLAYER_ITEM_BUSY               = 'BUSY'
export const PLAYER_ITEM_OUT_OF_STOCK       = 'OUT_OF_STOCK'

// getRollNumber
export function getRollNumber(serverSeed, clientSeed, nonce) {
  const text = `${clientSeed}-${nonce}`

  //create HMAC using server seed as key and client seed as message
  const hash = crypto.createHmac('sha512', serverSeed).update(text).digest('hex')
  let index = 0
  let lucky = parseInt(hash.substring(index * 5, index * 5 + 5), 16)

  //keep grabbing characters from the hash while greater than
  while (lucky >= Math.pow(10, 6)) {
    index++
    lucky = parseInt(hash.substring(index * 5, index * 5 + 5), 16)

    //if we reach the end of the hash, just default to highest number
    if (index * 5 + 5 > 128) {
      lucky = 99999
      break
    }
  }

  lucky %= Math.pow(10, 5)

  return lucky
}

// createKeyPair
export function createKeyPair(clientSeed, newUser, newUserWait = 1000) {
  clientSeed = clientSeed || randomstring.generate(16, { charset: 'numeric' }).toLowerCase()

  let serverSeed = ''

  m: while(true) {
    serverSeed = randomstring.generate(64, { charset: 'alphanumeric' }).toLowerCase()

    if(newUser) {
      for(let nonce = 0; nonce <= 100; nonce++) {
        const roll = getRollNumber(serverSeed, clientSeed, nonce + 1)

        if(roll < newUserWait) {
          continue m
        }
      }
    } else if(newUserWait === -1) {
      for(let nonce = 0; nonce <= 20; nonce++) {
        const roll = getRollNumber(serverSeed, clientSeed, nonce + 1)

        if(roll < 250) {
          continue m
        }
      }
    }

    break
  }

  const serverSeedHash = crypto.createHash('sha512').update(serverSeed).digest('hex');

  return {
    createdAt: new Date(),
    clientSeed,
    serverSeed,
    serverSeedHash,
    nonce: 0
  }
}
