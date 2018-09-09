
import { Router } from 'express'
import co from 'co'
import is from 'is_js'
import r from '../../lib/database'
import _ from 'underscore'

import Campaign from '../../document/campaign'
import logger from '../../lib/logger'
import { givePlayerBalance } from '../../document/player'
import { getLevelReward, levelRewards } from '../../lib/campaign'

import { runPluginHook } from 'plugins'

function postCampaignCreate(req, res) {
  co(function* () {
    let { code } = req.body
    let originalCode = req.body.code

    if(!code) {
      return res.status(400).send(req.__('CAMPAIGN_CODE_LENGTH'))
    } else {
      code = code.trim().toLowerCase()

      if(!is.string(code) || code.length < 3 || code.length > 16 || !/^[a-zA-Z0-9-_]+$/.test(code)) {
        return res.status(400).send(req.__('CAMPAIGN_CODE_LENGTH'))
      }
    }

    let existsCount = yield Campaign
      .getAll(req.user.id, { index: 'playerId' })
      .filter({ type: 'code' })
      .count()
      .run()

    if(existsCount > 0) {
      return res.status(400).send(req.__('CAMPAIGN_ALREADY_CREATED'))
    }

    existsCount = yield Campaign
      .getAll(code, { index: 'code' })
      .count()
      .run()

    if(existsCount > 0) {
      return res.status(400).send(req.__('CAMPAIGN_ALREADY_USED'))
    }

    const campaign = {
      type: 'code',
      code,
      originalCode,
      createdAt: new Date(),
      playerId: req.user.id,
      referrals: 0,
      commissionPerReferral: 0,
      reward: 0.40
    }

    const { generated_keys } = yield Campaign.insert(campaign).run()
    campaign.id = generated_keys[0]

    res.json({
      campaign: formatCampaign(campaign, req.user)
    })
  })

  .catch(err => {
    logger.error(`postCampaignCreate() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function getCampaign(req, res) {
  co(function* () {
    const campaigns = yield Campaign
      .getAll(req.user.id, { index: 'playerId' })
      .run()

    const hasReferralCode = _.findWhere(campaigns, {
      type: 'code'
    })

    res.json({
      hasReferralCode,
      campaigns: campaigns.map(c => formatCampaign(c, req.user))
    })
  })

  .catch(err => {
    logger.error(`getCampaign() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

function formatCampaign(campaign, user) {
  const reward = getLevelReward(user.level || 1)

  const formatted = {
    type: campaign.type,
    id: campaign.id,
    referrals: campaign.referrals || 0,
    name: campaign.name,
    description: campaign.description,
    code: campaign.originalCode,
    balance: campaign.balance || 0,
    totalEarned: campaign.totalEarned || 0,
    commission: reward.commission,
    commissionPerReferral: campaign.commissionPerReferral || 0
  }

  if(campaign.type === 'case') {
    return {
      ...formatted,
      caseId: campaign.caseId
    }
  }

  return {
    ...formatted,
    gift: campaign.reward || 0,
    totalDeposits: campaign.totalDeposits || 0,
    totalDeposited: campaign.totalDeposited || 0
  }
}

function postCampaignWithdraw(req, res) {
  const { id } = req.body
  if(!id || !id.length) {
    return res.status(400).send(req.__('TRY_AGAIN_LATER'))
  }

  co(function* () {
    const campaign = yield Campaign.get(id).run()
    if(!campaign) {
      return res.status(400).send('Nothing to claim')
    } else if(campaign.balance < 1) {
      return res.status(400).send('Minimum withdraw is $1.00')
    }

    const { replaced, changes } = yield Campaign
      .getAll(id)
      .filter({ playerId: req.user.id })
      .update({
        balance: 0
      }, { returnChanges: true })

      .run()

    if(replaced > 0) {
      const balanceChange = changes[0].old_val.balance
      const response = yield givePlayerBalance(req.user.id, balanceChange, {
        name: 'Claim campaign balance',
        campaign: id
      })

      return res.json({
        user: {
          balance: response.changes[0].new_val.balance
        },

        campaign: {
          balance: 0
        }
      })
    }

    res.status(400).send('Nothing to claim')
  })

  .catch(err => {
    logger.error(`postCampaignWithdraw() ${err}`)
    res.status(400).send(req.__('TRY_AGAIN_LATER'))
  })
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.get('/', getCampaign)
  router.post('/create', postCampaignCreate)
  router.post('/withdraw', postCampaignWithdraw)
  return router
}
