
const NodeRSA = require('node-rsa')
const fs = require('fs')
const path = require('path')

const binDir = path.join(process.cwd(), 'bin')
const publicFile = path.join(process.cwd(), 'bin', 'public')
const privateFile = path.join(process.cwd(), 'bin', 'private')

if(fs.existsSync(publicFile) || fs.existsSync(privateFile)) {
  console.log('Public/private already exists in', binDir)
  process.exit(0)
}

if(!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir)
}


const key = new NodeRSA({ b: 2048 })

fs.writeFileSync(publicFile, key.exportKey('pkcs8-public-pem'))
fs.writeFileSync(privateFile, key.exportKey('pkcs1-der-pem'))

console.log('Done!')
