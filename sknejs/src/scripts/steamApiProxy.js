
import express from 'express'
import TradeOfferManager from 'steam-tradeoffer-manager'
import ip from 'ip'

import logger from 'lib/logger'

const tradeOfferManager = new TradeOfferManager()
const app = express()

app.get('/ip', (req, res) => {
  res.json({
    id: ip.address()
  })
})

app.get('/getUserInventoryContents/:steamId', (req, res) => {
  tradeOfferManager.getUserInventoryContents(req.params.steamId, 730, 2, true, (err, inventory) => {
    if(!!err) {
      logger.error('GET /getUserInventoryContents', req.params.steamId, err)
      return res.status(400).send(err.message)
    }

    res.json(inventory)
  })
})

app.listen(8888, () => {
  logger.info('Server started on port', 8888)
})
