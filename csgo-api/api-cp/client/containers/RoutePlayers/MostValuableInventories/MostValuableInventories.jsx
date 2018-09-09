import React        from "react";
import api          from "lib/api";
import {Link}       from "react-router";



class InventoryRow extends React.PureComponent{
  render(){
    return (<tr>
      <td><img width="30" src={this.props.inventory.user.avatar} /></td>
      <td>{this.props.inventory.user.id}</td>
      <td><Link to={`/players/${this.props.inventory.user.id}`}>{this.props.inventory.user.displayName}</Link></td>
      <td>${this.props.inventory.value}</td>
    </tr>);
  }
}


class MostValuableInventories extends React.PureComponent{
  constructor(props){
    super(props);
    this.state = {inventories: []};
    this.fetchInventories = this.fetchInventories.bind(this);
  }
  componentDidMount(){
    this.fetchInventories();
  }
  fetchInventories(){
    api('stats/largest_inventories')
      .then(response =>{
        this.setState({inventories: response.inventories});
      })
      .catch(error =>{
        //dispatch(toggleNotesFetching());
        console.log(error);
      });
  }
  render(){
    return (<div>
      <hr/>
      <h3>Most valuable inventories</h3>
      <table>
        <thead>
        <tr>
          <th width="5%"></th>
          <th width="20%">SteamId</th>
          <th>DisplayName</th>
          <th width="10%">Value</th>
        </tr>
        </thead>
        <tbody>
          {this.state.inventories.map((invent)=>{
            return (<InventoryRow key={invent.user.id}
                                  inventory={invent} />);
          })}
        </tbody>
      </table>
    </div>);
  }

}

export default MostValuableInventories;