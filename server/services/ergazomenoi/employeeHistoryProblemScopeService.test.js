'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { CANONICAL_STATUSES } = require('./employeeHistoryCanonicalizationService');
const { identifyEmployeeHistoryProblemScope } = require('./employeeHistoryProblemScopeService');

const scope = { team: 'TEST', company_kod: 'company', kodikos: '0001' };
const profile = (id, from, extra = {}) => ({ _id: id, ...scope,
    ...buildCompleteProfileSnapshot({ effectiveFrom: from }), aa_eggrafhs: id,
    hmeromhnia_proslhpshs: '2026-01-01',
    hmeromhnia_isxyos_oron_ergasias_apo: from,
    hmeromhnia_isxyos_oron_ergasias_eos: null,
    afora_allagh_oron_ergasias: true, ...extra });

test('CLEAN history exposes no problematic row IDs', () => {
    const row = profile('0001', '2026-01-01');
    const result = identifyEmployeeHistoryProblemScope({ scope,
        currentEmployee: { ...row, _id: 'employee' }, completeHistoryRows: [row] });
    assert.equal(result.overallStatus, CANONICAL_STATUSES.CLEAN);
    assert.deepEqual(result.problematicHistoryIds, []);
    assert.equal(result.deterministicallyResolved, true);
});

test('AUTO_REPAIRABLE exposes only deterministic UPDATE and REDUNDANT rows', () => {
    const first = profile('0001', '2026-01-01');
    const duplicate = { ...first, _id: '0002', aa_eggrafhs: '0002' };
    const later = profile('0003', '2026-03-01', { ores_ergasias_ebdomadas: 35 });
    const current = { ...later, _id: 'employee' };
    const result = identifyEmployeeHistoryProblemScope({ scope, currentEmployee: current,
        completeHistoryRows: [first, duplicate, later] });
    assert.equal(result.overallStatus, CANONICAL_STATUSES.AUTO_REPAIRABLE);
    assert(result.problematicHistoryIds.some(id => ['0001', '0002'].includes(id)));
    assert(!result.problematicHistoryIds.includes('0003'));
    for (const id of result.problematicHistoryIds) assert.ok(result.problemReasonByHistoryId[id]);
});

test('one deterministic problem preserves stable IDs and excludes the valid row', () => {
    const valid = profile('valid', '2026-01-01');
    const problem = profile('problem', '2026-03-01');
    const completeHistoryRows = [valid, problem];
    const before = structuredClone(completeHistoryRows);
    const canonicalizer = () => ({
        status: CANONICAL_STATUSES.AUTO_REPAIRABLE,
        diagnostics: { reason: 'SINGLE_DETERMINISTIC_UPDATE' },
        classifications: [
            { historyId: 'valid', disposition: 'KEEP' },
            { historyId: 'problem', disposition: 'UPDATE' }
        ],
        rowsToUpdate: [{ historyId: 'problem', patch: { afora_proslhpsh: false } }],
        rowsToDelete: [],
        cleanupRequired: true
    });
    const result = identifyEmployeeHistoryProblemScope({ scope,
        currentEmployee: { ...problem, _id: 'employee' }, completeHistoryRows, canonicalizer });
    assert.deepEqual(result.problematicHistoryIds, ['problem']);
    assert.equal(result.problemReasonByHistoryId.problem, 'UPDATE');
    assert(!Object.hasOwn(result.problemReasonByHistoryId, 'valid'));
    assert.deepEqual(completeHistoryRows, before);
    assert.deepEqual(completeHistoryRows.map(item => item._id), ['valid', 'problem']);
});

