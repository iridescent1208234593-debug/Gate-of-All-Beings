// three.js 渲染：把 GameState 渲染到画布
// stage-05：细胞改为 InstancedMesh（单 draw call），体型 scale 与颜色均按基因逐实例设置；
// 健康细胞能量脉动提亮、濒死向虚弱色灰化；悬停任意细胞显示其感知圈（senseRange）。
// stage-07：有机体渲染——每个模块（body/flagellum/mouth/chloroplast）用独立
// InstancedMesh 逐实例摆放拼成团；模块色走 theme token，body 随有机体色系基因。
// stage-10：环境营养带——沿 x 轴铺三条地面色带（富营养/过渡/贫瘠），直观标出
// 食物丰度梯度，让“同一物种在不同营养带演化出不同体型”这件事看得见。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLORS, WORLD } from '../config/index.js';
import { moduleWorldPos, moduleRadiusOf } from './organism.js';
import { zoneSpan } from './environment.js';
import { TILE_KEY, worldToGrid, tileAtGrid } from '../world/map.js';
import { biomassRatio } from '../world/plants.js';
// stage-15：群体指令模式（渲染指令落点标记时需要判断「移动」）
import { ORDER } from './tribe.js';

export class Renderer {
  constructor(canvas) {
    this.events = new AbortController();
    const on = (target, type, listener) => target.addEventListener(type, listener, { signal: this.events.signal });
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bg);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 52, 52);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;

    // 灯光（色值统一取调色板）；stage-12：保留引用，随昼夜插值强度与色相
    this.hemi = new THREE.HemisphereLight(COLORS.light.sky, COLORS.light.ground, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(COLORS.light.sun, 0.9);
    this.sun.position.set(20, 40, 15);
    this.scene.add(this.sun);
    // stage-12：昼夜插值端点色（不改动 token 本身，运行时 lerp 出中间色）
    this._dn = {
      bgDay: new THREE.Color(COLORS.dayNight.bgDay),
      bgNight: new THREE.Color(COLORS.dayNight.bgNight),
      skyDay: new THREE.Color(COLORS.dayNight.skyDay),
      skyNight: new THREE.Color(COLORS.dayNight.skyNight),
      groundDay: new THREE.Color(COLORS.dayNight.groundDay),
      groundNight: new THREE.Color(COLORS.dayNight.groundNight),
      sunDay: new THREE.Color(COLORS.dayNight.sunDay),
      sunNight: new THREE.Color(COLORS.dayNight.sunNight),
    };

    // 地面网格
    const b = WORLD.bounds;
    const grid = new THREE.GridHelper(b * 2, 24, COLORS.groundLine, COLORS.groundLine);
    grid.position.y = WORLD.floorY;
    this.scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(b * 2, b * 2),
      new THREE.MeshStandardMaterial({ color: COLORS.ground, transparent: true, opacity: 0.35 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = WORLD.floorY;
    this.scene.add(floor);

    // ---- stage-10：环境营养带色带（富营养 -> 过渡 -> 贫瘠，色值取自 theme token）----
    const zoneKeys = ['rich', 'mid', 'poor'];
    this.zoneBands = [];
    for (let i = 0; i < WORLD.envZoneCount; i++) {
      const [x0, x1] = zoneSpan(i);
      const band = new THREE.Mesh(
        new THREE.PlaneGeometry(x1 - x0, b * 2),
        new THREE.MeshStandardMaterial({
          color: COLORS.envZone[zoneKeys[i]] ?? COLORS.envZone.poor,
          transparent: true,
          opacity: WORLD.envBandOpacity,
          roughness: 0.95,
          metalness: 0,
        })
      );
      band.rotation.x = -Math.PI / 2;
      band.position.set((x0 + x1) / 2, WORLD.floorY + 0.02, 0);
      this.scene.add(band);
      this.zoneBands.push(band);
    }

    // ---- stage-11：网格地形瓦片（草地/水域/沙地，逐实例着色）----
    // 地形为只读（map 一次生成后不变），按 seed 缓存，避免每帧重建几何。
    this.tileGeo = new THREE.PlaneGeometry(1, 1);
    this.tileMat = new THREE.MeshStandardMaterial({
      color: COLORS.meshBase,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: WORLD.tileOpacity,
    });
    this.tileInst = null;      // 懒创建：依赖 map 的瓦片数
    this._tileKey = null;      // `${cols}x${rows}@${seed}` —— 地图变了才重建
    this._tileColors = {
      0: new THREE.Color(COLORS.tile.grass),
      1: new THREE.Color(COLORS.tile.water),
      2: new THREE.Color(COLORS.tile.sand),
    };

    // ---- stage-11：生产者（植物）——细锥体幼苗，按生物量决定大小与色档 ----
    this.plantGeo = new THREE.ConeGeometry(0.5, 1, 6);
    this.plantMat = new THREE.MeshStandardMaterial({
      color: COLORS.meshBase,
      roughness: 0.6,
      metalness: 0,
    });
    const plantCapacity = WORLD.plantTarget + WORLD.plantRenderSlack;
    this._plantYoung = new THREE.Color(COLORS.plant.young);
    this._plantRipe = new THREE.Color(COLORS.plant.ripe);
    this.plantInst = new THREE.InstancedMesh(this.plantGeo, this.plantMat, plantCapacity);
    this.plantInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.plantInst.frustumCulled = false; // 实例整体包围盒不随逐实例位移更新，关掉以免误剔除
    // 首帧前初始化实例颜色，避免未 setColorAt 的实例取默认白
    for (let i = 0; i < plantCapacity; i++) this.plantInst.setColorAt(i, this._plantYoung);
    if (this.plantInst.instanceColor) this.plantInst.instanceColor.needsUpdate = true;
    this.scene.add(this.plantInst);

    // ---- 细胞：InstancedMesh（stage-05 外观基因化）----
    // 材质为白色基色，具体颜色由 per-instance instanceColor 叠加，色值仍只来自调色板
    this.cellGeo = new THREE.SphereGeometry(1, 14, 12);
    this.cellMat = new THREE.MeshStandardMaterial({
      color: COLORS.meshBase,
      roughness: 0.4,
      metalness: 0.1,
    });
    this.inst = new THREE.InstancedMesh(this.cellGeo, this.cellMat, WORLD.maxInstances);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.inst);
    // 预置全部实例的 instanceColor 缓冲区
    const initC = new THREE.Color(COLORS.meshBase);
    for (let i = 0; i < WORLD.maxInstances; i++) this.inst.setColorAt(i, initC);
    if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;

    // ---- 有机体模块：独立 InstancedMesh（stage-07）----
    // stage-10：繁殖允许本 tick 少量溢出 orgMax（随后由淘汰循环削峰），
    // 故实例容量按 1.5 倍留安全垫，避免溢出的那几只个体模块被截断不渲染。
    const orgCapacity = Math.ceil(WORLD.orgMax * 1.5) * WORLD.orgGridSize * WORLD.orgGridSize;
    this.orgGeo = new THREE.SphereGeometry(1, 12, 10);
    this.orgMat = new THREE.MeshStandardMaterial({
      color: COLORS.meshBase,
      roughness: 0.45,
      metalness: 0.05,
    });
    this.orgInst = new THREE.InstancedMesh(this.orgGeo, this.orgMat, orgCapacity);
    this.orgInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.orgInst);
    for (let i = 0; i < orgCapacity; i++) this.orgInst.setColorAt(i, initC);
    if (this.orgInst.instanceColor) this.orgInst.instanceColor.needsUpdate = true;
    // 模块专用色（来自 theme token）：body 使用有机体色系基因对应的 cell 调色板色
    this._typeColors = {
      body: null, // 运行时从 _baseColors[org.colorIndex] 取
      flagellum: new THREE.Color(COLORS.organism.flagellum),
      mouth: new THREE.Color(COLORS.organism.mouth),
      chloroplast: new THREE.Color(COLORS.organism.chloroplast),
      // stage-11：捕食爪用肉食者色 token，食物链顶层一眼可辨
      claw: new THREE.Color(COLORS.organism.claw),
    };

    this._dummy = new THREE.Object3D();
    this._tmpColor = new THREE.Color();
    this._baseColors = COLORS.cell.map((c) => new THREE.Color(c));
    this._weakColor = new THREE.Color(COLORS.weak);
    // stage-09：实例 -> 所属有机体 id（供生成编辑器点选有机体）
    this._orgOwner = new Array(orgCapacity).fill(-1);
    this._editColor = new THREE.Color(COLORS.orgEditor.ring);
    // stage-14：神经网络个体标识色（带脑个体整体偏向此色，一眼可辨认知谱系）
    this._nnColor = new THREE.Color(COLORS.nnBrain);

    // ---- stage-09：被组装有机体的地面选中环（组装模式高亮）----
    this.orgRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 64),
      new THREE.MeshBasicMaterial({
        color: COLORS.orgEditor.ring,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.orgRing.rotation.x = -Math.PI / 2;
    this.orgRing.visible = false;
    this.scene.add(this.orgRing);

    // ---- 悬停感知圈（Ring 半径由渲染时按基因 senseRange 缩放）----
    this.senseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1.0, 64),
      new THREE.MeshBasicMaterial({
        color: COLORS.senseRing,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.senseRing.rotation.x = -Math.PI / 2;
    this.senseRing.visible = false;
    this.scene.add(this.senseRing);

    // ---- stage-13：干预目标格高亮（地面方格描边，颜色走 theme token）----
    // 点到地面弹菜单时把方框挪到该格上，让“这次干预作用在哪一格/哪片区域”看得见。
    this.envMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 4),
      new THREE.MeshBasicMaterial({
        color: COLORS.intervention.pick,
        transparent: true,
        opacity: WORLD.interventionMarkerOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.envMarker.rotation.x = -Math.PI / 2;
    this.envMarker.rotation.z = Math.PI / 4; // 4 段环转 45° 后边缘与网格轴平行
    this.envMarker.visible = false;
    this.scene.add(this.envMarker);

    // ---- stage-15：群体与领地标识（领地圈 + 群体悬浮标记 + 指令目标点）----
    // 群体本身的成员个体仍走 orgInst（在 updateOrganisms 里按群体色偏向标记），
    // 这里额外画三样「群体的空间语义」：领地圈（范围）、悬浮标记（在哪一伙）、
    // 指令目标点（被下令“移动”的落点）。色值统一取 COLORS.tribe 调色板，按群体 id 稳定取色。
    this.tribeRingGeo = new THREE.RingGeometry(WORLD.tribeRingInner, 1, 72);
    this.tribeMarkGeo = new THREE.ConeGeometry(1, 2, 4);
    this.tribeTargetGeo = new THREE.RingGeometry(0.72, 0.96, 48);
    this._tribePalette = COLORS.tribe.palette.map((c) => new THREE.Color(c));
    this._tribeSelColor = new THREE.Color(COLORS.tribe.selected);
    this._tribeTargetColor = new THREE.Color(COLORS.tribe.target);
    this._tribeBanColor = new THREE.Color(COLORS.tribe.forbidden);
    this.tribeRings = [];   // 领地圈（懒创建，按需增补）
    this.tribeMarks = [];   // 群体悬浮标记
    this.selectedTribeId = null; // 由 main 写入：当前选中群体（面板/点击选中即高亮）
    this.tribeTarget = new THREE.Mesh(
      this.tribeTargetGeo,
      new THREE.MeshBasicMaterial({
        color: COLORS.tribe.target,
        transparent: true,
        opacity: WORLD.tribeRingOpacitySel,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.tribeTarget.rotation.x = -Math.PI / 2;
    this.tribeTarget.visible = false;
    this.scene.add(this.tribeTarget);

    this._pointer = new THREE.Vector2(0, 0);
    this._hasPointer = false;
    this._hoverIdx = -1;
    this._raycaster = new THREE.Raycaster();
    on(canvas, 'pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._hasPointer = true;
    });
    on(canvas, 'pointerleave', () => {
      this._hasPointer = false;
      this._hoverIdx = -1;
    });

    // ---- stage-06 细胞拾取 / stage-09 有机体拾取：区分“拖拽旋转”与“单击” ----
    this.onPickCell = null; // 由 main 注入：(instanceIndex) => void
    this.onPickOrganism = null; // stage-09：由 main 注入：(organismId) => void
    this.onPickGround = null; // stage-13：由 main 注入：(tile, screenX, screenY) => void
    this._map = null; // stage-13：本帧地图快照（地面拾取需要 cols/rows/cellSize）
    let downX = 0;
    let downY = 0;
    on(canvas, 'pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    on(canvas, 'pointerup', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(new THREE.Vector2(px, py), this.camera);
      // stage-09：优先拾取有机体（暂停组装模式点选目标）
      if (this.onPickOrganism) {
        const orgHits = this._raycaster.intersectObject(this.orgInst, false);
        if (orgHits.length) {
          const owner = this._orgOwner[orgHits[0].instanceId];
          if (owner >= 0) {
            this.onPickOrganism(owner);
            return;
          }
        }
      }
      const hits = this._raycaster.intersectObject(this.inst, false);
      if (hits.length && this.onPickCell) {
        this.onPickCell(hits[0].instanceId);
        return;
      }
      // stage-13：没点到生物就当地面点击 —— 交给 main 弹环境干预菜单
      if (this.onPickGround) {
        const tile = this.pickGroundTile(this._map, px, py);
        if (tile) this.onPickGround(tile, e.clientX, e.clientY);
      }
    });

    // ---- 食物：发光小能量团（独立 mesh，数量少不影响帧率）----
    this.foodGeo = new THREE.OctahedronGeometry(0.5, 0);
    this.foodMat = new THREE.MeshStandardMaterial({
      color: COLORS.food,
      emissive: COLORS.food,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    });
    this.foodMeshes = [];

    // ---- stage-16：文明层（资源点 / 采集作用圈 / 建城标识 / 火科技灯火）----
    // 资源点与作用圈按需懒创建（几何共享，材质各自一份以支持逐点着色）；
    // 色值全部取自 COLORS.resource / COLORS.civ，尺寸与脉动幅度取自 WORLD.civ*，无硬编码色值。
    this.civNodeGeo = new THREE.OctahedronGeometry(1, 0);    // 八面体晶体：一眼看出是「可采掘的点」
    this.civRingGeo = new THREE.RingGeometry(0.86, 1, 64);   // 单位环，运行时按采集作用半径缩放
    this.civNodes = [];      // 资源点本体
    this.civNodeRings = [];  // 采集作用圈（进入该范围即在开采）
    this._resColors = {
      water: new THREE.Color(COLORS.resource.water),
      food: new THREE.Color(COLORS.resource.food),
      mineral: new THREE.Color(COLORS.resource.mineral),
    };
    this._civSpentColor = new THREE.Color(COLORS.civ.nodeSpent);
    this._civGatherColor = new THREE.Color(COLORS.civ.gatherRing);
    this._civCityColor = new THREE.Color(COLORS.civ.city);
    this._civCityRingColor = new THREE.Color(COLORS.civ.cityRing);
    this._civFireColor = new THREE.Color(COLORS.civ.fireGlow);
    this._civTechOn = new THREE.Color(COLORS.civ.techOn);

    // 建城标识：城郭圈（范围）+ 城市核心（塔）+ 火科技灯火（球 + 地面光晕）+ 工具环
    // 四件套只有满足条件才可见——科技解锁/建城在 3D 场景里同样「看得见」，不只是面板数字。
    this.civCity = new THREE.Group();
    this.civCityRing = new THREE.Mesh(
      this.civRingGeo,
      new THREE.MeshBasicMaterial({
        color: COLORS.civ.cityRing,
        transparent: true,
        opacity: WORLD.civNodeRingOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.civCityRing.rotation.x = -Math.PI / 2;
    this.civCityRing.position.y = WORLD.civCityLift;
    this.civCity.add(this.civCityRing);

    this.civCityCore = new THREE.Mesh(
      new THREE.ConeGeometry(1, 2.4, 8),
      new THREE.MeshStandardMaterial({
        color: COLORS.civ.city,
        emissive: COLORS.civ.city,
        emissiveIntensity: 0.22,
        roughness: 0.5,
      })
    );
    this.civCityCore.scale.setScalar(WORLD.civCityCoreScale);
    this.civCityCore.position.y = WORLD.civCityCoreScale * 1.2; // 锥高 2.4 → 半高 1.2，底面贴地
    this.civCity.add(this.civCityCore);

    this.civFire = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: COLORS.civ.fireGlow, transparent: true, opacity: 0.95 })
    );
    this.civFire.scale.setScalar(WORLD.civCityCoreScale * 0.42);
    this.civFire.position.y = WORLD.civCityCoreScale * 2.4 + WORLD.civCityCoreScale * 0.42; // 塔顶灯火
    this.civCity.add(this.civFire);

    this.civFireHalo = new THREE.Mesh(
      this.civRingGeo,
      new THREE.MeshBasicMaterial({
        color: COLORS.civ.fireGlow,
        transparent: true,
        opacity: WORLD.civNodeRingOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.civFireHalo.rotation.x = -Math.PI / 2;
    this.civFireHalo.position.y = WORLD.civCityLift * 1.4; // 略高于城郭圈，避免叠面闪烁
    this.civCity.add(this.civFireHalo);

    this.civToolsRing = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 6),
      new THREE.MeshBasicMaterial({
        color: COLORS.civ.techOn,
        transparent: true,
        opacity: WORLD.civNodeRingOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.civToolsRing.rotation.x = -Math.PI / 2;
    this.civToolsRing.position.y = WORLD.civCityLift * 1.8;
    this.civCity.add(this.civToolsRing);

    this.civCity.visible = false;
    this.scene.add(this.civCity);

    on(window, 'resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  dispose() {
    this.events.abort();
    this.controls.dispose();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    const collect = object => {
      if (object?.isBufferGeometry) geometries.add(object);
      if (object?.isMaterial) materials.add(object);
      if (object?.isTexture) textures.add(object);
      if (object?.geometry) geometries.add(object.geometry);
      for (const material of [object?.material].flat()) if (material) materials.add(material);
    };
    this.scene.traverse(collect);
    Object.values(this).forEach(collect);
    for (const material of materials) {
      Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
      material.dispose();
    }
    textures.forEach(texture => texture.dispose());
    geometries.forEach(geometry => geometry.dispose());
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  syncFoods(foods) {
    while (this.foodMeshes.length < foods.length) {
      const m = new THREE.Mesh(this.foodGeo, this.foodMat.clone());
      this.scene.add(m);
      this.foodMeshes.push(m);
    }
    while (this.foodMeshes.length > foods.length) {
      const m = this.foodMeshes.pop();
      this.scene.remove(m);
      m.material.dispose();
    }
  }

  // stage-12：昼夜光照——按 state.light(0..1) 在昼/夜端点间插值灯光强度与色相：
  // 夜里整体压暗、光色转冷（月色），白昼恢复日光强度，与叶绿体产能/视野的变化同步。
  applyDaylight(light = 1) {
    const l = Math.max(0, Math.min(1, light));
    const dn = this._dn;
    this.hemi.intensity = 0.28 + (1.1 - 0.28) * l; // 环境光强度：夜 0.28 -> 昼 1.1
    this.hemi.color.copy(dn.skyNight).lerp(dn.skyDay, l);
    this.hemi.groundColor.copy(dn.groundNight).lerp(dn.groundDay, l);
    this.sun.intensity = 0.1 + (0.9 - 0.1) * l;    // 主光强度：夜 0.1 -> 昼 0.9
    this.sun.color.copy(dn.sunNight).lerp(dn.sunDay, l);
    this.scene.background.copy(dn.bgNight).lerp(dn.bgDay, l);
  }

  render(state) {
    // stage-12：先按当前光照刷新灯光与场景底色，再绘制本帧内容
    this.applyDaylight(state.light ?? 1);
    this._map = state.map; // stage-13：地面拾取用的地图快照
    this.syncFoods(state.foods);
    this.updateMap(state);
    this.updatePlants(state);
    this.updateTribes(state); // stage-15：群体领地圈/标记/指令落点（画在个体之下）
    this.updateCivilization(state); // stage-16：资源点/采集作用圈/建城标识
    this.updateCells(state);
    this.updateOrganisms(state);
    this.updateOrgSelection(state);
    this.updateHover(state);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // stage-11：网格地形瓦片——按瓦片类型（草地/水域/沙地）逐实例着色，
  // 地形只读且同种子可复现，故按 `${cols}x${rows}@${seed}` 缓存，仅在换图时重建。
  // stage-13：缓存键追加 map.rev——排水/注水会改写单格地表（rev+1），据此重建瓦片实例。
  updateMap(state) {
    const map = state.map;
    if (!map) return;
    const key = `${map.cols}x${map.rows}@${map.seed}#${map.rev || 0}`;
    if (key !== this._tileKey) {
      if (this.tileInst) {
        this.scene.remove(this.tileInst);
        this.tileInst.dispose();
      }
      const count = map.cols * map.rows;
      const inst = new THREE.InstancedMesh(this.tileGeo, this.tileMat, count);
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const size = map.cellSize * WORLD.tileFill;
      let i = 0;
      for (let gy = 0; gy < map.rows; gy++) {
        for (let gx = 0; gx < map.cols; gx++) {
          const t = map.tiles[gy * map.cols + gx];
          const cx = -map.half + (gx + 0.5) * map.cellSize;
          const cz = -map.half + (gy + 0.5) * map.cellSize;
          this._dummy.position.set(cx, WORLD.tileLift, cz);
          this._dummy.rotation.set(-Math.PI / 2, 0, 0);
          this._dummy.scale.set(size, size, 1);
          this._dummy.updateMatrix();
          inst.setMatrixAt(i, this._dummy.matrix);
          inst.setColorAt(i, this._tileColors[t] || this._tileColors[0]);
          i += 1;
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.scene.add(inst);
      this.tileInst = inst;
      this._tileKey = key;
      this._tileLegend = Object.keys(TILE_KEY).length; // 瓦片类型数（供调试/断言）
      this._dummy.rotation.set(0, 0, 0);
    }
  }

  // stage-11：生产者（植物）渲染——尺寸与颜色都随生物量走（幼株小且暗 -> 成熟大且亮），
  // 让“哪片草地被啃光、哪里牧草丰美”一眼可见；容量不足时截断（reducer 有存量上限）。
  updatePlants(state) {
    const plants = state.plants || [];
    const cap = this.plantInst.count;
    const n = Math.min(plants.length, cap);
    for (let i = 0; i < n; i++) {
      const p = plants[i];
      const ratio = biomassRatio(p);
      const s = WORLD.plantRenderMinScale + ratio * (1 - WORLD.plantRenderMinScale);
      this._dummy.position.set(p.pos[0], WORLD.floorY + s * 0.5, p.pos[1]);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.setScalar(s);
      this._dummy.updateMatrix();
      this.plantInst.setMatrixAt(i, this._dummy.matrix);
      const col = this._tmpColor.copy(this._plantYoung).lerp(this._plantRipe, ratio);
      this.plantInst.setColorAt(i, col);
    }
    for (let i = n; i < cap; i++) {
      this._dummy.position.set(0, -1000, 0);
      this._dummy.scale.setScalar(0.0001);
      this._dummy.updateMatrix();
      this.plantInst.setMatrixAt(i, this._dummy.matrix);
    }
    this.plantInst.instanceMatrix.needsUpdate = true;
    if (this.plantInst.instanceColor) this.plantInst.instanceColor.needsUpdate = true;
  }

  // ---- stage-15：群体与领地标识 ----
  // 按群体 id 的序号在调色板里稳定取色（tribe-3 -> palette[2]），同一群体跨帧同色，
  // 且成员个体、领地圈、悬浮标记共用同一色源——「谁跟谁是一伙」不靠文字也看得出来。
  _tribeColorOf(t) {
    const n = Number(String(t.id).split('-').pop());
    const i = Number.isFinite(n) ? Math.abs(n - 1) % this._tribePalette.length : 0;
    return this._tribePalette[i];
  }

  // 领地圈 / 悬浮标记按需懒创建（几何体共享，材质各自一份以支持逐群体着色与透明度）
  _ensureTribeLayers(n) {
    while (this.tribeRings.length < n) {
      const ring = new THREE.Mesh(
        this.tribeRingGeo,
        new THREE.MeshBasicMaterial({
          color: COLORS.tribe.palette[0],
          transparent: true,
          opacity: WORLD.tribeRingOpacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this.tribeRings.push(ring);

      const mark = new THREE.Mesh(
        this.tribeMarkGeo,
        new THREE.MeshBasicMaterial({
          color: COLORS.tribe.palette[0],
          transparent: true,
          opacity: WORLD.tribeMarkOpacity,
          depthWrite: false,
        })
      );
      mark.visible = false;
      this.scene.add(mark);
      this.tribeMarks.push(mark);
    }
  }

  // 每帧刷新群体标识：领地圈（范围）、悬浮标记（位置+自转）、指令落点（移动指令），
  // 并顺带产出「成员 id -> 群体色」映射，供 updateOrganisms 给成员个体打着群体色偏向。
  updateTribes(state) {
    const tribes = state.tribes || [];
    const shown = tribes.slice(0, WORLD.tribeRenderMax);
    const selId = this.selectedTribeId;
    this._ensureTribeLayers(shown.length);
    const memberColor = new Map();
    const byId = new Map(tribes.map((t) => [t.id, t]));
    for (let i = 0; i < this.tribeRings.length; i++) {
      const ring = this.tribeRings[i];
      const mark = this.tribeMarks[i];
      const t = shown[i];
      if (!t) {
        ring.visible = false;
        mark.visible = false;
        continue;
      }
      const selected = t.id === selId;
      const col = new THREE.Color().copy(this._tribeColorOf(t));
      if (t.noBreed) col.lerp(this._tribeBanColor, 0.4); // 繁殖禁令：该群体标识偏向禁令色
      if (selected) col.lerp(this._tribeSelColor, 0.5);  // 选中：向高亮色偏一档
      // 领地圈：单位环按群体半径缩放，贴地放置
      ring.visible = true;
      ring.position.set(t.center[0], (WORLD.floorY || 0) + WORLD.tribeRingLift, t.center[1]);
      ring.scale.setScalar(t.radius);
      ring.material.color.copy(col);
      ring.material.opacity = selected ? WORLD.tribeRingOpacitySel : WORLD.tribeRingOpacity;
      // 悬浮标记：缓慢自转，位置随群体中心移动（中心在走 = 群体在迁移，肉眼可见）
      mark.visible = true;
      mark.position.set(t.center[0], (WORLD.floorY || 0) + WORLD.tribeMarkHeight, t.center[1]);
      mark.rotation.y = (state.time || 0) * 0.6;
      mark.scale.setScalar(WORLD.tribeMarkSize * (selected ? 1.35 : 1));
      mark.material.color.copy(col);
      mark.material.opacity = WORLD.tribeMarkOpacity;
      for (const mid of t.members) memberColor.set(mid, col);
    }
    this._memberTribeColor = memberColor;

    // 指令落点：仅被选中且处于「移动」指令的群体显示——避免全屏都是目标环
    const sel = selId ? byId.get(selId) : null;
    if (sel && sel.order && sel.order.mode === ORDER.MOVE && sel.order.tx != null) {
      this.tribeTarget.visible = true;
      this.tribeTarget.position.set(
        sel.order.tx,
        (WORLD.floorY || 0) + WORLD.tribeTargetLift,
        sel.order.tz
      );
      this.tribeTarget.scale.setScalar(WORLD.tribeTargetScale);
      this.tribeTarget.material.color.copy(this._tribeTargetColor);
    } else {
      this.tribeTarget.visible = false;
    }
  }

  // ---- stage-16：文明层渲染 ----
  // 资源点：水/食物/矿物三色晶体浮在不同地块上，剩余储量决定大小（采空后「蔫下去」并转灰）；
  // 作用圈：贴地环，玩家把群体派进圈内即在开采（环变亮绿并脉动）——采集闭环肉眼可验证；
  // 建城标识：进度满后原地长出「城郭圈 + 核心塔」，火科技点亮塔顶灯火（夜里更亮），
  // 工具科技在城郭外加一圈六边形环。全程只读 state.civ，不改任何世界数据。
  _ensureCivLayers(n) {
    while (this.civNodes.length < n) {
      const node = new THREE.Mesh(
        this.civNodeGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92 })
      );
      node.visible = false;
      this.scene.add(node);
      this.civNodes.push(node);

      const ring = new THREE.Mesh(
        this.civRingGeo,
        new THREE.MeshBasicMaterial({
          color: COLORS.resource.water,
          transparent: true,
          opacity: WORLD.civNodeRingOpacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this.civNodeRings.push(ring);
    }
  }

  updateCivilization(state) {
    const civ = state.civ || null;
    const nodes = civ?.nodes || [];
    this._ensureCivLayers(nodes.length);
    const t = state.time || 0;
    const floorY = WORLD.floorY || 0;
    const ringScale = WORLD.civNodeRadius * WORLD.civNodeRingScale; // 作用圈显示半径
    for (let i = 0; i < this.civNodes.length; i++) {
      const node = this.civNodes[i];
      const ring = this.civNodeRings[i];
      const n = nodes[i];
      if (!n) {
        node.visible = false;
        ring.visible = false;
        continue;
      }
      const left = Math.max(0, Math.min(1, n.stock / (n.max || 1)));
      const spent = n.stock <= 0;
      const busy = (n.gatherers || 0) > 0;
      const pulse = busy ? 1 + Math.sin(t * 4 + i * 1.7) * WORLD.civGatherPulse : 1;

      node.visible = true;
      node.position.set(n.x, floorY + WORLD.civNodeLift, n.z);
      node.rotation.y = t * 0.5 + i;
      node.scale.setScalar(
        WORLD.civNodeScale * (spent ? WORLD.civNodeSpentScale : 0.55 + 0.45 * left) * pulse
      );
      node.material.color.copy(spent ? this._civSpentColor : this._resColors[n.kind]);
      node.material.opacity = spent ? 0.4 : 0.92;

      ring.visible = true;
      ring.position.set(n.x, floorY + WORLD.tribeRingLift, n.z);
      ring.scale.setScalar(ringScale);
      ring.material.color.copy(
        busy ? this._civGatherColor : spent ? this._civSpentColor : this._resColors[n.kind]
      );
      ring.material.opacity = busy
        ? Math.min(1, WORLD.civNodeRingOpacity * 2.4)
        : spent
          ? WORLD.civNodeRingOpacity * 0.45
          : WORLD.civNodeRingOpacity;
    }

    // 建城标识：建成后才出现；灯火随昼夜变化（夜里更亮，火科技 = 照明的视觉证据）
    const city = civ?.built ? civ.city : null;
    this.civCity.visible = !!city;
    if (!city) return;
    const light = Math.max(0, Math.min(1, state.light ?? 1));
    const fire = !!civ.techs?.fire;
    this.civCity.position.set(city.x, floorY, city.z);
    this.civCityRing.scale.setScalar(city.radius);
    this.civCityCore.rotation.y = t * 0.25;
    this.civFire.visible = fire;
    this.civFireHalo.visible = fire;
    this.civFireHalo.scale.setScalar(city.radius * 0.55);
    this.civFireHalo.material.opacity =
      WORLD.civNodeRingOpacity * (WORLD.civFireLightDay + WORLD.civFireLightNight * (1 - light));
    this.civFire.material.opacity = fire ? 0.75 + 0.25 * (1 - light) : 0;
    this.civToolsRing.visible = !!civ.techs?.tools;
    this.civToolsRing.scale.setScalar(city.radius * 1.12);
    this.civToolsRing.rotation.z = t * 0.6;
  }

  // stage-09：组装模式下在被编辑有机体脚下画选中环，提示“正在拼装这一只”
  updateOrgSelection(state) {
    const ed = state.orgEditor;
    const org = ed ? state.organisms.find((o) => o.id === ed.organismId) : null;
    if (!org) {
      this.orgRing.visible = false;
      return;
    }
    this.orgRing.visible = true;
    const r = Math.max(1.1, org.moduleCount * 0.42);
    this.orgRing.position.set(org.pos[0], 0.06, org.pos[2] ?? org.pos[1]);
    this.orgRing.scale.setScalar(r / 0.95);
  }

  // stage-07/08：有机体模块逐实例摆放（拼成团），濒死模块向虚弱色灰化；
  // stage-08：按行为做模块着色提示——逃(flee)灰暗、压(chase)偏口器暖色、
  // 光合(photo)偏叶绿体绿，色值均取自 theme token（不硬编码）。
  updateOrganisms(state) {
    const weakFrac = WORLD.weakEnergyFrac;
    const orgs = state.organisms;
    const editId = state.orgEditor ? state.orgEditor.organismId : -1;
    let idx = 0;
    const capacity = this.orgInst.count;
    for (const o of orgs) {
      if (idx >= capacity) break;
      const eFrac = o.maxEnergy > 0 ? Math.max(0, o.energy / o.maxEnergy) : 0;
      const bodyCol = this._baseColors[o.colorIndex];
      const beh = o.behavior || 'wander';
      const editing = o.id === editId;
      for (const m of o.layout) {
        if (idx >= capacity) break;
        const [wx, wy, wz] = moduleWorldPos(o, m);
        this._orgOwner[idx] = o.id; // stage-09：实例归属，供点选有机体
        this._dummy.position.set(wx, wy, wz);
        const r = moduleRadiusOf(m);
        this._dummy.scale.setScalar(r);
        const col = this._tmpColor.copy(
          m.type === 'body' ? bodyCol : this._typeColors[m.type]
        );
        if (eFrac < weakFrac) {
          const t = 1 - eFrac / weakFrac;
          col.lerp(this._weakColor, Math.min(1, t * 1.2));
        } else if (beh === 'flee') {
          col.lerp(this._weakColor, 0.28); // 受惊：整体灰暗
        } else if (beh === 'chase') {
          col.lerp(this._typeColors.mouth, 0.42); // 压制：偏口器暖色
        } else if (beh === 'photo') {
          col.lerp(this._typeColors.chloroplast, 0.34); // 光合：偏叶绿体绿
        }
        // stage-14：带脑个体整体向标识色偏一档——“会思考”的谱系一眼可辨（色走 theme token）
        if (o.brain) col.lerp(this._nnColor, WORLD.nnMarkLerp);
        // stage-15：群体成员向本群体标识色偏一档——同一伙的个体在外观上抱团（色走 theme token）
        const tribeCol = this._memberTribeColor ? this._memberTribeColor.get(o.id) : null;
        if (tribeCol) col.lerp(tribeCol, WORLD.tribeMemberLerp);
        // stage-09：组装中的目标有机体整体提亮，和非编辑对象区分（色走 theme token）
        if (editing) col.lerp(this._editColor, 0.45);
        this.orgInst.setColorAt(idx, col);
        this._dummy.updateMatrix();
        this.orgInst.setMatrixAt(idx, this._dummy.matrix);
        idx += 1;
      }
    }
    for (let i = idx; i < capacity; i++) {
      this._orgOwner[i] = -1; // stage-09：空实例无归属
      this._dummy.position.set(0, -1000, 0);
      this._dummy.scale.setScalar(0.0001);
      this._dummy.updateMatrix();
      this.orgInst.setMatrixAt(i, this._dummy.matrix);
    }
    this.orgInst.instanceMatrix.needsUpdate = true;
    if (this.orgInst.instanceColor) this.orgInst.instanceColor.needsUpdate = true;
  }

  // 按基因/能量状态逐实例写入矩阵与颜色
  updateCells(state) {
    const cells = state.cells;
    const weakFrac = WORLD.weakEnergyFrac;
    const max = this.inst.count;
    for (let i = 0; i < max; i++) {
      const c = i < cells.length ? cells[i] : null;
      if (!c) {
        this._dummy.position.set(0, -1000, 0);
        this._dummy.scale.setScalar(0.0001);
      } else {
        const eFrac = c.maxEnergy > 0 ? Math.max(0, c.energy / c.maxEnergy) : 0;
        this._dummy.position.set(c.pos[0], c.pos[1], c.pos[2]);
        this._dummy.scale.setScalar(c.radius); // 体型基因 -> scale
        const col = this._tmpColor.copy(this._baseColors[c.colorIndex]);
        if (eFrac < weakFrac) {
          // 濒死：向虚弱色灰化（instanced 无法逐实例透明，以色相替代）
          const t = 1 - eFrac / weakFrac;
          col.lerp(this._weakColor, Math.min(1, t * 1.2));
        } else {
          // 健康：能量越高越亮，微弱脉动提供“活体发光”感
          const pulse = 0.85 + eFrac * 0.3 + Math.sin(state.time * 2 + c.id) * 0.06;
          col.multiplyScalar(pulse);
        }
        this.inst.setColorAt(i, col);
      }
      this._dummy.updateMatrix();
      this.inst.setMatrixAt(i, this._dummy.matrix);
    }
    this.inst.instanceMatrix.needsUpdate = true;
    if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;
  }

  // stage-13：地面拾取——把指针射线与地面水平面求交，换算成网格坐标。
  // 返回 { gx, gy, x, z, tile }（tile 为地表类型），越界/相机平行地面时返回 null。
  pickGroundTile(map, px, py) {
    if (!map) return null;
    this._raycaster.setFromCamera(new THREE.Vector2(px, py), this.camera);
    if (!this._groundPlane) {
      this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WORLD.floorY || 0));
    }
    const hit = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(this._groundPlane, hit)) return null;
    const { gx, gy } = worldToGrid(map, hit.x, hit.z);
    if (gx < 0 || gy < 0 || gx >= map.cols || gy >= map.rows) return null;
    return { gx, gy, x: hit.x, z: hit.z, tile: tileAtGrid(map, gx, gy) };
  }

  // stage-13：把高亮方框挪到目标格（格心），供干预菜单指示落点
  showEnvMarker(map, gx, gy) {
    if (!map || !this.envMarker) return;
    const size = map.cellSize;
    this.envMarker.position.set(
      -map.half + (gx + 0.5) * size,
      (WORLD.floorY || 0) + WORLD.tileLift + WORLD.interventionMarkerLift,
      -map.half + (gy + 0.5) * size
    );
    this.envMarker.scale.setScalar(size);
    this.envMarker.visible = true;
  }

  hideEnvMarker() {
    if (this.envMarker) this.envMarker.visible = false;
  }

  // 悬停：命中细胞则显示其感知圈（半径 = perception 基因映射的 senseRange）
  updateHover(state) {
    if (!this._hasPointer) {
      this.senseRing.visible = false;
      return;
    }
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObject(this.inst, false);
    this._hoverIdx = hits.length ? hits[0].instanceId : -1;
    const c = this._hoverIdx >= 0 && this._hoverIdx < state.cells.length ? state.cells[this._hoverIdx] : null;
    if (!c) {
      this.senseRing.visible = false;
      return;
    }
    this.senseRing.visible = true;
    this.senseRing.position.set(c.pos[0], c.pos[1] + 0.06, c.pos[2]);
    this.senseRing.scale.setScalar(Math.max(0.1, c.senseRange));
  }
}
