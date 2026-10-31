import { reportResult, leaderboardUrl } from '/shared/shared-session/progress.js';
import domains from '/shared/site-domains/index.mjs';
import { unifiedStorage } from '/shared/shared-session/kv.js';
import { RUNNER_MAPS } from './maps.js';
import { createRunner, resizeRunner, stepRunner, jump } from './runner.js';
import { CROSSING_MAPS, createCrossing, moveCrossing, stepCrossing, nextLevel } from './crossing.js';
import { loadImage, loadMap, prepareCanvas, drawRunner, drawCrossing } from './graphics.js';
import { LoginRequired, AccountChanged, loadOwnedOCs, readOwner, imageChoices, readProgress, saveProgress } from './platform.js';

const $=id=>document.getElementById(id);
const crossing=new URLSearchParams(location.search).get('game')==='crossing';
let gameKey=crossing?'frog-crossing':'oc-run',title=crossing?'青蛙过河':'OC 快跑';
const maps=crossing?CROSSING_MAPS:RUNNER_MAPS,storage=unifiedStorage('mini-games');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const listeners=new AbortController();
const on=(element,type,fn,options={})=>element.addEventListener(type,fn,{...options,signal:listeners.signal});
const defaultCharacter={id:'mini-games-default',name:'默认角色',species:'还没有 OC，也可以先玩',images:[],fallback:true};
const defaultImage=new URL('../assets/default-character.png',import.meta.url).href;
async function loadRoster(){
  try{return await loadOwnedOCs();}
  catch(error){if(error instanceof LoginRequired)return {owner:null,ocs:[]};throw error;}
}
async function currentOwner(){
  try{return await readOwner();}
  catch(error){if(error instanceof LoginRequired)return null;throw error;}
}
const characterChoices=oc=>oc.fallback?[defaultImage]:imageChoices(oc,location.href,huiguanOrigin);
const huiguanOrigin=new URL(domains.url('huiguan','/')).origin;
let owner=null,ocs=[],selected=null,character=null,map=maps[0],images={},game=null,runOwner=null;
let busy=false,disposed=false,frameId=0,lastTime=0,loadVersion=0,imageVersion=0,previewVersion=0;
let runRef=null,rankQueue=[],rankBusy=false;
let pendingSave=null,saveBlocked=false,accountCheck=null;
let progress={best:0},imageURLs=[],selectedImage='',resumeMode='running';

$('runner-mode-label').hidden=crossing;
$('leaderboard').href=leaderboardUrl(gameKey);
document.title=`${title} · 众生之门`;
$('game-title').textContent=title;$('play-title').textContent=title;
$('game-description').textContent=crossing?'带上自己的 OC，穿过车流，跳过林间的小河。':'带上自己的 OC，跑过门后的风景。';
$('instructions').textContent=crossing?'方向键、WASD、滑动或下方按钮逐格移动。避开车辆、站稳浮木，到达五个不同终点进入下一关；每局三次机会。P 或 Esc 暂停。':'空格、上方向键或点击游戏画面跳跃，空中可再跳一次。跳过地面障碍，遇到空中障碍可以留在地面。P 或 Esc 暂停。';
$('start').textContent=crossing?'开始过河':'开始快跑';
$('direction-pad').hidden=!crossing;$('crossing-stats').hidden=!crossing;
document.body.classList.toggle('is-crossing',crossing);
if(!['localhost','127.0.0.1'].includes(location.hostname))$('return-home').href=domains.url('zszm','/#home');
$('manage-ocs').href=domains.url('huiguan','/');
$('login').href=domains.url('huiguan','/account.html');

