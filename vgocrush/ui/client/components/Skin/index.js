
import React, { Component } from 'react'
import cn from 'classnames'
import numeral from 'numeral'
import { getItemPrice } from 'lib/items'

import Button from 'components/Button'
import style from './style.scss'

const giftTypes = {
  'gift': {
    image: require('./assets/gift.svg'),
  },

  'pink': {
    image: require('./assets/pink.svg'),
  },

  'upgrade': {
    image: require('./assets/upgradeGift.svg'),
  },

  'youtube': {
    image: require('./assets/youtubeGift.svg'),
  }
}

export default class Skin extends Component {

  constructor(props) {
    super(props)

    this.state = {}

    const { item } = props

    if(item.type === 'skin') {
      const split = item.cleanName.split('|')
      const type = split[1] || null

      this.state = {
        ...this.state,

        name: split[0],
        type: type || '',
        qualityColor: !!type ? item.qualityColor : null
      }
    }

    this._styles = {
      ...style,
      ...(props.customStyles || {})
    }
  }

  render() {
    const { item } = this.props

    if(!!item.type && item.type === 'gift') {
      return this._renderGift()
    }

    return this._renderSkin()
  }

  _renderGift() {
    const { item } = this.props

    const skinClass = cn(this._styles.skin, style.giftItem, {
      [this._styles.newSkin]: item._newItem
    })

    const giftType = giftTypes[item.wear || 'gift'] || giftTypes['gift']

    return (
      <div className={skinClass} onClick={::this._onClick}>
        <img className={style.giftImage} src={giftType.image} />
        <div className={this._styles.skinName}>{item.giftName || 'Gift Box'}</div>
        <div className={this._styles.skinType}>{item.name || ''}</div>
        <div className={this._styles.skinWear}>{item.shortDescription || ''}</div>
        <div className={this._styles.skinBorder} />

        <div className={style.actionButtonContainer}>
          <Button className={style.actionButton} primary>Open</Button>
        </div>
      </div>
    )
  }

  _renderSkin() {
    const { item, selected, customStyles, dim, disabled, mode } = this.props

    const skinClass = cn(this._styles.skin, {
      [this._styles.skinSelected]: selected,
      [this._styles.skinDimmed]: dim,
      [this._styles.skinDisabled]: disabled,
      [this._styles.newSkin]: item._newItem
    })

    return (
      <div className={skinClass} onClick={::this._onClick}>
        <div className={this._styles.skinPrice}>{numeral(getItemPrice(item, mode)).format('0,0.00')}</div>

        <div className={this._styles.skinImage}>
          <img src={item.iconUrl} />
          { disabled ? <div>IN USE</div> : null }
        </div>

        <Button className={this._styles.selectButton}>Select</Button>

        <div className={this._styles.skinCheckbox}><i className="fa fa-check" /></div>
        <div className={this._styles.skinName}>{ this.state.name }</div>
        <div className={this._styles.skinType} style={{ color: this.state.qualityColor }}>{ this.state.type }</div>
        { !false ? <div className={this._styles.skinWear}>{ item.wear }</div> : null }
        <div className={this._styles.skinBorder} style={{ borderColor: this.state.qualityColor }} />
      </div>
    )
  }

  _onClick(e) {
    e.preventDefault()

    if(this.props.disabled) {
      return
    }

    if(this.props.onClick) {
      this.props.onClick()
    }
  }
}
