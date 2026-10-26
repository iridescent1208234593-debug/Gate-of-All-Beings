/**
 * Three r185 leaves its internal RAF running after setAnimationLoop(null).
 * Isolate that version-specific lifecycle here; retain the renderer and GPU assets.
 * Calls are made only after renderer.init(), so this synchronous adapter has no
 * delayed public-setter race when routes change several times in one task.
 */
export function setSceneAnimation(renderer, callback) {
  const animation = renderer._animation;
  if (!animation || typeof animation.start !== 'function' || typeof animation.stop !== 'function'
    || typeof animation.setAnimationLoop !== 'function' || !('_requestId' in animation)) {
    throw new Error('The installed Three.js animation lifecycle is not supported.');
  }
  animation.setAnimationLoop(callback ? (now, frame) => {
    // Animation.start() invokes its first tick without a timestamp.
    if (Number.isFinite(now)) callback(now, frame);
  } : null);
  if (callback) {
    if (animation._requestId === null) animation.start();
  } else {
    animation.stop();
  }
}
