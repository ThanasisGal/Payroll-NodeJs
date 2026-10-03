'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveHrDailyActualWorkResolution, isApprovedHrDailyActualWorkResolution,
    persistHrDailyActualWorkResolutionWrite } =
    require('./apasxoliseisHrDailyActualWorkResolutionService');

function base() { return { _id: 'row', apo_ora_01: '10:00', eos_ora_01: '14:00',
    ores_ergasias: 4, cards_apo_ora_01: '10:00', cards_eos_ora_01: '10:30', is_locked: false }; }
function command(work, leave = [], category = '') { return { approve: true,
    source_case: 'SUSPICIOUS_SHORT_CARD_INTERVAL', work_intervals: work,
    emergency_hourly_leave_intervals: leave, leave_category: category }; }
const noBreak = { dialleima_se_lepta: 0 };

test('raw short card can be confirmed as exact physical work', () => {
    const result = resolveHrDailyActualWorkResolution({ row: base(), effectiveEmployee: noBreak,
        reason: 'Επιβεβαίωση HR', actor: 'HR', command: command([
            { pairNumber: 1, start: '10:00', end: '10:30' }]) });
    assert.equal(result.netWorkMinutes, 30); assert.equal(result.absenceMinutes, 210);
    assert.equal(result.approvedUpdates.ektakth_oroadeia_apologistika, false);
    assert.equal(result.metadata.raw_card_snapshot.cards_eos_ora_01, '10:30');
    assert.equal(Object.keys(result.approvedUpdates).some(key => key.startsWith('cards_')), false);
});

