
import React, { Component } from 'react'
import cn from 'classnames'

import style from './style.scss'

export default class Button extends Component {
  render() {
    const buttonClass = cn(style.button, this.props.className, {
      [style.small]: this.props.small,
      [style.large]: this.props.large,

      [style.primary]: this.props.primary,
      [style.secondary]: this.props.secondary,
      
      [style.rounded]: this.props.rounded
    })

    return (
      <button onClick={::this._onClick} disabled={this.props.disabled} className={buttonClass}>{this.props.children}</button>
    )
  }

  _onClick(e) {
    if(this.props.href) {
      window.open(this.props.href, this.props.target || '_self')
    } else {
      e.preventDefault()
    }

    if(this.props.onClick) {
      this.props.onClick()
    }
  }
}
