
import React, { Component } from 'react'
import cn from 'classnames'

import style from './style.scss'

export default class Progress extends Component {
  render() {
    const value = Math.min(100, Math.max(this.props.value || 0, 0))
    const width = `${value}%`

    const styles = {
      width: `${value}%`
    }

    if(value >= 100) {
      styles.background = '#8BC34A'
    }

    return (
      <div className={style.progress}>
        <div className={style.progressBar} style={styles}/>
      </div>
    )
  }
}
