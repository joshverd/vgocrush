
import React, { Component } from 'react'
import cn from 'classnames'

import style from './style.scss'

export default class Segment extends Component {
  render() {
    const cl = cn(style.segment, this.props.className)

    return (
      <div className={cl}>{this.props.children}</div>
    )
  }
}
