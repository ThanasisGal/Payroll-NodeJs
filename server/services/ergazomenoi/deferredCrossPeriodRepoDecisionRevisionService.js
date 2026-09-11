'use strict';

function revisionError(code, message) {
    return Object.assign(new Error(message || code), { code, statusCode: 409 });
}

function id(value) { return String(value?._id || value?.id || '').trim(); }
function fingerprint(value) { return String(value?.resolution_fingerprint || '').trim(); }
function revision(value) { return Number(value?.resolution_revision || 1); }

function resolveEffectiveDeferredCrossPeriodDecision(decisions = [], deferredWeekId = '') {
    const matching = (Array.isArray(decisions) ? decisions : [decisions]).filter((decision) =>
        decision && decision.resolution_kind === 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION' &&
        decision.resolution_status === 'RESOLVED' &&
        (!deferredWeekId || String(decision.deferred_week_id || '') === String(deferredWeekId)));
    if (!matching.length) return null;
    const ordered = [...matching].sort((left, right) => revision(left) - revision(right));
    const revisions = new Set();
    for (let index = 0; index < ordered.length; index += 1) {
        const current = ordered[index];
        const currentRevision = revision(current);
        if (!Number.isSafeInteger(currentRevision) || currentRevision !== index + 1 || revisions.has(currentRevision)) {
            throw revisionError('DEFERRED_CROSS_PERIOD_RESOLUTION_CHAIN_CONFLICT',
                'Η αλυσίδα διορθώσεων της επιλογής ρεπό είναι αμφίσημη.');
        }
        revisions.add(currentRevision);
        if (index === 0) {
            if (current.supersedes_decision_id || current.supersedes_resolution_fingerprint) {
                throw revisionError('DEFERRED_CROSS_PERIOD_RESOLUTION_CHAIN_CONFLICT',
                    'Η πρώτη επιλογή ρεπό δεν μπορεί να αντικαθιστά προηγούμενη απόφαση.');
            }
            continue;
        }
        const previous = ordered[index - 1];
        if (!id(previous) || String(current.supersedes_decision_id || '') !== id(previous) ||
            String(current.supersedes_resolution_fingerprint || '') !== fingerprint(previous)) {
            throw revisionError('DEFERRED_CROSS_PERIOD_RESOLUTION_CHAIN_CONFLICT',
                'Η αλυσίδα διορθώσεων της επιλογής ρεπό δεν είναι συνεχής.');
        }
    }
    return ordered.at(-1);
}

module.exports = { resolveEffectiveDeferredCrossPeriodDecision };
