
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'
import _ from 'underscore'

import { setTitle } from 'containers/App'
import socket from 'lib/socket'
import * as engine from 'lib/engine'
import { CRASH_DISABLED_NEXT_MESSAGE } from 'reducers/toggles/constants'
import style from './style.scss'

const XTICK_LABEL_OFFSET  = 25
const XTICK_MARK_LENGTH   = 2
const YTICK_LABEL_OFFSET  = 30
const YTICK_MARK_LENGTH   = 2

const negativeColor = '#fe3273'

jQuery.extend(jQuery.easing, {
  loaderEasing(x, t, b, c, d) {
    const ts=(t/=d)*t
    const tc=ts*t
    return b+c*(tc + -3*ts + 3*t);
  }
})

export default class Graph extends React.Component {

  constructor(props) {
    super(props)

    this._fpsDelay = 1000 / 60
    this._fpsStart = null
    this._fpsFrame = 1

    this._loaderStart = Date.now()
    this._engine = props.engine || engine
  }

  componentDidMount() {

    this._onResize = () => {
      const { container } = this.refs

      this._canvasWidth = container.clientWidth
      this._canvasHeight = container.clientHeight

      this._gradient = this._ctx.createLinearGradient(0, this._canvasHeight, this._canvasWidth, 0)
      this._gradient.addColorStop('0', '#fe3273')
      this._gradient.addColorStop('1.0', '#2779dd')

      this._configPlotSettings()
    }

    // Setup the chart
    const { canvas, container } = this.refs
    if(!canvas.getContext) {
      throw new Error('Cannot get canvas context')
    }

    this._ctx = canvas.getContext('2d')
    this._onResize()

    this._loaderAnimations  = []
    this._loaderPositions   = [ -250, -250, -250, -250 ]
    this._loaderIndex       = 0

    const startLoaderAnimation = loader => {
      if(loader > 4) {
        loader = 0
      }

      if(this._loaderAnimations[loader]) {
        this._loaderAnimations[loader].stop()
      }

      this._loaderPositions[loader] = -250

      const endValue = (loader % 2 === 0 ? this._canvasWidth : this._canvasHeight) + 250
      let nextStarted = false

      this._loaderAnimations[loader] = jQuery({
        value: this._loaderPositions[loader]
      }).animate({
        value: endValue
      }, {
        duration: 800,
        // easing: 'loaderEasing',
        step: value => {
          if(!this._rendering) {
            return
          }

          this._loaderPositions[loader] = value

          if(!nextStarted && value >= endValue - 250 - 400) {
            nextStarted = true
            setTimeout(() => startLoaderAnimation(loader + 1), 20)
          }
        }
      })
    }

    startLoaderAnimation(0)

    this._rendering = true

    this._updateTitle = () => {
      if(this._engine.gameState === 'Starting') {
        setTitle('Game Starting')
      } else if(this._engine.gameState === 'Over') {
        setTitle('Crashed at ' + numeral(this._engine.lastCrash).format('0,0.00') + 'x')
      } else if(this._engine.gameState === 'InProgress') {
        const payout = this._engine.calculateGamePayout(this._engine.getElapsedTimeWithLag())
        setTitle(numeral(payout).format('0,0.00') + 'x')
      }
    }

    this._onCrashInit = () => this._init()

    this._onCrashStart = () => {
      this._updateTitle()
      this._showLoaders(true)
    }

    this._onCrashStarting = () => {
      this._updateTitle()
      this._showLoaders(false)
    }

    this._onCrashEnd = ({ crashPoint }) => {
      this._updateTitle()
      this._showLoaders(false)
    }

    this._onCrashTick = () => {
      this._updateTitle()
    }

    this._engine.events.on('onCrashInit', this._onCrashInit)
    this._engine.events.on('onCrashStart', this._onCrashStart)
    this._engine.events.on('onCrashStarting', this._onCrashStarting)
    this._engine.events.on('onCrashEnd', this._onCrashEnd)
    this._engine.events.on('onCrashTick', this._onCrashTick)

    window.addEventListener('resize', this._onResize)

    this._animRequest = window.requestAnimationFrame(::this._renderGame)
  }

  componentWillUnmount() {
    this._rendering = false

    window.removeEventListener('resize', this._onResize)

    this._engine.events.removeListener('onCrashInit', this._onCrashInit)
    this._engine.events.removeListener('onCrashStart', this._onCrashStart)
    this._engine.events.removeListener('onCrashStarting', this._onCrashStarting)
    this._engine.events.removeListener('onCrashEnd', this._onCrashEnd)
    this._engine.events.removeListener('onCrashTick', this._onCrashTick)

    this._loaderAnimations.forEach(anim => anim.stop())
  }

