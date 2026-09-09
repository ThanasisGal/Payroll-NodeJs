'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const C = require('./employmentProfileContract');
const H = require('./employmentProfileHistory');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const normalize = C.normalizeEmploymentProfileSubmission;
const enabled = () => ({ [C.ENABLED]: true, [C.TYPE]: 'APPROVED_TIME_SHIFT_INTERRUPTION',
    [C.FROM]: '2026-09-01', [C.START]: '13:00', [C.END]: '14:00' });
const fails = (data, field) => assert.throws(() => normalize(data), (error) =>
    error.code === 'INVALID_EMPLOYMENT_PROFILE' && (!field || error.field === field));

test('legacy reads preserve unrecorded provenance and do not mutate their source', () => {
    const source = { dialleima_se_lepta: 45 };
    const read = C.readEmploymentProfile(source);
    assert.equal(read.recorded, false); assert.equal(read.facts[C.ENABLED], false);
    assert.equal(read.facts.dialleima_se_lepta, 45);
    assert(read.unrecordedFields.includes(C.ENABLED));
    assert.deepEqual(source, { dialleima_se_lepta: 45 });
    const hydrated = ErgazomenoiModel.hydrate({ _id: new mongoose.Types.ObjectId(), ...source });
    assert.equal(hydrated.dialleima_se_lepta, 45);
    assert.equal(C.readEmploymentProfile(hydrated.toObject()).recorded, false);
});
test('new employee and history schemas carry optional safe defaults', async () => {
    for (const Model of [ErgazomenoiModel, IstorikoProslhpseonAllagonModel]) {
        const doc = new Model(); await doc.validate();
        assert.equal(doc[C.ENABLED], false); assert.deepEqual([...doc[C.DAYS]], []);
        assert.equal(doc[C.FROM], null); assert.equal(doc[C.TYPE_VERSION], null);
        assert.equal(doc[C.SCHEMA_VERSION], null); // construction is not a complete snapshot
        for (const field of C.FACT_FIELDS) assert(Model.schema.path(field), field);
        for (const field of C.BREAK_PAIRS.flat()) assert.equal(doc[field], null);
        assert.equal(Model.schema.path('apo_ora_01_break'), undefined);
    }
    assert.equal(mongoose.connection.readyState, 0);
});
test('disabled facts default safely; enabled types require type/start/interruption', () => {
    assert.equal(normalize({})[C.ENABLED], false);
    assert.equal(normalize({ [C.ENABLED]: 'false' })[C.ENABLED], false);
    assert.equal(normalize(enabled())[C.ENABLED], true);
    fails({ [C.ENABLED]: true }, C.TYPE);
    fails({ ...enabled(), [C.FROM]: null }, C.FROM);
    fails({ ...enabled(), [C.TYPE]: 'UNRECOGNIZED' }, C.TYPE);
    fails({ ...enabled(), [C.START]: null, [C.END]: null }, C.START);
    const other = normalize({ ...enabled(), [C.TYPE]: 'OTHER_APPROVED_ARRANGEMENT', [C.START]: null, [C.END]: null });
    assert.equal(other[C.START], null);
    const leave = normalize({ ...enabled(), [C.TYPE]: 'APPROVED_LEAVE_INTERRUPTION' });
    assert.equal(leave[C.CATEGORY], null); // No invented DB code or required Phase 2 mapping.
    assert.equal('counts_as_working_time' in leave, false);
});
test('dates are strict calendar days, optional end and inclusive same-day validity', () => {
    assert.equal(normalize(enabled())[C.UNTIL], null);
    assert.equal(normalize({ ...enabled(), [C.UNTIL]: '2026-09-01' })[C.UNTIL].toISOString(), '2026-09-01T00:00:00.000Z');
    fails({ ...enabled(), [C.UNTIL]: '2026-08-31' }, C.UNTIL);
    fails({ ...enabled(), [C.FROM]: '2026-02-30' }, C.FROM);
    fails({ ...enabled(), [C.FROM]: true }, C.FROM);
});
test('days are unique integer ISO weekdays; empty means all scheduled workdays', () => {
    assert.deepEqual(normalize(enabled())[C.DAYS], []);
    assert.deepEqual(normalize({ ...enabled(), [C.DAYS]: [7, 1, 4] })[C.DAYS], [1, 4, 7]);
    assert.deepEqual(normalize({ [C.DAYS]: ['7', 1, 7, '1'] })[C.DAYS], [1, 7]);
    for (const days of [[0], [8], [1.5], null, '1', [true], ['01']]) fails({ ...enabled(), [C.DAYS]: days }, C.DAYS);
});
test('server owns policy and complete schema versions', () => {
    const result = normalize({ ...enabled(), [C.TYPE_VERSION]: 'HR-spoof', [C.SCHEMA_VERSION]: 900 });
    assert.equal(result[C.TYPE_VERSION], C.ARRANGEMENT_TYPE_VERSION);
    assert.equal(result[C.SCHEMA_VERSION], C.EMPLOYMENT_PROFILE_SCHEMA_VERSION);
});
test('omitted fields preserve existing facts; explicit null clears optional pairs', () => {
    const previous = normalize({ ...enabled(), dialleima_se_lepta: 30,
        dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:30' });
    assert.equal(normalize({}, previous).dialleima_apo_ora_01, '12:00');
    const cleared = normalize({ dialleima_apo_ora_01: null, dialleima_eos_ora_01: '' }, previous);
    assert.equal(cleared.dialleima_apo_ora_01, null); assert.equal(cleared.dialleima_eos_ora_01, null);
});
test('breaks may be blank or complete and positive, including midnight', () => {
    assert.equal(normalize({}).dialleima_apo_ora_01, null);
    assert.equal(normalize({ dialleima_se_lepta: 30, dialleima_apo_ora_01: '23:50', dialleima_eos_ora_01: '00:20' }).dialleima_eos_ora_01, '00:20');
    assert.equal(normalize({ dialleima_se_lepta: 15, dialleima_apo_ora_01: '00:00', dialleima_eos_ora_01: '00:15' }).dialleima_apo_ora_01, '00:00');
    for (const [a, b] of C.BREAK_PAIRS) {
        fails({ [a]: '12:00' }, a); fails({ [b]: '12:15' }, a);
        fails({ [a]: '12:00', [b]: '12:00' }, a);
        fails({ [a]: '24:00', [b]: '00:15' }, a);
        fails({ [a]: '9:00', [b]: '09:15' }, a);
    }
});
test('break intervals cannot overlap; adjacency and sums work across midnight', () => {
    const pair = { dialleima_se_lepta: 30, dialleima_apo_ora_01: '12:00', dialleima_eos_ora_01: '12:15',
        dialleima_apo_ora_02: '12:15', dialleima_eos_ora_02: '12:30' };
    normalize(pair);
    fails({ ...pair, dialleima_apo_ora_02: '12:10' }, 'dialleima');
    fails({ ...pair, dialleima_se_lepta: 20 }, 'dialleima_se_lepta');
    fails({ dialleima_se_lepta: 30, dialleima_apo_ora_01: '23:50', dialleima_eos_ora_01: '00:10',
        dialleima_apo_ora_02: '00:05', dialleima_eos_ora_02: '00:15' }, 'dialleima');
    normalize({ ...pair, dialleima_apo_ora_01: '23:50', dialleima_eos_ora_01: '00:05',
        dialleima_apo_ora_02: '00:05', dialleima_eos_ora_02: '00:20' });
});
test('new break submissions allow 0 and 15..30; reads preserve legacy >30', () => {
    normalize({ dialleima_se_lepta: 0 });
    for (let n = 1; n < 15; n++) fails({ dialleima_se_lepta: n }, 'dialleima_se_lepta');
    for (let n = 15; n <= 30; n++) assert.equal(normalize({ dialleima_se_lepta: n }).dialleima_se_lepta, n);
    for (const n of [31, 45, -1, 15.5, NaN, true]) fails({ dialleima_se_lepta: n });
    assert.equal(C.readEmploymentProfile({ dialleima_se_lepta: 45 }).facts.dialleima_se_lepta, 45);
    assert.equal(normalize({}, { dialleima_se_lepta: 45 }).dialleima_se_lepta, 45);
    assert.throws(() => normalize({ dialleima_se_lepta: 45 }, { dialleima_se_lepta: 45 }));
});
test('Mongoose document validation uses the common server contract', async () => {
    await assert.rejects(new ErgazomenoiModel({ [C.ENABLED]: true }).validate());
    await assert.rejects(new ErgazomenoiModel({ dialleima_se_lepta: 45 }).validate());
    await assert.rejects(new IstorikoProslhpseonAllagonModel({ dialleima_apo_ora_01: '12:00' }).validate());
});
test('complete initial/changed snapshots carry every fact and server versions', () => {
    const first = H.buildCompleteProfileSnapshot({ input: enabled(), effectiveFrom: '2026-09-01' });
    for (const field of C.FACT_FIELDS) assert(field in first, field);
    assert.equal(first.afora_allagh_dialleimatos, true);
    assert.equal(first[C.SCHEMA_VERSION], C.EMPLOYMENT_PROFILE_SCHEMA_VERSION);
    const next = H.buildCompleteProfileSnapshot({ current: first,
        input: { [C.START]: '12:00', [C.END]: '13:00' }, effectiveFrom: '2026-09-15' });
    assert.equal(first[C.START], '13:00'); assert.equal(next[C.START], '12:00');
    assert.equal(next.hmeromhnia_isxyos_dialleimatos_apo.toISOString(), '2026-09-15T00:00:00.000Z');
});
test('historical dates never use current/future facts and validity is inclusive', () => {
    const row = H.buildCompleteProfileSnapshot({ input: { ...enabled(), [C.UNTIL]: '2026-09-30' }, effectiveFrom: '2026-09-01' });
    const old = { hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01', hmeromhnia_isxyos_oron_ergasias_eos: '2026-08-31' };
    const resolve = (date) => H.resolveEmploymentProfileFactsForDate(date, [old, row], { scheduledWorkingDay: true, currentEmployee: row });
    for (const date of ['2026-04-15', '2026-08-31', '2026-10-01']) assert.equal(resolve(date).facts[C.ENABLED], false);
    for (const date of ['2026-09-01', '2026-09-30']) assert.equal(resolve(date).facts[C.ENABLED], true);
    assert.equal(resolve('2026-04-15').recorded, false);
    assert.equal(resolve('2026-10-01').recorded, true);
    assert.equal(resolve('2026-10-01').facts[C.TYPE], null);
    assert.equal(H.resolveEmploymentProfileFactsForDate('2026-04-15', [], { currentEmployee: row }).recorded, false);
});
test('schedule day applicability, explicit open end and overlaps', () => {
    const row = H.buildCompleteProfileSnapshot({ input: enabled(), effectiveFrom: '2026-09-01' });
    row.hmeromhnia_allaghs_orarioy_eos = '2026-09-07';
    assert.equal(H.resolveEmploymentProfileFactsForDate('2026-09-30', [row], { scheduledWorkingDay: true }).arrangementEffective, true);
    assert.equal(H.resolveEmploymentProfileFactsForDate('2026-09-30', [row]).arrangementEffective, false);
    row[C.DAYS] = [1];
    assert.equal(H.resolveEmploymentProfileFactsForDate('2026-09-07', [row], { scheduledWorkingDay: true }).arrangementEffective, true);
    assert.equal(H.resolveEmploymentProfileFactsForDate('2026-09-08', [row], { scheduledWorkingDay: true }).arrangementEffective, false);
    assert.throws(() => H.resolveEmploymentProfileFactsForDate('2026-09-07', [row, row]), /overlapping/);
});
test('schema version alone cannot turn missing facts into a recorded decision', () => {
    const sparse = { [C.SCHEMA_VERSION]: C.EMPLOYMENT_PROFILE_SCHEMA_VERSION,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-01', ...enabled() };
    const result = H.resolveEmploymentProfileFactsForDate('2026-09-01', [sparse], { scheduledWorkingDay: true });
    assert.equal(result.recorded, false); assert.equal(result.arrangementEffective, false);
});

test('profile timeline excludes explicit empty non-terms starts without changing legacy fallback', () => {
    const schedule = { hmeromhnia_allaghs_orarioy_apo: '2026-05-25' };
    for (const empty of [null, '', undefined]) {
        assert.equal(H.effectiveStart({ ...schedule,
            hmeromhnia_isxyos_oron_ergasias_apo: empty, afora_allagh_oron_ergasias: false }), null);
    }
    for (const row of [schedule, { ...schedule, afora_allagh_oron_ergasias: false },
        { ...schedule, hmeromhnia_isxyos_oron_ergasias_apo: null, afora_allagh_oron_ergasias: true },
        { ...schedule, hmeromhnia_isxyos_oron_ergasias_apo: null }]) {
        assert.equal(H.effectiveStart(row).toISOString(), '2026-05-25T00:00:00.000Z');
    }
    const complete = H.buildCompleteProfileSnapshot({ effectiveFrom: '2026-06-01' });
    assert.equal(C.readEmploymentProfile(complete).recorded, true);
    assert.equal(H.effectiveStart({ ...complete, ...schedule }).toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(H.effectiveStart({ ...complete, ...schedule, afora_allagh_oron_ergasias: false }).toISOString(),
        '2026-06-01T00:00:00.000Z');
});

test('break-only legacy history stays outside the profile timeline and retains its own break start', () => {
    const { resolveBreakConfigurationForDate } = require('./resolveBreakConfigurationForDate');
    const row = { _id: 'break-only', afora_allagh_oron_ergasias: false,
        afora_allagh_dialleimatos: true, hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_allaghs_orarioy_apo: '2026-05-25',
        hmeromhnia_isxyos_dialleimatos_apo: '2026-06-01', dialleima_se_lepta: 30 };
    assert.equal(H.effectiveStart(row), null);
    for (const date of ['2026-05-25', '2026-05-31', '2026-06-01', '2026-06-15']) {
        const profile = H.resolveEmploymentProfileFactsForDate(date, [row]);
        assert.equal(profile.historyId, null);
        assert.equal(profile.recorded, false);
        const breaks = resolveBreakConfigurationForDate(date, [row]);
        assert.equal(breaks.break_minutes, date < '2026-06-01' ? 0 : 30);
        assert.equal(breaks.history_id, date < '2026-06-01' ? null : row._id);
        if (date >= '2026-06-01') {
            assert.equal(breaks.source, 'BREAK_CONFIGURATION_HISTORY');
            assert.equal(breaks.effective_from.toISOString(), '2026-06-01T00:00:00.000Z');
        }
    }
});

test('missing legacy profile dates retain schedule fallback and inclusive timeline boundaries', () => {
    const row = { _id: 'legacy', afora_allagh_oron_ergasias: false,
        hmeromhnia_allaghs_orarioy_apo: '2026-05-25', hmeromhnia_allaghs_orarioy_eos: '2026-06-30' };
    assert.equal(Object.hasOwn(row, 'hmeromhnia_isxyos_oron_ergasias_apo'), false);
    assert.equal(H.effectiveStart(row).toISOString(), '2026-05-25T00:00:00.000Z');
    assert.equal(H.effectiveEnd(row).toISOString(), '2026-06-30T00:00:00.000Z');
    assert.equal(H.effectiveEnd({ ...row, hmeromhnia_isxyos_oron_ergasias_eos: null }), null);
    for (const date of ['2026-05-24', '2026-05-25', '2026-06-30', '2026-07-01']) {
        assert.equal(H.resolveEmploymentProfileFactsForDate(date, [row]).historyId,
            date >= '2026-05-25' && date <= '2026-06-30' ? row._id : null);
    }
});
