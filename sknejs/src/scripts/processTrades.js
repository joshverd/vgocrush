
import 'babel-polyfill'

import co from 'co'
import minimist from 'minimist'
import _ from 'underscore'

import { amqpConnect, publishNotification } from 'lib/amqp'
import logger from 'lib/logger'
import r from 'lib/database'
import TradeOffers from 'document/offer'

const argv = minimist(process.argv.slice(2), {
  string: ['bots']
})

co(function* () {
  yield amqpConnect()

  const types = !!argv.types ? argv.types.trim().split(',') : []
  const bots = !!argv.bots ? argv.bots.trim().split(',') : []
  const states = !!argv.states ? argv.states.trim().split(',') : []
  const timespan = !!argv.timespan ? argv.timespan : 0

  logger.info('Types:', types.join(', '))
  logger.info('States:', states.join(', '))
  logger.info('Bots:', bots.join(', '))
  logger.info('Timespan:', timespan)
  
  if(!types.length) {
    logger.error('missing --types flag')
    return
  } else if(!states.length) {
    logger.error('missing --states flag')
    return
  } else if(states.indexOf('ACCEPTED') >= 0 || states.indexOf('DECLINED') >= 0) {
    if(timespan <= 0) {
      logger.error('cannot process trades with states:', 'ACCEPTED', 'DECLINED')
      return
    }
  }

  const lookup = types.map(type =>
    states.map(state => ([ type, state ]))
  ).reduce((arr, a) => arr.concat(a), [])

  let q = TradeOffers.getAll(r.args(lookup), { index: 'typeState' })

  if(bots.length > 0) {
    q = q.filter(o => r.expr(bots).contains(o('bot')))
  }

  if(timespan > 0) {
    q = q.filter(r.row('createdAt').ge(r.now().sub(parseInt(timespan))))
  }

  const tradeOffers = yield q

  logger.info('Processing', tradeOffers.length, 'trades...')

  for(let offer of tradeOffers) {
    let { replaced, changes } = yield TradeOffers.get(offer.id).update({
      state: 'ACCEPTED',
      automaticallyProcessed: true
    }, {
      returnChanges: true
    })

    if(replaced <= 0) {
      continue
    }

    publishNotification(changes[0].new_val, 'trade.OnTradeOfferStateChange')
  }

  logger.info('Done!')
  process.exit()
})

.catch(err =>
  logger.error('startup error', err)
)