function updateStart(){ $('start').disabled=busy||!selected||!character; }
function readLocal(){
  saveBlocked=false;
  try{progress=readProgress(storage,owner,gameKey);$('save-status').textContent='成绩保存在当前浏览器，按账户区分。';$('retry-save').hidden=true;}
  catch(error){progress={best:0};saveBlocked=true;$('save-status').textContent=error.message+' 本次仍可游玩。';$('retry-save').hidden=false;}
  showBest();
}
function showBest(){
  $('best').textContent=gameKey==='oc-run-coins'?`本机最佳 · ${progress.best} 枚金币 · 距离 ${progress.distance||0}`:`本机最佳 · ${progress.best} 分`;
}
function syncMode(){
  if(busy){$('runner-mode').value=gameKey==='oc-run-coins'?'coins':'classic';return;}
  const coins=!crossing&&$('runner-mode').value==='coins';
  gameKey=crossing?'frog-crossing':coins?'oc-run-coins':'oc-run';
  $('leaderboard').href=leaderboardUrl(gameKey);$('difficulty').disabled=coins;
  if(coins)$('difficulty').value='normal';
  $('mode-hint').textContent=coins?'金币快跑固定普通难度。金币相同再比距离；磁铁、飞行包、护盾和双倍金币均在局内免费生成。':'';
  $('coin-stats').hidden=!coins;
  if(owner){
    readLocal();map=maps.find(item=>!item.comingSoon&&item.id===progress.map)||map;renderMaps();
    $('difficulty').value=coins?'normal':(['easy','normal','hard'].includes(progress.difficulty)?progress.difficulty:'normal');
  }
  void preview();
}
on($('runner-mode'),'change',syncMode);
async function submitRank(){
  if(rankBusy||!rankQueue.length)return;
  rankBusy=true;$('retry-rank').hidden=true;
  try{
    while(rankQueue.length){
      const pending=rankQueue[0];
      if(await readOwner()!==pending.owner){rankQueue=rankQueue.filter(p=>p!==pending);$('rank-status').textContent='账户已切换，原账户成绩不向新账户提交。';continue;}
      if(!rankQueue.includes(pending))continue;
      const result=await reportResult(pending.key,{...pending.report,toast:false});
      if(!result?.ok)throw new Error('排行榜提交失败，可联网后重试；你仍可继续游玩。');
      if(rankQueue.includes(pending)){
        rankQueue=rankQueue.filter(p=>p!==pending);
        $('rank-status').textContent=result.ranked?'本局成绩已提交排行榜。':'当前为访客，本局成绩不参与排行。';
      }
    }
  }catch(error){$('rank-status').textContent=error.message;}
  finally{rankBusy=false;$('retry-rank').hidden=!rankQueue.length;}
}
on($('retry-rank'),'click',()=>void submitRank());
function finishRank(){
  if(!game||game.mode!=='over'||game.rankQueued)return;
  game.rankQueued=true;
  if(!runOwner){$('rank-status').textContent='访客试玩不参与排行，登录后可提交成绩。';return;}
  rankQueue.push({owner:runOwner,key:gameKey,report:{score:gameKey==='oc-run-coins'?game.coins:game.score,distance:Math.floor(game.distance||0),finished:true,won:crossing&&game.level>1,ref:runRef}});
  $('rank-status').textContent='正在提交本局成绩…';void submitRank();
}
function persistLocal(){
  if(!owner)return;
  const patch={best:game?(gameKey==='oc-run-coins'?game.coins:game.score):progress.best||0,distance:game?Math.floor(game.distance||0):progress.distance||0,selectedOc:selected?.id||'',map:map.id,difficulty:$('difficulty').value};
  pendingSave={owner:runOwner||owner,patch};
  try{
    if(saveBlocked)throw new Error('原记录尚未恢复，本次成绩暂未保存。');
    const saved=saveProgress(storage,pendingSave.owner,gameKey,patch);
    if(pendingSave.owner===owner){progress=saved;showBest();}
    pendingSave=null;$('save-status').textContent='已保存到当前浏览器。';$('retry-save').hidden=true;
  }catch(error){$('save-status').textContent=`保存失败：${error.message} 请恢复存储后重试。`;$('retry-save').hidden=false;}
}
on($('retry-save'),'click',()=>{
  try{
    if(pendingSave){saveBlocked=false;saveProgress(storage,pendingSave.owner,gameKey,pendingSave.patch);pendingSave=null;}
    if(owner)readLocal();
  }catch(error){saveBlocked=true;$('save-status').textContent=error.message;}
});

