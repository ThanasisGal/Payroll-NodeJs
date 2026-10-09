'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { Types } = require('mongoose');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { planEmployeeHistoryAutomaticReconstruction: plan,
    summarizeEmployeeHistoryAutomaticReconstruction: summary, MAX_HISTORY_ROWS } =
    require('./employeeHistoryAutomaticReconstructionPlannerService');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');

const timeline = result => result.logicalPeriods.map(({ from, to }) => [from, to]);
const proposed = (result, identity) => result.proposedRows.find(row => row.aa_eggrafhs === identity);
const diff = (result, identity, field) => result.rowDiffs.find(item =>
    String(item.historyId) === `synthetic-${identity}` && item.field === field);
function fixture(rows, employee = {}) {
    return { scope: F.scope, currentEmployee: { _id: 'synthetic-current', ...F.scope,
        [C.HIRE]: '2026-04-23', ...employee }, completeHistoryRows: rows };
}
function profile(identity, start, extra = {}) {
    return F.row(identity, { [C.HIRE]: '2026-04-23', [C.START]: start, ...extra });
}
function assertIdempotent(input) {
    const first = plan(input);
    assert.notEqual(first.status, 'BLOCKED');
    const second = plan({ ...input, completeHistoryRows: first.proposedRows });
    assert.equal(second.rowDiffs.length, 0, JSON.stringify(second.rowDiffs));
    assert.deepEqual(timeline(second), timeline(first));
    assert.deepEqual(second.proposedRows, first.proposedRows);
    assert.deepEqual(second.logicalPeriods.map(item => item.profile), first.logicalPeriods.map(item => item.profile));
    return first;
}

test('exact case A: 24 April hire, 25 May next state, 5 October end, next History values before zero', () => {
    const result = assertIdempotent(F.caseA());
    assert.deepEqual(timeline(result), [['2026-04-24', '2026-05-24'], ['2026-05-25', '2026-10-05']]);
    for (const [field, value] of Object.entries(F.workTerms)) {
        assert.equal(proposed(result, '0001')[field], value);
        assert.equal(diff(result, '0001', field).sourceType, 'NEXT_PERIOD');
        assert.equal(diff(result, '0001', field).sourceHistoryId, 'synthetic-0002');
    }
    assert.equal(result.logicalPeriods[1].endProvenance.sourceField, C.CONTRACT_END);
});

test('exact asymmetric case B: 0002 and 0001 coalesce on 23 April, 0003 starts 17 May', () => {
    const input = F.caseB();
    const result = assertIdempotent(input);
    assert.deepEqual(timeline(result), [['2026-04-23', '2026-05-16'], ['2026-05-17', '2026-10-15']]);
    assert.deepEqual(result.logicalPeriods.map(item => item.sourceHistoryIds),
        [['synthetic-0001', 'synthetic-0002'], ['synthetic-0003']]);
    assert.equal(result.logicalPeriods[1].endProvenance.sourceHistoryId, 'synthetic-0001');
    assert.equal(diff(result, '0001', C.HIRE).sourceHistoryId, 'synthetic-0002');
    for (const original of input.completeHistoryRows) assert.equal(
        result.proposedRows.find(row => row._id === original._id).aa_eggrafhs, original.aa_eggrafhs);
});

test('History hire missing: current Employee hire supplies the genuine initial start', () => {
    const result = assertIdempotent(fixture([F.row('0001', { afora_proslhpsh: true })]));
    assert.deepEqual(timeline(result), [['2026-04-23', null]]);
    assert.equal(diff(result, '0001', C.HIRE).sourceType, 'CURRENT_EMPLOYEE');
});

test('later missing FROM uses genuine contract-change evidence', () => {
    const result = assertIdempotent(fixture([
        profile('0010', '2026-04-23'), F.row('0001', { [C.CHANGE]: '2026-05-17' })
    ]));
    assert.deepEqual(timeline(result), [['2026-04-23', '2026-05-16'], ['2026-05-17', null]]);
    assert.equal(diff(result, '0001', C.START).sourceType, 'DETERMINISTIC_CONTRACT_CHANGE_BOUNDARY');
});

test('final period uses History contract end or applicable current end, otherwise null', () => {
    for (const [history, employee, end, sourceId] of [
        [{ [C.CONTRACT_END]: '2026-10-15' }, {}, '2026-10-15', 'synthetic-0001'],
        [{}, { [C.CONTRACT_END]: '2026-10-15' }, '2026-10-15', null],
        [{}, {}, null, null]
    ]) {
        const result = assertIdempotent(fixture([profile('0001', '2026-04-23', history)], employee));
        assert.deepEqual(timeline(result), [['2026-04-23', end]]);
        assert.equal(result.logicalPeriods[0].endProvenance.sourceHistoryId, sourceId);
    }
});

test('departure caps contract end and competing final facts are explicit assumptions', () => {
    const result = assertIdempotent(fixture([profile('0001', '2026-04-23', {
        [C.CONTRACT_END]: '2026-10-15', [C.DEPARTURE]: '2026-09-30'
    })]));
    assert.equal(result.logicalPeriods[0].to, '2026-09-30');
    assert.equal(result.logicalPeriods[0].endProvenance.sourceField, C.DEPARTURE);
    assert.ok(result.assumptions.some(item => item.code === 'COMPETING_FINAL_BOUNDARIES'));
});

test('latest historical contract-end state wins; History has precedence over conflicting current fact', () => {
    const result = assertIdempotent(fixture([
        profile('9999', '2026-04-23', { [C.CONTRACT_END]: '2026-09-01' }),
        profile('0001', '2026-05-01', { [C.CONTRACT_END]: '2026-10-15' })
    ], { [C.CONTRACT_END]: '2026-11-01' }));
    assert.equal(result.logicalPeriods[1].to, '2026-10-15');
    assert.ok(result.assumptions.some(item => item.code === 'CURRENT_TERMINATION_DIFFERS_FROM_HISTORY'));
});

