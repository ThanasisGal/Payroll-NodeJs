const mongoose = require('mongoose');

const OUTSIDE_SCOPE_CODE = 'ERGANI_IMPORTED_EMPLOYEE_OUTSIDE_AUTHORIZED_COMPANY_SCOPE';
const AMBIGUOUS_SCOPE_CODE = 'ERGANI_IMPORTED_EMPLOYEE_AMBIGUOUS_AUTHORIZED_SCOPE';

function normalizeScope(scope = {}) {
    return {
        team: String(scope.team || '').trim(),
        company_kod: String(scope.company_kod || scope.companyId || '').trim(),
        ypokatasthma: String(scope.ypokatasthma || '').trim().padStart(4, '0')
    };
}

function assertCompleteScope(scope) {
    const normalized = normalizeScope(scope);
    if (!normalized.team || !normalized.company_kod || !normalized.ypokatasthma) {
        const error = new Error(OUTSIDE_SCOPE_CODE);
        error.code = OUTSIDE_SCOPE_CODE;
        throw error;
    }
    return normalized;
}

function employeeIsInAuthorizedScope(employee, scope) {
    const authorized = assertCompleteScope(scope);
    return Boolean(employee) &&
        String(employee.team || '').trim() === authorized.team &&
        String(employee.company_kod || '').trim() === authorized.company_kod &&
        String(employee.ypokatasthma || '').trim().padStart(4, '0') === authorized.ypokatasthma;
}

function indexScopedEmployees(candidates, scope) {
    const authorized = assertCompleteScope(scope);
    const byAfm = new Map();
    for (const employee of candidates || []) {
        if (!employeeIsInAuthorizedScope(employee, authorized)) continue;
        const afm = String(employee.afm || '').trim();
        if (!afm) continue;
        if (!byAfm.has(afm)) byAfm.set(afm, []);
        byAfm.get(afm).push(employee);
    }

    const resolved = new Map();
    const ambiguousAfms = new Set();
    for (const [afm, matches] of byAfm.entries()) {
        if (matches.length === 1) resolved.set(afm, matches[0]);
        else ambiguousAfms.add(afm);
    }
    return { scope: authorized, resolved, ambiguousAfms };
}

async function loadScopedErganiEmployees({ employeeModel, afms, scope }) {
    const authorized = assertCompleteScope(scope);
    const uniqueAfms = [...new Set((afms || []).map((afm) => String(afm || '').trim()).filter(Boolean))];
    if (uniqueAfms.length === 0) return indexScopedEmployees([], authorized);
    const candidates = await employeeModel.find({
        team: authorized.team,
        company_kod: authorized.company_kod,
        ypokatasthma: authorized.ypokatasthma,
        afm: mongoose.trusted({ $in: uniqueAfms })
    }).lean();
    return indexScopedEmployees(candidates, authorized);
}

function assertEmployeeWriteScope(employee, scope) {
    if (employeeIsInAuthorizedScope(employee, scope)) return;
    const error = new Error(OUTSIDE_SCOPE_CODE);
    error.code = OUTSIDE_SCOPE_CODE;
    throw error;
}

module.exports = {
    AMBIGUOUS_SCOPE_CODE,
    OUTSIDE_SCOPE_CODE,
    assertEmployeeWriteScope,
    employeeIsInAuthorizedScope,
    indexScopedEmployees,
    loadScopedErganiEmployees,
    normalizeScope
};