test('persistence keeps lock, CAS and old/new audit provenance', async () => {
    const oldRecord = { ...base(), team: 'T', company_kod: 'C', kodikos: '0001',
        ypokatasthma: '0001', hmeromhnia: new Date('2026-08-03T00:00:00Z'), __v: 2 };
    const resolved = resolveHrDailyActualWorkResolution({ row: oldRecord,
        effectiveEmployee: noBreak, reason: 'Έγκριση', actor: 'HR',
        command: command([{ pairNumber: 1, start: '10:00', end: '10:30' }]) });
    let written = null; let audit = null;
    const rowModel = { updateOne: async (filter, update) => {
        assert.ok(filter.$and.some(item => item.cards_eos_ora_01 === '10:30'));
        written = update.$set; return { matchedCount: 1 };
    } };
    const auditModel = { create: async (rows) => { [audit] = rows; } };
    const result = await persistHrDailyActualWorkResolutionWrite({ oldRecord,
        semanticUpdates: { ...resolved.approvedUpdates,
            hr_daily_actual_work_resolution: resolved.metadata }, changedBy: 'HR',
        reason: 'Έγκριση', schemaPaths: ['__v', ...Object.keys(oldRecord),
            ...Object.keys(resolved.approvedUpdates), 'hr_daily_actual_work_resolution'],
        rowModel, auditModel, session: {} });
    assert.equal(result.updated, true); assert.equal(written.is_locked, true);
    assert.equal(written.cards_apo_ora_01, undefined);
    assert.equal(audit.oldValues.hr_daily_actual_work_resolution, '');
    assert.equal(audit.newValues.hr_daily_actual_work_resolution.status, 'HR_APPROVED');
});
test('work plus emergency leave plus return keeps hours distinct', () => {
    const result = resolveHrDailyActualWorkResolution({ row: base(), effectiveEmployee: noBreak,
        reason: 'Έκτακτη ανάγκη', actor: 'HR', command: command([
            { pairNumber: 1, start: '10:00', end: '10:30' },
            { pairNumber: 2, start: '13:00', end: '14:04' }
        ], [{ apo_lepto: 630, eos_lepto: 780 }], 'ΑΔΑΣ') });
    assert.equal(result.netWorkMinutes, 94); assert.equal(result.emergencyLeaveMinutes, 150);
    assert.equal(result.coveredMinutes, 244); assert.equal(result.absenceMinutes, 0);
    assert.equal(result.approvedUpdates.ores_pragmatikhs_ergasias_apologistika, 94 / 60);
    assert.equal(result.approvedUpdates.ores_ektakths_oroadeias_apologistika, 2.5);
    assert.equal(result.approvedUpdates.apo_ora_02_apologistika, '13:00');
    assert.equal(result.approvedUpdates.eos_ora_02_apologistika, '14:04');
});
test('overlap, full-day, arrangement and POSSIBLE_LEAVE fail closed', () => {
    const mixed = command([{ pairNumber: 1, start: '10:00', end: '11:00' }],
        [{ apo_lepto: 630, eos_lepto: 720 }], 'ΑΔΑΣ');
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: base(), command: mixed,
        effectiveEmployee: noBreak, reason: 'x', actor: 'HR' }), { code: 'HR_DAILY_WORK_LEAVE_OVERLAP' });
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: { ...base(), adeia_apologistika: true },
        command: mixed, effectiveEmployee: noBreak, reason: 'x', actor: 'HR' }), { code: 'HR_DAILY_FULL_DAY_LEAVE_CONFLICT' });
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: { ...base(), hr_declared_leave: true },
        command: mixed, effectiveEmployee: noBreak, reason: 'x', actor: 'HR' }), { code: 'HR_DAILY_FULL_DAY_LEAVE_CONFLICT' });
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: { ...base(),
        egkekrimenh_oroadeia_apologistika: true }, command: mixed,
        effectiveEmployee: noBreak, reason: 'x', actor: 'HR' }), { code: 'HR_DAILY_AGREEMENT_HOURLY_LEAVE_CONFLICT' });
    const possible = command([{ pairNumber: 1, start: '10:00', end: '10:30' }],
        [{ apo_lepto: 630, eos_lepto: 840 }], 'POSSIBLE_LEAVE');
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: base(), command: possible,
        effectiveEmployee: noBreak, reason: 'x', actor: 'HR' }), { code: 'POSSIBLE_LEAVE_NOT_HR_SELECTABLE' });
});
test('locked canonical approval supports only explicit revision', () => {
    const first = resolveHrDailyActualWorkResolution({ row: base(), effectiveEmployee: noBreak,
        reason: 'Πρώτη', actor: 'HR', command: command([
            { pairNumber: 1, start: '10:00', end: '10:30' }]) });
    const approved = { ...base(), ...first.approvedUpdates, is_locked: true,
        hr_daily_actual_work_resolution: first.metadata };
    assert.equal(isApprovedHrDailyActualWorkResolution(approved), true);
    assert.equal(isApprovedHrDailyActualWorkResolution({ ...approved,
        ektakth_oroadeia_apologistika: true,
        ektakta_diastimata_oroadeias_apologistika: [{ apo_lepto: 630, eos_lepto: 840 }],
        ores_ektakths_oroadeias_apologistika: 3.5,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
        hr_daily_actual_work_resolution: { ...first.metadata,
            emergency_hourly_leave_intervals: [{ apo_lepto: 630, eos_lepto: 840 }],
            leave_category: 'POSSIBLE_LEAVE' }
    }), false);
    const revised = resolveHrDailyActualWorkResolution({ row: approved, effectiveEmployee: noBreak,
        reason: 'Διόρθωση', actor: 'HR2', command: { ...command([
            { pairNumber: 1, start: '10:00', end: '11:00' }]), revise_approved: true } });
    assert.equal(revised.metadata.revision_number, 1);
    assert.equal(revised.metadata.approved_by, 'HR'); assert.equal(revised.metadata.revised_by, 'HR2');
});

test('work followed by emergency hourly leave fully covers the declared schedule', () => {
    const result = resolveHrDailyActualWorkResolution({ row: base(), effectiveEmployee: noBreak,
        reason: 'Έκτακτη αποχώρηση', actor: 'HR', command: command([
            { pairNumber: 1, start: '10:00', end: '10:30' }
        ], [{ apo_lepto: 630, eos_lepto: 840 }], 'ΑΔΑΣ') });
    assert.equal(result.netWorkMinutes, 30);
    assert.equal(result.emergencyLeaveMinutes, 210);
    assert.equal(result.contractualCoveredMinutes, 240);
    assert.equal(result.absenceMinutes, 0);
    assert.equal(result.approvedUpdates.ores_adeias_pistomenes_apologistika, 3.5);
});

test('work outside the declared schedule does not conceal an internal contractual gap', () => {
    const result = resolveHrDailyActualWorkResolution({ row: base(), effectiveEmployee: noBreak,
        reason: 'Μερική κάλυψη', actor: 'HR', command: command([
            { pairNumber: 1, start: '10:00', end: '10:30' },
            { pairNumber: 2, start: '13:30', end: '14:04' }
        ], [{ apo_lepto: 630, eos_lepto: 780 }], 'ΑΔΑΣ') });
    assert.equal(result.netWorkMinutes, 64);
    assert.equal(result.workMinutesInsideDeclared, 60);
    assert.equal(result.coveredMinutes, 214);
    assert.equal(result.contractualCoveredMinutes, 210);
    assert.equal(result.absenceMinutes, 30);
});

