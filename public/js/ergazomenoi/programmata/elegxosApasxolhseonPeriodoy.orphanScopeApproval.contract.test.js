'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
    path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8'
);
const start = source.indexOf('async function refreshOrphanResolutionPreview');
const end = source.indexOf('async function initializeOrphanResolutionPreview', start);
assert.ok(start >= 0 && end > start, 'orphan preview refresh function must exist');

async function runRefresh({ approvalChecked, scope, preserveExplicitApproval }) {
    const elements = new Map([
        ['edit_apo_ora_01_apologistika', { value: '08:00' }],
        ['edit_eos_ora_01_apologistika', { value: '16:00' }],
        ['orphanResolutionScope', { value: scope }],
        ['orphanResolutionApprove', { checked: approvalChecked }]
    ]);
    const section = {};
    Object.defineProperty(section, 'outerHTML', {
        set() {
            elements.set('orphanResolutionApprove', { checked: false });
        }
    });
    elements.set('orphanCardResolutionSection', section);

    let requestBody = null;
    const sandbox = {
        csrfToken: 'test-token',
        document: { getElementById: (id) => elements.get(id) || null },
        fetch: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return { ok: true, json: async () => ({
                success: true,
                preview: { orphanVisible: true, eligible: true, reuseScope: scope },
                derived_preview: null
            }) };
        },
        orphanResolutionPreviewDrafts: new WeakMap(),
        orphanResolutionPreviewRow: (row) => row,
        applyOrphanDerivedPreview: () => {},
        renderOrphanCardResolutionSection: () => '<div></div>'
    };
    vm.createContext(sandbox);
    vm.runInContext(source.slice(start, end), sandbox);
    await sandbox.refreshOrphanResolutionPreview(
        { _id: 'row-1' }, { preserveExplicitApproval }
    );
    return {
        approvalChecked: elements.get('orphanResolutionApprove').checked,
        requestBody
    };
}

(async () => {
    let result = await runRefresh({
        approvalChecked: false, scope: 'FUTURE_IDENTICAL', preserveExplicitApproval: true
    });
    assert.strictEqual(result.approvalChecked, false);
    assert.strictEqual(result.requestBody.reuse_scope, 'FUTURE_IDENTICAL');

    result = await runRefresh({
        approvalChecked: true, scope: 'FUTURE_IDENTICAL', preserveExplicitApproval: true
    });
    assert.strictEqual(result.approvalChecked, true);
    assert.strictEqual(result.requestBody.reuse_scope, 'FUTURE_IDENTICAL');

    result = await runRefresh({
        approvalChecked: true, scope: 'ONE_TIME', preserveExplicitApproval: true
    });
    assert.strictEqual(result.approvalChecked, true);
    assert.strictEqual(result.requestBody.reuse_scope, 'ONE_TIME');

    result = await runRefresh({
        approvalChecked: true, scope: 'ONE_TIME', preserveExplicitApproval: false
    });
    assert.strictEqual(result.approvalChecked, false,
        'start/end refresh must require renewed explicit approval');

    assert.match(source,
        /event\?\.currentTarget\?\.id === 'orphanResolutionScope'/);
    assert.match(source,
        /await refreshOrphanResolutionPreview\(row, \{ preserveExplicitApproval \}\)/);
    assert.match(source,
        /reuse_scope: document\.getElementById\('orphanResolutionScope'\)\?\.value/);
    assert.match(source,
        /if \(requiresExplicitOrphanResolutionApproval\(row, orphanApprove\)\)/);
    assert.match(source,
        /title: 'Ρητή έγκριση ορφανού χτυπήματος'/);

    console.log('orphan scope explicit approval contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
