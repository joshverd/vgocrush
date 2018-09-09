
import React from 'react'
import mojs, { Timeline, Tween, Burst, Shape } from 'mo-js'

import Sound from 'lib/sound'
import style from './style.css'

// const removeSound = new Sound(require('assets/sound/clickLow.wav'))
// const clickSound = new Sound(require('assets/sound/clickHigh.wav'))

export default class BetItem extends React.Component {

  componentDidMount() {
    const { item, image } = this.refs

    this._timeline = new Timeline()

    // this._timeline.add(new mojs.Burst({
		// 	parent: item,
		// 	radius: { 0: 60 },
		// 	count: 4,
		// 	children: {
    //     shape: 'star',
		// 		fill: this.props.item.qualityColor,
		// 		opacity: 0.5,
		// 		radius: 25,
		// 		duration: 2200,
		// 		easing: mojs.easing.bezier(0.1, 1, 0.3, 1)
		// 	}
		// }))

    // this._timeline.add(new mojs.Shape({
		// 	parent: item,
		// 	shape: 'heart',
		// 	radius: { 25: 0 },
		// 	fill: this.props.item.qualityColor,
		// 	stroke: this.props.item.qualityColor,
		// 	strokeWidth: { 5:0 },
		// 	opacity: 0.5,
		// 	duration: 1200,
		// 	easing: mojs.easing.sin.out
		// }))

    this._timeline.add(new mojs.Shape({
			parent: item,
			type: 'circle',
			radius: { 0: 50 },
			fill: 'transparent',
			stroke: '#f62f6d',
			strokeWidth: { 5:0 },
			opacity: 0.3,
			duration: 700,
			easing: mojs.easing.sin.out
		}))

    this._timeline.add(new Tween({
      duration: 1200,
      onUpdate: (progress) => {
        if(progress > 0.3) {
          const elasticOutProgress = mojs.easing.elastic.out(1.43 * progress - 0.43)
          image.style.WebkitTransform = image.style.transform = 'scale3d(' + elasticOutProgress + ', ' + elasticOutProgress + ', 1)'
        } else {
          image.style.WebkitTransform = image.style.transform = 'scale3d(0,0,1)'
        }

        item.style.opacity = progress
      }
    }))

    this._timeline.replay()
  }

  render() {
    const { item, compact } = this.props
    const split = item.name.split('|')

    return (
      <div ref="item" className={style.item}>
        <img className={style.itemImage} ref="image" src={item.iconUrl} />
        { !compact ? <div className={style.itemName}>{split[0]}</div> : null }
        { !compact ? <div className={style.itemType} style={{ color: item.qualityColor }}>{ split[1] || '' }</div> : null }
        { !compact ? <div className={style.itemWear}>{ item.wear || '' }</div> : null }
      </div>
    )
  }
}
