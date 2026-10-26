import test from 'node:test';
import assert from 'node:assert/strict';
import { setSceneAnimation } from '../src/scene-animation.js';

test('scene lifecycle stops internal RAF and resumes once with a valid frame time', () => {
  let starts = 0, stops = 0;
  const seen = [];
  const animation = {
    _requestId: 10, callback: null,
    setAnimationLoop(callback) { this.callback = callback; },
    stop() { stops++; this._requestId = null; },
    start() { starts++; this._requestId = 20; this.callback?.(); },
  };
  const renderer = { _animation: animation };
  setSceneAnimation(renderer, null);
  assert.equal(animation._requestId, null);
  assert.equal(animation.callback, null);
  setSceneAnimation(renderer, now => seen.push(now));
  setSceneAnimation(renderer, now => seen.push(now));
  assert.equal(starts, 1);
  assert.deepEqual(seen, []);
  animation.callback(123);
  assert.deepEqual(seen, [123]);
  setSceneAnimation(renderer, null);
  assert.equal(stops, 2);
});

test('unexpected Three animation lifecycle fails visibly instead of silently running in the background', () => {
  assert.throws(() => setSceneAnimation({ _animation: {} }, () => {}), /lifecycle/);
});
