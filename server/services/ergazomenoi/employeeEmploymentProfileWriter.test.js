'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { writeEmployeeEmploymentProfile, writeEmployeeEmploymentProfileWithUniqueSafeRepair,
    writeEmployeeEmploymentHistoryOperations,
    writeEmployeeDeparture, writeEmployeeInvalidDepartureCorrection,
    repairEmployeeHistoryCanonical, repairEmployeeLegacyOpenCycles,
    deleteEmployeeAndEmploymentHistory,
    selectMaintenanceMode, MODE_CORRECT_EXISTING,
    normalizeHistoryObjectIds, buildScopedHistoryDeleteFilter } = require('./employeeEmploymentProfileWriter');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { resolveEmploymentProfileFactsForDate } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { resolveEmploymentTypeFromFormData } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { profileError } = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { REAL_0069_SCOPE, REAL_0069_IDS, buildReal0069SanitizedHistoryFixture } =
    require('./fixtures/real0069SanitizedHistoryFixture');
const { REAL_0002_IDS, buildReal0002SanitizedHistoryFixture } =
    require('./fixtures/real0002SanitizedHistoryFixture');
const { SUPPORTED_COLLECTIONS } =
    require('./employeeHistoryReferenceDefinitionsService');
const { OPERATION: CONTRACT_END_SEGMENT_SYNC_OPERATION } =
    require('./employeeContractEndCorrectionPlannerService');
const { shapeALifecycleFixture, shapeBCorrectedProfileFixture } =
    require('./fixtures/uniqueSafeEmployeeHistoryRepairFixtures');
const { samePeriodMateriallyDifferentProfilesFixture,
    correctionFromHireOrSpecialtyChangeFixture,
    optionalIntermediateProfileFixture,
    realStartOfFourDayProfileFixture } =
    require('./fixtures/multipleSafeEmployeeHistoryResolutionFixtures');
const { competingDepartureDatesFixture, departureAndHistoricalPayFactFixture } =
    require('./fixtures/businessFactEmployeeHistoryResolutionFixtures');
const scope = { team: 'TEST', company_kod: 'company', kodikos: '0031' };
const canonicalWorkTerms = ['kathestos_apasxolhshs', 'typos_apasxolhshs', 'typos_ebdomadas',
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias',
    'pososto_prosayxhshs_6hs_hmeras'];
function assertCanonicalWorkTermsMatch(current, history) {
    for (const field of canonicalWorkTerms) {
        assert.equal(Object.hasOwn(current, field), Object.hasOwn(history, field), field);
        assert.deepEqual(current[field], history[field], field);
    }
}

test('current employee schema accepts explicit rotating type and empty week type without defaults', () => {
    for (const field of ['typos_apasxolhshs', 'typos_ebdomadas']) {
        assert.ok(ErgazomenoiModel.schema.path(field), field);
        assert.equal(Object.hasOwn(new ErgazomenoiModel({}).toObject(), field), false, field);
    }
    const cast = new ErgazomenoiModel({ typos_apasxolhshs: '2', typos_ebdomadas: '' }).toObject();
    assert.equal(cast.typos_apasxolhshs, '2');
    assert.equal(cast.typos_ebdomadas, '');
    assert.equal(Object.hasOwn(cast, 'typos_ebdomadas'), true);
});

function database(initial = { employee: null, history: [] }, fail = '', castCurrentThroughSchema = false,
    deleteBehavior = {}) {
    let committed = structuredClone(initial); let draft; let ended = false; let writes = 0;
    const deleteFilters = [];
    const operations = { employeeUpdates: 0, employeeCreates: 0, employeeDeletes: 0, historyUpdates: 0,
        historyFenceUpdates: 0, historyDeletes: 0, historyCreates: 0,
        auditCreates: 0, deletedCounts: [] };
    const session = { async withTransaction(work) {
        draft = structuredClone(committed);
        try { await work(); if (fail === 'commit') throw new Error('commit failed'); committed = draft; } finally { draft = null; }
    }, async endSession() { ended = true; } };
    const query = (read) => ({ session(value) { assert.equal(value, session); return this; }, async lean() { return structuredClone(read()); } });
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) =>
        value === null ? row[key] == null : value instanceof Date ? new Date(row[key]).getTime() === value.getTime() : row[key] === value);
    const employeeModel = {
        findOne: () => query(() => draft.employee),
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++; operations.employeeUpdates++;
            if (fail === 'employee') throw new Error('employee failed');
            if (!matches(draft.employee, filter)) return { matchedCount: 0 };
            const changes = castCurrentThroughSchema
                ? Object.fromEntries(Object.entries(new ErgazomenoiModel(update.$set)
                    .toObject({ minimize: false })).filter(([field]) => Object.hasOwn(update.$set, field)))
                : update.$set;
            Object.assign(draft.employee, changes); return { matchedCount: 1 };
        },
        async create([record], options) {
            assert.equal(options.session, session); writes++; operations.employeeCreates++;
            draft.employee = { _id: 'employee', ...record }; return [draft.employee];
        },
        async deleteOne(filter, options) {
            assert.equal(options.session, session); writes++; operations.employeeDeletes++;
            if (!matches(draft.employee, filter)) return { deletedCount: 0 };
            draft.employee = null;
            return { deletedCount: 1 };
        }
    };
    const historyModel = {
        find: filter => query(() => deleteBehavior.scopeFind ? draft.history.filter(row =>
            row.team === filter.team && String(row.company_kod) === String(filter.company_kod) &&
            row.kodikos === filter.kodikos) : draft.history),
        async updateMany(filter, update, options) {
            assert.equal(options.session, session); writes++; operations.historyFenceUpdates++;
            if (fail === 'stale') return { matchedCount: 0 };
            const ids = new Set(filter._id.$in.map(String));
            const matched = draft.history.filter(row => ids.has(String(row._id)) &&
                row.team === filter.team && String(row.company_kod) === String(filter.company_kod) &&
                row.kodikos === filter.kodikos);
            for (const row of matched) for (const [field, increment] of Object.entries(update.$inc || {})) {
                row[field] = Number(row[field] || 0) + increment;
            }
            return { matchedCount: matched.length };
        },
        async deleteMany(filter, options) {
            assert.equal(options.session, session); writes++; operations.historyDeletes++;
            if (fail === 'cleanup') throw new Error('cleanup failed');
            if (deleteBehavior.castFilter) {
                const queryToCast = IstorikoProslhpseonAllagonModel.deleteMany(filter);
                mongoose.sanitizeFilter(queryToCast.getFilter());
                queryToCast.cast(IstorikoProslhpseonAllagonModel);
            }
            deleteFilters.push(filter);
            const ids = new Set(filter._id.$in.map(String));
            const before = draft.history.length;
            if (!deleteBehavior.pretendDeleteSuccess) {
                draft.history = draft.history.filter(row => !(ids.has(String(row._id)) &&
                    row.team === filter.team && String(row.company_kod) === String(filter.company_kod) &&
                    row.kodikos === filter.kodikos));
            }
            const actualDeletedCount = before - draft.history.length;
            if (deleteBehavior.injectUnexpectedHistory) {
                draft.history.push({ ...draft.history[0], _id: 'unexpected-history-row',
                    aa_eggrafhs: '9999' });
            }
            const deletedCount = deleteBehavior.deletedCount ?? (deleteBehavior.pretendDeleteSuccess
                ? draft.history.filter(row => ids.has(String(row._id)) &&
                    row.team === filter.team && String(row.company_kod) === String(filter.company_kod) &&
                    row.kodikos === filter.kodikos).length
                : actualDeletedCount);
            operations.deletedCounts.push(deletedCount);
            return { deletedCount };
        },
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++; operations.historyUpdates++;
            if (fail === 'close') throw new Error('close failed');
            if (fail === `close:${filter._id}`) throw new Error('close failed');
            const row = draft.history.find((row) => matches(row, filter));
            if (!row || fail === 'stale') return { matchedCount: 0 };
            if (!deleteBehavior.pretendUpdateSuccess) Object.assign(row, update.$set);
            return { matchedCount: 1 };
        },
        async create([record], options) {
            assert.equal(options.session, session); writes++; operations.historyCreates++;
            if (fail === 'history') throw new Error('history failed');
            const row = { _id: `history-${draft.history.length}`, ...record };
            draft.history.push(row); return [row];
        }
    };
    const auditModel = { async create([record], options) {
        assert.equal(options.session, session); writes++; operations.auditCreates++;
        if (fail === 'audit') throw new Error('audit failed');
        if (!draft.audits) draft.audits = [];
        draft.audits.push(structuredClone(record));
        return [record];
    } };
    return { dependencies: { connection: { startSession: async () => session }, employeeModel, historyModel,
        auditModel, auditCollectionChecker: async () => true,
        referenceChecker: async () => [], capabilityProbe: async () => true },
    state: () => committed, ended: () => ended, writes: () => writes,
    deleteFilters: () => deleteFilters, operations: () => structuredClone(operations) };
}
const arrangement = { [C.ENABLED]: true, [C.TYPE]: 'APPROVED_TIME_SHIFT_INTERRUPTION',
    [C.FROM]: '2026-09-01', [C.START]: '13:00', [C.END]: '14:00' };

test('initial employee and complete history commit together', async () => {
    const db = database();
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: { eponymo: 'TEST' }, effectiveFrom: '2026-04-01' });
    assert.equal(db.state().employee[C.ENABLED], false);
    const history = db.state().history[0];
    for (const field of C.FACT_FIELDS) assert.deepEqual(history[field], db.state().employee[field], field);
    assert.equal(history.afora_proslhpsh, true); assert.equal(db.ended(), true);
});

test('whole-employee deletion uses the canonical plan, reference fence and final empty verification', async () => {
    const initial = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const db = database({ employee: { _id: 'employee', ...scope, ...initial },
        history: [{ _id: '507f1f77bcf86cd799439199', ...scope, ...initial,
            aa_eggrafhs: '0001' }] });
    const result = await deleteEmployeeAndEmploymentHistory({ ...db.dependencies,
        scope, employeeId: 'employee' });
    assert.deepEqual(result, { deletedEmployee: 1, deletedHistory: 1 });
    assert.equal(db.state().employee, null);
    assert.deepEqual(db.state().history, []);
    assert.equal(db.operations().employeeDeletes, 1);
    assert.equal(db.operations().historyFenceUpdates, 1);
    assert.equal(db.operations().historyDeletes, 1);
    assert.equal(db.operations().auditCreates, 1);
});
test('a new arrangement appends complete history and closes previous version', async () => {
    const initial = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const db = database({ employee: { _id: 'employee', ...scope, ...initial, localNote: 'preserve' },
        history: [{ _id: 'old', ...scope, ...initial, aa_eggrafhs: '0001' }] });
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom: '2026-09-15' });
    assert.equal(db.state().history.length, 2);
    assert.equal(db.state().history[0][C.ENABLED], false);
    assert.equal(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_eos.toISOString(), '2026-09-14T00:00:00.000Z');
    assert.equal(db.state().history[1][C.ENABLED], true);
    assert.equal(db.state().employee.localNote, 'preserve');
    assert.equal(db.state().history[1].aa_eggrafhs, '0002');
});

test('trusted full future-version double submit reuses the existing canonical version', async () => {
    const initial = { ...buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' }),
        hmeromhnia_proslhpshs: '2026-04-01' };
    const db = database({ employee: { _id: 'employee', ...scope, ...initial },
        history: [{ _id: 'old', ...scope, ...initial, aa_eggrafhs: '0001' }] });
    const maintenance = { intentHint: 'APPEND_NEW_VERSION',
        employeeChanges: { hmeromhnia_proslhpshs: '2026-04-01' },
        historyChanges: { hmeromhnia_proslhpshs: '2026-04-01' },
        submittedHistoryChanges: { hmeromhnia_proslhpshs: '2026-04-01' },
        submittedProfileFields: Object.keys(arrangement) };
    const first = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', input: arrangement, effectiveFrom: '2026-09-15', maintenance });
    assert.equal(first.mode, 'MODE_NEW_VERSION');
    assert.equal(db.state().history.length, 2);
    const writesAfterFirst = db.writes();
    const second = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', input: arrangement, effectiveFrom: '2026-09-15', maintenance });
    assert.equal(second.mode, 'NO_HISTORY_CHANGE');
    assert.equal(second.idempotent, true);
    assert.equal(db.state().history.length, 2);
    assert.equal(db.writes(), writesAfterFirst);
});

test('ordinary future Maintenance profile difference is ambiguous and performs no write', async () => {
    const initial = { ...buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' }),
        hmeromhnia_proslhpshs: '2026-04-01' };
    const state = { employee: { _id: 'employee', ...scope, ...initial },
        history: [{ _id: 'old', ...scope, ...initial, aa_eggrafhs: '0001' }] };
    const db = database(state);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', input: arrangement, effectiveFrom: '2026-09-15',
        maintenance: { employeeChanges: {}, historyChanges: {},
            submittedHistoryChanges: {}, submittedProfileFields: Object.keys(arrangement) }
    }), error => error.code === 'CONFLICT_PROFILE_CHANGE_INTENT_REQUIRED');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), state);
});

const LEGACY_SHADOW_IDS = Object.freeze({
    legacy: '507f1f77bcf86cd799439101',
    recorded: '507f1f77bcf86cd799439102'
});
function legacyShadowState() {
    const end = new Date('2026-10-15');
    const base = { ...buildCompleteProfileSnapshot({ effectiveFrom: '2026-05-28' }),
        hmeromhnia_proslhpshs: '2026-05-28', hmeromhnia_isxyos_oron_ergasias_eos: end,
        kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, nomimosMisthos: 1000,
        pragmatikosMisthos: 1100, poso_symbashs_01: 1100 };
    const legacy = { ...base, _id: LEGACY_SHADOW_IDS.legacy, ...scope, aa_eggrafhs: '0001',
        createdAt: new Date('2026-05-28') };
    for (const field of C.FACT_FIELDS) delete legacy[field];
    delete legacy.employment_profile_source;
    const recorded = { ...base, _id: LEGACY_SHADOW_IDS.recorded, ...scope, aa_eggrafhs: '0002',
        createdAt: new Date('2026-05-29') };
    return { employee: { ...base, _id: 'employee', ...scope, energos: true,
        archived: false, hmeromhnia_apoxorhshs: null }, history: [legacy, recorded] };
}
function rotatingAppend(db) {
    const type = resolveEmploymentTypeFromFormData({ kathestos_apasxolhshs_stathera: 'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ' });
    assert.equal(type, '2');
    const changes = { hmeromhnia_proslhpshs: '2026-05-28',
        hmeromhnia_allaghs_symbashs: '2026-09-22',
        hmeromhnia_allaghs_orarioy_apo: '2026-09-22',
        hmeromhnia_allaghs_orarioy_eos: '2026-09-28',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-22',
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        kathestos_apasxolhshs: type, typos_apasxolhshs: type,
        hmeres_ergasias_ebdomadas: 1, ores_ergasias_ebdomadas: 8,
        mo_oron_hmerhsias_ergasias: 8, nomimosMisthos: 300,
        pragmatikosMisthos: 350, poso_symbashs_01: 350 };
    return writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        effectiveFrom: '2026-09-22', maintenance: {
            intentHint: 'APPEND_NEW_VERSION', originalHistoryId: LEGACY_SHADOW_IDS.recorded,
            employeeChanges: changes, historyChanges: changes } });
}

