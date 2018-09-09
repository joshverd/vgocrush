
import React, { Component } from 'react'
import { connect } from 'react-redux'
import cn from 'classnames'
import { toast } from 'react-toastify'
import moment from 'moment'
import numeral from 'numeral'

import Button from 'components/Button'
import api from 'lib/api'
import { updateCurrentUser } from 'reducers/currentUser/actions'
import Tabs from 'components/Tabs'
import CrashGameModal from 'components/CrashGameModal'
import socket from 'lib/socket'

import Spinner from '../Spinner'
import Modal from '../Modal'

import Offer from './Offer'
import style from './style.scss'

const pendingOfferStates = [ 'QUEUED', 'SENT', 'PENDING', 'WAITING_CONFIRMATION']

class TradeUrlModal extends Component {
  constructor(props) {
    super(props)

    this.state = this._getInitialState(props)
  }

  _getInitialState(props = {}) {
    props = { ...this.props, ...props }

    return {
      busy: false,
      data: [],
      deposits: [],
      tradeUrl: !!props.currentUser ? props.currentUser.tradeUrl : '',
      selectedTab: 'bets',
      promoCode: ''
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.visible !== prevProps.visible) {
      this.setState(this._getInitialState())

      const selectedTab = !!this.props.selectedTab ? this.props.selectedTab : this.state.selectedTab
      this._onTabChange(selectedTab)
    }
  }

  render() {
    const { busy } = this.state

    const selectedTab = !!this.props.selectedTab ? this.props.selectedTab : this.state.selectedTab

    const pendingOffers = this.props.pendingOffers || []
    const pendingOffersCount = pendingOffers.filter(offer =>
      pendingOfferStates.indexOf(offer.state) >= 0 || offer.state === 'DECLINED' && offer.retry
    ).length

    return (
      <Modal
        dialogClass={style.settingsDialog}
        visible={this.props.visible}
        onClose={this.props.onClose}
        tabs={[{ key: 'bets', name: 'Bet History' }, { key: 'withdraws', name: 'Withdrawals', count: pendingOffersCount }, { key: 'deposits', name: 'Deposits' }]}
        selectedTab={selectedTab}
        onTabChange={::this._onTabChange}>
        {this._renderTab()}
      </Modal>
    )
  }

