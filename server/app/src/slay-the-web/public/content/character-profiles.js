// 罗小黑战记·重生之门 —— 角色详设档案（Character Profiles）
// 数据来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db（character_info 表，12 条）
// 用途：为角色图鉴补充性别 / 种族 / 详设身份 / 性格 / 外貌 / 声优等档案字段，
//       按 name 与 content/worldview-data.js + content/characters-full.js 的 allCharacters 精确匹配。
// 注：数据库原名「李清凝（清凝仙子）」在游戏角色库中为「李清凝」，映射时统一为「李清凝」。

export const characterProfiles = [
	{
		name: '玄离',
		gender: '男',
		race: '妖（上古神兽螭龙）',
		identity: '上古神兽，妖界声望极高，被称为"玄离大人"。原肉体在长眠洞中休眠，灵体寄居在罗小白的哥哥阿根体内，与阿根双魂一体。',
		personality: '上古时期急躁好斗，后逐渐沉稳。食量惊人，尤其喜爱肘子。',
		appearance: '黑色乱发，耳朵尖长，紫色瞳孔，笑时露獠牙，脖子系红绳，耳朵佩戴金色耳环。',
		voice: '（未公开）',
	},
	{
		name: '谛听',
		gender: '男',
		race: '神兽',
		identity: '上古神兽，原为明王（阎明）属下，后追随老君。可自由出入蓝溪镇，帮老君买宅周边。拥有三只能变成鸟的狗。',
		personality: '面冷心热，与玄离是旧识。极易上当受骗，总被困在门外。游戏高手但自称不会玩。',
		appearance: '青色长发，绿色瞳孔，精灵耳，古装风格。妖化形态为独角青兽。',
		voice: '皇贞季（中文）/ 内山昂辉（日配）',
	},
	{
		name: '老君',
		gender: '男',
		race: '妖（本质是妖精，被赋予"神仙"称号）',
		identity: '妖灵会馆创始人之一，法力高强拥有无数法宝。是"太上老君"的原型。立百年不出君阁之誓，目前闭关中，沉迷ACG。弟子包括李清凝、阎明等。',
		personality: '节能模式时像无眉毛小孩，实际性格有反差萌、傲娇。曾喜欢抽烟，后戒烟。',
		appearance: '蓝色头发，蓝色瞳孔。节能模式为无眉毛小孩，宽大深青色衣袍。原形非常帅，左右耳各佩戴蓝玉盘。',
		voice: '笑谈（中文）/ 山寺宏一（日配）',
	},
	{
		name: '李清凝',
		gender: '女',
		race: '人',
		identity: '老君的入室弟子，后成为清凝仙子。拥有极高医学天赋。后被那伽胁迫前往北域，最终老君救回并藏于君阁内。',
		personality: '善良聪慧，医术高超。',
		appearance: '（详见漫画《蓝溪镇》）',
		voice: '（未公开）',
	},
	{
		name: '山新',
		gender: '女',
		race: '人',
		identity: '罗小白的同班同学和好友，皇受的主人。行动力惊人，睡相惊人。',
		personality: '搞怪，重视友情，宅女，游戏高手。',
		appearance: '橙色头发双马尾，日常没有太多表情。头发会动，可以用头发打羽毛球。',
		voice: '山新（中文）/ 鬼头明里（日配）',
	},
	{
		name: '叶子',
		gender: '男',
		race: '妖（土系妖精）',
		identity: '风息团队成员，团队中相对年轻的新成员。',
		personality: '与风息志同道合，战力不强但展现土系典型特征。',
		appearance: '身高188cm，体格强健（土系妖精普遍特征）。',
		voice: '张恩泽',
	},
	{
		name: '兴帝',
		gender: '男',
		race: '',
		identity: '兴国开国皇帝',
		personality: '',
		appearance: '',
		voice: '',
	},
	{
		name: '程北河',
		gender: '男',
		race: '',
		identity: '老君助手·神医',
		personality: '',
		appearance: '',
		voice: '',
	},
	{
		name: '孙锐',
		gender: '男',
		race: '',
		identity: '兴国官员',
		personality: '',
		appearance: '',
		voice: '',
	},
	{
		name: '李雪',
		gender: '女',
		race: '',
		identity: '兴国女将军',
		personality: '',
		appearance: '',
		voice: '',
	},
	{
		name: '李钧',
		gender: '男',
		race: '',
		identity: '李清凝之父',
		personality: '',
		appearance: '',
		voice: '',
	},
	{
		name: '谢谷雨',
		gender: '女',
		race: '',
		identity: '李清凝之母',
		personality: '',
		appearance: '',
		voice: '',
	},
]

/** 档案统计（供图鉴标题 small 展示） */
export const profileStats = {
	total: characterProfiles.length,
	withIdentity: characterProfiles.filter((p) => p.identity).length,
	withPersonality: characterProfiles.filter((p) => p.personality).length,
	withAppearance: characterProfiles.filter((p) => p.appearance).length,
	withVoice: characterProfiles.filter((p) => p.voice && p.voice !== '（未公开）').length,
}

/** 按角色名查找详设档案（未收录返回 undefined） */
export function profileFor(name) {
	return characterProfiles.find((p) => p.name === name)
}
