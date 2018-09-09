
import React, { Component } from 'react'
import { Link } from 'react-router'
import cn from 'classnames'
import { toast } from 'react-toastify'
import { ToastContainer } from 'react-toastify'
import { connect } from 'react-redux'

import { hideLoader } from 'lib/loader'
import Button from 'components/Button'
import Modal from 'components/Modal'
import api from 'lib/api'
import { setTitle } from 'containers/App'
import style from './style.scss'

class LoginScreen extends Component {
  constructor(props) {
    super(props)

    this.state = {
      busy: false,
      showAgeVerification: false,
      passedAgeGate:(window.localStorage.passedAgeGate == '1' ? true : false),
      underageUser: false,
      text: '',
      month: 0,
      day: 0,
      year: 0,
      loginDetails: null
    }
    this.dobChange = this.dobChange.bind(this);
  }

  dobChange(event) {
    this.setState({ [event.target.name]: event.target.value });
  }

  componentDidMount() {
    setTitle('VgoCrush | Discover a better way to upgrade skins')

    hideLoader()
  }

  _onChangeFunc(what,val){
    this.state.dob[what] = val;
  }

  render() {
    const { text, loginDetails, showAgeVerification, month, day, year, underageUser } = this.state
    const { toggles } = this.props


    return (
      <div className={style.rootContainer}>
        <div className={[style.rootContentContainer, 0, ( showAgeVerification ? style.darkerBg:""), ( underageUser ? style.darkerBgdarkerBg:"")].join(' ')}>
          <img className={style.logo} src="/logo.svg" />
          {!showAgeVerification ? <div> <Button onClick={::this._verifyAge} className={style.loginButton}><i className="fa fa-steam" /> Sign in with Steam</Button>
          <div className={style.info}>By signing in with Steam you agree that you have read and accept our <Link target="_blank" to="/terms-of-use">Terms of Usage</Link> and are at least 18 years old.</div>

          { toggles.enableAlternateAuth ? <div className={style.alternateLogin}>
            <div className={style.info}>OpenID not working? Enter your SteamID64 or Steam profile URL below to begin an alternate login method.</div>
            <input type="text" placeholder="http://steamcommunity.com/id/yourCustomUrlHere/ or 76561198045555555" value={text} onChange={e => this.setState({ text: e.target.value })}/>
            <Button disabled={this.state.busy || !text.length} className={style.loginButton} onClick={::this._getAlternateCode}>Begin Alternate Login</Button>
          </div> : null } </div> : null}


          { showAgeVerification && !underageUser ?
            <div className={style.ageVerfication}>
              <h3>You must be of legal age to enter this site</h3>
              <h4>Please enter your date of birth</h4>
              <div className={style.dobSelect}>
                <select name="month" value={month} onChange={this.dobChange}>
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
                <select name="day" value={day} onChange={this.dobChange}>
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
                <select name="year" value={year} onChange={this.dobChange}>
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
              </div>
              <Button onClick={::this._verifyAgeTwo} className={style.loginButton}><i className="fa fa-steam" /> Sign in with Steam</Button>
            </div>
          : null}

          { underageUser ?
            <div className={style.ageVerfication}>
              <h3>Unfortunately, you are not old enough yet</h3>
             </div>
          : null}
        </div>


        { toggles.enableAlternateAuth ? <Modal dialogClass={style.altLoginModal} visible={!!loginDetails} onClose={() => this.setState({ loginDetails: null })}>
          { !!loginDetails ? <p>Your current Steam Profile Name is <b>{loginDetails.displayName}</b>. To verify your identity, please <a href="http://steamcommunity.com/id/me/edit#real_name" target="_blank">change your Steam Profile Name or Real Name</a> to <b>"{loginDetails.loginName}"</b> and click the button below.</p> : null }
          <Button disabled={this.state.busy} primary onClick={::this._verifyAlt}>Verify Identity</Button>
        </Modal> : null }

        <ToastContainer
          position="top-right"
          type="default"
          autoClose={5000}
          style={{ zIndex: 100 }}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          pauseOnHover />
      </div>
    )
  }

  _verifyAlt() {
    this.setState({
      busy: true
    })

    api('auth/alternateVerify', {
      body: {
        account: this.state.text
      }
    })

    .then(loginDetails => {
      window.location.reload()
    }, () => this.setState({ busy: false }))
  }

  _verifyAge() {
    if(this.state.passedAgeGate != '1') {
      this.setState({
        busy: true,
        showAgeVerification: true
      })
    } else window.location = "/api/auth/steam";


  }

  _verifyAgeTwo() {
    this.setState({
      busy: true,
    })
    const { month, day, year } = this.state
    if(!month || !year || !day) return alert("Must enter date of birth to verify age.");

    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    var currentMonth = currentDate.getUTCMonth() + 1;
    var currentDay = currentDate.getUTCDate();
    var age = currentYear - year;
    if (currentMonth > month) {

    } else {
      if (currentDay >= day) {

      } else {
        age--;
      }
    }

    if(age < 18) {
      console.log("Underage!")
      this.setState({
        busy: false,
        underageUser: true
      })
    } else {
      window.localStorage.passedAgeGate = '1';
      window.location = "/api/auth/steam";
    }
  }

  _getAlternateCode() {
    this.setState({
      busy: true
    })

    api('auth/alternateResolve', {
      body: {
        account: this.state.text
      }
    })

    .then(loginDetails => {
      this.setState({
        loginDetails,
        busy: false
      })
    }, () => this.setState({ busy: false }))
  }
}

export default connect(
  ({ toggles }) => ({ toggles }),
)(LoginScreen)
