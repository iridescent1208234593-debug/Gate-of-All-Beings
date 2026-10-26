import * as THREE from 'three/webgpu';

/** Pointer input uses each skin's picking meshes and authored coordinate space. */
export function createSpiritPointerInteraction({ canvas, camera, spirit, getRemoteSpirits = () => new Map(),
  onActivity, onCommand, onStart, onMoveTo, onPoke }) {
  const physics = spirit.physics;
  const events = new AbortController();
  const listen = (target, type, fn) => target.addEventListener(type, fn, { signal: events.signal });
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const groundNormal = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const target = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const pinchAnchor = new THREE.Vector3();
  const gaze = new THREE.Vector3();
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  let active = false;
  let disposed = false;
  let pointerId = null;
  let pointerType = null;
  let pinchPointerId = null;
  let primaryPoint = null;
  let pressPoint = null;
  let dragged = false;
  let pinchPoint = null;
  let pinchStartSpan = 1;
  let lastCommandAt = 0;
  let pinchCommandAt = 0;
  let deferredTarget = null;
  let deferredPinchRatio = null;
  let commandTimer = null;
  let pinchTimer = null;
  const face = () => spirit.skin?.faceMotion;
  const clearGaze = () => face()?.lookAt?.(0, 0);
  const sceneActive = () => active && !disposed && !document.hidden
    && (!document.body.dataset.softiePage || document.body.dataset.softiePage === 'spirit');
  const activity = () => onActivity?.();
  const endPinch = () => {
    const id = pinchPointerId;
    if (id === null) return;
    clearTimeout(pinchTimer); pinchTimer = null;
    if (deferredPinchRatio !== null) onCommand?.({ type: 'pinch', phase: 'move', ratio: deferredPinchRatio });
    deferredPinchRatio = null; pinchPointerId = null; pinchPoint = null;
    onCommand?.({ type: 'pinch', phase: 'end' });
    physics.endPinch();
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  };
  const updatePinch = () => {
    if (pinchPointerId === null || !primaryPoint || !pinchPoint) return;
    const ratio = Math.hypot(primaryPoint.x - pinchPoint.x, primaryPoint.y - pinchPoint.y) / pinchStartSpan;
    physics.movePinch(ratio);
    const now = performance.now();
    if (now - pinchCommandAt >= 80) {
      pinchCommandAt = now; deferredPinchRatio = null;
      onCommand?.({ type: 'pinch', phase: 'move', ratio });
    } else {
      deferredPinchRatio = ratio;
      if (!pinchTimer) pinchTimer = setTimeout(() => {
        pinchTimer = null;
        if (pinchPointerId !== null && deferredPinchRatio !== null) {
          pinchCommandAt = performance.now();
          const latest = deferredPinchRatio; deferredPinchRatio = null;
          onCommand?.({ type: 'pinch', phase: 'move', ratio: latest });
        }
      }, Math.max(1, 80 - (now - pinchCommandAt)));
    }
  };
  const release = (celebrate = false, stop = false) => {
    const id = pointerId;
    endPinch();
    pointerId = pointerType = null;
    primaryPoint = null;
    if (id !== null) {
      clearTimeout(commandTimer); commandTimer = null;
      const finalTarget = deferredTarget; deferredTarget = null;
      if (finalTarget) onCommand?.({ type: 'grab', phase: 'move', target: finalTarget });
      onCommand?.({ type: 'grab', phase: 'end' });
      physics.endGrab();
      face()?.grab?.(false, celebrate);
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    physics.clearDrive();
    if (stop) physics.velocity.x = physics.velocity.z = 0;
    canvas.style.cursor = sceneActive() ? 'grab' : 'default';
  };
  const clear = () => { release(false, true); clearGaze(); };
  const ray = event => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0
      || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2);
    camera.updateMatrixWorld();
    spirit.root.updateWorldMatrix(true, true);
    raycaster.setFromCamera(ndc, camera);
    return true;
  };
  const closestRemote = () => {
    let closest = null;
    for (const [id, remote] of getRemoteSpirits()) {
      remote.instance.root.updateWorldMatrix(true, true);
      const hit = raycaster.intersectObjects(remote.instance.pickMeshes, true)[0];
      if (hit && (!closest || hit.distance < closest.hit.distance)) closest = { id, remote, hit };
    }
    return closest;
  };
  const followGaze = event => {
    if (event.pointerType !== 'mouse' || face()?.isSleeping) { clearGaze(); return; }
    if (!face()?.lookAt) return;
    const rect = canvas.getBoundingClientRect();
    physics.deform(0, 1.2, 1.15, gaze);
    spirit.skin.root.localToWorld(gaze);
    gaze.project(camera);
    const x = rect.left + (gaze.x + 1) * rect.width / 2;
    const y = rect.top + (1 - gaze.y) * rect.height / 2;
    face().lookAt((event.clientX - x) / (rect.width * 0.24),
      (y - event.clientY) / (rect.height * 0.24));
  };
  listen(canvas, 'pointerdown', event => {
    if (!sceneActive() || event.button !== 0 || !ray(event)) return;
    if (pointerId !== null) {
      if (pointerType !== 'touch' || event.pointerType !== 'touch' || pinchPointerId !== null) return;
      const hit = raycaster.intersectObjects(spirit.pickMeshes, true)[0];
      if (!hit) return;
      spirit.skin.root.worldToLocal(pinchAnchor.copy(hit.point));
      const axis = pinchAnchor.sub(anchor);
      if (axis.length() < 0.05) return;
      pinchPointerId = event.pointerId;
      pinchPoint = { x: event.clientX, y: event.clientY };
      pinchStartSpan = Math.max(1, Math.hypot(primaryPoint.x - pinchPoint.x, primaryPoint.y - pinchPoint.y));
      physics.beginPinch(axis);
      pinchCommandAt = performance.now();
      onCommand?.({ type: 'pinch', phase: 'start', axis: { x: axis.x, y: axis.y, z: axis.z } });
      try { canvas.setPointerCapture(pinchPointerId); }
      catch { endPinch(); return; }
      activity(); event.preventDefault();
      return;
    }
    canvas.focus({ preventScroll: true });
    const other = closestRemote();
    if (other) {
      onMoveTo?.({ spiritId: other.id, instance: other.remote.instance });
      activity(); event.preventDefault();
      return;
    }
    const hit = raycaster.intersectObjects(spirit.pickMeshes, true)[0];
    if (!hit) {
      plane.set(groundNormal, 0);
      if (raycaster.ray.intersectPlane(plane, target)) {
        onMoveTo?.({ position: { x: target.x, z: target.z } });
        canvas.focus({ preventScroll: true });
        canvas.style.cursor = 'crosshair';
        activity(); event.preventDefault();
      }
      return;
    }
    // Skin scale is removed here; deformation anchors always use authored units.
    spirit.skin.root.worldToLocal(anchor.copy(hit.point));
    camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(normal, hit.point);
    pointerId = event.pointerId;
    pointerType = event.pointerType;
    primaryPoint = { x: event.clientX, y: event.clientY };
    pressPoint = { ...primaryPoint };
    dragged = false;
    physics.clearDrive();
    onStart?.();
    physics.beginGrab(anchor, hit.point);
    lastCommandAt = performance.now();
    onCommand?.({ type: 'grab', phase: 'start', anchor: { x: anchor.x, y: anchor.y, z: anchor.z },
      target: { x: hit.point.x, y: hit.point.y, z: hit.point.z } });
    face()?.grab?.(true);
    try { canvas.setPointerCapture(pointerId); }
    catch { clear(); return; }
    canvas.style.cursor = 'grabbing';
    activity();
    event.preventDefault();
  });
  listen(canvas, 'pointermove', event => {
    if (!sceneActive()) return;
    if (pointerId !== null && event.pointerId !== pointerId && event.pointerId !== pinchPointerId) return;
    if (!ray(event)) return;
    followGaze(event);
    if (event.pointerId === pointerId) primaryPoint = { x: event.clientX, y: event.clientY };
    if (event.pointerId === pinchPointerId) pinchPoint = { x: event.clientX, y: event.clientY };
    if (pinchPointerId !== null) updatePinch();
    if (event.pointerId === pointerId) {
      if (pressPoint && Math.hypot(event.clientX - pressPoint.x, event.clientY - pressPoint.y) > 7) dragged = true;
      if (raycaster.ray.intersectPlane(plane, target)) {
        physics.moveGrab(target);
        const position = { x: target.x, y: target.y, z: target.z };
        if (performance.now() - lastCommandAt >= 60) {
          lastCommandAt = performance.now(); deferredTarget = null;
          onCommand?.({ type: 'grab', phase: 'move', target: position });
        } else {
          deferredTarget = position;
          if (!commandTimer) commandTimer = setTimeout(() => {
            commandTimer = null;
            if (pointerId === event.pointerId && deferredTarget) {
              lastCommandAt = performance.now();
              const latest = deferredTarget; deferredTarget = null;
              onCommand?.({ type: 'grab', phase: 'move', target: latest });
            }
          }, Math.max(1, 60 - (performance.now() - lastCommandAt)));
        }
      }
      activity();
      event.preventDefault();
    } else {
      canvas.style.cursor = raycaster.intersectObjects(spirit.pickMeshes, true).length ? 'grab' : 'default';
    }
  });
  listen(canvas, 'pointerup', event => {
    if (event.pointerId === pinchPointerId) {
      endPinch(); activity(); event.preventDefault(); return;
    }
    if (event.pointerId !== pointerId) return;
    const wasTap = !dragged;
    release(true);
    if (wasTap) onPoke?.();
    activity();
    event.preventDefault();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    listen(canvas, type, event => {
      if (event.pointerId === pointerId) clear();
      else if (event.pointerId === pinchPointerId) endPinch();
    });
  }
  listen(canvas, 'pointerleave', () => { if (pointerId === null) clearGaze(); });
  listen(window, 'blur', clear);
  listen(document, 'visibilitychange', () => { if (document.hidden) clear(); });
  listen(document, 'focusin', event => { if (event.target !== canvas) clear(); });
  listen(document, 'softie-route', () => { if (!sceneActive()) clear(); });
  return {
    setActive(value) { active = Boolean(value) && !disposed; clear(); },
    clear,
    getDiagnostics: () => ({ active, pointerId, pointerType, pinchPointerId,
      dragging: physics.diagnostics.dragging, pinching: physics.diagnostics.pinching }),
    dispose() {
      if (disposed) return;
      active = false; clear(); disposed = true; events.abort();
      canvas.style.touchAction = previousTouchAction;
      canvas.style.cursor = 'default';
    },
  };
}
