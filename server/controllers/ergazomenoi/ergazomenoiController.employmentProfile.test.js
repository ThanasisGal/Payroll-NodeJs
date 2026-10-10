'use strict';
const Authorization = require('../../services/ergazomenoi/employeeHistoryAuthorizationService');
// Execute the actual controller through its persistence boundary. Later PDF/API/schedule
// effects are excluded; their source is compared byte-for-byte with the approved checkpoint.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const mongoose = require('mongoose');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const H = require('../../utils/ergazomenoi/employmentProfileHistory');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const EditorState = require('../../services/ergazomenoi/employeeHistoryEditorStateService');
const M = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const Models = require('../../models/ergazomenoi');
const Terms = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { requireScopedEmployeeForUpdate } = require('./employeeUpdateScope');
const { buildEmployeeMaintenanceIdentity } =
    require('../../services/ergazomenoi/employeeMaintenanceHistoryPlannerService');
const { findHistoryIdReferences } =
    require('../../services/ergazomenoi/employeeHistoryReferenceAuditService');
const { REAL_0069_SCOPE, REAL_0069_IDS, buildReal0069SanitizedHistoryFixture } =
    require('../../services/ergazomenoi/fixtures/real0069SanitizedHistoryFixture');
const { twoDaySchedule } = require('../../../test/fixtures/employeeDailyRestFixtures');
const source = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
const scope = { team: 'fixture', company_kod: 'company', kodikos: '0001' };
const plain = value => JSON.parse(JSON.stringify(value));
function assertSaveHistoryAction(res) {
    assert.equal(res.code, 200);
    assert.equal(res.body.success, false);
    assert.equal(res.body.actionRequired, true);
    assert.equal(res.body.reason, 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE');
    assert.deepEqual(plain(res.body.nextAction), {
        type: 'OPEN_EMPLOYEE_HISTORY_REVIEW', targetHistoryId: null
    });
    assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
    assert.match(res.body.message, /Πατήστε «Έλεγχος Ιστορικού»/);
    assert.deepEqual(Object.keys(res.body).sort(),
        ['success', 'actionRequired', 'reason', 'message', 'nextAction'].sort());
}
const enabled = { [C.ENABLED]: true, [C.TYPE]: 'APPROVED_LEAVE_INTERRUPTION',
    [C.FROM]: '2026-09-01', [C.START]: '13:00', [C.END]: '14:00', [C.CATEGORY]: 'existing-code' };
const form = () => ({ hmeromhnia_proslhpshs: '2026-04-01', hmeromhnia_allaghs_symbashs: '2026-04-01',
    hmeromhnia_allaghs_orarioy_apo: '2026-04-01', hmeromhnia_allaghs_orarioy_eos: '2026-04-07',
    hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-01',
    eponymoHidden: 'Fixture', onomaHidden: 'Employee', pososto_prosayxhshs_6hs_hmeras: 40,
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
    kathestos_apasxolhshs: '0', kathestos_apasxolhshs_stathera: '0',
    symbash: 'contract', symbash_stathera: 'contract', nomimosMisthos: 1200,
    poso_symbashs_01: 1200, symbatikes_ores_ergasias: 40 });
test('Maintenance submitted-field detection recognizes every KPK contract source', () => {
    for (const key of ['kpk_efka_basei_symbashs_stathera', 'kpk_efka_basei_symbashs',
        'tmp_kpk_efka_stathera']) {
        const submitted = M.submittedEmployeeMaintenanceFields(
            { kpk_efka_basei_symbashs: '0115' }, { [key]: '0115' });
        assert.deepEqual(submitted, ['kpk_efka_basei_symbashs'], key);
    }
});
test('Maintenance submitted-field detection recognizes work-terms start fallback', () => {
    const data = { hmeromhnia_allaghs_orarioy_apo: '2026-07-06' };
    assert.equal(Object.hasOwn(data, 'hmeromhnia_isxyos_oron_ergasias_apo'), false);
    assert.deepEqual(M.submittedEmployeeMaintenanceFields(
        { hmeromhnia_isxyos_oron_ergasias_apo: data.hmeromhnia_allaghs_orarioy_apo }, data),
    ['hmeromhnia_isxyos_oron_ergasias_apo']);
});
test('Maintenance submitted-field detection uses presence for every falsy value', () => {
    for (const value of [false, 0, '', null, []]) {
        assert.deepEqual(M.submittedEmployeeMaintenanceFields(
            { afora_kataggelia_me_proeidopoihsh: value,
                kpk_efka_basei_symbashs: value,
                hmeromhnia_isxyos_oron_ergasias_apo: value },
            { kataggelia_me_proeidopoihsh: value,
                tmp_kpk_efka_stathera: value,
                hmeromhnia_allaghs_orarioy_apo: value }),
        ['afora_kataggelia_me_proeidopoihsh', 'kpk_efka_basei_symbashs',
            'hmeromhnia_isxyos_oron_ergasias_apo']);
    }
});
function memory(initial = { employee: null, history: [] }, fail = '') {
    let committed = plain(initial), draft, ended = false, writes = 0, deleteAttempts = 0;
    let committedEmployeeCreates = 0, draftEmployeeCreates = 0;
    const session = { async withTransaction(work) {
        draft = plain(committed); draftEmployeeCreates = committedEmployeeCreates;
        try { await work(); if (fail === 'commit') throw Error('commit failed');
            committed = draft; committedEmployeeCreates = draftEmployeeCreates; }
        finally { draft = null; }
    }, async endSession() { ended = true; } };
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) =>
        value == null ? row[key] == null : value instanceof Date ? new Date(row[key]).getTime() === value.getTime() : String(row[key]) === String(value));
    function query(read) { let sort; return { mongooseOptions() { return this; }, session(s) { assert.equal(s, session); return this; }, select() { return this; },
        sort(value) { sort = value; return this; }, limit: async () => [], lean: async () => {
            const result = plain(read());
            if (sort && Array.isArray(result)) result.sort((a, b) => {
                for (const [key, dir] of Object.entries(sort)) {
                    const av = a[key] ?? '', bv = b[key] ?? '';
                    if (av !== bv) return (av < bv ? -1 : 1) * dir;
                }
                return 0;
            });
            return result;
        } }; }
    const employeeModel = Object.assign(function (record) { return new Models.ErgazomenoiModel(record); }, {
        hydrate: Models.ErgazomenoiModel.hydrate.bind(Models.ErgazomenoiModel),
        find: () => query(() => []),
        findOne: filter => query(() => matches((draft || committed).employee, filter) ? (draft || committed).employee : null),
        async create([record], options) {
            assert.equal(options.session, session); writes++;
            const doc = new Models.ErgazomenoiModel(record); await doc.validate();
            draft.employee = plain(doc); draftEmployeeCreates++; return [doc];
        },
        async updateOne(filter, update, options) {
            // Business-state assertions below intentionally exclude hidden fence
            // metadata; transactional increments/retries have dedicated tests.
            if (update.$inc?.employee_profile_mutation_sequence === 1) {
                assert.equal(options.session, session);
                assert.equal(options.timestamps, false);
                assert.deepEqual(update, { $inc: { employee_profile_mutation_sequence: 1 } });
                return { matchedCount: matches(draft.employee, filter) ? 1 : 0 };
            }

            assert.equal(options.session, session); writes++;
            if (fail === 'employee') throw Error('employee failed');
            if (!matches(draft.employee, filter)) return { matchedCount: 0 };
            Object.assign(draft.employee, plain(update.$set)); return { matchedCount: 1 };
        }
    });
    const historyModel = Object.assign(function (record) { return new Models.IstorikoProslhpseonAllagonModel(record); }, {
        schema: Models.IstorikoProslhpseonAllagonModel.schema,
        find: filter => query(() => draft.history.filter(row => matches(row, filter))),
        async updateMany(filter, update, options) {
            assert.equal(options.session, session); writes++;
            const ids = new Set(filter._id.$in.map(String));
            const rows = draft.history.filter(row => ids.has(String(row._id)) &&
                ['team', 'company_kod', 'kodikos'].every(field =>
                    String(row[field]) === String(filter[field])));
            for (const row of rows) for (const [field, increment] of Object.entries(update.$inc || {})) {
                row[field] = Number(row[field] || 0) + increment;
            }
            return { matchedCount: rows.length };
        },
        async deleteMany(filter, options) {
            assert.equal(options.session, session); writes++;
            if (fail === 'cleanup') throw Error('cleanup failed');
            const ids = new Set(filter._id.$in.map(String));
            const before = draft.history.length;
            draft.history = draft.history.filter(row => !ids.has(String(row._id)));
            return { deletedCount: before - draft.history.length };
        },
        async deleteOne(filter, options) {
            assert.equal(options.session, session); writes++; deleteAttempts++;
            if (fail === 'delete') throw Error('delete failed');
            const index = draft.history.findIndex(row => matches(row, filter));
            if (index < 0) return { deletedCount: 0 };
            draft.history.splice(index, 1); return { deletedCount: 1 };
        },
        async create([record], options) {
            assert.equal(options.session, session); writes++;
            await record.validate(); // Exercise real schema hooks without connecting Mongoose.
            if (fail === 'history') throw Error('history failed');
            draft.history.push(plain(record)); return [record];
        },
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++;
            if (fail === 'history') throw Error('history failed');
            const row = draft.history.find(row => matches(row, filter));
            if (!row) return { matchedCount: 0 };
            const cast = Object.fromEntries(Object.entries(update.$set || {}).map(([field, value]) => {
                const schemaPath = Models.IstorikoProslhpseonAllagonModel.schema.path(field);
                return [field, schemaPath ? schemaPath.cast(value) : value];
            }));
            Object.assign(row, plain(cast));
            for (const [field, increment] of Object.entries(update.$inc || {})) {
                row[field] = Number(row[field] || 0) + increment;
            }
            return { matchedCount: 1 };
        }
    });
    const auditModel = { async create([record], options) {
        assert.equal(options.session, session); writes++;
        if (fail === 'audit') throw Error('audit failed');
        if (!draft.audits) draft.audits = [];
        draft.audits.push(plain(record)); return [record];
    } };
    return { employeeModel, historyModel, state: () => committed, writes: () => writes,
        deleteAttempts: () => deleteAttempts, ended: () => ended,
        employeeCount: () => (initial.employee ? 1 : 0) + committedEmployeeCreates,
        deps: { userModel: { findById: () => ({ select() { return this; }, session() { return this; },
            lean: async () => ({ privileges: 'A', team: 'THA', situation: 'A' }) }) }, employeeModel, historyModel, auditModel,
            auditCollectionChecker: async () => true, referenceChecker: async () => [],
            connection: { startSession: async () => session }, capabilityProbe: async () => true } };
}
function handler(mode, db) {
    const name = mode === 'add' ? 'postErgazomenoiForm' : 'postErgazomenoiUpdate';
    const start = source.indexOf(`static ${name} = async (req, res) => {`);
    const end = mode === 'add' ? source.indexOf('        // ✅ Έλεγχος ότι το _id υπάρχει', start) :
        source.indexOf('        // ✅ 6) ΕΝΗΜΕΡΩΣΗ ΩΡΑΡΙΩΝ', start);
    const body = source.slice(start, end).replace(`static ${name} = `, '');
    const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
    const constants = source.slice(source.indexOf('const fieldsStoixeionSymbashs'), source.indexOf('function parseS3Uri'));
    return vm.runInNewContext(`${constants}\n${helpers}\n(${body}\nreturn res.json({ success: true });\n})`, {
        Date, console: { log() {}, error(...args) { db.logs?.push(args); } }, mongoose, ...Terms, ...M, MODE_CORRECT_EXISTING: W.MODE_CORRECT_EXISTING, ...require('../../utils/ergazomenoi/forologikhKlimakaCode'), requireScopedEmployeeForUpdate,
        ErgazomenoiModel: db.employeeModel, IstorikoProslhpseonAllagonModel: db.historyModel,
        ...require('../../services/ergazomenoi/employeeAddSubmittedPatchService'),
        resolveEmployeeAddPersistenceTarget: db.resolveTarget || (async () => db.state().employee && db.retryTarget
            ? { action: 'CORRECT_EXISTING', employee: db.state().employee,
                history: db.state().history[0], afm: '123456789' }
            : { action: 'CREATE_NEW', afm: '' }),
        writeEmployeeEmploymentProfile: args => W.writeEmployeeEmploymentProfile({ ...args, ...db.deps }),
        ...require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionSaveContract'),
        // Baseline controller regressions keep the original guided persistence
        // boundary; composite integration cases below explicitly opt into it.
        writeEmployeeEmploymentProfileWithAutomaticReconstruction: args => db.composite
            ? W.writeEmployeeEmploymentProfileWithAutomaticReconstruction({ ...args, ...db.deps,
                correctionCatalogLoader: async () => ({}) })
            : (() => {
                db.dispatch?.push('writeEmployeeEmploymentProfileWithUniqueSafeRepair');
                return W.writeEmployeeEmploymentProfileWithUniqueSafeRepair({ ...args, ...db.deps });
            })(),
        writeEmployeeEmploymentProfileWithUniqueSafeRepair: args => {
            db.dispatch?.push('writeEmployeeEmploymentProfileWithUniqueSafeRepair');
            return W.writeEmployeeEmploymentProfileWithUniqueSafeRepair({ ...args, ...db.deps });
        },
        writeEmployeeDeparture: args => {
            db.dispatch?.push('writeEmployeeDeparture');
            return W.writeEmployeeDeparture({ ...args, ...db.deps }).catch(error => {
                db.departureError = error; throw error;
            });
        },
        writeEmployeeRehire: args => W.writeEmployeeRehire({ ...args, ...db.deps }),
        writeEmployeeDepartureDateCorrection: args =>
            W.writeEmployeeDepartureDateCorrection({ ...args, ...db.deps }).catch(error => {
                db.departureCorrectionError = error; throw error;
            }),
        writeEmployeeDepartureCancellation: args => W.writeEmployeeDepartureCancellation({ ...args, ...db.deps }),
        ...require('../../services/ergazomenoi/employeeScheduleDailyRestValidationService'),
        ...require('../../services/ergazomenoi/employeeHistoryResolutionAnalysisService'),
        buildEmployeeMaintenanceIdentity,
        dateKeyUtc: require('../../utils/date/mondaySundayWeek').dateKeyUtc
    });
}
async function submit(mode, input, db = memory(), body = {}) {
    const requestScope = db.requestScope || scope;
    const req = { body: { formData: plain(input), filesToUpdate: {}, skipContract: true, ...body },
        session: { userId:'authorized-user', userTeam: requestScope.team, companyInUse: requestScope.company_kod },
        params: { ergazomenoiId: db.state().employee?._id } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler(mode, db)(req, res);
    assert.equal(mongoose.connection.readyState, 0);
    return { db, res };
}
test('add and update controller paths reject invalid daily rest before any writer', async () => {
    const invalidSchedule = twoDaySchedule(
        [{ start: '14:00', end: '22:00' }],
        [{ start: '08:00', end: '16:00' }]
    );

    const addDb = memory();
    const add = await submit('add', { ...form(), ...invalidSchedule }, addDb);
    assert.equal(add.res.code, 400);
    assert.equal(add.res.body.reason, 'EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION');
    assert.match(add.res.body.message, /11 ωρών/);
    assert.equal(addDb.writes(), 0);

    const stored = await initial();
    const editDb = memory(stored);
    const edit = await submit('edit', { ...form(), ...invalidSchedule }, editDb);
    assert.equal(edit.res.code, 400);
    assert.equal(edit.res.body.reason, 'EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION');
    assert.equal(editDb.writes(), 0);
});

for (const [name, nextStart] of [['exactly eleven hours', '09:00'], ['more than eleven hours', '10:00']]) {
    test(`update controller allows ${name}`, async () => {
        const stored = await initial();
        const validSchedule = twoDaySchedule(
            [{ start: '14:00', end: '22:00' }],
            [{ start: nextStart, end: '17:00' }]
        );
        const result = await submit('edit', { ...form(), ...validSchedule }, memory(stored));
        assert.equal(result.res.code, 200, result.res.body?.message);
    });
}
test('employee add preserves 409 messages and hides unexpected technical failure', async () => {
    const conflictDb = memory();
    conflictDb.resolveTarget = async () => {
        throw Object.assign(new Error('Η ημερομηνία πρόσληψης διαφέρει.'),
            { statusCode: 409, code: 'EMPLOYEE_ADD_HIRE_DATE_CONFLICT' });
    };
    const conflict = await submit('add', form(), conflictDb);
    assert.equal(conflict.res.code, 409);
    assert.equal(conflict.res.body.message, 'Η ημερομηνία πρόσληψης διαφέρει.');

    const failureDb = memory();
    failureDb.logs = [];
    failureDb.resolveTarget = async () => {
        throw Object.assign(new Error('Cast failed for synthetic 123456789'),
            { name: 'CastError', path: 'afm', kind: 'string' });
    };
    const failure = await submit('add', form(), failureDb);
    assert.equal(failure.res.code, 500);
    assert.equal(failure.res.body.message, failure.res.body.errorMessage);
    assert.match(failure.res.body.message, /Η αποθήκευση δεν πραγματοποιήθηκε/);
    assert.doesNotMatch(JSON.stringify(failureDb.logs), /123456789|Cast failed/);
    assert.equal(failureDb.logs[0][1].errorPath, 'afm');
});

test('controller real-0069 fixture self-heals once and the second identical Save performs no writes', async () => {
    const fixture = buildReal0069SanitizedHistoryFixture();
    const db = memory({ employee: fixture.currentEmployee, history: fixture.history });
    db.requestScope = REAL_0069_SCOPE;
    const { _id, team, company_kod, kodikos, createdAt, updatedAt,
        ...submittedCurrent } = fixture.currentEmployee;
    const payload = {
        ...form(),
        ...submittedCurrent,
        istorikoId: REAL_0069_IDS['0005'],
        historyExpectedRevision: fixture.history[4].updatedAt,
        kathestos_apasxolhshs_stathera: '1',
        evelikth_proselefsh_edit: 120,
        hmeromhnia_lhxhs_symbashs: '2026-10-31'
    };
    const first = await submit('edit', payload, db);
    assert.equal(first.res.code, 200, first.res.body?.errorMessage);
    assert.deepEqual(db.state().history.map(row => row._id),
        [REAL_0069_IDS['0001'], REAL_0069_IDS['0005']]);
    assert.equal(db.state().history[0].nomimoHmeromisthio, 0);
    assert.equal(db.state().history[1].hmeromhnia_lhxhs_symbashs.slice(0, 10), '2026-10-31');
    assert.equal(db.state().audits.length, 1);
    assert.deepEqual(db.state().audits[0].deletedLegacyHistoryIds,
        [REAL_0069_IDS['0002'], REAL_0069_IDS['0003'], REAL_0069_IDS['0004']]);
    const writesAfterFirst = db.writes();
    const stateAfterFirst = plain(db.state());

    const secondPayload = { ...payload,
        historyExpectedRevision: db.state().history[1].updatedAt };
    const second = await submit('edit', secondPayload, db);
    assert.equal(second.res.code, 200, second.res.body?.errorMessage);
    assert.deepEqual(db.state(), stateAfterFirst);
    assert.equal(db.writes(), writesAfterFirst);
    assert.deepEqual(db.state().history.map(row => row._id),
        [REAL_0069_IDS['0001'], REAL_0069_IDS['0005']]);
    assert.equal(db.state().audits.length, 1);
});
async function initial(input = {}) {
    const { db, res } = await submit('add', { ...form(), ...input });
    assert.equal(res.code, 200, res.body?.errorMessage); return db.state();
}
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const Transition = require('../../utils/ergazomenoi/employmentProfileTransition');
async function legacyInitial() {
    const stored = plain(await initial({ dialleima_se_lepta: 30 }));
    for (const field of Transition.NEW_CURRENT_FIELDS) delete stored.employee[field];
    for (const field of [...C.FACT_FIELDS, T.ANCHOR, 'afora_allagh_dialleimatos', 'hmeromhnia_isxyos_dialleimatos_apo']) delete stored.history[0][field];
    stored.history[0].employment_profile_source = 'ERGOMENOI_CONTROLLER';
    return stored;
}
function assertLegacy(stored) {
    for (const field of Transition.NEW_CURRENT_FIELDS) assert.equal(Object.hasOwn(stored.employee, field), false, field);
    for (const row of stored.history) for (const field of [...C.FACT_FIELDS, T.ANCHOR]) assert.equal(Object.hasOwn(row, field), false, field);
}
for (const [name, extra] of [
    ['personal only', { email: 'maintenance@example.invalid' }],
    ['neutral serialized defaults', { [C.ENABLED]: false, [C.DAYS]: [],
        ...Object.fromEntries([C.TYPE, C.FROM, C.UNTIL, C.START, C.END, C.CATEGORY, ...C.BREAK_PAIRS.flat()].map(field => [field, ''])) }],
    ['unchanged work terms', { dialleima_se_lepta: 30, synexes_diakekomeno: false, typos_orarioy: false,
        dialleima_entos_ektos_orarioy: false, evelikth_proselefsh_edit: 0 }]
]) test(`LEGACY maintenance controller: ${name} stays physically legacy without a history write`, async () => {
    const stored = await legacyInitial();
    const historyUpdatedAt = stored.history[0].updatedAt;
    const { db, res } = await submit('edit', { ...form(), ...extra }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assertLegacy(db.state()); assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0]._id, stored.history[0]._id);
    assert.equal(db.state().history[0].aa_eggrafhs, stored.history[0].aa_eggrafhs);
    assert.equal(db.state().history[0].createdAt, stored.history[0].createdAt);
    assert.equal(db.state().employee.nomimosMisthos, 1200);
    assert.equal(db.state().history[0].nomimosMisthos, 1200);
    assert.equal(db.state().history[0].employment_profile_source, 'ERGOMENOI_CONTROLLER');
    if (extra.email) assert.equal(db.state().employee.email, extra.email);
    assert.equal(db.state().history[0].updatedAt, historyUpdatedAt);
    assert.equal(db.writes(), extra.email ? 1 : 0);
    const writesAfterFirst = db.writes();
    const second = await submit('edit', { ...form(), ...extra }, db);
    assert.equal(second.res.code, 200, second.res.body?.errorMessage);
    assert.equal(db.writes(), writesAfterFirst);
    assert.equal(db.state().history[0].updatedAt, historyUpdatedAt);
    assert.equal(db.ended(), true);
});
test('LEGACY real putFieldValues collection through profileInput/controller preserves missing facts', async () => {
    const stored = await legacyInitial(); delete stored.employee.dialleima_se_lepta;
    delete stored.employee.evelikth_proselefsh; delete stored.employee.synexes_diakekomeno;
    const code = fs.readFileSync(__dirname + '/../../../public/js/ergazomenoi/genika/putFieldValues.js', 'utf8');
    const start = code.indexOf('        const formData = {}');
    const body = code.slice(start, code.indexOf('// ✅ CONVERT PDFs TO BASE64', start));
    const inputs = Object.entries({ ...form(), [C.ENABLED]: false, dialleima_se_lepta: '',
        evelikth_proselefsh_edit: '', synexes_diakekomeno: false, email: 'changed@example.invalid' }).map(([name, value]) => ({
        name, tagName: 'INPUT', type: typeof value === 'boolean' ? 'checkbox' :
            typeof value === 'number' || ['dialleima_se_lepta', 'evelikth_proselefsh_edit'].includes(name) ? 'number' : 'text',
        value: String(value), checked: value === true, hasAttribute: () => false
    }));
    const payload = vm.runInNewContext(`(() => { ${body}\nreturn formData; })()`, {
        document: { querySelectorAll: () => [{ querySelectorAll: () => inputs }] },
        window: require('../../../public/js/ergazomenoi/genika/employmentProfileUi')
    });
    assert.equal(payload[C.ENABLED], false); assert.equal(payload.dialleima_se_lepta, 0);
    const { db, res } = await submit('edit', payload, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assertLegacy(db.state());
    for (const field of ['dialleima_se_lepta', 'evelikth_proselefsh', 'synexes_diakekomeno']) assert.equal(Object.hasOwn(db.state().employee, field), false);
    assert.equal(db.state().employee.email, 'changed@example.invalid');
});
for (const [name, changes, field, expected] of [
    ['break', { dialleima_se_lepta: 20 }, 'dialleima_se_lepta', 20],
    ['weekly hours', { ores_ergasias_ebdomadas: 32 }, 'ores_ergasias_ebdomadas', 32],
    ['working days', { hmeres_ergasias_ebdomadas: 4 }, 'hmeres_ergasias_ebdomadas', 4],
    ['continuous work', { synexes_diakekomeno: true }, 'synexes_diakekomeno', true],
    ['arrangement', enabled, C.ENABLED, true],
    ['interval', { dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:30' }, 'dialleima_apo_ora_01', '12:00']
]) test(`LEGACY real ${name} change creates first V1 with an immutable before-image`, async () => {
    const stored = await legacyInitial();
    const { db, res } = await submit('edit', { ...form(), ...changes }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().employee[C.SCHEMA_VERSION], 1);
    assert.equal(db.state().history[0][C.SCHEMA_VERSION], 1);
    assert.equal(db.state().employee[field], expected); assert.equal(db.state().history[0][field], expected);
    assert.equal(db.state().employee[T.ANCHOR].facts.dialleima_se_lepta, 30);
    assert.equal(db.state().employee[T.ANCHOR].facts.ores_ergasias_ebdomadas, 40);
    const before = plain(db.state().employee[T.ANCHOR]);
    const edited = await submit('edit', { ...form(), ...changes, email: 'v1@example.invalid' }, memory(db.state()));
    assert.equal(edited.res.code, 200, edited.res.body?.errorMessage);
    assert.equal(edited.db.state().history.length, 1);
    assert.deepEqual(edited.db.state().employee[T.ANCHOR], before);
    assert.equal(edited.db.state().employee[C.SCHEMA_VERSION], 1);
    for (const key of C.FACT_FIELDS) assert.deepEqual(edited.db.state().employee[key], edited.db.state().history[0][key], key);
});
test('LEGACY personal-only maintenance never touches history even when history writes would fail', async () => {
    const stored = await legacyInitial(), db = memory(stored, 'history');
    const { res } = await submit('edit', { ...form(), email: 'rollback@example.invalid' }, db);
    assert.equal(res.code, 200); assert.equal(db.writes(), 1);
    assert.equal(db.state().employee.email, 'rollback@example.invalid');
    assert.deepEqual(db.state().history, stored.history); assert.equal(db.ended(), true);
});
test('LEGACY no matching history retains baseline insertion without V1 defaults', async () => {
    const stored = await legacyInitial(); stored.history = [];
    const { db, res } = await submit('edit', { ...form(), [C.ENABLED]: false }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assertLegacy(db.state());
    assert.equal(db.state().history.length, 1); assert.equal(db.state().history[0].aa_eggrafhs, '0001');
});
test('imported legacy employee with no history saves departure in one baseline transaction', async () => {
    const stored = await legacyInitial();
    stored.history = [];
    stored.employee.hmeromhnia_proslhpshs = '2025-05-01T00:00:00.000Z';
    delete stored.employee.hmeromhnia_isxyos_oron_ergasias_apo;
    delete stored.employee.hmeromhnia_allaghs_orarioy_apo;
    const importedForm = { ...form(), istorikoId: '', hmeromhnia_proslhpshs: '2025-05-01',
        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_allaghs_orarioy_apo: null,
        hmeromhnia_apoxorhshs: '2026-09-10' };
    const { db, res } = await submit('edit', importedForm, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo.slice(0, 10), '2025-05-01');
    assert.equal(db.state().history[0].hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-10');
    assert.equal(db.state().employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-10');
});
test('first departure with an unrelated profile mutation is rejected as a separate Save', async () => {
    const stored = await initial();
    stored.employee.email = 'before@example.invalid';
    const db = memory(stored);
    const { res } = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '2026-09-20',
        email: 'after@example.invalid' }, db);
    assertSaveHistoryAction(res);
    assert.deepEqual(db.state(), stored);
});
test('Save business stop ignores forged client target and rolls back Employee, History and Audit', async () => {
    const stored = await initial();
    stored.audits = [{ sentinel: 'unchanged' }];
    const db = memory(stored);
    const { res } = await submit('edit', { ...form(),
        istorikoId: 'ffffffffffffffffffffffff',
        hmeromhnia_apoxorhshs: '2026-09-20', email: 'after@example.invalid' }, db);
    assertSaveHistoryAction(res);
    assert.equal(db.writes(), 0);
    assert.equal(db.ended(), true);
    assert.deepEqual(db.state().employee, stored.employee);
    assert.deepEqual(db.state().history, stored.history);
    assert.deepEqual(db.state().audits, stored.audits);
});

test('action transport is endpoint-specific and cannot expose internal or unproven target metadata', () => {
    const error = Object.assign(new Error('internal'), {
        code: 'EMPLOYEE_DEPARTURE_PROFILE_CHANGE_REQUIRES_SEPARATE_SAVE', statusCode: 409,
        historyReviewTargetId: 'ffffffffffffffffffffffff',
        departureCorrectionChangedFields: ['internal'], patch: { secret: true }
    });
    const res = { status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; } };
    M.profileError(res, error);
    assert.equal(res.code, 409);
    assert.equal(res.body.actionRequired, undefined);
    M.profileError(res, error, { employeeSaveActionRequired: true });
    assertSaveHistoryAction(res);
    M.profileError(res, { code: 'EMPLOYEE_HISTORY_EDITOR_STALE', statusCode: 409 },
        { employeeSaveActionRequired: true });
    assert.equal(res.code, 409);
    assert.equal(res.body.actionRequired, undefined);
});

test('same-departure Maintenance ignores a submitted active flag without a new cycle', async () => {
    const stored = await initial();
    stored.employee.hmeromhnia_apoxorhshs = '2026-09-20';
    stored.employee.energos = false;
    stored.history[0].hmeromhnia_apoxorhshs = '2026-09-20';
    const beforeIds = stored.history.map(row => row._id);
    const { db, res } = await submit('edit', { ...form(),
        hmeromhnia_apoxorhshs: '2026-09-20', energos: true }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    const after = db.state();
    assert.equal(after.employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-20');
    assert.equal(after.employee.energos, false);
    assert.equal(after.history.length, stored.history.length);
    assert.deepEqual(after.history.map(row => row._id), beforeIds);
    assert.equal(after.history[0].hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-20');
    assert.equal(after.employee.hmeromhnia_proslhpshs.slice(0, 10), stored.employee.hmeromhnia_proslhpshs.slice(0, 10));
});
test('explicit departure cancellation reopens the same cycle through the controller', async () => {
    const initialState = await initial();
    const departed = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '2026-09-20',
        energos: true }, memory(initialState));
    assert.equal(departed.res.code, 200, departed.res.body?.errorMessage);
    const closed = departed.db.state();
    assert.equal(closed.employee.energos, false);
    const reopened = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '',
        historyExpectedRevision: closed.history.at(-1).updatedAt,
        energos: true }, memory(closed));
    assert.equal(reopened.res.code, 200, reopened.res.body?.errorMessage);
    const after = reopened.db.state();
    assert.equal(after.employee.hmeromhnia_apoxorhshs, null);
    assert.equal(after.employee.energos, true);
    assert.equal(after.history.length, closed.history.length);
    assert.deepEqual(after.history.map(row => row._id), closed.history.map(row => row._id));
    assert.equal(after.history.at(-1).hmeromhnia_apoxorhshs, null);
    assert.equal(after.employee.hmeromhnia_proslhpshs, initialState.employee.hmeromhnia_proslhpshs);
    assert.equal(W.writeEmployeeDepartureCancellation !== undefined, true);
});
test('departure cancellation never acknowledges an unrelated email change without saving it', async () => {
    const initialState = await initial();
    initialState.employee.email = 'old@example.test';
    const departed = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '2026-09-20',
        energos: true, email: 'old@example.test' }, memory(initialState));
    assert.equal(departed.res.code, 200, departed.res.body?.errorMessage);
    const closed = departed.db.state();
    const attempt = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '',
        historyExpectedRevision: closed.history.at(-1).updatedAt,
        energos: true, email: 'new@example.test' }, memory(closed));
    assert.equal(attempt.res.code, 409);
    assert.equal(attempt.res.body.reason, 'EMPLOYEE_DEPARTURE_CANCELLATION_SEPARATE_SAVE_REQUIRED');
    assert.match(attempt.res.body.errorMessage, /ακύρωση αποχώρησης πρέπει να αποθηκευτεί χωριστά/);
    assert.deepEqual(attempt.db.state(), closed);
});

