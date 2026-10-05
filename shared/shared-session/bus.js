// 跨模块事件总线：同源页面/iframe 之间同步会话与存档。
// Node（无 window/BroadcastChannel）下为安全空实现。
const NAME = 'iridescently';
let channel = null;

function hasWindow() {
  return typeof window !== 'undefined' && window;
}

function chan() {
  if (channel !== null) return channel;
  if (typeof BroadcastChannel === 'undefined') { channel = false; return channel; }
  const c = new BroadcastChannel(NAME);
  if (typeof c.unref === 'function') c.unref(); // Node：避免保持事件循环
  channel = c;
  return channel;
}

/** 广播一条消息（Node 下为空操作）。 */
export function publish(type, payload) {
  const c = chan();
  if (c) c.postMessage({ type, payload });
  else if (hasWindow()) window.dispatchEvent(new CustomEvent('iridescently:' + type, { detail: payload }));
}

/** 订阅指定类型消息，返回取消函数。 */
export function subscribe(type, handler) {
  const c = chan();
  if (c) {
    const onMsg = (e) => { if (e.data && e.data.type === type) handler(e.data.payload); };
    c.addEventListener('message', onMsg);
    return () => c.removeEventListener('message', onMsg);
  }
  if (!hasWindow()) return () => {};
  const onEv = (e) => handler(e.detail);
  window.addEventListener('iridescently:' + type, onEv);
  return () => window.removeEventListener('iridescently:' + type, onEv);
}