test('legacy shadow and recorded V1 close together before one rotating profile append', async () => {
    const initial = legacyShadowState();
    const db = database(initial);
    const saved = await rotatingAppend(db);
    const state = db.state();
    assert.equal(saved.mode, 'MODE_NEW_VERSION');
    assert.equal(state.history.length, 2);
    assert.deepEqual(state.history.map(row => row._id), [LEGACY_SHADOW_IDS.recorded, 'history-1']);
    assert.equal(new Date(state.history[0].hmeromhnia_isxyos_oron_ergasias_eos)
        .toISOString().slice(0, 10), '2026-09-21');
    assert.equal(C.readEmploymentProfile(state.history[0]).recorded, true);
    assert.equal(state.audits.length, 1);
    assert.deepEqual(state.audits[0].deletedLegacyHistoryIds, [LEGACY_SHADOW_IDS.legacy]);
    assert.deepEqual(db.deleteFilters()[0]._id.$in.map(String), [LEGACY_SHADOW_IDS.legacy]);
    assert.deepEqual(db.operations().deletedCounts, [1]);
    const next = state.history[1];
    assertCanonicalWorkTermsMatch(state.employee, next);
    assert.equal(state.employee.typos_apasxolhshs, '2');
    assert.equal(state.employee.typos_ebdomadas, '');
    assert.equal(C.readEmploymentProfile(next).recorded, true);
    assert.equal(next.aa_eggrafhs, '0003');
    assert.equal(new Date(next.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0, 10), '2026-09-22');
    assert.equal(next.hmeromhnia_isxyos_oron_ergasias_eos, null);
    assert.equal(new Date(next.hmeromhnia_allaghs_orarioy_eos).toISOString().slice(0, 10), '2026-09-28');
    for (const record of [next, state.employee]) {
        assert.equal(record.kathestos_apasxolhshs, '2');
        assert.equal(record.hmeres_ergasias_ebdomadas, 1);
        assert.equal(record.ores_ergasias_ebdomadas, 8);
        assert.equal(record.mo_oron_hmerhsias_ergasias, 8);
        assert.equal(record.nomimosMisthos, 300);
        assert.equal(record.pragmatikosMisthos, 350);
        assert.equal(record.poso_symbashs_01, 350);
        assert.equal(record.hmeromhnia_proslhpshs, '2026-05-28');
    }
    assert.equal(state.employee.hmeromhnia_apoxorhshs, null);
    assert.equal(state.employee.energos, true);
    const cycles = buildEmploymentCycles({ currentEmployee: state.employee, history: state.history });
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].hire_date, '2026-05-28');
    assert.equal(resolveEmploymentProfileFactsForDate('2026-09-21', state.history).historyId,
        LEGACY_SHADOW_IDS.recorded);
    assert.equal(resolveEmploymentProfileFactsForDate('2026-09-22', state.history).historyId, next._id);
});

test('other overlapping predecessor shapes fail closed before writes', async () => {
    const cases = {
        'two recorded profiles': state => Object.assign(state.history[0],
            Object.fromEntries(C.FACT_FIELDS.map(field => [field, state.history[1][field]]))),
        'different starts': state => { state.history[0].hmeromhnia_isxyos_oron_ergasias_apo = '2026-06-01'; },
        'different hires': state => { state.history[0].hmeromhnia_proslhpshs = '2026-06-01'; },
        'different ends': state => { state.history[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-10-16'; },
        'legacy row created later': state => { state.history[0].createdAt = new Date('2026-05-30'); },
        'newer cycle': state => { state.history.push({ ...scope, _id: 'newer-cycle',
            hmeromhnia_proslhpshs: '2026-07-01', aa_eggrafhs: '0003' }); }
    };
    delete cases['two recorded profiles'];
    delete cases['legacy row created later'];
    for (const [name, mutate] of Object.entries(cases)) {
        const initial = legacyShadowState(); mutate(initial);
        const db = database(initial);
        await assert.rejects(rotatingAppend(db), error =>
            ['EMPLOYEE_PROFILE_HISTORY_OVERLAP', 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED']
                .includes(error.code), name);
        assert.equal(db.writes(), 0, name);
        assert.deepEqual(db.state(), initial, name);
    }
});

test('all legacy-shadow cleanup writes roll back on each failure point', async () => {
    for (const fail of ['cleanup', 'audit', 'employee', 'history', 'commit']) {
        const initial = legacyShadowState();
        const db = database(initial, fail);
        await assert.rejects(rotatingAppend(db), undefined, fail);
        assert.deepEqual(db.state(), initial, fail);
        assert.equal(db.ended(), true, fail);
    }
});

test('ambiguous overlap has a dedicated Greek response', () => {
    let status;
    const response = { status(value) { status = value; return this; }, json(value) { return value; } };
    const error = Object.assign(new Error('overlap'), { code: 'EMPLOYEE_PROFILE_HISTORY_OVERLAP', statusCode: 409 });
    const result = profileError(response, error);
    assert.equal(status, 409);
    assert.equal(result.reason, error.code);
    assert.match(result.message, /επικαλυπτόμενες ενεργές περιόδους/);
    assert.match(result.message, /δεν αποθηκεύτηκε/);
});
test('ambiguous history conflict has a stable actionable response contract', () => {
    let status;
    const response = { status(value) { status = value; return this; }, json(value) { return value; } };
    const error = Object.assign(new Error('reconciliation'),
        { code: 'CONFLICT_INCONSISTENT_HISTORY', statusCode: 409 });
    const result = profileError(response, error);
    assert.equal(status, 409);
    assert.equal(result.success, false);
    assert.equal(result.reason, 'CONFLICT_INCONSISTENT_HISTORY');
    assert.equal(result.operation, 'EMPLOYEE_MAINTENANCE');
    assert.match(result.message, /περισσότερες από μία ασυνεπείς εγγραφές ιστορικού/);
    assert.match(result.message, /Δεν έγινε καμία αλλαγή/);
    assert.match(result.message, /Επιλέξτε τη συγκεκριμένη περίοδο από το Ιστορικό/);
    assert.doesNotMatch(result.message, /συμφιλίωση|reconciliation|canonical|schema/i);
    assert.equal(result.errorMessage, result.message);
});
test('history failure rolls back an initial employee insert', async () => {
    const db = database(undefined, 'history');
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: {}, effectiveFrom: '2026-09-01' }), /history failed/);
    assert.deepEqual(db.state(), { employee: null, history: [] }); assert.equal(db.ended(), true);
});
test('history create or close failure rolls back employee and previous history', async () => {
    const initial = { employee: { _id: 'employee', ...scope }, history: [{ _id: 'old', ...scope,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-01', hmeromhnia_isxyos_oron_ergasias_eos: null }] };
    for (const fail of ['history', 'close']) {
        const db = database(initial, fail);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom: '2026-09-15' }));
        assert.deepEqual(db.state(), initial); assert.equal(db.ended(), true);
    }
});
test('invalid submissions fail before any mock write', async () => {
    const db = database();
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: {},
        input: { [C.ENABLED]: true }, effectiveFrom: '2026-09-01' }));
    assert.equal(db.writes(), 0); assert.equal(db.state().employee, null);
});
test('standalone topology cannot fall back to non-atomic updates', async () => {
    const db = database();
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, newEmployee: {},
        capabilityProbe: async () => false, effectiveFrom: '2026-09-01' }),
    (error) => error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE');
    assert.equal(db.writes(), 0);
});
test('same-date or retroactive changes cannot overwrite a later profile', async () => {
    const initial = { employee: { _id: 'employee', ...scope }, history: [{ _id: 'future',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' }] };
    for (const effectiveFrom of ['2026-09-01', '2026-09-15']) {
        const db = database(initial);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom }),
            (error) => ['EMPLOYEE_PROFILE_NON_APPEND_CHANGE',
                'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED'].includes(error.code));
        assert.deepEqual(db.state(), initial); assert.equal(db.writes(), 0);
    }
});
test('unrelated fields cannot make history differ from current employee', async () => {
    const db = database({ employee: { _id: 'employee', ...scope }, history: [] });
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        input: { ores_ergasias_ebdomadas: 20 }, effectiveFrom: '2026-09-01' }));
    assert.equal(db.writes(), 0);
});
test('profile changes retain existing contract amounts without recalculation', async () => {
    const db = database({ employee: { _id: 'employee', ...scope, symbash: 'old-contract',
        nomimosMisthos: 1200, poso_symbashs_01: 1200 }, history: [] });
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, input: arrangement, effectiveFrom: '2026-09-01' });
    assert.equal(db.state().history[0].symbash, 'old-contract');
    assert.equal(db.state().history[0].nomimosMisthos, 1200);
    assert.equal(db.state().history[0].poso_symbashs_01, 1200);
    assert.equal(db.state().employee.nomimosMisthos, 1200);
});

function correctionState() {
    const old = { ...scope, ...buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' }),
        _id: 'old', aa_eggrafhs: '0001', hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-08-31') };
    const latest = { ...scope, ...buildCompleteProfileSnapshot({ input: arrangement, effectiveFrom: '2026-09-01' }),
        _id: 'latest', aa_eggrafhs: '0002' };
    return { employee: { ...latest, _id: 'employee', localNote: 'keep' }, history: [old, latest] };
}
test('same-date exact latest correction changes current and the same history row atomically', async () => {
    const initial = correctionState(); const db = database(initial);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'latest', effectiveFrom: '2026-09-01',
        input: { [C.START]: '12:00', [C.END]: '13:00' } });
    assert.equal(result.currentUpdated, true);
    assert.equal(db.state().history.length, 2);
    assert.deepEqual(db.state().history[0], initial.history[0]);
    for (const field of C.FACT_FIELDS) assert.deepEqual(db.state().employee[field], db.state().history[1][field]);
    assert.equal(db.state().employee[C.START], '12:00');
    assert.equal(db.state().employee.localNote, 'keep');
    for (const field of ['_id', 'aa_eggrafhs', 'hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_isxyos_oron_ergasias_eos']) {
        assert.deepEqual(db.state().history[1][field], initial.history[1][field]);
    }
});
test('latest complete correction restores absent canonical current fields without appending history', async () => {
    const initial = legacyShadowState();
    const appended = database(initial);
    await rotatingAppend(appended);
    const saved = structuredClone(appended.state());
    delete saved.employee.typos_apasxolhshs;
    delete saved.employee.typos_ebdomadas;
    saved.employee.hmeromhnia_isxyos_oron_ergasias_eos = new Date('2026-10-15');
    saved.history[1].hmeromhnia_isxyos_oron_ergasias_eos = new Date('2026-10-15');
    const db = database(saved, '', true);
    const latest = saved.history[1];
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: latest._id,
        effectiveFrom: '2026-09-22', input: {} });
    assert.equal(result.currentUpdated, true);
    assert.equal(result.mode, MODE_CORRECT_EXISTING);
    assert.equal(db.state().history.length, 2);
    assert.deepEqual(db.state().history.map(row => row.aa_eggrafhs), ['0002', '0003']);
    assert.deepEqual(db.state().history[0], saved.history[0]);
    for (const field of ['_id', 'aa_eggrafhs', 'hmeromhnia_isxyos_oron_ergasias_apo',
        'hmeromhnia_isxyos_oron_ergasias_eos', 'hmeromhnia_allaghs_orarioy_apo',
        'hmeromhnia_allaghs_orarioy_eos']) {
        assert.deepEqual(db.state().history[1][field], saved.history[1][field], field);
    }
    assert.deepEqual(db.state().history[1], saved.history[1]);
    assertCanonicalWorkTermsMatch(db.state().employee, db.state().history[1]);
    assert.equal(db.state().employee.typos_apasxolhshs, '2');
    assert.equal(db.state().employee.typos_ebdomadas, '');
    assert.equal(db.state().employee.energos, true);
    assert.equal(db.state().employee.hmeromhnia_apoxorhshs, null);
    assert.deepEqual(db.state().employee.hmeromhnia_proslhpshs, saved.employee.hmeromhnia_proslhpshs);
});
test('older complete correction preserves surrounding boundaries and never copies current arrangement', async () => {
    const initial = correctionState(); const db = database(initial);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'old', effectiveFrom: '2026-04-01', input: { dialleima_se_lepta: 20 } });
    assert.equal(result.currentUpdated, false);
    assert.deepEqual(db.state().employee, initial.employee);
    assert.deepEqual(db.state().history[1], initial.history[1]);
    assert.equal(db.state().history[0][C.ENABLED], false);
    assert.equal(db.state().history[0].dialleima_se_lepta, 20);
    assert.deepEqual(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_eos, initial.history[0].hmeromhnia_isxyos_oron_ergasias_eos);
});
test('correction rejects wrong identity or date without writes', async () => {
    for (const [historyId, effectiveFrom] of [['missing', '2026-09-01'], ['old', '2026-09-01'], ['latest', '2026-09-02']]) {
        const initial = correctionState(); const db = database(initial);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
            mode: MODE_CORRECT_EXISTING, historyId, effectiveFrom }), /CORRECTION_IDENTITY_MISMATCH/);
        assert.deepEqual(db.state(), initial); assert.equal(db.writes(), 0);
    }
});
test('correction history failure or stale match rolls back current facts', async () => {
    for (const fail of ['close', 'stale']) {
        const initial = correctionState(); const db = database(initial, fail);
        await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
            mode: MODE_CORRECT_EXISTING, historyId: 'latest', effectiveFrom: '2026-09-01', input: { [C.START]: '12:30' } }));
        assert.deepEqual(db.state(), initial); assert.equal(db.ended(), true);
    }
});
test('old incomplete legacy correction requires explicit missing facts instead of current defaults', async () => {
    const initial = correctionState();
    delete initial.history[0][C.ENABLED]; delete initial.history[0][C.SCHEMA_VERSION];
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'old', effectiveFrom: '2026-04-01', input: { dialleima_se_lepta: 20 } }),
    /LEGACY_CORRECTION_REQUIRES_FACTS/);
    assert.equal(db.writes(), 0);
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'old', effectiveFrom: '2026-04-01', input: { [C.ENABLED]: false } });
    assert.equal(db.state().history[0][C.SCHEMA_VERSION], 1);
    assert.deepEqual(db.state().employee, initial.employee);
});
test('correction rejects mismatched current identity', async () => {
    const initial = correctionState();
    initial.employee.hmeromhnia_isxyos_oron_ergasias_apo = new Date('2026-10-01');
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'latest', effectiveFrom: '2026-09-01' }),
    /CURRENT_IDENTITY_MISMATCH/);
    assert.equal(db.writes(), 0);
});

test('exact non-boundary termination correction is allowed over pre-existing legacy overlap', async () => {
    const initial = correctionState();
    initial.history[0].hmeromhnia_isxyos_oron_ergasias_eos = null;
    initial.history[1].hmeromhnia_apoxorhshs = null;
    initial.employee.hmeromhnia_apoxorhshs = null;
    const unrelatedBefore = structuredClone(initial.history[0]);
    const db = database(initial);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: 'latest',
        effectiveFrom: '2026-09-01', input: {}, maintenance: {
            employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
            historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
            correctableIdentityFields: ['hmeromhnia_apoxorhshs']
        } });
    assert.equal(result.history._id, 'latest');
    assert.equal(db.state().history.length, 2);
    assert.deepEqual(db.state().history[0], unrelatedBefore);
    assert.equal(new Date(db.state().history[1].hmeromhnia_apoxorhshs)
        .toISOString().slice(0, 10), '2026-09-10');
    assert.deepEqual(db.state().history[1].hmeromhnia_isxyos_oron_ergasias_apo,
        initial.history[1].hmeromhnia_isxyos_oron_ergasias_apo);
    assert.deepEqual(db.state().history[1].hmeromhnia_isxyos_oron_ergasias_eos,
        initial.history[1].hmeromhnia_isxyos_oron_ergasias_eos);
});
test('normal latest legacy Maintenance correction keeps its identity and creates no duplicate', async () => {
    const from = new Date('2026-04-01');
    const row = { ...scope, _id: 'legacy', aa_eggrafhs: '0001',
        hmeromhnia_allaghs_orarioy_apo: from, hmeromhnia_allaghs_orarioy_eos: null,
        dialleima_se_lepta: 15 };
    const db = database({ employee: { ...row, _id: 'employee' }, history: [row] });
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        mode: MODE_CORRECT_EXISTING, historyId: 'legacy', effectiveFrom: '2026-04-01',
        input: { dialleima_se_lepta: 20 } });
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0]._id, 'legacy');
    assert.deepEqual(db.state().history[0].hmeromhnia_allaghs_orarioy_apo, from);
    assert.equal(db.state().employee.dialleima_se_lepta, 20);
    assert.equal(C.readEmploymentProfile(db.state().history[0]).recorded, true);
});

