
import { Router } from 'express'
import co from 'co'
import _ from 'underscore'
import is from 'is_js'
import { mapSeries } from 'async'
import config from 'config'
import slug from 'slug'
import moment from 'moment'
import numeral from 'numeral'

import r from 'lib/database'
import redis from 'lib/redis'
import { ensureAuthenticated } from 'lib/middleware'

import Campaign from 'document/campaign'
import Case, { CaseItems } from '../documents/case'
import { CaseStats, addCaseStats } from '../documents/stats'
import { addStats } from 'document/stats'

import Player, { PlayerBalanceHistory, takePlayerBalance, givePlayerBalance } from 'document/player'
import { PlayerLikes, PlayerOpens, PlayerItems, PLAYER_ITEM_AVAILABLE, createKeyPair } from '../documents/player'

import skne, { getItems } from 'lib/sknexchange'
import logger from 'lib/logger'
import { getRollNumber, getWinningItemName, addLiveCases, determineCaseData } from '../'
import recaptcha from 'lib/recaptcha'
import { ITEM_WEAR, ITEM_SHORT_WEAR } from 'constant/item'
import { getCSGOHours } from 'lib/steam'
import { getLevelReward } from 'lib/campaign'
import { getWear, cleanItemName } from 'lib/item'

const addLiveCasesThrottled = _.throttle(addLiveCases, 200)

redis.del("cases:trending")

const timespans = {
  '1d': (24 * 3600),
  '7d': ((24 * 7) * 3600),
  '2w': ((24 * 14) * 3600)
};

      // Closure
      (function() {
        /**
         * Decimal adjustment of a number.
         *
         * @param {String}  type  The type of adjustment.
         * @param {Number}  value The number.
         * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
         * @returns {Number} The adjusted value.
         */
        function decimalAdjust(type, value, exp) {
          // If the exp is undefined or zero...
          if (typeof exp === 'undefined' || +exp === 0) {
            return Math[type](value);
          }
          value = +value;
          exp = +exp;
          // If the value is not a number or the exp is not an integer...
          if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
            return NaN;
          }
          // Shift
          value = value.toString().split('e');
          value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
          // Shift back
          value = value.toString().split('e');
          return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
        }

        // Decimal round
        if (!Math.round10) {
          Math.round10 = function(value, exp) {
            return decimalAdjust('round', value, exp);
          };
        }
        // Decimal floor
        if (!Math.floor10) {
          Math.floor10 = function(value, exp) {
            return decimalAdjust('floor', value, exp);
          };
        }
        // Decimal ceil
        if (!Math.ceil10) {
          Math.ceil10 = function(value, exp) {
            return decimalAdjust('ceil', value, exp);
          };
        }
      })();


