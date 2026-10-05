import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Shaders remain the same for particles
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
const AMBIENT_COUNT = 300;

interface ParticleData {
  startPos: THREE.Vector3;
  velocity: THREE.Vector3;
  angle: number;
  radius: number;
  speed: number;
  phase: number;
  baseSize: number;
  delay: number; // Individual delay for gradual gathering
}

export type GatheringPhase = 'primordial' | 'awakening' | 'drifting' | 'weaving' | 'forming' | 'emergence';

export interface PhaseConfig {
  name: GatheringPhase;
  label: string;
  startTime: number;
  endTime: number;
  description: string;
}

// Firefly shader - organic blinking particles for forest life
const fireflyVertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uPixelRatio;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (150.0 / -mvPosition.z);
    gl_PointSize = max(gl_PointSize, 1.5);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fireflyFragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    float core = smoothstep(0.12, 0.0, dist);
    float aura = smoothstep(0.5, 0.0, dist) * 0.25;
    float brightness = core * 0.7 + aura;
    gl_FragColor = vec4(vColor * brightness * 1.5, vAlpha * brightness);
  }
`;

// 120 seconds total - a long, meditative natural process
export const PHASES: PhaseConfig[] = [
  {
    name: 'primordial',
    label: '原始森林',
    startTime: 0.0,
    endTime: 0.20,
    description: '人迹罕至的深山老林，万物生灵在此繁衍生息，灵气在天地间自然流转。月光洒落，薄雾缭绕，一切寂静而深邃。'
  },
  {
    name: 'awakening',
    label: '生灵觉醒',
    startTime: 0.20,
    endTime: 0.40,
    description: '草木鸟兽的灵开始活跃，如萤火般在林间闪烁。不同种类的生灵之灵各自跃动，彼此尚未汇聚，只是自然地流淌。'
  },
  {
    name: 'drifting',
    label: '自然漂流',
    startTime: 0.40,
    endTime: 0.58,
    description: '生灵随风、流水、根脉自然漂移。极其缓慢地向某个气场汇聚处靠近，如同溪水入河，河流入海般自然。'
  },
  {
    name: 'weaving',
    label: '物质灵交织',
    startTime: 0.58,
    endTime: 0.74,
    description: '金色物质灵从大地、岩石、流水中缓缓渗出，与生灵在中心区域缓慢编织。如同蚕丝缠绕，层层叠叠。'
  },
  {
    name: 'forming',
    label: '精灵凝聚',
    startTime: 0.74,
    endTime: 0.87,
    description: '光核在漫长岁月中逐渐凝聚成形，精灵轮廓如晨雾般缓缓显现。生命的气息从光核中向外蔓延。'
  },
  {
    name: 'emergence',
    label: '妖精诞生',
    startTime: 0.87,
    endTime: 1.0,
    description: '生命自然而然成形。新生的妖精在晨光中安静伫立，与森林融为一体。周围万物安静下来，迎接新生命的到来。'
  },
];

interface Props {
  progress: number;
  isPlaying: boolean;
  onPhaseChange?: (phase: GatheringPhase) => void;
}

export const SpiritGatheringScene: React.FC<Props> = ({
  progress,
  isPlaying,
  onPhaseChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<ParticleData[]>([]);
  const prevPhaseRef = useRef<GatheringPhase>('primordial');
  const spiritPointsRef = useRef<THREE.Points | null>(null);
  const materialPointsRef = useRef<THREE.Points | null>(null);
  const ambientPointsRef = useRef<THREE.Points | null>(null);
  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const coreGlowRef = useRef<THREE.Mesh | null>(null);
  const spiritLightRef = useRef<THREE.PointLight | null>(null);
  const warmLightRef = useRef<THREE.PointLight | null>(null);
  const cameraTargetRef = useRef(new THREE.Vector3(0, 2, 0));
  const lightShaftsRef = useRef<THREE.Mesh[]>([]);
  const haloRingRef = useRef<THREE.Mesh | null>(null);
  const fireflyPointsRef = useRef<THREE.Points | null>(null);
  const mistLayersRef = useRef<THREE.Mesh[]>([]);
  const composerRef = useRef<EffectComposer | null>(null);
  const moonRef = useRef<THREE.Group | null>(null);
  const creatureRef = useRef<THREE.Group | null>(null);
  const leafMeshesRef = useRef<THREE.Mesh[]>([]);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const getCurrentPhase = useCallback((p: number): GatheringPhase => {
    for (const phase of PHASES) {
      if (p >= phase.startTime && p < phase.endTime) return phase.name;
    }
    return 'emergence';
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

    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;


    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020402);
    scene.fog = new THREE.FogExp2(0x020402, 0.020);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(0, 4, 15);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;
    // Post-processing: bloom for soft spiritual glow
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.4,   // strength - subtle glow
      0.6,   // radius - medium spread
      0.75   // threshold - only bright things glow
    );
    composer.addPass(bloomPass);
    // Vignette shader pass - cinematic edge darkening
    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        darkness: { value: 0.6 },
        offset: { value: 1.1 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float darkness;
        uniform float offset;
        varying vec2 vUv;
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
          float vign = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
          texel.rgb *= mix(1.0 - darkness, 1.0, vign);
          gl_FragColor = texel;
        }
      `,
    };
    const vignettePass = new ShaderPass(vignetteShader);
    composer.addPass(vignettePass);
    composerRef.current = composer;
    bloomPassRef.current = bloomPass;

    // Ambient light - moonlight filtering through canopy
    scene.add(new THREE.AmbientLight(0x1a2820, 0.45));
    const moonLight = new THREE.DirectionalLight(0x6688aa, 0.35);
    moonLight.position.set(10, 30, 15);
    scene.add(moonLight);

    // Moon - large pale disc in night sky
    const moonGroup = new THREE.Group();
    const moonGeo = new THREE.CircleGeometry(3.5, 48);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xfdfae4, // Cream moon matching spirit color
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(12, 28, -35);
    moonMesh.lookAt(0, 4, 0);
    moonGroup.add(moonMesh);
    // Moon halo - soft atmospheric glow
    const moonHaloGeo = new THREE.CircleGeometry(6.0, 48);
    const moonHaloMat = new THREE.MeshBasicMaterial({
      color: 0x8899aa,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const moonHalo = new THREE.Mesh(moonHaloGeo, moonHaloMat);
    moonHalo.position.copy(moonMesh.position);
    moonHalo.lookAt(0, 4, 0);
    moonGroup.add(moonHalo);
    scene.add(moonGroup);
    moonRef.current = moonGroup;

    // Spirit light - gentle cyan glow
    const spiritLight = new THREE.PointLight(0x8a9a5a, 0, 25); // Olive-tinted light
    spiritLight.position.set(0, 3, 0);
    scene.add(spiritLight);
    spiritLightRef.current = spiritLight;

    // Warm light - earth energy
    const warmLight = new THREE.PointLight(0xc49a5a, 0, 18);
    warmLight.position.set(2, 2, 2);
    scene.add(warmLight);
    warmLightRef.current = warmLight;

    // Ground - mossy forest floor
    const groundGeo = new THREE.PlaneGeometry(100, 100, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x0a120a, // Very dark forest floor 
      roughness: 0.95,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ancient trees - more dense and varied
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.95, metalness: 0.02 });
    const canopyMat = new THREE.MeshStandardMaterial({ 
      color: 0x0a1a0a, // Very dark canopy 
      roughness: 0.95, 
      transparent: true, 
      opacity: 0.85 
    });
    
    // Dense forest - 24 trees in natural clusters
    const trees = [
      [-8,-4,14,0.3],[-7,-6,16,0.35],[-9,0,13,0.28],[-6,5,15,0.32],
      [8,-5,15,0.35],[9,-2,14,0.3],[7,4,16,0.32],[9,6,13,0.28],
      [-4,-8,18,0.4],[4,-9,15,0.35],[0,-10,20,0.42],[-10,-6,13,0.25],
      [10,-7,14,0.3],[-3,8,12,0.25],[3,9,13,0.28],[-11,4,16,0.35],
      [-5,2,10,0.22],[5,-3,11,0.25],[-2,-5,9,0.2],[2,6,10,0.22],
      [-7,7,12,0.28],[7,-8,11,0.25],[-9,-9,14,0.3],[9,9,13,0.28]
    ];
    
    for (const [tx, tz, th, tr] of trees) {
      const trunkGeo = new THREE.CylinderGeometry(tr * 0.7, tr, th, 8);
      const trunk = new THREE.Mesh(trunkGeo, treeMat);
      trunk.position.set(tx, th / 2, tz);
      scene.add(trunk);
      
      const canopyGeo = new THREE.SphereGeometry(tr * 4.5 + 1.5, 8, 6);
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(tx, th * 0.75, tz);
      canopy.scale.y = 0.65;
      scene.add(canopy);
    }

    // Rocks and moss-covered boulders
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.98 });
    const rocks = [[-3,-2,0.5],[4,-3,0.6],[-5,3,0.4],[6,2,0.55],[0,-6,0.45]];
    for (const [rx, rz, rs] of rocks) {
      const rockGeo = new THREE.DodecahedronGeometry(rs, 1);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, rs * 0.5, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      scene.add(rock);
    }

    // Ground mist layer - low-lying forest atmosphere
    const mistGeo = new THREE.PlaneGeometry(60, 60);
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x0a150a,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mist = new THREE.Mesh(mistGeo, mistMat);
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = 0.3;
    scene.add(mist);


    // Volumetric light shafts - moonlight through canopy gaps
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0x8899aa,
      transparent: true,
      opacity: 0.012,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shaftConfigs = [
      [-4, 0, -3, 0.18], [3, 0, -5, -0.12], [-2, 0, 4, 0.08],
      [5, 0, 2, -0.15], [-6, 0, 0, 0.05], [1, 0, -7, -0.1],
    ];
    const lightShafts: THREE.Mesh[] = [];
    for (const [sx, _sz, sz, tilt] of shaftConfigs) {
      const shaftGeo = new THREE.CylinderGeometry(0.15, 1.8, 18, 6, 1, true);
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.position.set(sx, 9, sz);
      shaft.rotation.z = tilt;
      shaft.rotation.x = tilt * 0.5;
      scene.add(shaft);
      lightShafts.push(shaft);
    }
    lightShaftsRef.current = lightShafts;

    // Multi-layer ground mist for atmospheric depth
    const mistHeights = [0.15, 0.6, 1.2];
    const mistOpacities = [0.04, 0.025, 0.015];
    const mistColors = [0x080c08, 0x0a120a, 0x0c150c]; // Darker mist
    const mistLayers: THREE.Mesh[] = [mist];
    for (let mi = 0; mi < 3; mi++) {
      const mGeo = new THREE.PlaneGeometry(50 - mi * 8, 50 - mi * 8);
      const mMat = new THREE.MeshBasicMaterial({
        color: mistColors[mi],
        transparent: true,
        opacity: mistOpacities[mi],
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mMesh = new THREE.Mesh(mGeo, mMat);
      mMesh.rotation.x = -Math.PI / 2;
      mMesh.position.y = mistHeights[mi];
      scene.add(mMesh);
      mistLayers.push(mMesh);
    }
    mistLayersRef.current = mistLayers;

    // Halo ring - ethereal ring around the forming core
    const haloGeo = new THREE.TorusGeometry(2.0, 0.12, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x879f4c, // Olive green halo
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloRing = new THREE.Mesh(haloGeo, haloMat);
    haloRing.position.set(0, 3, 0);
    haloRing.rotation.x = Math.PI / 2;
    haloRing.visible = false;
    scene.add(haloRing);
    haloRingRef.current = haloRing;

    // Initialize particle data with individual delays
    const pData: ParticleData[] = [];
    for (let i = 0; i < SPIRIT_COUNT + MATERIAL_COUNT + AMBIENT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 18;
      const height = Math.random() * 10;
      pData.push({
        startPos: new THREE.Vector3(
          Math.cos(angle) * radius, 
          height, 
          Math.sin(angle) * radius
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.015, 
          (Math.random() - 0.5) * 0.008, 
          (Math.random() - 0.5) * 0.015
        ),
        angle, radius,
        speed: 0.2 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        baseSize: 0.25 + Math.random() * 2.2,
        delay: Math.random() * 0.3 // Individual delay for gradual gathering
      });
    }
    particlesRef.current = pData;

    // Helper to create point system
    const createPoints = (count: number, offset: number, colorFn: (i: number) => [number, number, number]) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const alphas = new Float32Array(count);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const d = pData[offset + i];
        pos[i * 3] = d.startPos.x;
        pos[i * 3 + 1] = d.startPos.y;
        pos[i * 3 + 2] = d.startPos.z;
        sizes[i] = d.baseSize;
        alphas[i] = 0;
        const [r, g, b] = colorFn(i);
        colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
      geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.ShaderMaterial({
        vertexShader: spiritVertexShader,
        fragmentShader: spiritFragmentShader,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      return new THREE.Points(geo, mat);
    };

    // Spirit particles - diverse colors representing different species
    const spiritPoints = createPoints(SPIRIT_COUNT, 0, (i) => {
      const species = Math.random();
      if (species < 0.3) return [0.99, 0.98, 0.89]; // Cream white - primary spirit energy (#fdfae4)
      if (species < 0.6) return [0.53 + Math.random() * 0.05, 0.62 + Math.random() * 0.04, 0.30]; // Olive green - plant/life spirits (#879f4c)
      if (species < 0.85) return [0.70 + Math.random() * 0.04, 0.76 + Math.random() * 0.03, 0.47]; // Light sage - animal spirits (#b2c379)
      return [0.80, 0.82, 0.70]; // Pale moss - rare spirits
    });
    scene.add(spiritPoints);
    spiritPointsRef.current = spiritPoints;

    // Material spirit particles - earth energy
    const matPoints = createPoints(MATERIAL_COUNT, SPIRIT_COUNT, () => {
      return [0.95 + Math.random() * 0.04, 0.90 + Math.random() * 0.03, 0.72]; // Warm cream-gold material spirit
    });
    scene.add(matPoints);
    materialPointsRef.current = matPoints;

    // Ambient particles - forest atmosphere
    const ambPoints = createPoints(AMBIENT_COUNT, SPIRIT_COUNT + MATERIAL_COUNT, () => {
      return [0.25 + Math.random() * 0.05, 0.28 + Math.random() * 0.05, 0.18 + Math.random() * 0.03]; // Very dim green ambient
    });
    scene.add(ambPoints);
    ambientPointsRef.current = ambPoints;


    // Firefly particles - living forest atmosphere
    const FIREFLY_COUNT = 80;
    const fireflyGeo = new THREE.BufferGeometry();
    const ffPos = new Float32Array(FIREFLY_COUNT * 3);
    const ffSizes = new Float32Array(FIREFLY_COUNT);
    const ffAlphas = new Float32Array(FIREFLY_COUNT);
    const ffColors = new Float32Array(FIREFLY_COUNT * 3);
    const ffData: { x: number; y: number; z: number; speedX: number; speedY: number; speedZ: number; phase: number; blinkSpeed: number }[] = [];
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const fx = (Math.random() - 0.5) * 35;
      const fy = 0.4 + Math.random() * 4.5;
      const fz = (Math.random() - 0.5) * 35;
      ffPos[i * 3] = fx;
      ffPos[i * 3 + 1] = fy;
      ffPos[i * 3 + 2] = fz;
      ffSizes[i] = 1.2 + Math.random() * 2.0;
      ffAlphas[i] = 0;
      ffColors[i * 3] = 0.55 + Math.random() * 0.15;
      ffColors[i * 3 + 1] = 0.72 + Math.random() * 0.1;
      ffColors[i * 3 + 2] = 0.25 + Math.random() * 0.1;
      ffData.push({
        x: fx, y: fy, z: fz,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: 0.08 + Math.random() * 0.15,
        speedZ: (Math.random() - 0.5) * 0.4,
        phase: Math.random() * Math.PI * 2,
        blinkSpeed: 0.25 + Math.random() * 0.5,
      });
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    fireflyGeo.setAttribute('aSize', new THREE.BufferAttribute(ffSizes, 1));
    fireflyGeo.setAttribute('aAlpha', new THREE.BufferAttribute(ffAlphas, 1));
    fireflyGeo.setAttribute('aColor', new THREE.BufferAttribute(ffColors, 3));
    const fireflyMat = new THREE.ShaderMaterial({
      vertexShader: fireflyVertexShader,
      fragmentShader: fireflyFragmentShader,
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
    scene.add(fireflyPoints);
    fireflyPointsRef.current = fireflyPoints;
    fireflyPoints.userData.ffData = ffData;
    fireflyPoints.userData.ffCount = FIREFLY_COUNT;

    // Falling leaves - organic forest detail
    const leafMat = new THREE.MeshBasicMaterial({
      color: 0x2a4a2a,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const leafMeshes: THREE.Mesh[] = [];
    const LEAF_COUNT = 18;
    for (let li = 0; li < LEAF_COUNT; li++) {
      const leafGeo = new THREE.PlaneGeometry(0.12 + Math.random() * 0.12, 0.06 + Math.random() * 0.06);
      const leaf = new THREE.Mesh(leafGeo, leafMat.clone());
      const lx = (Math.random() - 0.5) * 25;
      const ly = 5 + Math.random() * 12;
      const lz = (Math.random() - 0.5) * 25;
      leaf.position.set(lx, ly, lz);
      leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      leaf.userData = {
        baseY: ly,
        fallSpeed: 0.08 + Math.random() * 0.15,
        swaySpeed: 0.3 + Math.random() * 0.5,
        swayAmount: 0.4 + Math.random() * 0.8,
        rotSpeed: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        baseX: lx,
      };
      scene.add(leaf);
      leafMeshes.push(leaf);
    }
    leafMeshesRef.current = leafMeshes;

    // Forest floor details - ferns, moss patches, small mushrooms
    const fernMat = new THREE.MeshBasicMaterial({
      color: 0x1a3a1a,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fernMeshes: THREE.Mesh[] = [];
    const FERN_COUNT = 12;
    for (let fi = 0; fi < FERN_COUNT; fi++) {
      const fernGroup = new THREE.Group();
      // Create a simple fern frond - multiple small planes
      const frondCount = 3 + Math.floor(Math.random() * 3);
      for (let fj = 0; fj < frondCount; fj++) {
        const frondGeo = new THREE.PlaneGeometry(0.08, 0.25 + Math.random() * 0.15);
        const frond = new THREE.Mesh(frondGeo, fernMat.clone());
        const angle = (fj / frondCount) * Math.PI * 0.6 - Math.PI * 0.3;
        frond.position.set(Math.sin(angle) * 0.1, 0.12, Math.cos(angle) * 0.05);
        frond.rotation.z = angle * 0.5;
        frond.rotation.x = -0.3;
        fernGroup.add(frond);
      }
      const fx = (Math.random() - 0.5) * 20;
      const fz = (Math.random() - 0.5) * 20;
      fernGroup.position.set(fx, 0.02, fz);
      fernGroup.rotation.y = Math.random() * Math.PI * 2;
      scene.add(fernGroup);
      // Store as first frond for animation
      fernMeshes.push(fernGroup.children[0] as THREE.Mesh);
    }

    // Moss patches - subtle green ground cover
    const mossMat = new THREE.MeshBasicMaterial({
      color: 0x152a15,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const mossPositions = [
      [-2, 0.01, -1.5], [3, 0.01, -2], [-4, 0.01, 2.5], [1.5, 0.01, 3],
      [-3, 0.01, -4], [4.5, 0.01, 1], [-1, 0.01, 5], [2, 0.01, -5],
    ];
    for (const [mx, my, mz] of mossPositions) {
      const mossGeo = new THREE.CircleGeometry(0.3 + Math.random() * 0.4, 8);
      const moss = new THREE.Mesh(mossGeo, mossMat);
      moss.rotation.x = -Math.PI / 2;
      moss.position.set(mx, my, mz);
      scene.add(moss);
    }

    // Small mushrooms - whimsical forest detail
    const mushroomCapMat = new THREE.MeshBasicMaterial({
      color: 0x3a1a1a,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const mushroomStemMat = new THREE.MeshBasicMaterial({
      color: 0x2a2a20,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const mushroomPositions = [
      [-1.5, 0, -2], [2.5, 0, -3], [-3.5, 0, 1], [1, 0, 4],
      [-5, 0, -1], [4, 0, -4],
    ];
    for (const [mx, _my, mz] of mushroomPositions) {
      const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.12, 6);
      const stem = new THREE.Mesh(stemGeo, mushroomStemMat);
      stem.position.set(mx, 0.06, mz);
      scene.add(stem);
      const capGeo = new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
      const cap = new THREE.Mesh(capGeo, mushroomCapMat);
      cap.position.set(mx, 0.12, mz);
      scene.add(cap);
    }



   // Creature silhouette - emerges during final phase (天虎-inspired rounded cat shape)
   const creatureGroup = new THREE.Group();
    // 天虎 golden-amber body with dark blue-grey markings
    // Verified from reference: #d8b35c (golden amber), #383e48 (dark markings)
    const creatureMat = new THREE.MeshBasicMaterial({
      color: 0xd8b35c,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    // Dark marking material for tiger stripes/patterns
    const markingMat = new THREE.MeshBasicMaterial({
      color: 0x383e48,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    // Body - round, compact (like 天虎 - a round tiger/cat)
    const bodyGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const body = new THREE.Mesh(bodyGeo, creatureMat);
    body.scale.set(1.1, 0.9, 1.0);
    creatureGroup.add(body);
    // Head - large round head, characteristic of 罗小黑 style
    const headGeo = new THREE.SphereGeometry(0.42, 32, 32);
    const head = new THREE.Mesh(headGeo, creatureMat);
    head.position.set(0, 0.6, 0.2);
    creatureGroup.add(head);
    // Ears - two tall triangular ears (cat-like)
    const earGeo = new THREE.ConeGeometry(0.12, 0.3, 4);
    const earL = new THREE.Mesh(earGeo, creatureMat);
    earL.position.set(-0.22, 0.95, 0.15);
    earL.rotation.z = 0.25;
    earL.rotation.x = -0.1;
    creatureGroup.add(earL);
    const earR = new THREE.Mesh(earGeo, creatureMat);
    earR.position.set(0.22, 0.95, 0.15);
    earR.rotation.z = -0.25;
    earR.rotation.x = -0.1;
    creatureGroup.add(earR);
   // Eyes - two tiny glowing spheres
    // Eyes are the first feature to appear - must be prominent
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xfdfae4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const eyeGeo = new THREE.SphereGeometry(0.065, 16, 16);
   const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
   eyeL.position.set(-0.12, 0.65, 0.55);
   creatureGroup.add(eyeL);
   const eyeR = new THREE.Mesh(eyeGeo, eyeMat.clone());
   eyeR.position.set(0.12, 0.65, 0.55);
   creatureGroup.add(eyeR);
    // Forehead marking - small dark stripe between ears (天虎 pattern)
    const foreheadMarkGeo = new THREE.BoxGeometry(0.06, 0.15, 0.04);
    const foreheadMark = new THREE.Mesh(foreheadMarkGeo, markingMat);
    foreheadMark.position.set(0, 0.85, 0.35);
    creatureGroup.add(foreheadMark);
    // Body stripes - three subtle dark bands on the back
    for (let si = 0; si < 3; si++) {
      const stripeGeo = new THREE.BoxGeometry(0.35, 0.04, 0.08);
      const stripe = new THREE.Mesh(stripeGeo, markingMat.clone());
      stripe.position.set(0, 0.3 - si * 0.18, -0.35);
      stripe.rotation.x = -0.2;
      creatureGroup.add(stripe);
    }
    // Creature aura - soft golden glow sphere during emergence
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xdfbe66,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const auraGeo = new THREE.SphereGeometry(1.2, 24, 24);
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.name = 'creatureAura';
    creatureGroup.add(aura);
    // Short stubby legs (天虎 style)
    const legGeo = new THREE.CapsuleGeometry(0.08, 0.15, 4, 8);
    const legPositions = [[-0.25, -0.4, 0.2], [0.25, -0.4, 0.2], [-0.25, -0.4, -0.2], [0.25, -0.4, -0.2]];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, creatureMat);
      leg.position.set(lx, ly, lz);
      creatureGroup.add(leg);
    }
    // Tail - long curved tail (cat-like)
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.05, -0.55),
      new THREE.Vector3(0, 0.15, -0.8),
      new THREE.Vector3(0.1, 0.4, -0.9),
      new THREE.Vector3(0.15, 0.55, -0.75),
    ]);
    const tailGeo = new THREE.TubeGeometry(tailCurve, 12, 0.04, 6, false);
    const tail = new THREE.Mesh(tailGeo, creatureMat);
    creatureGroup.add(tail);
    creatureGroup.position.set(0, 2.5, 0);
    creatureGroup.visible = false;
    scene.add(creatureGroup);
    creatureRef.current = creatureGroup;

        // Core sphere - the forming spirit
    const coreGeo = new THREE.SphereGeometry(0.8, 48, 48);
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: coreVertexShader, fragmentShader: coreFragmentShader,
      uniforms: {
        uTime: { value: 0 }, uIntensity: { value: 0 },
        uColor1: { value: new THREE.Color(0x879f4c) }, // Olive green
        uColor2: { value: new THREE.Color(0xfdfae4) }, // Cream white
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 3, 0);
    coreMesh.visible = false;
    scene.add(coreMesh);
    coreMeshRef.current = coreMesh;

    // Gentle glow sphere
    const glowSphereGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const glowSphereMat = new THREE.MeshBasicMaterial({ 
      color: 0x879f4c, // Olive green glow 
      transparent: true, 
      opacity: 0, 
      blending: THREE.AdditiveBlending, 
      depthWrite: false 
    });
    const glowSphere = new THREE.Mesh(glowSphereGeo, glowSphereMat);
    glowSphere.position.set(0, 3, 0);
    glowSphere.visible = false;
    scene.add(glowSphere);
    coreGlowRef.current = glowSphere;

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

      // Slow, contemplative camera - wider shots, slower orbits
      let camAngle: number, camDist: number;
      if (phase === 'primordial') {
        // Wide, still forest shot - barely moving, like a meditation
        camera.position.set(
          Math.sin(time * 0.04) * 2.5,
          5.0 + Math.sin(time * 0.08) * 0.3,
          16 + Math.cos(time * 0.03) * 0.5
        );
        cameraTargetRef.current.set(0, 2.5, 0);
      } else if (phase === 'awakening') {
        // Slowly panning through the forest, discovering spirits
        camAngle = time * 0.06;
        camDist = 14 - ((p - 0.20) / 0.20) * 2;
        camera.position.set(
          Math.sin(camAngle) * camDist,
          4.0 + Math.sin(time * 0.10) * 0.4,
          Math.cos(camAngle) * camDist
        );
        cameraTargetRef.current.set(0, 2.8, 0);
      } else if (phase === 'drifting') {
        // Gradual approach, watching spirits drift toward center
        camAngle = time * 0.08;
        const driftP = (p - 0.40) / 0.18;
        camDist = 12 - driftP * 2;
        camera.position.set(
          Math.sin(camAngle) * camDist,
          3.5 + Math.sin(time * 0.12) * 0.3,
          Math.cos(camAngle) * camDist
        );
        cameraTargetRef.current.set(0, 3.0, 0);
      } else if (phase === 'weaving') {
        // Closer orbit, watching the weaving
        camAngle = time * 0.10;
        camera.position.set(
          Math.sin(camAngle) * 9,
          3.5 + Math.sin(time * 0.15) * 0.3,
          Math.cos(camAngle) * 9
        );
        cameraTargetRef.current.set(0, 3.0, 0);
      } else if (phase === 'forming') {
        // Intimate orbit around the forming core
        camAngle = time * 0.12;
        camera.position.set(
          Math.sin(camAngle) * 7,
          3.3 + Math.sin(time * 0.18) * 0.25,
          Math.cos(camAngle) * 7
        );
        cameraTargetRef.current.set(0, 3.0, 0);
      } else {
        // emergence - very gentle reveal, pulling back slightly
        const ep = (p - 0.87) / 0.13;
        camAngle = time * 0.03;
        const emergeDist = 7 - ep * 1.5;
        camera.position.set(
          Math.sin(camAngle) * emergeDist,
          3.0 + Math.sin(time * 0.06) * 0.15,
          Math.cos(camAngle) * emergeDist
        );
        cameraTargetRef.current.set(0, 2.6 + ep * 0.3, 0);
      }
      camera.lookAt(cameraTargetRef.current);

      // Update particle systems - SLOW and GRADUAL
      const updateParticleSystem = (
        points: THREE.Points | null, 
        count: number, 
        offset: number, 
        isSpirit: boolean, 
        isAmbient: boolean
      ) => {
        if (!points) return;
        const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
        const alphaAttr = points.geometry.attributes.aAlpha as THREE.BufferAttribute;
        const sizeAttr = points.geometry.attributes.aSize as THREE.BufferAttribute;
        const mat = points.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = time;

        for (let i = 0; i < count; i++) {
          const d = pd[offset + i];
          let alpha = 0, size = d.baseSize, x = 0, y = 0, z = 0;

          if (isAmbient) {
            // Ambient particles - always present, gentle drift
            x = d.startPos.x + Math.sin(time * d.speed * 0.4 + d.phase) * 2;
            y = d.startPos.y + Math.sin(time * d.speed * 0.25 + d.phase) * 1;
            z = d.startPos.z + Math.cos(time * d.speed * 0.3 + d.phase) * 2;
            alpha = 0.08 + Math.sin(time * 0.3 + d.phase) * 0.04;
            if (phase === 'emergence') alpha += 0.08;
            else if (phase === 'weaving' || phase === 'forming') alpha += 0.03;
          } else if (isSpirit) {
            // Spirit particles - the main gathering
            // Organic noise-based movement using layered sine waves
            const nx1 = Math.sin(time * d.speed * 0.3 + d.phase) * 0.6;
            const ny1 = Math.sin(time * d.speed * 0.2 + d.phase * 1.7) * 0.4;
            const nz1 = Math.cos(time * d.speed * 0.25 + d.phase * 0.8) * 0.6;
            const nx2 = Math.sin(time * d.speed * 0.12 + d.phase * 2.3) * 1.2;
            const nz2 = Math.cos(time * d.speed * 0.15 + d.phase * 1.4) * 1.2;

            if (phase === 'primordial') {
              // Scattered throughout forest, living naturally like fireflies
              x = d.startPos.x + nx1 * 1.5 + nx2 * 0.5;
              y = d.startPos.y + ny1 + Math.sin(time * 0.15 + d.phase) * 0.3;
              z = d.startPos.z + nz1 * 1.5 + nz2 * 0.5;
              // Barely visible, twinkling gently
              alpha = 0.04 + Math.sin(time * 0.6 + d.phase) * 0.025;
              size = d.baseSize * 0.4;
            } else if (phase === 'awakening') {
              // More active, pulsing brighter, but still scattered
              const ap = (p - 0.20) / 0.20;
              x = d.startPos.x + nx1 * (1.5 + ap * 1.0) + nx2 * 0.8;
              y = d.startPos.y + ny1 * (1 + ap * 0.5) + Math.sin(time * 0.25 + d.phase) * 0.5;
              z = d.startPos.z + nz1 * (1.5 + ap * 1.0) + nz2 * 0.8;
              // Gradually brightening, individual pulses
              alpha = 0.06 + ap * 0.12 + Math.sin(time * 0.8 + d.phase) * 0.04;
              size = d.baseSize * (0.5 + ap * 0.15);
            } else if (phase === 'drifting') {
              // Very gradual drift toward gathering point - like leaves on a slow stream
              const dp = Math.min(1, (p - 0.40) / 0.18);
              const stagger = d.delay * 0.6; // longer stagger
              const lp = Math.max(0, Math.min(1, (dp - stagger) / (1 - stagger)));
              // Quintic ease for extra gentle start
              const eased = lp * lp * lp * (lp * (lp * 6 - 15) + 10);

              // Blend from natural drift to gentle inward pull
              const naturalX = nx1 * 2.0 + nx2;
              const naturalZ = nz1 * 2.0 + nz2;
              // Slowly spiraling inward, but very gently
              const ca = d.angle + time * d.speed * 0.15 * eased + eased * 0.5;
              const cr = d.radius * (1 - eased * 0.7);
              const convergeX = Math.cos(ca) * cr;
              const convergeZ = Math.sin(ca) * cr;

              x = convergeX * eased + (d.startPos.x + naturalX) * (1 - eased);
              y = (d.startPos.y + (3 - d.startPos.y) * eased * 0.5) + ny1 * (1 - eased * 0.5);
              z = convergeZ * eased + (d.startPos.z + naturalZ) * (1 - eased);
              alpha = 0.15 + eased * 0.35 + Math.sin(time * 0.7 + d.phase) * 0.06;
              size = d.baseSize * (0.7 + eased * 0.3);
            } else if (phase === 'weaving') {
              // Interweaving at center - organic flow, not tight spiral
              const wp = (p - 0.58) / 0.16;
              // Gentle orbit with organic wobble
              const ca = d.angle + time * d.speed * 0.3 + wp * Math.PI;
              const wobbleR = 0.4 + Math.sin(time * 0.8 + d.phase) * 0.2;
              const cr = d.radius * 0.3 * (1 - wp * 0.5) + wobbleR;
              y = 3 + Math.sin(time * 0.6 + d.phase) * 0.5 * (1 - wp * 0.3) + ny1 * 0.3;
              x = Math.cos(ca) * cr + nx1 * 0.15 * (1 - wp);
              z = Math.sin(ca) * cr + nz1 * 0.15 * (1 - wp);
              alpha = 0.5 + wp * 0.2 + Math.sin(time * 0.5 + d.phase) * 0.05;
              size = d.baseSize * (1.0 - wp * 0.15);
            } else if (phase === 'forming') {
              // Very slow convergence into core - like morning mist gathering
              const fp = (p - 0.74) / 0.13;
              const ca = d.angle + time * d.speed * 0.2;
              const cr = (1 - fp) * 0.8 + Math.sin(time * 0.8 + d.phase) * 0.15 * (1 - fp);
              y = 3 + Math.sin(time * 0.6 + d.phase) * 0.15 * (1 - fp * 0.7);
              x = Math.cos(ca) * cr;
              z = Math.sin(ca) * cr;
              alpha = 0.7 - fp * 0.2;
              size = d.baseSize * (0.85 - fp * 0.2);
            } else {
              // emergence - peaceful gentle orbit around the newborn
              const ep = (p - 0.87) / 0.13;
              const ca = d.angle + time * d.speed * 0.06;
              const cr = 1.2 + Math.sin(time * 0.2 + d.phase) * 0.4 + ep * 0.5;
              y = 2.8 + Math.sin(time * 0.15 + d.phase) * 0.3;
              x = Math.cos(ca) * cr;
              z = Math.sin(ca) * cr;
              // Dimming slightly as the creature takes form - respectful distance
              alpha = 0.2 + Math.sin(time * 0.5 + d.phase) * 0.08 - ep * 0.05;
              size = d.baseSize * 0.4;
            }
          } else {
          // Material spirit - earth energy rising from the ground
            if (phase === 'primordial' || phase === 'awakening') {
              // Dormant deep in earth, barely visible warmth
              x = d.startPos.x + Math.sin(time * d.speed * 0.15 + d.phase) * 0.3;
              y = Math.max(0.1, d.startPos.y * 0.2) + Math.sin(time * d.speed * 0.1 + d.phase) * 0.15;
              z = d.startPos.z + Math.cos(time * d.speed * 0.12 + d.phase) * 0.3;
              alpha = 0.01 + (phase === 'awakening' ? ((p - 0.20) / 0.20) * 0.02 : 0);
              size = d.baseSize * 0.3;
            } else if (phase === 'drifting') {
              // Slowly seeping upward, like warm steam
              const dp = (p - 0.40) / 0.18;
              x = d.startPos.x + Math.sin(time * d.speed * 0.2 + d.phase) * 0.5;
              y = Math.max(0.1, d.startPos.y * 0.2) + dp * 1.0 + Math.sin(time * d.speed * 0.15 + d.phase) * 0.3;
              z = d.startPos.z + Math.cos(time * d.speed * 0.18 + d.phase) * 0.5;
              alpha = 0.03 + dp * 0.08;
              size = d.baseSize * (0.3 + dp * 0.1);
            } else if (phase === 'weaving') {
              // Rising from earth, flowing toward center like golden streams
              const wp = (p - 0.58) / 0.16;
              const ca = d.angle + time * d.speed * 0.4 + d.phase;
              const cr = d.radius * (1 - wp * 0.88);
              const helixY = Math.max(0.2, d.startPos.y * 0.2) + wp * 2.8 + Math.sin(ca + time * 0.5) * (1 - wp) * 0.8;
              x = Math.cos(ca) * cr + Math.sin(time * 0.3 + d.phase) * 0.3 * (1 - wp);
              y = helixY;
              z = Math.sin(ca) * cr + Math.cos(time * 0.25 + d.phase) * 0.3 * (1 - wp);
              alpha = 0.12 + wp * 0.5;
              size = d.baseSize * (0.4 + wp * 0.6);
            } else if (phase === 'forming') {
              // Integrating gently with spirit core
              const fp = (p - 0.74) / 0.13;
              const ca = d.angle + time * d.speed * 0.5;
              const cr = (1 - fp) * 0.5 + 0.05;
              y = 3 + Math.sin(time * 0.8 + d.phase) * 0.1 * (1 - fp);
              x = Math.cos(ca) * cr;
              z = Math.sin(ca) * cr;
              alpha = 0.6 - fp * 0.15;
              size = d.baseSize * (0.85 - fp * 0.2);
            } else {
              // emergence - gentle orbit, settling
              const ca = d.angle + time * d.speed * 0.05;
              const cr = 0.8 + Math.sin(time * 0.2 + d.phase) * 0.2;
              x = Math.cos(ca) * cr;
              y = 2.8 + Math.sin(time * 0.12 + d.phase) * 0.15;
              z = Math.sin(ca) * cr;
              alpha = 0.15 + Math.sin(time * 0.4 + d.phase) * 0.06;
              size = d.baseSize * 0.3;
            }
          }

          posAttr.setXYZ(i, x, y, z);
          alphaAttr.setX(i, alpha);
          sizeAttr.setX(i, size);
        }
        posAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
      };

      updateParticleSystem(spiritPointsRef.current, SPIRIT_COUNT, 0, true, false);
      updateParticleSystem(materialPointsRef.current, MATERIAL_COUNT, SPIRIT_COUNT, false, false);
      updateParticleSystem(ambientPointsRef.current, AMBIENT_COUNT, SPIRIT_COUNT + MATERIAL_COUNT, false, true);

      // Animate fireflies - organic blinking and drifting
      const ffPts = fireflyPointsRef.current;
      if (ffPts) {
        const ffD = ffPts.userData.ffData as any[];
        const ffN = ffPts.userData.ffCount as number;
        const ffPosA = ffPts.geometry.attributes.position as THREE.BufferAttribute;
        const ffAlphaA = ffPts.geometry.attributes.aAlpha as THREE.BufferAttribute;
        const showFireflies = phase !== 'primordial';
        for (let i = 0; i < ffN; i++) {
          const fd = ffD[i];
          const blink = Math.sin(time * fd.blinkSpeed + fd.phase);
          const vis = showFireflies ? Math.max(0, blink) * 0.35 : 0;
          ffAlphaA.setX(i, vis);
          ffPosA.setXYZ(i,
            fd.x + Math.sin(time * fd.speedX + fd.phase) * 1.5,
            fd.y + Math.sin(time * fd.speedY + fd.phase * 1.3) * 0.6,
            fd.z + Math.cos(time * fd.speedZ + fd.phase) * 1.5
          );
        }
        ffPosA.needsUpdate = true;
        ffAlphaA.needsUpdate = true;
      }

      // Animate light shafts - subtle sway and opacity pulse
      for (let si = 0; si < lightShaftsRef.current.length; si++) {
        const shaft = lightShaftsRef.current[si];
        const sm = shaft.material as THREE.MeshBasicMaterial;
        const baseOpacity = 0.012;
        const pulse = baseOpacity + Math.sin(time * 0.15 + si * 1.2) * 0.004;
        // Brighter as gathering progresses
        const progressBoost = phase === 'primordial' ? 0 : (phase === 'emergence' ? 0.015 : p * 0.008);
        sm.opacity = pulse + progressBoost;
        shaft.rotation.z += Math.sin(time * 0.03 + si) * 0.00008;
      }

      // Animate halo ring
      const halo = haloRingRef.current;
      if (halo) {
        const hm = halo.material as THREE.MeshBasicMaterial;
        if (phase === 'forming') {
          const fp = (p - 0.74) / 0.13;
          halo.visible = true;
          halo.rotation.z = time * 0.06;
          halo.scale.setScalar(0.4 + fp * 0.6);
          hm.opacity = fp * 0.06;
        } else if (phase === 'emergence') {
          halo.visible = true;
          halo.rotation.z = time * 0.03;
          halo.scale.setScalar(1.0 + Math.sin(time * 0.2) * 0.04);
          hm.opacity = 0.03 + Math.sin(time * 0.3) * 0.01;
        } else {
          halo.visible = false;
        }
      }


      // Animate mist layers - gentle undulation
      for (let mi = 0; mi < mistLayersRef.current.length; mi++) {
        const ml = mistLayersRef.current[mi];
        const mlm = ml.material as THREE.MeshBasicMaterial;
        ml.position.y += Math.sin(time * 0.08 + mi * 2.0) * 0.0002;
        // Mist clears slightly during emergence (morning)
        if (phase === 'emergence') {
          mlm.opacity *= 0.97;
        }
      }

      // Animate falling leaves - gentle descent and sway
      for (const leaf of leafMeshesRef.current) {
        const ud = leaf.userData as any;
        // Fall down slowly
        leaf.position.y -= ud.fallSpeed * 0.016;
        // Sway horizontally
        leaf.position.x = ud.baseX + Math.sin(time * ud.swaySpeed + ud.phase) * ud.swayAmount;
        // Rotate as falling
        leaf.rotation.x += ud.rotSpeed * 0.008;
        leaf.rotation.z += ud.rotSpeed * 0.005;
        // Reset when reaching ground
        if (leaf.position.y < 0.1) {
          leaf.position.y = ud.baseY + 5;
          leaf.position.x = ud.baseX;
        }
      }

     // Animate creature silhouette - gentle emergence
     const creature = creatureRef.current;
     if (creature) {
       if (phase === 'emergence') {
         const ep = (p - 0.87) / 0.13;
         creature.visible = true;
          // Gradual materialization: eyes appear first, then body solidifies
          // Eyes emerge early (ep 0.0-0.3), body follows (ep 0.2-0.8), full by 0.9
          const eyeProgress = Math.min(1.0, ep / 0.35);
          const bodyProgress = Math.max(0, Math.min(1.0, (ep - 0.15) / 0.65));
          const markingProgress = Math.max(0, Math.min(1.0, (ep - 0.35) / 0.55));

          creature.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mat = child.material as THREE.MeshBasicMaterial;
              const matColor = mat.color;
              if (matColor && matColor.getHex() === 0xfdfae4) {
                // Eyes: appear first and glow brightly
                mat.opacity = eyeProgress * 0.95;
              } else if (child.name === 'creatureAura') {
                // Aura: strong early, fading as body solidifies
                mat.opacity = (1.0 - bodyProgress * 0.7) * 0.25 * (0.85 + Math.sin(time * 0.6) * 0.15);
              } else if (matColor && matColor.getHex() === 0x383e48) {
                // Dark markings: appear after body starts forming
                mat.opacity = markingProgress * 0.75;
              } else {
                // Golden body: gradual solidification
                mat.opacity = bodyProgress * 0.85;
              }
            }
          });

         // Gentle breathing motion, very subtle
          const breathe = Math.sin(time * 0.4) * 0.018;
          creature.scale.setScalar(0.88 + ep * 0.12 + breathe);
         // Slight head tilt - curious, alive
         creature.rotation.z = Math.sin(time * 0.3) * 0.04;
          // Gentle settling motion - descends slightly as it materializes
          creature.position.y = 2.5 + (1.0 - ep) * 0.3 + Math.sin(time * 0.4) * 0.03;
       } else if (phase === 'forming') {
         // Start to hint at form - very late in forming phase
         const fp = (p - 0.74) / 0.13;
         creature.visible = fp > 0.65;
         if (fp > 0.65) {
            const hintProgress = (fp - 0.65) / 0.35;
            // Aura appears first, body is just a faint shimmer
           creature.traverse((child) => {
             if (child instanceof THREE.Mesh) {
                const mat = child.material as THREE.MeshBasicMaterial;
                if (child.name === 'creatureAura') {
                  mat.opacity = hintProgress * 0.12;
                } else {
                  mat.opacity = hintProgress * 0.05;
                }
             }
           });
            creature.scale.setScalar(0.85 + fp * 0.03 + Math.sin(time * 0.3) * 0.01);
         }
       } else {
         creature.visible = false;
       }
     }


      // Moon subtle animation - gentle glow pulse
      const moon = moonRef.current;
      if (moon) {
        const moonMesh = moon.children[0] as THREE.Mesh;
        const moonHalo = moon.children[1] as THREE.Mesh;
        if (moonMesh && moonHalo) {
          const mm = moonMesh.material as THREE.MeshBasicMaterial;
          const hm = moonHalo.material as THREE.MeshBasicMaterial;
          // Gentle pulse
          mm.opacity = 0.35 + Math.sin(time * 0.15) * 0.03;
          hm.opacity = 0.06 + Math.sin(time * 0.2 + 1.0) * 0.01;
          // Slight position drift
          moon.position.x = Math.sin(time * 0.02) * 0.3;
          moon.position.y = Math.cos(time * 0.015) * 0.15;
        }
      }

      // Dynamic bloom intensity - builds slowly
      if (bloomPassRef.current) {
        let bloomStrength = 0.4;
        if (phase === 'primordial') bloomStrength = 0.25;
        else if (phase === 'awakening') bloomStrength = 0.3 + ((p - 0.20) / 0.20) * 0.1;
        else if (phase === 'drifting') bloomStrength = 0.4 + ((p - 0.40) / 0.18) * 0.12;
        else if (phase === 'weaving') bloomStrength = 0.52 + ((p - 0.58) / 0.16) * 0.18;
        else if (phase === 'forming') bloomStrength = 0.7 + ((p - 0.74) / 0.13) * 0.2;
        else if (phase === 'emergence') bloomStrength = 0.9 + Math.sin(time * 0.3) * 0.08;
        bloomPassRef.current.strength = bloomStrength;
      }

      // Core sphere - very gradual formation
      const coreMesh = coreMeshRef.current;
      if (coreMesh) {
        const cm = coreMesh.material as THREE.ShaderMaterial;
        cm.uniforms.uTime.value = time;
        if (phase === 'forming') {
          const fp = (p - 0.74) / 0.13;
          coreMesh.visible = true;
          coreMesh.scale.setScalar(0.2 + fp * 0.7);
          cm.uniforms.uIntensity.value = fp * 0.6;
        } else if (phase === 'emergence') {
          coreMesh.visible = true;
          coreMesh.scale.setScalar(0.85 + Math.sin(time * 0.4) * 0.06);
          cm.uniforms.uIntensity.value = 0.4 + Math.sin(time * 0.4) * 0.1;
        } else {
          coreMesh.visible = false;
        }
      }

      const coreGlow = coreGlowRef.current;
      if (coreGlow) {
        const gm = coreGlow.material as THREE.MeshBasicMaterial;
        if (phase === 'forming') {
          const fp = (p - 0.74) / 0.13;
          coreGlow.visible = true;
          coreGlow.scale.setScalar(0.3 + fp * 1.2);
          gm.opacity = fp * 0.1;
        } else if (phase === 'emergence') {
          coreGlow.visible = true;
          coreGlow.scale.setScalar(1.4 + Math.sin(time * 0.4) * 0.12);
          gm.opacity = 0.05 + Math.sin(time * 0.4) * 0.015;
        } else {
          coreGlow.visible = false;
        }
      }

      // Lights - very gradual intensity build
      const sl = spiritLightRef.current;
      if (sl) {
        if (phase === 'awakening') sl.intensity = ((p - 0.20) / 0.20) * 1.0;
        else if (phase === 'drifting') sl.intensity = 1.0 + ((p - 0.40) / 0.18) * 1.2;
        else if (phase === 'weaving') sl.intensity = 2.2 + ((p - 0.58) / 0.16) * 1.8;
        else if (phase === 'forming') sl.intensity = 4.0 + ((p - 0.74) / 0.13) * 2.5;
        else if (phase === 'emergence') sl.intensity = 2.0 + Math.sin(time * 0.4) * 0.3;
        else sl.intensity = 0;
      }

      const wl = warmLightRef.current;
      if (wl) {
        if (phase === 'weaving') wl.intensity = ((p - 0.58) / 0.16) * 1.2;
        else if (phase === 'forming') wl.intensity = 1.2 + ((p - 0.74) / 0.13) * 1.0;
        else if (phase === 'emergence') wl.intensity = 0.6 + Math.sin(time * 0.3) * 0.15;
        else wl.intensity = 0;
      }


      // Fog - subtle changes + progressive warmth
      if (scene.fog instanceof THREE.FogExp2) {
        if (phase === 'drifting' || phase === 'weaving') {
          scene.fog.density = Math.max(0.016, 0.024 - (p - 0.40) * 0.012);
        } else if (phase === 'forming') {
          scene.fog.density = 0.020 - ((p - 0.74) / 0.13) * 0.004;
        } else if (phase === 'emergence') {
          // Morning clearing - fog lifts slowly
          const ep = (p - 0.87) / 0.13;
          scene.fog.density = 0.018 - ep * 0.006;
          // Gradual warm color shift - dawn breaking very slowly
          const bg = scene.background as THREE.Color;
          bg.setRGB(
            0.04 + ep * 0.05,
            0.08 + ep * 0.03,
            0.06 + ep * 0.01
          );
          scene.fog.color.copy(bg);
          renderer.toneMappingExposure = 1.0 + ep * 0.25;
        } else {
          scene.fog.density = 0.024;
          renderer.toneMappingExposure = 1.0;
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
