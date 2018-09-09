
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'
import moment from 'moment'
import pad from 'pad'
import { toast } from 'react-toastify'

import api from 'lib/api'
import Button from 'components/Button'
import FromNow from 'components/FromNow'
import style from './style.scss'

class Timer extends FromNow {
  constructor(props) {
    super(props)
  }

  _format(to) {
    const now = moment()
    const diff = to.diff(now)
    const duration = moment.duration(diff, 'milliseconds')

    const days = Math.max(to.diff(now, 'd'), 0)

    const hours = pad(2, Math.max(duration.hours(), 0), '0')
    const minutes = pad(2, Math.max(duration.minutes(), 0), '0')
    const seconds = pad(2, Math.max(duration.seconds(), 0), '0')

    let daysStr = days > 0 ? `${days} day${days !== 1 ? 's' : ''} ` : ''

    return `${daysStr}${hours}:${minutes}:${seconds}`
  }
}

const ticketsByColor = {
  'red': require('../assets/ticket.svg'),
  'yellow': require('../assets/ticketYellow.svg'),
  'green': require('../assets/ticketGreen.svg')
}

export default class PrizeInfo extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      busy: false
    }
  }

  render() {
    const { busy } = this.state
    const { paintInfo, giftImage, day, currentDay, type, raffle, winnersChosen } = this.props

    return (
      <div className={style.container}>
        <div className={style.paint} style={{ backgroundColor: '#fff' }}/>
        <div className={style.paintOverlay} />
        <div className={style.close} onClick={this.props.onClose}><i className="fa fa-times" /></div>

        { !type ? <div className={style.contentContainer}>
          <div className={style.content}>
            <div className={style.header}>#{day.day}</div>
            { day.day !== raffle.currentDay ? <div className={style.timer}><Timer date={day.startsAt} /></div> : null }
            <div className={style.giftContainer}>
              <img src={giftImage} />
              <Button disabled={busy || raffle.claimedDays.indexOf(day.day) >= 0 || day.day !== raffle.currentDay} className={style.claimButton} onClick={::this._claimTickets}>{ busy ? 'Claiming...' : raffle.claimedDays.indexOf(day.day) >= 0 ? 'Already Claimed!' : 'Claim Tickets' }</Button>
            </div>
          </div>
        </div> : null }

        { type === 'payouts' ? <div className={style.contentContainer}>
          <div className={style.payoutContent}>
            <div className={style.header}>{ winnersChosen ? 'Prize Winners' : 'Prize Payouts' }</div>
            <div className={style.giftContainer}>
              <div className={style.payouts}>
                {raffle.prizes.map((prize, i) =>
                  <div key={i} className={style.payout}>
                    <img src={require('assets/image/easter/eggs/1.svg')} />
                    <div className={style.payoutValue}>{numeral(prize.value).format('0,0.00')}</div>
                    <div>{ prize.maxWinners === -1 ? winnersChosen ? prize.entries.map(entry =>
                      <div key={entry.id} className={style.winner}>
                        <div><img src={entry.avatar} /></div>
                        <div>{entry.displayName}</div>
                      </div>
                    ) : 'Single Winner' : `${numeral(prize.maxWinners).format('0,0')} Winners` }</div>
                  </div>
                )}
              </div>

              <div style={{ flex: '1', overflow: 'auto', width: '100%', marginTop: 5 }}>
                <table>
                  <thead>
                    <tr>
                      <td>Name</td>
                      <td>Prize</td>
                    </tr>
                  </thead>

                  <tbody>
                    {raffle.winners.map(winner => (
                      <tr key={winner.playerId}>
                        <td><a href={`https://steamcommunity.com/profiles/${winner.playerId}`} target="_blank"><img src={winner.avatar} width="10" /> {winner.displayName}</a></td>
                        <td>{numeral(winner.prize).format('0,0.00')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            { !winnersChosen ? <div className={style.payoutInfo}>Jackpot winners will be drawn and announced on {moment(raffle.endDate).format('MMMM Do')}, good luck!</div> : null }
          </div>
        </div> : null }

        { type === 'tickets' ? <div className={style.contentContainer}>
          <div className={style.payoutContent}>
            <div className={style.header}>Your Tickets</div>

            <div className={style.tickets}>
              {raffle.tickets.map(ticket =>
                <div key={ticket.id} className={style.ticket}>
                  <img src={ticketsByColor[ticket.color]} />
                  <div className={style.ticketNumber}>#{ticket.ticketNumber}</div>
                </div>
              )}
            </div>
          </div>
        </div> : null }

        { type === 'purchase' ? <div className={style.contentContainer}>
          <div className={style.payoutContent}>
            <div className={style.header}>Purchase Tickets</div>

            <div className={style.tickets}>
              {raffle.tickets.map(ticket =>
                <div key={ticket.id} className={style.ticket}>
                  <img src={ticketsByColor[ticket.color]} />
                  <div className={style.ticketNumber}>#{ticket.ticketNumber}</div>
                </div>
              )}
            </div>
          </div>
        </div> : null }
      </div>
    )
  }

  _claimTickets() {
    this.setState({
      busy: true
    })

    api('raffles/claim/' + this.props.raffle.id, {
      body: {
        day: this.props.day.day
      }
    }).then(({ tickets }) => {
      toast(`Ticket(s) ${tickets.map(t => `#${t.ticketNumber}`).join(', ')} have been successfully claimed!`)
      this.props.showTickets(tickets)
    }, () =>
      this.setState({
        busy: false
      })
    )
  }
}