test('stale departure cancellation is rejected before any mutation', async () => {
    const departed = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '2026-09-20',
        energos: true }, memory(await initial()));
    const closed = departed.db.state();
    const stale = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '',
        historyExpectedRevision: '2026-01-01T00:00:00.000Z', energos: true }, memory(closed));
    assert.equal(stale.res.code, 409);
    assert.equal(stale.res.body.reason, 'EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE');
    assert.deepEqual(stale.db.state(), closed);
});

for (const [label, requestedDate] of [['later', '2026-09-23'], ['earlier', '2026-09-18']]) {
    test(`${label} departure-date correction uses the controlled writer path`, async () => {
        const departed = await submit('edit', { ...form(),
            hmeromhnia_apoxorhshs: '2026-09-20', energos: true }, memory(await initial()));
        assert.equal(departed.res.code, 200, departed.res.body?.errorMessage);
        const closed = departed.db.state();
        const terminal = closed.history.at(-1);
        const corrected = await submit('edit', { ...form(),
            hmeromhnia_apoxorhshs: requestedDate,
            historyExpectedRevision: terminal.updatedAt,
            energos: false }, memory(closed));
        assert.equal(corrected.res.code, 200, corrected.res.body?.errorMessage);
        assert.equal(corrected.db.state().employee.hmeromhnia_apoxorhshs.slice(0, 10),
            requestedDate);
        assert.equal(corrected.db.state().history.at(-1).hmeromhnia_apoxorhshs.slice(0, 10),
            requestedDate);
        assert.deepEqual(corrected.db.state().history.map(row => row._id),
            closed.history.map(row => row._id));
    });
}

