'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function weeklyLifecyclePayloadForDeviation');
const end = source.indexOf('function hasAdeiaSuggestion', start);
const payloads = [];
const sandbox = {
    weeklyHrStage1Payloads: new Map(),
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    reviewHrReasonLabel: (reason) => ({
        ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION:
            'Υπάρχει ορφανό χτύπημα κάρτας που πρέπει να επιλυθεί πριν συνεχιστεί ο έλεγχος.'
    }[reason] || 'Απαιτείται έλεγχος της περίπτωσης.'),
    escapeHtml: (value) => String(value ?? '')
};
vm.createContext(sandbox);
vm.runInContext(`${source.slice(start, end)}
this.renderStatus = renderStage4StatusCell;
this.isVisible = isHrVisibleDeviation;`, sandbox);

function addStage4(kodikos, weekStart, stage4) {
    payloads.push({
        scope: { employee_kodikos: kodikos, week_start: weekStart,
            week_end: '2026-04-26' },
        lifecycle_projection: { stages: { stage4 } }
    });
    sandbox.weeklyHrStage1Payloads = new Map(payloads.map((payload, index) =>
        [String(index), payload]));
}

const blocked = { kodikos: '0012', week_apo: '2026-04-20', week_eos: '2026-04-26' };
addStage4('0012', '2026-04-20', { business_status: 'BLOCKED', pending_count: 1,
    blockers: [], pending_reasons: ['ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION'],
    final_weekly_analysis: { reasons: ['ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION'] } });
const blockedHtml = sandbox.renderStatus(blocked);
assert.match(blockedHtml, /text-bg-danger[^>]*>ΜΠΛΟΚΑΡΙΣΜΕΝΟ</);
assert.match(blockedHtml, /ορφανό χτύπημα κάρτας/);

const completed = { kodikos: '0013', week_apo: '2026-04-20', week_eos: '2026-04-26' };
addStage4('0013', '2026-04-20', { business_status: 'COMPLETED', pending_count: 0 });
assert.doesNotMatch(sandbox.renderStatus(completed), /ΜΠΛΟΚΑΡΙΣΜΕΝΟ/);

const secondBlocked = { kodikos: '0014', week_apo: '2026-04-20',
    week_eos: '2026-04-26' };
addStage4('0014', '2026-04-20', { business_status: 'BLOCKED', pending_count: 1,
    blockers: ['CARD_VERIFICATION_PENDING'] });
assert.match(sandbox.renderStatus(blocked), /ΜΠΛΟΚΑΡΙΣΜΕΝΟ/);
assert.match(sandbox.renderStatus(secondBlocked), /ΜΠΛΟΚΑΡΙΣΜΕΝΟ/);

const zeroPending = { kodikos: '0015', week_apo: '2026-04-20',
    week_eos: '2026-04-26', status: 'OPEN_WEEK_PENDING_COMPLETION' };
addStage4('0015', '2026-04-20', { business_status: 'BLOCKED', pending_count: 0,
    final_weekly_analysis: { reasons: ['CARD_VERIFICATION_PENDING'] } });
assert.equal(sandbox.isVisible(zeroPending), true);

const deviationRendererStart = source.indexOf('function appendEmployeeDeviationRows');
const deviationRendererEnd = source.indexOf('const canonicalApplicabilityLabels',
    deviationRendererStart);
const deviationRenderer = source.slice(deviationRendererStart, deviationRendererEnd);
const weeklyHeader = deviationRenderer.match(/<thead[\s\S]*?<tr>([\s\S]*?)<\/tr>/)?.[1] || '';
const weeklyRow = deviationRenderer.match(/data-week-end=[\s\S]*?<\/tr>/)?.[0] || '';
assert.equal((weeklyHeader.match(/<th(?:\s|>)/g) || []).length, 10);
assert.equal((weeklyRow.match(/<td(?:\s|>)/g) || []).length, 10);
assert.doesNotMatch(weeklyHeader, />Κατάσταση<\/th>/);
assert.match(weeklyHeader, />Πραγματικές ημέρες εργασίας<\/th>/);
assert.doesNotMatch(deviationRenderer, /weekly-deviation-status-column/);
assert.doesNotMatch(deviationRenderer, /class="weekly-deviation-status"/);
assert.match(deviationRenderer,
    /class="weekly-deviation-comment">\$\{renderStage4StatusCell\(dev\)\}\$\{renderDeviationNoteCell\(dev\)\}/);

console.log('Stage 4 per-row blocked status presentation tests passed');
