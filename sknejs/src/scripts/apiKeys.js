
import 'babel-polyfill'
import minimist from 'minimist'

import ApiKeys from 'document/apiKey'
import logger from 'lib/logger'

const argv = minimist(process.argv.slice(2))

async function run() {
  if(!argv.apiKey) {
    return logger.error("No ApiKey provided")
  }

  logger.info(`ApiKey: ${argv.apiKey}`)

  const newApiKey = {
    key: argv.apiKey
  }

  ApiKeys.insert(newApiKey).then(res => {
    logger.info('Result: ApiKey inserted', res)
    process.exit(0)
  })
  .catch(error => {
    logger.error(error)
    process.exit(1)
  })
}

run()
