export const BODY_SHAPE_POINT_COUNT = 40;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function simplify(points, tolerance) {
  if (points.length <= 3) return points;
  let first = 0, farthest = 0;
  for (let i = 1; i < points.length; i++) {
    const d = distance(points[first], points[i]);
    if (d > farthest) { farthest = d; first = i; }
  }
  let second = first;
  farthest = 0;
  for (let i = 0; i < points.length; i++) {
    const d = distance(points[first], points[i]);
    if (d > farthest) { farthest = d; second = i; }
  }
  const arc = (from, to) => {
    const path = [];
    for (let i = from;; i = (i + 1) % points.length) {
      path.push(points[i]);
      if (i === to) break;
    }
    return path;
  };
  const rdp = path => {
    if (path.length <= 2) return path;
    const a = path[0], b = path.at(-1), dx = b.x - a.x, dy = b.y - a.y;
    let max = tolerance, index = -1;
    for (let i = 1; i < path.length - 1; i++) {
      const t = Math.max(0, Math.min(1, ((path[i].x - a.x) * dx + (path[i].y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(path[i].x - a.x - t * dx, path[i].y - a.y - t * dy);
      if (d > max) { max = d; index = i; }
    }
    return index < 0 ? [a, b] : [...rdp(path.slice(0, index + 1)).slice(0, -1), ...rdp(path.slice(index))];
  };
  const a = rdp(arc(first, second)), b = rdp(arc(second, first));
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

export function normalizeBodyShape(input, count = BODY_SHAPE_POINT_COUNT) {
  const source = Array.isArray(input) ? input : input?.points;
  if (!Array.isArray(source) || source.length < 3 || source.length > 200000) throw new TypeError('身体轮廓点数超出画布上限。');
  if (source.length === count && source.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    && Math.abs(p.x) <= 1.001 && Math.abs(p.y) <= 1.001)) {
    const minX = Math.min(...source.map(p => p.x)), maxX = Math.max(...source.map(p => p.x));
    const minY = Math.min(...source.map(p => p.y)), maxY = Math.max(...source.map(p => p.y));
    if (Math.max(maxX - minX, maxY - minY) > 1.9
      && Math.abs(maxX + minX) < 0.05 && Math.abs(maxY + minY) < 0.05) {
      return { points: source.map(({ x, y }) => ({ x, y })) };
    }
  }
  let points = [];
  for (const point of source) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new TypeError('身体轮廓包含无效坐标。');
    if (!points.length || distance(points.at(-1), point) > 0.001) points.push({ x: point.x, y: point.y });
  }
  if (points.length > 2048) {
    const stride = Math.ceil(points.length / 2048);
    points = points.filter((_, i) => i % stride === 0);
  }
  if (points.length > 2 && distance(points[0], points.at(-1)) < 0.001) points.pop();
  if (points.length < 3) throw new TypeError('身体轮廓面积太小。');
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
  if (width * height < 1e-8) throw new TypeError('身体轮廓面积太小。');
  const simplified = simplify(points, Math.max(width, height) * 0.004);
  const smooth = simplified.flatMap((p, i) => {
    const q = simplified[(i + 1) % simplified.length];
    return [{ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 },
      { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 }];
  });
  const smoothXs = smooth.map(p => p.x), smoothYs = smooth.map(p => p.y);
  const smoothWidth = Math.max(...smoothXs) - Math.min(...smoothXs), smoothHeight = Math.max(...smoothYs) - Math.min(...smoothYs);
  const scale = 2 / Math.max(smoothWidth, smoothHeight);
  const cx = (Math.min(...smoothXs) + Math.max(...smoothXs)) / 2;
  const cy = (Math.min(...smoothYs) + Math.max(...smoothYs)) / 2;
  const lengths = smooth.map((p, i) => distance(p, smooth[(i + 1) % smooth.length]));
  const perimeter = lengths.reduce((sum, n) => sum + n, 0);
  if (perimeter < 1e-5) throw new TypeError('身体轮廓面积太小。');
  const result = [];
  let segment = 0, traversed = 0;
  for (let i = 0; i < count; i++) {
    const target = perimeter * i / count;
    while (traversed + lengths[segment] < target) { traversed += lengths[segment]; segment = (segment + 1) % smooth.length; }
    const a = smooth[segment], b = smooth[(segment + 1) % smooth.length];
    const t = (target - traversed) / (lengths[segment] || 1);
    result.push({ x: Number(((a.x + (b.x - a.x) * t - cx) * scale).toFixed(5)),
      y: Number(((a.y + (b.y - a.y) * t - cy) * scale).toFixed(5)) });
  }
  return { points: result };
}

/** Select and trace the largest 4-connected painted region in an RGBA raster. */
export function extractLargestContour({ data, width, height }, count = BODY_SHAPE_POINT_COUNT) {
  if (!data || data.length !== width * height * 4 || width * height > 2_000_000) throw new TypeError('无效的绘制画布。');
  const seen = new Uint8Array(width * height), edges = [];
  let largest = [];
  const filled = i => data[i * 4 + 3] > 16;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !filled(start)) continue;
    const stack = [start], region = []; seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % width, y = (i / width) | 0; region.push(i);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const n = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !seen[n] && filled(n)) { seen[n] = 1; stack.push(n); }
      }
    }
    if (region.length > largest.length) largest = region;
  }
  if (!largest.length) throw new TypeError('先画出灵体身体轮廓。');
  const mask = new Uint8Array(width * height); largest.forEach(i => { mask[i] = 1; });
  for (const i of largest) {
    const x = i % width, y = (i / width) | 0;
    if (y === 0 || !mask[i - width]) edges.push([[x, y], [x + 1, y]]);
    if (x === width - 1 || !mask[i + 1]) edges.push([[x + 1, y], [x + 1, y + 1]]);
    if (y === height - 1 || !mask[i + width]) edges.push([[x + 1, y + 1], [x, y + 1]]);
    if (x === 0 || !mask[i - 1]) edges.push([[x, y + 1], [x, y]]);
  }
  const key = ([x, y]) => `${x},${y}`, starts = new Map();
  edges.forEach((edge, i) => { const k = key(edge[0]); if (!starts.has(k)) starts.set(k, []); starts.get(k).push(i); });
  const used = new Uint8Array(edges.length); let contour = [];
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    const loop = []; let edge = i;
    while (!used[edge]) {
      used[edge] = 1; loop.push(edges[edge][0]);
      const next = starts.get(key(edges[edge][1]))?.find(candidate => !used[candidate]);
      if (next === undefined) break; edge = next;
    }
    if (loop.length > contour.length) contour = loop;
  }
  if (contour.length < 3) throw new TypeError('无法提取身体轮廓，请让线条首尾闭合或涂满区域。');
  return normalizeBodyShape(contour.map(([x, y]) => ({ x: x / width, y: -y / width })), count);
}
