

import Router from 'koa-router'
import is from 'is_js'
import _ from 'underscore'
import numeral from 'numeral'
import SteamTotp from 'steam-totp'

import requirePermissions from '../middleware/requirePermissions'

import rsa, { encryptString, decryptString } from 'lib/rsa'
import r from 'lib/database'
import * as util from 'lib/util'
import { OPSkinsAPI } from 'lib/opskins'
import { SteamClient } from 'bot/lib/steamClient'

import Bots, { decryptBot } from 'document/bot'
import { userPermissions } from 'document/users'

const allowedUpdateProperties = ['displayName', 'groups', 'opskins', 'notes']
const publicBotFields = ['id', 'notes', 'identifier', 'steamId', 'groups', 'features', 'displayName', 'tradeUrl', 'state', {
  opskins: ['enabled', 'summary', 'isMaster', 'slaves', 'autoSellItems']
}]

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

async function postSave(ctx, next) {
  let { body: { bot } } = ctx.request

  if(!bot) {
    return ctx.throw(400, 'Invalid request')
  }

  const isSaving = is.string(bot.id) && bot.id.length
  const required = isSaving ? ['displayName', 'groups'] :
    ['displayName', 'username']

  for(let f of required) {
    if(f === 'groups') {
      if(!is.array(bot[f])) {
        return ctx.throw(400, `${f} is required`)
      }
    } else if(!is.string(bot[f]) || !bot[f].length) {
      return ctx.throw(400, `${f} is required`)
    }
  }

  let requireOPCheck = true // !isSaving

  const updatedProperties = _
    .chain(allowedUpdateProperties)
    .filter(k => !!bot[k])
    .map(k => ([ k, bot[k] ]))
    .object()
    .value()

  if(isSaving) {
    const existingBot = await Bots.get(bot.id)

    if(!existingBot) {
      return ctx.throw(400, `Cannot find bot to update (${bot.id})`)
    }

    bot = decryptBot(util.merge(existingBot, _.pick(updatedProperties, ...allowedUpdateProperties)))
  }

  const opskinsResult = {
    enabled: !!bot.opskins && (bot.groups.indexOf('opskins') >= 0 || bot.opskins.enabled)
  }

  if(requireOPCheck && opskinsResult.enabled) {

    if(!is.string(bot.opskins.apiKey) || !bot.opskins.apiKey) {
      return ctx.throw(400, 'Missing OPSkins api key')
    }

    const opClient = new OPSkinsAPI(bot.opskins.apiKey)

    const isValid = await new Promise((resolve, reject) =>
      opClient.getBalance(err => resolve(!err))
    )

    if(!isValid) {
      return ctx.throw(400, `Invalid OPSkins api key`)
    }

    if(!!bot.opskins.email && is.string(bot.opskins.email)) {
      const updateResult = await opClient.updateProfile({
        email: bot.opskins.email
      })

      opskinsResult.needsEmailVerification = updateResult.needs_email_verification
    }

    await opClient.updateProfile({
      email_notify: false
    })

    const opProfile = await opClient.getProfile()

    opskinsResult.autoSellItems = bot.opskins.autoSellItems === true
    opskinsResult.apiKey = bot.opskins.apiKey
    opskinsResult.email = opProfile.email.contact_email
    opskinsResult.isMaster = bot.opskins.isMaster === true
    opskinsResult.id = opProfile['id64']

    // if(bot.opskins.isMaster) {
    //   if(!is.array(bot.opskins.slaves) || !bot.opskins.slaves.length) {
    //     return ctx.throw(400, 'Missing bots to withdraw inventory items to')
    //   }
    //
    //   opskinsResult.slaves = bot.opskins.slaves.filter(s => is.string(s))
    // }
  }

  if(opskinsResult.enabled) {
    const summary = await getOPSummary(bot.opskins)

    opskinsResult.summary = _.map({
      ...(opskinsResult.summary || {}),
      ...summary
    }, (v, k) => ({
      key: k,
      name: k,
      value: summary[k]
    }))
  }

  try {

    const propertyUpdates =  _
      .chain(allowedUpdateProperties)
      .map(k => ([ k, bot[k] ]))
      .object()
      .value()

    let update = {
      ...propertyUpdates,

      id: opskinsResult.id,
      opskins: _.pick(opskinsResult, 'enabled', 'apiKey', 'email', 'summary', 'isMaster', 'autoSellItems', 'slaves')
    }

    if(update.opskins.enabled) {
      update.opskins.apiKey = encryptString(update.opskins.apiKey)
    }

    if(!isSaving) {
      bot.apiKey = encryptString(bot.apiKey)

      update = {
        ...update,
        ..._.pick(bot,
            'apiKey', 'groups'),

        state: 'Available',
        id: update.id,
        displayName: bot.displayName,
        steamId: update.id,
        createdAt: r.now(),
        enabled: true
      }
    }

    // Compatibility

    update = {
      ...update,

      features: [],
      steamId64: isSaving ? bot.steamId : update.steamId,
      display: update.displayName,
      storage: true
    }

    if(!!update.identifier) {
      update.identifier = update.identifier.toLowerCase()
    }

    const replaceResult = await Bots
      .get(update.id)
      .replace(b => r.branch(b.eq(null), update, b.merge(update)), { returnChanges: true })

    if(replaceResult.inserted <= 0 && replaceResult.replaced <= 0) {
      return ctx.throw(400, 'Nothing has been updated')
    }

    ctx.body = {
      bot: replaceResult.changes[0].new_val,
      opskins: replaceResult.changes[0].new_val.opskins
    }

  } catch(e) {
    ctx.throw(400, e)
  }
}

