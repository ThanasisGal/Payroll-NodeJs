'use strict';

const assert = require('assert/strict');
const {
    STAGE1_DERIVED_STATUS,
    buildStage1Fingerprint,
    resolveStage1Status,
    applicableStage1Fingerprint
} = require('./apasxoliseisStage1FingerprintService');

const dates = ['01', '02', '03', '04', '05', '06', '07'].map((day) => `2026-06-${day}`);

function row(date) {
    return {
        _id: `row-${date}`, hmeromhnia: date, kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8, apo_ora_01: '09:00', eos_ora_01: '17:00',
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_ores_ergasias: 8,
        repo: false, adeia: false, kathgoria_adeias: '', astheneia: false,
        kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false,
        adeia_apologistika: false, kathgoria_adeias_apologistika: '',
        astheneia_apologistika: false, ores_apoysias_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0, is_locked: false
    };
}

function possibleLeave(date = dates[1]) {
    return { ...row(date), cards_apo_ora_01: '', cards_eos_ora_01: '',
        cards_ores_ergasias: 0, kathgoria_ergasias_apologistika: '',
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' };
}

function week(replacement = possibleLeave()) {
    return dates.map((date) => date === replacement.hmeromhnia ? replacement : row(date));
}

const original = week();
const originalFingerprint = buildStage1Fingerprint(original).fingerprint;
const reorderedKeys = original.map((item) => Object.fromEntries(Object.entries(item).reverse()));
assert.equal(buildStage1Fingerprint(reorderedKeys).fingerprint, originalFingerprint);
assert.equal(buildStage1Fingerprint([...original].reverse()).fingerprint, originalFingerprint);

const actualWork = { ...possibleLeave(), cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '17:00', cards_ores_ergasias: 8,
    kathgoria_adeias_apologistika: '', kathgoria_ergasias_apologistika: 'ΕΡΓ' };
assert.notEqual(buildStage1Fingerprint(week(actualWork)).fingerprint, originalFingerprint);

const normalLeave = { ...possibleLeave(), adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' };
assert.notEqual(buildStage1Fingerprint(week(normalLeave)).fingerprint, originalFingerprint);

const sickness = { ...possibleLeave(), kathgoria_adeias_apologistika: '',
    astheneia_apologistika: true };
assert.notEqual(buildStage1Fingerprint(week(sickness)).fingerprint, originalFingerprint);
assert.notEqual(buildStage1Fingerprint(week({ ...possibleLeave(),
    ores_apoysias_apologistika: 8 })).fingerprint, originalFingerprint);
assert.notEqual(buildStage1Fingerprint(week({ ...possibleLeave(),
    apousia_apologistika: true })).fingerprint, originalFingerprint);
assert.notEqual(buildStage1Fingerprint(week({ ...possibleLeave(),
    hmeres_apoysias_apologistika: 1 })).fingerprint, originalFingerprint);
assert.notEqual(buildStage1Fingerprint(week({ ...possibleLeave(),
    kathestos_apasxolhshs_hmeras: '1' })).fingerprint, originalFingerprint);
assert.notEqual(buildStage1Fingerprint(week({ ...possibleLeave(),
    repo_apologistika: true })).fingerprint, originalFingerprint);
assert.notEqual(buildStage1Fingerprint(week({ ...possibleLeave(),
    is_locked: true })).fingerprint, originalFingerprint);
assert.equal(buildStage1Fingerprint(week({ ...possibleLeave(),
    display_label: 'UI only', employee_name: 'Display Name' })).fingerprint,
originalFingerprint);

const safeStartOnly = { ...possibleLeave(), cards_apo_ora_01: '09:00',
    cards_eos_ora_01: '', display_diagnostic: 'first rendering' };
const safeFingerprint = buildStage1Fingerprint(week(safeStartOnly)).fingerprint;
assert.equal(buildStage1Fingerprint(week({ ...safeStartOnly,
    display_diagnostic: 'second rendering' })).fingerprint, safeFingerprint);
assert.notEqual(buildStage1Fingerprint(week({ ...safeStartOnly,
    cards_apo_ora_01: '10:00' })).fingerprint, safeFingerprint);

const persisted = { status: 'COMPLETED', completion_fingerprint: originalFingerprint,
    completed_at: new Date('2026-08-14T10:00:00Z'), completed_by_user_name: 'HR' };
const snapshotBeforeResolution = JSON.stringify(persisted);
assert.equal(resolveStage1Status({ current_fingerprint: originalFingerprint }),
    STAGE1_DERIVED_STATUS.OPEN);
assert.equal(resolveStage1Status({ current_fingerprint: originalFingerprint,
    persisted_stage1_state: { status: 'OPEN' } }), STAGE1_DERIVED_STATUS.OPEN);
assert.equal(resolveStage1Status({ current_fingerprint: originalFingerprint,
    persisted_stage1_state: persisted }), STAGE1_DERIVED_STATUS.COMPLETED);
assert.equal(resolveStage1Status({ current_fingerprint: 'b'.repeat(64),
    persisted_stage1_state: persisted }), STAGE1_DERIVED_STATUS.STALE);
const successor = { ...persisted, effective_fingerprint: 'b'.repeat(64) };
assert.equal(applicableStage1Fingerprint(persisted), originalFingerprint);
assert.equal(applicableStage1Fingerprint(successor), 'b'.repeat(64));
assert.equal(resolveStage1Status({ current_fingerprint: 'b'.repeat(64),
    persisted_stage1_state: successor }), STAGE1_DERIVED_STATUS.COMPLETED);
assert.equal(resolveStage1Status({ current_fingerprint: 'c'.repeat(64),
    persisted_stage1_state: successor }), STAGE1_DERIVED_STATUS.STALE);
for (const canonicalStage2Row of [
    { ...possibleLeave(), apologistiko_biblio: true, repo_apologistika: false,
        kathgoria_ergasias_apologistika: 'ΜΕ',
        kathgoria_adeias_apologistika: '', apousia_apologistika: false },
    { ...possibleLeave(), apologistiko_biblio: true, repo_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΝ',
        kathgoria_adeias_apologistika: '', apousia_apologistika: false }
]) {
    const postStage2Fingerprint = buildStage1Fingerprint(week(canonicalStage2Row)).fingerprint;
    assert.equal(resolveStage1Status({ current_fingerprint: postStage2Fingerprint,
        persisted_stage1_state: { ...persisted,
            effective_fingerprint: postStage2Fingerprint } }),
    STAGE1_DERIVED_STATUS.COMPLETED);
}
assert.equal(JSON.stringify(persisted), snapshotBeforeResolution);

console.log('Stage-1 fingerprint/status tests passed');
