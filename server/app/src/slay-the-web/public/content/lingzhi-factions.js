// 势力缘起（faction）数据模块
// 数据来源：罗小黑世界观数据库 worldview_luoxiaohei_v4.db
//   - organizations 表：妖灵会馆 / 离岛组织 / 执行者 / 感知组 / 明王势力 / 北域势力
//   - characters 表 affiliation 字段：风息、虚淮、天虎、洛竹（离岛）；无限、鸠老、若水、蓝玉（执行者）；
//     明王（阎明）掌管地界与索灵妖精；那伽（北域神明，吸食魂灵，曾掳走清凝三百年）
// 设计定位：与「出身分馆」（妖灵会馆七大分馆，guild-branches.js）并行的阵营立场维度。
//   出身分馆决定“在哪修行”，势力缘起决定“站在哪一边”——开局二选一进入灵质回路后，
//   势力被动与分馆馆训、今日灵机叠加生效（startBattle 三层开战增益）。
// 立场基调：
//   - 执行者：妖灵会馆执法力量，守护人妖平衡（正道秩序）
//   - 离岛：风息领导的厌恨人类妖精组织，主张夺回土地（激进复仇）
//   - 地界·酆都：明王掌管的地界，索灵妖精居所，魂灵轮回之地（轮回中立）
//   - 北域：北域神明那伽的势力，吸食魂灵、灵主渗透（侵蚀异端）

export const lingzhiFactions = [
	{
		id: 'zhixing',
		name: '执行者',
		leader: '无限',
		stance: '妖灵会馆执法力量，守护人妖平衡',
		tone: '正道秩序',
		desc: '妖灵会馆的执法力量，负责处理违规妖精。最强执行者为无限，鸠老、若水、蓝玉、白宜皆出其中。',
		flavor: '「妖与人的世界需要一条线，而守住这条线的，是我们。」',
		leaders: ['无限', '鸠老', '若水', '蓝玉', '白宜'],
		passive: {
			strength: 2,
			block: 2,
		},
		passiveDesc: '执法之势：每场战斗开始获得 2 力量、2 格挡',
	},
	{
		id: 'lidao',
		name: '离岛',
		leader: '风息',
		stance: '厌恨人类的妖精组织，主张夺回被占据的土地',
		tone: '激进复仇',
		desc: '风息领导的妖精组织，聚集了对人类扩张心怀怨恨的妖精：天虎、虚淮、洛竹。他们相信土地本该属于妖精。',
		flavor: '「这片土地本就是我们的。夺回来，有什么不对？」',
		leaders: ['风息', '天虎', '虚淮', '洛竹'],
		passive: {
			strength: 4,
		},
		passiveDesc: '夺还之志：每场战斗开始获得 4 力量',
	},
	{
		id: 'dijie',
		name: '地界·酆都',
		leader: '明王',
		stance: '掌管地界与索灵妖精，魂灵轮回之地',
		tone: '轮回中立',
		desc: '明王（阎明）掌管的地界，索灵妖精的居所。酆都是其灵质空间，索灵者游走人间与地界之间，维系魂灵轮回。',
		flavor: '「魂灵来处与归处皆在此地。生者不必惧，逝者不必留。」',
		leaders: ['明王', '索灵妖精'],
		passive: {
			heal: 3,
			block: 2,
		},
		passiveDesc: '魂灵滋养：每场战斗开始回复 3 生命、获得 2 格挡',
	},
	{
		id: 'beiyu',
		name: '北域',
		leader: '那伽',
		stance: '北域神明那伽的势力，吸食魂灵、侵蚀同化',
		tone: '侵蚀异端',
		desc: '北域神明那伽的势力。那伽主修生灵系与空间系，领域具侵占特质，以灵主分身渗透同化，曾掳走清凝三百年。',
		flavor: '「你的灵，终将成为我的一部分。」',
		leaders: ['那伽', '清凝（曾）'],
		passive: {
			drawExtra: 1,
			strength: 1,
		},
		passiveDesc: '灵主渗透：每场战斗多抽 1 张牌、获得 1 力量',
	},
]

export function lingzhiFactionById(id) {
	return lingzhiFactions.find((f) => f.id === id) || null
}

export function randomLingzhiFaction() {
	return lingzhiFactions[Math.floor(Math.random() * lingzhiFactions.length)]
}
