import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createCamera,aimCamera,fitFrustum,gridFromPoint} from '../src/render/camera.js';
import {createInitialState} from '../src/core/gameState.js';
import {reducer} from '../src/core/reducer.js';
import {getBuilding} from '../src/content/buildings.js';
import {canPlace} from '../src/systems/spiritSpace.js';
import {ModelFactory} from '../src/render/models.js';
import {BUILDINGS} from '../src/content/buildings.js';
import {bindMapInteraction} from '../src/render/interaction.js';
import {importEcology} from '../src/systems/ecology.js';

test('orthographic map stays at 45 degrees and fits both mobile and expanded terrain',()=>{
 const camera=createCamera(),target=new Vector3(12,0,8);aimCamera(camera,target);
 const d=camera.position.clone().sub(target);assert.ok(Math.abs(d.y/Math.hypot(d.x,d.z)-1)<1e-10);
 for(const aspect of [.5,1.5,2.4]){fitFrustum(camera,30,20,aspect);aimCamera(camera,new Vector3(15,0,10));
  for(const x of [0,30])for(const z of [0,20]){const p=new Vector3(x,0,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1);}}
 assert.deepEqual(gridFromPoint(new Vector3(2.9,0,3.2),{width:24,height:16}),{gx:2,gy:3,inside:true});
 assert.equal(gridFromPoint(new Vector3(-.1,0,0),{width:24,height:16}).inside,false);
});
test('every unlocked building has finite three-dimensional geometry',()=>{
 const factory=new ModelFactory();for(const def of BUILDINGS){const object=factory.building(def);let count=0;object.traverse(o=>{if(o.isMesh){count++;assert.ok(o.scale.toArray().every(Number.isFinite));}});assert.ok(count>0,def.id);}factory.dispose();
});
test('expanded-grid construction occupies the right saved tiles and continues simulating after reload',()=>{
 let s=createInitialState();s={...s,resources:{...s.resources,spirit:1000}};
 s=reducer(s,{type:'SPACE_EXPAND',payload:{dir:'east'}});assert.equal(s.space.width,25);
 s={...s,space:{...s.space,tiles:s.space.tiles.map(t=>({...t,resource:null}))}};
 const def=getBuilding('campfire');const x=22,y=2;assert.ok(canPlace(s,def.id,x,y).ok);
 const next=reducer(s,{type:'BUILD_PLACE',payload:{buildingId:def.id,x,y}});
 const built=next.buildings.at(-1);assert.equal(next.space.tiles[y*25+x].buildingId,built.id);assert.equal(s.space.tiles[y*25+x].buildingId,null);
 const loaded=JSON.parse(JSON.stringify(next));const ticked=reducer(loaded,{type:'TICK'});
 assert.equal(ticked.tick,loaded.tick+1);assert.equal(ticked.colonists.length,loaded.colonists.length);assert.ok(Number.isFinite(ticked.resources.spirit));
});
test('drag, pinch, and cancellation cannot place buildings; a fresh tap can',()=>{
 const canvas=new EventTarget();canvas.focus=()=>{};canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;canvas.classList={add(){},remove(){}};canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600});
 let taps=0,pans=0,zooms=0;
 const engine={canvas,setPointer(){},setMouse(){},pick:()=>({gx:1,gy:1,inside:true}),panPixels(){pans++;},zoomAt(){zooms++;}};
 const off=bindMapInteraction(engine,{onTap:()=>taps++,onCancel(){}});
 const fire=(type,id,x,y)=>{const e=new Event(type);Object.assign(e,{pointerId:id,clientX:x,clientY:y,button:0});canvas.dispatchEvent(e);};
 fire('pointerdown',1,10,10);fire('pointermove',1,70,10);fire('pointerup',1,70,10);assert.equal(taps,0);assert.ok(pans>0);
 fire('pointerdown',1,10,10);fire('pointerdown',2,30,10);fire('pointermove',2,60,10);fire('pointerup',2,60,10);fire('pointerup',1,10,10);assert.equal(taps,0);assert.ok(zooms>0);
 fire('pointerdown',1,10,10);fire('pointercancel',1,10,10);fire('pointerup',1,10,10);assert.equal(taps,0);
 fire('pointerdown',1,10,10);fire('pointerup',1,10,10);assert.equal(taps,1);off();
});
test('full inventory rejects a harvest atomically so the hub can retry later',()=>{
 const s=createInitialState();s.resources.food=299;const before=JSON.stringify(s);
 const packet={schemaVersion:1,kind:'eco-harvest',worldId:'eco-cap',sequence:1,resources:{food:2,herb:0,spirit:0},species:[]};
 assert.throws(()=>importEcology(s,packet),/仓库空间不足/);assert.equal(JSON.stringify(s),before);assert.equal(s.ecoReceipts,undefined);
});
