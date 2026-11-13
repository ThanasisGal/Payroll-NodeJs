'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const numbers = require('./employmentReviewNumbers');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const sandbox = { EmploymentReviewNumbers: numbers, num: value => Number(value || 0) };
vm.createContext(sandbox);
vm.runInContext(source.slice(source.indexOf('function hours('), source.indexOf('function hasMeaningfulValue(')) +
    source.slice(source.indexOf('function effectiveWorkHoursValue('), source.indexOf('function ensureReviewTableStructure(')), sandbox);

test('PR381: unavailable daily hours show an accessible presentation zero and preserve original evidence', () => {
    for (const value of [null, undefined, 'UNAVAILABLE', NaN, Infinity, '', 'invalid']) {
        const row = Object.freeze({ ores_ergasias_apologistika: value });
        const html = sandbox.renderHoursCell(row);
        assert.match(html, />0\.00</);
        assert.match(html, /stage4-hours-unavailable/);
        assert.match(html, /tabindex="0"/);
        assert.match(html, /role="note"/);
        assert.match(html, /aria-label="[^"]*δεν είναι τεκμηριωμένη/);
        assert.match(html, /title="[^"]*δεν είναι τεκμηριωμένη/);
        assert.doesNotMatch(html, /stage4-hours-clock/);
        assert.equal(numbers.dailyNumber(row, 'ores_ergasias_apologistika'), null);
        assert.equal(numbers.sum([8, numbers.dailyNumber(row, 'ores_ergasias_apologistika')]), null);
        assert.ok(Object.is(row.ores_ergasias_apologistika, value));
    }
});
test('PR381: measured zero and valid hours retain distinct semantics and clock alignment hooks', () => {
    for (const value of [0, '0']) {
        const html = sandbox.renderHoursCell({ ores_ergasias_apologistika: value });
        assert.match(html, />0\.00</);
        assert.doesNotMatch(html, /stage4-hours-unavailable|stage4-hours-clock/);
    }
    const html = sandbox.renderHoursCell({ ores_ergasias_apologistika: 7.5 });
    assert.match(html, /stage4-hours-clock[^>]*>07:30</);
    assert.match(html, /stage4-hours-decimal[^>]*>7\.50</);
    assert.doesNotMatch(html, /stage4-hours-unavailable/);
    assert.equal(numbers.sum([7.5, 0]), 7.5);
    assert.equal(sandbox.hours(null), 'Μη διαθέσιμο', 'shared editor formatter stays unchanged');
});
test('PR381: legacy classifications and locked evidence retain the shared availability rules', () => {
    const row = Object.freeze({ history_terms_unavailable: true, ores_ergasias_apologistika: 8,
        ores_prostheths_ergasias_apologistika: 2 });
    assert.equal(numbers.dailyNumber(row, 'ores_ergasias_apologistika'), 8);
    assert.equal(numbers.dailyNumber(row, 'ores_prostheths_ergasias_apologistika'), null);
    assert.equal(numbers.dailyNumber({ ...row, is_locked: true }, 'ores_prostheths_ergasias_apologistika'), 2);
    assert.equal(numbers.dailyNumber({ ...row, is_locked: true, ores_prostheths_ergasias_apologistika: null },
        'ores_prostheths_ergasias_apologistika'), null);
});
