import { CARDS, HEROES, pool, rebirthPool, SEEKER } from './content';
import { decay, pickRoom, REBIRTH_SKILLS, REBIRTH_STARTERS, spawnEnemies, syncIntent } from './rebirth';
import { choicesFor, createShop, isRegionBossFloor, nodeTypeFor, pickEvent, pickSpace, roomKindFor } from './rebirthRooms';
import { BASE_PLAYER, BOSS_LOOT, battleGold, branchById, cardElementName, dailyFor, difficultyById, elementCardBonus, GUILDS, guildById, monsterVsPlayerBonus, passiveTotal, pickBossTreasure, playerVsMonsterBonus, resonanceCardBonus, resonanceMonsterBonus, scaleHp, weatherCardBonus, weatherForFloor, weatherMonsterBonus, type SeekerBonus } from './rebirthBonus';
import type { Action, AdventureRun, Battle, Card, WoundCarry, CardInstance, Enemy, HeroId, NodeKind, RebirthElement, RebirthStart, RunState, TimelineAnchor } from './types';
function random(s: RunState) { s.rng = (Math.imul(s.rng,1664525)+1013904223)>>>0; return s.rng/4294967296; }
function shuffle<T>(s: RunState, a: T[]) { for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function instance(s: RunState, card: string): CardInstance { return {uid:`c${s.nextId++}`,card,upgraded:false}; }
function note(s: RunState, text: string) { s.messages=[...s.messages.slice(-11),text]; }
function draw(s: RunState, count: number) { const b=s.battle!; for(let i=0;i<count && b.hand.length<10;i++){ if(!b.draw.length) b.draw=shuffle(s,b.discard.splice(0)); const c=b.draw.pop(); if(c)b.hand.push(c); } }
function offers(s: RunState) { const ids=s.mode==='rebirth'?rebirthPool().map(c=>c.id):pool(s.hero as HeroId,s.ecoCards).map(c=>c.id); return shuffle(s,ids).slice(0,3); }
/** 十层三路地图；末层守门者，第一层遭遇，第九层休憩。choices 决定中间各层的房间类型。 */
function buildMap(s: RunState, choices: NodeKind[]) {
  for(let f=0;f<10;f++)for(let l=0;l<3;l++){
    const kind: NodeKind = f===9?'boss':f===0?'battle':f===8?'rest':choices[Math.floor(random(s)*choices.length)];
    if(f===9 && l!==1)continue;
    s.nodes.push({id:`${f}-${l}`,floor:f,lane:l,kind});
  }
}
export function createRun(hero: HeroId, seed: number, sealed=false, ecoCards: string[] = [], wound?: WoundCarry): AdventureRun {
  const hp=wound?Math.max(1,Math.floor(HEROES[hero].hp/2)):HEROES[hero].hp;
  const s: AdventureRun={ecoCards:ecoCards.filter(id=>id.startsWith("eco-")&&CARDS[id]),version:1,seed:seed>>>0,rng:seed>>>0,hero,phase:'map',hp,maxHp:hp,gold:65,floor:-1,lane:1,nodes:[],visited:[],deck:[],relics:[HEROES[hero].relic],battle:null,offers:[],removed:false,log:[],messages:['穿过众生之门，新的旅途开始了。'],nextId:1};
  buildMap(s,['battle','battle','event','shop','rest','elite']);
  if(wound){
    // 重伤：原牌组与遗物保留，生命上限减半。
    s.deck=structuredClone(wound.deck);s.relics=[...wound.relics];
    s.nextId=Math.max(s.nextId,...s.deck.map(c=>Number(c.uid.slice(1))+1||0));
    s.messages=['带着旧伤再次启程，生命上限减半。'];
  } else {s.deck=HEROES[hero].starter.map(c=>instance(s,c)); if(sealed)s.deck.push(instance(s,'seal'));}
  return s;
}
export function availableNodes(s: RunState) { return s.nodes.filter(n=>n.floor===s.floor+1 && (s.floor<0 || n.kind==='boss' || Math.abs(n.lane-s.lane)<=1)); }
/** 精进后的定义：有显式升级（轮回卡）时以它为准。 */
export function upgradeOf(c: CardInstance) { return c.upgraded ? CARDS[c.card].upgrade : undefined; }
export function costOf(c: CardInstance) { return upgradeOf(c)?.cost ?? CARDS[c.card].cost; }
export function effectOf(c: CardInstance) { const up=upgradeOf(c); if(up)return {...up.effect}; const e={...CARDS[c.card].effect}; if(c.upgraded) { if(e.damage)e.damage+=3; if(e.block)e.block+=3; if(e.heal)e.heal+=2; if(e.summon)e.summon+=1; if(e.domain)e.domain+=1; if(e.strength)e.strength+=1; if(e.draw)e.draw+=1; if(e.energy)e.energy+=1; } return e; }
export function enemyDamage(e: Enemy) { const d=e.damage+(e.strength??0); return e.weak>0?Math.floor(d*.75):d; }
/** 敌人下一步意图的可读描述。 */
export function intentText(e: Enemy): string[] {
  const it=e.intents?.[e.next??0];
  if(!it)return [e.intent==='attack'?`攻击 ${enemyDamage(e)}`:'格挡 8'];
  const out:string[]=[];
  if(it.damage)out.push(`攻击 ${enemyDamage(e)}`);if(it.block)out.push(`格挡 ${it.block}`);if(it.weak)out.push(`虚弱 ${it.weak}`);if(it.vulnerable)out.push(`易伤 ${it.vulnerable}`);
  if(it.strength)out.push(`力量 +${it.strength}`);if(it.regen)out.push(`回灵 +${it.regen}`);if(it.heal)out.push(`回复 ${it.heal}`);
  return out.length?out:['观望'];
}
function hit(e: Enemy, damage: number) { damage=Math.floor(damage*((e.vulnerable??0)>0?1.5:1)); const n=Math.max(0,damage-e.block); e.block=Math.max(0,e.block-damage); e.hp=Math.max(0,e.hp-n); }
function victory(s: RunState) {
  if(!s.battle!.enemies.every(e=>e.hp<=0))return false;
  const kind=s.nodes.find(n=>n.id===s.visited.at(-1))!.kind;
  if(s.mode==='rebirth')rebirthSpoils(s,kind); else s.gold+=kind==='elite'?45:25;
  if(s.hero==='fengxi')s.hp=Math.min(s.maxHp,s.hp+4);
  if(kind==='elite' && s.mode!=='rebirth' && !s.relics.includes('青玉护符'))s.relics.push('青玉护符');
  s.phase=kind==='boss'?'victory':'reward'; s.offers=offers(s); note(s,kind==='boss'?(s.mode==='rebirth'?'守门者倒下了，重生之门为你敞开。':'试炼完成。带着这段记忆，回到会馆吧。'):'战斗胜利，选择一张牌继续旅程。'); return true;
}
function beginBattle(s: RunState, kind: NodeKind, fallback?: 'event'|'space') {
  if(s.mode==='rebirth'){
    const room=pickRoom(kind,s.floor,()=>random(s),fallback);const enemies=spawnEnemies(room.monsters,()=>random(s),hp=>scaleHp(hp,room.tier,s.rebirth?.difficulty));
    s.battle={turn:1,energy:3,block:0,strength:0,summon:0,domain:0,regen:0,weak:0,vulnerable:0,hand:[],draw:shuffle(s,structuredClone(s.deck)),discard:[],exhaust:[],enemies};
    s.phase='battle';draw(s,5);for(const e of enemies)if(e.quote)note(s,`${e.name}：“${e.quote}”`);note(s,'你的回合。先看敌方意图，再决定攻守。');return;
  }
  const boss=kind==='boss',elite=kind==='elite';
  const hp=boss?115:elite?52+s.floor*3:23+s.floor*3;
  const make=(id:string,name:string,h:number):Enemy=>({id,name,hp:h,maxHp:h,block:0,weak:0,poison:0,intent:'attack',damage:boss?15:elite?11:6+Math.floor(s.floor/2)});
  const enemies=[make('e1',boss?'界门守卫':elite?'古树灵卫':['迷途石灵','躁动木灵','山间游灵'][Math.floor(random(s)*3)],hp)];
  if(!boss&&!elite&&s.floor>=3)enemies.push(make('e2','随行灵体',18+s.floor));
  s.battle={turn:1,energy:3,block:s.relics.includes('青玉护符')?5:0,strength:s.hero==='wuxian'?1:0,summon:0,domain:0,hand:[],draw:shuffle(s,structuredClone(s.deck)),discard:[],exhaust:[],enemies};
  s.phase='battle'; draw(s,s.hero==='xiaohei'?6:5); note(s,'你的回合。先看敌方意图，再决定攻守。');
}
export function reduceRun<T extends RunState>(previous: T, action: Action, timeline?: TimelineAnchor): T {
  const s=structuredClone(previous); const b=s.battle;
  const require=(ok: unknown,message='当前不能进行这个操作。')=>{if(!ok)throw new Error(message);};
  if(action.type==='enter') {
    require(s.phase==='map'); const node=availableNodes(s).find(n=>n.id===action.node); require(node,'请选择与当前路径相连的节点。');
    s.floor=node!.floor;s.lane=node!.lane;s.visited.push(node!.id);s.removed=false;
    for(const ev of timeline?.events.filter(e=>e.floor===s.floor+1)??[]) {
      if(ev.effect==='heal')s.hp=Math.min(s.maxHp,s.hp+ev.amount);
      if(ev.effect==='gold')s.gold+=ev.amount;
      if(ev.effect==='growth'){s.maxHp+=ev.amount;s.hp+=ev.amount;}
      note(s,`时间线 · ${ev.title}`);
    }
    if(['battle','elite','boss','guardian'].includes(node!.kind))beginBattle(s,node!.kind);
    else if(s.mode==='rebirth')enterRebirthRoom(s,node!.kind);
    else {s.phase=node!.kind as 'rest'|'event'|'shop';s.battle=null;if(s.phase==='shop')s.offers=offers(s);}
  } else if(action.type==='play') {
    require(s.phase==='battle'&&b); const idx=b!.hand.findIndex(c=>c.uid===action.uid); require(idx>=0,'这张牌已经不在手中。');
    const c=b!.hand[idx], card=CARDS[c.card], cost=costOf(c); require(b!.energy>=cost,'灵力不足。');
    require(canPlayCard(s,c), '这张牌的出牌条件尚未满足。');
    const target=b!.enemies.find(e=>e.id===action.target && e.hp>0); const e=effectOf(c);
    const offensive=!!(e.damage||e.weak||e.poison||e.vulnerable||e.damageFromBlock||e.damageFromDebuffs||e.reduceAttack||e.loseHpFromWeak||e.loseHpFromVulnerable||e.reduceTargetRegen||e.reduceTargetStrength);
    require(!offensive||card.target==='all'||target,'请选择仍在场的敌人。');
    const targets=card.target==='all'?b!.enemies.filter(e=>e.hp>0):target?[target]:[];
    const lowHealth=s.hp<s.maxHp/2, hpPct=s.hp/s.maxHp*100;
    const rebirth=s.mode==='rebirth'?seekerBonus(s):null, atk=rebirth?cardBonus(s,rebirth,card,'atkBonus'):0;
    b!.energy-=cost; b!.hand.splice(idx,1);
    s.hp-=e.healthCost??0;
    for(const enemy of targets){
      const damage=(e.damage??0)+(e.damageFromBlock?b!.block:0)+(e.damageFromDebuffs?((enemy.weak??0)+(enemy.vulnerable??0))*e.damageFromDebuffs:0);
      if(rebirth){
        // 原重生之门：攻击牌（或有伤害的牌）= 基础伤害 + 被动加成 + 本命/天时/灵机共鸣 + 单体五行克制，再结算虚弱；按格挡值的伤害单独结算。
        if(card.type==='攻击'?e.damage!==undefined:(e.damage??0)>0){let dealt=(e.damage??0)+atk+(card.target!=='all'?playerVsMonsterBonus(rebirth.element,enemy.element):0)+b!.strength;if(b!.weak)dealt=Math.floor(dealt*.75);hit(enemy,dealt);}
        if(e.damageFromBlock)hit(enemy,b!.block);
      } else if(damage){let dealt=damage+b!.strength;if(b!.weak)dealt=Math.floor(dealt*.75);hit(enemy,dealt);}
      if(e.loseHpFromWeak)enemy.hp=Math.max(0,enemy.hp-(enemy.weak??0));
      if(e.loseHpFromVulnerable)enemy.hp=Math.max(0,enemy.hp-(enemy.vulnerable??0));
      if(e.clearTargetDebuffs){enemy.weak=0;enemy.vulnerable=0;}
      enemy.weak+=e.weak??0;enemy.poison+=e.poison??0;
      enemy.vulnerable=(enemy.vulnerable??0)+(e.vulnerable??0);
      enemy.damage=Math.max(0,enemy.damage-(e.reduceAttack??0));
      if(e.reduceTargetRegen)enemy.regen=Math.max(0,(enemy.regen??0)-e.reduceTargetRegen);
      if(e.reduceTargetStrength)enemy.strength=Math.max(0,(enemy.strength??0)-e.reduceTargetStrength);
    }
    b!.block+=(e.block??0)+(rebirth&&e.block?cardBonus(s,rebirth,card,'defBonus'):0);b!.energy+=e.energy??0;b!.strength+=e.strength??0;b!.summon+=e.summon??0;b!.domain+=e.domain??0;b!.regen=(b!.regen??0)+(e.regen??0);
    if(e.regenFromAllDamage)b!.regen=(b!.regen??0)+b!.enemies.filter(x=>x.hp>0).length*(e.damage??0);
    if(e.clearSelfDebuffs){b!.weak=0;b!.vulnerable=0;}
    if(e.selfDamage){let d=e.selfDamage;if(b!.vulnerable)d=Math.floor(d*1.5);const loss=Math.max(0,d-b!.block);b!.block=Math.max(0,b!.block-d);s.hp=Math.max(0,s.hp-loss);}
    s.hp=Math.min(s.maxHp,s.hp+(e.heal??0));
    const drawCount=(e.draw??0)+(lowHealth?(e.drawBelowHalf??0):0)+(e.drawBelow&&hpPct<(e.drawBelowPct??50)?e.drawBelow:0);
    if(drawCount)draw(s,drawCount); (card.exhaust?b!.exhaust:b!.discard).push(c);
    note(s,`${upgradeOf(c)?.name??card.name}${c.upgraded&&!upgradeOf(c)?' · 精进':''}${e.damage&&(target||card.target==='all')?` → ${card.target==='all'?'全体敌人':target!.name}`:''}`);
    if(s.hp<=0){s.phase='defeat';note(s,s.mode==='rebirth'?'魂灵散去，这一世的修行到此为止。':'旅途暂告一段落，回馆休整后再出发。');} else victory(s);
  } else if(action.type==='end') {
    require(s.phase==='battle'&&b);
    if(s.mode==='rebirth')rebirthEndTurn(s); else {
    const first=b!.enemies.find(e=>e.hp>0);if(first&&b!.summon)hit(first,b!.summon);
    for(const e of b!.enemies)if(e.hp>0&&e.poison){e.hp=Math.max(0,e.hp-e.poison);e.poison--;}
    if(!victory(s)) {
      for(const e of b!.enemies.filter(e=>e.hp>0)) {
        e.block=0;
        if(e.intent==='attack'){const d=enemyDamage(e);const loss=Math.max(0,d-b!.block);b!.block=Math.max(0,b!.block-d);s.hp=Math.max(0,s.hp-loss);note(s,`${e.name}攻击，你受到 ${loss} 点伤害。`);}
        else {e.block=8;note(s,`${e.name}获得 8 点格挡。`);}
        e.weak=Math.max(0,e.weak-1);e.vulnerable=Math.max(0,(e.vulnerable??0)-1);e.intent=b!.turn%3===1?'guard':'attack';
      }
      if(s.hp<=0){s.phase='defeat';note(s,'旅途暂告一段落，回馆休整后再出发。');}
      else {s.hp=Math.min(s.maxHp,s.hp+(b!.regen??0));b!.regen=Math.max(0,(b!.regen??0)-1);b!.discard.push(...b!.hand.splice(0)); b!.turn++;b!.energy=3;b!.block=b!.domain;draw(s,5);}
    }
    }
  } else if(action.type==='reward') {
    require(s.phase==='reward');require(action.card===null||s.offers.includes(action.card));if(action.card)s.deck.push(instance(s,action.card));s.phase='map';s.battle=null;s.offers=[];
  } else if(action.type==='rest') {
    require(s.phase==='rest');if(action.choice==='heal')s.hp=Math.min(s.maxHp,s.hp+(s.mode==='rebirth'?Math.floor(s.maxHp*.3):Math.ceil(s.maxHp*.3)));
    else if(action.choice==='remove'){require(s.mode==='rebirth','这里不能移除卡牌。');const i=s.deck.findIndex(c=>c.uid===action.uid);require(i>=0,'请选择要移除的卡牌。');s.deck.splice(i,1);}
    else {const c=s.deck.find(c=>c.uid===action.uid&&!c.upgraded);require(c,'请选择尚未精进的卡牌。');c!.upgraded=true;}
    s.phase='map';
  } else if(action.type==='event') {
    require(s.phase==='event');if(action.choice==='help'){require(s.hp>7,'生命不足，无法帮助灵体。');s.hp-=7;s.gold+=35;s.deck.push(instance(s,'tea'));}s.phase='map';
  } else if(action.type==='buy') {
    require(s.phase==='shop'&&s.offers.includes(action.card));require(s.gold>=45,'灵石不足。');s.gold-=45;s.deck.push(instance(s,action.card));s.offers=s.offers.filter(c=>c!==action.card);
  } else if(action.type==='remove') {
    require(s.phase==='shop'&&!s.removed&&s.gold>=35&&s.deck.length>5);const index=s.deck.findIndex(c=>c.uid===action.uid);require(index>=0);s.deck.splice(index,1);s.gold-=35;s.removed=true;
  } else if(action.type==='leave') {require(s.phase==='shop');s.phase='map';s.room=null;
  } else if(action.type==='buy-item') {require(s.mode==='rebirth');buyRoomItem(s,action.id);
  } else if(action.type==='choose') {require(s.mode==='rebirth'&&s.phase==='event');applyRoomChoice(s,action.side);}
  s.log.push({sequence:s.log.length+1,action:structuredClone(action)}); return s;
}
export function replay(hero: HeroId, seed: number, actions: Action[], timeline?: TimelineAnchor, sealed=false, ecoCards: string[] = []) { return actions.reduce((s,a)=>reduceRun(s,a,timeline),createRun(hero,seed,sealed,ecoCards)); }

export function canPlayCard(s: RunState,c: CardInstance): boolean {
  const card=CARDS[c.card]; const b=s.battle;
  if(s.phase!=='battle'||!b||!card||costOf(c)>b.energy)return false;
  const up=upgradeOf(c), condition=up?up.condition:card.condition, pct=up?up.conditionPct:card.conditionPct;
  if(condition==='belowPct' && !(s.hp/s.maxHp*100<(pct??50)))return false;
  if(s.hp <= (card.effect.healthCost??0))return false;
  if(condition==='belowHalf' && s.hp>=s.maxHp/2)return false;
  if(condition==='attacksOnly' && b.hand.some(x=>CARDS[x.card].type!=='攻击'))return false;
  return true;
}

/** 轮回（重生之门）开局：玩家自己的修行者，按本命五行领取原初始牌组。 */
export function createRebirthRun(start: RebirthStart | RebirthElement, seed: number): RunState {
  const opt: RebirthStart=typeof start==='string'?{element:start}:start, element=opt.element;
  const s: RunState={version:1,mode:'rebirth',rebirth:{element},seed:seed>>>0,rng:seed>>>0,hero:'seeker',phase:'map',hp:SEEKER.hp,maxHp:SEEKER.hp,gold:0,floor:-1,lane:1,nodes:[],visited:[],deck:[],relics:[],battle:null,offers:[],removed:false,log:[],messages:['推开重生之门，新的一世开始了。'],nextId:1};
  buildRebirthMap(s);
  // 原 createNewGame：出身分馆缺省随机（这里只在可见分馆中选）；天赋可以不选。
  const branch=branchById(opt.branch)?opt.branch!:null, guild=guildById(opt.guild)?opt.guild!:GUILDS[Math.floor(random(s)*GUILDS.length)].id;
  const difficulty=difficultyById(opt.difficulty).id, daily=opt.dailyKey?dailyFor(opt.dailyKey):null;
  const hp=BASE_PLAYER.maxHealth+difficultyById(difficulty).startingHealthBonus+(guildById(guild)?.passive.maxHealth??0)+(daily?.blessing.passive.maxHealth??0);
  s.hp=s.maxHp=hp;
  s.deck=rebirthDeck(element,branch).map(id=>instance(s,id));
  const b=branchById(branch), treasures=b?.starterTreasure?[b.starterTreasure]:[];
  s.rebirth={element,branch,guild,difficulty,dailyKey:opt.dailyKey??null,treasures};s.relics=[...treasures];
  return s;
}
/** 原重生之门地图：10 个房间层（y = 楼层 + 1）按原房型规则，第 5–9 层各有一间区域守门者，第 11 层是最终守门者。每层 3 路。 */
function buildRebirthMap(s: RunState) {
  for(let f=0;f<10;f++){
    const kinds=[0,1,2].map(()=>roomKindFor(nodeTypeFor(f,()=>random(s))));
    if(isRegionBossFloor(f))kinds[Math.floor(random(s)*3)]='guardian';
    kinds.forEach((kind,lane)=>s.nodes.push({id:`${f}-${lane}`,floor:f,lane,kind}));
  }
  s.nodes.push({id:'10-1',floor:10,lane:1,kind:'boss'});
}
/** 进入轮回的非战斗房间；事件房、灵质空间抽不到内容时退化为战斗。 */
function enterRebirthRoom(s: RunState, kind: NodeKind) {
  const r=s.rebirth!, y=s.floor+1, rand=()=>random(s);
  s.battle=null; s.room=null;
  if(kind==='rest'){s.phase='rest';return;}
  if(kind==='shop'){s.room={kind:'shop',shop:createShop(y,rand)};s.phase='shop';return;}
  const used=r.usedEvents??[], event=kind==='space'?pickSpace(y,used,rand):pickEvent(y,r.guild,used,rand);
  if(!event){beginBattle(s,'battle',kind==='space'?'space':'event');return;}
  r.usedEvents=[...used,event.id];s.room={kind:kind==='space'?'space':'event',event};s.phase='event';
}
/** 原 makeEventChoice / makeSpiritChoice 中已迁移的效果：生命、生命上限、得卡、法宝。 */
function applyRoomChoice(s: RunState, side: string) {
  const room=s.room; if(!room||room.kind==='shop')throw new Error('这里没有可以选择的事。');
  const choice=choicesFor(room.event,s.rebirth?.branch).find(c=>c.side===side); if(!choice)throw new Error('没有这个选项。');
  const e=choice.effects, r=s.rebirth!;
  if(e.health)s.hp=Math.max(0,Math.min(s.maxHp,s.hp+e.health));
  if(e.maxHealth){s.maxHp=Math.max(1,s.maxHp+e.maxHealth);s.hp=Math.max(0,Math.min(s.maxHp,s.hp+e.maxHealth));}
  if(e.addCard)s.deck.push(instance(s,e.addCard));
  if(e.treasure&&!(r.treasures??[]).includes(e.treasure)){r.treasures=[...(r.treasures??[]),e.treasure];s.relics=[...r.treasures];}
  note(s,`【${room.event.title}】${choice.text}`);
  s.room=null; s.phase=s.hp<=0?'defeat':'map';
}
/** 原 buyItem：灵石不足或已拥有该法宝时不能买；疗伤回复最大生命的 25%（向下取整）。 */
function buyRoomItem(s: RunState, id: string) {
  const room=s.room; if(s.phase!=='shop'||!room||room.kind!=='shop')throw new Error('这里不是商店。');
  const item=room.shop.items.find(i=>i.id===id); if(!item||item.sold)throw new Error('这件已经卖完了。');
  if(s.gold<item.price)throw new Error('灵石不足。');
  const r=s.rebirth!;
  if(item.kind==='card')s.deck.push(instance(s,item.card!));
  else if(item.kind==='treasure'){if((r.treasures??[]).includes(item.treasure!))throw new Error('已经有这件法宝了。');r.treasures=[...(r.treasures??[]),item.treasure!];s.relics=[...r.treasures];}
  else s.hp=Math.min(s.maxHp,s.hp+Math.floor(s.maxHp*(item.ratio??0.25)));
  s.gold-=item.price; item.sold=true; note(s,`买下「${item.name}」，花了 ${item.price} 灵石。`);
}
/** 原 addStarterDeck：本命初始牌组 + 天赋专属卡 + 御灵系的五行分支卡 + 双系合技卡（已在初始牌组里的不重复加）。 */
export function rebirthDeck(element: RebirthElement, branch?: string | null): string[] {
  const names=REBIRTH_STARTERS[element], deck=[...names], b=branchById(branch);
  if(b?.starterCard&&!names.includes(b.starterCard))deck.push(b.starterCard);
  const branchCard=b?.id==='yuling'?b.branchCards?.[element]:undefined;
  if(branchCard&&!names.includes(branchCard)&&!deck.includes(branchCard))deck.push(branchCard);
  if(b?.dualSkill&&!names.includes(b.dualSkill)&&!deck.includes(b.dualSkill))deck.push(b.dualSkill);
  return deck;
}
/** 局内修行者的加成来源，供界面显示。 */
export function seekerBonusOf(s: RunState): SeekerBonus | null { return s.mode==='rebirth'&&s.rebirth?seekerBonus(s):null; }
function seekerBonus(s: RunState): SeekerBonus { const r=s.rebirth!; return {element:r.element,branch:r.branch,guild:r.guild,daily:r.dailyKey?dailyFor(r.dailyKey):null,treasures:r.treasures??[]}; }
/** 原 playCard 的加成合计（不含单体五行克制）：被动 + 本命共鸣 + 天时 + 灵机共振。天时按原楼层 y = 共同引擎楼层 + 1。 */
function cardBonus(s: RunState, p: SeekerBonus, card: Card, key: 'atkBonus'|'defBonus') {
  const el=cardElementName(card.element), weather=weatherForFloor(s.floor+1), kind=key==='atkBonus'?{attack:true,block:false}:{attack:false,block:true};
  return passiveTotal(p,key)+elementCardBonus(el,p.element,kind)[key]+weatherCardBonus(weather,el,kind)[key]+resonanceCardBonus(weather,p.daily?.element.element,el,kind)[key];
}
/** 原 collectBattleReward：金币按房间档位与难度；守门者掉落专属法宝（已有则从稀有度 ≥4 的法宝里抽）。 */
function rebirthSpoils(s: RunState, kind: NodeKind) {
  const r=s.rebirth!, tier=kind==='boss'||kind==='guardian'?'boss':kind==='elite'?'elite':s.floor===0?'easy':'normal';
  const gold=battleGold(tier,Math.floor(random(s)*7),r.difficulty);s.gold+=gold;note(s,`战斗胜利：获得 ${gold} 灵石。`);
  if(kind==='boss'||kind==='guardian'){
    // 原实现：最终守门者从稀有度 ≥4 的法宝里抽，区域守门者 ≥3；有专属掉落且未拥有时优先专属。
    const owned=r.treasures??[], loot=BOSS_LOOT[s.battle!.enemies[0]?.name]; const id=loot&&!owned.includes(loot)?loot:pickBossTreasure(owned,kind==='boss'?4:3,()=>random(s));
    if(id){r.treasures=[...owned,id];s.relics=[...r.treasures];note(s,`守门者的战利品：法宝「${id}」。`);}
  }
}

/** 原重生之门的敌人行动：回灵→御灵技→半血第二形态→按意图序列行动；施加给玩家的减益多 1 层，抵消随后的衰减。 */
function rebirthEnemyTurn(s: RunState, e: Enemy) {
  const b=s.battle!; e.block=0; if(e.hp<1)return;
  if(e.regen)e.hp=Math.min(e.maxHp,e.hp+e.regen);
  const skill=e.skill?REBIRTH_SKILLS[e.skill]:undefined;
  if(skill){
    if(skill.playerWeak)b.weak=(b.weak??0)+skill.playerWeak+1;
    if(skill.playerVulnerable)b.vulnerable=(b.vulnerable??0)+skill.playerVulnerable+1;
    if(skill.selfBlock)e.block+=skill.selfBlock;
    if(skill.selfStrength)e.strength=(e.strength??0)+skill.selfStrength;
    if(skill.selfRegen)e.regen=(e.regen??0)+skill.selfRegen;
    if(skill.selfHeal)e.hp=Math.min(e.maxHp,e.hp+skill.selfHeal);
    note(s,`${e.name}发动【${e.skill}】`);
  }
  if(e.phase2&&!e.phase2Active&&e.hp<=e.maxHp*.5){e.phase2Active=true;e.intents=e.phase2;e.next=0;note(s,`${e.name}半血狂暴，进入第二形态！`);}
  const it=e.intents?.[e.next??0]; if(!it)return;
  e.next=(e.next??0)>=e.intents!.length-1?0:(e.next??0)+1;
  if(it.block)e.block+=it.block;
  if(it.strength)e.strength=(e.strength??0)+it.strength;
  if(it.regen)e.regen=(e.regen??0)+it.regen;
  if(it.heal)e.hp=Math.min(e.maxHp,e.hp+it.heal);
  if(it.damage){const p=seekerBonus(s),weather=weatherForFloor(s.floor+1);let d=it.damage+(e.strength??0)+monsterVsPlayerBonus(e.element,p.element)+weatherMonsterBonus(weather,e.element)+resonanceMonsterBonus(weather,p.daily?.element.element,e.element);if(e.weak)d=Math.floor(d*.75);if(b.vulnerable)d=Math.floor(d*1.5);const loss=Math.max(0,d-b.block);b.block=Math.max(0,b.block-d);s.hp-=loss;note(s,`${e.name}攻击，你受到 ${loss} 点伤害。`);}
  if(it.vulnerable)b.vulnerable=(b.vulnerable??0)+it.vulnerable+1;
  if(it.weak)b.weak=(b.weak??0)+it.weak+1;
}

/** 原重生之门的回合结束：弃手牌→回灵→敌人行动→双方状态衰减→抽 5 张、灵力回满、格挡清零。 */
function rebirthEndTurn(s: RunState) {
  const b=s.battle!;
  b.discard.push(...b.hand.splice(0));
  if(b.regen)s.hp=Math.min(s.maxHp,s.hp+b.regen);
  const hpRegen=passiveTotal(seekerBonus(s),'hpRegen');if(hpRegen>0)s.hp=Math.min(s.maxHp,s.hp+hpRegen);
  for(const e of b.enemies)rebirthEnemyTurn(s,e);
  if(s.hp<=0){s.hp=0;s.phase='defeat';note(s,'魂灵散去，这一世的修行到此为止。');return;}
  b.regen=decay(b.regen??0,'half');b.strength=decay(b.strength,'half');b.weak=decay(b.weak??0,'debuff');b.vulnerable=decay(b.vulnerable??0,'debuff');
  for(const e of b.enemies){e.weak=decay(e.weak,'debuff',e.resistance,e.potency);e.vulnerable=decay(e.vulnerable??0,'debuff',e.resistance,e.potency);e.strength=decay(e.strength??0,'half',e.resistance,e.potency);e.regen=decay(e.regen??0,'half',e.resistance,e.potency);syncIntent(e);}
  if(victory(s))return;
  b.turn++;b.energy=3;b.block=0;draw(s,5);
}
