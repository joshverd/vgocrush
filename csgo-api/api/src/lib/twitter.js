
import Twitter from 'node-twitter-api'
import config from 'config'

export default new Twitter({
  ...config.twitter,
  callback: `${config.app.url}/api/users/twitter`,
  x_auth_access_type: 'read'
})
