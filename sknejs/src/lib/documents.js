
import { eachSeries } from 'async'
import r from 'rethinkdb'

export const Stats  = r.table('Stats')
export const ItemSales  = r.table('ItemSales')
export const ItemListings  = r.table('ItemListings')
export const TradeOffers  = r.table('TradeOffers')
export const VirtualOffers  = r.table('PendingOffers')
export const VirtualOffersGroup  = r.table('VirtualOffersGroup')
export const Items        = r.table('Items')
export const Bots         = r.table('Bots')
export const BotItems     = r.table('BotItems')
export const Transfers    = r.table('Transfers')
export const SteamTradeHistory    = r.table('SteamTradeHistory')
export const PurchaseOrder    = r.table('PurchaseOrder')
export const ApiKeys    = r.table('ApiKeys')

// migrateDocuments
export function migrateDocuments(connection) {
  const steps = [
    r.tableCreate('ApiKeys'),
    ApiKeys.indexCreate('key'),
    ApiKeys.indexWait(),

    r.tableCreate('Transfers'),
    Transfers.indexWait(),

    r.tableCreate('SteamTradeHistory'),
    SteamTradeHistory.indexCreate('bot'),
    SteamTradeHistory.indexCreate('tradeOfferId'),
    SteamTradeHistory.indexWait(),

    r.tableCreate('PurchaseOrder'),
    PurchaseOrder.indexWait(),

    r.tableCreate('ItemSales'),
    ItemSales.indexCreate('saleId'),
    ItemSales.indexWait(),

    r.tableCreate('Stats'),
    Stats.wait(),
    Stats.indexCreate('createdAt'),
    Stats.indexWait(),

    r.tableCreate('ItemListings'),
    ItemListings.indexCreate('steamId'),
    ItemListings.indexCreate('saleId'),

    ItemListings.indexCreate('steamIdSaleId', row => [row('steamId'), row('saleId')]),
    ItemListings.indexCreate('steamIdItemName', row => [row('steamId'), row('itemName')]),
    ItemListings.indexWait(),

    r.tableCreate('PendingOffers'),
    VirtualOffers.indexCreate('receiptSaleIds', offer =>
      offer('receipt')('sales').map(sale => sale('itemId'))
    , { multi: true }),
    VirtualOffers.indexCreate('state'),
    VirtualOffers.indexCreate('offerId'),
    VirtualOffers.indexCreate('steamId'),
    VirtualOffers.indexCreate('steamIdState', row => [row('steamId'), row('state')]),
    VirtualOffers.indexCreate('incomingOfferIds', { multi: true }),
    // VirtualOffers.indexCreate('itemIds', { multi: true }),
    VirtualOffers.indexCreate('itemIdState', offer =>
      offer('itemIds').map(id => [ id, offer('state') ])
    , { multi: true }),
    VirtualOffers.wait(),
    VirtualOffers.indexWait(),

    r.tableCreate('VirtualOffersGroup'),
    VirtualOffersGroup.wait(),
    VirtualOffersGroup.indexWait(),

    r.tableCreate('Bots'),
    Bots.wait(),
    Bots.indexCreate('identifier'),
    Bots.indexCreate('steamId64'),
    Bots.indexCreate('username'),
    Bots.indexCreate('idState', i => ([ i('id'), i('state') ])),
    Bots.indexCreate('identifierState', i => ([ i('identifier'), i('state') ])),
    Bots.indexCreate('groups', { multi: true }),
    Bots.indexCreate('stateOpskinsEnabled', b => ([ b('state'), b('opskins')('enabled')])),
    Bots.indexCreate('stateOpskinsMaster', b => ([ b('state'), b('opskins')('isMaster')])),
    Bots.indexWait(),

    r.tableCreate('Items'),
    Items.wait(),
    Items.indexCreate('name'),
    Items.indexCreate('nameBlocked', i => ([ i('name'), i('blocked') ])),
    Items.indexCreate('cleanName'),
    Items.indexCreate('blocked'),
    Items.indexWait(),

    r.tableCreate('BotItems'),
    BotItems.wait(),
    BotItems.indexCreate('bot'),
    BotItems.indexCreate('offerId'),
    BotItems.indexCreate('name'),
    BotItems.indexCreate('state'),
    BotItems.indexCreate('assetId'),
    BotItems.indexCreate('assetIdState', row =>
      [row('assetId'), row('state')]
    ),
    BotItems.indexCreate('botState', row =>
      [row('bot'), row('state')]
    ),

    BotItems.indexCreate('groupsState', row =>
      row('groups').map(group =>
        [ group, row('state') ]
      )
    , { multi: true }),

    BotItems.indexCreate('groupsAssetId', row =>
      row('groups').map(group =>
        [ group, row('assetId') ]
      )
    , { multi: true }),

    BotItems.indexCreate('groupsStateTokens', row =>
      row('groups').map(group =>
        [ group, row('state'), row('tokens') ]
      )
    , { multi: true }),

    BotItems.indexCreate('assetIdState', row =>
      [row('assetId'), row('state')]
    ),
    BotItems.indexCreate('nameState', row =>
      [row('name'), row('state')]
    ),
    BotItems.indexCreate('idState', row =>
      [row('id'), row('state')]
    ),
    BotItems.indexWait(),

    r.tableCreate('TradeOffers'),
    TradeOffers.wait(),
    TradeOffers.indexCreate('offerId'),
    TradeOffers.indexCreate('state'),
    TradeOffers.indexCreate('type'),
    TradeOffers.indexCreate('steamId64'),
    TradeOffers.indexCreate('bot'),
    TradeOffers.indexCreate('offerId'),
    TradeOffers.indexCreate('itemState'),
    TradeOffers.indexCreate('tradeID'),
    TradeOffers.indexCreate('assetIds', { multi: true }),
    TradeOffers.indexCreate('botItemState', row => [row('bot'), row('itemState')]),
    TradeOffers.indexCreate('botState', row => [row('bot'), row('state')]),
    TradeOffers.indexCreate('botTypeState', row => [row('bot'), row('type'), row('state')]),
    TradeOffers.indexCreate('botItemStateType', row => [row('bot'), row('itemState'), row('type')]),
    TradeOffers.indexCreate('steamId64Type', row =>[row('steamId64'), row('type')]),
    TradeOffers.indexCreate('typeState', row => [row('type'), row('state')]),
    TradeOffers.indexCreate('typeStateCreatedAt', row => [row('type'), row('state'), row('createdAt')]),
    TradeOffers.indexWait()
  ]

  return new Promise((resolve, reject) => {
    eachSeries(steps, (query, done) =>
      query.run(connection, (err, res) => {
        done()
      })

    , () => resolve())
  })
}
