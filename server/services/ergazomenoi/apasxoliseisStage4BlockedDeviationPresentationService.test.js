'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { appendStage4BlockedDeviationRows } = require('./apasxoliseisStage4BlockedDeviationPresentationService');

const reason = 'MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE';
const projection = {
    scope: { employee_kodikos: '0013', week_start: '2026-05-25', week_end: '2026-05-31' },
    lifecycle_projection: { stages: { stage4: {
        business_status: 'BLOCKED', pending_count: 1,
        blockers: [reason], pending_reasons: [reason],
        final_weekly_analysis: { status: 'NEEDS_HR_DECISION', reasons: [reason],
            sixthDayIdentity: '2026-05-31', dailyFacts: [
                { hmeromhnia: '2026-05-25', countsAsActualWorkDay: true },
                { hmeromhnia: '2026-05-26', countsAsActualWorkDay: false },
                { hmeromhnia: '2026-05-27', countsAsActualWorkDay: true },
                { hmeromhnia: '2026-05-28', countsAsActualWorkDay: true },
                { hmeromhnia: '2026-05-29', countsAsActualWorkDay: true },
                { hmeromhnia: '2026-05-30', countsAsActualWorkDay: true },
                { hmeromhnia: '2026-05-31', countsAsActualWorkDay: true }
            ] }
    } } }
};
const reviewRows = [{ kodikos: '0013', hmeromhnia: new Date('2026-05-31T00:00:00Z'),
    effective_typos_apasxolhshs: 0, effective_weekly_workdays: 5,
    ypokatasthma: '0000' }];
const deviations = appendStage4BlockedDeviationRows({ deviations: [],
    canonicalLifecycleProjections: [projection], reviewRows });
assert.equal(deviations.length, 1);
assert.equal(deviations[0].kodikos, '0013');
assert.equal(deviations[0].week_apo, '2026-05-25');
assert.equal(deviations[0].week_eos, '2026-05-31');
assert.equal(deviations[0].actual_workdays, 6);
assert.equal(deviations[0].sixth_day_count, 1);
assert.deepEqual(deviations[0].sixth_seventh_day_reasons, [reason]);
assert.equal(deviations[0].requires_new_hr_decision, false);
assert.equal(appendStage4BlockedDeviationRows({ deviations,
    canonicalLifecycleProjections: [projection], reviewRows }).length, 1);

const source = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const lifecycleStart = source.indexOf('function weeklyLifecyclePayloadForDeviation');
const statusEnd = source.indexOf('function hasAdeiaSuggestion', lifecycleStart);
const lifecycleSource = source.slice(lifecycleStart, statusEnd);
const appendSource = source.slice(source.indexOf('function appendEmployeeDeviationRows'),
    source.indexOf('const canonicalApplicabilityLabels'));
const appended = [];
const sandbox = {
    currentCanonicalLifecyclePayloads: [projection], weeklyHrStage1Payloads: new Map(),
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    reviewHrReasonLabel: () => 'Το ημερομηνιακά ισχύον ποσοστό προσαύξησης 6ης ημέρας λείπει ή δεν είναι έγκυρο.',
    escapeHtml: (value) => String(value ?? ''),
    formatDate: (value) => String(value || ''),
    employmentTypeLabel: () => 'Πλήρης απασχόληση',
    renderWeeklySeventhDayValue: () => '0',
    renderDeviationNoteCell: () => '',
    canRecordCanonicalEmploymentDecision: () => false,
    document: { createElement: () => ({ classList: { add() {} }, dataset: {},
        innerHTML: '', querySelectorAll: () => [] }) }
};
vm.createContext(sandbox);
vm.runInContext(`${lifecycleSource}\n${appendSource}\nthis.appendRows = appendEmployeeDeviationRows;`, sandbox);
sandbox.appendRows({ appendChild: (element) => appended.push(element) }, deviations, '0013');
assert.equal(appended.length, 1);
const detailHtml = appended[0].innerHTML;
assert.equal((detailHtml.match(/data-employee-kodikos="0013"/g) || []).length, 1);
assert.match(detailHtml, /data-week-start="2026-05-25"/);
assert.match(detailHtml, /data-week-end="2026-05-31"/);
assert.match(detailHtml, /ΜΠΛΟΚΑΡΙΣΜΕΝΟ/);
assert.match(detailHtml, /ποσοστό προσαύξησης 6ης ημέρας λείπει/);

const filterSource = source.slice(source.indexOf('function filterGeneralReviewRows'),
    source.indexOf('function renderReviewNoPendingEmployees'));
vm.runInContext(`${filterSource}\nthis.filterRows = filterGeneralReviewRows;`, sandbox);
assert.equal(sandbox.filterRows(reviewRows, { lifecycleReady: false }).length, 0);
assert.equal(sandbox.filterRows(reviewRows, { lifecycleReady: true }).length, 1);
const searchSource = source.slice(source.indexOf('async function loadResults('),
    source.indexOf('function ', source.indexOf('async function loadResults(') + 20));
const projectionReadyAt = searchSource.indexOf('currentReviewLifecycleProjectionReady = Array.isArray(payload.canonicalLifecycleProjections)');
const firstRenderAt = searchSource.indexOf('currentReviewDeviations = payload.deviations || []');
assert.ok(projectionReadyAt > 0 && projectionReadyAt < firstRenderAt,
    'authoritative Search must release the row visibility gate before first render');

console.log('Stage4 blocked May detail row presentation tests passed');
