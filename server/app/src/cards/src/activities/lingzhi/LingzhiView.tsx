/**
 * 灵质修行的开局与局内画面。沿用众生牌录 / 入世历练已有的版式与样式类（run-toolbar、map-layout、battle-screen、encounter、spirit-card），
 * 不引入新视觉；只读写 LingzhiRun，结束时由众生牌录把结果写回世界。
 */
import { useState } from 'react';
import { ArrowRight, BookOpen, Flame, Gem, Heart, Moon, Orbit, Shield, Sparkles, Sprout, Swords, Undo2 } from 'lucide-react';
import { Forest } from '../../game/Forest';
import { Portrait } from '../../game/CardTile';
import { Modal } from '../../journal/ExpeditionView';
import { availableNodes, canPlay, LINGZHI, LINGZHI_CARDS, LINGZHI_CHARACTERS, lingzhiFloors, lingzhiIntentText, OPEN_CHARACTERS } from './engine';
import { LINGZHI_REWARD, type LingzhiSession } from './adapter';
import type { LingzhiAction, LingzhiLoadout, LingzhiNodeKind } from './types';

const NODE_NAMES: Record<LingzhiNodeKind, string> = { start: '起点', battle: '试炼', elite: '精英', rest: '休整', event: '事件', space: '灵质空间', boss: '守门者' };
const nodeIcons = { start: Sparkles, battle: Swords, elite: Flame, rest: Moon, event: Sprout, space: Orbit, boss: Gem } as const;

/** 灵术卡面：与 CardTile 相同的结构与样式类，数据来自灵质修行卡池。 */
export function LingzhiCardTile({ card, onClick, disabled = false, label, small = false }: { card: string; onClick?: () => void; disabled?: boolean; label?: string; small?: boolean }) {
  const c = LINGZHI_CARDS[card];
  return <button className={`spirit-card ${small ? 'small' : ''} card-all`} onClick={onClick} disabled={disabled} aria-label={label ?? `${c.name}，${c.desc}`}>
    <span className="card-top"><b>{c.energy}</b><span>{c.type === 'attack' ? '攻击' : c.type === 'skill' ? '技能' : c.type}{c.tags?.length ? ' · ' + c.tags.join(' ') : ''}</span></span>
    <div className="card-art"><span>{c.name.slice(0, 1)}</span><i /><i /></div><strong>{c.name}</strong><p>{c.desc}</p>
    <span className="card-foot">{c.exhaust ? '消耗 · 本场仅用一次' : '灵质修行'}</span>{label && <em>{label}</em>}</button>;
}

export function LingzhiSetup({ busy, onCancel, onStart }: { busy: boolean; onCancel: () => void; onStart: (l: LingzhiLoadout) => void }) {
  const [character, setCharacter] = useState(OPEN_CHARACTERS[0]);
  return <section className="encounter"><span className="round-emblem"><Orbit /></span><span className="eyebrow">灵质修行</span><h1>步入灵质回路</h1>
    <p>七层回路，层层试炼，击败第七层的守门者即算贯通。<br />贯通带回灵质 {LINGZHI_REWARD.victory.spirit}；散灵带回灵质 {LINGZHI_REWARD.defeat.spirit}。占用今天的白天。</p>
    {LINGZHI.characters.map(c => { const open = OPEN_CHARACTERS.includes(c.id); return <button key={c.id} className="choice" disabled={!open || busy} aria-pressed={character === c.id} onClick={() => setCharacter(c.id)}>
      <strong>{c.name}{character === c.id ? ' · 已选' : ''}</strong><span>{open ? `${c.passive.name}：${c.passive.desc}` : '尚未开放'}</span><ArrowRight size={17} /></button>; })}
    <div className="hero-actions"><button className="secondary" disabled={busy} onClick={onCancel}>回众生牌录</button><button className="primary" disabled={busy} onClick={() => onStart({ character })}>进入灵质回路 <ArrowRight size={17} /></button></div></section>;
}

