const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const routeSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'routes', 'usersRoute.js'),
    'utf8'
);
const postCheckWritePlan = fs.readFileSync(
    path.join(__dirname, '..', '..', 'services', 'ergazomenoi', 'apasxoliseisWeeklyPostCheckWritePlanService.js'),
    'utf8'
);
const dailyAdapterSource = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'ergazomenoi',
    'apasxoliseisEmploymentDailyCalculationAdapterService.js'), 'utf8');

assert.ok(routeSource.includes("router.get('/api/prodhlomena-oraria/review'"));
assert.ok(routeSource.includes('erganhController.getProdhlomenaOrariaForReview'));
assert.ok(source.includes('buildWeeklyRepoDeviationPreview({'));
assert.ok(source.includes('rows: deviationContextRows'));
assert.ok(source.includes('holidayByDateKey:'));
assert.ok(source.includes('existingAuditCountByRowKey:'));
assert.ok(source.includes('deviationAuditCountByRowKey'));
assert.ok(source.includes('external_break_minutes:'));
assert.ok(source.includes('eidikh_kathgoria_ergazomenoy:'));
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
const cleanupFilterStart = source.indexOf('const deviationsCleanupFilter = {');
const cleanupFilterEnd = source.indexOf(
    'await ProdhlomenaOrariaDeviationsModel.deleteMany(deviationsCleanupFilter,',
    cleanupFilterStart
);
assert.ok(cleanupFilterStart >= 0 && cleanupFilterEnd > cleanupFilterStart);
const cleanupFilterSource = source.slice(cleanupFilterStart, cleanupFilterEnd);
assert.ok(cleanupFilterSource.includes('team: sessionTeam'));
assert.ok(cleanupFilterSource.includes('company_kod: companyId'));
assert.ok(cleanupFilterSource.includes('period_apo: asDateOnlyUtc(apoDate)'));
assert.ok(cleanupFilterSource.includes('period_eos: asDateOnlyUtc(eosDate, true)'));
assert.ok(cleanupFilterSource.includes('if (selectedYpokatasthma)'));
assert.ok(
    cleanupFilterSource.includes(
        'deviationsCleanupFilter.ypokatasthma = selectedYpokatasthma;'
    )
);
assert.ok(!source.includes('startOfWeekSunday'));
assert.ok(!source.includes('endOfWeekSaturday'));

const postCheckStart = source.indexOf('async function runWeeklyRepoPostCheck({');
const postCheckEnd = source.indexOf('function getDailyDeclaredMinutes', postCheckStart);
assert.ok(postCheckStart >= 0 && postCheckEnd > postCheckStart);
const postCheckSource = source.slice(postCheckStart, postCheckEnd);
assert.ok(postCheckSource.includes('const postCheckRowsQuery = {'));
assert.ok(postCheckSource.includes('if (selectedYpokatasthma)'));
assert.ok(
    postCheckSource.includes(
        'postCheckRowsQuery.ypokatasthma = selectedYpokatasthma;'
    )
);
assert.ok(postCheckSource.includes('ProdhlomenaOrariaModel.find(postCheckRowsQuery)'));

const calculationStart = source.indexOf('static calcApasxolhseisPeriodoy');
const calculationEnd = source.indexOf('static ', calculationStart + 7);
assert.ok(calculationStart >= 0 && calculationEnd > calculationStart);
const calculationSource = source.slice(calculationStart, calculationEnd);
assert.ok(calculationSource.includes('const prodhlomenaQuery = {'));
assert.ok(calculationSource.includes('if (selectedYpokatasthma)'));
assert.ok(
    calculationSource.includes(
        'prodhlomenaQuery.ypokatasthma = selectedYpokatasthma;'
    )
);
assert.ok(calculationSource.includes('ProdhlomenaOrariaModel.find(prodhlomenaQuery)'));
assert.ok(calculationSource.includes('buildEmploymentDailyPreliminaryUpdate({'));
assert.ok(calculationSource.includes('buildEmploymentDailyCalculationUpdate({'));
assert.ok(dailyAdapterSource.includes('operations.resolveCardPairVerification(calculationRow)'));
assert.ok(dailyAdapterSource.includes('operations.buildPartialVerifiedCardUpdate(calculationRow).update'));
assert.ok(!calculationSource.includes('buildIncompleteCardSafeUpdate()'));
assert.strictEqual(
    (calculationSource.match(/checkIncompleteCardPairAgainstDeclared\(/g) || []).length,
    0
);
assert.ok(/resolveCardPairVerification\(\s*row\s*\)/.test(postCheckWritePlan));
assert.ok(postCheckWritePlan.includes('buildPartialVerifiedCardUpdate(row).update'));
assert.ok(!postCheckWritePlan.includes('buildIncompleteCardSafeUpdate()'));

const payrollIntervalsStart = source.indexOf(
    'function getPayrollCalculationIntervals(rec, ergazomenos = null)'
);
const payrollIntervalsEnd = source.indexOf(
    'function getPayrollDailyWorkMinutes',
    payrollIntervalsStart
);
assert.ok(
    payrollIntervalsStart >= 0 && payrollIntervalsEnd > payrollIntervalsStart
);
const payrollIntervalsSource = source.slice(
    payrollIntervalsStart,
    payrollIntervalsEnd
);
assert.ok(payrollIntervalsSource.includes('resolveCardPairVerification(rec)'));
assert.ok(payrollIntervalsSource.includes('verification.completePairs.map'));
assert.ok(payrollIntervalsSource.includes("source: 'CARD_PARTIALLY_VERIFIED'"));
assert.ok(!payrollIntervalsSource.includes('hasIncompleteCardPair'));

const atomicStart = source.indexOf('async function buildAtomicRepoTransferPolicyPreviewProjection');
const atomicEnd = source.indexOf('function getWeekRangesInsidePeriod', atomicStart);
assert.ok(atomicStart >= 0 && atomicEnd > atomicStart);
const atomicSource = source.slice(atomicStart, atomicEnd);
assert.ok(atomicSource.includes('startOfWeekMondayUtc(requestedPeriodStart)'));
assert.ok(atomicSource.includes('endOfWeekSundayUtc(requestedPeriodEnd)'));
assert.ok(atomicSource.includes('validationPeriodStart: requestedPeriodStart'));
assert.ok(atomicSource.includes('validationPeriodEnd: requestedPeriodEnd'));
assert.ok(atomicSource.includes('presentationStart: includeContextGroups ? analysisPeriodStart : requestedPeriodStart'));
assert.ok(atomicSource.includes('presentationEnd: includeContextGroups ? analysisPeriodEnd : requestedPeriodEnd'));
assert.ok(atomicSource.includes('$gte: analysisPeriodStart'));
assert.ok(atomicSource.includes('$lte: analysisPeriodEnd'));

console.log('employment review weekly deviation preview controller contract passed');