async function getBots(ctx) {
  let q = Bots
    .filter({
      state: ctx.params.filter === 'unavailable' ? 'Unavailable' : 'Available'
    })

  if(ctx.params.filter === 'assigned') {
    q = q.filter(r.row('identifier').default('').ne(''))
  } else if(ctx.params.filter === 'unassigned') {
    q = q.filter(r.row('identifier').default('').eq(''))
  }

  if(!!ctx.query.filter && ctx.query.filter.length > 0) {
    q = q.filter(r.row('identifier').default('').match(ctx.query.filter))
  }

  const bots = await q
    .orderBy(r.asc('identifier'))
    .pluck(...publicBotFields)

  ctx.body = {
    bots
  }
}

async function postUpdate(ctx) {
  const canUpdate = ['state', 'identifier']

  const { _reassignIdentifierTo: reassignIdentifierTo, ...rawUpdate } = ctx.request.body.update || {}

  const update = _
    .chain(rawUpdate)
    .keys()
    .filter(k => canUpdate.indexOf(k) >= 0 && (ctx.request.body.update[k] === null || is.string(ctx.request.body.update[k])))
    .map(k => ([ k, ctx.request.body.update[k] ]))
    .object()
    .value()

  if(!Object.keys(update).length) {
    return ctx.throw(400, 'Nothing to update')
  }

  const bot = await Bots.get(ctx.params.id)

  if(!bot) {
    return ctx.throw(400, 'Cannot find bot to update')
  }

  const botChanges = []

  if(!!reassignIdentifierTo && is.string(reassignIdentifierTo) && reassignIdentifierTo !== 'nothing') {
    const { replaced, changes } = await Bots
      .getAll([ reassignIdentifierTo, 'Available' ], { index: 'idState' })
      .filter(r.row('identifier').default(null).eq(null))
      .update({
        identifier: bot.identifier,
        groups: bot.groups,
        features: bot.features
      }, { returnChanges: true })

    if(replaced <= 0) {
      return ctx.throw(400, 'Cannot find new bot to assign with (Unavailable or already assigned)')
    }

    botChanges.push(changes[0])
    update.identifier = null
  } else if(!!update.identifier && is.string(update.identifier) && update.identifier.length > 0) {
    const [ existingBot ] = await Bots.getAll(update.identifier, { index: 'identifier' })

    if(!!existingBot) {
      if(!!rawUpdate._replaceIdentifierConflict) {
        const { replaced, changes } = await Bots
          .getAll([ existingBot.id, 'Available' ], { index: 'idState' })
          .filter(r.row('identifier').default(null).eq(update.identifier))
          .update({
            identifier: null
          }, { returnChanges: true })

        if(replaced <= 0) {
          return ctx.throw(400, 'Cannot update old bot')
        }

        update.groups = existingBot.groups
        update.features = existingBot.features

        if(bot.opskins.enabled && existingBot.opskins.enabled) {
          update.opskins = r.row('opskins').merge({
            autoSellItems: existingBot.opskins.autoSellItems
          })
        }

        botChanges.push(changes[0])
      } else {
        return ctx.throw(400, `The identifier ${update.identifier} is already in used by bot ${existingBot.displayName} (${existingBot.id})`)
      }
    }
  }

  if(!!update.state && update.state === 'Unavailable') {
    update.identifier = null
  }

  const { replaced, changes } = await Bots.get(ctx.params.id).update(update, {
    returnChanges: true
  })

  if(replaced <= 0) {
    return ctx.throw(400, 'Nothing was updated')
  }

  botChanges.push(...changes)

  ctx.body = {
    replaced,

    updates: botChanges.map(c => ({
      bot: _.pick(c.new_val, ...publicBotFields),

      wasUnassigned: !c.new_val.identifier && !!c.old_val.identifier ? c.old_val.identifier : false,
      wasAssigned: !!c.new_val.identifier && !c.old_val.identifier,
      stateChanged: c.new_val.state !== c.old_val.state
    }))
  }
}

