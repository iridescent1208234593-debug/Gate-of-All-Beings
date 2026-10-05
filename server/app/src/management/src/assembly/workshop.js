import { unifiedStorage } from '@lxh/shared-session/kv.js';
const localStorage = unifiedStorage('management');
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildSpiritCore,buildHorn,buildTail,createSpiritMaterial,CREATURE_PARAMS,idleMotion} from './spiritCreatureBuilder.ts';

/** Experimental parts recovered from conversations.json; kept separate from the opening scene. */
export function openSpiritWorkshop(){
  const dialog=document.createElement('dialog');dialog.className='paper-dialog spirit-workshop';
  dialog.innerHTML=`<div class="dialog-heading"><h2>灵体拼装 · 实验室</h2><button aria-label="关闭灵体拼装">×</button></div><p>球体、鹿角与鲸尾的形态草稿。拖动旋转，调整参数后可保存或导出。</p><div class="workshop-preview"></div><div class="workshop-fields"><label>基础形态<select aria-label="基础形态"><option value="deer">鹿灵</option><option value="whale">鲸灵</option><option value="blob">团子灵</option></select></label><label>体型<input aria-label="体型" data-param="radius" type="range" min="20" max="65" step="1"></label><label>纵向伸展<input aria-label="纵向伸展" data-param="height" type="range" min="0.5" max="2" step="0.05"></label><label>实体厚度<input aria-label="实体厚度" data-param="depth" type="range" min="0.5" max="1.5" step="0.05"></label><label>表面起伏<input aria-label="表面起伏" data-param="roundness" type="range" min="0" max="8" step="0.5"></label><label>透明度<input aria-label="透明度" data-param="opacity" type="range" min="0.2" max="1" step="0.05"></label></div><div class="workshop-actions"><button data-action="reset">重置形态</button><button data-action="save">保存草稿</button><button data-action="export">导出拼装 JSON</button></div><p role="status"></p>`;
  document.body.append(dialog);dialog.showModal();
  const host=dialog.querySelector('.workshop-preview'),status=dialog.querySelector('[role=status]'),select=dialog.querySelector('select');
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{status.textContent='当前浏览器无法开启 3D 预览。';dialog.querySelector('[aria-label="关闭灵体拼装"]').onclick=()=>dialog.remove();return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','灵体拼装预览');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#263b36');
  const camera=new THREE.PerspectiveCamera(35,1,.1,1000);camera.position.set(170,80,340);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,20,0);controls.enableDamping=true;controls.minDistance=160;controls.maxDistance=600;
  let group=null,material=null,config=structuredClone(CREATURE_PARAMS.deer),preset='deer';
  const release=()=>{if(!group)return;group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});material.dispose();scene.remove(group);};
  function rebuild(){
    release();group=new THREE.Group();material=createSpiritMaterial(new THREE.Color('#fdfbe5'),new THREE.Color('#ffffff'),config.opacity);
    group.add(new THREE.Mesh(buildSpiritCore(config,config.seed),material));
    if(config.horn)for(const direction of [-1,1]){const horn=buildHorn(config.horn,material);horn.scale.x=direction;horn.position.set(direction*config.horn.attach[0],config.horn.attach[1],config.horn.attach[2]);group.add(horn);}
    if(config.tail){const tail=new THREE.Mesh(buildTail(config.tail),material);tail.position.set(...config.tail.attach);tail.rotation.z=config.tail.attachRotation||0;group.add(tail);}
    scene.add(group);
  }
  function sync(){for(const input of dialog.querySelectorAll('[data-param]'))input.value=String(input.dataset.param==='height'?config.stretch[1]:input.dataset.param==='depth'?config.stretch[2]:config[input.dataset.param]);rebuild();}
  select.onchange=()=>{preset=select.value;config=structuredClone(CREATURE_PARAMS[preset]);sync();};
  dialog.querySelectorAll('[data-param]').forEach(input=>input.oninput=()=>{const n=Number(input.value);if(input.dataset.param==='height')config.stretch[1]=n;else if(input.dataset.param==='depth')config.stretch[2]=n;else config[input.dataset.param]=n;rebuild();});
  const blueprint=()=>({schemaVersion:1,kind:'spirit-blueprint',preset,params:config});
  dialog.querySelector('[data-action=reset]').onclick=()=>{config=structuredClone(CREATURE_PARAMS[preset]);sync();};
  dialog.querySelector('[data-action=save]').onclick=()=>{try{localStorage.setItem('lxh-spirit-workshop-v1',JSON.stringify(blueprint()));status.textContent='草稿已保存，下次打开会恢复。';}catch{status.textContent='保存失败，请导出 JSON。';}};
  dialog.querySelector('[data-action=export]').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(blueprint(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`灵体拼装-${preset}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  try{const saved=JSON.parse(localStorage.getItem('lxh-spirit-workshop-v1')||'null');if(saved?.kind==='spirit-blueprint'&&CREATURE_PARAMS[saved.preset]){
    preset=saved.preset;select.value=preset;config=structuredClone(CREATURE_PARAMS[preset]);
    for(const [key,min,max] of [['radius',20,65],['roundness',0,8],['opacity',.2,1]])if(Number.isFinite(saved.params?.[key]))config[key]=THREE.MathUtils.clamp(saved.params[key],min,max);
    for(const index of [1,2])if(Number.isFinite(saved.params?.stretch?.[index]))config.stretch[index]=THREE.MathUtils.clamp(saved.params.stretch[index],.5,index===1?2:1.5);
  }}catch{status.textContent='已忽略无法读取的草稿。';}
  sync();
  const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let raf=0;const start=performance.now();
  function render(){const idle=idleMotion(config.seed,(performance.now()-start)/1000);group.scale.setScalar(1+idle.breath*.025);material.uniforms.uBreath.value=idle.breath*.5+.5;controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(render);}render();
  let closed=false;const close=()=>{if(closed)return;closed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();release();renderer.dispose();renderer.forceContextLoss();dialog.remove();};
  dialog.querySelector('[aria-label="关闭灵体拼装"]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',close);
  return close;
}
