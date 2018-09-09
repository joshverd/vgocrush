
import React, { Component } from 'react'
import cn from 'classnames'

import style from './style.scss'

export default class Spinner extends Component {
  render() {
    const spinnerContainerClass = cn(style.spinnerContainer)
    const spinnerClass = cn(style.spinner)

    return (
      <div className={spinnerContainerClass}>
        <div className={spinnerClass}>
          { this.props.text || '' }
          <div className={style.spinnerLine} />
          <div className={style.spinnerLineTrack} />
        </div>
      </div>
    )
  }
}
