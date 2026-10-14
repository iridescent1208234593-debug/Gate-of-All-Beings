import { createGame, step, clamp } from './core.js?v=4';

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
const scene = document.createElement('canvas');
scene.width = 576; scene.height = 324;
const pen = scene.getContext('2d', { alpha: false });
let game = createGame(), mode = 'loading', ready = false, accumulator = 0, last = 0;
let previousMode = 'ready', drag = null, stickPointer = null, stickInput = { x: 0, y: 0 };
let audioContext, master, runningSource, soundEnabled = false, volume = 0.35;
let best = 0;
try {
  best = Math.max(0, Number(localStorage.getItem('shengsheng-shoot.best.v1')) || 0);
  volume = clamp(Number(localStorage.getItem('shengsheng-shoot.volume.v1') ?? 0.35), 0, 1);
} catch { /* Storage is optional in private or restricted browsers. */ }
const keys = new Set(), images = {}, buffers = {}, activeSounds = new Set();
const music = new Audio('assets/bgm.mp3');
music.loop = true; music.preload = 'none';
const soundFiles = { shot: 'gun.mp3', hit: 'hit.mp3', over: 'over.mp3', run: 'run.mp3' };
$('best').textContent = best;
$('volume').value = Math.round(volume * 100);
$('volume-value').textContent = `${Math.round(volume * 100)}%`;

