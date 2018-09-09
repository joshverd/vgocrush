
import React, { Component } from 'react'
import { connect } from 'react-redux'
import cn from 'classnames'
import PropTypes from 'prop-types'
import _ from 'underscore'

import Inventory from 'containers/RoutePlay/Inventory'
import Spinner from 'components/Spinner'
import api from 'lib/api'
import socket from 'lib/socket'
import { snipeSounds } from 'lib/sound'

import GameTimer from './GameTimer'
import BetContainer from './BetContainer'
import PotValue from './PotValue'
import ActionBar from './ActionBar'
import Jackpot from './Jackpot'
import History from './History'
import style from './style.scss'

class RouteJackpot extends React.Component {
  static contextTypes = {
    switchSettingsTab: PropTypes.func
  }

  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: false,

      gameMode: this._getGameMode(),

      bets: [],
      history: [],
      totalPotValue: 0,
      currentGame: null,
      mode: null,

      selectedItems: [],
      selectedItemIds: [],
      selectedValue: 0
    }
  }

  componentDidMount() {
    this._onNewEntries = entries => {
      const { currentGame } = this.state

      if(!currentGame) {
        return
      }

      this.setState({
        currentGame: {
          ...currentGame,

          entries: _.uniq([
            ...entries.map(e => ({
              ...e,
              _isNew: true
            })),

            ...currentGame.entries
          ], e => e.id)
        }
      })

      _.sample(snipeSounds).play()
    }

    this._onUpdate = update => {
      const { currentGame } = this.state

      if(!currentGame) {
        return
      }

      this.setState({
        currentGame: this._formatGame({
          ...currentGame,
          ...update
        })
      })
    }

    this._onNew = newGame => {
      const { currentGame } = this.state

      this.setState({
        currentGame: this._formatGame(newGame),
        history: [{
          id: currentGame.id,
          text: currentGame.roundNumberStr,
          roundNumber: currentGame.roundNumber
        }, ...this.state.history ].slice(0, 35)
      })
    }

    this._onDisconnect = () => {
      this.setState({
        loading: true
      })
    }

    this._onReconnect = () => {
      this._loadGame(this.state.gameMode)
    }

    this._loadGame(this.state.gameMode)
    socket.on('disconnect', this._onDisconnect)
    socket.on('reconnect', this._onReconnect)
    socket.on('jp:new', this._onNew)
    socket.on('jp:update', this._onUpdate)
    socket.on('jp:push', this._onNewEntries)
  }

  componentDidUpdate(prevProps, prevState) {

  }

  componentWillUnmount() {
    socket.emit('watchGame', null)
    socket.removeListener('disconnect', this._onDisconnect)
    socket.removeListener('reconnect', this._onReconnect)
    socket.removeListener('jp:new', this._onNew)
    socket.removeListener('jp:update', this._onUpdate)
    socket.removeListener('jp:push', this._onNewEntries)
  }

  render() {
    const { currentUser, playerInventory } = this.props
    const { loading, busy, gameMode, bets, totalPotValue, currentGame, selectedItems, selectedItemIds, selectedValue } = this.state

    return (
      <div className={style.container}>
        <div className={style.leftSide}>
          <History history={this.state.history} />
          <PotValue value={!!currentGame ? currentGame.potSize : 0} />
          <GameTimer currentGame={currentGame} onTick={() => {}} />
          <BetContainer busy={busy || selectedItems.length <= 0} onClick={() => this._deposit(selectedItemIds)} />

          <Inventory
            playerInventory={playerInventory}
            currentUser={currentUser}
            items={this.state.selectedItems}
            selectedItems={this.state.selectedItemIds}
            selectedValue={selectedValue}
            onToggleItem={::this._onToggleItem}
            selectAll={::this._onSelectAll}
            clearSelection={() => this.setState({ selectedItems: [], selectedItemIds: [] })}
            switchSettingsTab={this.context.switchSettingsTab}
            onContextMenuShow={() => this.setState({ selectedItems: [], selectedItemIds: [] })}
            contextMenu={[{
              key: 'jackpotDeposit',
              render: () => (<div><img src={require('assets/image/piggyBank.svg')} /> Deposit into Jackpot</div>),
              onClick: item => this._deposit([ item.id ])
            }]} />
        </div>

        <div className={style.rightSide}>
          <ActionBar
            disabled={loading}
            gameMode={gameMode}
            onChange={::this._onGameModeChange}/>

          { !loading && !!currentGame ? <Jackpot key={gameMode} busy={busy} currentGame={currentGame} currentUser={currentUser} onShowSecret={() => this._focusEntry(currentGame.winner.ticket)} /> : <div className={style.loaderContainer}><Spinner text="Loading Jackpot"/></div> }
        </div>
      </div>
    )
  }

  _focusEntry(ticketNumber) {
    const { currentGame } = this.state

    const entryIndex = _.findIndex(currentGame.entries, e =>
      ticketNumber >= e.ticketStart && ticketNumber <= e.ticketEnd
    )

    if(entryIndex < 0) {
      return
    }

    const temp = currentGame.entries[0]
    currentGame.entries[0] = currentGame.entries[entryIndex]
    currentGame.entries[entryIndex] = temp

    const playerId = currentGame.entries[entryIndex].player.id
    const focusedEntries = currentGame.entries
      .map((e, i) => e.playerId === playerId ? i : -1)
      .filter(i => i >= 0)

    this.setState({
      currentGame: {
        ...currentGame,

        _focusedEntries: [1],
        entries: [{
          id: 'secret',
          _secretBlock: true,
          _winningTicket: ticketNumber,
          _secret: currentGame.secret || ''
        },
          ...currentGame.entries
        ]
      }
    })
  }

  _getGameMode() {
    return this.props.params.gameMode !== 'Small' ? 'Classic' : 'Small'
  }

  _onGameModeChange(gameMode) {
    if(gameMode === this.state.gameMode) {
      return
    }

    this._loadGame(gameMode)
  }

  _loadGame(gameMode) {
    this.setState({
      loading: true,
      currentGame: null
    })

    // socket.emit('watchGame', null)

    return api(`jp/current/${gameMode}`).then(({ mode, currentGame, history }) => {
      this.setState({
        gameMode,
        mode,
        history,

        loading: false,
        currentGame: this._formatGame(currentGame)
      })

      socket.emit('watchGame', 'jackpot:' + gameMode)
    })

    .catch(console.log)
  }

  _deposit(itemIds) {
    const { currentGame } = this.state

    this.setState({
      busy: true
    })

    api(`jp/deposit/${currentGame.mode}`, {
      body: {
        itemIds
      }
    })

    .then(() => {
      this.setState({
        busy: false
      })
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _formatGame(game) {
    game._playerChances = _
      .chain(game.entries)
      .groupBy('playerId')
      .map(r => {
        const sum = r.reduce((t, e) => t + e.value, 0)
        return {
          player: r[0].player,
          chance: sum / game.potSize
        }
      })
      .sortBy('chance')
      .value()
      .reverse()

    game._playerChance = game._playerChances.filter(c =>
      c.player.id === this.props.currentUser.id
    )[0] || null

    return game
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

  _onSelectAll() {
    const { playerInventory } = this.props
    const selectedItems = playerInventory.filter(i => i.state === 'AVAILABLE')

    this.setState({
      selectedItems,
      selectedItemIds: _.pluck(selectedItems, 'id')
    })
  }
}

export default connect(
  ({ currentUser, playerInventory }) => ({ currentUser, playerInventory }),
)(RouteJackpot)
