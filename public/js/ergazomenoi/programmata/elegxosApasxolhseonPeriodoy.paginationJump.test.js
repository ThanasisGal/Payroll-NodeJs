'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function normalizeEmploymentReviewPageJump');
const end = source.indexOf('async function loadResults()', start);
const controls = new Map();
const makeControl = () => ({
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; }
});
const container = {
    classList: { add() {}, remove() {} },
    replaceChildren() {},
    querySelector(selector) { return controls.get(selector) || null; },
    set innerHTML(value) {
        this.html = value;
        ['.employment-review-page-previous', '.employment-review-page-next',
            '.employment-review-page-jump-input', '.employment-review-page-jump-button']
            .forEach((selector) => controls.set(selector, makeControl()));
    }
};
let loadCount = 0;
const sandbox = {
    document: {
        getElementById(id) {
            if (id === 'employmentReviewEmployeePagination') return container;
            if (id === 'kodikos') return { value: '' };
            return null;
        }
    },
    loadResults() { loadCount += 1; }
};
vm.createContext(sandbox);
vm.runInContext(`let currentReviewEmployeePage = 1;
const employmentReviewEmployeePageSize = 50;
${source.slice(start, end)}
this.currentPage = () => currentReviewEmployeePage;`, sandbox);

assert.equal(sandbox.normalizeEmploymentReviewPageJump('25', 40), 25);
assert.equal(sandbox.normalizeEmploymentReviewPageJump('1', 40), 1);
assert.equal(sandbox.normalizeEmploymentReviewPageJump('40', 40), 40);
assert.equal(sandbox.normalizeEmploymentReviewPageJump('0', 40), 1);
assert.equal(sandbox.normalizeEmploymentReviewPageJump('999', 40), 40);
assert.equal(sandbox.normalizeEmploymentReviewPageJump('abc', 40), null);
assert.equal(sandbox.normalizeEmploymentReviewPageJump('', 40), null);
assert.equal(sandbox.normalizeEmploymentReviewPageJump('1.5', 40), null);

sandbox.renderEmploymentReviewEmployeePagination({
    page: 1, totalPages: 40, totalEmployees: 2000, limit: 50
});
assert.match(container.html, /Σελίδα 1\/40/);
assert.match(container.html, /max="40"/);

const input = controls.get('.employment-review-page-jump-input');
input.value = '25';
let prevented = false;
input.listeners.keydown({ key: 'Enter', preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(sandbox.currentPage(), 25);
assert.equal(loadCount, 1);

input.value = 'abc';
controls.get('.employment-review-page-jump-button').listeners.click();
assert.equal(sandbox.currentPage(), 25);
assert.equal(loadCount, 1);

sandbox.renderEmploymentReviewEmployeePagination({
    page: 25, totalPages: 40, totalEmployees: 2000, limit: 50
});
controls.get('.employment-review-page-previous').listeners.click();
assert.equal(sandbox.currentPage(), 24);
assert.equal(loadCount, 2);
controls.get('.employment-review-page-next').listeners.click();
assert.equal(sandbox.currentPage(), 26);
assert.equal(loadCount, 3);

assert.equal(Math.ceil(26 / 50), 1);
assert.equal(Math.ceil(51 / 50), 2);

console.log('employment review direct page jump tests passed');
