import React            from "react";
import { connect }      from 'react-redux'
import numeral          from 'numeral'
import moment           from 'moment'
import FA               from "react-fontawesome"
import style            from '../../../RoutePromotions/style.css'

import {fetchNotes,
  addNote}              from "../../../../reducers/userNotes/actions.js";

class PlayerNotes extends React.PureComponent{
  constructor(props){
    super(props);
  }
  componentDidMount(){
    console.log(this.props.currentUser);
    this.props.fetchNotes(this.props.currentUser.id);
  }
  render(){
    return (<div className={style.container}>
      pimpom
      <FA name="rocket" />
    </div>);
  }
}

function mapStateToProps(state) {
  return  {
    currentUser   : state.currentUser,
    notes         : state.userNotes.notes
  };
}
const mapDispatchToProps = (dispatch)=>{
  return {
    fetchNotes: (playerId)=>{
      dispatch(fetchNotes(playerId))
    },
    addNote: (playerId)=>{
      dispatch(addNote(playerId));
    }
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(PlayerNotes);