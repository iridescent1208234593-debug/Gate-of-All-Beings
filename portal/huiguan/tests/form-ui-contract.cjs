const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// The first paint must already match the default 深绿×暖黄 scheme. Otherwise a
// slow first visit renders cream panels with the later scheme's pale text.
assert.match(source, /<meta name="theme-color" content="#103428">/i);
assert.match(source, /:root\s*\{[\s\S]*?--bg:\s*#103428;[\s\S]*?--surface:\s*#1b4d3e;[\s\S]*?--text:\s*#fff(?:fff)?;/i);

assert.match(source, /id="factionRange"/);
assert.match(source, /<output[^>]+id="sliderVal"[^>]+for="factionRange"/);
assert.doesNotMatch(source, /<span class="slider-val"/);

const functionMatch = source.match(/function updateSlider\(slider\)\s*\{([\s\S]*?)\n\}\n\n\/\/ ========== 验证/);
assert.ok(functionMatch, 'updateSlider implementation should be extractable');

function fakeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

const output = { textContent: '', classList: fakeClassList(), offsetWidth: 28 };
const label = { textContent: '' };
const row = {
  dataset: {},
  style: { values: {}, setProperty(name, value) { this.values[name] = value; } }
};
const elements = { sliderVal: output, factionLabel: label, 'row-faction': row };
const context = {
  document: { getElementById(id) { return elements[id]; } }
};
vm.runInNewContext(`function updateSlider(slider) {${functionMatch[1]}\n}\nthis.updateSlider = updateSlider;`, context);

for (const [value, expectedLabel, expectedZone] of [
  [0, '亲近人类', 'human'],
  [40, '中立', 'neutral'],
  [50, '中立', 'neutral'],
  [60, '中立', 'neutral'],
  [100, '亲近妖精', 'fairy']
]) {
  const attributes = {};
  context.updateSlider({ value: String(value), min: '0', max: '100', setAttribute(name, content) { attributes[name] = content; } });
  assert.equal(output.textContent, String(value));
  assert.equal(label.textContent, expectedLabel);
  assert.equal(row.dataset.zone, expectedZone);
  assert.equal(row.style.values['--faction-pct'], String(value));
  assert.equal(attributes['aria-valuetext'], `${value} · ${expectedLabel}`);
}

console.log('form initial theme and faction slider contract PASS');