test('critical legacy zero placeholders use compatible positive next evidence', () => {
    const input = F.caseA();
    for (const field of C.CRITICAL_NUMBERS) input.completeHistoryRows[0][field] = 0;
    const result = assertIdempotent(input);
    for (const [field, value] of Object.entries(F.workTerms)) assert.equal(proposed(result, '0001')[field], value);
    assert.equal(result.assumptions.filter(item => item.code === 'LEGACY_ZERO_PLACEHOLDER_REPLACED').length, 3);
});

test('only numeric defaults are materialized after evidence is exhausted; optional types stay absent', () => {
    const result = assertIdempotent(fixture([profile('0001', '2026-04-23')]));
    const after = proposed(result, '0001');
    assert.equal(after.ores_ergasias_ebdomadas, 0);
    for (const [field, type] of Object.entries(C.PROFILE_FIELD_TYPES)) {
        assert.equal(Object.hasOwn(after, field), type === 'Number', field);
        assert.equal(Object.hasOwn(result.logicalPeriods[0].profile, field), type === 'Number', field);
    }
    assert.ok(!Object.hasOwn(after, C.END), 'open end does not require a physical null');
    assert.ok(result.rowDiffs.every(item => C.PROFILE_FIELD_TYPES[item.field] === 'Number'));
    assert.equal(diff(result, '0001', 'ores_ergasias_ebdomadas').sourceType, 'DEFAULT_VALUE');
});

test('previous compatible period wins over next and current evidence', () => {
    const result = assertIdempotent(fixture([
        profile('0003', '2026-04-23', { ores_ergasias_ebdomadas: 35 }),
        profile('0002', '2026-05-01'),
        profile('0001', '2026-06-01', { ores_ergasias_ebdomadas: 40 })
    ], { ores_ergasias_ebdomadas: 37 }));
    assert.equal(proposed(result, '0002').ores_ergasias_ebdomadas, 35);
    assert.equal(diff(result, '0002', 'ores_ergasias_ebdomadas').sourceType, 'PREVIOUS_PERIOD');
});

test('incompatible employment states and rehire cycles do not donate work terms', () => {
    const result = assertIdempotent(fixture([
        profile('0001', '2026-04-23', { symbash: 'A' }),
        profile('0002', '2026-05-01', { symbash: 'B', ...F.workTerms })
    ]));
    assert.equal(proposed(result, '0001').ores_ergasias_ebdomadas, 0);
    const rehire = assertIdempotent(fixture([
        profile('0001', '2026-04-23', { [C.DEPARTURE]: '2026-05-01' }),
        profile('0002', '2026-06-01', { [C.HIRE]: '2026-06-01', ...F.workTerms })
    ], { [C.HIRE]: '2026-06-01', ...F.workTerms }));
    assert.equal(proposed(rehire, '0001').ores_ergasias_ebdomadas, 0);
});

test('current fields are last evidence fallback and cannot be copied onto an earlier state', () => {
    const direct = assertIdempotent(fixture([profile('0001', '2026-04-23')], F.workTerms));
    assert.equal(diff(direct, '0001', 'ores_ergasias_ebdomadas').sourceType, 'CURRENT_EMPLOYEE');
    const earlier = assertIdempotent(fixture([profile('0001', '2026-04-23')], {
        [C.START]: '2026-06-01', ...F.workTerms
    }));
    assert.equal(proposed(earlier, '0001').ores_ergasias_ebdomadas, 0);
});

test('same-period conflicting KPK values become coherent with original values preserved as evidence', () => {
    const result = assertIdempotent(fixture([
        profile('0002', '2026-04-23', { krathsh_01: '0115' }),
        profile('0001', '2026-04-23', { krathsh_01: '0111' }),
        profile('0003', '2026-04-23')
    ]));
    assert.equal(result.logicalPeriods.length, 1);
    assert.equal(proposed(result, '0001').krathsh_01, '0111');
    assert.equal(proposed(result, '0002').krathsh_01, '0111');
    assert.equal(diff(result, '0002', 'krathsh_01').before, '0115');
    assert.equal(diff(result, '0002', 'krathsh_01').confidence, 'ASSUMED');
    assert.equal(diff(result, '0003', 'krathsh_01').sourceType, 'APPLICATION_ASSUMPTION');
    assert.ok(result.assumptions.some(item => item.code === 'SAME_DATE_NON_EMPTY_CONFLICT' && item.field === 'krathsh_01'));
});

test('different-date non-empty KPK changes remain distinct and are explicit', () => {
    const result = assertIdempotent(fixture([
        profile('0001', '2026-04-23', { krathsh_01: '0111' }),
        profile('0002', '2026-05-01', { krathsh_01: '0115' })
    ]));
    assert.equal(result.logicalPeriods.length, 2);
    assert.ok(result.assumptions.some(item => item.code === 'HISTORICAL_NON_EMPTY_VALUE_CHANGE' && item.field === 'krathsh_01'));
    assert.ok(!result.rowDiffs.some(item => item.field === 'krathsh_01'));
});

test('same-date complementary rows coalesce without duplicate/zero-length periods', () => {
    const result = assertIdempotent(fixture([
        profile('0002', '2026-04-23', { ores_ergasias_ebdomadas: 40 }),
        profile('0001', '2026-04-23', { hmeres_ergasias_ebdomadas: 5 }),
        profile('0003', '2026-05-01', { mo_oron_hmerhsias_ergasias: 8 })
    ]));
    assert.deepEqual(timeline(result), [['2026-04-23', '2026-04-30'], ['2026-05-01', null]]);
    assert.equal(result.logicalPeriods[0].sourceHistoryIds.length, 2);
});

test('schedule-only changes have zero effect on decisions, provenance, assumptions and fingerprint', () => {
    for (const factory of [F.caseA, F.caseB, F.caseBWithProfileEvidence]) {
        const input = factory();
        const before = plan(input);
        const modified = factory();
        for (const record of [modified.currentEmployee, ...modified.completeHistoryRows]) {
            record.hmeromhnia_allaghs_orarioy_apo = 'arbitrary invalid informational bytes';
            record.hmeromhnia_allaghs_orarioy_eos = new Date('2040-12-31T21:24:36.789Z');
        }
        const after = plan(modified);
        assert.deepEqual({ ...after, proposedRows: [] }, { ...before, proposedRows: [] });
        for (const source of modified.completeHistoryRows) {
            const result = after.proposedRows.find(row => row._id === source._id);
            for (const field of ['hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']) {
                assert.deepEqual(result[field], source[field], field);
            }
        }
    }
});