test('departure-date correction before hire is rejected without writes', async () => {
    const departed = await submit('edit', { ...form(),
        hmeromhnia_apoxorhshs: '2026-09-20', energos: true }, memory(await initial()));
    const closed = departed.db.state();
    const attempt = await submit('edit', { ...form(),
        hmeromhnia_apoxorhshs: '2026-03-31',
        historyExpectedRevision: closed.history.at(-1).updatedAt,
        energos: false }, memory(closed));
    assert.equal(attempt.res.code, 409);
    assert.equal(attempt.res.body.reason, 'EMPLOYEE_DEPARTURE_BEFORE_HIRE');
    assert.deepEqual(attempt.db.state(), closed);
});

test('stale departure correction cannot overwrite a concurrent newer correction', async () => {
    const departed = await submit('edit', { ...form(),
        hmeromhnia_apoxorhshs: '2026-09-20', energos: true }, memory(await initial()));
    const loadedByUserA = departed.db.state();
    const oldRevision = loadedByUserA.history.at(-1).updatedAt;
    const changedByUserB = await submit('edit', { ...form(),
        hmeromhnia_apoxorhshs: '2026-09-22', historyExpectedRevision: oldRevision,
        energos: false }, memory(loadedByUserA));
    assert.equal(changedByUserB.res.code, 200, changedByUserB.res.body?.errorMessage);
    const latest = changedByUserB.db.state();
    const stale = await submit('edit', { ...form(),
        hmeromhnia_apoxorhshs: '2026-09-23', historyExpectedRevision: oldRevision,
        energos: false }, memory(latest));
    assert.equal(stale.res.code, 409);
    assert.equal(stale.res.body.reason, 'EMPLOYEE_DEPARTURE_DATE_CORRECTION_STALE');
    assert.deepEqual(stale.db.state(), latest);
});

test('normal cancellation repairs one uniquely proven invalid departure-before-hire', async () => {
    const invalid = await initial();
    invalid.employee.hmeromhnia_apoxorhshs = '2026-03-31';
    invalid.employee.energos = true;
    invalid.history[0].hmeromhnia_apoxorhshs = '2026-03-31';
    const revision = invalid.history[0].updatedAt;
    const repaired = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '',
        historyExpectedRevision: revision, energos: true }, memory(invalid));
    assert.equal(repaired.res.code, 200, repaired.res.body?.errorMessage);
    assert.equal(repaired.db.state().employee.hmeromhnia_apoxorhshs, null);
    assert.equal(repaired.db.state().history[0].hmeromhnia_apoxorhshs, null);
    assert.equal(repaired.db.state().history.length, 1);
});

