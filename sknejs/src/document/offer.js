
import r from '../lib/database'

const TradeOffers = r.table('TradeOffers')
export default TradeOffers

export const PendingOffers = r.table('PendingOffers')
export const SteamTradeHistory = r.table('SteamTradeHistory')
