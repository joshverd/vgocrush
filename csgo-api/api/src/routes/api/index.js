
import { Router } from 'express'
import co from 'co'
import r from '../../lib/database'
import config from 'config'
import is from 'is_js'
import request from 'request'
import { AllHtmlEntities } from 'html-entities'

import { ensureAuthenticated } from 'lib/middleware'
import Player, { PlayerOpens, givePlayerBalance, takePlayerBalance } from '../../document/player'
import redis from 'lib/redis'
import logger from 'lib/logger'
import mailgun from 'lib/mailgun'
import { addStats } from 'document/stats'
import Order from 'document/order'
import * as amqp from 'lib/amqp'
import { ipLogger } from 'lib/playerIp'

import auth from './auth'
// import chat from './chat'
import user from './user'
import raffles from './raffles'
import g2a from './g2a'
import ipn from './ipn'
import faq from './faq'
import items from './items'
import promotions from './promotions'

import { runPluginHook } from 'plugins'

const htmlEntities = new AllHtmlEntities()

// POST /api/support
function postSupport(req, res) {

  if(!is.string(req.body.name)) {
    return res.status(400).send('Invalid name')
  } else if(!is.email(req.body.email)) {
    return res.status(400).send('Invalid E-mail address')
  } else if(!req.body.message) {
    return res.status(400).send('Invalid request')
  } if(!req.body.subject) {
    return res.status(400).send('Invalid subject')
  }

  const { supportEmails } = config

  const message = [
    `SteamID64: ${req.user.id}`,
    `Name: ${req.body.name || 'N/A'}`,
    `IP: ${req.clientIp || 'N/A'}`,
    `Subject: ${req.body.subject}`,
    `E-Mail: ${req.body.email}`,
    `TradeUrl: ${req.user.tradeUrl}`,
    '\r\n',
    req.body.message
  ]

  const mailOptions = {
    from: req.body.name+` - `+req.body.email,
    to: supportEmails.join(', '),
    subject: `VGOCrush: ${req.user.id}`,
    text: message.join('\r\n')
  }

  mailgun.messages().send(mailOptions, function (err, body) {
    if(err) {
      logger.error(`postSupport() ${err}`)
      return res.status(400).send(req.__('TRY_AGAIN_LATER'))
    }

    mailgun.messages().send({
      from: `"VGOCrush Support" <support@${config.mailgun.domain}>`,
      to: req.body.email,
      subject: 'Support Confirmation',
      text: 'This message is to inform you that your support message has been successfully sent. We will get back to you as soon as possible, thank you!\r\n\r\n\r\n"' + req.body.message + '"'
    }, err => {
      if(err) {
        logger.error(`postSupport() confirmation message: ${err}`)
      }
    })

    res.json({
      success: true
    })
  })
}

function getPostback(req, res) {
  logger.info("KANZER")
  co(function* () {
    var whiteIPs = ["104.130.7.162","204.232.224.18","204.232.224.19","104.130.46.116","104.130.60.109","104.239.224.178","104.130.60.108",'108.162.238.136','108.162.238.127','108.162.238.175'];
    var ip = req.headers["cf-connecting-ip"] || "";
    var userIP = req.query.ip || "32.212.10.24";
    var uid = req.query.sid;
    var acceptedOffers = {
      "2671453":true,
      "2671451":true,
      "2671449":true
    }
    var userData = {};

    var runPost = function(){
      //credit user!

      givePlayerBalance(uid, 0.01, {
        name: 'Watch Ad - '+req.query.offerID
      }, player => ({
        totalDeposit: r.row('totalDeposit').default(0).add(0.01)
      }))
      // console.log("gave balance!");
      addStats({
        counters: {
          videoLeads: 1,
          videoGross: 0.01,
          videoNet: 0.00
        }
      })
      res.json(1);
      return;
    }

    //checkIP with maxmind fraud detection
    var checkIP = function(){
      r.db("kingdom").table("BadIP").get(userIP).then(function(data){
        if(data) {
          res.json(1);
          return 1;
        } else {
          request({
              url: "https://minfraud.maxmind.com",
              method: "POST",
              json: {
                "device": {
                "ip_address": userIP
              },
            }
          }, function(err,response,body) {
            if(body.risk_score && body.risk_score > 65){
              r.db("kingdom").table("BadIP").insert({score:body.risk_score, id: userIP, timestamp: r.now()}).run();
              res.json(1);
              return 1;
            } else {
              //we good lets go!
              r.db("kingdom").table("Player").get(uid).update({lastIP: userIP}).run();
              runPost();
            }
          })
        }
      })
    }

    var checkOffer = function(skipIP){
      if(acceptedOffers[req.query.offerID]) {
        if(skipIP) runPost();
        else checkIP();
      }
      else {
        res.json(1);
        return 1;
      }
    }

    var grabUser = function(){
      r.db("kingdom").table("Player").get(uid).then(function(d){
        if(d) {
          userData = d;
          if(userData.lastIP && userData.lastIP == userIP) checkOffer(true);
          else checkOffer();
        }
        else {
          res.json(1);
          return 1;
        }
      })
    }

    if(whiteIPs.indexOf(ip) > -1 || req.query.code == "kdjdheuwjwjh123123h123hhsdf") grabUser();
    else {
      res.json(1);
      return 1;
    }

  })

  .catch(err => {
    logger.error(`getPostback() ${err}`)
    res.status(400).send('Please try again later')
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()

  router.use((req, res, next) => {
    if(req.user && !req.user.admin && req.user.banned) {
      return res.status(400).send('You are banned')
    }

    if(!!req.user && !req.user.avatarColor) {
      // amqp.channel().sendToQueue(amqp.PlayerDetailsFetchQueue, new Buffer(req.user.id), { persistent: true })
    }

    next()
  })

  router.use('/g2a', g2a())

  router.use((req, res, next) => {
    if(!!req.query) {
      for(let k in req.query) {
        req.query[k] = htmlEntities.decode(req.query[k])
      }
    }

    next()
  })

  router.use('/auth', auth())
  router.use('/ipn', ipn())
  router.use('/faq', faq())
  router.use('/items', items())
  router.use('/promotions', promotions())

  router.use('/users', ensureAuthenticated, user())
  router.use('/raffles', ensureAuthenticated, raffles())
  router.post('/support', ensureAuthenticated, ipLogger, postSupport)
  router.get('/postback', getPostback)

  runPluginHook('afterApiRouteCreated', router)
  return router
}
