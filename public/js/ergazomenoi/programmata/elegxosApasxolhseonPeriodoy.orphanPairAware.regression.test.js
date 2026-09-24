'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(__dirname + '/elegxosApasxolhseonPeriodoy.js', 'utf8');
const start = source.indexOf('function defaultOrphanResolutionReason');
const end = source.indexOf('\nfunction ', start + 10);
assert(start >= 0 && end > start);
const context = {};
vm.runInNewContext(`${source.slice(start, end)}; result = defaultOrphanResolutionReason;`, context);
const reason = context.result;

assert.strictEqual(reason([{ orphanType: 'START_ONLY' }]),
    'Τακτοποίηση ορφανού χτυπήματος εξόδου');
assert.strictEqual(reason([{ orphanType: 'END_ONLY' }]),
    'Τακτοποίηση ορφανού χτυπήματος εισόδου');
assert.strictEqual(reason([{ orphanType: 'START_ONLY' }, { orphanType: 'START_ONLY' }]),
    'Τακτοποίηση ορφανών χτυπημάτων εξόδου');
assert.strictEqual(reason([{ orphanType: 'END_ONLY' }, { orphanType: 'END_ONLY' }]),
    'Τακτοποίηση ορφανών χτυπημάτων εισόδου');
assert.strictEqual(reason([{ orphanType: 'START_ONLY' }, { orphanType: 'END_ONLY' }]),
    'Τακτοποίηση ορφανών χτυπημάτων εισόδου και εξόδου');

assert.match(source, /edit_apo_ora_02_apologistika[\s\S]*edit_eos_ora_02_apologistika/);
assert.match(source, /edit_apo_ora_03_apologistika[\s\S]*edit_eos_ora_03_apologistika/);
assert.match(source, /pairs:\s*\(orphanPreview\.unresolvedPairs/);
assert.match(source, /<textarea id="edit_reason"[\s\S]*\$\{reusableOrphanReason \? 'readonly' : ''\}/);
assert.match(source, /function renderIntervalCell[\s\S]*\[1, 2, 3\][\s\S]*review-interval-line/);
assert.match(source, /renderIntervalCell\(row, 'apo_ora', 'eos_ora', '_apologistika'\)/);

console.log('pair-aware orphan UI/reason regression tests passed');
