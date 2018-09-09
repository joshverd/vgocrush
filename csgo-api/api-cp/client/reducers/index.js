
import { routerReducer as routing }   from 'react-router-redux'
import { combineReducers }            from 'redux'

import currentUser                    from './currentUser'
import userNotes                      from "./userNotes";
import auditLogs                      from "./auditLogs";

export default combineReducers({
  routing,
  currentUser,
  userNotes,
  auditLogs
})
