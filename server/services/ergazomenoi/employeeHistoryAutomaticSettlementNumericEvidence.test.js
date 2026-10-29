'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const P = require('./employeeHistoryAutomaticReconstructionPlannerService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const { prepareEmployeeEmploymentHistorySettlement: prepare } = require('./employeeEmploymentProfileWriter');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const fields = ['evelikth_proselefsh', 'symbatikes_ores_ergasias'];

before(() => {
    const forbidden = () => assert.fail('Numeric evidence tests must never access MongoDB');
    for (const method of ['connect', 'createConnection', 'startSession']) mock.method(mongoose, method, forbidden);
    for (const method of ['openUri', 'startSession', 'transaction']) mock.method(mongoose.connection, method, forbidden);
    mock.method(mongoose.Model.prototype, 'save', forbidden);
    for (const method of ['find', 'findOne', 'findById', 'aggregate', 'create', 'updateOne',
        'updateMany', 'deleteOne', 'deleteMany', 'insertMany', 'bulkWrite']) mock.method(mongoose.Model, method, forbidden);
});
after(() => mock.restoreAll());

function base() {
    const row = { ...F.scope, _id: new mongoose.Types.ObjectId('600000000000000000000001'),
        aa_eggrafhs: '0001', afora_proslhpsh: true, hmeromhnia_proslhpshs: new Date('2026-01-01'),
        hmeromhnia_allaghs_symbashs: new Date('2026-01-01'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01'),
        hmeromhnia_isxyos_oron_ergasias_eos: null, ...F.workTerms,
        evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 };
    return { scope: { ...F.scope }, currentEmployee: { ...row,
        _id: new mongoose.Types.ObjectId('600000000000000000000006') }, completeHistoryRows: [row] };
}
function options(input, protectedRows = false) {
    return { ...input, employeeId: String(input.currentEmployee._id), actorUserId: '700000000000000000000001',
        protectedReferenceSummary: Object.fromEntries(input.completeHistoryRows.map((row, index) => [String(row._id),
            protectedRows && index < 2 ? [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
                documentId: `synthetic-${index}`, historyId: String(row._id),
                frozen_snapshot: { finalized: true, amount: 123.45 } }] : []])) };
}
const strict = input => P.planEmployeeHistoryAutomaticReconstruction({ ...input, requireRecordedNumericFacts: true });

for (const field of fields) for (const value of [undefined, null, '']) {
    test(`${field}: missing representation ${String(value)} remains unknown without numeric fabrication`, () => {
        const input = base();
        if (value === undefined) { delete input.currentEmployee[field]; delete input.completeHistoryRows[0][field]; }
        else { input.currentEmployee[field] = value; input.completeHistoryRows[0][field] = value; }
        const before = A.stringify(input), result = strict(input);
        assert.equal(result.proposedRows[0][field], value);
        assert.equal(Object.hasOwn(result.proposedRows[0], field), value !== undefined);
        assert.ok(!Object.hasOwn(result.logicalPeriods[0].profile, field));
        assert.equal(result.logicalPeriods[0].fieldProvenance[field].sourceType, 'UNRECORDED');
        assert.ok(result.logicalPeriods[0].fieldProvenance[field].businessRationale);
        assert.ok(!result.rowDiffs.some(diff => diff.field === field));
        const pending = P.planEmployeeHistoryAutomaticSettlement(options(input));
        if (field === 'evelikth_proselefsh') {
            assert.equal(pending.status, 'REVIEW_REQUIRED');
            assert.equal(pending.reason, 'NUMERIC_PROFILE_FACT_UNRECORDED');
            assert.deepEqual(pending.proposedRows, []);
            assert.deepEqual(pending.fieldChanges, []);
            assert.ok(pending.warnings.some(item => item.field === field && item.businessRationale));
        } else {
            assert.equal(pending.status, 'CLEAN');
            assert.equal(pending.proposedRows[0][field], value);
            assert.equal(Object.hasOwn(pending.proposedRows[0], field), value !== undefined);
            assert.ok(pending.unrecordedFacts.some(item => item.field === field && item.required === false));
            assert.ok(!pending.fieldChanges.some(item => Object.hasOwn(item.patch, field)));
        }
        assert.equal(A.stringify(input), before);
    });
}

