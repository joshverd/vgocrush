import React, { Component } from 'react'

import Button from 'components/Button'
import Modal from '../Modal'
import style from './style.scss'

export default class LoginNoticeModal extends Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <Modal visible={this.props.visible} onClose={this.props.onClose} title="Your country is blocked.">
      	<p className={style.lead}>We’re sorry, we are not currently accepting players from your country.</p>
      	<p>VgoCrush is a pioneering company operating in an innovative space where discussions of appropriate legal regulations are ongoing. VgoCrush seeks to operate in compliance with all state, federal, and international laws.  However, these laws vary jurisdiction by jurisdiction.  While many countries and jurisdictions have clear legislation or legal precedent in place that protects VgoCrush contests, some locales require more legal clarity before we can operate in them. Thus, we are not accepting users from countries where politicians or other officials have made statements calling into question the legality of skins games. VgoCrush is monitoring developments in this dynamic industry and will act quickly to ensure it is in compliance with the laws where it operates.  As any changes in the law take place or regulations are implemented, VgoCrush will take steps to ensure its continued compliance, and changes to this site or its users’ access may take place to reflect any such new laws or regulations.</p>
      	<p className={style.lead}>You will not be able to play the game, but you can take a look around.</p>
      	<Button primary onClick={this.props.onClose}>Close Notice</Button>
      </Modal>
    )
  }

}
