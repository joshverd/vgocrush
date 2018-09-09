
import { Router } from 'express'
import _ from 'underscore'
import is from 'is_js'
import numeral from 'numeral'
import uuid from 'uuid/v4'
import ColorHash from 'color-hash'

import { ensureAuthenticated } from 'lib/middleware'
import { PlayerItems, formatPlayerItem, addPlayerItem, removePlayerItem, updatePlayerItem } from 'plugins/inventory/documents/player'
import r from 'lib/database'
import redis from 'lib/redis'
import { getItems } from 'lib/items'

import JackpotGame, { getCurrentJackpotGame, formatJackpotGame } from './documents/jackpotGame'
import documents from './documents'
import gameModes from './constant/gameModes'
import * as gameStates from './constant/gameState'
import * as gameStages from './constant/gameStage'

const colorHash = new ColorHash()

async function getGame(req, res) {
  const { id } = req.params

  const [ game ] = await JackpotGame
    .getAll(id)
    .filter({ state: gameStates.stateOver })

  if(!game) {
    return res.status(400).send('Cannot find jackpot game')
  }

  res.json({
    game: formatJackpotGame(game)
  })
}

async function getCurrentGame(req, res) {
  const { gameMode } = req.params

  if(typeof gameModes[gameMode] === 'undefined') {
    return res.status(400).send('Invalid jackpot mode')
  }

  const mode = gameModes[gameMode]
  const currentGame = await getCurrentJackpotGame(gameMode)

  if(!currentGame) {
    return res.status(400).send('Cannot get the current jackpot game')
  }

  let history = []

  const cachedHistory = await redis.getAsync(`jp:history:${gameMode}`)

  if(!!cachedHistory) {
    history = JSON.parse(cachedHistory)
  }

  res.json({
    mode,
    history,

    currentGame: formatJackpotGame(currentGame),
    settings: {
    }
  })
}

