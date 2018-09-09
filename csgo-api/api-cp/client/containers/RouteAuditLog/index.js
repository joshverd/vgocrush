
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'
import _ from 'underscore'

import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { DetailsList, CheckboxVisibility, SelectionMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { Dropdown, IDropdown, DropdownMenuItemType, IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import api from 'lib/api'
import App from 'containers/App'
import Stats, { Stat } from 'components/Stats'

import style from './style.css'

class RouteAuditLog extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      auditLogs: [],
      action: 'all',
      searchBy: 'any',
      page: 0,
      playerId: ''
    }
  }

  componentDidMount() {
    App.setTitle('Audit Logs')

    this._refresh()
  }

  handlePlayerIdChange(v) {
    this.setState({playerId: v, page: 0}, this._refresh)
  }
  handleActionChanged(v) {
    this.setState({action: v ? v.key : 'all', page: 0}, this._refresh)
  }

  handleSearchByChanged(v) {
    this.setState({searchBy: v ? v.key : 'any', page: 0}, this._refresh)
  }
  render() {
    const { loading, auditLogs } = this.state
    var self = this

    return (
      <div>

        <CommandBar
          isSearchBoxVisible={false}

          items={[, {
            key: 'section',
            name: 'Audit Logs',
            disabled: true,
            onClick: () => false,
            items: [{
              key: 'general',
              name: 'Audit Logs'
            }]
          }
          ]}

          farItems={[]} />

        <div className={style.container}>
          <div className="filters" style={{width: 300}}>
            <TextField label="Player Id" onChanged={this.handlePlayerIdChange.bind(this)} value={this.state.playerId} />
						<Dropdown
								label='Search by...'
								options={
									[
										{ key: 'any', text: 'Player ID' },
										{ key: 'source', text: 'Admin Player ID' },
									]
								}
								onChanged={self.handleSearchByChanged.bind(this)}
							/>
						<Dropdown
								label='Action'
								placeHolder='Filter By Action'
								options={
									[
										{ key: 'all', text: 'All' },
										{ key: 'update', text: 'Update' },
										{ key: 'removeItem', text: 'Remove Item' },
										{ key: 'updateItem', text: 'Update Item' },
										{ key: 'addItem', text: 'Add Item' },
									]
								}
								onChanged={self.handleActionChanged.bind(this)}
							/>
          </div>
					{ self.renderAuditLogsTable() }
        </div>
      </div>
    )
  }

renderAuditLogsTable() {
	const { loading, auditLogs } = this.state
	if (!auditLogs.length) {
		return <div style={{marginTop: 15}}>No results found.</div>
	}
	return (<table>
		<thead>
			<tr>
				<td>Admin</td>
				<td>Target Player</td>
				<td>Action</td>
				<td>Data</td>
				<td>Timestamp</td>
			</tr>
		</thead>
		<tbody>
			{auditLogs.map(q =>
				<tr key={q.id}>
					<td>{q.source.displayName}</td>
					<td>{q.target.displayName}</td>
					<td>{q.type}</td>
					<td>{JSON.stringify(q.data)}</td>
					<td>{q.createdAt}</td>
				</tr>
			)}
		</tbody>
		<tfoot>
			<tr>
				<td>
					{ this.state.page > 1 &&
						 <DefaultButton onClick={() => this.setState({page: this.state.page - 1}, this._refresh)}>Back</DefaultButton>
					}
					<DefaultButton onClick={() => this.setState({page: this.state.page + 1}, this._refresh)}>Next</DefaultButton>
				</td>
			</tr>
		</tfoot>
	</table>)
}

_refresh() {
    var self = this;
    this.setState({
      loading: true
    })

    api(`auditLogs?type=${self.state.action}&source=${self.state.searchBy}&page=${self.state.page}&playerId=${self.state.playerId}`).then(({ auditLogs }) => {
      self.setState({
        auditLogs,
        loading: false
      })
    })
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteAuditLog))
