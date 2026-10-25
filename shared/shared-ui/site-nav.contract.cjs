const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, 'site-nav.js'), 'utf8');

assert.doesNotThrow(() => new Function(source), 'site navigation should remain valid JavaScript');
assert.match(source, /el\('button', 'qc-mobile-toggle'/);
assert.match(source, /setAttribute\('aria-expanded', 'false'\)/);
assert.match(source, /el\('div', 'qc-mobile-panel'/);
assert.match(source, /nav\.dataset\.mobileOpen/);
assert.match(source, /#qc-nav\[data-mobile-open="true"\] \.qc-mobile-panel\{display:grid/);
assert.match(source, /@media\(max-width:720px\)[\s\S]*?\.qc-mobile-panel\{position:absolute/);
assert.match(source, /\.auth-bar\{[\s\S]*?flex-wrap:wrap/);
assert.doesNotMatch(source, /\.qc-more>summary\{font-size:0/);

console.log('shared mobile navigation contract PASS');
