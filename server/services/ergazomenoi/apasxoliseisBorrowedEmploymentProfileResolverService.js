'use strict';

const mongoose = require('mongoose');
const { CompaniesModel } = require('../../models/companies');
const {
    ErgazomenoiModel,
    IstorikoProslhpseonAllagonModel
} = require('../../models/ergazomenoi');
const {
    getOrarioTermsForDate,
    isEffectiveTermsRowForDate,
    normalizeDateOnly
} = require('../../utils/ergazomenoi/getOrarioTermsForDate');

const PROFILE_SOURCE = Object.freeze({
    LOCAL: 'LOCAL_EMPLOYMENT_PROFILE',
    BORROWING: 'BORROWING_COMPANY_EMPLOYMENT_PROFILE'
});

const BLOCK_REASON = Object.freeze({
    INVALID_MAPPING: 'BORROWING_MAPPING_INVALID',
    COMPANY_MISSING: 'BORROWING_COMPANY_MISSING',
    COMPANY_AMBIGUOUS: 'BORROWING_COMPANY_AMBIGUOUS',
    EMPLOYEE_MISSING: 'BORROWING_EMPLOYEE_MISSING',
    EMPLOYEE_AMBIGUOUS: 'BORROWING_EMPLOYEE_AMBIGUOUS',
    HISTORY_OVERLAP: 'BORROWING_HISTORY_OVERLAP',
    PROFILE_MISSING: 'BORROWING_EMPLOYMENT_PROFILE_MISSING',
    WEEKLY_WORKDAYS_INVALID: 'BORROWING_WEEKLY_WORKDAYS_INVALID'
});

function employeeKey(employee = {}) {
    return String(employee._id || `${employee.ypokatasthma || ''}|${employee.kodikos || ''}`);
}

function isExplicitLendingEmployee(employee = {}) {
    return employee.afora_daneismo_ergazomenoy === true &&
        employee.typos_ergodoth_daneismoy === false;
}

function isActiveLoan(reviewDate, employee = {}) {
    if (!isExplicitLendingEmployee(employee)) return false;
    const date = normalizeDateOnly(reviewDate);
    const start = normalizeDateOnly(employee.hmnia_enarxhs_daneismoy);
    const end = normalizeDateOnly(employee.hmnia_lhxhs_daneismoy);
    return Boolean(date && start && date >= start && (!end || date <= end));
}

function matchingHistoryRows(reviewDate, rows = []) {
    return rows.filter((row) => isEffectiveTermsRowForDate(row, reviewDate,
        { includeExplicitFalseWithDates: true }));
}

function blockedProfile(reason, reviewDate, normalEmployee = {}, context = {}) {
    return Object.freeze({
        source: PROFILE_SOURCE.BORROWING,
        resolution_source: PROFILE_SOURCE.BORROWING,
        resolution_blocked: true,
        resolution_reason: reason,
        hmeres_ergasias_ebdomadas: null,
        review_date: normalizeDateOnly(reviewDate)?.toISOString().slice(0, 10) || null,
        profile_company_id: context.borrowingCompanyId || null,
        profile_employee_id: context.borrowingEmployee?._id || null,
        profile_history_id: null,
        loan_interval: {
            from: normalEmployee.hmnia_enarxhs_daneismoy || null,
            to: normalEmployee.hmnia_lhxhs_daneismoy || null
        }
    });
}

function withProvenance(profile, source, reviewDate, employee, historyId = null,
    normalEmployee = {}) {
    return Object.freeze({
        ...profile,
        resolution_source: source,
        resolution_blocked: false,
        resolution_reason: null,
        review_date: normalizeDateOnly(reviewDate)?.toISOString().slice(0, 10) || null,
        profile_company_id: employee.company_kod || null,
        profile_employee_id: employee._id || null,
        profile_history_id: historyId || profile.istorikoId || null,
        loan_interval: source === PROFILE_SOURCE.BORROWING ? {
            from: normalEmployee.hmnia_enarxhs_daneismoy || null,
            to: normalEmployee.hmnia_lhxhs_daneismoy || null
        } : null
    });
}

function resolveEffectiveEmploymentProfileForReviewDate({
    reviewDate,
    normalEmployee = {},
    normalHistory = [],
    borrowedContext = null
} = {}) {
    if (!isActiveLoan(reviewDate, normalEmployee)) {
        const profile = getOrarioTermsForDate(reviewDate, normalHistory, normalEmployee);
        return withProvenance(profile, PROFILE_SOURCE.LOCAL, reviewDate, normalEmployee);
    }
    if (!borrowedContext || borrowedContext.reason) {
        return blockedProfile(
            borrowedContext?.reason || BLOCK_REASON.INVALID_MAPPING,
            reviewDate,
            normalEmployee,
            borrowedContext || {}
        );
    }
    const borrowingEmployee = borrowedContext.borrowingEmployee;
    const history = borrowedContext.borrowingHistory || [];
    const matches = matchingHistoryRows(reviewDate, history);
    if (matches.length > 1) {
        return blockedProfile(BLOCK_REASON.HISTORY_OVERLAP, reviewDate, normalEmployee,
            borrowedContext);
    }
    const profile = getOrarioTermsForDate(reviewDate, history, borrowingEmployee);
    if (!profile || !borrowingEmployee) {
        return blockedProfile(BLOCK_REASON.PROFILE_MISSING, reviewDate, normalEmployee,
            borrowedContext);
    }
    if (profile.hmeres_ergasias_ebdomadas === null ||
        profile.hmeres_ergasias_ebdomadas === undefined ||
        Number(profile.hmeres_ergasias_ebdomadas) === 0) {
        return blockedProfile(BLOCK_REASON.PROFILE_MISSING, reviewDate, normalEmployee,
            borrowedContext);
    }
    if (![5, 6].includes(Number(profile.hmeres_ergasias_ebdomadas))) {
        return blockedProfile(BLOCK_REASON.WEEKLY_WORKDAYS_INVALID, reviewDate, normalEmployee,
            borrowedContext);
    }
    return withProvenance(profile, PROFILE_SOURCE.BORROWING, reviewDate, borrowingEmployee,
        matches[0]?._id || null, normalEmployee);
}

