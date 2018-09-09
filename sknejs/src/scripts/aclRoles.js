import 'babel-polyfill'
import minimist from 'minimist'

import Users from 'document/users'
import logger from 'lib/logger'
import acl from 'lib/acl'

const argv = minimist(process.argv.slice(2))

async function run() {
  let user = null

  if(!!argv.username) {
    user = (await Users.getAll(argv.username, { index: 'username' }))[0]
  }

  if(!user) {
    return logger.error('Cannot find user')
  } else if(!acl[argv.fn]) {
    return logger.error('Cannot find acl fn', argv.fn)
  }

  logger.info(`${argv.fn}(${user.id}, ${argv._.join(', ')})`)

  acl[argv.fn](user.id, ...argv._, (err, res) => {
    if(!!err) {
      return logger.error('acl', fn, err)
    }

    logger.info('Result:', res)
    logger.info('Complete')
    process.exit(0)
  })
}

run()
