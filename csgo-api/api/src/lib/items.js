
import co from 'co'
import _ from 'underscore'

import r from 'lib/database'
import AvailableItems from 'document/items'
import { Items } from 'lib/sknexchange'
import { hashCode } from 'lib/string'
import redis from 'lib/redis'

const itemModes = ['price', 'depositPrice', 'upgradePrice', 'exchangePrice']

let _items = {}

let _cachedAvailableItemsHash = null
let _nonblockedAvailableItems = null
let _availableItems = null
let _availableItemsMode = {}

const getNonblockedAvailableItems = (opts = {}) => {
  if(!opts.ignoreCache && !!_nonblockedAvailableItems) {
    return Promise.resolve(_nonblockedAvailableItems)
  }

  return Items
    .getAll(r.args(AvailableItems.map(i => ([ i('name'), false ])).coerceTo('array')), { index: 'nameBlocked' })
    .then(result => {
      _nonblockedAvailableItems = result
      return _nonblockedAvailableItems
    })
}

export async function loadItems() {
  // Load available items
  await getAvailableItems()
}

export async function getCachedItemsHash() {
  return redis.getAsync("pricing:hash")
}

export async function getAvailableItems(opts = {}) {
  const liveHash = await redis.getAsync("pricing:hash");
  let items = []

  if(!opts.ignoreCache && !!_availableItems && (opts.hash == liveHash)) {
    items = _availableItems
  } else {
    items = await Items.filter({
        "blocked": false
    }).coerceTo('array')
  }

  _availableItems = items

  const hash = liveHash

  if(!liveHash || liveHash !== _cachedAvailableItemsHash) {
    clearItemsCache()

    _cachedAvailableItemsHash = liveHash

    for(let mode of itemModes) {
      _availableItemsMode[mode] = _.sortBy(await getItems(_.pluck(items, 'name'), items =>
        items.filter(i => !i.blocked)
      ), mode)
    }
  }

  return {
    items,
    hash
  }
}

export function clearItemsCache() {
  _items = {}
  _availableItems = null
}

export async function getItems(itemNames, fn = null) {
  const uniqueItems = _.uniq(itemNames)
  const missing = _.filter(uniqueItems, k => !_items[k])

  if(missing.length > 0) {
    const items = await Items.getAll(r.args(missing), { index: 'name' })

    for(let i of items) {
      _items[i.name] = i
    }
  }

  const items = itemNames.map(n => _items[n])
  return !!fn ? fn(items) : items
}

export async function getRandomAvailableItems(opts = {}) {
  opts = {
    mode: 'price',
    maxValue: 0,
    ...opts
  }

  let credits = opts.maxValue

  const items = _availableItemsMode[opts.mode].filter(item => item[opts.mode] < credits)
  const chosenItems = []

  while(credits > 0) {
    const possible = items.filter(i => i[opts.mode] <= credits)

    if(!possible.length) {
      break
    }

    let item = possible[possible.length - 1]
    credits -= item[opts.mode]

    chosenItems.push(item)
  }

  return {
    items: chosenItems,
    itemsValue: opts.maxValue - credits
  }
}
