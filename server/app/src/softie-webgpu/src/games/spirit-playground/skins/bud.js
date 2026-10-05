import * as THREE from 'three/webgpu';
import { SPIRIT_WORLD_SCALE } from '../settings.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FaceMotion } from '../../../face-motion.js';

const WIDTH = 1.05, DEPTH = 0.82, HEIGHT = 1.62, EYE_Y = 1.04;
const clamp = (value, fallback, min, max) => Number.isFinite(value) ? THREE.MathUtils.clamp(value, min, max) : fallback;
const radiusAt = y => {
  const t = THREE.MathUtils.clamp((y - 0.035) / HEIGHT, 0, 1), sy = t * 2 - 1;
  return Math.sqrt(Math.max(0, 1 - sy * sy)) ** 0.86 * (1 + 0.08 * Math.sin(t * Math.PI)) * (1 - 0.1 * sy);
};
const frontAt = (x, y) => {
  const radius = radiusAt(y);
  return DEPTH * Math.sqrt(Math.max(0, radius * radius - (x / WIDTH) ** 2));
};

function sculpt(geometry, map) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const point = map(position.getX(i), position.getY(i), position.getZ(i));
    position.setXYZ(i, point[0], point[1], point[2]);
  }
  geometry.deleteAttribute('uv'); geometry.deleteAttribute('normal');
  const result = mergeVertices(geometry, 1e-5);
  geometry.dispose(); result.computeVertexNormals();
  result.userData.rest = Float32Array.from(result.attributes.position.array);
  result.attributes.position.setUsage(THREE.DynamicDrawUsage);
  return result;
}

function merge(parts) {
  let start = 0;
  const ranges = parts.map(part => {
    const range = { start, count: part.attributes.position.count };
    start += range.count;
    return range;
  });
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  geometry.userData.rest = Float32Array.from(geometry.attributes.position.array);
  geometry.userData.ranges = ranges;
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 4);
  return geometry;
}

function bodyGeometry() {
  return sculpt(new THREE.SphereGeometry(1, 32, 20), (x, y, z) => {
    const radius = radiusAt(0.035 + HEIGHT * (y + 1) / 2);
    return [x * WIDTH * radius, 0.035 + HEIGHT * (y + 1) / 2, z * DEPTH * radius];
  });
}

function leafGeometry([bx, by, bz], [tx, ty, tz], width) {
  return sculpt(new THREE.SphereGeometry(1, 12, 8), (x, y, z) => {
    const t = (y + 1) / 2, taper = Math.sin(Math.PI * t) ** 0.72;
    return [bx + (tx - bx) * t + x * width * taper,
      by + (ty - by) * t + Math.abs(x) * 0.018,
      bz + (tz - bz) * t + z * 0.055 * taper];
  });
}

function eyeGeometry(side, highlight = false) {
  const x = side * (highlight ? 0.32 : 0.35), y = EYE_Y + (highlight ? 0.075 : 0);
  return sculpt(new THREE.SphereGeometry(1, 12, 8), (sx, sy, sz) => {
    const px = x + sx * (highlight ? 0.043 : 0.135);
    const py = y + sy * (highlight ? 0.055 : 0.205);
    return [px, py, frontAt(px, py) + (highlight ? 0.07 : 0.044) + sz * (highlight ? 0.012 : 0.018)];
  });
}

