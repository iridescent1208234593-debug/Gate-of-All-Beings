import { chromium } from '../../management/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}});
for (const [name,url] of [['gate','https://zszm.iridescently.xyz/'],['legacy-cards','https://game.iridescently.xyz/'],['management-in-gate','https://zszm.iridescently.xyz/#management']]) {
 await page.goto(url,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1800);
 console.log(name, (await page.locator('body').innerText()).slice(0,4000));
 await page.screenshot({path:path.join(docsDir, `${name}.png`),fullPage:false});
}
await browser.close();

