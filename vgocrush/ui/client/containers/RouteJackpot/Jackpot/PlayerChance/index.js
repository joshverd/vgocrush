
import React from 'react'

import style from './style.scss'

export default class PlayerChance extends React.Component {
  render() {

    return (
      <div className={style.container}>You currently have a {this.props.chance}% chance at winning</div>
    )
  }
}
