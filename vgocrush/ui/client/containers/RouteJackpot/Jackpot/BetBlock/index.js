
import React from 'react'
import cn from 'classnames'
import anime from 'animejs'
import _ from 'underscore'

import AnimatedCount from 'components/AnimatedCount'
import style from './style.scss'

export default class BetBlock extends React.Component {

  componentDidMount() {
    this._updatePosition(this.props.index, !this.props.entry || (!this.props.entry._isNew && !this.props.entry._secretBlock))
  }

  componentDidUpdate(prevProps) {
    if(prevProps.index !== this.props.index) {
      if(this._animation) {
        this._animation.pause()
      }

      this._updatePosition(this.props.index)
    }
  }

  componentWillUnmount() {
    if(!!this._animation) {
      this._animation.pause()
    }
  }

  render() {
    const { entry, index, dim } = this.props

    if(!!entry && entry._secretBlock) {
      return (
        <div ref="container" className={cn(style.container, style.initialBlock)}>
          <div className={style.header}><img src={require('assets/image/ticket.svg')} style={{ height: 25, marginRight: 10 }} /> {entry._winningTicket}</div>
          <div className={style.subHeader}><i className="fa fa-key" /> {entry._secret}</div>
        </div>
      )
    }

    if(this.props.initialBlock) {
      return (
        <div ref="container" className={cn(style.container, style.initialBlock, dim ? style.dimmed : null)}>
          <div className={style.header}><img src={require('assets/image/start.svg')} /> A NEW ROUND HAS STARTED!</div>
          <div className={style.subHeader}><i className="fa fa-lock" /> {this.props.hash}</div>
        </div>
      )
    }

    return (
      <div ref="container" className={cn(style.container, dim ? style.dimmed : null)} style={{ borderLeftColor: entry.player.color || '#3a394a' }}>
        <div className={style.wrapper}>
          <div className={style.player}>
            <img src={entry.player.avatar} />
            <div><span>{entry.player.displayName}</span></div>
          </div>

          <div className={style.itemsWrapper}>
            <div className={style.items}>
              <div className={style.ticketNumber}>Ticket #{parseInt(entry.ticketStart)} - {parseInt(entry.ticketEnd)}</div>
              {entry.items.slice(0, 10).map((item, i) => <img key={i} src={item.iconUrl} />)}
            </div>
          </div>

          <div className={style.itemsValue}>+ <AnimatedCount value={entry.value} format="0,0.00" duration={1100} initial={!entry._isNew} /></div>
        </div>
      </div>
    )
  }

  _updatePosition(index, instant = false) {
    const { container } = this.refs
    const top = index * 105

    if(instant) {
      container.style.top = `${top}px`
      return
    }

    this._animation = anime({
      top,

      targets: container,
      duration: 700,
      easing: 'easeInOutBack',

      begin: () => {
        container.style.zIndex = index
      },

      complete: () => {
        container.style.zIndex = 1
      }
    })
  }
}