function renderOCs(){
  $('oc-list').replaceChildren();
  for(const oc of ocs){
    const button=document.createElement('button');button.type='button';button.className='oc-option';button.setAttribute('aria-pressed',String(selected?.id===oc.id));
    const urls=characterChoices(oc);
    if(urls.length){const image=document.createElement('img');image.src=urls[0];image.alt='';image.loading='lazy';on(image,'error',()=>{image.hidden=true;});button.append(image);}
    else{const placeholder=document.createElement('span');placeholder.className='oc-placeholder';placeholder.textContent=oc.name.slice(0,1);button.append(placeholder);}
    const body=document.createElement('span'),name=document.createElement('strong'),species=document.createElement('small');
    name.textContent=oc.name;species.textContent=oc.species||'我的 OC';body.append(name,species);button.append(body);
    on(button,'click',()=>{if(!busy)void selectOC(oc);});$('oc-list').append(button);
  }
}
async function selectOC(oc){
  selected=oc;character=null;imageURLs=characterChoices(oc);selectedImage=imageURLs[0]||'';
  renderOCs();$('oc-image').replaceChildren();
  imageURLs.forEach((url,index)=>{const option=document.createElement('option');option.value=url;option.textContent=`图片 ${index+1}`;$('oc-image').append(option);});
  $('image-picker').hidden=imageURLs.length<2;
  if(!imageURLs.length){imageVersion++;$('image-status').textContent='这个 OC 暂无可用图片，请在会馆补充图片，或选择其他 OC。';updateStart();void preview();return;}
  await selectImage(selectedImage);
}
async function selectImage(url){
  const version=++imageVersion;character=null;selectedImage=url;updateStart();$('image-status').textContent='正在读取出场图片…';
  try{const image=await loadImage(url);if(disposed||version!==imageVersion)return;character=image;$('image-status').textContent=`本次出场：${selected.name}`;}
  catch(error){if(version===imageVersion)$('image-status').textContent=error.message;}
  if(version===imageVersion){updateStart();void preview();}
}
on($('oc-image'),'change',()=>void selectImage($('oc-image').value));

async function refreshOCs(){
  const version=++loadVersion,oldOwner=owner,oldSelection=selected?.id;imageVersion++;
  busy=true;character=null;selected=null;owner=null;ocs=[];$('oc-list').replaceChildren();$('image-picker').hidden=true;
  $('image-status').textContent='';$('login').hidden=true;$('oc-status').textContent='正在读取你的 OC…';updateStart();
  try{
    const data=await loadRoster();if(disposed||version!==loadVersion)return;
    owner=data.owner;ocs=data.ocs;progress={best:0};saveBlocked=false;
    if(owner)readLocal();else{$('save-status').textContent='当前为访客，可以试玩；登录后可保存账户成绩并参与排行。';showBest();}
    $('login').hidden=!!owner;
    map=maps.find(m=>!m.comingSoon&&m.id===progress.map)||maps[0];$('difficulty').value=['easy','normal','hard'].includes(progress.difficulty)?progress.difficulty:'normal';if(!crossing&&$('runner-mode').value==='coins')$('difficulty').value='normal';renderMaps();
    $('oc-status').textContent=ocs.length?`找到 ${ocs.length} 个 OC，选择一位出发。`:'还没有登记 OC，先用默认角色出发吧。';
    if(!ocs.length)ocs=[defaultCharacter];
    renderOCs();const choice=ocs.find(oc=>oc.id===(oldOwner===owner?oldSelection:progress.selectedOc))||ocs[0];
    if(choice)await selectOC(choice);
  }catch(error){if(version===loadVersion){$('oc-status').textContent=error.message||'OC 读取失败，请重试。';$('login').hidden=!(error instanceof LoginRequired);}}
  finally{if(version===loadVersion){busy=false;updateStart();void preview();}}
}
on($('refresh-ocs'),'click',()=>void refreshOCs());

function renderMaps(){
  $('map-list').replaceChildren();
  for(const item of maps){const button=document.createElement('button');button.type='button';button.textContent=item.comingSoon?item.name+' · 敬请期待':item.name;button.disabled=!!item.comingSoon;button.setAttribute('aria-pressed',String(map.id===item.id));on(button,'click',()=>{if(busy||item.comingSoon)return;map=item;renderMaps();void preview();});$('map-list').append(button);}
}
async function preview(){
  const version=++previewVersion,currentMap=map;
  try{
    const loaded=crossing?{}:await loadMap(currentMap);
    if(disposed||version!==previewVersion)return;
    images=loaded;const canvas=$('preview'),w=crossing?396:720,h=crossing?484:320,g=prepareCanvas(canvas,w,h);
    if(crossing)drawCrossing(g,createCrossing(currentMap.id,$('difficulty').value),character,true);
    else drawRunner(g,w,h,createRunner(),currentMap,loaded,character,true);
  }catch(error){if(version===previewVersion){$('image-status').textContent=`地图读取失败：${error.message}`;}}
}
on($('difficulty'),'change',()=>void preview());

