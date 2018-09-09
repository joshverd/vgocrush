
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'

import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import api from 'lib/api'
import App from 'containers/App'
import style from './style.css'

import MostValuableInventories from "./MostValuableInventories/MostValuableInventories.jsx";

class RoutePlayers extends Component {
  constructor(props) {
    super(props)

    this.state = {
      search: '',
      players: [],
      busy: false
    }
  }

  componentDidMount() {
    App.setTitle('Players')

    const searchBox = this._searchBox = this.refs.container.querySelectorAll('.ms-CommandBarSearch-input')[0]

    // searchBox.onkeyup = e => this.setState({
    //   search: e.target.value
    // })

    searchBox.onkeydown = e => {
      if(e.keyCode == 13) {
        this._refresh(e.target.value)
      }
    }
  }

  componentDidUpdate() {
    this._searchBox.disabled = this.state.busy
  }

  render() {
    const { busy, players } = this.state;

    return (
      <div ref="container">
        <CommandBar
          isSearchBoxVisible={ true }
          searchPlaceholderText='Steam ID or diplay name ...'
          items={[]}
          farItems={[]} />

        <div className={style.container}>
          { busy ? <Spinner size={ SpinnerSize.large } label="Loading players..." /> : null }

          { !busy ? <table>
            <thead>
              <tr>
                <th width="5%"></th>
                <th width="10%">SteamID</th>
                <th>Display Name</th>
              </tr>
            </thead>
            <tbody>
              {players.map(player =>
                <tr key={player.id}>
                  <td><img width="30" src={player.avatarFull} /></td>
                  <td><Link to={`/players/${player.id}`}>{player.id}</Link></td>
                  <td>{player.displayName}</td>
                </tr>
              )}

              { !players.length ? <tr><td colSpan="3">Nothing to display, try searching for a valid Steam ID or display name</td></tr> : null }
            </tbody>
          </table> : null }
        </div>
        <div className={style.container}>
          {<MostValuableInventories />}
        </div>
      </div>
    )
  }

  _refresh(query) {
    this.setState({
      busy: true
    })

    api('players/search/' + query).then(({ players }) => {
      this.setState({
        players,

        busy: false
      })
    }, () => {
      this.setState({
        busy: false
      })
    })
  }
}


export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RoutePlayers))
