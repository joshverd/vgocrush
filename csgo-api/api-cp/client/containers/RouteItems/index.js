
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'

import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'

import api from 'lib/api'
import App from 'containers/App'
import style from './style.css'

class RouteItems extends Component {
  constructor(props) {
    super(props)

    this.state = {
      search: '',
      items: [],
      busy: false
    }
  }

  componentDidMount() {
    App.setTitle('Items')

    const searchBox = this._searchBox = this.refs.container.querySelectorAll('.ms-CommandBarSearch-input')[0]

    // searchBox.onkeyup = e => this.setState({
    //   search: e.target.value
    // })

    searchBox.onkeydown = e => {
      if(e.keyCode == 13) {
        this._refresh(e.target.value)
      }
    }
  }

  componentDidUpdate() {
    this._searchBox.disabled = this.state.busy
  }

  render() {
    const { busy, items } = this.state

    return (
      <div ref="container">
        <CommandBar
          isSearchBoxVisible={ true }
          searchPlaceholderText='Item name'

          items={[]}
          farItems={[]} />

        <div className={style.container}>
          { busy ? <Spinner size={ SpinnerSize.large } label="Loading items..." /> : null }

          { !busy ? <table>
            <thead>
              <tr>
                <th width="5%"></th>
                <th width="5%">Price</th>
                <th>Name</th>
                <th>Blocked</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item =>
                <tr key={item.id} style={{ opacity: item.blocked ? 0.5 : 1 }}>
                  <td>
                    <Checkbox checked={!item.blocked} onChange={(e, c) => this._updateItem(item.id, { blocked: !item.blocked })} label="Block" />
                  </td>
                  <td>{numeral(item.price).format('$0,0.00')}</td>
                  <td>{item.name}</td>
                  <td>{item.blocked ? 'BLOCKED' : '-'}</td>
                </tr>
              )}

              { !items.length ? <tr><td colSpan="3">Nothing to display, try searching for a valid CS:GO item</td></tr> : null }
            </tbody>
          </table> : null }
        </div>
      </div>
    )
  }

  _refresh(query) {
    this.setState({
      busy: true
    })

    api('items/search?query=' + query).then(({ items }) => {
      this.setState({
        items,

        busy: false
      })
    }, () => {
      this.setState({
        busy: false
      })
    })
  }

  _updateItem(id, update) {
    this.setState({
      busy: false
    })

    api('items/update/' + id, {
      body: update
    })

    .then(({ item }) =>
      this.setState({
        busy: false,
        items: this.state.items.map(i => {
          if(i.id === item.id) {
            return {
              ...i,
              ...item
            }
          }

          return i
        })
      })
    , () =>
      this.setState({
        busy: false
      })
    )
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteItems))
