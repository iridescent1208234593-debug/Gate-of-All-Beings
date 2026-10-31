import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMiniGames } from '../build.mjs';
import { LoginRequired, AccountChanged, loadOwnedOCs, imageChoices, readProgress, saveProgress } from '../src/platform.js';

const identity=uid=>({logged_in:true,owner:{kind:'local',user_id:uid}});
function fetchSequence(values){return async()=>{const v=values.shift();if(v instanceof Error)throw v;return {status:200,ok:true,json:async()=>v};};}
test('OC list is only accepted when identity before and after matches',async()=>{
  const data=await loadOwnedOCs(fetchSequence([identity('a'),{ocs:[{id:'one',name:'小禾',images:[]},{id:'one',name:'duplicate'}]},identity('a')]));
  assert.equal(data.owner,'local:a');assert.equal(data.ocs.length,1);
  await assert.rejects(loadOwnedOCs(fetchSequence([identity('a'),{ocs:[]},identity('b')])),AccountChanged);
});
test('guest, request failure and malformed lists are distinct from an empty OC list',async()=>{
  await assert.rejects(loadOwnedOCs(fetchSequence([{logged_in:false}])),LoginRequired);
  await assert.rejects(loadOwnedOCs(fetchSequence([new Error('offline')])),/offline/);
  await assert.rejects(loadOwnedOCs(fetchSequence([identity('a'),{},identity('a')])),/格式异常/);
  assert.deepEqual((await loadOwnedOCs(fetchSequence([identity('a'),{ocs:[]},identity('a')]))).ocs,[]);
});
test('image IDs use preview URLs; other roots and executable URLs are rejected',()=>{
  const urls=imageChoices({images:['/assets/uploads/oc.webp','https://huiguan.iridescently.cn/assets/uploads/other.webp','javascript:alert(1)','https://untrusted.test/test.png','/assets/test.png']},'https://zszm.iridescently.xyz/','https://huiguan.iridescently.xyz');
  assert.deepEqual(urls,['https://huiguan.iridescently.xyz/api/uploads/preview?name=oc.webp','https://zszm.iridescently.xyz/assets/test.png']);
});
test('records are isolated by owner and game, and best scores cannot decrease',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  saveProgress(storage,'local:a','oc-run',{best:40,selectedOc:'one'});
  saveProgress(storage,'local:a','oc-run',{best:5});
  assert.equal(readProgress(storage,'local:a','oc-run').best,40);
  assert.equal(readProgress(storage,'local:b','oc-run').best,0);
  assert.equal(readProgress(storage,'local:a','frog-crossing').best,0);
});
test('corrupt records and quota failure surface without replacing old data',()=>{
  let text='{broken';const storage={getItem:()=>text,setItem:()=>{throw new Error('quota');}};
  assert.throws(()=>saveProgress(storage,'a','oc-run',{best:8}),/无法读取/);assert.equal(text,'{broken');
  text=null;assert.throws(()=>saveProgress(storage,'a','oc-run',{best:8}),/quota/);
});
test('standalone build includes both engines and original artwork, excludes tools and metadata',()=>{
  const output=mkdtempSync(path.join(tmpdir(),'gate-mini-games-test-'));
  try{
    buildMiniGames(output);
    for(const name of ['index.html','style.css','src/app.js','src/runner.js','src/crossing.js','assets/default-character.png'])assert.equal(existsSync(path.join(output,name)),true);
    for(const name of ['tests','README.md','package.json','SOURCE.json','build.mjs'])assert.equal(existsSync(path.join(output,name)),false);
    assert.ok(existsSync(path.join(output,'src/coins.js')));
    assert.ok(readFileSync(path.join(output,'index.html'),'utf8').includes('./src/app.js'));
    assert.throws(()=>buildMiniGames(fileURLToPath(new URL('..',import.meta.url))),/outside/);
  }finally{rmSync(output,{recursive:true,force:true});}
});
