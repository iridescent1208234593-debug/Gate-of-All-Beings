import {validateEcoExchange} from '@lxh/shared-types/exchange';

/** Durable imports are acknowledged only after dispatch has successfully saved the new state. */
export function mountHubBridge({getState,dispatch,isReady}) {
  if(parent===window)return ()=>{};
  const post=data=>parent.postMessage(data,location.origin);
  const announce=()=>{if(isReady())post({type:'zszm:management-ready',resources:getState().resources});};
  const receive=e=>{
    if(e.origin!==location.origin||e.source!==parent)return;
    if(e.data?.type==='zszm:management-ping'){announce();return;}
    if(e.data?.type!=='zszm:deliver-ecology')return;
    try{
      const packet=validateEcoExchange(e.data.packet);
      if(!isReady())throw new Error('据点存档正在恢复，请稍候。');
      if((getState().ecoReceipts?.[packet.worldId]||0)<packet.sequence)dispatch({type:'IMPORT_ECOLOGY',packet});
      post({type:'zszm:delivery-received',worldId:packet.worldId,sequence:packet.sequence,resources:getState().resources});
    }catch(err){post({type:'zszm:delivery-error',message:err.message});}
  };
  window.addEventListener('message',receive);
  const timer=setInterval(announce,3000);announce();
  return()=>{clearInterval(timer);window.removeEventListener('message',receive);};
}
