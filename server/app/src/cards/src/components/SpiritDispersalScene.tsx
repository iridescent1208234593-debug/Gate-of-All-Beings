import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const spiritVertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uTime;
  uniform float uPixelRatio;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPosition.z);
    gl_PointSize = max(gl_PointSize, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const spiritFragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    float softEdge = smoothstep(0.5, 0.08, dist);
    float halo = smoothstep(0.5, 0.0, dist) * 0.18;
    float glow = softEdge * 0.45 + halo;
    gl_FragColor = vec4(vColor * glow, vAlpha * glow);
  }
`;

const coreVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const coreFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float rim = pow(1.0 - abs(dot(viewDir, vNormal)), 1.8);
    float breathe = 0.92 + 0.08 * sin(uTime * 0.4);
    float drift = sin(vUv.x * 3.5 + uTime * 0.18) * sin(vUv.y * 3.0 - uTime * 0.14) * 0.06;
    vec3 color = mix(uColor2, uColor1, rim * 0.55 + drift);
    float alpha = (0.35 + rim * 0.3 + drift) * uIntensity * breathe;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
  }
`;

const SPIRIT_COUNT = 800;
const MATERIAL_COUNT = 400;
const AMBIENT_COUNT = 200;

const COLORS = {
  spirit: new THREE.Color(0xfdfae4),
  plantSpirit: new THREE.Color(0x879f4c),
  animalSpirit: new THREE.Color(0xb2c379),
  materialSpirit: new THREE.Color(0xf5e8b8),
};

interface DispersalParticle {
  bodyPos: THREE.Vector3;
  disperseDir: THREE.Vector3;
  disperseSpeed: number;
  driftAngle: number;
  driftPhase: number;
  driftSpeed: number;
  baseSize: number;
  delay: number;
  color: THREE.Color;
}

export type DispersalPhase = 'complete' | 'fading' | 'seeding' | 'dissolving' | 'ascending' | 'returning';

export interface DispersalPhaseConfig {
  name: DispersalPhase;
  label: string;
  startTime: number;
  endTime: number;
  description: string;
}

export const DISPERSAL_PHASES: DispersalPhaseConfig[] = [
  { name: 'complete', label: '\u5b8c\u6574\u5f62\u6001', startTime: 0.0, endTime: 0.15,
    description: '\u5996\u7cbe\u5b89\u9759\u4f2b\u7acb\uff0c\u7075\u8d28\u7a7a\u95f4\u5f00\u59cb\u8870\u7aed\uff0c\u5149\u8292\u5fae\u5fae\u6697\u6de1' },
  { name: 'fading', label: '\u6e10\u901d', startTime: 0.15, endTime: 0.35,
    description: '\u8eab\u4f53\u5f00\u59cb\u53d8\u5f97\u534a\u900f\u660e\uff0c\u8fb9\u7f18\u51fa\u73b0\u5149\u7c92\u5b50\u5265\u79bb\u6548\u679c\uff0c\u8f6e\u5ed3\u5982\u6c34\u4e2d\u58a8\u8ff9\u822c\u4e0d\u7a33\u5b9a' },
  { name: 'seeding', label: '\u98d8\u7075', startTime: 0.35, endTime: 0.55,
    description: '\u751f\u7075\u5982\u84b2\u516c\u82f1\u79cd\u5b50\u822c\u4ece\u8eab\u4f53\u5404\u5904\u7f13\u7f13\u98d8\u51fa\uff0c\u5728\u5fae\u98ce\u4e2d\u65cb\u8f6c\u98d8\u6563' },
  { name: 'dissolving', label: '\u6d88\u878d', startTime: 0.55, endTime: 0.75,
    description: '\u8eab\u4f53\u8d8a\u6765\u8d8a\u900f\u660e\uff0c\u5149\u7c92\u5b50\u98d8\u6563\u901f\u5ea6\u52a0\u5feb\uff0c\u8f6e\u5ed3\u9010\u6e10\u65e0\u6cd5\u8fa8\u8ba4' },
  { name: 'ascending', label: '\u5347\u5929', startTime: 0.75, endTime: 0.90,
    description: '\u6b8b\u4f59\u5316\u4e3a\u6f2b\u5929\u5149\u70b9\u98d8\u5411\u5929\u7a7a\uff0c\u878d\u5165\u5929\u5730\u4e4b\u95f4\uff0c\u6700\u540e\u4e00\u7f15\u5149\u8292\u5347\u817e\u800c\u53bb' },
  { name: 'returning', label: '\u56de\u5f52', startTime: 0.90, endTime: 1.0,
    description: '\u5149\u70b9\u7f13\u7f13\u6c89\u964d\u5230\u5927\u5730\uff0c\u751f\u7075\u56de\u5f52\u81ea\u7136\u5faa\u73af\uff0c\u4e07\u7269\u5f52\u4e8e\u5b81\u9759' },
];

