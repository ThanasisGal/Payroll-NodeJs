'use strict';

const MAX_TARGETED_SCOPES = 100;

async function loadWeeklyHrStage2TargetedReadGroups({ batchScopes = [], readGroups = {} } = {}) {
    if (!Array.isArray(batchScopes) || batchScopes.length > MAX_TARGETED_SCOPES) {
        throw Object.assign(new Error('Η στοχευμένη παρτίδα υπερβαίνει τα 100 scopes.'),
            { code: 'STAGE2_BULK_BATCH_INVALID', statusCode: 400 });
    }
    const entries = Object.entries(readGroups);
    if (entries.some(([, loader]) => typeof loader !== 'function')) {
        throw new TypeError('Όλες οι ομάδες ανάγνωσης πρέπει να είναι συναρτήσεις.');
    }
    const values = await Promise.all(entries.map(([, loader]) => loader()));
    return Object.fromEntries(entries.map(([name], index) => [name, values[index]]));
}

module.exports = { MAX_TARGETED_SCOPES, loadWeeklyHrStage2TargetedReadGroups };
