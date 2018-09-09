
import React, { Component } from 'react'
import ReactSVG from 'react-svg'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import { ToastContainer } from 'react-toastify'
import { Fabric } from 'office-ui-fabric-react/lib/Fabric'
import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog'
import { Button, PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import App from 'containers/App'
import api from 'lib/api'
import { setServerToken } from 'reducers/server/actions'

import style from './style.css'

class RouteLogin extends Component {

  static contextTypes = {
    router: React.PropTypes.object.isRequired
  }

  constructor(props) {
    super(props)

    this.state = {
      busy: false,

      showTwoFactor: false,
      enablingTwoFactor: false,
      twoFactorCode: '',

      id: '',
      password: ''
    }
  }

  componentDidMount() {
    this._hideLoader()

    App.setTitle('Login')
  }

  render() {
    const { currentUser } = this.props
    const { id, password, twoFactorCode, enablingTwoFactor, busy } = this.state

    const loginDisabled = busy || !id.length || !password.length

    return (
      <Fabric className={style.wrapper}>
        <div className={style.contentContainer}>
          <div className={style.loginContainer}>
          <ReactSVG path="/image/logo_red.svg" wrapperClassName={style.logoWrapper} className={style.logo} />

            { false ? <img className={style.logo} src={require('assets/image/logo_red.svg')} /> : null }
            <form className={style.loginForm}>
              <TextField disabled={busy} autoComplete="off" name="id" value={id} onChanged={v => this.setState({ id: v })} className={style.spaceBottom} label="Username" placeholder="Username" autoFocus />
              <TextField disabled={busy} name="password" type="password" value={password} onChanged={v => this.setState({ password: v })} className={style.spaceBottom} label="Password" placeholder="Password" />
              <PrimaryButton disabled={loginDisabled} type="submit" onClick={::this._login}>{ loginDisabled ? 'Login' : 'Continue' }</PrimaryButton>
            </form>
          </div>
        </div>

        <Dialog
          hidden={!this.state.showTwoFactor}
          onDismiss={() => this.setState({ showTwoFactor: false })}
          modalProps={{ isBlocking: true }}
          dialogContentProps={{
            type: DialogType.largeHeader,
            title: 'Two-Factor Verification',
            subText: 'For your security, please enter your two-factor authentication code to continue'
          }}>

          <form onSubmit={e => e.preventDefault()}>
            <TextField disabled={busy} name="twoFactorCode" autoComplete="off" value={twoFactorCode} onChanged={v => this.setState({ twoFactorCode: v })} placeholder="Authorization Code" autoFocus />

            <DialogFooter>
              <PrimaryButton disabled={busy || twoFactorCode.length !== 6} type="submit" onClick={::this._enableTwoFactor} text={ enablingTwoFactor ? 'Authorizing...' : 'Verify' } />
              <DefaultButton disabled={busy} onClick={() => this.setState({ showTwoFactor: false })} text='Cancel' />
            </DialogFooter>
          </form>
        </Dialog>

        <ToastContainer
          position="top-right"
          type="default"
          autoClose={12000}
          newestOnTop={true}
          hideProgressBar={true}
          closeOnClick
        />
      </Fabric>
    )
  }

  _hideLoader() {
    const loader = document.getElementById('loader')

    if(loader) {
      loader.classList.add('finished')

      setTimeout(() => {
        if(loader !== null) {
          loader.remove()
        }
      }, 2000)
    }
  }

  _login() {
    this.setState({
      busy: true
    })

    const { id, password } = this.state

    api('IAuth/GenerateToken/v1', {
      body: {
        id,
        password
      }
    })

    .then(({ token }) => {
      this.setState({
        token,

        busy: false,
        showTwoFactor: true
      })
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _enableTwoFactor() {
    this.setState({
      busy: true,
      enablingTwoFactor: true
    })

    const { id, token, twoFactorCode } = this.state

    api('IAuth/EnableTwoFactor/v1', {
      body: {
        id,
        token,
        code: twoFactorCode
      }
    })

    .then(({ newToken }) => {
      this.props.dispatch(setServerToken(newToken))
      window.location.reload()
    }, () =>
      this.setState({
        busy: false,
        enablingTwoFactor: false,
        twoFactorCode: ''
      })
    )
  }

}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)(RouteLogin)
