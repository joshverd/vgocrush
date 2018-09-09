
import React from 'react'
import cn from 'classnames'

import { CRASH_DISABLED_MESSAGE } from 'reducers/toggles/constants'
import style from './style.scss'

export default ({ disabled }) => {
  if(!disabled) {
    return null
  }

  return (
    <div className={style.container}>
      <div><i className="fa fa-warning-sign" /> { CRASH_DISABLED_MESSAGE }</div>
    </div>
  )
}
