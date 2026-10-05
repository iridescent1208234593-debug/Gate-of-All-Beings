// 罗小黑战记·重生之门 —— 蓝溪镇漫画篇章数据模块
// 数据来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db（lxz_episodes 表，134 条）
// 提取规则：仅收录 episode_num 形如 "N/139" 且含真实标题的话数（共 54 话，已去除 42 话重复条目）。
//          数据库中 LXZ55-LXZ99、LXZ100-LXZ133 等占位条目（无真实标题）不收录。
// 用途：为图鉴页「漫画篇章」区块提供蓝溪镇漫画连载档案（话数 / 标题 / 首载日期 / 平台 / 页数），
//       并可按篇章分组浏览。篇章划分基于标题与连载顺序客观归纳，剧情细节以官方漫画为准。
// 后续可用于：剧情向事件素材、叙事回顾、蓝溪镇篇 Boss 战前置文本。

// —— 篇章分组 ——
// name: 篇名 / range: 话数范围 / note: 篇目概览（按标题与连载顺序归纳）
export const lxzChapters = [
	{
		name: '序章·初遇',
		range: [1, 9],
		note: '战乱之后，清凝与老君相遇；玄离、约定、日常、画家诸话相继展开，拜师与行前，蓝溪镇前传就此开篇。',
	},
	{
		name: '云游·四方',
		range: [10, 19],
		note: '自罗城出发，强人、医者、伤者接连登场；上天谈心、登月袭击，一行人游历途中历经风波。',
	},
	{
		name: '归途·无限',
		range: [20, 29],
		note: '刀下救险、归镇读书；北河与无限先后登场，喜事与改朝之际，去留成为抉择。',
	},
	{
		name: '会馆·前夜',
		range: [30, 39],
		note: '刺客掌柜、年号对饮，烟花城墙之间妖灵会馆初立；流言与质问接踵而至。',
	},
	{
		name: '暗流·试探',
		range: [40, 49],
		note: '静夜琢磨，等候之中阎明登场；案前动心、回应言情，出镇之期渐近。',
	},
	{
		name: '远行·北域',
		range: [50, 54],
		note: '摆摊上路，疯犬与预谋紧随其后；钦差将至，远行前路未卜。',
	},
	{
		name: '新章·星夜',
		range: [134, 134],
		note: '2025 年哔哩哔哩漫画续更，「星夜」开启蓝溪镇的新篇章。',
	},
]

