const assert = require('node:assert/strict');
const safeAuthNext = require('../auth-next.js');

for (const url of [
  'https://huiguan.iridescently.xyz/account.html?tab=profile',
  'https://pc-zszm.iridescently.xyz/?view=home#gate',
]) {
  assert.equal(safeAuthNext(url), new URL(url).href, `registered return URL should pass: ${url}`);
}

for (const url of [
  '//evil.example/path',
  'https://evil-iridescently.xyz/',
  'https://iridescently.xyz.evil.example/',
  'https://user@huiguan.iridescently.xyz/',
  'https://huiguan.iridescently.xyz@evil.example/',
  'https://huiguan.iridescently.xyz:8443/',
  'https://huiguan.iridescently.xyz:443/',
  'http://huiguan.iridescently.xyz/',
  'javascript:alert(1)',
  'https:\\evil.example\\',
  'https://huiguan.iridescently.xyz./',
]) {
  assert.equal(safeAuthNext(url), '', `untrusted return URL should be rejected: ${url}`);
}

console.log('Huiguan OAuth return URL allowlist PASS');
