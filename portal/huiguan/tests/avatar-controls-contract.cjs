const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
function read(file) {
  return process.env.AVATAR_TEST_BASE
    ? execFileSync('git', ['show', process.env.AVATAR_TEST_BASE + ':' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
function element() {
  return { hidden: false, disabled: false, style: {}, attributes: {}, textContent: '',
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
  };
}
async function controls() {
  const source = read('portal/huiguan/index.html');
  const block = source.slice(source.indexOf('let imageList = [];'), source.indexOf('\nfunction handleImage('));
  const ids = ['ocAvatarPreview', 'ocAvatarFallback', 'ocAvatarFrame', 'ocAvatarSquare', 'ocAvatarCircle', 'ocAvatarUpload', 'ocAvatarRemove', 'ocAvatarStatus'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  const revoked = [], errors = [];
  const context = { document: { getElementById: id => elements[id], querySelectorAll: () => [] },
    window: { HuiguanAvatarCropper: { open: async () => new Blob(['image']) } },
    URL: { revokeObjectURL: value => revoked.push(value), createObjectURL: () => 'blob:new-avatar' },
    FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,test'; this.onload(); } },
    showToast: (type, text) => errors.push(text),
  };
  vm.runInNewContext(block + `\nthis.api = { renderOCAvatarPreview, setOCAvatarShape, cropOCAvatar, clearOCAvatar,
    setAsset(value) { ocAvatarAsset = value; }, state() { return { asset: ocAvatarAsset, preview: ocAvatarPreviewUrl }; } };`, context);
  const api = context.api;
  api.setAsset('/assets/uploads/avatar.png'); api.setOCAvatarShape('square');
  assert.equal(elements.ocAvatarFrame.style.borderRadius, '6px', '方形头像的外框不能继续按圆形裁切');
  assert.equal(elements.ocAvatarSquare.attributes['aria-pressed'], 'true');
  assert.equal(elements.ocAvatarCircle.attributes['aria-pressed'], 'false');
  api.setOCAvatarShape('circle'); assert.equal(elements.ocAvatarFrame.style.borderRadius, '50%');
  api.clearOCAvatar();
  assert.equal(elements.ocAvatarRemove.disabled, true);
  assert.equal(elements.ocAvatarSquare.disabled, true);
  assert.equal(elements.ocAvatarUpload.disabled, false);
  assert.equal(elements.ocAvatarPreview.hidden, true);
  assert.match(elements.ocAvatarStatus.textContent, /移除|尚未/);
  await api.cropOCAvatar(new Blob(['image']));
  assert.equal(api.state().asset, 'data:image/png;base64,test');
  assert.equal(elements.ocAvatarRemove.disabled, false);
  assert.equal(elements.ocAvatarUpload.disabled, false);
  const previous = api.state().asset;
  context.window.HuiguanAvatarCropper.open = async () => null;
  await api.cropOCAvatar('cancel'); assert.equal(api.state().asset, previous, '取消不能清空已有头像');
  context.window.HuiguanAvatarCropper.open = async () => { throw new Error('读取失败'); };
  await api.cropOCAvatar('failure');
  assert.equal(api.state().asset, previous, '失败不能覆盖原头像');
  assert.equal(elements.ocAvatarUpload.disabled, false, '失败后可以重试');
  assert.match(elements.ocAvatarStatus.textContent, /读取失败/);
  assert.equal(errors.length, 1);
  api.clearOCAvatar(); assert.deepEqual(revoked, ['blob:new-avatar']);
}
async function cropper() {
  const listeners = {}, contexts = { clearRect() {}, save() {}, beginPath() {}, rect() {}, clip() {}, drawImage() {}, restore() {} };
  const node = () => ({ disabled: false, width: 0, height: 0, value: '1',
    addEventListener(type, fn) { this[type] = fn; }, focus() {}, getContext: () => contexts,
    getBoundingClientRect: () => ({ width: 300 }), toBlob: callback => callback(new Blob(['crop'])),
  });
  const cancel = node(), confirm = node(), stage = node(), zoom = node(), square = node(), circle = node();
  const parts = { '.avatar-cropper__panel': { querySelector: () => cancel }, '.avatar-cropper__stage': stage,
    'input[type=range]': zoom, '.avatar-cropper__square': square, '.avatar-cropper__circle': circle,
    '[data-action=cancel]': cancel, '[data-action=confirm]': confirm };
  let removed = false, request, img;
  const overlay = { querySelector: selector => parts[selector], addEventListener() {}, remove() { removed = true; } };
  const context = { Blob, document: { body: { appendChild() {} }, createElement: tag => tag === 'div' ? overlay : node() },
    window: { devicePixelRatio: 1, addEventListener(type, fn) { listeners[type] = fn; }, removeEventListener(type) { delete listeners[type]; } },
    Image: class { constructor() { img = this; this.complete = false; this.naturalWidth = 0; } },
    URL: { createObjectURL: () => 'blob:crop', revokeObjectURL() {} },
    fetch: async (url, options) => { request = options; return { ok: true, blob: async () => new Blob(['image']) }; },
  };
  vm.runInNewContext(read('portal/huiguan/avatar-cropper.js'), context);
  const pending = context.window.HuiguanAvatarCropper.open('/api/uploads/preview?name=test.png');
  assert.equal(confirm.disabled, true, '图片加载前禁止确认空白头像');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.credentials, 'same-origin', '同源图片读取必须保留现有登录凭据');
  img.complete = true; img.naturalWidth = 600; img.naturalHeight = 800; img.onload();
  assert.equal(confirm.disabled, false);
  confirm.click();
  assert.ok((await pending) instanceof Blob);
  assert.equal(removed, true);
  assert.deepEqual(Object.keys(listeners), []);
}
(async () => { await controls(); await cropper(); console.log('OC avatar shape, empty/busy state, cancel/retry and cropper loading contract PASS'); })().catch(error => { console.error(error); process.exitCode = 1; });