test('Maintenance preserves a sparse lifecycle anchor and selects the open modern profile row', async () => {
    const identity = {
        hmeromhnia_proslhpshs: new Date('2026-04-23'),
        hmeromhnia_allaghs_symbashs: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: new Date('2026-10-31'),
        hmeromhnia_apoxorhshs: new Date('2026-04-24')
    };
    const legacy = { ...scope, ...identity, _id: 'legacy', aa_eggrafhs: '0001', afora_proslhpsh: true };
    delete legacy.hmeromhnia_isxyos_oron_ergasias_apo;
    delete legacy.hmeromhnia_isxyos_oron_ergasias_eos;
    const modern = { ...scope, ...identity, _id: 'modern', aa_eggrafhs: '0002',
        employment_profile_source: 'ERGOMENOI_CONTROLLER', afora_proslhpsh: true,
        afora_allagh_oron_ergasias: true };
    const current = { ...modern, _id: 'employee' };

    assert.deepEqual(selectMaintenanceMode([legacy, modern], identity), {
        mode: MODE_CORRECT_EXISTING,
        historyId: 'modern'
    });

    const db = database({ employee: current, history: [legacy, modern] });
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-04-23', maintenance: {
            identity, employeeChanges: {}, historyChanges: {}
    } });
    assert.equal(result.history._id, 'modern');
    assert.equal(db.state().history.length, 2);
    assert.equal(db.state().history[0]._id, 'legacy');
    assert.equal(db.state().history[1]._id, 'modern');
    assert.equal(db.state().audits.length, 1);
});

test('Maintenance identity keeps true equal effective boundaries ambiguous', () => {
    const identity = Object.fromEntries(require('../../utils/ergazomenoi/employmentProfileTransition')
        .IDENTITY_FIELDS.map(field => [field, null]));
    Object.assign(identity, {
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null
    });
    const first = { ...identity, _id: 'first' };
    const second = { ...identity, _id: 'second' };
    assert.throws(() => selectMaintenanceMode([first, second], identity), (error) =>
        error.code === 'EMPLOYEE_PROFILE_AMBIGUOUS_IDENTITY' && error.statusCode === 409);
});

test('Maintenance identity distinguishes missing, explicit null and finite effective ends', () => {
    const { IDENTITY_FIELDS } = require('../../utils/ergazomenoi/employmentProfileTransition');
    const openIdentity = Object.fromEntries(IDENTITY_FIELDS.map(field => [field, null]));
    Object.assign(openIdentity, {
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null
    });
    const missingEnd = { ...openIdentity, _id: 'legacy' };
    delete missingEnd.hmeromhnia_isxyos_oron_ergasias_apo;
    delete missingEnd.hmeromhnia_isxyos_oron_ergasias_eos;
    const explicitNull = { ...openIdentity, _id: 'open' };
    const finiteEnd = { ...openIdentity, _id: 'finite',
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-04-30') };

    assert.deepEqual(selectMaintenanceMode([missingEnd, explicitNull, finiteEnd], openIdentity), {
        mode: MODE_CORRECT_EXISTING, historyId: 'open'
    });
    assert.deepEqual(selectMaintenanceMode([missingEnd, explicitNull, finiteEnd], {
        ...openIdentity, hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-04-29')
    }), { mode: MODE_CORRECT_EXISTING, historyId: 'legacy' });
    assert.deepEqual(selectMaintenanceMode([missingEnd, explicitNull, finiteEnd], {
        ...openIdentity, hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-04-30')
    }), { mode: MODE_CORRECT_EXISTING, historyId: 'finite' });
});

for (const terminationType of ['ma_217', 'ma_222', 'ma_227']) test(
    `exact Maintenance termination ${terminationType} corrects departure on the same history row`,
    async () => {
        const initial = correctionState();
        initial.employee.hmeromhnia_apoxorhshs = null;
        initial.history[1].hmeromhnia_apoxorhshs = null;
        const db = database(initial);
        const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
            employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: 'latest',
            effectiveFrom: '2026-09-01', input: {}, maintenance: {
                employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
                historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
                correctableIdentityFields: ['hmeromhnia_apoxorhshs']
            } });
        assert.equal(result.history._id, 'latest');
        assert.equal(db.state().history.length, 2);
        assert.equal(db.state().history[0].hmeromhnia_apoxorhshs ?? null, null);
        assert.equal(new Date(db.state().history[1].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
        assert.equal(new Date(db.state().employee.hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
    }
);

test('exact older termination correction targets only its historyId with a later row present', async () => {
    const initial = correctionState();
    initial.history[0].hmeromhnia_apoxorhshs = null;
    const db = database(initial);
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: 'old',
        effectiveFrom: '2026-04-01', input: Object.fromEntries(C.FACT_FIELDS
            .filter(field => ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field))
            .map(field => [field, initial.history[0][field]])), maintenance: {
            employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-06-30') },
            historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-06-30') },
            correctableIdentityFields: ['hmeromhnia_apoxorhshs']
        } });
    assert.equal(db.state().history.length, 2);
    assert.equal(new Date(db.state().history[0].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-06-30');
    assert.deepEqual(db.state().history[1], initial.history[1]);
    assert.deepEqual(db.state().employee, initial.employee);
});

test('no-change Maintenance selects real May version and preserves non-terms history noise', async () => {
    const { IDENTITY_FIELDS } = require('../../utils/ergazomenoi/employmentProfileTransition');
    const { MODE_LEGACY_MAINTENANCE } = require('./employeeEmploymentProfileWriter');
    const identity = Object.fromEntries(IDENTITY_FIELDS.map(field => [field, null]));
    Object.assign(identity, { hmeromhnia_allaghs_orarioy_apo: new Date('2026-05-25'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-05-25'),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-05') });
    const real = { ...scope, ...identity, _id: 'real', aa_eggrafhs: '0002', afora_allagh_oron_ergasias: true };
    const noise = { ...real, _id: 'noise', aa_eggrafhs: '0003', afora_allagh_oron_ergasias: false,
        hmeromhnia_isxyos_oron_ergasias_apo: null, hmeromhnia_isxyos_oron_ergasias_eos: null };
    const initial = { employee: { ...real, _id: 'employee' }, history: [noise, real] };
    assert.deepEqual(selectMaintenanceMode(initial.history, identity), { mode: MODE_CORRECT_EXISTING, historyId: 'real' });
    const db = database(initial, '', true);
    const result = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        effectiveFrom: '2026-05-25', maintenance: { identity, employeeChanges: {}, historyChanges: {} } });
    assert.equal(result.mode, 'NO_HISTORY_CHANGE');
    assert.equal(result.history._id, 'real');
    assert.deepEqual(db.state(), initial);
    assert.equal(Object.hasOwn(db.state().employee, 'typos_apasxolhshs'), false);
    assert.equal(Object.hasOwn(db.state().employee, 'typos_ebdomadas'), false);
    // A pre-existing overlap is not newly introduced by this non-boundary correction.
    const overlap = { ...noise, afora_allagh_oron_ergasias: true };
    const conflicting = database({ ...initial, history: [real, overlap] });
    await writeEmployeeEmploymentProfile({ ...conflicting.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-05-25',
        maintenance: { identity, employeeChanges: {}, historyChanges: {} } });
    assert.deepEqual(conflicting.state().history, [real, overlap]);
});

function noHistoryMaintenanceState(dates = {}) {
    return { employee: { _id: 'employee', ...scope, eponymo: 'Imported',
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_allaghs_orarioy_apo: null,
        hmeromhnia_proslhpshs: null,
        ...dates }, history: [] };
}

test('imported employee without history creates one baseline from existing effective date', async () => {
    const db = database(noHistoryMaintenanceState({
        hmeromhnia_isxyos_oron_ergasias_apo: '2025-05-01' }));
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        maintenance: { employeeChanges: { email: 'saved@example.invalid' }, historyChanges: {} } });
    assert.equal(db.state().history.length, 1);
    assert.equal(new Date(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo)
        .toISOString().slice(0, 10), '2025-05-01');
});

test('first no-history maintenance persists departure in employee and the single baseline', async () => {
    const db = database(noHistoryMaintenanceState({ hmeromhnia_proslhpshs: '2025-05-01' }));
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        maintenance: { employeeChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') },
            historyChanges: { hmeromhnia_apoxorhshs: new Date('2026-09-10') } } });
    assert.equal(db.state().history.length, 1);
    assert.equal(new Date(db.state().history[0].hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
    assert.equal(new Date(db.state().employee.hmeromhnia_apoxorhshs).toISOString().slice(0, 10), '2026-09-10');
});

for (const [name, dates, expected] of [
    ['schedule start fallback', { hmeromhnia_allaghs_orarioy_apo: '2025-06-01',
        hmeromhnia_proslhpshs: '2025-05-01' }, '2025-06-01'],
    ['hire date fallback', { hmeromhnia_proslhpshs: '2025-05-01' }, '2025-05-01']
]) test(`no-history baseline uses ${name}`, async () => {
    const db = database(noHistoryMaintenanceState(dates));
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope, employeeId: 'employee',
        maintenance: { employeeChanges: {}, historyChanges: {} } });
    assert.equal(db.state().history.length, 1);
    assert.equal(new Date(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo)
        .toISOString().slice(0, 10), expected);
});

test('no-history baseline without any safe effective date fails before writes', async () => {
    const initial = noHistoryMaintenanceState(); const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', maintenance: { employeeChanges: {}, historyChanges: {} } }),
    error => error.code === 'INVALID_EMPLOYMENT_PROFILE' && error.field === 'effectiveFrom');
    assert.equal(db.writes(), 0); assert.deepEqual(db.state(), initial);
});

test('ordinary profile version cannot create a new employment cycle by changing hire date', async () => {
    const baseline = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const initial = {
        employee: { _id: 'employee', ...scope, ...baseline,
            hmeromhnia_proslhpshs: '2025-01-01', hmeromhnia_apoxorhshs: null },
        history: [{ _id: 'old', ...scope, ...baseline, aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2025-01-01', hmeromhnia_apoxorhshs: null }]
    };
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        employeeId: 'employee',
        input: arrangement,
        effectiveFrom: '2026-09-15',
        maintenance: {
            employeeChanges: { hmeromhnia_proslhpshs: '2026-09-15' },
            historyChanges: { hmeromhnia_proslhpshs: '2026-09-15' }
        }
    }), error => error.code === 'EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_REHIRE');
    assert.deepEqual(db.state(), initial);
    assert.equal(db.writes(), 0);
});

function openCycleHireGuardState() {
    const baseline = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const lifecycle = { hmeromhnia_proslhpshs: '2026-04-01',
        hmeromhnia_apoxorhshs: null, energos: true, archived: false };
    return {
        employee: { _id: 'employee', ...scope, ...baseline, ...lifecycle },
        history: [{ _id: '507f1f77bcf86cd799439188', ...scope, ...baseline,
            ...lifecycle, aa_eggrafhs: '0001', afora_proslhpsh: true,
            createdAt: new Date('2026-04-01T00:00:00.000Z') }]
    };
}

function historyGuardOperation(state, historyId, historyChanges, effectiveFrom = '2026-04-01') {
    return { state, historyId, effectiveFrom,
        maintenance: { historyChanges, employeeChanges: historyChanges,
            submittedFields: Object.keys(historyChanges) } };
}

test('open-cycle hire guard allows unchanged active-employee Save', async () => {
    const initial = openCycleHireGuardState();
    const db = database(initial);
    const hire = initial.employee.hmeromhnia_proslhpshs;
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-04-01',
        maintenance: { employeeChanges: { hmeromhnia_proslhpshs: hire },
            historyChanges: { hmeromhnia_proslhpshs: hire } } });
    assert.equal(new Date(db.state().employee.hmeromhnia_proslhpshs)
        .toISOString().slice(0, 10), '2026-04-01');
});

test('open-cycle hire guard allows ordinary profile change in the active cycle', async () => {
    const db = database(openCycleHireGuardState());
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', input: arrangement, effectiveFrom: '2026-09-15' });
    assert.equal(db.state().history.length, 2);
    assert.equal(new Set(db.state().history.map(row => new Date(row.hmeromhnia_proslhpshs)
        .toISOString().slice(0, 10))).size, 1);
});

test('open-cycle hire guard keeps normal Maintenance hire protection and zero writes', async () => {
    const initial = openCycleHireGuardState();
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-09-15',
        maintenance: { employeeChanges: { hmeromhnia_proslhpshs: '2026-09-15' },
            historyChanges: { hmeromhnia_proslhpshs: '2026-09-15' } } }),
    error => error.code === 'EMPLOYEE_PROFILE_HIRE_DATE_CHANGE_REQUIRES_REHIRE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('open-cycle hire guard rejects History editor hire identity modification with zero writes', async () => {
    const initial = openCycleHireGuardState();
    const db = database(initial);
    const row = initial.history[0];
    await assert.rejects(writeEmployeeEmploymentHistoryOperations({ ...db.dependencies, scope,
        employeeId: 'employee', operations: [historyGuardOperation('modified', row._id,
            { hmeromhnia_proslhpshs: '2026-09-15' })] }),
    error => error.code === 'EMPLOYEE_OPEN_CYCLE_DEPARTURE_REQUIRED_BEFORE_HIRE_CHANGE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('open-cycle hire guard rejects History editor second-cycle insertion with zero writes', async () => {
    const initial = openCycleHireGuardState();
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentHistoryOperations({ ...db.dependencies, scope,
        employeeId: 'employee', operations: [historyGuardOperation('inserted', null,
            { hmeromhnia_proslhpshs: '2026-09-15', afora_proslhpsh: true }, '2026-09-15')] }),
    error => error.code === 'EMPLOYEE_OPEN_CYCLE_DEPARTURE_REQUIRED_BEFORE_HIRE_CHANGE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('open-cycle hire guard rejects conflicting crafted History request with zero writes', async () => {
    const initial = openCycleHireGuardState();
    const db = database(initial);
    const row = initial.history[0];
    const operation = historyGuardOperation('modified', row._id,
        { hmeromhnia_proslhpshs: '2026-09-15', afora_proslhpsh: true });
    operation.maintenance.employeeChanges = { hmeromhnia_proslhpshs: '2026-09-16' };
    await assert.rejects(writeEmployeeEmploymentHistoryOperations({ ...db.dependencies, scope,
        employeeId: 'employee', operations: [operation] }),
    error => error.code === 'EMPLOYEE_OPEN_CYCLE_DEPARTURE_REQUIRED_BEFORE_HIRE_CHANGE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('open-cycle hire guard still allows explicit Departure', async () => {
    const db = database(openCycleHireGuardState());
    await writeEmployeeDeparture({ ...db.dependencies, scope, employeeId: 'employee',
        departureDate: '2026-08-31', effectiveFrom: '2026-04-01' });
    assert.equal(new Date(db.state().employee.hmeromhnia_apoxorhshs)
        .toISOString().slice(0, 10), '2026-08-31');
    assert.equal(new Date(db.state().history[0].hmeromhnia_apoxorhshs)
        .toISOString().slice(0, 10), '2026-08-31');
});


