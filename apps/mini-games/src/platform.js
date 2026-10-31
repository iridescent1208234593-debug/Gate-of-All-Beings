// This is the only integration boundary. Engines never fetch OC data or access storage.
export class LoginRequired extends Error {}
export class AccountChanged extends Error {}
export function ownerKey(identity) {
  const owner=identity?.owner;
  if(!identity?.logged_in || !['local','usso'].includes(owner?.kind) || !owner.user_id) throw new LoginRequired('请先登录会馆，再选择自己的 OC。');
  return `${owner.kind}:${owner.user_id}`;
}
async function json(url,fetcher) {
  const response=await fetcher(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(response.status===401)throw new LoginRequired('登录已失效，请重新登录会馆。');
  if(!response.ok)throw new Error('暂时无法读取 OC，请稍后重试。');
  return response.json();
}
export async function readOwner(fetcher=fetch) {return ownerKey(await json('/api/gate/identity',fetcher));}
export async function loadOwnedOCs(fetcher=fetch) {
  const owner=await readOwner(fetcher),data=await json('/api/gate/ocs',fetcher);
  if(owner!==await readOwner(fetcher))throw new AccountChanged('账户已切换，请重新选择 OC。');
  if(!Array.isArray(data.ocs))throw new Error('OC 列表格式异常，请重试。');
  const seen=new Set();
  const ocs=data.ocs.filter(oc=>oc && typeof oc.id==='string' && oc.id && !seen.has(oc.id) && seen.add(oc.id)).map(oc=>({
    id:oc.id,name:String(oc.name||'未命名 OC').slice(0,80),
    species:[oc.species_type,oc.species_detail].filter(v=>typeof v==='string'&&v).join(' · '),
    images:[oc.avatar_url,oc.avatar_asset_id,...(Array.isArray(oc.images)?oc.images:[])].filter(v=>typeof v==='string'&&v),
  }));
  return {owner,ocs};
}
// Only the current origin and the explicit Huiguan origin on the same approved root.
// Stored upload IDs are displayed via the protected preview endpoint, never the raw file.
export function imageChoices(oc,base,huiguanOrigin) {
  const origins=new Set([new URL(base).origin,new URL(huiguanOrigin).origin]);
  const result=[];
  for(const value of oc.images){
    let url;
    try{
      url=new URL(value,base);
      if(!origins.has(url.origin)||!['http:','https:'].includes(url.protocol)||url.username||url.password)continue;
      if(url.pathname.startsWith('/assets/uploads/'))url=new URL('/api/uploads/preview?name='+encodeURIComponent(url.pathname.slice('/assets/uploads/'.length)),huiguanOrigin);
      if(!url.pathname.startsWith('/api/uploads/preview')&&!url.pathname.startsWith('/api/image-preview')&&!url.pathname.startsWith('/api/assets/')&&!url.pathname.startsWith('/assets/'))continue;
      if(!result.includes(url.href))result.push(url.href);
    }catch{ /* A malformed or external image does not become an upload/import path. */ }
  }
  return result;
}

export function progressKey(owner,game) {return `mini-games.v1:${encodeURIComponent(owner)}:${game}`;}
export function readProgress(storage,owner,game) {
  const text=storage.getItem(progressKey(owner,game));
  if(!text)return {version:1,best:0,selectedOc:'',map:'',difficulty:'normal'};
  let value;
  try{value=JSON.parse(text);}catch{throw new Error('小游戏本地记录无法读取，原数据已保留。');}
  if(value?.version!==1||!Number.isSafeInteger(value.best)||value.best<0)throw new Error('小游戏本地记录格式不兼容，原数据已保留。');
  return value;
}
export function saveProgress(storage,owner,game,patch) {
  const current=readProgress(storage,owner,game);
  const better=(patch.best||0)>current.best||((patch.best||0)===current.best&&(patch.distance||0)>(current.distance||0));
  const next={...current,...patch,version:1,best:Math.max(current.best,patch.best||0),distance:better?(patch.distance||0):(current.distance||0)};
  storage.setItem(progressKey(owner,game),JSON.stringify(next));return next;
}
