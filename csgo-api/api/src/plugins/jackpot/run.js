
import 'babel-polyfill'

import _ from 'underscore'
import crypto from 'crypto'
import random from 'random-seed'
import schedule from 'node-schedule'
import config from 'config'

import { addPlayerItem } from 'plugins/inventory/documents/player'
import logger from 'lib/logger'
import r from 'lib/database'
import redis from 'lib/redis'
import Player from 'document/player'
import { addStats } from 'document/stats'
import sockets from 'lib/sockets'

import gameModes from './constant/gameModes'
import * as gameStates from './constant/gameState'
import * as gameStages from './constant/gameStage'
import JackpotGames, { getCurrentJackpotGame, formatJackpotGame } from './documents/jackpotGame'

const jackpotOptions = config.plugins.options.jackpot || {}
const primaryColors = ['#2678df', '#009688', '#fc2c69', '#4caf50', '#673ab7', '#9c27b0',
  '#795548', '#e57373', '#ba68c8']

const defaultOptions = {
  minimumBet: 1,
  maximumBet: null,
  maximumBets: null,

  fee: 0.10
}

class JackpotGame {

  constructor(gameMode, options) {
    this.gameMode = gameMode
    this.options = {
      ...defaultOptions,
      ...jackpotOptions,
      ...options
    }

    this.currentGame = null
    this.sockets = sockets.to(`jackpot:${gameMode}`)
  }

  log(fn) {
    logger[fn].apply(logger, [ `[${this.gameMode}]`, ...([].slice.call(arguments).slice(1)) ])
  }

  async updateHistory() {
    const history = await JackpotGames
      .between([ this.gameMode, gameStates.stateOver, 0 ], [ this.gameMode, gameStates.stateOver, r.maxval ], { index: 'modeStateCreatedAt' })
      .orderBy({
        index: r.desc('modeStateCreatedAt')
      })
      .limit(20)

    redis.set(`jp:history:${this.gameMode}`, JSON.stringify(history.map(g => ({
      id: g.id,
      createdAt: g.createdAt,
      text: g.roundNumberStr,
      roundNumber: g.roundNumber
    }))))
  }

  async watchChanges() {
    const cursor = await JackpotGames
      .changes({
        includeTypes: true
      })

    cursor.each((err, change) => {
      if(!!err) {
        this.log('error', 'watchChanges', err)
        return
      }

      if(change.type === 'change') {
        const { new_val: game, old_val: oldGame } = change

        if(game.mode !== this.gameMode) {
          return
        }

        let update = {
          potSize: game.potSize,
          startedAt: game.startedAt,
          endsAt: game.endsAt,
          stage: game.stage
        }

        if(game.entries.length > oldGame.entries.length) {
          const newEntries = game.entries.slice(0, game.entries.length - oldGame.entries.length)
          sockets.to(`jackpot:${this.gameMode}`).emit('jp:push', newEntries)
        }

        if(game.stage === gameStages.stageInProgress) {
          update.winner = game.winner
          update.secret = game.secret
          update.roundNumber = game.roundNumber
          update.roundNumberStr = game.roundNumberStr
          update.nextGameAt = game.nextGameAt
        }

        if(game.stage === gameStages.stageWaitingJoin || game.stage === gameStages.stageStarting) {
          sockets.to(`jackpot:${this.gameMode}`).emit('jp:update', update)
        }

        if(game.stage === gameStages.stageWaitingJoin && game.playerIds.length > 19999999999999) {
          this.tick(game)
        }
      }
    })
  }

  async start() {
    this.log('info', 'Starting', this.options.name, 'jackpot')

    this.currentGame = await getCurrentJackpotGame(this.gameMode)

    if(!this.currentGame) {
      this.log('info', 'Cannot find an active game, creating a new one')
      this.currentGame = await this.createNewGame()
    }

    await this.updateHistory()
    await this.watchChanges()
    await this.tick(this.currentGame)
  }