test('ordinary appended profile inherits the existing employment-cycle hire identity', async () => {
    const baseline = buildCompleteProfileSnapshot({ effectiveFrom: '2026-04-01' });
    const initial = {
        employee: {
            _id: 'employee',
            ...scope,
            ...baseline,
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: null
        },
        history: [{
            _id: 'old',
            ...scope,
            ...baseline,
            aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: null,
            afora_proslhpsh: true
        }]
    };
    const db = database(initial);

    await writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        employeeId: 'employee',
        input: arrangement,
        effectiveFrom: '2026-09-15'
    });

    const stored = db.state();
    assert.equal(
        new Date(stored.employee.hmeromhnia_proslhpshs).toISOString().slice(0, 10),
        '2025-01-01'
    );
    assert.equal(
        new Date(stored.history[1].hmeromhnia_proslhpshs).toISOString().slice(0, 10),
        '2025-01-01'
    );
    assert.equal(stored.history[1].afora_proslhpsh, false);
});

test('closed relationship is stored inactive even when submitted active', async () => {
    const db = database();
    await writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        newEmployee: {
            eponymo: 'Closed',
            energos: true,
            hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31'
        },
        effectiveFrom: '2026-01-01'
    });
    assert.equal(db.state().employee.energos, false);
});

test('generic profile correction cannot clear a stored departure', async () => {
    const initial = correctionState();
    initial.employee.hmeromhnia_apoxorhshs = new Date('2026-09-20');
    initial.employee.energos = false;
    initial.history[1].hmeromhnia_apoxorhshs = new Date('2026-09-20');
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', mode: MODE_CORRECT_EXISTING, historyId: 'latest',
        effectiveFrom: '2026-09-01', maintenance: {
            employeeChanges: { hmeromhnia_apoxorhshs: null, energos: true },
            historyChanges: { hmeromhnia_apoxorhshs: null }
        } }), { code: 'EMPLOYEE_DEPARTURE_CANCELLATION_REQUIRES_CONTROLLED_FLOW' });
    assert.equal(db.writes(), 0);
});
test('maintenance departure forces current master inactive', async () => {
    const initial = {
        employee: {
            _id: 'employee',
            ...scope,
            energos: true,
            hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_apoxorhshs: null,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01'
        },
        history: [{
            _id: 'old',
            ...scope,
            aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_apoxorhshs: null,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01',
            hmeromhnia_isxyos_oron_ergasias_eos: null,
            afora_proslhpsh: true
        }]
    };
    const db = database(initial);
    await writeEmployeeEmploymentProfile({
        ...db.dependencies,
        scope,
        employeeId: 'employee',
        effectiveFrom: '2026-01-01',
        maintenance: {
            employeeChanges: {
                energos: true,
                hmeromhnia_apoxorhshs: new Date('2026-07-31')
            },
            historyChanges: {
                hmeromhnia_apoxorhshs: new Date('2026-07-31')
            },
            identity: {
                hmeromhnia_proslhpshs: new Date('2026-01-01'),
                hmeromhnia_allaghs_symbashs: null,
                hmeromhnia_allaghs_orarioy_apo: null,
                hmeromhnia_allaghs_orarioy_eos: null,
                hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-01-01'),
                hmeromhnia_isxyos_oron_ergasias_eos: null,
                hmeromhnia_lhxhs_symbashs: null,
                hmeromhnia_apoxorhshs: null
            },
            originalHistoryId: 'old',
            correctableIdentityFields: ['hmeromhnia_apoxorhshs']
        }
    });
    assert.equal(db.state().employee.energos, false);
});

function deferredAmbiguityDepartureState() {
    const base = { ...scope,
        hmeromhnia_proslhpshs: new Date('2026-06-27T00:00:00.000Z'),
        hmeromhnia_apoxorhshs: null,
        hmeromhnia_lhxhs_symbashs: new Date('2026-10-15T00:00:00.000Z'),
        employment_profile_source: 'ERGOMENOI_CONTROLLER',
        afora_allagh_oron_ergasias: true };
    const row = (id, aa, from, until, scheduleFrom, scheduleUntil, facts) => ({
        _id: id, ...base, aa_eggrafhs: aa,
        hmeromhnia_allaghs_symbashs: new Date(`${facts.contractChange}T00:00:00.000Z`),
        hmeromhnia_allaghs_orarioy_apo: new Date(`${scheduleFrom}T00:00:00.000Z`),
        hmeromhnia_allaghs_orarioy_eos: new Date(`${scheduleUntil}T00:00:00.000Z`),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date(`${from}T00:00:00.000Z`),
        hmeromhnia_isxyos_oron_ergasias_eos: until
            ? new Date(`${until}T00:00:00.000Z`) : null,
        afora_proslhpsh: aa !== '0003', kathestos_apasxolhshs: facts.regime,
        typos_apasxolhshs: facts.type, typos_ebdomadas: facts.weekType,
        hmeres_ergasias_ebdomadas: facts.days,
        ores_ergasias_ebdomadas: facts.hours,
        mo_oron_hmerhsias_ergasias: facts.average,
        pragmatikosMisthos: facts.wage,
        createdAt: new Date(`${scheduleFrom}T06:00:00.000Z`),
        updatedAt: new Date(`${scheduleFrom}T06:10:00.000Z`) });
    const old = row('507f1f77bcf86cd799439301', '0001', '2026-06-27', '2026-07-22',
        '2026-06-27', '2026-07-03', { contractChange: '2026-06-27', regime: '2',
            type: '5', weekType: '', days: 2, hours: 16, average: 8, wage: 435.6 });
    const overlap = row('507f1f77bcf86cd799439302', '0002', '2026-06-27', null,
        '2026-07-13', '2026-07-19', { contractChange: '2026-06-27', regime: '2',
            type: '5', weekType: '', days: 4, hours: 34, average: 8.5, wage: 925.65 });
    const latest = row('507f1f77bcf86cd799439303', '0003', '2026-07-23', null,
        '2026-07-23', '2026-07-29', { contractChange: '2026-07-23', regime: '0',
            type: '0', weekType: '5HMERH', days: 5, hours: 40, average: 8, wage: 1089 });
    return { employee: { ...latest, _id: 'employee', aa_eggrafhs: undefined,
        afora_proslhpsh: undefined, energos: true }, history: [old, overlap, latest], audits: [] };
}

test('departure with older-only ambiguity preserves old rows and changes the unique anchor', async () => {
    const initial = deferredAmbiguityDepartureState();
    const oldBefore = structuredClone(initial.history.slice(0, 2));
    const db = database(initial);
    const result = await writeEmployeeDeparture({ ...db.dependencies, scope, employeeId: 'employee',
        departureDate: '2026-09-29', effectiveFrom: '2026-07-23',
        input: {}, maintenance: { employeeChanges: {}, submittedEmployeeFields: [],
            historyChanges: {}, submittedHistoryChanges: {}, submittedFormFields: [] } });
    const state = db.state();
    assert.equal(result.deferredAmbiguityDeparturePlan.status,
        'APPLYABLE_DEPARTURE_WITH_DEFERRED_HISTORY_AMBIGUITY');
    assert.equal(result.deferredAmbiguityDeparturePostcondition.ok, true);
    assert.deepEqual(state.history.slice(0, 2), oldBefore);
    assert.equal(state.history.length, 3);
    assert.equal(state.employee.hmeromhnia_apoxorhshs.toISOString(),
        '2026-09-29T00:00:00.000Z');
    assert.equal(state.history[2].hmeromhnia_apoxorhshs.toISOString(),
        '2026-09-29T00:00:00.000Z');
    assert.equal(state.audits[0].mutationSource,
        'DEPARTURE_WITH_DEFERRED_HISTORY_AMBIGUITY');
});

