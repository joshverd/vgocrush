
import crypto from 'crypto'
import co from 'co'
import numeral from 'numeral'
import duration from 'parse-duration'
import config from 'config'
import _ from 'underscore'
import { eachSeries } from 'async'

import documents from './documents'

import r from 'lib/database'
import { givePlayerBalance } from 'document/player'
import { PlayerOpens, PlayerLikes, createKeyPair } from './documents/player'
import { getLevelReward, levelRewards } from 'lib/campaign'
import Case, { CaseItems } from './documents/case'
import Campaign from 'document/campaign'
import redis from 'lib/redis'
import sockets from 'lib/sockets'
import logger from 'lib/logger'
import { getItems, getPendingOffers } from 'lib/sknexchange'

import afterApiRouteCreated from './api'
import afterApiUsersRouteCreated from './api/user'

let _biggestOpening = null

export function biggestOpening() {
  return _biggestOpening
}

let _latestOpenings = []

export function latestOpenings() {
  return _latestOpenings
}

function formatOpening(opening) {
  return {
    createdAt: opening.createdAt,
    crate_name: opening.case.name,
    crate_id: opening.caseId,
    crate_image: opening.case.image,

    player: opening.player.name,
    user_id: opening.player.id,
    avatar: opening.player.avatar,

    data: {
      item: {
        ...opening.item,
        crate_id: opening.caseId
      }
    }
  }
}

export function addLiveCases(openings) {
  return co(function* () {
    const total = parseInt(openings.reduce((total, o) => total + o.item.price, 0) * 100)

    let v = yield redis.getAsync('kingdom:casesOpened')
    if(!v) {
      yield redis.setAsync('kingdom:casesOpened', openings.length)
      yield redis.expireAsync('kingdom:casesOpened', 86400)
    } else {
      yield redis.incrbyAsync('kingdom:casesOpened', openings.length)
    }

    v = yield redis.getAsync('kingdom:totalWon')
    if(!v) {
      yield redis.setAsync('kingdom:totalWon', total)
      yield redis.expireAsync('kingdom:totalWon', 86400)
    } else {
      yield redis.incrbyAsync('kingdom:totalWon', total)
    }

    const stats = yield getCaseStats()
    const formatted = openings
      .filter(o => o.prize >= 0.04 && (!o.item.type || o.item.type !== 'cash'))
      .map(formatOpening)

    sockets.emit('addLiveCases', { openings: formatted, stats })

    openings.forEach(o => {
      if(o.item.type === 'cash') {
        return
      }

      if(_biggestOpening) {
        const wait = 86400 * 1000

        if(o.prize > _biggestOpening.data.item.price) {
          _biggestOpening = formatOpening(o)
        } else {
          const elapsed = Date.now() - _biggestOpening.createdAt.getTime()
          if(elapsed > wait) {
            _biggestOpening = formatOpening(o)
          }
        }
      } else {
        _biggestOpening = formatOpening(o)
      }
    })

    // if(formatted[0].data.item.type !== 'money') {
    //   _biggestOpening = formatted[0]
    //   sockets.emit('updateBiggestWin', _biggestOpening)
    // }

    _latestOpenings.unshift(...formatted)
    if(_latestOpenings.length > 20) {
      _latestOpenings.splice(20)
    }
  })
}

export function getCaseStats() {
  return co(function* () {
    const casesOpened = yield redis.getAsync('kingdom:casesOpened')

    return {
      casesOpened: parseInt(casesOpened),
      latestOpenings: _latestOpenings
    }
  })
}

// getRollNumber
export function getRollNumber(serverSeed, clientSeed, nonce) {
  const text = `${clientSeed}-${nonce}`

  //create HMAC using server seed as key and client seed as message
  const hash = crypto.createHmac('sha512', serverSeed).update(text).digest('hex')
  let index = 0
  let lucky = parseInt(hash.substring(index * 5, index * 5 + 5), 16)

  //keep grabbing characters from the hash while greater than
  while (lucky >= Math.pow(10, 6)) {
    index++
    lucky = parseInt(hash.substring(index * 5, index * 5 + 5), 16)

    //if we reach the end of the hash, just default to highest number
    if (index * 5 + 5 > 128) {
      lucky = 99999
      break
    }
  }

  lucky %= Math.pow(10, 5)

  return lucky
}

// getWinningItemName
export function getWinningItemName(roll, items) {
  for(let item of items) {
    if(roll >= item.prob.low && roll <= item.prob.high) {
      return item
    }
  }

  return null
}

