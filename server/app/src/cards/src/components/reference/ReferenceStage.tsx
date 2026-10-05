import React,{useEffect,useRef,useState} from 'react';
import {ReferenceScene2D} from './ReferenceScene2D';
import {ReferenceScene3D} from './ReferenceScene3D';
import {ALL_LAYERS,DURATION,FPS,REFERENCE_URL,clamp,type LayerVisibility} from './sceneModel';
import type {ThemeMode} from '../../types';
import './reference.css';

// 手机端（微信/QQ 的 X5 内核等）会把 <video> 提升到原生播放器层渲染，CSS 的
// opacity/z-index 对原生视频层无效，页面会被原片视频盖住（表现为「进入 2D/3D
// 直接变成视频」）。这里为叠加视频声明内联（h5-page）播放，避免被原生播放器接管。
const X5_INLINE_ATTRS = {
 'x5-video-player-type':'h5-page',
 'x5-playsinline':'true',
 'webkit-playsinline':'true',
} as unknown as React.VideoHTMLAttributes<HTMLVideoElement>;

export interface ReferenceStageProps {
 progress:number;isPlaying:boolean;speed:number;soundEnabled:boolean;theme:ThemeMode;
 is3DMode:boolean;onToggle3DMode:()=>void;onSeek:(progress:number)=>void;
 visibleLayers?:LayerVisibility;onCreatureClick?:(name:string)=>void;
}
export function ReferenceStage({progress,isPlaying,speed,soundEnabled,theme,is3DMode,onToggle3DMode,onSeek,visibleLayers=ALL_LAYERS,onCreatureClick}:ReferenceStageProps){
 const video=useRef<HTMLVideoElement>(null);
 const [overlay,setOverlay]=useState(false);
 const [opacity,setOpacity]=useState(.5);
 const [videoError,setVideoError]=useState(false);
 const [resetView,setResetView]=useState(0);
 const seconds=clamp(progress)*DURATION;
 const frame=Math.min(143,Math.floor(seconds*FPS+1e-6));
 useEffect(()=>{
  const v=video.current;if(!v)return;
  v.playbackRate=speed;v.muted=!soundEnabled;
  if(isPlaying)void v.play().catch(()=>{});else v.pause();
 },[isPlaying,speed,soundEnabled,overlay]);
 useEffect(()=>{
  const v=video.current;if(!v||v.readyState<1)return;
  const target=Math.min(seconds,Math.max(0,v.duration-1/FPS));
  if(!isPlaying||Math.abs(v.currentTime-target)>.12)v.currentTime=target;
  if(isPlaying&&v.paused&&seconds<DURATION)void v.play().catch(()=>{});
 },[seconds,isPlaying,overlay]);
 return <section className="reference-stage" aria-label={is3DMode?'3D 复现场景':'2D 复现场景'}>
  <div className="reference-toolbar">
   <div><span className="qc-tag qc-tag--accent">{is3DMode?'3D':'2D'}</span> <strong>众生之门 · 原片复现</strong></div>
   <div className="reference-actions">
    {is3DMode&&<button className="qc-btn qc-btn--ghost qc-btn--sm" onClick={()=>setResetView(v=>v+1)}>回到原片视角</button>}
    <button className={`qc-tab ${overlay?'is-active':''}`} aria-pressed={overlay} onClick={()=>setOverlay(!overlay)}>原片叠加</button>
    <button className="qc-btn qc-btn--ghost qc-btn--sm" onClick={onToggle3DMode}>{is3DMode?'切换 2D':'切换 3D'}</button>
   </div>
  </div>
  <div className="reference-viewport" data-testid="reference-viewport">
   {is3DMode?<ReferenceScene3D seconds={seconds} theme={theme} layers={visibleLayers} resetView={resetView} onCreatureClick={onCreatureClick}/>:<ReferenceScene2D seconds={seconds} theme={theme} layers={visibleLayers} onCreatureClick={onCreatureClick}/>}
   {overlay&&<video ref={video} className="reference-overlay" src={REFERENCE_URL} playsInline preload="auto" muted={!soundEnabled}
    disablePictureInPicture controls={false} {...X5_INLINE_ATTRS}
    style={{opacity}} onError={()=>setVideoError(true)}
    onLoadedMetadata={()=>{const v=video.current;if(!v)return;v.currentTime=Math.min(seconds,Math.max(0,v.duration-1/FPS));if(isPlaying)void v.play().catch(()=>{});}}/>}
  </div>
  <div className="reference-toolbar reference-bottom">
   <div className="reference-actions">
    <button className="qc-btn qc-btn--ghost qc-btn--sm" aria-label="上一帧" disabled={frame<=0} onClick={()=>onSeek(clamp((frame-1)/(DURATION*FPS)))}>← 上一帧</button>
    <span className="reference-time">{seconds.toFixed(2)} s · {frame} / 143 帧</span>
    <button className="qc-btn qc-btn--ghost qc-btn--sm" aria-label="下一帧" disabled={frame>=143} onClick={()=>onSeek(clamp((frame+1)/(DURATION*FPS)))}>下一帧 →</button>
   </div>
   {overlay?<label className="reference-actions">原片透明度 <input aria-label="原片透明度" className="qc-range" type="range" min="0" max="1" step=".05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>:<span className="qc-hint">{is3DMode?'拖动旋转 · 滚轮缩放 · 可回到原片视角':'与原片一致的 16:9 画幅 · 拖动进度可暂停对照'}</span>}
  </div>
  {videoError&&<p className="qc-err" role="status">参考视频加载失败，复现场景仍可独立播放。</p>}
 </section>;
}
