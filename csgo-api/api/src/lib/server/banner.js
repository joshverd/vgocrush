
import co from 'co'
import redis from 'lib/redis'

export function setBanner(banner) {
  return redis.setAsync('global:banner', JSON.stringify(banner))
}

export function getBanner() {
  return co(function* () {
    const banner = yield redis.getAsync('global:banner')

    if(!banner) {
      return null
    }

    return JSON.parse(banner)
  })
}
