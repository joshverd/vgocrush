import React            from "react";
import { connect }      from 'react-redux'
import numeral          from 'numeral'
import moment           from 'moment'
import FA               from "react-fontawesome"
import style            from './style.css'


class AddNoteContainer extends React.PureComponent{
  constructor(props){
    super(props);
    this.addNote = this.addNote.bind(this);
  }

  addNote(){
    this.props.addNote(this.props.playerId,
      this.topicField.value,
      this.contentField.value);
  }

  render(){
    return (<div>
      <input ref={(ref)=>{ this.topicField = ref}}
             type="text"
             className={style["add-note-topic"]}
             placeholder="topic"
      />
      <textarea ref={(ref)=>{ this.contentField = ref}}
                className={style["add-note-textarea"]}
                rows="6"
                placeholder="note content"
      />
      <button onClick={this.addNote}
              className={style["add-note-button"]}>
        add note
      </button>
    </div>);
  }

}

class Note extends React.PureComponent{
  render(){
    return (<div className={style["note-container"]}>
      <div className={style["note-header"]}>
        <span className={style["note-created-at"]}>
          {moment(this.props.note.createdAt).fromNow() } <br/>
          {this.props.note.createdBy.displayName}
         </span>
        <img src={this.props.note.createdBy.avatar} />
      </div>
      <div className={style["note-topic"]}>
        {this.props.note.topic}
      </div>

      <div className={style["note-content"]}>
        {this.props.note.content}
      </div>
    </div>);
  }
}

class PlayerNotes extends React.PureComponent{
  constructor(props){
    super(props);
  }
  componentDidMount(){
    this.props.fetchNotes(this.props.currentUser.id);
  }
  render(){
    return (<div className={style["notes-container"]}>
      <AddNoteContainer addNote={this.props.addNote}
                        playerId={this.props.currentUser.id}
      />
      {this.props.notes.map((note)=>{
        console.log("ff");
        console.log(note);
        return (<Note key={note.id} note={note} />);
      })}
    </div>);
  }
}

export default PlayerNotes;