test('deferred-ambiguity departure rejects a simultaneous employee change before writes', async () => {
    const db = database(deferredAmbiguityDepartureState());
    await assert.rejects(writeEmployeeDeparture({ ...db.dependencies, scope,
        employeeId: 'employee', departureDate: '2026-09-29', effectiveFrom: '2026-07-23',
        maintenance: { employeeChanges: { email: 'changed@example.invalid' },
            submittedEmployeeFields: ['email'], submittedFormFields: ['email'],
            historyChanges: {}, submittedHistoryChanges: {} } }), error =>
        error.code === 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE');
    assert.equal(db.writes(), 0);
});

test('deferred-ambiguity final verification failure rolls back the whole transaction', async () => {
    const initial = deferredAmbiguityDepartureState();
    const db = database(initial, '', false, { pretendUpdateSuccess: true });
    await assert.rejects(writeEmployeeDeparture({ ...db.dependencies, scope,
        employeeId: 'employee', departureDate: '2026-09-29', effectiveFrom: '2026-07-23',
        maintenance: { employeeChanges: {}, submittedEmployeeFields: [],
            historyChanges: {}, submittedHistoryChanges: {}, submittedFormFields: [] } }),
    error => error.code === 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED');
    assert.deepEqual(db.state(), initial);
});

const INVALID_DEPARTURE_HISTORY_ID = '6a149e44452cce439d38287a';
function invalidDepartureWriterState({ extraHistory = [] } = {}) {
    const profile = buildCompleteProfileSnapshot({ effectiveFrom: '2026-05-01' });
    const lifecycle = {
        hmeromhnia_proslhpshs: '2026-05-01',
        hmeromhnia_apoxorhshs: '2026-04-30',
        hmeromhnia_allaghs_symbashs: '2026-05-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-05-07',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01',
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: '2026-10-31'
    };
    const row = { _id: INVALID_DEPARTURE_HISTORY_ID, ...scope, ...profile, ...lifecycle,
        aa_eggrafhs: '0001', afora_proslhpsh: true,
        createdAt: '2026-05-01T08:00:00.000Z', updatedAt: '2026-05-02T08:00:00.000Z' };
    return { employee: { ...row, _id: 'employee', energos: true, archived: false },
        history: [row, ...extraHistory], audits: [] };
}
function invalidDepartureRequest(db, overrides = {}) {
    const state = db.state();
    return writeEmployeeInvalidDepartureCorrection({ ...db.dependencies, scope,
        employeeId: 'employee',
        expectedRevision: state.history.find(row => row._id === INVALID_DEPARTURE_HISTORY_ID)?.updatedAt,
        expectedStoredDeparture: state.employee.hmeromhnia_apoxorhshs,
        input: {}, maintenance: {}, ...overrides });
}

test('server-owned invalid departure correction clears only the proven current and history fact', async () => {
    const initial = invalidDepartureWriterState();
    const db = database(initial);
    const result = await invalidDepartureRequest(db);
    const stored = db.state();
    assert.equal(result.mode, 'MODE_INVALID_DEPARTURE_CORRECTION');
    assert.equal(stored.employee.hmeromhnia_apoxorhshs, null);
    assert.equal(stored.employee.hmeromhnia_proslhpshs, '2026-05-01');
    assert.equal(stored.employee.energos, true);
    assert.equal(stored.history.length, 1);
    assert.equal(stored.history[0]._id, INVALID_DEPARTURE_HISTORY_ID);
    assert.equal(stored.history[0].hmeromhnia_apoxorhshs, null);
    assert.equal(stored.audits.length, 1);
    assert.equal(stored.audits[0].mutationSource, 'HISTORY_INVALID_DEPARTURE_CORRECTION');
});

test('server-owned invalid departure correction rejects competing evidence without writes', async () => {
    const base = invalidDepartureWriterState();
    const competing = { ...base.history[0], _id: '6a149e44452cce439d38287b',
        aa_eggrafhs: '0002', updatedAt: '2026-05-03T08:00:00.000Z' };
    const initial = invalidDepartureWriterState({ extraHistory: [competing] });
    const db = database(initial);
    await assert.rejects(invalidDepartureRequest(db), error =>
        error.code === 'EMPLOYEE_HISTORY_INVALID_DEPARTURE_TARGET_MISMATCH');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('invalid departure correction rejects stale revision and stored-departure mismatch', async () => {
    for (const overrides of [{ expectedRevision: '2026-05-01T00:00:00.000Z' },
        { expectedStoredDeparture: '2026-04-29' }]) {
        const initial = invalidDepartureWriterState();
        const db = database(initial);
        await assert.rejects(invalidDepartureRequest(db, overrides), error =>
            error.code === 'EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE');
        assert.equal(db.writes(), 0);
        assert.deepEqual(db.state(), initial);
    }
});

test('invalid departure correction blocks unknown protected-reference semantics', async () => {
    const initial = invalidDepartureWriterState();
    const db = database(initial);
    await assert.rejects(invalidDepartureRequest(db, {
        referenceChecker: async () => [{ collection: 'Unknown_Protected_Collection' }]
    }), error => error.code === 'EMPLOYEE_HISTORY_REFERENCE_CHECK_FAILED');
    assert.deepEqual(db.state(), initial);
});

test('invalid departure final verification mismatch rolls back employee, history and audit', async () => {
    const initial = invalidDepartureWriterState();
    const db = database(initial, '', false, { pretendUpdateSuccess: true });
    await assert.rejects(invalidDepartureRequest(db), error =>
        error.code === 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED');
    assert.deepEqual(db.state(), initial);
});

test('invalid departure correction fails closed without transaction support', async () => {
    const initial = invalidDepartureWriterState();
    const db = database(initial);
    await assert.rejects(invalidDepartureRequest(db, { capabilityProbe: async () => false }),
        error => error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('0068 sparse legacy contract-end correction keeps the same row and repeated Save is a no-op', async () => {
    const sparse = { _id: '0068-history-0001', ...scope, aa_eggrafhs: '0001',
        hmeromhnia_proslhpshs: '2026-05-01',
        hmeromhnia_allaghs_symbashs: '2026-05-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-05-07',
        hmeromhnia_lhxhs_symbashs: null };
    const initial = { employee: { ...sparse, _id: 'employee' }, history: [sparse] };
    const db = database(initial);
    const maintenance = { originalHistoryId: sparse._id,
        employeeChanges: { hmeromhnia_lhxhs_symbashs: '2026-10-31' },
        historyChanges: { hmeromhnia_lhxhs_symbashs: '2026-10-31' } };
    const first = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-05-01', maintenance });
    assert.equal(first.history._id, sparse._id);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().employee.hmeromhnia_lhxhs_symbashs, '2026-10-31');
    assert.equal(db.state().history[0].hmeromhnia_lhxhs_symbashs, '2026-10-31');
    assert.equal(db.writes(), 3);
    assert.equal(db.state().audits.length, 1);
    assert.equal(db.state().audits[0].mutationSource, CONTRACT_END_SEGMENT_SYNC_OPERATION);
    const writesAfterFirst = db.writes();
    const second = await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-05-01', maintenance });
    assert.equal(second.mode, 'NO_HISTORY_CHANGE');
    assert.equal(second.idempotent, true);
    assert.equal(db.writes(), writesAfterFirst);
    assert.equal(db.state().history.length, 1);
});

const CONTRACT_SEGMENT_IDS = Object.freeze({ first: 'contract-segment-first',
    latest: 'contract-segment-latest' });
const contractSegmentFacts = {
    kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8
};
function contractSegmentWriterRow(id, sequence, from, until, hireEvent) {
    return { ...buildCompleteProfileSnapshot({ input: contractSegmentFacts,
        current: contractSegmentFacts, effectiveFrom: from }), _id: id, ...scope,
    aa_eggrafhs: sequence, hmeromhnia_proslhpshs: '2026-01-01',
    hmeromhnia_allaghs_symbashs: '2026-01-01',
    hmeromhnia_lhxhs_symbashs: '2026-12-31',
    hmeromhnia_allaghs_orarioy_apo: from,
    hmeromhnia_allaghs_orarioy_eos: from,
    hmeromhnia_isxyos_oron_ergasias_apo: from,
    hmeromhnia_isxyos_oron_ergasias_eos: until,
    afora_proslhpsh: hireEvent, afora_allagh_oron_ergasias: true,
    createdAt: `2026-01-0${sequence}T00:00:00.000Z`,
    updatedAt: `2026-01-0${sequence}T00:00:00.000Z` };
}
function contractSegmentWriterState({ partial = false } = {}) {
    const first = contractSegmentWriterRow(CONTRACT_SEGMENT_IDS.first, '1',
        '2026-01-01', '2026-05-31', true);
    const latest = contractSegmentWriterRow(CONTRACT_SEGMENT_IDS.latest, '2',
        '2026-06-01', null, false);
    const employee = { ...latest, _id: 'employee', aa_eggrafhs: undefined,
        afora_proslhpsh: undefined, afora_allagh_oron_ergasias: undefined,
        energos: true, archived: false };
    if (partial) {
        employee.hmeromhnia_lhxhs_symbashs = '2027-01-31';
        latest.hmeromhnia_lhxhs_symbashs = '2027-01-31';
    }
    return { employee, history: [first, latest] };
}
function saveContractSegment(db) {
    return writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-06-01', input: {},
        maintenance: {
            originalHistoryId: CONTRACT_SEGMENT_IDS.latest,
            employeeChanges: { hmeromhnia_lhxhs_symbashs: '2027-01-31' },
            historyChanges: { hmeromhnia_lhxhs_symbashs: '2027-01-31' },
            submittedEmployeeFields: ['hmeromhnia_lhxhs_symbashs'],
            submittedHistoryChanges: { hmeromhnia_lhxhs_symbashs: '2027-01-31' },
            submittedProfileFields: []
        }
    });
}

test('contract-end Save synchronizes the canonical segment without changing stable ids', async () => {
    const initial = contractSegmentWriterState();
    const ids = initial.history.map(row => row._id);
    const db = database(initial);
    const result = await saveContractSegment(db);
    assert.equal(result.mode, CONTRACT_END_SEGMENT_SYNC_OPERATION);
    assert.equal(result.status, 'APPLYABLE');
    assert.deepEqual(db.state().history.map(row => row._id), ids);
    assert.ok(db.state().history.every(row =>
        row.hmeromhnia_lhxhs_symbashs === '2027-01-31'));
    assert.equal(db.state().employee.hmeromhnia_lhxhs_symbashs, '2027-01-31');
    assert.deepEqual(db.operations(), { employeeUpdates: 1, employeeCreates: 0,
        employeeDeletes: 0, historyUpdates: 2, historyFenceUpdates: 0,
        historyDeletes: 0, historyCreates: 0, auditCreates: 1, deletedCounts: [] });
});

test('partial contract-end synchronization updates only stale segment rows', async () => {
    const db = database(contractSegmentWriterState({ partial: true }));
    const result = await saveContractSegment(db);
    assert.equal(result.status, 'APPLYABLE_PARTIAL_SEGMENT_SYNC');
    assert.deepEqual(result.contractEndSegmentPlan.currentPatch, {});
    assert.deepEqual(result.contractEndSegmentPlan.changedHistoryIds,
        [CONTRACT_SEGMENT_IDS.first]);
    assert.equal(db.operations().employeeUpdates, 0);
    assert.equal(db.operations().historyUpdates, 1);
});

test('contract-end synchronization preserves frozen references', async () => {
    const db = database(contractSegmentWriterState());
    db.dependencies.referenceChecker = async ({ historyIds }) => historyIds.map(historyId => ({
        historyId, collection: 'Apasxoliseis_Period_Frozen_Snapshots',
        documentId: `frozen-${historyId}`
    }));
    const result = await saveContractSegment(db);
    assert.equal(result.cleanup.referencedUpdates.length, 2);
    assert.equal(db.state().audits[0].diagnostics.referencedUpdates.length, 2);
});

test('contract-end synchronization rolls back on write or final-verification failure', async () => {
    for (const [name, db] of [
        ['history update', database(contractSegmentWriterState(),
            `close:${CONTRACT_SEGMENT_IDS.first}`)],
        ['final verification', database(contractSegmentWriterState(), '', false,
            { pretendUpdateSuccess: true })]
    ]) {
        const before = structuredClone(db.state());
        await assert.rejects(saveContractSegment(db), name);
        assert.deepEqual(db.state(), before, name);
    }
});

const lifecycleSaveScope = { team: 'LIFECYCLE', company_kod: 'company', kodikos: '0014' };
function lifecycleSaveRow(id, sequence, extra = {}) {
    return { _id: id, ...lifecycleSaveScope, aa_eggrafhs: sequence,
        hmeromhnia_proslhpshs: '2026-04-25',
        hmeromhnia_allaghs_symbashs: '2026-04-25',
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: false, ...extra };
}
function lifecycleSaveState() {
    const history = [
        lifecycleSaveRow('lifecycle-hire', '0001', {
            hmeromhnia_allaghs_orarioy_apo: '2026-04-25' }),
        lifecycleSaveRow('lifecycle-profile-1', '0002', {
            hmeromhnia_allaghs_orarioy_apo: '2026-05-25',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-06-14',
            afora_allagh_oron_ergasias: true }),
        lifecycleSaveRow('lifecycle-technical-1', '0003', {
            hmeromhnia_allaghs_orarioy_apo: '2026-06-02' }),
        lifecycleSaveRow('lifecycle-technical-2', '0004', {
            hmeromhnia_allaghs_orarioy_apo: '2026-06-14' }),
        lifecycleSaveRow('lifecycle-profile-2', '0005', {
            hmeromhnia_allaghs_orarioy_apo: '2026-06-16',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-15',
            hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-20',
            afora_allagh_oron_ergasias: true }),
        lifecycleSaveRow('lifecycle-departure', '0006', {
            hmeromhnia_allaghs_orarioy_apo: '2026-07-06',
            hmeromhnia_apoxorhshs: '2026-09-20' })
    ];
    return { employee: { _id: 'lifecycle-employee', ...lifecycleSaveScope,
        hmeromhnia_proslhpshs: '2026-04-25', hmeromhnia_apoxorhshs: '2026-09-20' },
    history };
}
function saveLifecycleRepair(db) {
    return writeEmployeeEmploymentProfile({ ...db.dependencies, scope: lifecycleSaveScope,
        employeeId: 'lifecycle-employee', effectiveFrom: '2026-06-15', input: {},
        maintenance: { employeeChanges: {}, historyChanges: {} } });
}

test('ordinary Save applies only uniquely proven lifecycle reclassification', async () => {
    const initial = lifecycleSaveState();
    const ids = initial.history.map(row => row._id);
    const db = database(initial);
    const result = await saveLifecycleRepair(db);
    assert.equal(result.mode, 'NO_HISTORY_CHANGE');
    assert.deepEqual(db.state().history.map(row => row._id), ids);
    assert.equal(db.state().history[0].afora_proslhpsh, true);
    assert.ok(db.state().history.slice(1).every(row => row.afora_proslhpsh === false));
    assert.equal(db.state().audits.length, 1);
    assert.equal(db.state().audits[0].mutationSource,
        'HISTORY_LIFECYCLE_RECLASSIFICATION');
});

test('ordinary lifecycle repair rolls back when final verification detects unapplied flags', async () => {
    const initial = lifecycleSaveState();
    const db = database(initial, '', false, { pretendUpdateSuccess: true });
    await assert.rejects(saveLifecycleRepair(db), error =>
        error.code === 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED');
    assert.deepEqual(db.state(), initial);
});

test('successful mutation advances revision, stale second tab writes nothing and no-op keeps revision', async () => {
    const r1 = '2026-09-26T08:00:00.000Z';
    const sparse = { _id: 'two-tab-history', ...scope, aa_eggrafhs: '0001', updatedAt: r1,
        hmeromhnia_proslhpshs: '2026-05-01',
        hmeromhnia_allaghs_symbashs: '2026-05-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-05-07',
        hmeromhnia_lhxhs_symbashs: null };
    const db = database({ employee: { ...sparse, _id: 'employee' }, history: [sparse] });
    const save = (contractEnd, expectedRevision) => writeEmployeeEmploymentProfile({
        ...db.dependencies, scope, employeeId: 'employee', effectiveFrom: '2026-05-01',
        maintenance: { originalHistoryId: sparse._id, expectedRevision,
            employeeChanges: { hmeromhnia_lhxhs_symbashs: contractEnd },
            historyChanges: { hmeromhnia_lhxhs_symbashs: contractEnd } }
    });

    await save('2026-10-31', r1);
    const r2 = db.state().history[0].updatedAt;
    assert.ok(new Date(r2).getTime() > new Date(r1).getTime());
    const writesAfterTabA = db.writes();
    await assert.rejects(save('2026-11-30', r1), error => error.code === 'CONFLICT_STALE');
    assert.equal(db.writes(), writesAfterTabA);
    assert.equal(db.state().history[0].hmeromhnia_lhxhs_symbashs, '2026-10-31');

    const noOp = await save('2026-10-31', r2);
    assert.equal(noOp.mode, 'NO_HISTORY_CHANGE');
    assert.equal(db.writes(), writesAfterTabA);
    assert.deepEqual(db.state().history[0].updatedAt, r2);
});

function polluted0069State() {
    const fixture = buildReal0069SanitizedHistoryFixture();
    return { employee: fixture.currentEmployee, history: fixture.history };
}

function save0069(db, originalHistoryId) {
    return writeEmployeeEmploymentProfile({ ...db.dependencies, scope: REAL_0069_SCOPE,
        employeeId: REAL_0069_IDS.employee, effectiveFrom: '2026-05-02', maintenance: {
            originalHistoryId,
            employeeChanges: { hmeromhnia_lhxhs_symbashs: '2026-10-31' },
            historyChanges: { hmeromhnia_lhxhs_symbashs: '2026-10-31' }
        } });
}

test('targeted history deletion normalizes one, many and empty ObjectId sets', () => {
    const one = buildScopedHistoryDeleteFilter(REAL_0069_SCOPE, [REAL_0069_IDS['0002']]);
    assert.deepEqual(Object.keys(one), ['team', 'company_kod', 'kodikos', '_id']);
    assert.equal(one.team, 'BLG');
    assert.equal(one.company_kod, REAL_0069_SCOPE.company_kod);
    assert.equal(one.kodikos, '0069');
    assert.ok(one._id.$in[0] instanceof mongoose.Types.ObjectId);
    assert.deepEqual(one._id.$in.map(String), [REAL_0069_IDS['0002']]);

    const ids = [REAL_0069_IDS['0002'], REAL_0069_IDS['0003'], REAL_0069_IDS['0004']];
    const many = buildScopedHistoryDeleteFilter(REAL_0069_SCOPE, ids);
    assert.deepEqual(many._id.$in.map(String), ids);
    assert.ok(Object.getOwnPropertySymbols(many._id).length > 0);
    assert.equal(buildScopedHistoryDeleteFilter(REAL_0069_SCOPE, []), null);
    assert.deepEqual(normalizeHistoryObjectIds([]), []);
    assert.throws(() => normalizeHistoryObjectIds(['not-an-object-id']),
        /Invalid employee history ObjectId/);
});

test('real 0069 delete path reproduces the raw CastError and accepts the narrowly trusted filter', async () => {
    const ids = [REAL_0069_IDS['0002'], REAL_0069_IDS['0003'], REAL_0069_IDS['0004']];
    const previousSanitizeFilter = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        const badQuery = IstorikoProslhpseonAllagonModel.deleteMany({
            ...REAL_0069_SCOPE,
            _id: { $in: ids }
        });
        mongoose.sanitizeFilter(badQuery.getFilter());
        assert.throws(() => badQuery.cast(IstorikoProslhpseonAllagonModel), error =>
            error.name === 'CastError' && error.path === '_id' &&
            JSON.stringify(error.value) === JSON.stringify({ $in: ids }));

        const db = database(polluted0069State(), '', false, { castFilter: true });
        const result = await save0069(db, REAL_0069_IDS['0005']);
        assert.equal(result.status, 'AUTO_REPAIRABLE');
        assert.equal(db.deleteFilters().length, 1);
        const filter = db.deleteFilters()[0];
        assert.equal(filter.team, 'BLG');
        assert.equal(filter.company_kod, REAL_0069_SCOPE.company_kod);
        assert.equal(filter.kodikos, '0069');
        assert.deepEqual(filter._id.$in.map(String), ids);
        assert.ok(filter._id.$in.every(id => id instanceof mongoose.Types.ObjectId));
        assert.deepEqual(db.state().history.map(row => row.aa_eggrafhs), ['0001', '0005']);
        assert.equal(db.state().history[1].hmeromhnia_lhxhs_symbashs, '2026-10-31');
        assert.equal(db.state().audits.length, 1);
        assert.equal(db.writes(), 4);
        assert.deepEqual(db.operations(), {
            employeeUpdates: 0,
            employeeCreates: 0,
            employeeDeletes: 0,
            historyUpdates: 1,
            historyFenceUpdates: 1,
            historyDeletes: 1,
            historyCreates: 0,
            auditCreates: 1,
            deletedCounts: [3]
        });
        assert.equal(db.ended(), true);

        const writesAfterFirst = db.writes();
        const operationsAfterFirst = db.operations();
        const second = await save0069(db, REAL_0069_IDS['0005']);
        assert.equal(second.mode, 'NO_HISTORY_CHANGE');
        assert.equal(db.writes(), writesAfterFirst);
        assert.equal(db.deleteFilters().length, 1);
        assert.deepEqual(db.operations(), operationsAfterFirst);
    } finally {
        mongoose.set('sanitizeFilter', previousSanitizeFilter);
    }
});

test('targeted cleanup scope cannot delete a foreign-team history row', async () => {
    const initial = polluted0069State();
    const foreign = { ...initial.history[1], _id: '507f1f77bcf86cd799439099', team: 'FOREIGN',
        aa_eggrafhs: '9000' };
    initial.history.push(foreign);
    const db = database(initial, '', false, { scopeFind: true });
    await save0069(db, REAL_0069_IDS['0005']);
    assert.ok(db.state().history.some(row => row._id === foreign._id && row.team === 'FOREIGN'));
    assert.deepEqual(db.state().history.filter(row => row.team === 'BLG').map(row => row.aa_eggrafhs),
        ['0001', '0005']);
});

test('invalid cleanup ObjectId fails before audit or data writes', async () => {
    const initial = polluted0069State();
    initial.history[1]._id = 'invalid-history-id';
    const db = database(initial);
    await assert.rejects(save0069(db, REAL_0069_IDS['0005']),
        /Invalid employee history ObjectId/);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('deletedCount mismatch and delete failure roll back audit, update and deletion', async () => {
    for (const [name, db] of [
        ['count mismatch', database(polluted0069State(), '', false, { deletedCount: 2 })],
        ['delete failure', database(polluted0069State(), 'cleanup')]
    ]) {
        const before = polluted0069State();
        await assert.rejects(save0069(db, REAL_0069_IDS['0005']), error =>
            name === 'count mismatch' ? error.code === 'EMPLOYEE_PROFILE_HISTORY_STALE' :
                error.message === 'cleanup failed', name);
        assert.deepEqual(db.state(), before, name);
        assert.equal(db.ended(), true, name);
    }
});

test('0069 deterministic polluted history preserves 0001, repairs 0005 and removes only duplicate snapshots', async () => {
    const initial = polluted0069State();
    assert.deepEqual(selectMaintenanceMode(initial.history, initial.employee, initial.employee), {
        mode: MODE_CORRECT_EXISTING,
        historyId: REAL_0069_IDS['0005']
    });
    for (const originalHistoryId of initial.history.map(row => row._id)) {
        const db = database(initial);
        const result = await save0069(db, originalHistoryId);
        assert.equal(result.history._id, REAL_0069_IDS['0005'], originalHistoryId);
        assert.equal(result.cleanup.verified.rebuilt.cleanupRequired, false, originalHistoryId);
        assert.equal(result.cleanup.verified.rebuilt.status, 'CLEAN', originalHistoryId);
        assert.equal(db.state().history.length, 2, originalHistoryId);
        assert.deepEqual(db.state().history.map(row => row.aa_eggrafhs), ['0001', '0005'], originalHistoryId);
        assert.equal(db.state().history[1].hmeromhnia_lhxhs_symbashs, '2026-10-31', originalHistoryId);
        assert.deepEqual(db.state().history[0], initial.history[0], originalHistoryId);
        assert.equal(db.state().audits.length, 1, originalHistoryId);
        assert.deepEqual(db.state().audits[0].deletedLegacyHistoryIds,
            [REAL_0069_IDS['0002'], REAL_0069_IDS['0003'], REAL_0069_IDS['0004']], originalHistoryId);
        assert.equal(db.state().audits[0].historyBefore.length, 5, originalHistoryId);
        assert.equal(db.state().audits[0].historyAfter.length, 2, originalHistoryId);
        const committedProjection = db.state().history.map(row => Object.fromEntries(
            Object.keys(db.state().audits[0].historyAfter.find(item => item._id === row._id))
                .map(field => [field, row[field]])));
        assert.deepEqual(JSON.parse(JSON.stringify(committedProjection)),
            JSON.parse(JSON.stringify(db.state().audits[0].historyAfter)), originalHistoryId);
        assert.deepEqual(db.state().audits[0].survivingHistoryIds,
            [REAL_0069_IDS['0001'], REAL_0069_IDS['0005']], originalHistoryId);
        assert.equal(db.writes(), 4, originalHistoryId);
    }
    const db = database(initial);
    await save0069(db, REAL_0069_IDS['0002']);
    const writesAfterFirst = db.writes();
    const second = await save0069(db, REAL_0069_IDS['0005']);
    assert.equal(second.mode, 'NO_HISTORY_CHANGE');
    assert.equal(second.idempotent, true);
    assert.equal(db.writes(), writesAfterFirst);
    assert.equal(db.state().history.length, 2);
    assert.equal(db.state().audits.length, 1);
});

test('controlled legacy normalization uses the canonical writer and is idempotent', async () => {
    const db = database(polluted0069State());
    const first = await repairEmployeeHistoryCanonical({ ...db.dependencies,
        scope: REAL_0069_SCOPE, employeeId: REAL_0069_IDS.employee });
    assert.equal(first.changed, true);
    assert.deepEqual(db.state().history.map(row => String(row._id)),
        [REAL_0069_IDS['0001'], REAL_0069_IDS['0005']]);
    const writesAfterFirst = db.writes();
    const second = await repairEmployeeHistoryCanonical({ ...db.dependencies,
        scope: REAL_0069_SCOPE, employeeId: REAL_0069_IDS.employee });
    assert.equal(second.changed, false);
    assert.equal(db.writes(), writesAfterFirst);
});

test('controlled legacy open-cycle cleanup uses the shared transactional mutation boundary', async () => {
    const oldId = '507f1f77bcf86cd799439131';
    const currentId = '507f1f77bcf86cd799439132';
    const employee = { _id: 'employee', ...scope,
        hmeromhnia_proslhpshs: '2026-05-01', hmeromhnia_apoxorhshs: null };
    const db = database({ employee, history: [
        { _id: oldId, ...scope, aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2025-05-01', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false },
        { _id: currentId, ...scope, aa_eggrafhs: '0002',
            hmeromhnia_proslhpshs: '2026-05-01', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false }
    ] });
    const result = await repairEmployeeLegacyOpenCycles({ ...db.dependencies,
        scope, employeeId: 'employee' });
    assert.deepEqual(db.state().employee, employee);
    assert.deepEqual(db.state().history.map(row => String(row._id)), [currentId]);
    assert.equal(db.operations().employeeUpdates, 0);
    assert.equal(db.operations().historyFenceUpdates, 1);
    assert.equal(db.operations().historyDeletes, 1);
    assert.equal(db.operations().auditCreates, 1);
    assert.equal(result.canonical.status, 'CLEAN');
    assert.equal(result.canonical.cleanupRequired, false);
});

test('referenced corrupted legacy open cycle is blocked before any write', async () => {
    const oldId = '507f1f77bcf86cd799439141';
    const currentId = '507f1f77bcf86cd799439142';
    const initial = { employee: { _id: 'employee', ...scope,
        hmeromhnia_proslhpshs: '2026-05-01', hmeromhnia_apoxorhshs: null }, history: [
        { _id: oldId, ...scope, aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2025-05-01', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false },
        { _id: currentId, ...scope, aa_eggrafhs: '0002',
            hmeromhnia_proslhpshs: '2026-05-01', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false }
    ] };
    const db = database(initial);
    await assert.rejects(repairEmployeeLegacyOpenCycles({ ...db.dependencies,
        scope, employeeId: 'employee', referenceChecker: async ({ historyIds }) =>
            historyIds.map(String).includes(oldId)
                ? [{ collection: 'Prodhlomena_Oraria_Deviations', documentId: 'frozen-1' }]
                : [] }), error => error.code === 'BLOCKED_REFERENCED_CORRUPTED_CYCLE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('legacy open-cycle cleanup rejects a stale dry-run fingerprint before writes', async () => {
    const oldId = '507f1f77bcf86cd799439143';
    const currentId = '507f1f77bcf86cd799439144';
    const initial = { employee: { _id: 'employee', ...scope,
        hmeromhnia_proslhpshs: '2026-05-01', hmeromhnia_apoxorhshs: null }, history: [
        { _id: oldId, ...scope, aa_eggrafhs: '0001',
            hmeromhnia_proslhpshs: '2025-05-01', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false },
        { _id: currentId, ...scope, aa_eggrafhs: '0002',
            hmeromhnia_proslhpshs: '2026-05-01', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: false }
    ] };
    const db = database(initial);
    await assert.rejects(repairEmployeeLegacyOpenCycles({ ...db.dependencies,
        scope, employeeId: 'employee', expectedPlanFingerprint: 'a'.repeat(64) }),
    error => error.code === 'EMPLOYEE_LEGACY_OPEN_CYCLE_CLEANUP_FINGERPRINT_MISMATCH');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('final verification rolls back when successful counts hide an unapplied update or deletion', async () => {
    for (const [name, behavior] of [
        ['update', { pretendUpdateSuccess: true }],
        ['delete', { pretendDeleteSuccess: true }],
        ['unexpected insert', { injectUnexpectedHistory: true }]
    ]) {
        const initial = polluted0069State();
        const db = database(initial, '', false, behavior);
        await assert.rejects(save0069(db, REAL_0069_IDS['0005']), error =>
            error.code === 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED', name);
        assert.deepEqual(db.state(), initial, name);
        assert.equal(db.ended(), true, name);
    }
});

test('sparse surviving row enrichment is identical in committed history and repair audit', async () => {
    const ids = ['507f1f77bcf86cd799439121', '507f1f77bcf86cd799439122'];
    const complete = { ...buildCompleteProfileSnapshot({ effectiveFrom: '2026-05-01' }),
        hmeromhnia_proslhpshs: '2026-05-01', hmeromhnia_lhxhs_symbashs: null,
        kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8 };
    const sparse = ids.map((id, index) => ({ _id: id, ...scope,
        aa_eggrafhs: String(index + 1).padStart(4, '0'),
        createdAt: new Date(`2026-05-0${index + 1}T08:00:00.000Z`),
        updatedAt: new Date(`2026-05-0${index + 1}T08:00:00.000Z`),
        hmeromhnia_proslhpshs: '2026-05-01',
        hmeromhnia_allaghs_symbashs: '2026-05-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-05-07',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01',
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: null }));
    const db = database({ employee: { _id: 'employee', ...scope, ...complete },
        history: sparse });
    await writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-05-01', maintenance: {
            originalHistoryId: ids[1], expectedRevision: sparse[1].updatedAt,
            employeeChanges: { hmeromhnia_lhxhs_symbashs: '2026-10-31' },
            historyChanges: { hmeromhnia_lhxhs_symbashs: '2026-10-31' }
        } });
    const state = db.state();
    assert.deepEqual(state.history.map(row => row._id), [ids[1]]);
    assert.equal(C.readEmploymentProfile(state.history[0]).recorded, true);
    assert.equal(state.audits.length, 1);
    const auditAfter = state.audits[0].historyAfter;
    const committedProjection = state.history.map(row => Object.fromEntries(
        Object.keys(auditAfter[0]).map(field => [field, row[field]])));
    assert.deepEqual(JSON.parse(JSON.stringify(committedProjection)),
        JSON.parse(JSON.stringify(auditAfter)));
});

test('competing genuine lifecycle boundaries perform zero writes', async () => {
    const initial = polluted0069State();
    const competing = { ...initial.history[0], _id: '0069-competing-hire', aa_eggrafhs: '0006',
        hmeromhnia_allaghs_symbashs: '2026-05-03',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-03',
        createdAt: '2026-10-01T08:00:00.000Z' };
    initial.history.push(competing);
    const db = database(initial);
    await assert.rejects(save0069(db, REAL_0069_IDS['0005']), error =>
        error.code === 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED' && error.statusCode === 409);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('referenced duplicate history ids remain physical and become semantically inert', async () => {
    const initial = polluted0069State();
    const db = database(initial);
    const result = await save0069({ ...db,
        dependencies: { ...db.dependencies, referenceChecker: async () => [{
            collection: 'Prodhlomena_Oraria_Deviations', documentId: 'deviation-1'
        }] }
    }, REAL_0069_IDS['0005']);
    assert.equal(result.cleanup.referencedRedundant.length, 3);
    assert.equal(db.operations().historyFenceUpdates, 1);
    assert.equal(db.operations().auditCreates, 1);
    assert.equal(db.operations().historyDeletes, 0);
    assert.equal(db.operations().historyUpdates, 4);
    const retained = db.state().history.filter(row =>
        [REAL_0069_IDS['0002'], REAL_0069_IDS['0003'], REAL_0069_IDS['0004']]
            .includes(String(row._id)));
    assert.equal(retained.length, 3);
    assert.ok(retained.every(row => row.employment_history_canonical_status ===
        'REDUNDANT_REFERENCED'));
    assert.ok(retained.every(row => String(row.employment_history_canonical_survivor_id) ===
        REAL_0069_IDS['0005']));
});

test('real 0006/0002 unchanged Save keeps all three semantic ids and normalizes once', async () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const db = database({ employee: fixture.currentEmployee, history: fixture.history });
    const dependencies = db.dependencies;
    const save = () => writeEmployeeEmploymentProfile({ ...dependencies,
        scope: fixture.scope, employeeId: String(fixture.currentEmployee._id),
        effectiveFrom: '2026-09-16', input: C.readEmploymentProfile(fixture.currentEmployee).facts,
        maintenance: { originalHistoryId: REAL_0002_IDS.CURRENT_PROFILE,
            employeeChanges: {}, historyChanges: {}, submittedEmployeeFields: [],
            submittedProfileFields: [], submittedHistoryChanges: {} } });

    const first = await save();
    assert.deepEqual(db.state().history.map(row => String(row._id)), [
        REAL_0002_IDS.OLD_PROFILE, REAL_0002_IDS.DEPARTURE, REAL_0002_IDS.CURRENT_PROFILE
    ]);
    assert.equal(new Date(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_eos)
        .toISOString().slice(0, 10), '2026-07-31');
    assert.equal(db.operations().employeeUpdates, 0);
    assert.equal(db.operations().historyUpdates, 1);
    assert.equal(db.operations().historyDeletes, 0);
    assert.equal(db.operations().historyCreates, 0);
    assert.equal(db.operations().auditCreates, 1);
    assert.deepEqual(first.cleanup.referencedUpdates, []);
    const afterFirst = structuredClone(db.state());
    const writesAfterFirst = db.writes();

    const second = await save();
    assert.equal(second.mode, 'NO_HISTORY_CHANGE');
    assert.equal(db.writes(), writesAfterFirst);
    assert.deepEqual(db.state(), afterFirst);
    assert.equal(db.state().audits.length, 1);
});

for (const collection of SUPPORTED_COLLECTIONS) test(
    `referenced canonical UPDATE preserves the stable id for frozen consumer ${collection}`,
    async () => {
        const fixture = buildReal0002SanitizedHistoryFixture();
        const db = database({ employee: fixture.currentEmployee, history: fixture.history });
        const result = await repairEmployeeHistoryCanonical({ ...db.dependencies,
            scope: fixture.scope, employeeId: String(fixture.currentEmployee._id),
            referenceChecker: async ({ historyIds }) => historyIds.map(String)
                .includes(REAL_0002_IDS.OLD_PROFILE)
                ? [{ collection, documentId: `${collection}-document` }] : [] });
        assert.equal(result.changed, true);
        assert.deepEqual(db.state().history.map(row => String(row._id)), [
            REAL_0002_IDS.OLD_PROFILE, REAL_0002_IDS.DEPARTURE,
            REAL_0002_IDS.CURRENT_PROFILE
        ]);
        assert.equal(db.operations().historyUpdates, 1);
        assert.equal(db.operations().historyDeletes, 0);
        assert.deepEqual(result.applied.referencedUpdates.map(item => item.historyId),
            [REAL_0002_IDS.OLD_PROFILE]);
    });

test('missing audit collection blocks cleanup before audit or history writes', async () => {
    const initial = polluted0069State();
    const db = database(initial);
    await assert.rejects(save0069({ ...db,
        dependencies: { ...db.dependencies, auditCollectionChecker: async () => false }
    }, REAL_0069_IDS['0005']), error =>
        error.code === 'EMPLOYEE_HISTORY_AUDIT_COLLECTION_MISSING');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('concurrent cleanup target change rolls back audit and every planned mutation', async () => {
    const initial = polluted0069State();
    const db = database(initial, 'stale');
    await assert.rejects(save0069(db, REAL_0069_IDS['0005']), error =>
        error.code === 'EMPLOYEE_PROFILE_HISTORY_STALE');
    assert.deepEqual(db.state(), initial);
    assert.equal(db.ended(), true);
});

test('stale main-form revision rejects before employee or history writes', async () => {
    const history = { _id: 'history-1', ...scope, aa_eggrafhs: '0001',
        updatedAt: '2026-09-26T08:00:00.000Z', hmeromhnia_proslhpshs: '2026-05-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01' };
    const initial = { employee: { ...history, _id: 'employee', email: 'before@example.test' },
        history: [history] };
    const db = database(initial);
    await assert.rejects(writeEmployeeEmploymentProfile({ ...db.dependencies, scope,
        employeeId: 'employee', effectiveFrom: '2026-05-01', maintenance: {
            originalHistoryId: history._id,
            expectedRevision: '2026-09-26T07:59:59.000Z',
            employeeChanges: { email: 'after@example.test' }, historyChanges: {}
        } }), error => error.code === 'CONFLICT_STALE' && error.statusCode === 409);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

function uniqueSafeRepairRequest(db, fixture, resolutionConfirmation = null, overrides = {}) {
    const current = fixture.currentEmployee;
    const input = Object.fromEntries(C.FACT_FIELDS.filter(field =>
        current[field] !== undefined).map(field => [field, current[field]]));
    return writeEmployeeEmploymentProfileWithUniqueSafeRepair({
        ...db.dependencies,
        scope: fixture.scope,
        employeeId: String(current._id),
        effectiveFrom: current.hmeromhnia_isxyos_oron_ergasias_apo ||
            current.hmeromhnia_allaghs_orarioy_apo || current.hmeromhnia_proslhpshs,
        input,
        maintenance: {
            employeeChanges: {},
            submittedEmployeeFields: [],
            historyChanges: {},
            submittedHistoryChanges: {},
            submittedProfileFields: [],
            identity: null,
            originalHistoryId: null,
            correctableIdentityFields: []
        },
        resolutionConfirmation,
        repairActor: { userId: 'synthetic-user', userName: 'Synthetic User' },
        ...overrides
    });
}

function referencedFixtureDatabase(fixture, fail = '', behavior = {}) {
    const db = database({ employee: fixture.currentEmployee,
        history: fixture.completeHistoryRows }, fail, false, behavior);
    db.dependencies.referenceChecker = async ({ historyIds }) =>
        fixture.protectedReferenceSummary[String(historyIds[0])] || [];
    return db;
}

async function requiredResolution(db, fixture, overrides = {}) {
    let resolution;
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, null, overrides), error => {
        assert.equal(error.code, 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_REQUIRED');
        assert.equal(error.resolutionRequired, true);
        resolution = error.resolution;
        return true;
    });
    return resolution;
}

for (const [name, factory] of [
    ['Shape A', shapeALifecycleFixture],
    ['Shape B', shapeBCorrectedProfileFixture]
]) test(`${name} first Save returns a sanitized resolution and performs zero writes`, async () => {
    const fixture = factory();
    const initial = { employee: fixture.currentEmployee, history: fixture.completeHistoryRows };
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredResolution(db, fixture);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
    assert.equal(resolution.kind, 'UNIQUE_SAFE_REPAIR');
    assert.match(resolution.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(resolution).includes('shape-'), false);
    assert.equal(JSON.stringify(resolution).includes('historyId'), false);
    assert.equal(JSON.stringify(resolution).includes('_id'), false);
});

for (const [name, factory] of [
    ['Shape A', shapeALifecycleFixture],
    ['Shape B', shapeBCorrectedProfileFixture]
]) test(`${name} confirmed repair and original Save commit atomically with one audit`, async () => {
    const fixture = factory();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredResolution(db, fixture);
    const saved = await uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
    });
    assert.equal(saved.uniqueSafeRepairApplied, true);
    assert.equal(saved.uniqueSafeRepairAuditWritten, true);
    assert.equal(db.operations().auditCreates, 1);
    assert.equal(db.operations().historyDeletes, 0);
    assert.equal(db.operations().historyCreates, 0);
    assert.equal(db.state().audits.length, 1);
    assert.equal(db.state().audits[0].diagnostics.confirmationFingerprint,
        resolution.fingerprint);
    assert.deepEqual(db.state().audits[0].diagnostics.actor,
        { userId: 'synthetic-user', userName: 'Synthetic User' });
});

test('confirmed repair continues and commits the original requested Maintenance change', async () => {
    const fixture = shapeALifecycleFixture();
    const maintenance = {
        employeeChanges: { email: 'synthetic-updated@example.test' },
        submittedEmployeeFields: ['email'],
        historyChanges: {}, submittedHistoryChanges: {}, submittedProfileFields: [],
        identity: null, originalHistoryId: null, correctableIdentityFields: []
    };
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredResolution(db, fixture, { maintenance });
    await uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
    }, { maintenance });
    assert.equal(db.state().employee.email, 'synthetic-updated@example.test');
    assert.equal(db.operations().auditCreates, 1);
    assert.equal(db.operations().historyDeletes, 0);
});

test('Shape B confirmed repair logically retires the old row and preserves all stable IDs', async () => {
    const fixture = shapeBCorrectedProfileFixture();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredResolution(db, fixture);
    await uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
    });
    assert.deepEqual(db.state().history.map(row => String(row._id)).sort(),
        fixture.completeHistoryRows.map(row => String(row._id)).sort());
    const old = db.state().history.find(row => row._id === 'shape-b-older');
    const survivor = db.state().history.find(row => row._id === 'shape-b-survivor');
    assert.equal(old.employment_history_canonical_status, 'REDUNDANT_REFERENCED');
    assert.equal(old.employment_history_canonical_survivor_id, survivor._id);
    assert.equal(survivor.krathsh_01, '0109');
    assert.equal(survivor.krathsh_03, '0023');
    assert.equal(survivor.krathsh_05, '2694');
    assert.equal(new Date(survivor.hmeromhnia_isxyos_oron_ergasias_eos)
        .toISOString().slice(0, 10), '2026-06-01');
    assert.equal(new Date(db.state().employee.hmeromhnia_isxyos_oron_ergasias_eos)
        .toISOString().slice(0, 10), '2026-06-01');
});

test('confirmation is stale after employee, history or reference drift and performs zero writes', async () => {
    const original = shapeALifecycleFixture();
    const firstDb = referencedFixtureDatabase(original);
    const resolution = await requiredResolution(firstDb, original);
    for (const kind of ['employee', 'history', 'references']) {
        const fixture = shapeALifecycleFixture();
        if (kind === 'employee') fixture.currentEmployee.updatedAt = new Date('2026-10-01');
        if (kind === 'history') fixture.completeHistoryRows[0].updatedAt = new Date('2026-10-01');
        if (kind === 'references') fixture.protectedReferenceSummary['shape-a-profile'] = [];
        const db = referencedFixtureDatabase(fixture);
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
            choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
        }), error => error.code === 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_STALE');
        assert.equal(db.writes(), 0, kind);
    }
});

test('audit absence or audit write failure rolls back the entire confirmed operation', async () => {
    for (const failureMode of ['missing', 'write']) {
        const fixture = shapeALifecycleFixture();
        const firstDb = referencedFixtureDatabase(fixture);
        const resolution = await requiredResolution(firstDb, fixture);
        const db = referencedFixtureDatabase(fixture, failureMode === 'write' ? 'audit' : '');
        if (failureMode === 'missing') db.dependencies.auditCollectionChecker = async () => false;
        const before = structuredClone(db.state());
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
            choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
        }), error => failureMode === 'missing'
            ? error.code === 'EMPLOYEE_HISTORY_AUDIT_COLLECTION_MISSING'
            : error.message === 'audit failed');
        assert.deepEqual(db.state(), before);
    }
});

test('final verification failure rolls back repair, audit and original Save', async () => {
    const fixture = shapeALifecycleFixture();
    const firstDb = referencedFixtureDatabase(fixture);
    const resolution = await requiredResolution(firstDb, fixture);
    const db = referencedFixtureDatabase(fixture, '', { pretendUpdateSuccess: true });
    const before = structuredClone(db.state());
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
    }), error => error.code === 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED');
    assert.deepEqual(db.state(), before);
});

