import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, ArrowRight, BookOpen, ScrollText, Sprout, PenLine } from 'lucide-react';
import portal from '../../../../portal.json';
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
import { usePlayerProfile } from './PlayerProfile';
import { PlayerAvatar } from './PlayerAvatar';
import { Forest } from './Forest';
import { composeSpecies, speciesParts } from './species';
import './mode-hall.css';

type Props = { onNavigate: (view: string) => void; onEditIdentity?: () => void };
type Game = { key: string; title: string; genre: string; desc: string; points: string[]; shots: string[]; view?: string; scene?: ReactNode };
const auxiliary = [
  { view: 'hall', title: '会馆日常', caption: '照料同行者，积攒默契', icon: Sprout },
  { view: 'collection', title: '灵卡图鉴', caption: '翻阅已结缘的灵卡', icon: BookOpen },
  { view: 'timeline', title: '旅途手札', caption: '安排下一程的奇遇', icon: ScrollText },
  { view: 'world', title: '万灵志', caption: '查阅人物、地点与灵术', icon: BookOpen },
];

/** Hall order: 入世历练 (which 重生之门 is merging into), 省省's beach, 聚灵, then the rest. */
const ADVENTURE: Game = { key: 'cards', view: 'adventure', title: '入世历练', genre: '卡牌 · 路线冒险 · 爬塔', shots: [cardsBattle, slayBattle, cardsMap, slayMap],
  scene: <Forest className="game-card__scene"/>,
  desc: '与罗小黑一同踏入山林，在分支路线上遭遇、休憩、交易，用灵术卡牌化解每一场相遇。重生之门的爬塔篇也正在并进来。', points: ['十层分支路线', '回合制灵术卡牌', '五行克制 · 爬塔', '会馆养成 · 封灵成卡'] };
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
  { key: 'softie', title: '灵体互动', genre: '社交 · 多人', shots: [softie],
    desc: '捏一只自己的软软灵体，在林间空地与其他旅人相遇、贴贴、戳一下。', points: ['自定义灵体', '多人同场'] },
  { key: 'aeon', title: 'AEON', genre: '模拟 · 神经演化', shots: [aeon],
    desc: '每个生灵都用真实的神经网络思考：领导一个民族，或以神之手塑造世界，看文明兴衰。', points: ['生存 / 创造双模式', '神经网络生灵'] },
];
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
    <span className={game.scene ? 'game-card__window' : 'game-card__shots'} aria-hidden="true">{game.shots.map((shot, shotIndex) => <img key={shot} src={shot} alt="" loading="lazy" decoding="async" className={shotIndex === frame ? 'is-shown' : ''}/>)}</span>
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
  return game.view ? <button type="button" {...props} onClick={() => onNavigate(game.view!)}>{content}</button>
    : <a {...props} href={`/app/shell/m/${game.key}`}>{content}</a>;
}

/** portal.json decides which external modes are published; the hall owns order and presentation. */
export function ModeHall({ onNavigate, onEditIdentity }: Props) {
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
    <div className="mode-hall__row mode-hall__row--feature">
      <GameCard game={ADVENTURE} index={1} onNavigate={onNavigate}/>
      {published.has('slay') && <a className="mode-hall__chapter" href="/app/shell/m/slay"><small>入世历练 · 爬塔篇</small><strong>重生之门</strong><span>五行爬塔，正在并入 <ArrowUpRight size={14}/></span></a>}
    </div>
    <div className="mode-hall__row">{firstRow.map((game, index) => <GameCard key={game.key} game={game} index={index + 2} onNavigate={onNavigate}/>)}</div>
    {secondRow.length > 0 && <div className="mode-hall__row mode-hall__row--compact">{secondRow.map((game, index) => <GameCard key={game.key} game={game} index={firstRow.length + index + 2} onNavigate={onNavigate}/>)}</div>}
    <aside className="mode-hall__desk" aria-label="旅途案头"><div><small>不赶路的时候</small><h2>在门庭歇一会。</h2></div><nav>{auxiliary.map(item => <button key={item.view} onClick={() => onNavigate(item.view)}><item.icon size={19}/><span><strong>{item.title}</strong><small>{item.caption}</small></span><ArrowRight size={15}/></button>)}</nav></aside>
    <p className="mode-hall__save-note">每片天地保留自己的旅途进度，玩家形象由众生之门统一读取。</p>
  </section>;
}

export default ModeHall;
