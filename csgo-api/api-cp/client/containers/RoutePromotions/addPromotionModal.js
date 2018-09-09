
import React from 'react'

import { Modal } from 'office-ui-fabric-react/lib/Modal'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { TextField } from 'office-ui-fabric-react/lib/TextField'

import api from 'lib/api'
import style from './style.css'

export default class AddPromotionModal extends React.Component {

  constructor(props) {
    super(props)

    this.state = this._getInitialState()
  }

  _getInitialState() {
    return {
      busy: false,
      promotion: {
        name: '',
        code: '',
        prizeValue: '0',
        maxUsages: '0'
      }
    }
  }

  componentDidUpdate(prevProps) {
    if(this.props.visible !== prevProps.visible && this.props.visible) {
      this.setState(this._getInitialState())
    }
  }

  render() {
    const { busy, promotion } = this.state
    const { code, prizeValue, maxUsages, name } = promotion

    return (
      <Modal isOpen={this.props.visible}
        onDismiss={::this._onDismiss}
        isBlocking={busy}
        containerClassName={style.createModalContainer}>

        <CommandBar
          isSearchBoxVisible={false}

          items={[{
            key: 'title',
            name: 'Add Promotion',
            icon: 'Add',
            disabled: true
          }]}

          farItems={[{
            key: 'save',
            name: !busy ? 'Save' : 'Saving...',
            disabled: busy || !name.length || !code.length || parseFloat(prizeValue) <= 0,
            onClick: ::this._onSave
          }]} />

        <div className={style.modalBody}>
          <TextField disabled={busy} label='Name' value={name} onChanged={v => this._update({ name: v })} />
          <TextField disabled={busy} label='Redemption Code' value={code} onChanged={v => this._update({ code: v })} />
          <TextField disabled={busy} label='Prize Value' value={prizeValue} onChanged={v => this._update({ prizeValue: v })} />
          <TextField disabled={busy} label='Max Usages (0 = unlimited)' value={maxUsages} onChanged={v => this._update({ maxUsages: v })} />
        </div>
      </Modal>
    )
  }

  _update(update) {
    this.setState({
      promotion: {
        ...this.state.promotion,
        ...update
      }
    })
  }

  _onDismiss() {
    this.setState(this._getInitialState())
    this.props.onDismiss()
  }

  _onSave() {
    this.setState({
      busy: true
    })

    const { id, code, prizeValue, maxUsages, name } = this.state.promotion

    api('promotions/save', {
      body: {
        name,
        code,
        maxUsages: parseFloat(maxUsages),
        prizeValue: parseFloat(prizeValue),

        // id: !!this.props.question ? this.props.question.id : null
      }
    })

    .then(() => {
      this.props.refresh()
      this.props.onDismiss()

      this.setState(this._getInitialState())
    }, () =>
      this.setState({
        busy: false
      })
    )
  }
}
