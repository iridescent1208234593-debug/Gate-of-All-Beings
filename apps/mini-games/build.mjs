import { mkdirSync, readdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source=path.dirname(fileURLToPath(import.meta.url));
function copy(sourcePath,target) {
  const stat=lstatSync(sourcePath);
  if(stat.isDirectory()){
    mkdirSync(target,{recursive:true});
    for(const entry of readdirSync(sourcePath))copy(path.join(sourcePath,entry),path.join(target,entry));
  }else if(stat.isFile())writeFileSync(target,readFileSync(sourcePath));
  else throw new Error('Only regular mini-game files may be published');
}
// An explicit publish list keeps tests, documentation and package metadata out of the game.
export function buildMiniGames(destination) {
  const output=path.resolve(destination),relative=path.relative(output,source);
  if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))||output.startsWith(source+path.sep))throw new Error('Build output must be outside the mini-games source directory');
  mkdirSync(output,{recursive:true});
  for(const name of ['index.html','file-mode.js','style.css','src','assets'])copy(path.join(source,name),path.join(output,name));
  return output;
}