export function LingzhiView({ session, busy, onAction, onReturn }: { session: LingzhiSession; busy: boolean; onAction: (a: LingzhiAction) => void; onReturn: () => void }) {
  const run = session.state, b = run.battle, who = LINGZHI_CHARACTERS[run.character];
  const [target, setTarget] = useState('enemy0');
  const [modal, setModal] = useState<'deck' | 'return' | null>(null);
  const floors = lingzhiFloors();
  const selected = b && b.monsters[Number(target.replace('enemy', ''))]?.hp > 0 ? target : b ? `enemy${Math.max(0, b.monsters.findIndex(m => m.hp > 0))}` : target;
  const send = (a: LingzhiAction) => { if (!busy) onAction(a); };
  const open = new Set(availableNodes(run).map(n => n.id));

  return <>
    <div className="run-toolbar"><div><Portrait name={who.name} /><div><strong>{who.name}<small className="journal-tag">灵质修行</small></strong><small>灵质回路 · 第 {Math.max(1, run.floor)} / {floors - 1} 层</small></div></div>
      <span className="health"><Heart size={16} />{run.hp} / {run.maxHp}</span>
      <button onClick={() => setModal('deck')}><BookOpen size={16} />牌组 {run.deck.length}</button>
      {run.phase === 'map' && <button onClick={() => setModal('return')}><Undo2 size={16} />离开</button>}
    </div>

    {run.phase === 'map' && <section className="map-layout"><aside><span className="eyebrow">SPIRIT CIRCUIT</span><h1>灵质回路</h1><p>{who.passive.name}：{who.passive.desc}<br />选择下一处亮起的节点。</p>
      <div className="map-legend">{(['battle', 'elite', 'rest', 'event', 'space', 'boss'] as const).map(k => { const Icon = nodeIcons[k]; return <span key={k}><Icon size={16} />{NODE_NAMES[k]}</span>; })}</div>
      <small className="subtle">每一层都可以走到下一层任一节点。事件与灵质空间这一版只停留、不结算。<br />两段路之间可以随时离开，回会馆写进众生牌录。</small></aside>
      <div className="route-scroll"><div className="route-map"><svg viewBox={`0 0 400 ${floors * 100}`} preserveAspectRatio="none" aria-hidden="true">{run.nodes.filter(n => n.floor < floors - 1).flatMap(n => run.nodes.filter(m => m.floor === n.floor + 1).map(m => <line key={n.id + m.id} x1={65 + n.lane * 135} y1={50 + n.floor * 100} x2={65 + m.lane * 135} y2={50 + m.floor * 100} className={run.visited.includes(n.id) && run.visited.includes(m.id) ? 'walked' : ''} />))}</svg>
        {run.nodes.map(n => { const Icon = nodeIcons[n.kind]; const enabled = open.has(n.id); return <button key={n.id} style={{ left: `${(65 + n.lane * 135) / 4}%`, top: `${(50 + n.floor * 100) / floors}%` }} disabled={!enabled || busy} className={`map-node ${enabled ? 'available' : ''} ${run.visited.includes(n.id) ? 'visited' : ''} ${n.kind === 'boss' ? 'boss' : ''}`} onClick={() => { send({ type: 'enter', node: n.id }); setTarget('enemy0'); }} aria-label={`第${n.floor}层 ${NODE_NAMES[n.kind]} 路线${n.lane + 1}`}><Icon size={22} /><span>{n.floor} · {NODE_NAMES[n.kind]}</span></button>; })}</div></div>
    </section>}

    {run.phase === 'battle' && b && <section className="battle-screen"><div className="battle-heading"><span className="eyebrow">灵质回路 · 第 {run.floor} 层</span><span>第 {b.turn} 回合 · 你的行动</span></div>
      <div className="battle-stage"><Forest />
        <div className="player-unit"><Portrait name={who.name} /><strong>{who.name}</strong><div className="hp-bar"><i style={{ width: `${run.hp / run.maxHp * 100}%` }} /></div><span>{run.hp} / {run.maxHp}　<Shield size={14} />{b.block}</span>
          <small>{[b.powers.strength && `力量 ${b.powers.strength}`, b.powers.regen && `回灵 ${b.powers.regen}`, b.powers.weak && `虚弱 ${b.powers.weak}`, b.powers.vulnerable && `易伤 ${b.powers.vulnerable}`].filter(Boolean).join(' ')}</small></div>
        <div className="enemies">{b.monsters.map(m => m.hp > 0 && <button key={m.id} className={`enemy-unit ${selected === m.id ? 'targeted' : ''}`} onClick={() => setTarget(m.id)} aria-label={`选中${m.name}，生命 ${m.hp}/${m.maxHp}，下一步：${lingzhiIntentText(m).join('、')}`} aria-pressed={selected === m.id}>
          <span className="intent">{m.intents[m.nextIntent]?.damage ? <Swords size={16} /> : <Shield size={16} />} {lingzhiIntentText(m).join(' · ')}</span>
          <div className="spirit-enemy"><i /><i /><span>{m.element === '通用' ? '灵' : m.element}</span></div><strong>{m.name}</strong>{m.bossPhase === 2 && <small className="journal-skill">【觉醒】</small>}
          <div className="hp-bar enemy-hp"><i style={{ width: `${m.hp / m.maxHp * 100}%` }} /></div><span>{m.hp} / {m.maxHp}{m.block > 0 && ` · 格挡 ${m.block}`}</span>
          <small>{[m.powers.weak && `虚弱 ${m.powers.weak}`, m.powers.vulnerable && `易伤 ${m.powers.vulnerable}`, m.powers.strength && `力量 ${m.powers.strength}`].filter(Boolean).join(' ')}</small></button>)}</div></div>
      <div className="turn-controls"><div className="energy"><b>{b.energy}</b><span>灵力<small>每回合恢复至 3</small></span></div><span className="battle-tip">点击敌人选中目标，再点击手牌打出。格挡在你的下回合开始时清空。</span><button className="primary" disabled={busy} onClick={() => send({ type: 'end' })}>结束回合 <ArrowRight size={17} /></button></div>
      <div className="hand">{b.hand.map(c => <div key={c.uid} className="hand-card"><LingzhiCardTile card={c.card} disabled={!canPlay(run, c) || busy} onClick={() => send({ type: 'play', uid: c.uid, target: selected })} /></div>)}</div>
      <div className="pile-row"><span>抽牌堆 {b.draw.length}</span><span>弃牌堆 {b.discard.length}</span><span>消耗堆 {b.exhaust.length}</span></div>
      <div className="combat-log" aria-live="polite">{run.messages.slice(-3).map((m, i) => <span key={i}>{m}</span>)}</div>
    </section>}

    {run.phase === 'reward' && <section className="encounter"><span className="round-emblem"><Sparkles /></span><span className="eyebrow">试炼通过</span><h1>把这份领悟带上</h1><p>选择一张灵术加入牌组，也可以保持精简，继续前行。</p>
      <div className="offer-cards">{run.offers.map(id => <LingzhiCardTile key={id} card={id} label="收入牌组" onClick={() => send({ type: 'reward', card: id })} />)}</div>
      <button className="text-button" onClick={() => send({ type: 'reward', card: null })}>不取新牌，继续前行 <ArrowRight size={16} /></button></section>}
    {run.phase === 'rest' && <section className="encounter"><span className="round-emblem"><Moon /></span><h1>回路里的静处</h1><p>静坐调息回复 {Math.floor(run.maxHp * .3)} 点生命，或舍去一张灵术。只能选一样。</p>
      <button className="primary" onClick={() => send({ type: 'rest', choice: 'heal' })}><Heart size={18} />静坐调息</button>
      <details><summary>舍去一张灵术</summary><div className="offer-cards compact">{run.deck.map(c => <LingzhiCardTile small key={c.uid} card={c.card} disabled={run.deck.length <= 1} label="舍去此牌" onClick={() => send({ type: 'rest', choice: 'remove', uid: c.uid })} />)}</div></details></section>}
    {run.phase === 'quiet' && <section className="encounter event-scene"><span className="round-emblem"><Orbit /></span><span className="eyebrow">{NODE_NAMES[run.nodes.find(n => n.floor === run.floor && n.lane === run.lane)!.kind]}</span><h1>灵质的回响</h1>
      <blockquote>这里的灵质轻轻流动，似乎还藏着什么。<br />这一版灵质修行还没有接入事件与灵质空间，稍作停留后继续前行。</blockquote>
      <button className="primary" disabled={busy} onClick={() => send({ type: 'continue' })}>继续前行 <ArrowRight size={17} /></button></section>}

    {modal === 'deck' && <Modal title={`灵质修行牌组 · ${run.deck.length} 张`} onClose={() => setModal(null)}><div className="collection-grid">{run.deck.map(c => <LingzhiCardTile key={c.uid} card={c.card} small />)}</div></Modal>}
    {modal === 'return' && <Modal title="现在离开灵质回路？" onClose={() => setModal(null)}><p>这次不带回灵质，今天就这样过去了。</p>
      <div className="hero-actions"><button className="secondary" onClick={() => setModal(null)}>继续修行</button><button className="primary" disabled={busy} onClick={() => { setModal(null); onReturn(); }}>回会馆 <ArrowRight size={17} /></button></div></Modal>}
  </>;
}
