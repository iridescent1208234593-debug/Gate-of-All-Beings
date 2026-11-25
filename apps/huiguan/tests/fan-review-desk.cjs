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

const controlsStart = html.indexOf('function historyButton(c)');
const controlsEnd = html.indexOf('function artCardHTML(', controlsStart);
assert.ok(controlsStart >= 0 && controlsEnd > controlsStart);
const cards = vm.createContext({currentUser: {logged_in: true, is_admin: true}});
vm.runInContext(html.slice(controlsStart, controlsEnd), cards);
for (const type of ['配色海报', '同人设表']) {
  const markup = cards.ownerActions({id: 17, type, is_mine: false});
  assert.match(markup, /data-fan-reopen-id="17"/);
  assert.doesNotMatch(markup, /data-act="revoke"|data-reject/);
}
cards.currentUser = {logged_in: true, is_admin: false, can_review_fan: true};
assert.equal(cards.ownerActions({id: 17, type: '同人设表', is_mine: false}), '');
assert.match(html, /data-reject=/); // The pending review desk still has the reject action.
console.log('PASS public cards only offer the admin re-review entry');
