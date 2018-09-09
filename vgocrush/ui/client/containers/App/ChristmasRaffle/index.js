
import React from 'react'
import numeral from 'numeral'
import moment from 'moment'
import _ from 'underscore'
import { toast } from 'react-toastify'

import Modal from 'components/Modal'
import Button from 'components/Button'
import Spinner from 'components/Spinner'
// import Snow from 'components/Christmas/Snow'
import SkinSelectModal from 'components/SkinSelectModal'

import api from 'lib/api'

import Countdown from './Countdown'
import Prize from './Prize'
import PrizeInfo from './PrizeInfo'
import HowToPlay from './HowToPlay'
import Sparkles from './Sparkles'

import style from './style.scss'

export default class ChristmasRaffle extends React.Component {
  constructor(props) {
    super(props)

    let hideRaffleHelp = false

    try {
      hideRaffleHelp = !!localStorage.hideRaffleHelp
    } catch(e) {
    }

    this.state = {
      loading: true,
      busy: false,
      raffle: null,
      showPurchase: false,
      showPrizeInfo: null,
      showHelp: !hideRaffleHelp,
      exchangeSkins: [],

      verifying: false
    }
  }

  componentDidMount() {
    if(this.props.visible) {
      this._load()
    }
  }

  componentWillUnmount() {
    if(this._interval) {
      clearInterval(this._interval)
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.visible !== prevProps.visible) {
      if(this.props.visible) {
        this._load()
      }
    }
  }

  render() {
    const { loading, raffle, showPrizeInfo, busy, exchangeSkins } = this.state
    const exchangeSkinsTotal = exchangeSkins.reduce((t, s) => t + s.price, 0)

    return (
      <div>
        <Modal visible={this.props.visible} onClose={this.props.onClose} className={style.modal} dialogClass={style.modalDialog}>

          { loading ? <div className={style.loading}>
            <Spinner text="Loading Raffle" />
          </div> : null }

          { !loading ? <div className={style.raffleContainer}>
            { this.state.showHelp ? <HowToPlay onClose={::this._hideHelp} /> : null }

            <div className={style.header} style={{ marginBottom: 25 }}>
              <img src={require('assets/image/easter/eggs.svg')} />
              <img src={require('assets/image/easter/eggs.svg')} />
            </div>

            <div className={style.prizesContainer}>
              { !!showPrizeInfo ? <PrizeInfo {...showPrizeInfo}
                key={showPrizeInfo.type || 'prizeInfo'}
                raffle={raffle}
                onClose={() => this.setState({ showPrizeInfo: null })}
                showTickets={::this._showMyTickets} /> : null }

              <div className={style.prizes}>
                {raffle.days.map(day =>
                  <Prize key={day.day}
                    jackpot={day.day === raffle.days.length}
                    day={day} currentDay={raffle.currentDay}
                    onClick={showPrizeInfo => this.setState({ showPrizeInfo })} />
                )}
              </div>
            </div>

            <div className={style.footer}>
              <div className={style.controls}>
                <Countdown raffle={raffle} />

                <div className={style.actions}>
                  <Button disabled={!raffle.tickets.length} className={style.actionButton} onClick={::this._showMyTickets}>My Tickets<div>{numeral(raffle.tickets.length).format('0,0')}</div></Button>
                  { !raffle.winnersChosen ? <Button disabled={this.state.showPurchase} className={style.actionButton} onClick={::this._showBuyTickets}>Buy more tickets</Button> : null }
                  <Button className={style.actionButton} onClick={::this._showPrizePayouts}>Prize Payouts</Button>
                </div>
              </div>

              <div className={style.twitterReward} style={{ opacity: this.state.verifying ? 0.4 : 1 }}>
                { false && !this.props.currentUser.claimedTwitterFollow ? <div>Follow our Twitter <a href="http://twitter.com" target="_blank">Twitter</a> and then click <a href="#" onClick={::this._verifyTwitter}>here</a> for a free raffle ticket!</div> : null }
              </div>
            </div>
          </div> : null }

          { false ? <div className={style.header}>
            <img src={require('assets/image/easter/eggs.svg')} />
            <div></div>
            <img src={require('assets/image/easter/eggs.svg')} />
          </div> : null }

        </Modal>

        <SkinSelectModal
          visible={this.state.showPurchase}
          onClose={() => this.setState({ exchangeSkins: [], showPurchase: false })}
          skins={this.props.playerInventory.filter(i => i.type === 'skin' && i.state === 'AVAILABLE')}
          onSelect={::this._onToggleExchangeSkin}
          selected={_.pluck(exchangeSkins, 'id')}
          disabledMode={true}
          modalOptions={{
            title: 'Purchase Tickets',
            subTitle: 'Exchange any of your eligible skins below for extra jackpot tickets',
            header: !busy ? <Button disabled={busy || exchangeSkinsTotal < 1} onClick={::this._exchangeSkins} primary>{exchangeSkinsTotal < 1 ? 'Exchange Skins' : `Exchange for ${numeral(Math.floor(exchangeSkinsTotal)).format('0,0')} ticket(s)`}</Button> : <Spinner text="Exchanging" />
          }}
          defaultSortDesc={true} />
      </div>
    )
  }

