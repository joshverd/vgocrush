
import React, { Component } from 'react'
import style from './style.css'

export default class Notification extends Component {

  constructor(props) {
    super(props)
  }

  render() {
    return (
      <div className={style.notification}>{this.props.children}</div>
    )
  }
}
