// Project-local history. This module never contacts the upstream game's server.
import {readGame,transact} from '/shared/shared-session/game.js'
import {runIdentity} from './save-system.js'
export async function postRun(game) {
	if(!game?.state?.player)throw new Error('缺少有效的对局记录。')
	return transact('slay',{id:'manual-history:'+runIdentity(game.state),summary:'重生之门 · 对局记录'})
}
export async function getRuns() {
	return (await readGame()).recent.filter(run=>run.mode==='slay')
}
