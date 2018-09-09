
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import { toast } from 'react-toastify'
import cn from 'classnames'
import _ from 'underscore'
import numeral from 'numeral'

import {
  IContextualMenuProps,
  IContextualMenuItem,
  DirectionalHint,
  ContextualMenu,
  ContextualMenuItemType
} from 'office-ui-fabric-react/lib/ContextualMenu'
import { Dropdown, IDropdown, DropdownMenuItemType, IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown'
import { Button, PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button'
import { Icon } from 'office-ui-fabric-react/lib/Icon'
import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { ChoiceGroup } from 'office-ui-fabric-react/lib/ChoiceGroup'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'
import { DetailsList, DetailsListLayoutMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { SelectionMode } from 'office-ui-fabric-react/lib/Selection'
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog'
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar'

import App from 'containers/App'
import api from 'lib/api'

import AddBotModal from './AddBotModal'
import style from './style.css'

const _columns = [{
  key: 'assignedTo',
  name: 'Identifier',
  minWidth: 150,
  maxWidth: 150,
  onRender: bot => <span style={{ opacity: !bot.identifier ? 0.3 : null }}>{bot.identifier || '<unassigned>'}</span>
}, {
  key: 'steamId',
  name: 'Steam ID',
  fieldName: 'steamId',
  minWidth: 150,
  maxWidth: 150
}, {
  key: 'displayName',
  name: 'Display Name',
  fieldName: 'displayName',
  minWidth: 200,
  maxWidth: 200
}, {
  key: 'groups',
  name: 'Groups',
  maxWidth: 250,
  onRender: bot => bot.groups.join(', ')
}, {
  key: 'notes',
  name: 'Notes',
  onRender: bot => <span className="primaryTextColor">{bot.notes || '-'}</span>
}]

const filters = {
  'available': {
    name: 'Available',
    icon: 'InboxCheck'
  },

  'assigned': {
    name: 'Assigned',
    icon: 'BuildQueue'
  },

  'unassigned': {
    name: 'Unassigned',
    icon: 'SurveyQuestions'
  },

  'divider': {
    itemType: ContextualMenuItemType.Divider
  },

  'unavailable': {
    name: 'Unavailable',
    icon: 'RecycleBin'
  }
}

class RouteBots extends Component {
  constructor(props) {
    super(props)

    let filter = props.params.filter || ''

    if(!filters[filter]) {
      filter = 'assigned'
    }

    this.state = {
      filter,

      busy: false,
      showAddModal: false,
      selection: null,

      confirmDelete: false,
      deleteAssignAction: null,

      bots: [],

      unassignedBots: [],
      assignedBots: [],
      loadingUnassignedBots: false,

      opskinsValueTransferAmount: '0.00'
    }

    this._selection = new Selection({
      onSelectionChanged: () => {
        const selection = this._selection.getSelection()

        this.setState({
          selection: selection[0] || null
        })
      }
    })
  }

  componentDidMount() {
    App.setTitle('Bots')

    this._refresh(this.state.filter)
  }

  render() {
    const { busy, filter, selection } = this.state
    const showDeleteAction = filter !== 'unavailable'

    return (
      <div className={style.container}>
        <CommandBar
          isSearchBoxVisible={ false }
          searchPlaceholderText='Steam ID or diplay name ...'

          items={[{
            key: 'filter',
            name: filters[filter].name + ' Bots',
            icon: 'Filter',
            disabled: busy,
            onClick: () => false,
            items: Object.keys(filters).map(key => ({
              ...filters[key],

              key,
              onClick: () => this._refresh(key)
            }))
          }]}

          farItems={[{
            key: 'addBot',
            name: 'Add Bot',
            icon: 'Add',
            onClick: () => this.setState({ showAddModal: true })
          }, {
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            onClick: () => this._refresh()
          }]} />

        <div className={style.botsTableContainer}>
          <DetailsList
            setKey='set'
            checkboxVisibility={false}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.single}
            selection={this._selection}
            selectionPreservedOnEmptyClick={true}
            items={this.state.bots}
            onItemContextMenu={::this._onItemContextMenu}
            columns={_columns}
          />

          {this.state.contextualMenuProps && (
            <ContextualMenu { ...this.state.contextualMenuProps } />
          )}

        </div>

        <Dialog
          hidden={!this.state.confirmDelete}
          onDismiss={() => this.setState({ confirmDelete: false })}
          dialogContentProps={{
            type: DialogType.largeHeader,
            title: !!selection && selection.state === 'Available' ? 'Mark as Unavailable' : 'Confirm Deletion',
            subText: !selection ? null : <span>Bot <b className="primaryTextColor">{selection.displayName} ({selection.id})</b> will no longer be able to be ran and will be marked as <b className="primaryTextColor">Unavailable</b>. Are you sure?</span>
          }}
          modalProps={{ containerClassName: style.dialog }}>

          { !!selection && !!selection.identifier && selection.identifier.length > 0 ? <MessageBar className={style.spaceBottom} messageBarType={MessageBarType.warning}>This bot is currently assigned to <b>{selection.identifier}</b>, would you like to assign a new bot with this identifier?</MessageBar> : null }

          { !!selection && !!selection.identifier && !this.state.loadingUnassignedBots ? <Dropdown
            placeHolder='Select an Action'
            label={<span>Assign identifier <b>{selection.identifier}</b>:</span>}
            selectedKey={this.state.deleteAssignAction}
            onChanged={item => this.setState({ deleteAssignAction: item.key })}
            onRenderTitle={selected => <span>{selected[0].text}</span>}
            options={
              [{
                key: 'nothing',
                text: 'Do nothing and unassign'
              }, {
                key: 'header',
                text: `Available Unassigned Bots (${this.state.unassignedBots.length})`,
                itemType: DropdownMenuItemType.Header
              }, ...this.state.unassignedBots.map(b => ({
                key: b.id,
                text: <span><b>{b.displayName}</b> ({b.steamId})</span>
              }))]
            }
          /> : null }

          <DialogFooter>
            { !this.state.loadingUnassignedBots ? <PrimaryButton disabled={busy || this.state.loadingUnassignedBots} onClick={() => this._updateBot({ state: 'Unavailable', _reassignIdentifierTo: this.state.deleteAssignAction }, { confirmDelete: false })} text='Mark as Unavailable' /> : null }
            { !this.state.loadingUnassignedBots ? <DefaultButton disabled={busy || this.state.loadingUnassignedBots} onClick={() => this.setState({ confirmDelete: false })} text='Cancel' /> : null }
            { this.state.loadingUnassignedBots ? <Spinner /> : null }
          </DialogFooter>
        </Dialog>

        <Dialog
          hidden={!this.state.confirmUnassign}
          onDismiss={() => this.setState({ confirmUnassign: false })}
          dialogContentProps={{
            type: DialogType.largeHeader,
            title: 'Unassign Bot',
            subText: !selection ? null : <span>Bot <b>{selection.displayName} ({selection.id})</b> will no longer be able to be ran with the identifier <b className="primaryTextColor">{selection.identifier}</b>. Are you sure?</span>
          }}
          modalProps={{ containerClassName: style.dialog }}>

          <DialogFooter>
            { !busy ? <PrimaryButton onClick={() => this._updateBot({ identifier: null }, { confirmUnassign: false })} text='Unassign' /> : null }
            { !busy ? <DefaultButton onClick={() => this.setState({ confirmUnassign: false })} text='Cancel' /> : null }
            { busy ? <Spinner /> : null }
          </DialogFooter>
        </Dialog>

        <Dialog
          hidden={!this.state.assignSelection}
          onDismiss={() => this.setState({ assignSelection: false })}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Assign an Identifier',
            subText: !selection ? null : <span>Manually enter or choose an existing identifier you would like to use for <b className="primaryTextColor">{selection.displayName} ({selection.id})</b></span>
          }}
          modalProps={{ containerClassName: style.dialog }}>

          <ChoiceGroup
            options={[{
              key: 'manual',
              text: 'Manually enter a new identifier'
            }, {
              key: 'existing',
              text: 'Overwrite an existing identifier'
            }]}

            selectedKey={this.state.newIdentifierMethod}
            onChange={(e, option) => this.setState({ newIdentifierMethod: option.key, newIdentifier: '' })} />

          <div className={style.spaceTop}>
            { this.state.newIdentifierMethod === 'existing'  && this.state.assignedBots.length > 0 ?
              <MessageBar messageBarType={MessageBarType.warning}>Choosing an already existing identifier will overwrite its current attached bot</MessageBar> : null }

            { this.state.newIdentifierMethod === 'existing'  && this.state.assignedBots.length === 0 ?
              <MessageBar messageBarType={MessageBarType.error}>There are no available identifiers to choose from</MessageBar> : null }

            <div className={style.spaceTop}>
              { this.state.newIdentifierMethod === 'existing' && this.state.assignedBots.length > 0 && !!selection ? <Dropdown
                placeHolder='Choose an existing identifier'
                selectedKey={this.state.newIdentifier}
                onChanged={item => this.setState({ newIdentifier: item.key })}
                onRenderTitle={selected => <span>{selected[0].text}</span>}
                options={this.state.assignedBots.map(b => ({
                  key: b.identifier,
                  text: <span><b><span className="primaryTextColor">{b.identifier}</span> - {b.displayName}</b> ({b.steamId})</span>
                }))} /> : null }

              { this.state.newIdentifierMethod === 'manual' ?
                <TextField
                  autoFocus
                  label='Enter New Identifier:'
                  value={this.state.newIdentifier}
                  onChanged={v => this.setState({ newIdentifier: v })} /> : null }
            </div>
          </div>

          <DialogFooter>
            { !busy && !this.state.loadingAssignedBots ? <PrimaryButton disabled={!this.state.newIdentifier} onClick={() => this._updateBot({ identifier: this.state.newIdentifier, _replaceIdentifierConflict: this.state.newIdentifierMethod === 'existing' }, { assignSelection: false })} text='Assign' /> : null }
            { !busy && !this.state.loadingAssignedBots ? <DefaultButton onClick={() => this.setState({ assignSelection: false })} text='Cancel' /> : null }
            { busy || this.state.loadingAssignedBots ? <Spinner /> : null }
          </DialogFooter>
        </Dialog>

        <Dialog
          hidden={!this.state.showTOTP}
          onDismiss={() => this.setState({ showTOTP: null })}
          dialogContentProps={{
            type: DialogType.large,
            title: !!selection ? `${selection.displayName} (${selection.id})` : null
          }}
          modalProps={{ containerClassName: style.dialog }}>

          <div className={style.totpCode}>{this.state.showTOTP}</div>

          <DialogFooter>
            <PrimaryButton onClick={() => this.setState({ showTOTP: null })} text='OK' />
          </DialogFooter>
        </Dialog>

        <Dialog
          hidden={!this.state.showOPSkinsVaultTransfer}
          onDismiss={() => this.setState({ showOPSkinsVaultTransfer: false })}
          dialogContentProps={{
            type: DialogType.largeHeader,
            title: 'OPSkins Vault Transfer'
          }}>

          <div className={style.opBalance}><div>{ this.state.loadingOPBalance ? <Spinner size={SpinnerSize.large} /> : numeral(this.state.opBalance).format('$0,0.00') }</div>Current Balance</div>
          <div className={style.opBalance}><div>{ this.state.loadingOPBalance ? null : numeral(this.state.vaultBalance).format('$0,0.00') }</div>Vault Balance</div>

          <div className={style.spaceTop}>
            <TextField
              autoFocus
              label='Amount to Transfer:'
              value={this.state.opskinsValueTransferAmount}
              onChanged={v => this.setState({ opskinsValueTransferAmount: v })} />
          </div>

          <DialogFooter>
            <DefaultButton disabled={busy} onClick={() => this.setState({ showOPSkinsVaultTransfer: false })} text='Cancel' />
            <PrimaryButton disabled={busy || !parseFloat(this.state.opskinsValueTransferAmount)} onClick={::this._transferOpskinsVault} text='Transfer' />
          </DialogFooter>
        </Dialog>

        <AddBotModal
          visible={this.state.showAddModal}
          initialBot={this.state.showBot}
          refresh={::this._refresh}
          onDismiss={() => this.setState({ showAddModal: false, showBot: null })} />
      </div>
    )
  }

  _onItemContextMenu(item, index, ev) {
    if (ev.target.nodeName === 'A') {
      return true;
    }

    ev.preventDefault()

    this.setState({
      contextualMenuProps: this._getContextualMenuProps(ev, item)
    })
  }

  _getContextualMenuProps(ev, item) {
    const { busy, filter, selection } = this.state
    const showDeleteAction = item.state !== 'Unavailable'

    const items = [{
      key: 'viewBot',
      name: 'View Summary',
      icon: 'Robot',
      onClick: () => {
        this.setState({
          showAddModal: true,
          showBot: selection
        })
      },
      disabled: busy
    }, {
      key: 'get2fa',
      name: 'Get 2FA Code',
      icon: 'GenericScan',
      disabled: busy,
      onClick: ::this._getSelection2FA
    }, {
      key: 'divider3',
      itemType: ContextualMenuItemType.Divider
    }, {
      key: 'trade',
      name: 'Open Trade URL',
      icon: 'OpenInNewWindow',
      onClick: () => window.open(item.tradeUrl, '_blank'),
      disabled: busy
    }, {
      key: 'trade',
      name: 'View Steam Profile',
      icon: 'OpenInNewWindow',
      onClick: () => window.open(`https://steamcommunity.com/profiles/${item.steamId}`, '_blank'),
      disabled: busy
    }, {
      key: 'opskins',
      name: 'OPSkins',
      icon: 'Storyboard',
      subMenuProps: {
        items: [{
          key: 'vaultTransfer',
          icon: 'Send',
          name: 'Transfer to Vault',
          onClick: () => {
            this.setState({
              showOPSkinsVaultTransfer: true,
              loadingOPBalance: true
            })

            api('bot/opskins/' + this.state.selection.id + '/balance').then(({ balance, vault }) => {
              this.setState({
                loadingOPBalance: false,
                opBalance: balance,
                vaultBalance: vault
              })
            })
          }
        }]
      },

      disabled: busy
    }]

    if(item.state === 'Available') {
      items.push(...[{
        key: 'divider',
        itemType: ContextualMenuItemType.Divider
      }, {
        key: 'assign',
        name: !!item.identifier ? 'Change identifier' : 'Assign an Identifier',
        icon: 'Link',
        onClick: ::this._showAssign,
        disabled: busy
      }, !!item.identifier ? {
        key: 'unassign',
        name: <span>Unassign identifier <span className="primaryTextColor">{item.identifier}</span></span>,
        icon: 'RemoveLink',
        onClick: () => {
          this.setState({
            confirmUnassign: true
          })
        },
        disabled: busy
      } : null].filter(i => !!i))
    }

    if(item.state === 'Available') {
      items.push(...[{
        key: 'divider2',
        itemType: ContextualMenuItemType.Divider
      }, {
        key: 'deleteBot',
        name: 'Mark as Unavailable',
        icon: 'Delete',
        onClick: ::this._confirmDelete,
        disabled: busy
      }])
    }

    return {
      items,

      target: ev.target,
      isBeakVisible: true,
      directionalHint: DirectionalHint.bottomCenter,
      onDismiss: () => this.setState({
        contextualMenuProps: null
      })
    }
  }

  _getSelection2FA() {
    this.setState({
      busy: true
    })

    api('bot/totp/' + this.state.selection.id).then(({ code }) => {
      this.setState({
        busy: false,
        showTOTP: code
      })
    }, () =>
      this.setState({ busy: false })
    )
  }
  _confirmDelete() {
    this.setState({
      loadingUnassignedBots: true,
      confirmDelete: true,
      deleteAssignAction: 'nothing'
    })

    api('bot/list/unassigned').then(({ bots }) => {
      this.setState({
        unassignedBots: bots,
        loadingUnassignedBots: false
      })
    }, () =>
    this.setState({
      loadingUnassignedBots: false,
      confirmDelete: false
    })
    )
  }

  _showAssign() {
    this.setState({
      assignSelection: true,
      newIdentifier: '',
      newIdentifierMethod: 'existing',
      loadingAssignedBots: true
    })

    api('bot/list/assigned').then(({ bots }) => {
      this.setState({
        assignedBots: bots,
        loadingAssignedBots: false
      })
    }, () =>
      this.setState({
        loadingAssignedBots: false,
        assignSelection: false
      })
    )
  }

  _updateBot(update, newState = {}) {
    let { bots, selection } = this.state

    this.setState({
      busy: true
    })

    api('bot/update/' + selection.id, { body: { update } }).then(({ updates }) => {
      this._selection.setItems([])

      if(!!update.state && update.state === 'Unavailable') {
        bots = bots.filter(b => b.id !== selection.id)
      }

      this.setState({
        ...newState,

        busy: false,
        selection: null,
        bots: _.sortBy(bots.map(b => {
          for(let update of updates) {
            if(update.bot.id === b.id) {
              return {
                ...b,
                ...update.bot
              }
            }
          }

          return b
        }), 'identifier')
      })

      for(let update of updates) {
        if(update.stateChanged) {
          toast.warn(<span>Bot {update.bot.displayName} ({update.bot.steamId}) has been moved to <b>{update.bot.state}</b></span>)
        }

        if(!!update.wasUnassigned) {
          toast.warn(<span>Bot {update.bot.displayName} ({update.bot.steamId}) has been unassigned from the identifier <b>{update.wasUnassigned}</b></span>)
        }

        if(update.wasAssigned) {
          toast.success(<span>Bot {update.bot.displayName} ({update.bot.steamId}) has been assigned to the identifier <b>{update.bot.identifier}</b></span>)
        }
      }

      this._refresh()
    }, () =>
      this.setState({ busy: false })
    )
  }

  _refresh(filter) {
    filter = filter || this.state.filter

    if(filter !== this.state.filter) {
      this.props.history.push(`/bots/${filter}`)
    }

    this.setState({
      filter,
      selection: null,
      busy: true
    })

    this._selection.setItems([])

    api('bot/list/' + filter).then(({ bots }) => {
      this.setState({
        bots,
        busy: false
      })
    }, () =>
      this.setState({ busy: false })
    )
  }

  _transferOpskinsVault() {
    this.setState({
      busy: true
    })

    const amount = parseFloat(this.state.opskinsValueTransferAmount)

    if(!amount) {
      return
    }

    api('bot/opskins/' + this.state.selection.id + '/transferToVault', {
      body: {
        amount
      }
    }).then(({ newBalance, newVaultBalance }) => {
      toast.success(`Successfully transfered ${numeral(amount).format('$0.00')} into vault`)

      this.setState({
        opBalance: newBalance,
        vaultBalance: newVaultBalance,
        busy: false
      })
    }, () =>
      this.setState({
        busy: false
      })
    )
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteBots))
