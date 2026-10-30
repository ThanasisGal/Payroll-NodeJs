'use strict';

const { CANONICAL_STATUSES, canonicalizeEmployeeHistory } =
    require('./employeeHistoryCanonicalizationService');
const { identifyEmployeeHistoryProblemScope } =
    require('./employeeHistoryProblemScopeService');
const { RESOLUTION_CLASSES } = require('./employeeHistoryResolutionAnalysisService');
const { PLAN_STATUSES: UNIQUE_STATUSES, planEmployeeHistoryUniqueSafeRepair } =
    require('./employeeHistoryUniqueSafeRepairPlannerService');
const { PLAN_STATUSES: MULTIPLE_STATUSES, planEmployeeHistoryMultipleSafeResolution } =
    require('./employeeHistoryMultipleSafeResolutionPlannerService');
const { PLAN_STATUSES: FACT_STATUSES, planEmployeeHistoryBusinessFactResolution } =
    require('./employeeHistoryBusinessFactResolutionPlannerService');
const { PLAN_STATUSES: USER_CORRECTION_STATUSES,
    planEmployeeHistoryUserConfirmedCorrection } =
    require('./employeeHistoryUserConfirmedCorrectionPlannerService');
const BUSINESS_DAY = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'
});

function classifyEmployeeHistoryResolutionCapability({ scope, currentEmployee,
    completeHistoryRows = [], protectedReferenceSummary = {}, asOfDate = BUSINESS_DAY.format(new Date()),
    collectAllPlans = false, allowGeneralProfileAlternatives = false, catalogs = {},
    canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const canonicalResult = canonicalizer({ scope, currentEmployee,
        historyRows: completeHistoryRows });
    if (!collectAllPlans && canonicalResult.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY) {
        return { resolutionClass: RESOLUTION_CLASSES.FALSE_POSITIVE_OR_ALREADY_RESOLVABLE,
            canonicalResult, problemScope: null, uniquePlan: null, multiplePlan: null,
            businessFactPlan: null, userCorrectionPlan: null,
            factCollectionReady: false, userConfirmedCorrectionReady: false };
    }
    const problemScope = identifyEmployeeHistoryProblemScope({ scope, currentEmployee,
        completeHistoryRows, canonicalizer });
    const uniquePlan = planEmployeeHistoryUniqueSafeRepair({ scope, currentEmployee,
        completeHistoryRows, canonicalResult, protectedReferenceSummary, canonicalizer });
    if (!collectAllPlans && uniquePlan.status === UNIQUE_STATUSES.APPLICABLE) {
        return { resolutionClass: RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN,
            canonicalResult, problemScope, uniquePlan, multiplePlan: null,
            businessFactPlan: null, userCorrectionPlan: null,
            factCollectionReady: false, userConfirmedCorrectionReady: false };
    }
    if (!collectAllPlans && !problemScope.deterministicallyResolved) {
        return { resolutionClass: RESOLUTION_CLASSES.ADMIN_REVIEW_REQUIRED,
            canonicalResult, problemScope, uniquePlan, multiplePlan: null,
            businessFactPlan: null, userCorrectionPlan: null,
            factCollectionReady: false, userConfirmedCorrectionReady: false };
    }
    const multiplePlan = planEmployeeHistoryMultipleSafeResolution({ scope, currentEmployee,
        completeHistoryRows, canonicalResult, problemScope, protectedReferenceSummary, allowGeneralProfileAlternatives, canonicalizer });
    if (!collectAllPlans && multiplePlan.status === MULTIPLE_STATUSES.APPLICABLE) {
        return { resolutionClass: RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS,
            canonicalResult, problemScope, uniquePlan, multiplePlan,
            businessFactPlan: null, userCorrectionPlan: null,
            factCollectionReady: false, userConfirmedCorrectionReady: false };
    }
    const businessFactPlan = planEmployeeHistoryBusinessFactResolution({ scope, currentEmployee,
        completeHistoryRows, canonicalResult, problemScope, protectedReferenceSummary, asOfDate, canonicalizer });
    const userCorrectionPlan = !collectAllPlans && businessFactPlan.status === FACT_STATUSES.APPLICABLE
        ? null : planEmployeeHistoryUserConfirmedCorrection({ scope, currentEmployee,
            completeHistoryRows, canonicalResult, problemScope, protectedReferenceSummary, catalogs, canonicalizer });
    const referenceFailure = [uniquePlan.reason, multiplePlan.reason, businessFactPlan.reason,
        userCorrectionPlan?.reason]
        .some(reason =>
        ['REFERENCE_STATE_NOT_LOADED', 'REFERENCE_SEMANTICS_UNKNOWN',
            'LIVE_REFERENCE_BLOCKS_REPAIR', 'LIVE_REFERENCE_BLOCKS_RESOLUTION',
            'LIVE_REFERENCE_BLOCKS_FACT_RESOLUTION',
            'LIVE_REFERENCE_BLOCKS_USER_CONFIRMED_CORRECTION'].includes(reason));
    return { resolutionClass: referenceFailure || !problemScope.deterministicallyResolved
        ? RESOLUTION_CLASSES.ADMIN_REVIEW_REQUIRED
        : uniquePlan.status === UNIQUE_STATUSES.APPLICABLE ? RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN
            : multiplePlan.status === MULTIPLE_STATUSES.APPLICABLE ? RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS
                : canonicalResult.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY
                    ? RESOLUTION_CLASSES.FALSE_POSITIVE_OR_ALREADY_RESOLVABLE : RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED,
    canonicalResult, problemScope, uniquePlan, multiplePlan, businessFactPlan,
    userCorrectionPlan,
    factCollectionReady: businessFactPlan.status === FACT_STATUSES.APPLICABLE,
    userConfirmedCorrectionReady: userCorrectionPlan?.status ===
        USER_CORRECTION_STATUSES.APPLICABLE };
}

module.exports = { classifyEmployeeHistoryResolutionCapability };
