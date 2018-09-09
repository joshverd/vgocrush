
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'
import _ from 'underscore'

import { SET_TRADE_OFFERS } from './constants'

const initialState = Immutable([])

export default handleActions({
  [SET_TRADE_OFFERS] (state, { payload }) {
    return payload
  },

  'event/tradeOffer:change' (state, { payload }) {
    if(_.findWhere(state, { id: payload.id })) {
      return state.map(offer => offer.id === payload.id ? { ...offer, ...payload } : offer)
    }

    return [ payload ].concat(state).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
}, initialState)
