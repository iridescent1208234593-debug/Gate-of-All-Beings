export function bindGalleryGestures(
  target,
  hitTest,
  onSingle,
  onDouble,
  delay = 360,
) {
  let press = null;
  let pending = null;
  const clearPress = () => {
    press = null;
  };
  const flush = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    onSingle(pending.index);
    pending = null;
  };
  const onDown = (event) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    const index = hitTest(event);
    if (index < 0) return;
    press = {
      index,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      pointerId: event.pointerId,
    };
  };
  const onUp = (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const held = press;
    press = null;
    const dx = event.clientX - held.x;
    const dy = event.clientY - held.y;
    if (dx * dx + dy * dy > 196 || performance.now() - held.at > 600) return;
    const index = hitTest(event);
    if (index !== held.index) return;
    if (
      pending &&
      pending.index === index &&
      performance.now() - pending.at <= delay &&
      (event.clientX - pending.x) ** 2 + (event.clientY - pending.y) ** 2 <=
        1024
    ) {
      clearTimeout(pending.timer);
      pending = null;
      onDouble(index);
      return;
    }
    flush();
    pending = {
      index,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      timer: setTimeout(flush, delay),
    };
  };
  const onCancel = () => {
    press = null;
    flush();
  };
  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onCancel);
  return () => {
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointerup", onUp);
    target.removeEventListener("pointercancel", onCancel);
    clearTimeout(pending?.timer);
    pending = null;
    press = null;
  };
}
