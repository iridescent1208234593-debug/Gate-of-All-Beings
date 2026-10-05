import * as THREE from 'three/webgpu';
import { JellyPhysics } from '../../physics.js';
import { makeSoftieSkin } from './skins/softie.js';
import { makeCatSpiritSkin } from './skins/cat.js';
import { makeBudSpiritSkin } from './skins/bud.js';
import { SPIRIT_WORLD_SCALE } from './settings.js';

const skinFactories = { cat: makeCatSpiritSkin, softie: makeSoftieSkin, bud: makeBudSpiritSkin, custom: makeSoftieSkin };
const sameBodyShape = (a, b) => a === b || Boolean(a?.points && b?.points && a.points.length === b.points.length
  && a.points.every((point, i) => point.x === b.points[i].x && point.y === b.points[i].y));

function validateSkin(skin) {
  if (!skin?.root?.isObject3D || !Array.isArray(skin.pickMeshes)
    || typeof skin.update !== 'function' || typeof skin.applyAppearance !== 'function'
    || typeof skin.dispose !== 'function') {
    skin?.dispose?.();
    throw new TypeError('A spirit skin must expose root, pickMeshes, applyAppearance, update and dispose.');
  }
  return skin;
}

/** Instance owns its skin; scene/world owns physics stepping and input. */
export class SpiritInstance {
  constructor({ id = 'spirit', appearance = {}, physics = new JellyPhysics(), environment,
    skinFactory } = {}) {
    this.id = id;
    this.physics = physics;
    this.environment = environment;
    this.appearance = { skin: 'cat', color: '#202b25', opacity: 1, size: 1,
      earSize: 1, tailLength: 1, eyeSize: 1, ...appearance };
    this.root = new THREE.Group();
    this.root.name = `spirit-instance-${id}`;
    this.presentationScale = 1;
    this.root.scale.setScalar(SPIRIT_WORLD_SCALE);
    this.genericAccessory = this._createGenericAccessory();
    this._disposed = false;
    this.setSkin(skinFactory ?? skinFactories[this.appearance.skin] ?? makeCatSpiritSkin);
    this.update(0);
  }

  get pickMeshes() {
    return this.skin?.pickMeshes ?? [];
  }

  get metrics() {
    const metrics = this.skin?.metrics;
    if (!metrics) return metrics;
    const scale = SPIRIT_WORLD_SCALE * this.presentationScale;
    return { radius: metrics.radius * scale, depth: metrics.depth * scale, height: metrics.height * scale };
  }

  setPresentationScale(value = 1) {
    this.presentationScale = Number.isFinite(value) ? Math.max(0.5, Math.min(3, value)) : 1;
    this.root.scale.setScalar(SPIRIT_WORLD_SCALE * this.presentationScale);
  }

  setSkin(factory, appearance = this.appearance) {
    if (this._disposed) return;
    if (typeof factory !== 'function') throw new TypeError('A spirit skin factory must be a function.');
    const nextAppearance = { ...appearance };
    const next = validateSkin(factory({ physics: this.physics, appearance: nextAppearance,
      environment: this.environment }));
    const previous = this.skin;
    this.root.add(next.root);
    next.root.add(this.genericAccessory);
    this.skin = next;
    this._skinFactory = factory;
    this.appearance = nextAppearance;
    if (previous) this.root.remove(previous.root);
    previous?.dispose();
    this._syncGenericAccessory();
  }

  applyAppearance(patch = {}) {
    if (this._disposed) return;
    const appearance = { ...this.appearance, ...patch };
    const factory = skinFactories[appearance.skin];
    const bodyChanged = Object.hasOwn(patch, 'bodyShape') && appearance.skin === 'custom'
      && !sameBodyShape(appearance.bodyShape, this.appearance.bodyShape);
    if ((Object.hasOwn(patch, 'skin') && factory && factory !== this._skinFactory) || bodyChanged) {
      this.setSkin(factory, appearance);
      this.update(0);
    } else {
      this.appearance = appearance;
      this.skin.applyAppearance(this.appearance);
      this._syncGenericAccessory();
    }
  }

  update(time) {
    if (this._disposed) return;
    const { x, y, z } = this.physics.position;
    this.root.position.set(x, y, z);
    this.skin.update(time);
    if (this.genericAccessory.visible) {
      this.physics.deform(0.56, 0.92, this.appearance.skin === 'bud' ? 0.48 : 0.82,
        this.genericAccessory.position);
    }
  }

  _createGenericAccessory() {
    const group = new THREE.Group();
    group.name = 'test-spirit-charm';
    const charm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#f5c85b', metalness: 0.58, roughness: 0.28 }));
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0),
      new THREE.MeshBasicMaterial({ color: '#fff3bb' }));
    charm.name = 'test-spirit-charm-center'; glint.name = 'test-spirit-charm-glint';
    glint.position.z = 0.105;
    group.add(charm, glint);
    group.visible = false;
    return group;
  }

  _syncGenericAccessory() {
    this.genericAccessory.visible = this.appearance.accessory === 'test-badge'
      && !['softie', 'custom'].includes(this.appearance.skin);
  }

  reset() {
    if (this._disposed) return;
    this.physics.reset();
    this.update(0);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.physics.clearDrive?.();
    this.skin.dispose();
    this.genericAccessory.traverse(object => {
      object.geometry?.dispose();
      if (object.material) object.material.dispose();
    });
    this.root.removeFromParent();
    this.root.clear();
  }
}
