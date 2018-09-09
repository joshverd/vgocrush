
import { handleActions } from 'redux-actions'
import Immutable from 'seamless-immutable'
import _ from 'underscore'

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
  },

  // 'event/addPlayerItem' (state, { payload }) {
  //   return state.update('inventory', inventory => inventory.concat([ payload ]))
  // },
  //
  // 'event/updatePlayerItem' (state, { payload }) {
  //   return state.update('inventory', inventory => inventory.map(item =>{
  //     if(item.id === payload.id) {
  //       return item.merge(payload)
  //     }
  //
  //     return item
  //   }))
  // },
  //
  // 'event/removePlayerItem' (state, { payload }) {
  //   return state.update('inventory', inventory => inventory.filter(item => item.id !== payload))
  // }

  //
  // 'event:offer:change' (state, { payload }) {
  //   if(!state) {
  //     return null
  //   }
  //
  //   return state.update('pendingOffers', pendingOffers =>
  //     pendingOffers.update('offers', offers => {
  //       if(_.findWhere(offers, { id: payload.id })) {
  //         return offers.map(offer => offer.id === payload.id ? { ...offer, ...payload } : offer)
  //       }
  //
  //       return [ payload ].concat(offers).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  //     })
  //   )
  // },
  //
  // 'packet/update_player' (state, { payload }) {
  //   if(!state) {
  //     return null
  //   }
  //
  //   return state.merge(Immutable(payload))
  // }
}, initialState)
