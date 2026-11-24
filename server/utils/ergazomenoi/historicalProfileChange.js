'use strict';

const { byField, workTerms, createHistoricalComparison } = require('./historicalProfileComparison');
const { registryEntry } = require('../../services/ergazomenoi/employeeHistoryCorrectionFieldRegistryService');
const { buildCanonicalWorkTermsSnapshotFields } = require('./getOrarioTermsForDate');
const { resolveEmploymentTypeSemantics } = require('./employmentTypeSemantics');

function validProfileChangeShape(change) {
    if (!change || typeof change !== 'object' || Array.isArray(change) ||
        Object.keys(change).some(key => !['kind','effectiveFrom','correctedTerms','targetHistoryId'].includes(key)) ||
        !['NEW_CHANGE','CORRECT_SAVED_ERROR'].includes(change.kind) ||
        !change.correctedTerms || typeof change.correctedTerms !== 'object' || Array.isArray(change.correctedTerms)) return false;
    const names = Object.keys(change.correctedTerms);
    return names.length > 0 && names.every(field => byField.get(field)?.writable === true);
}

// Normalize only declared changes, retaining the established coherent workweek
// context. Nothing here allocates dates, authenticates, or loads old History.
function normalizeProfileChangeTerms(values, current = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length ||
        Object.keys(values).some(field => byField.get(field)?.writable !== true)) return null;
    const comparison = createHistoricalComparison(current);
    let result;
    try {
        result = Object.fromEntries(Object.entries(values).map(([field,value]) => [field,comparison.normalize(field,value)]));
        for (const field of workTerms.filter(field => field !== 'typos_ebdomadas'))
            if (Object.hasOwn(values,field) && (!Number.isFinite(result[field]) || result[field] <= 0)) return null;
        for (const field of workTerms) if (!Object.hasOwn(result,field)) result[field] = comparison.normalize(field,current[field]);
        const days = result.hmeres_ergasias_ebdomadas, weekly = result.ores_ergasias_ebdomadas, daily = result.mo_oron_hmerhsias_ergasias;
        const week = buildCanonicalWorkTermsSnapshotFields({hmeres_ergasias_ebdomadas:days}).typos_ebdomadas;
        if (!result.typos_ebdomadas && days) result.typos_ebdomadas = week;
        // Missing values belong to the existing proposed-row completeness check.
        // Present but contradictory work terms never become an eligible deferral.
        if (days > 0 && weekly > 0 && daily > 0) {
            if (![5,6].includes(days) || weekly > 80) return null;
            registryEntry('WORK_DAYS').normalize(days);
            registryEntry('WEEKLY_HOURS').normalize(weekly);
            registryEntry('DAILY_HOURS').normalize(daily);
            if (Math.abs(days*daily-weekly) > days*0.005+1e-8 ||
                [5,6].includes(days) && result.typos_ebdomadas !== week) return null;
        }
        const aliases = ['kathestos_apasxolhshs','typos_apasxolhshs'];
        if (aliases.some(field => Object.hasOwn(result,field))) {
            const supplied = aliases.filter(field => Object.hasOwn(result,field));
            const resolved = supplied.map(field => resolveEmploymentTypeSemantics({[field]:result[field]}));
            if (resolved.some(value => value.status !== 'RESOLVED') || resolved.some(value => value.effectiveValue !== resolved[0].effectiveValue)) return null;
            // Both persisted aliases are derived by the existing controller too.
            for (const field of aliases) result[field] = resolved[0].effectiveValue;
        }
        return result;
    } catch { return null; }
}

function normalizeProfileChange(change, current) {
    if (!validProfileChangeShape(change)) return null;
    const correctedTerms = normalizeProfileChangeTerms(change.correctedTerms,current);
    return correctedTerms ? {...change,correctedTerms} : null;
}

module.exports = { validProfileChangeShape, normalizeProfileChangeTerms, normalizeProfileChange };
