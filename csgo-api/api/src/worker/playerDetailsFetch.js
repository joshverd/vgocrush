//
// CS:GO API WORKER
//

import 'babel-polyfill'

import fs from 'fs'
import path from 'path'
import co from 'co'
import request from 'request'
import ColorThief from 'color-thief'

import * as amqp from 'lib/amqp'
import redis from 'lib/redis'
import Player from 'document/player'
import logger from 'lib/logger'

const colorThief = new ColorThief()

function onMessage(msg) {
  const channel = amqp.channel()
  const playerId = msg.content.toString()

  co(function* () {
    const v = yield redis.setnxAsync('playerLock:' + playerId, Date.now())

    if(!!v) {
      return channel.ack(msg)
    }

    const player = yield Player.get(playerId)
    if(!player) {
      throw new Error('cannot find player: ' + playerId)
    }

    redis.expire('playerLock:' + playerId, 60)

    const tmpLocation = path.join(process.cwd(), 'tmp', playerId + '.png')

    if(fs.existsSync(tmpLocation)) {
      fs.unlinkSync(tmpLocation)
    }

    yield new Promise((resolve, reject) =>
      request(player.avatar)
        .pipe(fs.createWriteStream(tmpLocation))
        .on('close', () => resolve())
    )

    const image = fs.readFileSync(tmpLocation)
    const rgb = colorThief.getColor(image)
    const avatarColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`

    logger.info('onMessage', playerId, avatarColor)

    yield Player.get(playerId).update({
      avatarColor
    })

    if(fs.existsSync(tmpLocation)) {
      fs.unlinkSync(tmpLocation)
    }

    redis.del('playerLock:' + playerId)
    channel.ack(msg)
  })

  .catch(err => {
    logger.error('onMessage', err)
    channel.nack(msg, false, false)
  })
}

co(function* () {
  logger.info('CS:GO API Worker')

  if(!fs.existsSync('./tmp')) {
    fs.mkdir('tmp')
  }

  yield amqp.connect()

  const channel = amqp.channel()
  channel.prefetch(2)

  const q = yield channel.assertQueue(amqp.PlayerDetailsFetchQueue, { durable: true })

  yield channel.consume(q.queue, onMessage)
})

.catch(err => {
  logger.error('startup error', err)
})
