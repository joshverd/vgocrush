
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import is from 'is_js'
import moment from 'moment'
import numeral from 'numeral'

import { PlayerItems, formatPlayerItem, addPlayerItem, removePlayerItem, updatePlayerItem } from 'plugins/inventory/documents/player'
import { generateRandomItems } from 'plugins/crash'
import Player from 'document/player'
import Raffles, { RaffleEntries } from 'document/raffles'
import logger from 'lib/logger'
import r from 'lib/database'

function getRaffles(req, res) {
  co(function* () {
    const raffles = yield Raffles.orderBy(r.asc('startDate'))
    const now = moment()

    res.json({
      raffles: raffles.map(raffle => ({
        ...raffle,

        isActive: moment(raffle.endDate).isAfter(now) && now.isAfter(moment(raffle.startDate))
      }))
    })
  })

  .catch(err => {
    logger.error('GET /cp/raffles', err)
    res.status(400).json(err.message || err)
  })
}

function postCreateRaffle(req, res) {
  const { id, name, startDate, endDate, prizes } = req.body

  if(!is.string(id) || !is.string(name) || !is.string(startDate) || !is.string(endDate) || !is.array(prizes)
    || !id.length || !name.length || !startDate.length || !endDate.length || prizes.length <= 0) {
    return res.status(400).send('Invalid request')
  }

  const startDateMmt = moment(startDate, 'MM/DD/YYYY hh:mm A')
  if(!startDateMmt.isValid()) {
    return res.status(400).send('Invalid start date')
  }

  const endDateMmt = moment(endDate, 'MM/DD/YYYY hh:mm A')
  if(!endDateMmt.isValid()) {
    return res.status(400).send('Invalid start date')
  } else if(moment().isAfter(endDateMmt)) {
    return res.status(400).send('End date must be in the future')
  }

  co(function* () {
    const rafflePrizes = []

    for(let prize of prizes) {
      const { value, maxWinners } = prize

      if(!is.number(value) || !is.number(maxWinners) || value <= 0
        || maxWinners <= 0) {
        return res.status(400).send('Invalid prizes')
      }

      rafflePrizes.push({
        type: 'gift',
        value,
        maxWinners
      })
    }

    const existsCount = yield Raffles.getAll(id, { index: 'raffleId' }).count()
    if(existsCount > 0) {
      return res.status(400).send('A raffle with that ID already exists')
    }

    const totalPrizeValue = rafflePrizes.reduce((total, prize) => total + (prize.value * prize.maxWinners), 0)

    const newRaffle = {
      totalPrizeValue,
      name,

      createdAt: new Date(),
      startDate: startDateMmt.toDate(),
      endDate: endDateMmt.toDate(),

      raffleId: id,
      prizes: rafflePrizes.map(p => ({
        ...p,
        percentage: (p.value / totalPrizeValue)
      })),
      initialTotalPrizeValue: totalPrizeValue,
      totalEntries: 0
    }

    const { changes } = yield Raffles.insert(newRaffle, {
      returnChanges: true
    })

    res.json({
      newRaffle: changes[0].new_val
    })
  })

  .catch(err => {
    logger.error('POST /cp/raffles/create', err)
    res.status(400).json(err.message || err)
  })
}

function postChooseWinners(req, res) {
  const { raffleId } = req.params

  co(function* () {
    const raffle = yield Raffles.get(raffleId)

    if(!raffle) {
      return res.status(400).send('Cannot find raffle')
    }

    const { endDate } = raffle

    if(moment().isBefore(endDate)) {
      return res.status(400).send('This raffle has not ended yet')
    } else if(raffle.winnersChosen) {
      return res.status(400).send('Winners for this raffle have already been chosen')
    }

    const totalEntries = yield RaffleEntries.getAll(raffleId, { index: 'raffleId' }).count()

    for(let i in raffle.prizes) {
      let winningEntries = []

      for(let j = 0; j < raffle.prizes[i].maxWinners; j++) {
        while(true) {
          let ran = Math.floor(Math.random() * totalEntries)
          if(winningEntries.indexOf(ran) >= 0) {
            if(winningEntries.filter(e => e !== ran).length <= 0) {
              break
            }

            continue
          }

          winningEntries.push(ran)
          break
        }
      }

      const entries = yield RaffleEntries
        .getAll(r.args(winningEntries.map(e => [raffleId, e])), { index: 'raffleIdTicketNumber' })
        .map(entry => Player
          .getAll(entry('playerId'))
          .pluck('displayName', 'id', 'avatar')
          .nth(0)
          .merge({
            entryId: entry('id'),
            entryColor: entry('color'),
            entryTicketNumber: entry('ticketNumber')
          })
        )


      let prizeValue = raffle.totalPrizeValue * raffle.prizes[i].percentage
      let winningItems = yield generateRandomItems(prizeValue)

      raffle.prizes[i].winningItems = _.pluck(winningItems.items, 'name')
      raffle.prizes[i].prizeValue = prizeValue
      raffle.prizes[i].entries = entries
      raffle.prizes[i].winningEntries = winningEntries
    }

    const { replaced, changes } = yield Raffles.get(raffleId).update({
      winnersChosen: true,
      prizeWinners: raffle.prizes,
      chosenAt: r.now()
    }, {
      returnChanges: true
    })

    for(let prize of changes[0].new_val.prizeWinners) {
      for(let entry of prize.entries) {
        yield RaffleEntries.get(entry.entryId).update({
          rewarded: true
        })

        yield addPlayerItem(entry.id, [{
          type: 'gift',
          name: 'Christmas Giveaway',
          shortDescription: `${numeral(prize.prizeValue).format('$0,0.00')} Prize`,
          contains: {
            type: 'items',
            itemNames: prize.winningItems
          }
        }])
      }
    }

    res.json({
      raffle: replaced > 0 ? changes[0].new_val : raffle
    })
  })

  .catch(err => {
    logger.error('POST /cp/raffles/chooseWinners', raffleId, err)
    res.status(400).json(err.message || err)
  })
}

export default () => {
  const router = Router()
  router.get('/', getRaffles)
  router.post('/create', postCreateRaffle)
  router.post('/chooseWinners/:raffleId', postChooseWinners)
  return router
}
