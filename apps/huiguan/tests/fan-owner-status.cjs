const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'fan.html'), 'utf8');
const grid = {addEventListener(event, run) { this[event] = run; }};
const counter = {};
const button = {};
const chars = [
  {is_public: true, review_status: 'approved'},
  {is_public: true, review_status: 'pending'},
  {is_public: true, review_status: 'rejected'},
  {is_public: false, review_status: 'approved'},
];
const context = vm.createContext({
  $: (id) => ({myGrid: grid, myCount: counter, publishBtn: button})[id],
  myChars: chars, myCardHTML: () => '', fanRecord: (card) => card, selectedCodes: new Set(),
});
vm.runInContext(html.slice(html.indexOf('function renderMy()'), html.indexOf('async function unpublish')), context);
context.renderMy();
assert.equal(counter.textContent, '（共 4 个，已公开 1 个，审核中 1 个，已退回 1 个）');
for (const key of ['Enter', ' ']) {
  let activated = 0, prevented = 0;
  grid.keydown({key, target: {matches: () => true, click: () => activated++}, preventDefault: () => prevented++});
  assert.deepEqual([activated, prevented], [1, 1]);
}
grid.keydown({key: 'Enter', target: {matches: () => false, click() { assert.fail('nested button must keep native behavior'); }}});
console.log('PASS owner counters separate pending, rejected and public; keyboard card activation');
