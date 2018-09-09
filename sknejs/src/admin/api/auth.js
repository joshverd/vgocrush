
import Router from 'koa-router'
import is from 'is_js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import config from 'config'
import twoFactor from 'node-2fa'

import Users, { updateUserLastTwoFactorCode } from 'document/users'
import { getKey, decryptString } from 'lib/rsa'
import r from 'lib/database'

async function postGenerateToken(ctx, next) {
  const { id, password } = ctx.request.body

  if(!is.string(id) || !is.string(password) || !id.length || !password.length) {
    return ctx.throw(400, 'Invalid id or password')
  }

  const [ user ] = await Users
    .getAll(id, { index: 'username' })

  if(!user || !bcrypt.compareSync(password, user.password)) {
    return ctx.throw(400, 'Invalid id or password')
  }

  // const { replaced } = await Users
  //   .get(user.id)
  //   .update(u => r.branch(
  //     u.hasFields('lastTokenGeneratedAt').not().or(u('lastTokenGeneratedAt').lt(r.now().sub(600))), {
  //     lastTokenGeneratedAt: r.now()
  //   }, {}))
  //
  // if(replaced <= 0) {
  //   return ctx.throw(400, 'A login token has already recently been generted, please try again later')
  // }

  const token = jwt.sign({
    id: user.id,
    username: user.username
  }, getKey(), {
    expiresIn: '1w'
  })

  ctx.body = {
    token
  }
}

async function postEnableTwoFactor(ctx) {
  const { id, token, code } = ctx.request.body

  if(!is.string(id) || !is.string(token) || !is.string(code)
    || !token.length || !id.length || !code.length) {
    return ctx.throw(400, 'Invalid two-factor authorization code')
  }

  const userId = await new Promise((resolve, reject) =>
    jwt.verify(token, getKey(), (err, decoded) =>
      resolve(!!err || decoded.username !== id ? null : decoded.id)
    )
  )

  if(!userId) {
    return ctx.throw(400, 'Invalid two-factor authorization code')
  }

  const user = await Users.get(userId)

  if(!user) {
    return ctx.throw(400, 'Account no longer exists')
  }

  const result = twoFactor.verifyToken(decryptString(user.twoFactorSecret), code)

  if(!result || result.delta !== 0) {
    return ctx.throw(400, 'Invalid two-factor authorization code')
  }

  const canUseCode = await updateUserLastTwoFactorCode(userId, code)

  if(!canUseCode) {
    return ctx.throw(400, 'Authorization code has already been used before, wait for the next code')
  }

  const newToken = jwt.sign({
    id: user.id,
    username: user.username,
    twoFactorEnabled: true
  }, getKey(), {
    expiresIn: '1w'
  })

  ctx.body = {
    newToken
  }
}

export default () => {
  const router = new Router()

  router
    .post('/GenerateToken/v1', postGenerateToken)
    .post('/EnableTwoFactor/v1', postEnableTwoFactor)

  return router.routes()
}
