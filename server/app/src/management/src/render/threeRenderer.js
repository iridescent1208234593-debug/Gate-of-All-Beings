import * as THREE from 'three';
import { getBuilding } from '../content/buildings.js';
import { buildingUnlocked } from '../content/research.js';
import { getCrop } from '../content/crops.js';
import { NEEDS } from '../content/needs.js';
import { canPlace, RESOURCE_TYPES } from '../systems/spiritSpace.js';
import { isBuilt } from '../systems/building.js';
import { isNight } from '../core/util.js';
import { ModelFactory } from './models.js';
import { aimCamera, createCamera, fitFrustum, gridFromPoint } from './camera.js';
import { bindMapInteraction } from './interaction.js';

export class RenderEngine {
  constructor(canvas, { tooltipEl = null } = {}) {
    this.canvas = canvas; this.tooltipEl = tooltipEl;
    this.state = null; this.placement = null; this.selectedId = null; this.moveId = null;
    this.mouse = { gx: -1, gy: -1, inside: false }; this.pointer = { x: 0, y: 0 };
    this.disposed = false; this.contextLost = false;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#bfe3dc');
    this.camera = createCamera(); this.target = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.factory = new ModelFactory(); this.objects = new Map(); this.resourceObjects = new Map();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.ambient = new THREE.HemisphereLight('#fff8dc', '#729180', 2.2);
    this.sun = new THREE.DirectionalLight('#fff4d0', 2.1); this.sun.position.set(-12, 30, 16);
    this.scene.add(this.ambient, this.sun);
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.labels = document.createElement('div'); this.labels.className = 'map-labels';
    this.labels.setAttribute('aria-hidden', 'true'); canvas.parentElement.append(this.labels);
    this.overlayMaterial = new THREE.MeshBasicMaterial({ color: '#c08b3c', transparent: true, opacity: 0.5, depthWrite: false });
    this.overlay = new THREE.Mesh(this.factory.geometries.box, this.overlayMaterial);
    this.scene.add(this.overlay); this.overlay.visible = false;
    this.selection = new THREE.Box3Helper(new THREE.Box3(), '#c08b3c');
    this.scene.add(this.selection); this.selection.visible = false;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement);
    this._lost = e => { e.preventDefault(); this.contextLost = true; this.setRenderStatus('画面暂时中断，正在等待恢复…'); };
    this._restored = () => { this.contextLost = false; this.resize(); this.setRenderStatus(''); };
    canvas.addEventListener('webglcontextlost', this._lost); canvas.addEventListener('webglcontextrestored', this._restored);
    this.resize();
  }
  setRenderStatus(text) {
    const el = document.getElementById('render-status');
    if (el) { el.textContent = text; el.classList.toggle('hidden', !text); }
  }
  setState(state) {
    if (this.disposed || this.state === state) return;
    const changedSize = !this.state || this.state.space.width !== state.space.width || this.state.space.height !== state.space.height;
    this.state = state;
    if (changedSize) { this.rebuildGround(); this.resetView(); }
    this.syncResources(); this.syncObjects();
    const night = isNight(state.time);
    this.scene.background.set(night ? '#8eaeb1' : '#bfe3dc');
    this.ambient.intensity = night ? 1.45 : 2.2; this.sun.intensity = night ? 1.2 : 2.1;
    const phase = document.getElementById('map-phase'), size = document.getElementById('map-size');
    if (phase) phase.textContent = night ? '☾ 夜色 · 灵质空间' : '☀ 日光 · 灵质空间';
    if (size) size.textContent = `${state.space.width} × ${state.space.height}`;
  }
  rebuildGround() {
    if (this.terrain) { this.world.remove(this.terrain); this.terrain.dispose(); }
    if (this.base) this.world.remove(this.base);
    const { width, height, tiles } = this.state.space;
    this.base = this.factory.part(this.world, 'box', '#8a9b7b', [width / 2, -0.27, height / 2], [width + 0.08, 0.5, height + 0.08]);
    this.terrain = new THREE.InstancedMesh(this.factory.geometries.box, this.factory.material('#ffffff'), tiles.length);
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    tiles.forEach((t, i) => {
      matrix.compose(new THREE.Vector3(t.x + 0.5, -0.04, t.y + 0.5), new THREE.Quaternion(), new THREE.Vector3(0.98, 0.08, 0.98));
      this.terrain.setMatrixAt(i, matrix); color.set((t.x + t.y) % 2 ? '#b7c997' : '#bfcea2'); this.terrain.setColorAt(i, color);
    });
    this.terrain.instanceMatrix.needsUpdate = true; this.world.add(this.terrain);
  }
  syncResources() {
    const live = new Set();
    for (const tile of this.state.space.tiles) {
      if (!tile.resource || tile.buildingId) continue;
      const key = `${tile.x},${tile.y}:${tile.resource.type}`; live.add(key);
      if (!this.resourceObjects.has(key)) {
        const object = this.factory.resource(tile.resource.type); object.position.set(tile.x + 0.5, 0, tile.y + 0.5);
        this.world.add(object); this.resourceObjects.set(key, object);
      }
    }
    for (const [id, object] of this.resourceObjects) if (!live.has(id)) { this.world.remove(object); this.resourceObjects.delete(id); }
  }
  syncObjects() {
    const live = new Set();
    const items = [
      ...this.state.buildings.map(data => ({ kind: 'building', data })),
      ...this.state.colonists.map(data => ({ kind: 'colonist', data })),
      ...(this.state.combat?.threats || []).map(data => ({ kind: 'enemy', data })),
    ];
    for (const { kind, data } of items) {
      const key = `${kind}:${data.id}`, def = kind === 'building' ? getBuilding(data.buildingId) : null;
      if (kind === 'building' && !def) continue;
      live.add(key);
      let entry = this.objects.get(key);
      const signature = def ? data.buildingId : data.color;
      if (entry && entry.signature !== signature) { this.removeObject(key, entry); entry = null; }
      if (!entry) {
        const object = def ? this.factory.building(def) : this.factory.actor(data.color || '#c96c55', kind === 'enemy');
        const label = document.createElement('div'); label.className = `map-label map-label--${kind}`;
        this.labels.append(label); this.world.add(object);
        entry = { object, label, signature, kind, data }; this.objects.set(key, entry);
      }
      entry.data = data;
      const { object, label } = entry;
      object.userData.pick = { kind, id: data.id };
      object.position.set(data.x + (def ? data.w / 2 : 0.5), 0, data.y + (def ? data.h / 2 : 0.5));
      object.visible = Number.isFinite(data.x) && Number.isFinite(data.y) && data.x >= 0 && data.y >= 0;
      if (def) {
        const built = isBuilt(data), progress = Math.min(1, (data.construction || 0) / (data.buildTime || 1));
        object.scale.y = built ? 1 : 0.25 + progress * 0.75;
        label.textContent = built ? def.name : `${def.name} · ${Math.floor(progress * 100)}%`;
        label.classList.toggle('under-construction', !built);
        if (object.userData.crop) {
          const crop = getCrop(data.crop?.cropId);
          object.userData.crop.scale.y = crop ? 0.25 + Math.min(1, data.crop.progress / crop.growTime) * 0.75 : 0.2;
        }
      } else {
        label.textContent = kind === 'enemy' ? `${data.name} ${Math.ceil(data.hp)}` : data.name;
        object.userData.ring.visible = kind === 'enemy' || data.id === this.selectedId;
      }
    }
    for (const [key, entry] of this.objects) if (!live.has(key)) this.removeObject(key, entry);
    if (this.selectedId && !items.some(({ data }) => data.id === this.selectedId)) this.selectedId = null;
  }
  removeObject(key, entry) { this.world.remove(entry.object); entry.label.remove(); this.objects.delete(key); }
  setPlacement(buildingId, moveId = null) { this.placement = buildingId ? { buildingId } : null; this.moveId = moveId; }
  setMouse(gx, gy, inside) { this.mouse = { gx, gy, inside }; }
  setPointer(x, y) { this.pointer = { x, y }; this.mouse = this.screenToGrid(x, y); }
  setSelected(id) { this.selectedId = id; }
  bindInput(callbacks) { this._unbindInput?.(); this._unbindInput = bindMapInteraction(this, callbacks); }
  groundPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), this.camera);
    return this.raycaster.ray.intersectPlane(this.ground, new THREE.Vector3());
  }
  screenToGrid(x, y) { return gridFromPoint(this.groundPoint(x, y), this.state?.space || { width: 0, height: 0 }); }
  pick(x, y) {
    const grid = this.screenToGrid(x, y);
    if (this.placement) return grid;
    const hits = this.raycaster.intersectObjects([...this.objects.values()].map(e => e.object), true);
    for (const hit of hits) {
      let object = hit.object;
      while (object && !object.userData.pick) object = object.parent;
      if (object?.visible && object.userData.pick) {
        const info = object.userData.pick, entry = this.objects.get(`${info.kind}:${info.id}`);
        return { gx: entry.data.x, gy: entry.data.y, inside: true, ...info };
      }
    }
    return grid;
  }
  panPixels(x1, y1, x2, y2) {
    const a = this.groundPoint(x1, y1), b = this.groundPoint(x2, y2);
    if (!a || !b || !this.state) return;
    this.target.add(a.sub(b));
    this.target.x = THREE.MathUtils.clamp(this.target.x, -4, this.state.space.width + 4);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -4, this.state.space.height + 4);
    aimCamera(this.camera, this.target);
  }
  zoomAt(factor, x, y) {
    const rect = this.canvas.getBoundingClientRect();
    x ??= rect.left + rect.width / 2; y ??= rect.top + rect.height / 2;
    const before = this.groundPoint(x, y);
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, 0.65, 4); this.camera.updateProjectionMatrix();
    const after = this.groundPoint(x, y);
    if (before && after) this.target.add(before.sub(after));
    aimCamera(this.camera, this.target);
    const el = document.getElementById('zoom-level'); if (el) el.textContent = `${Math.round(this.camera.zoom * 100)}%`;
  }
  resetView() {
    if (!this.state) return;
    this.target.set(this.state.space.width / 2, 0, this.state.space.height / 2);
    this.camera.zoom = 1; this.resize(); aimCamera(this.camera, this.target);
    const el = document.getElementById('zoom-level'); if (el) el.textContent = '100%';
  }
  focusSelected() {
    const entry = [...this.objects.values()].find(e => e.data.id === this.selectedId);
    if (entry) { this.target.copy(entry.object.position); aimCamera(this.camera, this.target); }
  }
  resize() {
    if (this.disposed) return;
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    fitFrustum(this.camera, this.state?.space.width || 24, this.state?.space.height || 16, this.width / this.height);
  }
  placementCheck() {
    if (!this.placement || !this.state) return { ok: false };
    const { gx, gy } = this.mouse;
    if (!this.moveId) {
      if (!buildingUnlocked(this.state, this.placement.buildingId)) return { ok: false, reason: '尚未研究解锁' };
      return canPlace(this.state, this.placement.buildingId, gx, gy);
    }
    const def = getBuilding(this.placement.buildingId), space = this.state.space;
    if (gx < 0 || gy < 0 || gx + def.size.w > space.width || gy + def.size.h > space.height) return { ok: false, reason: '超出边界' };
    for (let y = gy; y < gy + def.size.h; y++) for (let x = gx; x < gx + def.size.w; x++) {
      const tile = space.tiles[y * space.width + x];
      if (tile.resource || (tile.buildingId && tile.buildingId !== this.moveId)) return { ok: false, reason: '地块被占用' };
    }
    return { ok: true };
  }
  render() {
    if (!this.state || this.disposed || this.contextLost) return;
    this.overlay.visible = this.mouse.inside;
    if (this.mouse.inside) {
      const def = this.placement && getBuilding(this.placement.buildingId), w = def?.size.w || 1, h = def?.size.h || 1;
      this.overlay.position.set(this.mouse.gx + w / 2, 0.055, this.mouse.gy + h / 2); this.overlay.scale.set(w - 0.05, 0.05, h - 0.05);
      this.overlayMaterial.color.set(def ? (this.placementCheck().ok ? '#609b64' : '#c45d49') : '#e8a13c');
    }
    this.selection.visible = false; this.world.updateMatrixWorld(true);
    for (const entry of this.objects.values()) {
      const selected = entry.data.id === this.selectedId;
      if (entry.kind === 'colonist') entry.object.userData.ring.visible = selected;
      if (selected && entry.kind === 'building') { this.selection.box.setFromObject(entry.object); this.selection.visible = true; }
      const point = entry.object.position.clone().add(new THREE.Vector3(0, entry.kind === 'building' ? 2.1 : 1.1, 0)).project(this.camera);
      const visible = entry.object.visible && Math.abs(point.x) < 0.97 && Math.abs(point.y) < 0.95;
      entry.label.hidden = !visible; entry.label.classList.toggle('selected', selected);
      if (visible) entry.label.style.transform = `translate(${(point.x + 1) * this.width / 2}px,${(1 - point.y) * this.height / 2}px) translate(-50%,-100%)`;
    }
    this.renderer.render(this.scene, this.camera); this.updateTooltip();
  }
  hitInfo(gx, gy) {
    if (!this.state || gx < 0 || gy < 0 || gx >= this.state.space.width || gy >= this.state.space.height) return null;
    const c = this.state.colonists.find(c => c.x === gx && c.y === gy);
    if (c) {
      const lowest = Object.entries(c.needs).sort((a, b) => a[1] - b[1])[0];
      return `${c.name} · ${c.mood === 'green' ? '愉快' : c.mood === 'yellow' ? '一般' : '糟糕'}\n${NEEDS.find(n => n.id === lowest?.[0])?.name || '需求'} ${Math.round(lowest?.[1] || 0)}`;
    }
    const tile = this.state.space.tiles[gy * this.state.space.width + gx], b = this.state.buildings.find(b => b.id === tile?.buildingId);
    if (b) { const def = getBuilding(b.buildingId); return `${def.name}\n${def.desc}\n工位 ${b.workers.length}/${def.maxWorkers}${isBuilt(b) ? '' : ' · 建造中'}`; }
    if (tile?.resource) return `${RESOURCE_TYPES[tile.resource.type]?.name || '资源'} · 余量 ${Math.ceil(tile.resource.amount)}`;
    return null;
  }
  updateTooltip() {
    if (!this.tooltipEl) return;
    let info = this.mouse.inside ? this.hitInfo(this.mouse.gx, this.mouse.gy) : null;
    if (this.mouse.inside && this.placement) { const check = this.placementCheck(); info = `${getBuilding(this.placement.buildingId).name} · ${check.ok ? '点击放置' : check.reason}`; }
    this.tooltipEl.classList.toggle('hidden', !info);
    if (!info) return;
    this.tooltipEl.textContent = info;
    const rect = this.canvas.getBoundingClientRect();
    this.tooltipEl.style.left = `${Math.max(8, Math.min(this.width - 230, this.pointer.x - rect.left + 16))}px`;
    this.tooltipEl.style.top = `${Math.max(8, Math.min(this.height - 90, this.pointer.y - rect.top + 20))}px`;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this._unbindInput?.(); this.resizeObserver.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this._lost); this.canvas.removeEventListener('webglcontextrestored', this._restored);
    this.labels.remove(); this.tooltipEl?.classList.add('hidden'); this.terrain?.dispose(); this.overlayMaterial.dispose();
    this.selection.geometry.dispose(); this.selection.material.dispose(); this.factory.dispose(); this.scene.clear();
    this.objects.clear(); this.resourceObjects.clear(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
