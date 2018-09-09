
import React from 'react'
import cn from 'classnames'
import mojs, { Timeline, Tween, Burst, Shape } from 'mo-js'

import { tickSound } from 'lib/sound'
import Button from 'components/Button'
import style from './style.scss'

export default class BetBlock extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      sniperElite3: false
    }

    this._timeline = new Timeline()
  }

  componentDidMount() {
    const button = this.refs.button.children[0]

    this._timeline.add(new mojs.Shape({
			parent: button,
			duration: 750,
			type: 'circle',
			radius: {0: 40},
			fill: 'transparent',
			stroke: '#E3B23C',
			strokeWidth: {35:0},
			opacity: 0.2,
			top: '45%',
			easing: mojs.easing.bezier(0, 1, 0.5, 1)
		}))

    this._timeline.add(new mojs.Shape({
			parent: button,
      duration: 500,
      delay: 100,
      type: 'circle',
      radius: {0: 20},
      fill: 'transparent',
      stroke: '#E3B23C',
      strokeWidth: {5:0},
      opacity: 0.2,
      x : 40,
      y : -60,
      easing: mojs.easing.sin.out
		}))

    this._timeline.add(new mojs.Shape({
			parent: button,
      duration: 500,
      delay: 180,
      type: 'circle',
      radius: {0: 10},
      fill: 'transparent',
      stroke: '#E3B23C',
      strokeWidth: {5:0},
      opacity: 0.5,
      x: -10,
      y: -80,
      isRunLess: true,
      easing: mojs.easing.sin.out
		}))

    this._timeline.add(new mojs.Shape({
			parent: button,
      duration: 800,
      delay: 240,
      type: 'circle',
      radius: {0: 20},
      fill: 'transparent',
      stroke: '#E3B23C',
      strokeWidth: {5:0},
      opacity: 0.3,
      x: -70,
      y: -10,
      easing: mojs.easing.sin.out
		}))
  }

  render() {
    const { busy } = this.props
    const { sniperElite3 } = this.state

    return (
      <div ref="button" className={style.container}>
        <Button disabled={busy} className={cn(style.depositButton, sniperElite3 ? style.snipeButton : null)} onClick={::this._onClick} large>
          { !sniperElite3 ? <img src={require('assets/image/weapons/awp.svg')} /> : <img src={require('assets/image/weapons/awp.svg')} /> }
          { !sniperElite3 ? 'Insert Skins' : 'Snipe!' }
        </Button>
      </div>
    )
  }

  _onClick() {
    tickSound.play()
    this.props.onClick()
  }
}
