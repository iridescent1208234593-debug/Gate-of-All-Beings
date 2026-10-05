const ZERO = Object.freeze({ x: 0, z: 0 });
const encoder = new TextEncoder();

/** Small reliable JSON connection. Motion packets contain only inputSeq and direction. */
export class SpiritRoomClient {
  constructor({ url, roomId = 'forest', settings, onStatus = () => {}, onSnapshot = () => {}, onDisconnect = () => {} }) {
    this.url = url;
    this.roomId = roomId;
    this.settings = settings;
    this.onStatus = onStatus;
    this.onSnapshot = onSnapshot;
    this.onDisconnect = onDisconnect;
    this.socket = null;
    this.selfId = null;
    this.inputSeq = 0;
    this.direction = ZERO;
    this.sentBytes = 0;
    this.receivedBytes = 0;
    this.pendingInputs = [];
    this.grabTarget = null;
    this.snapshotCount = 0;
    this.lastSend = 0;
    this.retries = 0;
    this.closed = false;
    this.retryTimer = null;
    this.keepalive = setInterval(() => {
      if (performance.now() - this.lastSend < 200) return;
      if (this.direction.x || this.direction.z) this.move(this.direction);
      else if (this.grabTarget) this.command({ type: 'grab', phase: 'move', target: this.grabTarget });
    }, 50);
    this.connect();
  }

  connect() {
    if (this.closed) return;
    this.onStatus(this.retries ? '正在重连…' : '正在连接房间…');
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (socket !== this.socket || this.closed) return socket.close();
      this.send({ type: 'join', protocol: 1, roomId: this.roomId, settings: this.settings });
    });
    socket.addEventListener('message', event => {
      if (socket !== this.socket || this.closed) return;
      if (typeof event.data !== 'string') return;
      this.receivedBytes += encoder.encode(event.data).byteLength;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'error') { this.onStatus(message.error || '房间消息无效。'); return; }
      if (message.type === 'joined') {
        this.selfId = message.selfId;
        this.retries = 0;
        this.onStatus(`已加入房间 ${message.roomId}`);
      }
      if (message.type === 'joined' || message.type === 'snapshot') {
        this.snapshotCount++;
        this.onSnapshot(message);
      }
    });
    socket.addEventListener('close', event => {
      if (socket !== this.socket || this.closed) return;
      this.selfId = null;
      this.direction = ZERO;
      this.grabTarget = null;
      this.pendingInputs.length = 0;
      this.onDisconnect();
      if (event.code === 1008) { this.onStatus(event.reason || '无法加入房间。'); return; }
      if (this.retries >= 8) { this.onStatus('房间连接中断，请刷新后重试。'); return; }
      const delay = Math.min(500 * 2 ** this.retries++, 8000);
      this.onStatus(`连接中断，${Math.round(delay / 1000)} 秒后重连…`);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    });
    socket.addEventListener('error', () => {});
  }

  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    const payload = JSON.stringify(message);
    this.sentBytes += encoder.encode(payload).byteLength;
    this.socket.send(payload);
    this.lastSend = performance.now();
    return true;
  }

  move(direction) {
    const x = Number.isFinite(direction?.x) ? Math.max(-1, Math.min(1, direction.x)) : 0;
    const z = Number.isFinite(direction?.z) ? Math.max(-1, Math.min(1, direction.z)) : 0;
    this.direction = Math.hypot(x, z) > 1 ? { x: x / Math.hypot(x, z), z: z / Math.hypot(x, z) } : { x, z };
    if (!this.selfId) return;
    const inputSeq = ++this.inputSeq;
    if (!this.send({ type: 'move', inputSeq, direction: this.direction })) return;
    this.pendingInputs.push({ inputSeq, direction: this.direction });
    if (this.pendingInputs.length > 180) this.pendingInputs.splice(0, this.pendingInputs.length - 180);
  }

  command(command) {
    if (!command || typeof command !== 'object' || !this.selfId) return false;
    if (command.type === 'grab') {
      if (command.phase === 'start' || command.phase === 'move') this.grabTarget = { ...command.target };
      else if (command.phase === 'end') this.grabTarget = null;
    }
    return this.send({ type: 'command', inputSeq: ++this.inputSeq, command });
  }

  acknowledge(inputSeq) {
    while (this.pendingInputs.length && this.pendingInputs[0].inputSeq <= inputSeq) this.pendingInputs.shift();
    return this.pendingInputs;
  }

  setSettings(settings) {
    this.settings = settings;
    if (this.selfId && this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'profile', inputSeq: ++this.inputSeq, settings });
    }
  }

  diagnostics() {
    return {
      connected: Boolean(this.selfId && this.socket?.readyState === WebSocket.OPEN),
      roomId: this.roomId, selfId: this.selfId, inputSeq: this.inputSeq,
      pendingInputs: this.pendingInputs.length, snapshots: this.snapshotCount,
      sentBytes: this.sentBytes, receivedBytes: this.receivedBytes,
      bufferedAmount: this.socket?.bufferedAmount ?? 0,
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.keepalive);
    clearTimeout(this.retryTimer);
    this.direction = ZERO;
    this.grabTarget = null;
    this.socket?.close(1000, 'Leaving room.');
    this.selfId = null;
  }
}

/** Interpolate body state at the supplied delayed render timestamp. */
export function interpolateSpiritState(previous, next, alpha) {
  if (!previous) return structuredClone(next.state);
  const t = Math.max(0, Math.min(1, alpha));
  const state = structuredClone(next.state);
  for (const key of ['position', 'velocity']) for (const axis of ['x', 'y', 'z']) {
    state[key][axis] = previous.state[key][axis] + (next.state[key][axis] - previous.state[key][axis]) * t;
  }
  for (const [name, values] of Object.entries(state.modes)) {
    values[0] = previous.state.modes[name][0] + (next.state.modes[name][0] - previous.state.modes[name][0]) * t;
    values[1] = previous.state.modes[name][1] + (next.state.modes[name][1] - previous.state.modes[name][1]) * t;
  }
  return state;
}
