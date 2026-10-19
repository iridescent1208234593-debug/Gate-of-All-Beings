export function placeGalleryControls(rect, viewport, size, gap = 10) {
  const { width, height } = viewport;
  const left = Math.max(8, viewport.safeLeft || 0);
  const right = Math.max(8, viewport.safeRight || 0);
  const top = Math.max(8, viewport.safeTop || 0);
  const bottom = Math.max(8, viewport.safeBottom || 0);
  if (size.width > width - left - right || size.height > height - top - bottom)
    return null;
  if (rect.right <= 0 || rect.left >= width || rect.bottom <= 0 || rect.top >= height)
    return null;

  const preferred = (rect.left + rect.right) / 2 < width / 2 ? "right" : "left";
  const sideX = preferred === "right" ? rect.right + gap : rect.left - gap - size.width;
  if (sideX >= left && sideX + size.width <= width - right) {
    return {
      side: preferred,
      x: sideX,
      y: Math.max(top, Math.min(height - bottom - size.height,
        (rect.top + rect.bottom - size.height) / 2)),
    };
  }

  const x = Math.max(left, Math.min(width - right - size.width,
    (rect.left + rect.right - size.width) / 2));
  if (rect.bottom + gap + size.height <= height - bottom)
    return { side: "below", x, y: rect.bottom + gap };
  if (rect.top - gap - size.height >= top)
    return { side: "above", x, y: rect.top - gap - size.height };
  return null;
}
