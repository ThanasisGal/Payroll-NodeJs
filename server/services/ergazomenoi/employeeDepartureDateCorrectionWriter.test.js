'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { writeEmployeeDeparture, writeEmployeeDepartureDateCorrection } =
    require('./employeeEmploymentProfileWriter');
const { PLAN_STATUSES } = require('./employeeDepartureDateCorrectionPlannerService');
const { THA_0014_IDS: IDS, buildTha0014SanitizedDepartureCorrectionFixture } =
    require('./fixtures/tha0014SanitizedDepartureCorrectionFixture');

const clone = value => structuredClone(value);
const date = value => value == null ? null : new Date(value).toISOString().slice(0, 10);

function database(initial, { fail = '', pretendHistoryUpdate = false,
    referencesById = {}, auditContext = initial.departureAuditContext || [] } = {}) {
    let committed = { employee: clone(initial.currentEmployee),
        history: clone(initial.completeHistoryRows), audits: [] };
    let draft = null;
    let writes = 0;
    const operations = { employee: 0, history: 0, audit: 0 };
    const operationOrder = [];
    const session = {
        async withTransaction(work) {
            draft = clone(committed);
            try {
                await work();
                if (fail === 'commit') throw new Error('commit failed');
                committed = draft;
            } finally {
                draft = null;
            }
        },
        async endSession() {}
    };
    const matches = (record, filter) => record && Object.entries(filter).every(([field, value]) =>
        value instanceof Date
            ? new Date(record[field]).getTime() === value.getTime()
            : String(record[field] ?? '') === String(value ?? ''));
    const query = read => ({
        mongooseOptions() { return this; },
        select() { return this; },
        session(value) { assert.equal(value, session); return this; },
        async lean() { return clone(read()); }
    });
    const employeeModel = {
        findOne: filter => query(() => matches(draft.employee, filter) ? draft.employee : null),
        async updateOne(filter, update, options) {
            // Business-state assertions below intentionally exclude hidden fence
            // metadata; transactional increments/retries have dedicated tests.
            if (update.$inc?.employee_profile_mutation_sequence === 1) {
                assert.equal(options.session, session);
                assert.equal(options.timestamps, false);
                assert.deepEqual(update, { $inc: { employee_profile_mutation_sequence: 1 } });
                return { matchedCount: matches(draft.employee, filter) ? 1 : 0 };
            }

            assert.equal(options.session, session);
            writes += 1; operations.employee += 1;
            operationOrder.push('employee');
            if (fail === 'employee') throw new Error('employee failed');
            if (!matches(draft.employee, filter)) return { matchedCount: 0 };
            Object.assign(draft.employee, clone(update.$set));
            return { matchedCount: 1 };
        }
    };
    const historyModel = {
        find: filter => query(() => draft.history.filter(row => matches(row, filter))),
        async updateOne(filter, update, options) {
            assert.equal(options.session, session);
            writes += 1; operations.history += 1;
            operationOrder.push('history');
            if (fail === 'history') throw new Error('history failed');
            const row = draft.history.find(item => matches(item, filter));
            if (!row) return { matchedCount: 0 };
            if (!pretendHistoryUpdate) Object.assign(row, clone(update.$set));
            return { matchedCount: 1 };
        },
        async create() { throw new Error('unexpected History insert'); },
        async deleteMany() { throw new Error('unexpected History delete'); }
    };
    const auditModel = {
        async create([record], options) {
            assert.equal(options.session, session);
            writes += 1; operations.audit += 1;
            operationOrder.push('audit');
            if (fail === 'audit') throw new Error('audit failed');
            draft.audits.push(clone(record));
            return [record];
        }
    };
    return {
        state: () => clone(committed),
        writes: () => writes,
        operations: () => clone(operations),
        operationOrder: () => [...operationOrder],
        dependencies: {
            connection: { startSession: async () => session },
            capabilityProbe: async () => true,
            employeeModel,
            historyModel,
            auditModel,
            auditCollectionChecker: async () => true,
            referenceChecker: async ({ historyIds }) =>
                clone(referencesById[String(historyIds[0])] || []),
            departureAuditContextLoader: async () => clone(auditContext)
        }
    };
}

function correction(db, requestedDepartureDate = '2026-09-23', extra = {}) {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const state = db.state();
    const terminal = state.history.find(row => row._id === IDS.terminal);
    return writeEmployeeDepartureDateCorrection({ ...db.dependencies,
        scope: fixture.scope, employeeId: 'employee-0014', requestedDepartureDate,
        expectedRevision: terminal?.updatedAt,
        expectedStoredDeparture: state.employee.hmeromhnia_apoxorhshs,
        input: {}, maintenance: {}, ...extra });
}

