
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

export default class CashoutPrediction extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
    }
  }

  // componentDidMount() {
  //   this._onCrashInit = history => this._init(history)
  //
  //   this._onCrashEnd = lastGame => this.setState({
  //     history: Immutable([ lastGame ]).concat(this.state.history)
  //   })
  //
  //   engine.events.on('onCrashEnd', this._onCrashEnd)
  //   engine.events.on('onCrashInit', this._onCrashInit)
  // }
  //
  // componentWillUnmount() {
  //   engine.events.removeListener('onCrashEnd', this._onCrashEnd)
  //   engine.events.removeListener('onCrashInit', this._onCrashInit)
  // }

  // shouldComponentUpdate(nextProps, nextState) {
  //   return nextState.history !== this.state.history
  // }

  render() {
    return (
      <div>s
      </div>
    )
  }
  //
  // _init(history) {
  //   this.setState({
  //     history
  //   })
  // }
  //
  // _load(h) {
  //   this.setState({
  //     showGame: true,
  //     loading: true,
  //     players: [],
  //     game: null
  //   })
  //
  //   socket.emit('getCrash', h.hash, ({ currentGame, players }) => {
  //     this.setState({
  //       players: players.sort((a, b) => b.wagerTotal - a.wagerTotal),
  //
  //       game: currentGame,
  //       loading: false
  //     })
  //   })
  // }
}
