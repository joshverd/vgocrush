
import React from 'react'
import cn from 'classnames'

import Button from 'components/Button'
import style from './style.scss'

export default (props) => (
  <div className={style.wrapper}>
    <div className={style.container}>
      <div className={style.header}>
        <div className={style.subText}>Collect as many raffle tickets as you can for a chance to win a magnificently beautiful prize on April 30th.</div>
      </div>

      <div className={style.list}>
        <div className={style.listItem}>
          <img src={require('assets/image/easter/yellowEgg.svg')} />
          <div>Claim one free raffle ticket every 24 hours</div>
        </div>

        <div className={style.listItem}>
          <img src={require('assets/image/easter/blueEgg.svg')} />
          <div>Receive another free raffle ticket simply by following our Twitter page</div>
        </div>

        <div className={style.listItem}>
          <img src={require('assets/image/easter/pinkEgg.svg')} />
          <div>Exchange your unused skins in return for shiny new raffle tickets</div>
        </div>
      </div>

      <Button large className={style.continueButton} onClick={props.onClose}>Continue</Button>
    </div>
  </div>
)
