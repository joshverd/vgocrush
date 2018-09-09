
console.log('%cStop! Do not send anyone your cookies or paste any code in here or your account may be at risk! ', 'color: red; font-size: 30px; font-weight: bold;');

import 'babel-polyfill'

import 'assets/fonts/fonts.css'
import 'assets/style/style.scss'

import 'lib/animation'

import numeral from 'numeral'
import moment from 'moment'

const defaultRounding = n => Math.floor(n, -2)

numeral.fn._format = numeral.fn.format
numeral.fn.format = function(a, b) {
  return numeral.fn._format.call(this, a, b || defaultRounding)
}

import { Router, Route, IndexRoute, Redirect, browserHistory } from 'react-router'
import { syncHistoryWithStore } from 'react-router-redux'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom'
import React from 'react'

import App from './containers/App'
import RoutePlay from './containers/RoutePlay'
import RouteJackpot from './containers/RouteJackpot'
import TermsOfUsage from './containers/TermsOfUsage'
import LoginScreen from './containers/LoginScreen'

import { setCurrentUser } from 'reducers/currentUser/actions'
import { setPlayerInventory } from 'reducers/playerInventory/actions'
import { setPendingOffers } from 'reducers/pendingOffers/actions'
import * as serverActions from 'reducers/server/actions'
import { setToggles } from 'reducers/toggles/actions'

import api from 'lib/api'
import socket from 'lib/socket'

import store from './store'

const history = syncHistoryWithStore(browserHistory, store)

function requiresAuthenticaton(state, replace, done) {
  const { currentUser } = store.getState()

  if(!!currentUser) {
    return done()
  }

  replace('/welcome')
  done()
}

function requiresGuest(state, replace, done) {
  const { currentUser } = store.getState()

  if(!!currentUser) {
    replace('/')
    return done()
  }

  done()
}

// setInterval(function(){
//   if(!Tawk_API) return;
//   if(Tawk_API.isChatHidden()){
//     // do something if chat widget is hidden
//   } else {
//     Tawk_API.toggleVisibility();
//   }
// },500)

function refreshSession() {
  const start = Date.now()

  return api('auth/session').then(response => {

    window.sessionData = response;
    // var interval = setInterval(function(){
    //   if(Tawk_API) {
    //     Tawk_API.setAttributes({
    //         'name'  : response.user.username,
    //         'steamid64' : response.user.id+"-"+response.user.username
    //     }, function(error){});
    //     clearInterval(interval)
    //     console.log("donezo")
    //   }
    // },1000)

    const end = Date.now()
    const offset = (new Date(response.serverTime).getTime() - end - (start - end))
    console.log(offset)
    moment.now = () => offset + Date.now()

    // window.countryCode = response.countryCode;
    // T.setTexts(response.translations)
    store.dispatch(setCurrentUser(response.user))
    store.dispatch(serverActions.setValue(response.server))

    if(!!response.toggles) {
      store.dispatch(setToggles(response.toggles))
    }

    if(!!response.user) {
      store.dispatch(setPlayerInventory(response.inventory))
      store.dispatch(setPendingOffers(response.pendingOffers))

      try {
        if(response.user.newRegistration) {
          ga('send', 'event', "registration_complete", "registration_complete");
          fbq('track', 'CompleteRegistration');
          try{
            __adroll.record_user({"adroll_segments": "7fb38d63"})
          } catch(err) {}
        }
      } catch(e) {
        console.log('session', e)
      }
    }
  })
}

socket.on('reconnect', () => refreshSession())

refreshSession().then(() => {
  ReactDOM.render(
    <Provider store={store}>
      <Router history={history}>
        <Route path="/welcome" component={LoginScreen} onEnter={requiresGuest} />
        <Route path="/terms-of-use" component={TermsOfUsage} />
        <Route path="/" component={App} onEnter={requiresAuthenticaton}>
          <IndexRoute component={RoutePlay} />
          <Route path="/play" component={RoutePlay} />
          <Route path="/jackpot(/:gameMode)" component={RouteJackpot} />
        </Route>
        <Redirect from='*' to='/' />
      </Router>
    </Provider>,
    document.getElementById('root')
  )
})
