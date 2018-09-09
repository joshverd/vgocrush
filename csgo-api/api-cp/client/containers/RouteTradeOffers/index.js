
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'

import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import api from 'lib/api'
import App from 'containers/App'
import style from './style.css'

class RouteTradeOffers extends Component {
  constructor(props) {
    super(props)

    this.state = {
    }
  }

  componentDidMount() {
    App.setTitle('Trade Offers')
  }

  render() {
    return (
      <div>
        <CommandBar
          isSearchBoxVisible={ true }
          searchPlaceholderText='Steam or offer ID...'

          items={[]}
          farItems={[]} />

        <div className={style.container}>
          <div className={style.nothingToDisplay}>Nothing to display, try searching for a valid Steam ID or trade offer id</div>
        </div>
      </div>
    )
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteTradeOffers))
