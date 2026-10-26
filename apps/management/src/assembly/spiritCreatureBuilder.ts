// spiritCreatureBuilder.ts
// 灵体拼装系统 · 程序化建模层，专用于替换 ReferenceScene3D 里 deer / whale / blob
// 这三个原本用 ExtrudeGeometry 挤出的「扁平」图层。
//
// 不引入 simplex-noise 等新依赖：用几个不同频率的正弦波叠加模拟低频噪声，
// 对这么小的几何体（几十像素半径）视觉上已经够用。后续想要更自然的表面扰动，
// 换成 `npm i simplex-noise` 的 createNoise3D 替换 fakeNoise 即可，其余代码不用动。

import * as THREE from 'three';

function fakeNoise(x: number, y: number, z: number, seed: number): number {
  return (
    Math.sin(x * 2.1 + seed * 3.7) * 0.4 +
    Math.sin(y * 1.7 + seed * 1.3 + z * 0.9) * 0.35 +
    Math.sin(z * 2.6 + x * 0.6 + seed * 5.2) * 0.25
  );
}

export interface CoreParams {
  radius: number;
  stretch: [number, number, number]; // 三轴拉伸：核心体的大骨架全靠这个（圆球/鲸鱼纺锤/鹿身椭圆）
  roundness: number;                 // 顶点位移幅度，单位和 radius 一致（不是 0-1 比例），建议控制在 radius 的 10%~15%
  segments?: number;                 // 默认 28，卡面/加载页小图可以更低省性能
}

export interface AppendageParams {
  length: number;
  curve: number;        // 弯曲弧度，-1~1
  thickStart: number;   // 根部半径
  thickEnd: number;     // 末端半径
  spread?: number;      // 末端额外展开量：调大即从「细尾」变「扇形鲸尾」
  segments?: number;
}

export interface HornParams extends AppendageParams {
  branches: number;      // 分叉数
  branchAngle: number;   // 分叉张开角度（弧度）
}

/** 核心体：标准球面 + 三轴拉伸 + 低频噪声位移。time 传 0 即为静态基础形状，
 *  真正的「呼吸不规则」由外部每帧重设 core.scale 完成，不必每帧重新生成几何体（省性能）。 */
