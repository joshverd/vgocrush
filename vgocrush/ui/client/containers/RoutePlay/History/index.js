
import React from 'react'
import cn from 'classnames'
import Immutable from 'seamless-immutable'
import moment from 'moment'
import numeral from 'numeral'

import Modal from 'components/Modal'
import Spinner from 'components/Spinner'
import Button from 'components/Button'
import * as engine from 'lib/engine'
import socket from 'lib/socket'
import style from './style.scss'

import { getCrashData } from 'lib/engine'

export default class History extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      history: engine.gameHistory,
      showGame: false,
      loading: false,
      game: null,
      players: []
    }
  }

  componentDidMount() {
    this._onCrashInit = history => this._init(history)

    this._onCrashEnd = lastGame => this.setState({
      history: Immutable([ lastGame ]).concat(this.state.history).slice(0, 35)
    })

    engine.events.on('onCrashEnd', this._onCrashEnd)
    engine.events.on('onCrashInit', this._onCrashInit)
  }

  componentWillUnmount() {
    engine.events.removeListener('onCrashEnd', this._onCrashEnd)
    engine.events.removeListener('onCrashInit', this._onCrashInit)
  }

  // shouldComponentUpdate(nextProps, nextState) {
  //   return nextState.history !== this.state.history
  // }

  render() {
    const { history, loading, game, players } = this.state

    let modalHeader = loading ? <Spinner /> : null

    return (
      <div className={style.history}>
        {history.map(h =>
          <div key={h.hash} className={cn(style.historyResult, {
            [style.goodResult]: h.crashPoint >= 2,
            [style.bonusResult]: h.bonusRound
          })} onClick={() => this._load(h)}>{h.crashPoint.toFixed(2)}x</div>
        )}

        <Modal visible={this.state.showGame} onClose={() => this.setState({ showGame: false })} title={!!game ? (game.crashPoint / 100).toFixed(2) + 'x' : 'Loading game...'} subTitle={!!game ? moment(game.createdAt).format('lll') : ''} caption={!!game ? game.hash : ''} header={modalHeader}>
          <table>
            <thead>
              <tr>
                <th colSpan="2">Player</th>
                <th>@</th>
                <th colSpan="2"></th>
              </tr>
            </thead>
            <tbody>
              {!players.length ? <tr><td colSpan="5">No players joined this game</td></tr> : null }
              {players.map(player =>
                <tr key={player.playerId} className={player.status !== 'cashed_out' ? style.lost : null}>
                  <td width="10%"><img className={style.avatar} src={player.avatarFull} /></td>
                  <td width="30%">{player.name}</td>
                  <td width="25%">{player.status === 'cashed_out' ? (player.stoppedAt / 100).toFixed(2) + 'x' : '-'}</td>
                  <td>{player.status !== 'cashed_out' ? '-' : '+' }{numeral(player.status === 'cashed_out' ? player.stoppedAtItemsTotal : player.wagerTotal).format('0,0.00')}</td>
                  <td>
                    <div className={style.items}>
                      {(player.status !== 'cashed_out' ? player.wagerItems : player.stoppedAtItems).map((item, i) => <img key={i} src={item.iconUrl} />)}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Modal>
      </div>
    )
  }

  _init(history) {
    this.setState({
      history
    })
  }

  _load(h) {
    this.setState({
      showGame: true,
      loading: true,
      players: [],
      game: null
    })

    getCrashData({ gameId: h.id }).then(({ currentGame }) => {
      this.setState({
        players: currentGame.players,
        game: currentGame,
        loading: false
      })
    })
  }
}
