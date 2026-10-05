import { chromium } from '../../management/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'以罗小黑启程',exact:true}).waitFor();
await page.screenshot({path:path.join(docsDir, 'new-home-desktop.png'),fullPage:true});
console.log('images',await page.locator('img').evaluateAll(xs=>xs.map(x=>({alt:x.alt,loaded:x.complete&&x.naturalWidth>0}))));
await page.getByRole('button',{name:'以罗小黑启程',exact:true}).click();
await page.getByRole('button',{name:'第1层 遭遇 路线2',exact:true}).click();
await page.getByRole('button',{name:'结束回合',exact:true}).waitFor();
await page.screenshot({path:path.join(docsDir, 'new-battle-desktop.png'),fullPage:true});
const before=await page.locator('.run-toolbar').innerText();
await page.getByRole('status').filter({hasText:'已自动保存'}).waitFor();
await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.locator('.run-toolbar').innerText(),before);
let turns=0;
while(await page.getByRole('button',{name:'结束回合',exact:true}).count()&&turns++<80){
 const cards=page.locator('.hand .spirit-card:not([disabled])');
 if(await cards.count())await cards.first().click();else await page.getByRole('button',{name:'结束回合',exact:true}).click();
}
assert.ok(turns<80);console.log('battle completed',await page.locator('.encounter h1').innerText());
await page.getByRole('button',{name:'会馆日常',exact:true}).click();
await page.getByRole('button',{name:'度过一天',exact:true}).click();
await page.getByRole('button',{name:'度过一天',exact:true}).click();
await page.getByRole('button',{name:'度过一天',exact:true}).click();
await page.getByRole('button',{name:'封灵成卡 · 12 灵质',exact:true}).filter({visible:true}).all().then(async xs=>{for(const x of xs)if(await x.isEnabled()){await x.click();break;}});
await page.getByRole('button',{name:'下一局可用「封灵之契」',exact:true}).waitFor();
await page.screenshot({path:path.join(docsDir, 'new-hall-desktop.png'),fullPage:true});
await page.getByRole('button',{name:'旅途手札',exact:true}).click();
await page.getByRole('textbox',{name:'事件1名称',exact:true}).fill('会馆来信');
await page.getByRole('button',{name:'保存时间线',exact:true}).click();
await page.getByRole('status').filter({hasText:'已自动保存'}).waitFor();
await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.getByRole('textbox',{name:'事件1名称',exact:true}).inputValue(),'会馆来信');
await page.setViewportSize({width:390,height:844});
for(const name of ['门庭','会馆日常','灵卡图鉴','旅途手札','入世历练']){
 await page.getByRole('button',{name,exact:true}).click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: no horizontal overflow`);
 await page.screenshot({path:path.join(docsDir, `mobile-${name}.png`),fullPage:true});
}
assert.deepEqual(errors,[]);console.log('E2E passed: combat, persistence, cultivation, timeline and all five mobile views');
await page.goto('https://zszm.iridescently.xyz/',{waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'以罗小黑启程',exact:true}).waitFor();
await page.screenshot({path:path.join(docsDir, 'live-mobile.png'),fullPage:true});
console.log('Public domain verified');await browser.close();

