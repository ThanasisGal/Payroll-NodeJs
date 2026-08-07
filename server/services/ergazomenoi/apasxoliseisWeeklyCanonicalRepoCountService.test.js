const assert = require('node:assert/strict');
const test = require('node:test');

const {
    resolveCanonicalRepoDayCountState,
    resolveWeeklyActualRepoCount
} = require('./apasxoliseisWeeklyCanonicalRepoCountService');

const FULL = Object.freeze({ typos_apasxolhshs: 'PLHRHS' });
const PARTIAL = Object.freeze({ typos_apasxolhshs: 'MERIKH' });
const ROTATIONAL = Object.freeze({ typos_apasxolhshs: 'EK_PERITROPHS' });

test('declared full-time repo with zero work and card hours counts as repo', () => {
    const result = resolveCanonicalRepoDayCountState({
        row: {
            kathgoria_ergasias: 'ΑΝ',
            repo: true,
            ores_ergasias: 0,
            cards_ores_ergasias: 0
        },
        dailyProfile: FULL
    });

    assert.equal(result.countsAsRepo, true);
    assert.deepEqual(result.diagnostics, []);
});

test('material apologistika source negative override does not count as repo', () => {
    const result = resolveCanonicalRepoDayCountState({
        row: {
            kathgoria_ergasias: 'ΑΝ',
            repo: true,
            ores_ergasias: 0,
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: false,
            ores_ergasias_apologistika: 0,
            cards_ores_ergasias: 0
        },
        dailyProfile: FULL
    });

    assert.equal(result.effectiveCategory, 'ΕΡΓ');
    assert.equal(result.effectiveRepo, false);
    assert.equal(result.countsAsRepo, false);
});

test('material apologistika target uses apologistika hours and counts as repo', () => {
    const result = resolveCanonicalRepoDayCountState({
        row: {
            kathgoria_ergasias: 'ΕΡΓ',
            repo: false,
            ores_ergasias: 8,
            kathgoria_ergasias_apologistika: 'ΑΝ',
            repo_apologistika: true,
            ores_ergasias_apologistika: 0,
            cards_ores_ergasias: 0
        },
        dailyProfile: FULL
    });

    assert.equal(result.provenance, 'APOLOGISTIKA_CURRENT');
    assert.equal(result.effectiveHours, 0);
    assert.equal(result.countsAsRepo, true);
});

test('partial and rotational ΜΕ rows use their authoritative daily profile', () => {
    for (const dailyProfile of [PARTIAL, ROTATIONAL]) {
        const result = resolveCanonicalRepoDayCountState({
            row: {
                kathgoria_ergasias: 'ΜΕ',
                repo: false,
                ores_ergasias: 0,
                cards_ores_ergasias: 0
            },
            dailyProfile
        });

        assert.equal(result.effectiveRepo, true);
        assert.equal(result.countsAsRepo, true);
    }
});

test('default apologistika false without a category falls back to declared repo', () => {
    const result = resolveCanonicalRepoDayCountState({
        row: {
            kathgoria_ergasias: 'ΑΝ',
            repo: true,
            ores_ergasias: 0,
            kathgoria_ergasias_apologistika: '',
            repo_apologistika: false,
            ores_ergasias_apologistika: 8,
            cards_ores_ergasias: 0
        },
        dailyProfile: FULL
    });

    assert.equal(result.provenance, 'DECLARED_CURRENT');
    assert.equal(result.effectiveHours, 0);
    assert.equal(result.countsAsRepo, true);
});

test('work hours, card hours and unresolved cards independently block repo counting', () => {
    const base = {
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        ores_ergasias: 0,
        cards_ores_ergasias: 0
    };

    assert.equal(resolveCanonicalRepoDayCountState({
        row: { ...base, ores_ergasias: 1 },
        dailyProfile: FULL
    }).countsAsRepo, false);
    assert.equal(resolveCanonicalRepoDayCountState({
        row: { ...base, cards_ores_ergasias: 1 },
        dailyProfile: FULL
    }).countsAsRepo, false);
    assert.equal(resolveCanonicalRepoDayCountState({
        row: base,
        dailyProfile: FULL,
        hasUnresolvedCardPair: true
    }).countsAsRepo, false);
});

test('category/repo conflict and unresolved profile fail closed with diagnostics', () => {
    const conflict = resolveCanonicalRepoDayCountState({
        row: {
            kathgoria_ergasias: 'ΕΡΓ',
            repo: false,
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: true,
            ores_ergasias_apologistika: 0,
            cards_ores_ergasias: 0
        },
        dailyProfile: FULL
    });
    const unresolved = resolveCanonicalRepoDayCountState({
        row: { kathgoria_ergasias: 'ΑΝ', repo: true },
        dailyProfile: {}
    });

    assert.equal(conflict.countsAsRepo, false);
    assert.deepEqual(conflict.diagnostics, ['CATEGORY_REPO_CONFLICT']);
    assert.equal(unresolved.countsAsRepo, false);
    assert.deepEqual(unresolved.diagnostics, ['DAILY_EMPLOYMENT_PROFILE_UNRESOLVED']);
});

test('approval and reusable metadata cannot affect canonical counting', () => {
    const row = {
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        ores_ergasias: 0,
        cards_ores_ergasias: 0
    };
    const baseline = resolveCanonicalRepoDayCountState({ row, dailyProfile: FULL });
    const withMetadata = resolveCanonicalRepoDayCountState({
        row: {
            ...row,
            reuse_status: 'ACTIVE',
            policy_status: 'RESOLVED_BY_POLICY',
            decision_type: 'APPROVE_PROPOSAL',
            approval_id: 'synthetic-approval',
            fingerprint: 'synthetic-fingerprint'
        },
        dailyProfile: FULL
    });

    assert.deepEqual(withMetadata, baseline);
});

test('persisted transfer moves repo placement without changing weekly count', () => {
    const before = resolveWeeklyActualRepoCount([
        {
            row: {
                kathgoria_ergasias: 'ΑΝ',
                repo: true,
                ores_ergasias: 0,
                cards_ores_ergasias: 0
            },
            dailyProfile: FULL
        },
        {
            row: {
                kathgoria_ergasias: 'ΕΡΓ',
                repo: false,
                ores_ergasias: 8,
                cards_ores_ergasias: 8
            },
            dailyProfile: FULL
        }
    ]);
    const after = resolveWeeklyActualRepoCount([
        {
            row: {
                kathgoria_ergasias: 'ΑΝ',
                repo: true,
                ores_ergasias: 0,
                kathgoria_ergasias_apologistika: 'ΕΡΓ',
                repo_apologistika: false,
                ores_ergasias_apologistika: 8,
                cards_ores_ergasias: 8
            },
            dailyProfile: FULL
        },
        {
            row: {
                kathgoria_ergasias: 'ΕΡΓ',
                repo: false,
                ores_ergasias: 8,
                kathgoria_ergasias_apologistika: 'ΑΝ',
                repo_apologistika: true,
                ores_ergasias_apologistika: 0,
                cards_ores_ergasias: 0
            },
            dailyProfile: FULL
        }
    ]);

    assert.equal(before.actualRepo, 1);
    assert.deepEqual(before.dayStates.map((day) => day.countsAsRepo), [true, false]);
    assert.equal(after.actualRepo, 1);
    assert.deepEqual(after.dayStates.map((day) => day.countsAsRepo), [false, true]);
});
