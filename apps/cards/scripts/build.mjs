import {spawnSync} from 'node:child_process';
import {buildModules} from './build-modules.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
buildModules();
const result=spawnSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