test('removing all schedule fields also leaves semantic decisions unchanged', () => {
    const input = F.caseB();
    const first = plan(input);
    for (const row of input.completeHistoryRows) {
        delete row.hmeromhnia_allaghs_orarioy_apo;
        delete row.hmeromhnia_allaghs_orarioy_eos;
    }
    const second = plan(input);
    assert.deepEqual({ ...first, proposedRows: [] }, { ...second, proposedRows: [] });
});

test('all input permutations give identical plans; audit numbering and timestamps never order events', () => {
    const input = F.caseB();
    const first = plan(input);
    for (const indices of [[2, 1, 0], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0]]) {
        assert.deepEqual(plan({ ...input, completeHistoryRows: indices.map(index => input.completeHistoryRows[index]) }), first);
    }
    const changed = F.caseB();
    changed.completeHistoryRows.forEach((row, index) => {
        row.aa_eggrafhs = String(100 - index);
        row.createdAt = new Date(`203${index}-01-01`);
        row.updatedAt = new Date(`204${index}-01-01`);
    });
    const second = plan(changed);
    assert.equal(second.semanticFingerprint, first.semanticFingerprint);
    assert.deepEqual(second.logicalPeriods, first.logicalPeriods);
    assert.deepEqual(second.rowDiffs, first.rowDiffs);
});

test('20 rows remain deterministic, practical and idempotent', () => {
    const input = fixture(Array.from({ length: 20 }, (_, index) => profile(String(20 - index).padStart(4, '0'),
        `2026-05-${String(index + 1).padStart(2, '0')}`, index % 3 === 0 ? F.workTerms : {})));
    const started = performance.now();
    const result = assertIdempotent(input);
    assert.equal(result.logicalPeriods.length, 20);
    assert.deepEqual(plan({ ...input, completeHistoryRows: [...input.completeHistoryRows].reverse() }), result);
    assert.ok(performance.now() - started < 5000);
});

test('referenced redundant artifacts are never events or profile/end donors and remain byte-equivalent', () => {
    const input = F.caseA();
    const artifact = profile('0000', '2030-01-01', {
        employment_history_canonical_status: 'REDUNDANT_REFERENCED',
        employment_history_canonical_survivor_id: new Types.ObjectId('507f1f77bcf86cd799439011'),
        [C.HIRE]: '1900-01-01', [C.CONTRACT_END]: '2040-01-01', ores_ergasias_ebdomadas: 99
    });
    input.completeHistoryRows.push(artifact);
    const result = assertIdempotent(input);
    assert.deepEqual(timeline(result), timeline(plan(F.caseA())));
    assert.equal(result.diagnostics.redundantArtifactCount, 1);
    assert.deepEqual(proposed(result, '0000'), artifact);
    assert.equal(typeof proposed(result, '0000').employment_history_canonical_survivor_id.toHexString, 'function');
});

test('frozen input is never mutated; output dates, arrays and BSON identities are independent', () => {
    const input = F.caseA();
    input.completeHistoryRows.forEach((row, index) => {
        row._id = new Types.ObjectId(`507f1f77bcf86cd7994390${String(index).padStart(2, '0')}`);
        row.hmeres_efarmoghs_egkekrimenhs_rythmishs = [1, 2];
        row.createdAt = new Date('2026-01-01T14:26:13.000Z');
        row.history_reference_fence = 7;
        Object.freeze(row.hmeres_efarmoghs_egkekrimenhs_rythmishs);
        Object.freeze(row);
    });
    Object.freeze(input.currentEmployee);
    Object.freeze(input.completeHistoryRows);
    Object.freeze(input);
    const before = JSON.stringify(input);
    const result = assertIdempotent(input);
    for (const row of result.proposedRows) {
        const original = input.completeHistoryRows.find(source => String(source._id) === String(row._id));
        for (const field of [...C.FIELD_GROUPS.IDENTITY_PROTECTED, ...C.FIELD_GROUPS.CANONICAL_METADATA]) {
            assert.deepEqual(row[field], original[field], field);
        }
        assert.equal(row._id instanceof Types.ObjectId, true);
        assert.notEqual(row._id, original._id);
        row.createdAt.setUTCFullYear(2030);
        row.hmeres_efarmoghs_egkekrimenhs_rythmishs.push(3);
    }
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(plan(input), plan(input));
});

test('fingerprint detects semantic evidence/identity changes and ignores unrelated PII/fences', () => {
    const input = F.caseA();
    const before = plan(input).semanticFingerprint;
    for (const field of [C.HIRE, C.CHANGE, C.START, C.END, C.CONTRACT_END, C.DEPARTURE,
        'ores_ergasias_ebdomadas', 'krathsh_01', '_id', 'employment_history_canonical_status']) {
        const modified = F.caseA();
        modified.completeHistoryRows[0][field] = field === 'ores_ergasias_ebdomadas' ? 35 : 'different';
        assert.notEqual(plan(modified).semanticFingerprint, before, field);
    }
    const modified = F.caseA();
    modified.currentEmployee.ores_ergasias_ebdomadas = 35;
    assert.notEqual(plan(modified).semanticFingerprint, before);
    Object.assign(input.currentEmployee, { onoma: 'sensitive-name', afm: 'sensitive-tax', amka: 'sensitive-social' });
    input.completeHistoryRows[0].history_reference_fence = 100;
    input.completeHistoryRows[0].__v = 100;
    assert.equal(plan(input).semanticFingerprint, before);
    const bson = F.caseA();
    bson.completeHistoryRows[0]._id = new Types.ObjectId('507f1f77bcf86cd799439011');
    const token = plan(bson).semanticFingerprint;
    bson.completeHistoryRows[0]._id = new Types.ObjectId('507f1f77bcf86cd799439011');
    assert.equal(plan(bson).semanticFingerprint, token);
    bson.completeHistoryRows[0]._id = new Types.ObjectId('507f1f77bcf86cd799439012');
    assert.notEqual(plan(bson).semanticFingerprint, token);
});

