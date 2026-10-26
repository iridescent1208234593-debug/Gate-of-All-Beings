/**
 * 灵境会馆 - Action 类型常量
 * 单向数据流：Action → reducer → GameState → 渲染
 */
export const ActionTypes = {
  /** 推进一个模拟 tick（由 gameLoop 每 250ms 派发） */
  TICK: 'TICK',
  /** 切换倍速 { rate: 1|2|3 } */
  SET_SPEED: 'SET_SPEED',
  /** 暂停 / 继续 */
  TOGGLE_PAUSE: 'TOGGLE_PAUSE',
  /** 放置建筑 { buildingId, x, y } */
  BUILD_PLACE: 'BUILD_PLACE',
  /** 移动建筑 { buildingId, x, y }（免费，校验不越界/不重叠/不占资源点） */
  BUILD_MOVE: 'BUILD_MOVE',
  /** 拆除建筑 { buildingId }（返还 50% 资源，释放地块） */
  BUILD_DEMOLISH: 'BUILD_DEMOLISH',
  /** 取消建造模式（纯 UI 状态，由 UI 层处理，不入 reducer） */
  BUILD_CANCEL: 'BUILD_CANCEL',
  /** 扩展灵质空间 { dir: 'east' | 'south' }，花费灵质 */
  SPACE_EXPAND: 'SPACE_EXPAND',
  /** 修改游戏设置 { difficulty?, eventFrequency? } */
  SET_SETTINGS: 'SET_SETTINGS',
  /** 新增小妖 { element?, name? } */
  ADD_COLONIST: 'ADD_COLONIST',
  /** 调试/测试用：直接增减资源 { spirit?, food? } */
  ADD_RESOURCE: 'ADD_RESOURCE',
  /** 调试/测试用：将某小妖需求补满 { colonistId } */
  DEBUG_FILL_NEEDS: 'DEBUG_FILL_NEEDS',
  /** 强制触发随机事件（调试/测试）：{ eventId } */
  TRIGGER_EVENT: 'TRIGGER_EVENT',
  /** 开始研究 { researchId } */
  RESEARCH_START: 'RESEARCH_START',
  /** 取消研究 */
  CANCEL_RESEARCH: 'CANCEL_RESEARCH',
  /** 时代跃迁：条件满足时推进到下一时代 */
  ERA_ADVANCE: 'ERA_ADVANCE',
  /** 开启远征 { colonistIds, target } */
  EXPEDITION_START: 'EXPEDITION_START',
  /** 强制返回远征队（调试/测试用） */
  EXPEDITION_RETURN: 'EXPEDITION_RETURN',
  // ---- R1 配方合成 ----
  /** 将配方加入炼制队列 { recipeId } */
  CRAFT_ENQUEUE: 'CRAFT_ENQUEUE',
  /** 将配方移出炼制队列（取消排队） { recipeId } */
  CRAFT_CANCEL: 'CRAFT_CANCEL',
};
