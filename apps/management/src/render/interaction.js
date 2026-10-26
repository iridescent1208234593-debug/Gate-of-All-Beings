/** Pointer events unify mouse, pen and touch. A drag/pinch never becomes a build tap. */
export function bindMapInteraction(engine, { onTap, onCancel }) {
  const canvas = engine.canvas;
  const abort = new AbortController();
  const pointers = new Map();
  let gesture = false;
  const listen = (name, fn, options = {}) => canvas.addEventListener(name, fn, { ...options, signal: abort.signal });
  const hover = e => engine.setPointer(e.clientX, e.clientY);
  listen('pointerdown', e => {
    if (e.button !== 0 && e.button !== 1) return;
    canvas.focus({ preventScroll: true });
    if (!pointers.size) gesture = e.button === 1;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
    if (pointers.size > 1) gesture = true;
    canvas.setPointerCapture(e.pointerId);
    hover(e);
  });
  listen('pointermove', e => {
    const previous = pointers.get(e.pointerId);
    if (!previous) { hover(e); return; }
    const oldPoints = [...pointers.values()];
    const oldCenter = center(oldPoints);
    const oldDistance = distance(oldPoints);
    if (Math.hypot(e.clientX - previous.startX, e.clientY - previous.startY) > 6) gesture = true;
    pointers.set(e.pointerId, { ...previous, x: e.clientX, y: e.clientY });
    const points = [...pointers.values()];
    const nextCenter = center(points);
    if (gesture) {
      engine.panPixels(oldCenter.x, oldCenter.y, nextCenter.x, nextCenter.y);
      if (points.length > 1 && oldDistance > 0) engine.zoomAt(distance(points) / oldDistance, nextCenter.x, nextCenter.y);
      canvas.classList.add('is-dragging');
    }
    hover(e);
  });
  listen('pointerup', e => {
    if (!pointers.has(e.pointerId)) return;
    const tap = !gesture && pointers.size === 1 && e.button === 0;
    pointers.delete(e.pointerId);
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (tap) { hover(e); onTap(engine.pick(e.clientX, e.clientY)); }
    if (!pointers.size) canvas.classList.remove('is-dragging');
  });
  const cancel = e => {
    pointers.delete(e.pointerId);
    gesture = true;
    if (!pointers.size) canvas.classList.remove('is-dragging');
  };
  listen('pointercancel', cancel);
  listen('lostpointercapture', cancel);
  listen('pointerleave', () => { if (!pointers.size) engine.setMouse(-1, -1, false); });
  listen('wheel', e => {
    e.preventDefault();
    engine.zoomAt(Math.exp(-Math.max(-200, Math.min(200, e.deltaY)) * 0.002), e.clientX, e.clientY);
    hover(e);
  }, { passive: false });
  listen('contextmenu', e => { e.preventDefault(); onCancel(); });
  listen('keydown', e => {
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const directions = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] };
    if (directions[e.key]) {
      e.preventDefault();
      engine.panPixels(x, y, x + directions[e.key][0], y + directions[e.key][1]);
    } else if (['+', '=', '-'].includes(e.key)) {
      e.preventDefault(); engine.zoomAt(e.key === '-' ? 0.85 : 1.15, x, y);
    } else if (e.key === 'Home') { e.preventDefault(); engine.resetView(); }
  });
  return () => { abort.abort(); pointers.clear(); canvas.classList.remove('is-dragging'); };
}

function center(points) {
  return { x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length };
}
function distance(points) { return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); }