test('every changed field has before/after, source, native identity and confidence', () => {
    const input = F.caseB();
    const result = plan(input);
    for (const change of result.rowDiffs) {
        for (const key of ['historyId', 'field', 'before', 'after', 'sourceType', 'sourceHistoryId', 'sourceField', 'confidence']) {
            assert.ok(Object.hasOwn(change, key), key);
        }
        assert.ok(!['IDENTITY_PROTECTED', 'INFORMATIONAL', 'CANONICAL_METADATA', 'INTERNAL_MONGOOSE']
            .includes(C.FIELD_CLASSIFICATION[change.field]));
        const original = input.completeHistoryRows.find(row => row._id === change.historyId);
        assert.deepEqual(change.before, original[change.field] === undefined ? null : original[change.field]);
        assert.equal(change.beforeMissing, original[change.field] === undefined);
        assert.deepEqual(change.after, result.proposedRows.find(row => row._id === change.historyId)[change.field]);
    }
});

test('read-only summary is an allowlist with no PII, values, row ids or scope', () => {
    const input = F.caseA();
    input.currentEmployee.onoma = 'DO_NOT_LOG_NAME';
    input.currentEmployee.afm = 'DO_NOT_LOG_TAX';
    input.completeHistoryRows[0].symbash = 'DO_NOT_LOG_PROFILE';
    const result = plan(input);
    const safe = summary(result);
    assert.equal(safe.proposedFieldChangeCount, result.rowDiffs.length);
    assert.equal(safe.assumptionsCount, result.assumptions.length);
    assert.doesNotMatch(JSON.stringify(safe), /DO_NOT_LOG|synthetic-|company_kod|sourceHistoryId/);
});

test('planner module executes with only its pure contract/date/crypto imports, no DB/network/UI dependencies', () => {
    const source = readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
    const loaded = [];
    const context = { module: { exports: {} }, Buffer, require(name) {
        loaded.push(name);
        assert.ok(['node:crypto', './employeeHistoryAutomaticReconstructionContract',
            '../../utils/ergazomenoi/employmentProfileContract'].includes(name), name);
        return require(name);
    } };
    vm.runInNewContext(source, context);
    const result = context.module.exports.planEmployeeHistoryAutomaticReconstruction(F.caseA());
    assert.equal(result.logicalPeriods.length, 2);
    assert.equal(loaded.length, 3);
    assert.doesNotMatch(source, /\.(findOne|updateOne|updateMany|bulkWrite|save|deleteOne|insertMany)\s*\(/);
});

test('genuine hire beats a later legacy start; invalid dates never become boundaries', () => {
    const stronger = assertIdempotent(fixture([profile('0001', '2026-04-25', { afora_proslhpsh: true })]));
    assert.equal(stronger.logicalPeriods[0].from, '2026-04-23');
    assert.equal(diff(stronger, '0001', C.START).sourceType, 'DETERMINISTIC_HIRE_BOUNDARY');
    assert.ok(stronger.assumptions.some(item => item.code === 'EXISTING_INITIAL_START_AFTER_HIRE'));
    const invalid = assertIdempotent(fixture([profile('0001', '2026-02-30', {
        afora_proslhpsh: true, [C.CONTRACT_END]: 'not-a-date'
    })]));
    assert.equal(invalid.logicalPeriods[0].from, '2026-04-23');
    assert.ok(invalid.warnings.some(item => item.code === 'INVALID_TEMPORAL_DATE'));
});

test('missing intermediate start can be derived from surrounding real period boundaries', () => {
    const result = assertIdempotent(fixture([
        profile('0003', '2026-04-23', { [C.END]: '2026-04-30' }),
        F.row('0002', { [C.END]: '2026-05-31' }),
        profile('0001', '2026-06-01')
    ]));
    assert.deepEqual(timeline(result), [
        ['2026-04-23', '2026-04-30'], ['2026-05-01', '2026-05-31'], ['2026-06-01', null]
    ]);
    assert.equal(diff(result, '0002', C.START).sourceType, 'DETERMINISTIC_CONTINUATION_BOUNDARY');
    assert.deepEqual(diff(result, '0002', C.START).sourceHistoryIds, ['synthetic-0003', 'synthetic-0001']);
});

test('undated rows prefer a deterministic reviewable compatible placement even with multiple candidates', () => {
    const result = assertIdempotent(fixture([profile('0001', '2026-04-23'), F.row('0002')]));
    assert.equal(result.logicalPeriods.length, 1);
    assert.ok(result.assumptions.some(item => item.code === 'UNDATED_ROW_ATTACHED_TO_UNIQUE_COMPATIBLE_PERIOD'));
    const ambiguous = assertIdempotent(fixture([profile('0001', '2026-04-23'), F.row('0002'), profile('0003', '2026-05-01')]));
    assert.equal(ambiguous.status, 'REVIEW_REQUIRED');
    assert.equal(diff(ambiguous, '0002', C.START).confidence, 'ASSUMED');
    assert.equal(diff(ambiguous, '0002', C.START).sourceType, 'APPLICATION_ASSUMPTION');
    assert.equal(ambiguous.logicalPeriods[0].sourceHistoryIds.length, 2);
});

test('late current-only evidence does not cause second-pass reconstruction drift', () => {
    assertIdempotent(fixture([profile('0001', '2026-04-23'), profile('0002', '2026-05-01')], {
        [C.START]: '2026-05-01', ...F.workTerms
    }));
});

test('historical evidence propagates before a premature current fallback can mask it', () => {
    const result = assertIdempotent(fixture([
        profile('0001', '2026-04-23'),
        profile('0002', '2026-05-01'),
        profile('0003', '2026-06-01', { ores_ergasias_ebdomadas: 40 })
    ], { ores_ergasias_ebdomadas: 35 }));
    assert.equal(proposed(result, '0002').ores_ergasias_ebdomadas, 40);
    assert.equal(proposed(result, '0001').ores_ergasias_ebdomadas, 40);
    assert.equal(diff(result, '0001', 'ores_ergasias_ebdomadas').originSourceType, 'EXISTING');
});

test('fixed-point compatibility never borrows a missing discriminator from a conflicting work profile', () => {
    const result = assertIdempotent(fixture([
        profile('0001', '2026-05-01', { ores_ergasias_ebdomadas: 35, mo_oron_hmerhsias_ergasias: 7 }),
        profile('0002', '2026-05-02', { ores_ergasias_ebdomadas: 35, krathsh_01: '0111' }),
        profile('0003', '2026-05-03', { krathsh_01: '0111' }),
        profile('0004', '2026-05-04', { symbash: 'A', ores_ergasias_ebdomadas: 40,
            hmeres_ergasias_ebdomadas: 6, mo_oron_hmerhsias_ergasias: 7 })
    ]));
    assert.equal(proposed(result, '0001').hmeres_ergasias_ebdomadas, 0);
    assert.equal(proposed(result, '0003').hmeres_ergasias_ebdomadas, 0);
    assert.equal(Object.hasOwn(proposed(result, '0001'), 'symbash'), false);
});

test('1000 seeded synthetic sparse-state reconstructions are fixed points, with and without current evidence', () => {
    let seed = 123456;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let attempt = 0; attempt < 1000; attempt += 1) {
        const input = fixture([]);
        for (let index = 0; index < 4; index += 1) {
            const row = profile(String(index), `2026-05-0${index + 1}`);
            for (const [field, values] of Object.entries({ symbash: ['A', 'B'],
                ores_ergasias_ebdomadas: [35, 40], hmeres_ergasias_ebdomadas: [5, 6],
                mo_oron_hmerhsias_ergasias: [7, 8], krathsh_01: ['0111', '0115'] })) {
                if (random() < 0.4) row[field] = values[Math.floor(random() * values.length)];
            }
            input.completeHistoryRows.push(row);
        }
        if (attempt % 2) Object.assign(input.currentEmployee, F.workTerms);
        assertIdempotent(input);
    }
});