async function start(){
  if(busy||!selected||!character)return;
  if(pendingSave){$('save-status').textContent='上一局成绩尚未保存，请先重试保存。';return;}
  busy=true;updateStart();const previousOwner=owner,ocId=selected.id;
  try{
    // Always revalidate ownership, even when the previously selected picture is cached.
    const data=await loadRoster();
    if(data.owner!==previousOwner)throw new AccountChanged('账户已切换，请重新选择 OC。');
    const oc=selected.fallback?(data.ocs.length?null:defaultCharacter):data.ocs.find(item=>item.id===ocId);
    if(!oc)throw new AccountChanged('OC 列表已更新，请刷新并重新选择角色。');
    if(!characterChoices(oc).includes(selectedImage))throw new AccountChanged('OC 配图已更新，请重新选择。');
    const [image,loaded]=await Promise.all([loadImage(selectedImage),crossing?{}:loadMap(map)]);
    if(disposed)return;
    character=image;images=loaded;runOwner=owner;game=crossing?createCrossing(map.id,$('difficulty').value):createRunner($('difficulty').value,$('runner-mode').value);runRef=crypto.randomUUID();$('rank-status').textContent='';$('pause').disabled=false;
    $('setup').hidden=true;$('play').hidden=false;$('overlay').hidden=true;
    $('playing-as').textContent=`${selected.name} · ${map.name}`;$('pause').textContent='暂停';
    $('game-canvas').focus();lastTime=performance.now();cancelAnimationFrame(frameId);frameId=requestAnimationFrame(frame);
    if(document.hidden)pause();
  }catch(error){$('image-status').textContent=error.message;if(error instanceof AccountChanged||error instanceof LoginRequired){await refreshOCs();$('image-status').textContent=error.message;}}
  finally{busy=false;updateStart();}
}
on($('start'),'click',()=>void start());
function showOverlay(heading,text,label){
  $('overlay-title').textContent=heading;$('overlay-text').textContent=text;$('continue').textContent=label;
  $('overlay').hidden=false;$('continue').focus({preventScroll:true});
}
function pause(){
  if(!game||!['running','hit'].includes(game.mode))return;
  resumeMode=game.mode;game.mode='paused';cancelAnimationFrame(frameId);persistLocal();$('pause').textContent='继续';
  showOverlay('休息一下','准备好了，就继续出发。','继续游戏');
}
async function guardAccount(){
  if(accountCheck)return accountCheck;
  accountCheck=(async()=>{
    try{
      if(await currentOwner()!==owner)throw new AccountChanged('账户已切换，请重新选择 OC。');
      return true;
    }catch(error){
      if(error instanceof AccountChanged||error instanceof LoginRequired){
        cancelAnimationFrame(frameId);game=null;runOwner=null;pendingSave=null;rankQueue=[];$('retry-rank').hidden=true;$('play').hidden=true;$('setup').hidden=false;
        await refreshOCs();$('image-status').textContent=error.message;
      }else{$('save-status').textContent='账户暂时无法验证，请联网后重试。';}
      return false;
    }
  })().finally(()=>{accountCheck=null;});return accountCheck;
}
async function continueGame(){
  if(busy||!game)return;
  busy=true;
  try{
    if(!await guardAccount()||!game)return;
    if(game.mode==='over'){busy=false;await start();return;}
    if(game.mode==='clear')nextLevel(game);
    else if(game.mode==='paused')game.mode=resumeMode;
    $('overlay').hidden=true;$('pause').textContent='暂停';$('game-canvas').focus();lastTime=performance.now();frameId=requestAnimationFrame(frame);
  }finally{busy=false;updateStart();}
}
on($('pause'),'click',()=>{if(game?.mode==='paused')void continueGame();else pause();});
on($('continue'),'click',()=>void continueGame());
function leave(){
  cancelAnimationFrame(frameId);if(game)persistLocal();game=null;runOwner=null;
  $('play').hidden=true;$('setup').hidden=false;void preview();$('start').focus();
}
on($('leave'),'click',leave);on($('choose-again'),'click',leave);

