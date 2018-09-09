import 'babel-polyfill'

import co from 'co'
import { parallelLimit } from 'async'

import r from 'lib/database'
import logger from 'lib/logger'
import * as database from 'lib/database'
import Case from '../documents/case'
import { determineCaseData } from '../'
import { CaseStats, getCaseStatId } from '../documents/stats'

const pageSize = 5000

// idk, max inserts to run at a time, 1/4 of page size?
const parallelInsertsLimit = Math.ceil(pageSize * 0.25)

co(function* () {
  logger.info('Kingdom Case Updater ¯\_(ツ)_/¯')

  const count = yield Case.count()
  const pages = Math.ceil(count / pageSize)

  logger.info(`Preparing to update ~${count} cases ${pageSize} at a time...`)

  for(let page = 0; page < pages; page++) {
    let start = page * pageSize
    let cases = yield Case
      .slice(start, start + pageSize)
      .pluck('id', 'name', 'items', 'official','cut')

    let tasks = []

    for(let c of cases) {

      if(c.free) {
        continue
      }

      let caseData = null

      try {
        caseData = yield determineCaseData(c.items.map(i => ({
          ...i,
          odds: (i.prob.high - i.prob.low) / 1000
        })), {
          allowAnyItems: true,
          affiliateCut: c.cut
        })
      } catch(e) {
        logger.error(`${c.id} - ${e.stack || e}`)
        continue
      }

      tasks.push(((c) => done => {
        co(function* () {
          yield Case.get(c.id).update({
            ...caseData,
            lastUpdated: r.now()
          })

          yield CaseStats.getAll(c.id, { index: 'caseId' }).update({
            price: caseData.price,
            official: c.official,
            lastUpdated: r.now()
          })

          done()
        })

        .catch(err => {
          logger.error(`insert error: ${err}`)
          done()
        })
      })(c))
    }

    yield new Promise(resolve => parallelLimit(tasks, parallelInsertsLimit, (err, result) => {
      resolve()
    }))

    logger.info(`${page + 1}/${pages}`)
  }

  process.exit()
})

.catch(err => {
  logger.error(err)
  process.exit()
})
