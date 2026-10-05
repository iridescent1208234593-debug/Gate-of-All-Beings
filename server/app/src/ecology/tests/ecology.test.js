import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,reducer} from '../src/core/state.js';
import {computeEcoMetrics} from '../src/core/eco.js';
import {encodeWorld,decodeWorld} from '../src/core/persistence.js';
import {receiveEcoExchange} from '@lxh/shared-types/exchange';
test('individual exports reference live entities and never re-export the same individual',()=>{
 let s=createInitialState(77);s={...s,ecology:{...s.ecology,harvest:{food:8,herb:3,spirit:2}}};
 const a=reducer(s,{type:'HARVEST'}),p=a.ecology.lastExport;
 assert.equal(p.schemaVersion,2);assert.ok(p.individuals.length>0);
 for(const i of p.individuals){const [kind,id]=i.sourceId.split('-');assert.ok((kind==='plant'?s.plants:s.organisms).some(e=>e.id===Number(id)));}
 const b=reducer({...a,ecology:{...a.ecology,harvest:{food:1,herb:0,spirit:0}}},{type:'HARVEST'});
 assert.ok(b.ecology.lastExport.individuals.every(i=>!p.individuals.some(j=>j.id===i.id)));
 assert.equal(b.ecology.pendingExports.length,2);
 assert.equal(reducer(b,{type:'ACK_HARVEST',worldId:p.worldId,sequence:p.sequence}).ecology.pendingExports.length,1);
 assert.deepEqual(decodeWorld(encodeWorld(b)),b);
});

test('invalid steps and pause cannot corrupt time or mutate state',()=>{
 const s=createInitialState(1);for(const dt of [-1,NaN,Infinity,0,61])assert.equal(reducer(s,{type:'TICK',dt}),s);
 const p={...s,paused:true};assert.equal(reducer(p,{type:'TICK',dt:1}),p);
});
test('same seed and elapsed time yield identical worlds across frame sizes',()=>{
 const a=reducer(createInitialState(42),{type:'TICK',dt:2});
 let b=createInitialState(42);for(let i=0;i<120;i++)b=reducer(b,{type:'TICK',dt:1/60});
 assert.deepEqual(a,b);
 assert.deepEqual(createInitialState(17),createInitialState(17));
});
test('JSON save restores typed terrain and continues deterministically',()=>{
 const s=reducer(createInitialState(5),{type:'TICK',dt:3});
 const restored=decodeWorld(encodeWorld(s));assert.deepEqual(restored,s);
 assert.deepEqual(reducer(restored,{type:'TICK',dt:1}),reducer(s,{type:'TICK',dt:1}));
});
test('diversity counts each plant, not one virtual representative',()=>{
 const s={cells:[{radius:1,energy:1}],plants:Array.from({length:100},()=>({biomass:1})),organisms:[]};
 assert.ok(Math.abs(computeEcoMetrics(s).diversity-(1-(10000+1)/10201))<1e-9);
});
test('harvesting consumes stock and duplicate packets cannot credit a recipient',()=>{
 let s=reducer(createInitialState(11),{type:'TICK',dt:10});
 s=reducer(s,{type:'HARVEST'});const p=s.ecology.lastExport;
 const claimed=receiveEcoExchange({},p);
 assert.throws(()=>receiveEcoExchange({ecoReceipts:claimed.receipts},p));
 assert.throws(()=>reducer(s,{type:'HARVEST'}));
 assert.throws(()=>receiveEcoExchange({}, {...p,resources:{...p.resources,food:-1}}));
});
test('five simulated minutes keep ecology finite without hidden replenishment',()=>{
 let s=createInitialState(101);for(let i=0;i<30;i++)s=reducer(s,{type:'TICK',dt:10});
 assert.equal(s.settings.reseed,false);assert.ok(Math.abs(s.time-300)<1e-7);
 for(const k of ['materialLing','lifeLing','detritus','decomposers'])assert.ok(Number.isFinite(s.space[k])&&s.space[k]>=0);
 for(const e of [...s.cells,...s.organisms])assert.ok(e.energy>=0&&e.pos.every(Number.isFinite));
 console.log(JSON.stringify({cells:s.cells.length,organisms:s.organisms.length,plants:s.plants.length,recycled:s.ecology.recycled,deaths:s.ecology.deaths}));
});
