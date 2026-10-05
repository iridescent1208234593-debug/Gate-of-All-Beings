import logo from './logoPaths.json';
import type { ThemeMode } from '../../types';

export const WIDTH = 1280;
export const HEIGHT = 720;
export const DURATION = 6;
export const FPS = 24;
export type LayerName = 'moon' | 'creatures' | 'bushes' | 'gate' | 'text';
export type LayerVisibility = Record<LayerName, boolean>;
export const ALL_LAYERS: LayerVisibility = { moon:true, creatures:true, bushes:true, gate:true, text:true };
export const REFERENCE_URL = '/reference/luoxiaohei_ep29.mp4';
export const palette = (theme: ThemeMode) => ({
  cream: '#fdfbe5', outline: '#fdfbe5',
  leaf: theme==='twilight' ? '#6b91b0' : theme==='emerald' ? '#4d9770' : theme==='golden' ? '#b69a4d' : theme==='cyber' ? '#ad71bb' : '#84a046',
  lightLeaf: theme==='original' ? '#afc477' : theme==='twilight' ? '#a1bfd1' : theme==='cyber' ? '#d0a9da' : '#bfd497',
  vein:'#b7c894', leafVeil:'#d6e0b7', spirit:'#fdfbe5',spiritEdge:'#e2e3c4',
});
export type ColorName = keyof ReturnType<typeof palette>;
export interface VectorPart { d:string; fill?:ColorName; stroke?:ColorName; strokeWidth?:number; opacity?:number; }
export interface SceneLayer {
  id:string; visibility:LayerName; start:number; end:number;
  pivot:[number,number]; z:number; depth:number; parts:VectorPart[];
  motion?:'grow'|'rise'|'reveal';
}

