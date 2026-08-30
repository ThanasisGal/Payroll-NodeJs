'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const section = (source, start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);
    assert.notStrictEqual(startIndex, -1, `Missing section start: ${start}`);
    assert.notStrictEqual(endIndex, -1, `Missing section end: ${end}`);
    return source.slice(startIndex, endIndex);
};

const employmentScopeImport = section(
    controller,
    'const {\n    buildPostDepartureExclusionDescriptors,',
    "} = require('../../services/ergazomenoi/apasxoliseisEmploymentPeriodScopeService');"
);
const reviewMethod = section(
    controller,
    'static getProdhlomenaOrariaForReview',
    'static getProdhlomenaOrariaOrphanQualityCheck'
);
const boundaryIntegration = section(
    reviewMethod,
    'const boundaryScope = buildFullMonthBoundaryContextPreflight({',
    'deviationPolicyVersion: deviationPreview.policyVersion'
);
const cardRowLoader = section(
    boundaryIntegration,
    'const loadBoundaryCardRows = async (side) => {',
    'const [previousBoundaryRows, nextBoundaryRows]'
);

assert.match(employmentScopeImport, /buildFullMonthBoundaryContextPreflight/);

assert.match(boundaryIntegration,
    /const boundaryScope = buildFullMonthBoundaryContextPreflight\(\{[\s\S]*?period_start: reviewPeriodStart,[\s\S]*?period_end: reviewPeriodEnd,[\s\S]*?employees: lifecycleEmployees[\s\S]*?\}\);/);
assert.match(boundaryIntegration,
    /if \(!side\?\.dates\?\.length \|\| !side\.affected_employee_codes\?\.length\) return \[\];/);

assert.match(cardRowLoader, /team: sessionTeam/);
assert.match(cardRowLoader, /company_kod: companyId/);
assert.match(cardRowLoader,
    /kodikos: mongoose\.trusted\(\{ \$in: side\.affected_employee_codes \}\)/);
assert.match(cardRowLoader,
    /\$gte: clampDateStartUtc\(`\$\{side\.dates\[0\]\}T00:00:00\.000Z`\)/);
assert.match(cardRowLoader,
    /\$lte: clampDateEndUtc\(`\$\{side\.dates\.at\(-1\)\}T23:59:59\.999Z`\)/);
assert.match(cardRowLoader,
    /boundaryFilter\.ypokatasthma = String\(ypokatasthma\)\.trim\(\)\.padStart\(4, '0'\)/);

assert.match(cardRowLoader, /ProdhlomenaOrariaModel\.find\(boundaryFilter\)/);
assert.match(cardRowLoader,
    /\.select\('ypokatasthma kodikos hmeromhnia cards_apo_ora_01 cards_eos_ora_01 ' \+[\s\S]*?'cards_apo_ora_02 cards_eos_ora_02 cards_apo_ora_03 cards_eos_ora_03 ' \+[\s\S]*?'cards_ores_ergasias'\)/);
assert.match(cardRowLoader, /\.sort\(\{ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 \}\)/);
assert.match(cardRowLoader, /\.lean\(\)/);
assert.doesNotMatch(cardRowLoader,
    /\.(?:update|updateOne|updateMany|save|delete|deleteOne|deleteMany|remove)\s*\(/);

assert.match(boundaryIntegration,
    /const \[previousBoundaryRows, nextBoundaryRows\] = boundaryScope[\s\S]*?await Promise\.all\(\[[\s\S]*?loadBoundaryCardRows\(boundaryScope\.previous\),[\s\S]*?loadBoundaryCardRows\(boundaryScope\.next\)[\s\S]*?\]\) : \[\[\], \[\]\];/);

assert.match(boundaryIntegration,
    /const boundaryContextPreflight = boundaryScope[\s\S]*?buildFullMonthBoundaryContextPreflight\(\{[\s\S]*?period_start: reviewPeriodStart,[\s\S]*?period_end: reviewPeriodEnd,[\s\S]*?employees: lifecycleEmployees,[\s\S]*?previous_rows: previousBoundaryRows,[\s\S]*?next_rows: nextBoundaryRows[\s\S]*?\}\) : null;/);
assert.match(boundaryIntegration, /return res\.json\(\{[\s\S]*?boundaryContextPreflight,/);

assert.doesNotMatch(boundaryIntegration,
    /isDateWithinEmploymentPeriod|resolveCardPairVerification|employeeRecordsByKey|activeEmploymentRecordsByKey/);
assert.doesNotMatch(boundaryIntegration,
    /completeWeeklyHrWorkflowStage1|saveWeeklyHrStage1DailyClassificationsBulk|resolveWeeklyHrStage3Day|updateProdhlomenaOrariaReviewRecord/);

console.log('boundary card preflight controller integration regression tests: PASS');
