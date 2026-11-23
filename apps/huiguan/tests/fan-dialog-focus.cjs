const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'fan.html'), 'utf8');
const document = {};
const node = () => ({
  isConnected: true, classes: new Set(), focus() { document.activeElement = this; },
  addEventListener(event, cb) { this['on' + event] = cb; },
});
const elements = Object.fromEntries(['modal', 'modalTitle', 'modalBody', 'modalInput', 'modalErr',
  'modalOk', 'modalCancel', 'modalClose', 'posterLightbox', 'lbClose', 'lbImg', 'lbCap', 'lbSub'].map(id => [id, node()]));
for (const id of ['modal', 'posterLightbox']) {
  const dialog = elements[id];
  dialog.classList = {contains: name => dialog.classes.has(name), add: name => dialog.classes.add(name), remove: name => dialog.classes.delete(name)};
}
elements.modal.querySelectorAll = () => [elements.modalClose, elements.modalCancel, elements.modalOk];
elements.posterLightbox.querySelectorAll = () => [elements.lbClose];
const context = vm.createContext({$: id => elements[id], document});
const source = (first, last) => html.slice(html.indexOf(first), html.indexOf(last));
vm.runInContext(source('let modalOpener', '// ====== 卡片'), context);
vm.runInContext(source('function openPosterView', '// ====== 我的已登记'), context);

const trigger = node();
trigger.focus();
context.openModal({title: 'fixture'});
assert.equal(document.activeElement, elements.modalOk);
let prevented = false;
elements.modal.onkeydown({key: 'Tab', preventDefault() { prevented = true; }});
assert.equal(document.activeElement, elements.modalClose);
assert.equal(prevented, true);
context.closeModal();
assert.equal(document.activeElement, trigger);

context.openPosterView('/fixture.png', 'Sample', '', trigger);
assert.equal(elements.lbImg.alt, '配色海报：Sample');
assert.equal(document.activeElement, elements.lbClose);
context.closePosterView();
assert.equal(document.activeElement, trigger);
console.log('PASS modal and poster dialog keyboard focus, wrapping, return and informative image alt');
