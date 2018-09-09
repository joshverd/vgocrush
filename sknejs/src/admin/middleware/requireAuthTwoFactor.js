
import requireAuth from './requireAuth'

export default async (ctx, next) => {
  await requireAuth(ctx, () => {})

  if(!ctx.state.session.twoFactorEnabled) {
    return ctx.throw(400, 'Unauthorized, two-factor authorization must be enabled first')
  }

  await next()
}