test('same-day emergency leave may reach midnight inside an overnight schedule', () => {
    const row = { ...base(), apo_ora_01: '22:00', eos_ora_01: '06:00',
        ores_ergasias: 8, cards_apo_ora_01: '22:00', cards_eos_ora_01: '22:30' };
    const result = resolveHrDailyActualWorkResolution({ row, effectiveEmployee: noBreak,
        reason: 'Έκτακτη αποχώρηση πριν τα μεσάνυχτα', actor: 'HR',
        command: command([{ pairNumber: 1, start: '22:00', end: '22:30' }],
            [{ apo_lepto: 1350, eos_lepto: 1440 }], 'ΑΔΑΣ') });
    assert.equal(result.emergencyLeaveMinutes, 90);
    assert.deepEqual(result.approvedUpdates.ektakta_diastimata_oroadeias_apologistika,
        [{ apo_lepto: 1350, eos_lepto: 1440 }]);
});

test('interval, schedule, reason, actor and command boundaries fail closed', () => {
    const valid = command([{ pairNumber: 1, start: '10:00', end: '10:30' }]);
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: base(), command: valid,
        effectiveEmployee: noBreak, reason: '', actor: 'HR' }), { code: 'HR_DAILY_REASON_REQUIRED' });
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: base(), command: valid,
        effectiveEmployee: noBreak, reason: 'x', actor: '' }), { code: 'HR_DAILY_ACTOR_REQUIRED' });
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: base(),
        command: { ...valid, arbitrary: true }, effectiveEmployee: noBreak,
        reason: 'x', actor: 'HR' }), { code: 'HR_DAILY_RESOLUTION_FIELDS_NOT_ALLOWED' });
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: base(),
        command: command([{ pairNumber: 1, start: '10:00', end: '10:00' }]),
        effectiveEmployee: noBreak, reason: 'x', actor: 'HR' }),
    { code: 'HR_DAILY_WORK_INTERVAL_INVALID' });
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: base(),
        command: command([{ pairNumber: 1, start: '10:00', end: '10:30' }],
            [{ apo_lepto: 540, eos_lepto: 600 }], 'ΑΔΑΣ'),
        effectiveEmployee: noBreak, reason: 'x', actor: 'HR' }),
    { code: 'HR_DAILY_EMERGENCY_LEAVE_OUTSIDE_DECLARED_SCHEDULE' });
});

test('shared break policy applies fallback once and skips breaks for split schedules', () => {
    const fallback = resolveHrDailyActualWorkResolution({ row: base(),
        effectiveEmployee: { dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false },
        reason: 'Έλεγχος διαλείμματος', actor: 'HR', command: command([
            { pairNumber: 1, start: '10:00', end: '14:30' }
        ]) });
    assert.equal(fallback.netWorkMinutes, 240);
    const splitRow = { ...base(), apo_ora_01: '08:00', eos_ora_01: '12:00',
        apo_ora_02: '16:00', eos_ora_02: '20:00', ores_ergasias: 8 };
    const split = resolveHrDailyActualWorkResolution({ row: splitRow,
        effectiveEmployee: { dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false },
        reason: 'Σπαστό ωράριο', actor: 'HR', command: command([
            { pairNumber: 1, start: '08:00', end: '12:00' },
            { pairNumber: 2, start: '16:00', end: '20:00' }
        ]) });
    assert.equal(split.netWorkMinutes, 480);
});

test('locked approval allows exact replay but requires revision for changed values', () => {
    const initialCommand = command([{ pairNumber: 1, start: '10:00', end: '10:30' }]);
    const first = resolveHrDailyActualWorkResolution({ row: base(), command: initialCommand,
        effectiveEmployee: noBreak, reason: 'Ίδια αιτιολογία', actor: 'HR' });
    const approved = { ...base(), ...first.approvedUpdates, is_locked: true,
        hr_daily_actual_work_resolution: first.metadata };
    const replay = resolveHrDailyActualWorkResolution({ row: approved,
        command: initialCommand, effectiveEmployee: noBreak,
        reason: 'Ίδια αιτιολογία', actor: 'HR' });
    assert.equal(replay.idempotentReplay, true);
    assert.deepEqual(replay.metadata, first.metadata);
    assert.throws(() => resolveHrDailyActualWorkResolution({ row: approved,
        command: command([{ pairNumber: 1, start: '10:00', end: '11:00' }]),
        effectiveEmployee: noBreak, reason: 'Ίδια αιτιολογία', actor: 'HR' }),
    { code: 'HR_DAILY_APPROVED_REVISION_REQUIRED' });
});

