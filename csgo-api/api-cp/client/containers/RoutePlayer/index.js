
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'
import moment from 'moment'
import _ from 'underscore'

import { Modal } from 'office-ui-fabric-react/lib/Modal'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import Stats, { Stat } from 'components/Stats'

import api from 'lib/api'
import App from 'containers/App'
import TradeOffers from './TradeOffers'
import Inventory from './Inventory'
import CrashGameHistory from './CrashGameHistory'
import style from './style.css'


import ExtendedContentContainer from "./ExtendedContentContainer/ExtendedContentContainer.jsx";

const sectionsTxt = {
  'general': 'General',
  'inventory': 'Inventory',
  'virtualOffers': 'Virtual Offers',
  'tradeOffers': 'Steam Trade Offers',
  'crashGameHistory': 'Crash Game History'
}

class Footer extends React.PureComponent{
  constructor(props){
    super(props);
  }
  render(){
    return (<div className={style.footer}>
      <Checkbox disabled={this.props.busy} checked={this.props.player.banned} onChange={(e, c) => this.props._updatePlayer({ banned: c })} label="Banned" />
      <Checkbox disabled={this.props.busy} checked={this.props.player.muted} onChange={(e, c) => this.props._updatePlayer({ muted: c })} label="Muted" />
      <Checkbox disabled={this.props.busy} checked={this.props.player.lockDeposits} onChange={(e, c) => this.props._updatePlayer({ lockDeposits: c })} label="Lock Deposits" />
      <Checkbox disabled={this.props.busy} checked={this.props.player.lockWithdraws} onChange={(e, c) => this.props._updatePlayer({ lockWithdraws: c })} label="Lock Withdraws" />
      <Checkbox disabled={this.props.busy} checked={!!this.props.player.maxWithdrawAmount && this.props.player.maxWithdrawAmount} onChange={(e, c) => this.props._updatePlayer({ maxWithdrawAmount: c })} label="Has Max Withdraw" />
    </div>);
  }
}

class Content extends React.PureComponent{
  constructor(props){
    super(props);
  }

  render(){

    switch(this.props.section){
      case "general":
        return (<ContentGeneral player={this.props.player} />);

      case "inventory":
        return (<Inventory currentUser={this.props.currentUser} playerId={this.props.playerId} player={this.props.player} />);

      case "virtualOffers":
        return (<ContentVirtualOffers virtualOffers={this.props.virtualOffers} />);

      case 'crashGameHistory':
        return (<CrashGameHistory playerId={this.props.playerId} player={this.props.player} />)

      case "tradeOffers":
        return (<ContentTradeOffers tradeOffers={this.props.tradeOffers}
                                    currentUser={this.props.currentUser}
                                    player={this.props.player}
                                    playerId={this.props.playerId} />);
      default:
        return(null);
    }
  }
}

class ContentVirtualOffers extends React.PureComponent{
  render(){
    return (<div className={style.container}>
      <table>
        <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>State</th>
          <th>Subtotal</th>
          <th>Items</th>
        </tr>
        </thead>
        <tbody>
        {this.props.virtualOffers.map(offer =>
          <tr key={offer.id}>
            <td>
              <a href="#"
                 onClick={e => {
                   e.preventDefault()
                   this.props.updateState({details: offer})
                 }}>
                {offer.id}</a>
            </td>
            <td>{moment(offer.createdAt).format('lll')}</td>
            <td>{offer.state}</td>
            <td>{numeral(offer.subtotal).format('$0,0.00')}</td>
            <td>{offer.itemNames.join(', ')}</td>
          </tr>
        )}
        </tbody>
      </table>
    </div>);
  }
}

class ContentGeneral extends React.PureComponent{
  render(){
    return (
      <div className={style.container}>
        <div className={style.statsContainer}>
          <Stats>
            <Stat name="Total Deposited" value={numeral(this.props.player.totalDeposit).format('$0,0.00')} />
            <Stat name="Total Withdrawn" value={numeral(this.props.player.totalWithdrawn).format('$0,0.00')} />
          </Stats>
        </div>

        <table>
          <thead>
          <tr>
            <th width="20%">Key</th>
            <th>Value</th>
          </tr>
          </thead>
          <tbody>
          {_.map(this.props.player, (v, k) =>
            <tr key={k}>
              <td><b>{k}</b></td>
              <td>{JSON.stringify(v)}</td>
            </tr>
          )}
          </tbody>
        </table>
      </div>);
  }
}
class ContentTradeOffers extends React.PureComponent{
  render(){
    return (<div className={style.container}>
      <TradeOffers currentUser={this.props.currentUser}
                   playerId={this.props.playerId}
                   tradeOffers={this.props.tradeOffers}
                   player={this.props.player}
      />
    </div>);
  }
}


