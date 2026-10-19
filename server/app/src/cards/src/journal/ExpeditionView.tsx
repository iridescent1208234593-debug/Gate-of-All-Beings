/**
 * 卡牌玩法的局内画面（入世历练出行与重生之门共用），沿用入世历练原有的界面与样式。
 * 只读写 RunState；结束时由手记把结果写回世界，不单独弹胜负页。
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Crown, Flame, Gem, Heart, Moon, Orbit, Shield, ShoppingBag, Sparkles, Sprout, Swords, Undo2, X } from 'lucide-react';
import { CARDS, NODE_NAMES, protagonistName } from '../game/core/content';
import { availableNodes, canPlayCard, effectOf, intentText, seekerBonusOf } from '../game/core/engine';
import { branchById, difficultyById, guildById, passiveTotal, weatherForFloor } from '../game/core/rebirthBonus';
import { regionName } from '../game/core/rebirth';
import { choicesFor, effectsText } from '../game/core/rebirthRooms';
import { formatPassive, TREASURES } from '../game/core/rebirthBonus';
import type { Action, NodeKind, RunState } from '../game/core/types';
import { CardTile, Portrait } from '../game/CardTile';
import { Forest } from '../game/Forest';
import type { ActivitySession } from '../world/types';
import { HandCard, type DropTarget } from './HandCard';

const nodeIcons = { battle: Swords, elite: Flame, event: Sparkles, rest: Moon, shop: ShoppingBag, boss: Gem, space: Orbit, guardian: Crown } as const;

/** 这张牌是否需要指定单个敌人（与引擎的 offensive 判断一致）。 */
function needsTarget(run: RunState, uid: string) {
  const c = run.battle?.hand.find(x => x.uid === uid);
  if (!c || CARDS[c.card].target === 'all' || CARDS[c.card].target === 'self') return false;
  const e = effectOf(c);
  return !!(e.damage || e.weak || e.poison || e.vulnerable || e.damageFromBlock || e.damageFromDebuffs || e.reduceAttack || e.loseHpFromWeak || e.loseHpFromVulnerable || e.reduceTargetRegen || e.reduceTargetStrength);
}

