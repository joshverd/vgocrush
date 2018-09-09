
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'

import style from './style.css'

export default ({ cashout, className }) => {

  return (
    <div className={cn(style.upgradeWin, className)}>
      <img className={style.upgradeArrow} src={require('assets/image/upgradeArrowWhite.svg')} />
      <div className={style.upgradeCashout}>{numeral(cashout).format('0,0.00')}x</div>
    </div>
  )
}
