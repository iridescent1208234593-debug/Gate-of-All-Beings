import { unifiedStorage } from '/shared/shared-session/kv.js';
const localStorage = unifiedStorage('slay');
// 罗小黑战记·重生之门 —— 多结局系统数据模块
// 机制来源：通关「重生之门」时，按本局玩家的状态轨迹（道心 / 魂灵种子 / 羁绊 / 境界 / 法宝 / 灵偶 / 化形）
//   判定本次轮回走向哪个结局。不同结局代表不同的「重生方式」——
//   呼应世界观中「聚灵而生，散灵而亡，魂灵不息」的生命循环（content/worldview-data.js spiritLifecycle）。
// 判定优先级：从最特殊到最普通，decideEnding 返回第一个满足条件的结局。
// 跨局记录：已解锁结局永久记录于 localStorage['luoxiaohei-rebirth-endings']，
//   供后续结局图鉴 / 成就系统复用（本模块只负责判定与记录，展示在 win-screen.js）。

const ENDINGS_KEY = 'luoxiaohei-rebirth-endings'

/**
 * 结局条目：
 * @typedef {Object} Ending
 * @property {string} id 唯一标识
 * @property {string} name 结局名
 * @property {string} subtitle 副标题（一句话点题）
 * @property {string} desc 结局正文（世界观叙事）
 * @property {string} conditionDesc 判定条件描述（供图鉴/结算界面展示）
 * @property {(player: object) => boolean} condition 判定函数，入参为通关时 player 状态
 */

// 结局池：按特殊度降序排列，decideEnding 取首个命中
export const ENDINGS = [
	// ---------- 特殊结局：道心通明 ----------
	{
		id: 'end_dao',
		name: '道心通明',
		subtitle: '千帆过尽，初心不改',
		desc: '你穿过重生之门时，道心澄澈如镜。老君曾说，灵誓系于魂灵，而道心系于本我——你已把每一世的选择都活成了「明」。门后没有新的轮回在等你，只有一泓照见过去所有自己的清水。你向它走去，第一次，不怕散灵。',
		conditionDesc: '道心 ≥ 120（心境圆满，不为轮回所动）',
		condition: (p) => (p.daoHeart || 0) >= 120,
	},
	// ---------- 特殊结局：魂灵归墟 ----------
	{
		id: 'end_soul',
		name: '魂灵归墟',
		subtitle: '散灵不是终结，是另一种聚',
		desc: '你的灵质空间里凝结着数颗魂灵种子，它们随你一同穿过门扉。门灵低语：魂灵从未真正消散，只是换一种方式等待重生。这一次，你选择不带走任何记忆——让魂灵种子回归天地，成为下一只聚灵而生的妖精最初的灵识。你听见风里有细微的、新生的呼吸。',
		conditionDesc: '魂灵种子 ≥ 5（深谙聚灵与散灵之理）',
		condition: (p) => (p.soulSeed || 0) >= 5,
	},
	// ---------- 特殊结局：众灵同行 ----------
	{
		id: 'end_bond',
		name: '众灵同行',
		subtitle: '一个人走不远的，是同伴',
		desc: '门扉合拢前，你回头——罗小黑、小白、比丢、山新……那些在旅途中结下的羁绊，化作一道道灵光立在门后，目送你踏入新的轮回。小黑晃着尾巴说：「下次，还一起走。」你忽然明白，重生之门最珍贵的不是力量，而是无论散灵多少次，都会有人记得你。',
		conditionDesc: '羁绊 ≥ 4（与核心角色结下深厚缘分）',
		condition: (p) => (p.bonds?.length || 0) >= 4,
	},
	// ---------- 特殊结局：超脱飞升 ----------
	{
		id: 'end_realm',
		name: '超脱飞升',
		subtitle: '渡尽劫波，此身即门',
		desc: '修为圆满的那一刻，你不再需要推开重生之门——你自己就是门。你以凡人之躯，一步步把修行走到了尽头。门灵向你俯首，轮回为你让路。你踏出最后一步，从此，生死由你，不由天。',
		conditionDesc: '境界达化神圆满（渡劫飞升）',
		condition: (p) => (p.realmIndex || 0) >= 4,
	},
	// ---------- 特殊结局：万宝归藏 ----------
	{
		id: 'end_treasure',
		name: '万宝归藏',
		subtitle: '宝物有灵，认主归宗',
		desc: '你腰间、袖中、灵质空间里，法宝与法器琳琅满目。门灵啧啧称奇：锁御系的高手它见过，可集齐如此多至宝的散修，它是头回见。法宝们嗡鸣着随你穿过门扉——宝物有灵，认主之后，连轮回也拆不散这份羁绊。你带着满身灵光，走入新的故事。',
		conditionDesc: '法宝 ≥ 8（集藏至宝，灵御随身）',
		condition: (p) => (p.treasures?.length || 0) >= 8,
	},
	// ---------- 特殊结局：造物之主 ----------
	{
		id: 'end_golem',
		name: '造物之主',
		subtitle: '以灵造物，万物可生',
		desc: '你的灵偶们在你身后列成一排，像一群忠诚的小兵。造物系的力量在你手中臻至化境——生灵与物质灵交织，你已能凭空捏出一个小小的、会呼吸的世界。门灵看着你的灵偶，沉默良久：「鸠老若在，也会收你为徒。」你带着造物之手，叩响下一世的门。',
		conditionDesc: '灵偶 ≥ 3（造物系大成）',
		condition: (p) => (p.golems?.length || 0) >= 3,
	},
	// ---------- 普通结局：化形圆满 ----------
	{
		id: 'end_transform',
		name: '化形圆满',
		subtitle: '聚灵成形，此身初立',
		desc: '生灵与物质灵在你的灵质空间里达成平衡，你的形态终于稳固。穿过重生之门时，门灵打量着你：「妖精化形，少说也要百年光景——你倒好，一世就做到了。」你摸摸自己的手，真切地感到「活着」。门后，新的世界正等着这只初生的妖精。',
		conditionDesc: '化形达大妖·通灵（生灵与物质灵圆满）',
		condition: (p) => (p.transformStage || 0) >= 2,
	},
	// ---------- 默认结局：轮回之门 ----------
	{
		id: 'end_default',
		name: '轮回之门',
		subtitle: '门后，又是新的一世',
		desc: '你穿过了重生之门。门灵散去，轮回的真相如潮水涌来——魂灵从未真正消散，它们只是换一种方式，等待重生。这一世的你，带着这一路的聚灵、散灵与抉择，轻轻合上门扉。故事，才刚刚开始。',
		conditionDesc: '普通通关（未触发特殊结局条件）',
		condition: () => true,
	},
]

