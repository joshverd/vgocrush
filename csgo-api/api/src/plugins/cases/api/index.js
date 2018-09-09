
import logger from 'lib/logger'

import cases from './cases'
import { getRollNumber } from '../'

// POST /api/verifyRoll
//
// postVerifyRoll
function postVerifyRoll(req, res) {
  const { clientSeed, serverSeed, nonce } = req.body

  if(!clientSeed || !serverSeed || !nonce) {
    return res.status(400).send('Please fill out all the fields')
  }

  try {
    res.json({
      roll: getRollNumber(serverSeed, clientSeed, nonce).toString()
    })
  } catch(e) {
    logger.error(`postVerifyRoll() ${e}`)
    res.status(400).send('Please try again later (Are you sure you put correct information?)')
  }
}

export default router => {
  router.post('/verifyRoll', postVerifyRoll)
  router.use('/crates', cases())
}
