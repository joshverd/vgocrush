
import { Router } from 'express'
import config from 'config'
import passport from 'passport'
import i18n from 'i18n'
import co from 'co'
import request from 'request'
import moment from 'moment'
import SteamAPI from 'steamapi'
import randomstring from 'randomstring'

import { addStats } from 'document/stats'
import { ensureAuthenticated } from 'lib/middleware'
import { getLevelReward, levelRewards } from 'lib/campaign'
import { lastOnlineCount } from 'lib/sockets'
import { ipLogger } from 'lib/playerIp'

import Player, { PlayerExternalAccounts, PlayerLikes, addPlayerFlash, logPlayerBalanceChange } from 'document/player'
import Order from 'document/order'
import r from 'lib/database'
import logger from 'lib/logger'
import redis from 'lib/redis'
import { getToggles } from 'lib/toggles'
import * as skne from 'lib/sknexchange'

import { runPluginHook } from 'plugins'

const steamApi = new SteamAPI(config.steam.apiKey)

const acceptedVideoCountries = {
  'US': true,
  'GB': true,
  'AU': true,
  'NZ': true,
  'IE': true,
  'DE': true,
  'NL': true,
  'NO': true,
  'SE': true,
  'DK': true
}

/**
 * GET /api/auth/session
 *
 */
