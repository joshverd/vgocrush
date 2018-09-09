
import { Router } from 'express'
import _ from 'underscore'
import config from 'config'
import co from 'co'
import r from '../../lib/database'
import slug from 'slug'

import Case, { CaseItems } from 'plugins/cases/documents/case'
import Campaign from '../../document/campaign'
import Stats from '../../document/stats'
import { CaseStats } from  'plugins/cases/documents/stats'
import { PlayerOpens } from 'plugins/cases/documents/player'
import { getItems } from '../../lib/sknexchange'
import logger from '../../lib/logger'
import { determineCaseData } from 'plugins/cases'

// GET /_manage/cases/styles
function getStyles(req, res) {
  res.json(config.cases.styles.map(style => ({
    ...style,
    image: `/static/styles/images/cases/${style.id}.png`
  })))
}

// POST /_manager/cases/create
function postCreate(req, res) {
  const { id, name, price, style, items, free, disabled } = req.body

  if(!name) {
    return res.status(400).json({ error: 'Invalid name' })
  } else if(price <= 0 && !free) {
    return res.status(400).json({ error: 'Invalid price' })
  } else if(!style) {
    return res.status(400).json({ error: 'Invalid style' })
  } else if(!items.length || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Case must contain items' })
  }

  const caseStyle = _.findWhere(config.cases.styles, { id: style })
  if(!caseStyle) {
    return res.status(400).json({ error: 'Cannot find case style' })
  }

  if(_.uniq(items).length !== items.length) {
    return res.status(400).json({ error: 'Case cannot have more than 1 of the same item' })
  }

  // const percentageSum = items.reduce((s, i) => s + i.percentage, 0)
  // const percentageSum = items.reduce((s, i) => s + i.percentage, 0)
  // if(percentageSum !== 100) {
  //   return res.status(400).json({ error: 'Percentages must add up to 100' })
  // }

  co(function* () {
    const skinItems = items.filter(item => !item.type || item.type !== 'cash')

    const caseData = yield determineCaseData(skinItems, {
      allowAnyItems: true
    })

    let lastLow = 0

    const newCase = {
      ...caseData,
      name,

      slug: slug(name, { lower: true }),
      price: free ? 0 : price,
      disabled: !!disabled && disabled,
      caseStyle: caseStyle.id,
      free: free ? true : false
    }

    if(free) {
      yield Case
        .getAll(true, { index: 'free' })
        .update({ free: false })
        .run()
    }

    if(!!id) {
      yield Case.get(id).update(newCase).run()
    } else {
      yield Case.insert({
        ...newCase,
        official: true,
        createdAt: new Date(),
        createdBy: req.user.id
      }).run()
    }
    res.json({ success: true })
  })

  .catch(err => {
    logger.error(`postCreate() ${err}`)
    res.json({ error: 'Internal error, please try again later' })
  })
}

// GET /_manage/cases
function getCases(req, res) {
  co(function* () {
    const cases = yield Case.getAll(true, { index: 'official' }).run()
    res.json(cases)
  })
}

// GET /_manage/get/:id
function getCase(req, res) {
  co(function* () {
    const cases = yield Case
      .getAll(req.params.id)
      .map(c => c.merge({
        player: r.branch(c.hasFields('playerId'), Player.get(c('playerId')), {})
      }))

      .run()

    if(!cases.length) {
      return res.status(400).json({ error: 'Case not found' })
    }

    const c = cases[0]
    const items = _
      .chain(yield getItems(_.pluck(c.items, 'name')))
      .map(item => [item.name, item])
      .object()
      .value()

    const openings = yield PlayerOpens
        .getAll(c.id, { index: 'caseId' })
        .group(r.row('item')('name'))
        .count()
        .run()

    const openingItems = _
      .chain(yield getItems(openings.map(o => o.group)))
      .map(item => [item.name, item])
      .object()
      .value()

    const openingsCount = openings.reduce((t, o) => t + o.reduction, 0)
    const profit = (openingsCount * c.price) - openings
      .filter(o => !!openingItems[o.group])
      .map(o => openingItems[o.group].price * o.reduction)
      .reduce((t, p) => t + p, 0)

    return res.json({
      ...c,
      openingsCount,
      profit,
      items: c.items.map(item => {
        if(item.type === 'cash') {
          return item
        }

        return {
          ...items[item.name],
          ...item,
          wear: item.type !== 'cash' ? items[item.name].wear : null
        }
      })
    })
  })

  .catch(console.log)
}

function postDelete(req, res) {
  const { id } = req.body

  co(function* () {
    const response = yield Case.get(id).delete({ returnChanges: true }).run()

    CaseStats.getAll(id,{index:"caseId"}).delete().run();

    if(response.changes && response.changes.length) {
      const c = response.changes[0].old_val

      if(c.campaignId) {
        yield Campaign.get(c.campaignId).delete().run()
      }
    }

    res.json({ success: true })
  })

  .catch(error =>
    res.status(400).json({
      error
    })
  )
}

function postAddItem(req, res) {
  const { itemName } = req.body
  CaseItems.insert({
    itemName,
    createdAt: r.now()
  }).run()

  res.json({
    success: true
  })
}

function getCaseItems(req, res) {
  co(function* () {
    const items = yield CaseItems.run()
    res.json(_.uniq(_.pluck(items, 'itemName')))
  })
}

function postRemoveItem(req, res) {
  co(function* () {
    yield CaseItems.filter({ itemName: req.body.itemName }).delete().run()

    res.json({
      success: true
    })
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.get('/', getCases)
  router.get('/get/:id', getCase)
  router.get('/styles', getStyles)
  router.post('/create', postCreate)
  router.post('/delete', postDelete)
  router.post('/addItem', postAddItem)
  router.post('/removeItem', postRemoveItem)
  router.get('/items', getCaseItems)
  return router
}
