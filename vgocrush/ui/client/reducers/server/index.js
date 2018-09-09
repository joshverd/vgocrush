
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'

import { SET_VALUE } from './constants'

const initialState = Immutable({
  onlineCount: 0,
  banner: null
})

export default handleActions({
  [SET_VALUE] (state, { payload }) {
    return state.merge(Immutable(payload))
  },

  'event/onlineCount' (state, { payload }) {
    return state.set('onlineCount', payload)
  },

  'event/updateServer' (state, { payload }) {
    return state.merge(payload)
  }
}, initialState)