  async createNewGame() {
    const rand = random.create()
    const roundNumber = rand.random()
    const roundNumberStr = this.roundNumberToStr(roundNumber)

    const secret = `${roundNumber}-${roundNumberStr}`
    const hash = crypto.createHash('sha256').update(secret).digest('hex')

    const { inserted, changes } = await JackpotGames.insert({
      ..._.pick(this.options, 'minimumBet', 'maximumBet', 'maximumBets', 'roundLength'),

      roundNumber,
      roundNumberStr,
      secret,
      hash,

      createdAt: r.now(),
      mode: this.gameMode,
      state: gameStates.stateActive,
      stage: gameStages.stageWaitingJoin,
      primaryColor: _.sample(primaryColors),

      entries: [],
      potSize: 0,
      ticketSize: 0,
      playerIds: []
    }, { returnChanges: true })

    if(inserted === 0) {
      throw new Error('inserted === 0')
    }

    return changes[0].new_val
  }

  roundNumberToStr(roundNumber) {
    return roundNumber > 0.5 ? 'HI' : 'LO'
  }

  schedule(game = null) {
    game = game || this.currentGame

    this.log('info', 'schedule', game.stage)

    if(game.stage === gameStages.stageWaitingJoin) {
      return
    }

    if(this.tickTimer) {
      this.tickTimer.cancel()
      this.tickTimer = null
    }

    const endsAt = game.stage === gameStages.stageStarting ? game.endsAt : game.nextGameAt

    if(endsAt <= new Date()) {
      this.onTickTimer(game)
      return
    }

    this.tickTimer = schedule.scheduleJob(endsAt, () => this.onTickTimer(game))
  }

