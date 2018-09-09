
import Router from 'koa-router'

import requireAuthTwoFactor from '../middleware/requireAuthTwoFactor'
import requirePermissions from '../middleware/requirePermissions'

import auth from './auth'
import user from './user'
import bot from './bot'
import userManagement from './userManagement'

export default () => {
  const router = new Router()

  router
    .prefix('/api')
    .use('/bot', requireAuthTwoFactor, bot())

    .use('/IAuth', auth())
    .use('/IUser', requireAuthTwoFactor, user())
    // .use('/IUserManagement', requireAuthTwoFactor, requirePermissions([ 'user', 'management' ]), userManagement())

  return router.routes()
}
