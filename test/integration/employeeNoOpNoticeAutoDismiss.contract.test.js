 'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../public/js/ergazomenoi/genika/putFieldValues.js'), 'utf8');
const start = source.indexOf('function autoDismissEmployeeNoOpNotice(');
const end = source.indexOf('function employeeSaveSuccessOptions(', start);
assert.ok(start > 0 && end > start);
const dismiss = vm.runInNewContext('(' + source.slice(start, end).trim() + ')');
const notice = () => ({ dataset: {}, isConnected: true, removed: false, remove() { this.removed = true; this.isConnected = false; } });
test('NO_OP alert hides itself after exactly 3000 ms', () => {
  const n = notice(), calls = [];
  const accepted = dismiss(n, { employeeUpdated: false, historyUpdated: false }, { isPermanent: true }, (fn, ms) => calls.push({ fn, ms }));
  assert.equal(accepted, true); assert.equal(calls.length, 1); assert.equal(calls[0].ms, 3000);
  assert.equal(n.removed, false); calls[0].fn(); assert.equal(n.removed, true);
});
test('genuine updates and selected ERGANI/document actions retain the warning', () => {
  for (const [data, actions] of [
    [{ employeeUpdated: true, historyUpdated: false }, {}],
    [{ employeeUpdated: false, historyUpdated: true }, {}],
    [{ employeeUpdated: false, historyUpdated: false }, { ma_217: true }],
    [{ employeeUpdated: false, historyUpdated: false }, { create_contract: true }]
  ]) {
    const n = notice(), calls = [];
    assert.equal(dismiss(n, data, actions, fn => calls.push(fn)), false);
    assert.equal(calls.length, 0); assert.equal(n.removed, false);
  }
});
test('an older timer cannot dismiss a newer warning or newer NO_OP', () => {
  const n = notice(), calls = [];
  const schedule = (fn, ms) => calls.push(fn);
  dismiss(n, { employeeUpdated: false, historyUpdated: false }, {}, schedule);
  dismiss(n, { employeeUpdated: true, historyUpdated: false }, {}, schedule);
  calls[0](); assert.equal(n.removed, false);
  dismiss(n, { employeeUpdated: false, historyUpdated: false }, {}, schedule);
  assert.equal(calls.length, 2);
  calls[1](); assert.equal(n.removed, true);
});
test('production branch calls auto-dismiss only after a successful read-only response', () => {
  assert.match(source, /if \(response\.ok && data\?\.success === true && data\?\.historyAccessMode === 'READ_ONLY'/);
  assert.match(source, /notice\.textContent = employeeLegacyReadOnlyNotice\(data, v\.filesToUpdate\);\s*autoDismissEmployeeNoOpNotice\(notice, data, v\.filesToUpdate\)/);
});
