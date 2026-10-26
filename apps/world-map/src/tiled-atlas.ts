import * as THREE from 'three';
import { mapPoint, SOURCE_MAP_SIZE, SURFACE_INSET } from './map-coordinates';

type Tile = { url: string; x: number; y: number; width: number; height: number; crop: number[] };
type Level = { width: number; height: number; tiles: Tile[] };
type Manifest = { width: number; height: number; sourceSha256: string; levels: Level[] };

// Keep the surveyed artwork intact. Vector tracing is only retained for the
// authored extension beyond x=8192, never used to redraw source islands.
export async function createTiledAtlas(radius: number, height: number, invalidate: () => void) {
  const base = `${import.meta.env.BASE_URL}assets/atlas-tiles/`;
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) throw new Error(`Atlas tiles unavailable (${response.status})`);
  const manifest: Manifest = await response.json();
  if (manifest.width !== SOURCE_MAP_SIZE.width || manifest.height !== SOURCE_MAP_SIZE.height || manifest.levels.length !== 3) {
    throw new Error('Atlas tile coordinate system does not match the nodes');
  }
  const group = new THREE.Group();
  group.name = 'source-raster-tiles';
  const dark = { value: 0 };
  const sea = new THREE.Color(0x101d1b);
  const loader = new THREE.TextureLoader();
  let disposed = false;
  const entries = manifest.levels.flatMap((level, z) => level.tiles.map(tile => {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const scaleX = manifest.width / level.width, scaleY = manifest.height / level.height;
    const steps = Math.ceil(tile.width * scaleX / 12);
    const [left, top, right, bottom] = tile.crop;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i <= steps; i++) {
        const x = tile.x + tile.width * i / steps, y = tile.y + tile.height * row;
        positions.push(...mapPoint(x * scaleX, y * scaleY, radius - SURFACE_INSET, height));
        uvs.push((x-left)/(right-left), 1-(y-top)/(bottom-top));
      }
    }
    for (let i = 0; i < steps; i++) indices.push(i, i+steps+1, i+1, i+1, i+steps+1, i+steps+2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false, depthTest: false, depthWrite: false });
    material.onBeforeCompile = shader => {
      shader.uniforms.atlasDark = dark;
      shader.uniforms.atlasSea = { value: sea };
      shader.fragmentShader = 'uniform float atlasDark; uniform vec3 atlasSea;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float luminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        // Continuous luminance mapping avoids threshold halos in antialiased
        // coastlines and JPEG edge pixels when switching to the dark palette.
        vec3 night = mix(atlasSea, vec3(0.20, 0.46, 0.48), pow(1.0 - luminance, 1.8));
        diffuseColor.rgb = mix(diffuseColor.rgb, night, atlasDark);`);
    };
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 4 + z;
    mesh.visible = false;
    group.add(mesh);
    return { z, mesh, material, url: base + tile.url, loaded: false, pending: false, failed: false };
  }));
  async function load(entry: typeof entries[number]) {
    if (entry.loaded || entry.pending || entry.failed || disposed) return;
    entry.pending = true;
    try {
      const texture = await loader.loadAsync(entry.url);
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      entry.material.map = texture;
      entry.material.needsUpdate = true;
      entry.loaded = true;
    } catch {
      // The lower-resolution source stays visible. Do not enter an infinite retry loop.
      entry.failed = true;
    } finally {
      entry.pending = false;
      if (!disposed) invalidate();
    }
  }
  await Promise.all(entries.filter(e => e.z === 0).map(load));
  if (entries.some(e => e.z === 0 && !e.loaded)) {
    entries.forEach(e => { e.material.map?.dispose(); e.material.dispose(); e.mesh.geometry.dispose(); });
    throw new Error('Base atlas tiles could not load; check the local map asset package');
  }
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  return {
    group,
    sourceSha256: manifest.sourceSha256,
    setTheme(value: boolean) { dark.value = value ? 1 : 0; },
    update(camera: THREE.PerspectiveCamera, viewportHeight: number) {
      if (disposed) return;
      camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      const screenScale = viewportHeight / (2 * radius * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      const pixelsPerSource = screenScale * height / manifest.height;
      const z = pixelsPerSource > .5 ? 2 : pixelsPerSource > .25 ? 1 : 0;
      for (const entry of entries) {
        const visible = frustum.intersectsObject(entry.mesh);
        entry.mesh.visible = visible && entry.loaded && (entry.z === 0 || entry.z === z);
        if (visible && entry.z === z) void load(entry);
      }
      // Bounded GPU memory when browsing the full ring. Keep only the base and
      // currently visible detail tiles; stale in-flight results get evicted next frame.
      for (const entry of entries) {
        if (entry.z > 0 && entry.loaded && !entry.mesh.visible) {
          entry.material.map?.dispose(); entry.material.map = null;
          entry.material.needsUpdate = true; entry.loaded = false;
        }
      }
    },
    dispose() {
      disposed = true;
      for (const entry of entries) { entry.material.map?.dispose(); entry.material.dispose(); entry.mesh.geometry.dispose(); }
      group.clear();
    },
  };
}
