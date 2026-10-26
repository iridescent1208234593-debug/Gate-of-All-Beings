// All visual layers and picking share the same surface; no marker parallax.
export const MAP_SIZE = { width: 9216, height: 1900 } as const;
export const SOURCE_MAP_SIZE = { width: 8192, height: 1900 } as const;
export const MAP_SEAM_U = 0.79;
export const SURFACE_INSET = 0.006;

export function mapPoint(x: number, y: number, radius: number, height: number): [number, number, number] {
  const angle = (x / MAP_SIZE.width - MAP_SEAM_U - .5) * Math.PI * 2;
  return [radius * Math.sin(angle), (.5 - y / MAP_SIZE.height) * height, -radius * Math.cos(angle)];
}

export function mapPixelFromUV(u: number, v: number) {
  return { x: ((u + MAP_SEAM_U) % 1 + 1) % 1 * MAP_SIZE.width, y: (1 - v) * MAP_SIZE.height };
}
