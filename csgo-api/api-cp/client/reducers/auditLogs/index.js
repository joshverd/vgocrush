import { SET_CURRENT_USER, UPDATE_CURRENT_USER } from './constants'

const initialState = {
  accessLogs: {
    logs : []
  }
};

export default (state = initialState, action)=>{
  switch (action.type){
    default:
      return state;
  }
}
