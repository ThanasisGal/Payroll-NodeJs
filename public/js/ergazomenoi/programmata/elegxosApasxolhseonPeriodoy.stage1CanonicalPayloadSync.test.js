'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
function sourceFunction(name) {
    const match = source.match(new RegExp('(?:async )?function ' + name + '\\([\\s\\S]*?\\n}'));
    assert.ok(match, `${name} must exist`);
    return match[0];
}
function stage(status) {
    return { business_status: status, pending_count: status === 'BLOCKED' ? 1 : 0,
        pending_reasons: status === 'BLOCKED' ? ['REAL_BLOCKER'] : [], pending_dates: [] };
}
function payload({ index = 1, status = 'COMPLETED', branch = '0001',
    employeeId = `employee-${index}`, employeeCode = String(index).padStart(4, '0') } = {}) {
    return { scope: { ypokatasthma: branch, employee_id: employeeId,
        employee_kodikos: employeeCode, week_start: '2026-09-07', week_end: '2026-09-13' },
    lifecycle_projection: { stages: { stage1: stage(status), stage2: stage('COMPLETED'),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED') } } };
}
const plain = value => JSON.parse(JSON.stringify(value));
function harness(canonical, details) {
    const events = [];
    const container = { innerHTML: '', insertAdjacentHTML() { assert.fail('Unexpected detail read error'); } };
    const sandbox = {
        currentCanonicalLifecyclePayloads: canonical,
        currentReviewLoadGeneration: 1, currentReviewLifecycleProjectionReady: true,
        currentReviewDeviations: [],
        weeklyHrStage1Scopes: new Map(), weeklyHrStage1RowsById: new Map(), weeklyHrStage1Payloads: new Map(),
        weeklyHrStage1Selected: new Set(), weeklyHrStage1DaySelected: new Set(), weeklyHrStage1DayDrafts: new Map(),
        weeklyHrStage1LazyLoad: null,
        document: { getElementById: () => container },
        resetWeeklyHrStage1TooltipInteraction() {},
        buildWeeklyHrStage1Scopes: () => new Map(details.map(item => [item.scope.employee_id, item.scope])),
        loadWeeklyHrLeaveCategories: async () => {},
        fetchWeeklyHrStage1Bulk: async () => { events.push('read'); return details; },
        visibleWeeklyHrStage1Payloads: () => [...sandbox.weeklyHrStage1Payloads.values()],
        isWeeklyHrStage1Selectable: () => false, weeklyHrStage1DraftCount: () => 0,
        renderWeeklyHrStage1Presentation: () => events.push('details'),
        updateEmploymentReviewWorkflowPresentation: () => events.push('lifecycle'),
        renderWeeklyHrStage1Error: () => { assert.fail('Unexpected read error'); }, console
    };
    vm.createContext(sandbox);
    for (const name of ['weeklyHrStage1Key', 'canonicalLifecyclePayloadKey', 'stage1PayloadsForDisplay',
        'weeklyHrStage1BusinessStatus', 'weeklyHrStage1Counts', 'compareLifecyclePendingItems',
        'derivePeriodLifecyclePresentation', 'renderWeeklyHrStage1', 'prepareWeeklyHrStage1LazyLoad',
        'loadPreparedWeeklyHrStage1', 'refreshWeeklyHrStage1Scope']) vm.runInContext(sourceFunction(name), sandbox);
    return { sandbox, events, header: () => plain(sandbox.derivePeriodLifecyclePresentation(
        sandbox.currentCanonicalLifecyclePayloads)) };
}

test('Stage 1 details preserve Search authority, real blockers, stale states and unrelated branches', async () => {
    for (const status of ['BLOCKED', 'COMPLETED', 'STALE']) {
        const authoritative = payload({ status, employeeId: 'employee-main', employeeCode: '0014' });
        const unrelated = payload({ branch: '0002', employeeId: 'employee-other', employeeCode: '0014' });
        const detail = { ...payload({ status: status === 'COMPLETED' ? 'BLOCKED' : 'COMPLETED',
            employeeId: 'employee-main', employeeCode: '0099' }), rows: [{ _id: 'saved', hours: null }],
            write_enabled: false, diagnostics: [{ code: 'KEEP_DETAIL_DIAGNOSTIC' }] };
        const { sandbox: s, header } = harness([authoritative, unrelated], [detail]);
        const before = plain(s.currentCanonicalLifecyclePayloads), beforeHeader = header();
        await s.renderWeeklyHrStage1([]);
        const hydrated = s.weeklyHrStage1Payloads.get(s.weeklyHrStage1Key(detail.scope));
        assert.deepEqual(plain(s.currentCanonicalLifecyclePayloads), before);
        assert.deepEqual(header(), beforeHeader);
        assert.equal(header().stages.STAGE1.business_status, status);
        assert.equal(s.weeklyHrStage1BusinessStatus(hydrated), status);
        assert.strictEqual(hydrated.lifecycle_projection, authoritative.lifecycle_projection);
        assert.strictEqual(hydrated.rows, detail.rows);
        assert.equal(hydrated.write_enabled, false);
        assert.strictEqual(hydrated.diagnostics, detail.diagnostics);
        assert.equal(s.currentReviewLifecycleProjectionReady, true);
        assert.equal(s.weeklyHrStage1Counts()[status === 'BLOCKED' ? 'blocked' : status === 'STALE' ? 'stale' : 'completed'], 1);
    }
});

test('a successful write refreshes full Search before loading details or releasing stages', async () => {
    const old = payload({ status: 'BLOCKED' }), fresh = payload(), unrelated = payload({ branch: '0002' });
    const { sandbox: s, events, header } = harness([old, unrelated], [old]);
    s.loadResults = async () => {
        events.push('search'); s.currentReviewLoadGeneration++;
        s.currentCanonicalLifecyclePayloads = [fresh, unrelated];
        s.prepareWeeklyHrStage1LazyLoad([]); return true;
    };
    const hydrated = await s.refreshWeeklyHrStage1Scope(fresh.scope);
    assert.deepEqual(events, ['search', 'read', 'details', 'lifecycle']);
    assert.deepEqual(plain(s.currentCanonicalLifecyclePayloads), [fresh, unrelated]);
    assert.strictEqual(hydrated.lifecycle_projection, fresh.lifecycle_projection);
    assert.equal(header().stages.STAGE1.business_status, 'COMPLETED');
    assert.equal(s.weeklyHrStage1Counts().completed, 1);
});

test('a failed Search refresh cannot publish a locally completed stage', async () => {
    const old = payload({ status: 'BLOCKED' });
    const { sandbox: s, events, header } = harness([old], [payload()]);
    s.loadResults = async () => false;
    await assert.rejects(s.refreshWeeklyHrStage1Scope(old.scope), /αποθηκεύτηκε.*1\..*2\..*REVIEW-REFRESH/);
    assert.deepEqual(events, []);
    assert.deepEqual(plain(s.currentCanonicalLifecyclePayloads), [old]);
    assert.equal(header().stages.STAGE1.business_status, 'BLOCKED');
});

test('a delayed detail response cannot overwrite the next Search or its detail population', async () => {
    const old = payload(), fresh = payload({ status: 'BLOCKED', branch: '0002' });
    const { sandbox: s, events } = harness([old], [old]);
    let release, began;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { began = resolve; });
    s.fetchWeeklyHrStage1Bulk = async () => { began(); await gate; return [old]; };
    const loading = s.renderWeeklyHrStage1([]);
    await started;
    s.currentReviewLoadGeneration++;
    s.currentCanonicalLifecyclePayloads = [fresh];
    s.weeklyHrStage1Payloads.set('new-search', fresh);
    release(); await loading;
    assert.deepEqual(plain(s.currentCanonicalLifecyclePayloads), [fresh]);
    assert.deepEqual([...s.weeklyHrStage1Payloads.entries()], [['new-search', fresh]]);
    assert.deepEqual(events, []);
    assert.equal(s.currentReviewLifecycleProjectionReady, true);
});

test('15 completed and 3 deferred scopes retain all table counts and the deferred period state', async () => {
    const completed = Array.from({ length: 15 }, (_, index) => payload({ index: index + 1 }));
    const deferred = Array.from({ length: 3 }, (_, index) => payload({ index: index + 16,
        status: 'DEFERRED_TO_NEXT_PERIOD' }));
    const population = [...completed, ...deferred];
    const { sandbox: s, header } = harness(population, population);
    await s.renderWeeklyHrStage1([]);
    const counts = s.weeklyHrStage1Counts();
    assert.deepEqual(plain({ total: counts.total, completed: counts.completed, blocked: counts.blocked,
        open: counts.open, stale: counts.stale }), { total: 18, completed: 15, blocked: 0, open: 0, stale: 0 });
    assert.equal(header().stages.STAGE1.business_status, 'DEFERRED_TO_NEXT_PERIOD');
    assert.equal(header().stages.STAGE1.presentation_status, 'DEFERRED_TO_NEXT_PERIOD');
    assert.equal(header().requires_hr_action, false);
});
