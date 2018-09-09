
import React, { Component } from 'react'
import cn from 'classnames'
import _ from 'underscore'
import { toast } from 'react-toastify'
import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import Button from 'components/Button'
import AnimatedCount from 'components/AnimatedCount'
import Spinner from 'components/Spinner'

import CurrentPlayer from './CurrentPlayer'
import ChatMessage from './chatMessage'
import api from 'lib/api'
import socket, { chatSocket } from 'lib/socket'
import style from './style.scss'

const chatChannels = {
  'en': 'English',
  'ru': 'Russian',
  'tur': 'Turkish',
  'chn': 'Chinese',
  'vnm': 'Vietnamese',
  'pt': 'Portuguese'
}

function getLang(shortCode){
  // if(window.sessionData.user.id == "76561198131984048") shortCode = "RU";
  var shorts = {
    "RU": "ru",
    "PT": "pt",
    "BR": "pt",
    "TUR": "tur",
    "CHN": "chn",
    "VNM": "vnm"

  }
  return shorts[shortCode] || "en";
}
export default class Chat extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: false,
      chatHidden: false,
      sendingMessage: false,
      message: '',
      selectedUsername: '',
      blocked: false,
      messages: [],

      channel: getLang(window.sessionData.countryCode)
    }

    this._nextMessageId = 0
    this._chatUpdated = false
    this._forceUpdate = true
  }

  componentDidMount() {
    this._scrollDown()

    // chatSocket.on('connect', () => {
    //   this.setState({
    //     loading: false
    //   })
    // })
    //
    // chatSocket.on('disconnect', () => {
    //   this.setState({
    //     loading: true
    //   })
    // })

    api('chatMessages/' + this.state.channel).then(({ messages }) => {
      this._chatUpdated = true
      this._forceUpdate = true

      this.setState({
        messages,
        loading: false,
        sendingMessage: false
      })
    })

    chatSocket.on('chatMessage', message => {
      if(this.state.channel != message.room) return;
      this._chatUpdated = true

      const { messages } = this.state

      if(messages.length > 50) {
        messages.splice(0, messages.length - 50)
      }

      this.setState({
        messages: [ ...messages, {
          ...message
        }]
      })
    })

    chatSocket.on('deleteMessages', playerId => this.setState({
      messages: this.state.messages.filter(m => m.userId !== playerId)
    }))

    chatSocket.on('deleteMessage', id => this.setState({
      messages: this.state.messages.filter(m => m.id !== id)
    }))
  }

  componentDidUpdate(prevProps, prevState) {
    if(this._chatUpdated) {

      const { chatMessages } = this.refs
      const diff = (chatMessages.scrollHeight - chatMessages.scrollTop) - chatMessages.clientHeight

      if(this._forceUpdate || diff <= 150) {
        this._scrollDown()
      }

      this._forceUpdate = false
      this._chatUpdated = false
    }

    if(!!this.refs.input && this.state.sendingMessage !== prevState.sendingMessage && !this.state.sendingMessage) {
      this.refs.input.focus()
    }
  }

