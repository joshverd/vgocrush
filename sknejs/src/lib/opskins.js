
import config from 'config'
import OPSkinsAPI from '@opskins/api'
import co from 'co'
import { eachSeries } from 'async'
import r from 'rethinkdb'
import _ from 'underscore'

import { TRADE_STATE_CONFIRM, TRADE_STATE_QUEUED, TRADE_TYPE_WITHDRAW } from '../constant/trade'
import { VirtualOffers, BotItems, TradeOffers } from './documents'
import { BOT_ITEM_STATE_AVAILABLE } from '../constant/item'
import { connection } from './database'
import logger from './logger'
import { amqpChannel } from './amqp'

OPSkinsAPI.prototype.postAsync = function() {
	const args = arguments
	this._requireKey()

	return new Promise((resolve, reject) =>
		this.post.apply(this, [ ...args, (err, res) => {
			return !!err ? reject(new Error(err.message)) : resolve(res)
		}])
	)
}

OPSkinsAPI.prototype.getAsync = function() {
	const args = arguments
	this._requireKey()

	return new Promise((resolve, reject) =>
		this.get.apply(this, [ ...args, (err, res) => !!err ? reject(new Error(err.message)) : resolve(res) ])
	)
}

OPSkinsAPI.prototype.getProfile = function(update, callback) {
	return new Promise((resolve, reject) => {
		this._requireKey()
		this.get('IUser', 'GetProfile', 1, update, (err, res) =>
			!!err ? reject(err) : resolve(res)
		)
	})
}

OPSkinsAPI.prototype.addWhitelistedApiIp = async function(ip, twofactor_code) {
	return await this.postAsync('IUser', 'AddWhitelistedApiIp', 1, {
		ip,
		twofactor_code
	})
}

OPSkinsAPI.prototype.updateProfile = async function(update, callback) {
	return await this.postAsync('IUser', 'UpdateProfile', 1, update)
}

OPSkinsAPI.prototype.buyItems = async function(saleids, total, callback) {
	this._requireKey();
	this.post("ISales", "BuyItems", 1, {"allow_trade_locked": true, "saleids": saleids.join(','), "total": total}, function(err, res, meta) {
		if (err) {
			callback(err);
		} else {
			callback(null, res.items, meta.balance);
		}
	});

}

OPSkinsAPI.prototype.transferToTradeSite = async function(items, callback) {
	return await this.postAsync('IInventory', 'TransferToTradeSite', 1, { items: items.join(',') })
}

OPSkinsAPI.prototype.updateProfile = async function(update, callback) {
	return await this.postAsync('IUser', 'UpdateProfile', 1, update)
}

OPSkinsAPI.prototype.getAccountSummary = async function(update, callback) {
	return await this.getAsync('IUser', 'GetAccountSummary', 1, update)
}

OPSkinsAPI.prototype.transferToVault = async function(amount) {
	return await this.postAsync('IVault', 'TransferToVault', 1, { amount })
}

OPSkinsAPI.prototype.getBalances = async function(amount) {
	return await this.getAsync('IUser', 'GetBalance', 1)
}

OPSkinsAPI.prototype.getUserInventoryFromSteamId = async function(steam_id) {
	return await this.getAsync('ITrade', 'GetUserInventoryFromSteamId', 1, {
		steam_id,
		app_id: '730_2'
	})
}

OPSkinsAPI.prototype.getInventory2 = function(callback) {
	this._requireKey()
	this.get('IInventory', 'GetInventory', 2, function(err, res) {
		if (err) {
			callback(err)
		} else {
			callback(null, res)
		}
	})
}

OPSkinsAPI.prototype.returnItemsToInventory = function(saleids, callback) {
	if (!Array.isArray(saleids)) {
		saleids = [saleids];
	}

	this._requireKey();
	this.post('ISales', 'ReturnItemsToInventory', 1, {'items': saleids.join(',')}, function(err, res, meta) {
		if (err && !res) {
			callback(err);
		} else {
			callback(null, meta);
		}
	});
};

OPSkinsAPI.prototype.withdrawInventoryItemsOther = function(saleids, steamId64, tradeToken, callback) {
	this._requireKey();
	this.post('IInventory', 'Withdraw', 1, {'items': saleids, 'delivery_id64': steamId64, 'delivery_token': tradeToken}, function(err, res, meta) {
		if (err && !res) {
      logger.info(res);
			callback(err);
		} else {
			callback(null, meta);
		}
	});
};

