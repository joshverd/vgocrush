
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import { ToastContainer } from 'react-toastify'
import { Fabric } from 'office-ui-fabric-react/lib/Fabric'
import { Nav } from 'office-ui-fabric-react/lib/Nav'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog'
import { Button, PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button'

import style from './style.css'

class App extends Component {

  static contextTypes = {
    router: React.PropTypes.object.isRequired
  }

  constructor(props) {
    super(props)

    this.state = {
    }
  }

  componentDidMount() {
    this._hideLoader()
  }

  render() {
    const { currentUser } = this.props
    let path = this.props.location.pathname.split('/')

    if(path[path.length - 1] === '') {
      path = ['home']
    }

    return (
      <Fabric className={style.wrapper}>
        <div className={style.contentContainer}>
          <div className={style.leftNav}>
            <div className={style.brand}>
              <img src={require('assets/image/logo.svg')} />
              <div>SKNE</div>
            </div>

            <Nav className={style.nav}
              onLinkClick={::this._onNavLinkClick}
              groups={[{
                links: this._links([{
                  key: 'dashboard',
                  name: 'Dashboard',
                  url: '/dashboard',
                  icon: 'Inbox',
                  isVisible: false
                }, {
                  key: 'bots',
                  name: 'Bots',
                  url: '/bots',
                  icon: 'Robot'
                }, {
                  key: 'offers',
                  name: 'Trades',
                  url: '/offers',
                  isExpanded: true,
                  isVisible: false,
                  links: this._links([{
                    key: 'offersPending',
                    name: 'Pending Offers',
                    url: '/offers/pending',
                    icon: 'BranchFork2'
                  }])
                }, {
                  key: 'items',
                  name: <span className={style.disabled}>Items</span>,
                  url: '/items',
                  icon: 'FolderList',
                  isVisible: false
                }])
              }, {
                links: this._links([{
                  key: 'administration',
                  name: 'Administration',
                  isVisible: false,
                  isExpanded: true,
                  links: this._links([{
                    key: 'adminUsers',
                    name: 'Authentication',
                    url: '/admin/authentication',
                    icon: 'People'
                  }])
                }])
              }, {
                links: this._links([{
                  key: 'logout',
                  name: 'Logout',
                  icon: 'SignOut',
                  onClick: ::this._logout
                }])
              }]}

              expandedStateText={ 'expanded' }
              collapsedStateText={ 'collapsed' }
              selectedKey={ path.join('/') } />
          </div>
          <div className={style.content}>{ this.props.children }</div>
        </div>

        <ToastContainer
          position="top-right"
          type="default"
          autoClose={12000}
          newestOnTop={true}
          hideProgressBar={true}
          closeOnClick
        />
      </Fabric>
    )
  }

  _links(links) {
    const { currentUser } = this.props
    return links.filter(link =>
      typeof link.isVisible === 'undefined' || link.isVisible
    )
  }

  _hideLoader() {
    const loader = document.getElementById('loader')

    if(loader) {
      loader.classList.add('finished')

      setTimeout(() => {
        if(loader !== null) {
          loader.remove()
        }
      }, 2000)
    }
  }

  _onNavLinkClick(e, link) {
    e.preventDefault()

    if(link.disabled) {
      this.setState({
        showWIP: true
      })

      return
    } else if(!link.url) {
      return
    }

    this.context.router.push(link.url)
  }

  _logout() {
    delete localStorage['serverToken']
    window.location.reload()
  }

  static setTitle(prefix) {
    let title = 'SknExchange'

    if(!!prefix) {
      title = `${prefix} | ${title}`
    }

    document.title = title
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)(App)
