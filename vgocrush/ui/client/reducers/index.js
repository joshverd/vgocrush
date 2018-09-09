
import { routerReducer as routing } from 'react-router-redux'
import { combineReducers } from 'redux'

import server from './server'
import currentUser from './currentUser'
import playerInventory from './playerInventory'
import pendingOffers from './pendingOffers'
import tradeOffers from './tradeOffers'
import toggles from './toggles'

export default combineReducers({
  routing,
  server,
  currentUser,
  playerInventory,
  pendingOffers,
  tradeOffers,
  toggles
})
