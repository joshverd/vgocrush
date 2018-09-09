
import { Router } from 'express'
import co from 'co'
import r from '../../lib/database'

import Order from '../../document/order'
// import Case from 'plugins/cases/documents/case'
import Player, { PlayerWithdrawHistory, PlayerBalanceHistory, takePlayerBalance } from '../../document/player'
import { PlayerOpens, PlayerItems, PLAYER_ITEM_AVAILABLE, PLAYER_ITEM_BUSY, createKeyPair } from 'plugins/cases/documents/player'
import Campaign from '../../document/campaign'
import logger from '../../lib/logger'
import { ipLogger } from '../../lib/playerIp'

import { ensureAdmin } from '../../lib/middleware'

// GET /_manage/players/largeDeposits
function getLargeDeposits(req, res) {
  co(function* () {
    const orders = yield Order
      .getAll(true, { index: 'completed' })
      .filter(r.row('amount').ge(100))
      .orderBy(r.desc('createdAt'))
      .limit(50)
      .eqJoin('playerId', Player)
      .zip()

      .run()

    res.json(orders)
  })

  .catch(console.log)
}

// GET /_manage/players/withdrawals
function getWithdrawals(req, res) {
  let { page } = req.query
  page = parseInt(page) || 1

  const perPage = 10

  co(function* () {
    let query = r.db("kingdom").table("PlayerWithdrawHistory");

    const count = yield query.count().run()
    const pages = Math.ceil(count/perPage)

    if(page > pages) {
      page = pages
    } else if(page <= 0) {
      page = 1
    }

    const start = Math.max(((page - 1) * perPage), 0)

    let orders = yield query
      .orderBy({index: r.desc('createdAt')})
      .slice(start, start+perPage)
      .map(o => o.merge({
        player: Player.get(o('playerId'))
      }))

      .run()


    res.json({
      page,
      pages,
      orders,
      hasNextPage: page < pages,
    })

  // co(function* () {
  //   const orders = yield Order
  //     .getAll(true, { index: 'completed' })
  //     .filter(r.row('amount').ge(100))
  //     .orderBy(r.desc('createdAt'))
  //     .limit(50)
  //     .eqJoin('playerId', Player)
  //     .zip()
  //
  //     .run()
  //
  //   res.json(orders)
  })

  .catch(console.log)
}

// GET /_manage/players/deposits
function getDeposits(req, res) {
  let { page } = req.query
  page = parseInt(page) || 1

  const perPage = 10

  var d = new Date();
  d.setDate(d.getDate()-3);

  co(function* () {
    let query = Order.between(["skins", d], ["skins", r.maxval], {
        index: "methodCreatedAt"
    }).orderBy({
        index: r.desc('methodCreatedAt')
    })

    const count = yield query.count().run()
    const pages = Math.ceil(count/perPage)

    if(page > pages) {
      page = pages
    } else if(page <= 0) {
      page = 1
    }

    const start = Math.max(((page - 1) * perPage), 0)

    let orders = yield query
      .slice(start, start+perPage)
      .map(o => o.merge({
        player: Player.get(o('playerId'))
      }))

      .run()


    res.json({
      page,
      pages,
      orders,
      hasNextPage: page < pages,
    })

  // co(function* () {
  //   const orders = yield Order
  //     .getAll(true, { index: 'completed' })
  //     .filter(r.row('amount').ge(100))
  //     .orderBy(r.desc('createdAt'))
  //     .limit(50)
  //     .eqJoin('playerId', Player)
  //     .zip()
  //
  //     .run()
  //
  //   res.json(orders)
  })

  .catch(console.log)
}

// GET /_manage/players/largeWithdraws
function getLargeWithraws(req, res) {
  co(function* () {
    const orders = yield PlayerWithdrawHistory
      .filter(r.row('amount').ge(100))
      .orderBy(r.desc('createdAt'))
      .limit(50)
      .eqJoin('playerId', Player)
      .zip()

      .run()

    res.json(orders)
  })

  .catch(console.log)
}

