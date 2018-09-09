
import r from 'lib/database'
import { decryptString } from 'lib/rsa'

const Bots = r.table('Bots')
export default Bots

export const BotItems = r.table('BotItems')

export function decryptBot(bot) {
  if(bot.opskins.enabled) {
    bot.opskins.apiKey = decryptString(bot.opskins.apiKey)
  }

  return bot
}
