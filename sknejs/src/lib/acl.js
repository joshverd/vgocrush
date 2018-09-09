
import ACL from 'acl'
import Backend from 'acl-backend-rethinkdb'
import config from 'config'

import r from 'lib/database'

var options = {
  prefix: 'acl_',
  useSingle: true,
  ensureTable: true
}

const acl = new ACL(new Backend(r, {
  db: config.database.db,
  useSingle: true,
  ensureTable: true,
  table: 'acl'
}))

acl.allow('admin', ['bots'], '*')

export default acl
