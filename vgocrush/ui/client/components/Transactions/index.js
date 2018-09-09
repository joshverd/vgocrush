
import React, { Component } from 'react'

import Modal from '../Modal'
import style from './style.scss'

export default class ProvablyFairModal extends Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <Modal visible={this.props.visible} onClose={this.props.onClose} title="Transactions" subTitle="Recent withdrawals and deposits">
        <table>
          <thead>
            <tr>
              <td width="15%"></td>
              <td width="15%">Date</td>
            </tr>
          </thead>
        </table>
      </Modal>
    )
  }
}