class ContentInventory extends React.PureComponent{
  render(){
    return (
      <div className={style.container}>
        <div className={style.statsContainer}>
          <Stats>
            <Stat name="Total Items" value={numeral(this.props.playerItems.length).format('0,0')} />
            <Stat name="Inventory Worth" value={numeral(this.props.playerItems.reduce((t, p) => t + p.item.price, 0)).format('$0,0.00')} />
          </Stats>
        </div>


        { this.props.currentUser.isAdmin || this.props.currentUser.aai ? <div className={style.addForm}>
          <TextField label="Add Item"
                     value={this.props.itemName}
                     onChanged={itemName => this.props.updateState({ itemName, suggestions: [] })} />
          <DefaultButton disabled={this.props.busy || !this.props.itemName.length} primary onClick={::this.props._addPlayerItem}>Insert</DefaultButton>
        </div> : null }

        { this.props.suggestions.length > 0 ? <div className={style.suggestions}>
          <b>Could not find item, Did you mean?</b>
          <ul>
            {this.props.suggestions.map(suggestion =>
              <li key={suggestion.id}><a href="#" onClick={e => {
                e.preventDefault()
                this.props.updateState({
                  suggestions: [],
                  itemName: suggestion.name
                })
              }}>{suggestion.name}</a></li>
            )}
          </ul>
        </div> : null }


        <table>
          <thead>
          <tr>
            { this.props.currentUser.isAdmin || this.props.currentUser.aai ? <th width="10%" colSpan="2" /> : null }
            <th width="10%">Price</th>
            <th>Name</th>
          </tr>
          </thead>
          <tbody>
          {this.props.playerItems.map(playerItem =>
            <tr key={playerItem.id}>
              { this.props.currentUser.isAdmin || this.props.currentUser.aai ?
                <td>
                  <DefaultButton disabled={this.props.busy} onClick={() => this.props._removePlayerItem(playerItem.id)}>Remove</DefaultButton>
                </td> : null }
              { this.props.currentUser.isAdmin || this.props.currentUser.aai ?
                <td>
                  <DefaultButton disabled={this.props.busy}
                                 primary={playerItem.state !== 'BUSY'}
                                 onClick={() => this.props._updatePlayerItem(playerItem.id, {
                                   state: playerItem.state === 'BUSY' ? 'AVAILABLE' : 'BUSY'})
                                 }
                  >{ playerItem.state === 'BUSY' ? 'Unlock' : 'Lock'} </DefaultButton>
                </td> : null }

              <td>{numeral(playerItem.item.price).format('$0,0.00')}</td>
              <td>{playerItem.name}</td>
            </tr>
          )}
          </tbody>
        </table>
      </div>);
  }
}


class RoutePlayer extends Component {
  constructor(props) {
    super(props)

    this.state = {
      player        : null,
      busy          : false,

      section: !!props.params.page && typeof sectionsTxt[props.params.page] ? props.params.page : 'general',
      playerItems   : [],
      virtualOffers : [],
      tradeOffers   : [],

      itemName      : '',
      suggestions   : [],

      details       : null
    };
    this.updateState        = this.updateState.bind(this);
    this._updatePlayer      = this._updatePlayer.bind(this);
    this._addPlayerItem     = this._addPlayerItem.bind(this);
    this._removePlayerItem  = this._removePlayerItem.bind(this);
    this._refresh           = this._refresh.bind(this);
  }

  componentDidMount() {
    App.setTitle('Player')

    this._refresh()
  }


