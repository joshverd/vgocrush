import 'babel-polyfill'
import minimist from 'minimist'
import { OPSkinsAPI } from 'lib/opskins'
import logger from 'lib/logger'
import _ from 'underscore'
import { encryptString } from 'lib/rsa'
import r from 'lib/database'
import Bots  from 'document/bot'
import numeral from "numeral";

const argv = minimist(process.argv.slice(2))

async function run() {
  if(!argv.identifier || !argv.apiKey) {
    return logger.error('Invalid params')
  }
  
  let identifier = argv.identifier
  let apiKey = argv.apiKey

  const bot = {
    displayName: identifier,
    username: identifier,
    identifier: identifier.toLowerCase(),
    groups: [
      'opskins',
      'deposit',
      'withdraw'
    ],
    opskins: {
      apiKey: apiKey,
      enabled: true
    }
  }

  const opClient = new OPSkinsAPI(bot.opskins.apiKey)

  const isValid = await new Promise((resolve, reject) =>
    opClient.getBalance(err => resolve(!err))
  )

  if(!isValid) {
    return logger.error(`Invalid OPSkins api key`)
  }

  const opProfile = await opClient.getProfile()

  const opskinsBot = {
    opskins: {
      autoSellItems: false,
      apiKey: encryptString(bot.opskins.apiKey),
      isMaster: true,
      enabled: true,
    },
    state: 'Available',
    id: opProfile['id64'],
    identifier: identifier,
    groups: ['deposit', 'withdraw', 'opskins'],
    steamId: opProfile['id64'],
    steamId64: opProfile['id64'],
    createdAt: r.now(),
    storage: true
  }

  const summary = await getOPSummary(bot.opskins)

  opskinsBot.opskins.summary = _.map({
    ...(opskinsBot.summary || {}),
    ...summary
  }, (v, k) => ({
    key: k,
    name: k,
    value: summary[k]
  }))

  const replaceResult = await Bots
    .get(opskinsBot.id)
    .replace(b => r.branch(b.eq(null), opskinsBot, b.merge(opskinsBot)), { returnChanges: true })

  if(replaceResult.inserted <= 0 && replaceResult.replaced <= 0) {
    return logger.error('Nothing has been updated')
  }

  const result = {
    bot: replaceResult.changes[0].new_val,
    opskins: replaceResult.changes[0].new_val.opskins
  }

  logger.info('Result:', result)
  logger.info('Complete')
  process.exit(0)
}

async function getOPSummary(opskins) {
  const opClient = new OPSkinsAPI(opskins.apiKey)

  const balance = await new Promise((r, re) => opClient.getBalance((e, res) => !!e ? re(e) : r(res / 100)))

  let summary = {
    'Last Updated': new Date(),
    'Balance': `${numeral(balance).format('$0,0.00')}`
  }

  const { can_refresh: canRefresh, summary: accountSummary } = await opClient.getAccountSummary()

  if(canRefresh) {
    summary = {
      ...summary,

      'Total Sold': `${numeral(accountSummary.sold).format('$0,0.00')}`,
      'Total Listed': `${numeral(accountSummary.listed).format('$0,0.00')}`,
      'Total Purchases': `${numeral(accountSummary.purchases).format('$0,0.00')}`
    }
  }

  return summary
}

run()
