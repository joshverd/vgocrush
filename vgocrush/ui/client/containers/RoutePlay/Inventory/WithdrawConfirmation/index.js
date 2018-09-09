
import React from 'react'
import numeral from 'numeral'

import Spinner from 'components/Spinner'
import Modal from 'components/Modal'
import Button from 'components/Button'
import style from './style.scss'

export default class WithdrawConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      busy: false
    }
  }

  render() {
    const { busy } = this.state

    return (
      <Modal visible={this.props.visible}
        onClose={::this._onClose}
        dialogClass={style.dialog}
        title="Confirm Withdrawal"
        subTitle="You cannot cancel a withdrawal after confirming, are you sure you want to continue?">

        <table className={style.depositItems}>
          <thead>
            <tr>
              <th width="10%"></th>
              <th>Skin</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {this.props.selectedItems.map(item =>
              <tr key={item.id}>
                <td><img src={item.iconUrl} width="40" /></td>
                <td>{item.name}</td>
                <td>{numeral(item.price).format('0,0.00')}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={style.actionContainer}>
          { !busy ? <Button secondary onClick={::this._onClose}>Cancel</Button> : null }
          { !busy ? <Button primary onClick={::this._onConfirm} disabled={!this.props.selectedItems.length}>Continue</Button> : null }
          { busy ? <Spinner /> : null }
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

  _onConfirm() {
    this.setState({
      busy: true
    })

    this.props.onConfirm()
      .then(() => {
        this.setState({
          busy: false
        })

        this.props.onClose()
      })
      .catch(() => this.setState({
        busy: false
      }))
  }
}
