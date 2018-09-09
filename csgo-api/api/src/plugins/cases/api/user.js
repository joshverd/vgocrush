
import co from 'co'
import slug from 'slug'
import is from 'is_js'

import Player from 'document/player'
import Campaign from 'document/campaign'
import logger from 'lib/logger'
import r from 'lib/database'

import Case from '../documents/case'
import { CaseStats } from '../documents/stats'
import { PlayerLikes, PlayerOpens, createKeyPair } from '../documents/player'

import { getInventory, getAvailableSwap, postSwapItems, postSellItems,
  postWithdrawItems, postKeepItem } from './inventory'

function postLikeCase(req, res) {
  const { id } = req.body
  if(!is.string(id)) {
    return res.status(400).send(req.__('TRY_AGAIN_LATER'))
  }

  co(function* () {
    const likeCount = yield PlayerLikes.getAll([ req.user.id, id ], { index: 'playerIdCase' }).count()

    if(likeCount > 0) {
      yield PlayerLikes.getAll([ req.user.id, id ], { index: 'playerIdCase' }).delete()
    } else {
      yield PlayerLikes.insert({
        playerId: req.user.id,
        caseId: id
      })
    }

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error(`postLikeCase() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// POST /api/users/rotate_seed
function postRotateSeed(req, res) {

  if((Date.now() - req.user.keyPair.createdAt.getTime()) < (30 * 60000)) {
    return res.status(400).send('Please wait a while before generating new pair')
  }

  const client = slug(`kindom ${req.user.displayName} ${Date.now()} ${Math.floor(Math.random() * 1000000)}`, { lower: true })

  const { user } = req
  const keyPair = createKeyPair(client)

  co(function* () {
    yield Player
      .get(user.id)
      .update({
        keyPair,
        lastKeyPair: r.row('keyPair')
      })

    res.json({
      user: {
        keyPairSeed: keyPair.clientSeed,
        keyPairHash: keyPair.serverSeedHash,
        keyPairNonce: keyPair.nonce,

        previousKeyPairClient: user.keyPair.clientSeed,
        previousKeyPairServer: user.keyPair.serverSeed,
      }
    })
  })

  .catch(err => {
    logger.error(`postRotateSeed() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function postDeleteCase(req, res) {
  co(function* () {
    const [ c ] = yield Case.getAll(req.params.id).filter({ playerId: req.user.id })
    if(!c) {
      return res.status(400).send('Cannot find case')
    }

    yield Campaign.get(c.campaignId).delete()
    yield CaseStats.getAll(c.id, { index: 'caseId' }).delete()
    yield Case.get(c.id).delete()
    yield PlayerLikes.getAll(c.id, { index: 'caseId' }).delete()

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error(`postDeleteCase() ${err.stack || err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// GET /api/users/openings
function getOpenings(req, res) {
  co(function* () {
    const perPage = 50
    let page = req.query.page || 1
    if(page < 1) {
      page = 1
    }

    const query = PlayerOpens
      .getAll('playerId', req.user.id, { index: 'playerId' })

    const count = yield query.count().run()
    const pages = Math.ceil(count / perPage)
    if(page > pages) {
      page = pages
    }

    const start = (page - 1) * perPage
    const openings = yield query
      .orderBy(r.desc('createdAt'))
      // .slice(start, start + perPage)
      .limit(500)
      .run()

    res.json({
      openings: openings.map(o => ({
        updated_at: o.createdAt,
        updated_at_ts: o.createdAt.getTime(),
        nonce: o.nonce,
        clientSeed: o.keyPair.clientSeed,
        serverSeedHash: o.keyPair.serverSeedHash,
        serverSeed: req.user.keyPair.serverSeed === o.keyPair.serverSeed ? null :  o.keyPair.serverSeed,
        caseId: o.caseId,
        'case': o.case,
        item: o.item,
        roll: o.roll
      })),

      pagination: {
        page,
        pageCount: pages
      }
    })
  })

  .catch(err => {
    logger.error(`getOpenings() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

export default router => {
  router.post('/rotateSeed', postRotateSeed)
  router.post('/deleteCase/:id', postDeleteCase)
  router.post('/likeCase', postLikeCase)

  // router.get('/inventory', getInventory)
  // router.get('/availableSwap', getAvailableSwap)
  // router.post('/swapItems', postSwapItems)
  // router.post('/sell', postSellItems)
  // router.post('/keepItem', postKeepItem)
  // router.post('/withdraw', postWithdrawItems)

  router.get('/openings', getOpenings)
}
