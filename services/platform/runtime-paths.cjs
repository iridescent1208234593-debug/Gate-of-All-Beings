'use strict';
// Cross-runtime tests keep this contract in parity with storage_paths.py.
const path = require('node:path'), os = require('node:os'), fs = require('node:fs');
const environment = (process.env.IRIDESCENTLY_ENVIRONMENT || 'development').trim();
if (!['development','staging','production','test'].includes(environment)) throw new Error('invalid storage environment');
if (environment === 'test' && !process.env.IRIDESCENTLY_STORAGE_ROOT?.trim()) throw new Error('test requires an explicit temporary IRIDESCENTLY_STORAGE_ROOT');
function absolute(value) {
  if (!path.isAbsolute(value)) throw new Error('storage roots must be absolute');
  let parent = path.resolve(value), suffix = [];
  while (!fs.existsSync(parent)) { suffix.unshift(path.basename(parent)); const next = path.dirname(parent); if (next === parent) break; parent = next; }
  return path.join(fs.realpathSync(parent), ...suffix);
}
const codeRoot = absolute(path.resolve(__dirname, '..', '..'));
const projectRoot = absolute(process.env.IRIDESCENTLY_PROJECT_ROOT || codeRoot);
const WORKSPACE_MANIFEST = 'iridescently-workspace.json';
function findWorkspace() {
  if (process.env.IRIDESCENTLY_WORKSPACE_ROOT?.trim()) return absolute(process.env.IRIDESCENTLY_WORKSPACE_ROOT.trim());
  for (let directory = path.dirname(codeRoot); ; directory = path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, WORKSPACE_MANIFEST))) return directory;
    if (path.dirname(directory) === directory) return null;
  }
}
const workspaceRoot = findWorkspace();
function workspacePath(key) {
  if (!workspaceRoot) return null;
  const value = JSON.parse(fs.readFileSync(path.join(workspaceRoot, WORKSPACE_MANIFEST), 'utf8')).roots?.[key];
  return typeof value === 'string' && value ? absolute(path.join(workspaceRoot, value)) : null;
}
// Test storage is always explicit; elsewhere an explicit root wins over the workspace's runtime root.
const storageRoot = absolute(process.env.IRIDESCENTLY_STORAGE_ROOT?.trim() || (environment !== 'test' && workspacePath('runtime')) || path.join(os.homedir(), '.local', 'share', 'iridescently'));
const variables = {data:'DATA',assets:'ASSETS',cache:'CACHE',releases:'RELEASE',backups:'BACKUP'};
const layout = Object.fromEntries(Object.entries(variables).map(([key, variable]) => [key, absolute(process.env[`IRIDESCENTLY_${variable}_ROOT`]?.trim() || path.join(storageRoot, environment, key))]));
function within(value, root) { const r = path.relative(root, value); return r === '' || (!r.startsWith(`..${path.sep}`) && r !== '..' && !path.isAbsolute(r)); }
for (const [key, value] of Object.entries(layout)) {
  for (const source of [codeRoot, projectRoot]) if (within(value, source) || (key !== 'releases' && within(source, value))) throw new Error(`${key} root overlaps source`);
  for (const [other, target] of Object.entries(layout)) if (key !== other && within(value, target)) throw new Error(`${key} and ${other} storage roots overlap`);
}
function parts(values) {
  return values.flatMap(value => {
    if (typeof value !== 'string' || path.isAbsolute(value) || path.win32.isAbsolute(value)) throw new Error('invalid relative storage path');
    const pieces = value.split(/[\\/]/);
    if (pieces.some(p => !p || p === '.' || p === '..' || /[:\0]/.test(p))) throw new Error('invalid relative storage path');
    return pieces;
  });
}
function dataPath(service, ...rest) { return path.join(layout.data, ...parts([service, ...rest])); }
function cachePath(service, ...rest) { return path.join(layout.cache, ...parts([service, ...rest])); }
function requireReady(service) {
  let marker;
  try { marker = JSON.parse(fs.readFileSync(path.join(layout.data, '.storage-ready.json'), 'utf8')); }
  catch { throw new Error('storage is not ready; initialize fixtures or complete verified migration first'); }
  if (marker.schema !== 1 || marker.state !== 'ready' || marker.environment !== environment || Object.entries(layout).some(([key, value]) => marker.roots?.[key] !== value)) throw new Error('storage readiness marker does not match this environment and roots');
  if (service && !fs.statSync(dataPath(service), {throwIfNoEntry:false})?.isDirectory()) throw new Error(`storage for ${service} is missing`);
  for (const relative of marker.required_files || []) {
    const file = path.resolve(layout.data, ...parts([relative]));
    if (!within(file, layout.data) || !fs.statSync(file, {throwIfNoEntry:false})?.size) throw new Error(`migrated persistent file is missing or empty: ${relative}`);
  }
  return marker;
}
module.exports = {environment,projectRoot,storageRoot,workspaceRoot,workspacePath,layout,dataRoot:layout.data,assetsRoot:layout.assets,cacheRoot:layout.cache,releaseRoot:layout.releases,backupRoot:layout.backups,dataPath,cachePath,requireReady};
