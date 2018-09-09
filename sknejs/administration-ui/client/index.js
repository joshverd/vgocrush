
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

import { style as toastifyStyle } from 'react-toastify'

toastifyStyle({
  zIndex: 1000100,
  colorError: '#F21439'
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
import RouteDashboard from 'containers/RouteDashboard'
import RouteBots from 'containers/RouteBots'
import RouteLogin from 'containers/RouteLogin'
import RouteAdmin, { RouteAdminAuthentication } from 'containers/RouteAdmin'
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
//   window.location = `/api/auth`
// }

initializeIcons()

async function run() {
  let session = null

  try {
    session = await api('/api/IUser/GetDetails/v1', {}, {
      disableToast: true
    })

    console.log(session)
  } catch(e) {
  }

  ReactDOM.render(
    <Provider store={store}>
      <Router history={history}>
        { !session ? <Route path="/login" component={RouteLogin} /> : null }

        { session ? <Route path="/" component={App}>
          <IndexRoute component={RouteBots} />
          <Route path="/dashboard" component={RouteDashboard} />
          <Route path="/bots(/:filter)" component={RouteBots} />

          <Route path="/admin" component={RouteAdmin}>
            <Route path="authentication" component={RouteAdminAuthentication} />
          </Route>
        </Route> : null }

        <Redirect from='*' to={!!session ? '/bots' : '/login'} />
      </Router>
    </Provider>,
    document.getElementById('root')
  )
}

run()
