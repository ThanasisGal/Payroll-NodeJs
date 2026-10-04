'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');

function sourceFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must exist`);
    const bodyStart = source.indexOf(') {', start) + 2;
    assert.ok(bodyStart > start, `${name} body must exist`);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Could not extract ${name}`);
}

function stage(status) {
    return { business_status: status, pending_count: status === 'BLOCKED' ? 1 : 0,
        pending_reasons: status === 'BLOCKED' ? ['OLD_BLOCKER'] : [], pending_dates: [] };
}

function payload({ index = 1, status = 'COMPLETED', branch = '0001',
    employeeId = `employee-${index}`, employeeCode = String(index).padStart(4, '0'),
    weekStart = '2026-09-07', weekEnd = '2026-09-13' } = {}) {
    return { scope: { ypokatasthma: branch, employee_id: employeeId,
        employee_kodikos: employeeCode, week_start: weekStart, week_end: weekEnd },
    lifecycle_projection: { stages: { stage1: stage(status), stage2: stage('COMPLETED'),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED') } } };
}

const weeklyHrStage1Payloads = new Map();
const sandbox = {
    weeklyHrStage1Payloads,
    weeklyHrStage1Selected: new Set(),
    weeklyHrStage1DaySelected: new Set(),
    weeklyHrStage1DayDrafts: new Map(),
    visibleWeeklyHrStage1Payloads: () => [...weeklyHrStage1Payloads.values()],
    weeklyHrStage1Key: (scope) => [scope.ypokatasthma, scope.employee_id,
        scope.week_start].join('|'),
    isWeeklyHrStage1Selectable: () => false,
    weeklyHrStage1DraftCount: () => 0
};
vm.createContext(sandbox);
vm.runInContext(`
let currentCanonicalLifecyclePayloads = [];
${sourceFunction('canonicalLifecyclePayloadKey')}
${sourceFunction('replaceCanonicalLifecyclePayload')}
${sourceFunction('stage1PayloadsForDisplay')}
${sourceFunction('weeklyHrStage1BusinessStatus')}
${sourceFunction('weeklyHrStage1Counts')}
${sourceFunction('compareLifecyclePendingItems')}
${sourceFunction('derivePeriodLifecyclePresentation')}
this.api = {
    replaceCanonicalLifecyclePayload,
    weeklyHrStage1Counts,
    derivePeriodLifecyclePresentation,
    setCanonical(payloads) { currentCanonicalLifecyclePayloads = payloads; },
    canonical() { return currentCanonicalLifecyclePayloads; },
    header() { return derivePeriodLifecyclePresentation(currentCanonicalLifecyclePayloads); }
};`, sandbox);

const oldBlocked = payload({ status: 'BLOCKED', employeeId: 'employee-main',
    employeeCode: '0014' });
const unrelated = payload({ status: 'COMPLETED', branch: '0002',
    employeeId: 'employee-other', employeeCode: '0014' });
const freshCompleted = payload({ status: 'COMPLETED', employeeId: 'employee-main',
    employeeCode: '0099' });
sandbox.api.setCanonical([oldBlocked, unrelated]);
weeklyHrStage1Payloads.set('fresh', freshCompleted);

const tableBeforeSync = sandbox.api.weeklyHrStage1Counts();
assert.equal(tableBeforeSync.completed, 1);
assert.equal(tableBeforeSync.blocked, 0);
assert.equal(sandbox.api.header().stages.STAGE1.business_status, 'BLOCKED');

sandbox.api.replaceCanonicalLifecyclePayload(freshCompleted);
const canonicalAfterSync = sandbox.api.canonical();
assert.equal(canonicalAfterSync.length, 2, 'an unrelated employee/branch must remain');
assert.ok(canonicalAfterSync.includes(unrelated));
assert.equal(canonicalAfterSync.includes(oldBlocked), false);
assert.equal(sandbox.api.header().stages.STAGE1.business_status, 'COMPLETED');
assert.equal(sandbox.api.weeklyHrStage1Counts().completed, 1);

const completed = Array.from({ length: 15 }, (_, index) => payload({ index: index + 1,
    employeeId: `completed-${index + 1}`, weekStart: `2026-09-${
        String(7 + index).padStart(2, '0')}` }));
const deferred = Array.from({ length: 3 }, (_, index) => payload({ index: index + 16,
    status: 'DEFERRED_TO_NEXT_PERIOD', employeeId: `deferred-${index + 1}`,
    weekStart: `2026-10-${String(1 + index).padStart(2, '0')}` }));
weeklyHrStage1Payloads.clear();
[...completed, ...deferred].forEach((item, index) =>
    weeklyHrStage1Payloads.set(`scope-${index}`, item));
sandbox.api.setCanonical([...completed, ...deferred]);
const realPopulationCounts = sandbox.api.weeklyHrStage1Counts();
assert.deepEqual(JSON.parse(JSON.stringify({
    total: realPopulationCounts.total,
    completed: realPopulationCounts.completed,
    blocked: realPopulationCounts.blocked,
    open: realPopulationCounts.open,
    stale: realPopulationCounts.stale
})), { total: 18, completed: 15, blocked: 0, open: 0, stale: 0 });
const realPopulationHeader = sandbox.api.header();
assert.equal(realPopulationHeader.stages.STAGE1.business_status, 'DEFERRED_TO_NEXT_PERIOD');
assert.equal(realPopulationHeader.stages.STAGE1.presentation_status,
    'DEFERRED_TO_NEXT_PERIOD');
assert.equal(realPopulationHeader.requires_hr_action, false);
assert.notEqual(realPopulationHeader.stages.STAGE1.business_status, 'BLOCKED');

const renderSource = source.slice(source.indexOf('async function renderWeeklyHrStage1('),
    source.indexOf('function prepareWeeklyHrStage1LazyLoad('));
assert.match(renderSource,
    /weeklyHrStage1Payloads\.set\(weeklyHrStage1Key\(scope\), payload\);\s*replaceCanonicalLifecyclePayload\(payload\);/);

console.log('Stage 1 canonical payload synchronization regression: PASS');
