import { useEffect, useState, type ReactNode } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { ArrowUpRight, ArrowRight, BookOpen, ScrollText, Sprout, PenLine, Trophy, Map as MapIcon } from 'lucide-react';
import { leaderboardUrl } from '@lxh/shared-session/progress.js';
import portal from '../../../shell/portal.json';
import shore from './previews/shore.webp';
import cardsBattle from './previews/cards-battle.webp';
import cardsMap from './previews/cards-map.webp';
import slayMap from './previews/slay-map.webp';
import slayBattle from './previews/slay-battle.webp';
import shootPlay from './previews/shoot-play.webp';
import shootReady from './previews/shoot-ready.webp';
import julingPlay from './previews/juling-play.webp';
import management from './previews/management.webp';
import ecology from './previews/ecology.webp';
import softie from './previews/softie.webp';
import aeon from './previews/aeon.webp';
import ocRunPreview from '../../../mini-games/assets/runner-preview.png';
import crossingPreview from '../../../mini-games/assets/crossing-preview.png';
import { usePlayerProfile } from './PlayerProfile';
import { PlayerAvatar } from './PlayerAvatar';
import { Forest } from './Forest';
import { composeSpecies, speciesParts } from './species';
import './mode-hall.css';
import {SharedResources} from './SharedResources';

type Props = { onNavigate: (view: string) => void; onEditIdentity?: () => void; onReady?: () => void };
type Game = { key: string; title: string; genre: string; desc: string; points: string[]; shots: string[]; view?: string; scene?: ReactNode };
const auxiliary = [
  { view: 'hall', title: '会馆日常', caption: '照料同行者，积攒默契', icon: Sprout },
  { view: 'collection', title: '灵卡图鉴', caption: '翻阅已结缘的灵卡', icon: BookOpen },
  { view: 'world', title: '万灵志', caption: '查阅人物、地点与灵术', icon: BookOpen },
];

/** Hall order: 众生牌录 (the 众生牌录, which replaced 入世历练 and 重生之门), 省省's beach, 聚灵, then the rest. */
const ADVENTURE: Game = { key: 'cards', view: 'journal', title: '众生牌录', genre: '卡牌 · 出行与重生之门', shots: [cardsBattle, slayBattle, cardsMap, slayMap],
  scene: <Forest className="game-card__scene"/>,
  desc: '入世历练与重生之门已并入众生牌录：与同行者出行、照料会馆、推开重生之门，每一次旅途都记在同一本牌录里。', points: ['出行 · 灵质修行', '同行者与会馆', '重生之门', '旅途见闻'] };
const GAMES: Game[] = [
  { key: 'shengsheng-shoot', title: '省省海滩射击', genre: '像素射击 · 省省老师', shots: [shootPlay, shootReady],
    desc: '省省的海滩练习：移动躲开迎面而来的敌人，站定时自动三路开火，冲击更高分。', points: ['WASD / 方向键', '站定自动开火', '一局一两分钟'] },
  { key: 'juling', title: '聚灵', genre: '修炼 · 养成', shots: [julingPlay],
    desc: '你是森林中一簇初聚的生灵。汇聚生灵与五行物质灵，跨越境界，终可化形为妖。', points: ['五行物质灵', '境界突破', '轮回多世'] },
  { key: 'shore', view: 'shore', title: '雾隐浅滩', genre: '探索 · 轻量小游戏', shots: [shore],
    desc: '回应雾中的三束灵息，拾起世界留下的回声。', points: ['三束灵息', '轻松探索'] },
  { key: 'management', view: 'management', title: '灵境会馆', genre: '经营 · 家园', shots: [management],
    desc: '在灵质空间里建造据点、招募小妖、研究与远征，经营大家共同的会馆。', points: ['等距建造', '小妖五行分工', '聚落 → 结盟 → 会馆'] },
  { key: 'ecology', view: 'ecosystem', title: '生态进化', genre: '模拟 · 万灵', shots: [ecology],
    desc: '物质灵滋养植物，生灵随生命流动。编辑细胞、拼装生灵，把收获送回会馆。', points: ['3D 生态循环', '细胞编辑', '收获回流会馆'] },
  { key: 'world-map', title: '罗小黑世界地图', genre: '地图 · 探索', shots: [],
    scene: <span className="game-card__atlas" aria-hidden="true"><MapIcon/><i/><i/><i/></span>,
    desc: '转动环形地图，浏览龙游、流石、灵溪、西木会馆等地点与档案。', points: ['环形世界', '地点档案', '自由缩放'] },
  { key: 'softie', title: '灵体互动', genre: '社交 · 多人', shots: [softie],
    desc: '捏一只自己的软软灵体，在林间空地与其他旅人相遇、贴贴、戳一下。', points: ['自定义灵体', '多人同场'] },
  { key: 'aeon', title: 'AEON', genre: '模拟 · 神经演化', shots: [aeon],
    desc: '每个生灵都用真实的神经网络思考：领导一个民族，或以神之手塑造世界，看文明兴衰。', points: ['生存 / 创造双模式', '神经网络生灵'] },
  { key: 'oc-run', title: 'OC 快跑', genre: '跑酷 · 自己的 OC', shots: [ocRunPreview],
    desc: '带上自己的 OC，跑过门后的风景。跳过障碍，再向前一点。', points: ['选择会馆 OC', '默认 / 经典小恐龙', '二段跳'] },
  { key: 'frog-crossing', title: '青蛙过河', genre: '闯关 · 自己的 OC', shots: [crossingPreview],
    desc: '看准车流，跳上浮木。和自己的 OC 一起，走向另一边的河岸。', points: ['晴日马路 / 林间小河', '方向键或滑动', '五个终点'] },
];
const VOTE_KEY = 'zszm.journal-update-vote';
const VOTER_KEY = 'zszm.journal-update-voter-id';
const VOTE_SYNC_KEY = 'zszm.journal-update-vote-synced';
type Vote = 'up' | 'down' | null;
function readVote(): Vote { try { const v = localStorage.getItem(VOTE_KEY); return v === 'up' || v === 'down' ? v : null; } catch { return null; } }
function writeVote(v: Vote) { try { if (v) localStorage.setItem(VOTE_KEY, v); else localStorage.removeItem(VOTE_KEY); } catch { /* storage unavailable */ } }
function readOrCreateVoterId() {
  try {
    const existing = localStorage.getItem(VOTER_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(existing)) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, id);
    return id;
  } catch { return crypto.randomUUID(); }
}
type VoteState = { up: number; down: number; vote: Vote };
const feedbackUrl = `${import.meta.env.BASE_URL}api/update-feedback`;
async function saveVote(voterId: string, vote: Vote): Promise<VoteState> {
  const response = await fetch(feedbackUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter_id: voterId, vote }),
  });
  if (!response.ok) throw new Error('投票暂时没有保存');
  return response.json();
}

