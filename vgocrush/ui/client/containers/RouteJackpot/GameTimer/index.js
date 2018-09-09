
import React from 'react'
import moment from 'moment'
import pad from 'pad'
import cn from 'classnames'

import Progress from 'components/Progress'
import style from './style.scss'

export default class GameTimer extends React.Component {

  constructor(props) {
    super(props)

    this.interval = null
    this.state = this._getInitialState()
  }

  componentDidMount() {
    if(!!this.props.currentGame) {
      this._start()
    }
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  componentDidUpdate(prevProps) {
    const { currentGame } = this.props
    const { currentGame:last } = prevProps

    if((!!currentGame && !!currentGame.endsAt && !last) // Active, has time, but none
      || (!!currentGame && !!last && currentGame.endsAt !== last.endsAt) // Timer just started
      || (!!currentGame && !!last && !!currentGame.winner && !last.winner) // End game
      || (!!currentGame && !!last && currentGame.gameType !== last.gameType) // Game change
    ) {
      this._start()
    }
  }

  render() {
    const { currentGame } = this.props
    const { progress, seconds, mseconds } = this.state
    const showTimer = !!currentGame && currentGame.stage !== 'WaitingJoin' && (seconds > 0)

    return (
      <div className={cn(style.container, showTimer ? style.showTimer : null)}>
        <div className={style.gameTimer}>Starting in {seconds || '00'}</div>
        { false ? <Progress value={progress} /> : null }
      </div>
    )
  }

  _getInitialState() {
    return {
      diff: 0,
      progress: 100,
      seconds: '',
      mseconds: ''
    }
  }

  _start() {
    if(this.interval) {
      clearInterval(this.interval)
    }

    const { currentGame } = this.props

    if(!currentGame) {
      this.setState(this._getInitialState())
      this.props.onTick(0, true)
      return
    }

    const endsAt = currentGame.endsAt
    if(!endsAt) {
      this.setState(this._getInitialState())
      this.props.onTick(0, true)
      return
    }

    let lastSecond
    const endsAtMmt = moment(endsAt)
    const endsAtMs = endsAtMmt.diff(moment())
    console.log('endsat', endsAtMs)
    const tick = () => {
      const diff = endsAtMmt.diff(moment())
      const duration = moment.duration(diff, 'milliseconds')
      const minutes = duration.minutes()
      const seconds = duration.seconds()
      const milliseconds = duration.milliseconds()

      if(diff < 0 || !currentGame || !currentGame.endsAt) {
        clearInterval(this.interval)
        this.setState(this._getInitialState())
        this.props.onTick(0, true)
        return
      }

      this.props.onTick(diff)

      this.setState({
        diff,
        seconds: pad(2, seconds, '0'),
        mseconds: pad(2, milliseconds, '0').substring(0, 2),
        progress: (diff / endsAtMs) * 100
      })

      this.props.onTick()

      if(minutes === 0 && seconds < 5 && lastSecond !== seconds) {
        // TICK3.play()
        lastSecond = seconds
      } else {
        // TICK2.play()
      }
    }

    tick()
    this.interval = setInterval(tick, 20)
  }
}
