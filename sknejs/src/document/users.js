
import keyMirror from 'keymirror'
import r from 'lib/database'

const Users = r.table('Users')

export function migrate() {
  return [
    r.tableCreate('Users'),
    Users.indexCreate('email'),
    Users.indexCreate('username'),
    Users.wait()
  ]
}

export async function isUserAllowed(id, resource, permissions) {
  return await new Promise((resolve, reject) =>
    acl.isAllowed(id, resource, permissions, (err, res) => resolve(!err && res))
  )
}

export async function updateUserLastTwoFactorCode(userId, code) {
  const { replaced } = await Users.get(userId).update({
    twoFactorLastCode: code
  })

  return replaced > 0
}

export const userPermissions = keyMirror({
  CAN_MANAGE_USERS: null,
  CAN_VIEW_BOTS: null
})

export default Users
