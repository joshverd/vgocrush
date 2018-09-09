
import 'babel-polyfill'

import r from 'rethinkdb'
import redis from './lib/redis'
import regression from 'regression'
import request from 'request'
import config from 'config'
import co from 'co'
import _ from 'underscore'
import { parallelLimit } from 'async'
import moment from 'moment'

import { OPSkinsAPI } from 'lib/opskins'
import Bots from 'document/bot'
import { BotItems, Items, migrateDocuments } from './lib/documents'
import logger from './lib/logger'
import { getWear, isStatTrak, isSouvenir, getItemCategory } from './constant/item'
import { amqpConnect, publishNotification } from 'lib/amqp'

function getItems() {
  return new Promise((resolve, reject) => {
    request({
      url: `${config.opskins.trade.baseUrl}/IItem/GetItems/v1/?key=${config.prices.opskinsApiKey}`,
      json: true
    }, (err, res, body) => {
      let results = !err ? (body.response.items || []) : []
      let values = _.values(results)
      let items = []
      _.each(values, (value, key) => {
        items.push(_.flatten(_.values(value)))
      })

      let itemsObject = _.flatten(items)

      let itemsResult = itemsObject.reduce(function(result,item) {
        result[item.name] = item;
        return result;
      },{});

      resolve(itemsResult)
    })
  })
}

function getOPItems() {
  return new Promise((resolve, reject) => {
    request({
      url: 'https://files.opskins.media/file/opskins-static/pricelist/1912.json',
      json: true
    }, (err, res, body) => {
      resolve(body)
    })
  })
}

function cleanItemName(name) {
  let idx = -1

  for(let i = 0; i < name.length; i++) {
    if(name.charAt(i) === '(') {
      idx = i
    }
  }

  if(idx > 0) {
    name = name.substring(0, idx)
  }

  return name.trim()
}

// as lenience increases the number increases
function scaleForLenience(lenience, minimum, maximum) {
  return minimum + lenience * (maximum - minimum)
}

