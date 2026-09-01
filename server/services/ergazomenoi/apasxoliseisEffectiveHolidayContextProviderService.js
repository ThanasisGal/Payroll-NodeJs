'use strict';

const mongoose = require('mongoose');
const {
    employeeKey,
    preloadBorrowedEmploymentProfileContexts,
    resolveEffectiveEmploymentProfileForReviewDate
} = require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const {
    buildNoCardsDisplayContext
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');

const HOLIDAY_CONTEXT_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    BLOCKED: 'BLOCKED'
});

const HOLIDAY_CONTEXT_BLOCK_REASON = Object.freeze({
    EFFECTIVE_COMPANY_MISSING: 'EFFECTIVE_HOLIDAY_COMPANY_MISSING',
    CONTEXT_NOT_PRELOADED: 'EFFECTIVE_HOLIDAY_CONTEXT_NOT_PRELOADED'
});

function canonicalCompanyId(value) {
    const id = String(value || '').trim();
    return mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id).toHexString()
        : id;
}

function dateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function periodDateKeys(periodStart, periodEnd) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    const keys = [];
    for (let date = start; date <= end; date = new Date(date.getTime() + 86400000)) {
        keys.push(date.toISOString().slice(0, 10));
    }
    return keys;
}

function blockedResult(effectiveProfile, reason) {
    return Object.freeze({
        status: HOLIDAY_CONTEXT_STATUS.BLOCKED,
        blocked: true,
        resolution_reason: reason,
        effectiveProfile,
        effective_company_id: null,
        holidayContext: null
    });
}

async function preloadEffectiveHolidayContextProvider({
    team,
    employees = [],
    etos,
    periodStart,
    periodEnd,
    normalHistoryByEmployeeKey = new Map(),
    borrowedProfileContexts,
    models = {},
    preloadBorrowedContexts = preloadBorrowedEmploymentProfileContexts,
    loadHolidayContext = buildNoCardsDisplayContext
} = {}) {
    const borrowedContexts = borrowedProfileContexts instanceof Map
        ? borrowedProfileContexts
        : await preloadBorrowedContexts({ team, employees, models });
    const resolvedProfiles = new Map();
    const companyIds = new Set();
    for (const employee of employees) {
        const key = employeeKey(employee);
        const normalHistory = normalHistoryByEmployeeKey.get(key) || [];
        for (const reviewDate of periodDateKeys(periodStart, periodEnd)) {
            const effectiveProfile = resolveEffectiveEmploymentProfileForReviewDate({
                reviewDate,
                normalEmployee: employee,
                normalHistory,
                borrowedContext: borrowedContexts.get(key) || null
            });
            resolvedProfiles.set(`${key}|${reviewDate}`, effectiveProfile);
            if (effectiveProfile?.resolution_blocked !== true) {
                const effectiveCompanyId = canonicalCompanyId(
                    effectiveProfile?.profile_company_id);
                if (effectiveCompanyId) companyIds.add(effectiveCompanyId);
            }
        }
    }

    const holidayContexts = new Map(await Promise.all([...companyIds].map(async (companyId) => [
        companyId,
        await loadHolidayContext({
            team,
            companyId,
            etos,
            periodStart,
            periodEnd,
            companiesModel: models.companiesModel,
            argiesModel: models.argiesModel
        })
    ])));

    return Object.freeze({
        resolveForEmployeeDate({ employee, reviewDate, normalHistory = [] } = {}) {
            const key = employeeKey(employee);
            const reviewDateKey = dateKey(reviewDate);
            const effectiveProfile = resolvedProfiles.get(`${key}|${reviewDateKey}`) ||
                resolveEffectiveEmploymentProfileForReviewDate({
                    reviewDate,
                    normalEmployee: employee,
                    normalHistory,
                    borrowedContext: borrowedContexts.get(key) || null
                });
            if (effectiveProfile?.resolution_blocked === true) {
                return blockedResult(effectiveProfile, effectiveProfile.resolution_reason);
            }
            const effectiveCompanyId = canonicalCompanyId(effectiveProfile?.profile_company_id);
            if (!effectiveCompanyId) {
                return blockedResult(effectiveProfile,
                    HOLIDAY_CONTEXT_BLOCK_REASON.EFFECTIVE_COMPANY_MISSING);
            }
            const holidayContext = holidayContexts.get(effectiveCompanyId);
            if (!holidayContext) {
                return blockedResult(effectiveProfile,
                    HOLIDAY_CONTEXT_BLOCK_REASON.CONTEXT_NOT_PRELOADED);
            }
            return Object.freeze({
                status: HOLIDAY_CONTEXT_STATUS.RESOLVED,
                blocked: false,
                resolution_reason: null,
                effectiveProfile,
                effective_company_id: effectiveCompanyId,
                holidayContext
            });
        }
    });
}

module.exports = {
    HOLIDAY_CONTEXT_STATUS,
    HOLIDAY_CONTEXT_BLOCK_REASON,
    preloadEffectiveHolidayContextProvider
};
