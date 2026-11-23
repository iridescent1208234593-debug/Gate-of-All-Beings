import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {platform, arch} from 'node:os';
import {createInitialState, reducer} from '../src/core/state.js';
import {WORLD} from '../src/config/simulation.js';

const seed = 101;
const seconds = Number(process.argv[2] ?? 60);
if (!Number.isInteger(seconds) || seconds < 6 || seconds > 1800 || typeof global.gc !== 'function') {
  throw new Error('Use node --expose-gc apps/ecology/tests/benchmark-ecology.mjs <seconds 6–1800>');
}
const step = 0.05;
const frameCount = Math.round(seconds / step);
const heapKiB = () => { global.gc(); return Math.round(process.memoryUsage().heapUsed/1024); };
function population(state) {
  return [state.cells.length, state.organisms.length, state.foods.length, state.plants.length];
}
function fixture(cells, organisms) {
  const state = createInitialState(seed);
  const resize = (items, count) => Array.from({length:count}, (_, i) => {
    if (i < items.length) return items[i];
    const extra = structuredClone(items[i % items.length]);
    extra.id = state.nextId++;
    extra.pos[0] *= 0.9;
    return extra;
  });
  state.cells = resize(state.cells, cells);
  state.organisms = resize(state.organisms, organisms);
  return state;
}
console.log(JSON.stringify({node:process.version, platform:platform(), arch:arch(), seed, seconds, step,
  fields:['cells','organisms','foods','plants'], browserMetrics:'not measured; reducer only'}));
for (const [label,cells,organisms] of [
  ['low', 20, 2], ['typical', WORLD.cellStartCount, WORLD.orgStartCount], ['cap', WORLD.maxCells, WORLD.orgMax],
]) {
  const idleHeapKiB = heapKiB();
  let state = fixture(cells, organisms);
  const start = population(state);
  const peak = [...start];
  const samples = [];
  const times = [];
  for (let frame=1; frame<=frameCount; frame++) {
    const begin = performance.now();
    state = reducer(state, {type:'TICK', dt:step});
    times.push(performance.now() - begin);
    const counts = population(state);
    counts.forEach((count,index) => { peak[index]=Math.max(peak[index],count); });
    assert.ok(counts[0]<=WORLD.maxCells && counts[1]<=WORLD.orgMax, `${label} frame ${frame}: ${counts}`);
    if (frame===1 || frame===frameCount || frame % Math.max(1,Math.floor(frameCount/3))===0) {
      const heap = heapKiB();
      samples.push({simSeconds:+state.time.toFixed(3), counts, heapKiBDelta:heap-idleHeapKiB});
    }
  }
  assert.ok(Math.abs(seconds-state.time)<1e-6, label);
  assert.ok(Number.isFinite(state.space.materialLing) && state.space.materialLing>=0, label);
  times.sort((a,b)=>a-b);
  const percentile = p => +times[Math.ceil(times.length*p)-1].toFixed(3);
  console.log(JSON.stringify({label,start,peak,samples, reducerMs:{p50:percentile(.5),p95:percentile(.95)}}));
}
