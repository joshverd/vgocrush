
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'
import _ from 'underscore'

import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { Button } from 'office-ui-fabric-react/lib/Button'
import { DetailsList, CheckboxVisibility, SelectionMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import api from 'lib/api'
import App from 'containers/App'
import Stats, { Stat } from 'components/Stats'

import style from './style.css'

const sectionsTxt = {
  'blacklist': 'Phrase Blacklist'
}

class RouteFAQ extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: false,
      blacklist: [],
      section: 'blacklist',
      newPattern: ''
    }
  }

  componentDidMount() {
    App.setTitle('Chat')

    this._onSectionChange('blacklist')
  }

  render() {
    const { loading, busy, section } = this.state

    return (
      <div>

        <CommandBar
          isSearchBoxVisible={false}

          items={[{
            key: 'section',
            name: sectionsTxt[section],
            disabled: busy,
            onClick: () => false,
            items: Object.keys(sectionsTxt).map(key => ({
              key,
              name: sectionsTxt[key],
              onClick: () => this._onSectionChange(key)
            }))
          }]}

          farItems={[]} />

        <div className={style.container}>
          <table>
            <thead>
              <tr>
                <td>Pattern</td>
              </tr>
            </thead>
            <tbody>
              {this.state.blacklist.map(b =>
                <tr key={b.id}><td>{b.pattern}</td></tr>
              )}

              <tr>
                <td>
                  <div className={style.flexMiddle}>
                    <TextField disabled={this.state.busy} placeholder="New Pattern" value={this.state.newPattern} onChanged={v => this.setState({ newPattern: v })} />
                    <Button primary onClick={::this._addBlacklist}>Add</Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  _addBlacklist() {
    this.setState({
      busy: true
    })

    api('chat/addBlacklist', {
      body: {
        newPattern: this.state.newPattern
      }
    })

    .then(() => {
      this.setState({
        busy: false,
        newPattern: '',
        blacklist: this.state.blacklist.concat({
          pattern: this.state.newPattern
        })
      })
    }, () => this.setState({ busy: false }))
  }

  _onSectionChange(section) {
    this.setState({
      busy: true,
      section
    })

    api('chat/blacklist').then(({ blacklist }) => {
      this.setState({
        blacklist,
        busy: false
      })
    })
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteFAQ))