test('events after departure and unterminated cycles produce explicit reviewable non-overlapping proposals', () => {
    for (const input of [
        fixture([profile('0001', '2026-04-23', { [C.DEPARTURE]: '2026-05-01' }), profile('0002', '2026-06-01')]),
        fixture([profile('0001', '2026-04-23'), profile('0002', '2026-06-01', { [C.HIRE]: '2026-06-01' })])
    ]) {
        const result = assertIdempotent(input);
        assert.equal(result.status, 'REVIEW_REQUIRED');
        assert.equal(result.logicalPeriods.length, 2);
        assert.ok(result.logicalPeriods[0].to < result.logicalPeriods[1].from);
        assert.ok(result.assumptions.some(item => ['PROFILE_EVENT_AFTER_DEPARTURE',
            'CYCLE_TERMINATION_ASSUMED_BEFORE_REHIRE'].includes(item.code)));
    }
});

test('coupled inconsistent work/break facts are preserved and warned, never silently normalized', () => {
    const result = assertIdempotent(fixture([profile('0001', '2026-04-23', {
        ...F.workTerms, mo_oron_hmerhsias_ergasias: 7, dialleima_apo_ora_01: '12:00'
    })]));
    assert.equal(proposed(result, '0001').mo_oron_hmerhsias_ergasias, 7);
    assert.equal(proposed(result, '0001').dialleima_apo_ora_01, '12:00');
    assert.ok(result.warnings.some(item => item.code === 'INCONSISTENT_RECONSTRUCTED_WORK_TERMS'));
    assert.ok(result.warnings.some(item => item.code === 'INCONSISTENT_RECONSTRUCTED_PROFILE'));
});

test('a plain object cannot masquerade as a BSON identity', () => {
    const input = F.caseA();
    input.completeHistoryRows[0]._id = { buffer: new Uint8Array(12) };
    assert.equal(plan(input).status, 'BLOCKED');
});

test('technical corruption and a wholly absent temporal baseline block without proposals', () => {
    for (const mutate of [
        input => { input.completeHistoryRows[0].team = 'different'; },
        input => { input.completeHistoryRows[1]._id = input.completeHistoryRows[0]._id; },
        input => { delete input.currentEmployee[C.HIRE]; input.completeHistoryRows.forEach(row => {
            for (const field of [C.HIRE, C.START, C.CHANGE]) delete row[field];
        }); },
        input => { input.completeHistoryRows[0].employment_history_canonical_status = 'UNKNOWN'; }
    ]) {
        const input = F.caseA();
        mutate(input);
        const before = structuredClone(input);
        const result = plan(input);
        assert.equal(result.status, 'BLOCKED');
        assert.deepEqual(result.rowDiffs, []);
        assert.deepEqual(result.logicalPeriods, []);
        assert.deepEqual(input, before);
    }
    assert.equal(plan().status, 'BLOCKED');
    assert.equal(plan(fixture([])).status, 'NO_HISTORY');
    assert.equal(plan({ ...fixture([]), completeHistoryRows: null }).status, 'BLOCKED');
    const tooMany = fixture(Array.from({ length: MAX_HISTORY_ROWS + 1 }, (_, index) => profile(String(index), '2026-04-23')));
    assert.equal(plan(tooMany).status, 'BLOCKED');
});

for (const [type, field] of Object.entries({ String: 'symbash', Boolean: 'synexes_diakekomeno',
    Array: 'hmeres_efarmoghs_egkekrimenhs_rythmishs', Date: 'hmnia_enarxhs_egkekrimenhs_rythmishs' })) {
    test(`absent ${type} has no artificial physical default or rowDiff`, () => {
        const result = assertIdempotent(fixture([profile('0001', '2026-04-23')]));
        assert.equal(Object.hasOwn(proposed(result, '0001'), field), false);
        assert.equal(diff(result, '0001', field), undefined);
        assert.equal(C.FIELD_CLASSIFICATION[field], 'RECONSTRUCTABLE_PROFILE');
    });
}