test('invalid departure cancellation rejects competing matching history evidence', async () => {
    const invalid = await initial();
    invalid.employee.hmeromhnia_apoxorhshs = '2026-03-31';
    invalid.employee.energos = true;
    invalid.history[0].hmeromhnia_apoxorhshs = '2026-03-31';
    invalid.history.push({ ...plain(invalid.history[0]), _id: 'competing-invalid',
        aa_eggrafhs: '0002', updatedAt: '2026-04-02T00:00:00.000Z' });
    const before = plain(invalid);
    const attempt = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '',
        historyExpectedRevision: invalid.history[0].updatedAt,
        energos: true }, memory(invalid));
    assert.equal(attempt.res.code, 409);
    assert.equal(attempt.res.body.reason,
        'EMPLOYEE_HISTORY_INVALID_DEPARTURE_TARGET_MISMATCH');
    assert.deepEqual(attempt.db.state(), before);
});
test('Maintenance invalid departure returns a lifecycle error without writes', async () => {
    const stored = await initial();
    const db = memory(stored);
    const { res } = await submit('edit', { ...form(), hmeromhnia_apoxorhshs: '2026-02-30' }, db);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, 'EMPLOYEE_DEPARTURE_INVALID_DATE');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), stored);
});
test('LEGACY maintenance preserves sparse history and baseline ordinary contract updates', async () => {
    const stored = await legacyInitial();
    for (const field of T.STANDARD_FIELDS) delete stored.history[0][field];
    const { db, res } = await submit('edit', { ...form(), nomimosMisthos: 1250, poso_symbashs_01: 1250 }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assertLegacy(db.state());
    for (const field of T.STANDARD_FIELDS) assert.equal(Object.hasOwn(db.state().history[0], field), false, field);
    for (const row of [db.state().employee, db.state().history[0]]) {
        assert.equal(row.nomimosMisthos, 1250); assert.equal(row.poso_symbashs_01, 1250);
    }
});
test('forged ordinary-maintenance append intent cannot create a legacy history version', async () => {
    const stored = await legacyInitial();
    const { db, res } = await submit('edit', { ...form(), historyMutationIntent: 'APPEND_NEW_VERSION',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0]._id, stored.history[0]._id);
});
for (const kind of ['employee', 'history']) test(`LEGACY maintenance stale ${kind} rolls back`, async () => {
    const stored = await legacyInitial(), db = memory(stored);
    db[`${kind}Model`].updateOne = async () => ({ matchedCount: 0 });
    const { res } = await submit('edit', { ...form(), email: 'stale@example.invalid',
        hmeromhnia_lhxhs_symbashs: '2026-10-31' }, db);
    assert.equal(res.code, 409); assert.match(res.body.reason, /STALE/); assert.deepEqual(db.state(), stored);
});
const addCases = [
    ['legacy/default', {}, null], ['disabled', { [C.ENABLED]: false }, null], ['enabled', enabled, null],
    ['unknown type', { ...enabled, [C.TYPE]: 'unknown' }, C.TYPE],
    ['missing start', { ...enabled, [C.FROM]: null }, C.FROM],
    ['open end', { ...enabled, [C.UNTIL]: null }, null],
    ['end date', { ...enabled, [C.UNTIL]: '2026-10-01' }, null],
    ['end before start', { ...enabled, [C.UNTIL]: '2026-08-31' }, C.UNTIL],
    ['all weekdays', { ...enabled, [C.DAYS]: [] }, null],
    ['normalize weekdays', { ...enabled, [C.DAYS]: ['7', 1, 7] }, null],
    ['break pairs', { dialleima_se_lepta: 30, dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:15', dialleima_apo_ora_02: '13:00', dialleima_eos_ora_02: '13:15' }, null],
    ['incomplete break', { dialleima_apo_ora_01: '12:00' }, 'dialleima_apo_ora_01'],
    ['overlap', { dialleima_se_lepta: 30, dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:15', dialleima_apo_ora_02: '12:10', dialleima_eos_ora_02: '12:25' }, 'dialleima'],
    ['overnight', { dialleima_se_lepta: 30, dialleima_apo_ora_01: '23:50', dialleima_eos_ora_01: '00:20' }, null],
    ['mismatch', { dialleima_se_lepta: 20, dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:15' }, 'dialleima_se_lepta'],
    ['new over 30', { dialleima_se_lepta: 45 }, 'dialleima_se_lepta'],
    ['server versions', { ...enabled, [C.SCHEMA_VERSION]: 99, [C.TYPE_VERSION]: 'spoof' }, null]
];
for (const [name, input, invalid] of addCases) test(`ADD controller: ${name}`, async () => {
    const { db, res } = await submit('add', { ...form(), ...input });
    if (invalid) {
        assert.equal(res.code, 400); assert.equal(res.body.field, invalid);
        assert.equal(db.writes(), 0); assert.equal(db.state().employee, null); return;
    }
    assert.equal(res.code, 200, `${res.body?.reason}: ${res.body?.errorMessage}`); assert.equal(db.state().history.length, 1);
    const expected = plain(C.normalizeEmploymentProfileSubmission(M.profileInput({ ...form(), ...input }, 'add')));
    for (const field of C.FACT_FIELDS) {
        assert.deepEqual(db.state().employee[field], expected[field], field);
        assert.deepEqual(db.state().history[0][field], expected[field], field);
    }
    assert.equal(db.ended(), true);
});
for (const fail of ['history', 'commit']) test(`ADD rolls back both documents on ${fail} failure`, async () => {
    const db = memory(undefined, fail); const { res } = await submit('add', form(), db);
    assert.equal(res.code, 500); assert.deepEqual(db.state(), { employee: null, history: [] });
});
test('EDIT omission preserves new fields and exact correction creates no duplicate', async () => {
    const stored = await initial({ ...enabled, dialleima_se_lepta: 30, dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:30' });
    const { db, res } = await submit('edit', form(), memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assert.equal(db.state().history.length, 1);
    for (const field of C.FACT_FIELDS) assert.deepEqual(db.state().employee[field], stored.employee[field], field);
    assert.equal(db.state().history[0]._id, stored.history[0]._id);
});
for (const terminationType of ['ma_217', 'ma_222', 'ma_227']) test(
    `EDIT ${terminationType} uses original historyId when departure identity changes`, async () => {
        const stored = await initial();
        stored.employee.hmeromhnia_apoxorhshs = null;
        stored.history[0].hmeromhnia_apoxorhshs = null;
        const originalId = stored.history[0]._id;
        const { db, res } = await submit('edit', { ...form(), istorikoId: originalId,
            hmeromhnia_apoxorhshs: '2026-09-10', terminationType }, memory(stored));
        assert.equal(res.code, 200, res.body?.errorMessage);
        assert.equal(db.state().history.length, 1);
        assert.equal(db.state().history[0]._id, originalId);
        assert.equal(db.state().history[0].hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-10');
    }
);
for (const [name, input, check] of [
    ['false', { [C.ENABLED]: false }, row => { assert.equal(row[C.ENABLED], false); assert.equal(row[C.TYPE], enabled[C.TYPE]); }],
    ['clear category', { [C.CATEGORY]: '' }, row => assert.equal(row[C.CATEGORY], null)],
    ['clear optional end', { [C.UNTIL]: null }, row => assert.equal(row[C.UNTIL], null)],
    ['clear days', { [C.DAYS]: [] }, row => assert.deepEqual(row[C.DAYS], [])],
    ['normalize days', { [C.DAYS]: ['7', 2, 2] }, row => assert.deepEqual(row[C.DAYS], [2, 7])],
    ['preserve category with another type', { [C.TYPE]: 'OTHER_APPROVED_ARRANGEMENT' }, row => assert.equal(row[C.CATEGORY], 'existing-code')]
]) test(`EDIT controller: ${name}`, async () => {
    const stored = await initial({ ...enabled, [C.UNTIL]: '2026-10-01', [C.DAYS]: [1, 5] });
    const { db, res } = await submit('edit', { ...form(), ...input }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); check(db.state().employee); check(db.state().history[0]);
});
test('EDIT ordinary endpoint rejects forged APPEND_NEW_VERSION when business intent is ambiguous', async () => {
    const stored = await initial();
    const before = plain(stored);
    const { db, res } = await submit('edit', { ...form(), ...enabled,
        historyMutationIntent: 'APPEND_NEW_VERSION',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15', nomimosMisthos: 1400, poso_symbashs_01: 1400 }, memory(stored));
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, 'CONFLICT_PROFILE_CHANGE_INTENT_REQUIRED');
    assert.deepEqual(db.state(), before);
    assert.equal(db.writes(), 0);
});
test('EDIT loaded historyId moves the same existing boundary instead of appending', async () => {
    const stored = await initial();
    const original = plain(stored.history[0]);
    const { db, res } = await submit('edit', { ...form(), istorikoId: original._id,
        hmeromhnia_allaghs_symbashs: '2026-09-13',
        hmeromhnia_allaghs_orarioy_apo: '2026-09-13',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-13',
        hmeromhnia_allaghs_orarioy_eos: '2026-09-19',
        kathestos_apasxolhshs: '1', kathestos_apasxolhshs_stathera: '1',
        hmeres_ergasias_ebdomadas: 3, ores_ergasias_ebdomadas: 24,
        mo_oron_hmerhsias_ergasias: 8 }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0]._id, original._id);
    assert.equal(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo.slice(0, 10), '2026-09-13');
    assert.equal(db.state().history[0].typos_apasxolhshs, '1');
    for (const record of [db.state().history[0], db.state().employee]) {
        assert.equal(record.kathestos_apasxolhshs, '1');
        assert.equal(record.hmeres_ergasias_ebdomadas, 3);
        assert.equal(record.ores_ergasias_ebdomadas, 24);
    }
});

test('EDIT loaded historyId treats forged append intent only as a same-row boundary request', async () => {
    const stored = await twoVersions();
    for (const [istorikoId, effectiveFrom] of [
        [stored.history[1]._id, '2026-08-01'],
        [stored.history[0]._id, '2026-09-15']
    ]) {
        const db = memory(stored);
        const { res } = await submit('edit', { ...form(), istorikoId,
            historyMutationIntent: 'APPEND_NEW_VERSION',
            hmeromhnia_allaghs_symbashs: effectiveFrom,
            hmeromhnia_allaghs_orarioy_apo: effectiveFrom,
            hmeromhnia_isxyos_oron_ergasias_apo: effectiveFrom }, db);
        assert.equal(res.code, 409);
        assert.equal(res.body.reason, 'CONFLICT_OVERLAP');
        assert.deepEqual(db.state(), stored); assert.equal(db.writes(), 0);
    }
});
test('EDIT correction history failure rolls back personal fields and profile together', async () => {
    const stored = await initial(enabled); const db = memory(stored, 'history');
    const { res } = await submit('edit', { ...form(), [C.ENABLED]: false, eponymoHidden: 'Changed' }, db);
    assert.equal(res.code, 500); assert.deepEqual(db.state(), stored);
});
test('EDIT forged retrospective append intent cannot insert a history row', async () => {
    const stored = await initial(); const { db, res } = await submit('edit', { ...form(),
        historyMutationIntent: 'APPEND_NEW_VERSION',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-03-15' }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0]._id, stored.history[0]._id);
});
for (const append of [false, true]) test(`EDIT ordinary legacy 45 requires correction even when omitted, append=${append}`, async () => {
    const stored = await initial(); stored.employee.dialleima_se_lepta = 45; stored.history[0].dialleima_se_lepta = 45;
    const data = { ...form(), ...(append ? { hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' } : {}) };
    for (const input of [data, { ...data, dialleima_se_lepta: 45 }]) {
        const { db, res } = await submit('edit', input, memory(stored));
        assert.equal(res.code, 400); assert.equal(res.body.field, 'dialleima_se_lepta');
        assert.deepEqual(db.state(), stored); assert.equal(db.writes(), 0);
    }
});
test('EDIT scope still rejects forged employee identity before writes', async () => {
    const db = memory(await initial()); const req = { body: { formData: form() },
        params: { ergazomenoiId: 'ffffffffffffffffffffffff' }, session: { userTeam: scope.team, companyInUse: scope.company_kod } };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler('edit', db)(req, res); assert.equal(res.code, 404); assert.equal(db.writes(), 0);
});
test('EDIT stale history revision returns actionable 409 before any write', async () => {
    const stored = await initial();
    stored.history[0].updatedAt = '2026-09-26T08:00:00.000Z';
    const { db, res } = await submit('edit', { ...form(), istorikoId: stored.history[0]._id,
        historyExpectedRevision: '2026-09-26T07:59:59.000Z', email: 'stale@example.test' }, memory(stored));
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, 'CONFLICT_STALE');
    assert.equal(res.body.actionRequired, undefined);
    assert.equal(res.body.nextAction, undefined);
    assert.match(res.body.message, /άλλαξαν από άλλο χρήστη/);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), stored);
});
test('EDIT matching history revision allows the normal employee-only Save', async () => {
    const stored = await initial();
    stored.history[0].updatedAt = '2026-09-26T08:00:00.000Z';
    const { db, res } = await submit('edit', { ...form(), istorikoId: stored.history[0]._id,
        historyExpectedRevision: stored.history[0].updatedAt, email: 'fresh@example.test' }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().employee.email, 'fresh@example.test');
    assert.deepEqual(db.state().history, stored.history);
    assert.equal(db.writes(), 1);
});
test('controller downstream Save response, uploads, ERGANI and schedule code unchanged outside contract generation', () => {
    const baseline = execFileSync('git', ['show', 'da765ee8050c91419b7707839b55e4ead0412ef3:server/controllers/ergazomenoi/ergazomenoiController.js'], { encoding: 'utf8' }).replaceAll('\r', '');
    for (const [start, end] of [
        ['        // ✅ 6) ΕΝΗΜΕΡΩΣΗ ΩΡΑΡΙΩΝ', '        // ✅ 7)'],
        ['        // ✅ 8) ΕΠΕΞΕΡΓΑΣΙΑ PDF', '        // ✅ 9) ΑΥΤΟΜΑΤΗ ΔΗΜΙΟΥΡΓΙΑ PDF ΣΥΜΒΑΣΗΣ'],
        ['        // ✅ 10) ΑΝΑΚΤΗΣΗ ΔΕΔΟΜΕΝΩΝ', '    static deleteErgazomenoi']
    ]) {
        const oldStart = baseline.indexOf(start), newStart = source.indexOf(start);
        assert(oldStart >= 0 && newStart >= 0, start);
        let oldEnd = baseline.indexOf(end, oldStart);
        if (oldEnd < 0) oldEnd = baseline.length;
        let chunk = baseline.slice(oldStart, oldEnd).trimEnd();
        // Section separators immediately before the moved history are not executable.
        chunk = chunk.replace(/\n\s*\/\/ =+$/, '');
        if (start.includes('ΕΠΕΞΕΡΓΑΣΙΑ PDF') || start.includes('ΑΝΑΚΤΗΣΗ ΔΕΔΟΜΕΝΩΝ')) chunk = chunk.replace(
            /hmeromhnia: \{\n\s*\$gte: new Date\(formData\.hmeromhnia_allaghs_orarioy_apo\),\n\s*\$lte: new Date\(formData\.hmeromhnia_allaghs_orarioy_eos\)\n\s*\}/,
            match => match.replace('hmeromhnia: {', 'hmeromhnia: mongoose.trusted({').replace(/\n(\s*)\}$/, '\n$1})'));
        const compared = source.slice(newStart)
            .replace("message: automaticReconstructionApplied ? 'Η αποθήκευση ολοκληρώθηκε και το Ιστορικό τακτοποιήθηκε.' : 'Εργαζόμενος ενημερώθηκε επιτυχώς',\n            automaticReconstructionApplied,", "message: 'Εργαζόμενος ενημερώθηκε επιτυχώς',");
        assert(compared.startsWith(chunk), start);
    }
});

function historyHandler(db) {
    const start = source.indexOf('static updateIstorikoData = '), end = source.indexOf('    static searchPostErgazomenoi', start);
    const method = source.slice(start, end).trim().replace('static updateIstorikoData = ', '').replace(/;$/, '');
    const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
    return vm.runInNewContext(`${helpers}\n(${method})`, { Date, console: { error() {} }, ...Terms, ...M, ...EditorState,
        buildEmployeeMaintenanceIdentity,
        ErgazomenoiModel: db.employeeModel,
        ...Authorization, getEmployeeHistoryAccess: async () => ({ mode: 'ADMIN_FULL' }),
        writeEmployeeEmploymentHistoryOperations: args => W.writeEmployeeEmploymentHistoryOperations({ ...args, ...db.deps,
                userModel: { findById: () => ({ select() { return this; }, session() { return this; },
                    lean: async () => ({ privileges: 'A', team: 'THA', situation: 'A' }) }) } }) });
}
async function editHistory(db, updates) {
    const req = { session: { userId: 'authorized-user', userTeam: scope.team, companyInUse: scope.company_kod },
        body: { employeeId: db.state().employee._id, updates,
            expectedStateToken: EditorState.buildEmployeeHistoryEditorStateToken({
                currentEmployee: db.state().employee, historyRows: db.state().history.filter(row =>
                    ['team', 'company_kod', 'kodikos'].every(field =>
                        String(row[field]) === String(db.state().employee[field]))) }) } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await historyHandler(db)(req, res); return res;
}
function rowData(row, extra = {}) {
    return { ...row, pososto_prosayxhshs_6hs_hmeras: 40, ...extra };
}

for (const flag of [false, true]) {
    test(`HTTP History ignores hire flag ${flag} -> ${!flag} and saves an unrelated edit`, async () => {
        const stored = await initial();
        stored.history[0].afora_proslhpsh = flag;
        const db = memory(stored), row = stored.history[0];
        const res = await editHistory(db, [{ state: 'modified', _id: row._id,
            data: rowData(row, { afora_proslhpsh: !flag, [C.DAYS]: [7, 1] }) }]);
        assert.equal(res.code, 200, res.body.message);
        assert.equal(db.state().history.length, 1);
        assert.equal(db.state().history[0]._id, row._id);
        assert.equal(db.state().history[0].afora_proslhpsh, flag);
        assert.deepEqual(db.state().history[0][C.DAYS], [1, 7]);
        assert.equal(mongoose.connection.readyState, 0);
    });
    for (const legacy of [false, true]) {
        test(`HTTP Maintenance (${legacy ? 'legacy' : 'recorded'}) ignores hire flag ${flag} -> ${!flag}`, async () => {
            const stored = legacy ? await legacyInitial() : await initial();
            stored.history[0].afora_proslhpsh = flag;
            const { db, res } = await submit('edit', { ...form(), afora_proslhpsh: !flag,
                email: 'maintenance@example.invalid' }, memory(stored));
            assert.equal(res.code, 200, res.body?.errorMessage);
            assert.equal(db.state().employee.email, 'maintenance@example.invalid');
            assert.equal(db.state().history.length, 1);
            assert.equal(db.state().history[0]._id, stored.history[0]._id);
            assert.equal(db.state().history[0].afora_proslhpsh, flag);
            if (legacy) assertLegacy(db.state());
        });
    }
}

test('HTTP History insert cannot claim hire ownership and initial Add cannot suppress it', async () => {
    const { db: added, res: addResponse } = await submit('add', { ...form(), afora_proslhpsh: false });
    assert.equal(addResponse.code, 200, addResponse.body?.errorMessage);
    assert.equal(added.state().history[0].afora_proslhpsh, true);
    const stored = added.state(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'inserted', data: rowData(stored.history[0], {
        hmeromhnia_allaghs_orarioy_apo: '2026-05-01',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01', afora_proslhpsh: true
    }) }]);
    assert.equal(res.code, 200, res.body.message);
    assert.equal(db.state().history.length, 2);
    assert.equal(db.state().history.find(row => row._id === stored.history[0]._id).afora_proslhpsh, true);
    assert.equal(db.state().history.find(row => row._id !== stored.history[0]._id).afora_proslhpsh, false);
});
function nestedValues(value, segments) {
    if (Array.isArray(value)) return value.flatMap(item => nestedValues(item, segments));
    if (!segments.length) return [value];
    if (value === null || value === undefined) return [];
    return nestedValues(value[segments[0]], segments.slice(1));
}
function referenceCollection(documents) {
    return { async findOne(query) {
        return documents.find(document => query.$or.some(clause => {
            const [path, condition] = Object.entries(clause)[0];
            const ids = condition.$in.map(String);
            return nestedValues(document, path.split('.')).some(value => ids.includes(String(value)));
        })) || null;
    } };
}
test('history editor corrects exact latest row and current atomically with baseline numbering', async () => {
    const stored = await initial(enabled), db = memory(stored);
    const row = stored.history[0];
    const res = await editHistory(db, [{ _id: row._id, state: 'modified', data: rowData(row, { [C.DAYS]: [7, 1] }) }]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history.length, 1);
    assert.deepEqual(db.state().employee[C.DAYS], [1, 7]); assert.deepEqual(db.state().history[0][C.DAYS], [1, 7]);
    assert.equal(db.state().history[0].aa_eggrafhs, row.aa_eggrafhs);
    assert(new Date(db.state().history[0].updatedAt) > new Date(row.updatedAt));
});
for (const state of ['inserted', 'deleted']) test(`history editor rejects specifically unsupported ${state} atomically`, async () => {
    const stored = await initial(), db = memory(stored);
    const res = await editHistory(db, [{ _id: stored.history[0]._id, state, data: form() }]);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, state === 'inserted' ? 'EMPLOYEE_PROFILE_NON_APPEND_CHANGE' : 'EMPLOYEE_HISTORY_CORRECTION_REQUIRED');
    assert.deepEqual(db.state(), stored);
});
test('history editor cannot change date identity or correct an unknown ID', async () => {
    const stored = await initial(); const row = stored.history[0];
    for (const update of [
        { _id: row._id, state: 'modified', data: rowData(row, { hmeromhnia_isxyos_oron_ergasias_apo: '2026-03-01' }) },
        { _id: 'ffffffffffffffffffffffff', state: 'modified', data: rowData(row) }
    ]) {
        const db = memory(stored); const res = await editHistory(db, [update]);
        assert.equal(res.code, 409); assert.equal(res.body.reason, update._id === row._id ? 'EMPLOYEE_HISTORY_CORRECTION_REQUIRED' : 'EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
        assert.deepEqual(db.state(), stored); assert.equal(db.writes(), 0);
    }
});
test('open-cycle hire guard controller rejects crafted History hire request without writes', async () => {
    const stored = await initial();
    const row = stored.history[0];
    const db = memory(stored);
    const res = await editHistory(db, [{ _id: row._id, state: 'modified',
        data: rowData(row, { hmeromhnia_proslhpshs: '2026-09-15' }) }]);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason,
        'EMPLOYEE_HISTORY_CORRECTION_REQUIRED');
    assert.match(res.body.message, /Έλεγχος \/ Διόρθωση/);
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), stored);
});
test('batch history corrections validate the complete plan before any physical write', async () => {
    const stored = await initial(enabled), db = memory(stored), row = stored.history[0];
    const res = await editHistory(db, [
        { _id: row._id, state: 'modified', data: rowData(row, { [C.ENABLED]: false }) },
        { _id: 'ffffffffffffffffffffffff', state: 'modified', data: rowData(row) }
    ]);
    assert.equal(res.code, 409); assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), stored); assert.equal(db.ended(), true);
});
test('older exact correction preserves current profile and surrounding version', async () => {
    const db = memory(await twoVersions());
    const before = plain(db.state()), old = before.history[0];
    const res = await editHistory(db, [{ _id: old._id, state: 'modified', data: rowData(old, { dialleima_se_lepta: 20 }) }]);
    assert.equal(res.code, 200, res.body.message);
    assert.deepEqual(db.state().employee, before.employee);
    assert.deepEqual(db.state().history[1], before.history[1]);
    assert.equal(db.state().history[0].dialleima_se_lepta, 20);
    assert.equal(db.state().history[0][C.ENABLED], false);
    assert.equal(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_eos, old.hmeromhnia_isxyos_oron_ergasias_eos);
});
test('sparse older legacy history is never filled from the current arrangement', async () => {
    const stored = await initial(enabled);
    const old = { ...scope, _id: 'ffffffffffffffffffffffff', hmeromhnia_allaghs_orarioy_apo: '2026-01-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-03-31' };
    stored.history.unshift(old); const db = memory(stored);
    const res = await editHistory(db, [{ _id: old._id, state: 'modified', data: rowData(old) }]);
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_PROFILE_LEGACY_CORRECTION_REQUIRES_FACTS');
    assert.deepEqual(db.state(), stored);
});
test('all controller methods outside the canonical persistence seams are byte-identical to baseline', () => {
    const baseline = execFileSync('git', ['show', 'da765ee8050c91419b7707839b55e4ead0412ef3:server/controllers/ergazomenoi/ergazomenoiController.js'], { encoding: 'utf8' }).replaceAll('\r', '');
    const methods = code => new Map(code.split(/(?=^    static )/m).map(part => [part.match(/^    static (\w+)/)?.[1], part]));
    const before = methods(baseline), after = methods(source);
    for (const [name, code] of before) if (name && !['editErgazomenoiForm', 'postErgazomenoiForm',
        'postErgazomenoiUpdate', 'updateIstorikoData', 'deleteErgazomenoi'].includes(name)) {
        assert.equal(after.get(name), code, name);
    }
});

async function twoVersions() {
    const db = memory(await initial());
    const data = { ...form(), ...enabled, hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' };
    const changes = { hmeromhnia_proslhpshs: data.hmeromhnia_proslhpshs,
        hmeromhnia_allaghs_symbashs: data.hmeromhnia_allaghs_symbashs,
        hmeromhnia_allaghs_orarioy_apo: data.hmeromhnia_allaghs_orarioy_apo,
        hmeromhnia_allaghs_orarioy_eos: data.hmeromhnia_allaghs_orarioy_eos,
        hmeromhnia_isxyos_oron_ergasias_apo: data.hmeromhnia_isxyos_oron_ergasias_apo,
        hmeromhnia_isxyos_oron_ergasias_eos: null };
    const result = await W.writeEmployeeEmploymentProfile({ ...db.deps, scope, employeeId: db.state().employee._id,
        input: M.profileInput(data, 'edit'), effectiveFrom: '2026-09-15', maintenance: {
            intentHint: 'APPEND_NEW_VERSION', employeeChanges: changes, historyChanges: changes,
            submittedHistoryChanges: changes,
            submittedEmployeeFields: Object.keys(changes),
            submittedProfileFields: Object.keys(M.profileInput(data, 'edit'))
        } });
    assert.equal(result.mode, W.MODE_NEW_VERSION); return db.state();
}
async function safeOlderVersions() {
    const stored = await twoVersions();
    Object.assign(stored.history[0], { afora_proslhpsh: false,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01',
        hmeromhnia_isxyos_dialleimatos_apo: '2026-05-01' });
    stored.history.push({ ...scope, _id: 'eeeeeeeeeeeeeeeeeeeeeeee', aa_eggrafhs: '0003',
        hmeromhnia_proslhpshs: '2026-04-01', hmeromhnia_allaghs_symbashs: '2026-04-01',
        afora_proslhpsh: true, afora_allagh_oron_ergasias: false,
        employment_profile_source: 'EMPLOYEE_PROFILE_FOUNDATION' });
    return stored;
}
const insertion = (date, extra = {}) => ({ state: 'inserted', data: { ...form(),
    hmeromhnia_isxyos_oron_ergasias_apo: date, ...extra } });
const withoutSequence = row => {
    const copy = plain(row);
    delete copy.aa_eggrafhs;
    delete copy.updatedAt;
    return copy;
};
test('history append after latest uses complete NEW_VERSION and baseline 0000 renumber ordering', async () => {
    const stored = await initial(), db = memory(stored);
    const res = await editHistory(db, [insertion('2026-09-15', enabled)]);
    assert.equal(res.code, 200, res.body.message);
    const [old, next] = db.state().history;
    assert.equal(next[C.SCHEMA_VERSION], 1); assert.equal(next[C.ENABLED], true);
    assert.equal(next.aa_eggrafhs, '0001'); assert.equal(old.aa_eggrafhs, '0002');
    assert.equal(old.hmeromhnia_isxyos_oron_ergasias_eos.slice(0, 10), '2026-09-14');
    for (const field of C.FACT_FIELDS) assert.deepEqual(next[field], db.state().employee[field]);
});
test('only retrospective inserted version between existing versions is rejected', async () => {
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [insertion('2026-07-01')]);
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
    assert.deepEqual(db.state(), stored); assert.equal(db.writes(), 0);
});
test('exact non-latest deletion keeps neighbor boundaries/facts and current, then renumbers', async () => {
    const stored = await safeOlderVersions(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history.length, 2);
    assert.deepEqual(withoutSequence(db.state().history[0]), withoutSequence(stored.history[1]));
    assert(new Date(db.state().history[0].updatedAt) > new Date(stored.history[1].updatedAt));
    assert.deepEqual(withoutSequence(db.state().history[1]), withoutSequence(stored.history[2]));
    assert.equal(db.state().history[0].aa_eggrafhs, '0001'); assert.deepEqual(db.state().employee, stored.employee);
});
for (const collection of [
    'Apasxoliseis_Weekly_Canonical_Decisions',
    'Apasxoliseis_Weekly_Repo_Transfer_Decisions',
    'Apasxoliseis_Period_Frozen_Snapshots'
]) test(`history editor blocks a referenced row from ${collection} before delete`, async () => {
    const stored = await safeOlderVersions(), db = memory(stored);
    const id = String(stored.history[0]._id);
    const persistedReference = collection === 'Apasxoliseis_Weekly_Canonical_Decisions'
        ? { _id: 'canonical-reference', canonical_snapshot: { profile_history: [{ _id: id }] } }
        : collection === 'Apasxoliseis_Weekly_Repo_Transfer_Decisions'
            ? { _id: 'repo-reference', canonical_snapshot: {
                employment_profile: { history: [{ id }] } } }
            : { _id: 'frozen-reference', frozen_snapshot: {
                weekly_calculation_context: { profile_history: [{ _id: id }] } } };
    const startSession = db.deps.connection.startSession;
    db.deps.connection = { startSession, collection(name) {
        return referenceCollection(name === collection ? [persistedReference] : []);
    } };
    db.deps.referenceChecker = options => {
        assert.deepEqual(options.historyIds, [id]);
        assert.ok(options.session);
        return findHistoryIdReferences(options);
    };
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }]);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_REFERENCED_DELETE_FORBIDDEN');
    assert.match(res.body.message, /δεν μπορεί να διαγραφεί/);
    assert.equal(db.deleteAttempts(), 0);
    assert.deepEqual(db.state(), stored);
});
test('history editor fails closed when the reference check fails', async () => {
    const stored = await safeOlderVersions(), db = memory(stored);
    db.deps.referenceChecker = async () => { throw new Error('reference store unavailable'); };
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }]);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_REFERENCE_CHECK_FAILED');
    assert.equal(db.deleteAttempts(), 0);
    assert.deepEqual(db.state(), stored);
});
test('latest legacy deletion preserves baseline current employee without fabrication or reopening previous row', async () => {
    const employee = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', ...scope, dialleima_se_lepta: 45, localNote: 'keep' };
    const rows = [{ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', ...scope, aa_eggrafhs: '0001',
        hmeromhnia_allaghs_orarioy_apo: '2025-01-01', hmeromhnia_allaghs_orarioy_eos: '2025-08-31' },
    { _id: 'cccccccccccccccccccccccc', ...scope, aa_eggrafhs: '0002', hmeromhnia_allaghs_orarioy_apo: '2025-09-01' }];
    const db = memory({ employee, history: rows });
    const res = await editHistory(db, [{ state: 'deleted', _id: rows[1]._id }]);
    assert.equal(res.code, 200, res.body.message); assert.deepEqual(db.state().employee, employee);
    assert.deepEqual(db.state().history, [rows[0]]); assert(!Object.hasOwn(db.state().history[0], C.ENABLED));
});
test('latest future snapshot deletion succeeds when current still has its previous complete snapshot', async () => {
    const stored = await twoVersions();
    const previous = plain(stored.history[0]);
    stored.employee = { ...stored.employee, ...previous, _id: stored.employee._id };
    const db = memory(stored); const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[1]._id }]);
    assert.equal(res.code, 200, res.body.message); assert.deepEqual(db.state().employee, stored.employee);
    assert.deepEqual(db.state().history, [previous]);
});
test('current V1 latest deletion is specifically blocked without inventing a baseline revert', async () => {
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[1]._id }]);
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_PROFILE_DELETE_CURRENT_VERSION_UNSUPPORTED');
    assert.deepEqual(db.state(), stored);
});
test('nonexistent deletion identity rejects without touching neighbors', async () => {
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'deleted', _id: 'ffffffffffffffffffffffff' }]);
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_PROFILE_DELETE_IDENTITY_MISMATCH');
    assert.deepEqual(db.state(), stored); assert.equal(db.writes(), 0);
});
test('mixed correction and deletion batch commits all facts and numbering together', async () => {
    const stored = await safeOlderVersions(), db = memory(stored);
    const res = await editHistory(db, [
        { state: 'modified', _id: stored.history[1]._id, data: rowData(stored.history[1], { [C.DAYS]: [2, 4] }) },
        { state: 'deleted', _id: stored.history[0]._id }
    ]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history.length, 2);
    assert.deepEqual(db.state().employee[C.DAYS], [2, 4]); assert.equal(db.state().history[0].aa_eggrafhs, '0001');
});
test('mixed append and older correction batch keeps complete current and baseline ordering', async () => {
    const stored = await initial(), db = memory(stored);
    const old = rowData(stored.history[0], { hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-14', dialleima_se_lepta: 20 });
    const res = await editHistory(db, [insertion('2026-09-15', enabled), { state: 'modified', _id: old._id, data: old }]);
    assert.equal(res.code, 200, res.body.message);
    assert.equal(db.state().history[0].dialleima_se_lepta, 20); assert.equal(db.state().history[0][C.ENABLED], false);
    assert.equal(db.state().employee[C.ENABLED], true); assert.equal(db.state().employee.dialleima_se_lepta, 0);
    assert.equal(db.state().history[1].aa_eggrafhs, '0001');
});
test('delete current plus a chronological replacement in one batch is atomic and safe', async () => {
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[1]._id }, insertion('2026-10-01')]);
    assert.equal(res.code, 200, res.body.message);
    assert.equal(db.state().employee.hmeromhnia_isxyos_oron_ergasias_apo.slice(0, 10), '2026-10-01');
    assert.deepEqual(withoutSequence(db.state().history[0]), withoutSequence(stored.history[0]));
    assert(new Date(db.state().history[0].updatedAt) > new Date(stored.history[0].updatedAt));
});
test('later batch failure rolls back deletion, append, closed boundaries and current update', async () => {
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }, insertion('2026-10-01'),
        { state: 'deleted', _id: 'ffffffffffffffffffffffff' }]);
    assert.equal(res.code, 409); assert.equal(db.writes(), 0); assert.deepEqual(db.state(), stored);
});
test('transaction commit failure rolls back renumbering and accepted deletion/append', async () => {
    const stored = await safeOlderVersions(), db = memory(stored, 'commit');
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }, insertion('2026-10-01')]);
    assert.equal(res.code, 500); assert(db.writes() >= 5); assert.deepEqual(db.state(), stored);
});
test('safe schedule-identity date edit updates the same row without moving effective boundaries', async () => {
    const stored = await initial(), db = memory(stored), row = stored.history[0];
    const res = await editHistory(db, [{ state: 'modified', _id: row._id,
        data: rowData(row, { hmeromhnia_allaghs_orarioy_eos: '2026-04-08' }) }]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history[0]._id, row._id);
    assert.equal(db.state().history[0].hmeromhnia_allaghs_orarioy_eos.slice(0, 10), '2026-04-08');
    assert.equal(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_apo, row.hmeromhnia_isxyos_oron_ergasias_apo);
});
test('safe forward latest boundary edit preserves previous boundary and same identity ID', async () => {
    const stored = await twoVersions(), db = memory(stored), row = stored.history[1];
    const res = await editHistory(db, [{ state: 'modified', _id: row._id,
        data: rowData(row, { hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-20' }) }]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history[1]._id, row._id);
    assert.equal(db.state().employee.hmeromhnia_isxyos_oron_ergasias_apo.slice(0, 10), '2026-09-20');
    assert.equal(db.state().history[1].hmeromhnia_isxyos_dialleimatos_apo.slice(0, 10), '2026-09-20');
    assert.deepEqual(db.state().history[0], stored.history[0]);
});
test('non-latest effective boundary mutation is precisely rejected', async () => {
    const stored = await twoVersions(), db = memory(stored), row = stored.history[0];
    const res = await editHistory(db, [{ state: 'modified', _id: row._id,
        data: rowData(row, { hmeromhnia_isxyos_oron_ergasias_eos: '2026-09-10' }) }]);
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED');
    assert.deepEqual(db.state(), stored);
});

test('actual six-date editor payload preserves unsubmitted profile and work terms', async () => {
    const stored = await twoVersions(), db = memory(stored), row = stored.history[1];
    const uiSource = fs.readFileSync(__dirname + '/../../../public/js/ergazomenoi/genika/istorikoTable.js', 'utf8');
    const fieldsSource = uiSource.match(/const fields = (\[[\s\S]*?\]);/)[1];
    const fields = vm.runInNewContext(fieldsSource);
    assert.equal(fields.length, 6);
    const data = Object.fromEntries(fields.map(field => [field, row[field]?.slice(0, 10) || '']));
    data.hmeromhnia_apoxorhshs = '2026-12-31';
    const res = await editHistory(db, [{ state: 'modified', _id: row._id, data }]);
    assert.equal(res.code, 200, res.body.message);
    for (const field of [...C.FACT_FIELDS, 'ores_ergasias_ebdomadas', 'hmeres_ergasias_ebdomadas', 'pososto_prosayxhshs_6hs_hmeras']) {
        assert.deepEqual(db.state().history[1][field], row[field], field);
    }
    assert.equal(db.state().history[1].hmeromhnia_isxyos_oron_ergasias_apo, row.hmeromhnia_isxyos_oron_ergasias_apo);
});
test('six-date append keeps omitted work terms from current in a complete new snapshot', async () => {
    const stored = await initial(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'inserted', data: {
        hmeromhnia_proslhpshs: '2026-04-01', hmeromhnia_allaghs_symbashs: '2026-09-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-09-01', hmeromhnia_allaghs_orarioy_eos: '2026-09-07',
        hmeromhnia_lhxhs_symbashs: '', hmeromhnia_apoxorhshs: '' } }]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history[1].ores_ergasias_ebdomadas, 40);
    assert.equal(db.state().history[1].hmeres_ergasias_ebdomadas, 5);
});
test('foreign history ID cannot be deleted and foreign numbering is untouched', async () => {
    const stored = await safeOlderVersions();
    const foreign = { ...stored.history[0], _id: 'ffffffffffffffffffffffff', company_kod: 'foreign', aa_eggrafhs: '0099' };
    stored.history.push(foreign); const db = memory(stored);
    const rejected = await editHistory(db, [{ state: 'deleted', _id: foreign._id }]);
    assert.equal(rejected.code, 409); assert.deepEqual(db.state(), stored);
    const accepted = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }]);
    assert.equal(accepted.code, 200); assert.deepEqual(db.state().history.find(row => row._id === foreign._id), foreign);
});
test('generic Add/Edit database failures keep baseline error responses', async () => {
    const add = await submit('add', form(), memory(undefined, 'history'));
    assert.deepEqual(plain(add.res.body), { success: false, errorMessage: 'Σφάλμα κατά τη αποθήκευση του εργαζόμενου' });
    const edit = await submit('edit', { ...form(), nomimosMisthos: 1300 }, memory(await initial(), 'history'));
    assert.deepEqual(plain(edit.res.body), { success: false,
        reason: 'EMPLOYEE_PROFILE_SAVE_FAILED', operation: 'EMPLOYEE_MAINTENANCE',
        message: 'Σφάλμα κατά την ενημέρωση εργαζόμενου',
        errorMessage: 'Σφάλμα κατά την ενημέρωση εργαζόμενου' });
});
test('semantic controller audit: field maps retain baseline parity except approved base experience zeros', () => {
    const baseline = execFileSync('git', ['show', 'da765ee8050c91419b7707839b55e4ead0412ef3:server/controllers/ergazomenoi/ergazomenoiController.js'], { encoding: 'utf8' }).replaceAll('\r', '');
    const part = (code, start, end, offset = 0) => { const a = code.indexOf(start, offset); const b = code.indexOf(end, a); assert(a >= 0 && b > a); return code.slice(a, b).trim(); };
    const addOffset = code => code.indexOf('static postErgazomenoiForm');
    assert.match(source, /persistenceTarget.action === 'CREATE_NEW'[^]*?const lastRecord =/);
    assert.match(source, /const addEmployeeValues = \{/);
    assert.match(source, /submittedAddPatch\(newErgazomenos, submittedFormKeys, addEmployeeOwnedFields\)/);
    const editOffset = code => code.indexOf('static postErgazomenoiUpdate');
    const noDivider = text => text.replace(/\n\s*\/\/ =+$/, '').trim();
    let expectedEditMap = noDivider(part(baseline, '        const filteredDataErgazomenoi =', '        // ✅ 5)', editOffset(baseline)));
    for (const field of ['proyphresia_se_eth', 'proyphresia_se_mhnes', 'proyphresia_adeias_se_eth']) {
        expectedEditMap = expectedEditMap.replace(`${field}: formData.${field},`,
            `${field}: normalizeBaseExperienceValue(formData.${field}),`);
    }
    assert.equal(part(source, '        const filteredDataErgazomenoi =', '        const updateFieldsIstoriko =', editOffset(source)), expectedEditMap);
    assert.equal(part(source, '            const toNumber =', '            const submittedDeparture =', editOffset(source)),
        part(baseline, '            const toNumber =', '            updatedErgazomenos = await ErgazomenoiModel.findOneAndUpdate', editOffset(baseline)));
    assert.match(source, /const addHistoryValues = \{/);
    assert.match(source, /submittedAddPatch\(newIstoriko, submittedFormKeys, addHistoryOwnedFields\)/);
});

test('latest incomplete legacy editor correction never fills missing facts from current', async () => {
    const stored = await initial(enabled), row = stored.history[0];
    for (const field of C.FACT_FIELDS) delete row[field];
    const db = memory(stored);
    const res = await editHistory(db, [{ state: 'modified', _id: row._id, data: rowData(row) }]);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, 'EMPLOYEE_PROFILE_LEGACY_CORRECTION_REQUIRES_FACTS');
    assert.deepEqual(db.state(), stored);
});
test('empty history batch preserves baseline renumbering without profile changes', async () => {
    const stored = await twoVersions();
    stored.history[0].aa_eggrafhs = '0012'; stored.history[1].aa_eggrafhs = '0007';
    const db = memory(stored), res = await editHistory(db, []);
    assert.equal(res.code, 200, res.body.message);
    assert.deepEqual(db.state().employee, stored.employee);
    assert.equal(db.state().history[0].aa_eggrafhs, '0002');
    assert.equal(db.state().history[1].aa_eggrafhs, '0001');
    db.state().history.forEach((row, i) => {
        assert.deepEqual(withoutSequence(row), withoutSequence(stored.history[i]));
        assert(new Date(row.updatedAt) > new Date(stored.history[i].updatedAt));
    });
});

for (const mode of ['add', 'edit']) for (const category of ['0004', '0005', '0009']) {
    for (const minutes of [0, 14, 15, 30, 31, 45, 46]) for (const inside of [false, true]) {
        test(`${mode}: category ${category}, break ${minutes}, inside ${inside} reaches employee and history`, async () => {
            const db = mode === 'add' ? memory() : memory(await initial());
            const before = plain(db.state());
            const input = { ...form(), eidikh_kathgoria_stathera: category, eidikh_kathgoria_ergazomenoy: category,
                dialleima_se_lepta: minutes, dialleima_entos_ektos_orarioy: inside };
            const { res } = await submit(mode, input, db);
            const special = category !== '0009';
            const valid = minutes === 0 || (minutes >= 15 && minutes <= (special ? 45 : 30));
            if (!valid) {
                assert.equal(res.code, 400); assert.equal(res.body.field, 'dialleima_se_lepta');
                assert.equal(db.writes(), 0); assert.deepEqual(db.state(), before); return;
            }
            assert.equal(res.code, 200, res.body?.errorMessage);
            for (const row of [db.state().employee, db.state().history.at(-1)]) {
                assert.equal(row.dialleima_se_lepta, minutes);
                assert.equal(row.dialleima_entos_ektos_orarioy, special || inside);
                assert.equal(row.eidikh_kathgoria_ergazomenoy, category);
            }
        });
    }
}
test('EDIT category change from 0004 to ordinary cannot preserve an omitted 45-minute duration', async () => {
    const stored = await initial({ eidikh_kathgoria_stathera: '0004', dialleima_se_lepta: 45 });
    const { db, res } = await submit('edit', { ...form(), eidikh_kathgoria_ergazomenoy: '0009' }, memory(stored));
    assert.equal(res.code, 400); assert.equal(res.body.field, 'dialleima_se_lepta');
    assert.equal(db.writes(), 0); assert.deepEqual(db.state(), stored);
});
test('legacy Maintenance normalizes outside to inside before choosing the profile/history path', async () => {
    const stored = await legacyInitial(); stored.employee.eidikh_kathgoria_ergazomenoy = '0004';
    stored.history[0].eidikh_kathgoria_ergazomenoy = '0004';
    const { db, res } = await submit('edit', { ...form(), eidikh_kathgoria_ergazomenoy: '0004',
        dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    for (const row of [db.state().employee, db.state().history.at(-1)]) {
        assert.equal(row.dialleima_entos_ektos_orarioy, true);
        assert.equal(row.dialleima_se_lepta, 30);
    }
});

test('unchanged legacy inside break cannot be overwritten by a forged outside Maintenance patch', async () => {
    const stored = await legacyInitial();
    for (const row of [stored.employee, stored.history[0]]) Object.assign(row, {
        eidikh_kathgoria_ergazomenoy: '0005', dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: true
    });
    const { db, res } = await submit('edit', { ...form(), eidikh_kathgoria_ergazomenoy: '0005',
        dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage);
    for (const row of [db.state().employee, db.state().history.at(-1)]) {
        assert.equal(row.dialleima_entos_ektos_orarioy, true);
        assert.equal(row.dialleima_se_lepta, 30);
    }
});

test('EDIT category whitespace cannot bypass the policy before Mongoose trims the stored code', async () => {
    const { db, res } = await submit('edit', { ...form(), eidikh_kathgoria_ergazomenoy: ' 0004 ',
        dialleima_se_lepta: 45, dialleima_entos_ektos_orarioy: false }, memory(await initial()));
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().employee.dialleima_entos_ektos_orarioy, true);
    assert.equal(db.state().history.at(-1).dialleima_entos_ektos_orarioy, true);
});

test('Add retry corrects one employee and one hire history row', async () => {
    const db = memory();
    const first = await submit('add', { ...form(), afm_ergazomenoyHidden: '123456789',
        amka_ergazomenoyHidden: '12345678901', karta_ergasias: false,
        evelikth_proselefsh_add: 0 }, db);
    assert.equal(first.res.code, 200, first.res.body?.errorMessage);
    assert.equal(db.employeeCount(), 1);
    assert.equal(db.state().history.length, 1);
    const original = plain(db.state());
    db.retryTarget = true;
    const second = await submit('add', { ...form(), afm_ergazomenoyHidden: '123456789',
        amka_ergazomenoyHidden: '12345678901', karta_ergasias: true,
        evelikth_proselefsh_add: 1 }, db);
    assert.equal(second.res.code, 200, second.res.body?.errorMessage);
    assert.equal(db.employeeCount(), 1);
    assert.equal(db.state().employee._id, original.employee._id);
    assert.equal(db.state().employee.kodikos, original.employee.kodikos);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0]._id, original.history[0]._id);
    assert.equal(db.state().employee.karta_ergasias, true);
    assert.equal(db.state().employee.evelikth_proselefsh, 1);
});

test('Add retry preserves absent employee and history fields, but applies explicit falsy values', async () => {
    const first = await submit('add', { ...form(), afm_ergazomenoyHidden: '123456789',
        amka_ergazomenoyHidden: '12345678901', karta_ergasias: false,
        evelikth_proselefsh_add: 0 });
    assert.equal(first.res.code, 200);
    const stored = plain(first.db.state());
    stored.employee.forologikh_klimaka = '03';
    stored.employee.foreas_epikoyrikhs_asfalishs = ['001'];
    stored.employee.pososto_apasxolhshs_kk1 = 75;
    stored.employee.hmeromhnia_ekdoshs = '2020-02-03T00:00:00.000Z';
    stored.employee.corrective_payroll_withholding_rate_percent = 12;
    stored.employee.pososto_prosayxhshs_6hs_hmeras = 50;
    stored.history[0].pososto_prosayxhshs_6hs_hmeras = 50;
    stored.employee.arxeio_apodoxhs_oron_atomikhs_symbashs_path = 's3://stored/contract.pdf';
    stored.history[0].stoixeio_symbashs_01 = 'preserved history value';
    const db = memory(stored); db.retryTarget = true;
    const retryForm = form(); delete retryForm.pososto_prosayxhshs_6hs_hmeras;
    const retry = await submit('add', { ...retryForm, afm_ergazomenoyHidden: '123456789',
        amka_ergazomenoyHidden: '12345678901', karta_ergasias: true,
        evelikth_proselefsh_add: 1, archived: true,
        arxeio_apodoxhs_oron_atomikhs_symbashs_path: 'forged/path' }, db);
    assert.equal(retry.res.code, 200, retry.res.body?.errorMessage);
    assert.equal(db.employeeCount(), 1);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().employee.archived, false);
    assert.equal(db.state().employee.karta_ergasias, true);
    assert.equal(db.state().employee.evelikth_proselefsh, 1);
    assert.equal(db.state().employee.forologikh_klimaka, '03');
    assert.deepEqual(db.state().employee.foreas_epikoyrikhs_asfalishs, ['001']);
    assert.equal(db.state().employee.pososto_apasxolhshs_kk1, 75);
    assert.equal(db.state().employee.hmeromhnia_ekdoshs, '2020-02-03T00:00:00.000Z');
    assert.equal(db.state().employee.corrective_payroll_withholding_rate_percent, 12);
    assert.equal(db.state().employee.pososto_prosayxhshs_6hs_hmeras, 50);
    assert.equal(db.state().history[0].pososto_prosayxhshs_6hs_hmeras, 50);
    assert.equal(db.state().employee.arxeio_apodoxhs_oron_atomikhs_symbashs_path,
        's3://stored/contract.pdf');
    assert.equal(db.state().history[0].stoixeio_symbashs_01, 'preserved history value');

    const explicit = await submit('add', { ...form(), afm_ergazomenoyHidden: '123456789',
        amka_ergazomenoyHidden: '12345678901', karta_ergasias: false,
        evelikth_proselefsh_add: 0, forologikh_klimaka: '',
        foreas_epikoyrikhs_asfalishs: [], pososto_apasxolhshs_kk1: 0,
        hmeromhnia_ekdoshs: null, stoixeio_symbashs_01: '' }, db);
    assert.equal(explicit.res.code, 200, explicit.res.body?.errorMessage);
    assert.equal(db.employeeCount(), 1);
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().employee.karta_ergasias, false);
    assert.equal(db.state().employee.evelikth_proselefsh, 0);
    assert.equal(db.state().employee.forologikh_klimaka, '');
    assert.deepEqual(db.state().employee.foreas_epikoyrikhs_asfalishs, []);
    assert.equal(db.state().employee.pososto_apasxolhshs_kk1, 0);
    assert.equal(db.state().employee.hmeromhnia_ekdoshs, null);
    assert.equal(db.state().history[0].stoixeio_symbashs_01, null);
});

