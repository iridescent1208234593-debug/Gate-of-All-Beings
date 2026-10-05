import {useEffect,useRef,useState,type ReactNode} from 'react';
import {BASE_CARDS,CARDS,HEROES} from './core/content';
import {balanceOf,applyBalance,validateBalance,EFFECT_FIELDS,type CardBalance} from './core/cardBalance';
import {ecologyCard} from './core/ecologyCards';
import {cardText} from './core/cardText';
import type {Card} from './core/types';
import type {EcoIndividual} from '@lxh/shared-types/models';
import type {CardBalanceService} from './useCardBalance';
import {downloadJSON} from './storage';
import './card-admin.css';

export function CardCollection({service,individuals,renderCard}:{service:CardBalanceService;individuals:EcoIndividual[];renderCard:(card:Card,open:()=>void)=>ReactNode}){
  const [search,setSearch]=useState(''),[owner,setOwner]=useState('全部'),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');
  const cards=Object.values(CARDS).filter(c=>(owner==='全部'||(c.owner==='all'?'通用':HEROES[c.owner].name)===owner)&&`${c.name} ${c.id} ${c.text}`.toLowerCase().includes(search.toLowerCase()));
  const card=selected?CARDS[selected]:undefined,individual=individuals.find(i=>i.id===selected);
  return <section className="card-library"><div className="section-heading"><div><span className="eyebrow">SPIRIT CARD COLLECTION</span><h1>灵卡图鉴</h1><p className="subtle">收录 {Object.keys(CARDS).length} 张灵卡 · 点击卡牌查看效果、调整数值。</p></div><button className="secondary" onClick={()=>void service.reload()} disabled={service.busy}>重新加载配置</button></div>
    <div className="balance-status"><span role="status">{service.busy?'正在连接数值后台…':service.error||`数值配置已连接 · 版本 ${service.snapshot?.revision??0} · ${Object.keys(service.snapshot?.overrides||{}).length} 张已调整`}</span><span>{service.snapshot?.editable?'本机可编辑':'只读模式 · 本机打开后可调整'}</span>{service.snapshot?.backup&&<button className="text-button" onClick={()=>downloadJSON(service.snapshot!.backup,'card-balance-export.json')}>导出数值备份</button>}</div>
    {notice&&<p className="admin-notice" role="status">{notice}</p>}
    <div className="card-search"><label>搜索灵卡<input type="search" placeholder="名称、效果或编号" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>适用同行者<select value={owner} onChange={e=>setOwner(e.target.value)}>{['全部','罗小黑','无限','风息','通用'].map(x=><option key={x}>{x}</option>)}</select></label><span>显示 {cards.length} 张</span></div>
    <div className="collection-grid">{cards.map(c=><div key={c.id} className="collection-entry">{renderCard(c,()=>{setSelected(c.id);setNotice('');})}{service.snapshot?.overrides[c.id]&&<span className="adjusted-badge">已调整</span>}</div>)}</div>
    {!cards.length&&<p>没有找到匹配的灵卡，试试其他名称或筛选。</p>}
    {card&&<CardEditor key={card.id} card={card} base={BASE_CARDS[card.id]||(individual?ecologyCard(individual):card)} individual={individual} service={service} onClose={()=>setSelected(null)} onSaved={message=>setNotice(message)}/>}
  </section>;
}
function CardEditor({card,base,individual,service,onClose,onSaved}:{card:Card;base:Card;individual?:EcoIndividual;service:CardBalanceService;onClose:()=>void;onSaved:(message:string)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[draft,setDraft]=useState<CardBalance>(()=>balanceOf(card)),[saving,setSaving]=useState(false),[error,setError]=useState(''),[showAll,setShowAll]=useState(false);
  const editable=!!service.snapshot?.editable&&!service.error;
  useEffect(()=>{dialog.current?.showModal();const element=dialog.current;return()=>element?.close();},[]);
  let validation='',preview=card;try{preview=applyBalance(base,validateBalance(draft));}catch(e){validation=(e as Error).message;}
  const fields=EFFECT_FIELDS.filter(f=>showAll||Object.hasOwn(draft.effect,f.key)||Object.hasOwn(base.effect,f.key));
  async function submit(reset=false){setSaving(true);setError('');try{await service.save(card.id,reset?null:draft,individual);onSaved(reset?`${card.name}已恢复默认并保存。`:`${card.name}数值已保存，后续出牌使用新配置。`);onClose();}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
  return <dialog ref={dialog} className="game-modal card-editor" onCancel={e=>{e.preventDefault();if(!saving)onClose();}}><div className="modal-head"><div><small>灵卡数值管理</small><h2>{card.name}</h2></div><button aria-label="关闭数值管理" disabled={saving} onClick={onClose}>×</button></div>
    <p className="subtle">{card.source||'基础灵术'} · {card.id}</p>
    <div className="card-preview" aria-label="效果预览"><span>灵力消耗 <b>{Number.isFinite(draft.cost)?draft.cost:'—'}</b></span><p>{validation?'请先修正下方数值。':cardText(preview)}</p></div>
    <p className="admin-scope">保存后更新这张卡的基础配置，影响本页后续出牌；已造成的伤害、已获得的状态不回算。其他页面需重新加载。精进加成保持原规则。</p>
    <form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={!editable||saving}><legend>使用规则</legend><div className="admin-fields">
      <label>灵力消耗<input aria-label="灵力消耗" type="number" min="0" max="10" step="1" required value={Number.isFinite(draft.cost)?draft.cost:''} onChange={e=>setDraft({...draft,cost:e.target.valueAsNumber})}/><small>0–10；每回合默认恢复 3 灵力。</small></label>
      <label>作用目标<select value={draft.target} onChange={e=>setDraft({...draft,target:e.target.value as CardBalance['target']})}><option value="single">单个敌人</option><option value="all">全部敌人</option></select><small>只扩展敌方效果，自身增益仍结算一次。</small></label>
      <label>出牌条件<select value={draft.condition} onChange={e=>setDraft({...draft,condition:e.target.value as CardBalance['condition']})}><option value="none">无额外条件</option><option value="belowHalf">生命低于一半</option><option value="attacksOnly">手牌全为攻击牌</option></select></label>
      <label className="admin-checkbox"><span><input type="checkbox" checked={draft.exhaust} onChange={e=>setDraft({...draft,exhaust:e.target.checked})}/>使用后消耗</span><small>本场战斗不再抽到，下场恢复。</small></label>
    </div></fieldset><fieldset disabled={!editable||saving}><legend>效果数值</legend><p className="subtle">设为 0 关闭该效果。每个字段旁都列出实际结算方式。</p><div className="admin-fields">{fields.map(field=><label key={field.key}>{field.label}<input aria-label={field.label} type="number" min="0" max={field.max} step="1" required value={Number.isFinite(draft.effect[field.key]??0)?draft.effect[field.key]??0:''} onChange={e=>setDraft({...draft,effect:{...draft.effect,[field.key]:e.target.valueAsNumber}})}/><small>{field.help} 范围 0–{field.max}。</small></label>)}</div><button type="button" className="text-button" onClick={()=>setShowAll(!showAll)}>{showAll?'只看已有效果':`显示全部 ${EFFECT_FIELDS.length} 种效果`}</button></fieldset>
      {(error||validation)&&<p className="admin-error" role="alert">{error||validation}</p>}
      {!editable&&<p role="status">{service.error||'当前为只读模式，请在运行后台的本机打开页面。'}</p>}
      {error&&<button type="button" className="secondary" disabled={saving} onClick={()=>{onClose();void service.reload();}}>取消草稿并重新加载配置</button>}
      <div className="admin-actions"><button type="submit" className="primary" disabled={!editable||saving||!!validation}>{saving?'正在保存…':'保存数值'}</button><button type="button" className="secondary" disabled={!editable||saving} onClick={()=>void submit(true)}>恢复默认并保存</button><button type="button" className="text-button" disabled={saving} onClick={onClose}>取消修改</button></div>
    </form><details className="admin-defaults"><summary>查看原始配置与获取方式</summary><p>默认灵力消耗 {base.cost} · {cardText(base)}</p><p>{card.id.startsWith('eco-')?'生态结缘解锁后，下一次历练才加入奖励池；调数值不会自动获得卡牌。':card.id.startsWith('legacy-')?'旧版灵术依六系、五行和同行者能力筛选进入奖励池。':'基础灵术按同行者进入初始牌组或奖励池；封灵之契需要在会馆日常封灵。'}</p><p>每次保存、恢复默认都由后台备份上一版。备份不含浏览器的旅途进度。</p></details>
  </dialog>;
}
