
import React from 'react'
import cn from 'classnames'
import Immutable from 'seamless-immutable'
import moment from 'moment'
import numeral from 'numeral'

import Modal from 'components/Modal'
import Spinner from 'components/Spinner'
import Button from 'components/Button'
import api from 'lib/api'
import socket from 'lib/socket'
import style from './style.scss'

export default class History extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      showGame: false,
      loading: false,
      game: null,
      players: []
    }
  }

  componentDidMount() {
    // this._onCrashInit = history => this._init(history)
    //
    // this._onCrashEnd = lastGame => this.setState({
    //   history: Immutable([ lastGame ]).concat(this.state.history).slice(0, 35)
    // })
    //
    // engine.events.on('onCrashEnd', this._onCrashEnd)
    // engine.events.on('onCrashInit', this._onCrashInit)
  }

  componentWillUnmount() {
    // engine.events.removeListener('onCrashEnd', this._onCrashEnd)
    // engine.events.removeListener('onCrashInit', this._onCrashInit)
  }

  // shouldComponentUpdate(nextProps, nextState) {
  //   return nextState.history !== this.state.history
  // }

  render() {
    const { loading, game, players } = this.state
    const { history } = this.props

    let modalHeader = loading ? <Spinner /> : null

    return (
      <div className={style.history}>
        {history.map(h =>
          <div key={h.id} className={cn(style.historyResult, {
            [style.goodResult]: h.roundNumber >= 0.5
          })} onClick={() => this._load(h)}>{h.text}</div>
        )}

        <Modal visible={this.state.showGame} onClose={() => this.setState({ showGame: false })} title={!!game ? `${game.mode}` : 'Loading game...'} subTitle={!!game ? moment(game.createdAt).format('lll') : ''} caption={!!game ? game.hash : ''} header={modalHeader}>
          { !!game ? <table>
            <tbody>
              <tr>
                <td>Round Number</td>
                <td>{game.roundNumber} ({game.roundNumberStr})</td>
              </tr>
              <tr>
                <td>Winner</td>
                <td><img src={game.winner.avatar} width="15" /> {game.winner.displayName}</td>
              </tr>
              <tr>
                <td>Winning Ticket</td>
                <td>{game.winner.ticket} ({game.winner.chance.toFixed(2)}% chance)</td>
              </tr>
              <tr>
                <td>Prize Amount</td>
                <td>{numeral(game.potSize).format('0,0.00')}</td>
              </tr>
              {game.winner.skins.map((skin, i) =>
                <tr key={i}>
                  <td></td>
                  <td><img src={skin.iconUrl} width="15" /> {skin.name}</td>
                </tr>
              )}
            </tbody>
          </table> : null }
        </Modal>
      </div>
    )
  }

  _load(h) {
    this.setState({
      showGame: true,
      loading: true,
      players: [],
      game: null
    })

    api(`jp/game/${h.id}`).then(({ game }) => {
      this.setState({
        game,

        loading: false
      })
    })
  }
}
