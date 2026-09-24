'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
    withWeeklyAnalysisPresentationStatus
} = require('../../../../server/services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname,
    '../../../../server/controllers/ergazomenoi/erganhController.js'), 'utf8');
assert.match(controllerSource,
    /canonicalLifecycleProjections[\s\S]*withWeeklyAnalysisPresentationStatus\(lifecycleProjection\)/);
const start = source.indexOf('function weeklyLifecyclePayloadForDeviation');
const end = source.indexOf('function resolveFinalWeeklyNonWorkDays', start);
const sandbox = {
    currentCanonicalLifecyclePayloads: [],
    weeklyHrStage1Payloads: new Map(),
    stage1DateKey: (value) => String(value || '').slice(0, 10)
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

const deviation = { kodikos: 'test-employee', week_apo: '2026-08-03',
    week_eos: '2026-08-09' };
const scope = { employee_kodikos: 'test-employee', week_start: '2026-08-03',
    week_end: '2026-08-09' };
const stage = (businessStatus) => ({ business_status: businessStatus });
function payload(stage1, stage2, stage3, { finalized = false } = {}) {
    const projection = withWeeklyAnalysisPresentationStatus({
        finalized_authoritative: finalized,
        stages: { stage1: stage(stage1), stage2: stage(stage2), stage3: stage(stage3),
            stage4: stage('COMPLETED') }
    });
    // Ίδιο όριο JSON με την πραγματική απόκριση canonicalLifecycleProjections.
    return JSON.parse(JSON.stringify({ scope, lifecycle_projection: projection }));
}
function warningFor(serializedPayload) {
    return sandbox.renderWeeklyAnalysisProvisionalWarning([deviation], [serializedPayload]);
}

for (const [label, serializedPayload] of [
    ['Stage 1 blocked', payload('BLOCKED', 'OPEN', 'OPEN')],
    ['Stage 2 incomplete', payload('COMPLETED', 'OPEN', 'OPEN')],
    ['Stage 3 incomplete', payload('COMPLETED', 'COMPLETED', 'OPEN')]
]) {
    const html = warningFor(serializedPayload);
    assert.match(html, /weekly-analysis-provisional/, label);
    assert.match(html, /ΠΡΟΕΠΙΣΚΟΠΗΣΗ/, label);
}

assert.equal(warningFor(payload('COMPLETED', 'COMPLETED', 'COMPLETED')), '');
assert.equal(warningFor(payload('COMPLETED', 'COMPLETED', 'COMPLETED', {
    finalized: true
})), '');

console.log('weekly provisional canonical payload renderer regression tests passed');
