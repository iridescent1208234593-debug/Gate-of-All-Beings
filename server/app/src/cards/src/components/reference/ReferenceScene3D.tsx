import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import {SCENE_LAYERS,WIDTH,HEIGHT,layerState,palette,stars,starState,type LayerVisibility,type SceneLayer} from './sceneModel';
import type {ThemeMode} from '../../types';

interface Props {seconds:number;theme:ThemeMode;layers:LayerVisibility;resetView:number;onCreatureClick?:(name:string)=>void;onReady?:()=>void;onFail?:()=>void;}
interface LayerObject {source:SceneLayer;group:THREE.Group;materials:Array<{material:THREE.Material & {opacity:number};base:number}>;}

export function ReferenceScene3D(props:Props){
 const host=useRef<HTMLDivElement>(null);
 const latest=useRef(props);latest.current=props;
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  const container=host.current;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}
  catch{setFailed(true);latest.current.onFail?.();return;}
  renderer.setClearColor(0x000000);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NoToneMapping;renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.domElement.setAttribute('aria-label','众生之门 3D 复现，可拖动旋转、双指捏合缩放');
  renderer.domElement.setAttribute('role','img');container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const root=new THREE.Group();scene.add(root);
  const camera=new THREE.OrthographicCamera(-WIDTH/2,WIDTH/2,HEIGHT/2,-HEIGHT/2,.1,4000);
  camera.position.set(0,0,1600);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xffffff,1.8));
  const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(-400,700,1000);scene.add(light);
  const colors=palette('original');
  const loader=new SVGLoader();
  const materials=new Set<THREE.Material>();const geometries=new Set<THREE.BufferGeometry>();
  const colored:Array<{material:THREE.MeshBasicMaterial|THREE.MeshLambertMaterial;color:keyof typeof colors;side:boolean}>=[];
  const trackMaterial=(mat:THREE.MeshBasicMaterial|THREE.MeshLambertMaterial,color:keyof typeof colors,side=false)=>{materials.add(mat);colored.push({material:mat,color,side});return mat;};
  const trackGeometry=<T extends THREE.BufferGeometry>(g:T):T=>{geometries.add(g);return g;};
  const objects:LayerObject[]=SCENE_LAYERS.map((layer,layerIndex)=>{
   const group=new THREE.Group();root.add(group);group.name=layer.id;
   const item:LayerObject={source:layer,group,materials:[]};
   const addMat=(mat:THREE.MeshBasicMaterial|THREE.MeshLambertMaterial,base=1)=>{mat.transparent=true;mat.opacity=base;item.materials.push({material:mat,base});return mat;};
   if(layer.id==='moon'){
    const mat=addMat(trackMaterial(new THREE.MeshBasicMaterial({color:colors.cream}),'cream'));
    const mesh=new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(135,64,40)),mat);mesh.userData.layer=layer.id;group.add(mesh);
   }else{
    layer.parts.forEach((part,index)=>{
     const [px,py]=layer.pivot;
     const xml=`<svg xmlns="http://www.w3.org/2000/svg"><path d="${part.d}" fill="${part.fill?colors[part.fill]:'none'}" fill-rule="evenodd" stroke="${part.stroke?colors[part.stroke]:'none'}" stroke-width="${part.strokeWidth||1}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
     const parsed=loader.parse(xml);
     for(const path of parsed.paths){
      if(part.fill){
       const front=addMat(trackMaterial(new THREE.MeshBasicMaterial({color:colors[part.fill],side:THREE.DoubleSide,depthWrite:(part.opacity??1)===1}),part.fill),part.opacity??1);
       const side=addMat(trackMaterial(new THREE.MeshLambertMaterial({color:colors[part.fill],side:THREE.DoubleSide,depthWrite:(part.opacity??1)===1}),part.fill,true),(part.opacity??1)*.9);
       for(const shape of path.toShapes()){
        // Opaque shapes have thickness. Transparent spirits use a single front
        // surface plus side walls so front/back alpha does not double up.
        const geometry=trackGeometry(new THREE.ExtrudeGeometry(shape,{depth:layer.depth,bevelEnabled:false,curveSegments:24,steps:1}));
        geometry.scale(1,-1,1);geometry.translate(-px,py,-layer.depth);
        if((part.opacity??1)<1){
         const faces=trackGeometry(new THREE.ShapeGeometry(shape,24));faces.scale(1,-1,1);faces.translate(-px,py,.1);
         const face=new THREE.Mesh(faces,front);face.position.z=index*.4;face.renderOrder=layerIndex*10+index;group.add(face);face.userData.layer=layer.id;
         geometry.groups=geometry.groups.filter(g=>g.materialIndex===1);
        }
        const mesh=new THREE.Mesh(geometry,[front,side]);mesh.position.z=index*.4;mesh.renderOrder=layerIndex*10+index;mesh.userData.layer=layer.id;group.add(mesh);
       }
      }
      if(part.stroke){
       const outline=addMat(trackMaterial(new THREE.MeshBasicMaterial({color:colors[part.stroke],side:THREE.DoubleSide,depthWrite:false}),part.stroke),part.fill?1:(part.opacity??1));
       for(const sub of path.subPaths){
        const geometry=SVGLoader.pointsToStroke(sub.getPoints(48),SVGLoader.getStrokeStyle(part.strokeWidth||1,colors[part.stroke],'round','round'));
        if(!geometry)continue;
        trackGeometry(geometry);geometry.scale(1,-1,1);geometry.translate(-px,py,index*.4+.2);
        const mesh=new THREE.Mesh(geometry,outline);mesh.renderOrder=layerIndex*10+index+1;mesh.userData.layer=layer.id;group.add(mesh);
       }
      }
     }
    });
   }
   return item;
  });
  const starObjects=stars.map(star=>{
   const material=trackMaterial(new THREE.MeshBasicMaterial({color:colors.cream,transparent:true,depthWrite:false}),'cream');
   const mesh=new THREE.Mesh(trackGeometry(new THREE.CircleGeometry(star.size,8)),material);root.add(mesh);return {star,mesh,material};
  });
  let rotX=0,rotY=0,zoom=1,panX=0,panY=0;let lastReset=latest.current.resetView;
  const ZMIN=.45,ZMAX=3;
  const clampZoom=(value:number)=>Math.max(ZMIN,Math.min(ZMAX,value));
  const raycaster=new THREE.Raycaster();
  const pick=(clientX:number,clientY:number)=>{const r=container.getBoundingClientRect();
   raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);
   const hit=raycaster.intersectObjects(root.children,true).find(h=>{let o:THREE.Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent;}return !!h.object.userData.layer;});
   if(hit)latest.current.onCreatureClick?.(({moon:'圆月',deer:'鹿灵',whale:'鲸灵',blob:'团子灵'} as Record<string,string>)[hit.object.userData.layer]||'众生之门');
  };
  // 正交相机下 1 像素对应的世界单位随 zoom 收缩：捏合缩放与双指平移据此换算锚点，保证手指下的内容不动
  const metrics=(value:number)=>{const r=container.getBoundingClientRect();const w=r.width||1,h=r.height||1;
   return {x:(camera.right-camera.left)/(value*w),y:(camera.top-camera.bottom)/(value*h),w,h,left:r.left,top:r.top};};
  // 桌面端：鼠标拖动旋转 + 滚轮缩放（以光标为锚点）
  let pointer:{id:number;x:number;y:number;startX:number;startY:number}|null=null;
  const down=(e:PointerEvent)=>{if(e.pointerType==='touch')return;if(e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};container.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!pointer||pointer.id!==e.pointerId)return;
   rotY+=(e.clientX-pointer.x)*.006;rotX=Math.max(-.75,Math.min(.75,rotX+(e.clientY-pointer.y)*.004));pointer.x=e.clientX;pointer.y=e.clientY;};
  const up=(e:PointerEvent)=>{if(!pointer||pointer.id!==e.pointerId)return;
   if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)<5)pick(e.clientX,e.clientY);
   pointer=null;if(container.hasPointerCapture(e.pointerId))container.releasePointerCapture(e.pointerId);
  };
  const cancel=()=>{pointer=null;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();
   const before=metrics(zoom);const next=clampZoom(zoom*Math.exp(-e.deltaY*.001));const after=metrics(next);
   const sx=e.clientX-before.left-before.w/2,sy=e.clientY-before.top-before.h/2;
   panX+=sx*(before.x-after.x);panY+=-sy*(before.y-after.y);zoom=next;};
  // 触摸端：单指拖动旋转，双指捏合缩放并跟随平移（开启 touch-action:none 后触摸事件完全由这里接管）
  const touches=new Map<number,{x:number;y:number}>();
  let drag:{x:number;y:number;startX:number;startY:number}|null=null;
  let pinch:{d0:number;z0:number;cx:number;cy:number}|null=null;
  const pinchInfo=()=>{const list=[...touches.values()];if(list.length<2)return null;const [a,b]=list;
   return {d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};};
  const touchStart=(e:TouchEvent)=>{e.preventDefault();
   for(const t of Array.from(e.changedTouches))touches.set(t.identifier,{x:t.clientX,y:t.clientY});
   if(touches.size===1){const t=e.changedTouches[0];drag={x:t.clientX,y:t.clientY,startX:t.clientX,startY:t.clientY};pinch=null;}
   else{const info=pinchInfo();if(info)pinch={d0:info.d,z0:zoom,cx:info.cx,cy:info.cy};drag=null;}
  };
  const touchMove=(e:TouchEvent)=>{if(!touches.size)return;e.preventDefault();
   for(const t of Array.from(e.changedTouches))if(touches.has(t.identifier))touches.set(t.identifier,{x:t.clientX,y:t.clientY});
   if(pinch&&touches.size>=2){const info=pinchInfo();if(!info)return;
    const before=metrics(zoom);const next=clampZoom(pinch.z0*info.d/pinch.d0);const after=metrics(next);
    const sx=info.cx-before.left-before.w/2,sy=info.cy-before.top-before.h/2;
    panX+=sx*(before.x-after.x)+(info.cx-pinch.cx)*after.x;
    panY+=-sy*(before.y-after.y)-(info.cy-pinch.cy)*after.y;
    zoom=next;pinch.cx=info.cx;pinch.cy=info.cy;return;}
   if(drag&&touches.size===1){const t=[...touches.values()][0];
    rotY+=(t.x-drag.x)*.006;rotX=Math.max(-.75,Math.min(.75,rotX+(t.y-drag.y)*.004));drag.x=t.x;drag.y=t.y;}
  };
  const touchEnd=(e:TouchEvent)=>{e.preventDefault();
   if(drag&&!pinch){const t=e.changedTouches[0];if(t&&Math.hypot(t.clientX-drag.startX,t.clientY-drag.startY)<6)pick(t.clientX,t.clientY);}
   for(const t of Array.from(e.changedTouches))touches.delete(t.identifier);
   if(touches.size<1){drag=null;pinch=null;}
   else if(touches.size===1){const t=[...touches.values()][0];drag={x:t.x,y:t.y,startX:t.x,startY:t.y};pinch=null;}
  };
  container.addEventListener('pointerdown',down);container.addEventListener('pointermove',move);container.addEventListener('pointerup',up);container.addEventListener('pointercancel',cancel);container.addEventListener('wheel',wheel,{passive:false});
  container.addEventListener('touchstart',touchStart,{passive:false});container.addEventListener('touchmove',touchMove,{passive:false});container.addEventListener('touchend',touchEnd,{passive:false});container.addEventListener('touchcancel',touchEnd,{passive:false});
  // 相机视锥随容器比例自适应（cover 式）：容器比 16:9 宽则横向扩展视域、更高则纵向扩展，
  // 避免固定 1280×720 的正交视锥在非 16:9 容器里被拉伸变形（原 16:9 容器结果不变）
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
   renderer.setSize(w,h,false);
   const base=WIDTH/HEIGHT;const aspect=w/h;const k=aspect>=base?aspect/base:base/aspect;
   if(aspect>=base){camera.left=-WIDTH/2*k;camera.right=WIDTH/2*k;camera.top=HEIGHT/2;camera.bottom=-HEIGHT/2;}
   else{camera.left=-WIDTH/2;camera.right=WIDTH/2;camera.top=HEIGHT/2*k;camera.bottom=-HEIGHT/2*k;}
   camera.updateProjectionMatrix();
  };
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  let oldTheme:ThemeMode|undefined;let lastState='';let raf=0;let readyNotified=false;
  const render=()=>{
   raf=requestAnimationFrame(render);const p=latest.current;
   if(lastReset!==p.resetView){rotX=0;rotY=0;zoom=1;panX=0;panY=0;lastReset=p.resetView;}
   const state=JSON.stringify([p.seconds,p.theme,p.layers,rotX,rotY,zoom,panX,panY,container.clientWidth,container.clientHeight]);
   if(state===lastState)return;lastState=state;
   root.rotation.set(rotX,rotY,0);root.position.set(panX,panY,0);camera.zoom=zoom;camera.updateProjectionMatrix();
   if(oldTheme!==p.theme){const c=palette(p.theme);for(const entry of colored){entry.material.color.set(c[entry.color]);if(entry.side)entry.material.color.multiplyScalar(.65);}oldTheme=p.theme;}
   for(const item of objects){const s=layerState(item.source,p.seconds);const [px,py]=item.source.pivot;
    item.group.visible=p.layers[item.source.visibility]&&s.opacity>0;
    item.group.position.set(px-WIDTH/2,HEIGHT/2-py-s.dy,item.source.z);
    item.group.scale.set(Math.max(s.sx,.00001),Math.max(s.sy,.00001),Math.max(s.sx,.00001));
    for(const m of item.materials)m.material.opacity=m.base*s.opacity;
   }
   for(const item of starObjects){const s=starState(item.star,p.seconds);item.mesh.position.set(s.x-WIDTH/2,HEIGHT/2-s.y,200);item.mesh.visible=p.layers.moon&&s.opacity>0;item.material.opacity=s.opacity;}
   renderer.render(scene,camera);
   if(!readyNotified){readyNotified=true;latest.current.onReady?.();}
   container.dataset.frame=String(Math.min(143,Math.floor(p.seconds*24+1e-6)));
   container.dataset.rotation=`${rotX.toFixed(3)},${rotY.toFixed(3)}`;container.dataset.zoom=zoom.toFixed(3);
  };
  render();
  return ()=>{cancelAnimationFrame(raf);observer.disconnect();container.removeEventListener('pointerdown',down);container.removeEventListener('pointermove',move);container.removeEventListener('pointerup',up);container.removeEventListener('pointercancel',cancel);container.removeEventListener('wheel',wheel);container.removeEventListener('touchstart',touchStart);container.removeEventListener('touchmove',touchMove);container.removeEventListener('touchend',touchEnd);container.removeEventListener('touchcancel',touchEnd);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 return failed?<div className="reference-webgl qc-err" role="alert">此浏览器无法开启 3D，请切换到 2D，或开启浏览器的硬件加速。</div>:<div className="reference-webgl" ref={host}/>;
}
