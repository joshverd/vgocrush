
import r from 'lib/database'
import { eachSeries } from 'async'

import ChatHistory from './chatHistory'

export default [
  r.tableCreate('ChatHistory'),
  ChatHistory.wait(),
  ChatHistory.indexCreate('userId'),
  ChatHistory.indexCreate('createdAt'),
  ChatHistory.indexCreate('chatRoomCreatedAt', p => ([ p('room'), p('createdAt') ])),
  ChatHistory.indexWait(),
]
