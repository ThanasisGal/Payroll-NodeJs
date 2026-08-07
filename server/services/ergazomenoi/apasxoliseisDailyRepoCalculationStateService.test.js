const assert = require('node:assert/strict');
const test = require('node:test');

const {
    DIAGNOSTIC,
    resolveDailyRepoCalculationState
} = require('./apasxoliseisDailyRepoCalculationStateService');

function expected({
    expectedRepoCategory,
    effectiveCategory,
    effectiveRepo,
    provenance,
    diagnostics = []
}) {
    return {
        expectedRepoCategory,
        effectiveCategory,
        effectiveRepo,
        provenance,
        diagnostics
    };
}

test('FULL profile resolves declared repo with explicit ΑΝ context', () => {
    const resolved = resolveDailyRepoCalculationState({
        row: { kathgoria_ergasias: 'ΑΝ', repo: true },
        dailyProfile: { typos_apasxolhshs: 'PLHRHS' }
    });

    assert.deepEqual(resolved, expected({
        expectedRepoCategory: 'ΑΝ',
        effectiveCategory: 'ΑΝ',
        effectiveRepo: true,
        provenance: 'DECLARED_CURRENT'
    }));
});

test('FULL profile preserves material apologistika negative override', () => {
    const resolved = resolveDailyRepoCalculationState({
        row: {
            kathgoria_ergasias: 'ΑΝ',
            repo: true,
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: false
        },
        dailyProfile: { kathestos_apasxolhshs: '0' }
    });

    assert.deepEqual(resolved, expected({
        expectedRepoCategory: 'ΑΝ',
        effectiveCategory: 'ΕΡΓ',
        effectiveRepo: false,
        provenance: 'APOLOGISTIKA_CURRENT'
    }));
});

test('FULL profile preserves material apologistika target repo', () => {
    const resolved = resolveDailyRepoCalculationState({
        row: {
            kathgoria_ergasias: 'ΕΡΓ',
            repo: false,
            kathgoria_ergasias_apologistika: 'ΑΝ',
            repo_apologistika: true
        },
        dailyProfile: { typos_apasxolhshs: 'FULL_TIME' }
    });

    assert.deepEqual(resolved, expected({
        expectedRepoCategory: 'ΑΝ',
        effectiveCategory: 'ΑΝ',
        effectiveRepo: true,
        provenance: 'APOLOGISTIKA_CURRENT'
    }));
});

test('MERIKH profile interprets ΜΕ through explicit daily context', () => {
    const resolved = resolveDailyRepoCalculationState({
        row: { kathgoria_ergasias: 'ΜΕ', repo: false },
        dailyProfile: { typos_apasxolhshs: 'MERIKH' }
    });

    assert.deepEqual(resolved, expected({
        expectedRepoCategory: 'ΜΕ',
        effectiveCategory: 'ΜΕ',
        effectiveRepo: true,
        provenance: 'DECLARED_CURRENT'
    }));
});

test('MERIKH profile preserves material apologistika negative override', () => {
    const resolved = resolveDailyRepoCalculationState({
        row: {
            kathgoria_ergasias: 'ΜΕ',
            repo: true,
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: false
        },
        dailyProfile: { kathestos_apasxolhshs: '1' }
    });

    assert.deepEqual(resolved, expected({
        expectedRepoCategory: 'ΜΕ',
        effectiveCategory: 'ΕΡΓ',
        effectiveRepo: false,
        provenance: 'APOLOGISTIKA_CURRENT'
    }));
});

test('EK_PERITROPHS profile uses ΜΕ and resolves a material target repo', () => {
    for (const row of [
        { kathgoria_ergasias: 'ΜΕ', repo: false },
        {
            kathgoria_ergasias: 'ΕΡΓ',
            repo: false,
            kathgoria_ergasias_apologistika: 'ΜΕ',
            repo_apologistika: true
        }
    ]) {
        const resolved = resolveDailyRepoCalculationState({
            row,
            dailyProfile: { typos_apasxolhshs: 'EK_PERITROPHS' }
        });

        assert.equal(resolved.expectedRepoCategory, 'ΜΕ');
        assert.equal(resolved.effectiveRepo, true);
        assert.deepEqual(resolved.diagnostics, []);
    }
});

