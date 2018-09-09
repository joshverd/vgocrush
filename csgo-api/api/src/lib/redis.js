
import redis from 'redis'
import bluebird from 'bluebird'
import config from 'config'

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient(config.redis.port, config.redis.host, { password: config.redis.password })
export default client
