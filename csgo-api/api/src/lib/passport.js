
import passport from 'passport'
import co from 'co'
import config from 'config'
import urlRegex from 'url-regex'
import SteamStrategy from 'passport-steam'
import FacebookStrategy from 'passport-facebook'
import LocalStrategy from 'passport-local'

import Player from 'document/player'
import { addStats } from 'document/stats'
import r from './database'
import { runPluginHook } from 'plugins'
import request from "request";

const domainRegex = urlRegex({ exact: false, strict: false })

async function getOpskinsAccessToken(code) {

  const opskinsOAuthUrl = config.app.opskinsOAuth.baseUrl
  const opskinsOAuthAccessTokenUrl = `${opskinsOAuthUrl}/v1/access_token`

  const clientId = config.app.opskinsOAuth.clientId
  const opskinsAuthSecret = config.app.opskinsOAuth.secret
  const auth = 'Basic ' + Buffer.from(clientId + ':' + opskinsAuthSecret).toString('base64')

  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: opskinsOAuthAccessTokenUrl,
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      json: true,
      form: {
        grant_type: 'authorization_code',
        code: code,
      }
    }, (err, res, body) => {
      if(!!err) {
        console.log(`Error getting access token`)
        console.log(`Error: ${err}`)
        return reject(err)
      }

      resolve(body)
    })
  })
}

async function getOpskinsProfile(accessToken) {

  const opskinsUrl = config.app.opskinsOAuth.opskinsApiUrl
  const auth = `Bearer ${accessToken}`;

  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `${opskinsUrl}/IUser/GetProfile/v1/`,
      headers: {
        'Authorization': auth,
      },
      json: true
    }, (err, res, body) => {
      if(!!err) {
        console.log(`Error: ${err}`)
        return reject(err)
      }

      resolve(body)
    })
  })
}

/**
 * Serialize passport user
 */
passport.serializeUser((player, done) => done(null, player.id))

/**
 * Deserialize passport user
 */
passport.deserializeUser((id, done) => {
  co(function* () {
    let player = yield Player.get(id).run()
    if(!player) {
      return done(null, null)
    }

    done(null, player)
  })

  .catch(done)
})

/**
 * Facebook strategy for rewards
 */

if(config.facebook) {
  passport.use(new FacebookStrategy({
    ...config.facebook,
    callbackURL: `${config.app.authUrl}/api/auth/facebookReturn`
  }, (accessToken, refreshToken, profile, cb) => {
    cb(null, {
      accessToken,
      refreshToken,
      profile
    })
  }))
}

/**
 * Steam strategy
 */
passport.use(new SteamStrategy({
  returnURL: `${config.app.authUrl}/api/auth/loginResponse`,
  realm: `${config.app.authUrl}`,
  apiKey: config.steam.apiKey
}, (identifier, profile, done) => {
  let displayName = profile.displayName.replace(domainRegex, '').trim()

  if(!displayName.length) {
    displayName = `Player${profile.id.substring(profile.id.length - 5)}*`
  }

  const hasNamePromotion = config.namePromotion.containsText.reduce((hasNamePromotion, text) =>
    hasNamePromotion || profile.displayName.toLowerCase().indexOf(text.toLowerCase()) >= 0
  , false)

  const playerInfo = {
    displayName,
    hasNamePromotion,

    id: profile.id,
    avatar: profile.photos[0].value,
    avatarMedium: profile.photos[1].value,
    avatarFull: profile.photos[2].value,

    displayNameRaw: profile.displayName
  }

  co(function* () {
    let player = yield Player.get(profile.id).run()

    if(!player) {
      // The player wasn't found, add it to the database
      // player = playerInfo

      const extraDetails = (yield runPluginHook('onNewPlayerRegistration')) || {}

      player = {
        ...playerInfo,
        ...extraDetails,

        balance: 0,
        level: 1,
        language: 'en',
        lastTrackedOrders: r.now(),
        newRegistration: true
      }

      yield Player.insert(player)

      yield addStats({
        counters: {
          userRegistrations: 1
        }
      })

      // amqp.channel().sendToQueue(amqp.PlayerDetailsFetchQueue, new Buffer(profile.id), { persistent: true })
    } else {

      if(player.avatar !== playerInfo.avatar) {
        // amqp.channel().sendToQueue(amqp.PlayerDetailsFetchQueue, new Buffer(profile.id), { persistent: true })
      }

      yield Player.get(profile.id).update(playerInfo)
    }

    done(null, player)
  })

  .catch(console.log)
}))

passport.use(new LocalStrategy({
    usernameField: 'state',
    passwordField: 'code',
    session: false
  },
  function(state, code, done) {
    co(function* () {
      const accessToken = yield getOpskinsAccessToken(code)

      if(!accessToken.access_token) {
        done(new Error('no opskins access token'))
      }

      const opProfileResponse = yield getOpskinsProfile(accessToken.access_token)

      if(!opProfileResponse.response.id64) {
        done(new Error('no opskins profile'))
      }

      const steamId = opProfileResponse.response.id64
      const displayName = opProfileResponse.response.username
      const avatar = opProfileResponse.response.avatar

      const playerInfo = {
        displayName,

        id: steamId,
        avatar: avatar,
        avatarMedium: avatar,
        avatarFull: avatar,

        displayNameRaw: displayName
      }

      let player = yield Player.get(steamId).run()
      if(!player) {
        // The player wasn't found, add it to the database
        // player = playerInfo

        const extraDetails = (yield runPluginHook('onNewPlayerRegistration')) || {}

        player = {
          ...playerInfo,
          ...extraDetails,

          balance: 0,
          level: 1,
          language: 'en',
          lastTrackedOrders: r.now(),
          newRegistration: true
        }

        yield Player.insert(player)

        yield addStats({
          counters: {
            userRegistrations: 1
          }
        })

        // amqp.channel().sendToQueue(amqp.PlayerDetailsFetchQueue, new Buffer(profile.id), { persistent: true })
      } else {

        if(player.avatar !== playerInfo.avatar) {
          // amqp.channel().sendToQueue(amqp.PlayerDetailsFetchQueue, new Buffer(profile.id), { persistent: true })
        }

        yield Player.get(steamId).update(playerInfo)
      }

      done(null, player)
    }).catch(console.log)
  }
))
