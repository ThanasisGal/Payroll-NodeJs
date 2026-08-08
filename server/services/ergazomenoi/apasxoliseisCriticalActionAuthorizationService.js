'use strict';

const CRITICAL_EMPLOYMENT_DECISION_ROLES = Object.freeze(['A', 'S', 'HR']);

function normalizedRole(value) {
    return String(value || '').trim().toUpperCase();
}

function isCriticalEmploymentDecisionRoleAllowed(role) {
    return CRITICAL_EMPLOYMENT_DECISION_ROLES.includes(normalizedRole(role));
}

function criticalEmploymentDecisionAuthorizationError() {
    const error = new Error('Δεν έχετε δικαίωμα εκτέλεσης κρίσιμης απόφασης απασχολήσεων.');
    error.statusCode = 403;
    error.code = 'CRITICAL_EMPLOYMENT_DECISION_NOT_AUTHORIZED';
    return error;
}

function assertCriticalEmploymentDecisionRole(session = {}) {
    if (!isCriticalEmploymentDecisionRoleAllowed(session.userRole)) {
        throw criticalEmploymentDecisionAuthorizationError();
    }
    return normalizedRole(session.userRole);
}

function requireCriticalEmploymentDecisionRole(req, res, next) {
    try {
        assertCriticalEmploymentDecisionRole(req.session);
        return next();
    } catch (error) {
        return res.status(403).json({ success: false, code: error.code, message: error.message });
    }
}

module.exports = {
    CRITICAL_EMPLOYMENT_DECISION_ROLES,
    isCriticalEmploymentDecisionRoleAllowed,
    assertCriticalEmploymentDecisionRole,
    requireCriticalEmploymentDecisionRole
};
