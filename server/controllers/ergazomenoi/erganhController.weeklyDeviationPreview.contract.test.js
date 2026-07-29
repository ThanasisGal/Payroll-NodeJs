const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routeSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'routes', 'usersRoute.js'),
    'utf8'
);

assert.ok(routeSource.includes("router.get('/api/prodhlomena-oraria/review'"));
assert.ok(routeSource.includes('erganhController.getProdhlomenaOrariaForReview'));
assert.ok(source.includes('buildWeeklyRepoDeviationPreview({'));
assert.ok(source.includes('rows: deviationContextRows'));
assert.ok(source.includes('asOfDate: req.session.appDate'));
assert.ok(source.includes('$gte: startOfWeekMondayUtc(requestedPeriodStart)'));
assert.ok(source.includes('$lte: endOfWeekSundayUtc(requestedPeriodEnd)'));
assert.ok(source.includes('pendingDeviationWeeks'));
assert.ok(source.includes('legacyDeviations'));
assert.ok(source.includes('normalizeLegacyDeviation({'));
assert.ok(source.includes('deviationPolicyVersion: deviationPreview.policyVersion'));
assert.ok(!source.includes('startOfWeekSunday'));
assert.ok(!source.includes('endOfWeekSaturday'));

console.log('employment review weekly deviation preview controller contract passed');
