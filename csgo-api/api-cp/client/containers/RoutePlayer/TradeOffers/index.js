
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
  key: 'type',
  name: 'Type',
  fieldName: 'type',
  maxWidth: 100
}, {
  key: 'credited',
  name: 'Credited',
  fieldName: 'credited',
  maxWidth: 50,
  onRender(item) {
    return <span>{item.type === 'DEPOSIT' && item.state === 'ACCEPTED' && !item.credited ? 'No' : '-'}</span>
  }
}, {
  key: 'state',
  name: 'State',
  fieldName: 'state',
  maxWidth: 100
}, {
  key: 'securityToken',
  name: 'Security Token',
  fieldName: 'securityToken',
  maxWidth: 100
}, {
  key: 'createdAt',
  name: 'Date',
  fieldName: 'createdAt',
  minWidth: 200,
  maxWidth: 200,
  onRender(item) {
    return <span>{moment(item.createdAt).format('MM/DD/YYYY hh:mm:ss A')}</span>
  }
}, {
  key: 'items',
  name: 'Items',
  fieldName: 'itemNames',
  isResizable: true
}, {
  key: 'subtotal',
  name: 'Subtotal',
  fieldName: 'subtotal',
  maxWidth: 100,
  onRender(item) {
    return <span>{numeral(item.subtotal).format('$0,0.00')}</span>
  }
}]

const stateOptions = [{
  key: 'ACCEPTED',
  text: 'ACCEPTED'
}]

export default class TradeOffers extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: true,
      groups: [],
      tradeOffers: [],
      filter: '',
      newState: '',
      selection: null,
      details: null
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
    const { loading, filter, selection, details, busy } = this.state

    if(loading) {
      return <Spinner label='Loading offers' />
    }

    const tradeOffers = this.state.tradeOffers.filter(o => {
      if(!filter) {
        return true
      }

      return (o.securityToken || '').toLowerCase().indexOf(filter.toLowerCase()) >= 0
    })

    return (
      <div ref={::this._initSearch} className={style.container}>

        <CommandBar
          className={style.commandBar}
          isSearchBoxVisible={true}
          searchPlaceholderText="Security Token"

          farItems={[ currentUser.isAdmin || currentUser.aai ? {
            key: 'process',
            name: 'Resend Notification',
            icon: 'Refresh',
            disabled: busy || !selection,
            onClick: ::this._showResendNotification
          } : null, {
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            disabled: busy,
            onClick: ::this._refresh
          }].filter(i => !!i)}

          items={[{
            key: 'view',
            name: 'View',
            icon: 'FullScreen',
            disabled: busy || !selection,
            onClick: () => {
              this.setState({ details: selection })
            }
          }, {
            key: 'steamLookup',
            name: 'Steam Lookup',
            icon: 'Search',
            disabled: busy || !selection || !selection.offerId,
            onClick: ::this._steamLookup
          }]} />

        <div className={style.content}>
          <DetailsList
            compact
            setKey='set'
            layoutMode={ DetailsListLayoutMode.justified }
            selectionMode={SelectionMode.single}
            selection={this._selection}
            selectionPreservedOnEmptyClick={true}
            items={tradeOffers}
            columns={_columns} />
          </div>

          <Modal
            containerClassName={style.detailsModal}
            isOpen={this.state.showResendNotificationModal}
            onDismiss={() => this.setState({ showResendNotificationModal: false })}>

            { !!selection ? <div>
             <ComboBox
              label="State"
              value={this.state.newState}
              onChanged={v => this.setState({ newState: v.key })}
              options={[{ key: 'nochange', text: selection.state }, ...stateOptions]} />

              <Button primary disabled={busy} onClick={::this._resendNotification}>Resend</Button>
            </div> : null }

          </Modal>

          <Modal containerClassName={style.detailsModal} isOpen={!!details} onDismiss={() => this.setState({ details: null })}>
            { !busy ? <table>
              <thead>
                <tr>
                  <th width="20%">Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {_.map(details, (v, k) =>
                  <tr key={k}>
                    <td><b>{k}</b></td>
                    <td>{JSON.stringify(v)}</td>
                  </tr>
                )}
              </tbody>
            </table> : <Spinner /> }
          </Modal>
      </div>
    )
  }

  _showResendNotification() {
    this.setState({
      showResendNotificationModal: true,
      newState: this.state.selection.state
    })
  }

  _resendNotification() {
    this.setState({
      busy: true
    })

    api('offers/resendNotification', {
      body: {
        id: this.state.selection.id,
        state: this.state.newState
      }
    })

    .then(({ details }) => {
      this.setState({
        busy: false,
        showResendNotificationModal: false
      })

      this._refresh()
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _steamLookup() {
    this.setState({
      busy: true,
      details: {}
    })

    api('steam/getOffer/' + this.state.selection.id)
      .then(({ details }) => {
        this.setState({
          details,

          busy: false
        })
      }, () =>
        this.setState({
          busy: false,
          details: null
        })
      )
  }

  _initSearch(container) {
    if(!container) {
      return
    }

    const searchBox = container.querySelectorAll('.ms-CommandBarSearch-input')[0]

    if(this._searchBox === searchBox) {
      return
    }

    this._searchBox = searchBox

    searchBox.onkeyup = e => {
      this.setState({
        filter: e.target.value
      })
    }
  }

  _refresh() {
    api('players/tradeOffers/' + this.props.playerId)
      .then(({ tradeOffers }) => {
        tradeOffers = tradeOffers.map(o => ({
          ...o,

          key: o.id,
          credited: (this.props.player.acceptedTradeOfferIds || []).indexOf(o.id) >= 0
        }))

        this.setState({
          tradeOffers,
          loading: false,
          busy: false
        })
      }, () => this.setState({ loading: false, busy: false }))
  }
}
