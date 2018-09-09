
import React, { Component } from 'react'
import { Link } from 'react-router'

import style from './style.scss'

const pendingOfferStates = [ 'SENT', 'PENDING', 'WAITING_CONFIRMATION']

export default class Chat extends Component {
  constructor(props) {
    super(props)
  }

  render() {
    const { currentUser, pendingOffers } = this.props
    const pendingOffersCount = pendingOffers.filter(offer =>
      pendingOfferStates.indexOf(offer.state) >= 0 || offer.state === 'DECLINED' && offer.retry
    ).length

    return (
      <nav className={style.globalNav}>
        <div className={style.logo}>
          <img src="/logo.svg" />
        </div>

        { false ? <a onClick={this.props.toggleRaffle} className={style.active} href="#">April Raffle</a> : null }
        <Link className={style.active} to="/crash">Play</Link>
        { false ? <Link to="/jackpot" style={{ color: '#e3b23c' }}>Jackpot</Link> : null }
        <a href="#" onClick={this.props.toggleProvablyFairModal}>Provably Fair</a>
        <a href="#" onClick={::this._viewAccount}>Account { pendingOffersCount > 0 ? <span>{pendingOffersCount}</span> : null }</a>
        <a href="#" onClick={::this._viewSupport}>Support</a>
      </nav>
    )
  }

  _viewAccount(e) {
    e.preventDefault()
    this.props.toggleViewAccount()
  }

  _viewSupport(e) {
    e.preventDefault()
    this.props.toggleSupportModal()
  }
}

/*

<div className={style.pullRight}>
  <a href="#">English <i className="fa fa-chevron-down" /></a>
</div>

 */
