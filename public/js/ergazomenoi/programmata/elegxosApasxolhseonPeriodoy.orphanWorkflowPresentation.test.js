'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function weeklyHrStage1BusinessStatus');
const end = source.indexOf('function weeklyHrStage1Counts', start);
const modalInputs = new Map([
    ['edit_ores_ergasias_apologistika', { type: 'number', value: '0.00' }],
    ['edit_ores_apoysias_apologistika', { type: 'number', value: '0.00' }],
    ['edit_ores_nyxtas_apologistika', { type: 'number', value: '0.00' }],
    ['edit_repo_apologistika', { type: 'checkbox', checked: true }],
    ['edit_kyriakes_apologistika', { type: 'checkbox', checked: false }]
]);
const sandbox = {
    currentReviewRows: [],
    escapeHtml: (value) => String(value ?? ''),
    formatStage1DateKey: (value) => String(value).slice(0, 10),
    document: { getElementById: (id) => modalInputs.get(id) || null }
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);
const modalStart = source.indexOf('function renderOrphanCardResolutionSection');
const modalEnd = source.indexOf('async function refreshOrphanResolutionPreview', modalStart);
vm.runInContext(source.slice(modalStart, modalEnd), sandbox);

const startRow = { _id: 'start', hmeromhnia: '2026-06-07', cards_apo_ora_01: '14:38',
    cards_eos_ora_01: '', orphan_card_resolution_preview: { orphanVisible: true,
        orphanType: 'START_ONLY', proposal: { start: '14:38', end: '23:08',
            durationSource: 'DECLARED_CONTINUOUS_DURATION', breakMinutes: 30,
            breakInsideSchedule: false } } };
const endRow = { _id: 'end', hmeromhnia: '2026-06-15', repo: true,
    cards_apo_ora_01: '', cards_eos_ora_01: '23:47',
    orphan_card_resolution_preview: { orphanVisible: true, orphanType: 'END_ONLY',
        proposal: { start: '15:17', end: '23:47', durationSource: 'EFFECTIVE_DAILY_AVERAGE',
            effectiveDailyAverageHours: 8, breakMinutes: 30, breakInsideSchedule: false } } };
const startHtml = sandbox.renderWeeklyHrOrphanItem(startRow);
const endHtml = sandbox.renderWeeklyHrOrphanItem(endRow);
assert.match(startHtml, /Μόνο είσοδος: 14:38/);
assert.match(startHtml, /14:38–23:08/);
assert.match(endHtml, /Μόνο έξοδος: 23:47/);
assert.match(endHtml, /Δηλωμένο ΡΕΠΟ/);
assert.match(endHtml, /Ημερομηνιακά ισχύων Μ\.Ο\./);
assert.match(endHtml, /15:17–23:47/);
assert.match(endHtml, /Επίλυση ορφανού χτυπήματος/);
assert.match(endHtml, /data-row-id="end"/);
assert.strictEqual(sandbox.weeklyHrHasOnlyOrphanBlockers({ workflow: {
    blocking_reasons: ['ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION'] } }), true);
assert.strictEqual(sandbox.weeklyHrHasOnlyOrphanBlockers({ workflow: {
    blocking_reasons: ['ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION',
        'INCOMPLETE_NATURAL_WEEK'] } }), false);
assert.match(source,
    /Χρήση και σε μελλοντικές όμοιες περιπτώσεις του ίδιου παραρτήματος/);
assert.match(source,
    /Η επιλογή αυτή μπορεί να εφαρμοστεί και σε άλλους εργαζομένους του ίδιου παραρτήματος, όταν πληρούνται οι ίδιοι κανόνες και οι έλεγχοι ασφαλείας\./);
