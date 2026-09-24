'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function resolveSixthDayRowPresentation');
const end = source.indexOf('function resolveSeventhDayRowPresentation', start);
const sandbox = {
    weeklyHrStage1Payloads: new Map(),
    currentCanonicalLifecyclePayloads: [],
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    escapeHtml: String
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

const lifecyclePayloads = [{
    scope: { employee_kodikos: 'test-employee', ypokatasthma: '0000',
        week_start: '2026-08-03', week_end: '2026-08-09' },
    lifecycle_projection: { stages: { stage4: { final_weekly_analysis: {
        sixthDay: { hmeromhnia: '2026-08-08', premiumRate: 0, sixthDayHours: 7.97 }
    } } } }
}];
const staleFriday = sandbox.resolveSixthDayRowPresentation({
    kodikos: 'test-employee', ypokatasthma: '0000', hmeromhnia: '2026-08-07',
    is_sixth_day: true, sixth_day_premium_rate: 40
}, lifecyclePayloads);
const saturday = sandbox.resolveSixthDayRowPresentation({
    kodikos: 'test-employee', ypokatasthma: '0000', hmeromhnia: '2026-08-08',
    is_sixth_day: false
}, lifecyclePayloads);
assert.equal(staleFriday.is_sixth_day, false);
assert.equal(staleFriday.sixth_day_premium_rate, null);
assert.equal(saturday.is_sixth_day, true);
assert.equal(saturday.sixth_day_premium_rate, 0);
assert.equal(sandbox.renderSixthDayCardsBadge(staleFriday), '');
assert.match(sandbox.renderSixthDayCardsBadge(saturday), /6η ημέρα · 0%/);

console.log('canonical weekly daily-row presentation regression tests passed');