async function historicalOverlapWithUniqueLatestState() {
    const stored = plain(await initial());
    const latest = stored.history[0];
    for (const target of [stored.employee, latest]) {
        target.hmeromhnia_proslhpshs = '2026-02-01';
        target.hmeromhnia_apoxorhshs = null;
        target.energos = true;
    }
    latest.aa_eggrafhs = '0003';
    latest.afora_proslhpsh = false;
    const older = (id, aa, end, scheduleFrom, days, hours, wage) => ({
        ...plain(latest), _id: id, aa_eggrafhs: aa,
        hmeromhnia_allaghs_symbashs: '2026-02-01',
        hmeromhnia_allaghs_orarioy_apo: scheduleFrom,
        hmeromhnia_allaghs_orarioy_eos: scheduleFrom,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-02-01',
        hmeromhnia_isxyos_oron_ergasias_eos: end,
        afora_proslhpsh: true, afora_allagh_oron_ergasias: true,
        hmeres_ergasias_ebdomadas: days, ores_ergasias_ebdomadas: hours,
        pragmatikosMisthos: wage,
        createdAt: `${scheduleFrom}T06:00:00.000Z`,
        updatedAt: `${scheduleFrom}T06:10:00.000Z`
    });
    stored.history = [
        older('507f1f77bcf86cd799439311', '0001', '2026-03-31', '2026-02-01', 2, 16, 435.6),
        older('507f1f77bcf86cd799439312', '0002', null, '2026-03-01', 4, 34, 925.65),
        latest
    ];
    stored.audits = [];
    return stored;
}