export function buildSpiritCore(p: CoreParams, seed: number): THREE.BufferGeometry {
  const seg = p.segments ?? 28;
  const geo = new THREE.SphereGeometry(p.radius, seg, seg);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const noise = fakeNoise(n.x * 1.4, n.y * 1.4, n.z * 1.4, seed);
    const displaced = v.clone().addScaledVector(n, noise * p.roundness);
    displaced.multiply(new THREE.Vector3(...p.stretch));
    pos.setXYZ(i, displaced.x, displaced.y, displaced.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildTube(p: AppendageParams): THREE.BufferGeometry {
  const start = new THREE.Vector3(0, 0, 0);
  const mid = new THREE.Vector3(p.curve * p.length * 0.15, p.length * 0.5, 0);
  const end = new THREE.Vector3(p.curve * p.length, p.length, 0);
  const curve = new THREE.CatmullRomCurve3([start, mid, end]);
  const geo = new THREE.TubeGeometry(curve, Math.max(4, p.segments ?? 10), p.thickStart, 8, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = Math.floor(i / 9) / geo.parameters.tubularSegments;
    const center = curve.getPointAt(t);
    const target = THREE.MathUtils.lerp(p.thickStart, p.thickEnd + (p.spread ?? 0), t);
    const scale = target / p.thickStart;
    v.sub(center).multiplyScalar(scale).add(center);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** 尾巴：spread 调大 + thickEnd 调大 → 从「细尾」变「扇形鲸尾」 */
export function buildTail(p: AppendageParams): THREE.BufferGeometry {
  return buildTube(p);
}

/** 鹿角：主干（60% 长度）+ branches 条分叉，从主干末端引出，张开 branchAngle */
export function buildHorn(p: HornParams, material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(buildTube({ ...p, length: p.length * 0.6 }), material);
  trunk.name = 'horn-trunk';
  group.add(trunk);
  for (let i = 0; i < p.branches; i++) {
    const branch = new THREE.Mesh(buildTube({ ...p, length: p.length * 0.45 }), material);
    branch.name = `horn-branch-${i}`;
    branch.position.set(p.curve * p.length * 0.55, p.length * 0.55, 0);
    branch.rotation.z = (i - (p.branches - 1) / 2) * p.branchAngle;
    group.add(branch);
  }
  return group;
}

/** 奶白半透明 + 菲涅尔边缘光材质。用 uBreath 把「呼吸」和边缘光强度联动起来，
 *  比固定边缘光更有「灵气感」。uOpacity 每帧由外部按 layerState 的 reveal 进度重设，
 *  这样开场淡入淡出的时序完全不用动，只是把生效对象换成了 shader uniform 而不是 material.opacity。 */
export function createSpiritMaterial(colorMain: THREE.Color, colorRim: THREE.Color, opacity: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uMain: { value: colorMain.clone() },
      uRim: { value: colorRim.clone() },
      uOpacity: { value: opacity },
      uBreath: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uMain; uniform vec3 uRim; uniform float uOpacity; uniform float uBreath;
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.2);
        float light = 0.72 + 0.28 * max(dot(normalize(vNormal), normalize(vec3(-0.5, 0.7, 1.0))), 0.0);
        vec3 color = mix(uMain * light, uRim, fresnel) * (1.0 + uBreath * fresnel * 0.12);
        float alpha = clamp(uOpacity * (0.78 + 0.22 * fresnel), 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** 待机呼吸/漂浮/摆动：用独立于开场时间轴（props.seconds）的真实时钟驱动，
 *  这样场景「定格」以后灵体依然有生命感，不受 EntryGate 里 playing.current=false 的影响。
 *  seed 不同，各灵体的相位错开，不会一起同步一起跳。 */
export function idleMotion(seed: number, tNow: number) {
  return {
    breath: Math.sin(tNow * 1.3 + seed * 2.1) * 0.5 + Math.sin(tNow * 0.47 + seed) * 0.5, // -1~1
    sway: Math.sin(tNow * 0.9 + seed * 3.7) * 0.08,     // 弧度：整体轻微左右摆动
    driftX: Math.sin(tNow * 0.7 + seed) * 3,             // 像素：细微水平漂移
    bob: Math.sin(tNow * 0.8 + seed * 1.3) * 5,          // 像素：轻微上下漂浮
    tailSway: Math.sin(tNow * 1.1 + seed * 4.4) * 0.3,   // 弧度：尾部摆动，幅度比整体大
    hornSway: Math.sin(tNow * 0.6 + seed * 2.8) * 0.05,  // 弧度：角部轻微摆动，幅度更小
  };
}

/** 按 1280×720 构图调校；offset 将原 SVG 的底部枢轴转换为实体中心。 */
export const CREATURE_PARAMS: Record<'deer' | 'whale' | 'blob', {
  radius: number; stretch: [number, number, number]; roundness: number; opacity: number; seed: number;
  offset: [number, number, number];
  tail?: AppendageParams & { attach: [number, number, number]; attachRotation?: number };
  horn?: HornParams & { attach: [number, number, number] };
}> = {
  deer: {
    radius: 43, stretch: [1, 1.65, 0.95], roundness: 3, opacity: 0.78, seed: 2, offset: [0, 83, 0],
    horn: { length: 58, curve: 0.26, thickStart: 5, thickEnd: 1.7, branches: 2, branchAngle: 0.9, attach: [23, 59, 2] },
  },
  whale: {
    radius: 47, stretch: [1.25, 0.73, 0.9], roundness: 3, opacity: 0.72, seed: 3, offset: [0, 10, 0],
    tail: { length: 54, curve: 0.24, thickStart: 12, thickEnd: 5, spread: 1, attach: [39, 12, -4], attachRotation: -0.16 },
  },
  blob: {
    radius: 31, stretch: [1.1, 0.82, 1], roundness: 2, opacity: 0.77, seed: 1, offset: [0, 23, 0],
  },
};
