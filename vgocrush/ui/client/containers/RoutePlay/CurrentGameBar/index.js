
import React from 'react'
import cn from 'classnames'

import AnimatedCount from 'components/AnimatedCount'
import * as engine from 'lib/engine'
import style from './style.scss'

export default class CurrentGameBar extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      periods: 0
    }
  }

  componentDidMount() {
    this._interval = setInterval(() =>
      this.setState({
        periods: this.state.periods < 3 ? this.state.periods + 1 : 0
      })
    , 350)
  }

  componentWillUnmount() {
    clearInterval(this._interval)
  }

  render() {
    const { playerCount, wageredTotal } = this.props

    const periods = Array.from({ length: this.state.periods }, () => '.')

    return (
      <div className={style.container}>
        <div className={style.currentGameInfo}>
          <div>{ playerCount === 0 ? 'Waiting for players to join' : `${playerCount} players upgrading` }{periods}</div>
          <div className={style.potValue}><AnimatedCount value={wageredTotal} format="0,0.00" /></div>
        </div>

        { false ? <div className={style.bonusInfo}>
          <img src={require('assets/image/gifts/upgradeGift.svg')} />
          <div><span>9</span> rounds since bonus</div>
        </div> : null }
      </div>
    )
  }
}
