/** 图一 · 按原版节点图与视频顺序重建的种族树。 */
import { RACES, TREE_CANVAS } from './races.js';
const NS = 'http://www.w3.org/2000/svg';
const ICONS = import.meta.glob('./media/race-icons/*.png', { eager: true, import: 'default', query: '?url' });
const INTRO_DURATION = 4300;
const WIRE_SPEED = 0.34;
const ROOT_START = 500;
const ROOT_APPEAR = 250;
const NODE_ARRIVE = 430;

// race-tree-03.png 的原始坐标。和现有图标对齐时只做等比变换。
const ROOTS = [
  [383.5, '#d1dbd6', 0], [467.5, '#a1b89e', 18], [515.5, '#d1dbd6', 110],
  [575.5, '#a1b89e', 32], [599.5, '#f3a82b', 12], [623.5, '#faebb1', 44],
];

// 每段从根节点或已长成的分叉处起笔；被图块覆盖的段落仍沿同一条路径前进。
// [id, 色号（主干也对应根节点）, 前一段 id, SVG path]
const BRANCHES = [
  ['base', 0, null, 'M383.5 640.5V622'],
  ['human', 0, 'base', 'M383.5 622V274.5Q383.5 262.5 371.5 262.5H365'],
  ['butterfly', 0, 'base', 'M383.5 622H143.5Q131.5 622 131.5 610V556'],
  ['mammals', 0, 'human', 'M365 190.5H419.5V82'],
  ['mammal-row', 1, 'mammals', 'M419.5 82H131.5V137'],
  ['koala-dash-a', 0, 'mammal-row', 'M173 178.5H189'],
  ['koala-dash-b', 0, 'koala-dash-a', 'M204 178.5H215'],
  ['bird', 0, 'human', 'M234.5 262.5H131.5V304.5'],
  ['fish', 1, 'bird', 'M131.5 304.5V330'],
  ['reptile-fork', 1, 'bird', 'M131.5 304.5H227.5'],
  ['lizard', 1, 'reptile-fork', 'M227.5 304.5V330'],
  ['frog', 1, 'reptile-fork', 'M227.5 304.5H311.5Q323.5 304.5 323.5 316.5V330'],
  ['star-fork', 1, 'butterfly', 'M221 466.5H263.5'],
  ['star', 1, 'star-fork', 'M263.5 466.5H283'],
  ['snail', 1, 'star-fork', 'M263.5 466.5V538.5Q263.5 550.5 275.5 550.5H283'],
  ['snail-dash-a', 1, 'snail', 'M282 574.5H263'],
  ['snail-dash-b', 1, 'snail-dash-a', 'M252 574.5H240'],
  ['mushroom', 1, null, 'M467.5 640.5V574.5Q467.5 562.5 455.5 562.5H419.5Q407.5 562.5 407.5 550.5V334.5Q407.5 322.5 419.5 322.5H475'],
  ['leaf', 2, null, 'M515.5 640.5V507'],
  ['fungus', 3, null, 'M575.5 640.5V238.5Q575.5 226.5 563.5 226.5H557'],
  ['phoenix', 4, null, 'M599.5 640.5V238.5Q599.5 226.5 611.5 226.5H619'],
  ['horse', 4, 'phoenix', 'M797 226.5H804Q816 226.5 816 214.5V94Q816 82 804 82H797'],
  ['owl', 5, 'horse', 'M715 82H701'],
  ['dragon', 5, null, 'M623.5 640.5V574.5Q623.5 562.5 635.5 562.5H683.5Q695.5 562.5 695.5 550.5V507'],
  ['sun', 4, 'dragon', 'M797 418.5H804Q816 418.5 816 430.5V550.5Q816 562.5 804 562.5H797'],
];

