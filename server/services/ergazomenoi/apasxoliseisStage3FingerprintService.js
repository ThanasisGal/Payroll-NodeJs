'use strict';

const crypto = require('crypto');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { resolveDailyActualWorkFacts } = require('./apasxoliseisDailyActualWorkFactsService');
const { normalizeEmploymentType } = require('./apasxoliseisReviewEmploymentProfileService');

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function text(value) { return String(value ?? '').trim(); }
function number(value) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
}

function positiveClassification(row = {}) {
    if (row.adeia_apologistika === true) return 'LEAVE';
    if (row.astheneia_apologistika === true) return 'SICKNESS';
    if (row.apousia_apologistika === true) return 'ABSENCE';
    if (text(row.kathgoria_ergasias_apologistika) === 'ΜΕ') return 'NON_WORK';
    return '';
}

function buildStage3InputFingerprint({
    scope = {}, row = {}, dailyProfile = {}, isResidual = false,
    stage2 = {}, upstream = {}
} = {}) {
    const facts = resolveDailyActualWorkFacts(row);
    const material = {
        contract: 'weekly-hr-stage3-input:v1',
        identity: {
            team: text(scope.team), company_kod: text(scope.company_kod),
            ypokatasthma: text(scope.ypokatasthma),
            employee_id: text(scope.employee_id), employee_kodikos: text(scope.employee_kodikos),
            week_start: dateKeyUtc(scope.week_start), week_end: dateKeyUtc(scope.week_end),
            date: dateKeyUtc(row.hmeromhnia), row_id: text(row._id)
        },
        daily_employment: {
            type: normalizeEmploymentType(
                dailyProfile.kathestos_apasxolhshs ?? dailyProfile.typos_apasxolhshs
            ),
            source: text(dailyProfile.daily_employment_snapshot_source || dailyProfile.source),
            effective_from: dateKeyUtc(
                dailyProfile.hmeromhnia_isxyos_oron_ergasias_apo ||
                dailyProfile.hmeromhnia_allaghs_orarioy_apo
            )
        },
        declared: {
            category: text(row.kathgoria_ergasias), hours: number(row.ores_ergasias),
            intervals: [1, 2, 3].map((index) => ({
                start: text(row[`apo_ora_0${index}`]), end: text(row[`eos_ora_0${index}`])
            }))
        },
        actual: {
            category: facts.category, hours: number(facts.actualWorkHours),
            counts_as_workday: facts.countsAsActualWorkDay === true,
            card_status: text(facts.cardVerificationStatus),
            verified_card_hours: number(facts.verifiedCardHours),
            reasons: [...(facts.reasons || [])].sort(), warnings: [...(facts.warnings || [])].sort()
        },
        current_classification: positiveClassification(row),
        residual: isResidual === true,
        stage2: {
            fingerprint: text(stage2.fingerprint), status: text(stage2.status),
            resolution: text(stage2.resolution), resolved_dates: [...new Set(
                (stage2.resolved_dates || []).map(dateKeyUtc).filter(Boolean)
            )].sort()
        },
        upstream: {
            stage1_attestation_scope: text(upstream.stage1_attestation_scope || 'WEEKLY'),
            stage1_period_start: text(upstream.stage1_period_start),
            stage1_period_end: text(upstream.stage1_period_end),
            stage1_context_fingerprint: text(upstream.stage1_context_fingerprint),
            stage1_current_fingerprint: text(
                upstream.stage1_current_fingerprint || upstream.stage1_fingerprint
            ),
            stage1_completion_fingerprint: text(upstream.stage1_completion_fingerprint),
            stage1_effective_fingerprint: text(
                upstream.stage1_effective_fingerprint || upstream.stage1_fingerprint
            ),
            stage1_version: number(upstream.stage1_version),
            stage2_fingerprint: text(upstream.stage2_fingerprint),
            stage2_version: number(upstream.stage2_version)
        }
    };
    return Object.freeze({ fingerprint: crypto.createHash('sha256')
        .update(stableStringify(material)).digest('hex'), material: Object.freeze(material) });
}

function buildStage2ResolutionFingerprint(stage2 = {}) {
    const material = { contract: 'weekly-hr-stage2-resolution:v1',
        status: text(stage2.status), resolution: text(stage2.resolution),
        resolved_dates: [...new Set((stage2.resolved_dates || [])
            .map(dateKeyUtc).filter(Boolean))].sort(),
        reasons: [...new Set(stage2.reasons || [])].sort() };
    return crypto.createHash('sha256').update(stableStringify(material)).digest('hex');
}

module.exports = { stableStringify, positiveClassification, buildStage2ResolutionFingerprint,
    buildStage3InputFingerprint };