// GET /api/crates
//
function getCases(req, res) {
  const categories = {
    'official': req.__('CASES_CAT_OFFICIAL'),
    'recent': req.__('CASES_CAT_RECENT'),
    'trending': req.__('CASES_CAT_TRENDING')
  }

  if(!!req.user) {
    categories['self'] = req.__('CASES_CAT_SELF')
    categories['favorites'] = req.__('Favorites')
  }

  let category = 'official'

  const free = req.params.slug === 'daily'

  co(function* () {
    let query = Case
      .getAll([ free, false, true ], { index: 'freeDisabledOfficial' })

    if(!free) {
      if(!!req.query.id) {
        query = Case
          .getAll(req.query.id)
          .filter({
            disabled: false
          })
          //   official: true,
          //   free: false,
          //   disabled: false
          // })
      } else if(req.params.slug) {
        query = Case
          .getAll([ req.params.slug, false ], { index: 'slugDisabled' })
          .map(c =>
            r.branch(c('official'), c, c.merge({
              creatorName: Player.get(c('playerId'))('displayName')
            }))
          )
      }
    }


    if(!!req.query.category && !!categories[req.query.category]) {
      category = req.query.category
    }


    if(category) {
      switch(category) {
        case 'official':

          req.query.filter = req.query.filter || 'hilo'

          switch(req.query.filter) {
            case 'hilo':
              query = query.orderBy(r.desc('price'))
              break

            case 'lohi':
              query = query.orderBy(r.asc('price'))
              break

            case 'az':
              query = query.orderBy(r.asc('name'))
              break

            case 'za':
              query = query.orderBy(r.desc('name'))
              break
          }

          break

        case 'recent':
          query = Case

          let filter = r.row('official').default(false).eq(false)
          let search = is.string(req.query.search) ? req.query.search : ''

          if(!!search && search.length > 0) {
            filter = filter.and(r.row('name').match(`(?i)${search}`))
          }

          query = query.orderBy({
            index: r.desc('createdAt')
          })
          .filter(filter)

          break

        case 'trending':
          // Get ids of cases with top openings
          // const ts = Math.round(new Date().getTime() / 1000) - (24 * 3600)
          //
          // const caseIds = yield CaseStats
          //   .between(ts, r.maxval, { index: 'createdAt' })
          //   .orderBy(r.desc('totalOpenings'))
          //   .limit(40)
          //   .map(s => s('caseId'))
          //
          //   .run()
          //
          // query = Case
          //   .getAll(r.args(caseIds))
          //   .filter({ official: false, free: false })
          //   .orderBy(r.desc('createdAt'))
          break

        case 'favorites':
          if(!!req.user) {
            const ids = yield PlayerLikes
              .getAll(req.user.id, { index: 'playerId' })
              .map(l => l('caseId'))

            query = Case.getAll(r.args(ids))
          }

          break

        case 'browser':
          query = r.branch(req.query.search.length > 0,
            Case.filter(r.row('name').match(`(?i)${req.query.search}`)),
            []
          )
          break

      case 'self':
        if(!!req.user) {
          query = Case
            .getAll(req.user.id, { index: 'playerId' })
            .merge(c => ({
              stats: CaseStats.getAll(c('id'), { index: 'caseId' }).coerceTo('array'),
              campaign: Campaign.get(c('campaignId'))
            }))
        }

        break
      }
    }

    let cases = []

    if(category === 'trending') {
      const timespan = !!timespans[req.query.timespan] ? req.query.timespan : '1d';
      const trendingCases = yield redis.getAsync('cases:trending' + timespan)
      if(trendingCases) {
        cases = JSON.parse(trendingCases)
      } else {
        const caseIds = []
        const trendingStart = Math.round(new Date().getTime() / 1000) - timespans[timespan]

        for(let tier of config.cases.tiers) {
          let minPrice = tier.range[0]
          let maxPrice = tier.range.length > 1 ? tier.range[1] : r.maxval

          // let ids = yield CaseStats
          //   .between([false, minPrice, trendingStart], [false, maxPrice, r.maxval], { index: 'officialPriceCreatedAt' })
          //   .orderBy(r.desc('totalOpenings'))
          //   .limit(150)
          //   .map(s => s('caseId'))

          if(tier.range[0] >= 5) {
            var ids = yield CaseStats
              .between(
                [false, minPrice, trendingStart],
                [false, maxPrice, r.maxval],
                { index: 'officialPriceCreatedAt' }
              )
              .filter(r.row("caseCreatedAt").gt(r.now().sub(60*60*24*14)))
              .group("caseId")
              .sum("totalSpent")
              .ungroup()
              .orderBy(r.desc("reduction"))
              .limit(100)
              .eqJoin("group",r.db("kingdom").table("Case"))
              .zip()
              .filter({official:false,free:false,disabled:false})
              .orderBy(r.desc("reduction"))
              .limit(10)
              .map(s => s('group'))
          } else {
            var ids = yield CaseStats
              .between(
                [false, minPrice, trendingStart],
                [false, maxPrice, r.maxval],
                { index: 'officialPriceCreatedAt' }
              )
              .filter(r.row("caseCreatedAt").gt(r.now().sub(60*60*24*7)))
              .group("caseId")
              .sum("totalSpent")
              .ungroup()
              .orderBy(r.desc("reduction"))
              .limit(100)
              .eqJoin("group",r.db("kingdom").table("Case"))
              .zip()
              .filter({official:false,free:false,disabled:false})
              .orderBy(r.desc("reduction"))
              .limit(10)
              .map(s => s('group'))
          }

          // console.log(ids)

          let tierCases = yield Case
            .getAll(r.args(_.uniq(ids)))
            .limit(10)
            .pluck('id', 'price', 'name', 'caseStyle', 'items', 'playerId', 'slug', 'official', 'creatorName', 'free', 'openingsCount', {
              stats: ['totalOpenings'],
              campaign: ['balance', 'totalEarned']
            })
            .merge({
              minPrice,
              tier: tier.name
            })
            .run({
              readMode: 'outdated'
            })

          cases.push(...tierCases)
        }

        redis.set('cases:trending' + timespan, JSON.stringify(cases))
        redis.expire('cases:trending' + timespan, 60 * 3)
      }
    }

    if(cases.length <= 0 && category !== 'trending') {
      cases = yield query
        .limit(150)
        .pluck('stats', 'id', 'price', 'name', 'caseStyle', 'items', 'playerId', 'slug', 'official', 'creatorName', 'free', 'openingsCount', {
          stats: ['totalOpenings'],
          campaign: ['balance', 'totalEarned']
        })

        .run({
          readMode: 'outdated'
        })
    }

    if(free && !cases.length) {
      return res.status(400).send('Cannot find free case, check back later')
    }

    if(cases.length === 0 && !!req.params.slug) {
      cases = yield Case
        .getAll(req.params.slug)
        .filter({
          free: false
        })
        .map(c =>
          r.branch(c('official'), c, c.merge({
            creatorName: Player.get(c('playerId'))('displayName')
          }))
        )
        .pluck('stats', 'id', 'price', 'name', 'caseStyle', 'items', 'playerId', 'slug', 'official', 'creatorName', 'free', 'openingsCount', {
          stats: ['totalOpenings'],
          campaign: ['balance', 'totalEarned']
        })

        .run({
          readMode: 'outdated'
        })
    }

    const itemNames = cases.reduce((items, item) => items.filter(item => !item.type || item.type !== 'cash').concat(_.pluck(item.items, 'name')), [])

    const items = _
      .chain(yield getItems(itemNames))
      .map(item => [item.name, item])
      .object()
      .value();

    if(category === 'trending') cases = _.shuffle(cases)

    res.json({
      category,
      categoryName: categories[category],
      categories,

      cases: cases

        .filter(c => {
          if(c.price <= 0 && !free) {
            return false
          }

          return true
        })

        .map(c => ({
          ...c,
          price: c.price, // How the frontend was built
          items: c.items.map(i => {

            if(i.type === 'cash') {
              return {
                ...i,
                chance: ((i.prob.high - i.prob.low) / 100000),
                price: i.prize,
                name: 'Cash'
              }
            }

            const item = items[i.name]
            if(!item) {
              throw new Error(`Item ${item.name} could not be found`)
            }

            const pushItem = {
              ...i,
              price: item.price, // How the frontend was built
              icon_url: item.icon,
              other_price: null,
              quality_color: item.qualityColor,
              market_hash_name: item.name,
              cleanName: item.cleanName,
              case_name: c.name,
              chance: ((i.prob.high - i.prob.low) / 100000),
              wear: ITEM_WEAR[item.wear] || ''
            }

            // if(!i.wearsArray || !i.wearsArray.length) {
              return pushItem
            // }

            // return i.wearsArray.map(w => ({
            //   ...pushItem,
            //   market_hash_name: `${item.cleanName} (${ITEM_SHORT_WEAR[w]})`,
            //   name: `${item.cleanName} (${ITEM_SHORT_WEAR[w]})`,
            //   wear: ITEM_SHORT_WEAR[w],
            //   chance: pushItem.chance / i.wearsArray.length
            // }))

            // const item = items[i.name]
            // if(!item) {
            //   throw new Error(`Item ${item.name} could not be found`)
            // }
            //
            // return {
            //   ...i,
            //   price: item.price, // How the frontend was built
            //   icon_url: item.icon,
            //   other_price: null,
            //   quality_color: item.qualityColor,
            //   market_hash_name: item.cleanName,
            //   case_name: c.name,
            //   wear: ITEM_WEAR[item.wear] || ''
            // }
          })

          .reduce((arr, i) => Array.isArray(i) ? [ ...arr, ...i ] : [ ...arr, i ], [])
        }))
      })
  })

  .catch(err => {
    logger.error(`getCases() ${err}`)
    res.status(400).send('Please try again later')
  })
}