test('transactional legacy correction changes only current and terminal departures and audits it', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const referencesById = {
        [IDS.terminal]: fixture.protectedReferences[IDS.terminal]
    };
    const db = database(fixture, { referencesById });
    const before = db.state();
    const result = await correction(db);
    const stored = db.state();
    assert.equal(result.plan.status, PLAN_STATUSES.APPLYABLE_DEPARTURE_ONLY);
    assert.equal(date(stored.employee.hmeromhnia_apoxorhshs), '2026-09-23');
    assert.equal(date(stored.employee.hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-20');
    assert.equal(date(stored.employee.hmeromhnia_lhxhs_symbashs), '2026-10-31');
    const terminal = stored.history.find(row => row._id === IDS.terminal);
    const profile = stored.history.find(row => row._id === IDS.latestProfile);
    assert.equal(date(terminal.hmeromhnia_apoxorhshs), '2026-09-23');
    assert.equal(date(profile.hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-20');
    assert.deepEqual(stored.history.map(row => row._id), before.history.map(row => row._id));
    assert.equal(stored.audits.length, 1);
    assert.equal(stored.audits[0].mutationSource, 'HISTORY_DEPARTURE_DATE_CORRECTION');
    assert.equal(stored.audits[0].diagnostics.oldDeparture, '2026-09-20');
    assert.equal(stored.audits[0].diagnostics.newDeparture, '2026-09-23');
    assert.equal(stored.audits[0].diagnostics.terminalHistoryId, IDS.terminal);
    assert.deepEqual(stored.audits[0].diagnostics.changedFields.current,
        ['hmeromhnia_apoxorhshs']);
    assert.deepEqual(stored.audits[0].diagnostics.changedFields.history,
        { [IDS.terminal]: ['hmeromhnia_apoxorhshs'] });
    assert.equal(typeof stored.audits[0].diagnostics.planFingerprint, 'string');
    assert.equal(stored.audits[0].diagnostics.planFingerprint.length, 64);
    assert.deepEqual(stored.audits[0].diagnostics.protectedReferenceSummary[IDS.terminal], {
        count: 1, collections: ['Apasxoliseis_Period_Frozen_Snapshots']
    });
    assert.deepEqual(db.operationOrder(), ['employee', 'history', 'audit']);
});

test('derived History aliases echoed by the ordinary form are not separate changes', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    fixture.currentEmployee.kathestos_apasxolhshs = '0';
    fixture.currentEmployee.hmeres_ergasias_ebdomadas = 5;
    const db = database(fixture);
    const result = await correction(db, '2026-09-23', {
        maintenance: {
            employeeChanges: {
                kathestos_apasxolhshs: '0',
                hmeres_ergasias_ebdomadas: 5,
                hmeromhnia_apoxorhshs: '2026-09-23'
            },
            submittedEmployeeFields: [
                'kathestos_apasxolhshs',
                'hmeres_ergasias_ebdomadas',
                'hmeromhnia_apoxorhshs'
            ],
            submittedHistoryChanges: {
                kathestos_apasxolhshs: '0',
                typos_apasxolhshs: '0',
                hmeres_ergasias_ebdomadas: 5,
                typos_ebdomadas: '5HMERH',
                hmeromhnia_apoxorhshs: '2026-09-23'
            }
        }
    });
    assert.equal(result.plan.status, PLAN_STATUSES.APPLYABLE_DEPARTURE_ONLY);
    assert.equal(date(db.state().employee.hmeromhnia_apoxorhshs), '2026-09-23');
    assert.equal(date(db.state().history.find(row => row._id === IDS.terminal)
        .hmeromhnia_apoxorhshs), '2026-09-23');
});

test('departure created by writeEmployeeDeparture moves only its proven clamps', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    fixture.currentEmployee.hmeromhnia_apoxorhshs = null;
    fixture.currentEmployee.energos = true;
    fixture.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = '2026-10-15';
    delete fixture.currentEmployee.employment_departure_restore;
    fixture.completeHistoryRows.find(row => row._id === IDS.terminal)
        .hmeromhnia_apoxorhshs = null;
    fixture.completeHistoryRows.find(row => row._id === IDS.latestProfile)
        .hmeromhnia_isxyos_oron_ergasias_eos = null;
    const db = database(fixture);
    await writeEmployeeDeparture({ ...db.dependencies, scope: fixture.scope,
        employeeId: 'employee-0014', departureDate: '2026-09-20',
        effectiveFrom: '2026-06-15' });
    const departed = db.state();
    assert.equal(departed.employee.employment_departure_restore.employee_end_clamped, true);
    assert.equal(departed.employee.employment_departure_restore.profile_end_clamped, true);
    const result = await correction(db);
    const corrected = db.state();
    assert.equal(result.plan.status, PLAN_STATUSES.APPLYABLE_WITH_PROVEN_CLAMP);
    assert.equal(date(corrected.employee.hmeromhnia_apoxorhshs), '2026-09-23');
    assert.equal(date(corrected.employee.hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-23');
    assert.equal(date(corrected.history.find(row => row._id === IDS.latestProfile)
        .hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-23');
    assert.equal(corrected.employee.employment_departure_restore.departure, '2026-09-23');
    assert.equal(date(corrected.employee.employment_departure_restore.employee_end_before),
        '2026-10-15');
});

test('unknown protected reference semantics blocks before writes', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const db = database(fixture, { referencesById: {
        [IDS.terminal]: [{ collection: 'Future_Live_Dereference', documentId: 'live-1' }]
    } });
    await assert.rejects(correction(db), error =>
        error.code === 'EMPLOYEE_DEPARTURE_DATE_CORRECTION_BLOCKED' &&
        error.correctionStatus === PLAN_STATUSES.BLOCKED_REFERENCE);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state().employee, fixture.currentEmployee);
});

test('mixed contract or profile changes are rejected before writes', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const db = database(fixture);
    await assert.rejects(correction(db, '2026-09-23', {
        maintenance: {
            employeeChanges: { hmeromhnia_lhxhs_symbashs: '2026-11-30' },
            submittedEmployeeFields: ['hmeromhnia_lhxhs_symbashs']
        }
    }), error => error.code ===
        'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state().employee, fixture.currentEmployee);
    assert.deepEqual(db.state().history, fixture.completeHistoryRows);
});

for (const failure of ['audit', 'employee', 'history', 'commit']) {
    test(`departure-date correction rolls back on ${failure} failure`, async () => {
        const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
        const db = database(fixture, { fail: failure });
        await assert.rejects(correction(db));
        assert.deepEqual(db.state().employee, fixture.currentEmployee);
        assert.deepEqual(db.state().history, fixture.completeHistoryRows);
        assert.deepEqual(db.state().audits, []);
    });
}

test('final canonical verification failure rolls back audit and employee update', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const db = database(fixture, { pretendHistoryUpdate: true });
    await assert.rejects(correction(db), error =>
        error.code === 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED');
    assert.deepEqual(db.state().employee, fixture.currentEmployee);
    assert.deepEqual(db.state().history, fixture.completeHistoryRows);
    assert.deepEqual(db.state().audits, []);
});

test('repeated direct Save is a NO_OP with no additional writes', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const db = database(fixture);
    await correction(db);
    const writes = db.writes();
    const second = await correction(db);
    assert.equal(second.plan.status, PLAN_STATUSES.NO_OP);
    assert.equal(second.idempotent, true);
    assert.equal(db.writes(), writes);
    assert.equal(db.state().audits.length, 1);
});

test('earlier correction moves only departure-owned clamp boundaries', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    fixture.currentEmployee.hmeromhnia_apoxorhshs = null;
    fixture.currentEmployee.energos = true;
    fixture.currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos = '2026-10-15';
    delete fixture.currentEmployee.employment_departure_restore;
    fixture.completeHistoryRows.find(row => row._id === IDS.terminal)
        .hmeromhnia_apoxorhshs = null;
    fixture.completeHistoryRows.find(row => row._id === IDS.latestProfile)
        .hmeromhnia_isxyos_oron_ergasias_eos = null;
    const db = database(fixture);
    await writeEmployeeDeparture({ ...db.dependencies, scope: fixture.scope,
        employeeId: 'employee-0014', departureDate: '2026-09-20',
        effectiveFrom: '2026-06-15' });
    const result = await correction(db, '2026-09-18');
    const stored = db.state();
    assert.equal(result.plan.status, PLAN_STATUSES.APPLYABLE_WITH_PROVEN_CLAMP);
    assert.equal(date(stored.employee.hmeromhnia_apoxorhshs), '2026-09-18');
    assert.equal(date(stored.employee.hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-18');
    assert.equal(date(stored.history.find(row => row._id === IDS.latestProfile)
        .hmeromhnia_isxyos_oron_ergasias_eos), '2026-09-18');
});

test('stale revision and changed stored departure both reject before writes', async () => {
    for (const extra of [
        { expectedRevision: '2026-01-01T00:00:00.000Z' },
        { expectedStoredDeparture: '2026-09-19' }
    ]) {
        const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
        const db = database(fixture);
        await assert.rejects(correction(db, '2026-09-23', extra), error =>
            error.code === 'EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE');
        assert.equal(db.writes(), 0);
        assert.deepEqual(db.state().employee, fixture.currentEmployee);
        assert.deepEqual(db.state().history, fixture.completeHistoryRows);
    }
});

test('an old browser correction cannot overwrite a newer departure correction', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const db = database(fixture);
    const oldRevision = db.state().history.find(row => row._id === IDS.terminal).updatedAt;
    const oldDeparture = db.state().employee.hmeromhnia_apoxorhshs;
    await correction(db, '2026-09-22');
    const afterConcurrentSave = db.state();
    await assert.rejects(writeEmployeeDepartureDateCorrection({ ...db.dependencies,
        scope: fixture.scope, employeeId: 'employee-0014',
        requestedDepartureDate: '2026-09-23', expectedRevision: oldRevision,
        expectedStoredDeparture: oldDeparture, input: {}, maintenance: {} }), error =>
        error.code === 'EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE');
    assert.deepEqual(db.state(), afterConcurrentSave);
});

test('departure-date correction fails closed without transaction support', async () => {
    const fixture = buildTha0014SanitizedDepartureCorrectionFixture();
    const db = database(fixture);
    await assert.rejects(correction(db, '2026-09-23', {
        capabilityProbe: async () => false
    }), error => error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state().employee, fixture.currentEmployee);
    assert.deepEqual(db.state().history, fixture.completeHistoryRows);
});