// GET /_manage/players/:id
function getPlayer(req, res) {

  co(function* () {
    let players = Player.getAll(req.params.id)

    if(!req.user.admin) {
      players = players.pluck('id', 'admin', 'mod', 'avatar', 'balance', 'displayName', 'level', 'language', 'mod', 'totalWon', 'banned', 'muted', 'muteExpiration',
        'disableOpeningCase', 'lockWithdraws', 'lockDeposits')
    }

    players = yield players.map(p => p.merge({
      totalWithdrawn: PlayerWithdrawHistory.getAll(p('id'), { index: 'playerId' }).sum('amount'),
      totalWon: PlayerOpens.getAll(p('id'), { index: 'playerId' }).sum('prize'),
      totalSkinDeposit: Order.getAll([ p('id'), 'skins' ], { index: 'playerIdMethod' }).sum('amount')
    })).run()
    if(!players.length) {
      return res.json({ player: null })
    }

    const player = players[0]
    if(player) {
      player.campaigns  = yield Campaign.getAll(req.params.id, { index: 'playerId' }).run()
      player.items      = yield PlayerItems.getAll(req.params.id, { index: 'playerId' }).run()
      player.balanceHistory    = yield PlayerBalanceHistory.getAll(req.params.id, { index: 'playerId' }).orderBy(r.desc('date')).limit(250).run()
      player.adminBalanceHistory    = yield PlayerBalanceHistory.getAll(req.params.id, { index: 'playerId' }).filter(r.row('meta')('fromAdmin').default(false).eq(true)).run()
      player.cases = [] //yield Case.getAll(req.params.id, { index: 'playerId' }).run()
    }

    res.json({ player })
  })

  .catch(console.log)
}

function togglePair(req,res) {
  const { state } = req.body

  co(function* () {
    const seed = state ? createKeyPair(null, false, -1) : createKeyPair(null, true, 500)

    yield Player
      .get(req.params.id)
      .update({
        keyPair: seed,
        lastKeyPair: r.row('keyPair')
      })
      .run()

    res.json({
      success: true
    })
  })

  .catch(console.log)
}

// GET /_manage/players/update/:id
function postUpdate(req, res) {
  const update = req.body
  co(function* () {
    if(!req.user.admin) {
      const allowed = ['_addBalance', 'muteExpiration', 'muted', 'banned', 'disableOpeningCase', 'lockWithdraws', 'lockDeposits', 'totalDeposit']

      for(let k in update) {
        if(allowed.indexOf(k) < 0) {
          return res.status(400).json({ error: 'No Access' })
        }
      }
    }

    if(!!update.muteExpiration) {
      update.muteExpiration = new Date(update.muteExpiration)
    }

    if(!!update._addBalance) {
      if(update._addBalance < 0) {
        return res.status(400).json({ error: 'Not enough balance' })
      }
      if(req.user.admin) {
        update.balance = r.row('balance').add(parseFloat(update._addBalance))
      } else {
        const updateResponse = yield takePlayerBalance(req.user.id, parseFloat(update._addBalance), {
          fromAdmin: true,
          name: `Transfer balance to ${req.params.id}`,
          'playerId': req.params.id
        })

        if(updateResponse.replaced > 0) {
          update.balance = r.row('balance').add(parseFloat(update._addBalance))
        } else {
          return res.status(400).json({ error: 'Not enough balance' })
        }
      }

      delete update._addBalance
    }

    if(!!update._removeBalance) {
      const amount = parseFloat(update._removeBalance)
      update.balance = r.branch(r.row('balance').sub(amount).ge(0), r.row('balance').sub(amount), 0)
      delete update._removeBalance
    }

    Player
      .get(req.params.id)
      .update(update, { returnChanges: true })
      .run()
      .then(({ replaced, changes }) => {

        if(replaced > 0) {
          const newBalance = changes[0].new_val.balance
          const oldBalance = changes[0].old_val.balance
          const diff = Math.abs(newBalance - oldBalance)
          const taken = newBalance < oldBalance

          PlayerBalanceHistory.insert({
            meta: {
              fromAdmin: true,
              name: `${taken ? 'Taken' : 'Given'} from admin panel by ${req.user.displayName}`,
              from: req.user.id
            },
            playerId: req.params.id,
            date: new Date(),
            balance: taken ? -diff : diff
          }).run()
        }
      })

    res.json({ success: true })
  })
}

function postRemoveItem(req, res) {
  const { id } = req.body

  co(function* () {
    const { deleted, changes } = yield PlayerItems
      .getAll([ id, req.params.id ], { index: 'idPlayerId' })
      .delete({ returnChanges: true })
      .run()

    if(deleted > 0) {
      PlayerBalanceHistory.insert({
        meta: {
          name: `Remove item ${changes[0].old_val.name}`,
          from: req.user.id,
          itemName: changes[0].old_val.name
        },
        playerId: req.params.id,
        date: new Date(),
        balance: 0
      }).run()
    }
  })

  .catch(console.log)

  res.json({ success: true })
}

