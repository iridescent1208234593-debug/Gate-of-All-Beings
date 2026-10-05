import React from 'react';
import {HEIGHT, WIDTH, SCENE_LAYERS, layerState, palette, stars, starState, type LayerVisibility} from './sceneModel';
import type {ThemeMode} from '../../types';

export function ReferenceScene2D({seconds,theme,layers,onCreatureClick}:{seconds:number;theme:ThemeMode;layers:LayerVisibility;onCreatureClick?:(name:string)=>void}){
 const colors=palette(theme);
 return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="reference-drawing" role="img" aria-label="众生之门 2D 矢量复现" data-frame={Math.min(143,Math.floor(seconds*24+1e-6))}>
  <title>众生之门：按原片构图重建的矢量动画</title>
  {layers.moon&&<g fill={colors.cream}>{stars.map((star,i)=>{const p=starState(star,seconds);return <circle key={i} cx={p.x} cy={p.y} r={star.size} opacity={p.opacity}/>;})}</g>}
  {SCENE_LAYERS.map(layer=>{
   const s=layerState(layer,seconds);if(!layers[layer.visibility]||s.opacity<=0)return null;
   const [x,y]=layer.pivot;
   return <g key={layer.id} data-layer={layer.id} opacity={s.opacity}
    transform={`translate(${x} ${y+s.dy}) scale(${s.sx} ${s.sy}) translate(${-x} ${-y})`}
    onClick={()=>onCreatureClick?.(layer.id==='moon'?'圆月':layer.id==='deer'?'鹿灵':layer.id==='whale'?'鲸灵':layer.id==='blob'?'团子灵':'众生之门')}>
    {layer.id==='moon'?<circle cx="654" cy="265" r="135" fill={colors.cream}/>:layer.parts.map((part,i)=><path key={i} d={part.d} fill={part.fill?colors[part.fill]:'none'} stroke={part.stroke?colors[part.stroke]:undefined} strokeWidth={part.strokeWidth} fillOpacity={part.fill?(part.opacity??1):1} opacity={part.fill?1:(part.opacity??1)} strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd"/>) }
   </g>;
  })}
 </svg>;
}
