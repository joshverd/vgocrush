
import React, { Component } from 'react'
import cn from 'classnames'

import style from './style.scss'

export default class Tabs extends Component {
  render() {
    const { vertical, selected, tabs } = this.props

    if(!tabs) {
      return null
    }

    return (
      <div className={cn(style.tabs, { [style.vertical]: vertical })}>
        {tabs.map(tab =>
          <div key={tab.key} className={cn(style.tab, tab.key === selected ? style.tabSelected : null)} onClick={e => this._onClick(e, tab.key)}>{tab.name} { tab.count > 0 ? <span>{tab.count}</span> : null }</div>
        )}
      </div>
    )
  }

  _onClick(e, tab) {
    e.preventDefault()

    if(!!this.props.onChange) {
      this.props.onChange(tab)
    }
  }
}