test('numeric missing/null/empty uses zero only after previous, next and applicable current evidence', () => {
    for (const empty of [undefined, null, '']) {
        for (const [previous, next, current, expected, source] of [
            [1100, 1200, 1300, 1100, 'PREVIOUS_PERIOD'],
            [undefined, 1200, 1300, 1200, 'NEXT_PERIOD'],
            [undefined, undefined, 1300, 1300, 'CURRENT_EMPLOYEE'],
            [undefined, undefined, undefined, 0, 'DEFAULT_VALUE']
        ]) {
            const rows = [profile('0002', '2026-05-01', { pragmatikosMisthos: empty })];
            if (previous !== undefined) rows.push(profile('0001', '2026-04-23', { pragmatikosMisthos: previous }));
            if (next !== undefined) rows.push(profile('0003', '2026-06-01', { pragmatikosMisthos: next }));
            const result = assertIdempotent(fixture(rows, { pragmatikosMisthos: current }));
            assert.equal(proposed(result, '0002').pragmatikosMisthos, expected);
            assert.equal(diff(result, '0002', 'pragmatikosMisthos').sourceType, source);
        }
    }
    const existing = assertIdempotent(fixture([
        profile('0001', '2026-04-23', { pragmatikosMisthos: 0 }),
        profile('0002', '2026-05-01', { pragmatikosMisthos: 1200 })
    ]));
    assert.equal(proposed(existing, '0001').pragmatikosMisthos, 0, 'a usable noncritical zero is an existing fact');
});

test('optional null/empty values remain physically unchanged without evidence', () => {
    const input = profile('0001', '2026-04-23', { symbash: '', synexes_diakekomeno: null,
        hmnia_enarxhs_egkekrimenhs_rythmishs: null, hmeres_efarmoghs_egkekrimenhs_rythmishs: null });
    const result = assertIdempotent(fixture([input]));
    for (const field of C.PROFILE_FIELDS.filter(field => C.PROFILE_FIELD_TYPES[field] !== 'Number')) {
        assert.deepEqual(proposed(result, '0001')[field], input[field], field);
        assert.equal(diff(result, '0001', field), undefined, field);
    }
});

test('compatible evidence still reconstructs optional String, Boolean, Array and meaningful Date facts', () => {
    const facts = { krathsh_01: '0111', synexes_diakekomeno: false,
        hmeres_efarmoghs_egkekrimenhs_rythmishs: [1, 3],
        hmeromhnia_isxyos_dialleimatos_apo: '2026-04-23' };
    const result = assertIdempotent(fixture([
        profile('0001', '2026-04-23', facts), profile('0002', '2026-05-01')
    ]));
    for (const [field, value] of Object.entries(facts)) {
        assert.deepEqual(proposed(result, '0002')[field], value);
        assert.equal(diff(result, '0002', field).sourceType, 'PREVIOUS_PERIOD');
    }
});

test('exact cases retain 118/118 coverage while default proposal noise drops by more than half', () => {
    assert.equal(Object.keys(C.FIELD_CLASSIFICATION).length, 118);
    for (const [factory, before, after] of [[F.caseA, 180, 86], [F.caseB, 270, 129]]) {
        const result = assertIdempotent(factory());
        const defaults = result.rowDiffs.filter(item => item.sourceType === 'DEFAULT_VALUE');
        assert.equal(defaults.length, after);
        assert.ok(defaults.length < before / 2);
        assert.ok(defaults.every(item => C.PROFILE_FIELD_TYPES[item.field] === 'Number' && item.after === 0));
    }
});

test('24 April genuine hire corrects a 25 May legacy FROM with deterministic hire provenance', () => {
    const input = F.caseA();
    input.completeHistoryRows[0][C.START] = '2026-05-25';
    const result = assertIdempotent(input);
    assert.deepEqual(timeline(result), [['2026-04-24', '2026-05-24'], ['2026-05-25', '2026-10-05']]);
    const change = diff(result, '0001', C.START);
    assert.equal(change.before, '2026-05-25');
    assert.equal(change.after.toISOString().slice(0, 10), '2026-04-24');
    assert.equal(change.sourceType, 'DETERMINISTIC_HIRE_BOUNDARY');
    assert.equal(result.status, 'REVIEW_REQUIRED');
});

test('a separate real contract change distinguishes a legacy flagged row from the initial hire event', () => {
    const result = assertIdempotent(fixture([
        profile('0001', '2026-04-23', { afora_proslhpsh: true }),
        profile('0002', '2026-05-25', { afora_proslhpsh: true, [C.CHANGE]: '2026-05-25' })
    ]));
    assert.deepEqual(timeline(result), [['2026-04-23', '2026-05-24'], ['2026-05-25', null]]);
});

test('same-period source selection follows explicit start, lifecycle, completeness, then identity', () => {
    for (const [name, left, right, expected, tie] of [
        ['explicit start', { [C.START]: undefined, afora_proslhpsh: true, ...F.workTerms }, {}, '0002', false],
        ['lifecycle', {}, { afora_proslhpsh: true }, '0002', false],
        ['completeness', {}, { pragmatikosMisthos: 1200 }, '0002', false],
        ['identity', {}, {}, '0001', true]
    ]) {
        const input = fixture([
            profile('0001', '2026-04-23', { krathsh_01: '0111', ...left }),
            profile('0002', '2026-04-23', { krathsh_01: '0115', ...right })
        ]);
        const result = assertIdempotent(input);
        const value = expected === '0001' ? '0111' : '0115';
        assert.ok(result.proposedRows.every(row => row.krathsh_01 === value), name);
        const conflict = result.assumptions.find(item => item.code === 'SAME_DATE_NON_EMPTY_CONFLICT' && item.field === 'krathsh_01');
        assert.equal(conflict.selectedSourceHistoryId, `synthetic-${expected}`, name);
        assert.equal(conflict.sourceType, 'APPLICATION_ASSUMPTION');
        assert.equal(conflict.confidence, 'ASSUMED');
        assert.equal(conflict.selectionRule === 'STABLE_PHYSICAL_IDENTITY_TIE_BREAK', tie, name);
        assert.deepEqual(conflict.sourceValues.map(item => item.value).sort(), ['0111', '0115']);
        assert.deepEqual(plan({ ...input, completeHistoryRows: [...input.completeHistoryRows].reverse() }), result);
        const renumbered = structuredClone(input);
        renumbered.completeHistoryRows.forEach((row, index) => { row.aa_eggrafhs = String(999 - index); });
        const changed = plan(renumbered);
        assert.equal(changed.semanticFingerprint, result.semanticFingerprint);
        assert.deepEqual(changed.rowDiffs, result.rowDiffs);
    }
});

