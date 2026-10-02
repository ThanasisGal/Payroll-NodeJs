'use strict';

const assert = require('node:assert/strict');
const {
    POLICY_VERSION,
    resolveZeroLengthCardResolution,
    persistZeroLengthCardResolutionWrite
} = require('./apasxoliseisZeroLengthCardResolutionService');

function row(overrides = {}) {
    return {
        _id: 'zero-row', team: 'THA', company_kod: 'company', ypokatasthma: '0000',
        kodikos: '0014', hmeromhnia: new Date('2026-08-14T00:00:00.000Z'),
        cards_apo_ora_01: '14:04', cards_eos_ora_01: '14:04',
        cards_apo_ora_02: '09:00', cards_eos_ora_02: '10:00',
        cards_apo_ora_03: '', cards_eos_ora_03: '', cards_ores_ergasias: 0,
        apo_ora_02_apologistika: '09:00', eos_ora_02_apologistika: '10:00',
        updatedAt: new Date('2026-08-15T09:00:00.000Z'), is_locked: false,
        ...overrides
    };
}

function command(overrides = {}) {
    return { approve: true, transmission_failure_confirmed: true,
        intervals: [{ pairNumber: 1, start: '14:04', end: '22:04' }], ...overrides };
}

const raw = row();
const rawCards = Object.fromEntries(Object.entries(raw).filter(([field]) =>
    field.startsWith('cards_')));
const resolved = resolveZeroLengthCardResolution({ row: raw, command: command(),
    effectiveEmployee: { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 },
    actor: 'HR', now: new Date('2026-08-15T10:00:00.000Z') });
assert.equal(resolved.metadata.status, 'HR_APPROVED');
assert.equal(resolved.metadata.policy_version, POLICY_VERSION);
assert.equal(resolved.metadata.raw_cards_preserved, true);
assert.equal(resolved.approvedUpdates.kathgoria_ergasias_apologistika, 'ΕΡΓ');
assert.equal(resolved.approvedUpdates.apologistiko_biblio, true);
assert.equal(resolved.approvedUpdates.apo_ora_01_apologistika, '14:04');
assert.equal(resolved.approvedUpdates.eos_ora_01_apologistika, '22:04');
assert.equal(resolved.approvedUpdates.apo_ora_02_apologistika, undefined,
    'unrelated accounting pairs are preserved rather than rewritten');
assert.equal(resolved.netWorkMinutes, 510,
    'the shared break policy applies across the preserved and approved intervals');
assert.deepEqual(Object.fromEntries(Object.entries(raw).filter(([field]) =>
    field.startsWith('cards_'))), rawCards, 'raw card evidence remains byte-for-byte unchanged');
assert.equal(Object.keys(resolved.approvedUpdates).some((field) => field.startsWith('cards_')),
    false);

const overnight = resolveZeroLengthCardResolution({ row: row({
    cards_apo_ora_02: '', cards_eos_ora_02: '',
    apo_ora_02_apologistika: '', eos_ora_02_apologistika: ''
}), command: command({ intervals: [{ pairNumber: 1, start: '22:00', end: '06:00' }] }),
effectiveEmployee: {} });
assert.equal(overnight.netWorkMinutes, 480);

