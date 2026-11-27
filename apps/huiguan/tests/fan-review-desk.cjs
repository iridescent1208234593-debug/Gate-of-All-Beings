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

// 画廊卡片上的操作：管理员有「重新送审」，审核员有「退回」，两者都能用。
const controlsStart = html.indexOf('function historyButton(c)');
const controlsEnd = html.indexOf('function artCardHTML(', controlsStart);
assert.ok(controlsStart >= 0 && controlsEnd > controlsStart);
const cards = vm.createContext({currentUser: {logged_in: true, is_admin: true}, canReview: true});
vm.runInContext(html.slice(controlsStart, controlsEnd), cards);

for (const type of ['配色海报', '同人设表']) {
  const markup = cards.ownerActions({id: 17, type, is_mine: false, review_version: 'v-17'});
  assert.match(markup, /data-fan-reopen-id="17"/, 'admin keeps the re-review entry');
  assert.doesNotMatch(markup, /data-act="revoke"|data-reject/);
}

// 审核员（非管理员）：必须能看到并点得到「退回」，但看不到「重新送审」。
cards.currentUser = {logged_in: true, is_admin: false, can_review_fan: true};
cards.canReview = true;
const reviewerMarkup = cards.ownerActions({id: 17, type: '同人设表', is_mine: false, review_version: 'v-17'});
assert.match(reviewerMarkup, /data-fan-revoke-id="17"/, 'reviewer must be able to reject a public card');
assert.doesNotMatch(reviewerMarkup, /data-fan-reopen-id/, 're-review stays admin-only');

// 没有 review_version（普通访客视角）时不渲染退回，避免必然 409。
assert.equal(cards.ownerActions({id: 17, type: '同人设表', is_mine: false}), '');

// 非审核员看不到任何审核操作。
cards.canReview = false;
assert.equal(cards.ownerActions({id: 17, type: '同人设表', is_mine: false, review_version: 'v-17'}), '');

// 退回弹窗在卡片场景下要能自己带上版本号（卡片没有 [data-review] 行）。
const askRejectSource = html.slice(html.indexOf('function askReject(id)'), html.indexOf("$('reviewList').addEventListener"));
const modalContext = vm.createContext({
  rowCache: new Map([['17', {id: 17, name: '阿青', review_version: 'v-17'}]]),
  document: {querySelector: () => null},
  openModal: (value) => { dialog = value; },
  decide: (...args) => posted.push([...args.slice(0, 2), {...args[2]}]),
});
vm.runInContext(askRejectSource, modalContext);
posted.length = 0;
modalContext.askReject('17');
assert.equal(dialog.title, '退回「阿青」');
dialog.onOk('理由足够长');
assert.deepEqual(posted, [['17', 'reject', {note: '理由足够长', review_version: 'v-17'}]]);

assert.match(html, /data-reject=/); // The pending review desk still has the reject action.
console.log('PASS public cards let reviewers reject, re-review stays admin-only');
