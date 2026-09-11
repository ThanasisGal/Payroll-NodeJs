'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');

const defaultReason = 'Μετά από έλεγχο του προδηλωμένου ωραρίου, των πραγματικών στοιχείων απασχόλησης και του καθεστώτος μερικής/εκ περιτροπής απασχόλησης, η ημέρα χαρακτηρίζεται ως ΜΗ ΕΡΓΑΣΙΑ. Δεν προέκυψε άδεια, ασθένεια ή απουσία.';
assert.ok(source.includes(defaultReason));
assert.match(source, /input:\s*'textarea'/);
assert.match(source, /inputValue:\s*selection === 'NON_WORK'\s*\? STAGE3_NON_WORK_DEFAULT_REASON/);
assert.match(source, /inputValidator:[\s\S]*String\(value \|\| ''\)\.trim\(\)/);
assert.match(source, /weekly-hr-stage3-classification/);
assert.match(source, /weekly-hr-stage3-leave-category/);
assert.match(source, /weekly-hr-stage3-resolve/);
assert.match(source, /Γιατί απαιτείται απόφαση:/);
assert.match(source, /ΠΡΟΣ ΑΠΟΦΑΣΗ/);
assert.doesNotMatch(source.slice(source.indexOf('function renderWeeklyHrStage3'),
    source.indexOf('function updateEmploymentReviewWorkflowPresentation')),
    />REMAINING_POSSIBLE_LEAVE_REVIEW_REQUIRED</);
assert.match(source, /allowed_classifications/);
assert.match(source, /final_classification:\s*selection/);
assert.match(source, /expected_input_fingerprint:\s*item\.input_fingerprint/);
assert.match(source, /expected_stage3_version:\s*Number\(item\.expected_stage3_version \|\| 0\)/);
const submitStage3 = source.slice(source.indexOf('async function submitWeeklyHrStage3Decision'),
    source.indexOf('function updateEmploymentReviewWorkflowPresentation'));
assert.match(submitStage3, /await loadResults\(\)/);
assert.match(submitStage3, /focusWeeklyHrStage1StaleAfterStage3Save\(\)/);
assert.doesNotMatch(submitStage3, /refreshWeeklyHrStage1Scope/);

const focusSource = source.match(
    /function focusWeeklyHrStage1StaleAfterStage3Save\(\) \{[\s\S]*?\n}/
)?.[0] || '';
const selected = new Set(['hidden-open', 'stale-week']);
const filters = { open: true, stale: true, completed: true, blocked: true,
    leave: true, sickness: true, absence: true };
let pruned = 0;
let rendered = 0;
let opened = 0;
const focusSandbox = {
    stage1PayloadsForDisplay: () => [
        { lifecycle_projection: { stages: { stage1: { business_status: 'COMPLETED' } } } },
        { lifecycle_projection: { stages: { stage1: { business_status: 'STALE' } } } }
    ],
    weeklyHrStage1BusinessStatus: (payload) =>
        payload.lifecycle_projection.stages.stage1.business_status,
    stage1DisplayFilters: filters,
    weeklyHrStage1Selected: selected,
    pruneHiddenWeeklyHrStage1Selections: () => { pruned += 1; },
    renderWeeklyHrStage1Presentation: () => { rendered += 1; },
    document: { querySelector: () => ({}) },
    bootstrap: { Collapse: { getOrCreateInstance: () => ({ show: () => { opened += 1; } }) } }
};
vm.runInNewContext(`${focusSource}\nthis.focus = focusWeeklyHrStage1StaleAfterStage3Save;`,
    focusSandbox);
assert.equal(focusSandbox.focus(), 1);
assert.deepEqual(filters, { open: false, stale: true, completed: false, blocked: false,
    leave: false, sickness: false, absence: false });
assert.equal(selected.size, 0);
assert.equal(pruned, 1);
assert.equal(rendered, 1);
assert.equal(opened, 1);
assert.doesNotMatch(focusSource, /weeklyHrStage1Selected\.add|completeWeeklyHrStage1/);

const helperSource = source.slice(source.indexOf('function stage3WeekKey'),
    source.indexOf('function findStage3PendingItem'));
const sandbox = {
    currentCanonicalLifecyclePayloads: [],
    currentReviewOwnershipPeriod: () => ({ period_start: '2026-05-01', period_end: '2026-05-31' }),
    compareLifecyclePendingItems: (left, right) => left.date.localeCompare(right.date),
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    formatStage1DateKey: (value) => String(value || '').slice(0, 10).split('-').reverse().join('/'),
    enumerateStage1DateKeys: (start, end) => {
        const dates = [];
        for (const date = new Date(`${start}T00:00:00.000Z`); date.toISOString().slice(0, 10) <= end;
            date.setUTCDate(date.getUTCDate() + 1)) dates.push(date.toISOString().slice(0, 10));
        return dates;
    },
    escapeHtml: (value) => String(value ?? ''),
    formatPolicyPreviewHours: (value) => String(value),
    stage3ClassificationOptions: (item) => (item.allowed_classifications || [])
        .map((value) => `<option value="${value}">${value}</option>`).join(''),
    stage1LeaveCategoryOptions: () => '<option value="REGULAR">Κανονική</option>',
    document: { getElementById: () => sandbox.container },
    container: { innerHTML: '' }
};
vm.runInNewContext(`${helperSource}\nthis.helpers = { groupStage3PendingItems, renderWeeklyHrStage3 };`, sandbox);

