
import React, { Component } from 'react'
import cn from 'classnames'

import Button from 'components/Button'
import style from './style.scss'

export default class LoginOverlay extends Component {
  constructor(props) {
    super(props)

    this.state = {
    }
  }

  render() {

    return (
      <div className={style.container}>
        <div className={style.brand}>VgoCrush</div>
        <Button href="/api/auth/steam" className={style.loginButton}><i className="fa fa-steam" /> Login with Steam</Button>
        <div className={style.info}>By signing in with Steam you agree that you have read and accept our <a target="_blank" href="#">Terms of Usage</a> and are at least 18 years old.</div>
      </div>
    )
  }
}