for (const field of ['evelikth_proselefsh']) test(`${field}: explicitly recorded zero is preserved rather than replaced by current positive evidence`, () => {
    const input = base();
    input.completeHistoryRows[0][field] = 0;
    input.currentEmployee[field] = field === 'evelikth_proselefsh' ? 120 : 40;
    // A later observed current profile cannot rewrite the earlier historical fact.
    input.currentEmployee.hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-02-01');
    const result = strict(input);
    assert.equal(result.proposedRows[0][field], 0);
    assert.equal(result.logicalPeriods[0].fieldProvenance[field].sourceType, 'EXISTING');
    assert.ok(!result.rowDiffs.some(diff => diff.field === field));
});

test('explicit zero arrival tolerance remains CLEAN and is never manufactured by preparation', () => {
    const input = base();
    const data = options(input);
    data.proposal = P.planEmployeeHistoryAutomaticSettlement(data);
    assert.equal(data.proposal.status, 'CLEAN');
    assert.ok(data.proposal.proposedRows.every(row => row.evelikth_proselefsh === 0 && row.symbatikes_ores_ergasias === 40));
    const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint(data);
    const prepared = prepare({ ...data, approval: { confirmed: true, fingerprint } });
    assert.deepEqual(prepared.physicalPlan.rowsToInsert, []);
    assert.deepEqual(prepared.physicalPlan.rowsToDelete, []);
    assert.ok(prepared.physicalPlan.rowsToUpdate.every(update => fields.every(field => !Object.hasOwn(update.patch, field))));
});

test('zero contractual base stays unrecorded until compatible positive evidence exists', () => {
    const input = base();
    input.completeHistoryRows[0].symbatikes_ores_ergasias = 0;
    delete input.currentEmployee.symbatikes_ores_ergasias;
    const unresolved = strict(input);
    assert.equal(unresolved.proposedRows[0].symbatikes_ores_ergasias, 0);
    const optional = P.planEmployeeHistoryAutomaticSettlement(options(input));
    assert.equal(optional.status, 'CLEAN');
    assert.equal(optional.proposedRows[0].symbatikes_ores_ergasias, 0);
    assert.ok(optional.unrecordedFacts.some(item => item.field === 'symbatikes_ores_ergasias' && !item.required));
    input.currentEmployee.symbatikes_ores_ergasias = 40;
    const resolved = P.planEmployeeHistoryAutomaticSettlement(options(input));
    assert.equal(resolved.status, 'CLEAN', resolved.reason);
    assert.equal(resolved.proposedRows[0].symbatikes_ores_ergasias, 40);
    assert.ok(resolved.assumptions.some(item => item.code === 'LEGACY_ZERO_PLACEHOLDER_REPLACED' && item.businessRationale));
});

for (const field of fields) test(`${field}: applicable current evidence supplies only the missing historical value with recorded rationale`, () => {
    const input = base();
    input.currentEmployee[field] = field === 'evelikth_proselefsh' ? 120 : 40;
    delete input.completeHistoryRows[0][field];
    const result = strict(input);
    const diff = result.rowDiffs.find(item => item.field === field);
    assert.equal(diff.after, input.currentEmployee[field]);
    assert.equal(diff.sourceType, 'CURRENT_EMPLOYEE');
    assert.equal(diff.confidence, 'ASSUMED');
    const proposal = P.planEmployeeHistoryAutomaticSettlement(options(input));
    assert.equal(proposal.status, 'CLEAN', proposal.reason);
    assert.ok(proposal.assumptions.some(item => item.field === field && item.businessRationale));
});

