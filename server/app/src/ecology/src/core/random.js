// Synchronous, scoped RNG. Reducers own the seed; rendering never consumes it.
let active = null;
export function random() {
  if (!active) return Math.random();
  active.seed = (Math.imul(active.seed, 1664525) + 1013904223) >>> 0;
  return active.seed / 4294967296;
}
export function withRandomState(seed, fn) {
  const previous = active;
  active = {seed:seed >>> 0};
  try { const value = fn(); return {value, rng:active.seed}; }
  finally { active = previous; }
}
