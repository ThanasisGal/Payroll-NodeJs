const MODE = Object.freeze({
    CURRENT: 'CURRENT',
    PROPOSED: 'PROPOSED'
});

const PROVENANCE = Object.freeze({
    DECLARED_CURRENT: 'DECLARED_CURRENT',
    APOLOGISTIKA_CURRENT: 'APOLOGISTIKA_CURRENT',
    PROPOSED_PROJECTION: 'PROPOSED_PROJECTION'
});

const DIAGNOSTIC = Object.freeze({
    INVALID_MODE: 'INVALID_MODE',
    INVALID_ROW: 'INVALID_ROW',
    INVALID_CATEGORY: 'INVALID_CATEGORY',
    INVALID_REPO_VALUE: 'INVALID_REPO_VALUE',
    INVALID_EXPECTED_REPO_CATEGORY: 'INVALID_EXPECTED_REPO_CATEGORY',
    INVALID_PROPOSED_VALUES: 'INVALID_PROPOSED_VALUES',
    CATEGORY_REPO_CONFLICT: 'CATEGORY_REPO_CONFLICT'
});

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function category(value) {
    if (value === null || value === undefined) return { ok: true, value: '' };
    if (typeof value !== 'string') return { ok: false, value: null };
    return { ok: true, value: value.trim() };
}

function repoValue(value) {
    if (value === null || value === undefined) return { ok: true, value };
    return typeof value === 'boolean'
        ? { ok: true, value }
        : { ok: false, value: null };
}

function result(effectiveCategory, effectiveRepo, provenance, diagnostics = []) {
    return Object.freeze({
        effectiveCategory,
        effectiveRepo,
        provenance,
        diagnostics: Object.freeze([...diagnostics])
    });
}

function invalid(diagnostic) {
    return result(null, null, null, [diagnostic]);
}

function resolveLayer({
    effectiveCategory,
    explicitRepo,
    expectedRepoCategory,
    provenance,
    categoryIsMaterial
}) {
    const categoryMeansRepo = Boolean(
        expectedRepoCategory && effectiveCategory === expectedRepoCategory
    );
    if (
        categoryIsMaterial &&
        typeof explicitRepo === 'boolean' &&
        explicitRepo !== categoryMeansRepo
    ) {
        return result(effectiveCategory, null, provenance, [DIAGNOSTIC.CATEGORY_REPO_CONFLICT]);
    }
    return result(
        effectiveCategory,
        explicitRepo === true || categoryMeansRepo,
        provenance
    );
}

function resolveCurrent(row, expectedRepoCategory) {
    const declaredCategory = category(row.kathgoria_ergasias);
    const declaredRepo = repoValue(row.repo);
    const apologistikaCategory = category(row.kathgoria_ergasias_apologistika);
    const apologistikaRepo = repoValue(row.repo_apologistika);
    if (!declaredCategory.ok || !apologistikaCategory.ok) {
        return invalid(DIAGNOSTIC.INVALID_CATEGORY);
    }
    if (!declaredRepo.ok || !apologistikaRepo.ok) {
        return invalid(DIAGNOSTIC.INVALID_REPO_VALUE);
    }

    const hasMaterialApologistikaCategory = apologistikaCategory.value !== '';
    const hasMaterialApologistikaRepo = apologistikaRepo.value === true;
    if (hasMaterialApologistikaCategory || hasMaterialApologistikaRepo) {
        const effectiveCategory = hasMaterialApologistikaCategory
            ? apologistikaCategory.value
            : declaredCategory.value;
        const explicitRepo = hasMaterialApologistikaCategory
            ? apologistikaRepo.value
            : true;
        return resolveLayer({
            effectiveCategory,
            explicitRepo,
            expectedRepoCategory,
            provenance: PROVENANCE.APOLOGISTIKA_CURRENT,
            categoryIsMaterial: hasMaterialApologistikaCategory
        });
    }

    return resolveLayer({
        effectiveCategory: declaredCategory.value,
        explicitRepo: declaredRepo.value,
        expectedRepoCategory,
        provenance: PROVENANCE.DECLARED_CURRENT,
        categoryIsMaterial: false
    });
}

function resolveProposed(current, proposedValues, expectedRepoCategory) {
    if (!isPlainObject(proposedValues)) return invalid(DIAGNOSTIC.INVALID_PROPOSED_VALUES);
    const hasCategory = Object.hasOwn(proposedValues, 'kathgoria_ergasias_apologistika');
    const hasRepo = Object.hasOwn(proposedValues, 'repo_apologistika');
    if (!hasCategory || !hasRepo) return invalid(DIAGNOSTIC.INVALID_PROPOSED_VALUES);

    const proposedCategory = category(proposedValues.kathgoria_ergasias_apologistika);
    const proposedRepo = repoValue(proposedValues.repo_apologistika);
    if (!proposedCategory.ok || proposedCategory.value === '') {
        return invalid(DIAGNOSTIC.INVALID_CATEGORY);
    }
    if (!proposedRepo.ok || typeof proposedRepo.value !== 'boolean') {
        return invalid(DIAGNOSTIC.INVALID_REPO_VALUE);
    }

    const effectiveCategory = hasCategory && proposedCategory.value !== ''
        ? proposedCategory.value
        : current.effectiveCategory;
    const explicitRepo = hasRepo ? proposedRepo.value : undefined;
    return resolveLayer({
        effectiveCategory,
        explicitRepo,
        expectedRepoCategory,
        provenance: PROVENANCE.PROPOSED_PROJECTION,
        categoryIsMaterial: hasCategory && proposedCategory.value !== ''
    });
}

function resolveEffectiveRepoState({
    row,
    mode = MODE.CURRENT,
    expectedRepoCategory = null,
    proposedValues
} = {}) {
    if (!Object.values(MODE).includes(mode)) return invalid(DIAGNOSTIC.INVALID_MODE);
    if (!isPlainObject(row)) return invalid(DIAGNOSTIC.INVALID_ROW);

    const normalizedExpectedRepoCategory = category(expectedRepoCategory);
    if (
        !normalizedExpectedRepoCategory.ok ||
        !['', 'ΑΝ', 'ΜΕ'].includes(normalizedExpectedRepoCategory.value)
    ) {
        return invalid(DIAGNOSTIC.INVALID_EXPECTED_REPO_CATEGORY);
    }

    const current = resolveCurrent(row, normalizedExpectedRepoCategory.value);
    if (current.provenance === null || mode === MODE.CURRENT) return current;
    return resolveProposed(current, proposedValues, normalizedExpectedRepoCategory.value);
}

module.exports = {
    MODE,
    PROVENANCE,
    DIAGNOSTIC,
    resolveEffectiveRepoState
};