co(function* () {
  const connection = yield r.connect(config.database)
  yield migrateDocuments(connection)
  yield amqpConnect()

  logger.info('OPSkins markup', config.prices.opMarkup)

  // const prices          = yield getPrices()
  const items           = yield getItems()
  const opItems         = yield getOPItems()

  const [ bot ] = yield Bots
    .getAll([ 'Available', true ], { index: 'stateOpskinsEnabled' })
    .limit(1)

  if(!bot) {
    return logger.error('Updating requires at least 1 available opskins bot, none were found')
  }

  const client = new OPSkinsAPI(bot.opskins.apiKey)

  const lowestPrices = yield new Promise((resolve, reject) =>
    client.getLowestPrices(1912, (err, prices) =>
      !!err ? reject(err) : resolve(prices)
    )
  )

  const prices = yield new Promise((resolve, reject) =>
    client.getPriceList(1912, (err, res) => !!err ? reject(err) : resolve(res))
  )

  const allItems = _
    .chain(yield Items.coerceTo('array').run(connection))
    .map(item => [item.name, item])
    .object()
    .value()


  // this number controls how lenient the system is to sketchy stuff
  // setting lenience to 0 will minimize all the other constants to make the system safer
  const lenience =  0.4;

  const dailyHighLow = scaleForLenience(lenience, 1.3, 3);
  const dailyIncrease = scaleForLenience(lenience, 1.2, 1.6)
  const minDaysData = scaleForLenience(lenience, 25, 1)
  const upgradeMarkup = 1.07 // 1.06 originally
  const caseMarkup = 1.10
  const exchangeMarkup = 1.14  // was 1.13 originally
  const tasks = []

  _.each(prices, (opPrice, key) => {
    const description = items[key]

    if(!description) {
      return
    }

    let blocked = false, blockedReason = null;

    if (Object.keys(opPrice).length < minDaysData) {
      blocked = true
      blockedReason = `opPrice keys length ${Object.keys(opPrice)} < ${minDaysData}`
    }

    const keys = _.sortBy(Object.keys(opPrice))
    const days = keys.slice(keys.length - 10).map(k => opPrice[k].normalized_mean)

    for(let i in days) {
      let prev = days[i - 1]
      if(!prev) {
        continue
      }

      let high = Math.max(days[i], prev)
      let low = Math.min(days[i], prev)

      if(high / low >= dailyHighLow) {
        blockedReason = 'high/low >= dailyHighLow'
        blocked = true
      }
    }

    if(days.length > 2 && days[0] / days[days.length - 1] >= dailyIncrease) {
      blocked = true
      blockedReason = 'more than dailyIncrease increase in 1 day'
    }


    if (key.toLowerCase().indexOf('sticker') !== -1
      || key.toLowerCase().indexOf('sealed graffiti') >= 0) {
      blocked = true;
      blockedReason = 'sticker or graffiti'
    }

    // figure out the slope of the line that projects prices
    const prev14 = keys.map(k => opPrice[k].normalized_mean)
    const eqn14 = regression.linear(prev14.map((v, i) => [i, v]))
    const prev21 = keys.map(k => opPrice[k].normalized_mean)
    const eqn21 = regression.linear(prev21.map((v, i) => [i, v]))
    const prev30 = keys.map(k => opPrice[k].normalized_mean)
    const eqn30 = regression.linear(prev30.map((v, i) => [i, v]))
    // we find the trend line for today and the 5 day projected trend, and we take the lower one.

    // calculate using the 30-day and 7 day trend lines, what the price will look like
    // in one week and take the lower one
    const trendLine30 = eqn30.predict(prev30.length - 1)[1]
    const trendLine14 = eqn14.predict(prev14.length - 1)[1]
    const trendLine21 = eqn21.predict(prev21.length - 1)[1]

    const prev3 = keys.slice(keys.length - 3).map(k => opPrice[k].normalized_mean)
    const eqn3 = regression.linear(prev3.map((v, i) => [i, v]))
    const trendLine3 = eqn3.predict(prev3.length - 1)[1]

    const prev3Min = keys.slice(keys.length - 3).map(k => opPrice[k].normalized_min)
    const eqn3Min = regression.linear(prev3Min.map((v, i) => [i, v]))
    const trendLine3Min = eqn3Min.predict(prev3Min.length - 1)[1]

    const prev3Max = keys.slice(keys.length - 3).map(k => opPrice[k].normalized_max)
    const eqn3Max = regression.linear(prev3Max.map((v, i) => [i, v]))
    const trendLine3Max = eqn3Min.predict(prev3Max.length - 1)[1]

    const prev7 = keys.slice(keys.length - 7).map(k => opPrice[k].normalized_mean)
    const eqn7 = regression.linear(prev7.map((v, i) => [i, v]))
    const trendLine7 = eqn7.predict(prev7.length - 1)[1]

    const prev1 = keys.slice(keys.length - 1).map(k => opPrice[k].normalized_mean)
    const eqn1 = regression.linear(prev1.map((v, i) => [i, v]))
    const trendLine1 = eqn1.predict(prev1.length - 1)[1]

    const prev7Max = keys.slice(keys.length - 7).map(k => opPrice[k].normalized_max)
    const eqn7Max = regression.linear(prev7Max.map((v, i) => [i, v]))
    const trendLine7Max = eqn7Max.predict(prev7Max.length - 1)[1]

    const prev7Min = keys.slice(keys.length - 7).map(k => opPrice[k].normalized_min)
    const eqn7Min = regression.linear(prev7Min.map((v, i) => [i, v]))
    const trendLine7Min = eqn7Min.predict(prev7Min.length - 1)[1]

    let casePrice, bestPrice;

    // this ones ensuring we sell the item for more than its worth
    const lowestPrice = lowestPrices[key] ? lowestPrices[key].price : 0;
    bestPrice = (trendLine3 + trendLine7 + trendLine7Min + trendLine3Min + Math.max(lowestPrice, trendLine7) ) / 5.0
    const upgradePriceBase = Math.max(trendLine7, bestPrice, lowestPrice);
    const upgradePriceBaseFixed = Math.ceil(((upgradePriceBase / 100) * config.prices.opMarkup) * 100) / 100;
    // bestPrice *= 1.07;
    // bestPrice = (trendLine7+trendLine14) / 2;
    bestPrice = Math.max(bestPrice, 0); // dont let price go below 0k

    let price = Math.ceil(((bestPrice / 100) * config.prices.opMarkup) * 100) / 100;
    const depositPrice = price;
    let upgradePrice = parseFloat((upgradePriceBaseFixed*upgradeMarkup).toFixed(2));
    let exchangePrice = parseFloat((upgradePriceBaseFixed*exchangeMarkup).toFixed(2));
    let sellPrice = Math.ceil(((bestPrice / 100)) * 100) / 100;

    //lgtm
    if (blocked) {
      let priceHistory = keys.map(k => opPrice[k].normalized_mean);
    }

    casePrice = bestPrice*caseMarkup;

    casePrice = Math.ceil(((casePrice / 100) * config.prices.opMarkup) * 100) / 100;
    casePrice *= 1.20;

    if(price <= 0) {
      logger.error('automatically blocking item, price <= 0', key, price)

      tasks.push((done) => {
        Items
          .getAll(key, { index: 'name' })
          .update({
            blocked: true,
            blockedReason: 'new price <= 0'
          })
          .run(connection)
          .then(() => done(), done)
      })
      return
    }

    if (price > 1500.0) {
      logger.error('blocking item, too expensive', key, price)
      blocked = true;
      blockedReason = 'too expensive'
    }

    let update = {
      blocked,
      blockedReason,
      price: price,
      sellPrice: sellPrice,
      casePrice: casePrice,
      depositPrice: depositPrice,
      upgradePrice: upgradePrice,
      exchangePrice: exchangePrice,
      icon: description['image']['300px'],
      name: key,
      cleanName: cleanItemName(key),
      wear: -1,
      basePrice: price,
      baseTokens: (price * config.tokenMultiplier),
      tokens: (price * config.tokenMultiplier),
      createdAt: new Date(),
      qualityColor: description.color,
      nameColor: description.color,
      wear: getWear(key),
      souvenir: isSouvenir(key),
      statTrak: isStatTrak(key),
      category: getItemCategory(key),
    }

    tasks.push((done) => {
      let promise

      if(!!allItems[key]) {
        promise = Items.getAll(key, { index: 'name' }).update({
          ...update,
          blocked: allItems[key].forceAllow ? false : allItems[key].forceBlocked ? true : blocked,
        }).run(connection)

        promise = promise.then(() =>
          BotItems.getAll(key, { index: 'name' }).update(
            _.pick(allItems[key], 'name', 'assetId', 'nameColor', 'tokens', 'basePrice', 'price', 'wear', 'icon', 'cleanName')
          ).run(connection)
        )
      } else {
        promise = Items.insert(update).run(connection)
      }

      promise.then(() => done(), done)
    })
  })

  console.log(`Updating ${tasks.length} items...`)

  parallelLimit(tasks, 250, err => {
    if(err) {
      logger.error(err)
    }

    logger.info('Update completed')
    redis.setAsync("pricing:hash", moment().unix());

    // Notify servers of the price update
    publishNotification({
      updateCount: tasks.length
    }, 'prices.updated')
  })
})
.catch(logger.error)

setTimeout(() => process.exit(), 4 * 60 * 60 * 1000)
