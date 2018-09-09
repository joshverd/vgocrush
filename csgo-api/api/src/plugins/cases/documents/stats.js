
import r from 'lib/database'
import moment from 'moment'
import _ from 'underscore'
import co from 'co'

export const CaseStats = r.table('CaseStats')

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

export function getCaseStatId(caseId) {
  return `${caseId}-${r.time(r.now().year(), r.now().month(), r.now().day(), "Z").toISO8601()}`
}

export function addCaseStats(caseData, stats) {
  const id = getCaseStatId(caseData.id)

  return CaseStats.get(id).replace(s =>
    r.branch(s.eq(null), {
      id,
      caseId: caseData.id,
      caseCreatedAt: caseData.createdAt,
      price: caseData.price,
      official: caseData.official,
      createdAt: new Date(),
      ...formatStats(stats, true)
    }, s.merge({
      id,
      caseCreatedAt: caseData.createdAt,
      price: caseData.price,
      official: caseData.official,
      ...formatStats(stats, false, s)
    }))
  ).run()
}
