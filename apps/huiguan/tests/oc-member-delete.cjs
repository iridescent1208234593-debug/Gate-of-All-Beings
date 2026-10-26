const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname,'../member.html'),'utf8');
const start = page.indexOf('async function delSheet(');
const end = page.indexOf('\nasync function delPoster(',start);
assert.ok(start >= 0 && end > start);

async function exercise(status, revision, confirm = true) {
  const calls = [], errors = {textContent:''};
  let alerts = 0, refreshes = 0;
  const context = {confirm:()=>confirm, alert:()=>alerts++, loadedChars:true,
    document:{getElementById:()=>errors},
    loadUsers:async()=>{refreshes++; errors.textContent='';},
    fetch:async(url, request)=>{calls.push({url,body:JSON.parse(request.body)});return {
      status,ok:status===200,json:async()=>status===200?{ok:true,removed:1}:{error:'oc_version_conflict'}
    };}
  };
  vm.createContext(context);vm.runInContext(page.slice(start,end),context);
  await context.delSheet('local:7','C','测试设表',revision);
  return {calls,errors,alerts,refreshes,context};
}
(async()=>{
  const success = await exercise(200,'7');
  assert.equal(success.calls[0].body.version,7);
  assert.equal(success.calls[0].body.key,'local:7');
  assert.equal(success.alerts,1);assert.equal(success.refreshes,1);assert.equal(success.context.loadedChars,false);
  const conflict = await exercise(409,'7');
  assert.equal(conflict.calls.length,1);assert.equal(conflict.alerts,0);assert.equal(conflict.refreshes,1);
  assert.match(conflict.errors.textContent,/已更新|重新确认/);
  const missing = await exercise(428,'');
  assert.equal('version' in missing.calls[0].body,false);assert.equal(missing.refreshes,1);
  const legacy = await exercise(200,'');
  assert.equal('version' in legacy.calls[0].body,false);
  assert.equal((await exercise(200,'7',false)).calls.length,0);
  assert.match(page,/data-version=/);assert.match(page,/this\.dataset\.version/);
  console.log('Member delete revision transport, refresh and conflict handling: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