  _renderTab() {
    const { busy, tradeUrl, data, promoCode } = this.state
    const { pendingOffers } = this.props

    const selectedTab = !!this.props.selectedTab ? this.props.selectedTab : this.state.selectedTab

    if(selectedTab === 'settings') {
      return (
        <div>
          <h3>Trade URL<div>You can find your current Steam trade offer url <a target="_blank" href="https://steamcommunity.com/id/me/tradeoffers/privacy#trade_offer_access_url">here</a></div></h3>
          <input disabled={busy} name="tradeUrl" type="text" autoComplete="off" placeholder="https://steamcommunity.com/tradeoffer/new/?partner=1234567&token=abcdefg" value={tradeUrl} onChange={e => this.setState({ tradeUrl: e.target.value })} autoFocus />

          <div className={style.footer}>
            { !busy ? <Button disabled={busy} large rounded secondary onClick={::this._close}>Cancel</Button> : null }
            { !busy ? <Button disabled={busy} large rounded primary onClick={::this._onSave}>Save</Button> : <Spinner /> }
          </div>
        </div>
      )
    }

    if(selectedTab === 'bets') {
      return (
        <div>
          <table>
            <thead>
              <tr>
                <td width="15%"></td>
                <td width="20%">Date</td>
                <td width="20%">Profit</td>
                <td width="10%">@</td>
                <td style={{ opacity: 0.5 }}>Skins</td>
              </tr>
            </thead>
            <tbody>
              {data.map(game =>
                <tr key={game.id} className={game.status !== 'cashed_out' ? style.lost : null }>
                  <td><a href="#" onClick={e => this._viewGame(e, game)}>View</a></td>
                  <td>{moment(game.createdAt).format('MMM DD, YYYY')}</td>
                  <td>{game.status !== 'cashed_out' ? '-' : ''}{numeral(game.itemsTotal).format('0,0.00')}</td>
                  <td>{game.status === 'cashed_out' ? (game.stoppedAt / 100).toFixed(2) + 'x' : '-'}</td>
                  <td style={{ opacity: 0.5 }}><small>{game.itemNames.join(', ')}</small></td>
                </tr>
              )}
            </tbody>
          </table>
          <div className={style.footer}>
             { !busy ? <Button disabled={busy} primary large rounded onClick={::this._refreshBets}>Refresh</Button> : <Spinner /> }
          </div>

          <CrashGameModal visible={!!this.state.viewGame} game={this.state.viewGame} onClose={() => this.setState({ viewGame: null })}/>
        </div>
      )
    } else if(selectedTab === 'withdraws') {
      // return (
      //   <div className={style.offers}>
      //     <Offer />
      //     <Offer />
      //     <Offer />
      //   </div>
      // )

      return (
        <div>
          <table>
            <thead>
              <tr>
                <td width="15%"></td>
                <td width="20%">Date</td>
                <td width="15%">Subtotal</td>
                <td>Details</td>
              </tr>
            </thead>
            <tbody>
              { !pendingOffers.length ? <tr><td colSpan="4">Nothing to display</td></tr> : null }
              { pendingOffers.map(offer =>
                <tr key={offer.id} style={{ opacity: (offer.state === 'ERROR' || offer.state === 'DECLINED') && !offer.retry ? 0.5 : null }}>
                  <td>{ offer.state !== 'SENT' ? offer.state === 'DECLINED' && offer.retry ? <a href="#" onClick={e => this._retryOffer(e, offer.id)}><i className="fa fa-refresh" /> Retry</a> : offer.state : <a href="https://trade.opskins.com/trade-offers" target="_blank"><i className="fa fa-external-link" /> {offer.state}</a> }</td>
                  <td>{moment(offer.createdAt).format('MMM DD, YYYY')}</td>
                  <td>{numeral(offer.subtotal).format('0,0.00')}</td>
                  <td>
                    { offer.itemNames.join(', ') }
                    { offer.unavailableItemNames.length > 0 ?
                      <div style={{ color: '#e91e63' }}>{offer.unavailableItemNames.join(', ')} currently out of stock</div> : null }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )
    } else if(selectedTab === 'deposits') {
      const baseOpacity = this.state.deposits.filter(o => o.state !== 'ACCEPTED' && o.state !== 'DECLINED').length > 0 ? 0.3 : null

      return (
        <div>
        <table>
          <thead>
            <tr>
              <th width="10%">Date</th>
              <th width="10%">State</th>
              <th width="10%">Subtotal</th>
              <th>Details</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {this.state.deposits.map((o, i) =>
              <tr key={i} style={{ opacity: o.state !== 'ACCEPTED' && o.state !== 'DECLINED' ? 1 : baseOpacity }}>
                <td>{moment(o.createdAt).format('MM/DD/YYYY')}</td>
                <td>{o.state !== 'SENT' ? o.state : <a href={o.tradeOfferUrl} target="_blank"><i className="fa fa-external-link" /> {o.state}</a>}</td>
                <td>{numeral(o.amount).format('0,0.00')}</td>
                <td>{o.details || ''}{ o.state === 'DECLINED' && !!o.error ? <div className={style.error}><i className="fa fa-warning" /> {o.error}</div> : null }</td>
              </tr>
            )}
          </tbody>
        </table>

          <div className={style.footer}>
            { !busy ? <Button disabled={busy} primary large rounded onClick={::this._refreshDeposits}>Refresh</Button> : <Spinner /> }
          </div>
        </div>
      )
    } else if(selectedTab === 'promotion') {
      return (
        <div className={style.promotion}>
          <div className={style.promotionContainer}>
            <h1>Redeem Code<div>Enter a promotion code below to redeem a prize</div></h1>
            <input disabled={busy} value={promoCode} onChange={e => this.setState({ promoCode: e.target.value })} type="text" placeholder="Code" autoFocus />
            <Button disabled={busy || !promoCode.length} primary large rounded onClick={::this._onRedeemCode}>Redeem</Button>
          </div>
        </div>
      )
    }
  }

  _onRedeemCode() {
    this.setState({
      busy: true
    })

    api('promotions/redeem/' + this.state.promoCode, { method: 'POST' }).then(() => {
      this.setState({
        busy: false
      })

      this._close()
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _retryOffer(e, id) {
    e.preventDefault()

    api('users/retryOffer', {
      body: {
        id
      }
    })

    .then(() => {
      toast('Retrying offer, please wait a couple moments')
    })
  }

  _viewGame(e, game) {
    e.preventDefault()

    this.setState({
      busy: true
    })

    socket.emit('getCrash', { hash: game.hash }, ({ currentGame, players }) => {
      this.setState({
        viewGame: {
          ...currentGame,
          players: players.sort((a, b) => b.wagerTotal - a.wagerTotal),
        },

        busy: false
      })
    })
  }

  _onTabChange(selectedTab) {
    this.setState({ selectedTab })

    if(selectedTab === 'bets') {
      this._refreshBets()
    } else if(selectedTab === 'deposits') {
      this._refreshDeposits()
    }

    if(!!this.props.onTabChange) {
      this.props.onTabChange(selectedTab)
    }
  }

  _close(updated = {}) {
    if(this.props.onClose) {
      this.props.onClose(updated)
    }
  }

  _onSave() {
    this.setState({
      busy: true
    })

    api('users/update', {
      body: {
        tradeUrl: this.state.tradeUrl
      }
    })

    .then(() => {
      this.props.dispatch(updateCurrentUser({ tradeUrl: this.state.tradeUrl }))
      this._close(true)
      toast('Settings have been updated!')
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _refreshBets() {
    this.setState({
      busy: true
    })

    api('crash/bets').then(data =>
      this.setState({
        data,

        busy: false
      })
    )
  }

  _refreshDeposits() {
    this.setState({
      busy: true
    })

    api('users/deposits').then(data =>
      this.setState({
        deposits: data.history,

        busy: false
      })
    )
  }
}

export default connect(
  ({ currentUser, pendingOffers }) => ({ currentUser, pendingOffers }),
)(TradeUrlModal)
