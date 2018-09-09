
import React from 'react'
import _ from 'underscore'
import moment from 'moment'
import numeral from 'numeral'
import {
  Spinner,
  SpinnerSize
} from 'office-ui-fabric-react/lib/Spinner'
import { DetailsList, DetailsListLayoutMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { SelectionMode } from 'office-ui-fabric-react/lib/Selection'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { Modal } from 'office-ui-fabric-react/lib/Modal'
import { ComboBox } from 'office-ui-fabric-react/lib/ComboBox'
import { Button } from 'office-ui-fabric-react/lib/Button'

import api from 'lib/api'
import style from './style.css'

let _columns = [{
  key: 'createdAt',
  name: 'Date',
  fieldName: 'createdAt',
  minWidth: 200,
  maxWidth: 200,
  onRender(item) {
    return <span>{moment(item.createdAt).format('MM/DD/YYYY hh:mm:ss A')}</span>
  }
}, {
  key: 'crashPoint',
  name: 'Crash Point',
  maxWidth: 100,
  onRender: item => <span>{(item.crashPoint / 100).toFixed(2)}x</span>
}, {
  key: 'status',
  name: 'Status',
  maxWidth: 50,
  onRender: item => {
    const won = item.wager.status === 'cashed_out'
    return <span className={style.gameStatus} style={{ backgroundColor: won ? '#8BC34A' : '#f44336' }}>{won ? 'WON' : 'LOST'}</span>
  }
}, {
  key: 'cashedAt',
  name: 'Cashout',
  maxWidth: 100,
  onRender: item => item.wager.status === 'cashed_out' ? <span>{(item.wager.stoppedAt / 100).toFixed(2)}x</span> : <span>-</span>
}, {
  key: 'autoCashOut',
  name: 'Auto Cashout',
  maxWidth: 100,
  onRender: item => <span>{(item.wager.autoCashOut / 100).toFixed(2)}x</span>
}, {
  key: 'items',
  name: 'Items',
  isResizable: true,
  onRender: item => <span>{item.wager.wagerItemsNames.join(', ')}</span>
}, {
  key: 'wagerTotal',
  name: 'Wager Total',
  maxWidth: 100,
  onRender: item => <span>{numeral(item.wager.wagerTotal).format('$0,0.00')}</span>
}, {
  key: 'profit',
  name: 'Profit',
  maxWidth: 100,
  onRender: item => item.wager.status === 'cashed_out' ? <span>{numeral(item.wager.stoppedAtItemsTotal - item.wager.wagerTotal).format('$0,0.00')} ({numeral(item.wager.stoppedAtItemsTotal).format('$0,0.00')})</span> : <span>-</span>
}]

export default class CrashGameHistory extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: true,
      games: []
    }

    this._selection = new Selection({
      onSelectionChanged: () => {
        const selection = this._selection.getSelection()

        this.setState({
          selection: selection[0] || null
        })
      }
    })
  }


  componentDidMount() {
    this._refresh()
  }

  render() {
    const { currentUser } = this.props
    const { loading, selection, busy, games } = this.state

    if(loading) {
      return <Spinner label='Loading crash games' />
    }

    return (
      <div className={style.container}>

        <CommandBar
          className={style.commandBar}

          farItems={[{
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            disabled: busy,
            onClick: ::this._refresh
          }]}

          items={[{
            key: 'selection',
            name: !!selection ? `${(selection.crashPoint / 100).toFixed(2)}x` : 'No Selection',
            disabled: true,
            onClick: () => {}
          }]} />

        <div className={style.content}>

          <div className={style.preview}>
            { !!selection ? <div className={style.upgrade}>
              <div className={style.upgradeItems}>
                <table>
                  <thead>
                    <tr>
                      <td>Name</td>
                      <td>Price</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="2" style={{ textAlign: 'right' }}>{numeral(selection.wager.wagerTotal).format('$0,0.00')}</td>
                    </tr>

                    {selection.wager.wagerItems.map((item, i) =>
                      <tr key={i}>
                        <td><img key={i} src={item.iconUrl} width="20" /> {item.name}</td>
                        <td>{numeral(item.price).format('$0,0.00')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className={style.upgradeDivider} />
              <div className={style.upgradeItems}>
                <table>
                  <thead>
                    <tr>
                      <td>Name</td>
                      <td>Price</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="2">{numeral(selection.wager.stoppedAtItemsTotal).format('$0,0.00')}</td>
                    </tr>

                    {selection.wager.status === 'cashed_out' ? selection.wager.stoppedAtItems.map((item, i) =>
                      <tr>
                        <td><img key={i} src={item.iconUrl} width="20" /> {item.name}</td>
                        <td>{numeral(item.price).format('$0,0.00')}</td>
                      </tr>
                    ) : []}
                  </tbody>
                </table>
              </div>
            </div> : <div className={style.upgradeEmpty}>Nothing selected</div> }
          </div>

          <DetailsList
            setKey='set'
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.single}
            selection={this._selection}
            selectionPreservedOnEmptyClick={true}
            items={games}
            columns={_columns} />
          </div>
      </div>
    )
  }

  _refresh() {
    api('players/crash/history/' + this.props.playerId)
      .then(({ games }) => {
        this.setState({
          games,
          loading: false,
          busy: false
        })
      }, () => this.setState({ loading: false, busy: false }))
  }
}
