
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'
import _ from 'underscore'
import moment from 'moment'

import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton'
import { Modal } from 'office-ui-fabric-react/lib/Modal'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { DetailsList, CheckboxVisibility, SelectionMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'

import api from 'lib/api'
import App from 'containers/App'
import Stats, { Stat } from 'components/Stats'
import style from './style.css'

class RouteRaffle extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: false,
      raffles: [],

      showCreateModal: false,
      newRaffle: null
    }
  }

  componentDidMount() {
    App.setTitle('Raffles')

    this._load()
  }

  render() {
    const { loading, busy, newRaffle, raffles } = this.state

    return (
      <div>

        <CommandBar
          isSearchBoxVisible={false}
          items={[{
            key: 'create',
            name: 'Start Raffle',
            icon: 'Add',
            disabled: busy,
            onClick: () =>
              this.setState({
                showCreateModal: true,
                showCreateModalBlocking: true,
                newRaffle: {
                  id: '',
                  name: '',
                  startDate: moment().format('MM/DD/YYYY hh:mm A'),
                  endDate: moment().add(1, 'd').format('MM/DD/YYYY hh:mm A'),
                  prizes: []
                }
              })
          }]}

          farItems={[{
            key: 'refresh',
            name: 'Refresh',
            icon: 'Refresh',
            disabled: loading,
            onClick: e => {
              e.preventDefault()
              this._load()
            }
          }]} />

        <div className={style.container}>
          { loading ? <div className={style.spinner}><Spinner size={ SpinnerSize.large } label="Loading raffles" /></div> : null }

          <div className={style.detail}>
            <div className={style.detailHeader}>
              <h1>Raffles</h1>
              <div>{raffles.reduce((t, r) => t + (r.isActive ? 1 : 0), 0)}/{raffles.length} Currently Active</div>
            </div>
            <div className={style.detailBody}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Total Prizes Value</th>
                    <th>Entries</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {raffles.map(raffle =>
                    <tr key={raffle.id} style={{ opacity: raffle.isActive ? null : 0.5 }}>
                      <td><a href="#" onClick={e => this._showRaffle(e, raffle)}>{raffle.name}</a></td>
                      <td>{numeral(raffle.totalPrizeValue).format('$0,0.00')}</td>
                      <td>{numeral(raffle.totalEntries).format('0,0')}</td>
                      <td>{moment(raffle.startDate).format('MM/DD/YYYY hh:mm A')}</td>
                      <td>{moment(raffle.endDate).format('MM/DD/YYYY hh:mm A')}</td>
                      <td><DefaultButton disabled={busy || raffle.winnersChosen} primary onClick={() => this._chooseWinners(raffle.id)}>Choose Winners</DefaultButton></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Modal isOpen={this.state.showCreateModal}
          onDismiss={() => this.setState({ showCreateModal: false, showCreateModalBlocking: false })}
          isBlocking={this.state.showCreateModalBlocking}
          containerClassName={style.modalContainer}>

          <CommandBar
            isSearchBoxVisible={false}
            items={[{
              key: 'addGift',
              icon: 'Add',
              name: 'Add Gift Prize',
              disabled: (!!newRaffle && newRaffle._disabledEdit) || busy,
              onClick: () => {
                this.setState({
                  newRaffle: {
                    ...this.state.newRaffle,
                    prizes: [
                      ...this.state.newRaffle.prizes,
                      {
                        type: 'gift',
                        maxWinners: '0',
                        value: '0'
                      }
                    ]
                  }
                })
              }
            }]}

            farItems={[{
              key: 'save',
              name: 'Save Raffle',
              icon: 'Save',
              onClick: ::this._createRaffle,
              disabled: (!!newRaffle && newRaffle._disabledEdit) || busy || !this._canCreateRaffle()
            }, {
              key: 'close',
              name: 'Close',
              icon: 'Close',
              onClick: () => this.setState({ showCreateModal: false }),
              disabled: busy
            }]} />

          { !!newRaffle ? <div className={style.modalInnerContainer}>
            <div>
              <div className={style.header}>General</div>
              <div className={style.verticalForm}>
                <div className={style.horizontalForm}>
                  <TextField disabled={busy || newRaffle._disabledEdit} label='ID' value={newRaffle.id} onChanged={v => this._updateRaffle({ id: v })} />
                </div>
              </div>

              <div className={style.verticalForm}>
                <div className={style.horizontalForm}>
                  <TextField disabled={busy || newRaffle._disabledEdit} label='Name' value={newRaffle.name} onChanged={v => this._updateRaffle({ name: v })} />
                </div>
              </div>

              <div className={style.header}>Duration</div>
              <div className={style.verticalForm}>
                <div className={style.horizontalForm}>
                  <TextField disabled={busy || newRaffle._disabledEdit} label='Start Date (MM/DD/YYY HH:MM AM)' value={newRaffle.startDate} onChanged={v => this._updateRaffle({ startDate: v })} />
                </div>
                <div className={style.horizontalForm}>
                  <TextField disabled={busy || newRaffle._disabledEdit} label='End Date (MM/DD/YYY HH:MM AM)' value={newRaffle.endDate} onChanged={v => this._updateRaffle({ endDate: v })} />
                </div>
              </div>
            </div>

            <div className={style.prizesForm}>
              <Stats>
                <Stat name="Total Prize Value" value={numeral(newRaffle._initialPrizeValue).format('$0,0.00')} />
                <Stat name="Total Winners" value={numeral(newRaffle._totalWinners).format('0,0')} />
              </Stats>

              <table>
                <thead>
                  <tr>
                    <td width="15%">Max Winners</td>
                    <td width="80%">Prize Value</td>
                    <td></td>
                    <td></td>
                  </tr>
                </thead>
                <tbody>
                  {newRaffle.prizes.map((prize, i) =>
                    <tr key={i}>
                      <td><TextField disabled={busy || newRaffle._disabledEdit} value={prize.maxWinners} onChanged={v => this._updatePrize(i, { maxWinners: v })} /></td>
                      <td><TextField disabled={busy || newRaffle._disabledEdit} value={prize.value} onChanged={v => this._updatePrize(i, { value: v })} /></td>
                      <td>{((prize._totalValue / newRaffle._initialPrizeValue) * 100).toFixed(2)}%</td>
                      <td>{numeral(prize._totalValue).format('$0,0.00')}</td>
                    </tr>
                  )}

                  { !newRaffle.prizes.length ? <tr>
                    <td colSpan="3"><div className={style.empty}>No prizes have been added</div></td>
                  </tr> : null }
                </tbody>
              </table>
            </div>
          </div> : null }
        </Modal>
      </div>
    )
  }

  _chooseWinners(id)  {
    this.setState({
      busy: true
    })

    api('raffles/chooseWinners/' + id, { method: 'POST' })
      .then(() => {
        this.setState({
          busy: false
        })
      }, () =>
        this.setState({
          busy: false
        })
      )
  }

  _showRaffle(e, raffle) {
    e.preventDefault()

    this.setState({
      showCreateModal: true,
      newRaffle: {
        ...raffle,

        _disabledEdit: true,
        _totalWinners: raffle.prizes.reduce((t, p) => t + p.maxWinners, 0),
        _initialPrizeValue: raffle.totalPrizeValue,

        startDate: moment(raffle.startDate).format('MM/DD/YYYY hh:mm A'),
        endDate: moment(raffle.endDate).format('MM/DD/YYYY hh:mm A'),
        id: raffle.raffleId,

        prizes: raffle.prizes.map(p => ({
          ...p,
          _totalValue: p.value * p.maxWinners
        }))
      }
    })
  }

  _createRaffle() {
    this.setState({
      busy: true
    })

    const { newRaffle: { name, id, startDate, endDate, prizes } } = this.state

    api('raffles/create', {
      body: {
        name,
        id,
        startDate: startDate,
        endDate: endDate,
        prizes: prizes.map(p => ({
          value: parseInt(p.value),
          maxWinners: parseInt(p.maxWinners)
        }))
      }
    })

    .then(({ newRaffle }) => {
      this._load()
    }, () =>
      this.setState({
        busy: false
      })
    )
  }

  _canCreateRaffle() {
    const { newRaffle } = this.state
    return !!newRaffle && newRaffle.name.length && newRaffle.id.length && newRaffle.startDate.length
      && newRaffle.endDate.length && newRaffle._initialPrizeValue > 0 && newRaffle._totalWinners > 0
  }

  _updateRaffle(update) {
    this.setState({
      newRaffle: {
        ...this.state.newRaffle,
        ...update
      }
    })
  }

  _updatePrize(index, update) {
    const prizes = this.state.newRaffle.prizes.map((prize, i) => {
      if(index === i) {
        const newPrize = {
          ...prize,
          ...update
        }

        newPrize._totalValue = parseInt(newPrize.value) * parseInt(newPrize.maxWinners)
        return newPrize
      }

      return prize
    })

    const newRaffle = {
      ...this.state.newRaffle,
      prizes
    }

    newRaffle._initialPrizeValue = prizes.reduce((t, p) => t + p._totalValue, 0)
    newRaffle._totalWinners = prizes.reduce((t, p) => t + parseInt(p.maxWinners), 0)

    this.setState({
      newRaffle
    })
  }

  _onCreateClick() {

  }

  _load() {
    this.setState({
      loading: true,
      busy: true
    })

    api('raffles').then(({ raffles }) => {
      this.setState({
        raffles,

        showCreateModal: false,
        busy: false,
        loading: false
      })
    })
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteRaffle))
