import AuditLog from './auditLogs/logger'

// ensureAuthenticated makes sure the person connecting the the route is
// logged in
export function ensureAuthenticated(req, res, next) {
  if(!req.user) {
    return res.status(400).send(req.__('NO_ACCESS'))
  }

  next()
}

// ensureAdmin makes sures the the person connecting to the route is a user
// and has admin permissions
export function ensureAdmin(req, res, next) {
  if(!req.user || !req.user.admin) {
    return res.status(400).send('No Access')
  }

  next()
}

// ensureStaff makes sures the the person connecting to the route is a user
// and has admin permissions
export function ensureStaff(req, res, next) {
  if(!req.user || (!req.user.admin && !req.user.mod)) {
    return res.status(400).send('No Access')
  }

  next()
}

// ensureGuest makes sure the person connecting the the route is
// a guest
export function ensureGuest(req, res, next) {
  if(req.user) {
    return res.status(400).send('No Access')
  }

  next()
}

// record an audit log for the admin panel request
export function auditLog(req, res, next) {
  AuditLog(req).then(() => {
    next()
  }).catch((e) => {
    next()
  })
}