  render() {
    const { disabled } = this.props

    return (
      <div ref="container" className={cn(style.currentGame, this.props.className, disabled && this._engine.gameState !== 'InProgress' ? style.disabled : null)}>
        <canvas ref="canvas" />

        { disabled && this._engine.gameState === 'InProgress' ? <div className={style.disabledInProgress}>{CRASH_DISABLED_NEXT_MESSAGE}</div> : null }
      </div>
    )
  }

  _init() {
    if(this._engine.gameState === 'InProgress') {
      this._showLoaders(true)
    } else {
      this._showLoaders(false)
    }

    this._updateTitle()
  }

  _renderGame(ts) {
    if(!this._rendering) {
      return
    }

    // if(this._fpsStart === null) {
      // this._fpsStart = ts
    // }

    // const seg = Math.floor((ts - this._fpsStart) / this._fpsDelay)

    // if (seg > this._fpsFrame) {
      // this._fpsFrame = seg

      this._calcGameData()
      this._calculatePlotValues()
      this._cleanChart()

      this._renderAxes()
      this._renderGraph()
      this._renderGameData()
      this._renderLoader()
    // }

    this._animRequest = window.requestAnimationFrame(::this._renderGame)
  }

  _renderLoader() {
    const ctx = this._ctx
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(47, 48, 63, 0.3)'
    ctx.setLineDash([ ])
    // ctx.font = '14px Circular,Roboto,Helvetica,Arial,sans-serif'
    // ctx.fillStyle = '#3b3c4a'
    // ctx.textAlign = 'center'

    if(this._engine.gameState === 'InProgress') {
      // ctx.setLineDash([ 15, 5 ])
      // ctx.strokeStyle = this._gradient
    } else if(this._engine.gameState === 'Over') {

    }

    ctx.beginPath()
    ctx.rect(0, 0, this._canvasWidth, this._canvasHeight)

    // if(this._engine.gameState === 'Over') {
    //   ctx.lineWidth = 4
    //   ctx.strokeStyle = !this._engine.wasBonusRound ? negativeColor : '#e4b23c'
    //   ctx.fillStyle = !this._engine.wasBonusRound ? 'rgba(253, 49, 115, 0.1)' : 'rgba(228, 178, 60, 0.1)'
    //   ctx.fill()
    // }

    // ctx.stroke()

    if(this._engine.gameState === 'InProgress') {
      ctx.beginPath()
      ctx.lineWidth = 5
      ctx.strokeStyle = this._gradient

      ctx.moveTo(this._loaderPositions[0], 0)
      ctx.lineTo(this._loaderPositions[0] + 250, 0)

      ctx.moveTo(this._canvasWidth, this._loaderPositions[1])
      ctx.lineTo(this._canvasWidth, this._loaderPositions[1] + 250)

      ctx.moveTo(this._canvasWidth - this._loaderPositions[2], this._canvasHeight)
      ctx.lineTo(this._canvasWidth - this._loaderPositions[2] + 250, this._canvasHeight)

      ctx.moveTo(0, this._canvasHeight - this._loaderPositions[3])
      ctx.lineTo(0, this._canvasHeight - this._loaderPositions[3] + 250)

      ctx.stroke()
    }
  }

