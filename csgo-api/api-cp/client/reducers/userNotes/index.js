
import { USER_NOTES_TOGGLE_FETCHING,
  USER_NOTES_SET_ALL} from './constants'

const initialState = {
  notes: [],
  fetching: false
};

export default function(state = initialState, action){
  switch(action.type){
    case USER_NOTES_TOGGLE_FETCHING:
      return Object.assign({}, state, {fetching: !state.fetching});
    case USER_NOTES_SET_ALL:
      return Object.assign({}, state, {notes: action.notes});

    default:
      return state;
  }
}
