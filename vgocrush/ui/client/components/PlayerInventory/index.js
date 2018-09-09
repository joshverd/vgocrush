import React, { Component } from 'react'
import _ from 'underscore'
import { connect } from 'react-redux'
import cn from 'classnames'
import { toast } from 'react-toastify'
import Immutable from 'seamless-immutable'
import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import api from 'lib/api'
import socket from 'lib/socket'
import { updateCurrentUser } from 'reducers/currentUser/actions'

import Spinner from '../Spinner'
import Skin from '../Skin'
import style from './style.scss'

class PlayerInventory extends Component {
  constructor(props) {
    super(props)

    const { playerInventory } = props

    this.state = {
      inventory: this._sortInventory(playerInventory),
      selectedItem: null
    }

    this._insertQueue = []
  }

  componentDidUpdate() {
    if(!this._timeout && this._insertQueue.length > 0) {
      this._timeout = setTimeout(::this._processInsertQueue, 100)
    }
  }

  componentDidMount() {
    this._onUpdatePlayerItem = (ids, update) => {
      const inventory = this.state.inventory.map(item => {
        if(ids.indexOf(item.id) >= 0) {
          return item.merge(update)
        }

        return item
      })

      this.setState({
        inventory
      })

      if(update.state === 'BUSY') {
        const mutable = inventory.asMutable()

        for(let id of ids) {
          if(this.props.selected.indexOf(id) >= 0) {
            this.props.onToggleItem(id, mutable)
          }
        }
      }
    }

    this._onAddPlayerItem = newItems => {
      this._insertQueue.push(...newItems.map(i =>
        Object.assign({
          _newItem: true
        }, i)
      ))

      if(!this._timeout && this._insertQueue.length > 0) {
        this._processInsertQueue()
      }
    }

    this._onRemovePlayerItem = ids => {
      const inventory = this.state.inventory.filter(item => ids.indexOf(item.id) < 0)

      this.setState({
        inventory
      })

      const mutable = inventory.asMutable()

      for(let id of ids) {
        if(this.props.selected.indexOf(id) >= 0) {
          this.props.onToggleItem(id, mutable)
        }
      }
    }

    socket.on('updatePlayerItem', this._onUpdatePlayerItem)
    socket.on('addPlayerItem', this._onAddPlayerItem)
    socket.on('removePlayerItem', this._onRemovePlayerItem)
  }

  componentWillUnmount() {
    socket.removeListener('updatePlayerItem', this._onUpdatePlayerItem)
    socket.removeListener('addPlayerItem', this._onAddPlayerItem)
    socket.removeListener('removePlayerItem', this._onRemovePlayerItem)
  }

  render() {
    const { selected, disableCustomStyles, maxHeight, contextMenu } = this.props
    const { selectedItem, inventory } = this.state

    const containerStyles = {}

    if(!!maxHeight) {
      containerStyles.maxHeight = maxHeight
    }

    return (
      <div style={containerStyles} className={style.skins}>

        { !inventory.length ? <div className={style.empty}>Your inventory is currently empty</div> : null }

        {inventory.map(item =>
          <ContextMenuTrigger key={item.id} id="inventoryContextMenu" collect={props => item} attributes={{ }}>
            <Skin
              disabled={(!!selectedItem && selectedItem.id === item.id) || item.state === 'BUSY'}
              customStyles={!disableCustomStyles ? style : {}}
              item={item}
              selected={selected.indexOf(item.id) >= 0}
              dim={!!selectedItem || (selected.length > 0 && selected.indexOf(item.id) < 0)}
              onClick={() => this.props.onToggleItem(item.id, this.state.inventory.asMutable(), item)} />
          </ContextMenuTrigger>
        )}

        <ContextMenu id="inventoryContextMenu"
          className={style.contextMenu}
          onShow={::this._onContextMenuShow}
          onHide={() => this.setState({ selectedItem: null })}>
            { !!selectedItem ? <div className={style.contextMenuHeader}>
              <div className={style.contextMenuHeaderIcon}><img src={selectedItem.iconUrl} /></div>
              <div>{selectedItem.name}</div>
            </div> : null }

            {contextMenu.map(menu =>
              <MenuItem key={menu.key} onClick={() => menu.onClick(selectedItem)}>{!!menu.render ? menu.render() : menu.name}</MenuItem>
            )}
        </ContextMenu>
      </div>
    )
  }

  _onContextMenuShow(e) {
    if(this.props.onContextMenuShow) {
      this.props.onContextMenuShow()
    }
    
    this.setState({
      selectedItem: e.detail.data
    })
  }

  _processInsertQueue() {
    this._timeout = null

    if(!this._insertQueue.length) {
      return
    }

    const item = this._insertQueue.splice(0, 1)

    this.setState({
      inventory: this._sortInventory(this.state.inventory.concat(item))
    })
  }

  _sortInventory(inventory) {
    return Immutable([].concat(inventory).sort((a, b) => (b.price || 0) - (a.price || 0)))
  }
}

export default connect(
  ({ playerInventory }) => ({ playerInventory }),
)(PlayerInventory)
