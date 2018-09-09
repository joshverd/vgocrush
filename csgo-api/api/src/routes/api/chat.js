
import { Router } from 'express'

import { ensureAuthenticated } from '../../lib/middleware'
import { publishMessage, getMessageHistory } from '../../lib/chat'
import logger from '../../lib/logger'

/**
 * POST /api/chat
 *
 */
function postChatMessage(req, res) {
  const { message } = req.body

  publishMessage(req.locale || 'en', message, req.user)
    .then(() =>
      res.json({ success: true }
    ), err => {
      logger.error(`postChatMessage() ${err}`)
      res.status(400).send(err)
    })
}

/**
 * GET /api/messages
 */
function getChatHistory(req, res) {
  getMessageHistory(req.locale)
    .then(messages =>
      res.json({
        messages
      })
    )
}

/**
 * Load routes
 * @return {Object} router group
 */
export default () => {
  const router = Router()
  router.post('/chat', ensureAuthenticated, postChatMessage)
  router.get('/messages', getChatHistory)
  return router
}
