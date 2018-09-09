
import React from 'react'
import moment from 'moment'
import pad from 'pad'

import FromNow from 'components/FromNow'
import AnimatedCount from 'components/AnimatedCount'

import style from './style.scss'


class Timer extends FromNow {
  constructor(props) {
    super(props)
  }

  _format(to) {
    const now = moment()
    const diff = to.diff(now)
    const duration = moment.duration(diff, 'milliseconds')

    const days = Math.max(to.diff(now, 'd'), 0)

    const hours = pad(2, Math.max(duration.hours(), 0), '0')
    const minutes = pad(2, Math.max(duration.minutes(), 0), '0')
    const seconds = pad(2, Math.max(duration.seconds(), 0), '0')

    return `${days} day${days !== 1 ? 's' : ''} ${hours}:${minutes}:${seconds}`
  }
}

export default class Countdown extends React.Component {
  render() {
    const { raffle } = this.props

    return (
      <div className={style.container}>
        <div><Timer date={raffle.endDate} /></div>
        <div className={style.prizeValue}><AnimatedCount initial={false} value={raffle.totalPrizeValue} format="0,0.00" /></div>
      </div>
    )
  }
}

// 28 days 09:31:58
