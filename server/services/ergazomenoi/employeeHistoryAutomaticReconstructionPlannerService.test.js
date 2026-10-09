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

test('safe defaults cover all five schema types, with zero only after all evidence is absent', () => {
    const result = assertIdempotent(fixture([profile('0001', '2026-04-23')]));
    const after = proposed(result, '0001');
    assert.equal(after.ores_ergasias_ebdomadas, 0);
    assert.equal(after.symbash, '');
    assert.equal(after.synexes_diakekomeno, false);
    assert.deepEqual(after.hmeres_efarmoghs_egkekrimenhs_rythmishs, []);
    assert.equal(after.hmnia_enarxhs_egkekrimenhs_rythmishs, null);
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

test('same-date incompatible non-empty KPK values remain physical and are explicitly classified', () => {
    const result = assertIdempotent(fixture([
        profile('0002', '2026-04-23', { krathsh_01: '0115' }),
        profile('0001', '2026-04-23', { krathsh_01: '0111' }),
        profile('0003', '2026-04-23')
    ]));
    assert.equal(result.logicalPeriods.length, 1);
    assert.equal(proposed(result, '0001').krathsh_01, '0111');
    assert.equal(proposed(result, '0002').krathsh_01, '0115');
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
    for (const factory of [F.caseA, F.caseB]) {
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

test('valid explicit start beats hire; invalid dates never throw and cannot become boundaries', () => {
    const stronger = assertIdempotent(fixture([profile('0001', '2026-04-25', { afora_proslhpsh: true })]));
    assert.equal(stronger.logicalPeriods[0].from, '2026-04-25');
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

test('undated rows only attach to a unique compatible state, with an explicit assumption', () => {
    const result = assertIdempotent(fixture([profile('0001', '2026-04-23'), F.row('0002')]));
    assert.equal(result.logicalPeriods.length, 1);
    assert.ok(result.assumptions.some(item => item.code === 'UNDATED_ROW_ATTACHED_TO_UNIQUE_COMPATIBLE_PERIOD'));
    const ambiguous = plan(fixture([profile('0001', '2026-04-23'), F.row('0002'), profile('0003', '2026-05-01')]));
    assert.equal(ambiguous.status, 'BLOCKED');
    assert.equal(ambiguous.rowDiffs.length, 0);
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
    assert.equal(proposed(result, '0001').symbash, '');
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

test('events after departure and an unterminated cycle before rehire never yield an overlapping timeline', () => {
    for (const input of [
        fixture([profile('0001', '2026-04-23', { [C.DEPARTURE]: '2026-05-01' }), profile('0002', '2026-06-01')]),
        fixture([profile('0001', '2026-04-23'), profile('0002', '2026-06-01', { [C.HIRE]: '2026-06-01' })])
    ]) {
        const result = plan(input);
        assert.equal(result.status, 'BLOCKED');
        assert.deepEqual(result.logicalPeriods, []);
        assert.deepEqual(result.rowDiffs, []);
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

test('scope mismatch, duplicate identity, missing hire and unknown canonical status fail without proposals', () => {
    for (const mutate of [
        input => { input.completeHistoryRows[0].team = 'different'; },
        input => { input.completeHistoryRows[1]._id = input.completeHistoryRows[0]._id; },
        input => { delete input.currentEmployee[C.HIRE]; input.completeHistoryRows.forEach(row => { delete row[C.HIRE]; }); },
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
