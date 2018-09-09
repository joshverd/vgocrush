
import React, { Component } from 'react'
import { Link } from 'react-router'
import cn from 'classnames'
import { toast } from 'react-toastify'
import { ToastContainer } from 'react-toastify'
import { connect } from 'react-redux'
import EventEmitter from 'eventemitter3'
import _ from 'underscore'

import { hideLoader } from 'lib/loader'
import { setTitle } from 'containers/App'
import Button from 'components/Button'
import Graph from 'components/Crash/Graph'
import * as engine from 'lib/engine'

import style from './style.scss'

class FakeGameEngine {
  constructor() {
    this.events = new EventEmitter()
  }

  resetGame() {
    this.gameState = 'Starting'
    this.startTime = new Date(Date.now() + 2500)

    setTimeout(() => this.startGame(), this.startTime - Date.now())
  }

  startGame(min = 0) {
    this.gameState = 'InProgress'
    this.startTime = Date.now()
    this.endTime = Date.now() + (Math.floor(Math.random() * 10) * 1000) + min
    this.totalElapsed = this.endTime - this.startTime

    if(this.resetTimeout) {
      clearTimeout(this.resetTimeout)
    }

    this.resetTimeout = setTimeout(() => {
      this.lastCrash = this.calculateGamePayout(Date.now() - this.startTime)
      this.gameState = 'Over'
      setTimeout(() => this.resetGame(), 2000)
    }, this.totalElapsed)
  }

  growthFunc(ms) {
    return Math.pow(Math.E, 0.00005 * ms)
  }

  calculateGamePayout(ms) {
    const gamePayout = Math.floor(100 * this.growthFunc(ms)) / 100
    console.assert(isFinite(gamePayout))
    return Math.max(gamePayout, 1)
  }

  getElapsedTimeWithLag() {
    if(this.gameState === 'InProgress') {
      return Date.now() - this.startTime
    }

    return 0
  }
}

class LoginScreen extends Component {

  constructor(props) {
    super(props)

    this._fakeGameEngine = new FakeGameEngine()

    this.state = {
      busy: false,
      showIntro: true
    }
  }

  componentDidMount() {
    setTitle()

    const hasIntroSupport = false

    if(!hasIntroSupport) {
      hideLoader(true)

      this.setState({
        showIntro: true,
        introOver: true
      })

      this._fakeGameEngine.startGame(60000)
      return
    }

    const onIntroEnd = () => {
      this.setState({
        introOver: true
      })
    }

    this._justLoadTmt = setTimeout(() => {
      hideLoader(true)
    }, 10000)

    this._onResize = _.throttle(() => {
      const { clientWidth, clientHeight } = this.refs.container
      const { intro } = this.refs

      if(!!intro) {
        intro.style.width = `${clientWidth}px`
        intro.style.height = `${clientHeight}px`
      }
    }, 200)

    this._onResize()
    window.addEventListener('resize', this._onResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._onResize)
  }

  render() {
    const { busy, showIntro, introOver } = this.state

    return (
      <div className={style.rootContainer}>
        <div ref="container" className={style.fakeGameContainer}>
          { !showIntro ? <Graph className={style.fakeGame} engine={this._fakeGameEngine} /> : null }

        </div>

        <div className={cn(style.loginContainer, showIntro ? style.leftSideLogin : null)}>
          <div className={style.loginForm}>
            <img src="/image/logo/logoh.svg" />
            <Button disabled={this.state.busy} href="/api/auth/steam" onClick={() => this.setState({ busy: true })} className={style.loginButton} large>Sign in with Steam</Button>
            <Button disabled={this.state.busy} href="/api/auth/opskins" onClick={() => this.setState({ busy: true })} className={[style.loginButton, style.opskinsLogin]} large>Sign in with Opskins</Button>
            <p>By signing in you agree that you have read and agree with our <Link target="_blank" to="/terms-of-use">Terms of Usage</Link></p>
          </div>
        </div>
      </div>
    )
  }
}

export default connect(
  ({ toggles }) => ({ toggles }),
)(LoginScreen)
