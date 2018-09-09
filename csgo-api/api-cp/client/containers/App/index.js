
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import { ToastContainer } from 'react-toastify'
import { Fabric } from 'office-ui-fabric-react/lib/Fabric'
import { Nav } from 'office-ui-fabric-react/lib/Nav'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'

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
            <div className={style.brand}><div>CS:GO API</div>CP</div>

            <Nav className={style.nav}
              onLinkClick={::this._onNavLinkClick}
              groups={[{
                links: this._links([{
                  key: 'home',
                  name: 'Home',
                  url: '/home',
                  icon: 'Edit',
                  isVisible: currentUser.isAdmin
                }, {
                  key: 'players',
                  name: 'Players',
                  url: '/players'
                }, {
                  key: 'auditLogs',
                  name: 'Audit Logs',
                  url: '/auditLogs',
                  isVisible: currentUser.isAdmin
                }, {
                  key: 'toggles',
                  name: 'Toggles',
                  url: '/toggles',
                  isVisible: currentUser.isAdmin
                }, {
                  key: 'faq',
                  name: 'FAQ',
                  url: '/faq',
                  isVisible: currentUser.isAdmin
                }])
              }, {
                links: this._links([{
                  key: 'promotions',
                  name: 'Promotions',
                  url: '/promotions',
                  isVisible: false && currentUser.isAdmin
                }, {
                  key: 'raffles',
                  name: 'Raffles',
                  url: '/raffles',
                  isVisible: currentUser.isAdmin
                }, {
                  key: 'chat',
                  name: 'Chat',
                  url: '/chat'
                }])
              }, {
                links: this._links([{
                  key: 'storage',
                  name: 'Storage',
                  url: '/storage',
                  isVisible: currentUser.isAdmin
                }, {
                  key: 'offers',
                  name: 'Trade Offers',
                  url: '/offers',
                  isVisible: false && currentUser.isAdmin
                }, {
                  key: 'items',
                  name: 'Items',
                  url: '/items',
                  isVisible: false && currentUser.isAdmin
                }])
              }, {
                links: []
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
          autoClose={5000}
          hideProgressBar={true}
          newestOnTop={false}
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
    this.context.router.push(link.url)
  }

  static setTitle(title) {
    document.title = 'CS:GO API Control Panel'
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)(App)
