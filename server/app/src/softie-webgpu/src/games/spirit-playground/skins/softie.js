import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { makeSlime } from '../../../slime.js';
import { SPIRIT_WORLD_SCALE } from '../settings.js';

const BASE_METRICS = Object.freeze({ radius: 1.66, depth: 1.18, height: 2.82 });

/** Adapt the original softie appearance to the replaceable spirit skin contract. */
export function makeSoftieSkin({ physics, appearance = {}, environment }) {
  if (!physics || typeof physics.deform !== 'function') {
    throw new TypeError('A spirit skin needs a physics deformation map.');
  }
  let size = 1;
  let disposed = false;
  // The body map is authored at size 1. Keep every scaled vertex above the world floor.
  const deformation = {
    get position() { return physics.position; },
    deform(x, y, z, out) {
      physics.deform(x, y, z, out);
      out.y = Math.max(out.y, (0.012 - physics.position.y) / (SPIRIT_WORLD_SCALE * size));
      return out;
    },
  };
  const slime = makeSlime(deformation, environment, { detail: 'playground', style: 'spirit', bodyShape: appearance.bodyShape });
  const root = slime.group;
  root.name = 'softie-spirit-skin';
  const rear = root.getObjectByName('rear-glass-interface');
  const alpha = uniform(1);
  slime.gel.opacityNode = alpha;
  rear.material.opacityNode = alpha;
  // Bubble opacity is already an angle-dependent node; retain its glints and falloff.
  const bubbleOpacity = slime.bubbles.material.opacityNode;
  slime.bubbles.material.opacityNode = bubbleOpacity.mul(alpha);
  const surfaceMaterials = [slime.gel, rear.material];
  const skin = {
    id: appearance.skin === 'custom' ? 'custom-drawn-spirit' : 'softie-spirit',
    root,
    slime,
    surfaceMaterial: slime.gel,
    faceMotion: slime.faceMotion,
    pickMeshes: [slime.body],
    get size() { return size; },
    get metrics() {
      return {
        radius: BASE_METRICS.radius * size,
        depth: BASE_METRICS.depth * size,
        height: BASE_METRICS.height * size,
      };
    },
    applyAppearance({ color, opacity, size: nextSize, accessory } = {}) {
      if (disposed) return;
      if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
        slime.setColor(color);
        slime.gel.color.set(color);
      }
      if (Number.isFinite(nextSize)) {
        size = THREE.MathUtils.clamp(nextSize, 0.65, 1.35);
        root.scale.setScalar(size);
      }
      if (typeof accessory === 'string') slime.setAccessory(accessory === 'test-badge' ? 'badge' : 'none');
      if (Number.isFinite(opacity)) {
        alpha.value = THREE.MathUtils.clamp(opacity, 0.2, 1);
        for (const material of surfaceMaterials) {
          const transparent = alpha.value < 1;
          if (material.transparent !== transparent) material.needsUpdate = true;
          material.transparent = transparent;
          material.depthWrite = !transparent;
          material.opacity = alpha.value;
        }
        slime.face.material.opacity = alpha.value;
      }
    },
    update(time = 0) {
      if (disposed) return;
      slime.update(time);
      // SpiritInstance already translates the enclosing root in world space.
      root.position.set(0, 0, 0);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      slime.dispose();
      root.removeFromParent();
      root.clear();
    },
  };
  skin.applyAppearance(appearance);
  skin.update();
  return skin;
}
