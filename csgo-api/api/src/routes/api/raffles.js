
import { Router } from 'express'
import co from 'co'
import moment from 'moment'
import is from 'is_js'
import _ from 'underscore'

import { PLAYER_ITEM_BUSY, PLAYER_ITEM_AVAILABLE, PlayerItems, getPlayerInventory, formatPlayerItem, addPlayerItem, removePlayerItem, updatePlayerItem } from 'plugins/inventory/documents/player'
import Raffles, { RaffleEntries } from 'document/raffles'
import { Items } from 'lib/sknexchange'
import r from 'lib/database'
import logger from 'lib/logger'
import redis from 'lib/redis'

const RaffleTicketColors = ['green', 'yellow', 'red']

function getRaffle(req, res) {
  const { raffleId } = req.params

  co(function* () {
    const [ raffle ] = yield Raffles.getAll(raffleId, { index: 'raffleId' })

    if(!raffle) {
      return res.status(400).send('Cannot find raffle')
    }

    // const cached = yield redis.getAsync('raffle:cache:' + raffleId)
    //
    // if(!!cached) {
    //   return res.json(JSON.parse(cached))
    // }

    const { totalPrizeValue, endDate, startDate, winnersChosen } = raffle
    const today = moment().startOf('day')
    let currentDay = 0

    const days = Array
      .from({ length: moment(endDate).diff(moment(startDate), 'days') }, (_, i) => {
        const day = i + 1
        const startsAt = moment(startDate).add(day - 1, 'd').startOf('day')

        if(startsAt.isBefore(today) || startsAt.isSame(today)) {
          currentDay = day
        }

        return {
          day,
          startsAt: startsAt.toDate(),
          passed: startsAt.isBefore(today),
          claimed: false
        }
      })

    const prizes = !winnersChosen ? raffle.prizes.map(prize => ({
      value: totalPrizeValue * prize.percentage,
      maxWinners: prize.maxWinners
    })) : raffle.prizeWinners.map(prize => ({
      value: prize.prizeValue,
      maxWinners: prize.maxWinners,
      entries: prize.maxWinners === 1 ? [] : []
    }))

    const winners = _
      .chain(raffle.prizeWinners)
      .map(prize => prize.entries.map(e => ({
        ...e,

        value: prize.prizeValue
      })))
      .reduce((a, e) => a.concat(e), [])
      .groupBy('id')
      .map((entries, playerId) =>
        entries.reduce((r, e) => ({
          ...r,
          prize: r.prize + e.value
        }), {
          playerId,
          displayName: entries[0].displayName,
          avatar: entries[0].avatar,
          prize: 0
        })
      )
      .sortBy('prize')
      .reverse()
      .value()

    const tickets = yield RaffleEntries
      .getAll([ req.user.id, raffle.id ], { index: 'playerIdRaffleId' })
      .orderBy(r.desc('ticketNumber'))

    const claimedDays = _.uniq(_.pluck(tickets, 'day'))

    const response = ({
      winnersChosen,
      winners,
      days,
      prizes,
      totalPrizeValue,
      endDate,
      currentDay,
      claimedDays,
      tickets,

      id: raffle.id
    })

    res.json(response)
    redis.set('raffle:cache:' + raffleId, JSON.stringify(response))
  })

  .catch(err => {
    logger.error('GET /raffles', raffleId, err)

    res.status(400).send('Please try again later')
  })
}

function postClaimRaffle(req, res) {
  const { raffleId } = req.params
  const { day } = req.body

  if(!is.number(day) || day <= 0) {
    return res.status(400).send('Invalid request')
  }

  co(function* () {
    const disabled = yield redis.getAsync('disable:raffle')
    if(disabled) {
      return res.status(400).send('Sorry this feature is currently disabled')
    }

    const raffle = yield Raffles.get(raffleId)

    if(!raffle) {
      return res.status(400).send('Cannot find raffle')
    }

    const today = moment().startOf('day')
    const claimDay = moment(raffle.startDate).add(day - 1, 'd').startOf('day')

    const startDate = moment(raffle.startDate).startOf('day')
    const endDate = moment(raffle.endDate)

    if(claimDay.isBefore(startDate) || claimDay.isAfter(endDate) || !claimDay.isSame(today)) {
      return res.status(400).send('Sorry, but the window for claiming this day has ended or has not started')
    }

    const existsCount = yield RaffleEntries
      .between([ req.user.id, raffle.id, claimDay.toDate()], [ req.user.id, raffle.id, r.maxval], { index: 'playerIdRaffleIdCreatedAt' })
      .filter(r.row('purchased').default(false).eq(false))
      .count()

    if(existsCount > 0) {
      return res.status(400).send('You have already claimed your tickets for this day')
    }

    const awarded = req.user.hasNamePromo ? 2 : 1

    const { changes, replaced } = yield Raffles.get(raffleId).update({
      totalEntries: r.row('totalEntries').add(awarded)
    }, { returnChanges: true })

    if(replaced <= 0) {
      throw new Error('replaced <= 0')
    }

    const change = changes[0]
    const tickets = []

    for(let ticketNumber = change.old_val.totalEntries; ticketNumber < change.new_val.totalEntries; ticketNumber++) {
      let color = _.sample(RaffleTicketColors)

      tickets.push({
        color,
        raffleId,
        ticketNumber,
        day,

        createdAt: new Date(),
        playerId: req.user.id
      })
    }

    const { changes: ticketInserts } = yield RaffleEntries.insert(tickets, { returnChanges: true })

    res.json({
      tickets: _.pluck(ticketInserts, 'new_val')
    })
  })

  .catch(err => {
    logger.error('POST /raffles/claim', raffleId, day, err, {
      playerId: req.user.id
    })

    res.status(400).send('Please try again later')
  })
}