test('enriched Case B coalesces complementary facts and resolves conflicting KPK while preserving BEFORE', () => {
    const result = assertIdempotent(F.caseBWithProfileEvidence());
    assert.deepEqual(timeline(result), [['2026-04-23', '2026-05-16'], ['2026-05-17', '2026-10-15']]);
    for (const identity of ['0001', '0002']) {
        assert.equal(proposed(result, identity).krathsh_01, '0115', 'lifecycle then profile completeness wins');
        assert.equal(proposed(result, identity).symbash, 'SYNTHETIC_CONTRACT');
        assert.equal(proposed(result, identity).pragmatikosMisthos, 1200);
    }
    assert.equal(diff(result, '0001', 'krathsh_01').before, '0111');
    assert.equal(diff(result, '0001', 'krathsh_01').sourceType, 'APPLICATION_ASSUMPTION');
});

test('resolved same-period conflicts donate assumed facts before defaults so a second run cannot discover them', () => {
    const result = assertIdempotent(fixture([
        profile('0001', '2026-04-23', { krathsh_01: '0111' }),
        profile('0002', '2026-04-23', { krathsh_01: '0115' }), profile('0003', '2026-05-01')
    ]));
    assert.equal(proposed(result, '0003').krathsh_01, '0111');
    assert.equal(diff(result, '0003', 'krathsh_01').confidence, 'ASSUMED');
    assert.equal(diff(result, '0003', 'krathsh_01').originSourceType, 'APPLICATION_ASSUMPTION');
});

for (const [field, before, after] of [
    ['krathsh_01', '0111', '0115'], ['symbash', 'A', 'B'], ['kathestos_apasxolhshs', 'A', 'B'],
    ['hmeres_ergasias_ebdomadas', 5, 6], ['ores_ergasias_ebdomadas', 35, 40],
    ['mo_oron_hmerhsias_ergasias', 7, 8], ['pragmatikosMisthos', 1000, 1200],
    ['synexes_diakekomeno', false, true], ['hmeres_efarmoghs_egkekrimenhs_rythmishs', [1], [2]]
]) {
    test(`different-period non-empty ${field} facts remain distinct`, () => {
        const result = assertIdempotent(fixture([
            profile('0001', '2026-04-23', { [field]: before }), profile('0002', '2026-05-01', { [field]: after })
        ]));
        assert.deepEqual(proposed(result, '0001')[field], before);
        assert.deepEqual(proposed(result, '0002')[field], after);
        assert.ok(!result.rowDiffs.some(item => item.field === field));
    });
}

test('ordinary missing cycle and period anchors produce explicit application proposals', () => {
    for (const rows of [
        [F.row('0001')],
        [profile('0001', '2026-04-23', { symbash: 'A' }), F.row('0002', { symbash: 'B' })],
        [profile('0001', '2026-04-23'), F.row('0002'), profile('0003', '2026-06-01', { [C.HIRE]: '2026-06-01' })]
    ]) {
        const input = fixture(rows);
        const result = assertIdempotent(input);
        assert.equal(result.status, 'REVIEW_REQUIRED');
        assert.ok(result.assumptions.some(item => item.sourceType === 'APPLICATION_ASSUMPTION' && item.confidence === 'ASSUMED'));
        assert.deepEqual(plan({ ...input, completeHistoryRows: [...rows].reverse() }), result);
    }
});

test('missing hire can be assumed from actual profile events, never schedule dates', () => {
    const input = fixture([F.row('0001', { [C.START]: '2026-04-23' })], { [C.HIRE]: undefined });
    const result = assertIdempotent(input);
    assert.equal(result.status, 'REVIEW_REQUIRED');
    assert.equal(result.logicalPeriods[0].hireDate, '2026-04-23');
    assert.equal(diff(result, '0001', C.HIRE).sourceType, 'APPLICATION_ASSUMPTION');
    const absent = plan(fixture([F.row('0001')], { [C.HIRE]: undefined }));
    assert.equal(absent.status, 'BLOCKED');
    assert.equal(absent.warnings[0].code, 'NO_TEMPORAL_BASELINE');
    assert.equal(absent.warnings[0].classification, 'ORDINARY_LEGACY_AMBIGUITY');
});

test('competing real start boundaries are reviewable and select explicit FROM deterministically', () => {
    const result = assertIdempotent(fixture([profile('0001', '2026-05-02', { [C.CHANGE]: '2026-05-01' })]));
    assert.equal(result.status, 'REVIEW_REQUIRED');
    assert.equal(result.logicalPeriods[0].from, '2026-05-02');
    assert.equal(result.logicalPeriods[0].startProvenance[0].sourceType, 'APPLICATION_ASSUMPTION');
    assert.ok(result.assumptions.some(item => item.code === 'COMPETING_PROFILE_START_BOUNDARIES'));
});

test('impossible reference states are technical corruption and produce no proposal', () => {
    for (const reference of [{ buffer: new Uint8Array(12) }, 'synthetic-0001']) {
        const input = F.caseA();
        input.completeHistoryRows[0].employment_history_canonical_survivor_id = reference;
        const result = plan(input);
        assert.equal(result.status, 'BLOCKED');
        assert.equal(result.warnings.at(-1).classification, 'TECHNICAL_CORRUPTION');
        assert.equal(result.rowDiffs.length, 0);
        assert.deepEqual(result.proposedRows, input.completeHistoryRows);
    }
});