test('compatible historical evidence supplies missing numbers without altering a genuine later change', () => {
    const input = base(), earlier = input.completeHistoryRows[0];
    const later = { ...earlier, _id: new mongoose.Types.ObjectId('600000000000000000000002'),
        aa_eggrafhs: '0002', afora_proslhpsh: false,
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-02-01'),
        hmeromhnia_allaghs_symbashs: new Date('2026-02-01'), evelikth_proselefsh: 60 };
    earlier.hmeromhnia_isxyos_oron_ergasias_eos = new Date('2026-01-31');
    delete earlier.symbatikes_ores_ergasias;
    input.completeHistoryRows.push(later);
    input.currentEmployee = { ...later, _id: input.currentEmployee._id };
    const result = strict(input);
    // The explicit flexibility conflict blocks borrowing the rest of that profile.
    assert.equal(result.proposedRows[0].symbatikes_ores_ergasias, undefined);
    assert.equal(result.proposedRows[0].evelikth_proselefsh, 0);
    assert.equal(result.proposedRows[1].evelikth_proselefsh, 60);
    later.evelikth_proselefsh = 0;
    input.currentEmployee.evelikth_proselefsh = 0;
    const compatible = strict(input);
    assert.equal(compatible.proposedRows[0].symbatikes_ores_ergasias, 40);
    assert.equal(compatible.rowDiffs.find(diff => diff.field === 'symbatikes_ores_ergasias').sourceType, 'NEXT_PERIOD');
});

test('full-time contractual base is independent of actual part-time weekly hours and schedule flags', () => {
    const input = base();
    Object.assign(input.completeHistoryRows[0], { ...F.workTerms, ores_ergasias_ebdomadas: 20,
        mo_oron_hmerhsias_ergasias: 4, typos_apasxolhshs: '1', typos_orarioy: false });
    input.currentEmployee = { ...input.completeHistoryRows[0], _id: input.currentEmployee._id };
    delete input.currentEmployee.symbatikes_ores_ergasias;
    delete input.completeHistoryRows[0].symbatikes_ores_ergasias;
    const result = strict(input);
    assert.equal(result.proposedRows[0].symbatikes_ores_ergasias, undefined);
    assert.equal(result.proposedRows[0].evelikth_proselefsh, 0);
    assert.ok(!result.rowDiffs.some(diff => diff.field === 'symbatikes_ores_ergasias'));
});

test('0006 stays pending: later 120/40 cannot certify earlier missing facts; old approval is unusable', () => {
    const input = F.real0006BoundaryStructure(), data = options(input, true), before = A.stringify(data);
    data.proposal = P.planEmployeeHistoryAutomaticSettlement(data);
    assert.equal(data.proposal.version, 'employee-history-automatic-settlement:memory:v3');
    assert.equal(data.proposal.status, 'REVIEW_REQUIRED');
    assert.equal(data.proposal.reason, 'NUMERIC_PROFILE_FACT_UNRECORDED');
    assert.deepEqual(data.proposal.warnings.map(item => item.field), ['evelikth_proselefsh']);
    assert.ok(data.proposal.unrecordedFacts.some(item => item.field === 'symbatikes_ores_ergasias' && !item.required));
    assert.deepEqual(data.proposal.proposedRows, []);
    assert.equal(strict(input).proposedRows.length, 3);
    assert.ok(strict(input).proposedRows.every(row => fields.every(field => !Object.hasOwn(row, field))));
    const oldFingerprint = 'FN_BbbYyrdutvqZRJmUDqKEfaeNVd2mxQh_LlPBlQUE';
    assert.throws(() => S.buildEmployeeHistorySettlementApprovalFingerprint(data),
        { code: S.PREFIX + 'CLEAN_PROPOSAL_REQUIRED' });
    assert.throws(() => prepare({ ...data, approval: { confirmed: true, fingerprint: oldFingerprint } }),
        { code: S.PREFIX + 'CLEAN_PROPOSAL_REQUIRED' });
    const { proposal, ...unchanged } = data;
    assert.equal(A.stringify(unchanged), before);
    assert.equal(mongoose.connection.readyState, 0);
});

test('independent final verification cannot turn missing numeric facts into CLEAN via normalizer defaults', () => {
    const input = base();
    for (const field of fields) delete input.completeHistoryRows[0][field];
    const result = P.verifyEmployeeHistoryAutomaticSettlement({ ...input, proposedRows: input.completeHistoryRows });
    assert.notEqual(result.status, 'CLEAN');
    assert.ok(result.issues.includes('NUMERIC_PROFILE_FACT_UNRECORDED'));
});