  _renderAxes() {
    const ctx = this._ctx

    const stepValues = x => {
      console.assert(_.isFinite(x));

      let c = .4
      let r = .1

      while (true) {
        if (x <  c) {
          return r
        }

        c *= 5
        r *= 2

        if (x <  c) {
          return r
        }

        c *= 2
        r *= 5
      }
    }

    const sections = Math.ceil(this._canvasWidth / 35) * 2
    ctx.fillStyle = '#161725'

    // const startX = (typeof this._backgroundX === 'undefined' ? (-35 * 5) : this._backgroundX)
    //
    // for(let i = 0; i < sections; i++) {
    //   let x = startX + (i * 35)
    //
    //   if(i % 2 === 0) {
    //     ctx.fillRect(x, 0, 35, this._canvasHeight)
    //   }
    // }

    // this._backgroundX = startX + 0.2
    //
    // if(this._backgroundX >= 35) {
    //   this._backgroundX = (-35 * 5)
    // }

    // Calculate Y Axis
    this._YAxisPlotMaxValue = this._YAxisPlotMinValue
    this._payoutSeparation = stepValues(!this._currentGamePayout ? 1 : this._currentGamePayout)

    ctx.setLineDash([10, 6])

    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(47, 48, 63, 0.25)'
    ctx.font = '14px Circular,Roboto,Helvetica,Arial,sans-serif'
    ctx.fillStyle = '#3b3c4a'
    ctx.textAlign = 'center'

    if(this._engine.gameState === 'Over' && this._engine.lastCrash) {
      ctx.fillStyle = !this._engine.wasBonusRound ? negativeColor : '#e4b23c'
    }

    // Draw Y Axis Values
    const heightIncrement =  this._plotHeight / (this._YAxisPlotValue)

    for(let payout = this._payoutSeparation, i = 0; payout < this._YAxisPlotValue; payout+= this._payoutSeparation, i++) {
        let y = this._plotHeight - (payout * heightIncrement)
        ctx.fillText((payout + 1).toFixed(2) + 'x', 25, y)

        if(this._engine.gameState !== 'Starting' && this._engine.gameState !== 'NotStarted' && this._engine.gameState !== 'Over') {
          ctx.beginPath()
          ctx.moveTo(this._xStart, y - 1)
          ctx.lineTo(this._canvasWidth , y - 1)
          ctx.stroke()
        }

        if(i > 100) {
          console.log('For 3 too long')
          break
        }
    }

    // Calculate X Axis
    this._milisecondsSeparation = stepValues(this._XAxisPlotValue)
    this._XAxisValuesSeparation = this._plotWidth / (this._XAxisPlotValue / this._milisecondsSeparation)

    // Draw X Axis Values
    for(let miliseconds = 0, counter = 0, i = 0; miliseconds < this._XAxisPlotValue; miliseconds += this._milisecondsSeparation, counter++, i++) {
      let seconds = miliseconds / 1000
      let textWidth = ctx.measureText(seconds).width
      let x = (counter * this._XAxisValuesSeparation) + this._xStart

      ctx.fillText(seconds + 's', x - textWidth / 2, this._plotHeight + 30)

      if(i > 100) {
        console.log('For 4 too long')
        break
      }
    }

    // Draw background Axis
    if(this._engine.gameState !== 'Starting' && this._engine.gameState !== 'NotStarted' && this._engine.gameState !== 'Over') {
      ctx.lineWidth = 3
      ctx.beginPath()
      // ctx.moveTo(this._xStart, 0)
      ctx.moveTo(this._xStart, this._canvasHeight - this._yStart)
      ctx.lineTo(this._canvasWidth, this._canvasHeight - this._yStart)
      ctx.stroke()
    }
  }

  _showLoaders(visible) {
    // this._loaders.forEach(l => l.style.opacity = visible ? 1 : 0 )
    //
    // const endColor = (!visible && !!this._engine.lastCrash) ? (this._engine.lastCrash < 2 ? negativeColor : '#1b85e3') : null
    // this.refs.container.style.borderColor = endColor
    // this.refs.overlay.style.background = endColor
  }

  _renderGraph() {
    const ctx = this._ctx

    ctx.strokeStyle = this._gradient
    ctx.fillStyle = this._gradient
    ctx.lineWidth = 3
    ctx.setLineDash([ 20, 5 ])
    ctx.beginPath()

    for(let t = 0, i = 0; t <= this._currentTime; t += 100, i++) {
      let payout = this._engine.calculateGamePayout(t) - 1
      let y = this._plotHeight - (payout * this._heightIncrement)
      let x = t * this._widthIncrement

      ctx.lineTo(x + this._xStart, y)

      /* Avoid crashing the explorer if the cycle is infinite */
      if(i > 5000) {
        console.log('For 1 too long!')
        break
      }
    }

    ctx.stroke()
    ctx.closePath()
  }

  _calcGameData() {
    this._currentTime = this._engine.getElapsedTimeWithLag()
    this._currentGamePayout = this._engine.calculateGamePayout(this._currentTime)
  }

  _configPlotSettings() {
    const { canvas, container } = this.refs

    canvas.width = this._canvasWidth
    canvas.height = this._canvasHeight

    this._plotWidth = this._canvasWidth - 50
    this._plotHeight = this._canvasHeight - 45
    this._xStart = this._canvasWidth - this._plotWidth
    this._yStart = this._canvasHeight - this._plotHeight
    this._XAxisPlotMinValue = 1000
    this._YAxisSizeMultiplier = 1.5
   }

