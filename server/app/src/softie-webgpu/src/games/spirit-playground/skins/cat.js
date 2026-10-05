import * as THREE from 'three/webgpu';
import { SPIRIT_WORLD_SCALE } from '../settings.js';
import { color, mix, normalView, normalWorld, positionViewDirection, uniform, vec3 } from 'three/tsl';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FaceMotion } from '../../../face-motion.js';

const WIDTH = 1.2, HEIGHT = 2.05, DEPTH = 0.94, EYE_Y = 1.22;
const clamp = (value, fallback, min, max) => Number.isFinite(value) ? THREE.MathUtils.clamp(value, min, max) : fallback;

function radiusAt(y) {
  const t = Math.pow(THREE.MathUtils.clamp((y - 0.035) / HEIGHT, 0, 1), 1 / 1.28);
  const c = t * 2 - 1;
  return Math.pow(Math.sqrt(Math.max(0, 1 - c * c)), 0.82) * (1 - 0.07 * c);
}
const frontAt = (x, y) => DEPTH * Math.sqrt(Math.max(0, radiusAt(y) ** 2 - (x / WIDTH) ** 2));

function sculpt(geometry, map) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const point = map(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, point[0], point[1], point[2]);
  }
  geometry.deleteAttribute('uv'); geometry.deleteAttribute('normal');
  const welded = mergeVertices(geometry, 1e-5);
  geometry.dispose(); welded.computeVertexNormals();
  return welded;
}

function combine(parts) {
  let offset = 0;
  const ranges = parts.map(geometry => {
    const range = { start: offset, count: geometry.attributes.position.count };
    offset += range.count;
    return range;
  });
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  geometry.userData.rest = Float32Array.from(geometry.attributes.position.array);
  geometry.userData.original = Float32Array.from(geometry.userData.rest);
  geometry.userData.posed = Float32Array.from(geometry.userData.rest);
  geometry.userData.ranges = ranges;
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.3, 0), 6);
  return geometry;
}

function ear(side, inner = false) {
  return sculpt(new THREE.SphereGeometry(1, 12, 8), (x, y, z) => {
    const t = (y + 1) / 2;
    // Wide rounded shoulders taper into a soft triangular tip, with a little outward lean.
    const taper = Math.pow(Math.max(0, 1 - t), 0.48);
    const w = inner ? 0.235 : 0.39, h = inner ? 0.56 : 0.95;
    return [side * (0.79 + t * 0.16) + x * w * taper,
      (inner ? 2.11 : 1.88) + t * h,
      (inner ? 0.19 : -0.015) + z * (inner ? 0.035 : 0.24) * taper];
  });
}

function eye(side, pupil = false) {
  return sculpt(new THREE.SphereGeometry(1, 12, 8), (x, y, z) => {
    const px = side * 0.42 + x * (pupil ? 0.15 : 0.31);
    const py = EYE_Y + y * (pupil ? 0.265 : 0.425);
    return [px, py, frontAt(px, py) + (pupil ? 0.083 : 0.044) + z * (pupil ? 0.012 : 0.027)];
  });
}

function toonMaterial(hex) {
  const material = new THREE.MeshBasicNodeMaterial({ color: hex });
  const tint = uniform(material.color);
  const light = normalWorld.dot(vec3(-0.45, 0.85, 0.5).normalize()).smoothstep(0.1, 0.18);
  const shade = mix(tint.mul(0.73), tint.add(color('#758863').mul(0.018)), light);
  const rim = normalView.dot(positionViewDirection).abs().smoothstep(0.04, 0.16).oneMinus();
  material.colorNode = mix(shade, color('#14251c'), rim);
  return material;
}

