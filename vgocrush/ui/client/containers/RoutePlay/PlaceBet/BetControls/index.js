
import React from 'react'
import cn from 'classnames'
import Immutable from 'seamless-immutable'
import moment from 'moment'
import numeral from 'numeral'
import { toast } from 'react-toastify'

import Modal from 'components/Modal'
import Spinner from 'components/Spinner'
import Button from 'components/Button'
import Progress from 'components/Progress'
import * as engine from 'lib/engine'
import SkinSelectModal from 'components/SkinSelectModal'
import { getItemPrice } from 'lib/items'
import socket from 'lib/socket'

import Payout from 'components/Crash/Payout'
import AutoCashoutProgress from 'components/Crash/AutoCashoutProgress'
import style from './style.scss'

export default class BetControls extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      busy: false,
      placingBet: false,

      autoCashOut: '1000',
      oldAutoCashout: '1000'
    }
  }

  componentDidMount() {
    this._onCrashStarting = () => {
      if(this.state.placingBet) {
        this._beginUpgrade()
      }
    }

    this._onPlayerCashout = bet => {
      if(bet.playerId === engine.playerId) {

        if(!!this.state.autoCashoutSkin && bet.stoppedAt >= parseInt(parseFloat(this.state.autoCashOut) * 100)) {
          this._clearAutoCashout()
        }
      }
    }

    this._onCrashInit = () => {
      if(!!engine.playerBet && engine.playerBet.autoCashOut && engine.playerBet.autoCashOut >= 101) {
        this.setState({
          autoCashOut: (engine.playerBet.autoCashOut / 100),
          autoCashoutSkin: !!engine.playerBet.targetItems && engine.playerBet.targetItems.length ? engine.playerBet.targetItems[0] : this.state.autoCashoutSkin
        })
      }
    }

    this._onCrashInit()

    engine.events.on('onCrashInit', this._onCrashInit)
    engine.events.on('onCrashStarting', this._onCrashStarting)
    engine.events.on('onPlayerCashout', this._onPlayerCashout)
  }

  componentWillUnmount() {
    engine.events.removeListener('onCrashInit', this._onCrashInit)
    engine.events.removeListener('onCrashStarting', this._onCrashStarting)
    engine.events.removeListener('onPlayerCashout', this._onPlayerCashout)
  }

  componentDidUpdate(prevProps, prevState) {
    if(prevProps.wagerItems.length !== this.props.wagerItems.length && this.state.placingBet) {
      this.setState({
        placingBet: false
      })
    }

    this._updateAutoCashout()
  }

  render() {
    const { busy, placingBet, autoCashOut, autoCashoutSkin } = this.state
    const wagerItems = !!engine.playerBet && engine.playerBet.status !== 'cashed_out' ? engine.playerBet.wagerItems : this.props.wagerItems
    const wagerTotal = this.props.wagerItems.reduce((t, i) => t + getItemPrice(i), 0)

    let showCashoutWarning = wagerItems.length > 0 && (!parseFloat(autoCashOut) || parseFloat(autoCashOut) <= 1)

    if(showCashoutWarning && !!autoCashoutSkin) {
      showCashoutWarning = false
    }

    return (
      <div className={style.container}>
        <label>Auto Cashout</label>

        <div className={style.autoCashOutContainer}>
          <div className={style.inputContainer}>
            <input disabled={(!!engine.playerBet && engine.playerBet.status === 'playing') || !!autoCashoutSkin || busy || placingBet} type="text" value={autoCashOut} onChange={e => this.setState({ autoCashOut: e.target.value })} />
          </div>

          { busy || !engine.playerBet && !!autoCashoutSkin ? <a className={style.clearAutoCashout} href="#" onClick={::this._clearAutoCashout}><i className="fa fa-trash" /></a> : null }

          { !autoCashoutSkin ? <div className={style.autoCashoutButton} onClick={::this._toggleSkinSelect}>
            <img src={require('assets/image/weapons/awp.svg')} />
            <div>CHOOSE SKIN</div>
          </div> : <div className={style.autoCashout} key={autoCashoutSkin.name} onClick={::this._toggleSkinSelect}>
            <img src={autoCashoutSkin.iconUrl} />
          </div> }
        </div>

        <div className={style.autoCashoutDetails}>
          <AutoCashoutProgress target={autoCashOut} />
        </div>

        <div className={style.cashoutButtonContainer}>
          {::this._renderCashoutButton(wagerTotal)}

          <div className={cn(style.maxBetWarning, wagerTotal > engine.options.maxBet ? style.visible : null)}>Max bet is {numeral(engine.options.maxBet).format('$0,0')}</div>
          <div className={cn(style.maxBetWarning, showCashoutWarning ? style.visible : null)}>Min. cashout is 1.01x</div>
        </div>

        <SkinSelectModal
          wagerTotal={wagerTotal}
          visible={this.state.showSkinSelect}
          onClose={() => this.setState({ showSkinSelect: false })}
          onSelect={::this._onAutoSelect} />
      </div>
    )
  }

  _updateAutoCashout() {
    const { autoCashoutSkin } = this.state

    if(!autoCashoutSkin) {
      return
    }

    const wagerItems = !!engine.playerBet && engine.playerBet.status !== 'cashed_out' ? engine.playerBet.wagerItems : this.props.wagerItems
    const wagerTotal = wagerItems.reduce((t, i) => t + getItemPrice(i), 0)


    if(wagerTotal <= 0 || wagerTotal > autoCashoutSkin.priceU) {

      if(this.state.autoCashOut !== '-') {

         this.setState({
           autoCashOut: '-'
         })
      }

      return
    }

    const newCashout = (autoCashoutSkin.priceU / wagerTotal).toFixed(2)

    if(this.state.autoCashOut !== newCashout) {
      this.setState({
        autoCashOut: newCashout
      })
    }
  }

  _clearAutoCashout(e) {
    if(!!e) {
      e.preventDefault()
    }

    this.setState({
      autoCashoutSkin: null,
      autoCashOut: this.state.autoCashOut !== '-' ? this.state.autoCashOut : '1000'
    })
  }

  _onAutoSelect(autoCashoutSkin) {
    this.setState({
      oldAutoCashout: this.state.autoCashOut,
      autoCashoutSkin,
      showSkinSelect: false
    })
  }

  _toggleSkinSelect(e) {
    e.preventDefault()

    if(this.state.busy || (!!engine.playerBet && engine.playerBet.status === 'playing')) {
      return
    }

    this.setState({
      showSkinSelect: true
    })
  }

  _renderCashoutButton(wagerTotal) {
    const { playerBet, gameState } = engine
    const { busy, placingBet, autoCashOut } = this.state
    const { wagerItems } = this.props

    const showSpinner = busy // || (!!playerBet && gameState !== 'InProgress' && gameState !== 'Over')

    if(showSpinner) {
      let text = null

      if(!!playerBet) {
        text = gameState === 'Starting' ? 'Starting upgrade...' : 'Upgrading...'
      } else if(!playerBet) {
        text = 'Placing upgrade...'
      }

      return <Spinner text={text} />
    }

    if(!!playerBet && playerBet.status === 'playing') {
      const disableButton = gameState !== 'InProgress'

      return (
        <Button disabled={busy || disableButton} large primary onClick={::this._finishUpgrade}>
          { gameState === 'Starting' ? 'Starting...' : <div>
            <Payout onPayoutUpdate={this.props.onPayoutUpdate} />
          </div> }
        </Button>
      )
    }

    if(placingBet) {
      return (
        <Button large disabled={busy} onClick={() => this.setState({ placingBet: false })}><i className="fa fa-times" /> Cancel</Button>
      )
    }

    return (
      <Button disabled={busy || wagerItems.length <= 0 || parseFloat(autoCashOut) < 1.01 || wagerTotal > engine.options.maxBet} large primary onClick={::this._beginUpgrade}>Start Upgrade</Button>
    )
  }

  _beginUpgrade() {
    if(engine.gameState !== 'Starting') {
      this.setState({
        placingBet: true
      })

      return
    }

    this.setState({
      busy: true,
      placingBet: false
    })

    const joinOpts = {
      itemIds: this.props.wagerItems.map(i => i.id)
    }

    if(!!this.state.autoCashoutSkin) {
      joinOpts.targetItemNames = [ this.state.autoCashoutSkin.name ]
    } else {
      joinOpts.target = parseInt(parseFloat(this.state.autoCashOut) * 100)
    }

    engine

      .joinGame(joinOpts)

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
