import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'
import ReactSVG from 'react-inlinesvg'
import { toast } from 'react-toastify'

import Button from 'components/Button'
import AnimatedCount from 'components/AnimatedCount'
import SkinSelectModal from 'components/SkinSelectModal'
import * as engine from 'lib/engine'
import { getItemPrice } from 'lib/items'

import ChooseSkins from './chooseSkins'
import CashoutButton from './currentPayout'
import BetControls from './BetControls'
import BetItem from './BetItem'

import style from './style.scss'

export default class PlaceBet extends React.Component {

  constructor(props) {
    super(props)


    this.state = {
      busy: false,
      placingUpgrade: false,

      wagerItems: !!engine.playerBet ? engine.playerBet.wagerItems : [],
      wagerItemTotal: !!engine.playerBet ? engine.playerBet.wagerTotal : 0,
      subSkins: []
    }
  }

  componentDidMount() {
    this._onCrashStateChange = gameState => {
      if(gameState === 'Starting' && this.state.wagerItems.length > 0) {
        this.setState({
          wagerItems: [],
          wagerItemTotal: 0
        })
      }

      if(gameState === 'Starting') {
        this.setState({
          subSkins: []
        })
      }
    }

    this._onJoinedCrash = playerBet => {
      if(!engine.playerBet) {
        return
      }

      this.setState({
        wagerItems: engine.playerBet.wagerItems,
        wagerItemTotal: engine.playerBet.wagerTotal
      })
    }

    this._onPlayerCashout = bet => {
      if(!!engine.playerBet && bet.playerId === engine.playerBet.playerId) {
        this.setState({
          wagerItems: [],
          subSkins: [],
          wagerItemTotal: 0
        })
      }
    }

    engine.events.on('onCrashStateChange', this._onCrashStateChange)
    engine.events.on('joinedCrash', this._onJoinedCrash)
    // engine.events.on('onPlayerBet', this._updatePlayers)
    engine.events.on('onCrashInit', this._onJoinedCrash)
    engine.events.on('onPlayerCashout', this._onPlayerCashout)
  }

  componentWillUnmount() {
    engine.events.removeListener('onCrashStateChange', this._onCrashStateChange)
    engine.events.removeListener('joinedCrash', this._onJoinedCrash)
    // engine.events.removeListener('onPlayerBet', this._updatePlayers)
    engine.events.removeListener('onPlayerCashout', this._onPlayerCashout)
    engine.events.removeListener('onCrashInit', this._onJoinedCrash)
  }

  componentDidUpdate(prevProps) {
    if((!engine.playerBet || engine.playerBet.status === 'cashed_out') && prevProps.wagerItems.length !== this.props.wagerItems.length && this.state.wagerItems.length > 0) {
      this.setState({
        wagerItems: [],
        wagerItemTotal: 0
      })
    }
  }

  render() {
    const { playerBet, gameState } = engine
    const { busy, subSkins } = this.state

    const upgraded = !!playerBet && playerBet.status === 'cashed_out'
    const upgrading = !!playerBet && gameState !== 'Starting'
    const lost = !!playerBet && playerBet.status !== 'cashed_out' && gameState === 'Over'

    const wagerItems = this.state.wagerItems.length > 0 ? this.state.wagerItems : this.props.wagerItems
    const wagerItemTotal = this.state.wagerItems.length > 0 ? this.state.wagerItemTotal : this.props.wagerItemTotal

    return (
      <div className={style.placeBet}>
        <div className={style.sides}>
          <div className={style.wagerSide}>
            <div className={style.itemsValue}>
              <AnimatedCount style={{ opacity: upgrading ? 0.5 : null }} value={!!playerBet ? playerBet.wagerTotal : wagerItemTotal} format="0,0.00" />
              { upgrading ? <i style={{ margin: '0 10px' }} className="fa fa-caret-right" /> : null }
              { upgrading ? <span style={{ color: !lost ? '#8bc34a' : '#fd3173' }}>{numeral(upgraded ? playerBet.stoppedAtItemsTotal : wagerItemTotal).format('0,0.00')}</span> : null }
            </div>

            <div className={style.itemsContainer}>
              <div className={style.items}>
                { !wagerItems.length ? <p className={style.itemsEmptyMessage}>Select skins from your inventory to begin upgrading</p> : null }

                {wagerItems.map((item, i) =>
                  <BetItem key={item.id || i} item={item} compact={wagerItems.length > 2} />
                )}

                { subSkins.length ? <div className={style.subSkins}>
                  {subSkins.map((skin, i) =>
                    <img key={i} src={skin.iconUrl} />
                  )}
                </div> : null }
              </div>
            </div>
          </div>

          <BetControls wagerItems={this.props.wagerItems} onPayoutUpdate={::this._onPayoutUpdate} />
        </div>
      </div>
    )
  }

  _onPayoutUpdate({ payoutItems }) {
    this.setState({
      wagerItems: payoutItems.items.slice(0, 1),
      wagerItemTotal: payoutItems.value,
      subSkins: payoutItems.items.slice(1, 4)
    })
  }

  _finishUpgrade() {
    this.setState({
      busy: true,
      cashingOut: true
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
          busy: false,
          cashingOut: false
        })
      })
  }

  _beginUpgrade() {
    this.setState({
      busy: true,
      placingUpgrade: true
    })

    engine

      .joinGame({
        itemIds: this.props.wagerItems.map(i => i.id)
      })

      .then(() => {
        this.setState({
          busy: false,
          placingUpgrade: false
        })
      }, err => {
        toast(err)

        this.setState({
          busy: false,
          placingUpgrade: false
        })
      })
  }

  _showUpgradeModal() {
    if(this.state.busy || (!!engine.playerBet && engine.playerBet.status === 'playing')) {
      return
    }

    this.setState({
      showUpgradeSelect: true
    })
  }

  _onUpgradeSelection(wagerItems) {
    this.setState({
      wagerItems,
      wagerItemIds: wagerItems.map(i => i.id),
      wagerItemTotal: wagerItems.reduce((t, i) => t + getItemPrice(i), 0),

      showUpgradeSelect: false
    })
  }
}

/*

<div className={style.playerBet}>
  <div className={style.chooseText}>Choose as many skins from your inventory to upgrade</div>
  <div className={style.actionButtons}>
    <Button className={style.chooseSkin} large><span>Choose Skins</span></Button>
    <Button className={style.autoCashoutButton} large>Choose Auto Cashout</Button>
  </div>
</div>

{ false ? <div className={style.splitter}>
  <div />
  <div />
  <div />
  <div />
  <div />

  <div />
  <div />
  <div />
  <div />
  <div />
</div> : null }

<div className={style.winnings}>
  <Button className={style.chooseSkin} large><span>Choose Target Skin</span></Button>
  <Button className={style.chooseSkin} large><span>Place Bet</span></Button>
</div>
 */
