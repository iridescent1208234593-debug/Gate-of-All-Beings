const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { chromium, devices } = require('playwright');
const { build } = require('../node_modules/esbuild');

// The real viewport and hook, mounted without accounts, APIs or production data.
(async () => {
  const result = await build({ stdin: { contents: `
    import React, {StrictMode, useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {mountOrientationViewport} from './src/gate/OrientationViewport';
    import {OrientationGuard, useOrientationGuard} from './src/gate/OrientationGuard';
    function App() {
      const [phase, setPhase] = useState('opening');
      const orientation = useOrientationGuard(phase);
      return <><OrientationGuard {...orientation}/><main inert={orientation.blocked}>
        <button id="enter" onClick={() => setPhase('game')}>进入</button>
        <input aria-label="名字"/><div style={{position:'fixed',right:0,bottom:0}}>边缘</div>
        <a href="/account">账户</a></main></>;
    }
    function mount() {
      const viewport = mountOrientationViewport();
      if (viewport) return viewport;
      const root = createRoot(document.getElementById('root'));
      root.render(<StrictMode><App/></StrictMode>);
      return () => root.unmount();
    }
    window.dispose = mount(); window.mount = mount;
  `, resolveDir: path.resolve(__dirname, '..'), loader: 'tsx' }, bundle: true, write: false,
    outdir: 'out', loader: { '.css': 'empty' }, jsx: 'automatic' });
  const script = result.outputFiles[0].text;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/bundle.js' ? 'application/javascript' : 'text/html; charset=utf-8');
    res.end(req.url === '/bundle.js' ? script : '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/bundle.js"></script>');
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({headless: true});
    for (const device of ['Pixel 7', 'iPhone 13', 'iPad Mini', null]) {
      const context = await browser.newContext(device ? devices[device] : { viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      const phone = device === 'Pixel 7' || device === 'iPhone 13';
      assert.equal(await page.locator('iframe').count(), phone ? 1 : 0, String(device));
      if (phone) {
        const frame = page.frames()[1];
        await frame.waitForFunction(() => !!window.dispose);
        await frame.evaluate(() => { window.installCalls = 0; window.addEventListener('beforeinstallprompt', e => { window.offer = e; }); });
        await page.evaluate(() => {
          const event = new Event('beforeinstallprompt', {cancelable:true});
          event.prompt = async () => { window.installCalls = (window.installCalls || 0) + 1; };
          event.userChoice = Promise.resolve({outcome:'accepted'});
          dispatchEvent(event);
        });
        await frame.evaluate(() => window.offer.prompt());
        assert.equal(await page.evaluate(() => window.installCalls), 1, 'real installation offer bridged');
        assert.equal(await frame.locator('.orient-guard').count(), 1);
        assert.equal(await frame.evaluate(() => innerHeight > innerWidth), true);
        await page.waitForTimeout(3000);
        assert.equal(await frame.locator('.orient-guard').count(), 1, 'no early switch');
        await frame.waitForFunction(() => innerWidth > innerHeight);
        assert.equal(await frame.locator('.orient-guard').count(), 0, 'no gesture required');
        assert.equal(await frame.evaluate(() => matchMedia('(orientation:landscape)').matches), true);
        const rect = await page.locator('iframe').boundingBox(); const vp = page.viewportSize();
        assert.ok(Math.abs(rect.x) < 1 && Math.abs(rect.y) < 1);
        assert.ok(Math.abs(rect.width - vp.width) < 1 && Math.abs(rect.height - vp.height) < 1);
        await frame.locator('#enter').click();
        await frame.getByLabel('名字').fill('测试');
        await frame.getByRole('button', {name:'切换竖屏'}).click();
        await frame.waitForFunction(() => innerHeight > innerWidth);
        await frame.getByRole('button', {name:'切换横屏'}).click();
        await frame.waitForFunction(() => innerWidth > innerHeight);
        assert.equal(await frame.getByLabel('名字').inputValue(), '测试', 'state survives rotation');
        await page.setViewportSize({width:844,height:390});
        await frame.waitForFunction(() => innerWidth === 844 && innerHeight === 390);
        await page.setViewportSize(vp);
        await frame.waitForFunction(() => innerWidth > innerHeight);
        await frame.getByRole('link', {name:'账户'}).click();
        await page.waitForURL(url + '/account');
        await page.evaluate(() => window.dispose());
        assert.equal(await page.locator('iframe').count(), 0, 'dispose removes viewport');
        await page.evaluate(() => { window.dispose = window.mount(); });
        assert.equal(await page.locator('iframe').count(), 1, 'remount creates only one viewport');
      }
      assert.deepEqual(errors, []);
      await context.close(); console.log((device || 'Desktop') + ' PASS');
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
