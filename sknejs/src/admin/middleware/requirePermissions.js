
import acl from 'lib/acl'

export default (...permissions) => async (ctx, next) => {
  const { user } = ctx.state

  for(let permission of permissions) {
    const isAllowed = await new Promise((resolve, reject) =>
      acl.isAllowed(user.id, permission[0], permission[1], (err, res) => resolve(!err && res))
    )

    if(!isAllowed) {
      return ctx.throw(400, 'Unauthorized, missing required permissions')
    }
  }

  await next()
}
