import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {Renderer} from '../src/core/renderer.js';

test('dispose releases shared and renderer-owned resources once and aborts listeners', () => {
  const scene = new THREE.Scene();
  const sharedGeometry = new THREE.BoxGeometry();
  const sharedTexture = new THREE.Texture();
  const sharedMaterial = new THREE.MeshBasicMaterial({map:sharedTexture});
  const otherMaterial = new THREE.MeshBasicMaterial({map:sharedTexture});
  const hiddenMarker = new THREE.Mesh(new THREE.CircleGeometry(), new THREE.MeshBasicMaterial());
  scene.add(new THREE.Mesh(sharedGeometry, sharedMaterial), new THREE.Mesh(sharedGeometry, otherMaterial));
  const objects = [sharedGeometry, sharedTexture, sharedMaterial, otherMaterial, hiddenMarker.geometry, hiddenMarker.material];
  const calls = new Map();
  for (const res of objects) res.addEventListener('dispose', () => calls.set(res, (calls.get(res) ?? 0) + 1));
  const lifecycle = [];
  const events = new AbortController();
  const target = new EventTarget();
  target.addEventListener('frame', () => lifecycle.push('listener'), {signal:events.signal});
  Renderer.prototype.dispose.call({
    scene, events, hiddenMarker,
    controls:{dispose:()=>lifecycle.push('controls')},
    renderer:{dispose:()=>lifecycle.push('renderer'), forceContextLoss:()=>lifecycle.push('context')},
  });
  target.dispatchEvent(new Event('frame'));
  assert.ok(events.signal.aborted);
  assert.deepEqual(lifecycle,['controls','renderer','context']);
  for (const res of objects) assert.equal(calls.get(res),1,res.type);
  assert.equal(scene.children.length,0);
});