// —— 漫画话数列表 ——
// num: 话数（N/139）/ title: 话标题 / date: 首载日期（YYYY-MM-DD）/ platform: 首载平台 / pages: 页数
export const lxzEpisodeList = [
	{num: 1, title: '清凝', date: '2018-09-27', platform: '微博', pages: 18},
	{num: 2, title: '老君', date: '2018-10-11', platform: '微博', pages: 7},
	{num: 3, title: '暂别', date: '2018-10-25', platform: '微博', pages: 7},
	{num: 4, title: '玄离', date: '2018-11-08', platform: '微博', pages: 10},
	{num: 5, title: '约定', date: '2018-11-30', platform: '微博', pages: 7},
	{num: 6, title: '日常', date: '2018-12-13', platform: '微博', pages: 6},
	{num: 7, title: '画家', date: '2018-12-26', platform: '微博', pages: 10},
	{num: 8, title: '拜师', date: '2019-01-09', platform: '微博', pages: 7},
	{num: 9, title: '行前', date: '2019-01-23', platform: '微博', pages: 8},
	{num: 10, title: '罗城', date: '2019-02-14', platform: '微博', pages: 10},
	{num: 11, title: '强人', date: '2019-02-28', platform: '微博', pages: 8},
	{num: 12, title: '医者', date: '2019-03-19', platform: '微博', pages: 7},
	{num: 13, title: '伤者', date: '2019-04-11', platform: '微博', pages: 9},
	{num: 14, title: '上天', date: '2019-04-25', platform: '微博', pages: 7},
	{num: 15, title: '谈心', date: '2019-05-10', platform: '微博', pages: 8},
	{num: 16, title: '登月', date: '2019-05-23', platform: '微博', pages: 8},
	{num: 17, title: '袭击', date: '2019-06-06', platform: '微博', pages: 9},
	{num: 18, title: '小花', date: '2019-06-20', platform: '微博', pages: 7},
	{num: 19, title: '问答', date: '2019-06-27', platform: '微博', pages: 3},
	{num: 20, title: '刀下', date: '2019-07-12', platform: '微博', pages: 7},
	{num: 21, title: '山林', date: '2019-07-25', platform: '微博', pages: 5},
	{num: 22, title: '治否', date: '2019-08-13', platform: '微博', pages: 5},
	{num: 23, title: '归镇', date: '2019-08-23', platform: '微博', pages: 6},
	{num: 24, title: '读书', date: '2019-09-19', platform: '微博', pages: 6},
	{num: 25, title: '北河', date: '2019-10-04', platform: '哔漫', pages: 5},
	{num: 26, title: '无限', date: '2019-10-18', platform: '哔漫', pages: 6},
	{num: 27, title: '喜事', date: '2019-11-07', platform: '哔漫', pages: 5},
	{num: 28, title: '改朝', date: '2019-11-28', platform: '哔漫', pages: 5},
	{num: 29, title: '去留', date: '2019-12-12', platform: '哔漫', pages: 6},
	{num: 30, title: '刺客', date: '2019-12-26', platform: '哔漫', pages: 6},
	{num: 31, title: '掌柜', date: '2020-01-15', platform: '哔漫', pages: 7},
	{num: 32, title: '年号', date: '2020-02-16', platform: '哔漫', pages: 6},
	{num: 33, title: '对饮', date: '2020-02-27', platform: '哔漫', pages: 6},
	{num: 34, title: '烟花', date: '2020-03-12', platform: '哔漫', pages: 5},
	{num: 35, title: '城墙', date: '2020-03-26', platform: '哔漫', pages: 5},
	{num: 36, title: '会馆', date: '2020-04-09', platform: '哔漫', pages: 11},
	{num: 37, title: '流言', date: '2020-04-23', platform: '哔漫', pages: 10},
	{num: 38, title: '质问', date: '2020-05-07', platform: '哔漫', pages: 9},
	{num: 39, title: '快刀', date: '2020-05-21', platform: '哔漫', pages: 9},
	{num: 40, title: '静夜', date: '2020-06-04', platform: '哔漫', pages: 11},
	{num: 41, title: '琢磨', date: '2020-06-16', platform: '哔漫', pages: 9},
	{num: 42, title: '等候', date: '2020-06-16', platform: '哔漫', pages: 8},
	{num: 44, title: '阎明', date: '2020-06-16', platform: '哔漫', pages: 9},
	{num: 45, title: '案前', date: '2020-06-25', platform: '哔漫', pages: 10},
	{num: 46, title: '动心', date: '2020-07-08', platform: '哔漫', pages: 10},
	{num: 47, title: '回应', date: '2020-07-24', platform: '哔漫', pages: 12},
	{num: 48, title: '言情', date: '2020-07-28', platform: '哔漫', pages: 10},
	{num: 49, title: '出镇', date: '2020-08-08', platform: '哔漫', pages: 9},
	{num: 50, title: '摆摊', date: '2020-08-18', platform: '哔漫', pages: 12},
	{num: 51, title: '路上', date: '2020-08-28', platform: '哔漫', pages: 10},
	{num: 52, title: '疯犬', date: '2020-09-09', platform: '哔漫', pages: 9},
	{num: 53, title: '预谋', date: '2020-09-18', platform: '哔漫', pages: 11},
	{num: 54, title: '钦差', date: '2020-09-28', platform: '哔漫', pages: 9},
	{num: 134, title: '星夜', date: '2025-09-20', platform: '哔漫', pages: 18},
]

const totalPages = lxzEpisodeList.reduce((sum, e) => sum + (e.pages || 0), 0)

export const lxzStats = {
	chapterCount: lxzChapters.length,
	total: lxzEpisodeList.length,
	pageTotal: totalPages,
	fromDate: lxzEpisodeList[0].date,
	toDate: lxzEpisodeList[lxzEpisodeList.length - 1].date,
}