   _calculatePlotValues() {
      this._YAxisPlotMinValue = this._YAxisSizeMultiplier
      this._YAxisPlotValue = this._YAxisPlotMinValue
      this._XAxisPlotValue = this._XAxisPlotMinValue

      if(this._currentTime > this._XAxisPlotMinValue) {
        this._XAxisPlotValue = this._currentTime
      }

      // Adjust Y Plot's Axis
      if(this._currentGamePayout > this._YAxisPlotMinValue) {
        this._YAxisPlotValue = this._currentGamePayout
      }

      this._YAxisPlotValue -= 1

      // Graph values
      this._widthIncrement = this._plotWidth / this._XAxisPlotValue
      this._heightIncrement = this._plotHeight / (this._YAxisPlotValue)
      this._currentX = this._currentTime * this._widthIncrement
   }

  _renderGameData() {
    const ctx = this._ctx

    // One percent of canvas width
    const onePercent = this._canvasWidth / 100

    // const gradient = ctx.createLinearGradient(this._canvasWidth / 2 + 150, 0, 0, 0)
    // gradient.addColorStop('0', '#197adf')
    // gradient.addColorStop('1.0', '#fd2b69')

    ctx.fillStyle = '#3b3c4a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if(this._engine.gameState === 'NotStarted') {
      ctx.font = this._fontSizePx(8) + ' Circular,Roboto,Helvetica,Arial,sans-serif'
      ctx.fillText('Connecting', this._canvasWidth / 2, this._canvasHeight / 2)
    }

    if(this._engine.gameState === 'InProgress') {
      ctx.font = this._fontSizePx(14) + ' Verdana'
      ctx.fillStyle = '#cfd0d2'
      // ctx["font-weight"] = "900"
      ctx.fillText(parseFloat(this._currentGamePayout).toFixed(2) + 'x', this._canvasWidth / 2, this._canvasHeight / 2)
    }

    if(this._engine.gameState === 'Over' && !!this._engine.lastCrash) {
      ctx.font = this._fontSizePx(14) + ' Verdana'
      ctx.fillStyle = !this._engine.wasBonusRound ? negativeColor : '#e4b23c'
      ctx.fillText(parseFloat(this._engine.lastCrash).toFixed(2) + 'x', this._canvasWidth / 2, this._canvasHeight / 2)
    }

    if(this._engine.gameState === 'Starting') {
      const timeLeft = (this._engine.startTime.getTime() / 1000) - (Date.now() / 1000)

      ctx.font = this._fontSizePx(10) + ' Circular,Roboto,Helvetica,Arial,sans-serif'
      ctx.fillText(timeLeft <= -1.5 ? 'Starting game' : `${Math.max(0, timeLeft).toFixed(1)}s`, this._canvasWidth / 2, this._canvasHeight / 2)
    }
  }

  // Function to calculate the distance in semantic values between ticks. The
  // parameter s is the minimum tick separation and the function produces a
  // prettier value.
  _tickSeparation(s) {
    if (!Number.isFinite(s)) {
      throw new Error('Is not a number: ', s)
    }

    let r = 1
    while(true) {
      if (r > s) {
        return r
      }

      r *= 2

      if (r > s) {
        return r
      }

      r *= 5
    }
  }

  // Function to calculate the distance in semantic values between ticks. The
  // parameter s is the minimum tick separation and the function produces a
  // prettier value.
  _tickSeparation(s) {
    if (!Number.isFinite(s)) {
      throw new Error('Is not a number: ', s)
    }

    let r = 1
    while(true) {
      if (r > s) {
        return r
      }

      r *= 2

      if (r > s) {
        return r
      }

      r *= 5
    }
  }

  // Measure the em-Height by CSS hackery as height text measurement is not
  // available on most browsers. From:
  // https://galacticmilk.com/journal/2011/01/html5-typographic-metrics/#measure
  _getEmHeight(font) {
    const sp = document.createElement('span')
    sp.style.font = font
    sp.style.display = 'inline'
    sp.textContent = 'Hello world!'

    document.body.appendChild(sp)
    const emHeight = sp.offsetHeight
    document.body.removeChild(sp)
    return emHeight
  }

  // _fontSizeNum
  _fontSizeNum = times => times * this._canvasWidth / 100

  // _fontSizePx
  _fontSizePx = times => this._fontSizeNum(times).toFixed(2) + 'px'

  // _trX
  _trX = t => this._XScale * (t - this._XTimeBeg)

  // _trY
  _trY = p => - (this._YScale * (p - this._YPayoutBeg))

  // _cleanChart
  _cleanChart = () => this._ctx.clearRect(0, 0, this._canvasWidth, this._canvasHeight)

  // _growthFunc
  static _growthFunc = ms => Math.pow(Math.E, 0.00006 * ms)
}
