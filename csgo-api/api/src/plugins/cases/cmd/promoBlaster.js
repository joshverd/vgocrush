import 'babel-polyfill'

import co from 'co'

import r from 'lib/database'
import logger from 'lib/logger'
import mailgun from 'lib/mailgun'
import * as database from 'lib/database'


co(function* () {
  logger.info('Kingdom Case Updater ¯\_(ツ)_/¯')

  r.db("kingdom").table("Player")
  .between(
    r.minval,
    r.now().sub(60*60*24*10),
    {index:"lastTrackedOrders"}
  )
  .filter(r.row.hasFields("email"))
  .filter(r.row("totalDeposit").gt(5))
  .count().then(function(count){
    logger.info("Number of people to send was: "+count);
    // process.exit()
    // send email to those users

    mailgun.messages().send({
      from: "domain@example.com",
      to: "domain@example.com",
      subject: "test",
      html: "This is a test"
  }, function (error, body) {
      if(!error) {
        // it went through!
      } else {
        // there was an error!
        logger.error(`mailer error: ${error}`)
      }
    });
  })

})

.catch(err => {
  logger.error(err)
  process.exit()
})
