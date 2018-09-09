import twoFactor from 'node-2fa'
import is from 'is_js'
import minimist from 'minimist'
import logger from 'lib/logger'

import Users from 'document/users'
import bcrypt from 'bcrypt'
import { encryptString } from 'lib/rsa'

const argv = minimist(process.argv.slice(2))

async function createUser() {

    let username = argv.userName
    let password = argv.password.toString()
    let email = argv.email
    let mobilePhoneNumber = argv.mobilePhoneNumber

    if(!is.string(username) || username.length < 3) {
        return logger.error('Username must be at least 3 characters long')
    } else if(!is.string(password) || password.length < 6) {
        return logger.error('Password must be at least 6 characters long')
    } else if(!is.string(email)) {
        return logger.error('Invalid e-mail address')
    }

    if(!!mobilePhoneNumber && !is.nanpPhone(mobilePhoneNumber)) {
        return logger.error('Invalid phone number')
    }

    email = email.toLowerCase()

    const usernameExistCount = await Users.getAll(username, { index: 'username' }).count()

    if(usernameExistCount > 0) {
        return logger.error('Username is already in use')
    }

    const emailExistCount = await Users.getAll(email, { index: 'email' }).count()

    if(emailExistCount > 0) {
        return logger.error('E-mail address is already in use')
    }

    const twoFactorSecret = twoFactor.generateSecret({
        name: 'SKNExchange',
        account: username
    })

    const newUser = {
        username,
        email,

        mobilePhoneNumber: mobilePhoneNumber || false,
        createdAt: new Date(),
        password: bcrypt.hashSync(password, 10),
        twoFactorSecret: encryptString(twoFactorSecret.secret),

        permissions: []
    }

    const { generated_keys } = await Users.insert(newUser)

    return {
        user: {
            id: generated_keys[0]
        },

        twoFactor: {
            qr: twoFactorSecret.qr
        }
    }
}

createUser()
    .then(res => {
        logger.info(res)
        process.exit(0)
    })
    .catch(error => {
        logger.info(error)
        process.exit(0)
    })