function postPurchase(req, res) {
  const { raffleId } = req.params
  let { playerItemIds } = req.body

  if(!is.array(playerItemIds)) {
    return res.status(400).send('Invalid request')
  }

  playerItemIds = _.uniq(playerItemIds.filter(i => is.string(i)))

  if(playerItemIds.length <= 0) {
    return res.status(400).send('Cannot find your items')
  }

  co(function* () {
    const disabled = yield redis.getAsync('disable:raffle')
    if(disabled) {
      return res.status(400).send('Sorry this feature is currently disabled')
    }

    const raffle = yield Raffles.get(raffleId)

    if(!raffle) {
      return res.status(400).send('Cannot find raffle')
    }

    const { endDate } = raffle

    if(moment().isAfter(endDate)) {
      return res.status(400).send('This raffle has already ended')
    }

    const { replaced, changes } = yield updatePlayerItem({
      ids: playerItemIds.map(id => [ id, req.user.id, PLAYER_ITEM_AVAILABLE ]),
      options: {
        index: 'idPlayerIdState'
      }
    }, item =>
      r.branch(item('state').eq('AVAILABLE').and(item('type').default('skin').eq('skin')), {
        state: PLAYER_ITEM_BUSY
      }, r.error('state !== AVAILABLE'))
    , {
      raffleId,

      purchasingRaffleTickets: true
    })

    if(replaced <= 0) {
      return Promise.reject('replaced === 0')
    }

    const playerItems = _.pluck(changes, 'new_val')
    const updatedPlayerItemIds = _.pluck(playerItems, 'id')

    const refund = refundReason => updatePlayerItem(updatedPlayerItemIds, {
      state: PLAYER_ITEM_AVAILABLE
    }, {
      refundReason,

      exchangeRefund: true
    })

    if(playerItemIds.length !== updatedPlayerItemIds.length) {
      refund('some items are no longer available')
      return res.status(400).send('Some of your items are no longer available')
    }

    const items = yield Items.getAll(r.args(_.pluck(playerItems, 'name')), { index: 'name' })
    if(!items.length) {
      refund('could not find items')
      return res.status(400).send('Cannot find your items')
    }

    const exchangeItems = playerItems.map(playerItem => {
      const item = _.findWhere(items, {
        name: playerItem.name
      })

      return formatPlayerItem(playerItem, item)
    })

    const exchangeItemsTotal = exchangeItems.reduce((t, i) => t + i.price, 0)
    const awarded = Math.floor(exchangeItemsTotal)

    const { changes: raffleChanges, replaced: raffleReplaced } = yield Raffles.get(raffleId).update({
      totalPrizeValue: r.row('totalPrizeValue').add(exchangeItemsTotal / 2),
      totalEntries: r.row('totalEntries').add(awarded)
    }, { returnChanges: true })

    if(raffleReplaced <= 0) {
      throw new Error('replaced <= 0')
    }

    yield removePlayerItem(updatedPlayerItemIds, {
      raffleId,
      exchangedFor: 'raffleTickets'
    })

    const change = raffleChanges[0]
    const tickets = []

    for(let ticketNumber = change.old_val.totalEntries; ticketNumber < change.new_val.totalEntries; ticketNumber++) {
      let color = _.sample(RaffleTicketColors)

      tickets.push({
        color,
        raffleId,
        ticketNumber,

        createdAt: new Date(),
        playerId: req.user.id,
        purchased: true
      })
    }

    const { changes: ticketInserts } = yield RaffleEntries.insert(tickets, { returnChanges: true })

    res.json({
      totalPrizeValue: change.totalPrizeValue,
      tickets: _.pluck(ticketInserts, 'new_val')
    })
  })

  .catch(err => {
    logger.error('POST /raffles/purchase', raffleId, err, {
      playerItemIds,
      playerId: req.user.id
    })

    res.status(400).send('Please try again later')
  })
}

export default () => {
  const router = Router()

  router.get('/:raffleId', getRaffle)
  router.post('/claim/:raffleId', postClaimRaffle)
  router.post('/purchase/:raffleId', postPurchase)
  return router
}
