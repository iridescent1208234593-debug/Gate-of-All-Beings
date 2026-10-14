import { ELEMENTS } from '@lxh/shared-types/world';
import { saveWorld, encodeWorld } from '../core/persistence.js';
import './unified.css';
import '@lxh/shared-ui/lxh-ui.js';

function download(value,name){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function mountSpacePanel(getState,dispatch,initialError='') {
  const events = new AbortController();
  const panel=document.createElement('section');panel.id='ling-space';
  panel.innerHTML=`<div class="space-heading"><strong>一方灵境</strong><button id="eco-details" type="button">观测面板</button></div><p>物质灵滋养植物，生灵随生命流动，分解者使残余归还环境。</p><div id="ling-metrics"></div><label>属性偏向 <select id="space-element">${Object.entries(ELEMENTS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>灵质浓度 <input id="space-density" type="range" min="0.25" max="3" step="0.25" value="1"/></label><div class="space-actions"><button id="eco-harvest" type="button">收获并送回会馆</button><button id="eco-download" type="button">下载本次收获</button><button id="eco-save" type="button">导出生态存档</button><button id="eco-reseed" type="button">自动补种：关</button></div><small id="eco-status" role="status"></small>`;
  document.body.append(panel);
  const status=panel.querySelector('#eco-status');status.textContent=initialError;
  const report=e=>{status.textContent=e.message||String(e);};
  const headingIcon=document.createElement('span');headingIcon.className='space-icon';headingIcon.innerHTML=window.LXHUI.ICONS.radar;panel.querySelector('.space-heading').prepend(headingIcon);
  let lastSend=0;
  const sendPending=()=>{const packet=getState().ecology.pendingExports?.[0];if(packet&&parent!==window){parent.postMessage({type:'zszm:eco-harvest',packet},location.origin);lastSend=performance.now();}};
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='zszm:eco-accepted')return;
    const packet=getState().ecology.pendingExports?.find(p=>p.worldId===e.data.worldId&&p.sequence===e.data.sequence);
    if(!packet)return;
    try{dispatch({type:'ACK_HARVEST',worldId:packet.worldId,sequence:packet.sequence});status.textContent=`第 ${packet.sequence} 批已送回主入口，打开据点即可入库；${packet.individuals?.length||0} 个生灵已结缘。`;sendPending();}catch(err){report(err);}
  }, { signal: events.signal });
  panel.querySelector('#eco-details').onclick=()=>document.body.classList.toggle('show-observations');
  const change=()=>dispatch({type:'SET_SPACE',element:panel.querySelector('#space-element').value,concentration:Number(panel.querySelector('#space-density').value)});
  panel.querySelector('#space-element').value=getState().space.element;
  panel.querySelector('#space-density').value=String(getState().space.concentration);
  panel.querySelector('#space-element').onchange=change;panel.querySelector('#space-density').onchange=change;
  panel.querySelector('#eco-harvest').onclick=()=>{try{dispatch({type:'HARVEST'});const s=getState();sendPending();status.textContent=`第 ${s.ecology.sequence} 批已保存，${s.ecology.lastExport.individuals.length} 个生灵待结缘。${parent===window?'可下载 JSON 后在主入口导入。':'正在送回主入口…'}`;}catch(e){report(e);}};
  panel.querySelector('#eco-download').onclick=()=>{const packet=getState().ecology.lastExport;if(!packet){report(new Error('请先收获。'));return;}download(packet,`灵境收获-${packet.sequence}.json`);};
  panel.querySelector('#eco-save').onclick=()=>download(encodeWorld(getState()),'灵境生态存档.json');
  panel.querySelector('#eco-reseed').onclick=()=>dispatch({type:'TOGGLE_RESEED'});
  let lastSave=performance.now();
  let saveDisabled=!!initialError;
  return {update(){
    const s=getState(),v=s.space,h=s.ecology.harvest;
    if(performance.now()-lastSend>3000)sendPending();
    panel.querySelector('#ling-metrics').textContent=`物质灵 ${v.materialLing.toFixed(1)} · 生灵 ${v.lifeLing.toFixed(1)}\n分解者 ${v.decomposers.toFixed(1)} · 待分解 ${v.detritus.toFixed(1)}\n可收获：食物 ${Math.floor(h.food)} / 草药 ${Math.floor(h.herb)} / 灵质 ${Math.floor(h.spirit)}`;
    panel.querySelector('#eco-reseed').textContent=`自动补种：${s.settings.reseed?'开（演示辅助）':'关'}`;
    if(!saveDisabled&&performance.now()-lastSave>5000){try{saveWorld(s);lastSave=performance.now();}catch(e){saveDisabled=true;report(new Error('自动保存不可用，请导出生态存档。'));}}
  },dispose(){events.abort();panel.remove();document.body.classList.remove('show-observations');}};
}
