
import jwt from 'jsonwebtoken'

import { getKey } from 'lib/rsa'
import Users from 'document/users'

export default async (ctx, next) => {
  let token = null

  if(!!ctx.request.query) {
    token = ctx.request.query.token
  } else if(!!ctx.request.body) {
    token = ctx.request.body
  }

  if(!token) {
    return ctx.throw(400, 'Unauthorized')
  }

  const decoded = await new Promise((resolve, reject) =>
    jwt.verify(token, getKey(), (err, decoded) => resolve(!!err ? null : decoded))
  )

  if(!decoded) {
    return ctx.throw(400, 'Unauthorized')
  }

  const user = await Users.get(decoded.id)

  if(!user) {
    return ctx.throw(400, 'Unauthorized')
  }

  ctx.state.token = token
  ctx.state.session = decoded
  ctx.state.user = user
  ctx.state.permissions = user.permissions

  await next()
}