test('already retired referenced artifacts remain excluded from an unrelated repair scope', () => {
    const first = profile('0001', '2026-01-01');
    const latest = profile('0002', '2026-03-01');
    const retired = { ...first, _id: 'retired', aa_eggrafhs: '0099',
        employment_history_canonical_status: 'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id: '0001' };
    const result = identifyEmployeeHistoryProblemScope({ scope,
        currentEmployee: { ...latest, _id: 'employee' },
        completeHistoryRows: [first, latest, retired] });
    assert.equal(result.overallStatus, CANONICAL_STATUSES.AUTO_REPAIRABLE);
    assert(!result.problematicHistoryIds.includes('retired'));
});

test('TRUE_AMBIGUITY exposes exactly implicated persisted rows and excludes clean rows', () => {
    const clean = profile('clean', '2026-01-01', {
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-01-31' });
    const left = profile('left', '2026-02-01', { [C.DAYS]: [1, 2, 3] });
    const right = profile('right', '2026-02-01', { [C.DAYS]: [4, 5] });
    const current = { ...left, _id: 'employee', [C.DAYS]: [1, 5] };
    const result = identifyEmployeeHistoryProblemScope({ scope, currentEmployee: current,
        completeHistoryRows: [clean, left, right] });
    assert.equal(result.overallStatus, CANONICAL_STATUSES.TRUE_AMBIGUITY);
    assert.deepEqual(result.problematicHistoryIds, ['left', 'right']);
    assert.equal(result.problemReasonByHistoryId.left, 'CONFLICTING_PROFILE_EVENTS');
    assert(!Object.hasOwn(result.problemReasonByHistoryId, 'clean'));
});

test('unresolvable ambiguity diagnostics fail closed for Supervisor', () => {
    const result = identifyEmployeeHistoryProblemScope({ scope, currentEmployee: null,
        completeHistoryRows: [], canonicalizer: () => ({
            status: CANONICAL_STATUSES.TRUE_AMBIGUITY,
            diagnostics: { reason: 'CURRENT_CYCLE_HISTORY_MISSING', historyIds: [] },
            classifications: []
        }) });
    assert.equal(result.deterministicallyResolved, false);
    assert.deepEqual(result.problematicHistoryIds, []);
});

test('coverage gap cannot authorize unrelated persisted rows and retains the complete diagnosis', () => {
    const rows = [
        profile('before-gap', '2026-01-01', { hmeromhnia_isxyos_oron_ergasias_eos: '2026-01-15' }),
        profile('after-gap', '2026-02-01', { hmeromhnia_isxyos_oron_ergasias_eos: '2026-02-28' }),
        profile('unrelated', '2026-03-01')
    ];
    const before = structuredClone(rows);
    const result = identifyEmployeeHistoryProblemScope({ scope,
        currentEmployee: { ...rows[2], _id: 'employee' }, completeHistoryRows: rows });
    assert.equal(result.overallReason, 'HISTORY_COVERAGE_MISSING');
    assert.deepEqual(result.canonicalResult.diagnostics.historyIds, rows.map(row => row._id));
    assert.equal(result.canonicalResult.diagnostics.coverageGaps[0].beforeHistoryId, 'before-gap');
    assert.equal(result.canonicalResult.diagnostics.coverageGaps[0].afterHistoryId, 'after-gap');
    assert.deepEqual(result.problematicHistoryIds, rows.map(row => row._id).sort());
    const { ACCESS_MODES, assertEmployeeHistoryOperationsAuthorized } =
        require('./employeeHistoryAuthorizationService');
    for (const operation of [
        { state: 'modified', historyId: 'unrelated' },
        { state: 'deleted', historyId: 'unrelated' },
        { state: 'inserted', anchorHistoryId: 'unrelated' },
        { state: 'modified', historyId: 'before-gap' }
    ]) {
        assert.throws(() => assertEmployeeHistoryOperationsAuthorized({
            accessMode: ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE,
            operations: [operation], originalHistoryRows: rows, problemScope: result
        }), { code: 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN', statusCode: 403 });
    }
    assert.deepEqual(rows, before);
});

test('coverage boundary hints and pending repairs do not prove a manual authorization scope', () => {
    const canonical = {
        status: CANONICAL_STATUSES.TRUE_AMBIGUITY,
        diagnostics: { reason: 'HISTORY_COVERAGE_MISSING', historyIds: ['problem'],
            coverageGaps: [{ beforeHistoryId: 'problem', afterHistoryId: null }] },
        classifications: [{ historyId: 'problem', disposition: 'TRUE_AMBIGUITY' }],
        rowsToUpdate: [{ historyId: 'problem', patch: { afora_proslhpsh: false } }]
    };
    const result = identifyEmployeeHistoryProblemScope({ scope,
        completeHistoryRows: [profile('problem', '2026-01-01')], canonicalizer: () => canonical });
    assert.deepEqual(result.problematicHistoryIds, ['problem']);
    assert.equal(result.canonicalResult, canonical);
    assert.equal(result.canonicalResult.rowsToUpdate.length, 1);
    const { ACCESS_MODES, assertEmployeeHistoryOperationsAuthorized } =
        require('./employeeHistoryAuthorizationService');
    assert.throws(() => assertEmployeeHistoryOperationsAuthorized({
        accessMode: ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE,
        operations: [{ state: 'modified', historyId: 'problem' }],
        originalHistoryRows: [{ _id: 'problem' }], problemScope: result
    }), { code: 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN', statusCode: 403 });
});
