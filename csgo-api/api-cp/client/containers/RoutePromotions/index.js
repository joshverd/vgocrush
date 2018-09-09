
import React, { Component } from 'react'
import { connect } from 'react-redux'
import numeral from 'numeral'

import { DetailsList, DetailsListLayoutMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { SelectionMode } from 'office-ui-fabric-react/lib/Selection'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'

import api from 'lib/api'
import App from 'containers/App'

import AddPromotionModal from './addPromotionModal'
import style from './style.css'

let _columns = [{
  key: 'name',
  name: 'Name',
  fieldName: 'name'
}, {
  key: 'code',
  name: 'Code',
  fieldName: 'code',
  maxWidth: 100
}, {
  key: 'type',
  name: 'Type',
  fieldName: 'type',
  maxWidth: 100
}, {
  key: 'value',
  name: 'Value',
  fieldName: 'value',
  maxWidth: 100,
  onRender(item) {
    return <span>{numeral(item.value).format('$0.00')}</span>
  }
}, {
  key: 'usages',
  name: 'Usages',
  maxWidth: 100,
  onRender(item) {
    return <span>{item.usages}/{item.maxUsages <= 0 ? '-' : item.maxUsages}</span>
  }
}]

class RoutePromotions extends Component {
  constructor(props) {
    super(props)

    this.state = {
      busy: true,
      promotions: [],
      showCreateModal: false,
      selection: null
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
    App.setTitle('Promotions')
    this._refresh()
  }

  render() {
    const { busy, promotions, selection } = this.state

    return (
      <div>
        <CommandBar
          isSearchBoxVisible={false}
          items={[{
            key: 'delete',
            name: 'Delete Promotion',
            icon: 'Delete',
            disabled: busy || !selection,
            onClick: ::this._deletePromotion
          }]}

          farItems={[{
            key: 'addPromotion',
            name: 'Add Promotion',
            icon: 'Add',
            disabled: busy,
            onClick: () => this.setState({ showCreateModal: true })
          }, {
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            onClick: ::this._refresh,
            disabled: busy
          }]} />

        <div className={style.container}>
          <DetailsList
            compact
            setKey='set'
            layoutMode={ DetailsListLayoutMode.justified }
            selectionMode={SelectionMode.single}
            selection={this._selection}
            selectionPreservedOnEmptyClick={true}
            items={promotions}
            columns={_columns} />
        </div>

        <AddPromotionModal
          visible={this.state.showCreateModal}
          onDismiss={() => this.setState({ showCreateModal: false })}
          refresh={::this._refresh} />
      </div>
    )
  }

  _refresh() {
    this.setState({
      busy: true
    })

    api('promotions').then(({ promotions }) => {
      this.setState({
        promotions,
        busy: false
      })
    })
  }

  _deletePromotion() {
    this.setState({
      busy: true
    })

    api('promotions/delete', {
      body: {
        id: this.state.selection.id
      }
    })

    .then(() => {
      this._refresh()
    }, () =>
      this.setState({
        busy: false
      })
    )
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RoutePromotions))