test('all blocking paths have an explicit reviewed classification', () => {
    const source = readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
    const codes = [...source.matchAll(/return blocked\('([^']+)'\)/g)].map(match => match[1]);
    assert.deepEqual(codes.sort(), Object.keys(C.BLOCKED_REASON_CLASSIFICATION).sort());
});

test('fingerprint includes every source-selection quality input and all actual semantic profile facts', () => {
    const input = fixture([
        profile('0001', '2026-04-23', { krathsh_01: '0111' }),
        profile('0002', '2026-04-23', { krathsh_01: '0115' })
    ]);
    const fingerprint = plan(input).semanticFingerprint;
    for (const [field, value] of [[C.START, undefined], ['afora_proslhpsh', true],
        [C.CHANGE, '2026-04-23'], ['symbash', 'A'], ['pragmatikosMisthos', 1200], ['_id', 'synthetic-other']]) {
        const modified = structuredClone(input);
        modified.completeHistoryRows[1][field] = value;
        assert.notEqual(plan(modified).semanticFingerprint, fingerprint, field);
    }
});

test('same-period BSON conflict provenance and BEFORE identities retain native ObjectId values', () => {
    const input = fixture([
        profile('0001', '2026-04-23', { krathsh_01: '0111' }),
        profile('0002', '2026-04-23', { krathsh_01: '0115' })
    ]);
    input.completeHistoryRows.forEach((row, index) => { row._id = new Types.ObjectId(`507f1f77bcf86cd7994390${index}1`); });
    const result = assertIdempotent(input);
    const change = result.rowDiffs.find(item => item.field === 'krathsh_01');
    assert.equal(change.before, '0115');
    assert.ok(change.historyId instanceof Types.ObjectId);
    assert.ok(change.sourceHistoryId instanceof Types.ObjectId);
    const conflict = result.assumptions.find(item => item.code === 'SAME_DATE_NON_EMPTY_CONFLICT');
    assert.ok(conflict.sourceValues.every(item => item.historyId instanceof Types.ObjectId));
});

test('500 seeded coalesced sparse/conflicting legacy reconstructions are permutation-independent fixed points', () => {
    let seed = 304;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let attempt = 0; attempt < 500; attempt += 1) {
        const rows = Array.from({ length: 5 }, (_, index) => profile(String(index), index < 3 ? '2026-04-23' : '2026-05-01'));
        for (const row of rows) for (const [field, values] of Object.entries({
            symbash: ['A', 'B'], ores_ergasias_ebdomadas: [35, 40], krathsh_01: ['0111', '0115'],
            pragmatikosMisthos: [1000, 1200], synexes_diakekomeno: [false, true]
        })) if (random() < 0.4) row[field] = values[Math.floor(random() * values.length)];
        const input = fixture(rows, attempt % 2 ? F.workTerms : {});
        const result = assertIdempotent(input);
        assert.deepEqual(plan({ ...input, completeHistoryRows: [...rows].reverse() }), result);
    }
});

for (const [field, before, after] of [
    ['symbash', 'A', 'B'], ['ores_ergasias_ebdomadas', 35, 40], ['synexes_diakekomeno', false, true],
    ['hmeres_efarmoghs_egkekrimenhs_rythmishs', [1], [2]],
    ['hmeromhnia_isxyos_dialleimatos_apo', '2026-04-23', '2026-04-24']
]) {
    test(`same-period conflicting ${field} facts yield one proposed value with review evidence`, () => {
        const result = assertIdempotent(fixture([
            profile('0001', '2026-04-23', { [field]: before }),
            profile('0002', '2026-04-23', { [field]: after })
        ]));
        assert.deepEqual(proposed(result, '0001')[field], before);
        assert.deepEqual(proposed(result, '0002')[field], before);
        assert.deepEqual(diff(result, '0002', field).before, after);
        assert.equal(diff(result, '0002', field).sourceType, 'APPLICATION_ASSUMPTION');
        assert.equal(diff(result, '0002', field).confidence, 'ASSUMED');
    });
}

test('equivalent BSON and date-only profile dates do not create semantic conflicts or physical proposals', () => {
    const field = 'hmeromhnia_isxyos_dialleimatos_apo';
    const input = fixture([
        profile('0001', '2026-04-23', { [field]: '2026-04-23' }),
        profile('0002', '2026-04-23', { [field]: new Date('2026-04-23T00:00:00Z') })
    ]);
    const result = assertIdempotent(input);
    assert.ok(!result.rowDiffs.some(item => item.field === field));
    assert.ok(!result.assumptions.some(item => item.code === 'SAME_DATE_NON_EMPTY_CONFLICT' && item.field === field));
    assert.ok(proposed(result, '0002')[field] instanceof Date);
});

test('all six enriched Case B input permutations select identical conflict values and provenance', () => {
    const input = F.caseBWithProfileEvidence();
    const expected = plan(input);
    for (const indices of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
        assert.deepEqual(plan({ ...input, completeHistoryRows: indices.map(index => input.completeHistoryRows[index]) }), expected);
    }
});

test('an end reconstructed despite an earlier departure exposes assumed confidence in the rowDiff', () => {
    const result = assertIdempotent(fixture([
        profile('0001', '2026-04-23', { [C.DEPARTURE]: '2026-05-01' }),
        profile('0002', '2026-06-01', { [C.END]: '2026-06-30' })
    ]));
    assert.equal(diff(result, '0002', C.END).sourceType, 'APPLICATION_ASSUMPTION');
    assert.equal(diff(result, '0002', C.END).confidence, 'ASSUMED');
});

test('corrupt BSON identities and references block without throwing or mutating the opaque input', () => {
    const corrupt = { _bsontype: 'ObjectId', toHexString() { throw new TypeError('corrupt BSON buffer'); } };
    for (const field of ['_id', 'employment_history_canonical_survivor_id', 'currentEmployee._id']) {
        const input = F.caseA();
        if (field === 'currentEmployee._id') input.currentEmployee._id = corrupt;
        else input.completeHistoryRows[0][field] = corrupt;
        const result = plan(input);
        assert.equal(result.status, 'BLOCKED');
        assert.equal(result.rowDiffs.length, 0);
        assert.deepEqual(result.proposedRows, input.completeHistoryRows);
        assert.equal(result.warnings.at(-1).classification, 'TECHNICAL_CORRUPTION');
    }
});
