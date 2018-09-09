
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'
import _ from 'underscore'

import { SET_PENDING_OFFERS } from './constants'

const initialState = Immutable([])

export default handleActions({
  [SET_PENDING_OFFERS] (state, { payload }) {
    return payload
  },

  'event/offer:change' (state, { payload }) {
    console.log(payload)

    if(_.findWhere(state, { id: payload.id })) {
      return state.map(offer => offer.id === payload.id ? { ...offer, ...payload } : offer)
    }

    return [ payload ].concat(state).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
}, initialState)
