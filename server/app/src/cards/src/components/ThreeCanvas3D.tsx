import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ThemeMode } from '../types';

interface ThreeCanvas3DProps {
  progress: number;
  dragRotateY: number;
  mouseX: number;
  mouseY: number;
  theme: ThemeMode;
  onSphereClick?: () => void;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export const ThreeCanvas3D: React.FC<ThreeCanvas3DProps> = ({
  progress,
  dragRotateY,
  mouseX,
  mouseY,
  theme,
  onSphereClick,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // 3D Objects refs
  const sphereGroupRef = useRef<THREE.Group | null>(null);
  const sphereMeshRef = useRef<THREE.Mesh | null>(null);
  const outerRingRef = useRef<THREE.Mesh | null>(null);
  const innerRingRef = useRef<THREE.Mesh | null>(null);

  const platformGroupRef = useRef<THREE.Group | null>(null);
  const platformMeshRef = useRef<THREE.Mesh | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);

  const backLeavesGroupRef = useRef<THREE.Group | null>(null);
  const frontLeavesGroupRef = useRef<THREE.Group | null>(null);

  const mainGroupRef = useRef<THREE.Group | null>(null);

  // Lights refs
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.PointLight | null>(null);

  // Material refs for dynamic theme color updates
  const sphereMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const topGrassMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sideSoilMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const leafDarkMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const leafMidMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const leafLightMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const currentThemeRef = useRef<ThemeMode | null>(null);
  // Spirit model refs
  const deerSpiritRef = useRef<THREE.Group | null>(null);
  const whaleSpiritRef = useRef<THREE.Group | null>(null);
  const blobSpiritRef = useRef<THREE.Group | null>(null);
  const spiritGroupRef = useRef<THREE.Group | null>(null);

  // Animation state refs
  const leafAnimationDataRef = useRef<{mesh: THREE.Mesh; baseRotX: number; baseRotY: number; baseRotZ: number; phase: number; speed: number}[]>([]);
  const fireflyDataRef = useRef<{mesh: THREE.Mesh; basePos: THREE.Vector3; speed: number; phase: number}[]>([]);
  const grassBladesRef = useRef<{mesh: THREE.Mesh; baseRotX: number; baseRotZ: number; phase: number; speed: number; height: number}[]>([]);
  const spiritParticleTrailsRef = useRef<{mesh: THREE.Mesh; orbitRadius: number; orbitSpeed: number; orbitPhase: number; orbitHeight: number; parentGroup: THREE.Group}[]>([]);


  // Store current props in ref for animation loop
  const propsRef = useRef({ progress, dragRotateY, mouseX, mouseY, theme });
  propsRef.current = { progress, dragRotateY, mouseX, mouseY, theme };

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 400;
    const height = containerRef.current.clientHeight || 320;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera with 45° Top-Down Isometric Perspective (俯视 45°)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 5.5, 5.5); // (y=5.5, z=5.5) creates exact 45-degree tilt
    camera.lookAt(0, -0.2, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    containerRef.current.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    dirLight.position.set(5, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    const rimLight = new THREE.PointLight(0x38bdf8, 3.0, 15);
    rimLight.position.set(-6, 4, -4);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    const fillLight = new THREE.PointLight(0xfef08a, 1.8, 12);
    fillLight.position.set(4, -3, 5);
    scene.add(fillLight);

    // 5. Main Root Group (responds to overall mouse parallax & drag rotation)
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    mainGroupRef.current = mainGroup;

    // Shared Leaf Materials
    const leafDarkMat = new THREE.MeshStandardMaterial({
      color: 0x243719,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const leafMidMat = new THREE.MeshStandardMaterial({
      color: 0x476e33,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const leafLightMat = new THREE.MeshStandardMaterial({
      color: 0x7ba659,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    leafDarkMatRef.current = leafDarkMat;
    leafMidMatRef.current = leafMidMat;
    leafLightMatRef.current = leafLightMat;

    // ================= A. 3D CELESTIAL SPHERE MODEL (完全不透明 3D 球体) =================
    const sphereGroup = new THREE.Group();
    sphereGroup.position.set(0, 0.55, 0);
    mainGroup.add(sphereGroup);
    sphereGroupRef.current = sphereGroup;

    // Sphere Mesh with OPAQUE PBR Physical Material
    const sphereGeo = new THREE.SphereGeometry(1.22, 64, 64);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffdf0,
      roughness: 0.22,
      metalness: 0.08,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      emissive: 0x7ba659,
      emissiveIntensity: 0.12,
      transmission: 0, // 100% Opaque solid sphere
      opacity: 1.0,
      transparent: false,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.castShadow = true;
    sphereMesh.receiveShadow = true;
    sphereGroup.add(sphereMesh);
    sphereMeshRef.current = sphereMesh;
    sphereMatRef.current = sphereMat;

    // Inner Core Glow (subtle accent)
    const coreGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.35,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    sphereGroup.add(coreMesh);
    coreMatRef.current = coreMat;
    // Sphere outer halo ring (subtle glow effect)
    const haloRingGeo = new THREE.RingGeometry(1.25, 1.45, 64);
    const haloRingMat = new THREE.MeshBasicMaterial({
      color: 0xfaf5dc,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const haloRing = new THREE.Mesh(haloRingGeo, haloRingMat);
    haloRing.rotation.x = -Math.PI / 2;
    sphereGroup.add(haloRing);



    // ================= B. 3D ISOMETRIC GROUND PLATFORM MODEL (THIN FLAT SLICE / 薄层地面) =================
    const platformGroup = new THREE.Group();
    platformGroup.position.set(0, -0.55, 0);
    mainGroup.add(platformGroup);
    platformGroupRef.current = platformGroup;

    // Create 3D Flat Square Slab (Exact mathematical square)
    const slabShape = new THREE.Shape();
    const size = 2.05; // base radius
    slabShape.moveTo(0, size);
    slabShape.lineTo(size, 0);
    slabShape.lineTo(0, -size);
    slabShape.lineTo(-size, 0);
    slabShape.closePath();

    // Very thin layer depth (薄薄的一层地面)
    const extrudeSettings = {
      steps: 1,
      depth: 0.04, // Ultra thin slice depth
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    };

    const platformGeo = new THREE.ExtrudeGeometry(slabShape, extrudeSettings);
    // Orient to tilt in isometric perspective (lie flat horizontally)
    platformGeo.rotateX(-Math.PI / 2);

    // Multi-Material: Top Grass Face + Side Earth/Stone Walls
    const topGrassMat = new THREE.MeshStandardMaterial({
      color: 0x537b3d,
      roughness: 0.55,
      metalness: 0.05,
    });
    const sideSoilMat = new THREE.MeshStandardMaterial({
      color: 0x243719,
      roughness: 0.80,
      metalness: 0.08,
    });
    topGrassMatRef.current = topGrassMat;
    sideSoilMatRef.current = sideSoilMat;

    const platformMesh = new THREE.Mesh(platformGeo, [topGrassMat, sideSoilMat]);
    platformMesh.castShadow = true;
    platformMesh.receiveShadow = true;
    platformGroup.add(platformMesh);
    platformMeshRef.current = platformMesh;

    // ================= 3D ANIME SOFT ORGANIC LEAF BRANCHES (动漫风柔软立耳草叶) =================
    // Helper function to build plumper, softer anime-style leaf blades with rounded tips & outward curve
    const createAnimeLeafMesh = (
      width: number,
      height: number,
      mat: THREE.MeshStandardMaterial,
      posX: number,
      posZ: number,
      rotY: number,
      rotZ: number,
      rotX: number = 0,
      outwardBend: number = 0.28
    ) => {
      const shape = new THREE.Shape();
      // Improved organic leaf silhouette using bezier curves
      shape.moveTo(0, 0);
      shape.bezierCurveTo(
        -width * 0.6, height * 0.25,
        -width * 0.85, height * 0.55,
        -width * 0.15, height * 0.92
      );
      shape.quadraticCurveTo(0, height * 1.02, width * 0.15, height * 0.92);
      shape.bezierCurveTo(
        width * 0.85, height * 0.55,
        width * 0.6, height * 0.25,
        0, 0
      );

      // Bevel settings create soft, rounded, cushiony anime edges
      const leafExtrudeSettings = {
        steps: 8,
        depth: 0.03,
        bevelEnabled: true,
        bevelThickness: 0.028,
        bevelSize: 0.028,
        bevelSegments: 4,
      };

      const geo = new THREE.ExtrudeGeometry(shape, leafExtrudeSettings);

      // Curve geometry outward gracefully away from the sphere to prevent any clipping
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const yVal = posAttr.getY(i);
        const t = Math.max(0, yVal / height);
        // Smooth outward arc with subtle twist for organic feel
        const zShift = Math.pow(t, 1.5) * outwardBend;
        const twist = Math.sin(t * Math.PI) * 0.02;
        posAttr.setZ(i, posAttr.getZ(i) + zShift);
        posAttr.setX(i, posAttr.getX(i) + twist);
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(posX, 0.02, posZ);
      mesh.rotation.x = rotX;
      mesh.rotation.y = rotY;
      mesh.rotation.z = rotZ;

      // Add center vein line for detail
      const veinGeo = new THREE.BufferGeometry();
      const veinPoints = [];
      for (let t = 0; t <= 1; t += 0.1) {
        const vy = t * height;
        const vz = Math.pow(t, 1.5) * outwardBend + 0.035;
        veinPoints.push(new THREE.Vector3(0, vy, vz));
      }
      veinGeo.setFromPoints(veinPoints);
      const veinMat = new THREE.LineBasicMaterial({
        color: mat.color.getHex(),
        transparent: true,
        opacity: 0.4,
      });
      // Make vein slightly darker
      veinMat.color.multiplyScalar(0.7);
      const veinLine = new THREE.Line(veinGeo, veinMat);
      mesh.add(veinLine);

      return mesh;
    };

    const backLeavesGroup = new THREE.Group();
    const frontLeavesGroup = new THREE.Group();

    // 1. Back Left & Right Ear Leaves (standing tall behind sphere at safe radius r >= 1.55)
    backLeavesGroup.add(createAnimeLeafMesh(0.42, 2.05, leafDarkMat, -0.80, -1.40, 0.22, 0.18, -0.25, 0.35));
    backLeavesGroup.add(createAnimeLeafMesh(0.38, 1.80, leafMidMat, -1.20, -1.15, 0.38, 0.26, -0.28, 0.32));
    backLeavesGroup.add(createAnimeLeafMesh(0.34, 1.55, leafLightMat, -0.50, -1.55, 0.12, 0.12, -0.20, 0.28));

    backLeavesGroup.add(createAnimeLeafMesh(0.42, 2.05, leafDarkMat, 0.80, -1.40, -0.22, -0.18, -0.25, 0.35));
    backLeavesGroup.add(createAnimeLeafMesh(0.38, 1.80, leafMidMat, 1.20, -1.15, -0.38, -0.26, -0.28, 0.32));
    backLeavesGroup.add(createAnimeLeafMesh(0.34, 1.55, leafLightMat, 0.50, -1.55, -0.12, -0.12, -0.20, 0.28));

    // 2. Front & Side Ear Leaves (framing the ground at safe radius r >= 1.55)
    frontLeavesGroup.add(createAnimeLeafMesh(0.36, 1.50, leafMidMat, -1.50, 0.45, 0.52, 0.32, 0.22, 0.28));
    frontLeavesGroup.add(createAnimeLeafMesh(0.36, 1.50, leafMidMat, 1.50, 0.45, -0.52, -0.32, 0.22, 0.28));

    frontLeavesGroup.add(createAnimeLeafMesh(0.36, 1.60, leafMidMat, -0.80, 1.40, 0.26, 0.18, 0.28, 0.32));
    frontLeavesGroup.add(createAnimeLeafMesh(0.32, 1.40, leafLightMat, -0.42, 1.55, 0.16, 0.12, 0.24, 0.28));
    frontLeavesGroup.add(createAnimeLeafMesh(0.36, 1.60, leafMidMat, 0.80, 1.40, -0.26, -0.18, 0.28, 0.32));
    frontLeavesGroup.add(createAnimeLeafMesh(0.32, 1.40, leafLightMat, 0.42, 1.55, -0.16, -0.12, 0.24, 0.28));
    frontLeavesGroup.add(createAnimeLeafMesh(0.30, 1.15, leafLightMat, -1.25, 1.00, 0.42, 0.25, 0.22, 0.25));
    frontLeavesGroup.add(createAnimeLeafMesh(0.30, 1.15, leafLightMat, 1.25, 1.00, -0.42, -0.25, 0.22, 0.25));

    backLeavesGroupRef.current = backLeavesGroup;
    frontLeavesGroupRef.current = frontLeavesGroup;

    platformGroup.add(backLeavesGroup);
    platformGroup.add(frontLeavesGroup);
    // Store leaf animation data for wind sway
    const leafAnimData: typeof leafAnimationDataRef.current = [];
    backLeavesGroup.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        leafAnimData.push({
          mesh: child,
          baseRotX: child.rotation.x,
          baseRotY: child.rotation.y,
          baseRotZ: child.rotation.z,
          phase: i * 0.8,
          speed: 0.8 + Math.random() * 0.4
        });
      }
    });
    frontLeavesGroup.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        leafAnimData.push({
          mesh: child,
          baseRotX: child.rotation.x,
          baseRotY: child.rotation.y,
          baseRotZ: child.rotation.z,
          phase: (i + backLeavesGroup.children.length) * 0.8,
          speed: 0.8 + Math.random() * 0.4
        });
      }
    });
    leafAnimationDataRef.current = leafAnimData;



    // ================= 3D MAGICAL FIREFLY / SPIRIT ORB PARTICLES =================
    const fireflyGroup = new THREE.Group();
    const fireflyGeo = new THREE.SphereGeometry(0.04, 12, 12);
    const fireflyMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
    });

    const fireflyData: typeof fireflyDataRef.current = [];
    for (let i = 0; i < 16; i++) {
      const fMesh = new THREE.Mesh(fireflyGeo, fireflyMat);
      const angle = (i / 16) * Math.PI * 2;
      const rad = 1.2 + Math.random() * 1.2;
      const basePos = new THREE.Vector3(
        Math.cos(angle) * rad,
        0.2 + Math.random() * 2.2,
        Math.sin(angle) * rad
      );
      fMesh.position.copy(basePos);
      fireflyGroup.add(fMesh);
      fireflyData.push({
        mesh: fMesh,
        basePos,
        speed: 0.8 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    fireflyDataRef.current = fireflyData;
    mainGroup.add(fireflyGroup);
    // ================= 3D SPIRIT MODELS (鹿/鲸鱼/团子) =================
    const spiritGroup = new THREE.Group();
    spiritGroup.position.set(0, 0, 0);
    mainGroup.add(spiritGroup);
    spiritGroupRef.current = spiritGroup;

    // Helper: Create spirit body material (translucent milk white)
    const createSpiritMaterial = (glowColor: number) => {
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.05,
        transmission: 0.15,
        thickness: 0.5,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        emissive: glowColor,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.92,
      });
    };

    // --- DEER SPIRIT (小鹿精灵) - Left side ---
    const deerGroup = new THREE.Group();
    deerGroup.position.set(-1.2, 0.35, 0.8);
    deerGroup.scale.set(0.55, 0.55, 0.55);
    spiritGroup.add(deerGroup);
    deerSpiritRef.current = deerGroup;

    const deerBodyMat = createSpiritMaterial(0xfef08a);

    // Deer body (rounded sphere)
    const deerBodyGeo = new THREE.SphereGeometry(0.28, 32, 32);
    const deerBody = new THREE.Mesh(deerBodyGeo, deerBodyMat);
    deerBody.castShadow = true;
    deerGroup.add(deerBody);

    // Deer inner glow core
    const deerCoreGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const deerCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.4,
    });
    const deerCore = new THREE.Mesh(deerCoreGeo, deerCoreMat);
    deerGroup.add(deerCore);

    // Deer ears (two pointed ears)
    const earGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const leftEar = new THREE.Mesh(earGeo, deerBodyMat);
    leftEar.position.set(-0.18, 0.22, 0);
    leftEar.scale.set(0.7, 1.3, 0.6);
    leftEar.rotation.z = 0.3;
    deerGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, deerBodyMat);
    rightEar.position.set(0.18, 0.22, 0);
    rightEar.scale.set(0.7, 1.3, 0.6);
    rightEar.rotation.z = -0.3;
    deerGroup.add(rightEar);

