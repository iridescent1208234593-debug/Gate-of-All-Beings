import {useEffect,useRef,useState} from 'react';
import type {EcoExchange} from '@lxh/shared-types/models';

export default function ManagementPanel({packets,onDelivered}:{packets:EcoExchange[];onDelivered:(worldId:string,sequence:number)=>void}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const [status,setStatus]=useState('正在恢复据点存档…');
  const [inventory,setInventory]=useState<Record<string,number>|null>(null);
  const latest=useRef({packets,onDelivered});latest.current={packets,onDelivered};
  const ready=useRef(false);
  function send(){if(ready.current&&latest.current.packets.length)frame.current?.contentWindow?.postMessage({type:'zszm:deliver-ecology',packet:latest.current.packets[0]},location.origin);}
  useEffect(()=>{
    const receive=(e:MessageEvent)=>{
      if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;
      if(e.data?.type==='zszm:management-ready'){ready.current=true;setStatus('据点已就绪');setInventory(e.data.resources);send();}
      if(e.data?.type==='zszm:delivery-received'){
        const p=latest.current.packets.find(p=>p.worldId===e.data.worldId&&p.sequence===e.data.sequence);
        if(p){latest.current.onDelivered(p.worldId,p.sequence);setStatus(`第 ${p.sequence} 批收获已入库并保存`);setInventory(e.data.resources);}
      }
      if(e.data?.type==='zszm:delivery-error')setStatus(e.data.message||'入库失败，收获已保留，将自动重试');
    };
    window.addEventListener('message',receive);const retry=setInterval(send,3000);
    return()=>{window.removeEventListener('message',receive);clearInterval(retry);};
  },[]);
  useEffect(send,[packets]);
  return <section><div className="section-heading"><div><span className="eyebrow">A HOME FOR ALL BEINGS</span><h1>据点经营</h1><p className="subtle">建造、种植、安顿居民，让一方灵境成为归处。</p></div><a className="text-button" href="/management/index.html" target="_blank" rel="noreferrer">独立打开 ↗</a></div>
    <div className="ecology-summary"><span role="status">{status}</span><span>待入库 {packets.length} 批</span>{inventory&&<span>最近入库后：粮 {inventory.food||0} · 药 {inventory.herb||0} · 灵 {inventory.spirit||0}</span>}<a href="#ecosystem">前往灵境收获 →</a></div>
    <iframe ref={frame} className="ecology-frame management-frame" src="/management/index.html?embed=1" title="灵境据点经营" allow="fullscreen" onLoad={()=>{ready.current=false;frame.current?.contentWindow?.postMessage({type:'zszm:management-ping'},location.origin);}}/>
  </section>;
}
