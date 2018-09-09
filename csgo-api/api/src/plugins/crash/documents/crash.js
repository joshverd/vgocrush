
import r from 'lib/database'

const CrashGames = r.table('CrashGames')
export default CrashGames

export const CrashGameBets = r.table('CrashGameBets')
export const CrashGameHashes = r.table('CrashGameHashes')

function getLastCrashGame() {

}