function weekRows(start, pendingDates = []) {
    return sandbox.enumerateStage1DateKeys(start,
        new Date(new Date(`${start}T00:00:00.000Z`).getTime() + 6 * 86400000)
            .toISOString().slice(0, 10)).map((date, index) => ({
        _id: `row-${date}`, hmeromhnia: date, apo_ora_01: index < 5 ? '08:00' : '',
        eos_ora_01: index < 5 ? '16:00' : '', kathgoria_ergasias_apologistika: index < 5 ? 'ΕΡΓ' : 'ΑΝ',
        kathgoria_adeias_apologistika: pendingDates.includes(date) ? 'POSSIBLE_LEAVE' : '',
        repo_apologistika: index >= 5, ores_pragmatikhs_ergasias_apologistika: index < 5 ? 8 : 0
    }));
}

function payload(employee, start, end, pendingDates) {
    const rows = weekRows(start, pendingDates);
    return { scope: { employee_id: employee, employee_kodikos: employee, week_start: start,
        week_end: end, period_start: '2026-05-01', period_end: '2026-05-31' },
        employee_name: `Εργαζόμενος ${employee}`, rows,
        stage1_daily_presentation: rows.map((row) => ({ date: row.hmeromhnia,
            actual_work_hours: row.ores_pragmatikhs_ergasias_apologistika,
            current_apologistiko_classification: row.kathgoria_ergasias_apologistika })) };
}

function pending(employee, start, end, date) {
    return { employee_id: employee, employee_kodikos: employee, week_start: start, week_end: end,
        period_start: '2026-05-01', period_end: '2026-05-31', row_id: `row-${date}`, date,
        declared_hours: 8, actual_work_hours: 0,
        allowed_classifications: ['LEAVE', 'SICKNESS', 'ABSENCE'], input_fingerprint: 'f',
        expected_stage3_version: 0 };
}

const mayItems = [pending('0012', '2026-05-11', '2026-05-17', '2026-05-14')];
sandbox.currentCanonicalLifecyclePayloads.push(payload('0012', '2026-05-11', '2026-05-17', ['2026-05-14']));
sandbox.helpers.renderWeeklyHrStage3({ stages: { STAGE3: { pending_items: mayItems } } });
assert.equal((sandbox.container.innerHTML.match(/data-stage3-week-date=/g) || []).length, 7,
    'μία pending ημέρα αποδίδει ολόκληρη την εβδομάδα');
assert.match(sandbox.container.innerHTML, /data-stage3-week-date="2026-05-14"[\s\S]*ΠΡΟΣ ΑΠΟΦΑΣΗ/);

const sameWeek = [...mayItems, pending('0012', '2026-05-11', '2026-05-17', '2026-05-15')];
assert.equal(sandbox.helpers.groupStage3PendingItems(sameWeek, sandbox.currentCanonicalLifecyclePayloads).length, 1);
const otherWeek = pending('0012', '2026-05-18', '2026-05-24', '2026-05-19');
assert.equal(sandbox.helpers.groupStage3PendingItems([...sameWeek, otherWeek], []).length, 2);

const crossMonth = pending('0013', '2026-04-27', '2026-05-03', '2026-05-01');
sandbox.currentCanonicalLifecyclePayloads.push(payload('0013', '2026-04-27', '2026-05-03', ['2026-05-01']));
sandbox.helpers.renderWeeklyHrStage3({ stages: { STAGE3: { pending_items: [crossMonth] } } });
assert.equal((sandbox.container.innerHTML.match(/data-stage3-week-date=/g) || []).length, 7);
assert.equal((sandbox.container.innerHTML.match(/Άλλος μήνας — μόνο για πλαίσιο/g) || []).length, 4);
assert.equal((sandbox.container.innerHTML.match(/weekly-hr-stage3-classification/g) || []).length, 1,
    'οι ημέρες πλαισίου δεν αποκτούν χειριστήριο απόφασης');

const renderSection = source.slice(source.indexOf('function renderWeeklyHrStage3'),
    source.indexOf('function findStage3PendingItem'));
assert.doesNotMatch(renderSection, /fetch\(|axios|XMLHttpRequest/,
    'η παρουσίαση δεν προσθέτει HTTP N+1');
assert.match(source, /final_classification:\s*selection/);
assert.match(source, /body:\s*JSON\.stringify\(\{ ypokatasthma: item\.ypokatasthma/);
assert.match(source, /renderWeeklyHrStage2LifecycleFallback\(lifecycle\);[\s\S]*renderWeeklyHrStage3\(lifecycle\)/);
assert.match(source, /renderStage4|STAGE4/);
assert.match(source, /pending_count: entries\.reduce/);
console.log('Stage-3 weekly decision context and actionable UI contracts passed');
