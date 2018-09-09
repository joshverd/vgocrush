
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'

import App from 'containers/App'
import style from './style.css'

class RouteAuthentication extends Component {
  constructor(props) {
    super(props)

    this.state = {
    }
  }

  componentDidMount() {
    App.setTitle('Authentication')
  }

  render() {
    return (
      <div>test
      </div>
    )
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteAuthentication))
