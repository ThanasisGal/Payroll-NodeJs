'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateQuery, overlapsPeriod } = require('./employmentReviewEmployeesController');
const query = { apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30', ypokatasthma: '0000' };
const period = validateQuery(query).period;
const employee = (hire, departure) => ({ hmeromhnia_proslhpshs: hire, hmeromhnia_apoxorhshs: departure });

for (const [name, hire, departure, expected] of [
    ['active throughout', '2026-01-01', null, true],
    ['0001 departure 04/10/2026', '2026-01-01', '2026-10-04', true],
    ['hire on final day', '2026-09-30', null, true],
    ['departure on first day', '2026-01-01', '2026-09-01', true],
    ['departure within period', '2026-01-01', '2026-09-15', true],
    ['departure next year', '2026-01-01', '2027-01-02', true],
    ['departure before period', '2026-01-01', '2026-08-31', false],
    ['hire after period', '2026-10-01', null, false],
    ['single first day', '2026-09-01', '2026-09-01', true],
    ['single last day', '2026-09-30', '2026-09-30', true],
    ['single middle day', '2026-09-15', '2026-09-15', true],
    ['no dates or history', null, null, false],
    ['invalid departure cannot mean open employment', '2026-01-01', 'invalid', false],
    ['departure before hire', '2026-09-20', '2026-09-10', false],
    ['legacy Date objects', new Date('2026-01-01'), new Date('2026-10-04'), true],
    ['legacy ISO timestamps', '2026-01-01T00:00:00.000Z', '2026-10-04T00:00:00.000Z', true]
]) test(name, () => assert.equal(overlapsPeriod(employee(hire, departure), [], period), expected));

test('draft excluded, missing finalization field included regardless of current active flag', () => {
    const e = { ...employee('2026-01-01', '2026-10-04'), energos: false };
    assert.equal(overlapsPeriod(e, [], period), true);
    assert.equal(overlapsPeriod({ ...e, oristikh_enhmerosh: false }, [], period), false);
    assert.equal(overlapsPeriod({ ...e, archived: true }, [], period), false);
});
test('rehire cycles: old/current intervals match, inactive gap does not', () => {
    const e = employee('2026-10-10', null);
    const history = [employee('2026-01-01', '2026-08-31'), employee('2026-10-10', null)];
    assert.equal(overlapsPeriod(e, history, period), false);
    for (const [start, end] of [['2026-08-01','2026-08-31'],['2026-10-10','2026-10-10']]) {
        assert.equal(overlapsPeriod(e, history, { startIso: start, endIso: end }), true);
    }
});
test('history-only legacy hire, current departure precedence and redundant artifacts', () => {
    assert.equal(overlapsPeriod({}, [employee('2026-01-01','2026-10-04')], period), true);
    assert.equal(overlapsPeriod(employee('2026-01-01','2026-08-31'),
        [employee('2026-01-01',null)], period), false);
    assert.equal(overlapsPeriod(employee('2026-01-01','2026-10-04'),
        [{ ...employee('2026-09-01', null), employment_history_canonical_status: 'REDUNDANT_REFERENCED' }], period), true);
});
test('ambiguous or unterminated legacy multi-cycle history cannot bridge a gap', () => {
    assert.equal(overlapsPeriod(employee('2026-10-10', null), [employee('2026-01-01', null)], period), false);
    assert.equal(overlapsPeriod(employee('2026-09-10', null), [employee('2026-01-01', '2026-09-20')], period), false);
});
test('malicious objects, unknown filters, invalid dates and unbounded parameters rejected', () => {
    for (const extra of [{ team: 'OTHER' }, { company: 'OTHER' }, { filter: { $or: [{}] } },
        { search: { $ne: '' } }, { search: ['0001'] }, { value: { $gt: '' } }, { ypokatasthma: { $ne: '' } },
        { apo_hmeromhnia: { $lte: '2026-10-01' } }, { apo_hmeromhnia: '2026-02-30' },
        { eos_hmeromhnia: '2026-08-31' }, { eos_hmeromhnia: '2028-01-01' }, { page: '-1' },
        { page: '0' }, { limit: '1000000' }, { value: '$where' }, { search: 'a'.repeat(129) }]) {
        assert.throws(() => validateQuery({ ...query, ...extra }), { status: 400 });
    }
});
