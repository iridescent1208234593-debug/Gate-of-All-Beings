/**
 * 灵境会馆 - 内容数据层：世界观角色池（M4 第一批）
 * 数据来源：worldview_luoxiaohei_v4.db（罗小黑战记世界观数据库，characters 表）
 * 抽取规则：
 *   1) 优先 type 含 妖精/执行者/神仙/妖怪 且 abilities_summary 含 御灵系-金/木/水/火/土；
 *   2) 补充知名角色，按其能力/本体映射五行（如虚淮·冰属水、紫罗兰·花属木、龙岩·土岩属土）；
 *   3) 共 48 条，element 枚举 jin/mu/shui/huo/tu，desc 一句话简介（≤40 字）。
 * 用途：小妖生成未显式指定名字时，从此池按元素过滤随机取名。
 */
export const LORE_CHARACTERS = [
  // ---------- 金 ----------
  { name: '罗小黑', element: 'jin', desc: '主角小黑猫，懵懂天真，师从无限，御灵系-金' },
  { name: '无限', element: 'jin', desc: '妖灵会馆最强执行者，小黑的师父，御灵系-金' },
  { name: '鹿野', element: 'jin', desc: '无限弟子，战斗妖精，御灵系-金，体术极强' },
  { name: '泽宇', element: 'jin', desc: '温柔细心的妖精，御灵系-金，生灵系-追毫' },
  { name: '甲', element: 'jin', desc: '沉稳寡言的妖精，御灵系-金，双系合技画虎' },
  { name: '溪鹿', element: 'jin', desc: '妖精执行者，御灵系-金，生灵系-念磁' },
  { name: '流藏', element: 'jin', desc: '御灵系-金的会馆妖精执行者' },
  // ---------- 木 ----------
  { name: '风息', element: 'mu', desc: '黑豹守护者，御灵系-木，为守护家园与人类为敌' },
  { name: '洛竹', element: 'mu', desc: '阳光可爱的妖精，御灵系-木，喜欢小黑' },
  { name: '卡里', element: 'mu', desc: '极具商业头脑的妖精，御灵系-木，催生树木卖钱' },
  { name: '幕斯', element: 'mu', desc: '漫画家妖精，御灵系-木，会馆成员' },
  { name: '小黄', element: 'mu', desc: '傲娇贪吃的神兽，御灵系-木与金' },
  { name: '猫老大', element: 'mu', desc: '慵懒贪吃的强大神兽，御灵系-木与金' },
  { name: '紫罗兰', element: 'mu', desc: '温柔善良的花妖，本体为花，会馆妖精' },
  { name: '粉末', element: 'mu', desc: '花精灵，重情重义，木系感知，终放下怨恨' },
  { name: '西木子', element: 'mu', desc: '玩世不恭的妖精，智谋顶尖，锁御系与心灵系' },
  { name: '木落仙人', element: 'mu', desc: '仙人行事随性，空间系巨灵阵，想收粉末为徒' },
  // ---------- 水 ----------
  { name: '清泉', element: 'shui', desc: '温和冷静的妖精，御灵系-水，双刀智囊' },
  { name: '肉山', element: 'shui', desc: '御灵系-水，生灵系-强化的妖精' },
  { name: '虚淮', element: 'shui', desc: '高冷沉静的妖精，御灵系-冰，从小带大风息' },
  { name: '若水', element: 'shui', desc: '开朗活泼的会馆执行者，无限迷妹' },
  { name: '雪荆', element: 'shui', desc: '名含雪意的妖精执行者，冰水之属' },
  { name: '恒娥仙子', element: 'shui', desc: '最早登月的妖精仙子，月属水阴' },
  { name: '源月', element: 'shui', desc: '外表可爱内心敏感的妖精，月源之意属水' },
  { name: '清凝', element: 'shui', desc: '老君之徒清凝仙子，生灵系-治愈，温柔坚强' },
  // ---------- 火 ----------
  { name: '罗小白', element: 'huo', desc: '人类少女，活泼善良，游戏中选御灵系-火' },
  { name: '阿根', element: 'huo', desc: '玄离化身，善良亲切，御灵系-火，冰火双系' },
  { name: '谛听', element: 'huo', desc: '老君随从神兽，面冷心热，御灵系-火' },
  { name: '玄离', element: 'huo', desc: '热血冒失的仙与山神，御灵系-火，冰火双灵质空间' },
  { name: '哪吒', element: 'huo', desc: '高冷妖王执行者，御灵系-火，可幻化三头六臂' },
  { name: '天虎', element: 'huo', desc: '憨厚老实的妖精，御灵系-火，风息阵营' },
  { name: '涅帕', element: 'huo', desc: '受会馆管理的食人妖精，御灵系-火' },
  { name: '天介', element: 'huo', desc: '不喜欢人类的会馆执行者，御灵系-火' },
  { name: '炎帝', element: 'huo', desc: '最强火系神兽，御灵系-火，曾传圣火于玄离' },
  { name: '兆岳', element: 'huo', desc: '稳重的会馆执行者，御灵系-火与土' },
  { name: '硅老', element: 'huo', desc: '低调的妖精，御灵系-火（滞爆），能力曾被夺走' },
  { name: '火花', element: 'huo', desc: '火之名属火的妖精执行者' },
  { name: '孙悟空', element: 'huo', desc: '由妖王成神的存在，与哪吒同列妖王' },
  { name: '妮妮', element: 'huo', desc: '果敢强势的新生代修行者，御灵系-火' },
  // ---------- 土 ----------
  { name: '乙', element: 'tu', desc: '活泼话多的妖精，御灵系-土，变形与简单治愈' },
  { name: '池年', element: 'tu', desc: '御灵系-土，自我修复极强的妖精' },
  { name: '丁', element: 'tu', desc: '愣头青冲动的妖精，御灵系-土' },
  { name: '芷清', element: 'tu', desc: '有主见的妖精，御灵系-土，外显元气内藏沉稳' },
  { name: '紫实', element: 'tu', desc: '御灵系-土，生灵系-观灵的妖精' },
  { name: '叶子', element: 'tu', desc: '直肠子的妖精，御灵系-土，风息阵营' },
  { name: '龙岩', element: 'tu', desc: '重情重义的妖精，土岩系能力，一方霸主' },
  { name: '擎天', element: 'tu', desc: '踏实敦厚的会馆执行者，牛角耕地属土' },
  { name: '青牛', element: 'tu', desc: '温厚圆融的妖精经营者，以茶道养灵属土' },
];

/** 全池名字集合（供去重/校验） */
export const LORE_NAME_SET = new Set(LORE_CHARACTERS.map((c) => c.name));
