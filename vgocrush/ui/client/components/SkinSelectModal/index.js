
import React, { Component } from 'react'
import cn from 'classnames'
import { VirtualScroll } from 'react-virtual-scrolling'
import _ from 'underscore'

import * as engine from 'lib/engine'
import Skin from 'components/Skin'
import Button from 'components/Button'
import { getItemPrice, getItemsCache } from 'lib/items'

import Modal from '../Modal'
import style from './style.scss'

export default class SkinSelectModal extends Component {
  static defaultProps = {
    selected: []
  }

  constructor(props) {
    super(props)

    this.state = this._getInitialState({
      sortDesc: props.defaultSortDesc || false
    })
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.visible !== prevProps.visible) {
      this.setState(this._getInitialState({ search: '' }))
    }
  }

  render() {
    const { skins, sortDesc } = this.state

    const modalOptions = {
      title: 'Choose a Skin',
      subTitle: 'Choose a skin to automatically cashout on',

      ...(this.props.modalOptions || {})
    }

    return (
      <Modal visible={this.props.visible} onClose={this.props.onClose} {...modalOptions}>

        <div className={style.container}>
          <div className={style.header}>
            <input type="text" placeholder="Search skins..." onChange={::this._onSearch} />
            <Button className={style.sortButton} onClick={::this._toggleSort}>Price <i className={cn('fa', { 'fa-caret-down': sortDesc, 'fa-caret-up': !sortDesc })} /></Button>
          </div>

          <div ref="list" onScroll={::this._scrollList}>
            <VirtualScroll
              ref="virtualScroll"
              rows={skins}
              scrollContainerHeight={400}
              totalNumberOfRows={(skins.length) || 0}
              rowHeight={160}
              rowRenderer={::this._contentRenderer} />
          </div>
        </div>

      </Modal>
    )
  }

  _toggleSort() {
    this.setState(this._getInitialState({
      search: this.state.search,
      sortDesc: !this.state.sortDesc
    }))
  }

  _onSearch(e) {
    this.setState(this._getInitialState({
      search: e.target.value,
      sortDesc: this.state.sortDesc
    }))
  }

  _renderRows(fromRow, toRow, styles) {
    const { selected } = this.props

    return this.state.skins.slice(fromRow, toRow).map(skins =>
      <div key={_.pluck(skins, 'name').join(',')} className={style.skinsContainer} style={styles}>
        {skins.map(skin =>
          <Skin key={skin.id || skin.name}
            mode={this.props.disabledMode ? '' : 'upgrade'}
            item={skin}
            selected={selected.indexOf(skin.id) >= 0}
            onClick={() => this._onSkinClick(skin)} />
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

  _getInitialState(newState = {}) {
    const { search, sortDesc } = {
      ...(this.state || {}),
      ...newState
    }

    const skins = (this.props.skins || getItemsCache(false)) || []
    let availableItems = _.sortBy(skins, 'priceU')

    if(sortDesc) {
      availableItems = availableItems.reverse()
    }

    if(this.props.wagerTotal > 0) {
      availableItems = availableItems.filter(i => {
        const mult = i.priceU / this.props.wagerTotal

        if(mult < 1.01) {
          return false
        }

        return i.priceU > this.props.wagerTotal + 0.01
      })
    }

    if(!!search) {
      availableItems = availableItems.filter(i => i.name.toLowerCase().indexOf(search.toLowerCase()) >= 0)
    }

    const renderSkins = []

    while(availableItems.length > 0) {
      renderSkins.push(availableItems.splice(0, 5))
    }

    return {
      search,
      sortDesc,
      skins: renderSkins
    }
  }

  _onSkinClick(skin) {
    this.props.onSelect(skin)
  }
}
