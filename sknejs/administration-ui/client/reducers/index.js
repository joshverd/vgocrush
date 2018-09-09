
import { routerReducer as routing } from 'react-router-redux'
import { combineReducers } from 'redux'

import server from './server'
import currentUser from './currentUser'

export default combineReducers({
  routing,
  server,
  currentUser
})
