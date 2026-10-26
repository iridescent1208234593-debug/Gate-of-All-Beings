/**
 * 灵境会馆 - 内容数据层：随机事件
 * 纯数据。世界随机事件：增益 / 减益 / 袭击 / 中立社交。
 * type: buff | debuff | attack | neutral
 * weight: 抽中权重；duration: 持续 tick（0 = 一次性立即结算；>0 在 state.events 驻留逐 tick 结算）
 * effect: { resource: 全局资源增减, needAll: 全员需求增减, needMulAll: 全员需求衰减倍率(持续型), triggerAttack: 触发袭击 }
 */
export const EVENTS = [
  {
    id: 'lingchi-tide',
    name: '灵质潮汐',
    desc: '灵质海洋起伏，潮汐涌入会馆，灵质 +50',
    type: 'buff',
    weight: 20,
    duration: 0,
    effect: { resource: { spirit: 50 } },
  },
  {
    id: 'yewei',
    name: '野味串门',
    desc: '山间野味误闯会馆，恰好撞进食坊，食物 +20',
    type: 'buff',
    weight: 16,
    duration: 0,
    effect: { resource: { food: 20 } },
  },
  {
    id: 'lingquan',
    name: '灵泉涌出',
    desc: '灵泉自地底涌出，浸润基地，全员领地感 +30',
    type: 'buff',
    weight: 12,
    duration: 0,
    effect: { needAll: { territory: 30 } },
  },
  {
    id: 'yaoqi',
    name: '妖气缠身',
    desc: '浓重妖气笼罩会馆，全员睡眠衰减翻倍',
    type: 'debuff',
    weight: 14,
    duration: 30,
    effect: { needMulAll: { sleep: 2 } },
  },
  {
    id: 'yaoshou-raid',
    name: '妖灵滋扰',
    desc: '成群的失控妖灵冲进灵质空间，被污染灵质驱使着疯狂破坏，必须迎战！',
    type: 'attack',
    weight: 8,
    duration: 0,
    effect: { triggerAttack: true },
  },
  {
    id: 'lingzhi-liefeng',
    name: '灵质裂缝',
    desc: '灵质海洋泛起异动，一道裂缝撕开会馆边缘，灵质外泄 -40',
    type: 'debuff',
    weight: 10,
    duration: 0,
    effect: { resource: { spirit: -40 } },
  },
  {
    id: 'buzhi-ke',
    name: '不速之客',
    desc: '云游的妖精登门拜访，携来新鲜见闻，全员社交 +25',
    type: 'neutral',
    weight: 12,
    duration: 0,
    effect: { needAll: { social: 25 } },
  },
];

export const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function getEvent(id) {
  return EVENT_MAP[id] || null;
}