    // Deer antlers (branching white structures)
    const antlerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0xfef08a,
      emissiveIntensity: 0.2,
    });

    const createAntlerBranch = (x: number, z: number, rotZ: number, length: number) => {
      const antlerGeo = new THREE.CylinderGeometry(0.015, 0.02, length, 8);
      const antler = new THREE.Mesh(antlerGeo, antlerMat);
      antler.position.set(x, 0.35, z);
      antler.rotation.z = rotZ;
      return antler;
    };

    deerGroup.add(createAntlerBranch(-0.12, 0, 0.4, 0.18));
    deerGroup.add(createAntlerBranch(-0.18, 0, 0.6, 0.12));
    deerGroup.add(createAntlerBranch(0.12, 0, -0.4, 0.18));
    deerGroup.add(createAntlerBranch(0.18, 0, -0.6, 0.12));

    // Deer eyes (dark with white highlights)
    const eyeGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const highlightGeo = new THREE.SphereGeometry(0.008, 12, 12);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08, 0.05, 0.25);
    deerGroup.add(leftEye);
    const leftHighlight = new THREE.Mesh(highlightGeo, highlightMat);
    leftHighlight.position.set(-0.085, 0.055, 0.26);
    deerGroup.add(leftHighlight);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.08, 0.05, 0.25);
    deerGroup.add(rightEye);
    const rightHighlight = new THREE.Mesh(highlightGeo, highlightMat);
    rightHighlight.position.set(0.075, 0.055, 0.26);
    deerGroup.add(rightHighlight);

    // Deer blush (orange ovals)
    const blushGeo = new THREE.SphereGeometry(0.03, 16, 16);
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.6,
    });
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-0.12, 0.02, 0.24);
    leftBlush.scale.set(1.2, 0.6, 0.5);
    deerGroup.add(leftBlush);
    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(0.12, 0.02, 0.24);
    rightBlush.scale.set(1.2, 0.6, 0.5);
    deerGroup.add(rightBlush);

    // Deer nose (small pink dot)
    const noseGeo = new THREE.SphereGeometry(0.015, 12, 12);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xfda4af });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0.02, 0.27);
    deerGroup.add(nose);

    // Deer ground glow
    const glowGeo = new THREE.CircleGeometry(0.35, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const deerGlow = new THREE.Mesh(glowGeo, glowMat);
    deerGlow.rotation.x = -Math.PI / 2;
    deerGlow.position.set(0, -0.35, 0);
    deerGroup.add(deerGlow);

    // --- WHALE SPIRIT (鲸鱼精灵) - Right side ---
    const whaleGroup = new THREE.Group();
    whaleGroup.position.set(1.1, 0.25, 0.5);
    whaleGroup.scale.set(0.55, 0.55, 0.55);
    spiritGroup.add(whaleGroup);
    whaleSpiritRef.current = whaleGroup;

    const whaleBodyMat = createSpiritMaterial(0x74b9ff);

    // Whale body (elongated sphere)
    const whaleBodyGeo = new THREE.SphereGeometry(0.32, 32, 32);
    const whaleBody = new THREE.Mesh(whaleBodyGeo, whaleBodyMat);
    whaleBody.scale.set(1.4, 1, 1);
    whaleBody.castShadow = true;
    whaleGroup.add(whaleBody);

    // Whale inner glow
    const whaleCoreGeo = new THREE.SphereGeometry(0.22, 24, 24);
    const whaleCoreMat = new THREE.MeshBasicMaterial({
      color: 0x74b9ff,
      transparent: true,
      opacity: 0.4,
    });
    const whaleCore = new THREE.Mesh(whaleCoreGeo, whaleCoreMat);
    whaleGroup.add(whaleCore);

    // Whale tail (flattened sphere)
    const tailGeo = new THREE.SphereGeometry(0.15, 24, 24);
    const tail = new THREE.Mesh(tailGeo, whaleBodyMat);
    tail.position.set(0.42, 0, 0);
    tail.scale.set(1.2, 0.4, 1);
    tail.rotation.z = 0.3;
    whaleGroup.add(tail);

    // Whale spout (water fountain - 3 small spheres)
    const spoutMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    const spoutGeo = new THREE.SphereGeometry(0.03, 12, 12);
    const spout1 = new THREE.Mesh(spoutGeo, spoutMat);
    spout1.position.set(-0.15, 0.32, 0);
    whaleGroup.add(spout1);
    const spout2 = new THREE.Mesh(spoutGeo, spoutMat);
    spout2.position.set(-0.15, 0.40, 0.03);
    whaleGroup.add(spout2);
    const spout3 = new THREE.Mesh(spoutGeo, spoutMat);
    spout3.position.set(-0.15, 0.32, -0.03);
    whaleGroup.add(spout3);

    // Whale flipper
    const flipperGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const flipper = new THREE.Mesh(flipperGeo, whaleBodyMat);
    flipper.position.set(-0.05, -0.15, 0.2);
    flipper.scale.set(1.5, 0.4, 1);
    flipper.rotation.x = -0.3;
    whaleGroup.add(flipper);

    // Whale eyes
    const whaleEyeGeo = new THREE.SphereGeometry(0.02, 16, 16);
    const whaleEyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const whaleLeftEye = new THREE.Mesh(whaleEyeGeo, whaleEyeMat);
    whaleLeftEye.position.set(-0.28, 0.08, 0.22);
    whaleGroup.add(whaleLeftEye);

    // Whale smile (torus arc)
    const smileGeo = new THREE.TorusGeometry(0.06, 0.01, 8, 16, Math.PI);
    const smileMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.position.set(-0.32, 0.02, 0.22);
    smile.rotation.y = Math.PI / 2;
    smile.rotation.z = Math.PI;
    whaleGroup.add(smile);

    // Whale blush
    const whaleBlush = new THREE.Mesh(blushGeo, blushMat);
    whaleBlush.position.set(-0.25, 0.04, 0.24);
    whaleBlush.scale.set(1.2, 0.6, 0.5);
    whaleGroup.add(whaleBlush);

    // Whale ground glow
    const whaleGlow = new THREE.Mesh(glowGeo, glowMat.clone());
    (whaleGlow.material as THREE.MeshBasicMaterial).color.setHex(0x74b9ff);
    whaleGlow.rotation.x = -Math.PI / 2;
    whaleGlow.position.set(0, -0.32, 0);
    whaleGroup.add(whaleGlow);

    // --- BLOB SPIRIT (团子精灵) - Front center ---
    const blobGroup = new THREE.Group();
    blobGroup.position.set(0, 0.2, 1.3);
    blobGroup.scale.set(0.55, 0.55, 0.55);
    spiritGroup.add(blobGroup);
    blobSpiritRef.current = blobGroup;

    const blobBodyMat = createSpiritMaterial(0xfef08a);

    // Blob body (round sphere)
    const blobBodyGeo = new THREE.SphereGeometry(0.26, 32, 32);
    const blobBody = new THREE.Mesh(blobBodyGeo, blobBodyMat);
    blobBody.castShadow = true;
    blobGroup.add(blobBody);

    // Blob inner glow
    const blobCoreGeo = new THREE.SphereGeometry(0.17, 24, 24);
    const blobCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.4,
    });
    const blobCore = new THREE.Mesh(blobCoreGeo, blobCoreMat);
    blobGroup.add(blobCore);

    // Blob ear tufts
    const tuftGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const leftTuft = new THREE.Mesh(tuftGeo, blobBodyMat);
    leftTuft.position.set(-0.15, 0.2, 0);
    leftTuft.scale.set(0.8, 1.2, 0.8);
    blobGroup.add(leftTuft);
    const rightTuft = new THREE.Mesh(tuftGeo, blobBodyMat);
    rightTuft.position.set(0.15, 0.2, 0);
    rightTuft.scale.set(0.8, 1.2, 0.8);
    blobGroup.add(rightTuft);

    // Blob halo ring (floating above head)
    const haloGeo = new THREE.TorusGeometry(0.18, 0.02, 16, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0, 0.38, 0);
    halo.rotation.x = Math.PI / 2;
    blobGroup.add(halo);

    // Blob happy eyes (^_^ arcs)
    const happyEyeGeo = new THREE.TorusGeometry(0.04, 0.008, 8, 16, Math.PI);
    const happyEyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const leftHappyEye = new THREE.Mesh(happyEyeGeo, happyEyeMat);
    leftHappyEye.position.set(-0.08, 0.08, 0.24);
    leftHappyEye.rotation.z = Math.PI;
    blobGroup.add(leftHappyEye);
    const rightHappyEye = new THREE.Mesh(happyEyeGeo, happyEyeMat);
    rightHappyEye.position.set(0.08, 0.08, 0.24);
    rightHappyEye.rotation.z = Math.PI;
    blobGroup.add(rightHappyEye);

    // Blob mouth (small curve)
    const mouthGeo = new THREE.TorusGeometry(0.025, 0.006, 8, 12, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 0.02, 0.25);
    blobGroup.add(mouth);

    // Blob blush
    const blobLeftBlush = new THREE.Mesh(blushGeo, blushMat);
    blobLeftBlush.position.set(-0.12, 0.04, 0.23);
    blobLeftBlush.scale.set(1.2, 0.6, 0.5);
    blobGroup.add(blobLeftBlush);
    const blobRightBlush = new THREE.Mesh(blushGeo, blushMat);
    blobRightBlush.position.set(0.12, 0.04, 0.23);
    blobRightBlush.scale.set(1.2, 0.6, 0.5);
    blobGroup.add(blobRightBlush);

    // Blob ground glow
    const blobGlow = new THREE.Mesh(glowGeo, glowMat.clone());
    blobGlow.rotation.x = -Math.PI / 2;
    blobGlow.position.set(0, -0.32, 0);
    blobGroup.add(blobGlow);

    // ================= SPIRIT PARTICLE TRAILS =================
    // Orbiting magical particles around each spirit
    const spiritParticleData: typeof spiritParticleTrailsRef.current = [];
    const trailParticleGeo = new THREE.SphereGeometry(0.012, 8, 8);
    
    // Deer spirit particles
    for (let i = 0; i < 6; i++) {
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.7,
      });
      const trailMesh = new THREE.Mesh(trailParticleGeo, trailMat);
      spiritGroup.add(trailMesh);
      spiritParticleData.push({
        mesh: trailMesh,
        orbitRadius: 0.25 + Math.random() * 0.15,
        orbitSpeed: 0.8 + Math.random() * 0.6,
        orbitPhase: (i / 6) * Math.PI * 2,
        orbitHeight: -0.1 + Math.random() * 0.3,
        parentGroup: deerGroup,
      });
    }
    
    // Whale spirit particles
    for (let i = 0; i < 6; i++) {
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0x74b9ff,
        transparent: true,
        opacity: 0.7,
      });
      const trailMesh = new THREE.Mesh(trailParticleGeo, trailMat);
      spiritGroup.add(trailMesh);
      spiritParticleData.push({
        mesh: trailMesh,
        orbitRadius: 0.3 + Math.random() * 0.15,
        orbitSpeed: 0.6 + Math.random() * 0.5,
        orbitPhase: (i / 6) * Math.PI * 2 + 1.0,
        orbitHeight: -0.05 + Math.random() * 0.25,
        parentGroup: whaleGroup,
      });
    }
    
    // Blob spirit particles
    for (let i = 0; i < 5; i++) {
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.7,
      });
      const trailMesh = new THREE.Mesh(trailParticleGeo, trailMat);
      spiritGroup.add(trailMesh);
      spiritParticleData.push({
        mesh: trailMesh,
        orbitRadius: 0.22 + Math.random() * 0.12,
        orbitSpeed: 1.0 + Math.random() * 0.5,
        orbitPhase: (i / 5) * Math.PI * 2 + 2.0,
        orbitHeight: -0.08 + Math.random() * 0.3,
        parentGroup: blobGroup,
      });
    }
    spiritParticleTrailsRef.current = spiritParticleData;




    // ================= PLATFORM GRASS BLADES =================
    // Add small grass blade cones scattered on platform surface for more detail
    const grassBladeMat = new THREE.MeshStandardMaterial({
      color: 0x7ba659,
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Create varied grass blades with different heights
    const grassBladeData: typeof grassBladesRef.current = [];
    for (let i = 0; i < 60; i++) {
      const height = 0.05 + Math.random() * 0.12;
      const grassBladeGeo = new THREE.ConeGeometry(0.012, height, 4);
      const blade = new THREE.Mesh(grassBladeGeo, grassBladeMat);
      // Random position on diamond platform
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 1.6;
      blade.position.set(
        Math.cos(angle) * radius,
        0.04,
        Math.sin(angle) * radius
      );
      const baseRotX = (Math.random() - 0.5) * 0.2;
      const baseRotZ = (Math.random() - 0.5) * 0.3;
      blade.rotation.x = baseRotX;
      blade.rotation.z = baseRotZ;
      // Vary the green color slightly
      const grassColor = new THREE.Color().setHSL(0.28 + Math.random() * 0.08, 0.5, 0.35 + Math.random() * 0.15);
      (blade.material as THREE.MeshStandardMaterial).color = grassColor;
      platformGroup.add(blade);
      
      grassBladeData.push({
        mesh: blade,
        baseRotX: baseRotX,
        baseRotZ: baseRotZ,
        phase: i * 0.5 + Math.random() * 2,
        speed: 0.8 + Math.random() * 0.6,
        height: height
      });
    }
    grassBladesRef.current = grassBladeData;

    // ================= PLATFORM EDGE DETAIL & FLOWERS =================
    // Small flower buds scattered on the platform
    const flowerBudGeo = new THREE.SphereGeometry(0.02, 12, 12);
    const flowerColors = [0xfff8dc, 0xffe4e1, 0xe0ffe0, 0xfff0f5, 0xf0fff0];
    for (let i = 0; i < 12; i++) {
      const flowerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      const flowerMat = new THREE.MeshStandardMaterial({
        color: flowerColor,
        roughness: 0.4,
        metalness: 0.05,
        emissive: flowerColor,
        emissiveIntensity: 0.1,
      });
      const flower = new THREE.Mesh(flowerBudGeo, flowerMat);
      const fAngle = Math.random() * Math.PI * 2;
      const fRadius = 0.5 + Math.random() * 1.3;
      flower.position.set(
        Math.cos(fAngle) * fRadius,
        0.04,
        Math.sin(fAngle) * fRadius
      );
      // Slight random rotation
      flower.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      platformGroup.add(flower);
      
      // Add a tiny stem
      const stemGeo = new THREE.CylinderGeometry(0.003, 0.004, 0.04, 4);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x476e33 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(
        flower.position.x,
        0.02,
        flower.position.z
      );
      platformGroup.add(stem);
    }

    // Moss clumps around platform edges
    const mossGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x3a5f2a,
      roughness: 0.9,
      metalness: 0.0,
    });
    for (let i = 0; i < 16; i++) {
      const moss = new THREE.Mesh(mossGeo, mossMat.clone());
      // Position around the diamond edges
      const edgeAngle = (i / 16) * Math.PI * 2;
      const edgeRadius = 1.8 + Math.random() * 0.3;
      moss.position.set(
        Math.cos(edgeAngle) * edgeRadius,
        -0.02,
        Math.sin(edgeAngle) * edgeRadius
      );
      moss.scale.set(
        0.6 + Math.random() * 0.8,
        0.4 + Math.random() * 0.4,
        0.6 + Math.random() * 0.8
      );
      const mossColor = new THREE.Color().setHSL(0.28 + Math.random() * 0.06, 0.4, 0.25 + Math.random() * 0.1);
      (moss.material as THREE.MeshStandardMaterial).color = mossColor;
      platformGroup.add(moss);
    }

    // Small pebbles/rocks on the platform
    const pebbleGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x5a5a4a,
      roughness: 0.85,
      metalness: 0.05,
    });
    for (let i = 0; i < 8; i++) {
      const pebble = new THREE.Mesh(pebbleGeo, pebbleMat.clone());
      const pAngle = Math.random() * Math.PI * 2;
      const pRadius = 0.4 + Math.random() * 1.4;
      pebble.position.set(
        Math.cos(pAngle) * pRadius,
        0.01,
        Math.sin(pAngle) * pRadius
      );
      pebble.scale.set(
        0.6 + Math.random() * 1.0,
        0.3 + Math.random() * 0.4,
        0.6 + Math.random() * 1.0
      );
      const pebbleColor = new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 0.15, 0.3 + Math.random() * 0.15);
      (pebble.material as THREE.MeshStandardMaterial).color = pebbleColor;
      platformGroup.add(pebble);
    }

    // Soft 3D Floor Shadow below platform
    const shadowGeo = new THREE.PlaneGeometry(4.8, 4.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x022c22,
      transparent: true,
      opacity: 0.45,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.05;
    platformGroup.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    // 6. Animation Frame Loop
    let animationFrameId: number;

    const THEME_3D_PALETTES: Record<ThemeMode, {
      sphere: number;
      emissive: number;
      core: number;
      grassTop: number;
      sideSoil: number;
      leafDark: number;
      leafMid: number;
      leafLight: number;
      rimLight: number;
    }> = {
      original: {
        sphere: 0xfffdf0,
        emissive: 0x7ba659,
        core: 0xfef08a,
        grassTop: 0x75a056,
        sideSoil: 0x243719,
        leafDark: 0x2d4222,
        leafMid: 0x537b3d,
        leafLight: 0x7baa5b,
        rimLight: 0xfbbf24,
      },
      twilight: {
        sphere: 0xffeaa7,
        emissive: 0x0984e3,
        core: 0x74b9ff,
        grassTop: 0x0984e3,
        sideSoil: 0x192a56,
        leafDark: 0x1e272e,
        leafMid: 0x0984e3,
        leafLight: 0x74b9ff,
        rimLight: 0x38bdf8,
      },
      emerald: {
        sphere: 0xeccc68,
        emissive: 0x2ed573,
        core: 0x7bed9f,
        grassTop: 0x2ed573,
        sideSoil: 0x006266,
        leafDark: 0x006266,
        leafMid: 0x009432,
        leafLight: 0x2ed573,
        rimLight: 0x2ed573,
      },
      golden: {
        sphere: 0xfffaec,
        emissive: 0xe1b12c,
        core: 0xfbc531,
        grassTop: 0xe1b12c,
        sideSoil: 0x442a00,
        leafDark: 0x442a00,
        leafMid: 0xb53471,
        leafLight: 0xf8efba,
        rimLight: 0xfbc531,
      },
      cyber: {
        sphere: 0xf5f6fa,
        emissive: 0x8c7ae6,
        core: 0x00a8ff,
        grassTop: 0x8c7ae6,
        sideSoil: 0x2f3640,
        leafDark: 0x2f3640,
        leafMid: 0x8c7ae6,
        leafLight: 0x00a8ff,
        rimLight: 0x8c7ae6,
      },
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const { progress, dragRotateY, mouseX, mouseY, theme } = propsRef.current;

      // Update 3D materials dynamically on theme change
      if (currentThemeRef.current !== theme) {
        currentThemeRef.current = theme;
        const pal = THEME_3D_PALETTES[theme] || THEME_3D_PALETTES.original;

        if (sphereMatRef.current) {
          sphereMatRef.current.color.setHex(pal.sphere);
          sphereMatRef.current.emissive.setHex(pal.emissive);
        }
        if (coreMatRef.current) {
          coreMatRef.current.color.setHex(pal.core);
        }
        if (topGrassMatRef.current) {
          topGrassMatRef.current.color.setHex(pal.grassTop);
        }
        if (sideSoilMatRef.current) {
          sideSoilMatRef.current.color.setHex(pal.sideSoil);
        }
        if (leafDarkMatRef.current) {
          leafDarkMatRef.current.color.setHex(pal.leafDark);
        }
        if (leafMidMatRef.current) {
          leafMidMatRef.current.color.setHex(pal.leafMid);
        }
        if (leafLightMatRef.current) {
          leafLightMatRef.current.color.setHex(pal.leafLight);
        }
        if (rimLightRef.current) {
          rimLightRef.current.color.setHex(pal.rimLight);
        }
      }

      // Continuous slow subtle rotation for rings
      if (outerRingRef.current) {
        outerRingRef.current.rotation.z += 0.005;
      }
      if (innerRingRef.current) {
        innerRingRef.current.rotation.z -= 0.007;
      }

     // ================= TIMELINE ANIMATION SYNC =================
      // Phase 1 (1.0s - 2.5s / progress 0.167 -> 0.417): Sphere fade in (matches original video)
      // Original: 0-1s is BLACK, sphere appears at 1.0s, positioned at upper 25-40% of screen
      const sphereProgress = Math.min(1, Math.max(0, (progress - 0.167) / 0.25));
      const sphereScale = sphereProgress === 0 ? 0 : 1 - Math.pow(1 - sphereProgress, 3);

      if (sphereGroupRef.current) {
        sphereGroupRef.current.scale.set(sphereScale, sphereScale, sphereScale);
        sphereGroupRef.current.position.y = 0.65 + (1 - sphereScale) * 0.4;
      }

      // Phase 2 (2.0s - 4.0s / progress 0.333 -> 0.667): Platform and foliage (matches original)
      // Original: green foliage starts at 2.0s, extends from y=30% to y=80% of screen
      const outwardEmerge = Math.min(1, Math.max(0, (progress - 0.333) / 0.334));
      const emergeEase = Math.sin((outwardEmerge * Math.PI) / 2);

      if (platformGroupRef.current) {
        // Uniform 3D scale prevents matrix distortion and keeps grass leaves 100% attached to ground plane
        const pScale = 0.05 + emergeEase * 0.95;

        platformGroupRef.current.scale.set(pScale, pScale, pScale);
        platformGroupRef.current.position.y = -0.45 - (1 - emergeEase) * 0.2;
      }

      // Staggered Leaf Growth: Front sprouts emerge first (progress 0.18 -> 0.38)
      const frontGrowth = Math.min(1, Math.max(0, (progress - 0.1833) / 0.20));
      const frontEase = 1 - Math.pow(1 - frontGrowth, 2.5);
      if (frontLeavesGroupRef.current) {
        frontLeavesGroupRef.current.scale.set(frontEase, frontEase, frontEase);
      }

      // Back Ear Leaves: Emerge second and bloom/unfurl outwards like a flower bud opening (progress 0.28 -> 0.52)
      const backGrowth = Math.min(1, Math.max(0, (progress - 0.28) / 0.22));
      const backEase = 1 - Math.pow(1 - backGrowth, 3.0);
      if (backLeavesGroupRef.current) {
        // Height Y and width X/Z scale up with blossoming ease
        backLeavesGroupRef.current.scale.set(0.1 + backEase * 0.9, backEase, 0.1 + backEase * 0.9);
        // Rotation X tilts backwards as the bud opens
        backLeavesGroupRef.current.rotation.x = -0.32 * (1 - backEase);
      }
      // Spirit emergence (progress 0.45 -> 0.69)
      const spiritProgress = Math.min(1, Math.max(0, (progress - 0.45) / 0.24));
      const spiritEase = spiritProgress === 0 ? 0 : 1 - Math.pow(1 - spiritProgress, 3);

      // Spring-like overshoot for spirit emergence
      const springSpirit = spiritEase + Math.sin(spiritEase * Math.PI * 3) * 0.04 * (1 - spiritEase);

      if (spiritGroupRef.current) {
        spiritGroupRef.current.visible = spiritProgress > 0;
      }

      if (deerSpiritRef.current) {
        deerSpiritRef.current.scale.set(0.55 * springSpirit, 0.55 * springSpirit, 0.55 * springSpirit);
        deerSpiritRef.current.position.y = 0.35 + (1 - springSpirit) * 0.3;
      }

      if (whaleSpiritRef.current) {
        whaleSpiritRef.current.scale.set(0.55 * springSpirit, 0.55 * springSpirit, 0.55 * springSpirit);
        whaleSpiritRef.current.position.y = 0.25 + (1 - springSpirit) * 0.3;
      }

      if (blobSpiritRef.current) {
        blobSpiritRef.current.scale.set(0.55 * springSpirit, 0.55 * springSpirit, 0.55 * springSpirit);
        blobSpiritRef.current.position.y = 0.2 + (1 - springSpirit) * 0.3;
      }



      // ================= 3D ROTATION DRAG & MOUSE PARALLAX =================
      if (mainGroupRef.current) {
        // Rotates around Y-axis smoothly based on drag angle + mouse movement
        const targetRotY = (dragRotateY * Math.PI) / 180 + (mouseX / 300) * 0.25;
        const targetRotX = (mouseY / 300) * 0.18;

        // Firefly float + twinkle animation
        const time = Date.now() * 0.0015;
        fireflyDataRef.current.forEach((item) => {
          item.mesh.position.x = item.basePos.x + Math.sin(time * item.speed + item.phase) * 0.15;
          item.mesh.position.y = item.basePos.y + Math.cos(time * item.speed * 1.2 + item.phase) * 0.12;
          item.mesh.position.z = item.basePos.z + Math.sin(time * item.speed * 0.8 + item.phase) * 0.15;
          // Firefly twinkle (opacity oscillation)
          const mat = item.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.6 + Math.sin(time * 2 + item.phase) * 0.3;
        });

        // Leaf wind sway animation with more natural movement
        leafAnimationDataRef.current.forEach((leaf) => {
          // Primary sway + secondary oscillation for natural feel
          const primarySway = Math.sin(time * leaf.speed + leaf.phase) * 0.04;
          const secondarySway = Math.sin(time * leaf.speed * 1.7 + leaf.phase * 1.3) * 0.02;
          leaf.mesh.rotation.x = leaf.baseRotX + primarySway;
          leaf.mesh.rotation.z = leaf.baseRotZ + secondarySway;
          // Subtle scale pulse for "breathing" effect
          const breathe = 1 + Math.sin(time * 0.8 + leaf.phase) * 0.015;
          leaf.mesh.scale.set(breathe, breathe, breathe);
        });

        // Grass blade wind animation - wave propagation across platform
        grassBladesRef.current.forEach((grass) => {
          // Wind wave based on position (grass further from center sways more)
          const distFromCenter = Math.sqrt(
            grass.mesh.position.x * grass.mesh.position.x + 
            grass.mesh.position.z * grass.mesh.position.z
          );
          const windStrength = 0.15 + (distFromCenter / 2.0) * 0.25;
          
          // Multi-layered wind animation
          const windPhase = time * grass.speed + grass.phase;
          const primaryWind = Math.sin(windPhase) * windStrength;
          const gustWind = Math.sin(windPhase * 0.5 + distFromCenter * 0.8) * windStrength * 0.5;
          const rustleWind = Math.sin(windPhase * 3.2 + grass.phase * 2) * windStrength * 0.15;
          
          // Taller grass bends more
          const heightFactor = grass.height / 0.17;
          grass.mesh.rotation.x = grass.baseRotX + (primaryWind + gustWind) * heightFactor;
          grass.mesh.rotation.z = grass.baseRotZ + (rustleWind + gustWind * 0.7) * heightFactor;
          
          // Subtle growth/scale pulse based on emergence progress
          if (outwardEmerge > 0.3) {
            const growthPulse = 1 + Math.sin(time * 1.2 + grass.phase) * 0.08;
            grass.mesh.scale.set(growthPulse, growthPulse, growthPulse);
          }
        });

        // Spirit particle trails - orbiting magical particles
        if (spiritProgress > 0.3) {
          const trailTime = Date.now() * 0.001;
          spiritParticleTrailsRef.current.forEach((particle) => {
            const orbitAngle = trailTime * particle.orbitSpeed + particle.orbitPhase;
            const parentPos = particle.parentGroup.position;
            
            particle.mesh.position.x = parentPos.x + Math.cos(orbitAngle) * particle.orbitRadius;
            particle.mesh.position.y = parentPos.y + particle.orbitHeight + Math.sin(trailTime * 2 + particle.orbitPhase) * 0.05;
            particle.mesh.position.z = parentPos.z + Math.sin(orbitAngle) * particle.orbitRadius;
            
            // Twinkle effect
            const trailMat = particle.mesh.material as THREE.MeshBasicMaterial;
            trailMat.opacity = 0.5 + Math.sin(trailTime * 3 + particle.orbitPhase) * 0.3;
            
            // Scale pulse
            const trailScale = 0.8 + Math.sin(trailTime * 4 + particle.orbitPhase) * 0.3;
            particle.mesh.scale.set(trailScale, trailScale, trailScale);
          });
        }

        // Spirit detailed idle animations
        if (typeof spiritProgress !== 'undefined' && spiritProgress > 0) {
          const spiritTime = Date.now() * 0.001;

          // Deer Spirit - breathing, ear wiggle, gentle sway
          if (deerSpiritRef.current) {
            // Main body float + breathing scale
            const deerBreath = 1 + Math.sin(spiritTime * 1.8) * 0.025;
            deerSpiritRef.current.position.y = 0.35 + Math.sin(spiritTime * 2.2) * 0.04;
            deerSpiritRef.current.scale.set(0.55 * deerBreath, 0.55 * deerBreath, 0.55 * deerBreath);
            
            // Gentle sway rotation
            deerSpiritRef.current.rotation.y = Math.sin(spiritTime * 1.4) * 0.08;
            deerSpiritRef.current.rotation.z = Math.sin(spiritTime * 1.1) * 0.03;
            
            // Animate ears (children 2 and 3)
            const earWiggle = Math.sin(spiritTime * 2.5) * 0.15;
            if (deerSpiritRef.current.children[2]) {
              deerSpiritRef.current.children[2].rotation.z = 0.3 + earWiggle;
            }
            if (deerSpiritRef.current.children[3]) {
              deerSpiritRef.current.children[3].rotation.z = -0.3 - earWiggle;
            }
            
            // Antler subtle movement (children 4-7)
            for (let i = 4; i <= 7; i++) {
              if (deerSpiritRef.current.children[i]) {
                deerSpiritRef.current.children[i].rotation.z += Math.sin(spiritTime * 1.5 + i) * 0.001;
              }
            }
          }

          // Whale Spirit - swimming motion, tail wag, spout bubbles
          if (whaleSpiritRef.current) {
            // Swimming undulation
            const swimPhase = spiritTime * 1.5;
            whaleSpiritRef.current.position.y = 0.25 + Math.cos(spiritTime * 2.4 + 1.2) * 0.05;
            whaleSpiritRef.current.rotation.y = Math.sin(spiritTime * 1.5 + 1.2) * 0.1;
            whaleSpiritRef.current.rotation.z = Math.sin(swimPhase) * 0.05;
            
            // Tail wag (child 3 - tail)
            if (whaleSpiritRef.current.children[3]) {
              whaleSpiritRef.current.children[3].rotation.y = Math.sin(spiritTime * 3.0) * 0.3;
              whaleSpiritRef.current.children[3].rotation.z = 0.3 + Math.sin(spiritTime * 3.0) * 0.2;
            }
            
            // Spout bubbles movement (children 4-6)
            for (let i = 4; i <= 6; i++) {
              if (whaleSpiritRef.current.children[i]) {
                const bubbleTime = spiritTime * 2 + (i - 4) * 0.3;
                whaleSpiritRef.current.children[i].position.y += Math.sin(bubbleTime) * 0.002;
                const bubble = whaleSpiritRef.current.children[i];
                if (bubble instanceof THREE.Mesh && bubble.material instanceof THREE.MeshBasicMaterial) {
                  bubble.material.opacity = 0.6 + Math.sin(bubbleTime * 2) * 0.2;
                }
              }
            }
            
            // Flipper movement (child 7)
            if (whaleSpiritRef.current.children[7]) {
              whaleSpiritRef.current.children[7].rotation.z = -0.3 + Math.sin(spiritTime * 2.0) * 0.15;
            }
          }

          // Blob Spirit - happy bouncing, halo rotation, tuft wiggle
          if (blobSpiritRef.current) {
            // Happy bob with slight squash-stretch
            const bobPhase = spiritTime * 2.6 + 2.4;
            const bobY = Math.sin(bobPhase) * 0.035;
            const squash = 1 + Math.sin(bobPhase * 2) * 0.04;
            blobSpiritRef.current.position.y = 0.2 + bobY;
            blobSpiritRef.current.scale.set(0.55 / squash, 0.55 * squash, 0.55 / squash);
            blobSpiritRef.current.rotation.y = Math.cos(spiritTime * 1.6 + 2.4) * 0.06;
            
            // Halo rotation (find halo in children - typically around index 7)
            blobSpiritRef.current.children.forEach((child) => {
              if (child instanceof THREE.Mesh && child.geometry.type === 'TorusGeometry') {
                child.rotation.z += 0.02;
              }
            });
            
            // Ear tufts wiggle (children around index 4-5)
            const tuftWiggle = Math.sin(spiritTime * 3.0) * 0.2;
            if (blobSpiritRef.current.children[4]) {
              blobSpiritRef.current.children[4].rotation.z = tuftWiggle;
            }
            if (blobSpiritRef.current.children[5]) {
              blobSpiritRef.current.children[5].rotation.z = -tuftWiggle;
            }
          }
        }

        // Sphere detailed animations
        if (sphereGroupRef.current && sphereScale > 0.5) {
          // Multi-layered breathing pulse
          const breatheMain = Math.sin(Date.now() * 0.0015) * 0.015;
          const breatheSub = Math.sin(Date.now() * 0.003) * 0.008;
          const breathe = 1 + breatheMain + breatheSub;
          const currentScale = sphereScale * breathe;
          sphereGroupRef.current.scale.set(currentScale, currentScale, currentScale);
          
          // Gentle slow rotation for life-like feel
          sphereGroupRef.current.rotation.y += 0.001;
          sphereGroupRef.current.rotation.x = Math.sin(Date.now() * 0.0005) * 0.02;
        }
        // Sphere halo pulse
        if (haloRing && sphereScale > 0.5) {
          const haloPulse = 0.12 + Math.sin(Date.now() * 0.002) * 0.05;
          (haloRing.material as THREE.MeshBasicMaterial).opacity = haloPulse;
        }


      // Smooth lerp for ultra fluid rotation
        mainGroupRef.current.rotation.y += (targetRotY - mainGroupRef.current.rotation.y) * 0.12;
        mainGroupRef.current.rotation.x += (targetRotX - mainGroupRef.current.rotation.x) * 0.12;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onSphereClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative w-full h-full select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    />
  );
};