  async onTickTimer(game = null) {
    this.log('info', 'tickTimer', game.stage)

    if(game.stage === gameStages.stageStarting) {
      game = await JackpotGames.get(game.id)

      this.log('info', 'Choosing winner of', game.entries.length, 'entries', 'with a pot size of', game.potSize.toFixed(2))

      const winningTicket = Math.floor(game.roundNumber * game.ticketSize)
      const winningEntry = game.entries.reduce((w, e) =>
        e.ticketStart <= winningTicket && e.ticketEnd >= winningTicket ? e : w
      , game.entries[0])

      if(!winningEntry) {
        this.log('error', 'Could not find winning entry with ticket', winningTicket)
        return
      }

      const winnerId = winningEntry.player.id
      const winnerEntries = game.entries.filter(e => e.player.id === winnerId)
      const totalDeposited = winnerEntries.reduce((t, e) => t + e.value, 0)
      const winningChance = (totalDeposited / game.potSize) * 100

      const profit = game.potSize - totalDeposited

      const fee = (profit * 0.10)
      const reward = totalDeposited + (profit - fee)

      this.log('info', winningEntry.player.displayName, 'won', reward.toFixed(2), 'with a', winningChance.toFixed(2), 'chance. Fee:', fee.toFixed(2))

      const nextGameAt = new Date(Date.now() + 16000)

      const update = {
        reward,
        fee,
        nextGameAt,

        stage: gameStages.stageInProgress,
        winnerId: winningEntry.playerId,

        winner: {
          ..._.pick(winningEntry.player, 'displayName', 'avatar', 'id'),

          ticket: winningTicket,
          chance: winningChance
        }
      }

      const { replaced, changes } = await JackpotGames.get(game.id).update(update, { returnChanges: true })

      if(replaced === 0) {
        throw new Error('could not update jackpot with winner')
      }

      sockets.to(`jackpot:${this.gameMode}`).emit('jp:update', {
        nextGameAt,

        stage: update.stage,
        secret: game.secret,
        roundNumber: game.roundNumber,
        roundNumberStr: game.roundNumberStr,
        potSize: changes[0].new_val.potSize,
        winner: update.winner
      })

      this.currentGame = changes[0].new_val
      this.schedule(this.currentGame)
    }

    if(game.stage === gameStages.stageInProgress) {
      const { replaced, changes: updateChanges } = await JackpotGames.get(game.id).update({
        rewardSent: true
      }, { returnChanges: true })

      if(replaced > 0) {
        game = updateChanges[0].new_val
        const playerEntries = _.groupBy(game.entries, g => g.player.id)

        for(let playerId in playerEntries) {
          const totalWagered = playerEntries[playerId].reduce((t, e) => t + e.value, 0)

          await Player.get(playerId).update({
            withdrawRequirement: r.expr([ r.row('withdrawRequirement').sub(totalWagered), 0 ]).max()
          }).run()
        }

        let winnerSkins = playerEntries[game.winner.id]
          .filter(e => e.playerId === game.winner.id)
          .map(e => e.items)
          .reduce((a, i) => a.concat(i), [])

        let unusedFee = game.fee
        let profitSkins = []
        let availableSkins = _.sortBy(game.entries, 'value').reverse()
          .filter(e => e.playerId !== game.winner.id)
          .map(e => e.items)
          .reduce((a, i) => a.concat(i), [])

        while(unusedFee > 0 && availableSkins.length > 0) {
          for(let i in availableSkins) {
            if(availableSkins[i].price <= unusedFee) {
              unusedFee -= availableSkins[i].price
              profitSkins.push(availableSkins[i])
              availableSkins.splice(i, 1)
              continue
            }
          }

          break
        }

        const profitSkinsValue = profitSkins.reduce((t, e) => t + e.price, 0)

        winnerSkins.push(...availableSkins)
        const winnerSkinsValue = winnerSkins.reduce((t, e) => t + e.price, 0)

        this.log('info', `Paying out ${winnerSkins.length} skins (${winnerSkinsValue}). Took ${profitSkins.length} skins (${profitSkinsValue}) with ${unusedFee} unused fees`)

        await JackpotGames.get(game.id).update({
          profitSkins,
          unusedFee,

          profit: profitSkinsValue,
          winner: r.row('winner').merge({
            skins: winnerSkins
          })
        })

        await addPlayerItem(game.winner.id, winnerSkins.map(({ mode, name }) => ({
          name,
          mode: mode || 'deposit'
        })), {
          jackpotGameId: game.id
        }, {})

        addStats({
          counters: {
            totalJackpotGames: 1,
            totalJackpotProfit: profitSkinsValue
          }
        })
      }

      await JackpotGames.get(game.id).update({
        state: gameStates.stateOver,
        stage: gameStages.stageOver
      })

      await this.updateHistory()

      this.log('info', 'Starting new game')
      this.currentGame = await this.createNewGame()
      sockets.to(`jackpot:${this.gameMode}`).emit('jp:new', formatJackpotGame(this.currentGame))
      this.tick(this.currentGame)
    }
  }

  async tick(game = null) {
    game = game || this.currentGame

    this.log('info', 'tick', game.stage)

    if(game.stage === gameStages.stageWaitingJoin) {
      if(game.playerIds.length > 19999999999999) {

        const now = new Date()
        const endsAt = new Date(now.getTime() + game.roundLength)

        const update = {
          endsAt,

          stage: gameStages.stageStarting,
          startedAt: now
        }

        const result = await JackpotGames
          .get(game.id)
          .update(r.branch(r.row('stage').eq(gameStages.stageWaitingJoin), update, {}))

        if(result.replaced > 0) {
          this.currentGame = game = {
            ...this.currentGame,
            ...update
          }

          this.log('info', 'Starting countdown from', game.roundLength)
          this.schedule(game)
        }
      }
    }

    if(game.stage === gameStages.stageStarting || game.stage === gameStages.stageInProgress) {
      this.schedule(game)
    }
  }
}


async function start() {
  logger.info('Available game modes:', _.pluck(gameModes, 'name').join(', '))

  for(let mode in gameModes) {
    const game = new JackpotGame(mode, gameModes[mode])

    await game.start()
  }
}

start().catch(err =>
  logger.error('Startup error', err)
)

process.on('uncaughtException', e => logger.error('uncaughtException', e))
