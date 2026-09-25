'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    AUDIT_CONTEXT,
    evaluateRow,
    sourceSnapshot,
    buildRepairPreview,
    applyRepairBatch
} = require('./apasxoliseisLegacyNoWorkSemanticRepairService');

const baseRow = (overrides = {}) => ({
    _id: '6ab5fe6f0ce78948c888b62b', team: 'THA', company_kod: 'C1',
    ypokatasthma: '0000', kodikos: '0001',
    hmeromhnia: new Date('2026-08-23T00:00:00.000Z'),
    kathgoria_ergasias: 'ΜΕ', repo: false, ores_ergasias: 0,
    apo_ora_01: '', eos_ora_01: '', apo_ora_02: '', eos_ora_02: '',
    apo_ora_03: '', eos_ora_03: '', apologistiko_biblio: false,
    kathgoria_ergasias_apologistika: null, repo_apologistika: true,
    adeia: false, hr_declared_leave: false, kathgoria_adeias: '',
    adeia_apologistika: false, kathgoria_adeias_apologistika: '',
    astheneia: false, astheneia_apologistika: false, apousia_apologistika: false,
    argia: false, argia_apologistika: false, cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', cards_apo_ora_02: '',
    cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '',
    orphan_card_resolution: null, ores_ergasias_apologistika: 0,
    ores_pragmatikhs_ergasias_apologistika: 0, is_locked: false,
    locked_by: '', locked_at: null, updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides
});
const profile = (employment, system, days, overrides = {}) => ({
    kathestos_apasxolhshs: employment, typos_apasxolhshs: employment,
    typos_ebdomadas: system, hmeres_ergasias_ebdomadas: days, ...overrides
});

for (const [name, workTerms, classification, ergani] of [
    ['PART_TIME 6/6', profile('1', '6ΗΜΕΡΗ', 6), 'REST_REPO', 'ΑΝ'],
    ['PART_TIME 6/5', profile('1', '6ΗΜΕΡΗ', 5), 'NON_WORK', 'ΜΕ'],
    ['PART_TIME 5/5', profile('1', '5ΗΜΕΡΗ', 5), 'REST_REPO', 'ΑΝ'],
    ['PART_TIME 5/4', profile('1', '5ΗΜΕΡΗ', 4), 'NON_WORK', 'ΜΕ'],
    ['ROTATIONAL', profile('2', '5ΗΜΕΡΗ', 4), 'NON_WORK', 'ΜΕ'],
    ['FULL_TIME', profile('0', '5ΗΜΕΡΗ', 5), 'REST_REPO', 'ΑΝ']
]) test(`${name} resolves through the production semantic`, () => {
    const result = evaluateRow({ row: baseRow(), effectiveProfile: workTerms });
    assert.equal(result.status, 'REPAIRABLE');
    assert.equal(result.semantic.classification, classification);
    assert.equal(result.semantic.ergani_code, ergani);
    assert.equal(result.proposed.apologistiko_biblio, true);
    assert.equal(result.proposed.kathgoria_ergasias_apologistika, ergani);
    assert.equal(result.proposed.repo_apologistika, classification === 'REST_REPO');
    assert.equal(result.proposed.ores_ergasias_apologistika, 0);
});

test('unknown semantic is excluded', () => {
    const result = evaluateRow({ row: baseRow(), effectiveProfile: profile('1', '', 0) });
    assert.equal(result.status, 'EXCLUDED');
    assert.ok(result.exclusionReasons.some(reason => reason.startsWith('SEMANTIC_')));
});

for (const [name, changes, reason] of [
    ['cards', { cards_ores_ergasias: 1, cards_apo_ora_01: '08:00',
        cards_eos_ora_01: '09:00' }, 'CARD_WORK_PRESENT'],
    ['orphan card', { cards_apo_ora_01: '08:00' }, 'UNRESOLVED_OR_ORPHAN_CARD_EVIDENCE'],
    ['actual work', { ores_pragmatikhs_ergasias_apologistika: 1 }, 'ACTUAL_WORK_PRESENT'],
    ['confirmed leave', { adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }, 'LEAVE_PRESENT'],
    ['sickness', { astheneia_apologistika: true }, 'SICKNESS_PRESENT'],
    ['absence', { apousia_apologistika: true }, 'ABSENCE_PRESENT'],
    ['holiday', { argia_apologistika: true }, 'HOLIDAY_PRESENT'],
    ['apologistiko interval', { apo_ora_01_apologistika: '08:00',
        eos_ora_01_apologistika: '09:00' }, 'APOLOGISTIKO_INTERVAL_PRESENT'],
    ['positive overtime', { ores_yperergasias_apologistika: 1 },
        'POSITIVE_ACTIVITY_CLASSIFICATION_PRESENT'],
    ['locked row', { is_locked: true }, 'LOCKED_LEGACY_ROW']
]) test(`${name} is excluded`, () => {
    const result = evaluateRow({ row: baseRow(changes),
        effectiveProfile: profile('1', '6ΗΜΕΡΗ', 6) });
    assert.equal(result.status, 'EXCLUDED');
    assert.ok(result.exclusionReasons.includes(reason));
});

test('applied atomic transfer identity is excluded', () => {
    const result = evaluateRow({ row: baseRow(),
        effectiveProfile: profile('1', '6ΗΜΕΡΗ', 6), appliedRepoTransfer: true });
    assert.equal(result.status, 'EXCLUDED');
    assert.ok(result.exclusionReasons.includes('APPLIED_REPO_TRANSFER_IDENTITY'));
});

test('prior classification audit is excluded', () => {
    const result = evaluateRow({ row: baseRow(),
        effectiveProfile: profile('1', '6ΗΜΕΡΗ', 6), manualClassificationAudit: true });
    assert.equal(result.status, 'EXCLUDED');
    assert.ok(result.exclusionReasons.includes('MANUAL_OR_PRIOR_CLASSIFICATION_AUDIT'));
});