test('controller repeats departure on the accepted older overlap without persisting another event', async () => {
    const stored = await historicalOverlapWithUniqueLatestState();
    const db = memory(stored); db.dispatch = [];
    db.deps.correctionCatalogLoader = async () => ({
        CONTRACT_TYPE: [{ code: 'contract', label: 'Σύμβαση δοκιμής' }],
        KPK_EFKA: [], CONTRACT_CATEGORY: [], CONTRACT_SPECIALTY: []
    });
    const payload = { ...form(), hmeromhnia_proslhpshs: '2026-02-01',
        hmeromhnia_apoxorhshs: '2026-09-29' };
    const first = await submit('edit', payload, db);
    assert.equal(first.res.code, 200, first.res.body?.errorMessage);
    assert.deepEqual(db.dispatch, ['writeEmployeeDeparture']);
    assert.deepEqual(db.state().history.slice(0, 2), stored.history.slice(0, 2));
    assert.equal(db.state().employee.energos, false);
    assert.equal(db.state().employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-29');
    assert.equal(db.state().history[2].hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-29');
    assert.equal(db.state().audits.length, 1);
    assert.equal(db.state().audits[0].mutationSource,
        'DEPARTURE_WITH_DEFERRED_HISTORY_AMBIGUITY');
    const afterFirst = plain(db.state());
    const writesAfterFirst = db.writes();
    const repeated = await submit('edit', payload, db);
    assert.equal(repeated.res.code, 409);
    assert.equal(repeated.res.body.reason, 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED');
    assert.deepEqual(db.dispatch,
        ['writeEmployeeDeparture', 'writeEmployeeEmploymentProfileWithUniqueSafeRepair']);
    assert.deepEqual(db.state(), afterFirst);
    assert.equal(db.writes(), writesAfterFirst);
});

test('controller ordinary maintenance rejects the same older overlap without hidden repairs', async () => {
    const stored = await historicalOverlapWithUniqueLatestState();
    const db = memory(stored); db.dispatch = [];
    db.deps.correctionCatalogLoader = async () => ({
        CONTRACT_TYPE: [{ code: 'contract', label: 'Σύμβαση δοκιμής' }],
        KPK_EFKA: [], CONTRACT_CATEGORY: [], CONTRACT_SPECIALTY: []
    });
    const { res } = await submit('edit', { ...form(),
        hmeromhnia_proslhpshs: '2026-02-01' }, db);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED');
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Δεν έγινε καμία αλλαγή/);
    assert.match(res.body.message, /διαχειριστή.*έλεγχο του ιστορικού/);
    assert.deepEqual(db.dispatch, ['writeEmployeeEmploymentProfileWithUniqueSafeRepair']);
    assert.deepEqual(db.state(), stored);
    assert.equal(db.writes(), 0);
});

// Sanitized full-form values exercise browser representations at the real controller boundary.
async function fullFormDepartureState() {
    return initial({ foreas_epikoyrikhs_asfalishs: ['002'], typos_metabolhs: [],
        stoixeio_symbashs_01: '0001', hmeromhnia_lhxhs_symbashs: '2026-12-31' });
}
function fullFormDeparturePayload(employee, departure = '2026-09-23') {
    return { ...form(), hmeromhnia_apoxorhshs: departure, energos: true,
        hmeromhnia_lhxhs_symbashs: '2026-12-31',
        hmeromhnia_isxyos_oron_ergasias_eos:
            employee.hmeromhnia_isxyos_oron_ergasias_eos?.slice(0, 10) || '',
        kathestos_apasxolhshs: '0', kathestos_apasxolhshs_stathera: '0',
        symbash: 'contract', symbash_stathera: 'contract',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, nomimosMisthos: 1200,
        foreas_epikoyrikhs_asfalishs: ['002'],
        foreas_epikoyrikhs_asfalishs_stathera: '["002"]',
        typos_metabolhs: [], typos_metabolhs_stathera: '[]',
        stoixeio_symbashs_01: '0001', stoixeio_symbashs_01_hidden: '0001' };
}
async function closedFullFormState() {
    const stored = await fullFormDepartureState();
    const result = await submit('edit', fullFormDeparturePayload(stored.employee), memory(stored));
    assert.equal(result.res.code, 200, result.res.body?.errorMessage);
    return result.db.state();
}

test('full-form populated controls save only the intended first departure', async () => {
    const stored = await fullFormDepartureState();
    const result = await submit('edit', fullFormDeparturePayload(stored.employee), memory(stored));
    assert.equal(result.res.code, 200, result.res.body?.errorMessage);
    const after = result.db.state();
    assert.deepEqual(after.history.map(row => row._id), stored.history.map(row => row._id));
    assert.equal(after.employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-23');
    assert.equal(after.employee.energos, false);
    assert.equal(after.history[0].hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-23');
    for (const field of ['nomimosMisthos', 'ores_ergasias_ebdomadas', 'kathestos_apasxolhshs',
        'hmeromhnia_proslhpshs', 'hmeromhnia_lhxhs_symbashs',
        'foreas_epikoyrikhs_asfalishs', 'stoixeio_symbashs_01']) {
        assert.deepEqual(after.employee[field], stored.employee[field], field);
    }
    assert.equal(after.history[0].afora_proslhpsh, stored.history[0].afora_proslhpsh);
    assert.deepEqual(after.audits, stored.audits);
});

for (const [label, change] of [
    ['salary', { nomimosMisthos: 1300 }],
    ['weekly hours', { ores_ergasias_ebdomadas: 39 }],
    ['employment status', { kathestos_apasxolhshs: '1' }],
    ['work-terms start', { hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-02' }],
    ['schedule boundary', { hmeromhnia_allaghs_orarioy_eos: '2026-04-08' }],
    ['contract change date', { hmeromhnia_allaghs_symbashs: '2026-04-02' }],
    ['contract end', { hmeromhnia_lhxhs_symbashs: '2027-01-31' }]
]) {
    test(`full-form departure plus a real ${label} change is rejected atomically`, async () => {
        const stored = await fullFormDepartureState();
        const db = memory(stored);
        const { res } = await submit('edit', {
            ...fullFormDeparturePayload(stored.employee), ...change
        }, db);
        assertSaveHistoryAction(res);
        assert.deepEqual(db.departureError.departureCorrectionChangedFields, Object.keys(change));
        assert.deepEqual(db.state(), stored); // Includes current, history and audit state.
        assert.equal(db.writes(), 0);
    });
}

test('unchanged departure with full-form echoes is a write-free NO_OP with stable revisions', async () => {
    const stored = await closedFullFormState(), db = memory(stored);
    const { res } = await submit('edit', fullFormDeparturePayload(stored.employee), db);
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.deepEqual(db.state(), stored);
    assert.equal(db.writes(), 0);
});

test('unchanged full-form departure permits an employee-only correction without duplicate events', async () => {
    const stored = await closedFullFormState(), db = memory(stored);
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee),
        email: 'correction@example.invalid' }, db);
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.deepEqual(db.state().history, stored.history);
    assert.deepEqual(db.state().audits, stored.audits);
    assert.deepEqual(db.state().employee, { ...stored.employee, email: 'correction@example.invalid' });
});

test('full-form departure correction rejects a genuine multi-select change, not just a JSON echo', async () => {
    const stored = await closedFullFormState(), db = memory(stored);
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee, '2026-09-24'),
        historyExpectedRevision: stored.history[0].updatedAt,
        foreas_epikoyrikhs_asfalishs: ['003'] }, db);
    assertSaveHistoryAction(res);
    assert.deepEqual(db.departureCorrectionError.departureCorrectionChangedFields,
        ['foreas_epikoyrikhs_asfalishs']);
    assert.deepEqual(db.state(), stored);
    assert.equal(db.writes(), 0);
});