test('revision persistence audits old/new metadata and rejects a stale CAS', async () => {
    const first = resolveHrDailyActualWorkResolution({ row: base(),
        command: command([{ pairNumber: 1, start: '10:00', end: '10:30' }]),
        effectiveEmployee: noBreak, reason: 'Πρώτη', actor: 'HR' });
    const oldRecord = { ...base(), ...first.approvedUpdates, team: 'T', company_kod: 'C',
        kodikos: '0001', ypokatasthma: '0001', hmeromhnia: new Date('2026-08-03T00:00:00Z'),
        is_locked: true, locked_by: 'HR', locked_at: new Date(),
        hr_daily_actual_work_resolution: first.metadata, __v: 3 };
    const revised = resolveHrDailyActualWorkResolution({ row: oldRecord,
        command: { ...command([{ pairNumber: 1, start: '10:00', end: '11:00' }]),
            revise_approved: true }, effectiveEmployee: noBreak,
        reason: 'Διόρθωση', actor: 'HR2' });
    let audit;
    await persistHrDailyActualWorkResolutionWrite({ oldRecord,
        semanticUpdates: { ...revised.approvedUpdates,
            hr_daily_actual_work_resolution: revised.metadata }, changedBy: 'HR2',
        reason: 'Διόρθωση', reviseApproved: true,
        schemaPaths: ['__v', ...Object.keys(oldRecord), ...Object.keys(revised.approvedUpdates)],
        rowModel: { updateOne: async () => ({ matchedCount: 1 }) },
        auditModel: { create: async ([value]) => { audit = value; } }, session: {} });
    assert.equal(audit.oldValues.hr_daily_actual_work_resolution.revision_number, 0);
    assert.equal(audit.newValues.hr_daily_actual_work_resolution.revision_number, 1);
    assert.equal(audit.oldValues.eos_ora_01_apologistika, '10:30');
    assert.equal(audit.newValues.eos_ora_01_apologistika, '11:00');
    await assert.rejects(() => persistHrDailyActualWorkResolutionWrite({ oldRecord,
        semanticUpdates: { ...revised.approvedUpdates,
            hr_daily_actual_work_resolution: revised.metadata }, changedBy: 'HR2',
        reason: 'Διόρθωση', reviseApproved: true,
        schemaPaths: ['__v', ...Object.keys(oldRecord), ...Object.keys(revised.approvedUpdates)],
        rowModel: { updateOne: async () => ({ matchedCount: 0 }) },
        auditModel: { create: async () => { throw new Error('must not audit'); } }, session: {} }),
    { code: 'EMPLOYMENT_REVIEW_STALE_WRITE' });
});

test('ordinary persistence accepts only exact replay of a locked approval', async () => {
    const first = resolveHrDailyActualWorkResolution({ row: base(),
        command: command([{ pairNumber: 1, start: '10:00', end: '10:30' }]),
        effectiveEmployee: noBreak, reason: 'Πρώτη', actor: 'HR' });
    const oldRecord = { ...base(), ...first.approvedUpdates, team: 'T', company_kod: 'C',
        kodikos: '0001', ypokatasthma: '0001', hmeromhnia: new Date('2026-08-03T00:00:00Z'),
        is_locked: true, locked_by: 'HR', locked_at: new Date(),
        hr_daily_actual_work_resolution: first.metadata, __v: 3 };
    const semanticUpdates = { ...first.approvedUpdates,
        hr_daily_actual_work_resolution: first.metadata };
    const models = { schemaPaths: ['__v', ...Object.keys(oldRecord),
        ...Object.keys(first.approvedUpdates)],
    rowModel: { updateOne: async () => { throw new Error('must not write'); } },
    auditModel: { create: async () => { throw new Error('must not audit'); } }, session: {} };
    const replay = await persistHrDailyActualWorkResolutionWrite({ oldRecord,
        semanticUpdates, changedBy: 'HR', reason: 'Πρώτη', ...models });
    assert.deepEqual(replay, { idempotent: true, updated: false });
    await assert.rejects(() => persistHrDailyActualWorkResolutionWrite({ oldRecord,
        semanticUpdates: { ...semanticUpdates, ores_apoysias_apologistika: 1 },
        changedBy: 'HR', reason: 'Πρώτη', ...models }),
    { code: 'HR_DAILY_APPROVED_REVISION_REQUIRED' });
});
