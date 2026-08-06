// Pure adapter that exposes verified-card rest-period checks as additional
// read-only policy-preview rows. It never mutates source rows and never
// proposes or applies card/apologistika updates.

const {
    POLICY_VERSION,
    STATUS,
    evaluateSplitShiftRest,
    evaluateInterdayRest
} = require('./apasxoliseisRestPeriodPolicyService');

const PREVIEW_POLICY = Object.freeze({
    SPLIT_SHIFT_REST: Object.freeze({
        code: 'SPLIT_SHIFT_MINIMUM_REST',
        title: 'Ελάχιστη ανάπαυση σε σπαστό ωράριο',
        violationScenario: 'SPLIT_SHIFT_REST_VIOLATION',
        pendingScenario: 'SPLIT_SHIFT_REST_TECHNICAL_PENDING'
    }),
    INTERDAY_REST: Object.freeze({
        code: 'INTERDAY_MINIMUM_REST',
        title: 'Ελάχιστη ανάπαυση μεταξύ διαδοχικών ημερών',
        violationScenario: 'INTERDAY_REST_VIOLATION',
        pendingScenario: 'INTERDAY_REST_TECHNICAL_PENDING'
    })
});

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function rowId(row = {}) {
    return String(row._id || row.id || row.prodhlomena_oraria_id || '').trim();
}

