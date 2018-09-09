
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
import { toast } from 'react-toastify'

import api from 'lib/api'
import style from './style.css'

let _columns = [{
  key: 'state',
  name: 'State',
  fieldName: 'state',
  minWidth: 100,
  maxWidth: 100
}, {
  key: 'mode',
  name: 'Mode',
  fieldName: 'mode',
  maxWidth: 50,
  onRender: item => item.mode || '-'
  // onRender: item => <span>{(item.crashPoint / 100).toFixed(2)}x</span>
}, {
  key: 'price',
  name: 'Price',
  fieldName: 'price',
  maxWidth: 100,
  onRender: item => <span>{numeral(item.price).format('$0,0.00')}</span>
}, {
  key: 'name',
  name: 'Name',
  fieldName: 'name'
}]

export default class Inventory extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: true,
      playerItems: [],
      selection: [],
      newItem: ''
    }

    this._selection = new Selection({
      onSelectionChanged: () => {
        const selection = this._selection.getSelection()

        this.setState({
          selection: selection
        })
      }
    })
  }


  componentDidMount() {
    this._refresh()
  }

  render() {
    const { currentUser } = this.props
    const { loading, selection, busy, playerItems, newItem } = this.state

    if(loading) {
      return <Spinner label='Loading inventory' />
    }

    return (
      <div ref={::this._initSearch} className={style.container}>

        <CommandBar
          className={style.commandBar}
          isSearchBoxVisible={true}
          searchPlaceholderText="Name or USD value"

          farItems={[{
            key: 'lock',
            name: 'Lock',
            icon: 'Lock',
            disabled: busy || !selection.length,
            onClick: () => this._updateState('BUSY')
          }, {
            key: 'unlock',
            name: 'Unlock',
            icon: 'Unlock',
            disabled: busy || !selection.length,
            onClick: () => this._updateState('AVAILABLE')
          }, {
            key: 'remove',
            name: 'Remove',
            icon: 'Delete',
            disabled: busy || !selection.length,
            onClick: ::this._removeItems
          }, {
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            disabled: busy,
            onClick: ::this._refresh
          }]}

          items={[{
            key: 'addItem',
            name: 'Insert Items',
            icon: 'Add',
            disabled: busy || !newItem.length,
            onClick: ::this._addItem
          }]} />

        <div className={style.content}>
          <DetailsList
            setKey='set'
            layoutMode={DetailsListLayoutMode.justified}
            selection={this._selection}
            items={playerItems}
            columns={_columns} />
          </div>
      </div>
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

      if(e.keyCode === 13) {
        this._addItem()
      }

      this.setState({
        newItem: e.target.value
      })
    }
  }

  _addItem() {
    this.setState({
      busy: true
    })

    api('players/addItem/' + this.props.playerId, {
      body: {
        itemName: this.state.newItem
      }
    })

    .then(({ playerItems }) => {
      toast(`Added ${playerItems.length} item(s): ${_.pluck(playerItems, 'name').join(', ')}`)
      this._selection.setItems([])
      this._refresh()
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _removeItems() {
    this.setState({
      busy: true
    })

    api('players/removeItem/', {
      body: {
        playerItemIds: _.pluck(this.state.selection, 'id')
      }
    })

    .then(({ deleted }) => {
      toast(`Removed ${deleted || 0} item(s)`)
      this._selection.setItems([])
      this._refresh()
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _refresh() {
    api('players/items/' + this.props.playerId)
      .then(({ playerItems }) => {
        this.setState({
          playerItems,
          loading: false,
          busy: false
        })
      }, () => this.setState({ loading: false, busy: false }))
  }

  _updateState(state) {
    this.setState({
      busy: true
    })

    api('players/updateItem', {
      body: {
        state,
        playerItemIds: _.pluck(this.state.selection, 'id')
      }
    })

    .then(({ playerItems }) => {
      toast(`Updated ${playerItems.length} item(s)`)
      this._refresh()
    }, () =>
      this.setState({
        busy: false
      })
    )
  }
}
