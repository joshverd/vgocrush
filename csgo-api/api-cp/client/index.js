
import 'babel-polyfill'

import Chart from 'chart.js'

Object.assign(Chart.defaults.global, {
  defaultColor: 'rgba(0, 150, 136, 0.5)',
  defaultFontFamily: `'Montserrat', sans-serif`,
  defaultFontSize: 16,

  elements: {
    ...Chart.defaults.global.elements,

    line: {
      ...Chart.defaults.global.elements.line,
      backgroundColor: 'rgba(0, 150, 136, 0.3)',
      borderColor: '#009688',
      borderWidth: 2
    }
  }
})

import { Router, Route, IndexRoute, Redirect, browserHistory } from 'react-router'
import { initializeIcons } from '@uifabric/icons'
import { syncHistoryWithStore } from 'react-router-redux'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom'
import React from 'react'

import 'lib/theme'

import { setCurrentUser } from 'reducers/currentUser/actions'
import App, { setTitle } from 'containers/App'
import RouteHome from 'containers/RouteHome'
import RouteStorage from 'containers/RouteStorage'
import RouteToggles from 'containers/RouteToggles'
import RouteRaffle from 'containers/RouteRaffle'
import RoutePlayers from 'containers/RoutePlayers'
import RoutePlayer from 'containers/RoutePlayer'
import RouteItems from 'containers/RouteItems'
import RouteAuditLog from 'containers/RouteAuditLog'
import RouteFAQ from 'containers/RouteFAQ'
import RouteChat from 'containers/RouteChat'
import RoutePromotions from 'containers/RoutePromotions'
import api from 'lib/api'

import store from './store'

const history = syncHistoryWithStore(browserHistory, store)

// function requiresAuthenticaton(state, replace, done) {
//   const { currentUser } = store.getState()
//
//   if(!!currentUser) {
//     return done()
//   }
//
//   const { pathname, search } = state.location
//   window.location = `/api/auth/steam?redirect=${pathname}${search}`
// }

initializeIcons()

api('/api/auth/session')

  .then(response => {
    console.log(response)
    if(!response.user || !(response.user.isMod || response.user.isAdmin)) {
      return
    }

    store.dispatch(setCurrentUser(response.user))
    ReactDOM.render(
      <Provider store={store}>
        <Router history={history}>
          <Route path="/" component={App}>
            <IndexRoute component={RouteHome} />
            <Route path="/home" component={RouteHome} />
            <Route path="/faq" component={RouteFAQ} />
            <Route path="/chat" component={RouteChat} />
            <Route path="/storage" component={RouteStorage} />
            <Route path="/toggles" component={RouteToggles} />
            <Route path="/auditLogs" component={RouteAuditLog} />
            <Route path="/players" component={RoutePlayers} />
            <Route path="/items" component={RouteItems} />
            <Route path="/promotions" component={RoutePromotions} />
            <Route path="/raffles" component={RouteRaffle} />
            <Route path="/players/:playerId(/:page)" component={RoutePlayer} />
            <Redirect from='*' to={ !response.user.isAdmin ? '/players' : '/home' } />
          </Route>
        </Router>
      </Provider>,
      document.getElementById('root')
    )
  })

  .catch(err =>
    console.log('startup error', err)
  )
