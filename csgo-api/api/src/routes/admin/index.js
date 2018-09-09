
import { Router } from 'express'
import r from '../../lib/database'
import co from 'co'
import _ from 'underscore'
import { mapSeries } from 'async'
import config from 'config'
import path from 'path'
import is from 'is_js'
import moment from 'moment'

import Case from 'plugins/cases/documents/case'
import { PlayerItems, PLAYER_ITEM_AVAILABLE } from 'plugins/cases/documents/player'
import Campaign from '../../document/campaign'
import Player from '../../document/player'
import { getItems, getBots, restockItems } from '../../lib/sknexchange'
import { connection } from '../../lib/database'
import { ITEM_SHORT_WEAR } from '../../constant/item'
import { cleanItemName } from '../../lib/item'
import { ensureAdmin } from '../../lib/middleware'
import { ipLogger } from '../../lib/playerIp'

import items from './items'
import cases from './cases'
import players from './players'
import settings from './settings'
import stats from './stats'
import stock from './stock'

// GET /admin
function getIndex(req, res) {
  res.render('admin/index.ejs', {
    admin: req.user.admin
  })
}

// GET /_manage/storage
function getStorage(req, res) {
  co(function* () {
    const bots = yield getBots()
    res.json(bots)
  })

  .catch(console.log)
}

function getPromotions(req, res) {
  co(function* () {
    const promotions = yield Campaign.getAll('promo', { index: 'type' })
    res.json(promotions)
  })

  .catch(console.log)
}

function postCreatePromo(req, res) {
  const { code, amount, maxUsages, expiration, lock } = req.body

  if(!is.string(code)) {
    return res.status(400).send('Invalid code')
  } else if(!is.number(amount) || amount <= 0) {
    return res.status(400).send('Invalid amount')
  } else if(!!maxUsages && !is.number(maxUsages) || maxUsages <= 0) {
    return res.status(400).send('Invalid max usages')
  } else if(!!lock && !is.string(lock)) {
    return res.status(400).send('Invalid steamid')
  }

  co(function* () {
    const count = yield Campaign.getAll(code.toLowerCase(), { index: 'code' }).count()
    if(count > 0) {
      return res.status(400).send('Code name already in use')
    }

    const campaign = {
      type: 'promo',
      code: code.toLowerCase(),
      originalCode: code,
      createdAt: new Date(),
      reward: amount
    }

    if(!!maxUsages) {
      campaign.maxUsages = maxUsages
    } else if(!!lock) {
      campaign.playerId = lock
    }

    if(!!expiration && expiration.length >= 5) {
      const now = moment()
      const then = moment(expiration, 'MM/DD/YYYY')

      if(then.isBefore(now)) {
        return res.status(400).send('Expiration must be in the future')
      }

      campaign.expiresAt = new Date(Date.now() + 30000)//then.toDate()
    }

    yield Campaign.insert(campaign)

    res.json({
      success: true
    })
  })

  .catch(console.log)
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()

  router.use((req, res, next) => {
    if(!req.session.unlocked) {

      if(req.body && req.body.accessCode) {
        if(req.body.accessCode === config.app.accessCode) {
          req.session.unlocked = true
          return res.redirect('/_acp/#home')
        } else {
          return res.render('admin/unlock.ejs', {
            error: 'Invalid Access Code'
          })
        }
      }

      return res.render('admin/unlock.ejs')
    }

    next()
  })

  router.get('/lock', (req, res) => {
    delete req.session.unlocked
    return res.render('admin/unlock.ejs')
  })

  router.get('/', getIndex)
  router.get('/storage', ensureAdmin, ipLogger, getStorage)

  router.get('/promotions', getPromotions, ipLogger)
  router.post('/createPromo', postCreatePromo, ipLogger)

  router.use('/stock', ensureAdmin, ipLogger, stock())
  router.use('/items', ensureAdmin, ipLogger, items())
  router.use('/cases', ensureAdmin, ipLogger, cases())
  router.use('/players', ipLogger, players())
  router.use('/stats', ipLogger, stats())
  router.use('/settings', ipLogger, ensureAdmin, settings())

  router.use('/*', (req, res) => res.status(400).json({
    error: 'Not found'
  }))
  return router
}