function postAddItem(req, res) {
  const { name } = req.body

  PlayerItems.insert({
    name,
    playerId: req.params.id,
    state: PLAYER_ITEM_AVAILABLE
  }).run()

  res.json({ success: true })
}

function postToggleItemState(req, res) {
  const { id } = req.body

  PlayerItems.get(id).update({
    state: r.branch(r.row('state').eq(PLAYER_ITEM_AVAILABLE), PLAYER_ITEM_BUSY, PLAYER_ITEM_AVAILABLE)
  }).run()

  res.json({ success: true })
}

function postCampaignAction(req, res) {
  co(function* () {
    switch(req.params.action) {
      case 'delete':
        Campaign.get(req.params.id).delete().run()
        break

      case 'clear':
        if(!req.user.admin) {
          return res.status(400).json({ error: 'No access' })
        }

        Campaign.get(req.params.id).update({ balance: 0 }).run()
        break

      case 'remove':
        if(!req.user.admin) {
          return res.status(400).json({ error: 'No access' })
        }

        const amount = parseFloat(req.body.balance)

        Campaign.get(req.params.id).update({
          balance: r.branch(r.row('balance').sub(amount).ge(0), r.row('balance').sub(amount), 0)
        }).run()
        break

      case 'add':
        if(!req.user.admin) {
          return res.status(400).json({ error: 'No access' })
        }

        Campaign.get(req.params.id).update({ balance: r.row('balance').add(parseFloat(req.body.balance)) }).run()
        break

      case 'reward':
        if(!req.user.admin) {
          return res.status(400).json({ error: 'No access' })
        }
        if(!req.body.amount || isNaN(req.body.amount) || parseFloat(req.body.amount) >= 0.51) return res.status(400).json({ error: 'Invalid Reward' });
        Campaign.get(req.params.id).update({ reward: parseFloat(req.body.amount) }).run()


        break


      case 'code':
        if(!req.body.name || req.body.name.length < 3) {
          return res.status(400).json({ error: 'Invalid code' })
        }

        const old = yield Campaign.get(req.params.id).run();
        if(old.code == req.body.name.toLowerCase()) return res.status(400).json({ error: 'User already has this code set' })

        const existsCount = yield Campaign.getAll(req.body.name.toLowerCase(), { index: 'code' }).count().run()
        if(existsCount > 0) {
          Campaign.getAll(req.body.name.toLowerCase(), { index: 'code' }).delete().run()
        }

        setTimeout(function(){
          Campaign
          .get(req.params.id)
          .update({
            code: req.body.name.toLowerCase(),
            originalCode: req.body.name
          }).run();
        },1000)
        break
    }

    res.json({ success: true })
  })

  .catch(console.log)
}

function getStatistics(req, res) {
  co(function* () {
    const totalDeposited = yield Order.getAll([ 'g2a', true ], { index: 'methodCompleted' }).sum('amount').run()
    const totalSkinsDeposited = yield Order.getAll([ 'skins', true ], { index: 'methodCompleted' }).sum('amount').run()
    const totalWithdrawn = yield PlayerWithdrawHistory.sum('amount').run()

    res.json({
      totalDeposited,
      totalSkinsDeposited,
      totalWithdrawn
    })
  })

  .catch(console.log)
}

function getBigWins(req, res) {

  co(function* () {
    const opens = yield PlayerOpens
      .orderBy({ index: r.desc('createdAt') })
      .filter(r.row('prize').ge(100))
      .limit(25)

      .run()

    res.json({
      opens
    })
  })

  .catch(console.log)
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.get('/', ensureAdmin, getStatistics)
  router.get('/largeDeposits', ensureAdmin, getLargeDeposits)
  router.get('/deposits', ensureAdmin, getDeposits)
  router.get('/withdrawals', ensureAdmin, getWithdrawals)
  router.get('/largeWithdraws', ensureAdmin, getLargeWithraws)
  router.get('/wins', ensureAdmin, getBigWins)
  router.post('/update/:id', ipLogger, postUpdate)
  router.post('/togglePair/:id', ipLogger, togglePair)
  router.post('/toggleItem/:id', ipLogger, postToggleItemState)
  router.post('/removeItem/:id', ipLogger, postRemoveItem)
  router.post('/campaign/:id/:action', postCampaignAction)
  router.post('/addItem/:id', ensureAdmin, ipLogger, postAddItem)
  router.get('/:id', getPlayer)
  return router
}
