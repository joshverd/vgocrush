
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'
import Spinner from 'components/Spinner'
import { VirtualScroll } from 'react-virtual-scrolling'

import * as engine from 'lib/engine'

import Bet from './Bet'
import CashoutArrow from './CashoutArrow'
import PrizeProgress from './PrizeProgress'
import style from './style.scss'

export default class CurrentBet extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      scrollContainerHeight: 400,

      players: engine.players,
      gameState: engine.gameState,
      bonusRound: engine.wasBonusRound,

      cashedOut: []
    }
  }

  componentDidMount() {
    this._updatePlayers = ::this._updatePlayers

    this._onResize = () => {
      const { list } = this.refs

      this.setState({
        scrollContainerHeight: list.clientHeight
      })
    }

    this._onResize()

    window.addEventListener('resize', this._onResize)
    engine.events.on('onCrashStateChange', this._updatePlayers)
    engine.events.on('onPlayerBet', this._updatePlayers)
    engine.events.on('onPlayerCashout', this._updatePlayers)
    engine.events.on('onCrashInit', this._updatePlayers)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._onResize)
    engine.events.removeListener('onCrashStateChange', this._updatePlayers)
    engine.events.removeListener('onPlayerBet', this._updatePlayers)
    engine.events.removeListener('onPlayerCashout', this._updatePlayers)
    engine.events.removeListener('onCrashInit', this._updatePlayers)
  }

  render() {
    const { players, gameState, cashedOut, scrollContainerHeight } = this.state

    return (
      <div className={style.rootContainer}>
        <div className={style.innerContains}>
          <div className={style.container}>
            { false ? <div className={style.cashoutsContainer}>
              {cashedOut.map(cashout =>
                <div key={cashout.id} className={style.cashout}>
                  <div className={style.cashoutImageContainer}>
                    <img src="//steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot621FAZt7P_BdjVW4tW4k7-KgOfLP7LWnn8fu5In27GYod2l21Gx-xU5MGDzddCRdw83Y1DW-VS3wu291JS76Z7PnWwj5Hc0AjJzVA/200x200" />
                  </div>

                  <CashoutArrow className={style.cashoutArrow} cashout={10.75} />

                  <div className={style.cashoutImageContainer}>
                    <img className={style.cashoutPlayer} src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/c9/c9180f93ac892fa7d078f5946239d049e987e3b6_full.jpg" />
                  </div>
                </div>
              )}
            </div> : null }

            <div className={style.currentBetsContainer} style={{ height: scrollContainerHeight }} ref="list" onScroll={::this._scrollList}>
              <VirtualScroll
                ref="virtualScroll"
                rows={players}
                scrollContainerHeight={scrollContainerHeight}
                totalNumberOfRows={(players.length) || 0}
                rowHeight={100}
                rowRenderer={::this._contentRenderer} />
            </div>
          </div>

          { !players.length ? <div className={style.emptyBets}>
          </div> : null }
        </div>
      </div>
    )
  }

  _scrollList(e) {
    if(this.refs.virtualScroll) {
      this.refs.virtualScroll.scrollHook(e.target)
    }
  }

  _contentRenderer(rowStyles, fromRow, toRow, parentStyles) {
    return (
      <div className={style.currentBets} style={parentStyles}>
        {this._renderRows(fromRow, toRow, rowStyles)}
      </div>
    )
  }

  _renderRows(fromRow, toRow, styles) {
    const { players, gameState, bonusRound } = this.state

    return this.state.players.slice(fromRow, toRow).map(player =>
      <Bet key={player.playerId}
        styles={{
          ...styles,
          borderLeftColor: this.props.toggles.enableCrashBetColors ? player.avatarColor : null
        }}
        player={player}
        bonusRound={bonusRound}
        gameState={gameState} />
    )
  }

  _updatePlayers() {
    this.setState({
      players: engine.players,
      gameState: engine.gameState,
      bonusRound: engine.wasBonusRound
    })
  }
}
