

import OPSkinsAPI from 'lib/opskins'

const argv = process.argv
console.log(argv[2])

const client = new OPSkinsAPI(argv[2])
client.addWhitelistedApiIp('54.39.16.143', 'test')
.then(console.log, console.log)

client.getBalance(console.log)
