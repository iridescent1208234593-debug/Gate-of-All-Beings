import * as THREE from 'three/webgpu';
import { SpiritInstance } from './spirit-instance.js';
import { createSpiritController } from './controller.js';
import { createSpiritPointerInteraction } from './pointer-interaction.js';
import { SpiritRoomClient, interpolateSpiritState } from '../../multiplayer/client.js';
import { DEFAULT_SPIRIT_SETTINGS, normalizeSpiritSettings, validateSpiritSettings, SPIRIT_SETTINGS_API, SPIRIT_WORLD_SCALE, spiritRadius } from './settings.js';
import { refreshSession } from '@lxh/shared-session/session.js';
import { reportResult } from '@lxh/shared-session/progress.js';
import { extractLargestContour } from './body-shape.js';

const BASE = import.meta.env.BASE_URL;
const API_URL = BASE + SPIRIT_SETTINGS_API.replace(/^\//, '');
const ACCOUNT_API = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:8089' : 'https://huiguan.iridescently.xyz';
const CLOUD_PROFILE_URL = `${ACCOUNT_API}/api/game/load?scope=softie`;
import { makeStudio } from '../../studio.js';
import { setSceneAnimation } from '../../scene-animation.js';
import './style.css';

const ranges = [
  ['size', '大小', 0.65, 1.35, 0.01],
  ['stiffness', '软硬', 0, 1, 0.01],
  ['damping', '阻尼', 0, 1, 0.01],
  ['opacity', '透明度', 0.35, 1, 0.01],
  ['acceleration', '移动速度', 6, 28, 0.5],
  ['earSize', '耳部比例', 0.7, 1.3, 0.01],
  ['tailLength', '尾部长度', 0.5, 1.5, 0.01],
  ['eyeSize', '眼睛大小', 0.8, 1.2, 0.01],
];
const shapeKeys = new Set(['earSize', 'tailLength', 'eyeSize']);
export function mountSpiritPlayground(root) {
  const requestedRoom = new URLSearchParams(location.search).get('room') || 'forest';
  const initialRoom = /^[a-zA-Z0-9_-]{1,24}$/.test(requestedRoom) ? requestedRoom : 'forest';
  root.innerHTML = `
    <header class="spirit-header"><div><p class="spirit-eyebrow">罗小黑世界 · 林间灵域</p><h1 class="spirit-page-title">入世寻灵<span>小灵体，开始走动啦</span></h1></div><nav aria-label="试验场导航"><a class="spirit-nav-play" href="${BASE}games/spirit-playground">进入灵界</a><a class="spirit-nav-create" href="${BASE}games/spirit-playground/create">自定义形象</a></nav></header>
    <section class="spirit-debug-gate" hidden><p class="spirit-eyebrow">管理员入口</p><h1>调试页面仅对管理员开放</h1><p>公开互动与灵体创建仍可正常使用。</p><a href="${BASE}games/spirit-playground">返回灵界</a></section>
    <div class="spirit-layout">
      <section class="spirit-arena" aria-label="灵体活动场地">
        <canvas class="spirit-canvas" tabindex="0" aria-label="灵体场地，WASD 或点击移动" aria-describedby="spirit-help"></canvas>
        <div class="spirit-nameplates" aria-hidden="true"></div>
        <p class="spirit-status" role="status">正在感应附近的灵体…</p>
        <div class="spirit-arena-label"><span class="spirit-name">小灵</span><span class="spirit-room-count">林间灵体：连接中</span><span class="spirit-network-metrics">等待灵域状态…</span></div>
        <div class="spirit-arena-tools"><button class="spirit-poke" type="button">戳一下 ✦</button><button class="spirit-reset" type="button">回到场地中央</button></div>
        <p class="spirit-help" id="spirit-help"><span class="spirit-keyboard-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span><span>点击空地前往 · 戳自己的灵体 · 点同伴靠近并贴住</span><span class="spirit-touch-help">单指拖拽、双指拉伸挤压</span></p>
      </section>
      <aside class="spirit-panel" aria-label="灵体参数面板">
        <p class="spirit-eyebrow">SPIRIT PROFILE</p><h2>自定义创造灵体</h2><p class="spirit-panel-intro">调整颜色、触感和形态，保存后带着它进入灵界。</p>
        <section class="spirit-room-control" aria-label="联机房间">
          <label for="spirit-room-code">房间码</label>
          <div class="spirit-room-row"><input id="spirit-room-code" type="text" maxlength="24" autocomplete="off" spellcheck="false" /><button class="spirit-room-join" type="button">加入</button></div>
          <button class="spirit-room-share" type="button">复制邀请链接</button>
          <p class="spirit-room-message" role="status" aria-live="polite">输入相同房间码即可相遇。</p>
        </section>
        <fieldset class="spirit-settings" disabled><legend class="sr-only">灵体参数</legend>
          <p class="spirit-account-row"><span class="spirit-account-status" role="status" aria-live="polite">正在读取账户…</span> <a class="spirit-account-login" href="https://huiguan.iridescently.xyz/" target="_blank" rel="noreferrer">登录 / 注册</a><span class="spirit-perk-hint">登录可同步档案并领取测试挂饰</span><button class="spirit-perk" type="button" hidden>佩戴测试挂饰「灵界小徽记」</button></p>
          <label for="spirit-name-input">灵体昵称</label><input id="spirit-name-input" type="text" maxlength="20" autocomplete="off" />
          <div class="spirit-color-row"><label for="spirit-color">颜色</label><input id="spirit-color" type="color" /></div>
          <label for="spirit-skin">灵体形态</label><select id="spirit-skin"><option value="softie">柔团灵</option><option value="cat">耳尾灵</option><option value="bud">芽灵</option><option value="custom">手绘灵体</option></select>
          <section class="spirit-draw" aria-label="绘制灵体身体" hidden>
            <p class="spirit-draw-title">亲手画一个身体</p>
            <canvas class="spirit-draw-canvas" width="360" height="240" aria-label="绘制身体轮廓或涂抹身体区域"></canvas>
            <div class="spirit-draw-tools"><button type="button" data-draw-mode="outline" aria-pressed="true">画轮廓</button><button type="button" data-draw-mode="brush" aria-pressed="false">实心涂抹</button></div>
            <label class="spirit-draw-size">笔刷大小 <input class="spirit-draw-brush" type="range" min="8" max="54" value="28" /></label>
            <label class="spirit-draw-color-label">笔刷颜色 <input class="spirit-draw-color" type="color" value="#a5e0cd" aria-label="笔刷颜色" /></label>
            <div class="spirit-draw-tools"><button class="spirit-draw-clear" type="button">清空</button><button class="spirit-draw-generate" type="button">生成灵体</button></div>
            <p class="spirit-draw-status" role="status" aria-live="polite">画一个闭合轮廓，或涂出实心区域。</p>
          </section>
          ${ranges.map(([key, label, min, max, step]) => `<div class="spirit-range"><label for="spirit-${key}">${label}<output for="spirit-${key}" data-output="${key}"></output></label><input id="spirit-${key}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" /></div>`).join('')}
          <p class="spirit-field-note">耳尾比例适用于耳尾灵，芽灵也可调眼睛大小。调参即时预览。</p>
          <button class="spirit-save" type="button">保存参数</button><p class="spirit-save-status" role="status" aria-live="polite">正在读取本地参数…</p>
          <div class="spirit-config-actions"><button class="spirit-export" type="button">导出 JSON</button><label class="spirit-import-label" for="spirit-import">导入 JSON<input id="spirit-import" type="file" accept=".json,application/json" /></label><button class="spirit-defaults" type="button">恢复默认参数</button></div>
        </fieldset>
        <p class="spirit-credit">软体物理与柔软形体基于开源项目 <a href="https://github.com/yuanyang749/softie-webgpu" target="_blank" rel="noreferrer">softie-webgpu</a>，感谢原作者 Yuanyang749。</p>
      </aside>
    </div>`;
  const $ = selector => root.querySelector(selector);
  const canvas = $('.spirit-canvas'), arena = $('.spirit-arena'), status = $('.spirit-status');
  const saveStatus = $('.spirit-save-status');
  const accountStatus = $('.spirit-account-status');
  const events = new AbortController();
  const listen = (target, type, fn) => target.addEventListener(type, fn, { signal: events.signal });
  // 账户积分 / 排行榜：页面可见时每满 5 分钟记一次「相处 5 分钟」（服务器每天最多计 120 分钟；访客不上榜）
  let visibleMinutes = 0;
  const companionTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (++visibleMinutes % 5 === 0) void reportResult('softie', { score: 5, finished: false, toast: false });
  }, 60_000);
  events.signal.addEventListener('abort', () => clearInterval(companionTimer));
  const drawCanvas = $('.spirit-draw-canvas'), drawContext = drawCanvas.getContext('2d');
  let drawMode = 'outline', drawing = false, drawPoints = [];
  const defaultBodyShape = { points: Array.from({ length: 40 }, (_, i) => ({
    x: Math.cos(i * Math.PI / 20), y: Math.sin(i * Math.PI / 20),
  })) };
  const drawAt = event => {
    const rect = drawCanvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * drawCanvas.width / rect.width,
      y: (event.clientY - rect.top) * drawCanvas.height / rect.height };
  };
  const drawStyle = () => {
    drawContext.strokeStyle = $('.spirit-draw-color').value; drawContext.fillStyle = $('.spirit-draw-color').value;
    drawContext.lineWidth = Number($('.spirit-draw-brush').value); drawContext.lineCap = drawContext.lineJoin = 'round';
  };
  const renderBodyShape = bodyShape => {
    drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawPoints = bodyShape?.points?.map(point => ({ x: drawCanvas.width / 2 + point.x * 92,
      y: drawCanvas.height / 2 - point.y * 92 })) ?? [];
    if (drawPoints.length < 3) return;
    drawStyle(); drawContext.globalAlpha = 0.18;
    drawContext.beginPath(); drawContext.moveTo(drawPoints[0].x, drawPoints[0].y);
    drawPoints.forEach(point => drawContext.lineTo(point.x, point.y)); drawContext.closePath(); drawContext.fill();
    drawContext.globalAlpha = 1; drawContext.stroke();
  };
  listen(drawCanvas, 'pointerdown', event => {
    drawing = true; drawPoints = [drawAt(event)]; drawCanvas.setPointerCapture(event.pointerId); drawStyle();
    if (drawMode === 'brush') {
      drawContext.beginPath(); drawContext.arc(drawPoints[0].x, drawPoints[0].y, drawContext.lineWidth / 2, 0, Math.PI * 2);
      drawContext.fill(); drawContext.beginPath(); drawContext.moveTo(drawPoints[0].x, drawPoints[0].y);
    }
  });
  listen(drawCanvas, 'pointermove', event => {
    if (!drawing) return;
    const point = drawAt(event); drawPoints.push(point); drawStyle();
    if (drawMode === 'brush') { drawContext.lineTo(point.x, point.y); drawContext.stroke(); }
    else { drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height); drawStyle();
      drawContext.beginPath(); drawContext.moveTo(drawPoints[0].x, drawPoints[0].y);
      drawPoints.forEach(p => drawContext.lineTo(p.x, p.y)); drawContext.stroke(); }
  });
  const stopDrawing = () => { drawing = false; };
  listen(drawCanvas, 'pointerup', stopDrawing); listen(drawCanvas, 'pointercancel', stopDrawing);
  let settings = { ...DEFAULT_SPIRIT_SETTINGS }, savedJSON = '', settingsLoaded = false;
  let account = { logged_in: false };
  let debugAllowed = false, mode = 'play';
  let renderer, observer, spirit, controller, pointer, studio, network;
  const remoteSpirits = new Map();
  const clearRemoteSpirits = () => {
    for (const [id, remote] of remoteSpirits) { remote.instance.dispose(); removeNameplate(id); }
    remoteSpirits.clear();
  };
  const correction = { x: 0, y: 0, z: 0 };
  let profileSyncTimer;
  let lastSnapshot;
  let presentedInitialState = false;
  let ready = false, disposed = false, requestedActive = false, loopActive = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe3dc');
  const camera = new THREE.OrthographicCamera(-9, 9, 7, -7, 0.1, 60);
  camera.position.set(0, 11, 15);
  camera.lookAt(0, 0.5, 0);
  const nameplatePoint = new THREE.Vector3();
  const nameplates = new Map();
  const setNameplate = (id, instance, name) => {
    let plate = nameplates.get(id);
    if (!plate) {
      const element = document.createElement('span');
      element.className = 'spirit-nameplate';
      element.dataset.spiritId = id;
      $('.spirit-nameplates').append(element);
      plate = { element, instance };
      nameplates.set(id, plate);
    }
    plate.instance = instance;
    if (plate.element.textContent !== name) plate.element.textContent = name;
  };
  const removeNameplate = id => {
    nameplates.get(id)?.element.remove(); nameplates.delete(id);
  };
  const positionNameplates = () => {
    const { width, height } = arena.getBoundingClientRect();
    if (!width || !height) return;
    camera.updateMatrixWorld();
    for (const { element, instance } of nameplates.values()) {
      nameplatePoint.set(0, (instance.skin?.metrics?.height ?? 2.4) / (instance.skin?.size ?? 1) + 0.2, 0);
      instance.root.localToWorld(nameplatePoint); nameplatePoint.project(camera);
      const x = (nameplatePoint.x + 1) * width / 2, y = (1 - nameplatePoint.y) * height / 2;
      element.hidden = nameplatePoint.z < -1 || nameplatePoint.z > 1 || x < -70 || x > width + 70 || y < -40 || y > height + 12;
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
    }
  };
  const worldMeshes = [];
  const addWorldMesh = mesh => { scene.add(mesh); worldMeshes.push(mesh); return mesh; };
  const clearingTexture = new THREE.TextureLoader().load(`${BASE}spirit-clearing.jpg`);
  clearingTexture.colorSpace = THREE.SRGBColorSpace;
  const backdropMaterial = new THREE.MeshBasicNodeMaterial({ map: clearingTexture, depthTest: false, depthWrite: false });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMaterial);
  backdrop.renderOrder = -100; addWorldMesh(backdrop);
  let previous = performance.now(), time = 0, frames = 0, fps = 0, windowStart = previous, windowFrames = 0;
  const frameTimes = [];
  const requestSignal = () => AbortSignal.any([events.signal, AbortSignal.timeout(5000)]);
  const fields = () => {
    if (document.activeElement !== $('#spirit-name-input')) $('#spirit-name-input').value = settings.name;
    $('#spirit-color').value = settings.color;
    $('#spirit-skin').value = settings.skin;
    $('.spirit-draw').hidden = settings.skin !== 'custom';
    $('.spirit-perk-hint').hidden = !account.logged_in;
    $('.spirit-perk').hidden = !account.logged_in;
    $('.spirit-perk').textContent = settings.accessory === 'test-badge'
      ? '已佩戴「灵界小徽记」· 点击取下' : '佩戴测试挂饰「灵界小徽记」';
    for (const [key] of ranges) {
      $(`#spirit-${key}`).value = settings[key];
      $(`[data-output="${key}"]`).value = key === 'acceleration' ? settings[key].toFixed(1) : settings[key].toFixed(2);
      if (shapeKeys.has(key)) $(`#spirit-${key}`).disabled = key === 'eyeSize'
        ? !['cat', 'bud'].includes(settings.skin) : settings.skin !== 'cat';
    }
    $('.spirit-name').textContent = $('.spirit-panel h2').textContent = settings.name;
  };
  const apply = () => {
    if (spirit) {
      pointer?.clear(); controller.clear(true);
      spirit.applyAppearance(settings);
      spirit.physics.setConfig(settings);
      const edge = 6.3 - spirit.metrics.radius;
      spirit.physics.setBounds({ x: [-edge, edge], y: [0, 3.4], z: [-edge, edge] });
      for (const axis of ['x', 'z']) spirit.physics.position[axis] = THREE.MathUtils.clamp(spirit.physics.position[axis], -edge, edge);
      controller.setAcceleration(settings.acceleration);
      studio.setColor(settings.color);
      spirit.update(time); studio.update(spirit.physics.position, SPIRIT_WORLD_SCALE * settings.size * spirit.presentationScale);
    }
    fields();
  };
  const setMode = next => {
    const previousMode = mode;
    mode = ['play', 'create', 'debug'].includes(next) ? next : 'play';
    root.dataset.mode = mode;
    const denied = mode === 'debug' && !debugAllowed;
    $('.spirit-debug-gate').hidden = !denied;
    if (denied) requestedActive = false;
    if (mode !== previousMode && ready) {
      if (mode === 'create') {
        pointer?.clear(true); controller?.clear(true);
        spirit.physics.clearDrive(); spirit.physics.endGrab();
        spirit.physics.velocity.x = spirit.physics.velocity.y = spirit.physics.velocity.z = 0;
        network?.close(); network = null; clearRemoteSpirits();
        $('.spirit-room-count').textContent = '形象预览 · 互动已暂停';
      } else if (previousMode === 'create' && !network) {
        network = makeRoomClient(roomId);
      }
    }
    document.title = mode === 'create' ? '自定义创造灵体 · 林间灵域'
      : mode === 'debug' ? '灵体调试 · 林间灵域' : '灵体试验场 · 林间灵域';
  };
  const scheduleProfileSync = () => {
    clearTimeout(profileSyncTimer);
    profileSyncTimer = setTimeout(() => network?.setSettings({ ...settings }), 250);
  };
  const preview = patch => {
    settings = normalizeSpiritSettings({ ...settings, ...patch });
    apply();
    scheduleProfileSync();
    saveStatus.textContent = JSON.stringify(settings) === savedJSON ? '参数已保存到本机。' : '有未保存的调整。';
  };
  const resize = () => {
    const { width, height } = arena.getBoundingClientRect();
    if (!renderer || width <= 0 || height <= 0) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
    const aspect = width / height, halfHeight = Math.max(6.6, 6.6 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    const imageAspect = 1;
    if (aspect > imageAspect) {
      clearingTexture.repeat.set(1, imageAspect / aspect);
      clearingTexture.offset.set(0, (1 - imageAspect / aspect) / 2);
    } else {
      clearingTexture.repeat.set(aspect / imageAspect, 1);
      clearingTexture.offset.set((1 - aspect / imageAspect) / 2, 0);
    }
    backdrop.quaternion.copy(camera.quaternion);
    backdrop.position.copy(camera.position).add(new THREE.Vector3(0, 0, -50).applyQuaternion(camera.quaternion));
    backdrop.scale.set(camera.right - camera.left + 1, camera.top - camera.bottom + 1, 1);
  };
  const frame = now => {
    const elapsed = now - previous; previous = now;
    const dt = Math.min(Math.max(elapsed / 1000, 0), 1 / 15); time += dt;
    spirit.setPresentationScale(mode === 'create' ? 2.5 : 1);
    if (mode === 'play') { controller.update(); spirit.physics.update(dt); }
    const decay = Math.exp(-dt * 9);
    correction.x *= decay; correction.y *= decay; correction.z *= decay;
    spirit.update(time);
    spirit.root.position.x += correction.x; spirit.root.position.y += correction.y; spirit.root.position.z += correction.z;
    presentedInitialState = true;
    studio.update(spirit.physics.position, SPIRIT_WORLD_SCALE * settings.size * spirit.presentationScale);
    const renderAt = now - 120;
    for (const remote of remoteSpirits.values()) {
      const samples = remote.samples;
      if (!samples.length) continue;
      const nextIndex = samples.findIndex(sample => sample.at >= renderAt);
      let previousSample, nextSample, alpha;
      let state;
      if (nextIndex < 0) {
        previousSample = nextSample = samples.at(-1); alpha = 1;
        const extrapolation = Math.min(120, Math.max(0, renderAt - previousSample.at)) / 1000;
        state = structuredClone(previousSample.state);
        state.position.x += state.velocity.x * extrapolation;
        state.position.y += state.velocity.y * extrapolation;
        state.position.z += state.velocity.z * extrapolation;
      }
      else if (nextIndex === 0) { previousSample = nextSample = samples[0]; alpha = 1; }
      else {
        previousSample = samples[nextIndex - 1]; nextSample = samples[nextIndex];
        alpha = (renderAt - previousSample.at) / Math.max(1, nextSample.at - previousSample.at);
      }
      state ??= interpolateSpiritState(previousSample, nextSample, alpha);
      remote.presentedPosition ??= { ...state.position };
      const follow = 1 - Math.exp(-dt * 18);
      for (const axis of ['x', 'y', 'z']) {
        remote.presentedPosition[axis] += (state.position[axis] - remote.presentedPosition[axis]) * follow;
      }
      state.position = { ...remote.presentedPosition };
      remote.instance.physics.restoreState(state);
      remote.instance.update(time);
    }
    positionNameplates();
    renderer.render(scene, camera);
    frames++; windowFrames++; frameTimes.push(elapsed);
    if (frameTimes.length > 300) frameTimes.shift();
    if (now - windowStart >= 1000) { fps = windowFrames * 1000 / (now - windowStart); windowStart = now; windowFrames = 0; }
  };
  const syncActivity = () => {
    const active = ready && !disposed && requestedActive && !(mode === 'debug' && !debugAllowed)
      && !document.hidden && document.body.dataset.softiePage === 'spirit';
    if (active === loopActive) {
      controller?.setActive(active && mode === 'play');
      pointer?.setActive(active && mode === 'play');
      return;
    }
    loopActive = active;
    previous = performance.now(); windowStart = previous; windowFrames = 0;
    controller?.setActive(active && mode === 'play');
    pointer?.setActive(active && mode === 'play');
    if (active) { resize(); setSceneAnimation(renderer, frame); }
    else if (renderer?._animation) setSceneAnimation(renderer, null);
  };
  const fail = message => {
    ready = false; syncActivity(); controller?.setActive(false);
    status.hidden = false; status.textContent = message; status.setAttribute('role', 'alert');
  };
  listen(document, 'visibilitychange', syncActivity);
  listen(document, 'softie-route', syncActivity);
  listen($('#spirit-name-input'), 'input', event => preview({ name: event.target.value }));
  listen($('#spirit-name-input'), 'blur', fields);
  listen($('#spirit-color'), 'input', event => preview({ color: event.target.value }));
  listen($('#spirit-skin'), 'change', event => {
    const skin = event.target.value;
    preview(skin === 'custom' ? { skin, bodyShape: settings.bodyShape ?? defaultBodyShape } : { skin, bodyShape: null });
    if (skin === 'custom') renderBodyShape(settings.bodyShape);
  });
  listen($('.spirit-draw-color'), 'input', () => { if (settings.bodyShape) renderBodyShape(settings.bodyShape); });
  root.querySelectorAll('[data-draw-mode]').forEach(button => listen(button, 'click', () => {
    drawMode = button.dataset.drawMode;
    root.querySelectorAll('[data-draw-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    $('.spirit-draw-status').textContent = drawMode === 'outline' ? '画一个闭合轮廓，再点击生成。' : '涂出身体区域；分开的笔迹只保留最大的一块。';
  }));
  listen($('.spirit-draw-clear'), 'click', () => {
    drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height); drawPoints = [];
    $('.spirit-draw-status').textContent = '画布已清空。';
  });
  listen($('.spirit-draw-generate'), 'click', () => {
    try {
      const raster = document.createElement('canvas'); raster.width = drawCanvas.width; raster.height = drawCanvas.height;
      const context = raster.getContext('2d');
      context.fillStyle = '#fff'; context.lineWidth = Number($('.spirit-draw-brush').value);
      context.lineCap = context.lineJoin = 'round';
      if (drawMode === 'outline') {
        if (drawPoints.length < 3) throw new TypeError('请先画出至少三个点并闭合轮廓。');
        context.beginPath(); context.moveTo(drawPoints[0].x, drawPoints[0].y);
        drawPoints.forEach(point => context.lineTo(point.x, point.y)); context.closePath(); context.fill();
      } else {
        if (drawPoints.length < 1) throw new TypeError('请先涂出一个实心区域。');
        if (drawPoints.length === 1) {
          context.beginPath(); context.arc(drawPoints[0].x, drawPoints[0].y, context.lineWidth / 2, 0, Math.PI * 2); context.fill();
        } else {
          context.beginPath(); context.moveTo(drawPoints[0].x, drawPoints[0].y);
          drawPoints.forEach(point => context.lineTo(point.x, point.y)); context.stroke();
        }
      }
      const bodyShape = extractLargestContour(context.getImageData(0, 0, raster.width, raster.height));
      preview({ skin: 'custom', bodyShape });
      $('.spirit-draw-status').textContent = `已生成灵体身体（${bodyShape.points.length} 个物理轮廓点），可继续揉捏并保存。`;
    } catch (error) { $('.spirit-draw-status').textContent = error.message; }
  });
  listen($('.spirit-perk'), 'click', () => preview({ accessory: settings.accessory === 'test-badge' ? 'none' : 'test-badge' }));
  for (const [key] of ranges) listen($(`#spirit-${key}`), 'input', event => preview({ [key]: Number(event.target.value) }));
  listen($('.spirit-reset'), 'click', () => {
    if (!ready) return;
    controller.clear(true); spirit.reset(); network?.command({ type: 'reset' });
    studio.update(spirit.physics.position, SPIRIT_WORLD_SCALE * settings.size * spirit.presentationScale); canvas.focus({ preventScroll: true });
  });
  listen($('.spirit-poke'), 'click', () => {
    if (!ready) return;
    controller.clear(true); spirit.physics.poke(); spirit.skin.faceMotion?.react('poke'); canvas.focus({ preventScroll: true });
  });
  listen($('.spirit-defaults'), 'click', () => preview(DEFAULT_SPIRIT_SETTINGS));
  listen($('.spirit-save'), 'click', async () => {
    const button = $('.spirit-save'), draft = { ...settings };
    button.disabled = true; saveStatus.textContent = '正在保存…';
    try {
      const response = account.logged_in
        ? await fetch(`${ACCOUNT_API}/api/game/save?scope=softie`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: draft }), signal: requestSignal() })
        : await fetch(API_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft), signal: requestSignal() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      if (disposed) return;
      savedJSON = JSON.stringify(account.logged_in ? draft : normalizeSpiritSettings(data));
      saveStatus.textContent = JSON.stringify(settings) === savedJSON
        ? account.logged_in ? '灵体档案已保存到登录账户。' : '参数已保存到本机，刷新后会恢复。'
        : '刚才的参数已保存，新调整尚未保存。';
    } catch (error) {
      if (!disposed) saveStatus.textContent = `保存失败：${error.message}。可先导出 JSON。`;
    } finally { if (!disposed) button.disabled = false; }
  });
  listen($('.spirit-export'), 'click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'spirit-settings.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    saveStatus.textContent = '已导出当前参数。';
  });
  listen($('#spirit-import'), 'change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 8192) throw new Error('JSON 文件不能超过 8 KB');
      const draft = JSON.parse(await file.text());
      const parsed = validateSpiritSettings(draft);
      // Validation may return the config or simply assert; normalization provides the same canonical object.
      if (disposed) return;
      preview(parsed && typeof parsed === 'object' ? parsed : draft);
      saveStatus.textContent = '已导入并预览，请保存参数。';
    } catch (error) { if (!disposed) saveStatus.textContent = `导入失败：${error.message}`; }
    finally { if (!disposed) event.target.value = ''; }
  });
  fields();
  async function loadSettings() {
    try {
      account = await refreshSession();
      if (disposed) return;
      debugAllowed = Boolean(account.admin);
      accountStatus.textContent = account.logged_in
        ? `已绑定账户：${account.name || account.uid} · 使用云端灵体档案`
        : '游客体验：登录项目账户后可同步灵体档案';
      $('.spirit-account-login').hidden = Boolean(account.logged_in);
      if (account.logged_in) {
        const cloud = await fetch(CLOUD_PROFILE_URL, { credentials: 'include', signal: requestSignal() });
        if (cloud.ok) {
          const data = await cloud.json();
          settings = normalizeSpiritSettings(data.state); savedJSON = JSON.stringify(settings);
          saveStatus.textContent = '已从登录账户读取灵体档案。';
          return finishSettingsLoad();
        }
        settings = normalizeSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, name: account.name || DEFAULT_SPIRIT_SETTINGS.name });
        savedJSON = JSON.stringify(settings);
        saveStatus.textContent = '已使用账户昵称创建默认灵体，可编辑后保存。';
        return finishSettingsLoad();
      }
      const response = await fetch(API_URL, { signal: requestSignal() });
      if (!response.ok) throw new Error('本地参数接口未连接');
      settings = normalizeSpiritSettings(await response.json()); savedJSON = JSON.stringify(settings);
      if (!disposed) saveStatus.textContent = '已读取本机保存的参数。';
    } catch {
      if (!disposed) saveStatus.textContent = account.logged_in
        ? '暂未读取到云端档案，可调整参数后保存到登录账户。'
        : '暂未连接本机保存接口，可先试玩或导出 JSON。';
    }
    finishSettingsLoad();
  }
  function finishSettingsLoad() {
    if (disposed) return;
    settingsLoaded = true; $('.spirit-settings').disabled = false; apply();
    if (settings.skin === 'custom') renderBodyShape(settings.bodyShape);
  }
  const loadingSettings = loadSettings();
  let roomId = initialRoom;
  const updateNavigation = () => {
    const params = new URLSearchParams(location.search); params.set('room', roomId);
    const query = `?${params}`;
    $('.spirit-nav-play').href = `${BASE}games/spirit-playground${query}`;
    $('.spirit-nav-create').href = `${BASE}games/spirit-playground/create${query}`;
    $('.spirit-debug-gate a').href = `${BASE}games/spirit-playground${query}`;
  };
  updateNavigation();
  $('#spirit-room-code').value = roomId;
  const wsUrl = new URL(`${BASE}api/spirit-room/ws`, location.href);
  wsUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const formatRate = bytes => bytes < 1024 ? `${bytes} B/s` : `${(bytes / 1024).toFixed(1)} KiB/s`;
  const receiveSnapshot = snapshot => {
    if (!spirit || !network) return;
    lastSnapshot = snapshot;
    const local = snapshot.entities.find(entity => entity.id === network.selfId);
    if (local) {
      const visible = { ...spirit.root.position };
      spirit.physics.restoreState(local.state);
      for (const input of network.acknowledge(local.ack)) {
        spirit.physics.setDriveAcceleration({ x: input.direction.x * settings.acceleration, z: input.direction.z * settings.acceleration });
      }
      if (!presentedInitialState || snapshot.type === 'joined') {
        correction.x = correction.y = correction.z = 0;
      } else {
        correction.x = visible.x - spirit.physics.position.x;
        correction.y = visible.y - spirit.physics.position.y;
        correction.z = visible.z - spirit.physics.position.z;
      }
      setNameplate('player', spirit, settings.name);
    }
    const remoteIds = new Set(snapshot.entities.filter(entity => entity.id !== network.selfId).map(entity => entity.id));
    for (const entity of snapshot.entities) {
      if (entity.id === network.selfId) continue;
      let remote = remoteSpirits.get(entity.id);
      if (!remote) {
        const instance = new SpiritInstance({ id: `remote-${entity.id}`, appearance: entity.settings, environment: scene.environment });
        scene.add(instance.root);
        remote = { instance, appearance: { ...entity.settings }, samples: [] };
        remoteSpirits.set(entity.id, remote);
        setNameplate(entity.id, instance, entity.settings.name);
      } else if (JSON.stringify(remote.appearance) !== JSON.stringify(entity.settings)) {
        remote.instance.applyAppearance(entity.settings);
        remote.appearance = { ...entity.settings };
        setNameplate(entity.id, remote.instance, entity.settings.name);
      }
      remote.samples.push({ at: performance.now(), state: entity.state });
      if (remote.samples.length > 8) remote.samples.shift();
    }
    for (const [id, remote] of remoteSpirits) {
      if (remoteIds.has(id)) continue;
      remote.instance.dispose(); remoteSpirits.delete(id); removeNameplate(id);
    }
    $('.spirit-room-count').textContent = `林间灵体：${snapshot.entities.length} / 10`;
    const metrics = snapshot.metrics;
    $('.spirit-network-metrics').textContent = metrics
      ? `收 ${formatRate(metrics.receivedBytesPerSec)} · 发 ${formatRate(metrics.sentBytesPerSec)} · 缓冲 ${network.socket?.bufferedAmount ?? 0}/${metrics.bufferedAmount} B · 房间 ${metrics.schedulerHz.toFixed(0)} Hz · 物理 ${metrics.physicsStepHz.toFixed(0)} Hz · tick p95 ${metrics.tickMs.p95.toFixed(2)} ms`
      : '正在统计联机流量…';
  };
  const makeRoomClient = activeRoom => new SpiritRoomClient({ url: wsUrl.href, roomId: activeRoom, settings,
    onStatus: value => {
      $('.spirit-room-count').textContent = value;
      $('.spirit-room-message').textContent = value.startsWith('已加入房间 ')
        ? `已加入房间 ${activeRoom}，复制邀请链接即可找朋友相聚。` : value;
    },
    onSnapshot: receiveSnapshot,
    onDisconnect: () => controller?.clear(true),
  });
  const joinRoom = nextRoom => {
    const requested = nextRoom.trim();
    if (!/^[a-zA-Z0-9_-]{1,24}$/.test(requested)) {
      $('.spirit-room-message').textContent = '房间码需为 1–24 位英文字母、数字、短横线或下划线。';
      return;
    }
    if (!ready || !network) {
      $('.spirit-room-message').textContent = '场地还在准备，请稍等片刻。';
      return;
    }
    if (requested === roomId) {
      $('.spirit-room-message').textContent = `你已在房间 ${roomId}。把邀请链接发给朋友即可相遇。`;
      return;
    }
    pointer?.clear(true); controller?.clear(true); network.close();
    for (const [id, remote] of remoteSpirits) { remote.instance.dispose(); removeNameplate(id); }
    remoteSpirits.clear(); lastSnapshot = null; presentedInitialState = false;
    roomId = requested; updateNavigation(); spirit.reset();
    $('#spirit-room-code').value = roomId;
    const pageUrl = new URL(location.href); pageUrl.searchParams.set('room', roomId);
    history.replaceState(null, '', pageUrl);
    $('.spirit-room-message').textContent = `正在进入房间 ${roomId}…`;
    if (mode !== 'create') network = makeRoomClient(roomId);
  };
  listen($('.spirit-room-join'), 'click', () => joinRoom($('#spirit-room-code').value));
  listen($('#spirit-room-code'), 'keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); joinRoom(event.currentTarget.value); }
  });
  listen($('.spirit-room-share'), 'click', async () => {
    const invite = new URL(location.href); invite.searchParams.set('room', roomId);
    try {
      await navigator.clipboard.writeText(invite.href);
      $('.spirit-room-message').textContent = '邀请链接已复制，发给朋友就能加入这个房间。';
    } catch {
      $('.spirit-room-message').textContent = `复制未获准，请手动复制：${invite.href}`;
    }
  });
  const getDiagnostics = () => ({
    ready, active: loopActive, settingsLoaded, settings: { ...settings }, frames, fps, frameTimes: [...frameTimes],
    animationRunning: renderer?._animation?._requestId != null, rendererFrame: renderer?.info.frame ?? 0,
    backend: renderer?.backend.isWebGPUBackend ? 'native-WebGPU' : 'pending', skin: spirit?.skin.id,
    input: controller?.getDiagnostics(), pointer: pointer?.getDiagnostics(), network: network?.diagnostics(), remoteCount: remoteSpirits.size,
    serverSnapshot: lastSnapshot && { tick: lastSnapshot.tick, physicsTick: lastSnapshot.physicsTick,
      entities: lastSnapshot.entities.map(entity => ({ id: entity.id, position: { ...entity.state.position },
        velocity: { ...entity.state.velocity }, drive: { ...entity.state.drive }, settings: entity.settings,
        radius: spiritRadius(entity.settings), ack: entity.ack })),
      metrics: lastSnapshot.metrics },
    physics: spirit?.physics.diagnostics,
    drawCalls: renderer?.info.render.drawCalls ?? 0, triangles: renderer?.info.render.triangles ?? 0,
  });
  const api = { getDiagnostics, camera, get spirit() { return spirit; }, get renderer() { return renderer; },
    get network() { return network; }, get remoteSpirits() { return remoteSpirits; } };
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) window.__SPIRIT__ = api;
  async function start() {
    await loadingSettings; if (disposed) return;
    setMode(mode);
    if (mode === 'debug' && !debugAllowed) return;
    if (!navigator.gpu) throw new Error('当前浏览器未提供 WebGPU，请使用支持 WebGPU 的桌面浏览器。');
    renderer = new THREE.Renderer(new THREE.WebGPUBackend({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }), { antialias: true, alpha: false, getFallback: null });
    renderer.library = new THREE.StandardNodeLibrary(); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    await renderer.init();
    if (disposed) { renderer.dispose(); return; }
    setSceneAnimation(renderer, null);
    if (!renderer.backend.isWebGPUBackend) throw new Error('灵体试验场需要原生 WebGPU。');
    renderer.backend.device.lost.then(info => { if (!disposed && info.reason !== 'destroyed') fail('图形设备连接中断，请刷新页面重试。'); });
    studio = makeStudio(renderer, scene, { spirit: true });
    spirit = new SpiritInstance({ id: 'player', appearance: settings, environment: scene.environment }); scene.add(spirit.root);
    setNameplate('player', spirit, settings.name);
    canvas.style.cursor = 'default';
    controller = createSpiritController({ canvas, physics: spirit.physics, acceleration: settings.acceleration,
      onMove: direction => network?.move(direction), onStop: () => network?.command({ type: 'stop' }) });
    pointer = createSpiritPointerInteraction({ canvas, camera, spirit,
      getRemoteSpirits: () => remoteSpirits,
      onStart: () => controller.clear(true),
      onCommand: command => network?.command(command),
      onMoveTo: destination => {
        if (destination.spiritId) {
          const remote = remoteSpirits.get(destination.spiritId);
          if (!remote) return;
          controller.setTarget({ position: () => remote.instance.physics.position,
            stopDistance: spirit.metrics.radius + remote.instance.metrics.radius });
        } else {
          const edge = 6.3 - spirit.metrics.radius;
          controller.setTarget({ position: { x: THREE.MathUtils.clamp(destination.position.x, -edge, edge),
            z: THREE.MathUtils.clamp(destination.position.z, -edge, edge) }, stopDistance: 0.14 });
        }
      },
      onPoke: () => { spirit.physics.poke(); spirit.skin.faceMotion?.react('poke'); } });
    apply();
    clearTimeout(profileSyncTimer);
    observer = new ResizeObserver(resize); observer.observe(arena); resize();
    await renderer.compileAsync(scene, camera); if (disposed) return;
    if (mode !== 'create') network = makeRoomClient(roomId);
    else {
      $('.spirit-room-count').textContent = '形象预览 · 互动已暂停';
      $('.spirit-network-metrics').textContent = '预览中 · 尚未加入房间';
    }
    ready = true; status.hidden = true; syncActivity();
  }
  start().catch(error => {
    if (disposed) return;
    console.error('[spirit-playground] WebGPU initialization:', error);
    fail(error.message || '灵体场景初始化失败，请刷新重试。');
  });
  return {
    setActive(value) { requestedActive = Boolean(value); syncActivity(); },
    setMode(next) { setMode(next); syncActivity(); },
    dispose() {
      if (disposed) return;
      disposed = true; requestedActive = false; syncActivity(); events.abort(); observer?.disconnect();
      clearTimeout(profileSyncTimer); pointer?.dispose(); controller?.dispose(); network?.close();
      for (const remote of remoteSpirits.values()) remote.instance.dispose(); remoteSpirits.clear();
      for (const id of nameplates.keys()) removeNameplate(id);
      spirit?.dispose(); studio?.dispose();
      const disposedGeometry = new Set(), disposedMaterial = new Set();
      for (const mesh of worldMeshes) {
        if (!disposedGeometry.has(mesh.geometry)) { disposedGeometry.add(mesh.geometry); mesh.geometry.dispose(); }
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (!disposedMaterial.has(material)) { disposedMaterial.add(material); material.dispose(); }
        }
      }
      clearingTexture.dispose();
      renderer?.dispose(); if (window.__SPIRIT__ === api) delete window.__SPIRIT__; root.replaceChildren();
    },
  };
}
