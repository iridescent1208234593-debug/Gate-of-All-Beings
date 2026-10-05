import {spawnSync} from 'node:child_process';
import {cpSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export function buildModules(){
  for(const [folder,mount] of [['ecology','ecology'],['management','management']]){
    const cwd=path.resolve(root,'..',folder);
    const result=spawnSync(process.execPath,[path.join(cwd,'node_modules/vite/bin/vite.js'),'build','--base',`/${mount}/`],{cwd,stdio:'inherit'});
    if(result.status!==0)throw new Error(`${folder} build failed`);
    mkdirSync(path.join(root,'public',mount),{recursive:true});
    cpSync(path.join(cwd,'dist'),path.join(root,'public',mount),{recursive:true});
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url))buildModules();
