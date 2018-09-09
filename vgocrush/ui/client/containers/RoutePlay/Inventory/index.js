
import React from 'react'
import cn from 'classnames'
import _ from 'underscore'
import numeral from 'numeral'
import swal from 'sweetalert2'

import { toast } from 'react-toastify'

import AnimatedCount from 'components/AnimatedCount'
import Button from 'components/Button'
import TradeUrlModal from 'components/TradeUrlModal'
import PlayerInventory from 'components/PlayerInventory'
import ExchangeSkinsModal from 'components/ExchangeSkinsModal'
import socket from 'lib/socket'
import api from 'lib/api'

import Deposit from './deposit'
import depositStyles from './deposit.scss'

import WithdrawConfirmation from './WithdrawConfirmation'
import style from './style.scss'

export default class Inventory extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      showInventory: false,
      showSettings: false,
      showExchange: false,
      placingBet: false,

      busy: false
    }
  }

  componentWillUnmount() {
    socket.removeListener('removePlayerItem', this._onPlayerItemRemove)
  }

  render() {
    const { showInventory, showSettings, placingBet, showExchange, busy } = this.state
    const { currentUser, selectedItems, selectedValue, playerInventory } = this.props

    const inventoryWorth = playerInventory
      .filter(i => i.type === 'skin')
      .reduce((t, i) => t + i.price, 0)

    const availableItems = playerInventory.filter(i => i.state === 'AVAILABLE')
    const items = playerInventory.filter(i => selectedItems.indexOf(i.id) >= 0)

    return (
      <div className={style.inventory}>
        <div className={style.header}>
          <div className={style.inventoryWorth}><i className="fa fa-tag" style={{ marginRight: 3 }} /> <AnimatedCount value={inventoryWorth} format="0,0.00" /></div>
          { playerInventory.length > 0 ? <div className={style.selectAll}><input type="checkbox" checked={selectedItems.length === availableItems.length} onChange={::this._onSelectAll} /> Select All</div> : null }
        </div>

        <div className={style.inventoryContainer}>
          <PlayerInventory
            onContextMenuShow={this.props.onContextMenuShow}
            contextMenu={this.props.contextMenu || []}
            selected={selectedItems}
            onToggleItem={this.props.onToggleItem}
            onNewItem={::this._onNewPlayerItem} />
        </div>

        <div className={style.actionBar}>
          { selectedItems.length <= 0 ? <Button disabled={busy || placingBet} onClick={::this._showDeposit}>Deposit</Button> : null }
          <Button disabled={busy || placingBet || selectedItems.length <= 0} primary onClick={() => this.setState({ showConfirmWithdraw: true })}>Withdraw</Button>
          { selectedItems.length > 0 ? <Button disabled={busy || placingBet} onClick={::this._exchange}>Exchange</Button> : null }
        </div>

        { !!currentUser ? <TradeUrlModal visible={showSettings} onClose={::this._onTradeModalClose} /> : null }
        { !!currentUser ? <Deposit visible={this.state.showInventory} onClose={() => this.setState({ showInventory: false })} currentUser={currentUser} /> : null }

        <WithdrawConfirmation visible={this.state.showConfirmWithdraw}
          selectedItems={items}
          onConfirm={::this._onConfirmWithdraw}
          onClose={() => this.setState({ showConfirmWithdraw: false })} />
        <ExchangeSkinsModal visible={this.state.showExchange}
          onClose={() => this.setState({ showExchange: false })}
          onExchange={::this._onExchange}
          skins={this.props.items} />
      </div>
    )
  }

  _onExchange(playerItems, skins) {
    const playerItemIds = _.pluck(playerItems, 'id')
    const targetItemNames = _.pluck(skins, 'name')

    return api('inventory/exchange', {
      method: 'POST',
      body: {
        playerItemIds,
        targetItemNames
      }
    })
  }

  _onSelectAll(e) {
    const { selectedItems, playerInventory } = this.props
    const availableItems = playerInventory.filter(i => i.state === 'AVAILABLE')

    if(selectedItems.length === availableItems.length) {
      this.props.clearSelection()
    } else {
      this.props.selectAll()
    }
  }

  _onNewPlayerItem(newItem) {
    toast(`${newItem.name} has been added to your inventory`)
  }

  _placeBet(itemIds) {
    this.setState({
      placingBet: true
    })

    this.props.placeBet(itemIds).then(() => {
      this.setState({
        placingBet: false,
        // selectedItems: []
      })
    }, () => {
      this.setState({
        placingBet: false
      })
    })
  }

  _showDeposit() {
    // if(!this.props.currentUser.tradeUrl || !this.props.currentUser.tradeUrl.trim().length) {
    //   this.setState({
    //     showSettings: true
    //   })
    //
    //   return
    // }

    this.setState({
      showInventory: true
    })
  }

  _onTradeModalClose(showInventory) {
    this.setState({
      showInventory,
      showSettings: false
    })
  }

  _exchange() {
    this.setState({
      showExchange: true
    })
  }

  _onConfirmWithdraw() {
    return api('inventory/withdraw', {
      method: 'POST',
      body: {
        items: _.pluck(this.props.items, 'name')
      }
    })

    .then(result => {
      this.setState({ showConfirmWithdraw: false })
      this.props.clearSelection()
      this.props.switchSettingsTab('withdraws', true)
    })
  }
}

//           <Button disabled={placingBet || selected.length === 0} className={cn(style.quickBetButton, !this.props.betting && !this.props.placingBet && selected.length > 0 ? style.showQuickButton : null)} onClick={() => this._placeBet(selected)} large><span>Set Upgrade Skins</span></Button>
