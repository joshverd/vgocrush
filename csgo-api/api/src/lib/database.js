
import config from 'config'
import r from 'rethinkdbdash'

export default r(config.database)
