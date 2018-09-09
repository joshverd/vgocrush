import React                    from "React";
import { connect }              from 'react-redux'
import style                    from "./style.css";

import ExtendedContentControls  from "./ExtendedContentControls.jsx";
import Notes                    from "./PlayerNotes/PlayerNotes.jsx";
import Logs                     from "./PlayerNotes/PlayerNotes.jsx";

import AccessLogs from './AccessLogs/AccessLogs.jsx'

import {addNote,
  fetchNotes}                   from "../../../reducers/userNotes/actions";

class ExtendedContentContainer extends React.PureComponent{
  constructor(props){
    super(props);
    this.state = {
      selectedTabName: "notes"
    };
    this.setActiveTab = this.setActiveTab.bind(this);
    this.getContent = this.getContent.bind(this);

  }
  setActiveTab(tabName){
    this.setState({selectedTabName: tabName});
  }
  getContent(selectedTabName){

    switch(selectedTabName){
      case "notes":
        return (<Notes notes={this.props.notes}
                       currentUser={this.props.currentUser}
                       fetchNotes={this.props.fetchNotes}
                       addNote={this.props.addNote}
        />);
      case "access logs":
        return (<AccessLogs logs={this.props.accessLogs}
                            currentUser={this.props.currentUser}
                            fetchLogs={this.props.fetchLogs}

        />);
    }
  }
  render(){
    return (<div>
      <ExtendedContentControls
        selectTab={this.setActiveTab}
        selectedTabName={this.state.selectedTabName}
      />
      {this.getContent(this.state.selectedTabName)}
    </div>);
  }

}

function mapStateToProps(state) {
  return  {
    currentUser   : state.currentUser,
    notes         : state.userNotes.notes,
    accessLogs    : state.auditLogs.accessLogs.logs
  };
}

const mapDispatchToProps = (dispatch)=>{
  return {
    fetchNotes: (playerId)=>{
      dispatch(fetchNotes(playerId))
    },
    addNote: (playerId, topic, content)=>{
      dispatch(addNote(playerId, topic, content));
    },
    fetchLogs: (playerId)=>{

    }
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ExtendedContentContainer);
