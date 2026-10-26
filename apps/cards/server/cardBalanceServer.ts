import express, {type Request} from 'express';
import {mkdir,readFile,writeFile,rename,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import type {Plugin} from 'vite';
import {BASE_CARDS} from '../src/game/core/content';
import {validateBalance,type CardOverrides} from '../src/game/core/cardBalance';
import {validateEcoIndividual} from '@lxh/shared-types/exchange';
import type {EcoIndividual} from '@lxh/shared-types/models';
import {createRequire} from 'node:module';
const runtimePaths = createRequire(import.meta.url)('../../../services/platform/runtime-paths.cjs');

interface BalanceFile {schemaVersion:1;revision:number;updatedAt:string|null;overrides:CardOverrides;individuals:Record<string,EcoIndividual>}
const empty=():BalanceFile=>({schemaVersion:1,revision:0,updatedAt:null,overrides:{},individuals:{}});
const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});
const validId=(id:string)=>/^[a-zA-Z0-9][a-zA-Z0-9-]{0,159}$/.test(id);
function validateFile(value:BalanceFile):BalanceFile {
  if(!value||value.schemaVersion!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!value.overrides||Array.isArray(value.overrides)||!value.individuals||Array.isArray(value.individuals))throw new Error('配置格式错误');
  if(Object.keys(value.individuals).length>512||Object.keys(value.overrides).length>610)throw new Error('配置数量超过限制');
  const result=empty();result.revision=value.revision;result.updatedAt=value.updatedAt;
  for(const [id,data] of Object.entries(value.individuals)){
    const individual=validateEcoIndividual(data);
    if(id!==individual.id)throw new Error('个体编号不一致');
    result.individuals[id]=individual;
  }
  for(const [id,balance] of Object.entries(value.overrides)){
    if(!validId(id)||(!Object.hasOwn(BASE_CARDS,id)&&!Object.hasOwn(result.individuals,id)))throw new Error('卡牌编号无效');
    result.overrides[id]=validateBalance(balance);
  }
  return result;
}
export class CardBalanceStore {
  constructor(readonly directory:string){}
  async read():Promise<BalanceFile>{
    let text:string;
    try{text=await readFile(path.join(this.directory,'config.json'),'utf8');}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return empty();throw fail(503,'无法读取卡牌配置，原文件已保留。');}
    try{return validateFile(JSON.parse(text));}catch{throw fail(503,'卡牌配置损坏，已停止写入；请从后台备份恢复。');}
  }
  async update(id:string,revision:unknown,value:unknown,individual?:unknown){
    if(!validId(id))throw fail(400,'卡牌编号无效。');
    await mkdir(this.directory,{recursive:true});
    const lock=path.join(this.directory,'.write-lock');
    try{await mkdir(lock);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw fail(409,'另一个页面正在保存，请稍后重新加载配置。');throw error;}
    try{
      const current=await this.read();
      if(!Number.isSafeInteger(revision)||revision!==current.revision)throw fail(409,'配置已在其他页面更新，请重新加载后再修改。');
      const next=structuredClone(current);
      if(!Object.hasOwn(BASE_CARDS,id)){
        const data=validateEcoIndividual(individual??current.individuals[id]);
        if(data.id!==id)throw fail(400,'生态个体与卡牌编号不一致。');
        if(!Object.hasOwn(next.individuals,id)&&Object.keys(next.individuals).length>=512)throw fail(400,'后台最多保存 512 个生态个体。');
        next.individuals[id]=data;
      }
      if(value===null){delete next.overrides[id];delete next.individuals[id];}
      else next.overrides[id]=validateBalance(value);
      next.revision++;next.updatedAt=new Date().toISOString();
      const backups=path.join(this.directory,'backups');await mkdir(backups,{recursive:true});
      await writeFile(path.join(backups,`${current.revision}-${Date.now()}-${randomUUID()}.json`),JSON.stringify(current,null,2),'utf8');
      const temporary=path.join(this.directory,`${randomUUID()}.tmp`);
      await writeFile(temporary,JSON.stringify(next,null,2),'utf8');
      await rename(temporary,path.join(this.directory,'config.json'));
      return next;
    }finally{await rmdir(lock);}
  }
}
function localAdmin(req:Request){
  const address=req.socket.remoteAddress;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address||''))return false;
  try{
    // The portal replaces this header with the original client host.
    const host=new URL(`http://${req.headers["x-forwarded-host"] || req.headers.host}`);
    if(!['127.0.0.1','localhost','[::1]'].includes(host.hostname))return false;
    if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==host.host||!['http:','https:'].includes(origin.protocol))return false;}
    return true;
  }catch{return false;}
}
export function createCardBalanceApi(directory:string){
  const app=express(),store=new CardBalanceStore(directory),token=randomBytes(32).toString('hex');
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.get('/',async(req,res,next)=>{try{const state=await store.read(),editable=localAdmin(req);res.json({revision:state.revision,updatedAt:state.updatedAt,overrides:state.overrides,editable,token:editable?token:undefined,backup:editable?state:undefined});}catch(error){next(error);}});
  app.put('/cards/:id',(req,res,next)=>{
    if(!localAdmin(req)||req.headers['x-card-admin-token']!==token){res.status(403).json({error:'数值管理仅支持本机同源页面，请从 127.0.0.1 打开图鉴。'});return;}next();
  },express.json({limit:'16kb'}),async(req,res,next)=>{
    try{const state=await store.update(req.params.id,req.body?.revision,req.body?.value,req.body?.individual);res.json({revision:state.revision,updatedAt:state.updatedAt,overrides:state.overrides,editable:true,token,backup:state});}catch(error){next(error);}
  });
  app.use((_req,res)=>res.status(404).json({error:'没有这个数值管理接口。'}));
  app.use((error:Error&{status?:number},_req:Request,res:express.Response,_next:express.NextFunction)=>{
    const status=error.status||((error as NodeJS.ErrnoException).code?503:400);
    res.status(status).json({error:status>=500?'后台保存或读取失败，已有配置未被替换。':error.message});
  });
  return app;
}
export function cardBalancePlugin(directory:string):Plugin {
  const attach=(server:{middlewares:{use:(path:string,handler:ReturnType<typeof createCardBalanceApi>)=>unknown}})=>{runtimePaths.requireReady();server.middlewares.use('/api/card-balance',createCardBalanceApi(directory));};
  return {name:'card-balance-backend',configureServer:attach,configurePreviewServer:attach};
}
