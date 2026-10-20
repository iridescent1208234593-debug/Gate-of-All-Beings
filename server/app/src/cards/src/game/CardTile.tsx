import { useState } from 'react';
import { ABILITY_SYSTEMS, ELEMENTS } from '@lxh/shared-types/world';
import { CARDS, HEROES } from './core/content';
import { effectText } from './core/cardText';
import { costOf, effectOf, upgradeOf } from './core/engine';
import type { CardInstance } from './core/types';
import { portrait } from './assets';

/** 入世历练原有的灵卡与头像组件；众生牌录和出行共用同一套。 */
export function Portrait({name,className=''}:{name:string;className?:string}) {const [failed,setFailed]=useState(false);return failed?<span className={`portrait-fallback ${className}`}>{name.slice(-1)}</span>:<img className={className} src={portrait(name)} alt={name} onError={()=>setFailed(true)}/>;}
export function CardTile({card,onClick,disabled=false,label,small=false}:{card:CardInstance;onClick?:()=>void;disabled?:boolean;label?:string;small?:boolean}) {const c=CARDS[card.card];const e=effectOf(card);const up=upgradeOf(card);const details=up?up.text:c.upgrade?c.text:effectText(e);const cost=costOf(card);const name=up?.name??c.name;const kind=[c.type,c.school&&ABILITY_SYSTEMS[c.school],c.element&&ELEMENTS[c.element]].filter(Boolean).join(' · ');return <button className={`spirit-card ${small?'small':''} card-${c.owner}`} data-card-type={c.type} data-element={c.element} data-school={c.school} onClick={onClick} disabled={disabled} aria-label={label??`${name}${card.upgraded?'，已精进':''}，${kind}，${details}`}><span className="card-top"><b>{cost}</b><span className="card-type">{kind}</span></span><div className="card-art"><span>{c.glyph}</span><i/><i/></div><strong>{name}{card.upgraded&&!up&&<sup>＋</sup>}</strong><p>{card.upgraded?details:c.text}</p><span className="card-foot">{c.exhaust?'消耗 · 本场仅用一次':c.source|| (c.owner==='all'?'通用灵术':HEROES[c.owner].name)}</span>{label&&<em>{label}</em>}</button>;}
