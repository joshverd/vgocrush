
import React from 'react'
import io from 'socket.io-client'
import Immutable from 'seamless-immutable'
import semver from 'semver'
import { toast } from 'react-toastify'

import store from 'store'
import { setToggles } from 'reducers/toggles/actions'
import { setValues } from 'reducers/server/actions'

const Emitter = io.Manager
const emit = Emitter.prototype.emit

const broadcastEvents = [
  'addPlayerItem', 'removePlayerItem', 'updatePlayerItem',
  'offer:change', 'tradeOffer:change', 'onlineCount',
  'setToggle', 'updateServer'
]

const client = io(API_URL, {
  forceNew: true,
  'force new connection': true,
  transports: [ 'websocket' ]
})

client.on('ready', ({ cachedItemsHash, server, toggles, version }) => {
  console.log('server version:', version)
  console.log('cached items hash:', cachedItemsHash)

  if(semver.valid(process.env.VERSION) && semver.lt(process.env.VERSION, version)) {
    console.log('client outdated, refresh to update')
    toast.error('Your version is outdated! Please refresh your browser as soon as possible to receive the latest updates!', {
      autoClose: false
    })
  }

  if(!!server) {
    store.dispatch(setValues(server))
  }

  store.dispatch(setToggles(toggles))
})

client.on('notification', notification => toast(<span dangerouslySetInnerHTML={{ __html: notification }} />))

client.on('tradeOffer:change', offer => {
  console.log(offer.id, offer.type, offer.state)

  if(offer.type === 'DEPOSIT' && offer.state === 'ACCEPTED') {

    try{
      __adroll.record_user({"adroll_segments": "37b663e4"})
    } catch(err) {}

    ga('send', 'event', "deposit", "deposit");

    fbq('track', 'Purchase', {
      value: offer.subtotal,
      currency: 'USD'
    })

    ga('require', 'ecommerce');

    ga('ecommerce:addTransaction', {
      'id': (Date.now()+1).toString(),
      'revenue': offer.subtotal.toString(),
    });


    ga('ecommerce:addItem', {
      'id': Date.now().toString(),
      'name': 'Balance Fill',
      'price': offer.subtotal.toString(),
      'quantity': '1'
    });

    ga('ecommerce:send');

    ga('ecommerce:clear');
  }
})

let addedItems = []
let addedItemsTimeout = null

client.on('addPlayerItem', items => {
  addedItems.push(...items)

  if(!!addedItemsTimeout) {
    clearTimeout(addedItemsTimeout)
  }

  addedItemsTimeout = setTimeout(() => {
    addedItems = addedItems.sort((a, b) => b.price - a.price)
    let str = `${items[0].name} has been added to your inventory!`

    if(addedItems.length > 1) {
      str = `${addedItems.length === 2 ? `${addedItems[0].name} and ${addedItems[1].name}` : `${addedItems[0].name} and ${addedItems.length - 1} other skins`} have been added to your inventory!`
    }

    addedItems = []
    toast(str)
  }, 200)
})

client.onevent = function onEvent(packet) {
  const args = packet.data || []

  if (packet.id !== null) {
    args.push(this.ack(packet.id))
  }

  if(broadcastEvents.indexOf(packet.data[0]) >= 0) {
    store.dispatch({
      type: `event/${packet.data[0]}`,
      payload: Immutable(packet.data[1]),
      event: packet.data
    })
  }

  return emit.apply(this, args)
}

// client.on('depositComplete', function(amount){
//   if(document.hasFocus()) {

//     ga('require', 'ecommerce');

//     ga('ecommerce:addTransaction', {
//       'id': (Date.now()+1).toString(),
//       'revenue': amount.toString(),
//     });

//     ga('ecommerce:addItem', {
//       'id': Date.now().toString(),
//       'name': 'Balance Fill',
//       'price': amount.toString(),
//       'quantity': '1'
//     });

//     ga('ecommerce:send');

//     ga('ecommerce:clear');

//     console.log("depositComplete PINGED PREV ORDER FOR "+amount)
//     api('/api/users/trackedOrder', { method: 'POST' })

//   } else console.log("not in focus, not sending")
// })

export const chatSocket = io(CHAT_URL + '/chat', {
  forceNew: true,
  transports: [ 'websocket' ],
  path: '/chat'
})

chatSocket.on('connect', () => console.log('connected'))
chatSocket.on('connection', () => console.log('connected'))
chatSocket.on('disconnect', () => console.log('diconnected'))

export default client