test('explicit rehire intent takes precedence over full-form departure cancellation', async () => {
    const stored = await closedFullFormState(), db = memory(stored);
    const { res } = await submit('edit', { ...form(),
        hmeromhnia_proslhpshs: '2026-10-01', hmeromhnia_allaghs_symbashs: '2026-10-01',
        hmeromhnia_allaghs_orarioy_apo: '2026-10-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-10-07',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-10-01',
        hmeromhnia_apoxorhshs: '', energos: true }, db,
    { rehireIntent: true, rehireDate: '2026-10-01' });
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().employee.hmeromhnia_proslhpshs.slice(0, 10), '2026-10-01');
    assert.equal(db.state().employee.hmeromhnia_apoxorhshs, null);
    assert.equal(db.state().employee.energos, true);
    const oldIds = new Set(stored.history.map(row => row._id));
    const oldRows = db.state().history.filter(row => oldIds.has(row._id));
    assert.deepEqual(oldRows, stored.history);
    const newRows = db.state().history.filter(row => !oldIds.has(row._id));
    assert.equal(newRows.length, 1);
    assert.equal(newRows[0].afora_proslhpsh, true);
    assert.equal(newRows[0].hmeromhnia_proslhpshs.slice(0, 10), '2026-10-01');
});

for (const failure of ['history', 'employee', 'commit']) {
    test(`controlled full-form departure rolls back current, history and audit on ${failure} failure`, async () => {
        const stored = await fullFormDepartureState(), db = memory(stored, failure);
        const { res } = await submit('edit', fullFormDeparturePayload(stored.employee), db);
        assert.equal(res.code, 500);
        assert.deepEqual(db.state(), stored);
        assert.equal(db.ended(), true);
    });
}

test('browser deletion flags cannot bypass canonical protection of sole old departure evidence', async () => {
    const stored = await initial();
    const oldHire = { _id: '507f1f77bcf86cd799439291', ...scope, aa_eggrafhs: '0001',
        hmeromhnia_proslhpshs: '2025-01-01', afora_proslhpsh: true };
    const oldDeparture = { _id: '507f1f77bcf86cd799439292', ...scope, aa_eggrafhs: '0002',
        hmeromhnia_proslhpshs: '2025-01-01', hmeromhnia_apoxorhshs: '2025-03-31',
        afora_proslhpsh: false };
    stored.history[0].aa_eggrafhs = '0003';
    stored.history.unshift(oldHire, oldDeparture);
    for (const forged of [false, true]) {
        const db = memory(stored);
        const res = await editHistory(db, [{ state: 'deleted', _id: oldDeparture._id,
            controlledHistoryDeletion: forged, controlledLifecycleRepair: forged,
            data: { ...oldDeparture, controlledHistoryDeletion: forged,
                controlledLifecycleRepair: forged } }]);
        assert.equal(res.code, 409);
        assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_CORRECTION_REQUIRED');
        assert.deepEqual(db.state(), stored);
        assert.equal(mongoose.connection.readyState, 0);
    }
});


test('controlled full-form departure-date correction normalizes hidden/JSON echoes without changing facts', async () => {
    const stored = await closedFullFormState(), db = memory(stored);
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee, '2026-09-24'),
        historyExpectedRevision: stored.history[0].updatedAt,
        kathestos_apasxolhshs: null, foreas_epikoyrikhs_asfalishs: [] }, db);
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-24');
    assert.equal(db.state().history[0].hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-24');
    assert.deepEqual(db.state().history.map(row => row._id), stored.history.map(row => row._id));
    for (const field of ['kathestos_apasxolhshs', 'foreas_epikoyrikhs_asfalishs',
        'nomimosMisthos', 'ores_ergasias_ebdomadas', 'hmeromhnia_lhxhs_symbashs']) {
        assert.deepEqual(db.state().employee[field], stored.employee[field], field);
    }
    assert.ok(db.state().audits?.length > 0);
});

test('controlled full-form departure-date correction rolls back history/current/audit on audit failure', async () => {
    const stored = await closedFullFormState(), db = memory(stored, 'audit');
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee, '2026-09-24'),
        historyExpectedRevision: stored.history[0].updatedAt }, db);
    assert.equal(res.code, 500);
    assert.deepEqual(db.state(), stored);
    assert.equal(db.ended(), true);
});

async function hiddenEchoDepartureState() {
    const stored = await fullFormDepartureState();
    for (const row of stored.history) {
        row.kathestos_apasxolhshs = stored.employee.kathestos_apasxolhshs;
        row.foreas_epikoyrikhs_asfalishs = plain(stored.employee.foreas_epikoyrikhs_asfalishs);
    }
    return stored;
}
for (const [label, representation] of [
    ['empty employment status', { kathestos_apasxolhshs: '' }],
    ['null employment status', { kathestos_apasxolhshs: null }],
    ['empty insurance selection', { foreas_epikoyrikhs_asfalishs: [] }],
    ['both empty controls', { kathestos_apasxolhshs: null, foreas_epikoyrikhs_asfalishs: [] }],
    ['JSON insurance selection', { foreas_epikoyrikhs_asfalishs: '["002"]' }],
    ['wrapped JSON insurance selection', { foreas_epikoyrikhs_asfalishs: ['["002"]'] }]
]) {
    test(`first departure preserves validated unchanged echoes: ${label}`, async () => {
        const stored = await hiddenEchoDepartureState(), db = memory(stored);
        const { res } = await submit('edit', {
            ...fullFormDeparturePayload(stored.employee), ...representation
        }, db);
        assert.equal(res.code, 200, res.body?.errorMessage);
        assert.equal(db.state().employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-23');
        assert.equal(db.state().employee.energos, false);
        assert.deepEqual(db.state().history.map(row => row._id), stored.history.map(row => row._id));
        for (const field of ['kathestos_apasxolhshs', 'foreas_epikoyrikhs_asfalishs']) {
            assert.deepEqual(db.state().employee[field], stored.employee[field], field);
            for (const [index, row] of db.state().history.entries()) {
                assert.deepEqual(row[field], stored.history[index][field], field);
                assert.equal(row.afora_proslhpsh, stored.history[index].afora_proslhpsh);
            }
        }
        assert.deepEqual(db.state().audits, stored.audits);
    });
}
for (const [label, change, changedField] of [
    ['real status change with stale hidden echo', { kathestos_apasxolhshs: '1' }, 'kathestos_apasxolhshs'],
    ['real insurance change with stale hidden echo', { foreas_epikoyrikhs_asfalishs: ['003'] }, 'foreas_epikoyrikhs_asfalishs'],
    ['intentional insurance clear', { foreas_epikoyrikhs_asfalishs: [],
        foreas_epikoyrikhs_asfalishs_stathera: '[]' }, 'foreas_epikoyrikhs_asfalishs'],
    ['malformed hidden JSON', { foreas_epikoyrikhs_asfalishs: [],
        foreas_epikoyrikhs_asfalishs_stathera: '["002"' }, 'foreas_epikoyrikhs_asfalishs'],
    ['forged hidden status', { kathestos_apasxolhshs: null,
        kathestos_apasxolhshs_stathera: '1' }, 'kathestos_apasxolhshs'],
    ['forged hidden insurance', { foreas_epikoyrikhs_asfalishs: [],
        foreas_epikoyrikhs_asfalishs_stathera: '["003"]' }, 'foreas_epikoyrikhs_asfalishs']
]) {
    test(`first departure does not grant hidden-field authority: ${label}`, async () => {
        const stored = await hiddenEchoDepartureState(), db = memory(stored);
        const { res } = await submit('edit', {
            ...fullFormDeparturePayload(stored.employee), ...change
        }, db);
        assertSaveHistoryAction(res);
        assert.ok(db.departureError.departureCorrectionChangedFields.includes(changedField));
        assert.deepEqual(db.state(), stored);
        assert.equal(db.writes(), 0);
    });
}
for (const [field, value] of [['kathestos_apasxolhshs', null], ['foreas_epikoyrikhs_asfalishs', []]]) {
    test(`first departure does not guess an omitted hidden echo: ${field}`, async () => {
        const stored = await hiddenEchoDepartureState(), db = memory(stored);
        const payload = { ...fullFormDeparturePayload(stored.employee), [field]: value };
        delete payload[`${field}_stathera`];
        const { res } = await submit('edit', payload, db);
        assertSaveHistoryAction(res);
        assert.deepEqual(db.state(), stored);
        assert.equal(db.writes(), 0);
    });
}
test('malformed hidden JSON cannot override a genuine visible insurance selection', async () => {
    const stored = await hiddenEchoDepartureState(), db = memory(stored);
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee),
        foreas_epikoyrikhs_asfalishs_stathera: '["003"' }, db);
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.deepEqual(db.state().employee.foreas_epikoyrikhs_asfalishs, ['002']);
    assert.deepEqual(db.state().history[0].foreas_epikoyrikhs_asfalishs, ['002']);
});
test('first departure with validated hidden echoes rolls back after mutation attempts', async () => {
    const stored = await hiddenEchoDepartureState(), db = memory(stored, 'commit');
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee),
        kathestos_apasxolhshs: null, foreas_epikoyrikhs_asfalishs: [] }, db);
    assert.equal(res.code, 500);
    assert.ok(db.writes() > 0);
    assert.deepEqual(db.state(), stored); // No committed current/history/audit change.
    assert.equal(db.ended(), true);
});