// POST /api/crates/open
function postOpenCase(req, res) {
  let { crateId, amount, test } = req.body
  // const { user } = req.user

  if(req.user && req.user.disableOpeningCase) {
    return res.status(400).send(req.__('TRY_AGAIN_LATER'))
  }

  if(amount && (!is.number(amount) || amount > 10 || amount < 1)) {
    return res.status(400).send('Invalid amount')
  } else if (!is.string(crateId)) {
    return res.status(400).send('Invalid crate')
  }

  let openCase
  let openCaseEnd, takeBalanceEnd, mapEnd

  co(function* () {

    const disabled = yield redis.getAsync('kingdom:disable:opencase')
    if(disabled) {
      return res.status(400).send('Opening cases is currently disabled')
    }

    const openCaseStart = process.hrtime()
    openCase = yield Case.get(crateId).run()
    openCaseEnd = process.hrtime(openCaseStart)

    if(!openCase) {
      return res.status(400).send('Could not find case')
    } else if(openCase.disabled) {
      return res.status(400).send('This case is currently disabled')
    } else if(!openCase.official) {
      const customDisabled = yield redis.getAsync('kingdom:disable:customcase')
      if(customDisabled) {
        return res.status(400).send('Opening cases is currently disabled')
      }
    }

    amount = amount <= 0 ? 1 : amount
    if(openCase.free) {
      amount = 1
      // return res.status(400).send(req.__('TRY_AGAIN_LATER'))

      if(!test) {

 //        There are three requirements to opening:
 // - vgocrush must be in the users steam name
 // - they must have deposited at least $2
 // - haven't opened the case that day

        if(req.user.displayName.toLowerCase().indexOf('vgocrush') == -1 && req.user.totalDeposit < 2) {
          if(req.user.displayName.toLowerCase().indexOf('vgocrush') == -1) {
            return res.status(400).send(req.__('NAME_PROMOTION_REQUIRED'))
          } else if(req.user.totalDeposit < 2) {
            return res.status(400).send(req.__('DAILY_DEPOSIT_REQUIREMENT'))
          }
        }

        // const hours = yield getCSGOHours(req.user.id)
        // if(hours < 10) {
        //   return res.status(400).send(req.__('ERR_CSGO_HOURS'))
        // }
        //
        // const validated = yield new Promise((resolve) => {
        //   const key = req.body.recaptcha || ''
        //   if(!key || !key.length) {
        //     return resolve(false)
        //   }
        //
        //   recaptcha
        //     .validate(key)
        //     .then(() => resolve(true), () => resolve(false))
        // })
        //
        // if(!validated) {
        //   return res.status(400).send('Invalid captcha response')
        // }
      }
    }

    let nonces      = []
    let keyPair     = {}
    let userUpdates = {}

    if(!test && req.user) {
      const { user }      = req
      let updateResponse  = null

      const takeBalanceStart = process.hrtime()

      if(openCase.free) {

        updateResponse = yield Player
          .get(user.id)
          .update(r.branch(r.row.hasFields('nextFreeSpin').not().or(  r.row('nextFreeSpin').le(r.now()) ), {
            nextFreeSpin: r.now().add(86400), // 86400 seconds in a day, I googled it.
            keyPair: r.row('keyPair').merge(keyPair => ({
              nonce: keyPair('nonce').add(1)
            }))
          }, { }), { returnChanges: true })
          .run()
      } else {
        if(openCase.price <= 0) {
          return res.status(400).send('Please try again later')
        }

        const cost  = openCase.price * amount;

        updateResponse = yield takePlayerBalance(user.id, cost, {
          name: `Open Case x${amount} (${openCase.name})`,
          'case': openCase.id
        }, player => ({
          keyPair: player('keyPair').merge(keyPair => ({
            nonce: keyPair('nonce').add(amount)
          }))
        }))
      }

      takeBalanceEnd = process.hrtime(takeBalanceStart)

      const { replaced, changes } = updateResponse

      if(replaced <= 0) {
        const until = moment(req.user.nextFreeSpin).fromNow(true)
        return res.status(400).send(openCase.free ? `Please wait ${until} to claim your next daily spin` : 'Insufficient Funds')
      }

      const { new_val, old_val } = changes[0]
      userUpdates = new_val
      keyPair     = new_val.keyPair

      const startNonce = old_val.keyPair.nonce + 1
      nonces = Array.from({ length: amount }).map((_, i) => i + startNonce)
    } else {
      keyPair = createKeyPair()
      nonces  = Array.from({ length: amount }).map((_, i) => i)
    }

    const history = []
    const mapStart = process.hrtime()
    mapSeries(nonces, (nonce, done) => {
      const { serverSeed, clientSeed, serverSeedHash } = keyPair
      const roll = getRollNumber(serverSeed, clientSeed, nonce)

      let winningItem = getWinningItemName(roll, openCase.items)
      if(!winningItem) {
        return done(`Could not get winning item from roll: ${roll} (${nonce})`)
      }

      co(function* () {
        let item = null

        if(winningItem.type === 'cash') {
          item = {
            ...winningItem,
            price: winningItem.prize
          }
        } else {
          let items = yield getItems([winningItem.name])
          if(!items.length) {
            return done(`Could not get winning item skin for roll: ${roll} (${nonce})`)
          }

          // if(!!winningItem.wearsArray && winningItem.wearsArray.length) {
          //   const chosenWear = ITEM_SHORT_WEAR[winningItem.wearsArray[Math.floor(Math.random() * winningItem.wearsArray.length)]]
          //   winningItem.name = `${items[0].cleanName} (${chosenWear})`
          //
          //   items = yield getItems([winningItem.name])
          //   if(!items.length) {
          //     return done(`Could not get winning item for roll: ${roll} (${nonce}) (${winningItem.name})`)
          //   }
          // }


          item = {
            ...winningItem,
            id: items[0].name,
            price: items[0].price,
            icon_url: items[0].icon,
            other_price: null,
            quality_color: items[0].qualityColor,
            market_hash_name: items[0].name,
            case_name: openCase.name,
            wear: ITEM_WEAR[items[0].wear] || ''
          }
        }

        if(!test && req.user) {
          history.push({
            item,
            roll,
            keyPair,
            nonce,

            createdAt: new Date(),
            playerId: req.user.id,
            caseId: openCase.id,
            prize: item.price,

            'case': {
              name: openCase.name,
              price: openCase.price,
              image: openCase.caseStyle
            },

            player: {
              id: req.user.id,
              name: req.user.displayName,
              avatar: req.user.avatarFull
            }
          })
        }

        done(null, item)
      })
      // done(null, getWinningItemName(roll, openCase.items))
    }, (err, openings) => {
      if(err) {
        logger.error(`postOpenCase() ${err}`, {
          caseId: crateId,
          playerId: req.user ? req.user.id : null
        })

        res.status(400).send('Internal error, please contact support!')
        return
      }

      mapEnd = process.hrtime(mapStart)

      // if(!test) {
      //   stats.increment('cases.opened', openings.length)
      //   stats.increment(`cases.opened.name.${openCase.name}`, openings.length)
      // }

      const response = {
        openings
      }

      co(function* () {
        if(!test && req.user) {
          response.user = {
            balance: userUpdates.balance,
            keyPairNonce: userUpdates.keyPair.nonce,
            spins: userUpdates.freeSpins
          }

          const skinOpenings  = openings.filter(o => o.type !== 'cash')
          const moneyEarned   = openings
            .filter(o => o.type === 'cash')
            .reduce((total, o) => total + o.prize, 0)

          if(moneyEarned > 0) {
            const { changes } = yield givePlayerBalance(req.user.id, moneyEarned, {
              caseId: crateId
            })

            if(changes && changes.length) {
              response.user.newBalance = changes[0].new_val.balance
            }
          }

          res.json(response)

          const spent = openCase.price * openings.length;
          const profit = (moneyEarned + openings.filter(o => o.type !== 'cash').reduce((t, o) => t + o.price, 0))

          Case.get(crateId).update({
            openingsCount: r.row("openingsCount").add(openings.length).default(1),
            lastOpened: new Date()
          }).run()

          // stats.increment(`cases.profit.${openCase.name}`, spent - profit)

          // if(req.user.hasRedeemedPromo) {
          //   const campaigns = yield Campaign
          //     .getAll(req.user.redeemedPromo.toLowerCase(), { index: 'code' })
          //
          //     .run()
          //
          //   if(campaigns.length) {
          //     const campaign = campaigns[0]
          //     const campaignPlayer = yield Player
          //       .get(campaign.playerId)
          //       .run()
          //
          //     if(campaignPlayer) {
          //       const reward = getLevelReward(campaignPlayer.level)
          //       const comission = spent * (reward.commission / 100)
          //
          //       yield insertProfit(req.user.id, 'Affiliate: Case Comission', -comission, {
          //         campaignId: campaign.id
          //       })
          //
          //       // stats.decrement('campaign.caseComission', comission)
          //
          //       givePlayerBalance(campaign.playerId, comission, {
          //         name: 'Comission',
          //         campaign: campaign.id
          //       })
          //     }
          //   }
          // }

          if(openCase.campaignId) {
            yield Campaign.get(openCase.campaignId).update({
              balance: r.row('balance').default(0).add(openCase.commission * amount),
              totalEarned: r.row('totalEarned').default(0).add(openCase.commission * amount),
              referrals: r.row('referrals').default(0).add(amount)
            }).run()
          }

          PlayerBalanceHistory.insert({
            meta: {
              name: 'Case Winnings',
              caseId: crateId,
              itemNames: skinOpenings.map(opening => opening.name)
            },
            playerId: req.user.id,
            date: new Date(),
            balance: 0
          }).run()

          // Add the item to the player inventory
          const { inserted } = yield PlayerItems
            .insert(skinOpenings.map(opening => ({
              createdAt: new Date(),
              playerId: req.user.id,
              caseId: crateId,
              name: opening.name,
              state: PLAYER_ITEM_AVAILABLE
            })))
            .run()

          if(inserted !== skinOpenings.length) {
            throw new Error('result.inserted !== ' + openings.length)
          }

          if(history.length) {
            PlayerOpens.insert(history).run()

            if(req.user.id != openCase.playerId) {
              addCaseStats(openCase, {
                counters: {
                  profit: (spent - profit),
                  totalOpenings: history.length,
                  totalSpent: spent
                }
              })
            }

            // if(!openCase.free) {
              addStats({
                counters: {
                  caseProfit: openCase.free ? 0 : (spent - profit),
                  totalOpenings: openCase.free ? 0 : history.length,
                  dailyCaseSpent: openCase.free ? profit : 0,
                  dailyCaseOpenings: openCase.free ? 1 : 0
                }
              })
            // }

            addLiveCasesThrottled(history)
          }
        }
      })

      .catch(err => {
        logger.info(`postOpenCase() Reward error: ${err}`, {
          itemNames: openings.map(o => o.name),
          amount,
          playerId: !!req.user ? req.user.id : null,
          caseId: crateId
        })

        res.status(400).send('Internal error, contact an administrator')
      })
    })
  })

  .catch(err => {
    logger.error(`postOpenCase() ${err}`, {
      caseId: crateId,
      playerId: req.user ? req.user.id : null
    })

    res.status(400).send('Please try again later')
  })

}

