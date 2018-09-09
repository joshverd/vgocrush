
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'
import moment from 'moment'
import Chart from 'chart.js'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { TagPicker } from 'office-ui-fabric-react/lib/components/pickers/TagPicker/TagPicker'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import api from 'lib/api'
import App from 'containers/App'
import Stats, { Stat } from 'components/Stats'
import style from './style.css'

const timespanTxt = {
  // 'realtime': 'Realtime',
  'daily': 'Daily',
  'weekly': 'Weekly',
  'monthly': 'Monthly',
  'lifetime': 'Lifetime'
}

class RouteHome extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      loadingCaseStats: true,
      timespan: 'daily',

      chartFilters: [],

      mergedStatsSorted: [],
      mergedStats: {},

      stats: [],
      caseStats: [],

      pauseLive: false
    }
  }

  componentDidMount() {
    App.setTitle('Home')

    this._statsChart = new Chart(this.refs.statsChart, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        hover: {
          mode: 'x-axis'
        },

        tooltips: {
          mode: 'point',
          axis: 'x'
        },

        scales: {
          yAxes: [{
            ticks: {
              beginAtZero:true
            }
          }]
        }
      }
    })

    this._load()
    // this._loadCaseStats()
  }

  render() {
    const { loading, pauseLive, timespan, mergedStats, caseStats, loadingCaseStats } = this.state

    return (
      <div>
        <CommandBar
          isSearchBoxVisible={false}
          items={[{
            key: 'timespan',
            name: `${timespanTxt[timespan]} Statistics`,
            icon: 'Calendar',
            disabled: loading,
            onClick: () => false,
            items: Object.keys(timespanTxt).map(key => ({
              key,
              name: timespanTxt[key],
              onClick: () => this._onTimespanChange(key)
            }))
          }]}

          farItems={[{
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            disabled: loading,
            onClick: e => {
              e.preventDefault()
              this._load()
              this._loadCaseStats()
            }
          }]} />

        <div className={style.container}>
          { loading ? <div className={style.spinner}><Spinner size={ SpinnerSize.large } label="Loading daily statistics" /></div> : null }

          <div className={style.statsContainer}>
            <Stats>
              { false ? <Stat name="G2A Deposits" value={numeral(mergedStats.totalG2ADeposited).format('$0,0.00')} /> : null }
              <Stat name="Skin Deposit" value={numeral(mergedStats.totalSkinDepositedUSD).format('$0,0.00')} />
              <Stat name="Withdrawn" value={numeral(mergedStats.totalWithdrawn).format('$0,0.00')} />
              <Stat name="Estimated Profit" value={numeral(mergedStats.estimatedProfit).format('$0,0.00')} />
              // <Stat name="Items Listed" value={`${numeral(mergedStats.itemListingsCount).format('0,0')} (${numeral(mergedStats.itemListingsValue).format('$0,0.00')})`} />
            </Stats>
          </div>


          <div className={style.chartContainer}>
            <div className={style.chartControls}>
              <TagPicker
                selectedItems={this.state.chartFilters}
                onChange={::this._onFilterUpdated}
                onResolveSuggestions={::this._onFilterChanged}
                getTextFromItem={::this._getTextFromItem}
                pickerSuggestionsProps={{
                  suggestionsHeaderText: 'Available Statistics',
                  noResultsFoundText: 'Could not find statistic'
                }}
                inputProps={{
                  placeholder: 'Filter chart statistics...'
                }}
                itemLimit={5} />
                { false ? <DefaultButton disabled={loading} primary={pauseLive} iconProps={{ iconName: pauseLive ? 'Play' : 'Pause' }} text={pauseLive ? 'Enable Live Updates' : 'Pause'} onClick={() => this.setState({ pauseLive: !pauseLive })} /> : null }
            </div>

            <div className={style.chart}>
              <canvas ref="statsChart" />
            </div>

          </div>

          <div className={style.details}>
            <div className={style.detail}>
              <div className={style.detailHeader}>
                <h1>{timespanTxt[timespan]} Statistics</h1>
                <div>{numeral(mergedStats.userRegistrations).format('0,0')} new user registrations</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Statistic</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                {this.state.mergedStatsSorted.map(([ k, v ]) =>
                  <tr key={k}>
                    <td>{k}</td>
                    <td><b>{numeral(v).format(v % 1 !== 0 ? '$0,0.00' : '0,0')}</b></td>
                  </tr>
                )}
                </tbody>
              </table>
            </div>

            { false ? <div className={style.detail}>
              <div className={style.detailHeader}>
                <h1>{timespanTxt[timespan]} Case Earnings</h1>
                <div>{numeral(mergedStats.totalOpenings).format('0,0')} cases opened / {numeral(mergedStats.caseProfit).format('$0,0.00')} case profit</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Openings</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                { loadingCaseStats ? <tr><td colSpan="3"><Spinner size={SpinnerSize.large} /></td></tr> : null }
                { !this.state.caseStats.length ? <tr><td colSpan="3">Nothing to display</td></tr> : null }
                {this.state.caseStats.map(c =>
                  <tr key={c.id}>
                    <td><Link target="_blank" to={`/case/${c.id}`}>{c.name}</Link></td>
                    <td>{numeral(c.totalOpenings).format('0,0')}</td>
                    <td>{numeral(c.profit).format('$0,0.00')}</td>
                  </tr>
                )}
                </tbody>
              </table>
            </div> : null }
          </div>
        </div>
      </div>
    )
  }

  _load(update = {}) {
    const { timespan, chartFilters } = { ...this.state, ...update }

    this.setState({
      loading: true
    })

    api('stats?ts=' + timespan).then(({ mergedStats, stats }) => {
      if(!chartFilters.length) {
        update.chartFilters = [{
          key: 'estimatedProfit',
          name: 'estimatedProfit'
        }]
      }

      this.setState({
        ...update,
        mergedStats,
        stats,

        mergedStatsSorted: Object.keys(mergedStats).sort().map(k => [k, mergedStats[k]]),
        loading: false
      })

      this._applyFilters(update.chartFilters || chartFilters, stats)
    })
  }

  // _loadCaseStats(update = {}) {
  //   const { timespan } = { ...this.state, ...update }
  //
  //   this.setState({
  //     loadingCaseStats: true
  //   })
  //
  //   api('stats/cases?ts=' + timespan).then(({ stats }) => {
  //     this.setState({
  //       ...update,
  //       caseStats: stats,
  //       loadingCaseStats: false
  //     })
  //   })
  // }

  _onTimespanChange(timespan) {
    this._load({
      timespan
    })

    // this._loadCaseStats({
    //   timespan
    // })
  }

  _onFilterChanged(filter, tagList) {
    return Object
      .keys(this.state.mergedStats)
      .filter(key => {
        if(!!filter && key.toLowerCase().indexOf(filter.toLowerCase()) < 0) {
          return false
        }

        return tagList.filter(i => i.key === key).length === 0
      })
      .map(key => ({
        key,
        name: key
      }))
  }

  _getTextFromItem(item) {
    return item.name
  }

  _onFilterUpdated(chartFilters) {
    this.setState({
      chartFilters
    })

    this._applyFilters(chartFilters, this.state.stats)
  }

  _applyFilters(filters, stats) {
    filters = filters || []

    this._statsChart.data.labels = stats.map(stat => moment(stat.createdAt).format('MMM Do'))
    this._statsChart.data.datasets = filters.map(filter => ({
      label: filter.name,
      data: stats.map(s => s[filter.key] || 0),
      backgroundColor: 'rgba(77, 182, 172, 0.3)'
    }))

    this._statsChart.update()
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteHome))
