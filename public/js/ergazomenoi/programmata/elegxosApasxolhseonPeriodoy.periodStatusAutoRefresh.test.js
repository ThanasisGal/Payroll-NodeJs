'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');

function sourceFunction(name) {
    const start = source.indexOf(`async function ${name}(`);
    assert.notEqual(start, -1, `Δεν βρέθηκε η ${name}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Δεν ολοκληρώθηκε η ${name}`);
}

function buildAction(name, dependencies) {
    return new Function(...Object.keys(dependencies), `${sourceFunction(name)}; return ${name};`)(
        ...Object.values(dependencies));
}

function response(payload, ok = true) {
    return { ok, json: async () => payload };
}

async function runTransition(action, { cancel = false, fail = false } = {}) {
    const filters = { apo_hmeromhnia: '2026-01-01', eos_hmeromhnia: '2026-01-31',
        ypokatasthma: '0001', kodikos: '0031' };
    const before = JSON.stringify(filters);
    const events = []; const requests = [];
    const transition = buildAction('transitionEmploymentPeriod', {
        currentEmploymentPeriodControl: { version: 7 }, csrfToken: 'token',
        getActiveEmploymentReviewScope: () => ({ ...filters }),
        fetch: async (url, options) => { requests.push({ url, options });
            return response(fail ? { success: false, message: 'failure' } : { success: true, message: 'success' }, !fail); },
        employmentReviewSwal: async (options) => {
            if (options.icon === 'success') { events.push('success-closed'); return { isConfirmed: true }; }
            events.push('confirmation'); return { isConfirmed: !cancel, value: 'reason' };
        },
        loadResults: async () => { events.push('search-refresh'); }
    });
    let error = null;
    try { await transition(action); } catch (caught) { error = caught; }
    assert.equal(JSON.stringify(filters), before);
    return { events, requests, error };
}

(async () => {
    for (const action of ['lock', 'unlock']) {
        const result = await runTransition(action);
        assert.deepEqual(result.events, ['confirmation', 'success-closed', 'search-refresh']);
        assert.equal(result.requests.length, 1);
        assert.equal(result.requests[0].options.method, 'POST');
    }
    const canceled = await runTransition('lock', { cancel: true });
    assert.deepEqual(canceled.events, ['confirmation']); assert.equal(canceled.requests.length, 0);
    const failed = await runTransition('lock', { fail: true });
    assert.ok(failed.error); assert.deepEqual(failed.events, ['confirmation']);
    assert.equal(failed.requests.length, 1);

    const events = []; const requests = []; const filters = { ypokatasthma: '0001', kodikos: '0031' };
    const finalize = buildAction('runEmploymentPeriodLifecycleAction', {
        currentEmploymentPeriodControl: { past_deadline: false, historical_reconstruction: {} },
        csrfToken: 'token', getActiveEmploymentReviewScope: () => ({ ...filters }),
        fetch: async (url, options) => { requests.push({ url, options });
            return response({ success: true, message: 'finalized' }); },
        employmentReviewSwal: async (options) => { events.push(options.icon === 'success'
            ? 'success-closed' : 'confirmation'); return { isConfirmed: true, value: 'reason' }; },
        loadResults: async () => { events.push('search-refresh'); },
        loadEmploymentPeriodControl: async () => { throw new Error('δεν πρέπει να χρησιμοποιηθεί στη finalize'); }
    });
    await finalize('finalize');
    assert.deepEqual(events, ['confirmation', 'success-closed', 'search-refresh']);
    assert.equal(requests.length, 1); assert.equal(requests[0].options.method, 'POST');
    assert.deepEqual(filters, { ypokatasthma: '0001', kodikos: '0031' });
    assert.doesNotMatch(sourceFunction('transitionEmploymentPeriod'), /location\.reload/);
    assert.doesNotMatch(sourceFunction('runEmploymentPeriodLifecycleAction'), /location\.reload/);
    console.log('period status auto-refresh tests: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
