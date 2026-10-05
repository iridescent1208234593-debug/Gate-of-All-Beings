const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function movementDirection(codes) {
  const x = Number(codes.has('KeyD')) - Number(codes.has('KeyA'));
  const z = Number(codes.has('KeyS')) - Number(codes.has('KeyW'));
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

// Only the focused arena owns movement keys. Editing or leaving clears held keys.
export function createSpiritController({ canvas, physics, acceleration = 20, onMove = () => {}, onStop = () => {} }) {
  const codes = new Set();
  const events = new AbortController();
  let active = false;
  const sceneActive = () => active && !document.hidden
    && (!document.body.dataset.softiePage || document.body.dataset.softiePage === 'spirit');
  let driveAcceleration = 20;
  let lastDirection = { x: 0, z: 0 };
  let target = null;
  let lastTargetSendAt = 0;
  const setAcceleration = value => {
    if (Number.isFinite(value)) driveAcceleration = Math.max(6, Math.min(28, value));
  };
  setAcceleration(acceleration);
  const listen = (target, type, fn) => target.addEventListener(type, fn, { signal: events.signal });
  const clear = (stop = false) => {
    codes.clear();
    target = null;
    physics.clearDrive();
    if (stop) { physics.velocity.x = physics.velocity.z = 0; onStop(); }
    if (lastDirection.x !== 0 || lastDirection.z !== 0) {
      lastDirection = { x: 0, z: 0 };
      onMove(lastDirection);
    }
  };
  listen(window, 'keydown', event => {
    if (!sceneActive() || document.activeElement !== canvas || !MOVE_CODES.has(event.code)
      || event.ctrlKey || event.metaKey || event.altKey || physics.diagnostics.dragging) return;
    event.preventDefault();
    target = null;
    codes.add(event.code);
  });
  listen(window, 'keyup', event => {
    codes.delete(event.code);
    if (MOVE_CODES.has(event.code) && active && document.activeElement === canvas) event.preventDefault();
  });
  listen(canvas, 'pointerdown', () => { if (active) canvas.focus({ preventScroll: true }); });
  listen(document, 'focusin', event => { if (event.target !== canvas) clear(true); });
  listen(window, 'blur', () => clear(true));
  listen(document, 'visibilitychange', () => { if (document.hidden) clear(true); });
  listen(document, 'softie-route', () => {
    if (document.body.dataset.softiePage !== 'spirit') clear(true);
  });
  return {
    setActive(value) {
      active = Boolean(value);
      clear(true);
      if (active) canvas.focus({ preventScroll: true });
    },
    update() {
      if (physics.diagnostics.dragging) {
        codes.clear();
        physics.clearDrive();
        return;
      }
      let direction = sceneActive() && document.activeElement === canvas
        ? movementDirection(codes) : { x: 0, z: 0 };
      if (sceneActive() && target) {
        const destination = typeof target.position === 'function' ? target.position() : target.position;
        if (!destination) target = null;
        else {
          const dx = destination.x - physics.position.x, dz = destination.z - physics.position.z;
          const distance = Math.hypot(dx, dz);
          if (distance <= target.stopDistance + 0.08) {
            target = null; codes.clear(); direction = { x: 0, z: 0 };
          } else {
            const towardX = dx / distance, towardZ = dz / distance;
            const approachSpeed = Math.max(0, physics.velocity.x * towardX + physics.velocity.z * towardZ);
            const brakingDistance = approachSpeed * approachSpeed / (2 * driveAcceleration);
            if (distance - target.stopDistance <= brakingDistance + 0.12) {
              const speed = Math.hypot(physics.velocity.x, physics.velocity.z) || 1;
              direction = { x: -physics.velocity.x / speed, z: -physics.velocity.z / speed };
            } else direction = { x: towardX, z: towardZ };
          }
        }
      }
      physics.setDriveAcceleration({ x: direction.x * driveAcceleration, z: direction.z * driveAcceleration });
      const changed = Math.hypot(direction.x - lastDirection.x, direction.z - lastDirection.z) > 0.025;
      const targetHeartbeat = target && performance.now() - lastTargetSendAt >= 100;
      if (changed || targetHeartbeat) {
        lastDirection = direction;
        if (target) lastTargetSendAt = performance.now();
        onMove({ ...direction });
      }
    },
    setTarget(next) {
      codes.clear();
      target = next && (typeof next.position === 'function' || next.position)
        ? { position: next.position, stopDistance: Math.max(0, next.stopDistance ?? 0) } : null;
      lastTargetSendAt = 0;
      if (target && document.activeElement !== canvas) canvas.focus({ preventScroll: true });
      return Boolean(target);
    },
    setAcceleration,
    clear,
    getDiagnostics: () => ({ active, keys: [...codes], focused: document.activeElement === canvas,
      acceleration: driveAcceleration, targeting: Boolean(target) }),
    dispose() { active = false; clear(true); events.abort(); },
  };
}
