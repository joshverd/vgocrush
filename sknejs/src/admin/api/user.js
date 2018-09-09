
import Router from 'koa-router'
import acl from 'lib/acl'

async function getDetails(ctx, next) {
  const { user } = ctx.state

  const roles = await new Promise((resolve, reject) =>
    acl.userRoles(user.id, (err, roles) => !!err ? reject(err) : resolve(roles))
  )

  ctx.body = {
    roles,

    id: user.id,
    username: user.username
  }
}

export default () => {
  const router = new Router()

  router
    .get('/GetDetails/v1', getDetails)

  return router.routes()
}
