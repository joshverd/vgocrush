
import React, { Component } from 'react'

import Modal from '../Modal'
import style from './style.scss'

export default class GiftModal extends Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <Modal visible={this.props.visible} onClose={this.props.onClose}>

      </Modal>
    )
  }
}
