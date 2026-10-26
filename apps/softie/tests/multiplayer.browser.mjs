import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const room = process.env.TEST_ROOM || 'forest';
const url = `${base}/games/spirit-playground?test=1&room=${encodeURIComponent(room)}`;
const report = { base, room, browsers: [], result: 'running' };
const launch = () => chromium.launch({ channel: 'chrome', headless: true, args: [
  '--enable-unsafe-webgpu', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
] });
let aBrowser, bBrowser, aPage, bPage;

try {
  [aBrowser, bBrowser] = await Promise.all([launch(), launch()]);
  const aContext = await aBrowser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1, hasTouch: true });
  const bContext = await bBrowser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1, hasTouch: true });
  aPage = await aContext.newPage(); bPage = await bContext.newPage();
  for (const [name, page] of [['A', aPage], ['B', bPage]]) {
    page.on('pageerror', error => report[`browser${name}Error`] = error.message);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPIRIT__?.getDiagnostics().frames > 15
      && window.__SPIRIT__?.getDiagnostics().network?.connected, null, { timeout: 60000 });
    const initial = await page.evaluate(() => window.__SPIRIT__.getDiagnostics());
    assert.equal(initial.backend, 'native-WebGPU', `browser ${name} did not initialize WebGPU`);
    report.browsers.push({ name, backend: initial.backend, selfId: initial.network.selfId });
  }
  const diag = page => page.evaluate(() => window.__SPIRIT__.getDiagnostics());
  await Promise.all([aPage, bPage].map(page => page.waitForFunction(() =>
    window.__SPIRIT__.getDiagnostics().remoteCount === 1 && window.__SPIRIT__.getDiagnostics().serverSnapshot?.entities.length === 2,
  null, { timeout: 10000 })));
  const initialA = await diag(aPage), initialB = await diag(bPage);
  assert.notEqual(initialA.network.selfId, initialB.network.selfId);
  assert.equal(initialA.serverSnapshot.entities.length, 2);
  await Promise.all([aPage, bPage].map(page => page.waitForFunction(() =>
    document.querySelectorAll('.spirit-nameplate').length === 2, null, { timeout: 5000 })));
  const visibleNameplates = await aPage.locator('.spirit-nameplate').evaluateAll(elements =>
    elements.map(element => ({ name: element.textContent, visible: !element.hidden,
      positioned: element.style.transform.includes('translate3d(') })));
  assert.ok(visibleNameplates.every(plate => plate.visible && plate.positioned), 'player nameplates were not placed over the arena');
  await aPage.screenshot({ path: 'artifacts/spirit-multiplayer-nameplates.png' });

  await Promise.all([aPage, bPage].map(page => page.evaluate(() => {
    window.__remoteTrack = [];
    const sample = () => {
      const remote = [...window.__SPIRIT__.remoteSpirits.values()][0];
      if (remote) window.__remoteTrack.push({ at: performance.now(), x: remote.instance.root.position.x });
      if (window.__remoteTrack.length < 240) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  })));
  await Promise.all([aPage, bPage].map(page => page.locator('.spirit-canvas').focus()));
  const [idA, idB] = [initialA.network.selfId, initialB.network.selfId];
  const aStart = initialA.serverSnapshot.entities.find(entity => entity.id === idA).position.x;
  const bStart = initialB.serverSnapshot.entities.find(entity => entity.id === idB).position.x;
  await Promise.all([aPage.keyboard.down('KeyA'), bPage.keyboard.down('KeyD')]);
  await Promise.all([
    aPage.waitForFunction(({ id, start }) => {
      const d = window.__SPIRIT__.getDiagnostics();
      return d.serverSnapshot?.entities.find(entity => entity.id === id)?.position.x < start - 0.05;
    }, { id: idA, start: aStart }, { timeout: 5000 }),
    bPage.waitForFunction(({ id, start }) => {
      const d = window.__SPIRIT__.getDiagnostics();
      return d.serverSnapshot?.entities.find(entity => entity.id === id)?.position.x > start + 0.05;
    }, { id: idB, start: bStart }, { timeout: 5000 }),
  ]);
  const duringA = await diag(aPage), duringB = await diag(bPage);
  const aEarly = duringA.serverSnapshot.entities.find(entity => entity.id === idA).position.x;
  const bEarly = duringB.serverSnapshot.entities.find(entity => entity.id === idB).position.x;
  assert.ok(aEarly < aStart - 0.05, `browser A did not move left (${aStart} -> ${aEarly})`);
  assert.ok(bEarly > bStart + 0.05, `browser B did not move right (${bStart} -> ${bEarly})`);
  await aPage.waitForTimeout(1050);
  await Promise.all([aPage.keyboard.up('KeyA'), bPage.keyboard.up('KeyD')]);
  await Promise.all([aPage, bPage].map(page => page.waitForFunction(() => {
    const self = window.__SPIRIT__.network.selfId;
    const entity = window.__SPIRIT__.getDiagnostics().serverSnapshot?.entities.find(value => value.id === self);
    return entity && Math.hypot(entity.position.x, entity.position.z) < 8;
  })));
  const collisionState = await diag(aPage);
  const positions = collisionState.serverSnapshot.entities.map(entity => entity.position);
  const radiusSum = collisionState.serverSnapshot.entities.reduce((sum, entity) => sum + entity.radius, 0);
  const distance = Math.hypot(positions[0].x - positions[1].x, positions[0].z - positions[1].z);
  assert.ok(distance >= radiusSum - 0.04, `server overlap was not resolved (${distance})`);
  assert.ok(collisionState.serverSnapshot.entities.every(entity =>
    Math.abs(entity.position.x) <= 6.3 - entity.radius + 0.03 && Math.abs(entity.position.z) <= 6.3 - entity.radius + 0.03,
  ), 'server let a spirit leave the room');
  await bPage.locator('.spirit-nav-create').click();
  await bPage.waitForFunction(() => document.querySelector('.spirit-playground')?.dataset.mode === 'create');
  await bPage.locator('#spirit-skin').selectOption('cat');
  await bPage.locator('#spirit-tailLength').evaluate(input => {
    input.value = '1.3'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await Promise.all([
    bPage.waitForFunction(() => {
      const d = window.__SPIRIT__.getDiagnostics();
      return d.serverSnapshot?.entities.find(entity => entity.id === d.network.selfId)?.settings.skin === 'cat'
        && d.serverSnapshot.entities.find(entity => entity.id === d.network.selfId)?.settings.tailLength === 1.3;
    }, null, { timeout: 5000 }),
    aPage.waitForFunction(id => {
      const remote = window.__SPIRIT__.remoteSpirits.get(id);
      return remote?.instance.skin.id === 'cat-spirit' && remote.appearance.tailLength === 1.3;
    }, idB, { timeout: 5000 }),
  ]);
  const remoteProfileUpdates = { skinChangedInPlace: true, shapeParameterSynced: true };
  await bPage.locator('#spirit-skin').selectOption('bud');
  await Promise.all([
    bPage.waitForFunction(() => {
      const d = window.__SPIRIT__.getDiagnostics();
      const entity = d.serverSnapshot?.entities.find(value => value.id === d.network.selfId);
      return entity?.settings.skin === 'bud' && Math.abs(entity.radius - 1.25) < 0.001;
    }, null, { timeout: 5000 }),
    aPage.waitForFunction(id => {
      const remote = window.__SPIRIT__.remoteSpirits.get(id);
      return remote?.instance.skin.id === 'bud-spirit' && remote.appearance.skin === 'bud';
    }, idB, { timeout: 5000 }),
  ]);
  remoteProfileUpdates.budSkinAndRadiusSynced = true;
  await bPage.locator('#spirit-name-input').fill('芽芽');
  await aPage.waitForFunction(({ id, name }) =>
    document.querySelector(`.spirit-nameplate[data-spirit-id="${id}"]`)?.textContent === name,
  { id: idB, name: '芽芽' }, { timeout: 5000 });
  remoteProfileUpdates.nameSynced = true;
  await Promise.all([aPage, bPage].map(page => page.evaluate(() => window.__SPIRIT__.network.move({ x: 0, z: 0 }))));
  await Promise.all([aPage, bPage].map(page => page.waitForFunction(() =>
    { const metrics = window.__SPIRIT__.getDiagnostics().serverSnapshot?.metrics;
      return metrics?.tickMs?.p95 > 0 && metrics.receivedBytesPerSec > 0 && metrics.sentBytesPerSec > 0; },
  null, { timeout: 7000 })));
  const [finalA, finalB, traceA] = await Promise.all([
    diag(aPage), diag(bPage), aPage.evaluate(() => window.__remoteTrack),
  ]);
  const metricsA = finalA.serverSnapshot.metrics, metricsB = finalB.serverSnapshot.metrics;
  const grabPoint = await aPage.evaluate(() => {
    const { spirit, camera } = window.__SPIRIT__;
    const point = spirit.root.position.clone(); point.y += 1; point.project(camera);
    const rect = document.querySelector('.spirit-canvas').getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  });
  await aPage.mouse.move(grabPoint.x, grabPoint.y); await aPage.mouse.down();
  await bPage.waitForFunction(id => window.__SPIRIT__.remoteSpirits.get(id)?.instance.physics.captureState().grab.active,
    idA, { timeout: 5000 });
  const remoteGrabStart = await bPage.evaluate(id => window.__SPIRIT__.remoteSpirits.get(id).instance.physics.captureState().grab.target,
    idA);
  await aPage.mouse.move(grabPoint.x + 44, grabPoint.y - 24, { steps: 6 });
  await bPage.waitForFunction(({ id, start }) => {
    const grab = window.__SPIRIT__.remoteSpirits.get(id)?.instance.physics.captureState().grab;
    return grab?.active && Math.hypot(grab.target.x - start.x, grab.target.y - start.y, grab.target.z - start.z) > 0.05;
  }, { id: idA, start: remoteGrabStart }, { timeout: 5000 });
  await aPage.mouse.up();
  await bPage.waitForFunction(id => !window.__SPIRIT__.remoteSpirits.get(id)?.instance.physics.captureState().grab.active,
    idA, { timeout: 5000 });
  const networkedGrab = { remoteSawGrab: true, remoteSawTargetMove: true, remoteSawRelease: true };
  const touchSession = await aContext.newCDPSession(aPage);
  const touchPoint = await aPage.evaluate(() => {
    const { spirit, camera } = window.__SPIRIT__;
    const point = spirit.root.position.clone(); point.y += 1; point.project(camera);
    const rect = document.querySelector('.spirit-canvas').getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  });
  const touches = (type, points) => touchSession.send('Input.dispatchTouchEvent', { type,
    touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 })) });
  await touches('touchStart', [[1, touchPoint.x - 12, touchPoint.y]]);
  await touches('touchStart', [[1, touchPoint.x - 12, touchPoint.y], [2, touchPoint.x + 12, touchPoint.y]]);
  await bPage.waitForFunction(id => window.__SPIRIT__.remoteSpirits.get(id)?.instance.physics.captureState().pinch.active,
    idA, { timeout: 5000 });
  await touches('touchMove', [[1, touchPoint.x - 36, touchPoint.y], [2, touchPoint.x + 36, touchPoint.y]]);
  await bPage.waitForFunction(id => {
    const pinch = window.__SPIRIT__.remoteSpirits.get(id)?.instance.physics.captureState().pinch;
    return pinch?.active && pinch.target > 0.1;
  }, idA, { timeout: 5000 });
  await touches('touchEnd', []);
  await bPage.waitForFunction(id => {
    const physics = window.__SPIRIT__.remoteSpirits.get(id)?.instance.physics;
    return physics && !physics.captureState().pinch.active && !physics.captureState().grab.active;
  }, idA, { timeout: 5000 });
  const networkedPinch = { remoteSawPinch: true, remoteSawStretch: true, remoteSawRelease: true };
  const remoteSteps = traceA.slice(1).map((sample, index) => ({
    gapMs: sample.at - traceA[index].at, step: Math.abs(sample.x - traceA[index].x),
  }));
  const maxRemoteGapMs = Math.max(0, ...remoteSteps.map(sample => sample.gapMs));
  const maxRemoteStep = Math.max(0, ...remoteSteps.filter(sample => sample.gapMs <= 50).map(sample => sample.step));
  assert.ok(traceA.length >= 40, `remote interpolation rendered too few frames (${traceA.length})`);
  const serverTickHz = metricsA.schedulerHz;
  const physicsTickHz = metricsA.physicsStepHz;
  assert.ok(serverTickHz >= 27 && serverTickHz <= 33, `server tick rate was ${serverTickHz.toFixed(1)} Hz`);
  assert.ok(physicsTickHz >= 108 && physicsTickHz <= 132, `physics substep rate was ${physicsTickHz.toFixed(1)} Hz`);
  assert.ok(maxRemoteStep < 0.35, `remote player jumped between snapshots (${maxRemoteStep})`);
  assert.ok(finalA.network.bufferedAmount < 16 * 1024 && finalB.network.bufferedAmount < 16 * 1024, 'client websocket send queue is unexpectedly backed up');
  assert.ok(metricsA.receivedBytesPerSec > 0 && metricsA.sentBytesPerSec > 0, 'server traffic rates were not sampled');

  await aPage.locator('.spirit-nav-create').click();
  await aPage.waitForFunction(() => document.querySelector('.spirit-playground')?.dataset.mode === 'create');
  await aPage.locator('#spirit-name-input').focus();
  await aPage.waitForFunction(() => {
    const diagnostic = window.__SPIRIT__.getDiagnostics();
    const entity = diagnostic.serverSnapshot?.entities.find(value => value.id === diagnostic.network.selfId);
    return diagnostic.input.keys.length === 0 && entity
      && Math.hypot(entity.drive.x, entity.drive.z) < 0.01;
  }, null, { timeout: 2000 });
  await aPage.locator('.spirit-canvas').focus();
  await aPage.keyboard.down('KeyW');
  await aPage.waitForFunction(() => {
    const d = window.__SPIRIT__.getDiagnostics();
    const entity = d.serverSnapshot?.entities.find(value => value.id === d.network.selfId);
    return entity && Math.hypot(entity.drive.x, entity.drive.z) > 1;
  }, null, { timeout: 5000 });
  const movingBeforeRefresh = await diag(aPage);
  assert.ok(Math.hypot(...Object.values(movingBeforeRefresh.serverSnapshot.entities
    .find(entity => entity.id === movingBeforeRefresh.network.selfId).drive)) > 1,
  'refresh case did not reach the server while moving');
  const reload = aPage.reload({ waitUntil: 'domcontentloaded' });
  await bPage.waitForFunction(oldId => !window.__SPIRIT__.remoteSpirits.has(`remote-${oldId}`), idA, { timeout: 5000 });
  await reload;
  await aPage.waitForFunction(() => window.__SPIRIT__?.getDiagnostics().frames > 15
    && window.__SPIRIT__?.getDiagnostics().network?.connected, null, { timeout: 60000 });
  await bPage.waitForFunction(() => window.__SPIRIT__.getDiagnostics().remoteCount === 1, null, { timeout: 10000 });
  const afterRefresh = await diag(aPage);
  const rejoined = afterRefresh.serverSnapshot.entities.find(entity => entity.id === afterRefresh.network.selfId);
  assert.deepEqual(afterRefresh.input.keys, []);
  assert.ok(Math.hypot(rejoined.drive.x, rejoined.drive.z) < 0.01, 'refresh retained a moving input');
  report.result = 'pass';
  report.roomVerification = {
    independentConnections: 2, eachSawOtherPlayer: true, simultaneousMovement: true,
    serverAuthority: true, finalSeparation: Number(distance.toFixed(3)), roomBoundaryRespected: true,
    serverTickHz: Number(serverTickHz.toFixed(1)), physicsSubstepHz: Number(physicsTickHz.toFixed(1)),
    remoteFrames: traceA.length, remoteMaxFrameStepWorldUnits: Number(maxRemoteStep.toFixed(4)),
    remoteMaxObservedRenderGapMs: Number(maxRemoteGapMs.toFixed(1)),
    browserA: { clientSentBytes: finalA.network.sentBytes, clientReceivedBytes: finalA.network.receivedBytes,
      bufferedAmountBytes: finalA.network.bufferedAmount,
      serverReceivedBytesPerSec: metricsA.receivedBytesPerSec, serverSentBytesPerSec: metricsA.sentBytesPerSec,
      serverBufferedAmountBytes: metricsA.bufferedAmount, serverTickMs: metricsA.tickMs },
    browserB: { clientSentBytes: finalB.network.sentBytes, clientReceivedBytes: finalB.network.receivedBytes,
      bufferedAmountBytes: finalB.network.bufferedAmount,
      serverReceivedBytesPerSec: metricsB.receivedBytesPerSec, serverSentBytesPerSec: metricsB.sentBytesPerSec,
      serverBufferedAmountBytes: metricsB.bufferedAmount, serverTickMs: metricsB.tickMs },
    focusClearedDrive: true,
    refreshRemovedOldActorAndRejoinedStopped: true,
    networkedGrab,
    networkedPinch,
    remoteProfileUpdates,
    visibleNameplates,
  };
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.result = 'fail'; report.error = error.message;
  const compact = page => page.evaluate(() => {
    const d = window.__SPIRIT__?.getDiagnostics();
    if (!d) return null;
    return { frames: d.frames, network: d.network, remoteCount: d.remoteCount,
      serverSnapshot: d.serverSnapshot && { tick: d.serverSnapshot.tick, physicsTick: d.serverSnapshot.physicsTick,
        entities: d.serverSnapshot.entities, metrics: d.serverSnapshot.metrics }, input: d.input };
  }).catch(() => null);
  if (aPage && !aPage.isClosed()) report.browserA = await compact(aPage);
  if (bPage && !bPage.isClosed()) report.browserB = await compact(bPage);
  console.log(JSON.stringify(report, null, 2));
  throw error;
} finally {
  await Promise.all([aBrowser?.close(), bBrowser?.close()]);
}
