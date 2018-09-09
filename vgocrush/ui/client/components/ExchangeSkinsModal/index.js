
import React, { Component } from 'react'
import cn from 'classnames'
import { VirtualScroll } from 'react-virtual-scrolling'
import _ from 'underscore'
import numeral from 'numeral'

import * as engine from 'lib/engine'
import Skin from 'components/Skin'
import Button from 'components/Button'
import Spinner from 'components/Spinner'
import AnimatedCount from 'components/AnimatedCount'
import { getItemsCache, getItemPrice } from 'lib/items'

import Modal from '../Modal'
import style from './style.scss'

export default class ExchangeSkinsModal extends Component {
  constructor(props) {
    super(props)

    this.state = this._getInitialState()
    this._skinsPerRow = 5
  }

  componentDidMount() {
    this._onResize = _.throttle(e => {
      const { modalHeader:skinsContainer } = this.refs

      if(!!skinsContainer) {
        this._skinsPerRow = Math.floor(skinsContainer.parentElement.clientWidth / 150)
      }

      if(!e) {
        this.setState({
          skins: this._getSkins()
        })
      }
    }, 100)

    window.addEventListener('resize', this._onResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._onResize)
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.visible !== prevProps.visible) {
      this._onResize()
      this.setState(this._getInitialState())
    }
  }

  render() {
    const { skins, selected, sortDesc, exchangeSkins, exchangeValue, busy } = this.state

    const subtotal = this._subtotal()
    const exchangeCredit = this._exchangeCredit()

    const modalHeader = (
      <div ref="modalHeader" className={style.modalHeader}>
        <div className={style.exchangeInfo}>
          <div className={style.exchangeInfoCredit}><AnimatedCount value={exchangeCredit} format="0,0.00" /></div>
          <div className={style.exchangeInfoText}>Remaining Credit</div>
        </div>

        <Button className={style.exchangeButton} disabled={(exchangeCredit == 0 && !selected.length) || busy || !selected.length} onClick={::this._exchange} primary>{ selected.length > 0 ? `Exchange for ${selected.length} Skins` : 'Exchange' }</Button>
      </div>
    )

    return (
      <Modal visible={this.props.visible}
        onClose={::this._onClose}
        title="Exchange"
        subTitle="Tired of your skins? Choose new skins you would like instead"
        dialogClass={style.modalDialog}
        header={modalHeader}>

        { this.state.showConfirm ? <div className={style.confirmExchange}>
          <div className={style.confirmExchangeContainer}>
            <div className={style.confirmExchangeHeader}>Confirm Exchange</div>
            <p>You have <b>{numeral(exchangeCredit).format('0,0.00')}</b> in exchange credits remaining. If you choose to continue they will be discarded, are you sure you want to continue?</p>

            <div className={style.confirmExchangeButtons}>
              <Button large secondary onClick={() => this.setState({ showConfirm: false })}>Cancel</Button>
              <Button large primary onClick={::this._doExchange}>Continue</Button>
            </div>
          </div>
        </div> : null }

        { busy ? <div className={style.confirmExchange}>
          <Spinner text="Exchanging your old skins...." />
        </div> : null }

        <div className={cn(style.container, busy || this.state.showConfirm ? style.blur : null)}>
          <div className={style.header}>
            <input type="text" placeholder="Search skins..." onChange={::this._onSearch} />
            <Button className={style.sortButton} onClick={::this._toggleSort}>Price <i className={cn('fa', { 'fa-caret-down': sortDesc, 'fa-caret-up': !sortDesc })} /></Button>
          </div>

          <div className={style.skinsContainer} style={{ height: 400 }} ref="list" onScroll={::this._scrollList}>
            {!skins.length ? <div className={style.empty}>{ selected.length > 0 ? 'No other skins could be found to exchange with' : 'Nothing to display' }</div> : null }

            <VirtualScroll
              ref="virtualScroll"
              rows={skins}
              scrollContainerHeight={400}
              totalNumberOfRows={(skins.length) || 0}
              rowHeight={170}
              rowRenderer={::this._contentRenderer} />
          </div>

          <div className={style.selectedItems}>
            {selected.map(item =>
              <div key={item.name} className={style.selectedItem} onClick={e => this._toggleItem(item, e)}>
                <div>{item.name}</div>
                <i className="fa fa-times" />
              </div>
            )}
          </div>
        </div>

      </Modal>
    )
  }

  _onClose() {
    if(this.state.busy) {
      return
    }

    this.props.onClose()
  }

  _toggleSort() {
    const sortDesc = !this.state.sortDesc

    this.setState({
      sortDesc,
      skins: this._getSkins({
        sortDesc
      })
    })
  }

  _onSearch(e) {
    const search = e.target.value

    this.setState({
      search,
      skins: this._getSkins({
        search
      })
    })
  }

  _renderRows(fromRow, toRow, styles) {
    const selectedIds = _.pluck(this.state.selected, 'name')

    return this.state.skins.slice(fromRow, toRow).map(skins =>
      <div key={_.pluck(skins, 'name').join(',')} className={style.skinsContainer} style={styles}>
        {skins.map(skin =>
          <Skin key={skin.name}
            mode="exchange"
            selected={selectedIds.indexOf(skin.name) >= 0}
            item={skin}
            onClick={() => this._toggleItem(skin)} />
        )}
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

  _getInitialState() {
    const state = {
      busy: false,
      selected: [],
      search: '',
      sortDesc: true,
      showConfirm: false,

      exchangeSkins: this.props.skins,
      exchangeSkinsValue: this.props.skins.reduce((t, i) => t + getItemPrice(i), 0)
    }

    return {
      ...state,

      skins: this._getSkins(state)
    }
  }

  _getSkins(opts = {}) {
    if(!this.props.visible) {
      return []
    }

    const { exchangeSkinsValue, sortDesc, search } = {
      ...this.state,
      ...opts
    }

    const exchangeCredit = exchangeSkinsValue - this._subtotal()

    let availableItems = _
      .chain(getItemsCache(false))
      .filter(i => i.priceE <= exchangeCredit)
      .sortBy('priceE')
      .value()

    if(sortDesc) {
      availableItems = availableItems.reverse()
    }

    if(!!search) {
      availableItems = availableItems.filter(i => i.name.toLowerCase().indexOf(search.toLowerCase()) >= 0)
    }

    return _.range(availableItems.length / this._skinsPerRow).map(i => availableItems.slice(i * this._skinsPerRow, (i + 1) * this._skinsPerRow))
  }

  _onSkinClick(skin) {
    this.props.onSelect(skin)
  }

  _toggleItem(item, e) {
    if(!!e) {
      e.preventDefault()
    }

    let { selected } = this.state

    let idx = _.findIndex(selected, i => i.name === item.name)

    if(idx >= 0) {
      selected.splice(idx, 1)
    } else {
      selected.push(item)
    }

    this.setState({
      selected,
      skins: this._getSkins()
    })
  }

  _subtotal() {
    return this.state.selected.reduce((t, i) => t + i.priceE, 0)
  }

  _exchangeCredit() {
    return this.state.exchangeSkinsValue - this._subtotal()
  }

  _exchange() {
    const exchangeCredits = this._exchangeCredit()

    if(exchangeCredits >= 0.10) {
      this.setState({
        showConfirm: true
      })

      return
    }

    this._doExchange()
  }

  _doExchange() {
    this.setState({
      busy: true,
      showConfirm: false
    })

    this.props.onExchange(this.state.exchangeSkins, this.state.selected).then(() => {
      this.props.onClose()
    }, () => {
      this.setState({
        busy: false
      })
    })
  }
}
