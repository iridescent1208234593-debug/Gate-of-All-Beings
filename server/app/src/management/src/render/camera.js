import { OrthographicCamera, Vector3 } from 'three';

// World X/Z correspond exactly to saved grid x/y. Elevation and azimuth are 45°.
export function createCamera() {
  const camera = new OrthographicCamera(-20, 20, 15, -15, 0.1, 400);
  camera.up.set(0, 1, 0);
  return camera;
}

export function aimCamera(camera, target) {
  camera.position.copy(target).add(new Vector3(50, 50 * Math.SQRT2, 50));
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

export function fitFrustum(camera, width, height, aspect) {
  const span = Math.max((width + height) / 2 + 4, ((width + height) / Math.SQRT2 + 3) / aspect);
  camera.left = -span * aspect / 2;
  camera.right = span * aspect / 2;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.updateProjectionMatrix();
}

export function gridFromPoint(point, space) {
  if (!point) return { gx: -1, gy: -1, inside: false };
  const gx = Math.floor(point.x), gy = Math.floor(point.z);
  return { gx, gy, inside: gx >= 0 && gy >= 0 && gx < space.width && gy < space.height };
}
