/**
 * 灵境会馆 - 事件系统（Event Bus）
 * 用于核心层与 UI/渲染层解耦：系统状态变化 → emit 事件 → 订阅者响应。
 * 不参与模拟逻辑，仅作为可选的观察者通道。
 */
export function createEventSystem() {
  const listeners = new Map();

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    const set = listeners.get(type);
    if (set) set.delete(fn);
  }

  function emit(type, payload) {
    const set = listeners.get(type);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        // 事件回调异常不影响主循环
        console.error(`[eventSystem] listener error on "${type}":`, err);
      }
    }
  }

  function clear() {
    listeners.clear();
  }

  function count(type) {
    return listeners.has(type) ? listeners.get(type).size : 0;
  }

  return { on, off, emit, clear, count };
}
