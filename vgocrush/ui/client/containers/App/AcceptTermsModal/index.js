
import React, { Component } from 'react'
import { Link } from 'react-router'

import Modal from 'components/Modal'
import Button from 'components/Button'
import api from 'lib/api'

import style from './style.scss'

export default class AcceptTermsModal extends Component {
  constructor(props) {
    super(props)

    this.state = {
      busy: false,
      underAged: false,
      month: 0,
      day: 0,
      year: 0
    }
  }

  render() {
    const { busy, underAged } = this.state
    const modalHeader = !underAged ? <Button large secondary href="/api/auth/logout" ><i className="fa fa-sign-out" /> Sign Out</Button> : null

    return (
      <Modal
        fullscreen
        visible={this.props.visible}
        onClose={this.props.onClose}
        title={ !underAged ? "Age Verification" : null }
        subTitle={ !underAged ? "Please enter your date of birth below to continue" : null }
        header={modalHeader}>
        { !underAged ? <div className={style.container}>
          <div className={style.form}>
            <img className={style.logo} src="/image/logo/logomark.svg" />

            <select disabled={busy} name="month" value={this.state.month} onChange={::this._onDateChange}>
              <option value="null">Month</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <select disabled={busy} name="day" value={this.state.day} onChange={::this._onDateChange}>
              <option value="null">Day</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
              <option value="12">12</option>
              <option value="13">13</option>
              <option value="14">14</option>
              <option value="15">15</option>
              <option value="16">16</option>
              <option value="17">17</option>
              <option value="18">18</option>
              <option value="19">19</option>
              <option value="20">20</option>
              <option value="21">21</option>
              <option value="22">22</option>
              <option value="23">23</option>
              <option value="24">24</option>
              <option value="25">25</option>
              <option value="26">26</option>
              <option value="27">27</option>
              <option value="28">28</option>
              <option value="29">29</option>
              <option value="30">30</option>
              <option value="31">31</option>
            </select>
            <select disabled={busy} name="year" value={this.state.year} onChange={::this._onDateChange}>
              <option value="null">Year</option>
              <option value="2018">2018</option>
              <option value="2017">2017</option>
              <option value="2016">2016</option>
              <option value="2015">2015</option>
              <option value="2014">2014</option>
              <option value="2013">2013</option>
              <option value="2012">2012</option>
              <option value="2011">2011</option>
              <option value="2010">2010</option>
              <option value="2009">2009</option>
              <option value="2008">2008</option>
              <option value="2007">2007</option>
              <option value="2006">2006</option>
              <option value="2005">2005</option>
              <option value="2004">2004</option>
              <option value="2003">2003</option>
              <option value="2002">2002</option>
              <option value="2001">2001</option>
              <option value="2000">2000</option>
              <option value="1999">1999</option>
              <option value="1998">1998</option>
              <option value="1997">1997</option>
              <option value="1996">1996</option>
              <option value="1995">1995</option>
              <option value="1994">1994</option>
              <option value="1993">1993</option>
              <option value="1992">1992</option>
              <option value="1991">1991</option>
              <option value="1990">1990</option>
              <option value="1989">1989</option>
              <option value="1988">1988</option>
              <option value="1987">1987</option>
              <option value="1986">1986</option>
              <option value="1985">1985</option>
              <option value="1984">1984</option>
              <option value="1983">1983</option>
              <option value="1982">1982</option>
              <option value="1981">1981</option>
              <option value="1980">1980</option>
              <option value="1979">1979</option>
              <option value="1978">1978</option>
              <option value="1977">1977</option>
              <option value="1976">1976</option>
              <option value="1975">1975</option>
              <option value="1974">1974</option>
              <option value="1973">1973</option>
              <option value="1972">1972</option>
              <option value="1971">1971</option>
              <option value="1970">1970</option>
              <option value="1969">1969</option>
              <option value="1968">1968</option>
              <option value="1967">1967</option>
              <option value="1966">1966</option>
              <option value="1965">1965</option>
              <option value="1964">1964</option>
              <option value="1963">1963</option>
              <option value="1962">1962</option>
              <option value="1961">1961</option>
              <option value="1960">1960</option>
              <option value="1959">1959</option>
            </select>

            <Button disabled={!this._canContinue()} onClick={::this._verifyAge} large rounded><i className="fa fa-check" /> Continue</Button>
            <p>By continuing you also agree that you have read and agree with our <Link target="_blank" to="/terms-of-use">Terms of Usage</Link>.</p>
          </div>
        </div> : <div className={style.underAge}>
          <div className={style.form}>
            <p>You must be at least 18 years of age to use this website, you have been automatically signed out. Goodbye.</p>
            <Button large primary rounded href="/">Exit</Button>
          </div>
        </div> }
      </Modal>
    )
  }

  _onDateChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    })
  }

  _canContinue() {
    const { busy, year, day, month } = this.state
    return !busy && !!year && !!day && !!month
  }

  _verifyAge() {
    this.setState({
      busy: true
    })

    const { month, day, year } = this.state

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getUTCMonth() + 1
    let age = currentYear - year

    if(month < currentMonth) {
      age--
    }

    if(age < 18) {
      this.setState({
        underAged: true
      })

      return api('auth/logout?noRedirect=1')
    }

    api('users/acceptTerms', { method: 'POST' })

    .then(() => window.location.reload(), () =>
      this.setState({
        busy: false
      })
    )
  }
}