/** An anonymous browser vote on the 众生牌录 update, with a shared site-wide tally. */
function UpdateVote() {
  const [voterId] = useState(readOrCreateVoterId);
  const [vote, setVote] = useState<Vote>(readVote);
  const [counts, setCounts] = useState<VoteState>({ up: 0, down: 0, vote: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(feedbackUrl, { headers: { 'X-Feedback-Voter': voterId }, cache: 'no-store' });
        if (!response.ok) throw new Error('读取投票失败');
        let next: VoteState = await response.json();
        let synced = false;
        try { synced = localStorage.getItem(VOTE_SYNC_KEY) === 'true'; } catch { /* storage unavailable */ }
        const legacyVote = readVote();
        if (!synced && legacyVote && !next.vote) next = await saveVote(voterId, legacyVote);
        if (active) {
          setCounts(next); setVote(next.vote); writeVote(next.vote);
          try { localStorage.setItem(VOTE_SYNC_KEY, 'true'); } catch { /* storage unavailable */ }
        }
      } catch { if (active) setMessage('暂时无法读取全站票数'); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);
  const cast = async (next: 'up' | 'down') => {
    if (saving || loading) return;
    const value = vote === next ? null : next;
    setSaving(true); setMessage('');
    try {
      const result = await saveVote(voterId, value);
      setCounts(result); setVote(result.vote); writeVote(result.vote);
      try { localStorage.setItem(VOTE_SYNC_KEY, 'true'); } catch { /* storage unavailable */ }
    } catch { setMessage('投票没有保存，请稍后重试'); }
    finally { setSaving(false); }
  };
  return <div className="mode-hall__chapter mode-hall__chapter--vote">
    <div className="mode-hall__vote" role="group" aria-label="这次更新你觉得如何">
      <em>这次更新</em>
      <small className="mode-hall__vote-total">匿名 · 全站票数</small>
      <button type="button" aria-pressed={vote === 'up'} aria-label={`赞 ${loading ? '加载中' : counts.up}`} onClick={() => void cast('up')} disabled={loading || saving}><ThumbsUp size={14}/><span>{loading ? '—' : counts.up}</span></button>
      <button type="button" aria-pressed={vote === 'down'} aria-label={`踩 ${loading ? '加载中' : counts.down}`} onClick={() => void cast('down')} disabled={loading || saving}><ThumbsDown size={14}/><span>{loading ? '—' : counts.down}</span></button>
    </div>
    {message && <small className="mode-hall__vote-message" role="status">{message}</small>}
  </div>;
}

const published = new Set(portal.links.filter(link => link.group === '游戏').map(link => link.key));

function GameCard({ game, index, onNavigate }: { game: Game; index: number; onNavigate: (view: string) => void }) {
  const [active, setActive] = useState(false);
  const [frame, setFrame] = useState(0);
  // While a card is open, step through its real screenshots like a short play-through.
  useEffect(() => {
    if (!active || game.shots.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) { setFrame(0); return; }
    const timer = window.setInterval(() => setFrame(current => (current + 1) % game.shots.length), 1900);
    return () => window.clearInterval(timer);
  }, [active, game.shots.length]);
  const content = <>
    {game.scene}
    {game.shots.length > 0 && <span className={game.scene ? 'game-card__window' : 'game-card__shots'} aria-hidden="true">{game.shots.map((shot, shotIndex) => <img key={shot} src={shot} alt="" loading="lazy" decoding="async" className={shotIndex === frame ? 'is-shown' : ''}/>)}</span>}
    {game.shots.length > 1 && <span className="game-card__dots" aria-hidden="true">{game.shots.map((shot, shotIndex) => <i key={shot} className={shotIndex === frame ? 'is-on' : ''}/>)}</span>}
    <span className="game-card__number">{String(index).padStart(2, '0')}</span>
    <span className="game-card__body">
      <small>{game.genre}</small>
      <strong>{game.title}</strong>
      <span className="game-card__more">
        <span className="game-card__desc">{game.desc}</span>
        <span className="game-card__points">{game.points.map(point => <em key={point}>{point}</em>)}</span>
      </span>
      <b>{game.view ? '踏入此门' : '前往此境'} {game.view ? <ArrowRight size={16}/> : <ArrowUpRight size={16}/>}</b>
    </span>
  </>;
  const props = {
    className: `game-card game-card--${game.key}${game.scene ? ' game-card--scene' : ''}${active ? ' is-active' : ''}`,
    onMouseEnter: () => setActive(true), onMouseLeave: () => setActive(false),
    onFocus: () => setActive(true), onBlur: () => setActive(false),
  };
  if (game.view) return <button type="button" {...props} onClick={() => onNavigate(game.view!)}>{content}</button>;
  return <a {...props} href={`/app/shell/m/${game.key}`}>{content}</a>;
}

/** portal.json decides which independent modes are published; the hall owns order and presentation. */
export function ModeHall({ onNavigate, onEditIdentity, onReady }: Props) {
  useEffect(() => { onReady?.(); }, [onReady]);
  const { identity } = usePlayerProfile();
  const parts = speciesParts(identity);
  const note = parts.note;
  const speciesLabel = composeSpecies(parts) || identity.species_name;
  const visible = (game: Game) => Boolean(game.view) || published.has(game.key);
  const games = GAMES.filter(visible);
  const firstRow = games.slice(0, 3);
  const secondRow = games.slice(3);
  return <section className="mode-hall" aria-labelledby="mode-hall-title">
    <header className="mode-hall__heading">
      <div><p className="mode-hall__eyebrow">THE GATE OF ALL BEINGS · 门庭</p><h1 id="mode-hall-title">每一扇门，都是一段旅途。</h1><p>把鼠标移到门上，看看门后的天地。</p></div>
      <button className="mode-hall__player" type="button" onClick={onEditIdentity} aria-label={`玩家形象：${identity.display_name || '旅人'}，${identity.species_name || '尚未填写种族'}。点击管理形象`} disabled={!onEditIdentity}>
        <PlayerAvatar identity={identity} className="mode-hall__avatar"/>
        <span><small>此刻的你</small><strong>{identity.display_name || '旅人'}</strong><em>{speciesLabel || '尚未填写种族'}</em>{note && <i>{note}</i>}</span>
        {onEditIdentity && <PenLine className="mode-hall__edit" size={15} aria-hidden="true"/>}
      </button>
    </header>
    <SharedResources onOpen={()=>onNavigate('journey')}/>
    <div className="mode-hall__row mode-hall__row--feature">
      <GameCard game={ADVENTURE} index={1} onNavigate={onNavigate}/>
      <UpdateVote/>
    </div>
    <div className="mode-hall__row">{firstRow.map((game, index) => <GameCard key={game.key} game={game} index={index + 2} onNavigate={onNavigate}/>)}</div>
    {secondRow.length > 0 && <div className="mode-hall__row mode-hall__row--compact">{secondRow.map((game, index) => <GameCard key={game.key} game={game} index={firstRow.length + index + 2} onNavigate={onNavigate}/>)}</div>}
    <aside className="mode-hall__desk" aria-label="旅途案头"><div><small>不赶路的时候</small><h2>在门庭歇一会。</h2></div><nav>{auxiliary.map(item => <button key={item.view} onClick={() => onNavigate(item.view)}><item.icon size={19}/><span><strong>{item.title}</strong><small>{item.caption}</small></span><ArrowRight size={15}/></button>)}<a href={leaderboardUrl('cards')}><Trophy size={19}/><span><strong>排行榜</strong><small>看看各段旅途的榜单与等级</small></span><ArrowRight size={15}/></a></nav></aside>
    <p className="mode-hall__save-note">众生牌录里的各段旅途共享同行名册和旅途资源，各自保留局内进度。</p>
  </section>;
}

export default ModeHall;
