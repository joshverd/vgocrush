import { USER_NOTES_TOGGLE_FETCHING,
  USER_NOTES_SET_ALL }
                              from './constants'
import api                    from "lib/api";

export function setNotes(notes){
  return {
    type: USER_NOTES_SET_ALL,
    notes
  };
}

export function toggleNotesFetching(){
  return {
    type: USER_NOTES_TOGGLE_FETCHING
  };
}

export function fetchNotes (playerId, skip = 0, limit=40){
  console.log("fetching notes");
  return (dispatch)=>{
    dispatch(toggleNotesFetching());
    api('players/notes/' + playerId + "?skip=" + skip + "&limit=" + limit)
      .then(response =>{
        dispatch(toggleNotesFetching());
        dispatch(setNotes(response.notes));
      })
      .catch(error =>{
        dispatch(toggleNotesFetching());
        console.log(error);
      });
  }
}

export function addNote(playerId, topic, content){
  console.log("adding note");
  return (dispatch)=>{
    dispatch(toggleNotesFetching());
    api('players/notes/' + playerId, {body: {topic, content}} )
      .then(response =>{
        dispatch(toggleNotesFetching());
        dispatch(setNotes(response.notes));
      })
      .catch(error =>{
        dispatch(toggleNotesFetching());
        console.log(error);
      });
  }
}