for (const [name, row] of [
    ['canonical ΑΝ', baseRow({ apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true })],
    ['canonical ΜΕ', baseRow({ apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΜΕ', repo_apologistika: false })]
]) test(`${name} is already canonical`, () => {
    const result = evaluateRow({ row, effectiveProfile: profile('1', '6ΗΜΕΡΗ', 6) });
    assert.equal(result.status, 'ALREADY_CANONICAL');
    assert.equal(result.proposed, null);
});

function harness({ matchedCount = 1 } = {}) {
    const row = baseRow();
    const evaluation = evaluateRow({ row, effectiveProfile: profile('1', '6ΗΜΕΡΗ', 6) });
    const updates = []; const audits = [];
    const rowModel = { async updateOne(filter, update, options) {
        updates.push({ filter, update, options }); return { matchedCount };
    } };
    const auditModel = { async create(documents, options) {
        audits.push({ documents, options });
    } };
    const session = { async withTransaction(work) { await work(); }, async endSession() {} };
    const connection = { async startSession() { return session; } };
    const preview = { preview_fingerprint: 'a'.repeat(64), repairable_count: 1,
        _repairable: [{ row, source: sourceSnapshot(row), proposed: evaluation.proposed }] };
    return { row, updates, audits, rowModel, auditModel, connection,
        previewBuilder: async () => preview };
}

test('apply uses CAS, preserves declared/card fields and audits exactly once', async () => {
    const h = harness();
    const result = await applyRepairBatch({ scope: {}, previewFingerprint: 'a'.repeat(64),
        confirmed: true, reason: 'controlled test', changedBy: 'operator',
        rowModel: h.rowModel, auditModel: h.auditModel, connection: h.connection,
        previewBuilder: h.previewBuilder });
    assert.equal(result.repaired_count, 1);
    assert.equal(h.updates.length, 1); assert.equal(h.audits.length, 1);
    const set = h.updates[0].update.$set;
    assert.equal(set.kathgoria_ergasias_apologistika, 'ΑΝ');
    assert.equal(set.is_locked, true); assert.equal(set.locked_by, 'operator');
    for (const field of ['kathgoria_ergasias', 'repo', 'ores_ergasias',
        'cards_apo_ora_01', 'cards_eos_ora_01',
        'ores_pragmatikhs_ergasias_apologistika',
        'ores_prostheths_ergasias_apologistika', 'ores_yperergasias_apologistika']) {
        assert.equal(Object.hasOwn(set, field), false, field);
    }
    assert.equal(h.audits[0].documents.length, 1);
    assert.match(h.audits[0].documents[0].reason, new RegExp(`^${AUDIT_CONTEXT}:`));
    assert.equal(h.audits[0].documents[0].changedBy, 'operator');
});

test('row changed after preview is stale and is not audited', async () => {
    const h = harness({ matchedCount: 0 });
    const result = await applyRepairBatch({ scope: {}, previewFingerprint: 'a'.repeat(64),
        confirmed: true, reason: 'controlled test', changedBy: 'operator',
        rowModel: h.rowModel, auditModel: h.auditModel, connection: h.connection,
        previewBuilder: h.previewBuilder });
    assert.equal(result.repaired_count, 0); assert.equal(result.stale_count, 1);
    assert.equal(h.audits.length, 0);
});

test('changed preview fingerprint stops before row writes', async () => {
    const h = harness();
    await assert.rejects(() => applyRepairBatch({ scope: {},
        previewFingerprint: 'b'.repeat(64), confirmed: true, reason: 'x',
        changedBy: 'operator', rowModel: h.rowModel, auditModel: h.auditModel,
        connection: h.connection, previewBuilder: h.previewBuilder }),
    { code: 'STALE_PREVIEW' });
    assert.equal(h.updates.length, 0); assert.equal(h.audits.length, 0);
});

test('normalized row is idempotently already canonical', () => {
    const first = evaluateRow({ row: baseRow(),
        effectiveProfile: profile('1', '6ΗΜΕΡΗ', 6) });
    const normalized = { ...baseRow(), ...first.proposed, is_locked: true };
    const second = evaluateRow({ row: normalized,
        effectiveProfile: profile('1', '6ΗΜΕΡΗ', 6) });
    assert.equal(second.status, 'ALREADY_CANONICAL');
    assert.equal(second.proposed, null);
});

function rowsQuery(rows) {
    return { select() { return this; }, sort() { return this; }, async lean() { return rows; } };
}

test('second preview has zero repairable rows and no Mongo IDs in public rows', async () => {
    const workTerms = profile('1', '6ΗΜΕΡΗ', 6);
    const initial = baseRow();
    const previewFor = (rows) => buildRepairPreview({
        scope: { team: 'THA', company_kod: 'C1', ypokatasthma: '0000',
            period_start: '2026-08-01', period_end: '2026-08-31' },
        rowModel: { find() { return rowsQuery(rows); } },
        profileLoader: async () => new Map(rows.map(row => [String(row._id), workTerms])),
        protectionLoader: async () => ({ entriesByRowId: {} }),
        auditModel: { find() { return { select() { return this; }, async lean() { return []; } }; } }
    });
    const first = await previewFor([initial]);
    assert.equal(first.repairable_count, 1);
    assert.equal(Object.hasOwn(first.rows[0], '_id'), false);
    const normalized = { ...initial, ...first._repairable[0].proposed,
        is_locked: true, locked_by: 'operator', locked_at: new Date() };
    const second = await previewFor([normalized]);
    assert.equal(second.repairable_count, 0);
    assert.equal(second.already_canonical_count, 1);
});