function dateKeyUtc(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function employeeKey(row = {}) {
    return [row.team, row.company_kod, row.kodikos]
        .map((value) => String(value || '').trim())
        .join('|');
}

function isNextCalendarDay(currentDate, nextDate) {
    const current = new Date(`${currentDate}T00:00:00.000Z`);
    const next = new Date(`${nextDate}T00:00:00.000Z`);
    return next.getTime() - current.getTime() === 24 * 60 * 60 * 1000;
}

function selectCriticalDetail(result = {}) {
    const details = asArray(result.details);
    if (details.length === 0) return {};

    return details.reduce((critical, detail) =>
        Number(detail.restMinutes) < Number(critical.restMinutes) ? detail : critical
    );
}

function buildDiagnosticDetails({ result, anchorRow }) {
    const detail = selectCriticalDetail(result);
    const anchorDate = dateKeyUtc(anchorRow.hmeromhnia);

    return {
        check_type: result.checkType,
        current_date: detail.currentDate || anchorDate,
        next_date: detail.nextDate || '',
        previous_end: detail.previousEnd || detail.currentEnd || '',
        next_start: detail.nextStart || '',
        measured_rest_minutes:
            Number.isFinite(Number(result.measuredRestMinutes))
                ? Number(result.measuredRestMinutes)
                : null,
        minimum_rest_minutes: Number(result.minimumRestMinutes),
        verification_pending: result.status === STATUS.NEEDS_HR_DECISION
    };
}

function buildPreviewRow({ anchorRow, result, suffix }) {
    const definition = PREVIEW_POLICY[result.checkType];
    const sourceId = rowId(anchorRow);
    const isViolation = result.status === STATUS.VIOLATION;

    return {
        preview_id: `${sourceId}:${suffix}`,
        prodhlomena_oraria_id: sourceId,
        team: anchorRow.team || '',
        company_kod: anchorRow.company_kod || '',
        ypokatasthma: anchorRow.ypokatasthma || '',
        kodikos: anchorRow.kodikos || '',
        hmeromhnia: anchorRow.hmeromhnia,
        kathgoria_ergasias_apologistika:
            anchorRow.kathgoria_ergasias_apologistika || '',
        scenarioDecision: {
            scenario_code: isViolation
                ? definition.violationScenario
                : definition.pendingScenario,
            scenario_version: POLICY_VERSION,
            rule_branch: isViolation
                ? `${result.checkType}_VERIFIED_VIOLATION`
                : `${result.checkType}_TECHNICAL_PENDING`,
            confidence: isViolation ? 'HIGH' : 'UNVERIFIED',
            requires_review: isViolation,
            reasons: [...result.reasons],
            warnings: [...result.warnings],
            proposed_updates: {},
            policy_thresholds: {
                minimum_rest_minutes: Number(result.minimumRestMinutes)
            },
            policy_conditions: {
                check_type: result.checkType,
                verification_status: isViolation ? 'VERIFIED_VIOLATION' : 'TECHNICAL_PENDING'
            },
            display_labels: {
                badge: definition.title,
                show_badge: true
            }
        },
        scenarioFactsSummary: {
            declared_category: anchorRow.kathgoria_ergasias || '',
            apologistika_category:
                anchorRow.kathgoria_ergasias_apologistika || '',
            card_hours: Number(anchorRow.cards_ores_ergasias) || 0,
            has_cards: Number(anchorRow.cards_ores_ergasias) > 0,
            rest_period_diagnostic: buildDiagnosticDetails({ result, anchorRow })
        },
        policyResult: {
            success: isViolation,
            policy_code: definition.code,
            policy_version: POLICY_VERSION,
            rule_branch: isViolation
                ? `${result.checkType}_VERIFIED_VIOLATION`
                : `${result.checkType}_TECHNICAL_PENDING`,
            policy_title: definition.title,
            mode: 'REVIEW_ONLY',
            result_status: isViolation ? 'NEEDS_REVIEW' : 'UNKNOWN_PATTERN',
            confidence: isViolation ? 'HIGH' : 'UNVERIFIED',
            batch_approvable: false,
            requires_human_approval: isViolation,
            reasons: [...result.reasons],
            warnings: [...result.warnings],
            proposed_updates: {},
            blocked: !isViolation,
            blocked_reasons: isViolation ? [] : ['CARD_VERIFICATION_PENDING'],
            audit_payload: {
                read_only: true,
                check_type: result.checkType,
                policy_version: POLICY_VERSION
            }
        }
    };
}

function buildRestPeriodPolicyPreviewRows(options = {}) {
    const rows = asArray(options.rows).filter((row) => rowId(row) && dateKeyUtc(row.hmeromhnia));
    const presentationIds = new Set(
        asArray(options.presentationRowIds).map((value) => String(value || '').trim())
    );
    const shouldPresent = (row) => presentationIds.size === 0 || presentationIds.has(rowId(row));
    const groups = new Map();
    const previewRows = [];

    rows.forEach((row) => {
        const key = employeeKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);

        if (!shouldPresent(row)) return;
        const splitResult = evaluateSplitShiftRest(row);
        if ([STATUS.VIOLATION, STATUS.NEEDS_HR_DECISION].includes(splitResult.status)) {
            previewRows.push(
                buildPreviewRow({
                    anchorRow: row,
                    result: splitResult,
                    suffix: 'SPLIT_SHIFT_REST'
                })
            );
        }
    });

    groups.forEach((employeeRows) => {
        const rowsByDate = new Map();
        employeeRows.forEach((row) => {
            const date = dateKeyUtc(row.hmeromhnia);
            if (!rowsByDate.has(date)) rowsByDate.set(date, []);
            rowsByDate.get(date).push(row);
        });
        const uniqueRows = [...rowsByDate.entries()]
            .filter(([, dateRows]) => dateRows.length === 1)
            .map(([, dateRows]) => dateRows[0])
            .sort((left, right) => dateKeyUtc(left.hmeromhnia).localeCompare(dateKeyUtc(right.hmeromhnia)));

        for (let index = 1; index < uniqueRows.length; index += 1) {
            const currentRow = uniqueRows[index - 1];
            const nextRow = uniqueRows[index];
            const currentDate = dateKeyUtc(currentRow.hmeromhnia);
            const nextDate = dateKeyUtc(nextRow.hmeromhnia);
            if (!isNextCalendarDay(currentDate, nextDate) || !shouldPresent(nextRow)) continue;

            const interdayResult = evaluateInterdayRest(currentRow, nextRow);
            if (![STATUS.VIOLATION, STATUS.NEEDS_HR_DECISION].includes(interdayResult.status)) {
                continue;
            }

            previewRows.push(
                buildPreviewRow({
                    anchorRow: nextRow,
                    result: interdayResult,
                    suffix: `INTERDAY_REST:${currentDate}`
                })
            );
        }
    });

    return previewRows;
}

module.exports = {
    PREVIEW_POLICY,
    buildRestPeriodPolicyPreviewRows
};
