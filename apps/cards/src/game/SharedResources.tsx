import {useEffect,useState} from 'react';
import {readGame,onGameChange,type GameProfile} from '@lxh/shared-session/game.js';
import {SHOWN_RESOURCES,RESOURCE_NAMES} from '../world/resources';
import './journey.css';
export function useGameProfile(){
  const [profile,setProfile]=useState<GameProfile|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;const load=()=>readGame().then(p=>{if(active){setProfile(p);setError('');}}).catch(e=>{if(active)setError(e.message);});load();const stop=onGameChange(load);return()=>{active=false;stop();};},[]);
  return {profile,error,setError};
}
export function ResourceBar({profile}:{profile:GameProfile|null}){
  return <div className="journey-resources">{SHOWN_RESOURCES.map(key=><span key={key}>{RESOURCE_NAMES[key]}<b>{profile?.resources[key]??'—'}</b></span>)}</div>;
}
export function SharedResources({onOpen}:{onOpen:()=>void}){
  const {profile,error}=useGameProfile();
  return <aside className="journey-summary" aria-label="共同旅途进度"><ResourceBar profile={profile}/><button className="text-button" onClick={onOpen}>共同旅途 · 角色与灵卡 →</button>{error&&<p role="alert">{error}</p>}</aside>;
}
