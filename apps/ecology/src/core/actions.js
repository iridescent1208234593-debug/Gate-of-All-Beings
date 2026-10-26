// 动作工厂
// stage-06：细胞编辑器动作——暂停/打开编辑器/微调基因（消耗进化点）/应用基因并投放展示子代/关闭面板
// stage-07：spawnOrganism——手动投放一只随机多模块有机体
export const Actions = {
  tick(dt) {
    return { type: 'TICK', dt };
  },
  togglePause() {
    return { type: 'TOGGLE_PAUSE' };
  },
  openEditor(cellId) {
    return { type: 'OPEN_EDITOR', cellId };
  },
  editGene(key, dir) {
    return { type: 'EDIT_GENE', key, dir };
  },
  applyGenome() {
    return { type: 'APPLY_GENOME' };
  },
  closeEditor() {
    return { type: 'CLOSE_EDITOR' };
  },
  spawnOrganism() {
    return { type: 'SPAWN_ORGANISM' };
  },
  // ---- stage-09 生成编辑器（组装模式）----
  openOrgEditor(organismId) {
    return { type: 'OPEN_ORG_EDITOR', organismId };
  },
  setModuleType(moduleType) {
    return { type: 'SET_MODULE_TYPE', moduleType };
  },
  toggleModuleCell(gx, gy) {
    return { type: 'TOGGLE_MODULE_CELL', gx, gy };
  },
  applyLayout() {
    return { type: 'APPLY_LAYOUT' };
  },
  closeOrgEditor() {
    return { type: 'CLOSE_ORG_EDITOR' };
  },
  // ---- stage-12 昼夜循环与经营面板 ----
  setTimeScale(scale) {
    return { type: 'SET_TIME_SCALE', scale };
  },
  // ---- stage-13 环境干预（点击地面 -> 播种 / 改地表 / 调温）----
  seedPlants(gx, gy) {
    return { type: 'SEED_PLANTS', gx, gy };
  },
  drainTile(gx, gy) {
    return { type: 'DRAIN_TILE', gx, gy }; // 排水成陆：水 -> 草
  },
  fillTile(gx, gy) {
    return { type: 'FILL_TILE', gx, gy };  // 注水成湖：陆 -> 水
  },
  adjustTemp(delta) {
    return { type: 'ADJUST_TEMP', delta }; // 基线气候调温（步长由 theme token 决定）
  },
  resetTemp() {
    return { type: 'RESET_TEMP' };         // 温度偏移归零
  },
  // ---- stage-15 群体与领地（对群体下指令，而不是对个体）----
  setTribeOrder(tribeId, mode, tx, tz) {
    return { type: 'SET_TRIBE_ORDER', tribeId, mode, tx, tz };
  },
  toggleTribeBreed(tribeId) {
    return { type: 'TOGGLE_TRIBE_BREED', tribeId }; // 繁殖禁令开关
  },
  // ---- stage-16 文明最小闭环（建城资料页已读标记）----
  ackCity() {
    return { type: 'ACK_CITY' };
  },
};
