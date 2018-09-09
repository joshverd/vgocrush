
import Router from 'koa-router'
import twoFactor from 'node-2fa'
import is from 'is_js'

import Users from 'document/users'
import bcrypt from 'bcrypt'
import { encryptString } from 'lib/rsa'

async function postCreateUser(ctx, next) {
  let { username, password, mobilePhoneNumber, email } = ctx.request.body

  if(!is.string(username) || username.length < 3) {
    return ctx.throw(400, 'Username must be at least 3 characters long')
  } else if(!is.string(password) || password.length < 6) {
    return ctx.throw(400, 'Password must be at least 6 characters long')
  } else if(!is.string(email)) {
    return ctx.throw(400, 'Invalid e-mail address')
  }

  if(!!mobilePhoneNumber && !is.nanpPhone(mobilePhoneNumber)) {
    return ctx.throw(400, 'Invalid phone number')
  }

  email = email.toLowerCase()

  const usernameExistCount = await Users.getAll(username, { index: 'username' }).count()

  if(usernameExistCount > 0) {
    return ctx.throw(400, 'Username is already in use')
  }

  const emailExistCount = await Users.getAll(email, { index: 'email' }).count()

  if(emailExistCount > 0) {
    return ctx.throw(400, 'E-mail address is already in use')
  }

  const twoFactorSecret = twoFactor.generateSecret({
    name: 'SKNExchange',
    account: username
  })

  const newUser = {
    username,
    email,

    mobilePhoneNumber: mobilePhoneNumber || false,
    createdAt: new Date(),
    password: bcrypt.hashSync(password, 10),
    twoFactorSecret: encryptString(twoFactorSecret.secret),

    permissions: []
  }

  const { generated_keys } = await Users.insert(newUser)

  ctx.body = {
    user: {
      id: generated_keys[0]
    },

    twoFactor: {
      qr: twoFactorSecret.qr
    }
  }
}

export default () => {
  const router = new Router()

  router
    .post('/CreateUser/v1', postCreateUser)

  return router.routes()
}
