import { ArrowUpRight, ArrowRight, BookOpen, ScrollText, Sprout, Swords } from 'lucide-react';
import portal from '../../../../portal.json';
import forest from '../../../../../../shared/shared-ui/lxh/scenes/deep-forest-moss.png';
import shore from './shore/shore-background.png';
import { usePlayerProfile } from './PlayerProfile';
import { PlayerAvatar } from './PlayerAvatar';
import './mode-hall.css';

type Props = { onNavigate: (view: string) => void; onEditIdentity?: () => void };
const auxiliary = [
  { view: 'hall', title: '会馆日常', caption: '照料同行者，积攒默契', icon: Sprout },
  { view: 'collection', title: '灵卡图鉴', caption: '翻阅已结缘的灵卡', icon: BookOpen },
  { view: 'timeline', title: '旅途手札', caption: '安排下一程的奇遇', icon: ScrollText },
  { view: 'world', title: '万灵志', caption: '查阅人物、地点与灵术', icon: BookOpen },
];
const internal: Record<string, string> = { cards: 'adventure', management: 'management', ecology: 'ecosystem' };

/** portal.json owns the published modes; the hall adds only in-application routes. */
export function ModeHall({ onNavigate, onEditIdentity }: Props) {
  const { identity } = usePlayerProfile();
  const modes = portal.links.filter(link => link.group === '游戏');
  return <section className="mode-hall" aria-labelledby="mode-hall-title">
    <header className="mode-hall__heading">
      <div><p className="mode-hall__eyebrow">THE GATE OF ALL BEINGS · 门庭</p><h1 id="mode-hall-title">每一扇门，都是一段旅途。</h1><p>山林、会馆与万灵的故事，都从这里启程。</p></div>
      <button className="mode-hall__player" type="button" onClick={onEditIdentity} aria-label={`玩家形象：${identity.display_name || '旅人'}，${identity.species_name || '尚未填写种族'}`} disabled={!onEditIdentity}>
        <PlayerAvatar identity={identity} className="mode-hall__avatar"/><span><small>此刻的你</small><strong>{identity.display_name || '旅人'}</strong><em>{identity.species_name || '尚未填写种族'}</em></span>
      </button>
    </header>
    <div className="mode-hall__paths" aria-label="选择一扇门">
      <button className="mode-path mode-path--shore" onClick={() => onNavigate('shore')} style={{ '--mode-image': `url("${shore}")` } as React.CSSProperties}>
        <span className="mode-path__number">01 / 林间相遇</span><span className="mode-path__body"><small>探索 · 轻量小游戏</small><strong>雾隐浅滩</strong><span>回应雾中的三束灵息，拾起世界留下的回声。</span><b>走入浅滩 <ArrowRight size={18}/></b></span>
      </button>
      {modes.map((mode, index) => {
        const view = internal[mode.key];
        const content = <><span className="mode-path__number">{String(index + 2).padStart(2, '0')} / {view ? '门内旅途' : '另一方天地'}</span><span className="mode-path__glyph" aria-hidden="true">{mode.icon}</span><span className="mode-path__body"><small>{mode.key === 'cards' ? '策略 · 同行者' : mode.key === 'management' ? '经营 · 家园' : mode.key === 'ecology' ? '模拟 · 万灵' : '众生之门 · 玩法'}</small><strong>{mode.key === 'cards' ? '入世历练' : mode.name}</strong><span>{mode.desc}</span><b>{mode.key === 'cards' ? <Swords size={17}/> : null} {view ? '踏入此门' : '前往此境'} {view ? <ArrowRight size={18}/> : <ArrowUpRight size={18}/>}</b></span></>;
        const className = `mode-path mode-path--${mode.key}`;
        const style = mode.key === 'cards' || mode.key === 'ecology' ? { '--mode-image': `url("${forest}")` } as React.CSSProperties : undefined;
        return view ? <button key={mode.key} className={className} style={style} onClick={() => onNavigate(view)}>{content}</button>
          : <a key={mode.key} className={className} href={`/app/shell/m/${mode.key}`}>{content}</a>;
      })}
    </div>
    <aside className="mode-hall__desk" aria-label="旅途案头"><div><small>不赶路的时候</small><h2>在门庭歇一会。</h2></div><nav>{auxiliary.map(item => <button key={item.view} onClick={() => onNavigate(item.view)}><item.icon size={19}/><span><strong>{item.title}</strong><small>{item.caption}</small></span><ArrowRight size={15}/></button>)}</nav></aside>
    <p className="mode-hall__save-note">每片天地保留自己的旅途进度，玩家形象由众生之门统一读取。</p>
  </section>;
}

export default ModeHall;
