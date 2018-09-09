
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'
import _ from 'underscore'

import { SET_PLAYER_INVENTORY } from './constants'

const initialState = Immutable([])

export default handleActions({
  [SET_PLAYER_INVENTORY] (state, { payload }) {
    return Immutable(payload)
  },

  'event/addPlayerItem' (state, { payload }) {
    return state.concat(payload)
  },

  'event/updatePlayerItem' (state, { event }) {
    return state.map(item => {
      if(event[1].indexOf(item.id) >= 0) {
        return item.merge(event[2])
      }

      return item
    })
  },

  'event/removePlayerItem' (state, { payload }) {
    return state.filter(item => payload.indexOf(item.id) < 0)
  }
}, initialState)
