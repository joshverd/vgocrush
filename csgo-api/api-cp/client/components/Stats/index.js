
import React from 'react'
import style from './style.css'

export default ({ children }) => {
  return (
    <div className={style.stats}>
      {children}
    </div>
  )
}

export function Stat ({ name, value }) {
  return (
    <div className={style.stat}>
      <div className={style.statValue}>{value}</div>
      <div className={style.statName}>{name}</div>
    </div>
  )
}
