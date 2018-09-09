
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'

import style from './style.scss'

export default ({ }) => {

  return (
    <div className={style.prizeProgress}>
      <div className={style.prize}>
        <img src={require('assets/image/gifts/upgradeGift.svg')} />
      </div>
      <div className={style.progressBar}>

      </div>
    </div>
  )
}
