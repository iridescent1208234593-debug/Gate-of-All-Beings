// 罗小黑战记·重生之门 —— 作品与幕后图鉴数据模块
// 数据来源：worldview_luoxiaohei_v4.db
//   series_works 表原始 12 条（含重复）→ 按 title+release_date 去重后 6 部作品
//   staff 表原始 24 条（含重复）→ 按 name 去重后 21 位制作人员（全量数据见 staff-data.js，含配音角色联动）
// 字段：id / title 名称 / aliases 别名 / type 类型 / episodes 集数 /
//       director 导演 / writer 编剧 / production 制作 / release 上映(播出)时间 / status 状态
// 说明：电影类 status 原库为空，渲染时以 release 展示；数据忠实保留百科原文。
import {staffMembers} from './staff-data.js'

export const seriesWorks = [
	{
		id: 1,
		title: '罗小黑战记（TV版）',
		aliases: ['罗小黑战记TV版', '第一季'],
		type: 'TV动画',
		episodes: '40＋5（未完结）',
		director: '木头 阿根 栗子',
		writer: '木头',
		production: '寒木春华',
		release: '2011年3月17日—今',
		status: '更新中',
	},
	{
		id: 2,
		title: '众生之门篇',
		aliases: ['罗小黑战记·众生之门篇', '众生之门'],
		type: 'TV动画',
		episodes: '12',
		director: '',
		writer: '',
		production: '哔哩哔哩、寒木春华',
		release: '2021年4月24日—2021年7月17日',
		status: '已完结',
	},
	{
		id: 3,
		title: '学前篇',
		aliases: ['罗小黑战记·学前篇'],
		type: 'TV动画',
		episodes: '6',
		director: '',
		writer: '',
		production: '哔哩哔哩、寒木春华',
		release: '2026年下半年',
		status: '未播出',
	},
	{
		id: 4,
		title: '罗小黑战记',
		aliases: ['罗小黑战记电影版', '罗小黑战记电影版第一部', '罗小黑战记1'],
		type: '电影',
		episodes: '',
		director: '木头 顾杰（执行）',
		writer: '木头',
		production: '寒木春华',
		release: '2019年9月7日',
		status: '',
	},
	{
		id: 5,
		title: '罗小黑战记2',
		aliases: ['罗小黑战记II'],
		type: '电影',
		episodes: '',
		director: '木头 顾杰（执行）',
		writer: '木头 顾杰 彭可欣 风息',
		production: '寒木春华',
		release: '2025年10月24日',
		status: '',
	},
	{
		id: 6,
		title: '罗小黑的清晨',
		aliases: [],
		type: '电影短片',
		episodes: '',
		director: '',
		writer: '',
		production: '寒木春华',
		release: '2022年6月24日',
		status: '已完结',
	},
]

export const staffList = staffMembers
// 制作人员全量数据见 staff-data.js（staff 表 24 条去重后 21 位，含 desc 与配音角色联动）

export const worksStats = {
	workCount: seriesWorks.length,
	tvCount: seriesWorks.filter((w) => w.type.includes('TV')).length,
	movieCount: seriesWorks.filter((w) => w.type.includes('电影')).length,
	staffCount: staffList.length,
	voiceCount: staffList.filter((s) => (s.role || '').includes('配音演员')).length,
}