function save(key, value) {
  try { localStorage.setItem(`shengsheng-shoot.${key}.v1`, String(value)); } catch { /* Optional persistence. */ }
}
function setSound(enabled) {
  soundEnabled = enabled;
  $('sound').setAttribute('aria-pressed', String(enabled));
  $('sound').setAttribute('aria-label', enabled ? '静音' : '开启声音');
  $('sound').querySelector('img').src = `assets/volume-${enabled ? '2' : 'x'}.svg`;
  if (master) master.gain.value = enabled ? volume : 0;
  music.volume = volume * 0.28;
  if (enabled && mode === 'playing') music.play().catch(() => {});
  else music.pause();
}
async function unlockAudio() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audioContext) {
      audioContext = new Context(); master = audioContext.createGain(); master.connect(audioContext.destination);
      master.gain.value = soundEnabled ? volume : 0;
      for (const [name, file] of Object.entries(soundFiles)) {
        fetch(`assets/${file}`).then(r => { if (!r.ok) throw Error(file); return r.arrayBuffer(); })
          .then(data => audioContext.decodeAudioData(data)).then(buffer => { buffers[name] = buffer; })
          .catch(() => { $('status').textContent = '音效暂不可用，游戏可继续'; });
      }
    }
    await audioContext.resume();
  } catch { $('status').textContent = '声音暂不可用，游戏可继续'; }
}
function playSound(name, loop = false) {
  if (!soundEnabled || !buffers[name] || audioContext?.state !== 'running') return null;
  const source = audioContext.createBufferSource(), gain = audioContext.createGain();
  source.buffer = buffers[name]; source.loop = loop;
  gain.gain.value = ({ shot: 0.28, hit: 0.55, over: 0.8, run: 0.15 })[name];
  source.connect(gain); gain.connect(master); source.start();
  activeSounds.add(source);
  source.onended = () => { activeSounds.delete(source); source.disconnect(); gain.disconnect(); };
  return source;
}
function stopRunning() { if (runningSource) { runningSource.stop(); runningSource = null; } }
function stopAudio() {
  music.pause(); stopRunning();
  for (const source of activeSounds) { try { source.stop(); } catch { /* Already stopped. */ } }
}
function resetInput() {
  keys.clear(); drag = null; stickPointer = null; stickInput = { x: 0, y: 0 };
  $('stick').style.transform = ''; stopRunning();
}
function showDialog(title, description, primary, action, { help = false, secondary = false, art = '', artAlt = '' } = {}) {
  $('overlay').hidden = false;
  $('dialog-title').textContent = title;
  $('dialog-description').textContent = description;
  const image = $('settlement-art');
  image.hidden = !art;
  if (art) { image.src = art; image.alt = artAlt; }
  $('instructions').hidden = !help;
  $('primary').textContent = primary;
  $('primary').onclick = action;
  $('primary').disabled = !ready;
  $('secondary').hidden = !secondary;
  $('volume-setting').hidden = false;
  $('primary').focus({ preventScroll: true });
}
function start() {
  if (!ready) return;
  stopAudio(); resetInput(); game = createGame(); music.currentTime = 0;
  resume();
}
function resume() {
  if (!ready || document.hidden) return;
  mode = 'playing'; accumulator = 0; last = performance.now();
  $('overlay').hidden = true; $('pause').disabled = false; $('restart').disabled = false;
  $('pause').setAttribute('aria-label', '暂停');
  $('pause').querySelector('img').src = 'assets/pause.svg';
  $('status').textContent = '站定开火 · 移动躲避';
  resetInput(); unlockAudio(); setSound(soundEnabled);
}
function pause(reason = '休息一下，海滩还在。') {
  if (mode !== 'playing') return;
  mode = 'paused'; accumulator = 0; resetInput(); stopAudio();
  $('pause').setAttribute('aria-label', '继续');
  $('pause').querySelector('img').src = 'assets/play.svg';
  $('status').textContent = '已暂停';
  showDialog('已暂停', reason, '继续游戏', resume);
}
function togglePause() { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
function finish() {
  mode = 'over'; resetInput(); stopAudio(); playSound('over');
  if (game.score > best) { best = game.score; save('best', best); }
  $('best').textContent = best; $('pause').disabled = true;
  $('status').textContent = '本局结束 · 投降';
  showDialog('本局结束', `得分 ${game.score} · 最佳 ${best}`, '再来一局', start,
    { art: 'assets/defeat.jpg', artAlt: '省省举起白旗投降' });
}
function victory() {
  mode = 'won'; resetInput(); stopAudio();
  if (game.score > best) { best = game.score; save('best', best); }
  $('best').textContent = best; $('pause').disabled = true;
  $('status').textContent = '达到 1000 分 · 胜利';
  showDialog('耶！1000 分！', `得分 ${game.score} · 最佳 ${best}`, '继续游戏', resume,
    { art: 'assets/victory.jpg', artAlt: '省省开心庆祝胜利' });
}
function input() {
  let x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  let y = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  if (x || y) return { x, y };
  if (stickPointer !== null) return stickInput;
  if (drag) {
    x = drag.targetX - game.player.x; y = drag.targetY - game.player.y;
    const length = Math.hypot(x, y);
    if (length > 0.8) return { x: x / length * Math.min(1, length / (100 / 60)), y: y / length * Math.min(1, length / (100 / 60)) };
  }
  return { x: 0, y: 0 };
}
function sprite(name, frame, row, size, x, y, flip = false) {
  if (!images[name]) return;
  pen.save(); pen.translate(Math.round(x), Math.round(y)); if (flip) pen.scale(-1, 1);
  pen.drawImage(images[name], frame * size, row * size, size, size, -size / 2, -size / 2, size, size);
  pen.restore();
}
function draw() {
  pen.imageSmoothingEnabled = false;
  pen.fillStyle = '#c5ede2'; pen.fillRect(0, 0, 576, 324);
  if (images.beach) {
    pen.save(); pen.translate(288, 162); pen.scale(1.25, 1.25);
    pen.drawImage(images.beach, 10 - 288, -29 - 162);
    if (images.bullet) for (const bullet of game.bullets) pen.drawImage(images.bullet, Math.round(bullet.x - 4), Math.round(bullet.y - 5));
    const entities = [...game.enemies.map(e => ({ ...e, enemy: true })), game.player].sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      if (entity.enemy) {
        if (entity.dead) sprite('burst', Math.min(7, Math.floor(entity.deathAge * 12)), 0, 48, entity.x - 2, entity.y - 7, true);
        else sprite('enemy', Math.floor(entity.age * 12) % 6, 0, 64, entity.x - 2, entity.y - 7, true);
      } else {
        if (game.over) pen.globalAlpha = 0.45;
        sprite('player', Math.floor(game.time * 8) % 4, entity.moving ? 1 : 0, 64, entity.x, entity.y - 3);
        pen.globalAlpha = 1;
      }
    }
    pen.restore();
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene, 0, 0, canvas.width, canvas.height);
  $('score').textContent = game.score;
}
function resize() {
  const bounds = canvas.getBoundingClientRect();
  // Integer backing scale preserves the pixel grid and caps high-DPR memory use.
  const scale = clamp(Math.ceil(bounds.width * Math.min(devicePixelRatio || 1, 3) / 576), 1, 4);
  canvas.width = 576 * scale; canvas.height = 324 * scale; draw();
}
function frame(now) {
  if (mode === 'playing') {
    accumulator += Math.min((now - last) / 1000, 0.1);
    while (accumulator >= 1 / 60 && mode === 'playing') {
      step(game, 1 / 60, input()); accumulator -= 1 / 60;
      for (const event of game.events) {
        if (event === 'over') finish();
        else if (event === 'win') victory();
        else playSound(event);
      }
    }
    if (game.player.moving && !runningSource) runningSource = playSound('run', true);
    else if (!game.player.moving) stopRunning();
  }
  last = now; draw(); requestAnimationFrame(frame);
}