test('a legitimate original Save conflict after repair rolls the repair back', async () => {
    const fixture = shapeALifecycleFixture();
    const firstDb = referencedFixtureDatabase(fixture);
    const resolution = await requiredResolution(firstDb, fixture, {
        input: arrangement, effectiveFrom: '2026-10-01',
        maintenance: { employeeChanges: {}, historyChanges: {},
            submittedHistoryChanges: {}, submittedProfileFields: Object.keys(arrangement) }
    });
    const db = referencedFixtureDatabase(fixture);
    const before = structuredClone(db.state());
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
    }, {
        input: arrangement, effectiveFrom: '2026-10-01',
        maintenance: { employeeChanges: {}, historyChanges: {},
            submittedHistoryChanges: {}, submittedProfileFields: Object.keys(arrangement) }
    }), error => error.code === 'EMPLOYEE_PROFILE_NEW_VERSION_REQUIRES_OPEN_RELATIONSHIP');
    assert.deepEqual(db.state(), before);
});

test('repeating a successfully repaired Save uses ordinary clean behavior with no second repair audit', async () => {
    const fixture = shapeALifecycleFixture();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredResolution(db, fixture);
    await uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
    });
    const audits = db.operations().auditCreates;
    const repeated = await uniqueSafeRepairRequest(db, fixture);
    assert.notEqual(repeated.uniqueSafeRepairApplied, true);
    assert.equal(db.operations().auditCreates, audits);
    const writesBeforeStaleConfirmation = db.writes();
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'APPLY_UNIQUE_SAFE_PLAN', fingerprint: resolution.fingerprint
    }), error => error.code === 'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_STALE');
    assert.equal(db.writes(), writesBeforeStaleConfirmation);
});

