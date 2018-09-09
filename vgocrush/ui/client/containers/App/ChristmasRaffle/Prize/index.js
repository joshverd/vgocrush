
import React from 'react'
import cn from 'classnames'

import Snow from 'components/Christmas/Snow'
import style from './style.scss'

const easterEggs = {
  1: require('assets/image/easter/eggs/1.svg'),
  2: require('assets/image/easter/eggs/2.svg'),
  3: require('assets/image/easter/eggs/3.svg'),
  4: require('assets/image/easter/eggs/4.svg'),

  5: require('assets/image/easter/eggs/5.svg'),
  6: require('assets/image/easter/eggs/6.svg'),
  7: require('assets/image/easter/eggs/7.svg'),
  8: require('assets/image/easter/eggs/8.svg'),
  9: require('assets/image/easter/eggs/9.svg'),

  10: require('assets/image/easter/eggs/10.svg'),

  11: require('assets/image/easter/eggs/1.svg'),
  12: require('assets/image/easter/eggs/2.svg'),
  13: require('assets/image/easter/eggs/3.svg'),
  14: require('assets/image/easter/eggs/4.svg'),

  15: require('assets/image/easter/eggs/5.svg'),
  16: require('assets/image/easter/eggs/6.svg'),
  17: require('assets/image/easter/eggs/7.svg'),
  18: require('assets/image/easter/eggs/8.svg'),
  19: require('assets/image/easter/eggs/9.svg'),

  20: require('assets/image/easter/eggs/5.svg'),
  21: require('assets/image/easter/eggs/6.svg'),
  22: require('assets/image/easter/eggs/7.svg'),
  23: require('assets/image/easter/eggs/8.svg')
}

export default class Prize extends React.Component {
  render() {
    const { day, currentDay } = this.props

    const cl = cn(style.prize, {
      [style.past]: day.day < currentDay,
      [style.jackpot]: this.props.jackpot,
      [style.green]: day.day % 2 === 0
    })

    let giftImage = easterEggs[day.day] || easterEggs[1]

    // if(day.day < currentDay) {
    //   giftImage = require('../assets/empty.png')
    // }
    //
    // if(this.props.jackpot) {
    //   giftImage = require('../assets/jackpot.png')
    // }

    return (
      <div ref="container" className={cl} onClick={::this._onClick}>
        <img src={giftImage} />
        <div className={style.day}>{day.day}</div>
      </div>
    )
  }

  _giftImage() {
    const { day, currentDay } = this.props
    return easterEggs[day.day] || easterEggs[1]

    let giftImage = day.day % 2 === 0 ? require('../assets/giftGreen.png') : require('../assets/gift.png')

    if(day.day < currentDay) {
      giftImage = require('../assets/empty.png')
    }

    if(this.props.jackpot) {
      giftImage = require('../assets/jackpot.png')
    }

    return giftImage
  }

  _onClick(e) {
    const { day, currentDay } = this.props

    this.props.onClick({
      currentDay,
      day,

      paintInfo: {
        color: this.props.jackpot ? '#fcd449' : this.props.day.day % 2 === 0 ? '#4CAF50' : '#c62828',
        x: this.refs.container.offsetLeft,
        y: this.refs.container.offsetTop
      },

      giftImage: this._giftImage()
    })
  }
}
