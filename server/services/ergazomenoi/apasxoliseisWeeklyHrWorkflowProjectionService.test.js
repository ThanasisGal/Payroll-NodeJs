'use strict';

const assert = require('assert/strict');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { deriveStoredStage1Decisions, buildWeeklyHrWorkflowProjection } = require(
    './apasxoliseisWeeklyHrWorkflowProjectionService'
);

const dates = ['01', '02', '03', '04', '05', '06', '07'].map((day) => `2026-06-${day}`);
function row(date) { return { _id: `row-${date}`, hmeromhnia: date,
    kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, apo_ora_01: '09:00', eos_ora_01: '17:00',
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_ores_ergasias: 8,
    kathgoria_ergasias_apologistika: 'ΕΡΓ', repo: false, repo_apologistika: false,
    adeia_apologistika: false, astheneia_apologistika: false,
    kathgoria_adeias_apologistika: '', ores_apoysias_apologistika: 0 }; }
function possible(date) { return { ...row(date), cards_apo_ora_01: '', cards_eos_ora_01: '',
    cards_ores_ergasias: 0, kathgoria_ergasias_apologistika: '',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }; }
const rows = dates.map(row);
rows[1] = possible(dates[1]);
rows[2] = { ...possible(dates[2]), adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' };
rows[3] = { ...possible(dates[3]), kathgoria_adeias_apologistika: '',
    astheneia_apologistika: true };
rows[4] = { ...possible(dates[4]), kathgoria_adeias_apologistika: '',
    ores_apoysias_apologistika: 8 };
const decisions = deriveStoredStage1Decisions(rows);
assert.deepEqual(decisions.confirmed_leave_dates, [dates[2]]);
assert.deepEqual(decisions.confirmed_sickness_dates, [dates[3]]);
assert.deepEqual(decisions.confirmed_absence_dates, []);
assert.deepEqual(deriveStoredStage1Decisions(rows.map((item) => item.hmeromhnia === dates[4]
    ? { ...item, apousia_apologistika: true } : item)).confirmed_absence_dates, [dates[4]]);
const profile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0' };
const fingerprint = buildStage1Fingerprint(rows).fingerprint;
const open = buildWeeklyHrWorkflowProjection({ weekRows: rows, effectiveProfile: profile });
assert.equal(open.stage1_status, 'OPEN');
assert.equal(open.workflow.leave_classification_completed, false);
const completed = buildWeeklyHrWorkflowProjection({ weekRows: rows, effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED', completion_fingerprint: fingerprint },
    indexState: { ready: true } });
assert.equal(completed.stage1_status, 'COMPLETED');
assert.equal(completed.workflow.leave_classification_completed, true);
assert.deepEqual(completed.workflow.confirmed_leave_days, [dates[2]]);
assert.deepEqual(completed.confirmed_absence_dates, []);
assert.ok(completed.workflow.unclassified_possible_leave_days.includes(dates[1]));
const stale = buildWeeklyHrWorkflowProjection({ weekRows: rows, effectiveProfile: profile,
    persistedStage1State: { status: 'COMPLETED', completion_fingerprint: 'a'.repeat(64) } });
assert.equal(stale.stage1_status, 'STALE');
assert.equal(stale.workflow.leave_classification_completed, false);
assert.equal(stale.write_enabled, false);
console.log('apasxoliseisWeeklyHrWorkflowProjectionService tests passed');
