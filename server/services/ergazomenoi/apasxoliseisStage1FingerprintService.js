'use strict';

const crypto = require('crypto');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { classifyLeaveProvenance } = require('./apasxoliseisLeaveProvenanceService');
const { normalizeTimeValue } = require('./apasxoliseisScenarioFactsService');

const FINGERPRINT_VERSION = 'weekly-hr-stage1-fingerprint:v1';
const STAGE1_DERIVED_STATUS = Object.freeze({
    OPEN: 'OPEN',
    COMPLETED: 'COMPLETED',
    STALE: 'STALE'
});

function text(value) {
    return String(value ?? '').trim();
}

function boolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function number(value) {
    if (value === null || value === undefined || text(value) === '') return 0;
    const parsed = Number(text(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizedManualAuditProvenance(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const fingerprint = text(value.fingerprint).toLowerCase();
    if (/^[a-f0-9]{64}$/.test(fingerprint)) return { fingerprint };
    const auditId = text(value.latest_audit_id || value.audit_id);
    const rawChangedAt = value.latest_changed_at || value.changed_at;
    const parsedChangedAt = rawChangedAt ? new Date(rawChangedAt) : null;
    const changedAt = parsedChangedAt && !Number.isNaN(parsedChangedAt.getTime())
        ? parsedChangedAt.toISOString() : '';
    return auditId && changedAt ? { latest_audit_id: auditId, latest_changed_at: changedAt } : null;
}

function normalizedCardEvidence(row) {
    const verification = resolveCardPairVerification(row);
    const actual = resolveDailyActualWorkFacts(row);
    return {
        status: verification.status,
        pairs: verification.pairs.map((pair) => ({
            pair_number: pair.pairNumber,
            state: pair.state,
            start: pair.start,
            end: pair.end,
            duration_minutes: pair.durationMinutes
        })),
        aggregate_hours_without_pairs: verification.aggregateHoursWithoutPairs,
        reported_card_hours: number(row.cards_ores_ergasias),
        verified_minutes: verification.verifiedMinutes,
        actual_work_fact: {
            status: actual.cardVerificationStatus,
            actual_work_hours: actual.actualWorkHours,
            counts_as_actual_work_day: actual.countsAsActualWorkDay,
            complete_pairs: [...actual.completeCardPairNumbers],
            unresolved_pairs: [...actual.unresolvedCardPairNumbers],
            reasons: [...actual.reasons].sort(),
            warnings: [...actual.warnings].sort()
        }
    };
}

function normalizeRow(row = {}) {
    return {
        row_id: text(row._id || row.id),
        date: text(dateKeyUtc(row.hmeromhnia)),
        daily_employment_type: text(row.kathestos_apasxolhshs_hmeras),
        declared: {
            category: text(row.kathgoria_ergasias).toUpperCase(),
            repo: boolean(row.repo),
            leave: boolean(row.adeia),
            leave_category: text(row.kathgoria_adeias),
            sickness: boolean(row.astheneia),
            work_hours: number(row.ores_ergasias),
            intervals: ['01', '02', '03'].map((pair) => ({
                pair_number: pair,
                start: normalizeTimeValue(row[`apo_ora_${pair}`]) || '',
                end: normalizeTimeValue(row[`eos_ora_${pair}`]) || ''
            }))
        },
        cards: normalizedCardEvidence(row),
        apologistika: {
            category: text(row.kathgoria_ergasias_apologistika).toUpperCase(),
            repo: boolean(row.repo_apologistika),
            leave: boolean(row.adeia_apologistika),
            leave_category: text(row.kathgoria_adeias_apologistika),
            sickness: boolean(row.astheneia_apologistika),
            absence: boolean(row.apousia_apologistika),
            absence_days: number(row.hmeres_apoysias_apologistika),
            absence_hours: number(row.ores_apoysias_apologistika),
            credited_leave_hours: number(row.ores_adeias_pistomenes_apologistika)
        },
        review: {
            is_locked: boolean(row.is_locked),
            manual_audit_provenance: normalizedManualAuditProvenance(
                row.manual_audit_provenance
            )
        },
        leave_provenance: classifyLeaveProvenance(row)
    };
}

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function buildStage1Fingerprint(weekRows = []) {
    const rows = (Array.isArray(weekRows) ? weekRows : []).map(normalizeRow)
        .sort((left, right) => left.date.localeCompare(right.date) ||
            left.row_id.localeCompare(right.row_id));
    const canonicalInput = { fingerprint_version: FINGERPRINT_VERSION, rows };
    return Object.freeze({
        fingerprint_version: FINGERPRINT_VERSION,
        fingerprint: crypto.createHash('sha256').update(stableStringify(canonicalInput)).digest('hex'),
        canonical_input: canonicalInput
    });
}

function resolveStage1Status({ current_fingerprint, persisted_stage1_state } = {}) {
    const persisted = persisted_stage1_state && typeof persisted_stage1_state === 'object'
        ? persisted_stage1_state : null;
    if (!persisted || persisted.status !== 'COMPLETED' ||
        !text(persisted.completion_fingerprint)) {
        return STAGE1_DERIVED_STATUS.OPEN;
    }
    const applicableFingerprint = text(persisted.effective_fingerprint) ||
        text(persisted.completion_fingerprint);
    return applicableFingerprint === text(current_fingerprint)
        ? STAGE1_DERIVED_STATUS.COMPLETED
        : STAGE1_DERIVED_STATUS.STALE;
}

function applicableStage1Fingerprint(persisted_stage1_state = {}) {
    return text(persisted_stage1_state?.effective_fingerprint) ||
        text(persisted_stage1_state?.completion_fingerprint);
}

module.exports = {
    FINGERPRINT_VERSION,
    STAGE1_DERIVED_STATUS,
    buildStage1Fingerprint,
    resolveStage1Status,
    applicableStage1Fingerprint
};