export function createRaceTree({ root, onSelect, onBack, initialSelected = null }) {
  const events = new AbortController();
  const listen = (target, type, listener) => target.addEventListener(type, listener, { signal: events.signal });
  const canvas = root.querySelector('#race-tree-canvas');
  const backBtn = root.querySelector('[data-back]');
  if (!canvas || !backBtn) throw new Error('种族树界面缺少必要的 DOM 结构');

  canvas.innerHTML = '';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'race-tree-links');
  svg.setAttribute('viewBox', `0 0 ${TREE_CANVAS.w} ${TREE_CANVAS.h}`);
  svg.setAttribute('aria-hidden', 'true');

  const wires = document.createElementNS(NS, 'g');
  wires.setAttribute('transform', 'translate(11.5 9) scale(1.19)');
  svg.appendChild(wires);
  canvas.appendChild(svg);

  const segments = new Map();
  for (const [id, rootIndex, parentId, d] of BRANCHES) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'race-tree-wire');
    path.setAttribute('d', d);
    path.setAttribute('stroke', ROOTS[rootIndex][1]);
    path.dataset.branch = id;
    wires.appendChild(path);
    const length = path.getTotalLength();
    // 单条时间轴驱动路径长度；分支只在父路径到达后开始。
    const duration = Math.max(24, length / WIRE_SPEED);
    const parent = segments.get(parentId);
    const start = parent ? parent.end : ROOT_START + ROOTS[rootIndex][2] * 1.3;
    path.style.strokeDasharray = `${length} ${length + 20}`;
    path.style.strokeDashoffset = String(length + 10);
    segments.set(id, { path, length, duration, start, end: start + duration });
  }

  const roots = ROOTS.map(([cx, fill]) => {
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', 'race-tree-root');
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', '640.5');
    dot.setAttribute('r', '9');
    dot.setAttribute('fill', fill);
    dot.style.opacity = '0';
    wires.appendChild(dot);
    return dot;
  });

  const nodes = new Map();
  const nodeTimings = new Map();
  for (const race of RACES) {
    const t = race.tree;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'race-node';
    btn.dataset.race = race.id;
    btn.style.left = `${t.x}em`;
    btn.style.top = `${t.y}em`;
    btn.style.width = `${t.w}em`;
    btn.style.height = `${t.h}em`;
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';
    btn.disabled = true;
    btn.setAttribute('aria-label', race.name);

    const icon = document.createElement('img');
    icon.className = 'race-icon';
    icon.alt = '';
    icon.draggable = false;
    icon.src = ICONS[`./media/race-icons/${race.id}.png`];
    const tint = document.createElement('span');
    tint.className = 'race-node-tint';
    tint.setAttribute('aria-hidden', 'true');
    btn.append(icon, tint);
    listen(btn, 'click', () => {
      setSelected(race.id);
      if (typeof onSelect === 'function') onSelect(race.id);
    });
    canvas.appendChild(btn);
    nodes.set(race.id, btn);

    let nearest = { distance: Infinity, at: ROOT_START };
    for (const segment of segments.values()) {
      if (segment.length < 35) continue;
      const steps = Math.max(12, Math.ceil(segment.length / 22));
      for (let step = 0; step <= steps; step++) {
        const fraction = step / steps;
        const point = segment.path.getPointAtLength(segment.length * fraction);
        const x = point.x * 1.19 + 11.5;
        const y = point.y * 1.19 + 9;
        const distance = Math.hypot(x - (t.x + t.w / 2), y - (t.y + t.h / 2));
        if (distance < nearest.distance) {
          nearest = { distance, at: segment.start + fraction * segment.duration };
        }
      }
    }
    nodeTimings.set(race.id, Math.max(ROOT_START + ROOT_APPEAR, nearest.at - NODE_ARRIVE - 130));
  }

  let selectedId = initialSelected;
  let progress = 0;
  let raf = 0;
  let playbackStartedAt = 0;
  let scrubbing = false;
  let resumeAfterVisibility = false;
  const progressRoot = root.querySelector('#race-tree-progress');
  const progressRange = root.querySelector('#race-tree-progress-range');
  const progressFill = root.querySelector('#race-tree-progress-fill');
  const timeLabel = root.querySelector('#race-tree-time');
  if (!progressRoot || !progressRange || !progressFill || !timeLabel) {
    throw new Error('种族树界面缺少动画进度控件');
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    return `00:${String(seconds).padStart(2, '0')}`;
  }

  function renderTimeline(ms) {
    const time = Math.max(0, Math.min(INTRO_DURATION, ms));
    progress = time / INTRO_DURATION;
    root.dataset.animationProgress = progress.toFixed(4);
    progressRange.value = String(Math.round(time));
    progressRange.setAttribute('aria-valuetext', `${formatTime(time)} / ${formatTime(INTRO_DURATION)}`);
    progressFill.style.width = `${progress * 100}%`;
    timeLabel.textContent = `${formatTime(time)} / ${formatTime(INTRO_DURATION)}`;

    roots.forEach((dot, index) => {
      const start = 150 + index * 26;
      const amount = Math.max(0, Math.min(1, (time - start) / ROOT_APPEAR));
      dot.style.opacity = String(amount);
      dot.setAttribute('r', String(9 * (0.3 + 0.7 * amount)));
    });
    for (const segment of segments.values()) {
      const amount = Math.max(0, Math.min(1, (time - segment.start) / segment.duration));
      segment.path.style.strokeDashoffset = String((segment.length + 10) * (1 - amount));
    }
    for (const [id, node] of nodes) {
      const amount = Math.max(0, Math.min(1, (time - nodeTimings.get(id)) / NODE_ARRIVE));
      const eased = 1 - Math.pow(1 - amount, 3);
      node.style.opacity = String(eased);
      node.style.setProperty('--arrival-scale', String(0.72 + 0.28 * eased));
      node.style.pointerEvents = amount >= 1 ? 'auto' : 'none';
      node.disabled = amount < 1;
    }

  }

  function stopPlayback() {
    window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function tick(now) {
    raf = 0;
    const time = Math.min(INTRO_DURATION, now - playbackStartedAt);
    renderTimeline(time);
    if (time < INTRO_DURATION && !scrubbing && !document.hidden) raf = window.requestAnimationFrame(tick);
  }

  function play() {
    if (raf || progress >= 1 || document.hidden || scrubbing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    playbackStartedAt = performance.now() - progress * INTRO_DURATION;
    raf = window.requestAnimationFrame(tick);
  }

  function seek(value) {
    stopPlayback();
    renderTimeline(value);
  }

  function clearIntro() {
    stopPlayback();
    scrubbing = false;
    root.classList.remove('is-intro');
  }

  listen(progressRange, 'input', () => {
    scrubbing = true;
    seek(Number(progressRange.value));
  });
  listen(progressRange, 'change', () => {
    scrubbing = false;
    play();
  });
  listen(progressRange, 'pointerdown', () => {
    scrubbing = true;
    stopPlayback();
  });
  listen(progressRange, 'pointerup', () => {
    scrubbing = false;
    play();
  });
  listen(progressRange, 'pointercancel', () => {
    scrubbing = false;
    play();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      resumeAfterVisibility = Boolean(raf);
      stopPlayback();
    } else if (resumeAfterVisibility) {
      resumeAfterVisibility = false;
      play();
    }
  });

  function setSelected(id) {
    selectedId = id;
    for (const [raceId, el] of nodes) el.classList.toggle('is-selected', raceId === id);
  }

  setSelected(selectedId);

  listen(backBtn, 'click', () => onBack?.());

  return {
    dispose() { clearIntro(); events.abort(); },
    show() {
      clearIntro();
      root.classList.add('is-active');
      root.setAttribute('aria-hidden', 'false');
      progressRoot.hidden = false;
      root.classList.add('is-intro');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        renderTimeline(INTRO_DURATION);
      } else {
        seek(0);
        play();
      }
    },
    hide() {
      clearIntro();
      progressRoot.hidden = true;
      root.classList.remove('is-active');
      root.setAttribute('aria-hidden', 'true');
      renderTimeline(0);
    },
    setSelected,
    get selected() { return selectedId; },
    get element() { return root; },
    nodeCount: nodes.size,
    rootCount: roots.length,
    get progress() { return progress; },
    get duration() { return INTRO_DURATION; },
  };
}

export default createRaceTree;
