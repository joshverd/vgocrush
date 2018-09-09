
import React, { Component } from 'react'
import cn from 'classnames'

import Tabs from 'components/Tabs'
import style from './style.scss'

export default class Modal extends Component {

  constructor(props) {
    super(props)

    this.state = {
      visible: props.visible,
      selectedTab: props.selectedTab || null
    }
  }

  componentDidUpdate(prevProps) {
    if(prevProps.visible !== this.props.visible) {

      if(this._timeout) {
        clearTimeout(this._timeout)
      }

      if(this.props.visible) {
        this.setState({
          visible: true,
          selectedTab: this.props.selectedTab || null
        })
      } else {
        this._timeout = setTimeout(() =>
          this.setState({
            visible: false
          })
        , 2100)
      }

      if(this.props.onVisibilityChange) {
        this.props.onVisibilityChange()
      }
    }
  }

  render() {
    const { visible, selectedTab } = this.state
    const { title, subTitle, caption, className } = this.props

    const cl = cn(style.modal, className, {
      [style.visible]: this.props.visible,
      [style.fullscreen]: this.props.fullscreen
    })

//         <div className={style.overlay} />

    return (
      <div ref="backdrop" className={cl} onClick={::this._onBackdropClick}>

        <div className={cn(style.dialog, this.props.dialogClass)}>

          <Tabs vertical selected={selectedTab} tabs={this.props.tabs} onChange={::this._onTabChange} />

          <div className={style.dialogContent}>
            { !!title || this.props.header ? <div className={style.header}>
              { !!title ? <div className={style.headerTitle}>{title} { !!subTitle ? <div>{subTitle}</div> : null }</div> : null }
              { this.props.header || null }
            </div> : null }

            { visible ? this.props.children : null }
          </div>
        </div>

        { caption ? <div className={style.caption}>{caption}</div> : null }
      </div>
    )
  }

  _onBackdropClick(e) {
    if(e.target.classList.contains(style.modal) && this.props.onClose) {
      if(e.target === this.refs.backdrop) {
        this.props.onClose()
      }
    }
  }

  _onTabChange(selectedTab) {
    this.setState({ selectedTab })

    if(!!this.props.onTabChange) {
      this.props.onTabChange(selectedTab)
    }
  }
}

//
// import React, { Component } from 'react'
// import cn from 'classnames'
//
// import Tabs from 'components/Tabs'
// import style from './style.scss'
//
// export default class Modal extends Component {
//
//   constructor(props) {
//     super(props)
//
//     this.state = {
//       visible: props.visible,
//       selectedTab: props.selectedTab || null
//     }
//   }
//
//   componentDidUpdate(prevProps) {
//     if(prevProps.visible !== this.props.visible) {
//
//       if(this._timeout) {
//         clearTimeout(this._timeout)
//       }
//
//       if(this.props.visible) {
//         this.setState({
//           visible: true,
//           selectedTab: this.props.selectedTab || null
//         })
//       } else {
//         this._timeout = setTimeout(() =>
//           this.setState({
//             visible: false
//           })
//         , 2100)
//       }
//     }
//   }
//
//   render() {
//     const { visible, selectedTab } = this.state
//     const { title, subTitle, caption, className } = this.props
//
//     const cl = cn(style.modal, className, {
//       [style.visible]: this.props.visible
//     })
//
// //         <div className={style.overlay} />
//
//     return (
//       <div ref="backdrop" className={cl} onClick={::this._onBackdropClick}>
//
//         <div className={cn(style.dialog, this.props.dialogClass)}>
//
//           <Tabs vertical selected={selectedTab} tabs={this.props.tabs} onChange={::this._onTabChange} />
//
//           <div className={style.dialogContent}>
//             <div className={style.header}>
//               { !!title ? <div className={style.headerTitle}>{title} { !!subTitle ? <div>{subTitle}</div> : null }</div> : null }
//               { this.props.header || null }
//             </div>
//
//             { visible ? this.props.children : null }
//           </div>
//         </div>
//
//         { caption ? <div className={style.caption}>{caption}</div> : null }
//       </div>
//     )
//   }
//
//   _onBackdropClick(e) {
//     if(e.target.classList.contains(style.modal) && this.props.onClose) {
//       if(e.target === this.refs.backdrop) {
//         this.props.onClose()
//       }
//     }
//   }
//
//   _onTabChange(selectedTab) {
//     this.setState({ selectedTab })
//
//     if(!!this.props.onTabChange) {
//       this.props.onTabChange(selectedTab)
//     }
//   }
// }
