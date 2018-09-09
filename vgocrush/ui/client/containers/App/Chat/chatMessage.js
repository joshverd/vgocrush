
import React from 'react'
import cn from 'classnames'

import style from './style.scss'

export default class ChatMessage extends React.Component {
  render() {
    const { message } = this.props

    const cl = cn(style.chatMessage, {
      [style.self]: this.props.self
    })

    return (
      <div className={cl}>
        <img src={message.avatars.medium} />

        <div>
          <div className={style.chatMessageHeader}>
            <div className={style.chatMessageUser}>
              <a target="_blank" href={"https://steamcommunity.com/profiles/"+message.userId} className={style.chatMessageUserName}>{ !!message.tag ? <span style={{ background: message.tag.color }}>{message.tag.prefix}</span> : null }<span style={{ color: message.color }}>{message.username}</span></a>
            </div>
          </div>

          <div className={style.chatMessageContent}>{message.message}</div>
        </div>
      </div>
    )
  }
}