assert.match(source,
    /futureIdenticalAvailable \? `<div class="small text-muted mt-1 orphan-future-identical-scope-help">/);
const reusableModalHtml = sandbox.renderOrphanCardResolutionSection({
    cards_eos_ora_01: '23:47', orphan_card_resolution_preview: {
        orphanVisible: true, eligible: true, orphanType: 'END_ONLY', reuseScope: 'ONE_TIME',
        proposal: { start: '15:17', end: '23:47', durationHours: 8.5,
            workDurationHours: 8, manualIntervalMatchesRule: true },
        rest: { hasViolation: false, conflicts: [] }
    }
});
assert.match(reusableModalHtml, /Μόνο για αυτή την περίπτωση/);
assert.match(reusableModalHtml,
    /Χρήση και σε μελλοντικές όμοιες περιπτώσεις του ίδιου παραρτήματος/);
assert.match(reusableModalHtml,
    /μπορεί να εφαρμοστεί και σε άλλους εργαζομένους του ίδιου παραρτήματος/);
assert.match(reusableModalHtml,
    /Εγκρίνω ρητά το απολογιστικό διάστημα για αυτή την περίπτωση ορφανού χτυπήματος\./);
assert.doesNotMatch(reusableModalHtml, /orphan περίπτωση/);
assert.doesNotMatch(reusableModalHtml, />START_ONLY<|>END_ONLY</);
const oneTimeOnlyModalHtml = sandbox.renderOrphanCardResolutionSection({
    cards_eos_ora_01: '23:47', orphan_card_resolution_preview: {
        orphanVisible: true, eligible: true, orphanType: 'END_ONLY', reuseScope: 'ONE_TIME',
        proposal: { start: '16:00', end: '23:47', durationHours: 7.78,
            workDurationHours: 7.28, manualIntervalMatchesRule: false },
        rest: { hasViolation: false, conflicts: [] }
    }
});
assert.match(oneTimeOnlyModalHtml, /value="FUTURE_IDENTICAL"[^>]*disabled/);
assert.doesNotMatch(oneTimeOnlyModalHtml, /orphan-future-identical-scope-help/);
const startModalHtml = sandbox.renderOrphanCardResolutionSection({
    cards_apo_ora_01: '14:38', orphan_card_resolution_preview: {
        orphanVisible: true, eligible: true, orphanType: 'START_ONLY', reuseScope: 'ONE_TIME',
        proposal: { start: '14:38', end: '23:08', durationHours: 8.5,
            workDurationHours: 8, manualIntervalMatchesRule: true },
        rest: { hasViolation: true, conflicts: ['PREVIOUS', 'NEXT'] }
    }
});
assert.match(startModalHtml, /<strong>Τύπος:<\/strong> Μόνο είσοδος/);
assert.doesNotMatch(startModalHtml, />START_ONLY<|>END_ONLY|PREVIOUS|NEXT/);
assert.match(startModalHtml, /ανεπαρκής ανάπαυση από την προηγούμενη εργασία/);
assert.match(startModalHtml, /ανεπαρκής ανάπαυση μέχρι την επόμενη εργασία/);
assert.doesNotMatch(source, />Flags</);
assert.match(source, /<div class="review-modal-section-title">Ενδείξεις<\/div>/);
assert.match(source, /preview\.orphanType === 'START_ONLY'/);
assert.match(source, /preview\.orphanType === 'END_ONLY'/);
assert.match(source, /value="ONE_TIME"/);
assert.match(source, /value="FUTURE_IDENTICAL"/);
const splitUnavailableHtml = sandbox.renderOrphanCardResolutionSection({
    hmeromhnia: '2026-06-14', cards_apo_ora_01: '08:15', cards_eos_ora_01: '',
    apo_ora_01: '08:00', eos_ora_01: '12:00',
    apo_ora_02: '16:00', eos_ora_02: '20:00',
    orphan_card_resolution_preview: { orphanVisible: true, eligible: false,
        orphanType: 'START_ONLY', reason: 'SPLIT_OR_INVALID_DECLARED_SCHEDULE' }
});
assert.match(splitUnavailableHtml, /Μόνο είσοδος/);
assert.match(splitUnavailableHtml, /08:00–12:00, 16:00–20:00/);
assert.match(splitUnavailableHtml,
    /Δεν είναι δυνατή ασφαλής αυτόματη πρόταση επειδή το προδηλωμένο ωράριο/);
assert.match(splitUnavailableHtml, /Συμπληρώστε το πραγματικό απολογιστικό διάστημα/);
const splitManualHtml = sandbox.renderOrphanCardResolutionSection({
    cards_apo_ora_01: '08:15', orphan_card_resolution_preview: {
        orphanVisible: true, eligible: true, orphanType: 'START_ONLY', reuseScope: 'ONE_TIME',
        proposal: { start: '08:15', end: '17:45', durationHours: 9.5,
            workDurationHours: 9, durationSource: 'HR_MANUAL_SPLIT_INTERVAL',
            scheduleKind: 'SPLIT', manualIntervalMatchesRule: false },
        rest: { hasViolation: false, conflicts: [] }
    }
});
assert.match(splitManualHtml, /Χειροκίνητο πραγματικό διάστημα σπαστού ωραρίου/);
assert.match(splitManualHtml, /value="FUTURE_IDENTICAL"[^>]*disabled/);
const rowBeforeDerivedPreview = structuredClone(endRow);
sandbox.applyOrphanDerivedPreview(endRow, { fields: {
    ores_ergasias_apologistika: 8,
    ores_apoysias_apologistika: 0,
    ores_nyxtas_apologistika: 1.78,
    repo_apologistika: false,
    kyriakes_apologistika: false,
    cards_apo_ora_01: '15:17',
    cards_eos_ora_01: '23:47'
} });
assert.strictEqual(modalInputs.get('edit_ores_ergasias_apologistika').value, '8.00');
assert.strictEqual(modalInputs.get('edit_ores_apoysias_apologistika').value, '0.00');
assert.strictEqual(modalInputs.get('edit_ores_nyxtas_apologistika').value, '1.78');
assert.strictEqual(modalInputs.get('edit_repo_apologistika').checked, false);
assert.strictEqual(modalInputs.get('edit_kyriakes_apologistika').checked, false);
assert.deepStrictEqual(endRow, rowBeforeDerivedPreview);
assert.strictEqual(sandbox.requiresExplicitOrphanResolutionApproval(
    { ...endRow, orphan_card_resolution_preview: {
        ...endRow.orphan_card_resolution_preview, eligible: true
    } }, { checked: false }
), true);
assert.strictEqual(sandbox.requiresExplicitOrphanResolutionApproval(
    { ...endRow, orphan_card_resolution_preview: {
        ...endRow.orphan_card_resolution_preview, eligible: true
    } }, { checked: true }
), false);
assert.strictEqual(sandbox.requiresExplicitOrphanResolutionApproval({
    ...endRow, orphan_card_resolution: { status: 'HR_APPROVED' },
    orphan_card_resolution_preview: {
        ...endRow.orphan_card_resolution_preview, eligible: true
    }
}, { checked: false }), false);
assert.strictEqual(sandbox.requiresExplicitOrphanResolutionApproval({
    ...endRow, orphan_card_resolution_preview: { orphanVisible: false }
}, { checked: false }), false);
assert.match(source, /orphanResolutionPreviewDrafts\.set\(row, draft\)/);
assert.match(source, /if \(requiresExplicitOrphanResolutionApproval\(row, orphanApprove\)\)/);
assert.match(source, /applyOrphanDerivedPreview\(row, draft\.orphan_derived_preview\)/);
assert.doesNotMatch(sandbox.applyOrphanDerivedPreview.toString(), /row\[field\]\s*=/);
assert.match(source, /await refreshOrphanResolutionPreview\(row\)/);
assert.doesNotMatch(sandbox.applyOrphanDerivedPreview.toString(),
    /end\s*-\s*start|timeToMinutes|convertTime/);

console.log('orphan weekly workflow presentation tests passed');
