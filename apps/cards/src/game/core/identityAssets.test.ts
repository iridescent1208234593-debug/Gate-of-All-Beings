import assert from 'node:assert/strict';
import test from 'node:test';
import { assetIdFromUrl, uploadDisplayUrl } from './identityAssets';

const name = `${'a'.repeat(64)}.jpg`;

test('stored uploads are shown through the preview route on the given root', () => {
  for (const origin of ['https://huiguan.root-a.test', 'https://huiguan.root-b.test', 'https://huiguan.root-c.example']) {
    assert.equal(uploadDisplayUrl(`/assets/uploads/${name}`, origin), `${origin}/api/uploads/preview?name=${name}`);
  }
});

test('other images and frame ids pass through unchanged', () => {
  for (const value of ['', 'r02', 'https://example.com/a.png', '/assets/store/x.png']) {
    assert.equal(uploadDisplayUrl(value, 'https://huiguan.root-a.test'), value);
  }
});

test('a relative account avatar resolves to its stored id instead of throwing', () => {
  assert.equal(assetIdFromUrl(`/assets/uploads/${name}`, 'https://zszm.root-b.test/#home'), `/assets/uploads/${name}`);
  assert.equal(assetIdFromUrl(`https://huiguan.root-a.test/assets/uploads/${name}`, 'https://zszm.root-a.test/'), `/assets/uploads/${name}`);
});
