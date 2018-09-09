
import React from 'react'

import Button from 'components/Button'
import style from './style.scss'

export default class Offer extends React.Component {
  render() {
    return (
      <div className={style.offer}>
        <div className={style.header}>
          <div className={style.state}>QUEUED</div>
          <div className={style.price}>$50.00</div>
        </div>

        <div className={style.list}>
          <div>Gamma Case 2</div>
          <div>Gamma Case 2</div>
          <div>Gamma Case 2</div>
          <div>Gamma Case 2</div>
          <div>Gamma Case 2</div>
        </div>

        <Button secondary>Retry</Button>
      </div>
    )
  }
}
