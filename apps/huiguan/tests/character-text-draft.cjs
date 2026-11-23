const assert = require('node:assert/strict');
require('../character-text-draft.js');

const {create, draftScope} = globalThis.HuiguanCharacterTextDraft;
const guest = {logged_in: false};
const a = {logged_in: true, kind: 'local', user_id: 7};
const b = {logged_in: true, kind: 'usso', user_id: 7}; // same digits, different account
assert.equal(draftScope(null), null);
assert.equal(draftScope({error: 'offline'}), null);
assert.equal(draftScope({logged_in: true, kind: 'local'}), null);
assert.notEqual(draftScope(a), draftScope(b));

const saved = new Map();
let tick = 1700000000000;
const storage = {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value),
  removeItem: key => saved.delete(key)};
function view() {
  const node = () => ({value: '', hidden: false, focus() {}, addEventListener(event, cb) { this[event] = cb; }});
  const controls = Object.fromEntries(['appearance','background','personality','image','email','code','notes'].map(name => [name, node()]));
  const form = node();
  form.elements = {namedItem: key => controls[key]};
  const panel = node(), restore = node(), discard = node();
  const manager = create({form, restore, discard, panel, storage, now: () => ++tick});
  return {manager, controls, panel, restore, discard,
    text(name, value) { controls[name].value = value; form.input({target: {name}}); }};
}

const first = view();
first.text('background', 'No verified user yet');
assert.equal(saved.size, 0);
first.manager.setIdentity(guest);
first.text('background', 'Guest lore');
first.text('appearance', 'contact fixture@example.test');
first.text('notes', 'Private notes');
first.text('image', 'data:image/png;base64,fixture');
assert.equal(saved.size, 1);
assert.ok([...saved.values()][0].includes('Guest lore'));
assert.doesNotMatch([...saved.values()][0], /example\.test|Private notes|base64/);
const guestTicket = first.manager.ticket();

const reopened = view();
reopened.manager.setIdentity(guest);
assert.equal(reopened.panel.hidden, false);
assert.equal(reopened.controls.background.value, '');
reopened.text('background', 'Do not overwrite without explicit restore');
assert.equal(reopened.manager.ticket(), null);
reopened.restore.click();
assert.equal(reopened.controls.background.value, 'Guest lore');
reopened.manager.suspend();
assert.equal(reopened.panel.hidden, true);
reopened.manager.setIdentity({error: 'offline'});
assert.equal(reopened.manager.ticket(), null);
let switched;
reopened.manager.setIdentity(a, (prior, next) => { switched = [prior, next]; reopened.controls.background.value = ''; });
assert.deepEqual(switched, ['guest','local:7']);
assert.equal(reopened.panel.hidden, true);
reopened.text('background', 'A first version');
const aTicket = reopened.manager.ticket();
reopened.text('background', 'A later version');
assert.equal(reopened.manager.clearTicket(aTicket), false);
assert.equal(reopened.manager.clearTicket(guestTicket), true);
reopened.manager.setIdentity(b, () => { reopened.controls.background.value = ''; });
assert.equal(reopened.panel.hidden, true);
reopened.text('background', 'B only');
const bTicket = reopened.manager.ticket();
reopened.manager.setEditing(true);
reopened.text('background', 'Never persist an edit');
assert.equal(reopened.manager.ticket(), null);
assert.equal(reopened.panel.hidden, true);
reopened.manager.setEditing(false);
assert.equal(reopened.manager.clearTicket(bTicket), true);

const returnToA = view();
returnToA.manager.setIdentity(a);
returnToA.restore.click();
assert.equal(returnToA.controls.background.value, 'A later version');
returnToA.discard.click();
assert.equal(returnToA.panel.hidden, true);
assert.equal(saved.size, 0);
console.log('PASS synthetic draft: no uncertain auth/PII/photos, explicit restore, guest and accounts, edits excluded, exact successful cleanup');