test('existing numeric work-terms fallback remains in parity with profile helper', () => {
    const full = resolveDailyRepoCalculationState({
        row: { kathgoria_ergasias: 'ΑΝ', repo: false },
        dailyProfile: { ores_ergasias_ebdomadas: 40 }
    });
    const partial = resolveDailyRepoCalculationState({
        row: { kathgoria_ergasias: 'ΜΕ', repo: false },
        dailyProfile: {
            hmeres_ergasias_ebdomadas: 5,
            mo_oron_hmerhsias_ergasias: 4
        }
    });

    assert.equal(full.expectedRepoCategory, 'ΑΝ');
    assert.equal(full.effectiveRepo, true);
    assert.equal(partial.expectedRepoCategory, 'ΜΕ');
    assert.equal(partial.effectiveRepo, true);
});

test('missing, unknown, incomplete and conflicting profiles fail closed', () => {
    const profiles = [
        undefined,
        {},
        { typos_apasxolhshs: 'UNKNOWN' },
        { hmeres_ergasias_ebdomadas: 5 },
        { kathestos_apasxolhshs: '0', typos_apasxolhshs: 'MERIKH' },
        []
    ];

    for (const dailyProfile of profiles) {
        const resolved = resolveDailyRepoCalculationState({
            row: { kathgoria_ergasias: 'ΑΝ', repo: true },
            dailyProfile
        });

        assert.deepEqual(resolved, expected({
            expectedRepoCategory: null,
            effectiveCategory: null,
            effectiveRepo: null,
            provenance: null,
            diagnostics: [DIAGNOSTIC.DAILY_EMPLOYMENT_PROFILE_UNRESOLVED]
        }));
    }
});

test('canonical category/repo conflict passes through unchanged', () => {
    const resolved = resolveDailyRepoCalculationState({
        row: {
            kathgoria_ergasias: 'ΕΡΓ',
            repo: false,
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: true
        },
        dailyProfile: { typos_apasxolhshs: 'PLHRHS' }
    });

    assert.deepEqual(resolved, expected({
        expectedRepoCategory: 'ΑΝ',
        effectiveCategory: 'ΕΡΓ',
        effectiveRepo: null,
        provenance: 'APOLOGISTIKA_CURRENT',
        diagnostics: ['CATEGORY_REPO_CONFLICT']
    }));
});

test('approval, reusable, decision and fingerprint metadata cannot affect CURRENT', () => {
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

test('adapter does not mutate row or daily profile and returns frozen output', () => {
    const row = {
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        nested: { marker: 'row' }
    };
    const dailyProfile = {
        typos_apasxolhshs: 'MERIKH',
        nested: { marker: 'profile' }
    };
    const rowBefore = structuredClone(row);
    const profileBefore = structuredClone(dailyProfile);

    const resolved = resolveDailyRepoCalculationState({ row, dailyProfile });

    assert.deepEqual(row, rowBefore);
    assert.deepEqual(dailyProfile, profileBefore);
    assert.equal(Object.isFrozen(resolved), true);
    assert.equal(Object.isFrozen(resolved.diagnostics), true);
});

test('same semantic input produces deterministic output', () => {
    const input = {
        row: {
            kathgoria_ergasias: 'ΕΡΓ',
            repo: false,
            kathgoria_ergasias_apologistika: 'ΜΕ',
            repo_apologistika: true
        },
        dailyProfile: { kathestos_apasxolhshs: '2' }
    };

    assert.deepEqual(
        resolveDailyRepoCalculationState(input),
        resolveDailyRepoCalculationState(structuredClone(input))
    );
});
