
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'

import AnimatedCount from 'components/AnimatedCount'
import Spinner from 'components/Spinner'
import style from './style.scss'

export function CashoutArrow({ player }) {
  return (
    <div className={style.upgradeWin}>
      <img className={style.upgradeArrow} src={require('assets/image/upgradeArrow.svg')} />
      <div className={style.upgradeCashout}>{numeral(player.stoppedAt / 100).format('0,0.00')}x</div>
    </div>
  )
}

export default ({ player, gameState, styles, bonusRound }) => {
  const lost = gameState === 'Over' && player.status !== 'cashed_out'

  return (
    <div className={cn(style.container, { [style.cashedOut]: player.status === 'cashed_out', [style.lost]: lost, [style.bonusRound]: bonusRound })} style={styles}>
      <div className={style.player}>
        <img src={player.avatarFull} />
        <div><span>{player.name}</span></div>
      </div>
      <div className={style.upgrade}>
        <div className={style.betItems}>
          <div className={style.itemsPrice}><AnimatedCount format="0,0.00" value={player.wagerTotal} /></div>
          {player.wagerItems.map((item, i) => <img key={i} src={item.iconUrl} />)}
        </div>

        { player.status === 'cashed_out' || lost ? <div className={style.upgradeDivider}>
          { player.status === 'cashed_out' ? <CashoutArrow player={player} /> : null }
        </div> : null }

        { player.status === 'cashed_out' ? <div className={style.upgradedItems}>
          <div className={style.itemsPrice}><AnimatedCount format="0,0.00" value={player.stoppedAtItemsTotal} /></div>
          {player.stoppedAtItems.slice(0, 1).map((item, i) => <img key={i} src={item.iconUrl} />)}
          <div className={style.subItems}>
            {player.stoppedAtItems.slice(1, 3).map((item, i) => <img key={i} src={item.iconUrl} />)}
          </div>
        </div> : null }

        { bonusRound ? <div className={style.bonusItems}>
          <img src={require('assets/image/gifts/upgradeGift.svg')} />
        </div> : null }

      </div>
    </div>
  )
}
