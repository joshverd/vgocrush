
const NodeRSA = require('node-rsa')
const fs = require('fs')
const path = require('path')

const key = new NodeRSA({ b: 2048 })

if(!!process.env.RSA_KEY) {
  key.importKey(process.env.RSA_KEY, 'pkcs1-der-pem')
} else {
  const localKey = path.join(process.cwd(), 'bin', 'private')

  if(fs.existsSync(localKey)) {
    key.importKey(fs.readFileSync(localKey), 'pkcs1-der-pem')
  }
}

export function encryptString(str) {
  return key.encrypt(str, 'base64')
}

export function decryptString(str) {
  return key.decrypt(str, 'utf8')
}

export function getKey() {
  return key.exportKey('pkcs1-der-pem')
}

export default key
