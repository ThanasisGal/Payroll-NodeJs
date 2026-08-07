const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MODE,
    PROVENANCE,
    DIAGNOSTIC,
    resolveEffectiveRepoState
} = require('./apasxoliseisEffectiveRepoStateService');

const fullContext = Object.freeze({ expectedRepoCategory: 'ΑΝ' });
const partialContext = Object.freeze({ expectedRepoCategory: 'ΜΕ' });

function resolve(row, context = {}) {
    return resolveEffectiveRepoState({ row, ...context });
}

function assertState(actual, category, repo, provenance, diagnostics = []) {
    assert.deepStrictEqual(actual, {
        effectiveCategory: category,
        effectiveRepo: repo,
        provenance,
        diagnostics
    });
}

test('CURRENT resolves declared full-time repo and declared work', () => {
    assertState(
        resolve({ kathgoria_ergasias: 'ΑΝ', repo: true }, fullContext),
        'ΑΝ',
        true,
        PROVENANCE.DECLARED_CURRENT
    );
    assertState(
        resolve({ kathgoria_ergasias: 'ΕΡΓ', repo: false }, fullContext),
        'ΕΡΓ',
        false,
        PROVENANCE.DECLARED_CURRENT
    );
});

test('CURRENT material apologistika source is a negative override over declared repo', () => {
    assertState(resolve({
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false
    }, fullContext), 'ΕΡΓ', false, PROVENANCE.APOLOGISTIKA_CURRENT);
});

test('CURRENT material apologistika target overrides declared work', () => {
    assertState(resolve({
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true
    }, fullContext), 'ΑΝ', true, PROVENANCE.APOLOGISTIKA_CURRENT);
    assertState(resolve({
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        kathgoria_ergasias_apologistika: 'ΜΕ',
        repo_apologistika: true
    }, partialContext), 'ΜΕ', true, PROVENANCE.APOLOGISTIKA_CURRENT);
});

test('CURRENT honors tri-state apologistika repo semantics', () => {
    const base = { kathgoria_ergasias: 'ΑΝ', repo: true };
    assertState(resolve({
        ...base,
        kathgoria_ergasias_apologistika: '',
        repo_apologistika: true
    }, fullContext), 'ΑΝ', true, PROVENANCE.APOLOGISTIKA_CURRENT);
    for (const repoApologistika of [false, null, undefined]) {
        assertState(resolve({
            ...base,
            kathgoria_ergasias_apologistika: '',
            repo_apologistika: repoApologistika
        }, fullContext), 'ΑΝ', true, PROVENANCE.DECLARED_CURRENT);
    }
    assertState(resolve({
        ...base,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false
    }, fullContext), 'ΕΡΓ', false, PROVENANCE.APOLOGISTIKA_CURRENT);
});

test('repo category interpretation requires explicit context', () => {
    assertState(resolve({ kathgoria_ergasias: 'ΑΝ', repo: false }, fullContext),
        'ΑΝ', true, PROVENANCE.DECLARED_CURRENT);
    assertState(resolve({ kathgoria_ergasias: 'ΜΕ', repo: false }, partialContext),
        'ΜΕ', true, PROVENANCE.DECLARED_CURRENT);
    assertState(resolve({ kathgoria_ergasias: 'ΜΕ', repo: false }),
        'ΜΕ', false, PROVENANCE.DECLARED_CURRENT);
    assertState(resolve({ kathgoria_ergasias: 'ΜΕ', repo: true }),
        'ΜΕ', true, PROVENANCE.DECLARED_CURRENT);
});

test('PROPOSED is an explicit pure overlay for source and target', () => {
    const sourceRow = { kathgoria_ergasias: 'ΑΝ', repo: true };
    const sourceProposal = {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false
    };
    const targetRow = { kathgoria_ergasias: 'ΕΡΓ', repo: false };
    const targetProposal = {
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true
    };
    const partialProposal = {
        kathgoria_ergasias_apologistika: 'ΜΕ',
        repo_apologistika: true
    };
    const sourceBefore = structuredClone(sourceRow);
    const sourceProposalBefore = structuredClone(sourceProposal);
    const targetBefore = structuredClone(targetRow);
    const targetProposalBefore = structuredClone(targetProposal);
    const partialProposalBefore = structuredClone(partialProposal);

    assertState(resolve(sourceRow, {
        ...fullContext,
        mode: MODE.PROPOSED,
        proposedValues: sourceProposal
    }), 'ΕΡΓ', false, PROVENANCE.PROPOSED_PROJECTION);
    assertState(resolve(targetRow, {
        ...fullContext,
        mode: MODE.PROPOSED,
        proposedValues: targetProposal
    }), 'ΑΝ', true, PROVENANCE.PROPOSED_PROJECTION);
    assertState(resolve(targetRow, {
        ...partialContext,
        mode: MODE.PROPOSED,
        proposedValues: partialProposal
    }), 'ΜΕ', true, PROVENANCE.PROPOSED_PROJECTION);

    assert.deepStrictEqual(sourceRow, sourceBefore);
    assert.deepStrictEqual(sourceProposal, sourceProposalBefore);
    assert.deepStrictEqual(targetRow, targetBefore);
    assert.deepStrictEqual(targetProposal, targetProposalBefore);
    assert.deepStrictEqual(partialProposal, partialProposalBefore);
});

