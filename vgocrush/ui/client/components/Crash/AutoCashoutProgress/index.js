
import React from 'react'
import numeral from 'numeral'

import Progress from 'components/Progress'
import Payout from '../Payout'

import * as engine from 'lib/engine'

export default class AutoCashoutProgress extends Payout {
  constructor(props) {
    super(props)
  }

  // shouldComponentUpdate() {
  //   return !!engine.playerBet
  // }

  render() {
    const { target } = this.props
    const pct = this._getPercentage()

    return (
      <Progress value={pct * 100} />
    )
  }

  _getPercentage() {
    const { target } = this.props

    if(!engine.playerBet || target <= 1.01) {
      return 0
    } else if(this.state.payout > target) {
      return 100
    } else if(engine.playerBet.status === 'cashed_out') {
      return (engine.playerBet.stoppedAt - 100) / ((target * 100) - 100)
    }

    return ((this.state.payout * 100) - 100) / ((target * 100) - 100)
  }
}
