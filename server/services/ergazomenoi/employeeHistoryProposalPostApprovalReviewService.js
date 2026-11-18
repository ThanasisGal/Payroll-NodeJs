'use strict';

// A verified row approval completes that row's BEFORE/AFTER work. Findings from
// subsequent canonical/current-profile consistency checks are not new approval
// requests for the same immutable edition. Keep them visible and read-only.
const POST_APPROVAL_REVIEW_REASONS = Object.freeze([
    'RECORDED_ROW_CORRECTION', 'CURRENT_PROFILE_MISMATCH', 'ACTIVE_PERIOD_NOT_OPEN'
]);
const reviewReasons = new Set(POST_APPROVAL_REVIEW_REASONS);

function separatePostApprovalFindings(pending, approvedIds) {
    if (!Array.isArray(pending) || !(approvedIds instanceof Set))
        throw new TypeError('POST_APPROVAL_REVIEW_INPUT');
    const cases = [], reviewFindings = [];
    for (const item of pending) {
        // Only an independently verified approved target can leave the queue.
        // An unknown, mixed or structural reason must NEVER be suppressed.
        if (item.kind === 'EXISTING_ROW' && item.operation === 'UPDATE' &&
            approvedIds.has(String(item.targetHistoryId)) &&
            Array.isArray(item.reasons) && item.reasons.length > 0 &&
            item.reasons.every(reason => reviewReasons.has(reason))) {
            reviewFindings.push({ ...item, kind: 'POST_APPROVAL_REVIEW',
                operation: 'REVIEW_REQUIRED', targetHistoryId: null,
                approvedHistoryId: item.targetHistoryId, reviewOnly: true });
        } else cases.push(item);
    }
    return { cases, reviewFindings };
}

module.exports = { POST_APPROVAL_REVIEW_REASONS, separatePostApprovalFindings };