test('approval, reusable, decision and fingerprint metadata cannot affect CURRENT', () => {
    const base = {
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false
    };
    const expected = resolve(base, fullContext);
    assert.deepStrictEqual(resolve({
        ...base,
        reuse_status: 'ACTIVE',
        decision_status: 'RECORDED',
        approval_id: 'ignored-approval',
        fingerprint: 'ignored-fingerprint',
        reusable_decision: { status: 'RESOLVED_BY_POLICY' }
    }, fullContext), expected);
});

test('same semantic input is deterministic', () => {
    const input = {
        row: {
            kathgoria_ergasias: 'ΕΡΓ',
            repo: false,
            kathgoria_ergasias_apologistika: 'ΑΝ',
            repo_apologistika: true
        },
        mode: MODE.CURRENT,
        expectedRepoCategory: 'ΑΝ'
    };
    assert.deepStrictEqual(
        resolveEffectiveRepoState(structuredClone(input)),
        resolveEffectiveRepoState(structuredClone(input))
    );
});

test('conflicting material category and repo fail closed with a diagnostic', () => {
    assertState(resolve({
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: true
    }, fullContext), 'ΕΡΓ', null, PROVENANCE.APOLOGISTIKA_CURRENT,
    [DIAGNOSTIC.CATEGORY_REPO_CONFLICT]);
    assertState(resolve({
        kathgoria_ergasias: 'ΕΡΓ',
        repo: false,
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: false
    }, fullContext), 'ΑΝ', null, PROVENANCE.APOLOGISTIKA_CURRENT,
    [DIAGNOSTIC.CATEGORY_REPO_CONFLICT]);
});

test('invalid input fails closed without permissive coercion', () => {
    for (const row of [null, undefined, [], 'row']) {
        assertState(resolve(row), null, null, null, [DIAGNOSTIC.INVALID_ROW]);
    }
    assertState(resolve({ kathgoria_ergasias: 1, repo: false }),
        null, null, null, [DIAGNOSTIC.INVALID_CATEGORY]);
    assertState(resolve({ kathgoria_ergasias: 'ΕΡΓ', repo: 'false' }),
        null, null, null, [DIAGNOSTIC.INVALID_REPO_VALUE]);
    assertState(resolve({ kathgoria_ergasias: 'ΕΡΓ', repo: false }, {
        expectedRepoCategory: 1
    }), null, null, null, [DIAGNOSTIC.INVALID_EXPECTED_REPO_CATEGORY]);
    assertState(resolve({ kathgoria_ergasias: 'ΕΡΓ', repo: false }, {
        expectedRepoCategory: 'ΕΡΓ'
    }), null, null, null, [DIAGNOSTIC.INVALID_EXPECTED_REPO_CATEGORY]);
    assertState(resolveEffectiveRepoState({
        row: { kathgoria_ergasias: 'ΕΡΓ', repo: false },
        mode: 'APPLIED'
    }), null, null, null, [DIAGNOSTIC.INVALID_MODE]);
    for (const proposedValues of [
        null,
        undefined,
        [],
        {},
        'proposal',
        { kathgoria_ergasias_apologistika: 'ΑΝ' },
        { repo_apologistika: true }
    ]) {
        assertState(resolve({ kathgoria_ergasias: 'ΕΡΓ', repo: false }, {
            ...fullContext,
            mode: MODE.PROPOSED,
            proposedValues
        }), null, null, null, [DIAGNOSTIC.INVALID_PROPOSED_VALUES]);
    }
    assertState(resolve({ kathgoria_ergasias: 'ΕΡΓ', repo: false }, {
        ...fullContext,
        mode: MODE.PROPOSED,
        proposedValues: {
            kathgoria_ergasias_apologistika: 'ΑΝ',
            repo_apologistika: 'true'
        }
    }), null, null, null, [DIAGNOSTIC.INVALID_REPO_VALUE]);
    assertState(resolve({ kathgoria_ergasias: 'ΕΡΓ', repo: false }, {
        ...fullContext,
        mode: MODE.PROPOSED,
        proposedValues: {
            kathgoria_ergasias_apologistika: '',
            repo_apologistika: true
        }
    }), null, null, null, [DIAGNOSTIC.INVALID_CATEGORY]);
});
