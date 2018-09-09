
import r from 'lib/database'
import * as Users from './users'

import logger from 'lib/logger'

const migrations = [
  ...Users.migrate()
]

export async function migrateDocuments() {
  for(let migration of migrations) {
    try {
      await migration.run()
    } catch(e) {
      // ignored
    }
  }
}
