/**
 * 众生之门 · 嵌入式场景内核（vanilla three.js，零 React 依赖）
 *
 * 由 src/components/reference/ReferenceScene3D.tsx 逐行移植为命令式实现，
 * 复用 sceneModel.ts 的时间轴 / 调色板 / 粒子，供静态站以 <script> 直接引入。
 *
 * 使用：
 *   <script src="assets/gate/gate-scene.js"></script>
 *   const scene = LXHGate.createScene(document.getElementById('gate'), { theme: 'original' });
 *   scene.play(); scene.setTheme('emerald'); scene.destroy();
 */

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import {
  ALL_LAYERS,
  DURATION as SCENE_DURATION,
  HEIGHT,
  SCENE_LAYERS,
  WIDTH,
  layerState,
  palette,
  starState,
  stars,
  type ColorName,
  type LayerVisibility,
  type SceneLayer,
} from '../components/reference/sceneModel';
import type { ThemeMode } from '../types';

/* ------------------------------------------------------------------ *
 * 对外常量
 * ------------------------------------------------------------------ */

export const THEMES: Array<{ id: ThemeMode; label: string; color: string }> = [
  { id: 'original', label: 'Classic Night', color: '#85A96F' },
  { id: 'twilight', label: 'Twilight Blue', color: '#74B9FF' },
  { id: 'emerald', label: 'Emerald Forest', color: '#2ED573' },
  { id: 'golden', label: 'Golden Dusk', color: '#F3C248' },
  { id: 'cyber', label: 'Cyber Neon', color: '#FD79A8' },
];

export const DURATION = SCENE_DURATION;

/** 门扉 reveal 起始 / 结束，取自 SCENE_LAYERS.gate，避免与时间轴漂移 */
const GATE_LAYER = SCENE_LAYERS.find(layer => layer.id === 'gate');
export const GATE_OPEN_AT = GATE_LAYER ? GATE_LAYER.start : 2.84;
export const GATE_FULLY_OPEN_AT = GATE_LAYER ? GATE_LAYER.end : 3.67;

/** 默认循环回绕点：圆月起始（1.02s），跳过 0–1s 的全黑星空段 */
const DEFAULT_LOOP_START = 1.02;

/* ------------------------------------------------------------------ *
 * 对外类型
 * ------------------------------------------------------------------ */

export interface GateFrameInfo {
  /** 当前场景时钟（秒） */
  t: number;
  /** 对应的 24fps 帧号（0–143） */
  frame: number;
  /** 是否已跨过门扉开启时刻 */
  gateOpen: boolean;
}

export interface GateSceneOptions {
  /** 主题 id，默认 'original' */
  theme?: string;
  /** 到达 DURATION 后是否回绕，默认 false（保留 zszm「只播一遍」语义） */
  loop?: boolean;
  /** 循环回绕起点（秒），默认 1.02 */
  loopStart?: number;
  /** 是否自动推进，默认 true */
  autoplay?: boolean;
  /** 图层开关，默认全部开启 */
  layers?: Partial<LayerVisibility>;
  /** 是否接管指针/滚轮/触摸交互（旋转、缩放），默认 true；页面内嵌黑框建议设为 false 以免抢滚动 */
  interactive?: boolean;
  onFrame?: (info: GateFrameInfo) => void;
  /** t 首次跨过 GATE_OPEN_AT 时回调一次（回退到开启前会重新武装） */
  onGateOpen?: () => void;
  onThemeChange?: (themeId: string) => void;
}

export interface GateSceneHandle {
  play(): void;
  pause(): void;
  seek(t: number): void;
  setTheme(id: string): void;
  getTheme(): string;
  setLoop(on: boolean): void;
  setLoopRange(range: [number, number]): void;
  resize(): void;
  destroy(): void;
  getTime(): number;
  readonly canvas: HTMLCanvasElement;
}

/* ------------------------------------------------------------------ *
 * 能力探测
 * ------------------------------------------------------------------ */

export function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    return !!gl;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * 场景创建
 * ------------------------------------------------------------------ */

const clampTime = (value: number) => Math.max(0, Math.min(SCENE_DURATION, value));

