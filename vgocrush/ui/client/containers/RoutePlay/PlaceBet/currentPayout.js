import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'

import CrashPayout from 'components/Crash/Payout'
import * as engine from 'lib/engine'
import Button from 'components/Button'
import { toast } from 'react-toastify'
import Payout from 'components/Crash/Payout'
import style from './style.scss'

export default class CurrentPayout extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      busy: false
    }
  }

/*
{ !!playerBet && playerBet.status === 'cashed_out' ? null : <div className={style.middleSide}>
  { !playerBet || playerBet.status === 'cashed_out' ? <Button disabled={busy || wagerItems.length <= 0} className={style.startUpgrade} onClick={::this._beginUpgrade}>{ !this.state.placingUpgrade ? 'Upgrade 6 Skins' : 'Starting ...'}</Button> :
    <CashoutButton gameState={gameState} playerBet={playerBet} /> }
</div> }
 */

  render() {
    const { playerBet, gameState } = engine
    const { wagerItems } = this.props
    const { busy } = this.state

    if(!!playerBet && playerBet.status !== 'playing') {
      return null
    }

    if(!playerBet) {
      const buttonText = !wagerItems.length ? 'Upgrade Skins' : `Upgrade ${wagerItems.length} Skin${wagerItems.length > 1 ? 's' : ''}`

      return (
        <Button disabled={busy || wagerItems.length <= 0} className={style.startUpgrade} onClick={::this._beginUpgrade}>{ !busy ? buttonText : 'Placing upgrade...'}</Button>
      )
    }

    let buttonText = 'Starting upgrade...'

    if(gameState === 'InProgress') {
       buttonText = !busy ? <Payout /> : 'Upgrading...'
    }

    return (
      <Button className={style.finishUpgrade} onClick={::this._finishUpgrade}>{buttonText}</Button>
    )
  }

  _beginUpgrade() {
    this.setState({
      busy: true
    })

    engine

      .joinGame({
        itemIds: this.props.wagerItems.map(i => i.id)
      })

      .then(() => {
        this.setState({
          busy: false
        })
      }, err => {
        toast(err)

        this.setState({
          busy: false
        })
      })
  }

  _finishUpgrade() {
    this.setState({
      busy: true
    })

    engine
      .cashoutGame()

      .then(() => {
        this.setState({
          busy: false
        })
      }, err => {
        toast(err)

        this.setState({
          busy: false
        })
      })
  }
}
