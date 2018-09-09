
import React from 'react'
import AnimatedCount from 'components/AnimatedCount'
import style from './style.scss'

export default class CurrentPlayer extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    const { currentUser } = this.props

    return (
      <div className={style.container}>
        <div className={style.avatar}>
          <img src={currentUser.avatarfull} />
        </div>

        <div className={style.playerInfo}>
          <div className={style.playerNameContainer}>
            { false ? <div className={style.level}>1</div> : null }
            <div className={style.playerName}>{currentUser.username}</div>
          </div>
          <a className={style.logout} href={`${API_URL}/api/auth/logout`}>Logout</a>
        </div>
      </div>
    )
  }
}

/*
<div className={style.xp}><AnimatedCount value={15} /> / <AnimatedCount value={100} /> XP</div>
<div className={style.progress}>
  <div />
</div>
 */
