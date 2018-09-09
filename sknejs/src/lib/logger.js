
import { Logger, transports } from 'winston'

export default new Logger({
  transports: [
    new transports.Console({
      colorize: true,
      prettyPrint: o => JSON.stringify(o)
    })
  ]
})
