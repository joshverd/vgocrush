
import React from 'react'
import cn from 'classnames'

import style from './style.scss'

const snowFlakes = Array.from({ length: 10 }, (_, i) => style[`snowFlake${i + 1}`])

export default class Snow extends React.Component {
  render() {
    return (
      <div className={style.container}>
        {snowFlakes.map((className, i) =>
          <div key={i} className={cn(style.snow, className)} />
        )}
      </div>
    )
  }
}
