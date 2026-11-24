'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../../test/fixtures/employeeHistoryResolvedProposal');
const { store } = require('../../../test/fixtures/employeeProfileTransactionStore');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const Row = require('./employeeHistoryRowApprovalService');
const W = require('./employeeEmploymentProfileWriter');
const Atomic = require('./employeeApprovedHistoryAtomicMaintenanceService');
const Validation = require('./employeeHistorySaveValidationService');
const Approval = require('./employeeHistoryMaintenanceApprovalService');
const SaveState = require('../../utils/ergazomenoi/employeeSaveState');
const { clone } = require('./employeeHistoryAutomaticSettlementPreparationContract');

const actorUserId = '630000000000000000000001';
const q = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
const auth = {
    actorUserId,
    userModel: { findById: () => q({ _id: actorUserId, team: 'THA', situation: 'A' }) },
    privilegeModel: { findOne: () => q({ privileges: { update: true } }) }
};

before(() => require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

async function setup({ independent = false, approveCurrent = false, alter = () => {} } = {}) {
    const input = F.resolvedProposalFixture({ independent });
    Object.assign(input.currentEmployee, { eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΛΕΓΧΟΣ', afm: '123456789',
        oristikh_enhmerosh: true, apasxolhsh_basei_symbashs: '5' });
    input.completeHistoryRows.forEach((row, index) => { row.history_reference_fence = index + 2; });
    // The approval deliberately retains missing specialty and hourly pay.
    F.approveSyntheticEdition(input);
    if (approveCurrent) {
        const order = input.completeHistoryRows;
        const current = order.at(-1);
        delete current.eidikothta_symbashs;
        input.completeHistoryRows = [current, ...order.slice(0, -1)];
        F.approveSyntheticEdition(input, {}, { n: 2, mode: 'APPROVAL_ONLY' });
        input.completeHistoryRows = order;
    }
    alter(input);
    const db = store([{ employee: input.currentEmployee, history: input.completeHistoryRows }], { cloneFn: clone });
    const matches = (audit, filter) => Object.entries(filter).every(([path, value]) =>
        path === '$or' ? value.some(branch => matches(audit, branch)) :
            String(path.split('.').reduce((part, key) => part?.[key], audit)) === String(value));
    let transformAuditRead = rows => rows;
    db.deps.auditModel.find = filter => ({
        sort() { return this; }, session(session) { this.s = session; return this; },
        async lean() { return transformAuditRead(clone(this.s.draft.audits.filter(audit => matches(audit, filter)))); }
    });
    const seed = await db.deps.connection.startSession();
    await seed.withTransaction(async () => {
        for (const audit of input.approvedHistoryDecisions) await db.deps.auditModel.create([audit], { session: seed });
    });
    await seed.endSession();
    db.events.length = 0;
    const req = { session: { userId: actorUserId, userTeam: input.scope.team, companyInUse: input.scope.company_kod },
        params: { id: String(input.currentEmployee._id) }, sessionID: 'synthetic-approved-maintenance-session' };
    const frozen = clone(input.protectedReferenceSummary);
    const service = Atomic.createApprovedHistoryAtomicMaintenanceService({ ...db.deps, ...auth,
        enabled: () => true, secret: 'synthetic-approved-maintenance-signing-key',
        auditReady: async () => true,
        referenceChecker: async ({ historyIds }) => clone(frozen[historyIds[0]] || []),
        periodProtection: async () => ({ uncertain: false, controls: [], snapshots: [], wire: [] }),
        claimPeriodProtection: async () => {}, claimCompanyPeriod: async () => {},
        buildHistoryDocument: (_model, row) => row
    });
    const save = async (changes = {}, extra = {}) => W.writeEmployeeMaintenance({ ...db.deps, ...auth,
        scope: input.scope, employeeId: String(input.currentEmployee._id), historyPreflight: true,
        confirmationSession: req.sessionID, externalIntent: {},
        expectedEmployeeStateToken: SaveState.employeeStateToken(db.state().employees[0]),
        correctionCatalogLoader: async () => F.catalogs,
        maintenance: { employeeChanges: changes, submittedEmployeeFields: Object.keys(changes),
            historyChanges: Object.fromEntries(Object.entries(changes).filter(([field]) =>
                require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel.schema.path(field))),
            submittedHistoryChanges: Object.fromEntries(Object.entries(changes).filter(([field]) =>
                require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel.schema.path(field))),
            submittedProfileFields: [], submittedFormValues: changes },
        ...extra });
    const completeSave = async (changes = {}) => {
        const preview = await save(changes);
        if (!preview.preflight) return preview;
        assert.equal(preview.decision, 'COMBINED_SAVE', JSON.stringify(preview));
        return save(changes, { historyPreflight: false,
            historyDecision: preview.decision, historyConfirmation: preview.historyConfirmation });
    };
    const preserved = before => {
        const after = db.state();
        assert.equal(A.stringify(after.history.find(row => String(row._id) === String(input.completeHistoryRows[0]._id))),
            A.stringify(before.history.find(row => String(row._id) === String(input.completeHistoryRows[0]._id))));
        assert.equal(A.stringify(after.audits[0]), A.stringify(before.audits[0]));
        assert.equal(after.audits[0].diagnostics.rowApproval.status, Row.STATUS);
        assert.deepEqual(input.protectedReferenceSummary, frozen, 'αμετάβλητα οριστικοποιημένα συνθετικά αποτελέσματα');
    };
    return { input, db, req, service, save, completeSave, preserved,
        changeAuditRead: transform => { transformAuditRead = transform; } };
}

function noOldWarnings(result) {
    assert.notEqual(result.historyStatus, 'LEGACY_REVIEW_REQUIRED');
    assert.notEqual(result.historyAccessMode, 'READ_ONLY');
    assert.ok(!result.historyPreservationReason, JSON.stringify(result.historyPreservationReason));
    assert.ok(!result.missingFields?.length, JSON.stringify(result.missingFields));
    assert.notEqual(result.ambiguousHistoryPreserved, true);
}

test('Εγκεκριμένο Ιστορικό + αλλαγή τηλεφώνου: κανονική αποθήκευση χωρίς παλιές προειδοποιήσεις', async () => {
    const f = await setup(), before = f.db.state();
    const result = await f.completeSave({ thlefono: '2100000000' });
    assert.equal(result.employee.thlefono, '2100000000');
    noOldWarnings(result);
    assert.deepEqual(f.db.state().history, before.history);
    assert.deepEqual(f.db.state().audits, before.audits);
    f.preserved(before);
});

test('Εγκεκριμένο Ιστορικό + αλλαγή αποδοχών: ελέγχεται και αποθηκεύεται η τρέχουσα διορθωτική έκδοση', async () => {
    const f = await setup(), before = f.db.state();
    const result = await f.completeSave({ pragmatikosMisthos: 1550 });
    assert.equal(result.employee.pragmatikosMisthos, 1550);
    assert.equal(f.db.state().history.find(row => String(row._id) === String(before.history.at(-1)._id)).pragmatikosMisthos, 1550);
    assert.equal(result.historyUpdated, true);
    noOldWarnings(result);
    f.preserved(before);
});

const six = { hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH',
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 40 / 6 };
const five = { hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5HMERH',
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
async function newSix(f) {
    const change = { kind: 'NEW_CHANGE', effectiveFrom: '2026-11-23', correctedTerms: six };
    const preview = await f.service.preview(f.req, change);
    return f.service.apply(f.req, change, preview.approval);
}

test('Εγκεκριμένο Ιστορικό + μεταβολή 5→6: νέα έκδοση και ανέπαφες όλες οι παλιές φυσικές εγγραφές', async () => {
    const f = await setup(), before = f.db.state();
    const result = await newSix(f), after = f.db.state();
    assert.equal(after.employees[0].hmeres_ergasias_ebdomadas, 6);
    assert.equal(after.history.length, before.history.length + 1);
    for (const row of before.history) assert.deepEqual(after.history.find(item => String(item._id) === String(row._id)), row);
    noOldWarnings(result);
    f.preserved(before);
});

test('Εγκεκριμένο Ιστορικό + διόρθωση 6→5: ίδια ημερομηνία και καμία επινοημένη δεύτερη περίοδος', async () => {
    const f = await setup(), original = f.db.state(), inserted = await newSix(f), before = f.db.state();
    const change = { kind: 'CORRECT_SAVED_ERROR', effectiveFrom: '2026-11-23',
        targetHistoryId: inserted.insertedHistoryId, correctedTerms: five };
    const preview = await f.service.preview(f.req, change);
    const result = await f.service.apply(f.req, change, preview.approval), after = f.db.state();
    assert.equal(after.employees[0].hmeres_ergasias_ebdomadas, 5);
    assert.equal(after.history.length, before.history.length);
    const corrected = after.history.find(row => String(row._id) === inserted.insertedHistoryId);
    assert.equal(corrected.hmeres_ergasias_ebdomadas, 5);
    assert.equal(new Date(corrected[C.START]).toISOString().slice(0, 10), change.effectiveFrom);
    for (const row of original.history) assert.deepEqual(after.history.find(item => String(item._id) === String(row._id)), row);
    noOldWarnings(result);
    f.preserved(original);
});

test('Αποθήκευση χωρίς μεταβολή: καμία εγγραφή, δέσμευση ή παλιά προειδοποίηση', async () => {
    const f = await setup(), before = f.db.state();
    const result = await f.completeSave();
    assert.equal(result.employeeUpdated, false);
    assert.equal(result.historyUpdated, false);
    assert.deepEqual(f.db.state(), before);
    assert.ok(!f.db.events.some(event => ['write', 'fence'].includes(event.type)));
    noOldWarnings(result);
    f.preserved(before);
});

test('Διατήρηση εγκεκριμένων φυσικών εγγραφών και audit σε διαδοχικές κανονικές αποθηκεύσεις', async () => {
    const f = await setup(), before = f.db.state();
    await f.completeSave({ thlefono: '2100000001' });
    await f.completeSave({ pragmatikosMisthos: 1575 });
    await f.completeSave();
    f.preserved(before);
    assert.equal(f.db.state().audits.filter(audit => audit.diagnostics.rowApproval).length, 1);
});

test('Ο κοινός έλεγχος δεν εξετάζει ελλείποντα στοιχεία της επαληθευμένης έκδοσης', async () => {
    const f = await setup(), projected = Approval.maintenanceHistoryState(f.input);
    const checked = Validation.inspectEmployeeHistorySave({ scope: f.input.scope,
        currentEmployee: f.input.currentEmployee, historyRows: projected.historyRows,
        approvedHistoryInput: f.input, includeIssueDetails: true });
    assert.equal(checked.status, 'CLEAN', JSON.stringify(checked));
    const approvedId = f.input.approvedHistoryDecisions[0].diagnostics.targetHistoryId;
    assert.ok(!checked.verification.unrecordedFacts.some(fact => fact.historyId === approvedId));
    assert.ok(!checked.issues.some(issue => issue.historyId === approvedId));
    assert.notEqual(Validation.inspectEmployeeHistorySave({ scope: f.input.scope,
        currentEmployee: f.input.currentEmployee, historyRows: projected.historyRows }).status, 'CLEAN',
    'η απουσία επαληθευμένου audit δεν εξαιρεί καμία εγγραφή');
});

for (const [label, changes] of [['τηλέφωνο', { thlefono: '2100000002' }], ['καμία μεταβολή', {}]])
    test(`Εγκεκριμένη και η τελευταία ελλιπής έκδοση + ${label}`, async () => {
        const f = await setup({ approveCurrent: true }), before = f.db.state();
        const result = await f.completeSave(changes);
        noOldWarnings(result);
        assert.deepEqual(f.db.state().history, before.history);
        assert.deepEqual(f.db.state().audits, before.audits);
        f.preserved(before);
    });

test('Μετά το 5→6: κανονική αλλαγή τηλεφώνου, αποδοχών και αποθήκευση χωρίς μεταβολή', async () => {
    const f = await setup(), original = f.db.state();
    await newSix(f);
    await f.completeSave({ thlefono: '2100000003' });
    const result = await f.completeSave({ pragmatikosMisthos: 1600 });
    assert.equal(result.employee.pragmatikosMisthos, 1600);
    noOldWarnings(result);
    const before = f.db.state(), unchanged = await f.completeSave();
    noOldWarnings(unchanged);
    assert.deepEqual(f.db.state(), before);
    for (const row of original.history) assert.deepEqual(f.db.state().history.find(item => String(item._id) === String(row._id)), row);
    f.preserved(original);
});

for (const [label, alter] of [
    ['μη επαληθευμένη κατάσταση', input => { input.approvedHistoryDecisions[0].diagnostics.rowApproval.status = 'COMMITTED_AWAITING_VERIFICATION'; }],
    ['αλλοιωμένο εγκεκριμένο περιεχόμενο', input => { input.approvedHistoryDecisions[0].diagnostics.rowApproval.approvedContent.pragmatikosMisthos = 999; }],
    ['διαφορετική εταιρεία', input => { input.approvedHistoryDecisions[0].employeeScope.company_kod = 'άλλη-εταιρεία'; }]
]) test(`Απόρριψη εξαίρεσης με ${label}`, async () => {
    const f = await setup({ alter }), before = f.db.state();
    const result = await f.save({ pragmatikosMisthos: 1600 });
    assert.equal(result.success, false);
    assert.deepEqual(f.db.state(), before);
    await assert.rejects(newSix(f));
    assert.deepEqual(f.db.state(), before);
});

test('Νέα ελλιπής μεταβολή δεν καλύπτεται από παλιά έγκριση', async () => {
    const f = await setup(), before = f.db.state();
    const result = await f.save({ pragmatikosMisthos: null });
    assert.notEqual(result.status, 'READY_FOR_COMBINED_SAVE');
    assert.deepEqual(f.db.state(), before);
    f.preserved(before);
});

test('Άλλη μη εγκεκριμένη ελλιπής έκδοση παραμένει ανεξάρτητη εκκρεμότητα', async () => {
    const f = await setup({ independent: true }), before = f.db.state();
    const result = await f.save({ pragmatikosMisthos: 1600 });
    assert.equal(result.success, false);
    await assert.rejects(newSix(f));
    assert.deepEqual(f.db.state(), before);
});

test('Ο κοινός φυσικός έλεγχος απορρίπτει αλλαγή ή διαγραφή εγκεκριμένης πηγής', async () => {
    const f = await setup(), original = A.stringify(f.input);
    for (const rows of [
        f.input.completeHistoryRows.map((row, index) => index === 0 ? { ...row, pragmatikosMisthos: 2000 } : row),
        f.input.completeHistoryRows.slice(1)
    ]) assert.throws(() => Approval.maintenanceHistoryState(f.input, rows), { code: 'EMPLOYEE_SAVE_HISTORY_NOT_CLEAN' });
    assert.equal(A.stringify(f.input), original);
});

test('Η επιβεβαίωση αποθήκευσης δεσμεύει και το επαληθευμένο audit', async () => {
    const f = await setup(), before = f.db.state();
    const changes = { pragmatikosMisthos: 1650 }, preview = await f.save(changes);
    assert.equal(preview.decision, 'COMBINED_SAVE');
    f.changeAuditRead(rows => rows.map(audit => {
        if (audit.diagnostics.rowApproval) audit.diagnostics.rowApproval.verification.verifiedAt = new Date('2026-11-19T11:00:00Z');
        return audit;
    }));
    await assert.rejects(f.save(changes, { historyPreflight: false,
        historyDecision: preview.decision, historyConfirmation: preview.historyConfirmation }),
    { code: 'EMPLOYEE_HISTORY_DEFER_STALE' });
    assert.deepEqual(f.db.state(), before);
});

test('Διεύθυνση και στοιχεία σύμβασης χρησιμοποιούν τα ίδια κοινά σημεία ελέγχου', async () => {
    const f = await setup(), before = f.db.state();
    const address = await f.completeSave({ odos: 'ΣΥΝΘΕΤΙΚΗ ΟΔΟΣ', arithmos: '10', tk: '00000' });
    assert.equal(address.employee.odos, 'ΣΥΝΘΕΤΙΚΗ ΟΔΟΣ');
    noOldWarnings(address);
    assert.deepEqual(f.db.state().history, before.history);
    const contract = await f.completeSave({ poso_symbashs_01: 1250 });
    assert.equal(contract.employee.poso_symbashs_01, 1250);
    assert.equal(f.db.state().history.find(row => String(row._id) === String(before.history.at(-1)._id)).poso_symbashs_01, 1250);
    noOldWarnings(contract);
    f.preserved(before);
});
