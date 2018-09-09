
import React from 'react'
import cn from 'classnames'
import _ from 'underscore'

import {
  Spinner,
  SpinnerSize
} from 'office-ui-fabric-react/lib/Spinner'
import { DetailsList, DetailsListLayoutMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { SelectionMode } from 'office-ui-fabric-react/lib/Selection'
import { Modal } from 'office-ui-fabric-react/lib/Modal'
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { TagPicker } from 'office-ui-fabric-react/lib/components/pickers/TagPicker/TagPicker';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar'
import { Pivot, PivotItem, PivotLinkFormat } from 'office-ui-fabric-react/lib/Pivot'
import { toast } from 'react-toastify'

import api from 'lib/api'
import style from './style.css'

const opSummaryColumns = [{
  key: 'name',
  name: 'Name',
  fieldName: 'name',
  minWidth: 150,
  maxWidth: 150
}, {
  key: 'value',
  name: 'Value',
  fieldName: 'value'
}]

export default class AddBotModal extends React.Component {

  constructor(props) {
    super(props)

    this.state = this._getInitialState()
  }

  _getInitialState() {
    return {
      busy: false,

      bot: !!this.props.initialBot ? this.props.initialBot : {
        groups: [],
        features: [],

        steamId: '',
        displayName: '',
        username: '',
        password: '',
        sharedSecret: '',
        identitySecret: '',
        apiKey: '',

        opskins: {
          apiKey: '',
          email: ''
        }
      }
    }
  }

  componentDidUpdate(prevProps) {
    if(this.props.visible !== prevProps.visible && this.props.visible) {
      this.setState(this._getInitialState())
    }
  }

  render() {
    const { busy, bot } = this.state

    return (
      <Modal isOpen={this.props.visible}
        onDismiss={::this._onDismiss}
        isBlocking={busy}
        containerClassName={style.modal}>

        { busy ? <div className={style.spinnerContainer}>
          <Spinner size={SpinnerSize.large} label="Saving, please wait..." />
        </div> : null }

        <CommandBar
          isSearchBoxVisible={false}

          items={[{
            key: 'addBot',
            name: !bot.id ? 'Add Bot' : bot.displayName,
            disabled: true
          }]}

          farItems={[!bot.id ? {
            key: 'import',
            name: 'Import',
            icon: 'ImportMirrored',
            onClick: ::this._onImport
          } : null, {
            key: 'save',
            name: 'Save',
            disabled: busy,
            icon: 'Save',
            onClick: ::this._onSave
          }].filter(i => !!i)} />

          <Pivot className={style.tabs}>
            <PivotItem linkText='Steam'>
              <div className={cn(style.modalBody, busy ? style.blur : null)}>

                { !!bot.id ? <MessageBar messageBarType={MessageBarType.success}>Steam settings has been successfully verified! Modifying credentials is not yet supported.</MessageBar> : null }

                <TextField disabled={busy}
                  label='Steam ID'
                  value={bot.steamId}
                  disabled={true} />

                <TextField disabled={busy}
                  label='Display Name'
                  value={bot.displayName}
                  onChanged={v => this._edit('displayName', v)}
                  disabled={busy} />

                { !bot.id ? <TextField disabled={busy}
                  label='Username'
                  value={bot.username}
                  onChanged={v => this._edit('username', v)}
                  disabled={busy || !!bot.id} /> : null }

                { !bot.id ? <TextField disabled={busy}
                  label='Password'
                  type="passsword"
                  value={bot.password}
                  onChanged={v => this._edit('password', v)}
                  disabled={busy || !!bot.id} /> : null }

                { !bot.id ? <TextField disabled={busy}
                  label='Identity Secret'
                  value={bot.identitySecret}
                  onChanged={v => this._edit('identitySecret', v)}
                  disabled={busy || !!bot.id} /> : null }

                { !bot.id ? <TextField disabled={busy}
                  label='Shared Secret'
                  value={bot.sharedSecret}
                  onChanged={v => this._edit('sharedSecret', v)}
                  disabled={busy || !!bot.id} /> : null }

                { !bot.id ? <TextField disabled={busy}
                  label='API Key'
                  value={bot.apiKey}
                  onChanged={v => this._edit('apiKey', v)}
                  disabled={busy || !!bot.id} /> : null }

                <div className={style.form}>
                  <Checkbox label="Allow Deposits"
                    disabled={busy}
                    checked={bot.groups.indexOf('deposit') >= 0}
                    onChange={v => this._toggleGroup('deposit')} />
                </div>

                <div className={style.form}>
                  <Checkbox label="Allow Withdrawals"
                    disabled={busy}
                    checked={bot.groups.indexOf('withdraw') >= 0}
                    onChange={v => this._toggleGroup('withdraw')} />
                </div>
              </div>
            </PivotItem>

            <PivotItem linkText='OPSkins'>
              <div className={style.modalBody}>
                <Checkbox label='Enabled'
                  disabled={busy || bot.opskins.enabled}
                  checked={bot.groups.indexOf('opskins') >= 0}
                  onChange={v => this._toggleGroup('opskins')} />

                <div className={style.form}>
                  <Checkbox label='Auto sell inventory items'
                    disabled={busy}
                    checked={bot.opskins.autoSellItems}
                    onChange={(e, v) => this._edit('opskins', 'autoSellItems', v)} />
                </div>

                <div className={style.form}>
                  <Checkbox label='Withdraw inventory items to other bots'
                    disabled={busy}
                    checked={bot.opskins.isMaster}
                    onChange={(e, v) => this._edit('opskins', 'isMaster', v)} />

                  { bot.opskins.isMaster ? <div className={style.form}>
                    <TagPicker
                      label="Slaves"
                      defaultSelectedItems={bot.opskins.isMaster && !!bot.opskins.slaves ? bot.opskins.slaves.map(s => ({
                        key: s,
                        name: s
                      })) : []}
                      disabled={!bot.opskins.isMaster}
                      onChange={slaves => this._edit('opskins', 'slaves', _.pluck(slaves, 'name'))}
                      onResolveSuggestions={::this._onResolveAvailableBots}
                      itemLimit={5}
                      inputProps={{
                        placeholder: 'Enter identifiers of bots you would like withdrawals to be sent to'
                      }}
                      pickerSuggestionsProps={{
                        suggestionsHeaderText: 'Available Bots',
                        noResultsFoundText: 'No Bots Found'
                      }} />
                  </div> : null }
                </div>

                { !bot.opskins.enabled ? <TextField disabled={busy || bot.groups.indexOf('opskins') < 0}
                  label='API Key'
                  disabled={busy || bot.groups.indexOf('opskins') < 0}
                  value={bot.opskins.apiKey || ''}
                  onChanged={v => this._edit('opskins', 'apiKey', v)} /> : null }

                { !bot.opskins.enabled ? <TextField disabled={busy || bot.groups.indexOf('opskins') < 0}
                  disabled={busy || bot.groups.indexOf('opskins') < 0}
                  label='Email Address'
                  value={bot.opskins.email || ''}
                  onChanged={v => this._edit('opskins', 'email', v)} /> : null }

                <div className={style.form}>
                  <DetailsList
                    setKey='set'
                    checkboxVisibility={false}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    items={bot.opskins.enabled ? bot.opskins.summary : []}
                    columns={opSummaryColumns}
                  />
                </div>
              </div>
            </PivotItem>

            <PivotItem linkText='Notes'>
              <TextField disabled={busy}
                multiline
                rows={10}
                placeholder="Enter extra information here..."
                value={bot.notes || ''}
                onChanged={v => this._edit('notes', v)} />
            </PivotItem>
          </Pivot>
      </Modal>
    )
  }

  _onResolveAvailableBots(filter, tagsList) {
    const exists = _.pluck(tagsList, 'key')

    return api('bot/list/assigned?filter=' + filter).then(({ bots }) => {
      return bots.filter(b => exists.indexOf(b.id) < 0).map(bot => ({
        key: bot.identifier,
        name: bot.identifier
      }))
    }, () => ([]))
  }

  _onImport() {
    let text = prompt('Enter line from V4 Accounts')

    if(!text) {
      return
    }

    const split = text.trim().split('\t')

    if(!split.length) {
      toastify.error('Unknown format')
      return
    }

    console.log(split)

    this.setState({
      bot: {
        groups: ['opskins'],
        features: [],

        displayName: split[10],
        username: split[10],
        password: split[11],
        sharedSecret: split[12],
        identitySecret: split[13],
        apiKey: split[16],

        opskins: {
          apiKey: split[20],
          email: ''
        }
      }
    })
  }

  _edit(field, key, value) {
    const { bot } = this.state

    if(typeof value === 'undefined') {
      bot[field] = key
    } else {
      bot[field][key] = value
    }

    this.setState({
      bot
    })
  }

  _toggleGroup(group, enabled) {
    let { bot: { groups } } = this.state

    const idx = groups.indexOf(group)

    if(idx < 0) {
      groups.push(group)
    } else {
      groups.splice(idx, 1)
    }

    this.setState({
      bot: {
        groups,
        ...this.state.bot
      }
    })
  }

  _onResolveSuggestions() {
    return []
  }

  _onDismiss() {
    this.setState(this._getInitialState())
    this.props.onDismiss()
  }

  _onSave() {
    this.setState({
      busy: true
    })

    const { bot } = this.state

    api('bot/save', {
      body: {
        bot
      }
    })

    .then(result => {
      this.setState({
        busy: false,
        bot: result.bot
      })

      if(bot.groups.indexOf('opskins') >= 0) {
        if(result.opskins.needsEmailVerification) {
          toast.warn('Please confirm opskins e-mail account, a confirmation e-mail has been sent to ' + bot.opskins.email)
        } else if(!bot.opskins.email && !!result.opskins.email) {
          this._edit('opskins', 'email', result.opskins.email)
        }
      }

      toast(<span>Bot {bot.displayName} ({bot.steamId}) has been successfully updated!</span>)
      this.setState({ busy: false })
      this.props.refresh()
    }, () =>
      this.setState({ busy: false })
    )
  }
}