test('a previous proposal version cannot reuse approval even for a fully recorded CLEAN profile', () => {
    const data = options(base());
    data.proposal = P.planEmployeeHistoryAutomaticSettlement(data);
    assert.equal(data.proposal.status, 'CLEAN');
    const freshFingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint(data);
    for (const version of ['memory:v1', 'memory:v2']) {
        const legacyProposal = { ...data.proposal, version: 'employee-history-automatic-settlement:' + version };
        const oldFingerprint = A.hash({ version: S.PREPARATION_VERSION, actorUserId: data.actorUserId,
            employeeId: data.employeeId, scope: data.scope, currentEmployee: data.currentEmployee,
            historyBefore: A.ordered(data.completeHistoryRows),
            protectedReferenceSummary: data.protectedReferenceSummary, proposal: legacyProposal });
        assert.notEqual(freshFingerprint, oldFingerprint);
        assert.throws(() => prepare({ ...data, approval: { confirmed: true, fingerprint: oldFingerprint } }),
            { code: S.PREFIX + 'APPROVAL_REQUIRED' });
        assert.throws(() => prepare({ ...data, proposal: legacyProposal,
            approval: { confirmed: true, fingerprint: oldFingerprint } }),
        { code: S.PREFIX + 'CLEAN_PROPOSAL_REQUIRED' });
    }
});

test('invalid numeric values and same-period contrary facts are never silently corrected to zero', () => {
    for (const field of fields) for (const value of [-1, NaN, Infinity, '40']) {
        const input = base();
        input.completeHistoryRows[0][field] = value;
        delete input.currentEmployee[field];
        const result = strict(input);
        assert.ok(A.equal(result.proposedRows[0][field], value));
        assert.equal(P.planEmployeeHistoryAutomaticSettlement(options(input)).status, 'REVIEW_REQUIRED');
    }
    const input = base();
    input.completeHistoryRows.push({ ...input.completeHistoryRows[0],
        _id: new mongoose.Types.ObjectId('600000000000000000000002'), evelikth_proselefsh: 120 });
    const result = P.planEmployeeHistoryAutomaticSettlement(options(input));
    assert.equal(result.status, 'REVIEW_REQUIRED');
    assert.deepEqual(result.proposedRows, []);
});

test('legacy actual work terms resolve identically with or without a full-time contractual base', () => {
    const Terms = require('../../utils/ergazomenoi/getOrarioTermsForDate');
    const C = require('../../utils/ergazomenoi/employmentProfileContract');
    const input = base();
    const before = Terms.getOrarioTermsForDate('2026-01-15', input.completeHistoryRows, input.currentEmployee);
    delete input.currentEmployee.symbatikes_ores_ergasias;
    delete input.completeHistoryRows[0].symbatikes_ores_ergasias;
    const unrecorded = C.readEmploymentProfile(input.completeHistoryRows[0]);
    assert.equal(unrecorded.recorded, false);
    assert.ok(unrecorded.unrecordedFields.includes('symbatikes_ores_ergasias'));
    assert.deepEqual(Terms.getOrarioTermsForDate('2026-01-15', input.completeHistoryRows, input.currentEmployee), before);
    const data = options(input);
    data.proposal = P.planEmployeeHistoryAutomaticSettlement(data);
    assert.equal(data.proposal.status, 'CLEAN');
    assert.ok(!Object.hasOwn(data.proposal.proposedRows[0], 'symbatikes_ores_ergasias'));
    const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint(data);
    const prepared = prepare({ ...data, approval: { confirmed: true, fingerprint } });
    assert.ok(prepared.physicalPlan.finalRows.every(row => !Object.hasOwn(row, 'symbatikes_ores_ergasias')));
    assert.ok(prepared.physicalPlan.rowsToUpdate.every(item => !Object.hasOwn(item.patch, 'symbatikes_ores_ergasias')));
});

test('a versioned complete-profile contract still requires both numeric facts', () => {
    for (const field of fields) {
        const input = base();
        input.completeHistoryRows[0].employment_profile_schema_version = 1;
        delete input.completeHistoryRows[0][field];
        delete input.currentEmployee[field];
        const proposal = P.planEmployeeHistoryAutomaticSettlement(options(input));
        assert.equal(proposal.status, 'REVIEW_REQUIRED');
        assert.ok(proposal.unrecordedFacts.some(item => item.field === field && item.required &&
            item.reason === 'VERSIONED_PROFILE_REQUIRES_RECORDED_FACT'));
        const final = P.verifyEmployeeHistoryAutomaticSettlement({ ...input, proposedRows: input.completeHistoryRows });
        assert.notEqual(final.status, 'CLEAN');
        assert.ok(final.unrecordedFacts.some(item => item.field === field && item.required));
    }
});

