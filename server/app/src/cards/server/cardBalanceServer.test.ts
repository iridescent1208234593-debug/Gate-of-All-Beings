import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {request as httpRequest,createServer} from 'node:http';
import {createCardBalanceApi,CardBalanceStore} from './cardBalanceServer';
import {BASE_CARDS} from '../src/game/core/content';
import {balanceOf,validateBalance} from '../src/game/core/cardBalance';

test('every shipped card has a valid editable numeric definition',()=>{
  for(const card of Object.values(BASE_CARDS))assert.doesNotThrow(()=>validateBalance(balanceOf(card)),card.id);
});
test('saved configuration survives backend recreation, backs up and resets a single card',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'zszm-balance-'));
  try{
    const store=new CardBalanceStore(directory),value={...balanceOf(BASE_CARDS.claw),cost:2,effect:{damage:17}};
    const next=await store.update('claw',0,value);assert.equal(next.revision,1);
    const restarted=new CardBalanceStore(directory);assert.deepEqual((await restarted.read()).overrides.claw,value);
    await restarted.update('guard',1,{...balanceOf(BASE_CARDS.guard),effect:{block:12}});
    const reset=await restarted.update('claw',2,null);assert.equal(reset.overrides.claw,undefined);assert.equal(reset.overrides.guard.effect.block,12);
    const backups=await readdir(path.join(directory,'backups'));assert.equal(backups.length,3);
    const baseline=JSON.parse(await readFile(path.join(directory,'backups',backups.find(n=>n.startsWith('0-'))!),'utf8'));assert.deepEqual(baseline.overrides,{});
    await assert.rejects(restarted.update('claw',1,value),/其他页面/);
    await assert.rejects(restarted.update('../secret',3,value),/编号无效/);
    await assert.rejects(restarted.update('claw',3,{...value,cost:-1}),/灵力消耗/);
    assert.equal((await restarted.read()).revision,3);
    await writeFile(path.join(directory,'config.json'),'{broken');
    await assert.rejects(restarted.update('claw',3,value),/配置损坏/);
    assert.equal(await readFile(path.join(directory,'config.json'),'utf8'),'{broken');
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('two backend instances cannot overwrite each other and ecology cards are validated',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'zszm-balance-'));
  try{
    const a=new CardBalanceStore(directory),b=new CardBalanceStore(directory);
    const results=await Promise.allSettled([a.update('claw',0,balanceOf(BASE_CARDS.claw)),b.update('guard',0,balanceOf(BASE_CARDS.guard))]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await a.read()).revision,1);
    const individual={id:'eco-card-eco-test-plant-1',worldId:'eco-test',sourceId:'plant-1',name:'ignored',role:'producer',element:'mu',traits:{size:3,speed:4,vitality:5}};
    const updated=await b.update(individual.id,1,{...balanceOf(BASE_CARDS.guard),effect:{block:23}},individual);
    assert.equal(updated.overrides[individual.id].effect.block,23);
    assert.equal((await new CardBalanceStore(directory).read()).individuals[individual.id].name,'灵芽 · 1');
    await assert.rejects(b.update('eco-card-eco-test-plant-2',2,balanceOf(BASE_CARDS.guard),individual),/编号不一致/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('HTTP writes require local host, matching origin, token, bounded values and current revision',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'zszm-balance-'));
  // Like Vite/Connect: strip the mount prefix without an outer Express app.
  const api=createCardBalanceApi(directory);
  const server=createServer((req,res)=>{req.url=req.url?.replace(/^\/api\/card-balance/,'')||'/';api(req,res);}).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address() as import('node:net').AddressInfo,origin=`http://127.0.0.1:${address.port}`,base=origin+'/api/card-balance';
  try{
    const snapshot=await (await fetch(base)).json();assert.equal(snapshot.editable,true);assert.ok(snapshot.token);assert.equal(snapshot.backup.schemaVersion,1);
    const body=JSON.stringify({revision:0,value:{...balanceOf(BASE_CARDS.claw),effect:{damage:18}}});
    const put=(headers:Record<string,string>,payload=body)=>fetch(base+'/cards/claw',{method:'PUT',headers:{'Content-Type':'application/json',...headers},body:payload});
    assert.equal((await put({})).status,403);
    assert.equal((await put({'X-Card-Admin-Token':snapshot.token,Origin:'http://attacker.invalid'})).status,403);
    // Fetch normalizes Host; raw HTTP is required to exercise a reverse-proxy hostname.
    const foreignHost=(method:string)=>new Promise<{status:number;body:any}>((resolve,reject)=>{
      const req=httpRequest(base+(method==='PUT'?'/cards/claw':''),{method,headers:{Host:'public.invalid','Content-Type':'application/json','X-Card-Admin-Token':snapshot.token}},res=>{
        let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(text)}));
      });req.on('error',reject);req.end(method==='PUT'?body:undefined);
    });
    assert.equal((await foreignHost('PUT')).status,403);
    const remoteView=(await foreignHost('GET')).body;assert.equal(remoteView.editable,false);assert.equal(remoteView.token,undefined);assert.equal(remoteView.backup,undefined);
    const headers={'X-Card-Admin-Token':snapshot.token,Origin:origin};
    assert.equal((await put(headers,JSON.stringify({revision:0,value:{...balanceOf(BASE_CARDS.claw),effect:{damage:1000}}}))).status,400);
    assert.equal((await put(headers)).status,200);assert.equal((await put(headers)).status,409);
    const saved=await (await fetch(base)).json();assert.equal(saved.overrides.claw.effect.damage,18);assert.deepEqual(saved.backup,await new CardBalanceStore(directory).read());
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(directory,{recursive:true,force:true});}
});