// GET /api/crates/createOpts
function getCreatorOpts(req, res) {
  co(function* () {

    const disabled = yield redis.getAsync('kingdom:disable:casecreator')
    if(disabled) {
      return res.status(400).send('Creating cases is currently disabled')
    }

    res.json({
      items: [],
      categories: [],
      edge: config.cases.edge,
      commission: config.cases.commission,
      styles: config.cases.styles.map(style => ({
        ...style,
        image: `styles/images/cases/${style.id}`
      }))
    })
  })

  .catch(err => {
    logger.info(`getCreatorOpts() ${err}`)
    res.status(400).send('Internal error, contact an administrator')
  })
}

// GET /api/creates/caseItems
function getCaseItems(req, res) {
  co(function* () {
    const disabled = yield redis.getAsync('kingdom:disable:casecreator')

    if(disabled) {
      return res.status(400).send('Creating cases is currently disabled')
    }

    const cases = yield Case
      .getAll([ true, false ], { index: 'officialDisabled' })
      .pluck('items')
      .run()

    const extraCaseItems = _.pluck(yield CaseItems.run(), 'itemName')

    const itemNames  = _
      .chain(cases)
      .reduce((items, c) => [
        ...items,
        ...c.items.reduce((items, item) => {
          if(item.type === 'cash') {
            return items
          }

          return [ ...items, item.name ]
        }, [])
      ], extraCaseItems)
      .uniq()
      .value()

    let q = skne.Items
      .getAll(r.args(itemNames), { index: 'name' })
      .orderBy(r[req.query.order === 'asc' ? 'asc' : 'desc']('price'))

    const filters = {}

    if(!!req.query.category) {
      filters.category = req.query.category
    }

    if(Object.keys(filters).length > 0) {
      q = q.filter(filters)
    }

    if(!!req.query.query && req.query.query.length > 0) {
      q = q.filter(r.row('name').match(`(?i)${req.query.query}`))
    }

    const perPage = 50
    let page = parseInt(req.query.page) || 1
    if(page < 1) {
      page = 1
    }

    const count = yield q.count()
    const pages = Math.ceil(count / perPage)
    if(page > pages) {
      page = pages
    }

    const start = (page - 1) * perPage

    if(pages > 1) {
      q = q.slice(start, start + perPage)
    }

    const items = yield q

    res.json({
      pages,
      page,

      items: items.map(item => ({
        id: item.name,
        price: item.price,
        category: item.category,
        icon_url: item.icon,
        quality_color: item.qualityColor,
        market_hash_name: item.cleanName,
        wear: ITEM_WEAR[item.wear] || ''
      })),

      categories: [
      	{
      		id: 'pistol',
      		name: 'pistol'
      	},
      	{
      		id: 'melee',
      		name: 'melee'
      	},
      	{
      		id: 'other',
      		name: 'other'
      	},
      	{
      		id: 'sniper_rifle',
      		name: 'sniper rifle'
      	},
      	{
      		id: 'rifle',
      		name: 'rifle'
      	},
      	{
      		id: 'submachine_gun',
      		name: 'submachine gun'
      	},
      	{
      		id: 'shotgun',
      		name: 'shotgun'
      	},
      	{
      		id: 'machine_gun',
      		name: 'machine gun'
      	},
      	{
      		id: 'case',
      		name: 'case'
      	}
      ]

    })
  })

  .catch(err => {
    logger.info(`getCaseItems() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

// POST /api/crates/create
//
// postCreate
function postCreate(req, res) {
  const { name, style, items, cut } = req.body

  co(function* () {

    const disabled = yield redis.getAsync('kingdom:disable:casecreator')
    if(disabled) {
      return res.status(400).send('Creating cases is currently disabled')
    }

    if(!is.string(name) || name.length <= 0 || name.length > 16) {
      return res.status(400).send(req.__('INVALID_CASE_NAME'))
    } else if(!is.string(style)) {
      return res.status(400).send(req.__('INVALID_CASE_STYLE'))
    } else if(!Array.isArray(items) || items.length <= 0) {
      return res.status(400).send(req.__('INVALID_CASE_ITEMS'))
    } else if(!is.number(cut) || cut < 0 || cut > 3) {
      return res.status(400).send(req.__('INVALID_CASE_CUT'))
    }

    const caseStyle = _.findWhere(config.cases.styles, { id: style })
    if(!caseStyle) {
      return res.status(400).send(req.__('INVALID_CASE_STYLE'))
    }

    for(let item of items) {
      if(!is.number(item.odds) || item.odds <= 0) {
        return res.status(400).send(req.__('INVALID_ODDS'))
      }
    }

    const percentageSum = items.reduce((s, i) => s + i.odds, 0)
    if(percentageSum !== 100) {
      return res.status(400).send(req.__('INVALID_ODDS_SUM'))
    }

    const yesterday = new Date(Date.now() - (365 * (24 * 3600)))

    const createdCount = yield Case
      .between([ req.user.id, yesterday ], [ req.user.id, new Date() ], { index: 'playerIdCreatedAt' })
      .count()
      .run()

    if(createdCount >= config.cases.maxCreateDaily) {
      return res.status(400).send(req.__('CASE_DAILY_LIMIT_REACHED'))
    }

    const caseSlug = slug(`${req.user.id}-${name}`, { lower: true })
    const existsCount = yield Case.getAll([ req.user.id, caseSlug ], {
      index: 'playerIdSlug'
    }).count().run()

    if(existsCount > 0) {
      return res.status(400).send(req.__('CASE_EXISTS'))
    }

    const affiliateCut = cut / 100
    const caseData = yield determineCaseData(items, {
      affiliateCut
    })

    if(caseData.price < config.cases.minimumCreateCost) {
      return res.status(400).send(req.__('CASE_CREATOR_MINIMUM'))
    }

    const newCase = {
      ...caseData,
      name,

      caseStyle: style,
      createdAt: new Date(),
      slug: caseSlug,
      free: false,
      disabled: false,
      official: false,

      playerId: req.user.id
    }

    const url = `${config.app.url}/open/${newCase.slug}`
    const { generated_keys } = yield Campaign.insert({
      type: 'case',
      code: url,
      originalCode: url,
      createdAt: new Date(),
      playerId: req.user.id,
      description: `Case profits from your custom made case: ${name}`,
      name: `Case: ${name}`,
      commission: caseData.cut,
      commissionPerReferral: caseData.commission
    }).run()

      newCase.campaignId = generated_keys[0]

      const result = yield Case.insert(newCase).run()

      yield Campaign.get(newCase.campaignId).update({
        caseId: result.generated_keys[0]
      }).run()

      res.json({
        success: true,
        playerId: req.user.id,
        slug: newCase.slug
      })
  })

  .catch(err => {
    logger.info(`postCreate() ${err}`)
    res.status(400).send('Internal error, contact an administrator')
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.post('/open', ensureAuthenticated, postOpenCase)
  router.get('/createOpts', ensureAuthenticated, getCreatorOpts)
  router.get('/caseItems', ensureAuthenticated, getCaseItems)
  router.post('/create', ensureAuthenticated, postCreate)
  router.get('/:slug?', getCases)
  return router
}
