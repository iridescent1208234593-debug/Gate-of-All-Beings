import {useState} from 'react';
import {characters,facts} from '@lxh/shared-data/catalog.js';
import catalogue from '@lxh/shared-data/cards-data.js';
import {exportGame} from '@lxh/shared-session/game.js';
import {useGameProfile,ResourceBar} from './SharedResources';
import {downloadJSON} from './storage';
import './journey.css';
export function UnifiedJourney(){
  const {profile,error,setError}=useGameProfile();
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState<'characters'|'cards'>('characters'),[limit,setLimit]=useState(24);
  const needle=query.trim().toLowerCase();
  const roster=characters.filter(c=>(c.name+c.aliases+c.abilitiesSummary).toLowerCase().includes(needle));
  const cards=catalogue.cards.filter(c=>(c.name+c.text).toLowerCase().includes(needle));
  const count=tab==='characters'?roster.length:cards.length;
  async function backup(){try{downloadJSON(await exportGame(),'众生之门-共同旅途.json');}catch(e){setError((e as Error).message);}}
  return <section className="world-guide journey-view" aria-labelledby="journey-title">
    <div className="section-heading"><div><span className="eyebrow">ONE WORLD · MANY JOURNEYS</span><h1 id="journey-title">共同旅途</h1><p>每一段历练，都在同一片天地里留下回响。</p></div><button className="secondary" onClick={backup}>导出共同旅途</button></div>
    <ResourceBar profile={profile}/>{error&&<p role="alert">{error}</p>}
    <p className="subtle">{characters.length} 位角色 · {catalogue.cards.length} 张灵卡 · 已接入 {Object.keys(profile?.modes||{}).length} 种玩法。进度保存在当前浏览器，同一站点内共享。</p>
    <div className="guide-tools"><div className="filter-row"><button className={tab==='characters'?'selected':''} aria-pressed={tab==='characters'} onClick={()=>{setTab('characters');setLimit(24);}}>同行名册</button><button className={tab==='cards'?'selected':''} aria-pressed={tab==='cards'} onClick={()=>{setTab('cards');setLimit(24);}}>灵卡总册</button></div><input aria-label="搜索共同旅途" value={query} placeholder="寻找名字或灵术…" onChange={e=>{setQuery(e.target.value);setLimit(24);}}/></div>
    <div className="guide-grid">{tab==='characters'?roster.slice(0,limit).map(c=>{const state=profile?.characters[c.id];return <article key={c.id}><span className="guide-tag">{state?.discovered?'已结缘':'尚待相遇'} · {c.category||'角色'}</span><h2>{c.name}</h2><p>{c.abilitiesSummary||c.abilities.join('；')||'暂无能力资料'}</p>{state&&<small>默契 {state.bond||0} · {(state.deaths||0)>=2?'已陨落':state.deaths===1?'重伤':'可同行'}</small>}<p className="guide-detail">演武推导 · {c.balance.rarity} / {c.balance.tier} · 战力 {c.balance.power}（游戏数值）</p></article>;}):cards.slice(0,limit).map(c=><article key={c.id}><span className="guide-tag">{c.mode==='cards'?'入世历练':'重生之门'} · 消耗 {c.cost}</span><h2>{c.name}</h2><p>{c.text}</p><small>{c.type}</small></article>)}</div>
    {count>limit&&<button className="secondary" onClick={()=>setLimit(limit+24)}>继续翻阅 · 还有 {count-limit} 项</button>}
    <details><summary>数据来源</summary><p>角色来自世界观数据库，已合并的旧 ID 保留跳转。数据批次：{facts.provenance.source}。演武战力是独立游戏模型推导值。</p></details>
  </section>;
}
