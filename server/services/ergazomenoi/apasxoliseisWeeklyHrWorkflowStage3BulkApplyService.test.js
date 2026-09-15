'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');
const { buildWeeklyHrStage3BulkPreview } = require(
    './apasxoliseisWeeklyHrStage3BulkPreviewService'
);
const { applyWeeklyHrStage3Bulk, bulkCommandIdentity,
    bulkRequestPrefix, inspectStage3BulkIdempotency } = require(
    './apasxoliseisWeeklyHrWorkflowStage3BulkApplyService'
);
const WorkflowAuditModel = require('../../models/apasxoliseisWeeklyHrWorkflowAudit');

const actor = { user_id: new mongoose.Types.ObjectId().toString(),
    user_name: 'HR User', role: 'HR' };
const requestScope = { team: 'THA', company_kod: 'company' };
function digest(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function makeWeek({ employeeIndex = 1, week = '2026-06-01', dates = ['2026-06-03'],
    full = false, contextOnly = [], actual = [], unknown = [], resolved = [] } = {}) {
    const employeeId = new mongoose.Types.ObjectId().toString();
    const weekStart = week; const weekEnd = new Date(`${week}T00:00:00.000Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const weekEndKey = weekEnd.toISOString().slice(0, 10);
    const state = { stage1: { status: 'COMPLETED', completion_fingerprint: digest('completion'),
        effective_fingerprint: digest('completion'), version: 1 },
    stage3: { status: 'OPEN', version: 2 } };
    const contexts = dates.map((date, index) => {
        const rowId = new mongoose.Types.ObjectId().toString();
        const isResidual = !resolved.includes(date);
        return { scope: { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
            employee_id: employeeId, employee_kodikos: String(employeeIndex).padStart(4, '0'),
            week_start: new Date(`${weekStart}Z`), week_end: new Date(`${weekEndKey}Z`) },
        employee_name: `Εργαζόμενος ${employeeIndex}`,
        row: { _id: rowId, team: 'THA', company_kod: 'company',
            kodikos: String(employeeIndex).padStart(4, '0'), hmeromhnia: new Date(`${date}Z`),
            updatedAt: new Date('2026-06-10Z'), kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: 8, kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
        dailyProfile: unknown.includes(date) ? {} : { kathestos_apasxolhshs: full ? '0' : '1' },
        actualFacts: { countsAsActualWorkDay: actual.includes(date) }, isResidual,
        remaining_dates: dates.filter((candidate) => !resolved.includes(candidate)),
        upstream: { stage1_current_fingerprint: state.stage1.effective_fingerprint,
            stage1_effective_fingerprint: state.stage1.effective_fingerprint,
            stage1_completion_fingerprint: state.stage1.completion_fingerprint,
            stage1_version: state.stage1.version, stage2_fingerprint: digest('stage2'),
            stage3_version: state.stage3.version }, workflowState: state,
        lifecycle: { employment_date_scope: {
            authoritative_date_set: contextOnly.includes(date) ? [] : [date],
            context_only_dates: contextOnly.includes(date) ? [date] : [] },
        stages: { stage3: { pending_items: isResidual ? [{ row_id: rowId, date,
            allowed_classifications: full ? ['LEAVE', 'SICKNESS', 'ABSENCE']
                : ['LEAVE', 'SICKNESS', 'ABSENCE', 'NON_WORK'] }] : [] } } } };
    });
    return contexts;
}
function item(context) {
    return { employee_id: String(context.scope.employee_id),
        employee_kodikos: context.scope.employee_kodikos,
        week_start: context.scope.week_start.toISOString().slice(0, 10),
        week_end: context.scope.week_end.toISOString().slice(0, 10),
        row_id: String(context.row._id),
        decision_date: context.row.hmeromhnia.toISOString().slice(0, 10),
        expected_input_fingerprint: buildStage3InputFingerprint(context).fingerprint,
        expected_stage3_version: context.upstream.stage3_version };
}
function previewCommand(items, overrides = {}) {
    return { ypokatasthma: '0000', period_start: '2026-06-01', period_end: '2026-06-30',
        final_classification: 'LEAVE', leave_category: 'ΑΔΚΑΝ', items, ...overrides };
}
async function commandWithPreview(contexts, items, overrides = {}) {
    const byId = new Map(contexts.map((context) => [String(context.row._id), context]));
    const { bulk_request_id: bulkRequestId, reason_or_notes: reason, ...previewOverrides } = overrides;
    const base = previewCommand(items, previewOverrides);
    const preview = await buildWeeklyHrStage3BulkPreview({ command: base, requestScope,
        loadAuthoritativeContext: async (selected) => byId.get(selected.row_id) });
    assert.equal(preview.can_apply, true);
    return { ...base, bulk_request_id: bulkRequestId || 'stage3-bulk:test-0001',
        expected_preview_fingerprint: preview.preview_fingerprint,
        reason_or_notes: reason || 'Κοινή αιτιολογία' };
}
function harness(initialContexts, { failAt = 0, failureCode = 'WRITER_FAILED' } = {}) {
    let store = { contexts: structuredClone(initialContexts), workflowAudits: [],
        canonicalWrites: [], prodhlomenaAudits: [], workflowStateWrites: 0,
        resolveCalls: 0, loadsBeforeFirstWrite: 0, order: [] };
    const initialCount = initialContexts.length;
    const contextById = (rowId) => store.contexts.find((context) =>
        String(context.row._id) === String(rowId));
    const auditModel = { find: (filter) => ({ session() { return this; }, lean: async () => {
        const expression = new RegExp(filter.request_id.$regex);
        return store.workflowAudits.filter((audit) => expression.test(audit.request_id));
    } }) };
    const runAtomic = async (work) => {
        const snapshot = structuredClone(store);
        try { return await work({ session: {}, period_control_version: 4,
            period_write_fence_version: 9 }); }
        catch (error) { store = snapshot; throw error; }
    };
    const loadAuthoritativeContext = async (selected) => {
        if (store.resolveCalls === 0) store.loadsBeforeFirstWrite++;
        return contextById(selected.row_id);
    };
    const resolveOne = async ({ item: selected, command, current, request_id,
        command_identity, expected_input_fingerprint, expected_stage3_version }) => {
        store.resolveCalls++;
        store.order.push(selected.row_id);
        assert.equal(expected_input_fingerprint,
            buildStage3InputFingerprint(current).fingerprint);
        assert.equal(expected_stage3_version, current.upstream.stage3_version);
        store.canonicalWrites.push(selected.row_id);
        store.prodhlomenaAudits.push({ row_id: selected.row_id,
            leave_category: command.leave_category });
        if (failAt === store.resolveCalls) throw Object.assign(new Error(failureCode),
            { code: failureCode, statusCode: 409 });
        const sameWeek = store.contexts.filter((context) =>
            String(context.scope.employee_id) === selected.employee_id &&
            context.scope.week_start.toISOString().slice(0, 10) === selected.week_start);
        const target = contextById(selected.row_id);
        target.row.kathgoria_adeias_apologistika = command.leave_category;
        target.row.adeia_apologistika = command.final_classification === 'LEAVE';
        target.isResidual = false;
        const remaining = sameWeek.filter((context) => context.isResidual)
            .map((context) => context.row.hmeromhnia.toISOString().slice(0, 10));
        const nextVersion = current.upstream.stage3_version + 1;
        const nextStage1Version = current.workflowState.stage1.version + 1;
        const nextFingerprint = digest(`${current.upstream.stage1_current_fingerprint}|${selected.row_id}`);
        sameWeek.forEach((context) => {
            context.remaining_dates = remaining;
            context.workflowState.stage1.effective_fingerprint = nextFingerprint;
            context.workflowState.stage1.version = nextStage1Version;
            context.workflowState.stage3.version = nextVersion;
            context.workflowState.stage3.status = remaining.length ? 'OPEN' : 'COMPLETED';
            context.upstream.stage1_current_fingerprint = nextFingerprint;
            context.upstream.stage1_effective_fingerprint = nextFingerprint;
            context.upstream.stage1_version = nextStage1Version;
            context.upstream.stage3_version = nextVersion;
            context.lifecycle.stages.stage3.pending_items = context.isResidual
                ? context.lifecycle.stages.stage3.pending_items : [];
        });
        store.workflowStateWrites++;
        store.workflowAudits.push({ request_id, command_identity,
            stage_version: nextVersion,
            after_stage: { status: remaining.length ? 'OPEN' : 'COMPLETED' } });
        return { stage3_status: remaining.length ? 'OPEN' : 'COMPLETED',
            stage3_version: nextVersion, remaining_count: remaining.length };
    };
    return { get store() { return store; }, initialCount, auditModel, runAtomic,
        loadAuthoritativeContext, resolveOne };
}
async function apply(command, h) {
    return applyWeeklyHrStage3Bulk({ command, requestScope, actor,
        runAtomic: h.runAtomic, loadAuthoritativeContext: h.loadAuthoritativeContext,
        resolveOne: h.resolveOne, auditModel: h.auditModel });
}

(async () => {
    const sameWeekContexts = makeWeek({ dates: ['2026-06-03', '2026-06-04'] });
    const sameWeekItems = sameWeekContexts.map(item);
    const sameWeekCommand = await commandWithPreview(sameWeekContexts, sameWeekItems);
    const previousSanitizeFilter = mongoose.get('sanitizeFilter');
    try {
        mongoose.set('sanitizeFilter', true);
        const prefix = bulkRequestPrefix(sameWeekCommand.bulk_request_id);
        assert.match(prefix, /^stage3-bulk:[a-f0-9]{16}:$/);
        assert.equal(prefix, `stage3-bulk:${digest(sameWeekCommand.bulk_request_id).slice(0, 16)}:`);
        const oldQuery = WorkflowAuditModel.find({ request_id: { $regex: `^${prefix}` } });
        oldQuery._castConditions();
        assert.equal(oldQuery.error()?.name, 'CastError');

        const matchingId = `${prefix}${'a'.repeat(64)}`;
        const otherPrefix = bulkRequestPrefix('stage3-bulk:different-request');
        const otherId = `${otherPrefix}${'b'.repeat(64)}`;
        const fixture = [{ request_id: otherId }];
        const captured = [];
        const auditModel = { find(filter) {
            const query = WorkflowAuditModel.find(filter);
            query.lean = async () => {
                query._castConditions();
                if (query.error()) throw query.error();
                const condition = query.getFilter().request_id;
                captured.push(condition);
                return fixture.filter((audit) => new RegExp(condition.$regex).test(audit.request_id));
            };
            return query;
        } };
        const noPrior = await inspectStage3BulkIdempotency({ command: sameWeekCommand,
            requestScope, actor, auditModel });
        assert.equal(noPrior, null);
        assert.deepEqual(captured[0].$regex, `^${prefix}`);
        assert.equal(new RegExp(captured[0].$regex).test(matchingId), true);
        assert.equal(new RegExp(captured[0].$regex).test(otherId), false);
    } finally {
        mongoose.set('sanitizeFilter', previousSanitizeFilter);
    }
    const sameWeekHarness = harness(sameWeekContexts);
    const sameWeek = await apply(sameWeekCommand, sameWeekHarness);
    assert.equal(sameWeek.applied_count, 2);
    assert.equal(sameWeek.completed_week_count, 1);
    assert.equal(sameWeek.remaining_stage3_count, 0);
    assert.deepEqual(sameWeek.results.map((result) => result.stage3_version), [3, 4]);
    assert.equal(sameWeekHarness.store.workflowStateWrites, 2);
    assert.equal(new Set(sameWeekHarness.store.contexts.map((context) =>
        context.upstream.stage1_current_fingerprint)).size, 1);
    assert.equal(sameWeekHarness.store.contexts[0].workflowState.stage1.version, 3);
    assert.ok(sameWeekHarness.store.loadsBeforeFirstWrite >= sameWeekHarness.initialCount,
        'all items must be prevalidated before the first mutation');
    assert.equal(sameWeekHarness.store.canonicalWrites.length, 2);
    assert.equal(sameWeekHarness.store.prodhlomenaAudits.length, 2);
    assert.equal(sameWeekHarness.store.workflowAudits.length, 2);
    assert.equal(sameWeekHarness.store.prodhlomenaAudits[0].leave_category, 'ΑΔΚΑΝ');

    const openContexts = makeWeek({ employeeIndex: 9,
        dates: ['2026-06-02', '2026-06-03', '2026-06-04'] });
    const openItems = openContexts.slice(0, 2).map(item);
    const openCommand = await commandWithPreview(openContexts, openItems,
        { bulk_request_id: 'stage3-bulk:test-open' });
    const openHarness = harness(openContexts);
    const openResult = await apply(openCommand, openHarness);
    assert.equal(openResult.completed_week_count, 0);
    assert.equal(openResult.remaining_stage3_count, 1);
    assert.equal(openHarness.store.contexts[0].workflowState.stage3.status, 'OPEN');

    const retry = await apply(sameWeekCommand, sameWeekHarness);
    assert.equal(retry.idempotent, true);
    assert.equal(sameWeekHarness.store.canonicalWrites.length, 2);
    assert.equal(sameWeekHarness.store.workflowAudits.length, 2);
    const preflightRetry = await inspectStage3BulkIdempotency({ command: sameWeekCommand,
        requestScope, actor, auditModel: sameWeekHarness.auditModel });
    assert.equal(preflightRetry.idempotent, true);

    const changedCommand = { ...sameWeekCommand, leave_category: 'ΑΔΑΝΕΥΑΠ' };
    await assert.rejects(() => apply(changedCommand, sameWeekHarness),
        { code: 'STAGE3_BULK_REQUEST_ID_CONFLICT', applied_count: 0 });
    assert.notEqual(bulkCommandIdentity(sameWeekCommand, requestScope, actor),
        bulkCommandIdentity(changedCommand, requestScope, actor));

    const partialHarness = harness(sameWeekContexts);
    await apply(sameWeekCommand, partialHarness);
    partialHarness.store.workflowAudits.pop();
    await assert.rejects(() => apply(sameWeekCommand, partialHarness),
        { code: 'STAGE3_BULK_PARTIAL_IDEMPOTENCY_CONFLICT', applied_count: 0 });

    const weekA = makeWeek({ employeeIndex: 2, dates: ['2026-06-02'] });
    const weekB = makeWeek({ employeeIndex: 3, week: '2026-06-08', dates: ['2026-06-09'] });
    const multiContexts = [...weekA, ...weekB];
    const reversedItems = multiContexts.map(item).reverse();
    const multiCommand = await commandWithPreview(multiContexts, reversedItems,
        { bulk_request_id: 'stage3-bulk:test-0002' });
    const multiHarness = harness(multiContexts);
    const multi = await apply(multiCommand, multiHarness);
    assert.equal(multi.employee_count, 2);
    assert.equal(multi.completed_week_count, 2);
    assert.deepEqual(multiHarness.store.order, [...reversedItems].sort((a, b) =>
        `${a.employee_id}|${a.week_start}|${a.decision_date}|${a.row_id}`.localeCompare(
            `${b.employee_id}|${b.week_start}|${b.decision_date}|${b.row_id}`))
        .map((selected) => selected.row_id));

    for (const failureCode of ['WRITER_FAILED', 'PRODHLONENA_AUDIT_FAILED',
        'WORKFLOW_AUDIT_FAILED', 'STAGE3_VERSION_CONFLICT', 'DAILY_REVIEW_INPUT_CHANGED']) {
        const failureHarness = harness(sameWeekContexts, { failAt: 2, failureCode });
        await assert.rejects(() => apply(sameWeekCommand, failureHarness),
            { code: failureCode });
        assert.equal(failureHarness.store.canonicalWrites.length, 0);
        assert.equal(failureHarness.store.prodhlomenaAudits.length, 0);
        assert.equal(failureHarness.store.workflowAudits.length, 0);
        assert.equal(failureHarness.store.workflowStateWrites, 0);
    }

    const staleContexts = makeWeek({ employeeIndex: 4, dates: ['2026-06-03', '2026-06-04'] });
    const staleItems = staleContexts.map(item);
    const staleCommand = await commandWithPreview(staleContexts, staleItems,
        { bulk_request_id: 'stage3-bulk:test-0003' });
    staleContexts[1].row.ores_ergasias = 7;
    const staleHarness = harness(staleContexts);
    await assert.rejects(() => apply(staleCommand, staleHarness),
        { code: 'STAGE3_BULK_VALIDATION_FAILED', applied_count: 0 });
    assert.equal(staleHarness.store.canonicalWrites.length, 0);

    for (const invalidContexts of [
        makeWeek({ employeeIndex: 5, contextOnly: ['2026-06-03'] }),
        makeWeek({ employeeIndex: 6, resolved: ['2026-06-03'] }),
        makeWeek({ employeeIndex: 7, actual: ['2026-06-03'] }),
        makeWeek({ employeeIndex: 8, full: true })
    ]) {
        const invalidItems = invalidContexts.map(item);
        const base = previewCommand(invalidItems, invalidContexts[0].dailyProfile.kathestos_apasxolhshs === '0'
            ? { final_classification: 'NON_WORK', leave_category: '' } : {});
        const fakeFingerprint = digest('preview');
        const invalidCommand = { ...base, bulk_request_id: `stage3-bulk:invalid-${Math.random()}`,
            expected_preview_fingerprint: fakeFingerprint, reason_or_notes: 'Αιτιολογία' };
        const invalidHarness = harness(invalidContexts);
        await assert.rejects(() => apply(invalidCommand, invalidHarness),
            { code: 'STAGE3_BULK_VALIDATION_FAILED', applied_count: 0 });
        assert.equal(invalidHarness.store.canonicalWrites.length, 0);
    }

    const mismatchHarness = harness(sameWeekContexts);
    await assert.rejects(() => apply({ ...sameWeekCommand,
        expected_preview_fingerprint: digest('wrong') }, mismatchHarness),
    { code: 'STAGE3_BULK_PREVIEW_STALE', applied_count: 0 });
    assert.equal(mismatchHarness.store.canonicalWrites.length, 0);

    await assert.rejects(() => apply({ ...sameWeekCommand,
        items: [sameWeekCommand.items[0], sameWeekCommand.items[0]] }, harness(sameWeekContexts)),
    { code: 'STAGE3_BULK_DUPLICATE_ITEM' });
    await assert.rejects(() => apply({ ...sameWeekCommand,
        items: [{ ...sameWeekCommand.items[0], row_id: 'invalid' }] },
    harness(sameWeekContexts)), { code: 'INVALID_STAGE3_BULK_ROW_ID' });
    const oversized = Array.from({ length: 101 }, (_, index) => ({ ...sameWeekItems[0],
        row_id: new mongoose.Types.ObjectId().toString(),
        decision_date: `2026-06-${String((index % 7) + 1).padStart(2, '0')}` }));
    await assert.rejects(() => apply({ ...sameWeekCommand, items: oversized },
        harness(sameWeekContexts)), { code: 'STAGE3_BULK_LIMIT_EXCEEDED' });
    console.log('weekly HR Stage-3 atomic bulk apply tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