function draw(){
  const canvas=$('game-canvas');
  const w=crossing?396:Math.max(280,canvas.clientWidth),h=crossing?484:canvas.clientHeight;
  const g=prepareCanvas(canvas,w,h);
  if(crossing)drawCrossing(g,game,character,reducedMotion.matches);
  else{game.viewHeight=h;resizeRunner(game,w);drawRunner(g,w,h,game,map,images,character,reducedMotion.matches);}
}
function frame(now){
  if(disposed||!game)return;
  const dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
  if(!crossing)resizeRunner(game,Math.max(280,$('game-canvas').clientWidth));
  if(crossing)stepCrossing(game,dt);else stepRunner(game,dt);
  draw();$('score').textContent=String(game.score);
  if(crossing)$('crossing-stats').textContent=`第 ${game.level} 关 · 终点 ${game.goals.length}/5 · 机会 ${game.lives} · ${Math.ceil(game.time)} 秒`;
  if(!crossing&&game.gameMode==='coins'){
    const labels={magnet:'磁铁',jetpack:'飞行包',shield:'护盾',double:'双倍金币',grace:'保护中'};
    const effects=Object.entries(game.effects).filter(([,v])=>v>0).map(([k,v])=>`${labels[k]} ${k==='shield'?v+'层':Math.ceil(v)+'秒'}`).join(' / ');
    const summary=`金币 ${game.coins} · 距离 ${Math.floor(game.distance)}`;
    const signature=summary+'|'+effects;
    if($('coin-stats').dataset.signature!==signature){
      $('coin-stats').dataset.signature=signature;
      const total=document.createElement('span');total.textContent=summary;$('coin-stats').replaceChildren(total);
      for(const [key,value] of Object.entries(game.effects).filter(([,v])=>v>0)){
        const badge=document.createElement('span');badge.className='effect-badge';badge.dataset.effect=key;
        const icon=images[key];if(icon){const img=document.createElement('img');img.src=icon.src;img.alt='';badge.append(img);}
        const text=document.createElement('span');text.textContent=`${labels[key]} ${key==='shield'?value+'层':Math.ceil(value)+'秒'}`;badge.append(text);
        $('coin-stats').append(badge);
      }
    }
  }
  $('play-message').textContent=crossing?game.message:'空格／点击跳跃，空中可再跳一次。';
  if(game.mode==='over'||game.mode==='clear'){
    persistLocal();finishRank();$('pause').disabled=true;
    showOverlay(game.mode==='clear'?'这一关，全部到达！':'这一程，辛苦了',`本局 ${game.score} 分${game.gameMode==='coins'?` · ${game.coins} 枚金币 · 距离 ${Math.floor(game.distance)}`:''}${crossing?` · 第 ${game.level} 关`:''}`,game.mode==='clear'?'进入下一关':'再来一局');return;
  }
  $('pause').disabled=false;
  if(game.mode!=='paused')frameId=requestAnimationFrame(frame);
}
function act(direction){if(!game)return;if(crossing)moveCrossing(game,direction);else if(direction==='up')jump(game);}
on(document,'keydown',event=>{
  if(!game||/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target.tagName)&&event.target!==$('game-canvas'))return;
  const directions={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right',Space:'up'};
  if(directions[event.code]||['KeyP','Escape'].includes(event.code))event.preventDefault();else return;
  if(event.repeat)return;
  if(['KeyP','Escape'].includes(event.code)){if(game.mode==='paused')void continueGame();else pause();}
  else act(directions[event.code]);
});
let pointer=null;
on($('game-canvas'),'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();$('game-canvas').focus();if(crossing){pointer={id:event.pointerId,x:event.clientX,y:event.clientY};event.target.setPointerCapture(event.pointerId);}else act('up');});
on($('game-canvas'),'pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;pointer=null;if(Math.max(Math.abs(dx),Math.abs(dy))>=15)act(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');});
on($('game-canvas'),'pointercancel',()=>{pointer=null;});
for(const button of document.querySelectorAll('[data-move]'))on(button,'click',()=>{act(button.dataset.move);$('game-canvas').focus({preventScroll:true});});
on(window,'blur',pause);
on(document,'visibilitychange',()=>{if(document.hidden)pause();else if(selected)void guardAccount();});
on(window,'focus',()=>{if(selected)void guardAccount();});
on(window,'resize',()=>{if(game)draw();else void preview();});
function dispose(){
  if(disposed)return;cancelAnimationFrame(frameId);if(game)persistLocal();disposed=true;
  loadVersion++;imageVersion++;previewVersion++;listeners.abort();character=null;images={};
}
on(window,'pagehide',event=>{if(event.persisted)pause();else dispose();});
on(window,'pageshow',event=>{if(event.persisted&&selected)void guardAccount();});
renderMaps();syncMode();void refreshOCs();
