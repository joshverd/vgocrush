
import React, { Component } from 'react'
import { connect } from 'react-redux'
import cn from 'classnames'
import moment from 'moment'
import numeral from 'numeral'

import Modal from 'components/Modal'
import style from './style.scss'

class CrashGameModal extends Component {
  constructor(props) {
    super(props)

    this.state = this._getInitialState(props)
  }

  _getInitialState(props = {}) {
    return {
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.visible !== prevProps.visible) {
      this.setState(this._getInitialState())
    }
  }

  render() {
    const { game } = this.props
    const players = !!game ? game.players : []

    return (
      <Modal {...this.props} title={!!game ? (game.crashPoint / 100).toFixed(2) + 'x' : 'Loading game...'} subTitle={!!game ? moment(game.createdAt).format('lll') : ''} caption={!!game ? game.hash : ''}>
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
    )
  }
}

export default CrashGameModal