test('first departure preserves echoes when creating the imported employee history baseline', async () => {
    const stored = await hiddenEchoDepartureState();
    stored.history = [];
    const db = memory(stored);
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee),
        kathestos_apasxolhshs: null, foreas_epikoyrikhs_asfalishs: [] }, db);
    assert.equal(res.code, 200, res.body?.errorMessage);
    assert.equal(db.state().employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-23');
    assert.equal(db.state().history.length, 1);
    assert.equal(db.state().history[0].hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-23');
    assert.equal(db.state().history[0].kathestos_apasxolhshs, '0');
    assert.equal(db.state().employee.kathestos_apasxolhshs, '0');
    assert.deepEqual(db.state().employee.foreas_epikoyrikhs_asfalishs, ['002']);
});
test('first departure preserves other stored status values and insurance ordering using existing equality', async () => {
    const stored = await hiddenEchoDepartureState();
    for (const record of [stored.employee, ...stored.history]) {
        record.kathestos_apasxolhshs = '1';
        record.typos_apasxolhshs = '1';
        record.foreas_epikoyrikhs_asfalishs = ['004', '002'];
    }
    const db = memory(stored);
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee),
        kathestos_apasxolhshs: '', kathestos_apasxolhshs_stathera: '1',
        foreas_epikoyrikhs_asfalishs: [],
        foreas_epikoyrikhs_asfalishs_stathera: '["004","002"]' }, db);
    assert.equal(res.code, 200, res.body?.errorMessage);
    for (const record of [db.state().employee, ...db.state().history]) {
        assert.equal(record.kathestos_apasxolhshs, '1');
        assert.deepEqual(record.foreas_epikoyrikhs_asfalishs, ['004', '002']);
    }
});

function userCorrectionTransportResolution() {
    const fixture = require('../../services/ergazomenoi/fixtures/userConfirmedEmployeeHistoryCorrectionFixtures').h2KpkBoundaryFixture();
    const analysis = require('../../services/ergazomenoi/employeeHistoryResolutionAnalysisService');
    const planner = require('../../services/ergazomenoi/employeeHistoryUserConfirmedCorrectionPlannerService')
        .planEmployeeHistoryUserConfirmedCorrection(fixture);
    const fingerprint = 'a'.repeat(64);
    return analysis.buildUserConfirmedCorrectionPublicResolution({
        analysis: analysis.buildUserConfirmedCorrectionAnalysis({ userCorrectionPlan: planner,
            sourceStateFingerprint: fingerprint }), fingerprint });
}

test('normal Save transports only allowlisted sanitized guided errors with HTTP 200', async () => {
    const stored = await initial();
    const resolution = userCorrectionTransportResolution();
    const original = W.writeEmployeeEmploymentProfileWithUniqueSafeRepair;
    try {
        for (const code of ['EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR_REQUIRED',
            'EMPLOYEE_HISTORY_MULTIPLE_SAFE_RESOLUTION_REQUIRED', 'EMPLOYEE_HISTORY_BUSINESS_FACT_REQUIRED',
            'EMPLOYEE_HISTORY_USER_CORRECTION_REQUIRED', 'EMPLOYEE_HISTORY_SAFE_CORRECTION_REQUIRED']) {
            W.writeEmployeeEmploymentProfileWithUniqueSafeRepair = async () => {
                throw Object.assign(new Error(code), { code, statusCode: 409, resolutionRequired: true, resolution });
            };
            const db = memory(stored);
            const { res } = await submit('edit', form(), db);
            assert.equal(res.code, 200, code);
            assert.equal(res.body.success, false);
            assert.equal(res.body.resolutionRequired, true);
            assert.deepEqual(plain(res.body.resolution), plain(resolution));
            assert.equal(db.writes(), 0);
        }
    } finally { W.writeEmployeeEmploymentProfileWithUniqueSafeRepair = original; }
});

test('normal Save keeps stale and invalid guided envelopes at their original status with zero writes', async () => {
    const stored = await initial();
    const resolution = userCorrectionTransportResolution();
    const original = W.writeEmployeeEmploymentProfileWithUniqueSafeRepair;
    try {
        for (const error of [
            { code: 'EMPLOYEE_HISTORY_USER_CORRECTION_STALE', statusCode: 409 },
            { code: 'EMPLOYEE_HISTORY_USER_CORRECTION_STALE', statusCode: 409, resolutionRequired: true, resolution },
            { code: 'EMPLOYEE_HISTORY_USER_CORRECTION_REQUIRED', statusCode: 409, resolutionRequired: false, resolution },
            { code: 'EMPLOYEE_HISTORY_USER_CORRECTION_REQUIRED', statusCode: 409, resolutionRequired: true, resolution: {} },
            { code: 'EMPLOYEE_PROFILE_FINAL_VERIFICATION_FAILED', statusCode: 500 }
        ]) {
            W.writeEmployeeEmploymentProfileWithUniqueSafeRepair = async () => { throw Object.assign(new Error(error.code), error); };
            const db = memory(stored);
            const { res } = await submit('edit', form(), db);
            assert.equal(res.code, error.statusCode);
            assert.equal(res.body.success, false);
            assert.equal(res.body.resolutionRequired, undefined);
            assert.equal(db.writes(), 0);
        }
    } finally { W.writeEmployeeEmploymentProfileWithUniqueSafeRepair = original; }
});

// Phase 3B executes the actual new composite boundary, while the earlier
// regression cases above keep exercising the guided boundary independently.
test('Phase 3B controller retains raw lending intent before cleanup and excludes only passive defaults', async () => {
    const stored = await initial();
    delete stored.history[0].poso_symbashs_02;
    const defaults = require('../../utils/ergazomenoi/employeeNormalSaveNormalization').PASSIVE_LENDING_DEFAULTS;
    for (const field of Object.keys(defaults)) delete stored.employee[field];
    stored.employee.afora_daneismo_ergazomenoy = false;
    const db = memory(stored); db.composite = true;
    const before = plain(db.state());
    const clean = { ...form(), afora_daneismo_ergazomenoy: false, ...defaults };
    const first = await submit('edit', clean, db);
    const forged = await submit('edit', { ...clean, afm_daneizontos_ergodoth: '123456789',
        untouched: true, readonly: true }, db);
    assert.equal(first.res.body.reason, 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_REQUIRED');
    assert.equal(forged.res.body.reason, first.res.body.reason);
    assert.notEqual(forged.res.body.previewToken, first.res.body.previewToken,
        'raw non-neutral value must not receive passive treatment after controller cleanup');
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), before);
});

test('Phase 3B controller: normal Save returns a sanitized automatic preview before any business writes', async () => {
    const stored = await initial();
    delete stored.history[0].poso_symbashs_02;
    const db = memory(stored); db.composite = true;
    const before = plain(db.state());
    const { res } = await submit('edit', { ...form(), parathrhseis: 'unsaved synthetic note' }, db);
    assert.equal(res.code, 200); assert.equal(res.body.actionRequired, true);
    assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_REQUIRED');
    assert.equal(res.body.nextAction.type, 'APPROVE_HISTORY_RECONSTRUCTION_AND_CONTINUE_SAVE');
    assert.equal(typeof res.body.previewToken, 'string');
    assert.doesNotMatch(JSON.stringify(res.body), /rowDiffs|proposedRows|sourceHistoryIds/);
    assert.equal(db.writes(), 0); assert.deepEqual(db.state(), before);
});
for (const reconstruction of [{ approvalAccepted: false }, { approvalAccepted: true }, { approvalAccepted: true, previewToken: [] }]) {
    test('Phase 3B controller rejects invalid continuation before any writer', async () => {
        const stored = await initial(), db = memory(stored); db.composite = true;
        const before = plain(db.state()); const { res } = await submit('edit', form(), db, { reconstruction });
        assert.equal(res.code, 400); assert.equal(db.writes(), 0); assert.deepEqual(db.state(), before);
    });
}

// Experience intent is owned by the server, independently of browser metadata.
const baseExperienceFields = ['proyphresia_se_eth', 'proyphresia_se_mhnes', 'proyphresia_adeias_se_eth'];
const derivedExperienceFields = ['synolo_proyphresias_se_eth', 'synolo_proyphresias_se_mhnes',
    'proyphresia_apozhmioshs_se_eth', 'misthologiko_klimakio'];
function assertDepartureHistoryStable(before, after) {
    assert.deepEqual(after.history.map(row => [row._id, row.aa_eggrafhs]),
        before.history.map(row => [row._id, row.aa_eggrafhs]));
    for (const [index, row] of after.history.entries()) {
        const { hmeromhnia_apoxorhshs, hmeromhnia_isxyos_oron_ergasias_eos, updatedAt, ...rest } = row;
        const { hmeromhnia_apoxorhshs: oldDeparture, hmeromhnia_isxyos_oron_ergasias_eos: oldEnd,
            updatedAt: oldUpdatedAt, ...oldRest } = before.history[index];
        assert.deepEqual(rest, oldRest);
        for (const field of baseExperienceFields) assert.equal(Object.hasOwn(row, field), false, field);
    }
    assert.deepEqual(after.audits, before.audits); // No reconstruction Apply.
}
test('first departure atomically saves three canonical numeric zeros and ignores page-load totals', async () => {
    const stored = await fullFormDepartureState();
    delete stored.employee.proyphresia_se_eth;
    stored.employee.proyphresia_se_mhnes = null;
    stored.employee.proyphresia_adeias_se_eth = '';
    const payload = { ...fullFormDeparturePayload(stored.employee),
        ...Object.fromEntries(baseExperienceFields.map(field => [field, '0'])),
        ...Object.fromEntries(derivedExperienceFields.map(field => [field, 77])) };
    const db = memory(stored), { res } = await submit('edit', payload, db);
    assert.equal(res.body.success, true, JSON.stringify(res.body));
    assert.equal(db.state().employee.hmeromhnia_apoxorhshs.slice(0, 10), '2026-09-23');
    assert.equal(db.state().employee.energos, false);
    for (const field of baseExperienceFields) assert.equal(db.state().employee[field], 0, field);
    for (const field of derivedExperienceFields) assert.equal(db.state().employee[field], stored.employee[field], field);
    assertDepartureHistoryStable(stored, db.state());
});
for (const field of baseExperienceFields) {
    for (const before of [undefined, null, '']) for (const submitted of [0, '0', '', null]) {
        test(`first departure persists ${field}: ${String(before)} -> ${JSON.stringify(submitted)}`, async () => {
            const stored = await fullFormDepartureState();
            if (before === undefined) delete stored.employee[field]; else stored.employee[field] = before;
            const db = memory(stored), { res } = await submit('edit', {
                ...fullFormDeparturePayload(stored.employee), [field]: submitted
            }, db);
            assert.equal(res.body.success, true, JSON.stringify(res.body));
            assert.equal(db.state().employee[field], 0);
            assertDepartureHistoryStable(stored, db.state());
        });
    }
    for (const [before, submitted] of [[0, 3], [0, 5], [2, 5], [3, 7], [2, 0], [2, ''], [undefined, 999]]) {
        test(`first departure protects genuine ${field}: ${String(before)} -> ${submitted}`, async () => {
            const stored = await fullFormDepartureState();
            if (before === undefined) delete stored.employee[field]; else stored.employee[field] = before;
            const db = memory(stored), { res } = await submit('edit', {
                ...fullFormDeparturePayload(stored.employee), [field]: submitted,
                derived: true, readonly: true, autoCalculated: true,
                ...Object.fromEntries(derivedExperienceFields.map(output => [output, 999]))
            }, db);
            assertSaveHistoryAction(res);
            assert.ok(db.departureError.departureCorrectionChangedFields.includes(field));
            assert.deepEqual(db.state(), stored);
            assert.equal(db.writes(), 0);
        });
    }
    test(`ordinary Save persists canonical ${field} zero without changing history`, async () => {
        const stored = await fullFormDepartureState(); delete stored.employee[field];
        const db = memory(stored), { res } = await submit('edit', {
            ...fullFormDeparturePayload(stored.employee, ''), [field]: ''
        }, db);
        assert.equal(res.body.success, true, JSON.stringify(res.body));
        assert.equal(db.state().employee[field], 0);
        assert.deepEqual(db.state().history, stored.history);
    });
}
for (const field of derivedExperienceFields) {
    test(`first departure ignores only browser-derived ${field}, preserving Employee and History`, async () => {
        const stored = await fullFormDepartureState(), db = memory(stored);
        const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee),
            [field]: Number(stored.employee[field] || 0) + 10 }, db);
        assert.equal(res.body.success, true, JSON.stringify(res.body));
        assert.equal(db.state().employee[field], stored.employee[field]);
        assertDepartureHistoryStable(stored, db.state());
    });
    test(`ordinary Save excludes browser-derived ${field} from business intent`, async () => {
        const stored = await fullFormDepartureState(), db = memory(stored);
        const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee, ''),
            [field]: 8 }, db);
        assert.equal(res.body.success, true, JSON.stringify(res.body));
        assert.equal(db.state().employee[field], stored.employee[field]);
        assert.deepEqual(db.state().history, stored.history);
    });
}
for (const failure of ['history', 'commit']) {
    test(`first departure canonical zeros roll back with ${failure} failure`, async () => {
        const stored = await fullFormDepartureState();
        for (const field of baseExperienceFields) delete stored.employee[field];
        const db = memory(stored, failure), { res } = await submit('edit', {
            ...fullFormDeparturePayload(stored.employee),
            ...Object.fromEntries(baseExperienceFields.map(field => [field, 0]))
        }, db);
        assert.equal(res.code, 500);
        assert.ok(db.writes() > 0);
        assert.deepEqual(db.state(), stored);
    });
}
test('experience exception does not normalize unrelated missing numeric fields', async () => {
    assert.equal(M.departureMaintenanceValuesEqual('unrelated_numeric', undefined, 0), false);
    const stored = await fullFormDepartureState(); delete stored.employee.poso_symbashs_02;
    const db = memory(stored), { res } = await submit('edit', {
        ...fullFormDeparturePayload(stored.employee), poso_symbashs_02: 3
    }, db);
    assertSaveHistoryAction(res); assert.deepEqual(db.state(), stored);
});
test('browser-derived outputs cannot mask an authoritative hire-date change', async () => {
    const stored = await fullFormDepartureState(), db = memory(stored);
    const { res } = await submit('edit', { ...fullFormDeparturePayload(stored.employee),
        hmeromhnia_proslhpshs: '2026-04-02',
        ...Object.fromEntries(derivedExperienceFields.map(field => [field, 99])) }, db);
    assertSaveHistoryAction(res);
    assert.ok(db.departureError.departureCorrectionChangedFields.includes('hmeromhnia_proslhpshs'));
    assert.deepEqual(db.state(), stored);
});

test('first departure preserves already-validated stale hidden contract echoes and termination reason', async () => {
    const stored = await fullFormDepartureState();
    stored.employee.stoixeio_symbashs_01_hidden = 'stale-browser-echo';
    stored.employee.stoixeio_symbashs_02_hidden = 'another-stale-echo';
    stored.employee.logos_peratosis = 'existing-reason';
    const db = memory(stored), { res } = await submit('edit', {
        ...fullFormDeparturePayload(stored.employee),
        stoixeio_symbashs_02: '', stoixeio_symbashs_02_hidden: '', logos_peratosis: ''
    }, db);
    assert.equal(res.body.success, true, JSON.stringify(res.body));
    for (const field of ['stoixeio_symbashs_01_hidden', 'stoixeio_symbashs_02_hidden', 'logos_peratosis']) {
        assert.equal(db.state().employee[field], stored.employee[field], field);
    }
    assertDepartureHistoryStable(stored, db.state());
});
test('stale hidden contract echo still cannot authorize a genuine contract change', async () => {
    const stored = await fullFormDepartureState();
    stored.employee.stoixeio_symbashs_01_hidden = 'stale-browser-echo';
    const db = memory(stored), { res } = await submit('edit', {
        ...fullFormDeparturePayload(stored.employee), stoixeio_symbashs_01: 'changed-contract',
        stoixeio_symbashs_01_hidden: 'changed-contract'
    }, db);
    assertSaveHistoryAction(res);
    assert.deepEqual(db.state(), stored);
    assert.equal(db.writes(), 0);
});