/** A round forest-bud spirit; all visible geometry follows the same soft-body field. */
export function makeBudSpiritSkin({ physics, appearance = {} }) {
  if (!physics || typeof physics.deform !== 'function') throw new TypeError('A spirit skin needs a physics deformation map.');
  let size = 1, eyeSize = 1, disposed = false;
  const root = new THREE.Group(); root.name = 'bud-spirit-skin';
  const faceMotion = new FaceMotion();
  const parts = [];
  const bodyMaterial = new THREE.MeshBasicNodeMaterial({ color: appearance.color ?? '#a5e0cd' });
  const leafMaterial = new THREE.MeshBasicNodeMaterial({ color: '#4a7a32' });
  const eyeMaterial = new THREE.MeshBasicNodeMaterial({ color: '#0d0d0d' });
  const highlightMaterial = new THREE.MeshBasicNodeMaterial({ color: '#f4f0d0' });
  const cheekMaterial = new THREE.MeshBasicNodeMaterial({ color: '#e8a13c' });
  const inkMaterial = new THREE.MeshBasicNodeMaterial({ color: '#2f3a26', side: THREE.BackSide });
  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.frustumCulled = false; root.add(mesh); parts.push(mesh); return mesh;
  };
  const outline = (geometry, name, scale) => {
    const mesh = add(geometry, inkMaterial, name); mesh.scale.setScalar(scale); mesh.renderOrder = -1; return mesh;
  };

  const body = bodyGeometry();
  outline(body, 'bud-ink-silhouette', 1.045);
  const bodyMesh = add(body, bodyMaterial, 'bud-soft-body');
  const leaves = merge([
    leafGeometry([-0.17, 1.48, 0.02], [-0.49, 2.03, 0.03], 0.17),
    leafGeometry([-0.02, 1.52, -0.035], [0.04, 2.31, -0.04], 0.17),
    leafGeometry([0.17, 1.48, 0.02], [0.48, 2.04, 0.03], 0.17),
  ]);
  outline(leaves, 'bud-ink-leaves', 1.09);
  const leafMesh = add(leaves, leafMaterial, 'bud-leaves');
  const eyes = merge([eyeGeometry(-1), eyeGeometry(1)]);
  const eyeMesh = add(eyes, eyeMaterial, 'bud-eyes');
  const highlights = merge([eyeGeometry(-1, true), eyeGeometry(1, true)]);
  const highlightMesh = add(highlights, highlightMaterial, 'bud-eye-glints');
  const cheeks = merge([-1, 1].map(side => sculpt(new THREE.SphereGeometry(1, 8, 6), (x, y, z) => {
    const px = side * 0.62 + x * 0.075, py = 0.87 + y * 0.035;
    return [px, py, frontAt(px, py) + 0.035 + z * 0.012];
  })));
  const cheekMesh = add(cheeks, cheekMaterial, 'bud-cheeks');
  const mouthPoints = [[-0.09, 0.82], [-0.045, 0.77], [0, 0.8], [0.045, 0.77], [0.09, 0.82]]
    .map(([x, y]) => new THREE.Vector3(x, y, frontAt(x, y) + 0.045));
  const mouth = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints), 12, 0.012, 5, false);
  mouth.deleteAttribute('uv'); mouth.userData.rest = Float32Array.from(mouth.attributes.position.array);
  mouth.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const mouthMesh = add(mouth, inkMaterial, 'bud-smile');
  const deformTarget = {};
  const deformation = (geometry, time, blink = 0) => {
    const rest = geometry.userData.rest, position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const n = i * 3;
      let x = rest[n], y = rest[n + 1], z = rest[n + 2];
      if (geometry === eyes || geometry === highlights) {
        const eye = i < geometry.userData.ranges[0].count ? -1 : 1;
        const centerX = eye * (geometry === eyes ? 0.35 : 0.32);
        const centerY = EYE_Y + (geometry === highlights ? 0.075 : 0);
        const open = geometry === highlights ? Math.max(0.12, 1 - blink) : Math.max(0.08, 1 - blink * 0.94);
        x = centerX + (x - centerX) * eyeSize + faceMotion.state.gazeX * 0.025;
        y = centerY + (y - centerY) * eyeSize * open;
        z = frontAt(x, y) + (geometry === highlights ? 0.07 : 0.044) + (rest[n + 2] - frontAt(rest[n], rest[n + 1]));
      }
      physics.deform(x, y, z, deformTarget);
      position.setXYZ(i, deformTarget.x, Math.max(deformTarget.y, (0.012 - physics.position.y) / (SPIRIT_WORLD_SCALE * size)), deformTarget.z);
    }
    position.needsUpdate = true; geometry.computeVertexNormals();
  };
  const allMaterials = [bodyMaterial, leafMaterial, eyeMaterial, highlightMaterial, cheekMaterial];
  const skin = {
    id: 'bud-spirit', root, body: bodyMesh, leaves: leafMesh, eyes: eyeMesh, highlights: highlightMesh,
    cheeks: cheekMesh, mouth: mouthMesh, parts, outlines: [root.getObjectByName('bud-ink-silhouette'), root.getObjectByName('bud-ink-leaves')],
    faceMotion, pickMeshes: [bodyMesh],
    get size() { return size; },
    get metrics() { return { radius: 1.25 * size, depth: 0.9 * size, height: 2.31 * size }; },
    applyAppearance(patch = {}) {
      if (disposed) return;
      if (typeof patch.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.color)) bodyMaterial.color.set(patch.color);
      if (Number.isFinite(patch.size)) { size = clamp(patch.size, size, 0.65, 1.35); root.scale.setScalar(size); }
      if (Number.isFinite(patch.eyeSize)) eyeSize = clamp(patch.eyeSize, eyeSize, 0.8, 1.2);
      if (Number.isFinite(patch.opacity)) {
        const opacity = THREE.MathUtils.clamp(patch.opacity, 0.35, 1);
        for (const material of [...allMaterials, inkMaterial]) {
          material.opacity = opacity; material.transparent = opacity < 1;
          material.depthWrite = opacity === 1; material.needsUpdate = true;
        }
      }
    },
    update(time = 0) {
      if (disposed) return;
      const expression = faceMotion.update(time), blink = Math.max(expression.blink, expression.sleepy * 0.92, expression.squish * 0.7);
      for (const geometry of [body, leaves, eyes, highlights, cheeks, mouth]) deformation(geometry, time, blink);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set(parts.map(part => part.geometry));
      for (const geometry of geometries) geometry.dispose();
      for (const material of [...allMaterials, inkMaterial]) material.dispose();
      root.removeFromParent(); root.clear();
    },
  };
  skin.applyAppearance(appearance); skin.update();
  return skin;
}
