import React      from "react";
import FA         from "react-fontawesome";

import style      from "./style.css";

class Tab extends React.PureComponent{

  render(){
    let activeTabClass = "";
    if(this.props.selectedTabName === this.props.labelName){
      activeTabClass = style["selected"];
    }
    return (<div onClick={()=>{this.props.selectTab(this.props.labelName)}}
                 className={style["controls-selector"] + " " + activeTabClass}
    >
      <div className={style.icon}>{<FA name={this.props.iconName}/>}</div>
      <div><small>{this.props.labelName}</small></div>
    </div>);
  }
}


class ExtendedContentControls extends React.PureComponent{
  constructor(props){
    super(props);
  }
  render(){
    console.log(this.props.selectedTabName);
    return (<div className={style["controls-container"]}>
      <Tab iconName="clipboard"
           labelName="notes"
           selectedTabName={this.props.selectedTabName}
           selectTab={this.props.selectTab}
      />
      <Tab iconName="balance-scale"
           labelName="access logs"
           selectedTabName={this.props.selectedTabName}
           selectTab={this.props.selectTab}
      />
    </div>);
  }
}

export default ExtendedContentControls;