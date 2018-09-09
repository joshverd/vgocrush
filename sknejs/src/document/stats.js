
import r from 'lib/database'
import moment from 'moment'
import _ from 'underscore'
import co from 'co'

const Stats = r.table('Stats')
export default Stats

function formatStats(stats, inserting, scope) {
  const row = scope || r.row

  const counters = _
    .chain(stats.counters || {})
    .map((v, k) => ([k, inserting ? v : row(k).default(0).add(v)]))
    .object()
    .value()

  return {
    ...counters
  }
}

export function addStats(stats) {
  const id = r.time(r.now().year(), r.now().month(), r.now().day(), "Z").toISO8601()

  return Stats.get(id).replace(s =>
    r.branch(s.eq(null), {
      id,
      createdAt: new Date(),
      ...formatStats(stats, true)
    }, s.merge({
      id,
      ...formatStats(stats, false, s)
    }))
  ).run()
}
