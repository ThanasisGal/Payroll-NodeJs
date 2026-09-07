'use strict';
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
const M = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const Models = require('../../models/ergazomenoi');
const Terms = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { requireScopedEmployeeForUpdate } = require('./employeeUpdateScope');
const source = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
const scope = { team: 'fixture', company_kod: 'company', kodikos: '0001' };
const plain = value => JSON.parse(JSON.stringify(value));
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
function memory(initial = { employee: null, history: [] }, fail = '') {
    let committed = plain(initial), draft, ended = false, writes = 0;
    const session = { async withTransaction(work) {
        draft = plain(committed);
        try { await work(); if (fail === 'commit') throw Error('commit failed'); committed = draft; }
        finally { draft = null; }
    }, async endSession() { ended = true; } };
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) =>
        value == null ? row[key] == null : value instanceof Date ? new Date(row[key]).getTime() === value.getTime() : String(row[key]) === String(value));
    function query(read) { let sort; return { session(s) { assert.equal(s, session); return this; }, select() { return this; },
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
            draft.employee = plain(doc); return [doc];
        },
        async updateOne(filter, update, options) {
            assert.equal(options.session, session); writes++;
            if (!matches(draft.employee, filter)) return { matchedCount: 0 };
            Object.assign(draft.employee, plain(update.$set)); return { matchedCount: 1 };
        }
    });
    const historyModel = Object.assign(function (record) { return new Models.IstorikoProslhpseonAllagonModel(record); }, {
        find: filter => query(() => draft.history.filter(row => matches(row, filter))),
        async deleteOne(filter, options) {
            assert.equal(options.session, session); writes++;
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
            Object.assign(row, plain(update.$set)); return { matchedCount: 1 };
        }
    });
    return { employeeModel, historyModel, state: () => committed, writes: () => writes, ended: () => ended,
        deps: { employeeModel, historyModel, connection: { startSession: async () => session }, capabilityProbe: async () => true } };
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
        Date, console: { log() {}, error() {} }, mongoose, ...Terms, ...M, ...require('../../utils/ergazomenoi/forologikhKlimakaCode'), requireScopedEmployeeForUpdate,
        ErgazomenoiModel: db.employeeModel, IstorikoProslhpseonAllagonModel: db.historyModel,
        writeEmployeeEmploymentProfile: args => W.writeEmployeeEmploymentProfile({ ...args, ...db.deps })
    });
}
async function submit(mode, input, db = memory()) {
    const req = { body: { formData: plain(input), filesToUpdate: {}, skipContract: true },
        session: { userTeam: scope.team, companyInUse: scope.company_kod },
        params: { ergazomenoiId: db.state().employee?._id } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler(mode, db)(req, res);
    assert.equal(mongoose.connection.readyState, 0);
    return { db, res };
}
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
]) test(`LEGACY maintenance controller: ${name} stays physically legacy and corrects the same history`, async () => {
    const stored = await legacyInitial();
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
    assert.equal(db.writes(), 2); assert.equal(db.ended(), true);
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
test('LEGACY maintenance history failure rolls back the successful current write', async () => {
    const stored = await legacyInitial(), db = memory(stored, 'history');
    const { res } = await submit('edit', { ...form(), email: 'rollback@example.invalid' }, db);
    assert.equal(res.code, 500); assert.equal(db.writes(), 2);
    assert.deepEqual(db.state(), stored); assert.equal(db.ended(), true);
});
test('LEGACY no matching history retains baseline insertion without V1 defaults', async () => {
    const stored = await legacyInitial(); stored.history = [];
    const { db, res } = await submit('edit', { ...form(), [C.ENABLED]: false }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assertLegacy(db.state());
    assert.equal(db.state().history.length, 1); assert.equal(db.state().history[0].aa_eggrafhs, '0001');
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
test('LEGACY effective date change creates first V1 append and preserves prior legacy facts', async () => {
    const stored = await legacyInitial(), previous = plain(stored.history[0]);
    const { db, res } = await submit('edit', { ...form(), hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assert.equal(db.state().history.length, 2);
    assert.equal(db.state().history[1][C.SCHEMA_VERSION], 1);
    assert.equal(db.state().employee[T.ANCHOR].before.slice(0, 10), '2026-09-15');
    previous.hmeromhnia_isxyos_oron_ergasias_eos = '2026-09-14T00:00:00.000Z';
    assert.deepEqual(db.state().history[0], previous);
});
for (const kind of ['employee', 'history']) test(`LEGACY maintenance stale ${kind} rolls back`, async () => {
    const stored = await legacyInitial(), db = memory(stored);
    db[`${kind}Model`].updateOne = async () => ({ matchedCount: 0 });
    const { res } = await submit('edit', { ...form(), email: 'stale@example.invalid' }, db);
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
    assert.equal(res.code, 200, res.body?.errorMessage); assert.equal(db.state().history.length, 1);
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
test('EDIT new version has complete work terms, contract values and all profile fields', async () => {
    const stored = await initial();
    const { db, res } = await submit('edit', { ...form(), ...enabled,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15', nomimosMisthos: 1400, poso_symbashs_01: 1400 }, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assert.equal(db.state().history.length, 2);
    const next = db.state().history[1];
    for (const field of [...C.FACT_FIELDS, ...H.BASE_HISTORY_FIELDS, 'kathestos_apasxolhshs', 'typos_apasxolhshs',
        'typos_ebdomadas', 'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias']) {
        assert(Object.hasOwn(next, field), field);
    }
    assert.equal(next.nomimosMisthos, 1400); assert.equal(next.poso_symbashs_01, 1400);
    assert.equal(next.hmeromhnia_isxyos_dialleimatos_apo.slice(0, 10), '2026-09-15');
    assert.equal(db.state().history[0].hmeromhnia_isxyos_oron_ergasias_eos.slice(0, 10), '2026-09-14');
    assert.equal(db.state().history[0][C.ENABLED], false);
});
test('EDIT correction history failure rolls back personal fields and profile together', async () => {
    const stored = await initial(enabled); const db = memory(stored, 'history');
    const { res } = await submit('edit', { ...form(), [C.ENABLED]: false, eponymoHidden: 'Changed' }, db);
    assert.equal(res.code, 500); assert.deepEqual(db.state(), stored);
});
test('EDIT retrospective insertion fails with visible validation and no changes', async () => {
    const stored = await initial(); const { db, res } = await submit('edit', { ...form(),
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-03-15' }, memory(stored));
    assert.equal(res.code, 409); assert.equal(res.body.reason, 'EMPLOYEE_PROFILE_NON_APPEND_CHANGE');
    assert.match(res.body.errorMessage, /αναδρομική/); assert.deepEqual(db.state(), stored); assert.equal(db.writes(), 0);
});
for (const append of [false, true]) test(`EDIT legacy 45 survives omission, append=${append}`, async () => {
    const stored = await initial(); stored.employee.dialleima_se_lepta = 45; stored.history[0].dialleima_se_lepta = 45;
    const data = { ...form(), ...(append ? { hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' } : {}) };
    const { db, res } = await submit('edit', data, memory(stored));
    assert.equal(res.code, 200, res.body?.errorMessage); assert.equal(db.state().employee.dialleima_se_lepta, 45);
    assert.equal(db.state().history.at(-1).dialleima_se_lepta, 45);
    const rejected = await submit('edit', { ...data, dialleima_se_lepta: 45 }, memory(stored));
    assert.equal(rejected.res.code, 400); assert.deepEqual(rejected.db.state(), stored);
});
test('EDIT scope still rejects forged employee identity before writes', async () => {
    const db = memory(await initial()); const req = { body: { formData: form() },
        params: { ergazomenoiId: 'ffffffffffffffffffffffff' }, session: { userTeam: scope.team, companyInUse: scope.company_kod } };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler('edit', db)(req, res); assert.equal(res.code, 404); assert.equal(db.writes(), 0);
});
test('controller downstream Save response, PDF, ERGANI and schedule code unchanged', () => {
    const baseline = execFileSync('git', ['show', 'da765ee8050c91419b7707839b55e4ead0412ef3:server/controllers/ergazomenoi/ergazomenoiController.js'], { encoding: 'utf8' }).replaceAll('\r', '');
    for (const [start, end] of [
        ['        // ✅ Έλεγχος ότι το _id υπάρχει', '        const newIstoriko ='],
        ['            // ✅ Get company data for email', '    static postErgazomenoiUpdate'],
        ['        // ✅ 6) ΕΝΗΜΕΡΩΣΗ ΩΡΑΡΙΩΝ', '        // ✅ 7)'],
        ['        // ✅ 8) ΕΠΕΞΕΡΓΑΣΙΑ PDF', '    static deleteErgazomenoi']
    ]) {
        const oldStart = baseline.indexOf(start), newStart = source.indexOf(start);
        assert(oldStart >= 0 && newStart >= 0, start);
        let oldEnd = baseline.indexOf(end, oldStart);
        if (oldEnd < 0) oldEnd = baseline.length;
        let chunk = baseline.slice(oldStart, oldEnd).trimEnd();
        // Section separators immediately before the moved history are not executable.
        chunk = chunk.replace(/\n\s*\/\/ =+$/, '');
        assert(source.slice(newStart).startsWith(chunk), start);
    }
});

function historyHandler(db) {
    const start = source.indexOf('static updateIstorikoData = '), end = source.indexOf('    static searchPostErgazomenoi', start);
    const method = source.slice(start, end).trim().replace('static updateIstorikoData = ', '').replace(/;$/, '');
    const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
    return vm.runInNewContext(`${helpers}\n(${method})`, { Date, console: { error() {} }, ...Terms, ...M,
        ErgazomenoiModel: db.employeeModel,
        writeEmployeeEmploymentHistoryOperations: args => W.writeEmployeeEmploymentHistoryOperations({ ...args, ...db.deps }) });
}
async function editHistory(db, updates) {
    const req = { session: { userTeam: scope.team, companyInUse: scope.company_kod },
        body: { employeeId: db.state().employee._id, updates } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await historyHandler(db)(req, res); return res;
}
function rowData(row, extra = {}) {
    return { ...row, pososto_prosayxhshs_6hs_hmeras: 40, ...extra };
}
test('history editor corrects exact latest row and current atomically with baseline numbering', async () => {
    const stored = await initial(enabled), db = memory(stored);
    const row = stored.history[0];
    const res = await editHistory(db, [{ _id: row._id, state: 'modified', data: rowData(row, { [C.DAYS]: [7, 1] }) }]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history.length, 1);
    assert.deepEqual(db.state().employee[C.DAYS], [1, 7]); assert.deepEqual(db.state().history[0][C.DAYS], [1, 7]);
    assert.equal(db.state().history[0].aa_eggrafhs, row.aa_eggrafhs);
});
for (const state of ['inserted', 'deleted']) test(`history editor rejects specifically unsupported ${state} atomically`, async () => {
    const stored = await initial(), db = memory(stored);
    const res = await editHistory(db, [{ _id: stored.history[0]._id, state, data: form() }]);
    assert.equal(res.code, 409);
    assert.equal(res.body.reason, state === 'inserted' ? 'EMPLOYEE_PROFILE_NON_APPEND_CHANGE' : 'EMPLOYEE_PROFILE_DELETE_CURRENT_VERSION_UNSUPPORTED');
    assert.deepEqual(db.state(), stored);
});
test('history editor cannot change date identity or correct an unknown ID', async () => {
    const stored = await initial(); const row = stored.history[0];
    for (const update of [
        { _id: row._id, state: 'modified', data: rowData(row, { hmeromhnia_isxyos_oron_ergasias_apo: '2026-03-01' }) },
        { _id: 'ffffffffffffffffffffffff', state: 'modified', data: rowData(row) }
    ]) {
        const db = memory(stored); const res = await editHistory(db, [update]);
        assert.equal(res.code, 409); assert.equal(res.body.reason, update._id === row._id ? 'EMPLOYEE_PROFILE_RETROSPECTIVE_BOUNDARY_UNSUPPORTED' : 'EMPLOYEE_PROFILE_CORRECTION_IDENTITY_MISMATCH');
        assert.deepEqual(db.state(), stored); assert.equal(db.writes(), 0);
    }
});
test('batch history corrections roll back earlier correction when a later identity fails', async () => {
    const stored = await initial(enabled), db = memory(stored), row = stored.history[0];
    const res = await editHistory(db, [
        { _id: row._id, state: 'modified', data: rowData(row, { [C.ENABLED]: false }) },
        { _id: 'ffffffffffffffffffffffff', state: 'modified', data: rowData(row) }
    ]);
    assert.equal(res.code, 409); assert(db.writes() > 0, 'earlier draft correction ran');
    assert.deepEqual(db.state(), stored); assert.equal(db.ended(), true);
});
test('older exact correction preserves current profile and surrounding version', async () => {
    const initialState = await initial(); const db = memory(initialState);
    await submit('edit', { ...form(), ...enabled, hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' }, db);
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
test('all controller methods outside the three persistence seams are byte-identical to baseline', () => {
    const baseline = execFileSync('git', ['show', 'da765ee8050c91419b7707839b55e4ead0412ef3:server/controllers/ergazomenoi/ergazomenoiController.js'], { encoding: 'utf8' }).replaceAll('\r', '');
    const methods = code => new Map(code.split(/(?=^    static )/m).map(part => [part.match(/^    static (\w+)/)?.[1], part]));
    const before = methods(baseline), after = methods(source);
    for (const [name, code] of before) if (name && !['postErgazomenoiForm', 'postErgazomenoiUpdate', 'updateIstorikoData'].includes(name)) {
        assert.equal(after.get(name), code, name);
    }
});

async function twoVersions() {
    const db = memory(await initial());
    const result = await submit('edit', { ...form(), ...enabled, hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-15' }, db);
    assert.equal(result.res.code, 200); return db.state();
}
const insertion = (date, extra = {}) => ({ state: 'inserted', data: { ...form(),
    hmeromhnia_isxyos_oron_ergasias_apo: date, ...extra } });
const withoutSequence = row => { const copy = plain(row); delete copy.aa_eggrafhs; return copy; };
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
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history.length, 1);
    assert.deepEqual(withoutSequence(db.state().history[0]), withoutSequence(stored.history[1]));
    assert.equal(db.state().history[0].aa_eggrafhs, '0001'); assert.deepEqual(db.state().employee, stored.employee);
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
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [
        { state: 'modified', _id: stored.history[1]._id, data: rowData(stored.history[1], { [C.DAYS]: [2, 4] }) },
        { state: 'deleted', _id: stored.history[0]._id }
    ]);
    assert.equal(res.code, 200, res.body.message); assert.equal(db.state().history.length, 1);
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
});
test('later batch failure rolls back deletion, append, closed boundaries and current update', async () => {
    const stored = await twoVersions(), db = memory(stored);
    const res = await editHistory(db, [{ state: 'deleted', _id: stored.history[0]._id }, insertion('2026-10-01'),
        { state: 'deleted', _id: 'ffffffffffffffffffffffff' }]);
    assert.equal(res.code, 409); assert(db.writes() >= 3); assert.deepEqual(db.state(), stored);
});
test('transaction commit failure rolls back renumbering and accepted deletion/append', async () => {
    const stored = await twoVersions(), db = memory(stored, 'commit');
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
    const stored = await twoVersions();
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
    const edit = await submit('edit', form(), memory(await initial(), 'history'));
    assert.deepEqual(plain(edit.res.body), { success: false, errorMessage: 'Σφάλμα κατά την ενημέρωση εργαζόμενου' });
});
test('semantic controller audit: allocation and Add/Edit field maps retain baseline parity', () => {
    const baseline = execFileSync('git', ['show', 'da765ee8050c91419b7707839b55e4ead0412ef3:server/controllers/ergazomenoi/ergazomenoiController.js'], { encoding: 'utf8' }).replaceAll('\r', '');
    const part = (code, start, end, offset = 0) => { const a = code.indexOf(start, offset); const b = code.indexOf(end, a); assert(a >= 0 && b > a); return code.slice(a, b).trim(); };
    const addOffset = code => code.indexOf('static postErgazomenoiForm');
    assert.equal(part(source, '        try {\n            const lastRecord =', '        const days = 7;', addOffset(source)),
        part(baseline, '        try {\n            const lastRecord =', '        try {\n            const lastRecordIstorikoy', addOffset(baseline)));
    assert.equal(part(source, '        const newErgazomenos =', '        const newIstoriko =', addOffset(source)),
        part(baseline, '        const newErgazomenos =', '        let savedErgazomenos', addOffset(baseline)));
    const editOffset = code => code.indexOf('static postErgazomenoiUpdate');
    const noDivider = text => text.replace(/\n\s*\/\/ =+$/, '').trim();
    assert.equal(part(source, '        const filteredDataErgazomenoi =', '        const updateFieldsIstoriko =', editOffset(source)),
        noDivider(part(baseline, '        const filteredDataErgazomenoi =', '        // ✅ 5)', editOffset(baseline))));
    assert.equal(part(source, '            const toNumber =', '            const result = await writeEmployeeEmploymentProfile', editOffset(source)),
        part(baseline, '            const toNumber =', '            updatedErgazomenos = await ErgazomenoiModel.findOneAndUpdate', editOffset(baseline)));
    const beforeHistory = part(baseline, '        const newIstoriko =', '        try {\n            await IstorikoProslhpseonAllagonModel.create', addOffset(baseline))
        .replace("            aa_eggrafhs: aa_eggr.toString().padStart(4, '0'),\n", '');
    assert.equal(part(source, '        const newIstoriko =', '        let savedErgazomenos', addOffset(source)), beforeHistory);
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
    db.state().history.forEach((row, i) => assert.deepEqual(withoutSequence(row), withoutSequence(stored.history[i])));
});
