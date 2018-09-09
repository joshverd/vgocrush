
import config from 'config'
import amqplib from 'amqplib'

export const PlayerDetailsFetchQueue = 'csgoapi.playerDetails'

let _connection = null
let _channel = null

export function connect() {
  return amqplib.connect(config.amqp).then(connection => {
    _connection = connection
    return connection.createChannel()
  }).then(channel => {
    _channel = channel
    return _connection
  })
}

export function channel() {
  return _channel
}

export function connection() {
  return _connection
}