test('current card switch and fixed/split flags cannot prove earlier non-applicability of arrival tolerance', () => {
    const Attendance = require('./apasxoliseisAttendanceDerivedScheduleService');
    const decision = minutes => Attendance.resolveApologistikoArrivalDecision({
        declaredStart: '12:00', actualArrival: '12:30', flexibleArrivalMinutes: minutes });
    assert.equal(decision(0).requiresBook, true);
    assert.equal(decision(120).requiresBook, false);
    for (const karta_ergasias of [false, true, undefined]) {
        const input = base();
        delete input.completeHistoryRows[0].evelikth_proselefsh;
        delete input.currentEmployee.evelikth_proselefsh;
        Object.assign(input.currentEmployee, { karta_ergasias, typos_orarioy: false, synexes_diakekomeno: false });
        const proposal = P.planEmployeeHistoryAutomaticSettlement(options(input));
        assert.equal(proposal.status, 'REVIEW_REQUIRED');
        assert.ok(proposal.unrecordedFacts.some(item => item.field === 'evelikth_proselefsh' && item.required &&
            item.reason === 'CARD_ARRIVAL_TOLERANCE_OR_APPLICABILITY_UNKNOWN'));
    }
});

test('0006 with recorded arrival tolerance can settle while the optional contractual base remains physically absent', () => {
    const input = F.real0006BoundaryStructure();
    for (const row of input.completeHistoryRows) row.evelikth_proselefsh = 0;
    const data = options(input, true), before = A.stringify(data);
    data.proposal = P.planEmployeeHistoryAutomaticSettlement(data);
    assert.equal(data.proposal.status, 'CLEAN', data.proposal.reason);
    assert.equal(data.proposal.proposedRows.length, 3);
    assert.equal(data.proposal.proposedActiveRows.length, 1);
    assert.ok(data.proposal.unrecordedFacts.every(item => item.field === 'symbatikes_ores_ergasias' && !item.required));
    const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint(data);
    const prepared = prepare({ ...data, approval: { confirmed: true, fingerprint } });
    assert.deepEqual(prepared.physicalPlan.rowsToInsert, []);
    assert.deepEqual(prepared.physicalPlan.rowsToDelete, []);
    for (const row of prepared.physicalPlan.finalRows) assert.ok(!Object.hasOwn(row, 'symbatikes_ores_ergasias'));
    for (const original of input.completeHistoryRows.slice(0, 2)) {
        const retained = prepared.physicalPlan.finalRows.find(row => String(row._id) === String(original._id));
        const { updatedAt, employment_history_canonical_status, employment_history_canonical_survivor_id, ...payload } = retained;
        const { updatedAt: previous, ...originalPayload } = original;
        assert.equal(employment_history_canonical_status, 'REDUNDANT_REFERENCED');
        assert.deepEqual(payload, originalPayload);
    }
    const next = { ...data, completeHistoryRows: prepared.physicalPlan.finalRows };
    next.proposal = P.planEmployeeHistoryAutomaticSettlement(next);
    assert.equal(next.proposal.status, 'CLEAN');
    assert.equal(next.proposal.noOp, true);
    const { proposal, ...unchanged } = data;
    assert.equal(A.stringify(unchanged), before);
});

test('reconstruction NO_OP cannot certify CLEAN while critical arrival evidence is still missing', () => {
    const input = base();
    delete input.currentEmployee.evelikth_proselefsh;
    delete input.completeHistoryRows[0].evelikth_proselefsh;
    input.completeHistoryRows = strict(input).proposedRows;
    const fixedPoint = strict(input);
    assert.equal(fixedPoint.rowDiffs.length, 0);
    assert.equal(A.isNoOp(fixedPoint), true);
    const proposal = P.planEmployeeHistoryAutomaticSettlement(options(input));
    assert.equal(proposal.status, 'REVIEW_REQUIRED');
    assert.equal(proposal.noOp, false);
    assert.deepEqual(proposal.proposedRows, []);
});
