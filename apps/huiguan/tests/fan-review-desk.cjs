const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'fan.html'), 'utf8');
const rows = ['text', 'ai', 'art', 'poster'].map(reviewType => ({dataset: {reviewType}, hidden: false}));
const elements = {
  reviewType: {value: 'all', addEventListener(_event, cb) { this.onchange = cb; }},
  reviewEmptyFilter: {hidden: true},
  reviewList: {querySelectorAll: () => rows, querySelector: () => rows[0], addEventListener(_event, cb) { this.onclick = cb; }},
};
let dialog;
const posted = [];
const context = vm.createContext({
  $: (id) => elements[id],
  openModal: (value) => { dialog = value; },
  decide: (...args) => posted.push([...args.slice(0, 2), {...args[2]}]),
});
const filter = html.slice(html.indexOf('function filterReviewQueue()'), html.indexOf('async function loadQueue()'));
assert.ok(filter.includes('reviewEmptyFilter'));
vm.runInContext(filter, context);
elements.reviewType.value = 'ai';
elements.reviewType.onchange();
assert.deepEqual(rows.map(row => row.hidden), [true, false, true, true]);
elements.reviewType.value = 'all';
elements.reviewType.onchange();
assert.ok(rows.every(row => !row.hidden));

const source = html.slice(html.indexOf("$('reviewList').addEventListener('click'"), html.indexOf('function syncQueueIfVisible()'));
vm.runInContext(source, context);
const approve = { dataset: {approve: '17'}, closest: () => ({
  dataset: {reviewVersion: 'prior-version'},
  querySelector: () => ({value: 'ai'}),
})};
elements.reviewList.onclick({target: {closest: (selector) => selector === '[data-approve]' ? approve : null}});
assert.deepEqual(posted, []);
assert.equal(dialog.okText, '确认通过');
dialog.onOk();
assert.deepEqual(posted, [['17', 'approve', {review_version: 'prior-version', art_source: 'ai'}]]);
console.log('PASS review desk filtering and explicit approval with the exact version');