/**
 * 判定本局结局：按 ENDINGS 顺序返回第一个满足条件的结局。
 * @param {object} player 通关时的 player 状态
 * @returns {{id: string, name: string, subtitle: string, desc: string, conditionDesc: string}}
 */
export function decideEnding(player) {
	if (!player) return ENDINGS[ENDINGS.length - 1]
	return ENDINGS.find((e) => e.condition(player)) || ENDINGS[ENDINGS.length - 1]
}

/** 读取跨局已解锁结局记录（浏览器外环境返回空对象） */
export function getUnlockedEndings() {
	if (typeof localStorage === 'undefined') return {}
	try {
		const raw = localStorage.getItem(ENDINGS_KEY)
		return raw ? JSON.parse(raw) : {}
	} catch (err) {
		console.warn('结局记录读取失败', err)
		return {}
	}
}

/** 记录本次解锁的结局（去重；附带解锁次数与时间） */
export function markEndingUnlocked(id) {
	if (!id || typeof localStorage === 'undefined') return
	try {
		const all = getUnlockedEndings()
		const prev = all[id] || {count: 0}
		all[id] = {count: prev.count + 1, unlockedAt: Date.now()}
		localStorage.setItem(ENDINGS_KEY, JSON.stringify(all))
	} catch (err) {
		console.warn('结局记录写入失败', err)
	}
}

/** 统计已解锁结局种类数 */
export function unlockedEndingCount() {
	return Object.keys(getUnlockedEndings()).length
}

/** 按 id 取结局条目 */
export function endingById(id) {
	return ENDINGS.find((e) => e.id === id) || null
}
