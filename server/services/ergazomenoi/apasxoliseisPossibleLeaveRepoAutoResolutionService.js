const crypto = require('crypto');
const { startOfWeekMondayUtc, endOfWeekSundayUtc, dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { isPossibleLeave, classifyLeaveProvenance, LEAVE_PROVENANCE } = require('./apasxoliseisLeaveProvenanceService');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');

const RULE = 'REUSABLE_SOURCE_APPROVAL_WITH_UNIQUE_POSSIBLE_LEAVE_TARGET';
const RULE_VERSION = 'possible-leave-repo-auto-resolution:v1';
const AUTHORITY = 'BASED_ON_REUSABLE_HR_APPROVAL';

function text(value) { return String(value ?? '').trim(); }
function truthy(value) { return value === true || value === 'true' || value === 1 || value === '1'; }
function number(value) { const parsed = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; }
function id(value) { return text(value?._id ?? value); }
function pairIdentity({ approval, source, target }) {
    return crypto.createHash('sha256').update([
        RULE_VERSION, id(approval), id(source), id(target), dateKeyUtc(startOfWeekMondayUtc(source.hmeromhnia))
    ].join('|')).digest('hex');
}
function activeReusableSourceApprovals(approvals, source, weekStart, weekEnd) {
    return (approvals || []).filter((approval) => {
        const effectiveFrom = approval.reuse_effective_from ? new Date(approval.reuse_effective_from) : null;
        const effectiveTo = approval.reuse_effective_to ? new Date(approval.reuse_effective_to) : null;
        const sourceItems = (approval.items || []).filter((item) =>
            text(item.role) === 'SOURCE_BECOMES_WORK' ||
            text(item.proposed_values?.kathgoria_ergasias_apologistika) === 'ΕΡΓ'
        );
        const approvedAsWork = sourceItems.some((item) => {
            const declaredCategory = text(item.kathgoria_ergasias);
            const sourceCategory = text(source.kathgoria_ergasias);
            const categoryMatches = declaredCategory
                ? declaredCategory === sourceCategory
                : ['ΑΝ', 'ΜΕ'].includes(sourceCategory);
            const hasVerifiedCards = number(item.cards_ores_ergasias) > 0 ||
                item.policy_context?.conditions?.card_evidence_class === 'VERIFIED_CARDS';
            return categoryMatches && hasVerifiedCards;
        });
        const scopeMatches = (!text(approval.team) || text(approval.team) === text(source.team)) &&
            (!text(approval.company_kod) || text(approval.company_kod) === text(source.company_kod)) &&
            (!text(approval.ypokatasthma) || text(approval.ypokatasthma).padStart(4, '0') ===
                text(source.ypokatasthma).padStart(4, '0'));
        return text(approval.reuse_scope) === 'FUTURE_IDENTICAL' &&
            text(approval.reuse_status) === 'ACTIVE' && text(approval.decision_status) === 'RECORDED' &&
            ['APPROVE_PROPOSAL', 'APPROVE_PREFILL'].includes(text(approval.decision_type)) &&
            scopeMatches && approvedAsWork &&
            (!effectiveFrom || effectiveFrom <= weekEnd) && (!effectiveTo || effectiveTo >= weekStart);
    });
}
function sourceEligible(row) {
    const declaredRepo = truthy(row.repo) || ['ΑΝ', 'ΜΕ'].includes(text(row.kathgoria_ergasias));
    const cardVerification = resolveCardPairVerification(row);
    const completeCards = number(row.cards_ores_ergasias) > 0 &&
        cardVerification.hasUnresolvedCardEvidence !== true &&
        cardVerification.completePairs?.length > 0 && row.incomplete_card_evidence !== true;
    return declaredRepo && completeCards && row.is_locked !== true && row.manual_override !== true &&
        row.mixed_profile !== true && row.category_repo_conflict !== true;
}
function targetEligible(row) {
    const cardVerification = resolveCardPairVerification(row);
    return text(row.kathgoria_ergasias) === 'ΕΡΓ' && number(row.ores_ergasias) > 0 &&
        number(row.cards_ores_ergasias) === 0 && isPossibleLeave(row) &&
        cardVerification.hasUnresolvedCardEvidence !== true &&
        cardVerification.completePairs?.length === 0 &&
        row.adeia_apologistika !== true &&
        text(row.kathgoria_adeias_apologistika) === 'POSSIBLE_LEAVE' &&
        classifyLeaveProvenance(row) !== LEAVE_PROVENANCE.HR_DECLARED_LEAVE &&
        !truthy(row.astheneia) && !truthy(row.astheneia_apologistika) &&
        !truthy(row.argia) && !truthy(row.argia_apologistika) &&
        !truthy(row.repo) && !truthy(row.repo_apologistika) && row.is_locked !== true &&
        row.manual_override !== true && row.current_canonical_eligible !== false;
}
function resolveUniquePossibleLeaveTransfer({ weekRows = [], approvals = [], appliedPairIdentities = new Set() }) {
    if (!weekRows.length) return { status: 'NEEDS_HR', reasons: ['NO_WEEK_ROWS'] };
    const weekStart = startOfWeekMondayUtc(weekRows[0].hmeromhnia);
    const weekEnd = endOfWeekSundayUtc(weekRows[0].hmeromhnia);
    const sources = weekRows.filter(sourceEligible);
    const candidates = [];
    for (const source of sources) {
        const matches = activeReusableSourceApprovals(approvals, source, weekStart, weekEnd);
        if (matches.length !== 1) continue;
        const targets = weekRows.filter((row) => id(row) !== id(source) && targetEligible(row));
        if (targets.length === 1 &&
            dateKeyUtc(source.hmeromhnia).slice(0, 7) === dateKeyUtc(targets[0].hmeromhnia).slice(0, 7)) {
            candidates.push({ source, target: targets[0], approval: matches[0] });
        }
    }
    if (candidates.length !== 1) return { status: 'NEEDS_HR', reasons: [
        candidates.length === 0 ? 'NO_UNIQUE_AUTHORIZED_PAIR' : 'MULTIPLE_AUTHORIZED_PAIRS'
    ] };
    const candidate = candidates[0];
    const identity = pairIdentity(candidate);
    const audit = {
        authority: AUTHORITY, rule: RULE, rule_version: RULE_VERSION,
        automatic_resolution_reason: 'UNIQUE_SAFE_POSSIBLE_LEAVE_TARGET',
        original_approval_id: id(candidate.approval),
        original_approving_user: text(candidate.approval.created_by_user_name),
        original_approval_timestamp: candidate.approval.created_at || null,
        source_id: id(candidate.source), target_id: id(candidate.target),
        week_start: dateKeyUtc(weekStart), week_end: dateKeyUtc(weekEnd), atomic_pair_identity: identity
    };
    if (appliedPairIdentities.has(identity)) return { status: 'ALREADY_APPLIED', idempotent: true, audit };
    return { status: 'AUTO_RESOLVED', idempotent: false, ...candidate, atomic_pair_identity: identity, audit };
}
async function resolvePossibleLeaveTransfersInBatch({ approvalModel, approvalFilter, weeklyRows, appliedPairIdentities, applyAtomicPair }) {
    const approvals = await approvalModel.find(approvalFilter).lean();
    const results = [];
    for (const weekRows of weeklyRows) {
        const resolution = resolveUniquePossibleLeaveTransfer({ weekRows, approvals, appliedPairIdentities });
        if (resolution.status === 'AUTO_RESOLVED') {
            results.push(await applyAtomicPair(resolution));
        } else results.push(resolution);
    }
    return { approval_queries: 1, results };
}

module.exports = {
    RULE, RULE_VERSION, AUTHORITY, sourceEligible, targetEligible,
    activeReusableSourceApprovals, pairIdentity, resolveUniquePossibleLeaveTransfer,
    resolvePossibleLeaveTransfersInBatch
};
