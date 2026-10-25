const assert = require('node:assert/strict');

const digest = 'a'.repeat(64);
const responses = new Map();

global.window = {};
global.fetch = async (url, options = {}) => {
  assert.equal(options.method, 'POST');
  assert(responses.has(url), `Unexpected request: ${url}`);
  return {
    ok: true,
    status: 200,
    json: async () => responses.get(url),
  };
};

require('../image-upload.js');

function image(type = 'image/png') {
  return new Blob(['test-image'], { type });
}

(async () => {
  responses.set('/api/images/upload', {
    ok: true,
    url: `/api/uploads/preview?name=${digest}.jpg`,
  });
  assert.equal(
    await window.HuiguanImages.upload(image('image/jpeg')),
    `/assets/uploads/${digest}.jpg`,
    'fresh uploads must normalize preview URLs before validation',
  );

  responses.set('/api/images/upload', {
    ok: true,
    url: `/assets/uploads/${digest}.webp`,
  });
  assert.equal(
    await window.HuiguanImages.upload(image('image/webp')),
    `/assets/uploads/${digest}.webp`,
    'durable upload URLs must remain unchanged',
  );

  responses.set('/api/avatars/upload', {
    ok: true,
    avatar_asset_id: `/api/uploads/preview?name=${digest}.png`,
  });
  const character = await window.HuiguanImages.character({
    avatar_asset_id: image('image/png'),
    images: [],
  });
  assert.equal(
    character.avatar_asset_id,
    `/assets/uploads/${digest}.png`,
    'fresh avatar uploads must use the same normalization contract',
  );

  const restored = await window.HuiguanImages.character({
    image: `/api/uploads/preview?name=${digest}.jpg`,
    images: [`/api/uploads/preview?name=${digest}.jpg`],
    avatar_asset_id: `/api/uploads/preview?name=${digest}.png`,
    avatar_display_shape: 'circle',
  });
  assert.equal(restored.image, `/assets/uploads/${digest}.jpg`);
  assert.deepEqual(restored.images, [`/assets/uploads/${digest}.jpg`]);
  assert.equal(restored.avatar_asset_id, `/assets/uploads/${digest}.png`);

  responses.set('/api/images/upload', {
    ok: true,
    url: '/api/uploads/preview?name=../../not-an-upload.png',
  });
  await assert.rejects(
    window.HuiguanImages.upload(image()),
    /图片保存地址无效/,
    'malformed preview URLs must still be rejected',
  );

  console.log('image upload URL contract PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
