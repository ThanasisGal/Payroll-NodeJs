'use strict';

const { SUPPORTED_COLLECTIONS } = require('./employeeHistoryReferenceDefinitionsService');

const REFERENCE_BEHAVIORS = Object.freeze({
    FROZEN_PROVENANCE: 'FROZEN_PROVENANCE',
    LIVE_DEREFERENCE: 'LIVE_DEREFERENCE'
});

// Every protected collection stores the history id as provenance next to the
// effective/frozen facts used by its readers. None of these readers repopulates
// an employment-history document by this id. Keep the declaration exhaustive:
// adding a protected collection without deciding its update semantics fails.
const REFERENCE_SEMANTICS = Object.freeze({
    Prodhlomena_Oraria_Deviations: REFERENCE_BEHAVIORS.FROZEN_PROVENANCE,
    Oraria_Apologistika: REFERENCE_BEHAVIORS.FROZEN_PROVENANCE,
    Apasxoliseis_Period_Frozen_Snapshots: REFERENCE_BEHAVIORS.FROZEN_PROVENANCE,
    Apasxoliseis_Weekly_Canonical_Decisions: REFERENCE_BEHAVIORS.FROZEN_PROVENANCE,
    Apasxoliseis_Weekly_Repo_Transfer_Decisions: REFERENCE_BEHAVIORS.FROZEN_PROVENANCE
});

function referenceBehavior(collectionName) {
    const behavior = REFERENCE_SEMANTICS[collectionName];
    if (!behavior) throw new TypeError(
        `Employee-history reference semantics missing for collection: ${collectionName}`
    );
    return behavior;
}

function assertCompleteReferenceSemantics() {
    const missing = SUPPORTED_COLLECTIONS.filter(name => !REFERENCE_SEMANTICS[name]);
    const extra = Object.keys(REFERENCE_SEMANTICS)
        .filter(name => !SUPPORTED_COLLECTIONS.includes(name));
    if (missing.length || extra.length) {
        throw new TypeError(`Employee-history reference semantics mismatch: missing=${missing.join(',')};extra=${extra.join(',')}`);
    }
    return true;
}

function partitionHistoryUpdateReferences(references = []) {
    assertCompleteReferenceSemantics();
    const frozenProvenance = [];
    const liveDereference = [];
    for (const reference of references) {
        const behavior = referenceBehavior(reference.collection);
        (behavior === REFERENCE_BEHAVIORS.LIVE_DEREFERENCE
            ? liveDereference : frozenProvenance).push(reference);
    }
    return { frozenProvenance, liveDereference };
}

module.exports = { REFERENCE_BEHAVIORS, REFERENCE_SEMANTICS,
    referenceBehavior, assertCompleteReferenceSemantics,
    partitionHistoryUpdateReferences };