async function getOPSkinsBalance(ctx) {
  const bot = await Bots.get(ctx.params.id)

  if(!bot) {
    return ctx.throw(400, 'Cannot find bot')
  } else if(!bot.opskins.enabled) {
    return ctx.throw(400, 'OPSkins is not enabled on this bot')
  }

  const opskinsClient = new OPSkinsAPI(decryptString(bot.opskins.apiKey))
  const balances = await opskinsClient.getBalances()
  const vaultBalance = !!balances.vault ? balances.vault.usd / 100 : 0

  ctx.body = {
    vault: vaultBalance,
    balance: await new Promise((resolve, reject) =>
      opskinsClient.getBalance((err, balance) => !!err ? reject(err) : resolve(balance/100))
    )
  }
}

async function postOpskinsTransferToVault(ctx) {
  const bot = await Bots.get(ctx.params.id)

  if(!bot) {
    return ctx.throw(400, 'Cannot find bot')
  } else if(!bot.opskins.enabled) {
    return ctx.throw(400, 'OPSkins is not enabled on this bot')
  }

  const { amount } = ctx.request.body

  if(!is.number(amount) || amount <= 0) {
    return ctx.throw(400, 'Amount must be at least $1.00')
  }

  const opskinsClient = new OPSkinsAPI(decryptString(bot.opskins.apiKey))
  const response = await opskinsClient.transferToVault(parseInt(amount * 100))

  ctx.body = {
    newBalance: response.vault_txn.wallet_txn.new_balance / 100,
    newVaultBalance: response.vault_txn.new_balance / 100,
  }
}

export default () => {
  const router = new Router()

  router
    .post('/save', requirePermissions([ 'bots', 'update' ]), postSave)
    .post('/update/:id', requirePermissions([ 'bots', 'update' ]), postUpdate)
    .get('/list/:filter', requirePermissions([ 'bots', 'view' ]), getBots)
    .get('/opskins/:id/balance', requirePermissions([ 'bots', 'opskins' ]), getOPSkinsBalance)
    .post('/opskins/:id/transferToVault', requirePermissions([ 'bots', 'opskinsManage' ]), postOpskinsTransferToVault)

  return router.routes()
}
