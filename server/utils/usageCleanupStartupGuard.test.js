const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    DEFAULT_INTERVAL_MS,
    startUsageCleanupGuarded
} = require('./usageCleanupStartupGuard');

function runCase(enabledValue) {
    let cleanupCalls = 0;
    const intervals = [];
    const cleanup = () => { cleanupCalls++; };
    const result = startUsageCleanupGuarded({
        enabledValue,
        cleanup,
        setIntervalFn(fn, milliseconds) {
            intervals.push({ fn, milliseconds });
            return 'test-interval';
        }
    });
    return { result, cleanupCalls, intervals, cleanup };
}

for (const enabledValue of [undefined, 'true']) {
    const outcome = runCase(enabledValue);
    assert.strictEqual(outcome.result.enabled, true);
    assert.strictEqual(outcome.cleanupCalls, 1);
    assert.strictEqual(outcome.intervals.length, 1);
    assert.strictEqual(outcome.intervals[0].fn, outcome.cleanup);
    assert.strictEqual(outcome.intervals[0].milliseconds, DEFAULT_INTERVAL_MS);
}

const disabled = runCase('false');
assert.strictEqual(disabled.result.enabled, false);
assert.strictEqual(disabled.result.interval, null);
assert.strictEqual(disabled.cleanupCalls, 0);
assert.strictEqual(disabled.intervals.length, 0);

const appSource = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
assert.match(appSource, /startUsageCleanupGuarded\(\{/);
assert.match(appSource, /startPayrollPrecalcScheduler\(\)/);
assert.match(appSource, /initializeTextCacheSystem\(\)/);
assert.match(appSource, /initializeSocket\(server\)/);

console.log('usage cleanup startup guard tests passed');
