import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createDemoServer } from '../dev.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MINI_GAMES_PLAYWRIGHT_MODULE||'playwright');
const server=createDemoServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage();
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.goto(origin+'/?game=runner');
  await page.waitForFunction(()=>!document.getElementById('start').disabled);
  assert.match(await page.locator('aside').first().innerText(),/本地试玩.*测试 OC/);
  assert.equal(await page.locator('#oc-list button').count(),2);
  assert.equal(await page.locator('#manage-ocs').getAttribute('href'),null);
  await page.getByRole('button',{name:/测试 OC · 小川/}).click();
  await page.waitForFunction(()=>!document.getElementById('start').disabled);
  await page.getByRole('button',{name:'默认地图',exact:true}).click();
  await page.locator('#start').click();await page.locator('#play:not([hidden])').waitFor();
  assert.match(await page.locator('#playing-as').innerText(),/测试 OC · 小川/);
  await page.keyboard.press('Space');await page.locator('#pause').click();
  assert.equal(await page.locator('#overlay-title').innerText(),'休息一下');
  await page.goto(origin+'/?game=crossing');await page.waitForFunction(()=>!document.getElementById('start').disabled);
  await page.locator('#start').click();await page.locator('#play:not([hidden])').waitFor();
  await page.getByRole('button',{name:'向上',exact:true}).click();
  await page.goto(pathToFileURL(fileURLToPath(new URL('../index.html',import.meta.url))).href);
  await page.waitForFunction(()=>document.getElementById('oc-status').textContent.includes('直接打开的本地文件'));
  assert.match(await page.locator('pre').innerText(),/node apps\/mini-games\/dev.mjs/);
  console.log('Manual preview: both games playable with labelled test OCs; file:// explains how to start.');
}finally{
  if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
