import * as THREE from 'three';

/** Shared geometry/material pool: removed instances leave no per-frame GPU allocations. */
export class ModelFactory {
  constructor() {
    this.geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cone: new THREE.ConeGeometry(0.5, 1, 4),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      sphere: new THREE.SphereGeometry(0.5, 10, 6),
      crystal: new THREE.OctahedronGeometry(0.5),
      ring: new THREE.TorusGeometry(0.5, 0.06, 4, 20),
    };
    this.materials = new Map();
  }
  material(color) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    return this.materials.get(color);
  }
  part(parent, shape, color, position, scale) {
    const mesh = new THREE.Mesh(this.geometries[shape], this.material(color));
    mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh);
    return mesh;
  }
  building(def) {
    const g = new THREE.Group(), w = def.size.w, h = def.size.h;
    const p = (shape, color, xyz, size) => this.part(g, shape, color, xyz, size);
    p('box', '#dbd5b7', [0, 0.1, 0], [w - 0.08, 0.2, h - 0.08]);
    if (def.id === 'farmland') {
      p('box', '#8a6f52', [0, 0.22, 0], [w - 0.2, 0.14, h - 0.2]);
      const crop = new THREE.Group(); g.add(crop); g.userData.crop = crop;
      for (let x = -0.5; x <= 0.5; x += 0.5) for (let z = -0.5; z <= 0.5; z += 0.5) {
        this.part(crop, 'cone', '#88a154', [x, 0.48, z], [0.25, 0.5, 0.25]);
      }
    } else if (def.id === 'altar' || def.id === 'chuansongshuniu' || def.id === 'xinxizhongshu') {
      p('cylinder', '#7d8b7d', [0, 0.3, 0], [w * 0.8, 0.3, h * 0.8]);
      p('cylinder', '#ece5d0', [0, 0.52, 0], [w * 0.55, 0.18, h * 0.55]);
      const crystal = p('crystal', def.color, [0, 1.08, 0], [0.8, 1.1, 0.8]);
      g.userData.crystal = crystal;
      if (def.id === 'chuansongshuniu') p('ring', '#93c8c3', [0, 1.35, 0], [2, 2, 2]);
    } else if (def.id === 'campfire') {
      p('cylinder', '#8a6f52', [0, 0.28, 0], [0.68, 0.22, 0.68]);
      p('cone', '#e8a13c', [0, 0.65, 0], [0.55, 0.7, 0.55]);
      p('cone', '#f0e2a0', [0, 0.57, 0.05], [0.3, 0.5, 0.3]);
    } else if (['totem', 'wuxingbei', 'jieshishi'].includes(def.id)) {
      p('box', '#7d8b7d', [0, 0.65, 0], [0.52, 1, 0.45]);
      p('crystal', def.color, [0, 1.32, 0], [0.36, 0.4, 0.36]);
    } else if (['chuanxint', 'jietata'].includes(def.id)) {
      p('box', '#ece5d0', [0, 1.0, 0], [w * 0.5, 1.8, h * 0.5]);
      p('cone', def.color, [0, 2.1, 0], [w * 0.9, 0.7, h * 0.9]).rotation.y = Math.PI / 4;
    } else if (['researchTable', 'fulutai'].includes(def.id)) {
      p('box', '#8a6f52', [0, 0.5, 0], [w * 0.65, 0.7, h * 0.5]);
      p('box', '#f7f1e1', [0, 0.88, 0], [w * 0.75, 0.12, h * 0.65]);
      p('crystal', def.color, [0, 1.15, 0], [0.4, 0.4, 0.4]);
    } else {
      p('box', '#f7f1e1', [0, 0.72, 0], [w * 0.72, 1.05, h * 0.72]);
      p('cone', def.id === 'hut' ? '#a98251' : def.color, [0, 1.52, 0], [w * 1.05, 0.78, h * 1.05]).rotation.y = Math.PI / 4;
      p('box', '#4a4636', [0.15, 0.52, h * 0.365], [0.34, 0.7, 0.04]);
      p('box', '#e8a13c', [-w * 0.2, 0.82, h * 0.37], [0.24, 0.26, 0.05]);
      if (['kitchen', 'duanzaofang', 'lianyaolu'].includes(def.id)) p('cylinder', '#8a6f52', [w * 0.2, 1.7, -h * 0.15], [0.3, 0.8, 0.3]);
    }
    return g;
  }
  resource(type) {
    const g = new THREE.Group();
    if (type === 'tree') {
      this.part(g, 'cylinder', '#8a6f52', [0, 0.35, 0], [0.16, 0.7, 0.16]);
      this.part(g, 'sphere', '#638b57', [0, 0.93, 0], [0.78, 0.9, 0.78]);
    } else if (type === 'herb') {
      this.part(g, 'cone', '#92aa60', [0, 0.24, 0], [0.48, 0.46, 0.48]);
      this.part(g, 'sphere', '#ece5d0', [0.12, 0.47, 0], [0.14, 0.14, 0.14]);
    } else {
      const rock = this.part(g, type === 'ore' ? 'crystal' : 'sphere', type === 'ore' ? '#7697a1' : '#a1a493', [0, 0.24, 0], [0.64, 0.55, 0.55]);
      rock.rotation.y = 0.6;
    }
    return g;
  }
  actor(color, enemy = false) {
    const g = new THREE.Group();
    this.part(g, 'sphere', color, [0, 0.38, 0], [0.57, 0.72, 0.5]);
    for (const x of [-0.17, 0.17]) this.part(g, 'cone', enemy ? '#b85f4b' : color, [x, 0.76, 0], [0.22, 0.3, 0.22]);
    for (const x of [-0.1, 0.1]) this.part(g, 'sphere', '#f7f1e1', [x, 0.48, 0.23], [0.11, 0.16, 0.04]);
    const ring = this.part(g, 'ring', enemy ? '#c96c55' : '#c08b3c', [0, 0.06, 0], [0.86, 0.86, 0.86]);
    ring.rotation.x = -Math.PI / 2; ring.visible = enemy;
    g.userData.ring = ring;
    return g;
  }
  dispose() {
    Object.values(this.geometries).forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
    this.materials.clear();
  }
}