export function fixDelayedOPTrades() {
  logger.info('Checking for delayed opskin trades...')

  const tm = new Date(Date.now() + (60000 * 5))

  return co(function* () {
    const pendingOffers = yield VirtualOffers
      .getAll(TRADE_STATE_CONFIRM, { index: 'state' })
      .filter(r.row('createdAt').le(tm))
      .coerceTo('array')
      .run(connection())

    if(!pendingOffers.length) {
      return
    }

    eachSeries(pendingOffers, (offer, done) => {
      if(!!offer.tradeOfferId) {
        console.log('has offer')
        done()
        return
      }

      const assetIds = offer.assetIds || []
      const itemNames = offer.itemNames || []
      const botItemIds = offer.botItemIds || []

      let readyToSend = (assetIds.length === itemNames.length)

      co(function* () {
        const availableBotItems = yield BotItems
          .getAll(BOT_ITEM_STATE_AVAILABLE, { index: 'state' })
          .filter(r.row('createdAt').ge(offer.createdAt).and(r.row('opskins').default(false).eq(false)))
          .coerceTo('array')
          .run(connection())

        const botItems = yield BotItems
          .getAll(r.args(botItemIds))
          .orderBy(r.asc('createdAt'))
          .coerceTo('array')
          .run(connection())

        const itemsMissing = itemNames

        botItems.forEach(botItem => {
          const idx = itemsMissing.indexOf(botItem.name)
          if(idx >= 0) {
            itemsMissing.splice(idx, 1)
          }
        })

        const foundItems = []

        itemsMissing.forEach(name => {
          const botItem = _.findWhere(availableBotItems, {
            name
          })

          if(botItem) {
            foundItems.push(botItem)
          }
        })

        if(foundItems.length > 0) {
          logger.info(`Found ${foundItems.length} missing item(s) for opskins offer ${offer.id}`)

          let { changes } = yield BotItems
            .getAll(r.args(_.pluck(foundItems, 'id')))
            .update({
              opskins: true
            }, { returnChanges: true })
            .run(connection())

          const newBotItemsIds = _.pluck(_.pluck(changes, 'new_val'), 'id')
          const newBotItemsAssetIds = _.pluck(_.pluck(changes, 'new_val'), 'assetId')

          const botItemsIdsRow = r.row('botItemIds').default([])
          const newBotItemsIdRow = botItemsIdsRow.add(newBotItemsIds)

          const updateResult = yield VirtualOffers
            .getAll(offer.id)
            .update({
              botItemIds: newBotItemsIdRow,
              assetIds: r.row('assetIds').default([]).add(newBotItemsAssetIds)
            }, {
              returnChanges: true
            })
            .run(connection())

          if(updateResult.replaced > 0) {
            offer = updateResult.changes[0].new_val
            if(offer.assetIds.length === offer.itemNames.length) {
              readyToSend = true
            }
          }
        }

        if(readyToSend) {
          const botItem = yield BotItems.get(offer.botItemIds[0]).run(connection())

          const newTradeOffer = {
            createdAt: new Date(),
            type: TRADE_TYPE_WITHDRAW,
            state: TRADE_STATE_QUEUED,
            steamId64: offer.steamId,
            tradeLink: offer.tradeUrl,
            notifyUrl: offer.notifyUrl,
            assetIds: offer.assetIds,
            subtotal: offer.subtotal,
            itemNames: offer.itemNames,
            bot: botItem.bot,

            meta: {
              ...offer.meta,
              virtualOfferId: offer.id
            }
          }

          const { generated_keys: [ newTradeOfferId ] } = yield TradeOffers.insert(newTradeOffer, { returnChanges: true }).run(connection())
          newTradeOffer.id = newTradeOfferId

          yield VirtualOffers.get(offer.id).update({
            tradeOfferId: newTradeOfferId,
						withdrawCreatedAt: r.now(),
						withdrawElapsed: r.now().sub(r.row('pendingAt'))
          }).run(connection())

          amqpChannel().publish('skne.withdraw', newTradeOffer.bot, new Buffer(newTradeOfferId), { persistent: true })
        }

        done()
      })

      .catch(err => {

        if(!!err) {
          logger.error(`fixDelayedOPTrades() ${err}`)
        }

        done()
      })

    })
  })
}

export default OPSkinsAPI

export {
	OPSkinsAPI
}
