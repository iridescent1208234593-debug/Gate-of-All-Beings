import { useEffect, useRef, useState } from 'react';
import facts from '@lxh/shared-data/worldview.json';
import { ABILITY_SYSTEMS, ELEMENTS } from '@lxh/shared-types/world';
import type { MetaState } from './core/types';
import { CARDS } from './core/content';

export function WorldGuide() {
  const [tab,setTab]=useState('角色');
  const [query,setQuery]=useState('');
  const [limit,setLimit]=useState(36);
  const items=tab==='角色'?facts.characters.map(c=>({id:c.id,title:c.name,tag:c.species||'角色',text:c.abilities.join('；')||'暂无能力记录',detail:c.affiliation,url:c.sourceUrl})):
    tab==='地点'?facts.locations.map(l=>({id:l.id,title:l.name,tag:l.type||'地点',text:l.description||'',detail:'',url:''})):
    tab==='纪事'?facts.timeline.map(t=>({id:t.id,title:t.event,tag:t.era,text:t.description,detail:t.relatedCharacters,url:''})):
    facts.terms.filter(t=>tab==='灵物'?t.category==='法器灵物':t.category!=='法器灵物').map(t=>({id:t.id,title:t.term,tag:t.category,text:t.definition||'',detail:'',url:''}));
  const matches=items.filter(i=>(i.title+i.tag+i.text).toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="world-guide"><div className="section-heading"><div><span className="eyebrow">ATLAS OF ALL BEINGS</span><h1>万灵志</h1><p className="subtle">从人物、灵术与山川，认识这片世界。</p></div><span className="guide-count">{facts.characters.length} 位角色 · {facts.locations.length} 处地点</span></div>
    <div className="world-vocabulary"><div><small>六大系</small>{Object.values(ABILITY_SYSTEMS).map(s=><span key={s}>{s}</span>)}</div><div><small>御灵五行</small>{Object.values(ELEMENTS).map(s=><span key={s}>{s}</span>)}</div></div>
    <div className="guide-tools"><div className="filter-row">{['角色','地点','灵物','设定','纪事'].map(x=><button key={x} aria-pressed={tab===x} className={tab===x?'selected':''} onClick={()=>{setTab(x);setLimit(36);}}>{x}</button>)}</div><input aria-label="搜索万灵志" placeholder="寻找一个名字、一种能力…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(36);}}/></div>
    <p className="subtle">找到 {matches.length} 条{tab==='纪事'?' · 纪事保留资料中的时间表述':''}</p>
    <div className="guide-grid">{matches.slice(0,limit).map(i=><article key={i.id}><small>{i.tag}</small><h2>{i.title}</h2><p>{i.text.slice(0,240)}{i.text.length>240?'…':''}</p>{i.detail&&<p className="guide-detail">{i.detail}</p>}{/^https?:\/\//.test(i.url)&&<a href={i.url} target="_blank" rel="noreferrer">查看资料出处 ↗</a>}</article>)}</div>
    {matches.length>limit&&<button className="secondary" onClick={()=>setLimit(limit+36)}>继续翻阅</button>}
  </section>;
}

export function EcosystemPanel({meta,receipts,pendingCount,onImport,onError}:{meta:MetaState;receipts:Record<string,number>;pendingCount:number;onImport:(value:unknown)=>void;onError:(message:string)=>void}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const latest=useRef({receipts,onImport});latest.current={receipts,onImport};
  const lastPacket=useRef<{worldId:string;sequence:number}|null>(null);
  function acknowledge(){const p=lastPacket.current;if(p&&(latest.current.receipts[p.worldId]||0)>=p.sequence)frame.current?.contentWindow?.postMessage({type:'zszm:eco-accepted',worldId:p.worldId,sequence:p.sequence},location.origin);}
  useEffect(()=>{const receive=(e:MessageEvent)=>{
    if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||e.data?.type!=='zszm:eco-harvest')return;
    const p=e.data.packet;lastPacket.current=p;
    if(p&&(latest.current.receipts[p.worldId]||0)>=p.sequence){acknowledge();return;}
    latest.current.onImport(p);
  };window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
  useEffect(acknowledge,[receipts]);
  return <section><div className="section-heading"><div><span className="eyebrow">A SMALL LIVING WORLD</span><h1>一方灵境</h1><p className="subtle">观察生长与迁徙，把灵境的馈赠带回会馆。</p></div><a className="text-button" href="/ecology/index.html" target="_blank" rel="noreferrer">独立打开 ↗</a></div>
    <div className="ecology-summary"><span>已结缘 <b>{meta.ecoIndividuals?.length||0}</b> 个生灵</span><span>待入库 <b>{pendingCount}</b> 批</span><a href="#management">查看据点库存 →</a></div>
    <iframe className="ecology-frame" ref={frame} src="/ecology/index.html" title="灵境生态模拟" allow="fullscreen"/>
    <div className="ecology-import"><div><h3>将观测化成灵卡</h3><p>每次收获记录至多 12 个存活个体，按体型、速度、活力生成专属灵卡。下一次历练可在奖励中获得；食物、草药与灵质进入据点库存。</p><p>{(meta.ecoCards||[]).map(id=>CARDS[id]?.name).filter(Boolean).join(' · ')||'还没有结缘的生灵。'}</p></div>
      <label className="secondary file-label">导入灵境收获<input type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>50000)throw new Error('收获文件过大。');onImport(JSON.parse(await file.text()));}catch(err){onError((err as Error).message);}e.target.value='';}}/></label></div>
  </section>;
}