export function determineCaseData(items, opts = {}) {
  const affiliateCut = opts.affiliateCut || 0

  return co(function* () {
    const totalOdds = items.reduce((t, i) => t + i.odds, 0)

    if(totalOdds !== 100 && opts.ignoreCase) {
      return Promise.reject(`Item odds must add up to 100 (you gave ${totalOdds}%)`)
    }

    let itemNames = _
      .chain(items)
      .uniq(item => item.name)
      .value()

    if(!opts.allowAnyItems) {
      const cases = yield Case
        .getAll([ true, false ], { index: 'officialDisabled' })
        .pluck('items')

      const extraCaseItems = _.pluck(yield CaseItems.run(), 'itemName')

      const validItemNames  = cases
        .reduce((items, c) => [
          ...items,
          ...c.items.reduce((items, item) => {
            if(item.type === 'cash') {
              return items
            }

            return [ ...items, item.name ]
          }, [])
        ], [])
        .concat(extraCaseItems)

      itemNames = _
        .chain(items)
        .filter(item => validItemNames.indexOf(item.name) >= 0)
        .uniq(item => item.name)
        .value()
    }

    let lastLow = 0

    const itemDescriptions = _
      .chain(yield getItems(itemNames.map(item => item.name)))
      .map(item => [item.name, item])
      .object()
      .value()

    if(Object.keys(itemDescriptions).length !== itemNames.length) {
      return Promise.reject('itemDescriptions != itemNames')
    } else if(Object.keys(itemDescriptions).length !== _.pluck(items, 'name').length) {
      console.log(_.pluck(items, 'name').join(','))
      console.log(Object.keys(itemDescriptions).join(','))
      return Promise.reject('itemDescriptions != items')
    }

    const caseItems = items.map(item => {
      const { odds } = item

      let low = lastLow
      lastLow += (odds * 1000)

      return {
        name: item.name,
        odds: odds/100,
        price: itemDescriptions[item.name].price * (odds/100),

        prob: {
          low,
          high: low + (odds * 1000)
        }
      }
    })

    let newEdge = config.cases.edge
    const beforeEdgePrice = Math.ceil10((caseItems.reduce((t, i) => t + i.price, 0)), -2)

    if(beforeEdgePrice < 0.15) {
      newEdge = 1.15
    } else if(beforeEdgePrice < 0.10) {
      newEdge = 1.50
    } else if(beforeEdgePrice < 0.06) {
      newEdge = 2
    }

    let price = caseItems.reduce((t, i) => t + i.price, 0) * newEdge
    let commission = 0

    if(affiliateCut > 0) {
      commission = Math.ceil10(price * affiliateCut, -2)
      price += commission
    }

    return {
      commission,
      cut: affiliateCut,

      price: Math.ceil10(price, -2),
      items: caseItems
    }
  })
}

function loadCaseStatistics() {
  return co(function* () {
    let openings = yield PlayerOpens
      // .between(r.now().date().toEpochTime(), r.epochTime(Date.now()), { index: 'createdAt' })
      .orderBy({ index: r.desc('prize') })
      .filter(r.row('createdAt').gt(r.now().date()).and(r.row('item').hasFields('type').not().or(r.row('item')('type').ne('cash'))))
      .limit(1)
      .run()

    if(openings.length) {
      const opening = openings[0]
      _biggestOpening = formatOpening(opening)
    }

    openings = yield PlayerOpens
      .orderBy({ index: r.desc('createdAt') })
      .filter(r.row('item').hasFields('type').not().or(r.row('item')('type').ne('cash')))
      .limit(20)
      .run()

    _latestOpenings = openings.map(formatOpening)
  })
}

function* onSessionRequest(req, session) {

  if(!!session.user) {
    const { keyPair, lastKeyPair, level, referrals, claimedTwitterFollow,
      claimedGroupFreeSpin, claimedGroupPrimary, claimedFacebookFollow } = req.user

    const nextLevelReferrals = level < 10 ? levelRewards[level + 1].unlock : 0
    let pendingOffers = {
      offers: []
    }

    try {
      const groups = yield getPendingOffers({
        steamId: req.user.id
      })

      pendingOffers = {
        ...groups,

        offers: groups.offers.map(offer => {
          // Sigh...... i know
          const unavailableItemNames = (offer.hasError ? offer.error.unavailableItemNames : offer.hasPurchaseResponse ? offer.purchaseResponse.unavailableItemNames : [])

          return {
            unavailableItemNames,

            createdAt: offer.createdAt,
            tradeOfferId: offer.tradeOfferId,
            id: offer.id,
            state: offer.state,
            itemNames: offer.itemNames,
            subtotal: offer.subtotal,
            previousState: offer.previousState,
            tradeOfferUrl: offer.tradeOfferUrl,
            retry: offer.retry,
          }
        })
      }
    } catch(e) {
      console.log(e)
    }

    session.user = {
      ...session.user,

      level,
      referrals,
      nextLevelReferrals,
      claimedTwitterFollow,
      claimedGroupFreeSpin,
      claimedGroupPrimary,
      claimedFacebookFollow,
      pendingOffers,

      keyPairHash: keyPair.serverSeedHash,
      keyPairNonce: keyPair.nonce,
      keyPairSeed: keyPair.clientSeed,

      previousKeyPairClient: !!lastKeyPair ? lastKeyPair.clientSeed : null,
      previousKeyPairServer: !!lastKeyPair ? lastKeyPair.serverSeed : null,

      likedCases: yield PlayerLikes
        .getAll(req.user.id, { index: 'playerId' })
        .map(playerLike => playerLike('caseId'))
    }
  }

  session.stats = yield getCaseStats()
  return session
}

function onNewPlayerRegistration() {
  return {
    totalWon: 0,
    casesOpened: 0,
    keyPair: createKeyPair()
  }
}

export default {
  name: 'Case Openings',

  documents,

  register: function* () {
    yield loadCaseStatistics()
  },

  hooks: {
    afterApiUsersRouteCreated,
    afterApiRouteCreated,
    onNewPlayerRegistration,
    onSessionRequest
  }
}
