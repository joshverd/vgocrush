
import _ from 'underscore'

const itemModesField = {
  deposit: 'price',
  exchange: 'priceE',
  upgrade: 'priceU',

  d: 'price',
  e: 'priceE',
  u: 'priceU'
}

let _itemsCacheHash = null
let _itemsCache = []
let _nonBlockedItemsCache = []
let _itemsByName = {}

try {
  if(!!typeof localStorage.availableItems) {
    const cached = JSON.parse(localStorage.availableItems)

    if(cached.length > 0) {
      updateItemsCache(cached, !!localStorage.acs ? localStorage.acs : null)
    }
  }
} catch(e) {
}

export function getItemsCache(includeBlocked = true) {
  return includeBlocked ? _itemsCache : _nonBlockedItemsCache
}

export function getItemsCacheHash() {
  return _itemsCacheHash
}

export function updateItemsCache(newItems, newHash = null) {
  if(!!newHash) {
    if(newHash !== _itemsCacheHash) {
      console.log('item cache updated:', newHash)
    }

    _itemsCacheHash = newHash
  }

  _itemsCache = newItems
  _nonBlockedItemsCache = newItems.filter(i => !i.blocked)

  _itemsByName = _
    .chain(newItems)
    .map(i => ([ i.name, i ]))
    .object()
    .value()

  try {
    localStorage.setItem('acs', _itemsCacheHash)
    localStorage.setItem('availableItems', JSON.stringify(newItems))
  } catch(e) {
    console.log(updateItemsCache, e)
  }
}

export function getItemPrice(item, mode) {
  mode = mode || 'deposit'
  return item[itemModesField[mode]] || item.price
}

export function resolveItem(itemName, mode) {
  const item = _itemsByName[itemName]

  if(!item) {
    console.error(`cannot find item: ${itemName}`)
    return {}
  }

  item.price = getItemPrice(item, mode)
  return item
}
