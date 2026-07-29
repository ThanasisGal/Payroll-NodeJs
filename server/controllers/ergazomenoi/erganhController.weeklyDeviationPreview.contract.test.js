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
const deviationSelectStart = source.indexOf(
    'ProdhlomenaOrariaModel.find(deviationContextFilter)'
);
const deviationSelectEnd = source.indexOf(
    '.sort({ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 })',
    deviationSelectStart
);
assert.ok(deviationSelectStart >= 0 && deviationSelectEnd > deviationSelectStart);
const deviationSelect = source.slice(deviationSelectStart, deviationSelectEnd);
for (const field of [
    'adeia',
    'kathgoria_adeias',
    'ores_apoysias',
    'adeia_apologistika',
    'kathgoria_adeias_apologistika',
    'ores_apoysias_apologistika',
    'astheneia',
    'astheneia_apologistika',
    'cards_ores_ergasias',
    'cards_apo_ora_01',
    'cards_eos_ora_01',
    'ores_ergasias',
    'ores_ergasias_apologistika',
    'kathgoria_ergasias',
    'kathgoria_ergasias_apologistika'
]) {
    assert.ok(
        new RegExp(`(?:^|[^A-Za-z0-9_])${field}(?:$|[^A-Za-z0-9_])`).test(
            deviationSelect
        ),
        `missing ${field}`
    );
}
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
