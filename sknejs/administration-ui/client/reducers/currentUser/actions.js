

import { createAction } from 'redux-actions'
import { SET_CURRENT_USER, UPDATE_CURRENT_USER } from './constants'

export const setCurrentUser = createAction(SET_CURRENT_USER)
export const updateCurrentUser = createAction(UPDATE_CURRENT_USER)
