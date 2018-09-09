
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'
import _ from 'underscore'

import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { DetailsList, CheckboxVisibility, SelectionMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import api from 'lib/api'
import App from 'containers/App'
import Stats, { Stat } from 'components/Stats'
import style from './style.css'

class RouteToggles extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: false,

      availableToggles: [],
      disabled: []
    }
  }

  componentDidMount() {
    App.setTitle('Toggles')

    this._load()
  }

  render() {
    const { loading, availableToggles, disabled, busy } = this.state

    return (
      <div>

        <div className={style.container}>
          { loading ? <div className={style.spinner}><Spinner size={ SpinnerSize.large } label="Loading toggles" /></div> : null }

          <div className={style.detail}>
            <div className={style.detailHeader}>
              <h1>Toggles</h1>
              <div>Enable/Disable API features</div>
            </div>
            <div className={style.detailBody}>
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Custom Message</th>
                  </tr>
                </thead>
                <tbody>
                  {availableToggles.map(toggle =>
                    <tr key={toggle.key}>
                      <td>
                        <Checkbox
                          disabled={busy}
                          label={toggle.name}
                          onChange={e => this._onToggle(e, toggle)}
                          checked={!toggle.defaultDisabled ? disabled.indexOf(toggle.key) < 0 : disabled.indexOf(toggle.key) >= 0} />
                      </td>
                      <td style={{ opacity: disabled.indexOf(toggle.key) >= 0 ? 1 : 0.5 }}>
                        { toggle.hasCustomMessage ? <TextField disabled={busy} value={toggle.value} onChanged={v => this._updateToggle(toggle.key, v)} /> : null }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  _updateToggle(k, v) {
    console.log('test')

    this.setState({
      availableToggles: this.state.availableToggles.map(t => {
        if(t.key === k) {
          return {
            ...t,
            value: v
          }
        }

        return t
      })
    })
  }

  _onToggle(e, toggle) {
    this.setState({
      busy: true
    })

    api('toggles', {
      body: {
        toggle: toggle.key,
        customMessage: toggle.value
      }
    })

    .then(({ enabled }) => {
      this.setState({
        busy: false,
        disabled: enabled ? this.state.disabled.concat([ toggle.key ]) : this.state.disabled.filter(d => d !== toggle.key)
      })
    })
  }

  _load() {
    this.setState({
      loading: true
    })

    api('toggles').then(({ availableToggles, disabled }) => {
      this.setState({
        availableToggles,
        disabled,

        loading: false
      })
    })
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteToggles))
