/* Optional DOM regression (jsdom required in NODE_PATH). No browser/network or active payloads. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const sample = '保留 "双引号" 与 \'单引号\' (内文) &amp; 字面';
const open = name => {
  const html = fs.readFileSync(path.resolve(__dirname,'../'+name+'.html'),'utf8');
  const {window} = new JSDOM(html,{url:'https://hall.example.test',runScripts:'outside-only'});
  return {html,window,doc:window.document};
};
function section(html,start,end){
  const i=html.indexOf(start), j=html.indexOf(end,i+start.length);
  assert(i>=0 && j>i);
  return html.slice(i,j);
}
(async()=> {
  const {html,window:w,doc:d}=open('member');
  w.sample=sample;
  w.eval(section(html,'function esc(s)','init();') + `
    window.observed=[];
    upd=(...args)=>observed.push(args);
    resetPwd=(...args)=>observed.push(args);
    myScope='all';
    users=[{kind:'local',uid:sample,nickname:sample,role:'executor'}];
    render();`);
  const role=d.querySelector('select[data-member-field=role]');
  assert.equal(role.dataset.uid,sample);
  assert.equal(role.getAttribute('onchange'),null);
  role.value='elder';
  role.dispatchEvent(new w.Event('change',{bubbles:true}));
  const reset=d.querySelector('[data-member-action=reset]');
  assert.equal(reset.getAttribute('onclick'),null);
  reset.click();
  assert.deepEqual(JSON.parse(JSON.stringify(w.observed)),[['local',sample,'role','elder'],['local',sample,sample]]);
  const expand=d.querySelector('[data-member-action=sheets]');
  assert.equal(expand.dataset.key,'local:'+sample);
  expand.click();
  assert(d.querySelector('.sheet-row'));
  w.close();

  const c=open('char');
  c.doc.body.insertAdjacentHTML('beforeend', section(c.html,'<div id="mergeMgr"','        </div>\n      </div>\n      <div id="delModal"'));
  c.window.fetch=async()=>({json:async()=>({characters:[{id:8,name:sample,type:'fixture'}]})});
  c.window.eval(section(c.html,'function esc(s)','\n') + '\n' +
    section(c.html,'function escAttr(s)','\n') + '\nlet _editCharId=1,_mergeTarget=null;\n' +
    section(c.html,'function initMerge(','async function doMerge(') + '\nwindow.run=()=>{initMerge("原角色");return mergeSearch("fixture")};');
  await c.window.run();
  const pick=c.doc.querySelector('button[data-merge-id]');
  assert.equal(pick.dataset.mergeName,sample);
  assert.equal(pick.getAttribute('onclick'),null);
  pick.click();
  assert.equal(c.doc.querySelector('#mergeTarget b').textContent,sample);
  c.window.close();

  const work=open('works'); let calls=0;
  work.window.eval(section(work.html,'function setState(','// ----------'));
  const state=work.doc.querySelector('#listState');
  work.window.setState(state,sample,'alert',()=>calls++);
  assert.match(state.textContent,/&amp;/);
  const retry=state.querySelector('button');
  assert.equal(retry.getAttribute('onclick'),null);
  retry.click();
  assert.equal(calls,1);
  work.window.close();

  const admin=open('admin');
  assert(!admin.html.includes('onchange="setRole('));
  admin.window.close();
  console.log('PASS: opaque member/name data, delegated actions and retry callback');
})().catch(e=>{console.error(e);process.exitCode=1});
