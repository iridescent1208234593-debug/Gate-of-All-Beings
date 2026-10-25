import siteDomains from '../../../../../../shared/site-domains.mjs';
export function mountEcologyImport(dispatch){
 const bar=document.createElement('div');bar.id='ecology-import';
 bar.innerHTML=`<a href="${siteDomains.url('zszm', '/#ecosystem')}" target="_blank" rel="noreferrer">灵境生态 ↗</a><label>导入生态收获 ＋<input type="file" aria-label="导入生态收获" accept=".json,application/json"></label><span role="status"></span>`;
 document.querySelector('#hud').after(bar);
 if(parent!==window){const link=bar.querySelector('a');link.href='/#ecosystem';link.target='_parent';}
 bar.querySelector('input').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>50000)throw Error('收获文件过大。');dispatch({type:'IMPORT_ECOLOGY',packet:JSON.parse(await f.text())});bar.querySelector('[role=status]').textContent='收获已入库并保存。';}catch(err){bar.querySelector('[role=status]').textContent=err.message;}e.target.value='';};
}