//         <div className={cn(style.hiddenToggle, chatHidden ? style.showHiddenToggle : null)} onClick={::this._toggleHidden}><i className="fa fa-chevron-left" /></div>

  render() {
    const { currentUser, inventoryWorth } = this.props
    const { loading, blocked, chatHidden, messages, message, sendingMessage } = this.state

    return (
      <div className={cn(style.chatContainer, chatHidden ? style.hidden : null)}>
        <a className={style.chatToggle} href="#" onClick={::this._toggleHidden}><i className="fa fa-chevron-right" /></a>
        <CurrentPlayer currentUser={currentUser} inventoryWorth={inventoryWorth} />

        <div ref="chatMessages" className={cn(style.chatMessages, loading ? style.blur : null)}>
          {messages.map(message =>
            <ContextMenuTrigger key={message.id} id="chatContextMenu" collect={props => message} attributes={{ 'data-message': message.id, 'data-id': message.userId, 'data-name': message.username }}>
              <ChatMessage message={message} self={!!currentUser && currentUser.id === message.userId} />
            </ContextMenuTrigger>
          )}
        </div>

        { currentUser.isMod ? <ContextMenu id="chatContextMenu" className={style.chatContextMenu} onShow={::this._onChatContextShow}>
          <div className={style.chatContextMenuName}>{this.state.selectedUsername}</div>
          <MenuItem onClick={::this._onChatContextMenuClick} data={{ action: 'mute' }}>Mute</MenuItem>
          <MenuItem onClick={::this._onChatContextMenuClick} data={{ action: 'permMute' }}>Perm. Mute</MenuItem>
          <MenuItem onClick={::this._onChatContextMenuClick} data={{ action: 'clearSingle' }}>Clear Message</MenuItem>
          <MenuItem onClick={::this._onChatContextMenuClick} data={{ action: 'clear' }}>Clear All Messages</MenuItem>
        </ContextMenu> : null }

        <div className={cn(style.chatInputContainer, loading ? style.blur : null)}>
          <input disabled={sendingMessage} ref="input" type="text" placeholder="Enter your message..." onChange={e => this.setState({ message: e.target.value })} value={blocked ? 'Temporarily blocked...' : message} onKeyDown={::this._sendChatMessage} maxLength="255" />
        </div>

        <div className={cn(style.chatInputContainer, loading ? style.blur : null)}>
          <select value={this.state.channel} onChange={::this._onChannelChange} className={style.chatChannels}>
            {_.map(chatChannels, (channel, k) =>
              <option key={k} value={k}>{channel}</option>
            )}
          </select>

          { !sendingMessage ? <a href="#" onClick={::this._sendChatMessage}>Send</a> : <i className="fa fa-cog fa-spin" /> }
        </div>

        <div className={style.footer}>
          <div><div className={style.onlinePulse}><span /></div> Online: <AnimatedCount style={{ fontFamily: null, marginLeft: 4 }} value={this.props.onlineCount} format="0,0" /></div>
          <div className={style.social}>
            <a className={style.terms} href="/terms-of-use" target="_blank">Terms</a>
            <a href="https://discord.gg" target="_blank"><img className={style.discord} src="data:image/svg+xml;base64,CjxzdmcgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDI0NSAyNDAiPjxzdHlsZT4uc3Qwe2ZpbGw6I0ZGRkZGRjt9PC9zdHlsZT48cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTA0LjQgMTAzLjljLTUuNyAwLTEwLjIgNS0xMC4yIDExLjFzNC42IDExLjEgMTAuMiAxMS4xYzUuNyAwIDEwLjItNSAxMC4yLTExLjEuMS02LjEtNC41LTExLjEtMTAuMi0xMS4xek0xNDAuOSAxMDMuOWMtNS43IDAtMTAuMiA1LTEwLjIgMTEuMXM0LjYgMTEuMSAxMC4yIDExLjFjNS43IDAgMTAuMi01IDEwLjItMTEuMXMtNC41LTExLjEtMTAuMi0xMS4xeiIvPjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xODkuNSAyMGgtMTM0QzQ0LjIgMjAgMzUgMjkuMiAzNSA0MC42djEzNS4yYzAgMTEuNCA5LjIgMjAuNiAyMC41IDIwLjZoMTEzLjRsLTUuMy0xOC41IDEyLjggMTEuOSAxMi4xIDExLjIgMjEuNSAxOVY0MC42YzAtMTEuNC05LjItMjAuNi0yMC41LTIwLjZ6bS0zOC42IDEzMC42cy0zLjYtNC4zLTYuNi04LjFjMTMuMS0zLjcgMTguMS0xMS45IDE4LjEtMTEuOS00LjEgMi43LTggNC42LTExLjUgNS45LTUgMi4xLTkuOCAzLjUtMTQuNSA0LjMtOS42IDEuOC0xOC40IDEuMy0yNS45LS4xLTUuNy0xLjEtMTAuNi0yLjctMTQuNy00LjMtMi4zLS45LTQuOC0yLTcuMy0zLjQtLjMtLjItLjYtLjMtLjktLjUtLjItLjEtLjMtLjItLjQtLjMtMS44LTEtMi44LTEuNy0yLjgtMS43czQuOCA4IDE3LjUgMTEuOGMtMyAzLjgtNi43IDguMy02LjcgOC4zLTIyLjEtLjctMzAuNS0xNS4yLTMwLjUtMTUuMiAwLTMyLjIgMTQuNC01OC4zIDE0LjQtNTguMyAxNC40LTEwLjggMjguMS0xMC41IDI4LjEtMTAuNWwxIDEuMmMtMTggNS4yLTI2LjMgMTMuMS0yNi4zIDEzLjFzMi4yLTEuMiA1LjktMi45YzEwLjctNC43IDE5LjItNiAyMi43LTYuMy42LS4xIDEuMS0uMiAxLjctLjIgNi4xLS44IDEzLTEgMjAuMi0uMiA5LjUgMS4xIDE5LjcgMy45IDMwLjEgOS42IDAgMC03LjktNy41LTI0LjktMTIuN2wxLjQtMS42czEzLjctLjMgMjguMSAxMC41YzAgMCAxNC40IDI2LjEgMTQuNCA1OC4zIDAgMC04LjUgMTQuNS0zMC42IDE1LjJ6Ii8+PC9zdmc+" /></a>
            <a href="https://twitter.com" target="_blank"><i className="fa fa-twitter-square" aria-hidden="true" /></a>
          </div>
        </div>

        { loading ? <div className={style.loader}>
          <Spinner text="Initializing Chat" />
        </div> : null }
      </div>
    )
  }

  _onChannelChange(e) {
    this.setState({
      loading: true,
      sendingMessage: true
    })

    const room = e.target.value

    api('chatMessages/' + room).then(({ messages }) => {
      this._chatUpdated = true
      this._forceUpdate = true

      this.setState({
        messages,
        channel: room,
        loading: false,
        sendingMessage: false
      })

      chatSocket.emit('updateChannel', room)
    })
  }

  _onChatContextShow(e) {
    this.setState({
      selectedUsername: e.detail.target.attributes['data-name'].value
    })
  }

  _onChatContextMenuClick(e, data) {
    if(data.action === 'mute') {
      this.refs.input.focus()

      return this.setState({
        message: `/m ${data.userId} 1h`
      })
    } else if(data.action === 'clearSingle') {
      chatSocket.emit('chatMessage', `/${data.action} ${data.id}`)
      return
    }

    chatSocket.emit('chatMessage', `/${data.action} ${data.userId}`)
  }

  _sendChatMessage(e) {
    const { message, sendingMessage } = this.state

    if(!e || sendingMessage || !message.trim().length) {
      return
    }

    if(!e.keyCode || e.keyCode === 13) {
      this.setState({
        sendingMessage: true
      })

      chatSocket.emit('chatMessage', message, err => {
        if(!!err) {
          toast(err)

          this.setState({
            blocked: true
          })

          return setTimeout(() => this.setState({
            sendingMessage: false,
            blocked: false
          }), 2000)
        }

        this.setState({
          sendingMessage: false,
          message: ''
        })
      })
    }
  }

  _toggleHidden() {
    this.setState({
      chatHidden: !this.state.chatHidden
    })
  }

  _scrollDown() {
    this.refs.chatMessages.scrollTop = this.refs.chatMessages.scrollHeight
  }
}
