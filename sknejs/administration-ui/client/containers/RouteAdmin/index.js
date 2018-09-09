
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'

import App from 'containers/App'

export RouteAdminAuthentication from './RouteAuthentication'

import style from './style.css'

class RouteDashboard extends Component {
  constructor(props) {
    super(props)

    this.state = {
    }
  }

  componentDidMount() {
  }

  render() {
    return (
      <div>
        {this.props.children}
      </div>
    )
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteDashboard))
