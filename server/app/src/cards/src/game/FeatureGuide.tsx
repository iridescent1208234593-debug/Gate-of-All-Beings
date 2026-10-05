import {EFFECT_FIELDS} from './core/cardBalance';

export const FEATURE_GUIDES:Record<string,{title:string;text:string}>={
  home:{title:'门庭 · 选择今天的旅途',text:'选择同行者开始卡牌历练，也可以进入据点建造或生态观测。已有历练可以继续；另开一局会提示替换当前进度。'},
  adventure:{title:'入世历练 · 路线与回合',text:'选择亮起的相邻节点。战斗先点敌人再出牌，每回合恢复 3 灵力，手牌上限 10 张。结束回合后木灵和侵蚀先结算，再轮到敌人。战后可选牌或跳过；休憩可治疗或精进；行商可购牌或删牌。'},
  management:{title:'据点经营 · 安顿居民',text:'营造面板选择建筑，再点空地放置，居民随后施工。点击居民查看需求和分工；研究解锁新建筑。拖动画面平移，滚轮或双指缩放，复位按钮回到全图。暂停与 1–3 倍速控制模拟；东扩、南扩花费灵质扩地。生态收获在打开此页后入库，容量不足会继续保留。合成面板内可打开灵体拼装实验室。'},
  hall:{title:'会馆日常 · 默契与封灵',text:'为同行者分配照料灵圃、切磋或休息，再推进一天领取结果。默契达到 9 且拥有 12 灵质可封灵，下一局会多一张封灵之契。这里的日常资源独立于三维据点库存；新版生态收获送往据点经营。'},
  collection:{title:'灵卡图鉴 · 了解与调校',text:'点击卡牌查看详细效果及数值管理。编辑灵力费用、效果、目标和出牌条件，预览后保存到后台；恢复默认只重置这张卡的配置。修改会影响本页后续出牌，不重算已经发生的行动；其他已打开页面需重新加载。图鉴收录不代表已加入当前牌组。'},
  timeline:{title:'旅途手札 · 安排节点事件',text:'设置事件的名称、触发层数及治疗、灵石或生命上限奖励，再保存时间线。每份最多 12 个事件，层数为 1–10，数值为 1–20。新历练使用保存的时间线；当前历练保留出发时的版本。支持 JSON 导入和导出。'},
  world:{title:'万灵志 · 查阅世界',text:'按人物、地点和纪事浏览资料，搜索名称和介绍。六大系描述能力类型，五行描述属性，两者分别标注。人物资料用于查阅，游戏中的卡牌数值另由玩法规则决定。'},
  ecosystem:{title:'灵境生态 · 从观测到收获',text:'运行生态世界，观察植物和生灵繁衍。点击收获并送回会馆，会保存这一批资源和至多 12 个存活个体：资源等待据点接收，个体解锁专属灵卡，下一次历练可在奖励池获得。同一批重复发送不会重复入库；独立页面也可导出 JSON。'},
};
export function FeatureGuide({view}:{view:string}){
  const guide=FEATURE_GUIDES[view];if(!guide)return null;
  return <details className="feature-guide"><summary>{guide.title} · 功能说明</summary><p>{guide.text}</p></details>;
}
export function FullGuide(){return <div className="help-content full-guide"><p>三个玩法互相连接：生态结缘成卡、资源送往据点，再选择同行者入世历练。</p>{Object.entries(FEATURE_GUIDES).map(([id,guide])=><details key={id}><summary>{guide.title}</summary><p>{guide.text}</p></details>)}<details><summary>卡牌效果词典与精进</summary><p>以下都是未受敌我状态修正前的基础值。精进仅提高已经存在的效果；费用、出牌条件和消耗规则不变。</p><dl>{EFFECT_FIELDS.map(field=><div key={field.key}><dt>{field.label}</dt><dd>{field.help}</dd></div>)}</dl><p>消耗：使用后本场不再抽到，下场恢复。全部敌人：只扩展敌方效果，抽牌、治疗、灵力和格挡等自身效果仍只结算一次。</p></details><details><summary>保存、备份与生效范围</summary><p>旅途和生态进度保存在当前浏览器；据点每 15 秒及离开时保存，也可手动存档。页脚可导出完整旅途存档。卡牌调整另存于本地后台，刷新后仍然有效，每次保存会自动备份前一版。后台不可用时暂停历练操作，避免套用错误数值。历史操作回放需要配套的数值版本。</p></details></div>;}
