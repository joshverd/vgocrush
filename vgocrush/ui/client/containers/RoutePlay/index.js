
import React, { Component } from 'react'
import { connect } from 'react-redux'
import cn from 'classnames'
import _ from 'underscore'
import PropTypes from 'prop-types'

import { setTitle } from 'containers/App'
import Segment from 'components/Segment'
import Transactions from 'components/Transactions'
import AnimatedCount from 'components/AnimatedCount'
import GiftModal from 'components/GiftModal'
import Graph from 'components/Crash/Graph'

import socket from 'lib/socket'
import * as engine from 'lib/engine'
import api from 'lib/api'

import CurrentGameBar from './CurrentGameBar'
import CurrentGame from './CurrentGame'
import Inventory from './Inventory'
import PlaceBet from './PlaceBet'
import History from './History'
import CashoutPrediction from './CashoutPrediction'
import CurrentBets from './CurrentBets'
import UpdateNotice from './UpdateNotice'
import style from './style.scss'

function crashToColor(crash) {
  return crash < 2 ? '#fd3173' : '#1b85e3'
}

class RoutePlay extends Component {
  static contextTypes = {
    switchSettingsTab: PropTypes.func
  }

  constructor(props) {
    super(props)

    this.state = {
      players: engine.players,
      wageredTotal: engine.players.reduce((t, p) => t + p.wagerTotal, 0),
      playerCount: 0,

      selectedItems: [],
      selectedItemIds: [],
      selectedValue: 0
    }
  }

  componentDidMount() {
    setTitle('Play')

    this._updatePlayers = () => {
      this.setState({
        playerCount: engine.players.length,
        wageredTotal: engine.players.reduce((t, p) => t + p.wagerTotal, 0)
      })
    }

    this._onPlayerCashout = bet => {
      if(!!engine.playerBet && bet.playerId === engine.playerBet.playerId) {
        this.setState({
          selectedItems: bet.stoppedAtItems,
          selectedItemIds: _.pluck(bet.stoppedAtItems, 'id'),
          selectedValue: bet.stoppedAtItems.reduce((t, i) => t + i.price, 0)
        })
      }
    }

    this._onReconnect = () => socket.emit('watchGame', 'crash')

    engine.loadCrash()

    socket.on('reconnect', this._onReconnect)
    socket.emit('watchGame', 'crash')

    engine.events.on('onPlayerCashout', this._onPlayerCashout)
    engine.events.on('onCrashStateChange', this._updatePlayers)
    engine.events.on('onPlayerBet', this._updatePlayers)
    engine.events.on('onCrashInit', this._updatePlayers)
  }

  componentWillUnmount() {
    socket.emit('watchGame', null)
    socket.removeListener('reconnect', this._onReconnect)
    engine.events.removeListener('onPlayerCashout', this._onPlayerCashout)
    engine.events.removeListener('onCrashStateChange', this._updatePlayers)
    engine.events.removeListener('onPlayerBet', this._updatePlayers)
    engine.events.removeListener('onCrashInit', this._updatePlayers)

    engine.resetCrash()
  }

  render() {
    const { currentUser, playerInventory, toggles } = this.props
    const { playerCount, wageredTotal, selectedItems, selectedValue } = this.state

    const disabledCrash = toggles.disableCrash && engine.gameState !== 'Over'

    return (
      <div className={style.container}>
        <div className={style.leftSide}>
          <Segment className={style.currentGameContainer}>
            <CurrentGame disabled={disabledCrash} />
            <UpdateNotice disabled={disabledCrash && engine.gameState !== 'InProgress'} />
          </Segment>

          <Inventory
            playerInventory={playerInventory}
            currentUser={currentUser}
            items={this.state.selectedItems}
            selectedItems={this.state.selectedItemIds}
            selectedValue={selectedValue} onToggleItem={::this._onToggleItem}
            selectAll={::this._onSelectAll}
            clearSelection={() => this.setState({ selectedItems: [], selectedItemIds: [] })}
            switchSettingsTab={this.context.switchSettingsTab} />
        </div>
        <div className={style.rightSide}>
          <Segment className={style.rideSideSegment}>

            { false ? <div className={style.warningSign}><i className="fa fa-warning-sign" /> Withdrawals are temporarily down and will be back as soon as possible.</div> : null }

            <PlaceBet wagerItems={selectedItems} wagerItemTotal={selectedValue} />
            <History history={this.state.history} />
            <CurrentGameBar playerCount={playerCount} wageredTotal={wageredTotal} />
            <CurrentBets toggles={toggles} />
          </Segment>
        </div>

        { false ? <GiftModal visible={true} /> : null }
      </div>
    )
  }

  _onSelectAll() {
    const { playerInventory } = this.props
    const selectedItems = playerInventory.filter(i => i.state === 'AVAILABLE')

    this.setState({
      selectedItems,
      selectedItemIds: _.pluck(selectedItems, 'id')
    })
  }

  _open(id) {
    api('/inventory/open/' + id, {
      method: 'POST'
    })
  }

  _onToggleItem(id, inventory, item) {

    if(!!item && item.type === 'gift') {
      this._open(item.id)
      return
    }

    let { selectedItemIds } = this.state
    let idx = selectedItemIds.indexOf(id)

    if(idx >= 0) {
      selectedItemIds.splice(idx, 1)
    } else {
      selectedItemIds.push(id)
    }

    const selectedItems = inventory
      .filter(i => selectedItemIds.indexOf(i.id) >= 0)

    this.setState({
      selectedItems,
      selectedItemIds,
      selectedValue: selectedItems.reduce((t, i) => t + i.price, 0)
    })
  }
}

export default connect(
  ({ currentUser, playerInventory, toggles }) => ({ currentUser, playerInventory, toggles }),
)(RoutePlay)
