
import React from 'react'
import cn from 'classnames'
import numeral from 'numeral'
import _ from 'underscore'

import Button from 'components/Button'
import Modal from 'components/Modal'
import Spinner from 'components/Spinner'
import PlayerInventory from 'components/PlayerInventory'
import AnimatedCount from 'components/AnimatedCount'

import api from 'lib/api'
import socket from 'lib/socket'
import style from './chooseSkins.scss'

export default class ChooseSkins extends React.Component {

  constructor(props) {
    super(props)

    this.state = this._getInitialState()
  }

  _getInitialState() {
    return {
      busy: false,
      selected: [],
      selectedItems: [],
      selectedTotal: 0
    }
  }

  componentDidMount() {
  }

  componentWillUnmount() {
  }

  componentWillUpdate(nextProps, prevState) {
    if(this.props.visible !== nextProps.visible) {
      if(nextProps.visible) {
        this.setState(this._getInitialState())
      }
    }
  }

  render() {
    const { busy, selected, selectedTotal, selectedItems } = this.state

    const modalHeader = (
      <div className={style.modalHeader}>
        <Button disabled={!selected.length} onClick={() => this.props.onSelect(selectedItems)} primary large>{ selected.length === 0 ? 'Select' : `Select ${selected.length} Skins` }</Button>
        <div className={style.upgradeTotal}>worth <AnimatedCount value={selectedTotal} format="0,0.00" /></div>
      </div>
    )

    return (
      <Modal
        dialogClass={style.modalDialog}
        visible={this.props.visible}
        onClose={::this._close}
        title="Upgrade"
        subTitle="Choose skins you would like to upgrade"
        caption={ null } header={modalHeader}>

        <PlayerInventory
          noAnimation
          disableCustomStyles
          maxHeight={280}
          selected={selected}
          onToggleItem={::this._onToggleItem} />

      </Modal>
    )
  }

  _onToggleItem(id, inventory) {
    let { selected } = this.state
    let idx = selected.indexOf(id)

    if(idx >= 0) {
      selected.splice(idx, 1)
    } else {
      selected.push(id)
    }

    const selectedItems = inventory.filter(i => selected.indexOf(i.id) >= 0)

    this.setState({
      selected,
      selectedItems,

      selectedTotal: selectedItems.reduce((t, i) => t + i.price, 0)
    })
  }

  _close() {
    this.props.onClose()
  }
}
