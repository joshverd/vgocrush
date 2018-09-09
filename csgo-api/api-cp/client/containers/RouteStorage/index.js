
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'

import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import api from 'lib/api'
import App from 'containers/App'
import Stats, { Stat } from 'components/Stats'
import style from './style.css'

class RouteStorage extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      bots: []
    }
  }

  componentDidMount() {
    App.setTitle('Storage')

    this._load()
  }

  render() {
    const { loading, bots } = this.state

    return (
      <div>

        <div className={style.container}>
          { loading ? <div className={style.spinner}><Spinner size={ SpinnerSize.large } label="Loading storage" /></div> : null }

          <div className={style.statsContainer}>
            <Stats>
              <Stat name="Bots" value={numeral(bots.length).format('0,0')} />
              <Stat name="Storage Value" value={numeral(bots.reduce((t, b) => t + b.estimatedValue, 0)).format('$0,0.00')} />
            </Stats>
          </div>

          <div className={style.details}>
            {bots.map(bot =>
              <div key={bot.id} className={style.detail}>
                <div className={style.detailHeader}>
                  <h1>{bot.name} ({bot.username})</h1>
                  <div>{bot.steamId64}</div>
                </div>
                <div className={style.detailBody}>
                  <div className={style.estimatedValue}>{numeral(bot.estimatedValue).format('$0,0.00')}</div>
                  <div className={style.itemCount}>{numeral(bot.itemCount).format('0,0')}/1000</div>
                </div>
                <div className={style.detailActions}>
                  <DefaultButton primary href={bot.tradeLink} target="_blank" text="Open Trade URL" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  _load() {
    this.setState({
      loading: true
    })

    api('storage').then(({ bots }) => {
      this.setState({
        bots,

        loading: false
      })
    })
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteStorage))