$('pause').onclick = togglePause; $('touch-pause').onclick = togglePause;
$('restart').onclick = () => {
  if (!ready) return;
  previousMode = mode; if (mode === 'playing') pause();
  mode = 'confirm';
  showDialog('重新开始？', `本局得分 ${game.score}`, '重新开始', start, { secondary: true });
  $('secondary').onclick = () => returnToPrevious();
};
function returnToPrevious() {
  const prior = previousMode;
  if (prior === 'playing' || prior === 'paused') { mode = 'playing'; pause(); }
  else if (prior === 'over') finish(); else if (prior === 'won') victory(); else readyDialog();
}
$('help').onclick = () => {
  if (!ready) return;
  if (mode === 'help' || mode === 'confirm') return;
  previousMode = mode; if (mode === 'playing') pause(); mode = 'help';
  showDialog('站定开火，移动躲避。', '只有一条命，看看你能守住多久。', '返回游戏', returnToPrevious, { help: true });
};
$('sound').onclick = () => { unlockAudio(); setSound(!soundEnabled); if (!soundEnabled) stopRunning(); };
$('volume').oninput = event => {
  volume = Number(event.target.value) / 100;
  $('volume-value').textContent = `${Math.round(volume * 100)}%`; save('volume', volume); setSound(soundEnabled);
};
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('app').requestFullscreen) await $('app').requestFullscreen();
    else $('status').textContent = '此浏览器不支持页面全屏，可横屏游玩';
  } catch { $('status').textContent = '全屏暂不可用，可继续游玩'; }
};
const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (movementKeys.includes(event.code)) {
    if (mode === 'playing') { event.preventDefault(); keys.add(event.code); }
  } else if (!event.repeat) {
    if (event.code === 'Escape' || event.code === 'KeyP') togglePause();
    if (event.code === 'KeyR' && mode === 'playing') $('restart').click();
    if (event.code === 'KeyM') $('sound').click();
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { pause('窗口已离开，点击继续。'); resetInput(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause('已切换到后台，点击继续。'); stopAudio(); resetInput(); } });
window.addEventListener('pagehide', () => { pause(); stopAudio(); resetInput(); });
document.addEventListener('fullscreenchange', resize);
new ResizeObserver(resize).observe($('stage'));

function worldPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: ((event.clientX - bounds.left) / bounds.width * 576 - 288) / 1.25,
    y: ((event.clientY - bounds.top) / bounds.height * 324 - 162) / 1.25 };
}
canvas.addEventListener('pointerdown', event => {
  if (mode !== 'playing' || drag || event.button > 0) return;
  event.preventDefault(); const point = worldPoint(event);
  canvas.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, originX: point.x, originY: point.y,
    playerX: game.player.x, playerY: game.player.y, targetX: game.player.x, targetY: game.player.y };
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  const point = worldPoint(event);
  drag.targetX = clamp(drag.playerX + point.x - drag.originX, -229.92893, 229.92893);
  drag.targetY = clamp(drag.playerY + point.y - drag.originY, 39.07107, 118.92893);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => { if (drag?.id === event.pointerId) drag = null; });
const joystick = $('joystick');
function moveStick(event) {
  const bounds = joystick.getBoundingClientRect();
  const dx = event.clientX - bounds.left - bounds.width / 2, dy = event.clientY - bounds.top - bounds.height / 2;
  const radius = bounds.width * 0.3, length = Math.hypot(dx, dy), scale = Math.min(1, radius / (length || 1));
  $('stick').style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
  stickInput = length < radius * 0.2 ? { x: 0, y: 0 } : { x: dx * scale / radius, y: dy * scale / radius };
}
joystick.addEventListener('pointerdown', event => {
  if (mode !== 'playing' || stickPointer !== null) return;
  event.preventDefault(); stickPointer = event.pointerId; drag = null;
  joystick.setPointerCapture(event.pointerId); moveStick(event);
});
joystick.addEventListener('pointermove', event => { if (stickPointer === event.pointerId) moveStick(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, event => {
  if (stickPointer !== event.pointerId) return;
  stickPointer = null; stickInput = { x: 0, y: 0 }; $('stick').style.transform = '';
});
document.querySelector('.dialog').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...document.querySelectorAll('.dialog button:not([hidden]):not(:disabled), .dialog input')];
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
});
function readyDialog() {
  mode = 'ready';
  showDialog('站定开火，移动躲避。', '停止移动时自动发射三路子弹；碰到敌人即结束。', '开始游戏', start);
}
async function preload() {
  const sources = { beach: 'beach.webp', player: 'player.webp', enemy: 'enemy.webp', bullet: 'bullet.webp', burst: 'burst.webp',
    victory: 'victory.jpg', defeat: 'defeat.jpg' };
  let loaded = 0;
  try {
    await Promise.all(Object.entries(sources).map(async ([name, file]) => {
      const image = new Image(); image.src = `assets/${file}`;
      await Promise.race([image.decode(), new Promise((_, reject) => setTimeout(() => reject(Error('timeout')), 15000))]);
      images[name] = image; loaded++;
      $('load-progress').value = loaded / Object.keys(sources).length;
      $('load-status').textContent = `正在准备海滩… ${loaded}/${Object.keys(sources).length}`; draw();
    }));
    ready = true; $('load-progress').hidden = true; $('load-status').hidden = true;
    $('restart').disabled = false; readyDialog();
  } catch {
    $('dialog-title').textContent = '海滩还没准备好';
    $('load-status').textContent = '部分素材加载失败，请检查网络后重试。';
    $('load-progress').hidden = true; $('primary').disabled = false; $('primary').textContent = '重新加载';
    $('primary').onclick = () => location.reload();
  }
}
// A read-only snapshot supports browser acceptance checks without changing gameplay.
window.shengshengShoot = Object.freeze({ snapshot: () => ({ mode, time: game.time, score: game.score, best, victory: game.victory,
  player: { ...game.player }, bullets: game.bullets.length, enemies: game.enemies.length, over: game.over,
  soundEnabled, volume, canvas: [canvas.width, canvas.height] }) });
resize(); requestAnimationFrame(frame); preload();
