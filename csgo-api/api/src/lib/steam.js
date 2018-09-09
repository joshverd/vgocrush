
import request from 'request'
import config from 'config'
import TradeOfferManager from 'steam-tradeoffer-manager'
import xml from 'xml2js'
import _ from 'underscore'
import url from 'url'
import SteamID from 'steamid'
import qs from 'querystring'

export const tradeOfferManager = new TradeOfferManager()

export function isValidTradeUrl(tradeUrl, opts = {}) {
  if(!tradeUrl || tradeUrl.length <= 0) {
    return false
  }

  const u = url.parse(tradeUrl.trim())

  if(u.host !== 'trade.opskins.com' || u.protocol !== 'https:' || u.pathname.indexOf('/t') !== 0) {
    return false
  }

  // const query = qs.parse(u.query)
  // if(!query.partner) {
  //   return false
  // } else if(!!opts.steamId) {
  //   const steamId = new SteamID(opts.steamId)
  //
  //   if(steamId.steam3().indexOf(query.partner) < 0) {
  //     return false
  //   }
  // }

  return true
}

export function getCSGOHours(steamId) {
  return new Promise((resolve, reject) => {
    request({
      url: `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/`,
      qs: {
        key: config.steam.apiKey,
        steamid: steamId,
        format: 'json'
      },

      json: true
    }, (err, resp, body) => {
      if(err) {
        return reject(err)
      } else if(resp.statusCode !== 200) {
        return reject('Status code !== 200')
      } else if(!body.response.games) {
        return resolve(false)
      }

      for(let game of body.response.games) {
        if(game.appid === 730) {
          return resolve(game.playtime_forever / 60)
        }
      }

      resolve(false)
    })
  })
}

export function getGroup(steamId, group) {
  return new Promise((resolve, reject) => {
    request({
      url: `http://steamcommunity.com/profiles/${steamId}`,
      qs: {
        xml: 1
      },

      json: true
    }, (err, resp, body) => {
      if(err) {
        return reject(err)
      } else if(resp.statusCode !== 200) {
        return reject('Status code !== 200')
      }

      xml.parseString(body, (err, result) => {
        if(err) {
          return reject(err)
        } else if(!result.profile.privacyState|| !result.profile.groups || !result.profile.groups.length) {
          return reject(false)
        } else if(result.profile.privacyState[0] !== 'public') {
          return resolve(false)
        }

        const g = result.profile.groups[0].group.filter(g => g.groupID64[0] === group)
        if(!g.length) {
          return resolve(false)
        }

        resolve(g[0])
      })
    })
  })
}