  _verifyTwitter(e) {
    e.preventDefault()

    const { verifying } = this.state

    if(verifying) {
      return
    }

    this.setState({
      verifying: true
    })

    api('users/reward', { body: { type: 'twitter' } })

    .then(({ url }) => {
      window.location = url
    })

    .catch(err => {
      this.setState({
        verifying: false
      })
    })
  }

  _hideHelp() {
    try {
      localStorage.hideRaffleHelp = true
    } catch(e) {
    }

    this.setState({
      showHelp: false
    })
  }

  _onToggleExchangeSkin(exchangeSkin) {
    let { exchangeSkins } = this.state
    let idx = _.findIndex(exchangeSkins, s => s.id === exchangeSkin.id)

    if(idx >= 0) {
      exchangeSkins.splice(idx, 1)
    } else {
      exchangeSkins.push(exchangeSkin)
    }

    this.setState({
      exchangeSkins
    })
  }

  _tick() {
    const { raffle } = this.state

    const now = moment()
    const currentDay = raffle.days.reduce((c, d) => {
      const mmt = moment(d.startsAt)

      return now.isAfter(mmt) || now.isSame(mmt) ? d.day : c
    }, 1)

    const update = {}

    if(currentDay !== raffle.currentDay) {
      update.currentDay = currentDay
    }

    if(Object.keys(update).length > 0) {
      this.setState({
        raffle: {
          ...raffle,
          ...update
        }
      })
    }
  }

  _load() {
    this.setState({
      loading: true
    })

    api('raffles/april18').then(raffle => {
      this.setState({
        raffle,
        busy: false,
        exchangeSkins: [],
        showPrizeInfo: raffle.winnersChosen ? {
          type: 'payouts',
          paintInfo: {
            color: '#4CAF50'
          },
          winnersChosen: true
        } : null,
        loading: false,

      })

      if(this.props.currentUser.sessionFlashes.twitterFollowed) {
        this._showMyTickets()
      }

      this._interval = setInterval(() => this._tick(), 1000)
    })
  }

  _showMyTickets(tickets = []) {

    this.setState({
      showPurchase: false,
      busy: false,

      raffle: {
        ...this.state.raffle,
        tickets: _.sortBy(tickets.concat(this.state.raffle.tickets), 'ticketNumber').reverse(),
        claimedDays: this.state.raffle.claimedDays.concat(_.pluck(tickets, 'day'))
      },

      showPrizeInfo: {
        type: 'tickets',
        paintInfo: {
          color: '#474761'
        }
      }
    })
  }

  _showPrizePayouts() {
    this.setState({
      showPrizeInfo: {
        type: 'payouts',
        paintInfo: {
          color: '#4CAF50'
        }
      }
    })
  }

  _showBuyTickets() {
    this.setState({
      showPurchase: true,
      exchangeSkins: [],
      busy: false
    })
  }

  _exchangeSkins() {
    this.setState({
      busy: true
    })

    api(`/raffles/purchase/${this.state.raffle.id}`, {
      body: {
        playerItemIds: _.pluck(this.state.exchangeSkins, 'id')
      }
    }).then(({ tickets }) => {
      toast(`${tickets.length} Ticket(s) have been successfully purchased!`)
      this._showMyTickets(tickets)
    }, () =>
      this.setState({
        busy: false
      })
    )
  }
}