  render() {
    const { busy, player, section, details } = this.state
     if(!player && busy) {
      return (
        <div className={style.container}>
          <Spinner size={ SpinnerSize.large } label="Loading player..." />
        </div>
      )
    } else if(!player) {
      return (
        <div className={style.container}>
          <div style={{ textAlign: 'center' }}>Cannot find player. <Link to="/players">Search again</Link></div>
        </div>
      )
    }

    return (
      <div className={style.wrapper} ref="container">
        <CommandBar
          isSearchBoxVisible={false}

          items={[{
            key: 'avatar',
            name: <div className={style.avatar}><img src={player.avatar} /></div>
          }, {
            key: 'playerId',
            name: player.id
          }, {
            key: 'displayName',
            name: player.displayName
          }, {
            key: 'section',
            name: sectionsTxt[section],
            disabled: busy,
            onClick: () => false,
            items: Object.keys(sectionsTxt).map(key => ({
              key,
              name: sectionsTxt[key],
              onClick: () => this._onSectionChange(key)
            }))
          }]}

          farItems={ false ? [{
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            disabled: busy,
            onClick: e => {
              e.preventDefault()
              this._refresh()
            }
          }] : []} />
        <div className={style["main-container"]}>
          <div className={style["content-container"]}>
            {<Content currentUser={this.props.currentUser}
                      virtualOffers={this.state.virtualOffers}
                      playerId={this.props.params.playerId}
                      tradeOffers={this.state.tradeOffers}
                      suggestions={this.state.suggestions}
                      playerItems={this.state.playerItems}
                      player={this.state.player}
                      updateState={this.updateState}
                      section={this.state.section }
                      busy={this.state.busy}
                      itemName={this.state.itemName}
                      _addPlayerItem={this._addPlayerItem}
                      _updatePlayerItem={this._updatePlayerItem}
                      _removePlayerItem={this._removePlayerItem}
            />}

            {<Footer player={this.state.player}
                     _updatePlayer={this._updatePlayer}
                     busy={this.state.busy} /> }
          </div>
        </div>


        <Modal containerClassName={style.detailsModal} isOpen={!!details} onDismiss={() => this.setState({ details: null })}>
        <table>
          <thead>
            <tr>
              <th width="20%">Key</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {_.map(details, (v, k) =>
              <tr key={k}>
                <td><b>{k}</b></td>
                <td>{JSON.stringify(v)}</td>
              </tr>
            )}
          </tbody>
        </table>
        </Modal>
      </div>
    )
    /*
     * chris asked for this to be removed/hidden for now
      <div className={style["extended-content-container"]} >
        {<ExtendedContentContainer />}
      </div>
      */
  }
  updateState(newState){
    this.setState(newState);
  }


  _addPlayerItem() {
    this.setState({
      busy: true
    })
    api('players/addItem/' + this.props.params.playerId + '/' + this.state.itemName, { method: 'POST' })

      .then(({ suggestions, playerItem }) => {
        if(!!suggestions) {
          return this.setState({
            suggestions: suggestions || [],

            busy: false
          })
        }

        this.setState({
          busy: false,
          playerItems: this.state.playerItems.concat([ playerItem ])
        })
      }, () => this.setState({ busy: false }))
  }

  _removePlayerItem(id) {
    this.setState({
      busy: false
    })

    api('players/removeItem/' + id, { method: 'POST' })

      .then(() =>
        this.setState({
          busy: false,
          playerItems: this.state.playerItems.filter(p => p.id !== id)
        })
      , () =>
        this.setState({
          busy: false
        })
      )
  }

  _updatePlayer(update) {
    this.setState({
      busy: false
    })

    if(update.maxWithdrawAmount) {
      update.maxWithdrawAmount =  parseFloat(prompt('Max withdraw amount'))
    }

    api('players/update/' + this.props.params.playerId, {
      body: update
    })

    .then(({ player }) =>
      this.setState({
        busy: false,
        player: {
          ...this.state.player,
          ...player
        }
      })
    , () =>
      this.setState({
        busy: false
      })
    )
  }

  _updatePlayerItem(id, update) {
    this.setState({
      busy: false
    })

    api('players/updateItem/' + id, {
      body: update
    })

    .then(({ playerItem }) =>
      this.setState({
        busy: false,
        playerItems: this.state.playerItems.map(i => {
          if(i.id === id) {
            return {
              ...i,
              ...playerItem
            }
          }

          return i
        })
      })
    , () =>
      this.setState({
        busy: false
      })
    )
  }

  _refresh() {
    this.setState({
      busy: true
    })

    api('players/search/' + this.props.params.playerId + '?single=1').then(({ players }) => {
      this.setState({
        player: players.length > 0 ? players[0] : null,
        busy: false
      })

      this._onSectionChange(this.state.section)
    }, () => {
      this.setState({
        busy: false
      })
    })
  }

  _onSectionChange(section) {
    if(section !== this.state.section) {
      this.props.history.push(`/players/${this.props.params.playerId}/${section}`)
    }

    this.setState({
      section
    })

    if(section === 'inventory') {
      this.setState({
        busy: true,
        playerItems: []
      })

      api('players/items/' + this.props.params.playerId).then(({ playerItems }) =>
        this.setState({
          playerItems,

          busy: false,
        })
      , () => this.setState({ busy: false }))
    }

    if(section === 'virtualOffers') {
      this.setState({
        busy: true,
        virtualOffers: []
      })

      api('players/virtualOffers/' + this.props.params.playerId).then(({ virtualOffers }) =>
        this.setState({
          virtualOffers,

          busy: false,
        })
      , () => this.setState({ busy: false }))
    }

    // if(section === 'tradeOffers') {
    //   this.setState({
    //     busy: true,
    //     tradeOffers: []
    //   })
    //
    //   api('players/tradeOffers/' + this.props.params.playerId).then(({ tradeOffers }) =>
    //     this.setState({
    //       tradeOffers,
    //
    //       busy: false,
    //     })
    //   , () => this.setState({ busy: false }))
    // }
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RoutePlayer))
