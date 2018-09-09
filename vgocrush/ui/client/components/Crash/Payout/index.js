
import React from 'react'
import numeral from 'numeral'

import * as engine from 'lib/engine'

export default class CrashPayout extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      payout: 0,
      payoutItems: []
    }
  }

  componentDidMount() {
    window.requestAnimationFrame(::this._draw)
  }

  componentWillUnmount() {
    this._stopDrawing = true
  }

  render() {
    return (
      <span>Upgrade @ {numeral(this.state.payout).format('0,0.00')}x</span>
    )
  }

  _draw() {
    if (this._stopDrawing) {
      return
    }

    const payout = engine.calculateGamePayout(engine.getElapsedTimeWithLag())

    if(!!this.props.onPayoutUpdate && !!engine.playerBet && engine.playerBet.status === 'playing') {
      const payoutAmount = engine.playerBet.wagerTotal * payout
      const payoutItems = engine.generateRandomItems(payoutAmount)

      if(payout !== this.state.payout && payoutItems.value !== this._lastPayoutItemsValue) {
        this._lastPayoutItemsValue = payoutItems.value

        this.props.onPayoutUpdate({
          payout,
          payoutItems
        })
      }
    }

    const newPayout = payout || 1

    if(newPayout !== this.state.payout) {
      this.setState({
        payout: newPayout
      })
    }

    window.requestAnimationFrame(::this._draw)
  }
}
