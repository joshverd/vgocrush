
import r from 'lib/database'
import _ from 'underscore'

import { stateActive } from '../constant/gameState'
import { stageInProgress, stageOver } from '../constant/gameStage'

const JackpotGames = r.table('JackpotGames')
export default JackpotGames

export async function getCurrentJackpotGame(gameMode) {
  const [ game ] = await JackpotGames.getAll([ gameMode, stateActive ], { index: 'modeState' })
  return game || null
}

export function formatJackpotGame(game) {
  const publicFields = [
    'id', 'mode', 'endsAt', 'hash', 'potSize', 'entries', 'stage', 'roundLength',
    'primaryColor'
  ]

  if(game.stage === stageInProgress || game.stage === stageOver) {
    publicFields.push('winner', 'secret', 'roundNumber', 'nextGameAt', 'roundNumberStr')
  }

  return _.pick(game, ...publicFields)
}
