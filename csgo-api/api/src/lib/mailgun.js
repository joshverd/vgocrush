
import config from 'config'
import mailgun from 'mailgun-js'

export default !!config.mailgun && config.mailgun.apiKey ? mailgun(config.mailgun) : false
