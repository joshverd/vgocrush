
import { Router } from 'express'
import co from 'co'
import r from '../../lib/database'
import _ from 'underscore'
import is from 'is_js'
import i18n from 'i18n'
import { mapSeries } from 'async'
import config from 'config'
import slug from 'slug'
import url from 'url'
import request from 'request'
import querystring from 'querystring'
import TradeOfferManager from 'steam-tradeoffer-manager'

import sockets from 'lib/sockets'
import logger from 'lib/logger'
import Raffles, { RaffleEntries } from 'document/raffles'
import Player, { PlayerWithdrawHistory, givePlayerBalance, logPlayerBalanceChange, PlayerBalanceHistory, addPlayerFlash } from '../../document/player'
import Campaign from 'document/campaign'
import { addStats } from 'document/stats'
import Order from 'document/order'
// import 'plugins/cases/documents/case', { CaseItems } from '../../document/case'

import skne, { TradeOffers, Items, getItems, withdraw, fetchInventory, deposit, virtualWithdraw, retryVirtualOffer, runBotExecute } from 'lib/sknexchange'
import { ITEM_WEAR, ITEM_SHORT_WEAR } from 'constant/item'
import { isValidTradeUrl, tradeOfferManager, getCSGOHours, getGroup } from 'lib/steam'
import redis from 'lib/redis'
import { getWear, cleanItemName } from 'lib/item'
import { getLevel } from 'lib/campaign'
import twitter from 'lib/twitter'
import { runPluginHook } from 'plugins'

import userCampaign from './userCampaign'

// POST /api/users/trackedOrder
function trackedOrder(req, res) {
  const { user } = req

  setTimeout(function() {
    co(function* () {
      yield Player.get(user.id).update({lastTrackedOrders: r.now().add(2*60)}).run();
    })

    .catch(err => {
      logger.error(`trackedOrder() ${err}`)
    })
  }, 5000)

  res.json({result:true})
}

