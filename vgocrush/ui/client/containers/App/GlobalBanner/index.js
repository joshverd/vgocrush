
import React from 'react'
import style from './style.scss'

export default class GlobalBanner extends React.Component {
  render() {
    const { banner } = this.props

    if(!banner) {
      return null
    }

    return (
      <div className={style.banner} style={banner.style}>
        <div dangerouslySetInnerHTML={{ __html: banner }} />
      </div>
    )
  }
}