const multipleFactories = [
    samePeriodMateriallyDifferentProfilesFixture,
    correctionFromHireOrSpecialtyChangeFixture,
    optionalIntermediateProfileFixture,
    realStartOfFourDayProfileFixture
];

async function requiredMultipleResolution(db, fixture, overrides = {}) {
    let resolution;
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, null, overrides), error => {
        assert.equal(error.code, 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_RESOLUTION_REQUIRED');
        assert.equal(error.resolutionRequired, true);
        resolution = error.resolution;
        return true;
    });
    return resolution;
}

for (const factory of multipleFactories) test(
    `${factory().name} first Save returns guided choices and performs zero writes`, async () => {
        const fixture = factory();
        const initial = { employee: fixture.currentEmployee, history: fixture.completeHistoryRows };
        const db = referencedFixtureDatabase(fixture);
        const resolution = await requiredMultipleResolution(db, fixture);
        assert.equal(db.writes(), 0);
        assert.deepEqual(db.state(), initial);
        assert.equal(resolution.kind, 'GUIDED_BUSINESS_CHOICE');
        assert.equal(resolution.options.length, 3);
        assert.match(resolution.fingerprint, /^[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(resolution).includes('historyId'), false);
        assert.equal(JSON.stringify(resolution).includes('_id'), false);
    });

test('all four fixed business choices commit atomically and preserve the original Save', async () => {
    const cases = [
        [samePeriodMateriallyDifferentProfilesFixture, 'SPLIT_AT_2026_06_29'],
        [correctionFromHireOrSpecialtyChangeFixture, 'SPECIALTY_CHANGE_2026_07_02'],
        [optionalIntermediateProfileFixture, 'INTERMEDIATE_PROFILE_FROM_2026_06_02'],
        [realStartOfFourDayProfileFixture, 'FOUR_DAY_PROFILE_FROM_2026_07_13']
    ];
    for (const [factory, choiceId] of cases) {
        const fixture = factory();
        const maintenance = { employeeChanges: { email: `${fixture.name}@example.test` },
            submittedEmployeeFields: ['email'], historyChanges: {},
            submittedHistoryChanges: {}, submittedProfileFields: [], identity: null,
            originalHistoryId: null, correctableIdentityFields: [] };
        const db = referencedFixtureDatabase(fixture);
        const resolution = await requiredMultipleResolution(db, fixture, { maintenance });
        const saved = await uniqueSafeRepairRequest(db, fixture, {
            choiceId, fingerprint: resolution.fingerprint
        }, { maintenance });
        assert.equal(saved.guidedBusinessResolutionApplied, true, fixture.name);
        assert.equal(saved.guidedBusinessResolutionAuditWritten, true, fixture.name);
        assert.equal(db.state().employee.email, `${fixture.name}@example.test`, fixture.name);
        assert.equal(db.operations().auditCreates, 1, fixture.name);
        const audit = db.state().audits[0];
        assert.equal(audit.diagnostics.resolutionClass,
            'MULTIPLE_SAFE_BUSINESS_PLANS', fixture.name);
        assert.equal(audit.diagnostics.selectedBusinessOptionId, choiceId, fixture.name);
        assert.match(audit.diagnostics.stateFingerprint, /^[a-f0-9]{64}$/, fixture.name);
        assert.match(audit.diagnostics.executionPlanFingerprint,
            /^[a-f0-9]{64}$/, fixture.name);
        assert.ok(Array.isArray(audit.diagnostics.affectedStableIds), fixture.name);
        assert.ok(audit.diagnostics.referenceClassifications, fixture.name);
        assert.ok(audit.currentBefore && audit.historyBefore && audit.historyAfter, fixture.name);
        assert.ok(audit.repairedAt instanceof Date, fixture.name);
        assert.deepEqual(audit.diagnostics.actor,
            { userId: 'synthetic-user', userName: 'Synthetic User' }, fixture.name);
    }
});

test('M2 correction from hire is the only guided plan that physically deletes a row', async () => {
    const m2 = correctionFromHireOrSpecialtyChangeFixture();
    const m2db = referencedFixtureDatabase(m2);
    const resolution = await requiredMultipleResolution(m2db, m2);
    await uniqueSafeRepairRequest(m2db, m2, {
        choiceId: 'CORRECTION_FROM_HIRE', fingerprint: resolution.fingerprint
    });
    assert.equal(m2db.operations().historyDeletes, 1);
    assert.equal(m2db.state().history.some(row =>
        row._id === '507f1f77bcf86cd799439211'), false);

    for (const [factory, choiceId] of [
        [samePeriodMateriallyDifferentProfilesFixture, 'KEEP_TWO_DAY_PROFILE'],
        [optionalIntermediateProfileFixture, 'INTERMEDIATE_PROFILE_NOT_REAL'],
        [realStartOfFourDayProfileFixture, 'FOUR_DAY_PROFILE_FROM_HIRE']
    ]) {
        const fixture = factory();
        const db = referencedFixtureDatabase(fixture);
        const offered = await requiredMultipleResolution(db, fixture);
        await uniqueSafeRepairRequest(db, fixture, {
            choiceId, fingerprint: offered.fingerprint
        });
        assert.equal(db.operations().historyDeletes, 0, fixture.name);
        assert.ok(db.state().history.some(row =>
            row.employment_history_canonical_status === 'REDUNDANT_REFERENCED'));
    }
});

test('M2 correction from hire fails closed if a reference appears before physical deletion', async () => {
    const fixture = correctionFromHireOrSpecialtyChangeFixture();
    const firstDb = referencedFixtureDatabase(fixture);
    const resolution = await requiredMultipleResolution(firstDb, fixture);
    const db = referencedFixtureDatabase(fixture);
    let checks = 0;
    db.dependencies.referenceChecker = async ({ historyIds }) => {
        checks += 1;
        if (checks <= fixture.completeHistoryRows.length) return [];
        return [{ collection: 'EmployeeHistoryRepairAudit', historyId: String(historyIds[0]) }];
    };
    const before = structuredClone(db.state());
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'CORRECTION_FROM_HIRE', fingerprint: resolution.fingerprint
    }), error => error.code === 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_STALE');
    assert.deepEqual(db.state(), before);
});

test('OTHER_DATE is validated by current server bounds before every write', async () => {
    const fixture = realStartOfFourDayProfileFixture();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredMultipleResolution(db, fixture);
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'FOUR_DAY_PROFILE_FROM_OTHER_DATE',
        fingerprint: resolution.fingerprint,
        answers: { effectiveDate: '2026-07-23' }
    }), error => error.code === 'EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
    assert.equal(db.writes(), 0);
    const saved = await uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'FOUR_DAY_PROFILE_FROM_OTHER_DATE',
        fingerprint: resolution.fingerprint,
        answers: { effectiveDate: '2026-07-05' }
    });
    assert.equal(saved.guidedBusinessResolutionApplied, true);
});

