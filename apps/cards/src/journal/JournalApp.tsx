/**
 * 众生牌录：众生之门的主界面和长期状态中心，沿用入世历练原有的会馆与选同行者界面。
 * 所有玩法都从这里出发，结束后把 ActivityResult 提交回同一本众生牌录；回来时直接在众生牌录上看到变化。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, DoorOpen, Gem, Heart, Home, Map as MapIcon, Moon, Orbit, ScrollText, Sparkles, Sprout, X } from 'lucide-react';
import { CARDS, HEROES } from '../game/core/content';
import { reduceRun } from '../game/core/engine';
import { REBIRTH_ELEMENTS, REBIRTH_STYLE } from '../game/core/rebirth';
import { rebirthDeck } from '../game/core/engine';
import { BASE_PLAYER, BRANCHES, dailyFor, DIFFICULTIES, formatPassive, GUILDS, guildById, masteryByElement, TREASURES } from '../game/core/rebirthBonus';
import type { Action, RebirthElement, RunState } from '../game/core/types';
import { CardTile, Portrait } from '../game/CardTile';
import { Forest } from '../game/Forest';
import { useCardBalance } from '../game/useCardBalance';
import { defaultLoadout, expeditionResult, heroOf, REBIRTH_REWARD, rebirthDailyKey, rebirthResult, rebirthResults, startExpedition, startRebirth, stayResult, type ExpeditionSession, type RebirthSession } from '../world/activities';
import { isShownResource, RESOURCE_NAMES, SHOWN_RESOURCES } from '../world/resources';
import { allFallen, canStartExpedition, commitResult, markSeen, nightResult, RULES, sealResult, summarize, unseenEntries } from '../world/rules';
import { onWorldLedgerChange, openWorld, saveWorld, type WorldStore } from '../world/store';
import type { ActivityResult, ActivitySession, Assignment, Change, ExpeditionLoadout, JournalEntry, PlaceId, RebirthLoadout, ResourceKey, WorldSnapshot } from '../world/types';
import { ExpeditionView } from './ExpeditionView';
import './journal.css';
import { LoadError } from '../components/LoadBoundary';
import { lingzhiResult, startLingzhi, type LingzhiSession } from '../activities/lingzhi/adapter';
import { reportActivity } from '../world/progressReport';
import { reduceLingzhi } from '../activities/lingzhi/engine';
import type { LingzhiAction, LingzhiLoadout } from '../activities/lingzhi/types';
import { LingzhiSetup, LingzhiView } from '../activities/lingzhi/LingzhiView';

const nameOf = (id: number) => Object.values(HEROES).find(h => h.characterId === id)?.name ?? `同行者 ${id}`;
const PLACE_NAMES: Record<PlaceId, string> = { lodge: '林间小馆', 'forest-path': '林间小径', 'deep-forest': '深林', 'rebirth-gate': '重生之门', 'lingzhi-circuit': '灵质回路' };
const CONDITION_LABEL = { healthy: '', wounded: ' · 重伤', fallen: ' · 静养中' } as const;

export function changeText(c: Change): string {
  switch (c.kind) {
    case 'resource': return `${RESOURCE_NAMES[c.key]} ${c.amount > 0 ? '+' : ''}${c.amount}`;
    case 'bond': return `${nameOf(c.character)} 默契 +${c.amount}`;
    case 'wound': return `${nameOf(c.character)} 重伤`;
    case 'fall': return `${nameOf(c.character)} 倒下`;
    case 'recover': return `${nameOf(c.character)} ${c.from === 'fallen' ? '恢复' : '痊愈'}`;
    case 'seal': return `${nameOf(c.character)} 结下封灵之契`;
    case 'card': return `记下「${CARDS[c.card]?.name ?? c.card}」`;
    case 'meet': return `结识 ${nameOf(c.character)}`;
    case 'place': return `${PLACE_NAMES[c.place]}${c.state === 'cleared' ? ' · 走通' : ' · 新发现'}`;
    case 'world-event': return c.text;
  }
}
const tone = (c: Change) => c.kind === 'resource' ? (c.amount < 0 ? 'loss' : 'gain') : c.kind === 'wound' || c.kind === 'fall' ? 'loss' : c.kind === 'place' || c.kind === 'world-event' ? 'world' : 'gain';

export function JournalApp({ onOpenCollection }: { onOpenCollection?: () => void }) {
  const balance = useCardBalance();
  const [store, setStore] = useState<WorldStore | null>(null);
  const [screen, setScreen] = useState<'home' | 'setup' | 'rebirth' | 'lingzhi'>('home');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<WorldStore | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /** 所有写入串行执行，始终基于最新的存档。 */
  const enqueue = useCallback((work: (s: WorldStore) => Promise<WorldStore> | WorldStore) => {
    const run = queue.current.then(async () => {
      if (!ref.current) return;
      setBusy(true);
      try { const next = await work(ref.current); ref.current = next; setStore(next); }
      catch (e) {
        setError((e as Error).message);
        try { const fresh = await openWorld(); ref.current = fresh; setStore(fresh); } catch { /* 保留当前画面 */ }
      } finally { setBusy(false); }
    });
    queue.current = run;
    return run;
  }, []);

  const commit = useCallback((result: ActivityResult | ((s: WorldStore) => ActivityResult)) => enqueue(async s => {
    const r = typeof result === 'function' ? result(s) : result;
    const out = commitResult(s.snapshot, s.ledger, r);
    if (out.duplicate) return s;
    const next = await saveWorld(s, out.snapshot, { resources: out.resources, roster: out.roster, operationId: r.id });
    reportActivity(r);
    return next;
  }), [enqueue]);

  const persist = useCallback((edit: (snap: WorldSnapshot) => WorldSnapshot) => enqueue(s => saveWorld(s, edit(s.snapshot))), [enqueue]);

  /** 重新打开世界并把其他玩法（重生之门）的结算写进众生牌录。 */
  const sync = useCallback(() => enqueue(async () => {
    let s = await openWorld();
    for (const r of rebirthResults(s.snapshot.world, s.recent)) {
      const out = commitResult(s.snapshot, s.ledger, r);
      if (!out.duplicate) s = await saveWorld(s, out.snapshot, { resources: out.resources, roster: out.roster, operationId: r.id });
    }
    return s;
  }), [enqueue]);

  useEffect(() => {
    let alive = true;
    openWorld().then(s => { if (!alive) return; ref.current = s; setStore(s); void sync(); }).catch(e => alive && setError((e as Error).message));
    const off = onWorldLedgerChange(mode => { if (mode === 'slay') void sync(); });
    const focus = () => void sync();
    window.addEventListener('focus', focus);
    return () => { alive = false; off(); window.removeEventListener('focus', focus); };
  }, [sync, attempt]);
  // 众生牌录未打开时错误要一直留着（带重试），不能 7 秒后退回加载线。
  useEffect(() => { if (!error || !store) return; const t = setTimeout(() => setError(''), 7000); return () => clearTimeout(t); }, [error, store]);

  if (!store) return error ? <LoadError page message={`众生牌录没能打开：${error}`} onRetry={() => { setError(''); setAttempt(n => n + 1); }} />
    : <p className="qc-loading qc-loading--page" role="status">正在翻开众生牌录…</p>;
  const { world, journal, activity } = store.snapshot;
  const toast = error && <div className="toast" role="alert">{error}<button aria-label="关闭提示" onClick={() => setError('')}><X size={15} /></button></div>;

  function begin(loadout: ExpeditionLoadout) {
    if (!balance.snapshot || balance.error) { setError('请先连接数值后台，再出行。'); return; }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    let session: ExpeditionSession;
    try { session = startExpedition(store!.snapshot.world, store!.ledger, loadout, seed); } catch (e) { setError((e as Error).message); return; }
    void persist(snap => ({ ...markSeen(snap), activity: session })).then(() => { setScreen('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  function beginRebirth(loadout: RebirthLoadout) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    let session: RebirthSession;
    try { session = startRebirth(store!.snapshot.world, loadout, seed); } catch (e) { setError((e as Error).message); return; }
    void persist(snap => ({ ...markSeen(snap), activity: session })).then(() => { setScreen('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  function beginLingzhi(loadout: LingzhiLoadout) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    let session: LingzhiSession;
    try { session = startLingzhi(store!.snapshot.world, loadout, seed); } catch (e) { setError((e as Error).message); return; }
    void persist(snap => ({ ...markSeen(snap), activity: session })).then(() => { setScreen('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  /** 灵质修行：局内规则在 activities/lingzhi，结束时同样交给适配器生成结果提交进众生牌录。 */
  function actLingzhi(action: LingzhiAction) {
    const session = store!.snapshot.activity as LingzhiSession | null;
    if (!session) return;
    let next: LingzhiSession['state'];
    try { next = reduceLingzhi(session.state, action); } catch (e) { setError((e as Error).message); return; }
    const updated = { ...session, state: next };
    if (next.phase === 'victory' || next.phase === 'defeat') void commit(lingzhiResult(updated)).then(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    else void persist(snap => ({ ...snap, activity: updated }));
  }
  /** 一局结束（或中途折返）：交给对应玩法的适配器生成结果，再提交进众生牌录。 */
  function finish(session: ActivitySession<RunState, unknown>, early: boolean) {
    void commit(s => session.activity === 'rebirth-gate'
      ? rebirthResult(session as RebirthSession, s.snapshot.world, early)
      : expeditionResult(session as ExpeditionSession, s.snapshot.world, s.ledger, early)).then(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
  function act(action: Action) {
    const session = store!.snapshot.activity as ActivitySession<RunState, unknown> | null;
    if (!session) return;
    let next: RunState;
    try { next = reduceRun(session.state, action); } catch (e) { setError((e as Error).message); return; }
    const updated = { ...session, state: next };
    if (next.phase === 'victory' || next.phase === 'defeat') finish(updated, false);
    else void persist(snap => ({ ...snap, activity: updated }));
  }
  function returnEarly() {
    const session = store!.snapshot.activity as ActivitySession<RunState, unknown> | null;
    if (session) finish(session, true);
  }

  if (activity?.activity === 'lingzhi') return <><LingzhiView session={activity as LingzhiSession} busy={busy} onAction={actLingzhi} onReturn={() => void commit(lingzhiResult(activity as LingzhiSession, true)).then(() => window.scrollTo({ top: 0, behavior: 'smooth' }))} />{toast}</>;
  if (activity && (activity.activity === 'expedition' || activity.activity === 'rebirth-gate')) return <><ExpeditionView session={activity as ActivitySession<RunState, unknown>} busy={busy} onAction={act} onReturn={returnEarly} onError={setError} />{toast}</>;
  if (screen === 'rebirth') return <><RebirthSetup busy={busy} day={world.day} dailyKey={rebirthDailyKey(world)} onCancel={() => setScreen('home')} onStart={beginRebirth} />{toast}</>;
  if (screen === 'lingzhi') return <><LingzhiSetup busy={busy} onCancel={() => setScreen('home')} onStart={beginLingzhi} />{toast}</>;
  if (screen === 'setup') return <><ExpeditionSetup store={store} busy={busy} onCancel={() => setScreen('home')} onStart={begin} balanceError={balance.error} />{toast}</>;

  const unseen = unseenEntries(journal);
  const summary = summarize(unseen);
  const canGo = canStartExpedition(world);
  const latest = journal.entries.at(-1);
  const morning = world.daypart === 'morning';
  return <>
    <div className="section-heading"><div><span className="eyebrow">YOUR JOURNAL</span><h1>众生牌录</h1><p className="subtle">每一次出行、每一夜，都记在这里。</p></div><span className="day-label">第 {world.day} 日 · {morning ? '清晨' : '傍晚'}</span></div>
    <div className="hall-scene"><Forest village /><div className="hall-overlay"><span>林间小馆</span><h2>{latest?.note ?? '山有木兮，灵有所栖。'}</h2>
      <div className="resource-bar">{SHOWN_RESOURCES.filter(k => k === 'spirit' || k === 'herb' || store.ledger.resources[k] > 0).map(k => {
        const d = summary.resources[k];
        return <span key={k}>{k === 'spirit' ? <Sparkles size={17} /> : k === 'herb' ? <Sprout size={17} /> : <Gem size={17} />}{RESOURCE_NAMES[k]} {store.ledger.resources[k]}{d ? <em className={`journal-delta ${d < 0 ? 'is-loss' : ''}`}>{d > 0 ? '+' : ''}{d}</em> : null}</span>;
      })}</div></div></div>

    {unseen.length > 0 && <ReturnPanel entries={unseen} summary={summary} onDone={() => void persist(markSeen)} onOpenCollection={onOpenCollection} />}

    <div className="hall-actions journal-actions">
      <div><strong>{morning ? '今天去哪里走走？' : '天色晚了，回会馆歇下吧。'}</strong>
        <p>{morning ? (canGo.ok ? '出行会占用今天。也可以去重生之门，或者留在会馆照看园圃。' : canGo.reason) : `过一夜会结算每个人的安排：种植草药 +${RULES.gardenHerbs}、修习默契 +${RULES.practiceBond}、休息灵质 +${RULES.restSpirit}；重伤者休养 ${RULES.healNights} 夜可痊愈。`}</p></div>
      <div className="hero-actions">{morning ? <>
        <button className="primary" disabled={busy || !canGo.ok} onClick={() => setScreen('setup')}>出行 <ArrowRight size={17} /></button>
        <button className="secondary" disabled={busy} onClick={() => { void persist(markSeen); setScreen('rebirth'); }}><DoorOpen size={16} />去重生之门</button>
        <button className="secondary" disabled={busy} onClick={() => { void persist(markSeen); setScreen('lingzhi'); }}><Orbit size={16} />去灵质回路</button>
        <button className="secondary" disabled={busy} onClick={() => void commit(s => stayResult(s.snapshot.world))}><Home size={16} />在会馆过一天</button>
      </> : <button className="primary" disabled={busy} onClick={() => void commit(s => nightResult(s.snapshot.world, s.ledger, nameOf))}><Moon size={16} />歇下，等明天</button>}</div>
    </div>

    <div className="residents">{Object.entries(world.companions).map(([id, care]) => {
      const cid = Number(id), roster = store.ledger.characters[cid] ?? {}, bond = roster.bond ?? 0, sealed = !!roster.sealed;
      const changed = summary.conditions[cid], gained = summary.bonds[cid];
      return <article key={id} className={`journal-resident is-${care.condition} ${changed || gained ? 'is-changed' : ''}`}>
        <div className="resident-head"><Portrait name={nameOf(cid)} /><div><h3>{nameOf(cid)}{care.condition !== 'healthy' && <em className={`hero-wound hero-wound--${care.condition === 'fallen' ? 'dead' : 'wounded'}`}>{CONDITION_LABEL[care.condition]}</em>}</h3>
          <small>{sealed ? '已结封灵之契' : `默契 ${bond} / ${RULES.sealBond}`}{gained ? <em className="journal-delta">+{gained}</em> : null}</small></div></div>
        {changed && <p className="journal-flag">{changed === 'recover' ? '伤好了，可以再一起出门。' : changed === 'fall' ? '这次倒下了，暂时不能同行。' : '受了重伤：下次出行生命上限减半。'}</p>}
        {care.condition === 'wounded' && !changed && <p className="subtle">安排「林间休息」{RULES.healNights} 夜并用 {RULES.healHerbs} 草药可痊愈（已休 {care.nights} 夜）。</p>}
        {care.condition === 'fallen' && !changed && <p className="subtle">{allFallen(world) ? `大家都在静养，还需 ${Math.max(0, RULES.reviveNights - Math.min(...Object.values(world.companions).map(c => c.nights)))} 夜。` : '要等大家都歇下，才能一起恢复。'}</p>}
        <label>日常安排<select aria-label={`${nameOf(cid)}的日常安排`} value={care.assignment} disabled={busy} onChange={e => {
          const assignment = e.target.value as Assignment;
          void persist(snap => ({ ...snap, world: { ...snap.world, companions: { ...snap.world.companions, [id]: { ...snap.world.companions[id], assignment } } } }));
        }}><option value="garden">照看灵田</option><option value="practice">同行练习</option><option value="rest">林间休息</option></select></label>
        <button className="secondary wide" disabled={busy || sealed || bond < RULES.sealBond || store.ledger.resources.spirit < RULES.sealSpirit} onClick={() => void commit(s => sealResult(s.snapshot.world, s.ledger, cid, nameOf(cid)))}>{sealed ? <Check size={16} /> : <BookOpen size={16} />} {sealed ? '下一次出行可用「封灵之契」' : `封灵成卡 · ${RULES.sealSpirit} 灵质`}</button>
      </article>;
    })}</div>

    <div className="journal-columns">
      <section aria-labelledby="journal-entries-title"><div className="section-heading"><div><span className="eyebrow">ENTRIES</span><h2 id="journal-entries-title">见闻</h2></div><span className="subtle">{journal.entries.length} 条</span></div>
        {journal.entries.length === 0 ? <p className="subtle">众生牌录还是空的。第一次出行之后，这里会记下遇见的人、走过的路和带回来的东西。</p>
          : <ol className="journal-entries">{[...journal.entries].reverse().slice(0, 12).map(e => <EntryItem key={e.id} entry={e} fresh={unseen.includes(e)} />)}</ol>}
      </section>
      <aside className="journal-side">
        <div><h3><ScrollText size={16} />灵卡图鉴</h3><p>已记下 <b>{world.codex.cards.length}</b> 张{summary.newCards.length > 0 && <em className="journal-delta">新 {summary.newCards.length}</em>}</p>
          {onOpenCollection && <button className="text-button" onClick={onOpenCollection}>翻开图鉴 <ArrowRight size={16} /></button>}</div>
        <div><h3><MapIcon size={16} />走过的地方</h3><ul className="journal-places">{(Object.keys(PLACE_NAMES) as PlaceId[]).map(id => {
          const p = world.places[id], fresh = summary.places.some(x => x.place === id);
          return <li key={id} className={`${p.discovered ? '' : 'is-hidden'} ${fresh ? 'is-fresh' : ''}`}><span>{p.discovered ? PLACE_NAMES[id] : '？？？'}</span><small>{!p.discovered ? '尚未发现' : id === 'lodge' ? '住处' : p.cleared ? `走通 ${p.cleared} 次` : p.visits ? `去过 ${p.visits} 次` : id === 'deep-forest' ? '还没有路' : '还没去过'}</small></li>;
        })}</ul></div>
      </aside>
    </div>
    {toast}
  </>;
}

function ReturnPanel({ entries, summary, onDone, onOpenCollection }: { entries: JournalEntry[]; summary: ReturnType<typeof summarize>; onDone: () => void; onOpenCollection?: () => void }) {
  const chips: Change[] = [];
  for (const [k, v] of Object.entries(summary.resources)) if (isShownResource(k as ResourceKey)) chips.push({ kind: 'resource', key: k as ResourceKey, amount: v! });
  for (const e of entries) for (const c of e.changes) if (c.kind === 'wound' || c.kind === 'fall' || c.kind === 'recover' || c.kind === 'place' || c.kind === 'seal' || c.kind === 'world-event') chips.push(c);
  return <section className="journal-return" role="status" aria-label="新的见闻">
    <span className="round-emblem"><Sparkles /></span>
    <div>
      <span className="eyebrow">{entries.length > 1 ? `这段时间 · ${entries.length} 条新见闻` : '刚刚记下'}</span>
      <h2>{entries.at(-1)!.title}</h2>
      {entries.at(-1)!.note && <p>{entries.at(-1)!.note}</p>}
      <ul className="journal-chips">{chips.map((c, i) => <li key={i} className={`is-${tone(c)}`}>{changeText(c)}</li>)}</ul>
      {summary.newCards.length > 0 && <div className="offer-cards compact">{summary.newCards.slice(0, 6).map(id => <CardTile key={id} small card={{ uid: id, card: id, upgraded: false }} onClick={onOpenCollection} label="图鉴新增" />)}</div>}
      <button className="text-button" onClick={onDone}>收好这些见闻 <Check size={16} /></button>
    </div>
  </section>;
}

function EntryItem({ entry, fresh }: { entry: JournalEntry; fresh: boolean }) {
  const shown = entry.changes.filter(c => c.kind !== 'card' && !(c.kind === 'resource' && !isShownResource(c.key)));
  const cards = entry.changes.filter(c => c.kind === 'card').length;
  return <li className={`${fresh ? 'is-fresh' : ''} is-${entry.activity}`}>
    <span className="journal-when">第 {entry.day} 日{entry.activity === 'night' ? ' · 夜' : entry.daypart === 'morning' ? '' : ' · 傍晚'}</span>
    <div><strong>{entry.title}</strong>{entry.note && <p>{entry.note}</p>}
      {(shown.length > 0 || cards > 0) && <ul className="journal-chips is-compact">{shown.map((c, i) => <li key={i} className={`is-${tone(c)}`}>{changeText(c)}</li>)}{cards > 0 && <li className="is-gain">记下 {cards} 张灵卡</li>}</ul>}
    </div>
  </li>;
}

function ExpeditionSetup({ store, busy, onCancel, onStart, balanceError }: { store: WorldStore; busy: boolean; onCancel: () => void; onStart: (l: ExpeditionLoadout) => void; balanceError: string }) {
  const { world } = store.snapshot;
  const [loadout, setLoadout] = useState<ExpeditionLoadout>(() => defaultLoadout(world));
  const cid = Number(loadout.companion), care = world.companions[loadout.companion], hero = heroOf(cid);
  const h = hero ? HEROES[hero] : undefined;
  const sealed = !!store.ledger.characters[cid]?.sealed;
  const ok = canStartExpedition(world, cid);
  return <section className="hero-section journal-setup">
    <div className="section-heading"><div><span className="eyebrow">BEFORE YOU GO</span><h2>这一程，与谁同行</h2></div><span className="subtle">第 {world.day} 日 · 出行前</span></div>
    <div className="hero-selection">
      <div className="hero-options">{Object.entries(world.companions).map(([id, c]) => {
        const hh = HEROES[heroOf(Number(id))!];
        return <button key={id} className={`hero-option ${loadout.companion === id ? 'selected' : ''}`} disabled={c.condition === 'fallen'} aria-pressed={loadout.companion === id}
          onClick={() => setLoadout(l => ({ ...l, companion: id, deck: world.companions[id].carry ? 'carry' : 'starter' }))}>
          <Portrait name={hh.name} /><div><small>{hh.subtitle}</small><h3>{hh.name}{c.condition !== 'healthy' && <em className={`hero-wound hero-wound--${c.condition === 'fallen' ? 'dead' : 'wounded'}`}>{CONDITION_LABEL[c.condition]}</em>}</h3>
            <p>{hh.id === 'xiaohei' ? '灵巧连击 · 自由穿梭' : hh.id === 'wuxian' ? '御金破阵 · 稳中制胜' : '木灵召唤 · 生生不息'}</p></div>
          <span className="selection-dot">{loadout.companion === id && <Check size={13} />}</span></button>;
      })}</div>
      {h && <div className="hero-detail">
        <span className="hero-quote">“{h.quote}”</span><p>{h.description}</p>
        <div className="relic"><Gem size={20} /><div><strong>{h.relic}</strong><small>{h.relicText}</small></div><span><Heart size={14} /> {care.condition === 'wounded' ? Math.floor(h.hp / 2) : h.hp}</span></div>
        {care.carry && <div className="journal-option" role="radiogroup" aria-label="牌组">
          <button role="radio" aria-checked={loadout.deck === 'carry'} className={loadout.deck === 'carry' ? 'selected' : ''} onClick={() => setLoadout(l => ({ ...l, deck: 'carry' }))}>带上受伤时的牌组 · {care.carry.deck.length} 张</button>
          <button role="radio" aria-checked={loadout.deck === 'starter'} className={loadout.deck === 'starter' ? 'selected' : ''} onClick={() => setLoadout(l => ({ ...l, deck: 'starter' }))}>重新整理初始牌组</button>
        </div>}
        {care.condition === 'wounded' && <small className="sealed-note">重伤 · 生命上限减半；再次倒下将暂时无法同行。</small>}
        <div className="journal-option" aria-label="去向"><span>去向</span><button className="selected" aria-pressed>林间小径</button><button disabled>{world.places['deep-forest'].discovered ? '深林 · 还没有路' : '？？？'}</button></div>
        <div className="journal-slots" aria-label="随身物品，以后开放"><span>随身</span><i>道具</i><i>草药</i><i>装备</i><small>以后开放</small></div>
        {(balanceError || !ok.ok) && <small className="sealed-note journal-warn">{balanceError || (!ok.ok && ok.reason)}</small>}
        <button className="primary wide" disabled={busy || !ok.ok || !!balanceError} onClick={() => onStart(loadout)}>以{h.name}启程 <ArrowRight size={17} /></button>
        {sealed && <small className="sealed-note">封灵之契已生效 · 初始牌组增加一张灵卡</small>}
        <button className="text-button" onClick={onCancel}>回众生牌录</button>
      </div>}
    </div>
  </section>;
}

function RebirthSetup({ busy, day, dailyKey, onCancel, onStart }: { busy: boolean; day: number; dailyKey: string; onCancel: () => void; onStart: (l: RebirthLoadout) => void }) {
  const [element, setElement] = useState<RebirthElement>('金');
  const [branch, setBranch] = useState<string | null>(null);
  const [guild, setGuild] = useState<string>(GUILDS[0].id);
  const [difficulty, setDifficulty] = useState<RebirthLoadout['difficulty']>('normal');
  const daily = dailyFor(dailyKey), b = BRANCHES.find(x => x.id === branch), g = guildById(guild), d = DIFFICULTIES.find(x => x.id === difficulty)!;
  const deck = rebirthDeck(element, branch);
  const hp = BASE_PLAYER.maxHealth + d.startingHealthBonus + (g?.passive.maxHealth ?? 0) + (daily.blessing.passive.maxHealth ?? 0);
  const treasure = b?.starterTreasure ? TREASURES[b.starterTreasure] : null;
  const blessing = formatPassive(daily.blessing.passive);
  return <section className="hero-section journal-setup">
    <div className="section-heading"><div><span className="eyebrow">REBIRTH GATE</span><h2>推开重生之门</h2></div><span className="subtle">第 {day} 日 · 不需要同行者</span></div>
    <div className="hero-selection">
      <div className="hero-options">{REBIRTH_ELEMENTS.map(el => <button key={el} className={`hero-option ${element === el ? 'selected' : ''}`} aria-pressed={element === el} onClick={() => setElement(el)}>
        <span className="portrait-fallback journal-element">{el}</span><div><small>本命五行{formatPassive(masteryByElement(el)?.passive) && ` · ${formatPassive(masteryByElement(el)?.passive)}`}</small><h3>本命{el}行</h3><p>{REBIRTH_STYLE[el]}</p></div>
        <span className="selection-dot">{element === el && <Check size={13} />}</span></button>)}</div>
      <div className="hero-detail">
        <span className="hero-quote">“魂灵入门，前尘尽忘；见过的灵术，会在下一世醒来。”</span>
        <p>同系牌伤害与格挡 +2，相生 +1；楼层天时同系的牌再 +1，与今日灵机同向时共振再 +1。</p>

        <div className="journal-option" role="radiogroup" aria-label="灵质天赋"><span>天赋</span>
          <button role="radio" aria-checked={branch === null} className={branch === null ? 'selected' : ''} onClick={() => setBranch(null)}>不选</button>
          {BRANCHES.map(x => <button key={x.id} role="radio" aria-checked={branch === x.id} className={branch === x.id ? 'selected' : ''} onClick={() => setBranch(x.id)}>{x.name}</button>)}</div>
        {b && <small className="subtle journal-choice-note">{b.title} · {[formatPassive(b.passive), b.starterCard && `开局卡「${b.starterCard.slice(8)}」`, b.id === 'yuling' && b.branchCards?.[element] && `五行分支卡「${b.branchCards[element].slice(8)}」`, b.dualSkill && `双系合技「${b.dualSkill.slice(8)}」`, b.starterTreasure && `开局法宝「${b.starterTreasure}」`].filter(Boolean).join('，')}</small>}

        <div className="journal-option" role="radiogroup" aria-label="出身分馆"><span>分馆</span>
          {GUILDS.map(x => <button key={x.id} role="radio" aria-checked={guild === x.id} className={guild === x.id ? 'selected' : ''} onClick={() => setGuild(x.id)}>{x.name}</button>)}</div>
        {g && <small className="subtle journal-choice-note">{g.title.replace(/^馆训·/, '馆训 · ')}：{formatPassive(g.passive)}</small>}

        <div className="journal-option" role="radiogroup" aria-label="难度"><span>难度</span>
          {DIFFICULTIES.map(x => <button key={x.id} role="radio" aria-checked={difficulty === x.id} className={difficulty === x.id ? 'selected' : ''} onClick={() => setDifficulty(x.id)}>{x.name.split(' · ')[0]}</button>)}</div>
        <small className="subtle journal-choice-note">{d.name}：敌人生命 ×{d.hpMult}{d.bossHpMult !== 1 && `（守门者再 ×${d.bossHpMult}）`}，金币 ×{d.rewardMult}{d.startingHealthBonus ? `，开局生命 +${d.startingHealthBonus}` : ''}</small>

        <div className="relic"><Gem size={20} /><div><strong>今日灵机 · {daily.element.name}</strong><small>{daily.element.element}系与天时同向的楼层共振{blessing ? `；${daily.blessing.name}：${blessing}` : ''}</small></div><span><Heart size={14} /> {hp}</span></div>
        {treasure && <small className="subtle">开局法宝「{treasure.id}」：{formatPassive(treasure.passive) || treasure.desc}</small>}
        <small className="subtle">初始牌组 · {deck.length} 张</small>
        <div className="offer-cards compact">{deck.map((id, i) => <CardTile key={i} small card={{ uid: `s${i}`, card: id, upgraded: false }} />)}</div>
        <button className="primary wide" disabled={busy} onClick={() => onStart({ element, branch, guild, difficulty })}>以本命{element}行推开重生之门 <ArrowRight size={17} /></button>
        <small className="sealed-note">走通带回灵质 +{REBIRTH_REWARD.victory.spirit}、草药 +{REBIRTH_REWARD.victory.herb}；散灵带回灵质 +{REBIRTH_REWARD.defeat.spirit}。修行事件与结局还在迁移中。</small>
        <button className="text-button" onClick={onCancel}>回众生牌录</button>
      </div>
    </div>
  </section>;
}
