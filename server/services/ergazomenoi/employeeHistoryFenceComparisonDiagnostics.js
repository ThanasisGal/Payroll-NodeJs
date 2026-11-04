'use strict';
const crypto = require('node:crypto');
const D = require('./employeeHistoryReferenceDefinitionsService');
// Only fixed technical names may enter logs. Dynamic keys can contain personal
// data or document IDs, so identify them with a keyed, non-reversible label.
const safeNames = new Set(['binding', 'state', 'target', 'employee', 'history', 'references', 'referenceSummary', 'audits',
    'scope', 'reservationId', 'employeeId', 'actorUserId', 'legacyAttemptId', 'fingerprint', 'executionId',
    'team', 'company_kod', 'kodikos', '_id', 'diagnostics', 'mutationSource', 'employeeScope',
    'currentBefore', 'historyBefore', 'historyAfter', 'employee_profile_mutation_sequence', 'history_reference_fence',
    'amount', 'updatedAt', 'createdAt', 'effective_profile_istoriko_id', 'previous_profile_istoriko_id', ...D.SUPPORTED_COLLECTIONS]);
const type = value => value?._bsontype || (Array.isArray(value) ? 'array' : value instanceof Date ? 'date' :
    Buffer.isBuffer(value) ? 'buffer' : value === null ? 'null' : typeof value);
function firstDifference(left, right, path, equal, secret, ordered = true) {
    if (equal(left, right)) return null;
    if (type(left) !== type(right)) return { path, type: 'TYPE' };
    if (!left || typeof left !== 'object' || left._bsontype || left instanceof Date || Buffer.isBuffer(left))
        return { path, type: 'VALUE' };
    if (Array.isArray(left)) {
        if (left.length !== right.length) return { path: path + '.length', type: left.length < right.length ? 'EXTRA' : 'MISSING' };
        if (ordered && left.every(item => item?._id) && right.every(item => item?._id)) {
            const before = left.map(item => String(item._id)), after = right.map(item => String(item._id));
            if (before.some((id, index) => id !== after[index]) && [...before].sort().join() === [...after].sort().join())
                return { path, type: 'ORDER' };
        }
        for (let index = 0; index < left.length; index++) {
            const difference = firstDifference(left[index], right[index], path + '[' + index + ']', equal, secret, ordered);
            if (difference) return difference;
        }
    } else {
        const before = Object.keys(left), after = Object.keys(right);
        if (ordered && before.length === after.length && before.every(key => Object.hasOwn(right, key)) &&
            before.some((key, index) => key !== after[index])) return { path, type: 'ORDER' };
        for (const key of new Set([...before, ...after])) {
            const label = safeNames.has(key) ? '.' + key : '[field:' +
                crypto.createHmac('sha256', secret).update(key).digest('hex').slice(0, 24) + ']';
            if (!Object.hasOwn(left, key)) return { path: path + label, type: 'EXTRA' };
            if (!Object.hasOwn(right, key)) return { path: path + label, type: 'MISSING' };
            const difference = firstDifference(left[key], right[key], path + label, equal, secret, ordered);
            if (difference) return difference;
        }
    }
    return { path, type: 'VALUE' };
}
function describe({ savedBinding, binding, before, after, bindingChanged, stateChanged, bindingEqual, stateEqual, secret }) {
    const count = state => [state.employee ? 1 : 0, state.history.length, state.audits.length,
        ...D.SUPPORTED_COLLECTIONS.map(name => state.references[name]?.length || 0)];
    const beforeCounts = count(before), afterCounts = count(after);
    return {
        BINDING_CHANGED: bindingChanged, STATE_CHANGED: stateChanged,
        firstDifference: bindingChanged ? firstDifference(savedBinding, binding, 'binding', bindingEqual, secret, false) :
            firstDifference(before, after, 'state', stateEqual, secret),
        DOCUMENT_COUNT_CHANGED: beforeCounts.some((value, index) => value !== afterCounts[index]),
        DOCUMENT_CONTENT_CHANGED: ['employee', 'history', 'references', 'audits'].some(key => !stateEqual(before[key], after[key]))
    };
}
module.exports = { describe };