// POST /api/users/update
function postUpdate(req, res) {
  const { email, tradeUrl, language } = req.body
  const update = {}
  const errors = []
  let restartRequired = false

  if(!!email) {
    if(is.email(email)) {
      update.email = email
    } else {
      errors.push('Invalid e-mail address')
    }
  }

  if(!!tradeUrl) {
    if(!isValidTradeUrl(tradeUrl, { steamId: req.user.id })) {
      return res.status(400).send('An invalid Steam trade url was given')
    }

    update.tradeUrl = tradeUrl
  }

  const languages = i18n.getLocales()
  if(!!language && languages.indexOf(language.toLowerCase()) >= 0 && language.toLowerCase() !== req.locale) {
    req.setLocale(language.toLowerCase())
    update.language = language.toLowerCase()
    restartRequired = true
  }

  co(function* () {
    if(Object.keys(update).length > 0) {
      yield Player.get(req.user.id).update(update).run()
    }

    res.json({
      errors,
      restartRequired
    })
  })

  .catch(err => {
    logger.error(`postUpdate() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function canAcceptItem({ name, category, souvenir, tokens, statTrak, type, price, blocked }) {
  if(blocked) {
    return false
  }

  // const bannedTypes = ['Base Grade Container']
  // if(bannedTypes.indexOf(type) >= 0) {
  //   return false
  // } else if(type.indexOf('Collectible') >= 0) {
  //   return false
  // }

  // No StatTrak items
  // if((typeof config.block.stKnives === 'undefined' || config.block.stKnives) && category === CATEGORY_MELEE && statTrak) {
    // return false
  if(category === 'STICKER') {
    return false
  } else if(category === 'CASE') {
    return false
  }

  return !souvenir && price >= config.minimumDeposit && config.sknexchange.blacklistedItems.indexOf(name) < 0
}

function getRemoteInventoryProxy(req,res){

  const id = req.body.id;

  co(function* () {

    tradeOfferManager.getUserInventoryContents(id, 730, 2, true, (err, inventory) => {
      if(err) {
        return res.status(400).send('Make sure your profile is set to public; or try later.')
      }

      inventory = inventory.filter(item => blacklistedItems.indexOf(item.market_hash_name) < 0);

      res.json({
        inventory: inventory
      })

    })

  }).catch(err => {
    logger.error(`getRemoteInventoryProxy() cannot get inventory:`, err)
    res.status(400).send('Make sure your profile is set to public; or try later.')
  })
}

// GET /api/users/remoteInventory
function getRemoteInventory(req, res) {
  const { id, tradeUrl } = req.user
  const { blacklistedItems } = config.sknexchange
  const discount = config.depositDiscount
  const steamId64 = req.user.id

  co(function* () {
    let refresh = false;

    const disabled = yield redis.getAsync('kingdom:disable:deposit')
    if(disabled) {
      return res.status(400).send('Depositing is currently disabled')
    }

    if(req.query.refresh) {
      const k = `inventory:refresh:${id}`
      const v = yield redis.getAsync(k)
      if(v) {
        const elapsed = 120 - parseInt((Date.now() - v) / 1000)
        return res.status(400).send(`You can only refresh your inventory once every 2 minutes. (Try again in ${elapsed}s)`)
      }

      redis.set(k, Date.now())
      redis.expire(k, 120)
      refresh = true
    }

    const inventory = yield fetchInventory(req.user.id, {
      refresh,

      discount: config.depositDiscount,
      tradeUrl: req.user.tradeUrl
    })

    const items = inventory.items.map(i => ({
      id: i.assetId,
      price: i.price,
      icon_url: i.icon,
      name_color: i.nameColor,
      quality_color: i.qualityColor,
      market_hash_name: i.cleanName,
      canAccept: i.canAccept,
      wear: ITEM_WEAR[i.wear]
    }))

    res.json({
      ...inventory,
      items,
      maxItems: config.maxDepositItems,
      minimumDeposit: config.minimumDeposit
    })

  })

  .catch(err => {
    logger.error(`getRemoteInventory() cannot get inventory:`, err)
    res.status(400).send('Make sure your profile is set to public; or try later.')
  })

}

function isBlockedCountry(shortCode){
  if(!shortCode) shortCode = "null";
  var blocked = config.blockedCountries || {};
  if(blocked[shortCode]) return true;
  else return false;
}

// POST /api/users/deposit
function postDeposit(req, res) {
  /*if(!req.user.tradeUrl) {
    return res.status(400).send('Please set a valid Steam trade link first')
  } else if(!isValidTradeUrl(req.user.tradeUrl, { steamId: req.user.id })) {
    return res.status(400).send('An invalid Steam trade url was given')
  } else*/

  if(!req.user.acceptedTerms) {
    return res.status(400).send('You must accept our Terms and Agreement first')
  }

  const { ids } = req.body

  if(ids.length <= 0) {
    return res.status(400).send('Invalid items')
  } else if(ids.length > 20) {
    return res.status(400).send('Max amount of items you can deposit at a time is 20')
  }

  if(req.user.lockDeposits) {
    return res.status(400).send('Your deposits are locked.')
  }

  co(function* () {
    logger.info(`User ID: ${req.user.id} from ${req.headers['cf-ipcountry']} is attempting a deposit request`)
    if(isBlockedCountry(req.headers['cf-ipcountry'])) {
      logger.info(`Blocked country: ${req.headers['cf-ipcountry']}`)
      return res.status(400).send('We’re sorry, we are not currently accepting players from your country.')
    }

    const disabled = yield redis.getAsync('kingdom:disable:deposit')
    if(disabled) {
      return res.status(400).send('Depositing is currently disabled')
    }

    const v = yield redis.setnxAsync('player:deposit:' + req.user.id, Date.now())
    if(!v) {
      return res.status(400).send('Please wait a minute before attempting to send another deposit offer')
    }

    redis.expire('player:deposit:' + req.user.id, 60)

    // TODO: Check if under 3 trade active offers
    const activeStates = ['SENT']
    const activeOfferCount = yield TradeOffers
      .getAll([ req.user.id, 'DEPOSIT'], { index: 'steamId64Type' })
      .filter(t => r.expr(activeStates).contains(t('state')))
      .count()

    if(activeOfferCount > 0) {
      return res.status(400).send('You already have an active deposit offer')
    }

    const inventory     = yield fetchInventory(req.user.id, {
     discount: config.depositDiscount,
     tradeUrl: req.user.tradeUrl
    })

    const depositItems  = inventory.items.filter(item => ids.indexOf(item.id) >= 0)
    const numDepositedThisDeposit = {}
    const numDepositedToday = {}

    /*
    for (let depositItem of depositItems) {
      numDepositedThisDeposit[depositItem.name] = numDepositedThisDeposit[depositItem.name] ? numDepositedThisDeposit[depositItem.name] + 1 : 1;
      const depositCount = yield redis.getAsync(`depositCount:${req.user.id}:${depositItem.name}`)
      numDepositedToday[depositItem.name] = depositCount ? parseInt(depositCount) : 0;
      if (depositCount > 10) {
        return res.status(400).send(`You have reached your limit for ${depositItem.name} deposits today`)
      }
      if (!depositItem.canAccept) {
        return res.status(400).send(`Cannot accept ${depositItem.name}`)
      }
    }
    */

    // These should equal the same, if they aren't then we were given an item
    // that wasn't in their inventory
    if(ids.length !== depositItems.length) {
      return res.status(400).send('Invalid items given')
    }

    const subtotal = Math.round(depositItems.reduce((t, i) => t + i.price, 0) * 100) / 100
    if(subtotal < config.minimumDeposit) {
      return res.status(400).send('Minimum deposit amount is $1.00')
    }

    const { result } = yield deposit({
      discount: config.depositDiscount,
      steamId64: req.user.id,
      tradeLink: req.user.tradeUrl,
      notifyUrl: config.sknexchange.notifyUrl,
      assetIds: depositItems.map(item => item.assetId),
      includeItems: true,
      group: 'deposit',

      meta: {
        requestIp: req.clientIp
      }
    })

    if(result.error) {
      return res.status(400).send(result.error)
    }

    /*
    for (let key of Object.keys(numDepositedThisDeposit)) {
      yield redis.setAsync(`depositCount:${req.user.id}:${key}`,  numDepositedThisDeposit[key] + numDepositedToday[key], 'EX', 60 * 60 * 24)
    }
    */

    res.json({
      success: true,
      tradeOffer: {
        ...result.tradeOffer,
        items: depositItems
      }
    })
  })

  .catch(err => {
    logger.error('POST /api/users/deposit', err)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// GET /api/users/withdrawals
function getWithdrawals(req, res) {

  co(function* () {
    const perPage = 15
    let page = req.query.page || 1
    if(page < 1) {
      page = 1
    }

    const query = PlayerWithdrawHistory
      .getAll('playerId', req.user.id, { index: 'playerId' })

    const count = yield query.count().run()
    const pages = Math.ceil(count / perPage)
    if(page > pages) {
      page = pages
    }

    const start = (page - 1) * perPage
    const withdrawals = yield query
      .orderBy(r.desc('createdAt'))
      // .slice(start, start + perPage)

      .run()

    res.json({
      withdrawals: withdrawals.map(o => ({
        id: o.id,
        updated_at: o.createdAt,
        items: o.items
      })),

      pagination: {
        page,
        pageCount: pages
      }
    })
  })

  .catch(err => {
    logger.error(`getWithdrawals() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function postSaveEmail(req, res) {
  const { user, body: { email } } = req

  co(function* () {
    const csgoHours = yield getCSGOHours(req.user.id)
    if(csgoHours < 10) {
      return res.status(400).send(req.__('ERR_CSGO_HOURS'))
    }

    yield addStats({
      counters: {
        emailSaves: 1
      }
    })

    r.db("kingdom").table("Player").get(req.user.id).update({email: req.body.email}).run();

    res.json({
      user: {
        email: req.body.email
      }
    })


  })

  .catch(err => {
    logger.error(`postSaveEmail() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function postRedeemPromo(req, res) {
  const { user, body: { code } } = req

  co(function* () {
    const disabled = yield redis.getAsync('kingdom:disable:redeem')
    if(disabled) {
      return res.status(400).send('Redeeming is currently disabled')
    }

    const campaigns = yield Campaign
      .getAll(code.toLowerCase(), { index: 'code' })
      .run()

    if(!campaigns.length) {
      return res.status(400).send(req.__('PROMO_NOT_FOUND'))
    }

    const campaign = campaigns[0]

    if(campaign.type === 'code') {
      if(campaign.playerId === req.user.id) {
        return res.status(400).send(req.__('ERR_PROMO_REDEEM_OWN'))
      } else if(user.hasRedeemedPromo) {
        return res.status(400).send(req.__('PROMO_ALREADY_REDEEMED'))
      }

      const csgoHours = yield getCSGOHours(req.user.id)
      if(csgoHours < 10) {
        return res.status(400).send(req.__('ERR_CSGO_HOURS'))
      }
    } else if(campaign.type === 'promo') {
      if(!!req.user.redeemedCodes && req.user.redeemedCodes.indexOf(code) >= 0) {
        return res.status(400).send('You have already redeemed this code before')
      }

      const { replaced, changes } = yield Campaign.get(campaign.id).update(r.branch(
        // Check if redeemed
        r.row('referralIds').default([]).contains(req.user.id),
        r.error('contains referral id'),

        // Max Usages
        r.row.hasFields('maxUsages')
          .and(r.row('maxUsages').gt(0))
          .and(r.row('referrals').default(0).ge(r.row('maxUsages'))),

        r.error('max usages reached'),

        // Expiration
        r.row.hasFields('expiresAt')
          .and(r.now().gt(r.row('expiresAt'))),
        r.error('code expiration'),

        // Linked to
        r.row.hasFields('playerId')
          .and(r.row('playerId').ne(req.user.id)),

        r.error('code not locked to user'),

        {
          referrals: r.row('referrals').default(0).add(1),
          referralIds: r.row('referralIds').default([]).append(req.user.id)
        }
      ))

      if(replaced === 0) {
        return res.status(400).send('An invalid or expired promo code was given')
      }

      const playerChanges = yield Player
        .get(req.user.id)
        .update(r.branch(r.row('redeemedCodes').default([]).contains(campaign.code).not(), {
          balance: r.row('balance').add(campaign.reward),
          redeemedCodes: r.row('redeemedCodes').default([]).append(campaign.code)
        }, r.error('already redeemed')), {
          returnChanges: true
        })

      if(playerChanges.replaced === 0) {
        return res.status(400).send(req.__('TRY_AGAIN_LATER'))
      }

      yield addStats({
        counters: {
          totalPromoRedeem: campaign.reward
        }
      })

      yield PlayerBalanceHistory.insert({
        meta: {
          name: 'Redeem Promo',
          code: campaign.code,
          campaign: campaign.id
        },

        playerId: req.user.id,
        date: new Date(),
        balance: campaign.reward
      })

      res.json({
        user: {
          balance: playerChanges.changes[0].new_val.balance
        }
      })

      return
    }

    const { replaced, changes } = yield Player
      .get(req.user.id)
      .update(r.branch(r.row('hasRedeemedPromo').default(false).eq(false), {
        balance: r.row('balance').add(campaign.reward),
        redeemedPromo: code,
        hasRedeemedPromo: true
      }, r.error('already redeemed')), {
        returnChanges: true
      })

      .run()

    if(replaced === 0) {
      return res.status(400).send(req.__('TRY_AGAIN_LATER'))
    }

    yield addStats({
      counters: {
        totalAffiliateRedeem: campaign.reward
      }
    })

    // stats.decrement('campaign.redeem', campaign.reward)

    yield PlayerBalanceHistory.insert({
      meta: {
        name: 'Redeem Promo',
        code: campaign.code,
        campaign: campaign.id
      },
      playerId: req.user.id,
      date: new Date(),
      balance: campaign.reward
    }).run()

    yield Campaign.get(campaign.id).update({
      // balance: r.row('balance').default(0).add(r.row('commissionPerReferral')),
      totalEarned: r.row('totalEarned').default(0).add(r.row('commissionPerReferral')),
      totalRewarded: r.row('totalRewarded').default(0).add(r.row('reward')),
      referrals: r.row('referrals').default(0).add(1),
      referralIds: r.row('referralIds').default([]).append(req.user.id)
    }).run()

    const response = yield Player
      .get(campaign.playerId)
      .update({
        // balance: r.row('balance').add(campaign.commissionPerReferral),
        referrals: r.row('referrals').default(0).add(1)
      }, { returnChanges: true })
      .run()

    if(response.replaced > 0) {

      // yield insertProfit(req.user.id, 'Affiliate: Comission', -campaign.commissionPerReferral, {
      //   campaignId: campaign.id
      // })

      // stats.decrement('campaign.comission', campaign.commissionPerReferral)
      // yield PlayerBalanceHistory.insert({
      //   meta: {
      //     name: 'Comission Per Referral',
      //     code: campaign.code,
      //     campaign: campaign.id
      //   },
      //   playerId: campaign.playerId,
      //   date: new Date(),
      //   balance: campaign.commissionPerReferral
      // }).run()

      const shouldBeLevel = getLevel(response.changes[0].new_val.referrals)

      if(shouldBeLevel !== response.changes[0].new_val.level) {
        yield Player.get(campaign.playerId).update({
          level: shouldBeLevel
        }).run()
      }

      yield addStats({
        counters: {
          rewardCode: 1,
          rewardTotal: campaign.reward
        }
      })
    }

    res.json({
      user: {
        balance: changes[0].new_val.balance
      }
    })
  })

  .catch(err => {
    logger.error(`postRedeemPromo() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// POST /api/users/claim_free_spin
function postReward(req, res) {
  const { type } = req.body

  co(function* () {

    const disabled = yield redis.getAsync('kingdom:disable:freespin')
    if(disabled) {
      return res.status(400).send('Claiming free spin is currently disabled')
    }

    // const csgoHours = yield getCSGOHours(req.user.id)
    // if(csgoHours < 10) {
    //   return res.status(400).send(req.__('ERR_CSGO_HOURS'))
    // }

    switch(type) {
      case 'facebook':

        res.json({
          url: `${config.app.url}/api/auth/facebook`
        })

        break

      case 'twitter':

        twitter.getRequestToken((err, requestToken, requestTokenSecret, results) => {
          if(err) {
            return res.status(400).send(req.__('TRY_AGAIN_LATER'))
          }

          req.session.twitterSecret = requestTokenSecret

          res.json({
            url: twitter.getAuthUrl(requestToken)
          })
        })

        break

      case 'primary_group':
        {
          const inGroup = yield getGroup(req.user.id, config.steam.group)
          if(!inGroup || inGroup.$.isPrimary !== '1') {
            return res.status(400).send(req.__('CLAIM_SPIN_NOT_IN_GROUP'))
          }

          const reward = 0.06
          let response = yield Player
            .get(req.user.id)
            .update(r.branch(r.row('claimedGroupPrimary').default(false).eq(false), {
              claimedGroupPrimary: true,
              balance: r.row('balance').add(reward)
            }, {

            }), { returnChanges: true })
            .run()

          if(response.replaced <= 0) {
            return res.status(400).send(req.__('ALREADY_CLAIMED_SPIN'))
          }

          logPlayerBalanceChange(req.user.id, reward, {
            name: `Reward: Steam Primary Group Follow`
          })

          yield addStats({
            counters: {
              rewardSteamPrimary: 1,
              rewardTotal: reward
            }
          })

          res.json({
            user: {
              balance: response.changes[0].new_val.balance
            }
          })
        }

        break

      case 'group':
        let inGroup = yield getGroup(req.user.id, config.steam.group)
        if(!inGroup) {
          return res.status(400).send(req.__('CLAIM_SPIN_NOT_IN_GROUP'))
        }

        const reward = 0.07
        let response = yield Player
          .get(req.user.id)
          .update(r.branch(r.row('claimedGroupFreeSpin').default(false).eq(false), {
            claimedGroupFreeSpin: true,
            balance: r.row('balance').add(reward)
          }, {

          }), { returnChanges: true })
          .run()

        if(response.replaced <= 0) {
          return res.status(400).send(req.__('ALREADY_CLAIMED_SPIN'))
        }

        logPlayerBalanceChange(req.user.id, reward, {
          name: `Reward: Steam Group Follow`
        })

        yield addStats({
          counters: {
            rewardSteam: 1,
            rewardTotal: reward
          }
        })

        res.json({
          user: {
            balance: response.changes[0].new_val.balance
          }
        })

        break

      default:
        res.status(400).send(req.__('TRY_AGAIN_LATER'))
        break
    }
  })

  .catch(err => {
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// GET /api/users/deposits
function getDeposits(req, res) {
  co(function* () {
    const tradeOffers = yield TradeOffers
      .getAll([ req.user.id, 'DEPOSIT' ], { index: 'steamId64Type' })
      .limit(50)

    const perPage = 20
    let page = req.query.page || 1
    if(page < 1) {
      page = 1
    }

    const query = Order
      .getAll([ req.user.id, true ], { index: 'playerIdCompleted' })

    const count = yield query.count().run()
    const pages = Math.ceil(count / perPage)
    if(page > pages) {
      page = pages
    }

    const start = (page - 1) * perPage
    const deposits = yield query
      .orderBy(r.desc('createdAt'))
      .limit(20)
      // .slice(start, start + perPage)
      .run()

    const history = []

    for(let offer of tradeOffers) {
      let details = offer.itemNames.join(', ')

      history.push({
        details,

        id: offer.id,
        createdAt: offer.createdAt,
        amount: offer.subtotalPrice,
        state: offer.state,
        tradeOfferUrl: offer.tradeOfferUrl,
        securityToken: offer.securityToken,
        error: offer.hasError ? offer.error : null,
        type: 'SKINS'
      })
    }

    for(let o of deposits) {
      let push = {
        id: o.id,
        createdAt: o.createdAt,
        amount: o.amount,
        type: o.method.toUpperCase(),
        state: 'ACCEPTED'
      }

      if(o.method === 'skins') {
        continue
      }
    }

    res.json({
      history: _.sortBy(history, 'createdAt').reverse(),

      pagination: {
        page,
        pageCount: pages
      }
    })
  })

  .catch(err => {
    logger.error(`getDeposits()`, err)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function postRetryOffer(req, res) {
  const { id } = req.body

  co(function* () {

    const k = `user:${req.user.id}:retryOffer:${id}`
    const v = yield redis.getAsync(k)
    if(v) {
      const elapsed = 30 - parseInt((Date.now() - v) / 1000)
      return res.status(400).send(`You cannot retry this offer yet (Try again in ${elapsed}s)`)
    }

    redis.set(k, Date.now())
    redis.expire(k, 30)

    yield retryVirtualOffer({
      id,
      steamId: req.user.id,
      tradeUrl: req.user.tradeUrl
    })

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error(`postRetryOffer()`, {
      err
    })
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

async function getTwitter(req, res) {
  const { oauth_token: requestToken, oauth_verifier: verifier } = req.query

  await addPlayerFlash(req.user.id, 'showRaffle')

  twitter.getAccessToken(requestToken, req.session.twitterSecret, verifier, (err, accessToken, accessSecret) => {
    if(!!err) {
      addPlayerFlash(req.user.id, 'twitterNotFollow').run()
      return res.redirect(config.app.url)
    }

    twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
      if(!!err) {
        addPlayerFlash(req.user.id, 'twitterNotFollow').run()
        return res.redirect(config.app.url)
      }

      twitter.friendships('lookup', {
        screen_name: ''
      }, accessToken, accessSecret, (err, data) => {
        if(!!err || !data.length) {
          addPlayerFlash(req.user.id, 'twitterNotFollow').run()
          return res.redirect(config.app.url + '/rewards')
        }

        if(data[0].connections.indexOf('following') < 0) {
          addPlayerFlash(req.user.id, 'twitterNotFollow').run()
          return res.redirect(config.app.url + '/rewards')
        }

        co(function* () {
          let response = yield Player
            .get(req.user.id)
            .update({ claimedTwitterFollow: true })
            .run()

          if(response.replaced <= 0) {
            return res.redirect(config.app.url)
          }

          const { changes, replaced: raffleReplaced } = yield Raffles.getAll('april18', { index: 'raffleId' }).update({
            totalEntries: r.row('totalEntries').add(1)
          }, { returnChanges: true })

          if(raffleReplaced > 0) {
            const change = changes[0]
            const tickets = []

            for(let ticketNumber = change.old_val.totalEntries; ticketNumber < change.new_val.totalEntries; ticketNumber++) {
              let color = _.sample(['green', 'yellow', 'red'])

              tickets.push({
                color,
                ticketNumber,

                raffleId: change.new_val.id,
                createdAt: new Date(),
                playerId: req.user.id
              })
            }

            yield RaffleEntries.insert(tickets, { returnChanges: true })
          }

          yield addStats({
            counters: {
              rewardTwitter: 1
            }
          })

          addPlayerFlash(req.user.id, 'twitterFollowed').run()
          res.redirect(config.app.url)
        })

        .catch(err => {
          logger.error(`getTwitter() ${err}`)
          res.redirect(config.app.url + '/rewards')
        })
      })
    })
  })
}

function postCollectCaseEarnings(req, res) {
  co(function* () {

    const campaignsQuery = Campaign
      .getAll(req.user.id, { index: 'playerId' })

    const balance = yield campaignsQuery.sum('balance')
    if(balance <= 1) {
      return res.status(400).send('You\'re earnings must be at least $1.00 to collect')
    }

    const { replaced, changes } = yield campaignsQuery.update({
      balance: 0
    }, { returnChanges: true })

    const earnings = changes.reduce((s, c) => s + ( (c.old_val.balance || 0) - (c.new_val.balance || 0)), 0)

    yield givePlayerBalance(req.user.id, earnings, {
      name: `Collect Case Earnings`,
      campaignIds: changes.map(c => c.new_val.id)
    })

    res.json({
      success: true
    })
  })

  .catch(err => {
    logger.error(`postCollectCaseEarnings() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function getDepositParams(req, res) {
  co(function* () {
    switch(req.params.type) {
      case 'gift':
        const { partnerId, productId } = config.paygarden
        const postBackUrl = `${config.app.url}/api/ipn/pg`

        return res.json({
          paymentUrl: `https://secure.paygarden.com/pay/site/${partnerId}/${productId}?postback-url=${postBackUrl}&account-id=${req.user.id}`
        })

      case 'engagemetv':
        return res.json({
          channels: config.engagemetv.channels.map(id => ({
            id,
            url: `https://asmclk.com/click.php?aff=112353&camp=${id}&from=10963&prod=4&sub1=${req.user.id}`

          }))
        })
    }

    res.status(400).send('Could not find payment gateway')
  })

  .catch(err => {
    logger.error(`getDepositParams() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

async function postAcceptTerms(req, res) {
  const { replaced } = await Player.get(req.user.id).update({
    acceptedTerms: true
  })

  res.json({
    success: replaced > 0
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()

  router.post('/trackedOrder', trackedOrder)
  router.post('/update', postUpdate)
  router.get('/remoteInventory', getRemoteInventory)
  router.get('/remoteInventoryProxy', getRemoteInventoryProxy)
  router.get('/deposit/:type', getDepositParams)
  router.post('/deposit', postDeposit)
  router.get('/deposits', getDeposits)
  router.get('/withdrawals', getWithdrawals)
  router.post('/affiliate', postRedeemPromo)
  router.post('/emailSave', postSaveEmail)
  router.post('/collectCaseEarnings', postCollectCaseEarnings)
  router.post('/reward', postReward)
  router.get('/twitter', getTwitter)
  router.post('/retryOffer', postRetryOffer)
  router.post('/acceptTerms', postAcceptTerms)
  router.use('/campaign', userCampaign())

  runPluginHook('afterApiUsersRouteCreated', router)
  return router
}