async function postDeposit(req, res)  {
  const { gameMode } = req.params

  if(typeof gameModes[gameMode] === 'undefined') {
    return res.status(400).send('Invalid jackpot mode')
  }

  let { itemIds } = req.body

  if(!is.array(itemIds)) {
    return res.status(400).send('Invalid request')
  }

  itemIds = _.uniq(itemIds)

  if(!itemIds.length) {
    return res.status(400).send('Invalid request')
  }

  for(let id of itemIds) {
    if(!is.string(id)) {
      return res.status(400).send('Invalid request')
    }
  }

  if(itemIds.length > 10) {
    return res.status(400).send('The maximum amount of skins you can bet at a time is 10')
  }

  let disabled = await redis.getAsync('disable:jackpot')

  if(disabled) {
    return res.status(400).send('Jackpot is currently disabled')
  }

  disabled = await redis.getAsync('disable:jackpot:' + gameMode)

  if(disabled) {
    return res.status(400).send('Jackpot is currently disabled')
  }

  const currentGame = await getCurrentJackpotGame(req.params.gameMode)

  if(!currentGame) {
    return res.status(400).send('Cannot get current jackpot game')
  } else if(gameStages.betStages.indexOf(currentGame.stage) < 0) {
    return res.status(400).send('The game has already started, please wait for it to finish')
  }

  if(!!currentGame.maximumBets && currentGame.maximumBets > 0) {
    const playerBetsCount = _.where(currentGame.entries, { id: req.user.id }).length

    if(playerBetsCount >= currentGame.maximumBets) {
      return res.status(400).send(`The maximum allowed bets in this jackpot is ${currentGame.maximumBets}`)
    }
  }

  const { replaced: playerItemReplaced, changes: playerItemChanges } = await updatePlayerItem({
    ids: itemIds.map(id => [ id, req.user.id, 'AVAILABLE' ]),
    options: { index: 'idPlayerIdState' }
  }, item =>
    r.branch(item('state').eq('AVAILABLE').and(item('type').default('skin').eq('skin')), {
      state: 'BUSY',
      attemptJackpotJoin: currentGame.id,
      attemptJoinAt: r.now()
    }, r.error('state !== AVAILABLE'))
  , {
    jackpotGameId: currentGame.id
  })

  if(playerItemReplaced <= 0) {
    return res.status(400).send('Cannot find selected skins')
  }

  const playerItems = (playerItemChanges || []).map(c => c.new_val)
  const playerItemNames = _.pluck(playerItems, 'name')
  const playerItemIds = _.pluck(playerItems, 'id')

  const refundItems = () => PlayerItems
    .getAll(r.args(playerItemIds))
    .replace(p => p
      .without({
        attemptJoinAt: true,
        attemptJackpotJoin: true
      })

      .merge({
        state: 'AVAILABLE'
      })
    , { returnChanges: true })

  const items = await getItems(playerItemNames)

  if(items.length !== playerItemIds.length) {
    await refundItems()
    return res.status(400).send('Cannot find items')
  }

  const formattedPlayerItems = playerItems.map(playerItem => {
    const item = _.findWhere(items, {
      name: playerItem.name
    })

    return formatPlayerItem(playerItem, item, playerItem.mode, {
      includeMode: true
    })
  })

  const subtotal = formattedPlayerItems.reduce((t, i) => t + i.price, 0)

  if(!!currentGame.minimumBet && subtotal < currentGame.minimumBet) {
    await refundItems()
    return res.status(400).send(`The minimum bet is ${numeral(currentGame.minimumBet).format('0,0.00')}`)
  } else if(!!currentGame.maximumBet && subtotal > currentGame.maximumBet) {
    await refundItems()
    return res.status(400).send(`The maximum bet is ${numeral(currentGame.maximumBet).format('0,0.00')}`)
  }

  const sniped = currentGame.stage == gameStages.stageStarting && Date.now() >= (currentGame.endsAt.getTime() - 3000)

  const checkStage = r.row('stage').ne(gameStages.stageOver).and(r.row('stage').ne(gameStages.stageInProgress))
    .and(r.row('endsAt').default(null).eq(null).or(r.row('endsAt').gt(new Date())))

  const checkBetRange = r.row('minimumBet').gt(0).and(r.expr(subtotal).lt(r.row('minimumBet')))
    .or(r.row('maximumBet').gt(0).and(r.expr(subtotal).gt(r.row('maximumBet'))))

  const entry = {
    sniped,

  	createdAt: r.now(),
		id: uuid(),
    playerId: req.user.id,
    value: subtotal,

    player: {
      id: req.user.id,
      displayName: req.user.displayName,
      avatar: req.user.avatarFull,
      color: colorHash.hex(req.user.displayName)
    },

    items: formattedPlayerItems.map(i =>
      _.pick(i, 'name', 'iconUrl', 'price', 'mode')
    ),

		ticketStart: r.expr(r.row('ticketSize')).add(1),
		ticketEnd: r.expr(r.row('ticketSize')).add(parseInt(subtotal * 100))
  }

  const update = {
    potSize: r.row('potSize').add(subtotal),
    ticketSize: r.row('ticketSize').add(subtotal * 100),
    entries: r.row('entries').prepend(entry),
    playerIds: r.row('playerIds').default([]).append(req.user.id).distinct()
  }

  const branchArgs = [
    checkStage.not(), r.error('Please wait for the current jackpot to finish first'),
    checkBetRange, r.error('Invalid bet range'),
    update
  ]

  const insertResult = await JackpotGame.get(currentGame.id).update(r.branch(...branchArgs))

  if(insertResult.replaced <= 0) {
    await refundItems()
    return res.status(400).send(insertResult.first_error || 'Please try again later')
  }

  await removePlayerItem(playerItemIds, {
    jackpotGameId: currentGame.id
  })

  res.json({
    success: true
  })
}

export default {
  documents,

  name: 'Jackpot',
  hooks: {
    ready() {
    },

    toggles() {
      return [{
        group: 'Jackpot',
        key: 'disable:jackpot',
        name: 'Jackpot'
      }, {
        group: 'Jackpot',
        key: 'disable:jackpot:Classic',
        name: 'Jackpot Classic'
      }, {
        group: 'Jackpot',
        key: 'disable:jackpot:Small',
        name: 'Jackpot Small'
      }]
    },

    afterApiRouteCreated(router) {
      const group = new Router()

      group.get('/current/:gameMode', getCurrentGame)
      group.post('/deposit/:gameMode', postDeposit)
      group.get('/game/:id', getGame)
      router.use('/jp', group)
    }
  }
}
