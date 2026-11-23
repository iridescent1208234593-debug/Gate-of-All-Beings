import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createInitialState} from '../src/core/state.js';
import {encodeWorld} from '../src/core/persistence.js';


const origin='http://127.0.0.1:5118';
const duration=Number(process.argv[2] ?? 12);
if (!Number.isInteger(duration) || duration < 3 || duration > 180) {
  throw new Error('Use node apps/ecology/tests/benchmark-browser.mjs <seconds 3–180>');
}
const seed=101;
const root=fileURLToPath(new URL('../../../',import.meta.url));
const assets=resolve(root, process.env.ECOLOGY_BUILD_DIR || 'apps/ecology/dist');
const shell=resolve(root, process.env.ECOLOGY_SHELL || 'apps/shell/index.html');
const defaultArgs=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const args=process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : defaultArgs;
const launch=()=>chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args,headless:true});
let browser;
const fixture=(cells, organisms)=>{
  const state=createInitialState(seed);
  const resize=(items,count)=>Array.from({length:count},(_,i)=>{
    if(i<items.length)return items[i];
    const extra=structuredClone(items[i%items.length]);
    extra.id=state.nextId++;
    extra.pos[0]*=.9;
    return extra;
  });
  state.cells=resize(state.cells,cells);
  state.organisms=resize(state.organisms,organisms);
  return encodeWorld(state);
};
function mime(path){
  return path.endsWith('.js')||path.endsWith('.mjs')?'text/javascript':
    path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html';
}
try {
  for(const [label,cells,organisms] of [['low',20,2],['typical',80,8],['cap',130,24]]) {
    browser=await launch();
    if(label==='low') console.log(JSON.stringify({browser:browser.version(),duration,seed,viewport:[960,540],softwareGPU:true}));
    const ctx=await browser.newContext({viewport:{width:960,height:540}});
    await ctx.addInitScript(world=>{
      if (location.origin !== 'http://127.0.0.1:5118') return;
      localStorage.setItem('iridescently.save.v1',JSON.stringify({'m:ecology:zszm-ecology-v2':world}));
      window.qaProbe={frames:0,contexts:[],hudWrites:0,redundantHudWrites:0};
      const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(Node.prototype, 'textContent', {...text, set(value) {
        if (/^hud-(cells|food|energy|split|culled|evo-points|tribe|civ)$/.test(this.id ?? '')) {
          qaProbe.hudWrites++;
          if (text.get.call(this) === value) qaProbe.redundantHudWrites++;
        }
        text.set.call(this, value);
      }});
      const raf=window.requestAnimationFrame;
      window.requestAnimationFrame=function(cb){return raf.call(window,time=>{window.qaProbe.frames++;cb(time);});};
      const glContexts=new WeakMap();
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(...args){
        const gl=get.apply(this,args);
        if(gl && /^webgl/.test(args[0]) && !glContexts.has(gl)) {
          const entry={kind:args[0],created:{},deleted:{},draws:0,lost:false};
          glContexts.set(gl,entry);
          qaProbe.contexts.push(entry);
          this.addEventListener('webglcontextlost',()=>{entry.lost=true;});
          for(const stem of ['Buffer','Texture','Framebuffer','Renderbuffer','Program','Shader','VertexArray']) {
            for(const prefix of ['create','delete']){
              const fn=gl[prefix+stem];
              if(typeof fn!=='function')continue;
              gl[prefix+stem]=function(...a){
                const out=fn.apply(this,a);
                if(prefix==='create'?out:a[0]){
                  const counts=prefix==='create'?entry.created:entry.deleted;
                  counts[stem]=(counts[stem]||0)+1;
                }
                return out;
              };
            }
          }
          for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
            const fn=gl[name];
            if(typeof fn!=='function')continue;
            gl[name]=function(...a){entry.draws++;return fn.apply(this,a);};
          }
        }
        return gl;
      };
    },fixture(cells,organisms));
    const portal={links:[
      {key:'ecology',name:'生态进化',url:'/app/modules/ecology/',embed:true},
      {key:'juling',name:'聚灵',url:'/app/modules/juling/',embed:true},
    ]};
    await ctx.route('**/*',async route=>{
      const {origin:o,pathname:p}=new URL(route.request().url());
      if(o!==origin)return route.abort();
      if(p.startsWith('/api/'))return route.fulfill({json:{logged_in:false}});
      if(p==='/app/portal.json')return route.fulfill({json:portal});
      if(p.startsWith('/app/modules/juling/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><main id="qa-other">fixture route</main>'});
      const file=p.startsWith('/app/shell/')?shell:
        p.startsWith('/app/modules/ecology/')?resolve(assets,p.slice('/app/modules/ecology/'.length)):
        p.startsWith('/shared/')?resolve(root,'packages',p.slice('/shared/'.length)):null;
      if(!file)return route.fulfill({status:404});
      try{return route.fulfill({contentType:mime(file),body:await readFile(file)});}
      catch{return route.fulfill({status:404});}
    });
    const page=await ctx.newPage();page.setDefaultTimeout(15000);
    const failures=[];page.on('pageerror',e=>failures.push(e.message));
    const cdp=await ctx.newCDPSession(page);await cdp.send('Performance.enable');
    await page.goto(origin+'/app/shell/m/ecology');
    await page.waitForFunction(()=>qaProbe.contexts.some(x=>x.draws>0));
    const read=async()=>{
      const [web,metrics,dom]=await Promise.all([
        page.evaluate(()=>({now:performance.now(),frames:qaProbe.frames,hudWrites:qaProbe.hudWrites,redundantHudWrites:qaProbe.redundantHudWrites,contexts:qaProbe.contexts,hidden:document.hidden,cells:document.getElementById('hud-cells')?.textContent,organisms:document.getElementById('hud-org')?.textContent,food:document.getElementById('hud-food')?.textContent})),
        cdp.send('Performance.getMetrics'),cdp.send('Memory.getDOMCounters')
      ]);
      return {...web,jsHeapKiB:Math.round(metrics.metrics.find(m=>m.name==='JSHeapUsedSize').value/1024),dom};
    };
    const samples=[await read()];
    for(let i=0;i<3;i++){await page.waitForTimeout(duration*1000/3);samples.push(await read());}
    const fps=(samples.at(-1).frames-samples[0].frames)*1000/(samples.at(-1).now-samples[0].now);
    const redundantWrites=samples.at(-1).redundantHudWrites-samples[0].redundantHudWrites;
    if (!process.env.ECOLOGY_PROBE_BASELINE) {
      assert.equal(redundantWrites,0,`${label}: unchanged per-frame HUD text must not be replaced`);
    }
    const beforeHidden=await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
      return qaProbe.frames;
    });
    await page.waitForTimeout(350);
    const hidden=await read();
    assert.equal(hidden.hidden,true);
    assert.equal(hidden.frames,beforeHidden,'main loop is inactive while hidden');
    await page.evaluate(()=>{
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(prev=>qaProbe.frames>prev,beforeHidden);
    await page.locator('#iridescently-shell-navlinks a[href="/app/shell/m/juling"]').click();
    await page.locator('#qa-other').waitFor();
    await page.waitForFunction(()=>qaProbe.contexts[0].lost);
    const away=await read();await page.waitForTimeout(350);
    assert.equal((await read()).frames,away.frames,'main loop is idle after Shell unmount');
    await page.locator('#iridescently-shell-navlinks a[href="/app/shell/m/ecology"]').click();
    await page.waitForFunction(()=>qaProbe.contexts.some((x,i)=>i>0&&x.draws>0));
    const remount=await read();
    assert.equal(remount.contexts.filter(x=>!x.lost).length,1);
    assert.deepEqual(failures,[]);
    console.log(JSON.stringify({label,cells,organisms,fps:+fps.toFixed(1),redundantWrites,samples,
      paused:{from:beforeHidden,to:hidden.frames},exit:{frames:away.frames,contexts:away.contexts,jsHeapKiB:away.jsHeapKiB,dom:away.dom},
      reentry:{frames:remount.frames,contexts:remount.contexts,jsHeapKiB:remount.jsHeapKiB,dom:remount.dom}}));
    await ctx.close();
    await browser.close();
  }
}finally{await browser?.close();}
