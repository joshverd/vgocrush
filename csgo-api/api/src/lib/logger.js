
import config from 'config'
import { Logger, transports } from 'winston'
import winston from 'winston'
import Papertrail from 'winston-papertrail'

const t = [
  new transports.Console({
    prettyPrint: o => JSON.stringify(o)
  })
]

if(config.papertrail) {
  t.push(new winston.transports.Papertrail(config.papertrail))
}

export default new Logger({
  transports: t
})