export function createScene(container: HTMLElement, options: GateSceneOptions = {}): GateSceneHandle | null {
  if (!container || !hasWebGL()) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }

  /* ---------- 渲染器 / 场景 / 相机（与 ReferenceScene3D 保持一致） ---------- */
  renderer.setClearColor(0x000000);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute('aria-label', '众生之门 3D 复现');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 4000);
  camera.position.set(0, 0, 1600);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.8));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(-400, 700, 1000);
  scene.add(light);

  /* ---------- 主题 ---------- */
  let theme: ThemeMode = (THEMES.some(item => item.id === options.theme) ? options.theme : 'original') as ThemeMode;
  const layers: LayerVisibility = { ...ALL_LAYERS, ...(options.layers || {}) };

  /* ---------- 图层构建（矢量 path → 挤出几何 + 描边） ---------- */
  const colors = palette(theme);
  const loader = new SVGLoader();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const colored: Array<{ material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial; color: ColorName; side: boolean }> = [];
  const trackMaterial = (
    material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial,
    color: ColorName,
    side = false,
  ) => {
    materials.add(material);
    colored.push({ material, color, side });
    return material;
  };
  const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };

  interface LayerObject {
    source: SceneLayer;
    group: THREE.Group;
    materials: Array<{ material: THREE.Material & { opacity: number }; base: number }>;
  }

  const objects: LayerObject[] = SCENE_LAYERS.map((layer, layerIndex) => {
    const group = new THREE.Group();
    root.add(group);
    group.name = layer.id;
    const item: LayerObject = { source: layer, group, materials: [] };
    const addMat = (material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial, base = 1) => {
      material.transparent = true;
      material.opacity = base;
      item.materials.push({ material, base });
      return material;
    };
    if (layer.id === 'moon') {
      const mat = addMat(trackMaterial(new THREE.MeshBasicMaterial({ color: colors.cream }), 'cream'));
      const mesh = new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(135, 64, 40)), mat);
      mesh.userData.layer = layer.id;
      group.add(mesh);
    } else {
      layer.parts.forEach((part, index) => {
        const [px, py] = layer.pivot;
        const xml = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${part.d}" fill="${
          part.fill ? colors[part.fill] : 'none'
        }" fill-rule="evenodd" stroke="${part.stroke ? colors[part.stroke] : 'none'}" stroke-width="${
          part.strokeWidth || 1
        }" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
        const parsed = loader.parse(xml);
        for (const path of parsed.paths) {
          if (part.fill) {
            const front = addMat(
              trackMaterial(
                new THREE.MeshBasicMaterial({
                  color: colors[part.fill],
                  side: THREE.DoubleSide,
                  depthWrite: (part.opacity ?? 1) === 1,
                }),
                part.fill,
              ),
              part.opacity ?? 1,
            );
            const side = addMat(
              trackMaterial(
                new THREE.MeshLambertMaterial({
                  color: colors[part.fill],
                  side: THREE.DoubleSide,
                  depthWrite: (part.opacity ?? 1) === 1,
                }),
                part.fill,
                true,
              ),
              (part.opacity ?? 1) * 0.9,
            );
            for (const shape of SVGLoader.createShapes(path)) {
              // Opaque shapes have thickness. Transparent spirits use a single front
              // surface plus side walls so front/back alpha does not double up.
              const geometry = trackGeometry(
                new THREE.ExtrudeGeometry(shape, { depth: layer.depth, bevelEnabled: false, curveSegments: 24, steps: 1 }),
              );
              geometry.scale(1, -1, 1);
              geometry.translate(-px, py, -layer.depth);
              if ((part.opacity ?? 1) < 1) {
                const faces = trackGeometry(new THREE.ShapeGeometry(shape, 24));
                faces.scale(1, -1, 1);
                faces.translate(-px, py, 0.1);
                const face = new THREE.Mesh(faces, front);
                face.position.z = index * 0.4;
                face.renderOrder = layerIndex * 10 + index;
                group.add(face);
                face.userData.layer = layer.id;
                geometry.groups = geometry.groups.filter(group => group.materialIndex === 1);
              }
              const mesh = new THREE.Mesh(geometry, [front, side]);
              mesh.position.z = index * 0.4;
              mesh.renderOrder = layerIndex * 10 + index;
              mesh.userData.layer = layer.id;
              group.add(mesh);
            }
          }
          if (part.stroke) {
            const outline = addMat(
              trackMaterial(
                new THREE.MeshBasicMaterial({
                  color: colors[part.stroke],
                  side: THREE.DoubleSide,
                  depthWrite: false,
                }),
                part.stroke,
              ),
              part.fill ? 1 : part.opacity ?? 1,
            );
            for (const sub of path.subPaths) {
              const geometry = SVGLoader.pointsToStroke(
                sub.getPoints(48),
                SVGLoader.getStrokeStyle(part.strokeWidth || 1, colors[part.stroke], 'round', 'round'),
              );
              if (!geometry) continue;
              trackGeometry(geometry);
              geometry.scale(1, -1, 1);
              geometry.translate(-px, py, index * 0.4 + 0.2);
              const mesh = new THREE.Mesh(geometry, outline);
              mesh.renderOrder = layerIndex * 10 + index + 1;
              mesh.userData.layer = layer.id;
              group.add(mesh);
            }
          }
        }
      });
    }
    return item;
  });

  const starObjects = stars.map(star => {
    const material = trackMaterial(
      new THREE.MeshBasicMaterial({ color: colors.cream, transparent: true, depthWrite: false }),
      'cream',
    );
    const mesh = new THREE.Mesh(trackGeometry(new THREE.CircleGeometry(star.size, 8)), material);
    root.add(mesh);
    return { star, mesh, material };
  });

  /* ---------- 视角状态与交互 ---------- */
  let rotX = 0;
  let rotY = 0;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  const ZMIN = 0.45;
  const ZMAX = 3;
  const clampZoom = (value: number) => Math.max(ZMIN, Math.min(ZMAX, value));
  const interactive = options.interactive !== false;
  if (interactive) renderer.domElement.style.touchAction = 'none';

  // 正交相机下 1 像素对应的世界单位随 zoom 收缩：捏合缩放与双指平移据此换算锚点，保证手指下的内容不动
  const metrics = (value: number) => {
    const rect = container.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    return {
      x: (camera.right - camera.left) / (value * w),
      y: (camera.top - camera.bottom) / (value * h),
      w,
      h,
      left: rect.left,
      top: rect.top,
    };
  };

  let pointer: { id: number; x: number; y: number } | null = null;
  const down = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    if (event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    container.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    rotY += (event.clientX - pointer.x) * 0.006;
    rotX = Math.max(-0.75, Math.min(0.75, rotX + (event.clientY - pointer.y) * 0.004));
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };
  const up = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer = null;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
  };
  const cancel = () => {
    pointer = null;
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const before = metrics(zoom);
    const next = clampZoom(zoom * Math.exp(-event.deltaY * 0.001));
    const after = metrics(next);
    const sx = event.clientX - before.left - before.w / 2;
    const sy = event.clientY - before.top - before.h / 2;
    panX += sx * (before.x - after.x);
    panY += -sy * (before.y - after.y);
    zoom = next;
  };

  const touches = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number } | null = null;
  let pinch: { d0: number; z0: number; cx: number; cy: number } | null = null;
  const pinchInfo = () => {
    const list = [...touches.values()];
    if (list.length < 2) return null;
    const [a, b] = list;
    return { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };
  const touchStart = (event: TouchEvent) => {
    event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    if (touches.size === 1) {
      const touch = event.changedTouches[0];
      drag = { x: touch.clientX, y: touch.clientY };
      pinch = null;
    } else {
      const info = pinchInfo();
      if (info) pinch = { d0: info.d, z0: zoom, cx: info.cx, cy: info.cy };
      drag = null;
    }
  };
  const touchMove = (event: TouchEvent) => {
    if (!touches.size) return;
    event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) {
      if (touches.has(touch.identifier)) touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    if (pinch && touches.size >= 2) {
      const info = pinchInfo();
      if (!info) return;
      const before = metrics(zoom);
      const next = clampZoom((pinch.z0 * info.d) / pinch.d0);
      const after = metrics(next);
      const sx = info.cx - before.left - before.w / 2;
      const sy = info.cy - before.top - before.h / 2;
      panX += sx * (before.x - after.x) + (info.cx - pinch.cx) * after.x;
      panY += -sy * (before.y - after.y) - (info.cy - pinch.cy) * after.y;
      zoom = next;
      pinch.cx = info.cx;
      pinch.cy = info.cy;
      return;
    }
    if (drag && touches.size === 1) {
      const touch = [...touches.values()][0];
      rotY += (touch.x - drag.x) * 0.006;
      rotX = Math.max(-0.75, Math.min(0.75, rotX + (touch.y - drag.y) * 0.004));
      drag.x = touch.x;
      drag.y = touch.y;
    }
  };
  const touchEnd = (event: TouchEvent) => {
    event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) touches.delete(touch.identifier);
    if (touches.size < 1) {
      drag = null;
      pinch = null;
    } else if (touches.size === 1) {
      const touch = [...touches.values()][0];
      drag = { x: touch.x, y: touch.y };
      pinch = null;
    }
  };

  if (interactive) {
    container.addEventListener('pointerdown', down);
    container.addEventListener('pointermove', move);
    container.addEventListener('pointerup', up);
    container.addEventListener('pointercancel', cancel);
    container.addEventListener('wheel', wheel, { passive: false });
    container.addEventListener('touchstart', touchStart, { passive: false });
    container.addEventListener('touchmove', touchMove, { passive: false });
    container.addEventListener('touchend', touchEnd, { passive: false });
    container.addEventListener('touchcancel', touchEnd, { passive: false });
  }

  /* ---------- 视锥 cover 自适应（容器非 16:9 时扩展视域，不拉伸变形） ---------- */
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const base = WIDTH / HEIGHT;
    const aspect = w / h;
    const k = aspect >= base ? aspect / base : base / aspect;
    if (aspect >= base) {
      camera.left = (-WIDTH / 2) * k;
      camera.right = (WIDTH / 2) * k;
      camera.top = HEIGHT / 2;
      camera.bottom = -HEIGHT / 2;
    } else {
      camera.left = -WIDTH / 2;
      camera.right = WIDTH / 2;
      camera.top = (HEIGHT / 2) * k;
      camera.bottom = (-HEIGHT / 2) * k;
    }
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  /* ---------- 时钟与播放控制 ---------- */
  const reducedMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loopStartOption = typeof options.loopStart === 'number' ? options.loopStart : DEFAULT_LOOP_START;
  let loopStart = clampTime(loopStartOption);
  let loopEnd = SCENE_DURATION;
  let loopEnabled = options.loop === true;
  let time = reducedMotion ? GATE_FULLY_OPEN_AT : 0;
  let playing = options.autoplay !== false && !reducedMotion;
  let gateOpenFired = false;
  let destroyed = false;
  let raf = 0;
  let lastTick = performance.now();
  let oldTheme: ThemeMode | undefined;
  let lastState = '';

  const draw = () => {
    const state = JSON.stringify([
      time,
      theme,
      layers,
      rotX,
      rotY,
      zoom,
      panX,
      panY,
      container.clientWidth,
      container.clientHeight,
    ]);
    if (state === lastState) return;
    lastState = state;

    root.rotation.set(rotX, rotY, 0);
    root.position.set(panX, panY, 0);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();

    if (oldTheme !== theme) {
      const next = palette(theme);
      for (const entry of colored) {
        entry.material.color.set(next[entry.color]);
        if (entry.side) entry.material.color.multiplyScalar(0.65);
      }
      oldTheme = theme;
    }

    for (const item of objects) {
      const s = layerState(item.source, time);
      const [px, py] = item.source.pivot;
      item.group.visible = layers[item.source.visibility] && s.opacity > 0;
      item.group.position.set(px - WIDTH / 2, HEIGHT / 2 - py - s.dy, item.source.z);
      item.group.scale.set(Math.max(s.sx, 0.00001), Math.max(s.sy, 0.00001), Math.max(s.sx, 0.00001));
      for (const m of item.materials) m.material.opacity = m.base * s.opacity;
    }

    for (const item of starObjects) {
      const s = starState(item.star, time);
      item.mesh.position.set(s.x - WIDTH / 2, HEIGHT / 2 - s.y, 200);
      item.mesh.visible = layers.moon && s.opacity > 0;
      item.material.opacity = s.opacity;
    }

    renderer.render(scene, camera);

    container.dataset.frame = String(Math.min(143, Math.floor(time * 24 + 1e-6)));
    container.dataset.rotation = `${rotX.toFixed(3)},${rotY.toFixed(3)}`;
    container.dataset.zoom = zoom.toFixed(3);
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (destroyed) return;
    const dt = Math.min((now - lastTick) / 1000, 1 / 30);
    lastTick = now;
    if (playing) {
      time += dt;
      const end = loopEnabled ? loopEnd : SCENE_DURATION;
      if (time >= end) {
        if (loopEnabled) {
          const span = Math.max(1e-3, loopEnd - loopStart);
          time = loopStart + ((time - loopEnd) % span);
        } else {
          time = SCENE_DURATION;
          playing = false;
        }
      }
    }
    const gateOpen = time >= GATE_OPEN_AT;
    if (gateOpen) {
      if (!gateOpenFired) {
        gateOpenFired = true;
        if (options.onGateOpen) options.onGateOpen();
      }
    } else {
      gateOpenFired = false;
    }
    draw();
    if (options.onFrame) {
      options.onFrame({ t: time, frame: Math.min(143, Math.floor(time * 24 + 1e-6)), gateOpen });
    }
  };
  raf = requestAnimationFrame(tick);

  /* ---------- 句柄 ---------- */
  const handle: GateSceneHandle = {
    play() {
      if (destroyed) return;
      if (time >= SCENE_DURATION - 1e-6) time = loopEnabled ? loopStart : clampTime(loopStart);
      playing = true;
    },
    pause() {
      playing = false;
    },
    seek(value: number) {
      if (destroyed) return;
      time = clampTime(value);
      playing = false; // 与 zszm 进度条接管语义一致：seek 后停止自动推进，需显式 play()
      draw();
    },
    setTheme(id: string) {
      if (destroyed) return;
      if (!THEMES.some(item => item.id === id)) return;
      theme = id as ThemeMode;
      draw();
      if (options.onThemeChange) options.onThemeChange(id);
    },
    getTheme() {
      return theme;
    },
    setLoop(on: boolean) {
      loopEnabled = !!on;
    },
    setLoopRange(range: [number, number]) {
      const start = clampTime(range[0]);
      const end = clampTime(range[1]);
      loopStart = Math.min(start, end);
      loopEnd = Math.max(start, end);
      if (loopEnd - loopStart < 1e-3) loopEnd = clampTime(loopStart + 1e-3);
    },
    resize() {
      if (destroyed) return;
      resize();
      draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (interactive) {
        container.removeEventListener('pointerdown', down);
        container.removeEventListener('pointermove', move);
        container.removeEventListener('pointerup', up);
        container.removeEventListener('pointercancel', cancel);
        container.removeEventListener('wheel', wheel);
        container.removeEventListener('touchstart', touchStart);
        container.removeEventListener('touchmove', touchMove);
        container.removeEventListener('touchend', touchEnd);
        container.removeEventListener('touchcancel', touchEnd);
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
    getTime() {
      return time;
    },
    get canvas() {
      return renderer.domElement;
    },
  };

  // 首帧立即绘制，避免等到下一次 rAF 才可见
  draw();
  return handle;
}

/* ------------------------------------------------------------------ *
 * 全局挂载
 * ------------------------------------------------------------------ */

export const LXHGate = { THEMES, DURATION, GATE_OPEN_AT, GATE_FULLY_OPEN_AT, hasWebGL, createScene };

declare global {
  interface Window {
    LXHGate?: typeof LXHGate;
  }
}

if (typeof window !== 'undefined') {
  window.LXHGate = LXHGate;
}
