const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const postCheckStart = source.indexOf('async function runWeeklyRepoPostCheck({');
const postCheckEnd = source.indexOf('function getDailyDeclaredMinutes', postCheckStart);
const postCheckSource = source.slice(postCheckStart, postCheckEnd);
const exportMapStart = source.indexOf('function mapDeviationForReviewExport(');
const exportMapEnd = source.indexOf('function reviewDeviationProfileText(', exportMapStart);
const exportMapSource = source.slice(exportMapStart, exportMapEnd);

test('weekly post-check uses canonical CURRENT repo counting with daily terms', () => {
    assert.ok(postCheckStart >= 0 && postCheckEnd > postCheckStart);
    assert.ok(source.includes(
        "require('../../services/ergazomenoi/apasxoliseisWeeklyCanonicalRepoCountService')"
    ));
    assert.ok(postCheckSource.includes('ores_ergasias_apologistika'));
    assert.ok(postCheckSource.includes('resolveCanonicalRepoDayCountState({'));
    assert.ok(postCheckSource.includes('dailyProfile,'));
    assert.ok(postCheckSource.includes('hasUnresolvedCardPair'));
    assert.ok(/if \(\s*repoCountState\.countsAsRepo\s*\)/.test(postCheckSource));
    assert.ok(!postCheckSource.includes('cardsOresIsZero'));
});

test('canonical repo diagnostics use the existing in-memory HR decision result', () => {
    assert.ok(postCheckSource.includes('repoStateReasons.add(reason)'));
    assert.ok(postCheckSource.includes(
        "status: 'NEEDS_HR_DECISION'"
    ));
    assert.ok(postCheckSource.includes('reasons: [...repoStateReasons]'));
    assert.ok(postCheckSource.includes('repoStateReasons.size > 0'));
});

test('post-check persistence blocks remain structurally unchanged', () => {
    assert.ok(postCheckSource.includes('update: { $set: update }'));
    assert.ok(postCheckSource.includes(
        'await ProdhlomenaOrariaModel.bulkWrite(chunk, { ordered: false })'
    ));
    assert.ok(postCheckSource.includes(
        'await ProdhlomenaOrariaDeviationsModel.deleteMany(deviationsCleanupFilter)'
    ));
    assert.ok(postCheckSource.includes('await ProdhlomenaOrariaDeviationsModel.insertMany('));
    const persistedDeviation = postCheckSource.slice(
        postCheckSource.indexOf('await ProdhlomenaOrariaDeviationsModel.insertMany(')
    );
    assert.ok(persistedDeviation.includes('status: d.status || undefined'));
    assert.ok(persistedDeviation.includes(
        'reasons: Array.isArray(d.reasons) ? d.reasons : undefined'
    ));
});

test('persisted diagnostic metadata reaches the shared review export projection', () => {
    assert.ok(exportMapStart >= 0 && exportMapEnd > exportMapStart);
    assert.ok(exportMapSource.includes("...(d.status ? { status: d.status } : {})"));
    assert.ok(exportMapSource.includes(
        '...(Array.isArray(d.reasons) ? { reasons: [...d.reasons] } : {})'
    ));
});
