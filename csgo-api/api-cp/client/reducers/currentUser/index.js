
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'

import { SET_CURRENT_USER, UPDATE_CURRENT_USER } from './constants'

const initialState = null

export default handleActions({
  [SET_CURRENT_USER] (state, { payload }) {
    return Immutable(payload)
  },

  [UPDATE_CURRENT_USER] (state, { payload }) {
    if(!state) {
      return null
    }

    return state.merge(Immutable(payload))
  }
}, initialState)
