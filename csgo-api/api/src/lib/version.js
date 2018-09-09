
import semver from 'semver'
import pkg from 'lib/pkg'

export function isVersionOutdated(version) {
  return false
  // 
  // if(process.env.NODE_ENV !== 'production') {
  //   return false
  // }
  //
  // if(typeof version !== 'string' || !semver.valid(version)) {
  //   return true
  // }
  //
  // return semver.major(version) !== semver.major(pkg.version)
}
