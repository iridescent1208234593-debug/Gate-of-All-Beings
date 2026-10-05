const brand = document.querySelector(".site-brand");
const name = brand?.querySelector("[data-brand-proximity]");

if (brand && name) {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let pointer = null;
  let frame = 0;

  const update = () => {
    frame = 0;
    if (!pointer || !finePointer.matches) {
      brand.classList.remove("is-near");
      return;
    }

    const rect = name.getBoundingClientRect();
    const x = Math.max(rect.left, Math.min(pointer.x, rect.right));
    const y = Math.max(rect.top, Math.min(pointer.y, rect.bottom));
    brand.classList.toggle(
      "is-near",
      Math.hypot(pointer.x - x, pointer.y - y) < 28,
    );
  };

  const scheduleUpdate = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  const onPointerMove = (event) => {
    if (event.pointerType !== "mouse" || !finePointer.matches) return;
    pointer = { x: event.clientX, y: event.clientY };
    scheduleUpdate();
  };

  const clearPointer = () => {
    pointer = null;
    scheduleUpdate();
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("blur", clearPointer);
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) clearPointer();
  });
  finePointer.addEventListener("change", clearPointer);
}
