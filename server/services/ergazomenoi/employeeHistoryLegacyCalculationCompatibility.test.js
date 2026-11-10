'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { employeeActiveHistoryFixture } = require('../../../test/fixtures/employeeActiveHistoryFixture');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { store } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { clone } = require('./employeeHistoryAutomaticSettlementPreparationContract');
const policy = require('./employeeHistorySaveValidationService');
const writer = require('./employeeEmploymentProfileWriter');
const { assertVerifiedHistoryCoverageForDate: coverage, employeeHistoryCoverageGaps: gaps } =
    require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { getOrarioTermsForDate: terms } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { resolveEffectiveEmploymentProfileForReviewDate: review } = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { detectPayrollPhasesForDateRange: phases } = require('../kinhseis/phaseDetectorService');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

function legacyFixture() {
    const f = employeeActiveHistoryFixture('0015');
    f.employee.hmeromhnia_proslhpshs = f.history[0].hmeromhnia_proslhpshs = '2026-01-01';
    f.history.unshift({ ...clone(f.history[0]), _id: '507f1f77bcf86cd799439088', aa_eggrafhs: '0000',
        employment_profile_schema_version: undefined,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-03-31',
        hmeromhnia_allaghs_symbashs: '2026-01-01', hmeromhnia_lhxhs_symbashs: 'invalid',
        krathsh_01: null, pragmatikosMisthos: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') });
    return f;
}
const inspect = f => policy.inspectEmployeeHistorySave({ scope: f.scope, currentEmployee: f.employee, historyRows: f.history });
const payrollInput = f => ({ ...f.scope, apo: '2026-04-06', eos: '2026-04-06', asOfDate: '2026-04-30',
    preparedContext: { employee: f.employee, contractStatusHistoryRows: f.history, workingTermsHistoryRows: f.history,
        rows: [{ hmeromhnia: '2026-04-06', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, apo_ora_01: '10:00', eos_ora_01: '18:00' }] } });
const blocked = fn => assert.throws(fn, { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });

test('closed pre-V1 uncertainty permits actual payroll phases and employment review without a false CLEAN or any mutation', async () => {
    const f = legacyFixture(), before = clone(f), validOnly = { ...f, history: [f.history[1]] };
    assert.equal(inspect(f).status, 'LEGACY_REVIEW_REQUIRED');
    const checked = coverage('2026-04-06', f.history, f.employee);
    assert.equal(checked.status, 'LEGACY_COMPATIBLE');
    assert.deepEqual(checked.ignoredHistoryIds, [f.history[0]._id]);
    assert.deepEqual(await phases(payrollInput(f)), await phases(payrollInput(validOnly)));
    assert.deepEqual(review({ reviewDate: '2026-04-06', normalEmployee: f.employee, normalHistory: f.history }),
        review({ reviewDate: '2026-04-06', normalEmployee: f.employee, normalHistory: validOnly.history }));
    assert.equal(terms('2026-04-06', f.history, f.employee).hmeres_ergasias_ebdomadas, 5);
    assert.equal(inspect(f).status, 'LEGACY_REVIEW_REQUIRED');
    assert.ok(gaps({ currentEmployee: f.employee, historyRows: f.history }).length);
    assert.deepEqual(f, before);
});

for (const field of ['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias', 'kathestos_apasxolhshs'])
test(`compatibility cannot fill necessary ${field} from today's employee`, async () => {
    const f = legacyFixture(); delete f.history[1][field];
    if (field === 'kathestos_apasxolhshs') delete f.history[1].typos_apasxolhshs;
    blocked(() => terms('2026-04-06', f.history, f.employee));
    const partial = review({ reviewDate: '2026-04-06', normalEmployee: f.employee, normalHistory: f.history });
    assert.equal(partial.history_terms_unavailable, true);
    assert.equal(partial.resolution_blocked, false);
    
    const defaults = {
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        kathestos_apasxolhshs: '0'
    };
    assert.equal(partial.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
    assert.equal(partial[field], defaults[field]);
    assert.equal(partial.assumed_work_terms[field], defaults[field]);
    assert.equal(partial.all_financial_results_documented, false);
    assert.equal(Object.hasOwn(f.history[1], field), false);

    await assert.rejects(phases(payrollInput(f)), { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });
});

for (const kind of ['overlap', 'unknown-end', 'departure', 'versioned-invalid', 'later-contract-event', 'unknown-contract-event',
    'future-new-contract-event', 'unknown-new-departure', 'missing-new-expiry', 'post-expiry', 'new-gap'])
test(`strict verifier rejects unproven terms while Ergani continues: ${kind}`, () => {
    const f = legacyFixture();
    if (kind === 'overlap') f.history[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-04-30';
    if (kind === 'unknown-end') f.history[0].hmeromhnia_isxyos_oron_ergasias_eos = null;
    if (kind === 'departure') f.history[0].hmeromhnia_apoxorhshs = '2026-03-31';
    if (kind === 'versioned-invalid') f.history[0].employment_profile_schema_version = 1;
    if (kind === 'later-contract-event') f.history[0].hmeromhnia_allaghs_symbashs = '2026-04-05';
    if (kind === 'unknown-contract-event') f.history[0].hmeromhnia_allaghs_symbashs = 'invalid';
    if (kind === 'future-new-contract-event') f.history[1].hmeromhnia_allaghs_symbashs = '2026-05-01';
    if (kind === 'unknown-new-departure') f.history[1].hmeromhnia_apoxorhshs = 'invalid';
    if (kind === 'missing-new-expiry') delete f.history[1].hmeromhnia_lhxhs_symbashs;
    if (kind === 'post-expiry') f.history[1].hmeromhnia_lhxhs_symbashs = '2026-04-05';
    if (kind === 'new-gap') f.history[1].hmeromhnia_isxyos_oron_ergasias_apo = '2026-04-07';
    blocked(() => coverage('2026-04-06', f.history, f.employee));
    assert.equal(review({ reviewDate: '2026-04-06', normalEmployee: f.employee,
        normalHistory: f.history }).history_terms_unavailable, true);
});

test('the old problematic date itself still requires documented correction', () => {
    const f = legacyFixture(); blocked(() => coverage('2026-02-01', f.history, f.employee));
});

test('read compatibility never authorizes a new invalid final hire or a historical mutation', async () => {
    const f = legacyFixture(), db = store([f], { cloneFn: clone }), before = db.state();
    coverage('2026-04-06', f.history, f.employee);
    assert.throws(() => policy.assertEmployeeHistorySaveClean({ scope: f.scope, currentEmployee: f.employee, historyRows: f.history }),
        { code: 'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN' });
    await assert.rejects(writer.writeEmployeeEmploymentProfile({ ...db.deps, scope: f.scope, employeeId: f.employee._id,
        mode: writer.MODE_CORRECT_EXISTING, effectiveFrom: '2026-04-01', historyId: f.history[1]._id,
        maintenance: { employeeChanges: {}, historyChanges: { krathsh_01: null } } }));
    assert.deepEqual(db.state(), before);
    const fresh = employeeActiveHistoryFixture('NEW'), empty = store([], { cloneFn: clone }), emptyBefore = empty.state();
    delete fresh.employee.krathsh_01;
    await assert.rejects(writer.writeEmployeeEmploymentProfile({ ...empty.deps, scope: fresh.scope,
        newEmployee: fresh.employee, effectiveFrom: '2026-04-01' }), { code: 'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN' });
    assert.deepEqual(empty.state(), emptyBefore);
});

test('a past gap remains unresolved but cannot contaminate a later fully evidenced calculation date', () => {
    const f = legacyFixture(); f.history[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-01-31';
    assert.equal(coverage('2026-04-06', f.history, f.employee).status, 'LEGACY_COMPATIBLE');
    blocked(() => coverage('2026-02-15', f.history, f.employee));
    assert.equal(inspect(f).status, 'LEGACY_REVIEW_REQUIRED');
});

test('actual payroll work-facts generation is READY without altering the legacy aggregate', async t => {
    const f = legacyFixture(), before = clone(f), detector = require('../kinhseis/phaseDetectorService');
    t.mock.method(detector, 'detectPayrollPhasesForDateRange', args => phases({ ...args, preparedContext: payrollInput(f).preparedContext }));
    const result = await require('../kinhseis/workFactsPrecalcService').generateWorkFactsForEmployeePeriod({
        ...f.scope, apo: '2026-04-06', eos: '2026-04-06', asOfDate: '2026-04-30', scope: 'MANUAL' });
    assert.equal(result.status, 'READY'); assert.deepEqual(f, before);
});

test('0031 remains genuinely CLEAN with identical payroll phases and review terms', async () => {
    const f = employeeActiveHistoryFixture('0031'), before = clone(f);
    assert.equal(inspect(f).status, 'CLEAN');
    assert.equal(coverage('2026-04-06', f.history, f.employee).status, 'VERIFIED_DATE');
    assert.ok((await phases(payrollInput(f))).phases.length);
    assert.equal(review({ reviewDate: '2026-04-06', normalEmployee: f.employee, normalHistory: f.history }).hmeres_ergasias_ebdomadas, 5);
    assert.deepEqual(f, before);
});

test('PR 373 original synthetic history has real missing/overlapping terms, not isolated legacy defects', () => {
    const f = require('./fixtures/employee0015HistoryFixture').fixture(), before = clone(f);
    assert.equal(f.completeHistoryRows.length, 6);
    const septemberWeek = Array.from({ length: 7 }, (_, i) => ['2026-09-' + String(7 + i).padStart(2, '0'), 2]);
    for (const [date, count] of [['2026-04-27', 0], ['2026-05-26', 2], ['2026-06-10', 2], ['2026-06-23', 2], ...septemberWeek]) {
        for (const run of [() => coverage(date, f.completeHistoryRows, f.currentEmployee),
            () => terms(date, f.completeHistoryRows, f.currentEmployee)]) {
            assert.throws(run, error => {
                assert.equal(error.code, 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED');
                assert.deepEqual(error.diagnostics, [{ code: error.code, dates: [date], evidence: {
                    coverage_reason: count ? 'OVERLAPPING_WORK_TERMS' : 'NO_VERIFIED_PROFILE_FOR_DATE',
                    matching_profile_count: count } }]);
                return true;
            });
        }
        const result = review({ reviewDate: date, normalEmployee: f.currentEmployee, normalHistory: f.completeHistoryRows });
        assert.equal(result.history_terms_unavailable, true);
        assert.equal(result.resolution_blocked, false);

        assert.equal(result.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
        assert.equal(result.hmeres_ergasias_ebdomadas, 5);
        assert.equal(result.assumed_work_terms.hmeres_ergasias_ebdomadas, 5);
        assert.equal(result.all_financial_results_documented, false);
    }
    assert.deepEqual(f, before); // No hypothetical replacement dates/terms are introduced.
});

test('07–13 September control: independently recorded terms permit legacy compatibility every day', () => {
    const f = legacyFixture(), before = clone(f);
    for (let i = 7; i <= 13; i++) {
        const date = '2026-09-' + String(i).padStart(2, '0');
        assert.equal(coverage(date, f.history, f.employee).status, 'LEGACY_COMPATIBLE');
        assert.equal(review({ reviewDate: date, normalEmployee: f.employee, normalHistory: f.history }).hmeres_ergasias_ebdomadas, 5);
    }
    assert.deepEqual(f, before);
});
