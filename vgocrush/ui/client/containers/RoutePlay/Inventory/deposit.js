
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'
import _ from 'underscore'
import { VirtualScroll } from 'react-virtual-scrolling'

import Notification from 'components/Notification'
import Button from 'components/Button'
import Modal from 'components/Modal'
import Spinner from 'components/Spinner'
import AnimatedCount from 'components/AnimatedCount'

import api from 'lib/api'
import socket from 'lib/socket'
import style from './deposit.scss'

export default class Inventory extends React.Component {

  constructor(props) {
    super(props)

    this.state = this._getInitialState()
  }

  _getInitialState() {
    return {
      loading: false,
      selected: [],
      allItems: [],
      items: [],
      cannotAccept: 0,
      page: 1,
      sortDesc: true,
      sendingDeposit: false,
      tradeOffer: null,

      search: ''
    }
  }

  componentDidMount() {
    this._onOfferChange = offer => {
      if(!this.state.tradeOffer) {
        return
      }

      if(offer.id === this.state.tradeOffer.id) {
        this.setState({
          tradeOffer: {
            ...this.state.tradeOffer,
            ...offer
          }
        })
      }
    }

    socket.on('tradeOffer:change', this._onOfferChange)
  }

  componentWillUnmount() {
    socket.removeListener('tradeOffer:change', this._onOfferChange)
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.visible !== prevProps.visible) {
      if(this.props.visible) {
        this._refresh()
      } else {
        this.setState(this._getInitialState())
      }
    }
  }

  render() {
    const { loading, items, allItems, selected, cannotAccept, page, search, sortDesc, sendingDeposit, tradeOffer } = this.state

    const selectedItems = allItems.filter(item => selected.indexOf(item.id) >= 0)
    const subtotal = selectedItems.reduce((t, i) => t + i.price, 0)
    // if(!search.length) {
    //   for(let item of selectedItems) {
    //     const i = _.findWhere(renderItems, {
    //       id: item.id
    //     })
    //
    //     if(!!i) {
    //       continue
    //     }
    //     renderItems.push({
    //       ...item,
    //       _dimmed: true
    //     })
    //   }
    // }

    if(!!tradeOffer) {
      let modalHeader = null

      if(tradeOffer.state === 'QUEUED') {
        modalHeader = <Spinner center />
      } else if(tradeOffer.state === 'SENT') {
        modalHeader = <Button className={style.depositButton} target="_blank" href={tradeOffer.tradeOfferUrl}><i className="fa fa-link" /> Open OPskins Express Trade</Button>
      } else if(tradeOffer.state === 'DECLINED') {
        modalHeader = <Button className={style.retryButton} onClick={::this._retry}>Retry</Button>
      } else if(tradeOffer.state === 'ACCEPTED') {
        modalHeader = <Button className={style.retryButton} onClick={::this._close}>Exit</Button>
      }

      return (
        <Modal dialogClass={style.dialog} visible={this.props.visible} onClose={::this._close} header={modalHeader} title={tradeOffer.state.replace(/_/, ' ')} subTitle={ tradeOffer.state === 'DECLINED' ? tradeOffer.error : `Security Token: ${tradeOffer.securityToken}`} caption={`Reference: ${tradeOffer.id}`} >
          { tradeOffer.state === 'SENT' && false ? <Notification><b><i className="fa fa-warning-sign" /> For your security, please only use the trade link button above to open your Steam trade offer and always confirm the security tokens match.</b></Notification> : null }
          { tradeOffer.state === 'DECLINED' ? <Notification><b><i className="fa fa-warning-sign" /> You have declined the trade offer sent by us, do <u>NOT</u> accept any other offers for this deposit of you may fall for a scam!</b></Notification> : null }

          <table className={style.depositItems}>
            <thead>
              <tr>
                <th></th>
                <th>Skin</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {tradeOffer.items.map(item =>
                <tr key={item.id}>
                  <td><img src={item.icon} /></td>
                  <td>{item.name}</td>
                  <td>{numeral(item.price).format('0,0.00')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Modal>
      )
    }

    const modalHeader = !sendingDeposit ? (
      <div className={style.modalHeader}>
        <Button disabled={loading} className={style.refreshButton} onClick={() => this._refresh(true)}>Refresh</Button>
        <div className={style.depositInfo}>
          <Button className={style.depositButton} onClick={::this._deposit} disabled={loading || !selected.length}>{ selected.length > 0 ? `Deposit ${selected.length} Skin${selected.length === 1 ? '' : 's'}` : 'Deposit' }</Button>
          <div className={style.depositTotal}>worth {numeral(subtotal).format('0,0.00')}</div>
        </div>
      </div>
    ) : null

    return (
      <Modal dialogClass={style.dialog} visible={this.props.visible} onClose={::this._close} title="Deposit" subTitle={<span>Choose skins from your <a href="https://trade.opskins.com/" target="_blank">OPSkins Trade inventory</a> to deposit below.</span>} caption={ !loading && cannotAccept > 0 ? `${cannotAccept} of your skins cannot be deposited` : null } header={modalHeader}>

        { loading ? <Spinner text={ sendingDeposit ? 'Queueing your deposit ...' : null } center /> : null }

        { !loading && allItems.length > 0 ? <div className={style.header}>
          <input type="text" placeholder="Search inventory..." value={search} onChange={::this._onSearch} onKeyDown={::this._onSearchKeydown} autoFocus />
          <Button className={style.sortButton} onClick={::this._toggleSort}>Price <i className={cn('fa', { 'fa-caret-down': sortDesc, 'fa-caret-up': !sortDesc })} /></Button>
        </div> : null }

        { !loading && !allItems.length ? <div className={style.empty}>Cannot find any skins to display</div> : null }

        <div ref="list" onScroll={::this._scrollList}>
          <VirtualScroll
            ref="virtualScroll"
            rows={this.state.items}
            scrollContainerHeight={400}
            totalNumberOfRows={(this.state.items.length) || 0}
            rowHeight={184}
            rowRenderer={::this._contentRenderer} />
        </div>

        { allItems.length ? <p className={style.warning}>Having trouble? View our <a href="https://youtu.be/DWT504yns5w">deposit tutorial video</a> for detailed instructions.</p> : null }
      </Modal>
    )
  }

  _renderRows(fromRow, toRow, styles) {
    const { loading, items, selected, cannotAccept, page, search, sortDesc, sendingDeposit, tradeOffer } = this.state

    return this.state.items.slice(fromRow, toRow).map(skins =>
      <div key={_.pluck(skins, 'id').join(',')} className={style.skinsContainer} style={styles}>
        {skins.map(item => {
          const split = item.market_hash_name.split('|')
          const name = split[0]
          const type = split[1] || null

          return (
            <div key={item.id} className={cn(style.skin, selected.indexOf(item.id) >= 0 ? style.skinSelected : null)} style={{ opacity: item._dimmed ? 0.5 : 1 }} onClick={() => this._toggleItem(item.id, item.canAccept)}>

              { !item.canAccept ? <div className={style.notAccepted}>Not Accepted</div> : null }

              <div className={style.skinPrice}>{numeral(item.price).format('0,0.00')}</div>
              <div className={style.skinImage}>
                <img src={item.icon_url} />
              </div>

              { item.canAccept ? <Button className={style.selectButton}>Select</Button> : null }

              <div className={style.skinCheckbox}><i className="fa fa-check" /></div>
              <div className={style.skinName}>{ name }</div>
              <div className={style.skinType} style={{ color: type ? item.quality_color : null }}>{ type || '' }</div>
              <div className={style.skinWear}>{ item.wear }</div>
              <div className={style.skinBorder} style={{ borderColor: type ? item.quality_color : null }} />
            </div>
          )
        })}
      </div>
    )
  }

  _scrollList(e) {
    if(this.refs.virtualScroll) {
      this.refs.virtualScroll.scrollHook(e.target)
    }
  }

  _contentRenderer(rowStyles, fromRow, toRow, parentStyles) {
    return (
      <div className={style.skins} style={parentStyles}>
        {this._renderRows(fromRow, toRow, rowStyles)}
      </div>
    )
  }

  _toggleItem(id, canAccept) {
    if(!canAccept) {
      return
    }

    let { selected } = this.state
    let idx = selected.indexOf(id)

    if(idx >= 0) {
      selected.splice(idx, 1)
    } else {
      selected.push(id)
    }

    this.setState({
      selected
    })
  }

  _refresh(refresh) {
    const oldState = this.state

    this.setState({
      items: [],
      visibleItems: [],
      selected: [],
      page: 1,
      loading: true
    })

    api(`users/remoteInventory?${ refresh ? 'refresh=1' : ''}`).then(inventory => {
      const items = this._sort(inventory.items)

      this.setState({
        ...inventory,

        allItems: inventory.items,
        items: _
          .range(items.length / 5)
          .map(i => items.slice(i * 5, (i + 1) * 5)),

        loading: false
      })
    }, () => {
      this.setState({
        ...oldState,
        loading: false
      })
    })
  }

  _close() {
    this.props.onClose()
  }

  _retry() {
    this.setState({
      loading: false,
      sendingDeposit: false,
      tradeOffer: null
    })
  }

  _deposit() {
    this.setState({
      loading: true,
      sendingDeposit: true
    })

    api('users/deposit', {
      method: 'POST',
      body: {
        ids: this.state.selected
      }
    })

    .then(result => {
      this.setState({
        loading: false,
        sendingDeposit: false,
        tradeOffer: result.tradeOffer
      })
    })

    .catch(() => {
      this.setState({
        loading: false,
        sendingDeposit: false
      })
    })
  }

  _sort(items, update) {
    let { sortDesc, search } = { ...this.state, ...update }

    search = search.trim().toLowerCase()

    const canAccept = items.filter(i => i.canAccept)
    const cannotAccept = items.filter(i => !i.canAccept)

    const sort = arr => arr
      .filter(item => search.length > 0 ? item.market_hash_name.toLowerCase().indexOf(search) >= 0 : true)
      .sort((a, b) => {
        if(!sortDesc) {
          return a.price - b.price
        }

        return b.price - a.price
      })

    return sort(canAccept).concat(sort(cannotAccept))
  }

  _onSearchKeydown(e) {
    if(e.keyCode === 13) {
      const items = this._sort(this.state.allItems)

      this.setState({
        items: _
          .range(items.length / 5)
          .map(i => items.slice(i * 5, (i + 1) * 5)),
        page: 1
      })
    }
  }

  _onSearch(e) {
    this.setState({
      search: e.target.value.trim()
    })
  }

  _toggleSort() {
    const sortDesc = !this.state.sortDesc

    const items = this._sort(this.state.allItems, { sortDesc })

    this.setState({
      sortDesc,
      items: _
        .range(items.length / 5)
        .map(i => items.slice(i * 5, (i + 1) * 5)),
      page: 1
    })
  }
}
