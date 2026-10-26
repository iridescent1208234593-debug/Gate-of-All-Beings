import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importEcology} from '../src/systems/ecology.js';
const packet={schemaVersion:1,kind:'eco-harvest',worldId:'eco-test',sequence:1,resources:{food:3,herb:2,spirit:1},species:[]};
test('ecology resources credit once without modifying the input',()=>{
 const s={tick:1,eventLog:[],resources:{food:1,herb:0,spirit:0}};
 const n=importEcology(s,packet);assert.deepEqual(n.resources,{food:4,herb:2,spirit:1});assert.equal(s.resources.food,1);
 assert.throws(()=>importEcology(n,packet));assert.throws(()=>importEcology(s,{...packet,resources:{food:Infinity,herb:0,spirit:0}}));
});