interface Props {
  progress: number;
  isPlaying: boolean;
  onPhaseChange?: (phase: DispersalPhase) => void;
}

export const SpiritDispersalScene: React.FC<Props> = ({ progress, isPlaying, onPhaseChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<DispersalParticle[]>([]);
  const prevPhaseRef = useRef<DispersalPhase>('complete');
  const spiritPointsRef = useRef<THREE.Points | null>(null);
  const materialPointsRef = useRef<THREE.Points | null>(null);
  const ambientPointsRef = useRef<THREE.Points | null>(null);
  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const coreGlowRef = useRef<THREE.Mesh | null>(null);
  const spiritLightRef = useRef<THREE.PointLight | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const creatureRef = useRef<THREE.Group | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const getCurrentPhase = useCallback((p: number): DispersalPhase => {
    for (const phase of DISPERSAL_PHASES) {
      if (p >= phase.startTime && p < phase.endTime) return phase.name;
    }
    return 'returning';
  }, []);

  useEffect(() => {
    const phase = getCurrentPhase(progress);
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      onPhaseChange?.(phase);
    }
  }, [progress, getCurrentPhase, onPhaseChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020402);
    scene.fog = new THREE.FogExp2(0x020402, 0.018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 3, 0);
    cameraRef.current = camera;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.6, 0.7);
    composer.addPass(bloomPass);
    const vignetteShader = {
      uniforms: { tDiffuse: { value: null }, darkness: { value: 0.7 }, offset: { value: 1.1 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float darkness; uniform float offset; varying vec2 vUv; void main() { vec4 texel = texture2D(tDiffuse, vUv); vec2 uv = (vUv - vec2(0.5)) * vec2(offset); float vign = clamp(1.0 - dot(uv, uv), 0.0, 1.0); texel.rgb *= mix(1.0 - darkness, 1.0, vign); gl_FragColor = texel; }`,
    };
    composer.addPass(new ShaderPass(vignetteShader));
    composerRef.current = composer;
    bloomPassRef.current = bloomPass;

    scene.add(new THREE.AmbientLight(0x1a2820, 0.35));
    const moonLight = new THREE.DirectionalLight(0x6688aa, 0.3);
    moonLight.position.set(10, 30, 15);
    scene.add(moonLight);

    // Moon
    const moonGeo = new THREE.CircleGeometry(3.5, 48);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfdfae4, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(12, 28, -35);
    moon.lookAt(0, 4, 0);
    scene.add(moon);
    const haloGeo = new THREE.CircleGeometry(6.0, 48);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.05, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(moon.position);
    halo.lookAt(0, 4, 0);
    scene.add(halo);

    const spiritLight = new THREE.PointLight(0x8a9a5a, 3, 25);
    spiritLight.position.set(0, 3, 0);
    scene.add(spiritLight);
    spiritLightRef.current = spiritLight;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a120a, roughness: 0.95, metalness: 0.05 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Trees
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.95 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0a1a0a, roughness: 0.95, transparent: true, opacity: 0.8 });
    const trees: [number, number, number, number][] = [
      [-9,-5,16,0.35],[-8,4,14,0.3],[-10,-1,15,0.32],
      [9,-4,15,0.33],[8,5,13,0.28],[10,1,16,0.35],
      [-5,-9,14,0.3],[5,-8,15,0.32],[0,-11,18,0.38],
      [-7,7,12,0.25],[7,8,13,0.28],[-11,-7,14,0.3],
    ];
    for (const [tx, tz, th, tr] of trees) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(tr*0.7, tr, th, 8), treeMat);
      trunk.position.set(tx, th/2, tz);
      scene.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(tr*4.5+1.5, 8, 6), canopyMat);
      canopy.position.set(tx, th*0.75, tz);
      canopy.scale.y = 0.65;
      scene.add(canopy);
    }

    // Rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.98 });
    const rocks: [number, number, number][] = [[-3,-2,0.5],[4,-3,0.6],[-5,3,0.4],[6,2,0.55]];
    for (const [rx, rz, rs] of rocks) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 1), rockMat);
      rock.position.set(rx, rs*0.5, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      scene.add(rock);
    }

    // Ground mist
    const mistMat = new THREE.MeshBasicMaterial({ color: 0x2a3a2a, transparent: true, opacity: 0.04, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mistMat.clone());
      mist.rotation.x = -Math.PI / 2;
      mist.position.y = 0.1 + i * 0.3;
      (mist.material as THREE.MeshBasicMaterial).opacity = 0.04 - i * 0.01;
      scene.add(mist);
    }

    // Creature body
    const creatureGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xfdfae4, roughness: 0.6, metalness: 0.1,
      transparent: true, opacity: 0.9,
      emissive: 0xfdfae4, emissiveIntensity: 0.15,
    });

    const bodyGeo = new THREE.SphereGeometry(1.2, 24, 18);
    bodyGeo.scale(1.0, 0.85, 1.1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2.2;
    creatureGroup.add(body);

    const headMat = bodyMat.clone();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), headMat);
    head.position.set(0, 3.3, 0.3);
    creatureGroup.add(head);

    const earMat = bodyMat.clone();
    const earGeo = new THREE.ConeGeometry(0.2, 0.5, 8);
    const earL = new THREE.Mesh(earGeo, earMat);
    earL.position.set(-0.35, 3.85, 0.2);
    earL.rotation.z = 0.3;
    creatureGroup.add(earL);
    const earR = new THREE.Mesh(earGeo, earMat);
    earR.position.set(0.35, 3.85, 0.2);
    earR.rotation.z = -0.3;
    creatureGroup.add(earR);

    const tailMat = bodyMat.clone();
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 1.5, 8), tailMat);
    tail.position.set(0, 1.8, -1.2);
    tail.rotation.x = -0.6;
    creatureGroup.add(tail);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.22, 3.4, 0.85);
    creatureGroup.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.22, 3.4, 0.85);
    creatureGroup.add(eyeR);

    scene.add(creatureGroup);
    creatureRef.current = creatureGroup;

    // Core glow
    const coreGeo = new THREE.SphereGeometry(2.0, 24, 18);
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: coreVertexShader, fragmentShader: coreFragmentShader,
      uniforms: {
        uTime: { value: 0 }, uIntensity: { value: 0.5 },
        uColor1: { value: new THREE.Color(0xfdfae4) },
        uColor2: { value: new THREE.Color(0x879f4c) },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 2.8, 0);
    scene.add(coreMesh);
    coreMeshRef.current = coreMesh;

    const glowGeo = new THREE.SphereGeometry(2.8, 24, 18);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfdfae4, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    glowSphere.position.set(0, 2.8, 0);
    scene.add(glowSphere);
    coreGlowRef.current = glowSphere;

    // Initialize particles
    const allParticles: DispersalParticle[] = [];

    for (let i = 0; i < SPIRIT_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 0.8 + Math.random() * 1.2;
      const bodyPos = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r,
        2.8 + Math.sin(phi) * Math.sin(theta) * r * 0.8,
        Math.cos(phi) * r
      );
      const disperseDir = new THREE.Vector3(
        (Math.random()-0.5)*2, 0.5+Math.random()*1.5, (Math.random()-0.5)*2
      ).normalize();

      const cc = Math.random();
      let color: THREE.Color;
      if (cc < 0.4) color = COLORS.spirit.clone();
      else if (cc < 0.65) color = COLORS.plantSpirit.clone();
      else if (cc < 0.85) color = COLORS.animalSpirit.clone();
      else color = COLORS.materialSpirit.clone();

      allParticles.push({
        bodyPos, disperseDir, disperseSpeed: 0.3+Math.random()*0.8,
        driftAngle: Math.random()*Math.PI*2, driftPhase: Math.random()*Math.PI*2,
        driftSpeed: 0.2+Math.random()*0.5, baseSize: 2.0+Math.random()*3.0,
        delay: Math.random()*0.7, color,
      });
    }

    for (let i = 0; i < MATERIAL_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 0.3 + Math.random() * 0.8;
      const bodyPos = new THREE.Vector3(
        Math.sin(phi)*Math.cos(theta)*r,
        2.8+Math.sin(phi)*Math.sin(theta)*r*0.6,
        Math.cos(phi)*r
      );
      const disperseDir = new THREE.Vector3(
        (Math.random()-0.5)*2, 0.8+Math.random()*2.0, (Math.random()-0.5)*2
      ).normalize();
      allParticles.push({
        bodyPos, disperseDir, disperseSpeed: 0.2+Math.random()*0.6,
        driftAngle: Math.random()*Math.PI*2, driftPhase: Math.random()*Math.PI*2,
        driftSpeed: 0.15+Math.random()*0.4, baseSize: 1.5+Math.random()*2.5,
        delay: 0.2+Math.random()*0.6, color: COLORS.materialSpirit.clone(),
      });
    }

    for (let i = 0; i < AMBIENT_COUNT; i++) {
      const bodyPos = new THREE.Vector3(
        (Math.random()-0.5)*20, 0.5+Math.random()*8, (Math.random()-0.5)*20
      );
      allParticles.push({
        bodyPos, disperseDir: new THREE.Vector3(0,1,0), disperseSpeed: 0.1,
        driftAngle: Math.random()*Math.PI*2, driftPhase: Math.random()*Math.PI*2,
        driftSpeed: 0.1+Math.random()*0.3, baseSize: 1.0+Math.random()*2.0,
        delay: 0, color: COLORS.plantSpirit.clone().multiplyScalar(0.6),
      });
    }

    particlesRef.current = allParticles;

    const createPoints = (count: number, offset: number) => {
      const positions = new Float32Array(count * 3);
      const alphas = new Float32Array(count);
      const sizes = new Float32Array(count);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const pp = allParticles[offset + i];
        positions[i*3] = pp.bodyPos.x;
        positions[i*3+1] = pp.bodyPos.y;
        positions[i*3+2] = pp.bodyPos.z;
        alphas[i] = 0;
        sizes[i] = pp.baseSize;
        colors[i*3] = pp.color.r;
        colors[i*3+1] = pp.color.g;
        colors[i*3+2] = pp.color.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.ShaderMaterial({
        vertexShader: spiritVertexShader, fragmentShader: spiritFragmentShader,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      return points;
    };

    spiritPointsRef.current = createPoints(SPIRIT_COUNT, 0);
    materialPointsRef.current = createPoints(MATERIAL_COUNT, SPIRIT_COUNT);
    ambientPointsRef.current = createPoints(AMBIENT_COUNT, SPIRIT_COUNT + MATERIAL_COUNT);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composerRef.current?.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const scene = sceneRef.current, camera = cameraRef.current, renderer = rendererRef.current;
      if (!scene || !camera || !renderer) return;
      const time = performance.now() / 1000;
      const p = Math.max(0, Math.min(1, progressRef.current));
      const phase = getCurrentPhase(p);
      const pd = particlesRef.current;

      // Camera
      let camAngle: number, camDist: number, camY: number;
      if (phase === 'complete') {
        camAngle = Math.sin(time * 0.06) * 0.3;
        camDist = 12;
        camY = 4 + Math.sin(time * 0.1) * 0.3;
        camera.position.set(Math.sin(camAngle)*camDist, camY, Math.cos(camAngle)*camDist);
        camera.lookAt(0, 2.8, 0);
      } else if (phase === 'fading' || phase === 'seeding') {
        camAngle = time * 0.08;
        camDist = 11 - (p - 0.15) * 3;
        camY = 3.5 + Math.sin(time * 0.12) * 0.4;
        camera.position.set(Math.sin(camAngle)*camDist, camY, Math.cos(camAngle)*camDist);
        camera.lookAt(0, 2.8, 0);
      } else if (phase === 'dissolving') {
        camAngle = time * 0.1;
        camDist = 8;
        camY = 3.5 + (p - 0.55) / 0.20 * 1.5;
        camera.position.set(Math.sin(camAngle)*camDist, camY, Math.cos(camAngle)*camDist);
        camera.lookAt(0, 3 + (p-0.55)/0.20*1.0, 0);
      } else if (phase === 'ascending') {
        camAngle = time * 0.05;
        const ap = (p - 0.75) / 0.15;
        camDist = 8 + ap * 3;
        camY = 5 + ap * 4;
        camera.position.set(Math.sin(camAngle)*camDist, camY, Math.cos(camAngle)*camDist);
        camera.lookAt(0, 4 + ap * 6, 0);
      } else {
        const rp = (p - 0.90) / 0.10;
        camAngle = time * 0.04;
        camDist = 11;
        camY = 9 - rp * 5;
        camera.position.set(Math.sin(camAngle)*camDist, camY, Math.cos(camAngle)*camDist);
        camera.lookAt(0, 10 - rp * 8, 0);
      }

      // Update particles
      const updateDispersal = (points: THREE.Points | null, count: number, offset: number, isAmbient: boolean) => {
        if (!points) return;
        const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
        const alphaAttr = points.geometry.attributes.aAlpha as THREE.BufferAttribute;
        const sizeAttr = points.geometry.attributes.aSize as THREE.BufferAttribute;
        const mat = points.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = time;

        for (let i = 0; i < count; i++) {
          const d = pd[offset + i];
          let x = 0, y = 0, z = 0, alpha = 0, size = d.baseSize;

          if (isAmbient) {
            x = d.bodyPos.x + Math.sin(time*d.driftSpeed*0.4 + d.driftPhase)*2;
            y = d.bodyPos.y + Math.sin(time*d.driftSpeed*0.25 + d.driftPhase)*1;
            z = d.bodyPos.z + Math.cos(time*d.driftSpeed*0.3 + d.driftPhase)*2;
            alpha = 0.06 + Math.sin(time*0.3 + d.driftPhase)*0.03;
            if (phase === 'returning') alpha += 0.04;
            size = d.baseSize * 0.6;
          } else if (phase === 'complete') {
            x = d.bodyPos.x + Math.sin(time*d.driftSpeed*0.3 + d.driftPhase)*0.15;
            y = d.bodyPos.y + Math.sin(time*d.driftSpeed*0.2 + d.driftPhase)*0.1;
            z = d.bodyPos.z + Math.cos(time*d.driftSpeed*0.25 + d.driftPhase)*0.15;
            alpha = 0.35 + Math.sin(time*0.5 + d.driftPhase)*0.1;
            size = d.baseSize * 0.7;
          } else if (phase === 'fading') {
            const fp = (p - 0.15) / 0.20;
            const stagger = d.delay;
            const earlyDisperse = Math.max(0, (fp - stagger) / (1 - stagger));
            if (earlyDisperse > 0 && stagger < 0.3) {
              const dist = earlyDisperse * d.disperseSpeed * 2;
              x = d.bodyPos.x + d.disperseDir.x * dist;
              y = d.bodyPos.y + d.disperseDir.y * dist + Math.sin(time*0.5+d.driftPhase)*0.2;
              z = d.bodyPos.z + d.disperseDir.z * dist;
              alpha = 0.35 * (1 - earlyDisperse * 0.5);
            } else {
              x = d.bodyPos.x + Math.sin(time*(0.5+fp)+d.driftPhase)*(0.15+fp*0.3);
              y = d.bodyPos.y + Math.sin(time*0.3+d.driftPhase)*0.15;
              z = d.bodyPos.z + Math.cos(time*0.4+d.driftPhase)*(0.15+fp*0.3);
              alpha = (0.35 - fp*0.12) + Math.sin(time*2+d.driftPhase)*fp*0.15;
            }
            size = d.baseSize * (0.7 + fp * 0.15);
          } else if (phase === 'seeding') {
            const sp = (p - 0.35) / 0.20;
            const stagger = d.delay;
            const lp = Math.max(0, Math.min(1, (sp - stagger*0.5) / (1 - stagger*0.5)));
            const eased = lp * lp * (3 - 2 * lp);
            const dist = eased * d.disperseSpeed * 6;
            const driftX = Math.sin(time*d.driftSpeed + d.driftAngle) * eased * 1.5;
            const driftZ = Math.cos(time*d.driftSpeed*0.8 + d.driftAngle) * eased * 1.5;
            const driftY = Math.sin(time*d.driftSpeed*0.5 + d.driftPhase) * eased * 0.8;
            x = d.bodyPos.x + d.disperseDir.x * dist + driftX;
            y = d.bodyPos.y + d.disperseDir.y * dist + driftY;
            z = d.bodyPos.z + d.disperseDir.z * dist + driftZ;
            alpha = 0.4*(1-eased*0.3) + Math.sin(time*0.8+d.driftPhase)*0.08;
            size = d.baseSize * (0.8 + eased * 0.3);
          } else if (phase === 'dissolving') {
            const dp = (p - 0.55) / 0.20;
            const baseDist = d.disperseSpeed * 6;
            const extraDist = dp * d.disperseSpeed * 8;
            const totalDist = baseDist + extraDist;
            const driftX = Math.sin(time*d.driftSpeed + d.driftAngle)*2.5;
            const driftZ = Math.cos(time*d.driftSpeed*0.8 + d.driftAngle)*2.5;
            const driftY = Math.sin(time*d.driftSpeed*0.5 + d.driftPhase)*1.2;
            x = d.bodyPos.x + d.disperseDir.x*totalDist + driftX;
            y = d.bodyPos.y + d.disperseDir.y*totalDist + driftY;
            z = d.bodyPos.z + d.disperseDir.z*totalDist + driftZ;
            alpha = 0.3*(1-dp*0.4) + Math.sin(time*0.6+d.driftPhase)*0.06;
            size = d.baseSize * (1.0 - dp*0.15);
          } else if (phase === 'ascending') {
            const ap = (p - 0.75) / 0.15;
            const totalDist = d.disperseSpeed * 14;
            const rise = ap * (8 + d.disperseSpeed * 5);
            const driftX = Math.sin(time*d.driftSpeed*0.6 + d.driftAngle) * (3 - ap*1.5);
            const driftZ = Math.cos(time*d.driftSpeed*0.5 + d.driftAngle) * (3 - ap*1.5);
            x = d.bodyPos.x + d.disperseDir.x*totalDist*0.5 + driftX;
            y = d.bodyPos.y + d.disperseDir.y*totalDist*0.3 + rise;
            z = d.bodyPos.z + d.disperseDir.z*totalDist*0.5 + driftZ;
            alpha = 0.25 * (1 - ap*0.6);
            size = d.baseSize * (0.8 - ap*0.3);
          } else {
            // returning
            const rp = (p - 0.90) / 0.10;
            const eased = rp * rp;
            const maxHeight = d.bodyPos.y + d.disperseDir.y * 14 + 8;
            const settleY = maxHeight * (1 - eased) + 0.3 * eased;
            x = d.bodyPos.x + d.disperseDir.x*5*(1-rp) + Math.sin(time*d.driftSpeed+d.driftAngle)*(1-rp)*2;
            y = settleY;
            z = d.bodyPos.z + d.disperseDir.z*5*(1-rp) + Math.cos(time*d.driftSpeed+d.driftAngle)*(1-rp)*2;
            alpha = 0.15 * (1 - rp*0.7);
            size = d.baseSize * (0.5 - rp*0.3);
          }

          posAttr.setXYZ(i, x, y, z);
          alphaAttr.setX(i, Math.max(0, alpha));
          sizeAttr.setX(i, Math.max(0.5, size));
        }
        posAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
      };

      updateDispersal(spiritPointsRef.current, SPIRIT_COUNT, 0, false);
      updateDispersal(materialPointsRef.current, MATERIAL_COUNT, SPIRIT_COUNT, false);
      updateDispersal(ambientPointsRef.current, AMBIENT_COUNT, SPIRIT_COUNT + MATERIAL_COUNT, true);

      // Creature body fading
      const creature = creatureRef.current;
      if (creature) {
        let bodyOpacity = 0.9;
        let bodyEmissive = 0.15;
        if (phase === 'complete') {
          bodyOpacity = 0.9;
          bodyEmissive = 0.15 + Math.sin(time * 0.4) * 0.03;
        } else if (phase === 'fading') {
          const fp = (p - 0.15) / 0.20;
          bodyOpacity = 0.9 - fp * 0.4;
          bodyEmissive = 0.15 - fp * 0.08;
        } else if (phase === 'seeding') {
          const sp = (p - 0.35) / 0.20;
          bodyOpacity = 0.5 - sp * 0.3;
          bodyEmissive = 0.07 - sp * 0.04;
        } else if (phase === 'dissolving') {
          const dp = (p - 0.55) / 0.20;
          bodyOpacity = 0.2 - dp * 0.18;
          bodyEmissive = 0.03 - dp * 0.02;
        } else {
          bodyOpacity = 0;
          bodyEmissive = 0;
        }
        creature.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat.opacity !== undefined) {
              mat.transparent = true;
              mat.opacity = Math.max(0, bodyOpacity);
              mat.emissiveIntensity = Math.max(0, bodyEmissive);
            }
          }
        });
        creature.visible = bodyOpacity > 0.01;
      }

      // Core glow
      const coreMesh = coreMeshRef.current;
      if (coreMesh) {
        const cm = coreMesh.material as THREE.ShaderMaterial;
        cm.uniforms.uTime.value = time;
        if (phase === 'complete') {
          coreMesh.visible = true;
          coreMesh.scale.setScalar(1.0 + Math.sin(time*0.6)*0.05);
          cm.uniforms.uIntensity.value = 0.5;
        } else if (phase === 'fading') {
          const fp = (p-0.15)/0.20;
          coreMesh.visible = true;
          coreMesh.scale.setScalar(1.0 - fp*0.15);
          cm.uniforms.uIntensity.value = 0.5 - fp*0.2;
        } else if (phase === 'seeding') {
          const sp = (p-0.35)/0.20;
          coreMesh.visible = true;
          coreMesh.scale.setScalar(0.85 - sp*0.35);
          cm.uniforms.uIntensity.value = 0.3 - sp*0.2;
        } else if (phase === 'dissolving') {
          const dp = (p-0.55)/0.20;
          coreMesh.visible = dp < 0.8;
          coreMesh.scale.setScalar(0.5 - dp*0.4);
          cm.uniforms.uIntensity.value = 0.1 * (1 - dp);
        } else {
          coreMesh.visible = false;
        }
      }

      const coreGlow = coreGlowRef.current;
      if (coreGlow) {
        const gm = coreGlow.material as THREE.MeshBasicMaterial;
        if (phase === 'complete') {
          coreGlow.visible = true;
          coreGlow.scale.setScalar(1.6 + Math.sin(time*0.6)*0.1);
          gm.opacity = 0.08;
        } else if (phase === 'fading') {
          const fp = (p-0.15)/0.20;
          coreGlow.visible = true;
          gm.opacity = 0.08 - fp*0.03;
        } else if (phase === 'seeding') {
          const sp = (p-0.35)/0.20;
          coreGlow.visible = true;
          gm.opacity = 0.05 - sp*0.04;
          coreGlow.scale.setScalar(1.6 + sp*0.8);
        } else {
          coreGlow.visible = false;
        }
      }

      // Light
      const sl = spiritLightRef.current;
      if (sl) {
        if (phase === 'complete') sl.intensity = 3 + Math.sin(time*0.4)*0.3;
        else if (phase === 'fading') sl.intensity = 3 - ((p-0.15)/0.20)*1.5;
        else if (phase === 'seeding') sl.intensity = 1.5 - ((p-0.35)/0.20)*0.8;
        else if (phase === 'dissolving') sl.intensity = 0.7 - ((p-0.55)/0.20)*0.5;
        else sl.intensity = 0.2 * Math.max(0, 1 - (p-0.75)/0.25);
      }

      // Bloom
      if (bloomPassRef.current) {
        let bloomStrength = 0.6;
        if (phase === 'complete') bloomStrength = 0.6;
        else if (phase === 'fading') bloomStrength = 0.6 + ((p-0.15)/0.20)*0.2;
        else if (phase === 'seeding') bloomStrength = 0.8 + ((p-0.35)/0.20)*0.3;
        else if (phase === 'dissolving') bloomStrength = 1.1 - ((p-0.55)/0.20)*0.3;
        else if (phase === 'ascending') bloomStrength = 0.8 - ((p-0.75)/0.15)*0.3;
        else bloomStrength = 0.5 - ((p-0.90)/0.10)*0.3;
        bloomPassRef.current.strength = Math.max(0.1, bloomStrength);
      }

      // Atmosphere
      if (scene.fog instanceof THREE.FogExp2) {
        if (phase === 'returning') {
          const rp = (p - 0.90) / 0.10;
          scene.fog.density = 0.018 + rp * 0.008;
          const bg = scene.background as THREE.Color;
          bg.setRGB(0.01 - rp*0.005, 0.016 - rp*0.008, 0.01 - rp*0.005);
          scene.fog.color.copy(bg);
          renderer.toneMappingExposure = 0.9 - rp * 0.25;
        } else {
          scene.fog.density = 0.018;
          (scene.background as THREE.Color).setRGB(0.008, 0.016, 0.008);
          scene.fog.color.copy(scene.background as THREE.Color);
          renderer.toneMappingExposure = 0.9;
        }
      }

      composerRef.current?.render();
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [getCurrentPhase]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
  );
};
