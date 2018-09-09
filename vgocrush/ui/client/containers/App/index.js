
import React, { Component } from 'react'
import { connect } from 'react-redux'
import cn from 'classnames'
import { ToastContainer, toast } from 'react-toastify'
import PropTypes from 'prop-types'

import TradeUrlModal from 'components/TradeUrlModal'
import SupportModal from 'components/SupportModal'
import ProvablyFairModal from 'components/ProvablyFairModal'
import LoginNoticeModal from 'components/LoginNoticeModal'
import Chat from './Chat'
import GlobalNav from './GlobalNav'
import GlobalBanner from './GlobalBanner'
import LoginOverlay from './LoginOverlay'
import ChristmasRaffle from './ChristmasRaffle'
import AcceptTermsModal from './AcceptTermsModal'
import style from './style.scss'

class App extends Component {
  static childContextTypes = {
    switchSettingsTab: PropTypes.func
  }

  constructor(props) {
    super(props)

    var blockedCountries = {"DK":true,"NO":true}

    this.state = {
      viewAccount: false,
      accountModalTab: 'bets',
      viewProvablyFair: false,
      viewSupport: false,
      viewLoginNotice: (blockedCountries[window.sessionData.countryCode] ? true : false),

      showChristmasRaffle: props.currentUser.sessionFlashes.showRaffle || false
    }
  }

  componentDidMount() {
    this._hideLoader()

    if(this.props.currentUser.sessionFlashes.twitterNotFollow) {
      toast('Please follow our Twitter first before claiming reward')
    }

    if(this.props.currentUser.sessionFlashes.twitterFollowed) {
      toast('Free raffle ticket has been claimed!')
    }
  }

  getChildContext() {
    return {
      switchSettingsTab: (tab, open) => {
        this.setState({
          viewAccount: open,
          accountModalTab: tab
        })
      }
    }
  }

  render() {
    const { server, currentUser, playerInventory, pendingOffers, toggles } = this.props
    const path = location.pathname.split('/')

    const inventoryWorth = playerInventory.reduce((t, i) => t + i.price, 0)

    return (
      <div className={style.rootContainer}>

        <div className={style.rootContentContainer}>
          <GlobalBanner banner={toggles.enableBanner} />
          <GlobalNav
            pendingOffers={pendingOffers}
            currentUser={currentUser}
            toggleProvablyFairModal={::this._toggleProvablyFairModal}
            toggleRaffle={::this._toggleRaffle}
            toggleViewAccount={() => this.setState({ viewAccount: !this.state.viewAccount })}
            toggleSupportModal={() => this.setState({ viewSupport: !this.state.viewSupport })} />

          <div className={style.rootContent}>
            { currentUser.acceptedTerms ? this.props.children : null }
          </div>
        </div>

        {window.sessionData ?
          <Chat currentUser={currentUser}
            inventoryWorth={inventoryWorth}
            onlineCount={this.props.server.onlineCount} />
        : null}

        <ProvablyFairModal visible={this.state.viewProvablyFair} onClose={() => this.setState({ viewProvablyFair: false })} />
        <TradeUrlModal
          visible={this.state.viewAccount}
          selectedTab={this.state.accountModalTab}
          onTabChange={accountModalTab => this.setState({ accountModalTab })}
          onClose={() => this.setState({ viewAccount: false })} />
        <SupportModal visible={this.state.viewSupport} onClose={() => this.setState({ viewSupport: false })} />

        <LoginNoticeModal visible={this.state.viewLoginNotice} onClose={() => this.setState({ viewLoginNotice: false })} />

        <ChristmasRaffle
          visible={this.state.showChristmasRaffle}
          currentUser={currentUser}
          playerInventory={playerInventory}
          onClose={() => this.setState({ showChristmasRaffle: false })} />

        { !currentUser.acceptedTerms ? <AcceptTermsModal visible={true} onClose={() => this.setState({ showAcceptTerms: false })} /> : null }

        <ToastContainer
          position="top-right"
          type="default"
          autoClose={5000}
          style={{ zIndex: 100 }}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          pauseOnHover />
      </div>
    )
  }

  _toggleRaffle(e) {
    e.preventDefault()

    this.setState({
      showChristmasRaffle: true
    })
  }

  _toggleProvablyFairModal(e) {
    e.preventDefault()

    this.setState({
      viewProvablyFair: !this.state.viewProvablyFair
    })
  }

  _hideLoader(instant = false) {
    const loader = document.getElementById('loader')

    if(loader) {
      if(instant) {
        loader.remove()
        return
      }

      loader.classList.add('finished')

      setTimeout(() => {
        if(loader !== null) {
          loader.remove()
        }
      }, 5000)
    }
  }
}

export function setTitle(title) {
  title = title || 'Discover a better way to upgrade skins'

  if(document.title !== title) {
    document.title = `${title} - VgoCrush`
  }
}

export default connect(
  ({ currentUser, playerInventory, server, pendingOffers, toggles }) => ({ currentUser, server, playerInventory, pendingOffers, toggles }),
)(App)