function getSession(req, res) {
  co(function* () {
    let user = null

    if(req.user) {
      const { email, tradeUrl, balance, avatar, avatarMedium, avatarFull, id, displayName,
          admin, mod, newRegistration, lastTrackedOrders, sessionFlashes, acceptedTerms,
          claimedTwitterFollow } = req.user

      user = {
        id,
        balance,
        email,
        tradeUrl,
        newRegistration,
        acceptedTerms,
        claimedTwitterFollow,

        sessionFlashes: sessionFlashes || {},
        avatarfull: avatarFull,
        steamid64: id,
        username: displayName,
        allowVideo: acceptedVideoCountries[req.headers['cf-ipcountry'] || "US"] || false,
        code: req.headers['cf-ipcountry'],
        avatars: {
          medium: avatarMedium,
          large: avatarFull
        },

        preferences: {
          language: req.locale.toString()
        },

        isMod: mod || admin,
        isAdmin: admin,
        aai: mod && req.user.allowACPInventory
      }

      const userUpdates = {}

      if(!!user.sessionFlashes) {
        // Clear flash flags
        if(Object.keys(user.sessionFlashes).length > 0) {
          userUpdates.sessionFlashes = []
        }
      }

      // Order history for tracking
      const untrackedOrdersStartDate = (req.user.lastTrackedOrders || r.minval)

      const untrackedOrdersSum = yield Order
        .between([ user.id, true, untrackedOrdersStartDate ], [ user.id, true, r.maxval ], { index: 'playerIdCompletedCreatedAt' })
        .filter(r.row.hasFields("noTrack").not())
        .sum('amount')

      user.untrackedOrdersSum = untrackedOrdersSum

      if(untrackedOrdersSum > 0) {
        userUpdates.lastTrackedOrders = r.now().add(2*60)
      }

      if(user.newRegistration) {
        userUpdates.newRegistration = false
      }

      if(Object.keys(userUpdates).length > 0) {
        yield Player.get(user.id).update(userUpdates)
      }
    }

    const session = {
      user,

      server: {
        onlineCount: lastOnlineCount()
      },

      serverTime: new Date(),
      language: req.locale,
      countryCode: req.headers['cf-ipcountry'] || 'US',
      env: process.env.NODE_ENV || 'development',
      langs: i18n.getLocales()

      // translations: (i18n.getCatalog((user && user.preferences && user.preferences.language ? user.preferences.language : (req.headers['cf-ipcountry'] || 'en').toLowerCase())) || i18n.getCatalog('en'))
    }

    if(!!req.user) {
      let pendingStates = [
        'ACCEPTED', 'QUEUED', 'ERROR',
        'ESCROW', 'WAITING_CONFIRMATION',
        'SENT', 'DECLINED', 'PENDING'
      ]

      session.pendingOffers = (yield skne.PendingOffers
        .getAll(r.args(pendingStates.map(state => ([ req.user.id, state ]))), { index: 'steamIdState' })
        .orderBy(r.desc('createdAt'))).map(skne.formatPendingOffer)
    } else {
      session.toggles = yield getToggles({
        camelCase: true
      })
    }

    res.json(
      (yield runPluginHook('onSessionRequest', req, session)).reduce((a, s) => Object.assign(a, s), session)
    )
  })

  .catch(err => {
    logger.error(`getSession() ${err.stack || err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()

  router.post('/alternateVerify', (req, res) => {
    const { account } = req.body

    co(function* () {
      const enabled = yield redis.getAsync('enable:alternateAuth')
      if(!enabled) {
        return res.status(400).send('Alternate authentication is currently disabled')
      }

      const id = yield steamApi.resolve(account)
      const summary = yield steamApi.getUserSummary(id)

      let loginName = yield redis.getAsync(`auth:alt:${id}`)

      if(!loginName) {
        return res.status(400).send('Login name expired, please start over')
      } else if(loginName !== summary.nickname) {
        return res.status(400).send('Please change your name first to verify your identity')
      }

      redis.del(`auth:alt:${id}`)

      const player = yield Player.get(id)
      if(!player) {
        return res.status(400).send('Cannot find account')
      }

      req.login(player, err => {
        if(!!err) {
          logger.error('POST /auth/alternateVerify', err)
          return res.status(400).send('Please try again later')
        }

        res.json({
          success: true
        })
      })
    })

    .catch(err => {
      logger.error('POST /auth/alternateVerify', err)
      res.status(400).send('Please try again later')
    })
  })

  router.post('/alternateResolve', (req, res) => {
    const { account } = req.body

    co(function* () {
      const id = yield steamApi.resolve(account)
      const summary = yield steamApi.getUserSummary(id)

      let loginName = yield redis.getAsync(`auth:alt:${id}`)

      if(!loginName) {
        loginName = 'vgocrush-' + randomstring.generate(12)
        redis.set(`auth:alt:${id}`, loginName)
        redis.expire(`auth:alt:${id}`, 60 * 5)
      }

      res.json({
        loginName,
        displayName: summary.nickname
      })
    })

    .catch(err => {
      logger.error('POST /auth/alternateResolve', err)
      res.status(400).send('Please try again later')
    })
  })

  router.get('/session', ipLogger, getSession)

  router.get('/facebook', ensureAuthenticated, passport.authenticate('facebook', {
    authType: 'rerequest',
    scope: ['public_profile', 'email']
  }))

  router.get('/facebookReturn', ensureAuthenticated, (req, res, next) => {

    passport.authenticate('facebook', (err, result) => {
      if (err) {
        return next(err)
      } else if(!result || !result.profile) {
        return next(new Error('Cannot get profile'))
      }

      const { accessToken, profile: { username, displayName, name, gender, profileUrl } } = result

      co(function* () {
        const id = `${req.user.id}-facebook`

        const update = {
          id,
          accessToken,
          username,
          displayName,
          profileUrl,

          accountId: result.id,
          playerId: req.user.id,
          provider: 'facebook',
          rawProfile: result.profile
        }

        yield PlayerExternalAccounts.get(id).replace(s =>
          r.branch(s.eq(null), {
            ...update,
            createdAt: new Date()
          }, s.merge({
            ...update,
            updatedAt: new Date()
          }))
        )

        const reward = 0.12

        let response = yield Player
          .get(req.user.id)
          .update(r.branch(r.row('claimedFacebookFollow').default(false).eq(false), {
            claimedFacebookFollow: true,
            balance: r.row('balance').add(reward)
          }, {
          }), { returnChanges: true })
          .run()

        if(response.replaced <= 0) {
          return res.redirect(`${config.app.url}/rewards`)
        }

        logPlayerBalanceChange(req.user.id, reward, {
          name: `Reward: Facebook Link`
        })

        yield addStats({
          counters: {
            rewardFacebook: 1,
            rewardTotal: reward
          }
        })

        yield addPlayerFlash(req.user.id, 'claimedReward')

        res.redirect(`${config.app.url}/rewards`)
      })

      .catch(next)
    })(req, res, next)

  })

  // GET /auth/steam
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  The first step in Steam authentication will involve redirecting
  //   the user to steamcommunity.com.  After authenticating, Steam will redirect the
  //   user back to this application at /auth/steam/return
  // router.get('/steam', passport.authenticate('steam', { failureRedirect: config.app.url, failureFlash: true }),  (req, res) => res.redirect(config.app.url))
  router.get('/steam', (req, res, next) => {
    let { redirect } = req.query

    const redirectUrl = `${config.app.url}${(!!redirect && redirect.length ? `/${redirect}` : '')}`
    req.session.redirectUrl = redirectUrl

    passport.authenticate('steam', (err, user, info) => {
      if (err) {
        return next(err)
      }

      if (!user) {
        return res.redirect(config.app.url)
      }

      req.logIn(user, err => {
        if (err) {
          return next(err)
        }

        res.redirect(config.app.url)
      })
    })(req, res, next)

  })

  // GET /auth/loginResponse
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  If authentication fails, the user will be redirected back to the
  //   login page.  Otherwise, the primary route function function will be called,
  //   which, in this example, will redirect the user to the home page.
  // router.get('/loginResponse', passport.authenticate('steam', { failureRedirect: config.app.url, failureFlash: true }), (req, res) => res.redirect(config.app.url))
  router.get('/loginResponse', (req, res, next) => {
    passport.authenticate('steam', (err, user, info) => {
      if (err) {
        return next(err)
      }

      if (!user) {
        return res.redirect(config.app.url)
      }

      req.logIn(user, err => {
        if (err) {
          return next(err)
        }

        res.redirect(req.session.redirectUrl || config.app.url)

        delete req.session['redirectUrl']
      })
    })(req, res, next)

  })

  // GET /auth/logout
  router.get('/logout', (req, res) => {
    req.logout()

    if(!!req.query.noRedirect) {
      return res.json({ success: true })
    }

    res.redirect(config.app.url)
  })

  router.get('/opskins', (req, res, next) => {
    const opskinsOAuthUrl = config.app.opskinsOAuth.baseUrl
    const clientId = config.app.opskinsOAuth.clientId
    const opskinsOAuthAuthorizationUrl = `${opskinsOAuthUrl}/v1/authorize?client_id=${clientId}&response_type=code&state=123456&duration=permanent`

    res.redirect(opskinsOAuthAuthorizationUrl)
  })

  router.get('/opskinsCallback', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err)
      }

      if (!user) {
        return res.redirect(config.app.url)
      }

      req.logIn(user, err => {
        if (err) {
          return next(err)
        }

        res.redirect(config.app.url)

        delete req.session['redirectUrl']
      })
    })(req, res, next)
  })

  return router
}
