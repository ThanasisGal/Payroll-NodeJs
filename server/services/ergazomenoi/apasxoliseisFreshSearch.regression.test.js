'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklyHrLifecycleProjection } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const profile = { typos_apasxolhshs: '0', typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 5,
    pososto_prosayxhshs_6hs_hmeras: 40, pragmatikoOromisthio: 10 };
function input() {
    const rows = Array.from({ length: 7 }, (_, i) => ({ _id: `synthetic-${i}`, hmeromhnia: `2026-09-${String(7+i).padStart(2,'0')}`,
        kathgoria_ergasias: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: i >= 5,
        kathgoria_ergasias_apologistika: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo_apologistika: i >= 5,
        ores_ergasias: i < 5 ? 8 : 0, ores_ergasias_apologistika: i < 5 ? 8 : 0,
        cards_ores_ergasias: i < 5 ? 8 : 0, cards_apo_ora_01: i < 5 ? '09:00' : '', cards_eos_ora_01: i < 5 ? '17:00' : '' }));
    return { weekRows: rows, effectiveProfile: profile,
        persistedStage1State: { status: 'COMPLETED', completion_fingerprint: 'a'.repeat(64), version: 2 } };
}
test('fresh read reevaluates obsolete attestation without rewriting persisted state', () => {
    const data = input(), before = structuredClone(data);
    const p = buildWeeklyHrLifecycleProjection(data);
    assert.equal(p.stages.stage1.persisted_status, 'STALE');
    assert.equal(p.stages.stage1.business_status, 'COMPLETED');
    assert.equal(p.requires_hr_action, false);
    assert.deepEqual(data, before);
});
test('fresh read exposes the actual pending day instead of obsolete-attestation dead end', () => {
    const data = input();
    Object.assign(data.weekRows[1], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
        kathgoria_ergasias_apologistika: '', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' });
    const p = buildWeeklyHrLifecycleProjection(data);
    assert.equal(p.stages.stage1.business_status, 'OPEN');
    assert.deepEqual(p.stages.stage1.pending_dates, ['2026-09-08']);
    assert.ok(p.stages.stage1.pending_reasons.includes('POSSIBLE_LEAVE_REQUIRES_HR_CLASSIFICATION'));
    assert.equal(p.stages.stage3.presentation_status, 'LOCKED');
});
test('fresh read retains real conflicts and their exact dates', () => {
    const data = input(); data.weekRows[1].ores_ergasias = -1;
    const p = buildWeeklyHrLifecycleProjection(data);
    assert.equal(p.stages.stage1.business_status, 'BLOCKED');
    assert.ok(p.stages.stage1.diagnostics.some(d => d.code === 'INVALID_DECLARED_HOURS' && d.dates.includes('2026-09-08')));
});
test('approved daily decisions survive fresh read and fingerprints still detect changed input', () => {
    const data = input();
    Object.assign(data.weekRows[1], { adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ',
        cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '', kathgoria_ergasias_apologistika: '' });
    const before = structuredClone(data);
    buildWeeklyHrLifecycleProjection(data);
    assert.deepEqual(data, before);
    const old = buildStage1Fingerprint(data.weekRows).fingerprint;
    data.weekRows[0].cards_eos_ora_01 = '18:00';
    assert.notEqual(buildStage1Fingerprint(data.weekRows).fingerprint, old);
});

test('fresh reevaluation does not weaken concurrent completion protection', async () => {
    const { completeWeeklyHrWorkflowStage1 } = require('./apasxoliseisWeeklyHrWorkflowStage1CompletionService');
    const data = input(), changed = structuredClone(data.weekRows);
    changed[0].cards_eos_ora_01 = '18:00';
    assert.equal(buildWeeklyHrLifecycleProjection(data).stages.stage1.business_status, 'COMPLETED');
    const writes = [];
    await assert.rejects(completeWeeklyHrWorkflowStage1({
        scope: { team: 'TEST', company_kod: 'synthetic', ypokatasthma: '0000',
            employee_id: '000000000000000000000001', employee_kodikos: '0001',
            week_start: '2026-09-07', week_end: '2026-09-13' },
        actor: { user_id: '000000000000000000000002', user_name: 'ΣΥΝΘΕΤΙΚΟΣ', role: 'HR' },
        weekRows: data.weekRows, workflow_context: { effectiveProfile: profile },
        reason_or_notes: 'Συνθετικός έλεγχος ταυτόχρονης αλλαγής', request_id: 'fresh-search-concurrent',
        transactionRunner: work => work({}), fenceWeeklyInput: async () => {},
        loadFreshWeekRows: async () => changed,
        auditModel: { findOne: () => null, create: (...args) => writes.push(args) },
        stateModel: { findOneAndUpdate: (...args) => writes.push(args) }
    }), error => error.code === 'STAGE1_INPUT_CHANGED');
    assert.deepEqual(writes, []);
});
test('stored-attestation guidance does not ask for a search loop; write conflicts retain freshness guidance', () => {
    const ui = require('../../../public/js/ergazomenoi/programmata/employmentReviewGuidanceUi');
    const issue = ui.issues({ lifecycle_projection: { stages: { stage1: {
        business_status: 'STALE', pending_dates: [], blockers: []
    } } } })[0];
    assert.match(issue.message, /προηγούμενη επιβεβαίωση/);
    assert.doesNotMatch(issue.steps.join(' '), /ξανά.*Αναζήτηση/);
    assert.match(ui.failureHtml({ code: 'STAGE1_INPUT_CHANGED' }), /Αναζήτηση/);
});
