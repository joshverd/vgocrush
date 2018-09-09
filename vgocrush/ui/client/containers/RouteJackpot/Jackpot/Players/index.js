
import React from 'react'

import Progress from 'components/Progress'
import style from './style.scss'

export default class GameTimer extends React.Component {
  render() {
    const { chances } = this.props

    return (
      <div className={style.container}>
        {chances.map(c =>
          <div key={c.player.id} className={style.player} style={{ borderBottomColor: c.player.color }}>
            <img src={c.player.avatar} />
            <div className={style.chance}>{(c.chance * 100).toFixed(2)}%</div>
          </div>
        )}
      </div>
    )
  }
}
