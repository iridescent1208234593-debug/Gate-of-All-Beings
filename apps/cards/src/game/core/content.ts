import legacyCards from '../data/legacy-cards.json';
import rebirthData from '../data/rebirth.json';
import { HERO_CHARACTER_IDS, CHARACTER_AFFINITIES } from '@lxh/shared-types/world';
import { identityById } from '@lxh/shared-data/identities.js';
import { cardText } from './cardText';
import { ecologyCard } from './ecologyCards';
import {applyBalance, type CardOverrides} from './cardBalance';
import type { EcoIndividual } from '@lxh/shared-types/models';
import type { Card, Character, HeroId } from './types';
export const HEROES: Record<HeroId, Character> = {
  xiaohei: { id: 'xiaohei', characterId:HERO_CHARACTER_IDS.xiaohei, element:CHARACTER_AFFINITIES[HERO_CHARACTER_IDS.xiaohei].element, abilitySystems:CHARACTER_AFFINITIES[HERO_CHARACTER_IDS.xiaohei].systems, name: '罗小黑', subtitle: '御灵 · 金 / 空间', description: '穿梭于虚实之间，以灵巧的连招寻找破绽。抽牌与低费攻击，让每一回合都有新的可能。', quote: '世界那么大，一起去看看吧。', hp: 72, relic: '小黑的铃铛', relicText: '每场战斗第一回合多抽 1 张牌。', starter: ['claw','claw','claw','guard','guard','guard','blink','metal','devour','claw'] },
  wuxian: { id: 'wuxian', characterId:HERO_CHARACTER_IDS.wuxian, element:CHARACTER_AFFINITIES[HERO_CHARACTER_IDS.wuxian].element, abilitySystems:CHARACTER_AFFINITIES[HERO_CHARACTER_IDS.wuxian].systems, name: '无限', subtitle: '御灵 · 金', description: '凝金为刃，收放自如。以格挡稳住阵脚，积蓄力量，打出一击制胜的锋芒。', quote: '别急，慢慢来。', hp: 80, relic: '执行者的信物', relicText: '每场战斗开始获得 1 点力量。', starter: ['blade','blade','blade','guard','guard','guard','iron','focus','pierce','blade'] },
  fengxi: { id: 'fengxi', characterId:HERO_CHARACTER_IDS.fengxi, element:CHARACTER_AFFINITIES[HERO_CHARACTER_IDS.fengxi].element, abilitySystems:CHARACTER_AFFINITIES[HERO_CHARACTER_IDS.fengxi].systems, name: '风息', subtitle: '御灵 · 木', description: '让藤蔓生长，让森林回应。召唤木灵与展开领域，在持续的守护中积累优势。', quote: '这里，是我们的家。', hp: 76, relic: '故林的种子', relicText: '每场战斗胜利恢复 4 点生命。', starter: ['vine','vine','vine','guard','guard','guard','seed','grove','bind','vine'] },
};
for(const hero of Object.values(HEROES)){
  const identity=identityById(hero.characterId);
  if(!identity)throw new Error('同行者缺少共享角色记录：'+hero.characterId);
  hero.characterId=identity.id;
  hero.name=identity.name;
}
const cards: Card[] = [
  {id:'guard',name:'凝灵',owner:'all',cost:1,type:'技能',glyph:'守',text:'获得 6 点格挡。',effect:{block:6}},
  {id:'claw',name:'利爪',owner:'xiaohei',cost:1,type:'攻击',glyph:'爪',text:'造成 7 点伤害。',effect:{damage:7}},
  {id:'blink',name:'遁空',owner:'xiaohei',cost:0,type:'技能',glyph:'隙',text:'抽 1 张牌，获得 3 点格挡。',effect:{draw:1,block:3}},
  {id:'metal',name:'御金',owner:'xiaohei',cost:1,type:'攻击',glyph:'金',text:'造成 9 点伤害，抽 1 张牌。',effect:{damage:9,draw:1}},
  {id:'devour',name:'灵隙回流',owner:'xiaohei',cost:1,type:'能力',glyph:'隙',text:'获得 2 点能量。消耗。',effect:{energy:2},exhaust:true},
  {id:'rift',name:'空间裂隙',owner:'xiaohei',cost:2,type:'攻击',glyph:'裂',text:'造成 18 点伤害。',effect:{damage:18}},
  {id:'shadow',name:'黑影',owner:'xiaohei',cost:1,type:'技能',glyph:'影',text:'获得 9 点格挡，抽 1 张牌。',effect:{block:9,draw:1}},
  {id:'dance',name:'游身',owner:'xiaohei',cost:0,type:'攻击',glyph:'游',text:'造成 4 点伤害。',effect:{damage:4}},
  {id:'blade',name:'飞刃',owner:'wuxian',cost:1,type:'攻击',glyph:'刃',text:'造成 8 点伤害。',effect:{damage:8}},
  {id:'iron',name:'铁御',owner:'wuxian',cost:1,type:'技能',glyph:'御',text:'获得 10 点格挡。',effect:{block:10}},
  {id:'focus',name:'凝神',owner:'wuxian',cost:1,type:'能力',glyph:'定',text:'本场战斗获得 2 点力量。消耗。',effect:{strength:2},exhaust:true},
  {id:'pierce',name:'破阵',owner:'wuxian',cost:2,type:'攻击',glyph:'破',text:'造成 16 点伤害，施加 1 回合虚弱。',effect:{damage:16,weak:1}},
  {id:'swords',name:'万剑归一',owner:'wuxian',cost:3,type:'攻击',glyph:'剑',text:'造成 30 点伤害。',effect:{damage:30}},
  {id:'resolve',name:'从容',owner:'wuxian',cost:0,type:'技能',glyph:'静',text:'抽 2 张牌。消耗。',effect:{draw:2},exhaust:true},
  {id:'edge',name:'锋芒',owner:'wuxian',cost:1,type:'攻击',glyph:'锋',text:'造成 10 点伤害，获得 4 点格挡。',effect:{damage:10,block:4}},
  {id:'vine',name:'藤击',owner:'fengxi',cost:1,type:'攻击',glyph:'藤',text:'造成 7 点伤害。',effect:{damage:7}},
  {id:'seed',name:'唤木',owner:'fengxi',cost:1,type:'能力',glyph:'芽',text:'召唤木灵：每次回合结束造成 3 点伤害。消耗。',effect:{summon:3},exhaust:true},
  {id:'grove',name:'林间领域',owner:'fengxi',cost:1,type:'能力',glyph:'林',text:'领域：每次回合开始获得 4 点格挡。消耗。',effect:{domain:4},exhaust:true},
  {id:'bind',name:'缚根',owner:'fengxi',cost:1,type:'攻击',glyph:'缚',text:'造成 5 点伤害，施加 2 回合虚弱。',effect:{damage:5,weak:2}},
  {id:'bloom',name:'繁生',owner:'fengxi',cost:2,type:'能力',glyph:'生',text:'召唤木灵 5，恢复 3 点生命。消耗。',effect:{summon:5,heal:3},exhaust:true},
  {id:'thorn',name:'荆棘',owner:'fengxi',cost:1,type:'攻击',glyph:'棘',text:'造成 6 点伤害，施加 4 层侵蚀。',effect:{damage:6,poison:4}},
  {id:'canopy',name:'树冠',owner:'fengxi',cost:1,type:'技能',glyph:'叶',text:'获得 8 点格挡，抽 1 张牌。',effect:{block:8,draw:1}},
  {id:'tea',name:'一盏清茶',owner:'all',cost:0,type:'技能',glyph:'茶',text:'恢复 5 点生命。消耗。',effect:{heal:5},exhaust:true},
  {id:'flow',name:'灵流',owner:'all',cost:0,type:'技能',glyph:'流',text:'获得 1 点能量，抽 1 张牌。消耗。',effect:{energy:1,draw:1},exhaust:true},
  {id:'seal',name:'封灵之契',owner:'all',cost:1,type:'能力',glyph:'契',text:'获得 1 点力量和 5 点格挡。消耗。',effect:{strength:1,block:5},exhaust:true},
];
const inherited = (legacyCards as unknown as Card[]).map(c=>({...c,text:cardText(c)}));
const ecoCards: Card[] = [
  {id:'eco-producer',name:'灵芽的馈赠',owner:'all',cost:1,type:'技能',glyph:'芽',text:'获得 7 点格挡，抽 1 张牌。',effect:{block:7,draw:1},source:'生态观测'},
  {id:'eco-herbivore',name:'林间同行',owner:'all',cost:1,type:'技能',glyph:'伴',text:'获得 5 点格挡和 1 点力量。消耗。',effect:{block:5,strength:1},exhaust:true,source:'生态观测'},
  {id:'eco-carnivore',name:'巡林之势',owner:'all',cost:2,type:'攻击',glyph:'巡',text:'造成 14 点伤害，施加 2 回合虚弱。',effect:{damage:14,weak:2},source:'生态观测'},
];
/** 重生之门（轮回玩法）卡牌：由 scripts/export-rebirth.mjs 从原始内容导出，保留原卡面文字与显式升级。 */
export const REBIRTH_CARDS = rebirthData.cards as unknown as Card[];
const allCards=[...cards,...inherited,...ecoCards,...REBIRTH_CARDS];
export const BASE_CARDS = Object.fromEntries(allCards.map(c => [c.id,structuredClone(c)])) as Record<string, Card>;
let overrides:CardOverrides={};
export const CARDS = Object.fromEntries(allCards.map(c => [c.id,c])) as Record<string, Card>;
export function setCardOverrides(next:CardOverrides) {
  overrides=structuredClone(next);
  for(const [id,card] of Object.entries(BASE_CARDS))CARDS[id]=applyBalance(card,overrides[id]);
}
export function registerEcoCards(individuals: EcoIndividual[] = []) {
  for(const id of Object.keys(CARDS))if(id.startsWith('eco-card-'))delete CARDS[id];
  for(const i of individuals)CARDS[i.id]=applyBalance(ecologyCard(i),overrides[i.id]);
}
export const pool = (hero: HeroId, unlocked: string[] = []) => Object.values(CARDS).filter(c => {
  if(c.id.startsWith('rebirth:'))return false;
  if(c.id.startsWith('eco-'))return unlocked.includes(c.id);
  if(c.id.startsWith('legacy-'))return !c.school || (c.school==='yuling'?c.element===HEROES[hero].element:HEROES[hero].abilitySystems.includes(c.school));
  return (c.owner===hero||c.owner==='all') && c.id!=='seal' && c.id!=='guard';
});
/** 轮回玩法的奖励与商店卡池：全部重生之门卡。 */
export const rebirthPool = () => Object.values(CARDS).filter(c => c.id.startsWith('rebirth:'));
/** 轮回玩法的主角：玩家自己的修行者（不是官方角色，不承受同行者伤势）。 */
export const SEEKER = { name: '修行者', hp: 72, relic: '魂灵印记', relicText: '轮回中的修行者，前世见闻化作今生的灵卡。' } as const;
/** 局内主角的显示名：同行者用官方角色名，轮回用修行者。 */
export const protagonistName = (hero: string) => hero === 'seeker' ? SEEKER.name : HEROES[hero as HeroId]?.name ?? hero;
export const NODE_NAMES: Record<import('./types').NodeKind, string> = {battle:'遭遇',elite:'精英',event:'奇遇',rest:'休憩',shop:'行商',boss:'守门者',space:'灵质空间',guardian:'区域守门者'};
