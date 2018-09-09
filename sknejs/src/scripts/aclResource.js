import 'babel-polyfill'
import minimist from 'minimist'

import logger from 'lib/logger'
import acl from 'lib/acl'

const argv = minimist(process.argv.slice(2))

async function run() {
  let role = argv.role
  let resource = argv.resource

  logger.info(`${argv.fn}(${role}, ${resource}, ${argv._.join(', ')})`)

  acl[argv.fn](role, resource, ...argv._, (err) => {
    if(!!err) {
      return logger.error('acl', fn, err)
    }

    logger.info('Complete')
    process.exit(0)
  })
}

run()
