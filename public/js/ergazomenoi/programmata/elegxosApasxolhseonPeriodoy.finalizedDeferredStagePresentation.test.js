'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');

function sourceFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Δεν βρέθηκε η ${name}`);
    let depth = 0;
    let parentheses = 0;
    let parametersStarted = false;
    let bodyStarted = false;
    for (let index = start; index < source.length; index += 1) {
        if (!bodyStarted && source[index] === '(') {
            parentheses += 1;
            parametersStarted = true;
        } else if (!bodyStarted && source[index] === ')') {
            parentheses -= 1;
        } else if (source[index] === '{' && parametersStarted && parentheses === 0) {
            depth += 1;
            bodyStarted = true;
        } else if (source[index] === '{' && bodyStarted) {
            depth += 1;
        } else if (source[index] === '}' && bodyStarted && --depth === 0) {
            return source.slice(start, index + 1);
        }
    }
    throw new Error(`Δεν ολοκληρώθηκε η ${name}`);
}

const derive = new Function(`${sourceFunction('compareLifecyclePendingItems')}
${sourceFunction('derivePeriodLifecyclePresentation')}
return derivePeriodLifecyclePresentation;`)();

function deferredPayload(periodStart, periodEnd) {
    const stage = () => ({ business_status: 'DEFERRED_TO_NEXT_PERIOD', pending_count: 0,
        pending_reasons: [], pending_dates: [], persisted_status: 'DEFERRED_TO_NEXT_PERIOD' });
    return { scope: { team: 'T', company_kod: 'C', ypokatasthma: '0001',
        employee_id: 'E', employee_kodikos: '0031', week_start: periodEnd.slice(0, 8) + '26',
        week_end: periodEnd.slice(0, 8) + '31', period_start: periodStart, period_end: periodEnd },
    lifecycle_projection: { deferred_week: { deferred_week_id: `week-${periodStart}`,
        status: 'DEFERRED_TO_NEXT_PERIOD' }, stages: { stage1: stage(), stage2: stage(),
        stage3: stage(), stage4: stage() } } };
}

for (const [periodStart, periodEnd] of [
    ['2026-01-01', '2026-01-31'], ['2026-02-01', '2026-02-28'], ['2026-03-01', '2026-03-31']
]) {
    const payload = deferredPayload(periodStart, periodEnd);
    const before = JSON.stringify(payload);
    const finalized = derive([payload], { stored_status: 'FINALIZED' });
    assert.deepEqual(Object.values(finalized.stages).map((stage) => stage.presentation_status),
        ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED']);
    assert.equal(finalized.total_pending_count, 0);
    assert.equal(finalized.requires_hr_action, false);
    assert.equal(finalized.deferred_weeks[0].status, 'DEFERRED_TO_NEXT_PERIOD');
    assert.equal(JSON.stringify(payload), before, 'το stored lifecycle input δεν μεταλλάσσεται');
}

for (const status of ['OPEN', 'LOCKED']) {
    const active = derive([deferredPayload('2026-04-01', '2026-04-30')], {
        stored_status: status });
    assert.ok(Object.values(active.stages).every((stage) =>
        stage.presentation_status === 'DEFERRED_TO_NEXT_PERIOD'));
}

console.log('finalized historical deferred stage presentation tests: PASS');
