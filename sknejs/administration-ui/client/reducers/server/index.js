
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'

import { SET_SERVER_TOKEN } from './constants'

let token = null

try {
  token = localStorage.serverToken
} catch(e) {
}

const initialState = Immutable({
  token
})

export default handleActions({
  [SET_SERVER_TOKEN] (state, { payload }) {
    try {
      localStorage.serverToken = payload
    } catch(e) {
      console.error('reducers.server', 'cannot save token', e)
    }

    return state.set('token', payload)
  }
}, initialState)
