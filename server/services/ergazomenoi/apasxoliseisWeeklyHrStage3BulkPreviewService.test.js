'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');
const { MAX_STAGE3_BULK_PREVIEW_ITEMS, normalizeStage3BulkPreviewCommand,
    buildWeeklyHrStage3BulkPreview } = require(
    './apasxoliseisWeeklyHrStage3BulkPreviewService'
);

const IDS = Array.from({ length: 110 }, () => new mongoose.Types.ObjectId().toString());
function makeContext({ index = 0, date = '2026-06-03', full = false, actual = false,
    residual = true, contextOnly = false, unknown = false, branch = '0000',
    stage3Version = 2, rowPatch = {} } = {}) {
    const employeeId = IDS[index * 2]; const rowId = IDS[index * 2 + 1];
    const stage1Fingerprint = 'b'.repeat(64);
    const context = { scope: { team: 'THA', company_kod: 'company', ypokatasthma: branch,
        employee_id: employeeId, employee_kodikos: String(index + 1).padStart(4, '0'),
        week_start: new Date('2026-06-01Z'), week_end: new Date('2026-06-07Z') },
    employee_name: `Εργαζόμενος ${index + 1}`,
    row: { _id: rowId, team: 'THA', company_kod: 'company', kodikos:
        String(index + 1).padStart(4, '0'), hmeromhnia: new Date(`${date}Z`),
    updatedAt: new Date('2026-06-10Z'), kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', ...rowPatch },
    dailyProfile: unknown ? {} : { kathestos_apasxolhshs: full ? '0' : '1' },
    actualFacts: { countsAsActualWorkDay: actual }, isResidual: residual,
    upstream: { stage1_current_fingerprint: stage1Fingerprint,
        stage1_effective_fingerprint: stage1Fingerprint, stage3_version: stage3Version },
    workflowState: { stage1: { status: 'COMPLETED',
        completion_fingerprint: stage1Fingerprint, effective_fingerprint: stage1Fingerprint,
        version: 1 }, stage3: { status: 'OPEN', version: stage3Version } } };
    const allowed = unknown ? [] : full ? ['LEAVE', 'SICKNESS', 'ABSENCE']
        : ['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK'];
    context.lifecycle = { employment_date_scope: {
        authoritative_date_set: contextOnly ? [] : [date],
        context_only_dates: contextOnly ? [date] : [] }, stages: { stage3: {
        pending_items: residual ? [{ row_id: rowId, date,
            allowed_classifications: allowed }] : [] } } };
    return context;
}
function itemFor(context, overrides = {}) {
    return { employee_id: String(context.scope.employee_id),
        employee_kodikos: context.scope.employee_kodikos,
        week_start: '2026-06-01', week_end: '2026-06-07',
        row_id: String(context.row._id), decision_date: '2026-06-03',
        expected_input_fingerprint: buildStage3InputFingerprint(context).fingerprint,
        expected_stage3_version: context.upstream.stage3_version, ...overrides };
}
function command(items, overrides = {}) {
    return { ypokatasthma: '0000', period_start: '2026-06-01', period_end: '2026-06-30',
        final_classification: 'LEAVE', leave_category: 'ΑΔΚΑΝ', items, ...overrides };
}
async function preview(contexts, input, options = {}) {
    const byId = new Map(contexts.map((context) => [String(context.row._id), context]));
    let loads = 0;
    const result = await buildWeeklyHrStage3BulkPreview({ command: input,
        requestScope: { team: 'THA', company_kod: 'company' },
        leaveCategoryLabel: 'ΑΔΚΑΝ - Κανονική άδεια',
        loadAuthoritativeContext: async (item) => { loads++; const value = byId.get(item.row_id);
            if (value instanceof Error) throw value; return value; }, ...options });
    return { result, loads };
}

(async () => {
    const first = makeContext(); const second = makeContext({ index: 1 });
    const valid = await preview([first, second], command([itemFor(first), itemFor(second)]));
    const authoritativeDates = normalizeStage3BulkPreviewCommand(command([itemFor(first)], {
        period_start: new Date('2026-06-01T00:00:00.000Z'),
        period_end: new Date('2026-06-30T00:00:00.000Z') }));
    assert.equal(authoritativeDates.period_start, '2026-06-01');
    assert.equal(authoritativeDates.period_end, '2026-06-30');
    assert.throws(() => normalizeStage3BulkPreviewCommand(command([itemFor(first)], {
        period_start: 'malformed' })), { code: 'INVALID_STAGE3_BULK_DATE' });
    assert.equal(valid.result.can_apply, true);
    assert.equal(valid.result.selected_count, 2);
    assert.equal(valid.result.employee_count, 2);
    assert.equal(valid.result.items.length, 2);
    assert.equal(valid.result.items[0].status, 'READY');
    assert.equal(valid.result.items[0].before, 'UNCLASSIFIED');
    assert.equal(valid.result.items[0].after, 'LEAVE');
    assert.deepEqual(valid.result.leave_category,
        { value: 'ΑΔΚΑΝ', label: 'ΑΔΚΑΝ - Κανονική άδεια' });
    assert.match(valid.result.preview_fingerprint, /^[a-f0-9]{64}$/);

    const stale = makeContext({ index: 2 });
    const staleItem = itemFor(stale, { expected_input_fingerprint: 'a'.repeat(64) });
    const staleResult = (await preview([stale], command([staleItem]))).result;
    assert.equal(staleResult.can_apply, false);
    assert.equal(staleResult.preview_fingerprint, '');
    assert.equal(staleResult.invalid_items[0].code, 'STAGE3_INPUT_CHANGED');
    assert.equal(staleResult.invalid_items[0].message,
        'Κάντε νέα Αναζήτηση και δοκιμάστε ξανά.');

    const decided = makeContext({ index: 3, residual: false });
    const contextOnly = makeContext({ index: 4, contextOnly: true });
    const multipleInvalid = (await preview([decided, contextOnly], command([
        itemFor(decided), itemFor(contextOnly)
    ]))).result;
    assert.equal(multipleInvalid.invalid_items.length, 2);
    assert.deepEqual(multipleInvalid.invalid_items.map((value) => value.code),
        ['STAGE3_DATE_NOT_RESIDUAL', 'STAGE3_DATE_OUTSIDE_ACTIVE_PERIOD']);

    const wrongScope = makeContext({ index: 5, branch: '0001' });
    assert.equal((await preview([wrongScope], command([itemFor(wrongScope)]))).result
        .invalid_items[0].code, 'STAGE3_ROW_SCOPE_MISMATCH');

    const actual = makeContext({ index: 6, actual: true });
    assert.equal((await preview([actual], command([itemFor(actual)]))).result
        .invalid_items[0].code, 'STAGE3_ACTUAL_WORK_PRESENT');
    const unknown = makeContext({ index: 7, unknown: true });
    assert.equal((await preview([unknown], command([itemFor(unknown)]))).result
        .invalid_items[0].code, 'STAGE3_DAILY_REGIME_UNKNOWN');

    const full = makeContext({ index: 8, full: true });
    const part = makeContext({ index: 9 });
    const mixed = (await preview([full, part], command([itemFor(full), itemFor(part)],
        { final_classification: 'NON_WORK', leave_category: '' }))).result;
    assert.equal(mixed.can_apply, false);
    assert.equal(mixed.invalid_items.length, 1);
    assert.equal(mixed.invalid_items[0].row_id, String(full.row._id));
    assert.equal(mixed.invalid_items[0].code, 'STAGE3_NON_WORK_NOT_ALLOWED_FOR_FULL_TIME');

    await assert.rejects(() => preview([first], command([itemFor(first)],
        { leave_category: '' })), { code: 'LEAVE_CATEGORY_REQUIRED' });
    await assert.rejects(() => preview([first], command([itemFor(first)],
        { leave_category: 'POSSIBLE_LEAVE' })), { code: 'POSSIBLE_LEAVE_NOT_HR_SELECTABLE' });
    await assert.rejects(() => preview([first], command([
        itemFor(first), itemFor(first)
    ])), { code: 'STAGE3_BULK_DUPLICATE_ITEM' });
    const invalidIdentifier = (await preview([first], command([
        { ...itemFor(first), row_id: 'bad' }
    ]))).result;
    assert.equal(invalidIdentifier.can_apply, false);
    assert.equal(invalidIdentifier.invalid_items[0].code, 'INVALID_STAGE3_BULK_ROW_ID');

    const oversized = Array.from({ length: MAX_STAGE3_BULK_PREVIEW_ITEMS + 1 }, (_, index) =>
        ({ ...itemFor(first), row_id: IDS[index] || new mongoose.Types.ObjectId().toString(),
            decision_date: `2026-06-${String((index % 7) + 1).padStart(2, '0')}` }));
    await assert.rejects(() => preview([first], command(oversized)),
        { code: 'STAGE3_BULK_LIMIT_EXCEEDED' });

    const normal = command([itemFor(first), itemFor(second)]);
    const reverse = command([itemFor(second), itemFor(first)]);
    const normalFingerprint = (await preview([first, second], normal)).result.preview_fingerprint;
    assert.equal((await preview([first, second], reverse)).result.preview_fingerprint,
        normalFingerprint);
    assert.notEqual((await preview([first, second], { ...normal,
        final_classification: 'SICKNESS', leave_category: '' })).result.preview_fingerprint,
    normalFingerprint);
    assert.notEqual((await preview([first, second], { ...normal,
        leave_category: 'ΑΔΑΝΕΥΑΠ' })).result.preview_fingerprint, normalFingerprint);

    const changed = makeContext({ rowPatch: { ores_ergasias: 7 } });
    assert.notEqual((await preview([changed, second], command([
        itemFor(changed), itemFor(second)
    ]))).result.preview_fingerprint, normalFingerprint);
    const changedVersion = makeContext({ stage3Version: 3 });
    assert.notEqual((await preview([changedVersion, second], command([
        itemFor(changedVersion), itemFor(second)
    ]))).result.preview_fingerprint, normalFingerprint);

    const source = fs.readFileSync(path.join(__dirname,
        'apasxoliseisWeeklyHrStage3BulkPreviewService.js'), 'utf8');
    assert.doesNotMatch(source, /writeCanonicalDailyClassification|runWithPeriodWriteFence|withTransaction/);
    assert.doesNotMatch(source, /\.(?:updateOne|updateMany|findOneAndUpdate|bulkWrite|create)\s*\(/);
    assert.equal(valid.loads, 2);
    console.log('weekly HR Stage-3 read-only bulk preview service tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