test('guided confirmation is stale after employee, history, references or option-set drift', async () => {
    const original = realStartOfFourDayProfileFixture();
    const firstDb = referencedFixtureDatabase(original);
    const resolution = await requiredMultipleResolution(firstDb, original);
    for (const kind of ['employee', 'history', 'references', 'options']) {
        const fixture = realStartOfFourDayProfileFixture();
        if (kind === 'employee') fixture.currentEmployee.updatedAt = new Date('2026-10-01');
        if (kind === 'history') fixture.completeHistoryRows[0].updatedAt = new Date('2026-10-01');
        if (kind === 'references') fixture.protectedReferenceSummary['m4-full-time'] = [];
        if (kind === 'options') fixture.completeHistoryRows[1].hmeromhnia_allaghs_orarioy_apo =
            '2026-07-14';
        const db = referencedFixtureDatabase(fixture);
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
            choiceId: 'FOUR_DAY_PROFILE_FROM_2026_07_13', fingerprint: resolution.fingerprint
        }), error => error.code === 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_STALE');
        assert.equal(db.writes(), 0, kind);
    }
});

test('unknown guided choice and malformed answers are rejected with zero writes', async () => {
    const fixture = optionalIntermediateProfileFixture();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredMultipleResolution(db, fixture);
    for (const confirmation of [
        { choiceId: 'UNKNOWN_CHOICE', fingerprint: resolution.fingerprint },
        { choiceId: 'INTERMEDIATE_PROFILE_OTHER_DATE', fingerprint: resolution.fingerprint },
        { choiceId: 'INTERMEDIATE_PROFILE_OTHER_DATE', fingerprint: resolution.fingerprint,
            answers: { effectiveDate: 'bad' } }
    ]) {
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, confirmation), error =>
            ['EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST',
                'EMPLOYEE_HISTORY_RESOLUTION_DATE_INVALID'].includes(error.code));
        assert.equal(db.writes(), 0);
    }
});

test('guided audit failure and final verification failure roll back resolution and original Save', async () => {
    for (const [failure, behavior, expected] of [
        ['audit', {}, 'audit failed'],
        ['', { pretendUpdateSuccess: true }, 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED']
    ]) {
        const fixture = samePeriodMateriallyDifferentProfilesFixture();
        const firstDb = referencedFixtureDatabase(fixture);
        const resolution = await requiredMultipleResolution(firstDb, fixture);
        const db = referencedFixtureDatabase(fixture, failure, behavior);
        const before = structuredClone(db.state());
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
            choiceId: 'SPLIT_AT_2026_06_29', fingerprint: resolution.fingerprint
        }), error => error.code === expected || error.message === expected);
        assert.deepEqual(db.state(), before);
    }
});

test('resolved guided state is idempotent and does not write a second resolution audit', async () => {
    const fixture = samePeriodMateriallyDifferentProfilesFixture();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredMultipleResolution(db, fixture);
    await uniqueSafeRepairRequest(db, fixture, {
        choiceId: 'KEEP_TWO_DAY_PROFILE', fingerprint: resolution.fingerprint
    });
    const auditCount = db.operations().auditCreates;
    const repeated = await uniqueSafeRepairRequest(db, fixture);
    assert.notEqual(repeated.guidedBusinessResolutionApplied, true);
    assert.equal(db.operations().auditCreates, auditCount);
});

async function requiredBusinessFactResolution(db, fixture, overrides = {}) {
    let resolution;
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, null, {
        businessFactAsOfDate: fixture.asOfDate,
        ...overrides
    }), error => {
        assert.equal(error.code, 'EMPLOYEE_HISTORY_BUSINESS_FACT_REQUIRED');
        assert.equal(error.resolutionRequired, true);
        resolution = error.resolution;
        return true;
    });
    return resolution;
}

test('πρώτη αποθήκευση για κάθε ελεγχόμενο σχήμα γεγονότων επιστρέφει 409 χωρίς εγγραφή', async () => {
    for (const fixture of [competingDepartureDatesFixture(),
        departureAndHistoricalPayFactFixture()]) {
        const initial = { employee: fixture.currentEmployee,
            history: fixture.completeHistoryRows };
        const db = referencedFixtureDatabase(fixture);
        const resolution = await requiredBusinessFactResolution(db, fixture);
        assert.equal(db.writes(), 0);
        assert.deepEqual(db.state(), initial);
        assert.equal(resolution.kind, 'BUSINESS_FACT_COLLECTION');
        assert.match(resolution.fingerprint, /^[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(resolution).includes('historyId'), false);
        assert.equal(JSON.stringify(resolution).includes('_id'), false);
        assert.equal(JSON.stringify(resolution).includes('patch'), false);
    }
});

test('επιβεβαιωμένη αποχώρηση, μη αποχώρηση και D2 εκτελούνται συναλλακτικά με πλήρες audit', async () => {
    const cases = [
        [competingDepartureDatesFixture(), {
            departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE'
        }],
        [competingDepartureDatesFixture({ name: 'no-departure' }), {
            departureOutcome: 'NO_DEPARTURE'
        }],
        [departureAndHistoricalPayFactFixture(), {
            departureOutcome: 'DEPARTED_ON_OTHER_DATE', departureDate: '2026-08-15',
            payEffectiveOutcome: 'PAY_APPLIED_FROM_OTHER_DATE',
            payEffectiveDate: '2026-07-01'
        }]
    ];
    for (const [fixture, answers] of cases) {
        const db = referencedFixtureDatabase(fixture);
        const resolution = await requiredBusinessFactResolution(db, fixture);
        const saved = await uniqueSafeRepairRequest(db, fixture, {
            fingerprint: resolution.fingerprint, answers
        }, { businessFactAsOfDate: fixture.asOfDate });
        assert.equal(saved.businessFactResolutionApplied, true);
        assert.equal(saved.businessFactResolutionAuditWritten, true);
        assert.equal(db.operations().auditCreates, 1);
        const audit = db.state().audits[0];
        assert.equal(audit.diagnostics.resolutionClass, 'BUSINESS_FACT_REQUIRED');
        assert.equal(audit.diagnostics.resolutionKind, 'BUSINESS_FACT_COLLECTION');
        assert.deepEqual(audit.diagnostics.normalizedBusinessAnswers, {
            ...answers,
            ...(answers.departureOutcome === 'NO_DEPARTURE'
                ? { departureDate: null } : {}),
            ...(answers.departureOutcome !== 'DEPARTED_ON_OTHER_DATE' &&
                answers.departureOutcome !== 'NO_DEPARTURE'
                ? { departureDate: fixture.completeHistoryRows
                    .filter(row => row.hmeromhnia_apoxorhshs)
                    .map(row => new Date(row.hmeromhnia_apoxorhshs).toISOString().slice(0, 10))[0] }
                : {})
        });
        assert.match(audit.diagnostics.stateFingerprint, /^[a-f0-9]{64}$/);
        assert.match(audit.diagnostics.executionPlanFingerprint, /^[a-f0-9]{64}$/);
        assert.ok(Array.isArray(audit.diagnostics.questionIds));
        assert.ok(Array.isArray(audit.diagnostics.affectedStableIds));
        assert.ok(audit.diagnostics.referenceClassifications);
        assert.equal(audit.diagnostics.currentLifecycleBefore.energos, true);
        assert.equal(audit.diagnostics.currentLifecycleAfter.energos,
            answers.departureOutcome === 'NO_DEPARTURE');
        assert.deepEqual(audit.diagnostics.actor,
            { userId: 'synthetic-user', userName: 'Synthetic User' });
    }
});

test('η επίλυση γεγονότων συνεχίζει την αρχική αποθήκευση χωρίς να επαναφέρει την αντίφαση', async () => {
    const fixture = competingDepartureDatesFixture();
    const maintenance = {
        employeeChanges: {
            email: 'fact-resolution@example.test',
            energos: true,
            hmeromhnia_apoxorhshs: fixture.currentEmployee.hmeromhnia_apoxorhshs
        },
        submittedEmployeeFields: ['email', 'energos', 'hmeromhnia_apoxorhshs'],
        historyChanges: {
            hmeromhnia_apoxorhshs: fixture.currentEmployee.hmeromhnia_apoxorhshs
        },
        submittedHistoryChanges: {
            hmeromhnia_apoxorhshs: fixture.currentEmployee.hmeromhnia_apoxorhshs
        },
        submittedProfileFields: [], identity: null, originalHistoryId: null,
        correctableIdentityFields: []
    };
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredBusinessFactResolution(db, fixture, { maintenance });
    await uniqueSafeRepairRequest(db, fixture, {
        fingerprint: resolution.fingerprint,
        answers: { departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE' }
    }, { businessFactAsOfDate: fixture.asOfDate, maintenance });
    assert.equal(db.state().employee.email, 'fact-resolution@example.test');
    assert.equal(db.state().employee.energos, false);
    assert.equal(new Date(db.state().employee.hmeromhnia_apoxorhshs)
        .toISOString().slice(0, 10), '2026-08-19');
    assert.equal(db.operations().auditCreates, 1);
});

test('μεταβολή εργαζομένου, ιστορικού, συσχετίσεων ή ερωτήσεων επιστρέφει STALE με μηδενικές εγγραφές', async () => {
    const original = competingDepartureDatesFixture();
    const firstDb = referencedFixtureDatabase(original);
    const resolution = await requiredBusinessFactResolution(firstDb, original);
    for (const kind of ['employee', 'history', 'references', 'questions']) {
        const fixture = competingDepartureDatesFixture();
        if (kind === 'employee') fixture.currentEmployee.updatedAt = new Date('2026-10-01');
        if (kind === 'history') fixture.completeHistoryRows[0].updatedAt = new Date('2026-10-01');
        if (kind === 'references') {
            fixture.protectedReferenceSummary[String(fixture.completeHistoryRows[0]._id)] =
                [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'changed' }];
        }
        const db = referencedFixtureDatabase(fixture);
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
            fingerprint: resolution.fingerprint,
            answers: { departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE' }
        }, { businessFactAsOfDate: kind === 'questions' ? '2026-10-07' : fixture.asOfDate }),
        error => error.code === 'EMPLOYEE_HISTORY_BUSINESS_FACT_STALE');
        assert.equal(db.writes(), 0, kind);
    }
});

test('άγνωστες ή ελλιπείς απαντήσεις γεγονότων απορρίπτονται πριν από κάθε εγγραφή', async () => {
    const fixture = departureAndHistoricalPayFactFixture();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredBusinessFactResolution(db, fixture);
    for (const answers of [
        { departureOutcome: 'UNKNOWN', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' },
        { departureOutcome: 'NO_DEPARTURE' },
        { departureOutcome: 'DEPARTED_ON_OTHER_DATE', departureDate: 'bad',
            payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE' },
        { departureOutcome: 'NO_DEPARTURE', payEffectiveOutcome: 'PAY_APPLIED_FROM_HIRE',
            historyId: 'forged' }
    ]) {
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
            fingerprint: resolution.fingerprint, answers
        }, { businessFactAsOfDate: fixture.asOfDate }), error =>
            ['EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST',
                'EMPLOYEE_HISTORY_RESOLUTION_DATE_INVALID'].includes(error.code));
        assert.equal(db.writes(), 0);
    }
});

test('η φυσική διαγραφή επανελέγχει NO_REFERENCES αμέσως πριν τη μετάλλαξη', async () => {
    const fixture = competingDepartureDatesFixture();
    const firstDb = referencedFixtureDatabase(fixture);
    const resolution = await requiredBusinessFactResolution(firstDb, fixture);
    const db = referencedFixtureDatabase(fixture);
    let checks = 0;
    db.dependencies.referenceChecker = async () => {
        checks += 1;
        if (checks <= fixture.completeHistoryRows.length) return [];
        return [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
            documentId: 'appeared-before-delete' }];
    };
    const before = structuredClone(db.state());
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
        fingerprint: resolution.fingerprint,
        answers: { departureOutcome: 'NO_DEPARTURE' }
    }, { businessFactAsOfDate: fixture.asOfDate }), error =>
        error.code === 'EMPLOYEE_HISTORY_BUSINESS_FACT_STALE');
    assert.deepEqual(db.state(), before);
});

test('οι PROVENANCE_ONLY εγγραφές αποσύρονται λογικά χωρίς φυσική διαγραφή', async () => {
    const fixture = competingDepartureDatesFixture({
        referencedIds: [
            '507f1f77bcf86cd799439302',
            '507f1f77bcf86cd799439303',
            '507f1f77bcf86cd799439304'
        ]
    });
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredBusinessFactResolution(db, fixture);
    await uniqueSafeRepairRequest(db, fixture, {
        fingerprint: resolution.fingerprint,
        answers: { departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE' }
    }, { businessFactAsOfDate: fixture.asOfDate });
    assert.equal(db.operations().historyDeletes, 0);
    assert.ok(db.state().history.some(row =>
        row.employment_history_canonical_status === 'REDUNDANT_REFERENCED'));
});

test('αποτυχία audit ή τελικής επαλήθευσης αναστρέφει επίλυση και αρχική αποθήκευση', async () => {
    for (const [failure, behavior, expected] of [
        ['audit', {}, 'audit failed'],
        ['', { pretendUpdateSuccess: true },
            'EMPLOYEE_HISTORY_BUSINESS_FACT_FINAL_VERIFICATION_FAILED']
    ]) {
        const fixture = competingDepartureDatesFixture();
        const firstDb = referencedFixtureDatabase(fixture);
        const resolution = await requiredBusinessFactResolution(firstDb, fixture);
        const db = referencedFixtureDatabase(fixture, failure, behavior);
        const before = structuredClone(db.state());
        await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
            fingerprint: resolution.fingerprint,
            answers: { departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE' }
        }, { businessFactAsOfDate: fixture.asOfDate }), error =>
            error.code === expected || error.message === expected);
        assert.deepEqual(db.state(), before);
    }
});

test('νόμιμη σύγκρουση της αρχικής αποθήκευσης αναστρέφει και την επίλυση γεγονότων', async () => {
    const fixture = competingDepartureDatesFixture();
    const overrides = {
        businessFactAsOfDate: fixture.asOfDate,
        input: arrangement,
        effectiveFrom: '2026-10-01',
        maintenance: { employeeChanges: {}, historyChanges: {},
            submittedHistoryChanges: {}, submittedProfileFields: Object.keys(arrangement) }
    };
    const firstDb = referencedFixtureDatabase(fixture);
    const resolution = await requiredBusinessFactResolution(firstDb, fixture, overrides);
    const db = referencedFixtureDatabase(fixture);
    const before = structuredClone(db.state());
    await assert.rejects(uniqueSafeRepairRequest(db, fixture, {
        fingerprint: resolution.fingerprint,
        answers: { departureOutcome: 'DEPARTED_ON_FIRST_RECORDED_DATE' }
    }, overrides), error =>
        error.code === 'EMPLOYEE_PROFILE_NEW_VERSION_REQUIRES_OPEN_RELATIONSHIP');
    assert.deepEqual(db.state(), before);
});

test('καθαρή επανάληψη δεν δημιουργεί δεύτερο audit επίλυσης γεγονότων', async () => {
    const fixture = competingDepartureDatesFixture();
    const db = referencedFixtureDatabase(fixture);
    const resolution = await requiredBusinessFactResolution(db, fixture);
    await uniqueSafeRepairRequest(db, fixture, {
        fingerprint: resolution.fingerprint,
        answers: { departureOutcome: 'NO_DEPARTURE' }
    }, { businessFactAsOfDate: fixture.asOfDate });
    const audits = db.operations().auditCreates;
    const repeated = await uniqueSafeRepairRequest(db, fixture, null,
        { businessFactAsOfDate: fixture.asOfDate });
    assert.notEqual(repeated.businessFactResolutionApplied, true);
    assert.equal(db.operations().auditCreates, audits);
});