/** A sculpted spirit: softie proportions and deformation, with a flat animated cat silhouette. */
export function makeCatSpiritSkin({ physics, appearance = {} }) {
  if (!physics || typeof physics.deform !== 'function') throw new TypeError('A spirit skin needs a physics deformation map.');
  const root = new THREE.Group(); root.name = 'cat-spirit-skin';
  const faceMotion = new FaceMotion();
  let size = 1, earSize = 1, tailLength = 1, eyeSize = 1, disposed = false;
  const bodyShape = sculpt(new THREE.SphereGeometry(1, 36, 22), (x, y, z) => {
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const radius = Math.pow(radial, 0.82) * (1 - 0.07 * y);
    const spread = radial > 1e-5 ? radius / radial : 0;
    return [x * WIDTH * spread, 0.035 + HEIGHT * Math.pow((y + 1) / 2, 1.28), z * DEPTH * spread];
  });
  const paw = side => sculpt(new THREE.SphereGeometry(1, 12, 8), (x, y, z) =>
    [side * 0.52 + x * 0.285, 0.155 + y * 0.14, 0.55 + z * 0.34]);
  const tailPoints = [[0.68, 0.42, -0.65], [1.00, 0.55, -1.05], [1.55, 0.74, -1.30],
    [1.82, 1.00, -0.95], [1.67, 1.25, -0.68]].map(point => new THREE.Vector3(...point));
  const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPoints), 24, 0.105, 6, false);
  tail.deleteAttribute('uv');
  const bodyGeometry = combine([bodyShape, ear(-1), ear(1), paw(-1), paw(1), tail]);
  const earGeometry = combine([ear(-1, true), ear(1, true)]);
  delete bodyGeometry.userData.posed; delete earGeometry.userData.posed;
  const mouthPoints = [[-0.14, 0.87], [-0.08, 0.80], [0, 0.86], [0.08, 0.80], [0.14, 0.87]]
    .map(([x, y]) => new THREE.Vector3(x, y, frontAt(x, y) + 0.055));
  const mouth = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints), 16, 0.013, 5, false);
  mouth.deleteAttribute('uv');
  const nose = sculpt(new THREE.SphereGeometry(1, 8, 6), (x, y, z) => {
    const px = x * 0.043, py = 0.98 + y * 0.027;
    return [px, py, frontAt(px, py) + 0.047 + z * 0.015];
  });
  const eyeGeometry = combine([eye(-1), eye(1), mouth, nose]);
  const pupilGeometry = combine([eye(-1, true), eye(1, true)]);
  const bodyMaterial = toonMaterial('#202b25');
  const earMaterial = toonMaterial('#83966c');
  const eyeMaterial = new THREE.MeshBasicNodeMaterial({ color: '#f4f0d0' });
  const pupilMaterial = new THREE.MeshBasicNodeMaterial({ color: '#13241b' });
  const outlineMaterial = new THREE.MeshBasicNodeMaterial({ color: '#2f3a26', side: THREE.BackSide });
  const mesh = (geometry, material, name) => {
    const part = new THREE.Mesh(geometry, material); part.name = name;
    part.frustumCulled = false; root.add(part); return part;
  };
  const outline = (geometry, name, scale) => {
    const line = mesh(geometry, outlineMaterial, name);
    line.scale.setScalar(scale); line.renderOrder = -1;
    return line;
  };
  const outlines = [
    outline(bodyGeometry, 'spirit-ink-silhouette', 1.045),
    outline(earGeometry, 'spirit-ink-inner-ears', 1.08),
    outline(eyeGeometry, 'spirit-ink-expression', 1.08),
  ];
  const body = mesh(bodyGeometry, bodyMaterial, 'soft-cat-body');
  const ears = mesh(earGeometry, earMaterial, 'soft-cat-inner-ears');
  const eyes = mesh(eyeGeometry, eyeMaterial, 'soft-cat-eyes-and-smile');
  const pupils = mesh(pupilGeometry, pupilMaterial, 'soft-cat-pupils');
  const parts = [body, ears, eyes, pupils];
  const point = {};

  function authorShape() {
    for (const geometry of [bodyGeometry, earGeometry]) {
      const rest = geometry.userData.rest, original = geometry.userData.original;
      rest.set(original);
      const earRanges = geometry === bodyGeometry ? geometry.userData.ranges.slice(1, 3) : geometry.userData.ranges;
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1, range = earRanges[sideIndex];
        for (let i = range.start; i < range.start + range.count; i++) {
          const n = i * 3;
          rest[n] = side * 0.79 + (original[n] - side * 0.79) * earSize;
          rest[n + 1] = 1.88 + (original[n + 1] - 1.88) * earSize;
          rest[n + 2] = original[n + 2] * earSize;
        }
      }
      if (geometry === bodyGeometry) {
        const range = geometry.userData.ranges[5];
        for (let i = range.start; i < range.start + range.count; i++) {
          const n = i * 3;
          rest[n] = 0.68 + (original[n] - 0.68) * tailLength;
          rest[n + 1] = 0.42 + (original[n + 1] - 0.42) * tailLength;
          rest[n + 2] = -0.65 + (original[n + 2] + 0.65) * tailLength;
        }
      }
    }
  }

  function poseEyes(geometry, expression, isPupil) {
    const original = geometry.userData.original, posed = geometry.userData.posed;
    posed.set(geometry.userData.rest);
    for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
      const side = sideIndex === 0 ? -1 : 1, cx = side * 0.42, range = geometry.userData.ranges[sideIndex];
      const closed = Math.max(expression.blink, expression.sleepy * 0.95, expression.squish * 0.8,
        expression.happy * 0.60, sideIndex === 0 ? expression.wink * 0.95 : 0);
      const eyeHeight = Math.max(0.045, 1 - closed) * (1 + expression.surprised * 0.13 + expression.startle * 0.2);
      for (let i = range.start; i < range.start + range.count; i++) {
        const n = i * 3;
        const dx = (original[n] - cx) * eyeSize;
        const dy = (original[n + 1] - EYE_Y) * eyeSize;
        const x = cx + dx + (isPupil ? expression.gazeX * 0.075 : 0);
        const y = EYE_Y + dy * eyeHeight - side * dx * expression.angry * 0.28
          + closed * 0.015 * (1 - (dx / 0.38) ** 2) + (isPupil ? expression.gazeY * 0.055 * eyeHeight : 0);
        // Reproject posed eyes onto the authored body before sharing its deformation.
        const depth = original[n + 2] - frontAt(original[n], original[n + 1]);
        posed[n] = x; posed[n + 1] = y; posed[n + 2] = frontAt(x, y) + depth;
      }
    }
  }

  const skin = {
    id: 'cat-spirit', root, body, ears, eyes, pupils, parts, outlines, faceMotion,
    pickMeshes: [body],
    get size() { return size; },
    // Network collisions use the body radius; the curled tail is a visual appendage.
    get metrics() { return { radius: WIDTH * size, depth: 2.25 * size, height: (1.88 + 0.95 * earSize) * size }; },
    applyAppearance(patch = {}) {
      if (disposed) return;
      if (typeof patch.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.color)) {
        bodyMaterial.color.set(patch.color);
        earMaterial.color.copy(bodyMaterial.color).lerp(new THREE.Color('#a5b38a'), 0.65);
      }
      size = clamp(patch.size, size, 0.65, 1.35); root.scale.setScalar(size);
      const nextEars = clamp(patch.earSize, earSize, 0.7, 1.3), nextTail = clamp(patch.tailLength, tailLength, 0.5, 1.5);
      eyeSize = clamp(patch.eyeSize, eyeSize, 0.8, 1.2);
      if (earSize !== nextEars || tailLength !== nextTail) {
        earSize = nextEars; tailLength = nextTail; authorShape();
      }
      if (Number.isFinite(patch.opacity)) {
        const opacity = THREE.MathUtils.clamp(patch.opacity, 0.35, 1);
        for (const part of parts) {
          const material = part.material;
          if (material.transparent !== (opacity < 1)) material.needsUpdate = true;
          material.opacity = opacity; material.transparent = opacity < 1; material.depthWrite = opacity === 1;
        }
        if (outlineMaterial.transparent !== (opacity < 1)) outlineMaterial.needsUpdate = true;
        outlineMaterial.opacity = opacity; outlineMaterial.transparent = opacity < 1; outlineMaterial.depthWrite = opacity === 1;
      }
    },
    update(time = 0) {
      if (disposed) return;
      const expression = faceMotion.update(time);
      poseEyes(eyeGeometry, expression, false); poseEyes(pupilGeometry, expression, true);
      for (const part of parts) {
        const geometry = part.geometry, rest = geometry === eyeGeometry || geometry === pupilGeometry
          ? geometry.userData.posed : geometry.userData.rest;
        const p = geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const n = i * 3; physics.deform(rest[n], rest[n + 1], rest[n + 2], point);
          p.setXYZ(i, point.x, Math.max(point.y, (0.012 - physics.position.y) / (SPIRIT_WORLD_SCALE * size)), point.z);
        }
        p.needsUpdate = true; geometry.computeVertexNormals();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const part of parts) { part.geometry.dispose(); part.material.dispose(); }
      outlineMaterial.dispose();
      root.removeFromParent(); root.clear();
    },
  };
  skin.applyAppearance(appearance); skin.update();
  return skin;
}
