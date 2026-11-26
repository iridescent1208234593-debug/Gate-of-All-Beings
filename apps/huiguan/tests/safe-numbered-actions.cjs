'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const [page, op0, op1, expected, event = 'click'] of [
  ['admin', 'decideScribe', '19', [19, true, 'fan_reviewer']],
  ['char', 'moveImg', '0', [0, -1, 19]],
  ['char', 'setImgType', '27', [27, 'avatar', 0, 19], 'change'],
  ['works', 'delCmt', '19', [19, 27]],
]) {
  const html = fs.readFileSync(path.join(__dirname, '..', page + '.html'), 'utf8');
  const dynamic = /\bon(?:click|change|input)="[^"\n]*\$\{/g;
  assert.equal([...html.matchAll(dynamic)].length, 0, page + ' has data in inline event source');
  assert(html.includes('data-' + page + '-operation="' + op0 + '"'));
  assert(html.includes('data-op-0='), page + ' markup lost data-op-N attributes');
  const router = html.match(new RegExp('function dispatch' + page + 'Operation\\(event\\) \\{[\\s\\S]*?\\n\\}'));
  assert(router, page + ' dispatcher source missing');
  assert(router[0].includes('data-op-'), page + ' dispatcher does not read data-op-N attributes');
  let calls = [];
  const context = {[op0]: (...args) => calls.push(args)};
  vm.createContext(context);
  vm.runInContext(router[0], context);
  // data-op-0 在真实 DOM 里的键名是 "op-0" 而不是 op0；桩按属性名读取，
  // 避免再出现「测试通过但线上点不动」的契约错位。
  const attributes = {
    'data-op-0': op1,
    'data-op-1': page === 'admin' ? 'true' : (page === 'works' ? '27' : '-1'),
    'data-op-2': page === 'admin' ? 'fan_reviewer' : (event === 'change' ? '0' : '19'),
    'data-op-3': '19',
  };
  const element = {
    value: 'avatar',
    dataset: { [page + 'Operation']: op0 },
    getAttribute: (attribute) => (attribute in attributes ? attributes[attribute] : null),
  };
  const invoke = () => context['dispatch' + page + 'Operation']({type:event,target:{closest: () => element}});
  invoke();
  assert.deepEqual(calls, [expected], page + ' did not pass the intended typed arguments');
  calls = [];
  for (const invalid of ['"sample" (name) &amp;', '', '-8', '3.5', '9007199254740992']) {
    attributes['data-op-0'] = invalid;
    invoke();
  }
  element.dataset[page + 'Operation'] = 'constructor';
  invoke();
  assert.deepEqual(calls, [], page + ' routed invalid data');
}
console.log('PASS: three templates keep dynamic IDs out of inline handlers and reject malformed IDs before dispatch');