function queryLean(query, fields) {
    return query.select(fields).lean();
}

async function preloadBorrowedEmploymentProfileContexts({
    team,
    employees = [],
    models = {}
} = {}) {
    const companiesModel = models.companiesModel || CompaniesModel;
    const employeeModel = models.employeeModel || ErgazomenoiModel;
    const historyModel = models.historyModel === undefined
        ? IstorikoProslhpseonAllagonModel
        : models.historyModel;
    const lending = employees.filter(isExplicitLendingEmployee);
    const contexts = new Map();
    if (!lending.length) return contexts;

    const afms = [...new Set(lending.map((row) =>
        String(row.afm_daneizomenoy_ergodoth || '').trim()).filter(Boolean))];
    const companies = afms.length
        ? await queryLean(companiesModel.find({ team, afm: mongoose.trusted({ $in: afms }) }),
            '_id afm')
        : [];
    const byAfm = new Map();
    for (const company of companies) {
        const afm = String(company.afm || '').trim();
        if (!byAfm.has(afm)) byAfm.set(afm, []);
        byAfm.get(afm).push(company);
    }

    const requested = [];
    for (const local of lending) {
        const afm = String(local.afm_daneizomenoy_ergodoth || '').trim();
        const code = String(local.kodikos_ergazomenoy_alloy_ergodoth || '').trim();
        const matches = byAfm.get(afm) || [];
        let reason = null;
        if (!afm || !code) reason = BLOCK_REASON.INVALID_MAPPING;
        else if (!matches.length) reason = BLOCK_REASON.COMPANY_MISSING;
        else if (matches.length > 1) reason = BLOCK_REASON.COMPANY_AMBIGUOUS;
        const context = { reason, borrowingCompanyId: matches.length === 1
            ? String(matches[0]._id) : null, borrowingEmployee: null, borrowingHistory: [] };
        contexts.set(employeeKey(local), context);
        if (!reason) requested.push({ local, context, code });
    }

    const companyIds = [...new Set(requested.map((item) => item.context.borrowingCompanyId))];
    const codes = [...new Set(requested.map((item) => item.code))];
    const sourceEmployees = requested.length
        ? await queryLean(employeeModel.find({ team,
            company_kod: mongoose.trusted({ $in: companyIds }),
            kodikos: mongoose.trusted({ $in: codes }) }),
        '_id team company_kod kodikos ypokatasthma hmeres_ergasias_ebdomadas ' +
        'ores_ergasias_ebdomadas mo_oron_hmerhsias_ergasias kathestos_apasxolhshs ' +
        'typos_apasxolhshs typos_ebdomadas pososto_prosayxhshs_6hs_hmeras ' +
        'nomimoOromisthio pragmatikoOromisthio eidikh_kathgoria_ergazomenoy eidikh_periptosh')
        : [];

    for (const item of requested) {
        const matches = sourceEmployees.filter((row) =>
            String(row.company_kod) === item.context.borrowingCompanyId &&
            String(row.kodikos || '').trim() === item.code);
        if (!matches.length) item.context.reason = BLOCK_REASON.EMPLOYEE_MISSING;
        else if (matches.length > 1) item.context.reason = BLOCK_REASON.EMPLOYEE_AMBIGUOUS;
        else item.context.borrowingEmployee = matches[0];
    }

    const resolved = requested.filter((item) => !item.context.reason);
    const histories = resolved.length && historyModel
        ? await queryLean(historyModel.find({ team,
            company_kod: mongoose.trusted({ $in: companyIds }),
            kodikos: mongoose.trusted({ $in: codes }) }),
        '_id team company_kod kodikos hmeromhnia_allaghs_orarioy_apo ' +
        'hmeromhnia_allaghs_orarioy_eos hmeromhnia_isxyos_oron_ergasias_apo ' +
        'hmeromhnia_isxyos_oron_ergasias_eos hmeres_ergasias_ebdomadas ' +
        'ores_ergasias_ebdomadas mo_oron_hmerhsias_ergasias kathestos_apasxolhshs ' +
        'typos_apasxolhshs typos_ebdomadas pososto_prosayxhshs_6hs_hmeras ' +
        'nomimoOromisthio pragmatikoOromisthio employment_profile_source ' +
        'afora_allagh_oron_ergasias createdAt')
        : [];
    for (const item of resolved) {
        item.context.borrowingHistory = histories.filter((row) =>
            String(row.company_kod) === item.context.borrowingCompanyId &&
            String(row.kodikos || '').trim() === item.code);
    }
    return contexts;
}

module.exports = {
    PROFILE_SOURCE,
    BLOCK_REASON,
    employeeKey,
    isActiveLoan,
    matchingHistoryRows,
    resolveEffectiveEmploymentProfileForReviewDate,
    preloadBorrowedEmploymentProfileContexts
};
