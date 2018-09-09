
import React from 'react'
import pad from 'pad'
import _ from 'underscore'
import mojs, { Timeline, Tween, Burst, Shape } from 'mo-js'

import style from './style.scss'

const NumberGroup = ({ value, dim }) => {
  const idx = value !== '.' ? parseInt(value) * 100 : 1000

  return (
    <div className={style.numberGroupContainer}>
      <div className={style.numberGroup} style={{ opacity: dim ? 0.15 : 1, transform: `translate3d(0, -${idx}px, 0)` }}>
        <div>0</div>
        <div>1</div>
        <div>2</div>
        <div>3</div>
        <div>4</div>
        <div>5</div>
        <div>6</div>
        <div>7</div>
        <div>8</div>
        <div>9</div>
        <div>.</div>
      </div>
    </div>
  )
}

export default class GameTimer extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      value: 0
    }

    this._swirls = []
    this._replayStarsThrottled = _.throttle(::this._replayStars, 100)
  }

  componentDidMount() {
    const { container } = this.refs

    this._swirls.push(new mojs.ShapeSwirl({
      parent: container,
      shape: 'star',
      fill: '#E3B23C',
      y: { 0: -150 },
      radius: 'rand(10, 20)',
      degreeShift: 90,
      duration: 1000,
      swirlFrequency: 'rand(2,4)'
    }))

    this._swirls.push(new mojs.ShapeSwirl({
      parent: container,
      shape: 'star',
      fill: '#E3B23C',
      y: { 0: -150 },
      radius: 'rand(10, 20)',
      degreeShift: 30,
      duration: 1000,
      swirlFrequency: 'rand(2,4)'
    }))

    this._swirls.push(new mojs.ShapeSwirl({
      parent: container,
      shape: 'star',
      fill: '#E3B23C',
      x: -40,
      y: { 0: -150 },
      radius: 'rand(10, 20)',
      degreeShift: 30,
      duration: 1000,
      swirlFrequency: 'rand(2,4)'
    }))

    this._swirls.push(new mojs.ShapeSwirl({
      parent: container,
      shape: 'star',
      fill: '#E3B23C',
      y: { 0: 150 },
      radius: 'rand(10, 20)',
      degreeShift: 90,
      duration: 1000,
    }))

    this._swirls.push(new mojs.ShapeSwirl({
      parent: container,
      shape: 'star',
      fill: '#E3B23C',
      x: { 0: 150 },
      y: 0,
      radius: 'rand(10, 20)',
      degreeShift: 90,
      duration: 1000,
    }))

    this._swirls.push(new mojs.ShapeSwirl({
      parent: container,
      shape: 'star',
      fill: '#E3B23C',
      x: { 0: 50 },
      y: 0,
      radius: 'rand(10, 20)',
      degreeShift: 20,
      duration: 1000,
    }))
  }

  componentDidUpdate(prevProps, prevState) {
    if(prevProps.value !== this.props.value) {
      this._replayStarsThrottled()
    }
  }

  render() {
    const { value } = this.props

    let split = value.toFixed(2).toString().split('.')
    let text = pad(4, split[0], '0')

    if(split.length > 1) {
      text += `.${pad(split[1], 2, '0')}`
    }

    const parts = text.split('')

    return (
      <div ref="container" className={style.potValue}>
        {parts.map((v, i) =>
          <NumberGroup key={i} value={v} dim={i < 4 - split[0].length} />
        )}
      </div>
    )
  }

  _replayStars() {
    for(let swirl of this._swirls) {
      swirl.replay()
    }
  }
}