for (const [overrides, code] of [
    [{ approve: false }, 'ZERO_LENGTH_EXPLICIT_APPROVAL_REQUIRED'],
    [{ transmission_failure_confirmed: false },
        'ZERO_LENGTH_TRANSMISSION_FAILURE_CONFIRMATION_REQUIRED'],
    [{ intervals: [] }, 'ZERO_LENGTH_INTERVALS_REQUIRED'],
    [{ intervals: [{ pairNumber: 1, start: '14:04', end: '14:04' }] },
        'ZERO_LENGTH_REPLACEMENT_NOT_WORK'],
    [{ intervals: [{ pairNumber: 1, start: '14:04', end: '' }] },
        'ZERO_LENGTH_INTERVAL_INCOMPLETE'],
    [{ intervals: [{ pairNumber: 1, start: '', end: '22:04' }] },
        'ZERO_LENGTH_INTERVAL_INCOMPLETE'],
    [{ intervals: [{ pairNumber: 1, start: '25:00', end: '22:04' }] },
        'ZERO_LENGTH_INTERVAL_INCOMPLETE'],
    [{ intervals: [{ pairNumber: 1, start: '9:00', end: '22:04' }] },
        'ZERO_LENGTH_INTERVAL_INCOMPLETE'],
    [{ intervals: [{ pairNumber: 1, start: '14:04', end: '22:04',
        cards_eos_ora_01: '22:04' }] }, 'ZERO_LENGTH_INTERVAL_FIELDS_NOT_ALLOWED'],
    [{ intervals: [{ pairNumber: 2, start: '14:04', end: '22:04' }] },
        'ZERO_LENGTH_PAIR_SET_MISMATCH']
]) {
    assert.throws(() => resolveZeroLengthCardResolution({ row: row(),
        command: command(overrides) }), { code });
}
assert.throws(() => resolveZeroLengthCardResolution({ row: row({
    cards_eos_ora_01: '22:04' }), command: command() }),
{ code: 'ZERO_LENGTH_CARD_EVIDENCE_NOT_FOUND' });
assert.throws(() => resolveZeroLengthCardResolution({ row: row(), command: {
    ...command(), cards_apo_ora_01: '00:00' } }),
{ code: 'ZERO_LENGTH_RESOLUTION_FIELDS_NOT_ALLOWED' });

(async () => {
    let updateArgs; let auditArgs;
    const semanticUpdates = { ...resolved.approvedUpdates,
        zero_length_card_resolution: resolved.metadata };
    const result = await persistZeroLengthCardResolutionWrite({ oldRecord: raw,
        semanticUpdates, changedBy: 'HR', reason: 'Αποτυχία διαβίβασης',
        now: new Date('2026-08-15T10:00:00.000Z'), schemaPaths: Object.keys(raw), session: {},
        rowModel: { updateOne: async (...args) => { updateArgs = args;
            return { matchedCount: 1 }; } },
        auditModel: { create: async (...args) => { auditArgs = args; } } });
    assert.equal(result.updated, true);
    assert.equal(updateArgs[1].$set.cards_apo_ora_01, undefined);
    assert.equal(updateArgs[1].$set.cards_eos_ora_01, undefined);
    assert.equal(updateArgs[1].$set.cards_ores_ergasias, undefined);
    assert.equal(updateArgs[1].$set.is_locked, true);
    assert.equal(auditArgs[0][0].reason, 'Αποτυχία διαβίβασης');

    let replayWrites = 0;
    const replay = await persistZeroLengthCardResolutionWrite({
        oldRecord: { ...raw, ...result.finalUpdates }, semanticUpdates,
        changedBy: 'HR', reason: 'Αποτυχία διαβίβασης',
        now: new Date('2026-08-15T11:00:00.000Z'), schemaPaths: Object.keys(raw),
        session: {}, rowModel: { updateOne: async () => { replayWrites += 1;
            return { matchedCount: 1 }; } },
        auditModel: { create: async () => { replayWrites += 1; } }
    });
    assert.deepEqual(replay, { idempotent: true, updated: false });
    assert.equal(replayWrites, 0);
    await assert.rejects(() => persistZeroLengthCardResolutionWrite({
        oldRecord: { ...raw, is_locked: true }, semanticUpdates,
        changedBy: 'HR', reason: 'x', schemaPaths: Object.keys(raw), session: {},
        rowModel: { updateOne: async () => ({ matchedCount: 1 }) },
        auditModel: { create: async () => {} }
    }), { code: 'EMPLOYMENT_REVIEW_RECORD_LOCKED' });

    await assert.rejects(() => persistZeroLengthCardResolutionWrite({ oldRecord: raw,
        semanticUpdates, changedBy: 'HR', reason: 'x', schemaPaths: Object.keys(raw),
        session: {}, rowModel: { updateOne: async () => ({ matchedCount: 0 }) },
        auditModel: { create: async () => {} } }),
    { code: 'EMPLOYMENT_REVIEW_STALE_WRITE' });
    console.log('zero-length card resolution service tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
