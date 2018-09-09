
import util from 'util'
import SteamUser from 'steam-user'
import TradeOfferManager from 'steam-tradeoffer-manager'
import SteamTotp from 'steam-totp'
import SteamCommunity from 'steamcommunity'

export class SteamClient {
  constructor(options = {}) {
    this._options = options

    this.user = new SteamUser({
      promptSteamGuardCode: false
    })

    this.tradeManager = new TradeOfferManager({
      steam: this.user,
      community: new SteamCommunity(),
      domain: 'localhost',
      language: 'en',
      cancelTime: 60000 * 3,
      cancelOfferCount: 25
    })

    this.user.on('webSession', (session, cookies) => {
      this.tradeManager.setCookies(cookies, err => {
        this.displayName = this.user.accountInfo.name
        this.steamId = this.user.steamID.getSteamID64()
        this.accountId = this.user.steamID.accountid

        this.user.emit('skne:ready', err)
      })
    })
  }

  async editProfile(update) {
    const result = await new Promise((resolve, reject) => {
      this.tradeManager._community.editProfile(update, (err, res) => {
        if(!!err) {
          return reject(err)
        }

        if(!!update.name) {
          this.displayName = update.name
        }

        resolve(update)
      })
    })
  }

  login() {
    const { username, password, sharedSecret } = this._options

    this.user.logOn({
      password,

      accountName: username,
      twoFactorCode: SteamTotp.generateAuthCode(sharedSecret)
    })
  }
}

const defaultClient = new SteamClient()

export const tradeManager = defaultClient.tradeManager
export default defaultClient.user
