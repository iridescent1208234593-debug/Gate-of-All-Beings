import { cardText } from './core/cardText';
import '@lxh/shared-ui/lxh-ui.css';
import './unified.css';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Sprout, Map as MapIcon, Sparkles, X, Download, CircleHelp, Check, Home, ScrollText, Clapperboard, Settings } from 'lucide-react';
import { HEROES, registerEcoCards } from './core/content';
import { advanceDay, sealCharacter } from './core/meta';
import type { MetaState, SaveData } from './core/types';
import { downloadJSON, freshSave, readSave, writeSave } from './storage';
import { Forest } from './Forest';
import './game.css';
import './header.css';
import { queueEcology, acknowledgeDelivery } from './core/exchangeQueue';
import { LxhIcon } from './LxhIcon';
import { validateEcoExchange } from '@lxh/shared-types/exchange';
import { useCardBalance } from './useCardBalance';
import { CardCollection } from './CardCollection';
import { FeatureGuide, FullGuide } from './FeatureGuide';
import { PlayerIdentity, avatarPickInterrupted } from './PlayerIdentity';
import { usePlayerProfile } from './PlayerProfile';
import { PlayerAvatar } from './PlayerAvatar';
import { CardTile, Portrait } from './CardTile';
import { LoadBoundary } from '../components/LoadBoundary';
const WorldGuide=lazy(()=>import('./WorldGuide').then(m=>({default:m.WorldGuide})));
const EcosystemPanel=lazy(()=>import('./WorldGuide').then(m=>({default:m.EcosystemPanel})));
const ManagementPanel=lazy(()=>import('./ManagementPanel'));
const ModeHall=lazy(()=>import('./ModeHall'));
const ShoreMode=lazy(()=>import('./ShoreMode'));
const UnifiedJourney=lazy(()=>import('./UnifiedJourney').then(m=>({default:m.UnifiedJourney})));
const JournalApp=lazy(()=>import('../journal/JournalApp').then(m=>({default:m.JournalApp})));
type View = 'shore'|'management'|'home'|'hall'|'collection'|'world'|'ecosystem'|'journey'|'journal';
const navs: {id:View;label:string;icon:typeof Home;hidden?:boolean}[]=[{id:'shore',label:'雾隐浅滩',icon:MapIcon,hidden:true},{id:'home',label:'门庭',icon:Home},{id:'management',label:'灵境会馆',icon:Home},{id:'hall',label:'会馆日常',icon:Sprout},{id:'collection',label:'灵卡图鉴',icon:BookOpen},{id:'world',label:'万灵志',icon:BookOpen},{id:'ecosystem',label:'灵境生态',icon:Sprout}];
navs.push({id:'journey',label:'共同旅途',icon:BookOpen});
navs.splice(1,0,{id:'journal',label:'众生牌录',icon:ScrollText});
function readView():View {const id=location.hash.slice(1);return navs.some(n=>n.id===id)?id as View:'home';}
function Modal({title,children,onClose,className=''}:{title:string;children:React.ReactNode;onClose:()=>void;className?:string}) {const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const el=ref.current;el?.showModal();return()=>el?.close();},[]);return <dialog ref={ref} className={`game-modal ${className}`} onCancel={onClose}><div className="modal-head"><h2>{title}</h2><button aria-label="关闭" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;}
export default function GameApp({ onReturnGate, onCreateIdentity }: { onReturnGate?: () => void; onCreateIdentity?: () => void } = {}) {
  const balance=useCardBalance();
  const { account: ssoUser, identity: playerIdentity } = usePlayerProfile();
  const [save,setSave]=useState<SaveData>(freshSave);const [ready,setReady]=useState(false);const [saveStatus,setSaveStatus]=useState('读取存档');const [storageOK,setStorageOK]=useState(true);
  const [view,setView]=useState<View>(readView);const [modal,setModal]=useState<'help'|'identity'|'settings'|null>(()=>avatarPickInterrupted()?'identity':null);const [error,setError]=useState('');
  const [durableSave,setDurableSave]=useState<SaveData|null>(null);
  const pendingSave=useRef(Promise.resolve());const revision=useRef(0);
  useEffect(()=>{let active=true;readSave().then(s=>{if(active){setSave(s);setDurableSave(s);setReady(true);}}).catch(()=>{if(active){setStorageOK(false);setSaveStatus('存档不可用 · 可导出备份');setReady(true);setError('本地存档无法读取，已进入临时游玩模式；原存档不会被覆盖。');}});return()=>{active=false;};},[]);
  useEffect(()=>{if(!storageOK)return;let active=true;const refresh=()=>{if(!revision.current)return;setReady(false);pendingSave.current.then(()=>readSave()).then(s=>{if(active){setSave(s);setDurableSave(s);setReady(true);}}).catch(e=>{if(active){setReady(true);setError(e.message);}});};window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('focus',refresh);};},[storageOK]);
  useEffect(()=>{if(!ready||!storageOK)return;const rev=++revision.current;setSaveStatus('正在保存');pendingSave.current=pendingSave.current.catch(()=>{}).then(()=>writeSave(save)).then(()=>{setDurableSave(save);if(revision.current===rev)setSaveStatus('已自动保存');}).catch(()=>{setSaveStatus('保存失败 · 请导出备份');});},[save,ready,storageOK]);
  // Keep the current tab visible in the scrollable mobile nav.
  useEffect(()=>{const button=document.querySelector<HTMLElement>('.game-header nav button.active');const nav=button?.parentElement;if(button&&nav&&nav.scrollWidth>nav.clientWidth)nav.scrollTo({left:button.offsetLeft-(nav.clientWidth-button.offsetWidth)/2,behavior:'smooth'});},[view]);
  useEffect(()=>{const fn=()=>setView(readView());window.addEventListener('hashchange',fn);return()=>window.removeEventListener('hashchange',fn);},[]);

  useEffect(()=>{if(!error)return;const t=setTimeout(()=>setError(''),6000);return()=>clearTimeout(t);},[error]);
  registerEcoCards(save.meta.ecoIndividuals);
  function go(v:View){setView(v);location.hash=v;setModal(null);window.scrollTo({top:0,behavior:'smooth'});}
  function changeMeta(fn:(m:MetaState)=>MetaState){setSave(s=>{try{return {...s,meta:fn(s.meta)};}catch(e){setError((e as Error).message);return s;}});}
  function importEcology(value:unknown){
    if(!storageOK){setError('本地存档不可用，收获仍保存在生态中，请恢复存储后再送回。');return;}
    try{const packet=validateEcoExchange(value);setSave(s=>{try{return queueEcology(s,packet);}catch(e){setError((e as Error).message);return s;}});}catch(e){setError((e as Error).message);}
  }
  if(!ready)return <div className="qc-loading qc-loading--page" role="status">正在读取旅途存档…</div>;
  return <div className="zszm-game"><header className="game-header"><nav aria-label="游戏导航">{navs.filter(n=>!n.hidden).map(n=><button key={n.id} className={view===n.id?'active':''} aria-current={view===n.id?'page':undefined} onClick={()=>go(n.id)}><n.icon size={15}/>{n.label}</button>)}</nav><div className="game-header__links">{onReturnGate&&<button type="button" className="gate-return" onClick={onReturnGate} title="重看开场动画" aria-label="重看开场动画"><Clapperboard size={15}/><span>开场</span></button>}<button type="button" aria-label="设置" title="设置" onClick={()=>setModal('settings')}><Settings size={19}/></button><button className="help-button" aria-label="玩法说明" title="玩法说明" onClick={()=>setModal('help')}><CircleHelp size={19}/></button><button type="button" className="identity-entry" aria-label={`玩家形象：${playerIdentity.display_name || '旅人'}`} onClick={()=>setModal('identity')}><PlayerAvatar identity={playerIdentity}/><span>{playerIdentity.display_name || '形象'}</span></button></div></header>
    <main className={`game-main view-${view}`}><LoadBoundary resetKey={view}>
    {balance.error&&<div className="balance-warning" role="alert">{balance.error} 已暂停历练操作。<button className="secondary" disabled={balance.busy} onClick={()=>void balance.reload()}>重试连接</button></div>}
    <FeatureGuide view={view}/>
    {view==='home'&&<Suspense fallback={<p className="qc-loading" role="status">正在展开门庭…</p>}><ModeHall onNavigate={value=>go(value as View)} onEditIdentity={()=>setModal('identity')}/></Suspense>}
    {view==='shore'&&<Suspense fallback={<p className="qc-loading" role="status">正在进入浅滩…</p>}><ShoreMode onReturn={()=>go('home')}/></Suspense>}
    {view==='hall'&&<><div className="section-heading"><div><span className="eyebrow">A PLACE TO RETURN</span><h1>会馆日常</h1><p className="subtle">在这里，慢慢生长。默契满 9 后，可封灵成卡，带入下一次历练。</p></div><span className="day-label">第 {save.meta.day} 日 · 晴</span></div><div className="hall-scene"><Forest village/><div className="hall-overlay"><span>林间小馆</span><h2>山有木兮，灵有所栖。</h2><div className="resource-bar"><span><Sparkles size={17}/>灵质 {save.meta.spirit}</span><span><Sprout size={17}/>草药 {save.meta.herbs}</span><span>灵田 Lv.{save.meta.garden}</span></div></div></div><div className="hall-actions"><div><strong>安排今日的生活</strong><p>种植：草药 +{save.meta.garden*2}，默契 +1　·　修习：默契 +3　·　休息：灵质 +4</p></div><button className="primary" onClick={()=>changeMeta(advanceDay)}>度过一天 <ArrowRight size={17}/></button></div><div className="residents">{Object.values(HEROES).map(c=>{const r=save.meta.characters[c.id];return <article key={c.id}><div className="resident-head"><Portrait name={c.name}/><div><h3>{c.name}</h3><small>{r.sealed?'已结封灵之契':`默契 ${r.bond} / 9`}</small></div></div><label>日常安排<select aria-label={`${c.name}的日常安排`} value={r.assignment} onChange={e=>changeMeta(m=>({...m,characters:{...m.characters,[c.id]:{...m.characters[c.id],assignment:e.target.value as typeof r.assignment}}}))}><option value="garden">照看灵田</option><option value="practice">同行练习</option><option value="rest">林间休息</option></select></label><button className="secondary wide" disabled={r.sealed||r.bond<9||save.meta.spirit<12} onClick={()=>changeMeta(m=>sealCharacter(m,c.id))}>{r.sealed?<Check size={16}/>:<BookOpen size={16}/>} {r.sealed?'下一局可用「封灵之契」':'封灵成卡 · 12 灵质'}</button></article>;})}</div><div className="hall-upgrades"><div><h3>扩建灵田</h3><p>每位种植者的每日草药产量 +2，最高 3 级。</p><button className="secondary" disabled={save.meta.spirit<20||save.meta.herbs<8||save.meta.garden>=3} onClick={()=>changeMeta(m=>({...m,spirit:m.spirit-20,herbs:m.herbs-8,garden:m.garden+1}))}>{save.meta.garden>=3?'灵田已满级':'扩建 · 20 灵质 + 8 草药'}</button></div><div><h3>走进更大的灵境</h3><p>进入 3D 据点，安排建造、种植、研究与远征，接收生态资源。</p><button className="text-button" onClick={()=>go('management')}>进入据点经营 <ArrowRight size={16}/></button></div></div></>}
    {view==='collection'&&<CardCollection service={balance} individuals={save.meta.ecoIndividuals||[]} renderCard={(c,open)=><CardTile card={{card:c.id,uid:c.id,upgraded:false}} onClick={open}/>}/>}
    {view==='management'&&<Suspense fallback={<p className="qc-loading" role="status">正在打开据点…</p>}><ManagementPanel packets={durableSave?.ecoDeliveries||[]} onDelivered={(world,sequence)=>setSave(s=>acknowledgeDelivery(s,world,sequence))}/></Suspense>}
    {view==='world'&&<Suspense fallback={<p className="qc-loading" role="status">正在翻开万灵志…</p>}><WorldGuide/></Suspense>}
    {view==='journal'&&<Suspense fallback={<p className="qc-loading" role="status">正在翻开众生牌录…</p>}><JournalApp onOpenCollection={()=>go('collection')}/></Suspense>}
    {view==='journey'&&<Suspense fallback={<p className="qc-loading" role="status">正在翻开共同旅途…</p>}><UnifiedJourney/></Suspense>}
    {view==='ecosystem'&&<Suspense fallback={<p className="qc-loading" role="status">正在打开灵境…</p>}><EcosystemPanel meta={save.meta} receipts={durableSave?.meta.ecoReceipts||{}} pendingCount={save.ecoDeliveries?.length||0} onImport={importEcology} onError={setError}/></Suspense>}
    </LoadBoundary></main><footer className="game-footer"><div><span className="footer-mark">众生有灵 · 山水有期</span><small>罗小黑战记非商业同人项目 · IP 版权归原权利方所有</small></div><div className="footer-links"><span className="save-status" role="status"><i/>{saveStatus}</span><button onClick={()=>downloadJSON(save,'众生之门-旅途备份.json')} aria-label="导出完整存档"><Download size={16}/></button></div></footer>
    {error&&<div className="toast" role="alert">{error}<button aria-label="关闭提示" onClick={()=>setError('')}><X size={15}/></button></div>}
    {modal==='help'&&<Modal title="众生之门 · 功能手册" onClose={()=>setModal(null)}><FullGuide/><button className="primary" onClick={()=>setModal(null)}>明白了，出发吧 <ArrowRight size={17}/></button></Modal>}
    {modal==='settings'&&<Modal title="设置" className="gate-install-settings-dialog" onClose={()=>setModal(null)}><section className="gate-install-settings"><h3>使用帮助</h3><p>查看 iPhone / iPad 和安卓手机的桌面安装步骤。</p><button type="button" className="secondary" onClick={()=>{setModal(null);window.dispatchEvent(new Event('gate:open-install'));}}>添加到桌面 <ArrowRight size={17}/></button></section></Modal>}
    {modal==='identity'&&<PlayerIdentity key={ssoUser.logged_in?`${ssoUser.kind}:${ssoUser.user_id}`:'anonymous'} account={ssoUser} onClose={()=>setModal(null)} onCreateWithOpening={onCreateIdentity&&(()=>{setModal(null);onCreateIdentity();})}/>}
  </div>;
}
