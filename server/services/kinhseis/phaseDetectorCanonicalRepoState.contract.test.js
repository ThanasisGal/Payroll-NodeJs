const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    resolveDailyRepoCalculationState
} = require('../ergazomenoi/apasxoliseisDailyRepoCalculationStateService');

const source = fs.readFileSync(path.join(__dirname, 'phaseDetectorService.js'), 'utf8');
const expectedWorkInfoStart = source.indexOf('function buildExpectedWorkInfo(');
const expectedWorkInfoEnd = source.indexOf(
    'function buildDailyFactHours(',
    expectedWorkInfoStart
);
const expectedWorkInfoSource = source.slice(expectedWorkInfoStart, expectedWorkInfoEnd);

test('phase detector wires authoritative daily terms to canonical CURRENT repo state', () => {
    assert.ok(source.includes("require('../ergazomenoi/apasxoliseisDailyRepoCalculationStateService')"));
    assert.ok(expectedWorkInfoStart >= 0 && expectedWorkInfoEnd > expectedWorkInfoStart);
    assert.ok(expectedWorkInfoSource.includes('resolveDailyRepoCalculationState({'));
    assert.ok(expectedWorkInfoSource.includes('dailyProfile'));
    assert.ok(expectedWorkInfoSource.includes('warnings.push(...repoState.diagnostics)'));
    assert.ok(expectedWorkInfoSource.includes(
        'const effectiveKathgoria = repoState.effectiveCategory;'
    ));
    assert.ok(expectedWorkInfoSource.includes(
        'const isRepoDay = repoState.effectiveRepo === true;'
    ));
    assert.ok(source.includes(
        'const expectedWorkInfo = buildExpectedWorkInfo(\n' +
        '            orario,\n' +
        '            kartaErgasias,\n' +
        '            dayWarnings,\n' +
        '            terms\n' +
        '        );'
    ));
    const isRepoDayLine = expectedWorkInfoSource
        .split('\n')
        .find((line) => line.includes('const isRepoDay ='));
    assert.equal(isRepoDayLine.trim(), 'const isRepoDay = repoState.effectiveRepo === true;');
});

test('canonical daily results cover phase detector repo semantics without DB imports', () => {
    const cases = [
        {
            row: {
                kathgoria_ergasias: 'ΑΝ',
                repo: true,
                kathgoria_ergasias_apologistika: 'ΕΡΓ',
                repo_apologistika: false
            },
            profile: { typos_apasxolhshs: 'PLHRHS' },
            category: 'ΕΡΓ',
            repo: false,
            diagnostics: []
        },
        {
            row: {
                kathgoria_ergasias: 'ΕΡΓ',
                repo: false,
                kathgoria_ergasias_apologistika: 'ΑΝ',
                repo_apologistika: true
            },
            profile: { typos_apasxolhshs: 'PLHRHS' },
            category: 'ΑΝ',
            repo: true,
            diagnostics: []
        },
        {
            row: { kathgoria_ergasias: 'ΜΕ', repo: false },
            profile: { typos_apasxolhshs: 'MERIKH' },
            category: 'ΜΕ',
            repo: true,
            diagnostics: []
        },
        {
            row: { kathgoria_ergasias: 'ΜΕ', repo: false },
            profile: { typos_apasxolhshs: 'EK_PERITROPHS' },
            category: 'ΜΕ',
            repo: true,
            diagnostics: []
        },
        {
            row: {
                kathgoria_ergasias: 'ΑΝ',
                repo: true,
                kathgoria_ergasias_apologistika: '',
                repo_apologistika: false
            },
            profile: { typos_apasxolhshs: 'PLHRHS' },
            category: 'ΑΝ',
            repo: true,
            diagnostics: []
        },
        {
            row: {
                kathgoria_ergasias: 'ΕΡΓ',
                repo: false,
                kathgoria_ergasias_apologistika: 'ΕΡΓ',
                repo_apologistika: true
            },
            profile: { typos_apasxolhshs: 'PLHRHS' },
            category: 'ΕΡΓ',
            repo: null,
            diagnostics: ['CATEGORY_REPO_CONFLICT']
        },
        {
            row: { kathgoria_ergasias: 'ΑΝ', repo: true },
            profile: {},
            category: null,
            repo: null,
            diagnostics: ['DAILY_EMPLOYMENT_PROFILE_UNRESOLVED']
        }
    ];

    for (const fixture of cases) {
        const repoState = resolveDailyRepoCalculationState({
            row: fixture.row,
            dailyProfile: fixture.profile
        });
        assert.equal(repoState.effectiveCategory, fixture.category);
        assert.equal(repoState.effectiveRepo, fixture.repo);
        assert.deepEqual(repoState.diagnostics, fixture.diagnostics);
    }
});

test('approval-only metadata cannot affect the wired CURRENT result', () => {
    const row = {
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false
    };
    const dailyProfile = { typos_apasxolhshs: 'PLHRHS' };
    const baseline = resolveDailyRepoCalculationState({ row, dailyProfile });
    const withMetadata = resolveDailyRepoCalculationState({
        row: {
            ...row,
            reuse_status: 'ACTIVE',
            decision_status: 'RECORDED',
            approval_id: 'synthetic-approval',
            fingerprint: 'synthetic-fingerprint',
            reusable_decision: { status: 'RESOLVED_BY_POLICY' }
        },
        dailyProfile
    });

    assert.deepEqual(withMetadata, baseline);
});