export function ExpeditionView({ session, busy, onAction, onReturn, onError }: { session: ActivitySession<RunState, unknown>; busy: boolean; onAction: (a: Action) => void; onReturn: () => void; onError: (m: string) => void }) {
  const run = session.state, b = run.battle, rebirth = run.mode === 'rebirth';
  const name = protagonistName(run.hero);
  const [target, setTarget] = useState('e1');
  const [hover, setHover] = useState<DropTarget | null>(null);
  const [modal, setModal] = useState<'deck' | 'return' | null>(null);
  const selectedTarget = b?.enemies.find(e => e.id === target && e.hp > 0)?.id ?? b?.enemies.find(e => e.hp > 0)?.id ?? '';
  const send = (a: Action) => { if (!busy) onAction(a); };
  const seeker = seekerBonusOf(run), weather = weatherForFloor(run.floor + 1), resonance = !!seeker?.daily && seeker.daily.element.element === weather;
  const bonusLine = seeker ? [`本命${seeker.element}`, passiveTotal(seeker, 'atkBonus') && `攻击 +${passiveTotal(seeker, 'atkBonus')}`, passiveTotal(seeker, 'defBonus') && `格挡 +${passiveTotal(seeker, 'defBonus')}`, passiveTotal(seeker, 'hpRegen') && `每回合回复 ${passiveTotal(seeker, 'hpRegen')}`].filter(Boolean).join(' · ') + `；同系牌 +2、相生 +1，${weather}系牌顺应天时 +1${resonance ? '，灵机共振再 +1' : ''}。` : '';
  const floors = Math.max(...run.nodes.map(n => n.floor)) + 1;
  const room = run.room;
  const place = rebirth ? `重生之门 · 第 ${Math.max(1, run.floor + 1)} / ${floors} 层${regionName(Math.max(0, run.floor)) ? ' · ' + regionName(Math.max(0, run.floor)) : ''}` : `林间小径 · 第 ${Math.max(1, run.floor + 1)} / 10 层`;

  /** 拖拽出牌：敌人身上直接打向它；拖到战场上，不需要目标的牌直接打出，需要目标但只剩一个敌人时打向它。 */
  function drop(uid: string, at: DropTarget | null) {
    if (!at || !b) return;
    const alive = b.enemies.filter(e => e.hp > 0);
    if (at.kind === 'enemy') { setTarget(at.id); send({ type: 'play', uid, target: at.id }); return; }
    if (!needsTarget(run, uid)) send({ type: 'play', uid, target: selectedTarget });
    else if (alive.length === 1) send({ type: 'play', uid, target: alive[0].id });
    else onError('把这张牌拖到一个敌人身上。');
  }

  return <>
    <div className="run-toolbar"><div><Portrait name={name} /><div><strong>{name}{rebirth && run.rebirth && <small className="journal-tag">本命{run.rebirth.element}</small>}</strong><small>{place}</small></div></div>
      <span className="health"><Heart size={16} />{run.hp} / {run.maxHp}</span><span><Gem size={16} />{run.gold} 灵石</span>
      <button onClick={() => setModal('deck')}><BookOpen size={16} />牌组 {run.deck.length}</button>
      {run.phase === 'map' && run.floor >= 0 && <button onClick={() => setModal('return')}><Undo2 size={16} />{rebirth ? '离开' : '折返'}</button>}
    </div>

    {run.phase === 'map' && <section className="map-layout"><aside>{rebirth
      ? <><span className="eyebrow">REBIRTH GATE</span><h1>重生之门</h1><p>本命{run.rebirth?.element}行的修行者，<br />一层层走向门后的新一世。<br />选择下一处亮起的节点。</p>
        <small className="subtle">{[branchById(run.rebirth?.branch)?.name ?? '未选天赋', guildById(run.rebirth?.guild)?.name, difficultyById(run.rebirth?.difficulty).name.split(' · ')[0], seeker?.daily && `今日灵机 · ${seeker.daily.element.name}`].filter(Boolean).join(' · ')}</small></>
      : <><span className="eyebrow">TODAY'S PATH</span><h1>林间小径</h1><p>山风穿过枝叶，<br />远处传来若有若无的铃声。<br />选择下一处亮起的节点。</p></>}
      <div className="map-legend">{Object.entries(NODE_NAMES).filter(([k]) => rebirth || (k !== 'space' && k !== 'guardian')).map(([k, v]) => { const Icon = nodeIcons[k as NodeKind]; return <span key={k}><Icon size={16} />{v}</span>; })}</div>
      {run.relics.length > 0 && <div className="relic-list"><small>随身灵物</small>{run.relics.map(r => <span key={r}><Gem size={14} />{r}</span>)}</div>}
      <small className="subtle">{rebirth ? '第 5–9 层各有一位区域守门者，击败第 11 层的守门者推开重生之门。' : '走到守门者就算走通。'}<br />两段路之间可以随时{rebirth ? '离开' : '折返'}，回会馆写进手记。</small></aside>
      <div className="route-scroll"><div className="route-map"><svg viewBox={`0 0 400 ${floors * 100}`} preserveAspectRatio="none" aria-hidden="true">{run.nodes.filter(n => n.floor < floors - 1).flatMap(n => run.nodes.filter(m => m.floor === n.floor + 1 && (m.kind === 'boss' || Math.abs(m.lane - n.lane) <= 1)).map(m => <line key={n.id + m.id} x1={65 + n.lane * 135} y1={50 + n.floor * 100} x2={65 + m.lane * 135} y2={50 + m.floor * 100} className={run.visited.includes(n.id) && run.visited.includes(m.id) ? 'walked' : ''} />))}</svg>
        {run.nodes.map(n => { const Icon = nodeIcons[n.kind]; const enabled = availableNodes(run).some(a => a.id === n.id); return <button key={n.id} style={{ left: `${(65 + n.lane * 135) / 4}%`, top: `${(50 + n.floor * 100) / floors}%` }} disabled={!enabled || busy} className={`map-node ${enabled ? 'available' : ''} ${run.visited.includes(n.id) ? 'visited' : ''} ${n.kind === 'boss' || n.kind === 'guardian' ? 'boss' : ''}`} onClick={() => { send({ type: 'enter', node: n.id }); setTarget('e1'); }} aria-label={`第${n.floor + 1}层 ${NODE_NAMES[n.kind]} 路线${n.lane + 1}`}><Icon size={22} /><span>{n.floor + 1} · {NODE_NAMES[n.kind]}</span></button>; })}</div></div>
    </section>}

    {run.phase === 'battle' && b && <section className="battle-screen"><div className="battle-heading"><span className="eyebrow">{rebirth ? `${regionName(run.floor) ?? '重生之门 · 试炼'} · 天时${weather}${resonance ? ' · 灵机共振' : ''}` : '林间试炼'}</span><span>第 {b.turn} 回合 · 你的行动</span></div>
      <div className={`battle-stage ${hover?.kind === 'stage' ? 'drop-ready' : ''}`} data-drop-stage><Forest />
        <div className="player-unit"><Portrait name={name} /><strong>{name}</strong><div className="hp-bar"><i style={{ width: `${run.hp / run.maxHp * 100}%` }} /></div><span>{run.hp} / {run.maxHp}　<Shield size={14} />{b.block}</span>
          <small>{[b.strength > 0 && `力量 ${b.strength}`, b.summon > 0 && `木灵 ${b.summon}`, b.domain > 0 && `领域 ${b.domain}`, (b.regen ?? 0) > 0 && `回灵 ${b.regen}`, (b.weak ?? 0) > 0 && `虚弱 ${b.weak}`, (b.vulnerable ?? 0) > 0 && `易伤 ${b.vulnerable}`].filter(Boolean).join(' ')}</small></div>
        <div className="enemies">{b.enemies.filter(e => e.hp > 0).map(e => <button key={e.id} data-drop-enemy={e.id} className={`enemy-unit ${selectedTarget === e.id || (hover?.kind === 'enemy' && hover.id === e.id) ? 'targeted' : ''}`} onClick={() => setTarget(e.id)} aria-label={`选中${e.name}，生命 ${e.hp}/${e.maxHp}，下一步：${intentText(e).join('、')}`} aria-pressed={selectedTarget === e.id}>
          <span className="intent">{e.intent === 'attack' ? <Swords size={16} /> : <Shield size={16} />} {intentText(e).join(' · ')}</span>
          <div className="spirit-enemy"><i /><i /><span>{e.element ?? '灵'}</span></div><strong>{e.name}</strong>{e.skill && <small className="journal-skill">【{e.skill}】</small>}
          <div className="hp-bar enemy-hp"><i style={{ width: `${e.hp / e.maxHp * 100}%` }} /></div><span>{e.hp} / {e.maxHp}{e.block > 0 && ` · 格挡 ${e.block}`}</span>
          <small>{[e.weak > 0 && `虚弱 ${e.weak}`, (e.vulnerable ?? 0) > 0 && `易伤 ${e.vulnerable}`, e.poison > 0 && `侵蚀 ${e.poison}`, (e.strength ?? 0) > 0 && `力量 ${e.strength}`, (e.regen ?? 0) > 0 && `回灵 ${e.regen}`].filter(Boolean).join(' ')}</small></button>)}</div></div>
      <div className="turn-controls"><div className="energy"><b>{b.energy}</b><span>灵力<small>每回合恢复至 3</small></span></div><span className="battle-tip">{rebirth ? bonusLine : '点击出牌打向选中的敌人，也可以把牌拖到敌人身上。格挡在你的下回合开始时清空。'}</span><button className="primary" disabled={busy} onClick={() => send({ type: 'end' })}>结束回合 <ArrowRight size={17} /></button></div>
      <div className="hand">{b.hand.map(c => <HandCard key={c.uid} card={c} disabled={!canPlayCard(run, c) || busy} onHover={setHover}
        onClick={() => send({ type: 'play', uid: c.uid, target: selectedTarget })} onDrop={at => drop(c.uid, at)} />)}</div>
      <div className="pile-row"><span>抽牌堆 {b.draw.length}</span><span>弃牌堆 {b.discard.length}</span><span>消耗堆 {b.exhaust.length}</span></div>
      <div className="combat-log" aria-live="polite">{run.messages.slice(-3).map((m, i) => <span key={i}>{m}</span>)}</div>
    </section>}

    {run.phase === 'reward' && <section className="encounter"><span className="round-emblem"><Sparkles /></span><span className="eyebrow">一场小小的胜利</span><h1>把这份领悟带上</h1><p>选择一张灵卡加入牌组，也可以保持精简，继续前行。</p>
      <div className="offer-cards">{run.offers.map(id => <CardTile key={id} card={{ uid: id, card: id, upgraded: false }} label="收入牌组" onClick={() => send({ type: 'reward', card: id })} />)}</div>
      <button className="text-button" onClick={() => send({ type: 'reward', card: null })}>不取新牌，继续旅途 <ArrowRight size={16} /></button></section>}
    {run.phase === 'rest' && <section className="encounter"><span className="round-emblem"><Moon /></span><h1>听一会儿山风</h1><p>歇脚恢复 {rebirth ? Math.floor(run.maxHp * .3) : Math.ceil(run.maxHp * .3)} 点生命，或选一张牌精进{rebirth ? '、移除' : ''}。只能选一样。</p>
      <button className="primary" onClick={() => send({ type: 'rest', choice: 'heal' })}><Heart size={18} />在树荫下休息</button>
      <div className="offer-cards compact">{run.deck.filter(c => !c.upgraded).map(c => <CardTile small key={c.uid} card={c} label="精进此牌" onClick={() => send({ type: 'rest', choice: 'upgrade', uid: c.uid })} />)}</div>
      {rebirth && <details><summary>移除一张卡牌</summary><div className="offer-cards compact">{run.deck.map(c => <CardTile small key={c.uid} card={c} label="移除此牌" onClick={() => send({ type: 'rest', choice: 'remove', uid: c.uid })} />)}</div></details>}</section>}
    {run.phase === 'event' && room && room.kind !== 'shop' && <section className="encounter event-scene"><span className="round-emblem">{room.kind === 'space' ? <Orbit /> : <Sprout />}</span>
      <span className="eyebrow">{room.kind === 'space' ? `灵质空间${room.event.theme ? ' · ' + room.event.theme : ''}` : ({ echo: '纪年回响', guild: '会馆支援', memory: '角色回忆', relation: '因缘', lxz: '蓝溪镇', worldview: '世界观' } as Record<string, string>)[room.event.source] ?? '奇遇'}</span>
      <h1>{room.event.title}</h1>{room.event.owner && <small className="subtle">{room.event.owner}的灵质空间</small>}<blockquote>{room.event.description}</blockquote>
      {choicesFor(room.event, run.rebirth?.branch).map(c => <button key={c.side} className="choice" disabled={busy || (c.effects.health ?? 0) + run.hp <= 0} onClick={() => send({ type: 'choose', side: c.side })}><strong>{c.text}{c.branch ? ' · 天赋' : ''}</strong><span>{effectsText(c.effects)}</span><ArrowRight size={17} /></button>)}</section>}
    {run.phase === 'event' && !room && <section className="encounter event-scene"><span className="round-emblem"><Sprout /></span><span className="eyebrow">林间奇遇</span><h1>迷路的小灵体</h1><blockquote>“你也要去会馆吗？”<br />树根旁的小小身影，怯生生地看着你。</blockquote><p>分出一点灵力，送它穿过林间。它会把珍藏的灵石和清茶送给你。</p>
      <button className="choice" disabled={run.hp <= 7} onClick={() => send({ type: 'event', choice: 'help' })}><strong>送它一程</strong><span>失去 7 生命 · 获得 35 灵石和「一盏清茶」</span><ArrowRight size={17} /></button>
      <button className="choice" onClick={() => send({ type: 'event', choice: 'leave' })}><strong>指明方向，继续赶路</strong><span>不损失任何资源</span><ArrowRight size={17} /></button></section>}
    {run.phase === 'shop' && room?.kind === 'shop' && <section className="encounter"><span className="round-emblem"><ShoppingBag /></span><span className="eyebrow">{room.shop.theme.owner}</span><h1>{room.shop.theme.name}</h1><p>{room.shop.theme.desc}</p>
      <div className="offer-cards">{room.shop.items.filter(i => i.kind === 'card').map(i => <CardTile key={i.id} card={{ uid: i.id, card: i.card!, upgraded: false }} label={i.sold ? '已买下' : `${i.price} 灵石 · 购入`} disabled={busy || !!i.sold || run.gold < i.price} onClick={() => send({ type: 'buy-item', id: i.id })} />)}</div>
      <div className="journal-shop-goods">{room.shop.items.filter(i => i.kind !== 'card').map(i => <button key={i.id} className="choice" disabled={busy || !!i.sold || run.gold < i.price || (i.kind === 'treasure' && (run.rebirth?.treasures ?? []).includes(i.treasure!))} onClick={() => send({ type: 'buy-item', id: i.id })}>
        <strong>{i.kind === 'treasure' ? `法宝 · ${i.name}` : i.name}</strong><span>{i.kind === 'treasure' ? formatPassive(TREASURES[i.treasure!].passive) : i.desc}{i.sold ? ' · 已买下' : ` · ${i.price} 灵石`}</span><ArrowRight size={17} /></button>)}</div>
      <button className="primary" onClick={() => send({ type: 'leave' })}>告别 <ArrowRight size={17} /></button></section>}
    {run.phase === 'shop' && !room && <section className="encounter"><span className="round-emblem"><ShoppingBag /></span><h1>{rebirth ? '会馆补给站' : '山间行商'}</h1><p>挑一份心仪的灵术，或放下不再需要的那一张牌。</p>
      <div className="offer-cards">{run.offers.map(id => <CardTile key={id} card={{ uid: id, card: id, upgraded: false }} label="45 灵石 · 购入" disabled={run.gold < 45} onClick={() => send({ type: 'buy', card: id })} />)}</div>
      <details><summary>忘却一张牌 · 35 灵石（每次来访限一次）</summary><div className="offer-cards compact">{run.deck.map(c => <CardTile small key={c.uid} card={c} disabled={run.removed || run.gold < 35 || run.deck.length <= 5} label="忘却此牌" onClick={() => send({ type: 'remove', uid: c.uid })} />)}</div></details>
      <button className="primary" onClick={() => send({ type: 'leave' })}>告别 <ArrowRight size={17} /></button></section>}

    {modal === 'deck' && <Modal title={`${rebirth ? '这一世的牌组' : '旅途牌组'} · ${run.deck.length} 张`} onClose={() => setModal(null)}><div className="collection-grid">{run.deck.map(c => <CardTile key={c.uid} card={c} small />)}</div>{run.relics.length > 0 && <p className="subtle">{run.relics.join(' · ')}</p>}</Modal>}
    {modal === 'return' && <Modal title={rebirth ? '现在离开重生之门？' : '现在折返？'} onClose={() => setModal(null)}><p>{rebirth ? '这一世见到的灵卡会记进手记，不带回奖励。今天就这样过去了。' : '这一趟见到的灵卡会记进手记，默契 +1；不会受伤，也没有走通的奖励。今天就这样过去了。'}</p>
      <div className="hero-actions"><button className="secondary" onClick={() => setModal(null)}>继续走</button><button className="primary" disabled={busy} onClick={() => { setModal(null); onReturn(); }}>回会馆 <ArrowRight size={17} /></button></div></Modal>}
  </>;
}

/** 与 GameApp 相同结构和样式的对话框。 */
export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={ref} className="game-modal" onCancel={onClose}><div className="modal-head"><h2>{title}</h2><button aria-label="关闭" onClick={onClose}><X size={20} /></button></div>{children}</dialog>;
}
