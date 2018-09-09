
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'

import { SET_TOGGLES } from './constants'

const initialState = Immutable({})

export default handleActions({
  [SET_TOGGLES] (state, { payload }) {
    return state.merge(payload.map(t => ({
      [t.key]: t.enabled ? t.value || t.enabled : false
    })))
  },

  'event/setToggle' (state, { payload }) {
    return state.merge(payload)
  }
}, initialState)
