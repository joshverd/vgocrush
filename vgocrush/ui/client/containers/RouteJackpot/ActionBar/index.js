
import React from 'react'
import { Link } from 'react-router'
import cn from 'classnames'

import { tickSound } from 'lib/sound'
import style from './style.scss'

export default class ActionBar extends React.Component {
  render() {
    const { gameMode, disabled } = this.props

    return (
      <div className={cn(style.container, disabled ? style.disabled : null)}>
        <a href="#" className={cn(gameMode !== 'Small' ? style.active : null)} onClick={e => this._onClick(e, 'Classic')}>Classic</a>
        <a href="#" className={cn(gameMode === 'Small' ? style.active : null)} onClick={e => this._onClick(e, 'Small')}>Small</a>
      </div>
    )
  }

  _onClick(e, gameMode) {
    e.preventDefault()

    if(this.props.disabled) {
      return
    }

    tickSound.play()
    this.props.onChange(gameMode)
  }
}
