'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
const start = source.indexOf('function withCompactOrdinarySwalClasses(');
const end = source.indexOf('\n\ndocument.addEventListener', start);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

for (const [icon, expected] of [
    ['error', 'class-error'], ['success', 'class-success'],
    ['warning', 'class-warning'], ['info', 'class-info'], ['question', 'class-info']
]) test(`ordinary ${icon} Swal receives existing compact application classes`, () => {
    const result = sandbox.withCompactOrdinarySwalClasses({ icon, title: 'unchanged' });
    assert.equal(result.title, 'unchanged');
    assert.match(result.customClass.confirmButton, new RegExp(`^${expected} `));
    assert.equal(result.customClass.title, 'custom-title');
    assert.equal(result.customClass.popup, 'custom-swal-popup');
    assert.equal(result.customClass.htmlContainer, 'custom-html-container');
});

test('already styled and intentional progress Swal options remain untouched', () => {
    const styled = { icon: 'error', customClass: { popup: 'special' } };
    const progress = { title: 'progress', didOpen() {} };
    assert.equal(sandbox.withCompactOrdinarySwalClasses(styled), styled);
    assert.equal(sandbox.withCompactOrdinarySwalClasses(progress), progress);
});

test('putFieldValues routes its local Swal.fire through the compact normalizer', () => {
    assert.match(source, /const Swal = new Proxy\(window\.Swal/);
    assert.match(source, /target\.fire\(withCompactOrdinarySwalClasses\(options\)\)/);
});
