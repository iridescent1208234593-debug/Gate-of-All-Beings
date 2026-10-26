// 罗小黑战记·重生之门 —— 御灵系技能效果表
// 设定依据：content/skills-data.js（角色技能大全，源自 worldview_luoxiaohei_v4.db 技能聚合）
//          + content/dungeon-encounters.js（怪物已配置的 skill 名字段）
// 作用：将怪物身上的 skill 名字从"纯展示标签"升级为"每回合实际战斗效果"。
// 触发时机：怪物回合行动前（takeMonsterTurn 内），效果与意图结算叠加。
//
// 效果字段（全部可选，纯数据声明以兼容 JSON 存档）：
//   playerWeak        给玩家叠加 N 层虚弱（伤害 -25%）
//   playerVulnerable  给玩家叠加 N 层易伤（受伤害 +50%）
//   selfBlock         自身本回合获得 N 点格挡
//   selfStrength      自身永久获得 N 层力量（不随回合递减）
//   selfRegen         自身永久获得 N 层回灵（每回合行动前回复生命）
//   selfHeal          自身立即回复 N 点生命
//   desc              效果描述（战斗 UI 鼠标悬浮展示）

export const skillEffects = {
	// —— 木系：缠绕 / 催生 / 治愈 ——
	藤蔓缠绕: {
		playerWeak: 1,
		desc: '藤蔓缠身，削弱敌人攻势（每回合使玩家虚弱 1 层）',
	},
	缠藤: {
		playerWeak: 1,
		desc: '缠藤束缚，削弱敌人攻势（每回合使玩家虚弱 1 层）',
	},
	催生: {
		selfRegen: 1,
		desc: '催生草木，生机不息（每回合获得 1 层回灵）',
	},
	植灵: {
		selfRegen: 2,
		desc: '植灵汲取大地生机（每回合获得 2 层回灵）',
	},
	仿生: {
		selfHeal: 3,
		desc: '仿生造物，自我修复（立即回复 3 点生命）',
	},

	// —— 土系：岩壁 / 地陷 / 巨灵阵 ——
	地陷: {
		selfBlock: 4,
		desc: '地陷为垒，土系护体（每回合获得 4 点格挡）',
	},
	岩壁: {
		selfBlock: 5,
		desc: '岩壁高耸，坚不可摧（每回合获得 5 点格挡）',
	},
	巨灵阵: {
		selfBlock: 6,
		desc: '巨灵法阵，厚土镇守（每回合获得 6 点格挡）',
	},
	转移: {
		selfBlock: 4,
		desc: '转移攻势，借力卸劲（每回合获得 4 点格挡）',
	},

	// —— 水系：雾隐 / 寒潮 / 缚灵 / 渊啸 ——
	雾隐: {
		selfBlock: 5,
		desc: '雾隐迷踪，水幕护身（每回合获得 5 点格挡）',
	},
	寒潮: {
		playerWeak: 1,
		desc: '寒潮刺骨，冻僵筋骨（每回合使玩家虚弱 1 层）',
	},
	缚灵: {
		playerWeak: 1,
		desc: '缚灵锁魂，水缚周身（每回合使玩家虚弱 1 层）',
	},
	渊啸: {
		playerVulnerable: 1,
		desc: '渊底长啸，震慑心神（每回合使玩家易伤 1 层）',
	},
	冰火双域: {
		playerVulnerable: 1,
		selfBlock: 4,
		desc: '冰火双域，攻守兼备（每回合易伤玩家 1 层并获 4 点格挡）',
	},

	// —— 火系：烈焰 / 三昧火 / 妖王怒 / 三头六臂 ——
	烈焰: {
		playerVulnerable: 1,
		desc: '烈焰灼烧，破甲焚身（每回合使玩家易伤 1 层）',
	},
	三昧火: {
		playerVulnerable: 1,
		selfStrength: 1,
		desc: '三昧真火，愈战愈烈（每回合易伤玩家 1 层并获 1 层力量）',
	},
	妖王怒: {
		selfStrength: 2,
		desc: '妖王震怒，气势磅礴（每回合获得 2 层力量）',
	},
	三头六臂: {
		selfStrength: 2,
		desc: '三头六臂，攻势如潮（每回合获得 2 层力量）',
	},

	// —— 金系：剑阵 / 剑域 / 断金阵 / 针雨 / 追毫 ——
	剑阵: {
		selfStrength: 1,
		desc: '剑阵齐发，锋芒毕露（每回合获得 1 层力量）',
	},
	剑域: {
		selfStrength: 1,
		selfBlock: 3,
		desc: '剑域展开，攻守一体（每回合获 1 层力量与 3 点格挡）',
	},
	断金阵: {
		playerVulnerable: 1,
		desc: '断金之阵，锋锐破防（每回合使玩家易伤 1 层）',
	},
	针雨: {
		playerVulnerable: 1,
		desc: '针雨如瀑，无孔不入（每回合使玩家易伤 1 层）',
	},
	追毫: {
		playerWeak: 1,
		selfStrength: 1,
		desc: '追毫锁定，弱点毕现（每回合虚弱玩家 1 层并获 1 层力量）',
	},

	// —— 特殊系：聚灵 / 回响 / 灵誓 / 豪夺 / 时滞 / 戏梦 / 噬魂 / 分裂 / 冲撞 / 横扫 ——
	聚灵: {
		selfRegen: 1,
		desc: '聚拢天地灵气（每回合获得 1 层回灵）',
	},
	回响: {
		selfStrength: 1,
		desc: '轮回回响，门灵渐强（每回合获得 1 层力量）',
	},
	灵誓: {
		selfStrength: 1,
		playerWeak: 1,
		desc: '灵誓镇压，双重压制（每回合虚弱玩家 1 层并获 1 层力量）',
	},
	豪夺: {
		selfHeal: 3,
		playerVulnerable: 1,
		desc: '豪夺生机，噬敌养己（每回合回复 3 点生命并使玩家易伤 1 层）',
	},
	时滞: {
		playerWeak: 1,
		selfBlock: 2,
		desc: '时滞凝滞，攻速迟缓（每回合虚弱玩家 1 层并获 2 点格挡）',
	},
	戏梦: {
		playerWeak: 2,
		desc: '戏梦迷离，神志恍惚（每回合使玩家虚弱 2 层）',
	},
	噬魂: {
		selfHeal: 3,
		playerVulnerable: 1,
		desc: '噬魂夺魄，愈战愈勇（每回合回复 3 点生命并使玩家易伤 1 层）',
	},
	分裂: {
		selfStrength: 1,
		desc: '分裂增生，分身作战（每回合获得 1 层力量）',
	},
	冲撞: {
		playerVulnerable: 1,
		desc: '蛮力冲撞，撞碎防线（每回合使玩家易伤 1 层）',
	},
	横扫: {
		playerWeak: 1,
		desc: '横扫千军，势大力沉（每回合使玩家虚弱 1 层）',
	},

	// —— 法宝类：蓝玉盘 ——
	蓝玉盘: {
		selfBlock: 6,
		desc: '蓝玉宝盘，护体灵光（每回合获得 6 点格挡）',
	},
}

/**
 * 按技能名取效果；未收录的技能返回 null（技能仅作展示，无额外效果）。
 * @param {string|undefined} skill
 * @returns {object|null}
 */
export const skillEffectByName = (skill) => (skill && skillEffects[skill]) || null

/**
 * 全部技能效果数（供验证脚本断言）。
 */
export const skillEffectCount = Object.keys(skillEffects).length
