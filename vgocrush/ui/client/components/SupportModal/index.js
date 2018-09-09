
import React, { Component } from 'react'
import { toast } from 'react-toastify'

import Button from 'components/Button'
import Spinner from 'components/Spinner'
import api from 'lib/api'

import Modal from '../Modal'
import style from './style.scss'

const faqQuestionsOld = [
  ['Is this game provably fair?', 'Yes, you can read more about our provably fair system by clicking "Provably Fair" up top.'],
  ["My withdrawal got canceled/declined?","You can always retry the trade by going to your account > withdrawals and hitting retry."],
  ["My trade keeps getting canceled (After Retrying)?","Most likely means that your trade URL is invalid, or you're unable to trade. To test this, ask a friend to trade with you using the URL you provided us. If it turns out your trade URL is functioning, then shoot us a message and we'll help out."],
  ["Where can I track the status of my withdraw request?","You can go to 'Account' on the top nav, and hit 'withdrawals'."],
  ["Unavailable items.", "This means that the item is not available for withdraw at the moment. We try to keep as many items in stock as we can. You can always exchange your item if you don't want to wait."],
  ["I exchanged but lost money?","When you exchange, the balance left over does not get put into your account."],
  ["I withdrew, but I didn't want to.","We cannot return withdrawals even if they were by accident."],
  ["How much is the minimum to deposit?","Currently, minimum to deposit is 0.30 credits per item."]
]

export default class SupportModal extends Component {
  constructor(props) {
    super(props)

    this.state = {
      busy: false,
      selectedTab: 'faq',
      faqQuestions: [],
      contactMessage: '',
      contactName: '',
      contactEmail: '',
      contactSubject: '',
      liveSupport: false
    }
  }

  componentDidMount() {
    if(this.props.visible) {
      this._onTabChange(this.state.selectedTab)
    }
  }

  render() {
    const { busy, selectedTab, contactName, contactEmail, contactSubject, contactMessage, faqQuestions, liveSupport } = this.state

    return (
      <Modal
        visible={this.props.visible}
        onClose={this.props.onClose}
        selectedTab={selectedTab}
        onTabChange={::this._onTabChange}
        onVisibilityChange={::this._onVisibilityChange}
        tabs={[{ key: 'faq', name: 'F.A.Q' }, { key: 'contact', name: 'Contact Us' }]}>

        { selectedTab === 'faq' ? <div className={style.faq}>

          {faqQuestions.map((q, i) =>
            <div key={i}>
              <h3>{q.question}</h3>
              <p>{q.answer}</p>
            </div>
          )}

        </div> : null }

        { selectedTab === 'contact' ? <div className={style.contactUs}>

          <div>
            { liveSupport ? <div className={style.liveSupport}><p>Try our live support. </p><Button onClick={::this._liveSupportPop} primary large>Start Chat</Button><hr></hr></div> : null }
          </div>

          <form>
            <div>
              <label>Name:</label>
              <input type="text" placeholder="Your Name" autoComplete="off" autoFocus value={contactName} onChange={e => this.setState({ contactName: e.target.value })} />
            </div>
            <div>
              <label>Subject:</label>
              <select type="text" autoComplete="off" autoFocus value={contactSubject} onChange={e => this.setState({ contactSubject: e.target.value })} >
                <option value="">Select Subject</option>
                <option value="Sponsorships">Sponsorships</option>
                <option value="Trade Issue">Trade Issue</option>
                <option value="Game Issue">Game Issue</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label>Email:</label>
              <input type="email" placeholder="Your E-Mail" autoComplete="off" value={contactEmail} onChange={e => this.setState({ contactEmail: e.target.value })} />
            </div>
            <div>
              <label>Message:</label>
              <textarea placeholder="Enter a message..." autoComplete="off" value={contactMessage} onChange={e => this.setState({ contactMessage: e.target.value })} />
            </div>
          </form>

          { !busy ? <Button disabled={!contactName.length || !contactEmail.length || !contactMessage.length} onClick={::this._sendMessage} primary large>Send Message</Button> : <Spinner /> }

          <p>Our support team normally responds in 24-48 hour time period. Any abuse of our system can result in your account being closed.</p>
        </div> : null }
      </Modal>
    )
  }

  _onVisibilityChange() {
    if(this.props.visible) {
      this._onTabChange(this.state.selectedTab)
    }
  }

  _onTabChange(selectedTab) {
    if(selectedTab === 'faq') {
      this._refreshFAQ()
      return
    }
    var live = false;

    this.setState({
      selectedTab,
      liveSupport: live
    })
  }

  _refreshFAQ() {
    this.setState({
      busy: true
    })

    api('faq').then(({ questions }) =>
      this.setState({
        busy: false,
        faqQuestions: questions
      })
    )
  }

  _liveSupportPop() {
    Tawk_API.popup();
    this.props.onClose()
  }

  _sendMessage() {
    this.setState({
      busy: true
    })

    const { contactName, contactEmail, contactMessage, contactSubject } = this.state
    if(contactSubject.length == 0) {
      this.setState({ busy: false })
      return toast('Please change subject.')
    }
    api('support', {
      body: {
        name: contactName,
        email: contactEmail,
        message: contactMessage,
        subject: contactSubject
      }
    })

    .then(() => {
      toast('Your message has been successfully sent, please allow us 24-48 hours for a response. Thank you!')

      this.setState({
        busy: false,

        contactName: '',
        contactEmail: '',
        contactMessage: '',
        contactSubject: ''
      })

      this.props.onClose()
    }, () =>
      this.setState({ busy: false })
    )
  }
}