// Coordinates are measured in the reference video's 1280 × 720 frame.
// Geometry is vector artwork, not a video or screenshot used as the reconstruction.
export const SCENE_LAYERS: SceneLayer[] = [
  {id:'ground',visibility:'bushes',start:1.66,end:2.04,pivot:[640,358],z:-170,depth:8,parts:[
    {d:'M456 353 L640 247 L825 354 Q827 357 820 361 L640 464 L459 360 Q452 357 456 353 Z',fill:'leaf'},
  ]},
  {id:'back-leaves',visibility:'bushes',start:1.95,end:2.45,pivot:[640,357],z:-155,depth:10,parts:[
    {d:'M525 350 C490 355 456 350 443 327 C429 307 441 289 461 290 C486 288 512 312 533 321 Z',fill:'lightLeaf'},
    {d:'M765 346 C765 297 775 255 779 225 C783 195 808 190 824 204 C850 223 839 244 822 276 C843 263 862 279 848 300 C831 325 802 341 765 346 Z',fill:'leaf'},
  ]},
  {id:'deer',visibility:'creatures',start:2.38,end:2.91,pivot:[485,319],z:-148,depth:26,motion:'rise',parts:[
    {d:'M445 172 C425 174 417 150 422 136 C425 122 437 124 443 132 C440 108 450 81 463 77 C474 71 482 83 477 96 C471 113 460 135 464 154 L445 172 Z',fill:'spirit',stroke:'outline',strokeWidth:4,opacity:.6},
    {d:'M508 163 C522 143 517 118 518 97 C517 83 527 75 535 84 C552 104 546 128 533 149 C549 126 558 127 561 139 C568 156 548 179 525 173 Z',fill:'spirit',stroke:'outline',strokeWidth:4,opacity:.6},
    {d:'M478 149 C448 151 437 169 435 200 C430 242 436 281 452 301 C469 322 509 326 541 319 C532 293 529 266 530 230 C531 188 528 165 506 154 C497 150 486 148 478 149 Z',fill:'spirit',stroke:'outline',strokeWidth:4,opacity:.6},
    {d:'M449 229 C438 200 457 186 476 201 C504 219 520 274 536 320 C498 317 465 272 449 229 Z',fill:'leafVeil'},
    {d:'M463 219 Q492 247 534 319 M462 240 Q482 260 505 269',stroke:'vein',strokeWidth:4},
    {d:'M464 190 L463 202 M493 192 L494 204',stroke:'outline',strokeWidth:5},
  ]},
  {id:'moon',visibility:'moon',start:1.02,end:1.82,pivot:[654,265],z:0,depth:0,parts:[]},
  {id:'front-leaves',visibility:'bushes',start:1.93,end:2.5,pivot:[640,413],z:145,depth:9,parts:[
    {d:'M519 368 C509 347 523 328 542 333 C555 335 562 343 566 348 C560 322 563 302 578 300 C600 294 606 320 600 343 C621 320 640 329 639 346 C636 369 623 386 603 397 L557 410 Z',fill:'leaf'},
    {d:'M656 414 C648 395 648 377 658 370 C668 365 675 374 676 385 C674 368 682 353 691 356 C705 358 702 372 695 383 C709 371 721 377 720 390 C723 404 708 422 694 429 Z',fill:'leaf'},
  ]},
  {id:'whale',visibility:'creatures',start:2.07,end:2.92,pivot:[764,326],z:157,depth:22,motion:'rise',parts:[
    {d:'M736 284 C715 285 700 298 699 318 C695 336 708 348 725 354 C750 364 786 365 801 345 C814 328 818 300 817 265 C842 260 845 244 832 240 C824 236 818 241 813 245 C818 225 800 213 793 228 C788 238 795 253 795 267 C784 284 764 282 736 284 Z',fill:'spirit',stroke:'spiritEdge',strokeWidth:4,opacity:.53},
    {d:'M786 330 Q812 325 809 338 Q803 350 777 345',stroke:'outline',strokeWidth:3,opacity:.72},
    {d:'M747 313 C755 313 756 331 747 332 C739 331 739 314 747 313 Z',fill:'leafVeil'},
  ]},
  {id:'blob',visibility:'creatures',start:2.29,end:2.88,pivot:[574,407],z:159,depth:19,motion:'rise',parts:[
    {d:'M538 387 C539 368 555 357 574 360 C595 360 609 373 608 392 C607 405 590 407 573 408 C551 409 535 404 538 387 Z',fill:'spirit',stroke:'outline',strokeWidth:5,opacity:.58},
    {d:'M565 379 L566 393 M587 378 L588 392',stroke:'outline',strokeWidth:5,opacity:.75},
  ]},
  {id:'gate',visibility:'gate',start:2.84,end:3.67,pivot:[640,369],z:-5,depth:20,motion:'reveal',parts:logo.gate as VectorPart[]},
  {id:'cube',visibility:'gate',start:3.2,end:3.67,pivot:[737,422],z:165,depth:18,parts:[
    {d:'M737 394 L761 407 L761 435 L737 449 L713 436 L713 407 Z',fill:'cream'},
  ]},
  {id:'text',visibility:'text',start:2.99,end:3.73,pivot:[640,535],z:0,depth:7,motion:'reveal',parts:logo.text as VectorPart[]},
];

export const clamp = (v:number) => Math.max(0,Math.min(1,v));
export function layerState(layer:SceneLayer, seconds:number) {
  const p=clamp((seconds-layer.start)/(layer.end-layer.start));
  const ease=1-Math.pow(1-p,3);
  if(layer.id==='moon')return {sx:ease,sy:ease,dy:0,opacity:p>0?1:0};
  if(layer.motion==='reveal')return {sx:1,sy:.93+.07*ease,dy:-4*(1-ease),opacity:p};
  if(layer.motion==='rise')return {sx:.55+.45*ease,sy:.12+.88*ease,dy:14*(1-ease),opacity:clamp(p*4)};
  return {sx:ease,sy:.2+.8*ease,dy:0,opacity:p>0?1:0};
}
// Fixed seed: seeking to the same time always yields the same particles.
export const stars=Array.from({length:28},(_,i)=>({angle:i*2.399963, radius:35+((i*41)%140),size:.5+(i%4)*.35,delay:(i%6)*.025}));
export function starState(star:typeof stars[number],seconds:number){
  const p=clamp((seconds-.76-star.delay)/.74);
  const radius=star.radius*(1-p);
  return {x:654+Math.cos(star.angle)*radius,y:265+Math.sin(star.angle)*radius*.75,opacity:p>0&&p<1?Math.sin(p*Math.PI):0};
}
