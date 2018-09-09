import React from 'react'

import Button from 'components/Button'
import style from './style.scss'

export default class CurrentUpgrade extends React.Component {
  render() {
    return (
      <div className={style.container}>
        <div className={style.itemsContainer}>
          <div className={style.emptyBetText}>Select skins from your inventory you would like to upgrade</div>
        </div>
        <div className={style.controlsContainer}>
          <Button>Begin Upgrade</Button>
        </div>
      </div>
    )
  }
}
