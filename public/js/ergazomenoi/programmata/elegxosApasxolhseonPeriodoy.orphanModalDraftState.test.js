'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
    path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8'
);
const start = source.indexOf('function renderOrphanCardResolutionSection');
const end = source.indexOf('async function initializeOrphanResolutionPreview', start);

const elements = new Map();
let renderedSection = '';
const section = {};
Object.defineProperty(section, 'outerHTML', {
    set(value) { renderedSection = value; }
});
elements.set('orphanCardResolutionSection', section);
elements.set('edit_apo_ora_01_apologistika', { value: '10:09' });
elements.set('edit_eos_ora_01_apologistika', { value: '18:39' });
elements.set('orphanResolutionScope', { value: 'FUTURE_IDENTICAL' });

const preview = {
    orphanVisible: true,
    eligible: true,
    orphanType: 'START_ONLY',
    reuseScope: 'FUTURE_IDENTICAL',
    proposal: {
        start: '10:09',
        end: '18:39',
        durationHours: 8.5,
        workDurationHours: 8,
        manualIntervalMatchesRule: true
    },
    rest: { hasViolation: false, conflicts: [] }
};
const sandbox = {
    csrfToken: 'test-token',
    escapeHtml: (value) => String(value ?? ''),
    formatStage1DateKey: (value) => String(value).slice(0, 10),
    document: { getElementById: (id) => elements.get(id) || null },
    fetch: async () => ({
        ok: true,
        json: async () => ({ success: true, preview, derived_preview: null })
    })
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

const row = {
    _id: 'orphan-a',
    hmeromhnia: '2026-06-02',
    cards_apo_ora_01: '10:09',
    orphan_card_resolution_preview: preview
};
const otherRow = {
    ...row,
    _id: 'orphan-b'
};

(async () => {
    elements.set('orphanResolutionApprove', { checked: true });
    await sandbox.refreshOrphanResolutionPreview(row);
    assert.match(renderedSection, /id="orphanResolutionApprove"\s+checked/);

    elements.set('orphanResolutionApprove', { checked: false });
    await sandbox.refreshOrphanResolutionPreview(row);
    assert.doesNotMatch(renderedSection, /id="orphanResolutionApprove"\s+checked/);

    elements.delete('orphanResolutionApprove');
    sandbox.resetOrphanResolutionModalDraft(row);
    assert.doesNotMatch(
        sandbox.renderOrphanCardResolutionSection(sandbox.orphanResolutionPreviewRow(row)),
        /id="orphanResolutionApprove"\s+checked/
    );

    elements.set('orphanResolutionApprove', { checked: true });
    sandbox.captureOrphanResolutionModalDraft(row);
    assert.doesNotMatch(
        sandbox.renderOrphanCardResolutionSection(sandbox.orphanResolutionPreviewRow(otherRow)),
        /id="orphanResolutionApprove"\s+checked/
    );

    assert.match(source,
        /function showDetailsModal\(row\) \{\s*resetOrphanResolutionModalDraft\(row\);/);
    assert.match(source,
        /addEventListener\('hidden\.bs\.modal', \(\) => \{\s*resetOrphanResolutionModalDraft\(row\);/);
    console.log('orphan modal draft state tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
