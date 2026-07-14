// Pure weekly analyzer for one semantic repo-transfer pair.
// This module must stay free of DB, controller, route, network, and write dependencies.

const {
    buildApasxoliseisScenarioFacts,
    buildApologistikaIntervals
} = require('./apasxoliseisScenarioFactsService');

const SCENARIO_CODE = 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR';
const SCENARIO_VERSION = 'repo-transfer-single-pair:v1';

const ELIGIBILITY_STATUS = Object.freeze({
    ELIGIBLE: 'ELIGIBLE',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    NEEDS_REVIEW: 'NEEDS_REVIEW',
    INVALID_INPUT: 'INVALID_INPUT'
});

const EMPLOYMENT_TYPE = Object.freeze({
    FULL: 'PLHRHS',
    PARTIAL: 'MERIKH',
    ROTATIONAL: 'EK_PERITROPHS'
});

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function asPlainObject(value) {
    return isPlainObject(value) ? value : {};
}

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function toBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    const number = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(number) ? number : null;
}

function classifyApologistikaNumber(value) {
    if (value === null || value === undefined) return { kind: 'ZERO', value: 0 };
    if (typeof value === 'string' && value.trim() === '') return { kind: 'ZERO', value: 0 };
    if (!['string', 'number'].includes(typeof value)) return { kind: 'INVALID', value: null };

    const number = toFiniteNumber(value);
    if (number === null || number < 0) return { kind: 'INVALID', value: null };
    return { kind: number === 0 ? 'ZERO' : 'POSITIVE', value: number };
}

function normalizePrimitiveString(value, maxLength = 150) {
    if (!['string', 'number', 'bigint', 'boolean'].includes(typeof value)) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    const normalized = String(value).trim();
    return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeRepoLimitForResult(value) {
    return Number.isSafeInteger(value) && [1, 2].includes(value) ? value : null;
}

function normalizeId(value, maxLength = 100) {
    if (typeof value === 'boolean') return null;
    const primitive = normalizePrimitiveString(value, maxLength);
    if (primitive) return primitive;
    if (!value || typeof value !== 'object') return null;

    try {
        if (typeof value.toHexString === 'function') {
            const hexValue = normalizePrimitiveString(value.toHexString(), maxLength);
            if (hexValue) return hexValue;
        }
    } catch (_error) {
        return null;
    }

    return null;
}

function dateKeyUtc(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        const key = value.trim();
        const parsed = new Date(`${key}T00:00:00.000Z`);
        return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key
            ? null
            : key;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function addDaysUtc(dateKey, days) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function startOfWeekSundayUtc(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date.toISOString().slice(0, 10);
}

function normalizeEmploymentType(value) {
    const raw = toTrimmedString(value).toUpperCase().replace(/\s+/g, '_');

    if (['0', '00', 'ΠΛΗΡΗΣ', 'PLHRHS', 'PLIRIS', 'FULL', 'FULL_TIME'].includes(raw)) {
        return EMPLOYMENT_TYPE.FULL;
    }
    if (['1', '01', 'ΜΕΡΙΚΗ', 'MERIKH', 'MERIKI', 'PART_TIME'].includes(raw)) {
        return EMPLOYMENT_TYPE.PARTIAL;
    }
    if (
        [
            '2',
            '02',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ_ΑΠΑΣΧΟΛΗΣΗ',
            'EK_PERITROPHS',
            'EK_PERITROPHIS',
            'ROTATIONAL'
        ].includes(raw)
    ) {
        return EMPLOYMENT_TYPE.ROTATIONAL;
    }
    return null;
}

function getContextValue(source, key) {
    if (!source || !key) return null;
    if (source instanceof Map) return source.get(key) ?? null;
    if (typeof source === 'object' && !Array.isArray(source)) return source[key] ?? null;
    return null;
}

function resolveRepoTransferHolidayState(row, holidayByDateKey, key) {
    const external = getContextValue(holidayByDateKey, key);
    const hasExternalContext = Boolean(external);
    const externalObject = external && typeof external === 'object' ? external : null;
    const externalIsHoliday = externalObject
        ? externalObject.isHoliday !== false
        : toBoolean(external);
    const isMandatoryHoliday = externalIsHoliday && Boolean(
        externalObject &&
        (externalObject.isMandatoryHoliday === true ||
            externalObject.ypoxreotikh_argia === true)
    );
    const isOptionalHoliday = externalIsHoliday && Boolean(
        externalObject &&
        (externalObject.isOptionalHoliday === true ||
            (externalObject.ypoxreotikh_argia === false && !isMandatoryHoliday))
    );
    const companyOperatesOnHoliday = Boolean(
        externalObject && externalObject.companyOperatesOnHoliday === true
    );
    const rawHoliday =
        toBoolean(row.argia) ||
        toBoolean(row.argia_apologistika);
    let blocksRepoTransfer = false;

    if (isMandatoryHoliday) {
        blocksRepoTransfer = true;
    } else if (isOptionalHoliday) {
        blocksRepoTransfer = !companyOperatesOnHoliday;
    } else if (externalIsHoliday) {
        blocksRepoTransfer = externalObject?.blocksRepoTransfer !== false;
    } else if (!hasExternalContext && rawHoliday) {
        blocksRepoTransfer = true;
    }

    return {
        isHoliday: externalIsHoliday || rawHoliday,
        isMandatoryHoliday,
        isOptionalHoliday,
        companyOperatesOnHoliday,
        blocksRepoTransfer,
        description: toTrimmedString(externalObject?.description).slice(0, 200)
    };
}

function hasCompleteNonZeroApologistikaInterval(row) {
    return buildApologistikaIntervals(row).some(
        (interval) => interval.isComplete && !interval.isZeroLength
    );
}

function inspectApologistikaState(row, facts) {
    const category = toTrimmedString(row.kathgoria_ergasias_apologistika);
    const numericStates = Object.entries(row)
        .filter(([field]) => /^ores_.*_apologistika$/.test(field))
        .map(([field, value]) => ({ field, ...classifyApologistikaNumber(value) }));
    const invalidNumericValue = numericStates.some((state) => state.kind === 'INVALID');
    const positiveNumericValue = numericStates.some((state) => state.kind === 'POSITIVE');

    const flags = facts.apologistika.existingFlags;
    return {
        category,
        numericStates,
        invalidNumericValue,
        substantiveState:
            positiveNumericValue ||
            hasCompleteNonZeroApologistikaInterval(row) ||
            flags.repo_apologistika ||
            flags.adeia_apologistika ||
            flags.astheneia_apologistika ||
            flags.argia ||
            toBoolean(row.argia_apologistika)
    };
}

function isProvisionalAutoCalculatedLeave({
    row,
    facts,
    cardHours,
    holidayState,
    manualOverride
}) {
    const apologistikaState = inspectApologistikaState(row, facts);
    const workHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_ergasias_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const absenceHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_apoysias_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const unrelatedPositiveHours = apologistikaState.numericStates.some(
        (state) =>
            state.kind === 'POSITIVE' &&
            !['ores_ergasias_apologistika', 'ores_apoysias_apologistika'].includes(
                state.field
            )
    );
    const declaredHours = toFiniteNumber(row.ores_ergasias);
    const workHoursMatchFallback =
        workHoursState.kind === 'ZERO' ||
        (workHoursState.kind === 'POSITIVE' &&
            declaredHours !== null &&
            workHoursState.value === declaredHours);
    const autoLeaveMarker =
        facts.leave.adeia_apologistika ||
        apologistikaState.category === 'ΑΔΕΙΑ' ||
        facts.leave.kathgoria_adeias_apologistika === 'ΑΔΑΛ';
    const compatibleCalculatedCategory = ['', 'ΑΔΕΙΑ'].includes(
        apologistikaState.category
    );
    const compatibleLeaveCategory = ['', 'ΑΔΑΛ'].includes(
        facts.leave.kathgoria_adeias_apologistika
    );
    const blockingSickness =
        toBoolean(row.astheneia) || facts.apologistika.existingFlags.astheneia_apologistika;

    return (
        facts.declared.isDeclaredWork &&
        cardHours === 0 &&
        facts.leave.hasDeclaredLeave === false &&
        blockingSickness === false &&
        holidayState.blocksRepoTransfer === false &&
        manualOverride === false &&
        autoLeaveMarker &&
        compatibleCalculatedCategory &&
        compatibleLeaveCategory &&
        apologistikaState.invalidNumericValue === false &&
        workHoursMatchFallback &&
        absenceHoursState.kind === 'ZERO' &&
        unrelatedPositiveHours === false &&
        hasCompleteNonZeroApologistikaInterval(row) === false &&
        facts.apologistika.existingFlags.repo_apologistika === false
    );
}

const AUTO_SOURCE_DERIVED_HOUR_FIELDS = new Set([
    'ores_nyxtas_apologistika',
    'ores_argion_prosayxhsh_apologistika',
    'ores_argion_ergasia_apologistika',
    'ores_prostheths_ergasias_apologistika',
    'ores_yperergasias_apologistika',
    'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika',
    'ores_yperergasias_argion_nyxtas_apologistika',
    'ores_nominhs_yperorias_apologistika',
    'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika',
    'ores_paranomhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_nyxtas_apologistika',
    'ores_paranomhs_yperorias_argion_apologistika',
    'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
]);
const AUTO_SOURCE_HOLIDAY_DERIVED_HOUR_FIELDS = new Set([
    'ores_argion_prosayxhsh_apologistika',
    'ores_argion_ergasia_apologistika',
    'ores_yperergasias_argion_apologistika',
    'ores_yperergasias_argion_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika',
    'ores_paranomhs_yperorias_argion_apologistika',
    'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
]);
const AUTO_SOURCE_HOURS_TOLERANCE = 0.02;

function numbersMatch(left, right) {
    return Number.isFinite(left) &&
        Number.isFinite(right) &&
        Math.abs(left - right) <= AUTO_SOURCE_HOURS_TOLERANCE;
}

function sourceIntervalsMatchAutoResult(row, facts, employmentProfile) {
    const cardIntervals = facts.cards.cardIntervalsRaw;
    const apologistikaIntervals = facts.apologistika.currentApologistikaIntervals;
    const declaredIntervals = facts.declared.declaredIntervals;
    const hasSingleCardInterval = facts.cards.cardIntervalsNormalized.length === 1;
    const declaredHours = toFiniteNumber(row.ores_ergasias);
    const contractualDailyHours = toFiniteNumber(
        employmentProfile.mo_oron_hmerhsias_ergasias
    );
    const hasAnyApologistikaInterval = apologistikaIntervals.some(
        (interval) => interval.start || interval.end
    );

    if (!hasAnyApologistikaInterval) return true;

    return apologistikaIntervals.every((apologistikaInterval, index) => {
        const cardInterval = cardIntervals[index];
        const declaredInterval = declaredIntervals[index];
        if (!apologistikaInterval.start && !apologistikaInterval.end) {
            return !cardInterval?.isComplete || cardInterval.isZeroLength;
        }
        if (
            !apologistikaInterval.isComplete ||
            apologistikaInterval.isZeroLength ||
            !cardInterval?.isComplete ||
            cardInterval.isZeroLength ||
            apologistikaInterval.start !== cardInterval.start
        ) {
            return false;
        }

        return (
            apologistikaInterval.end === cardInterval.end ||
            (declaredInterval?.isComplete &&
                !declaredInterval.isZeroLength &&
                apologistikaInterval.durationMinutes === declaredInterval.durationMinutes) ||
            (hasSingleCardInterval &&
                [declaredHours, contractualDailyHours].some((expectedHours) =>
                    numbersMatch(apologistikaInterval.durationMinutes / 60, expectedHours)
                ))
        );
    });
}

function isProvisionalAutoCalculatedSourceWork({
    row,
    facts,
    cardHours,
    holidayState,
    manualOverride,
    apologistikaState,
    employmentProfile
}) {
    const declaredRestOrNonWork =
        facts.declared.isDeclaredRepo ||
        facts.declared.isDeclaredNonWork ||
        toBoolean(row.repo);
    const categoryCompatible = ['', 'ΕΡΓ'].includes(apologistikaState.category);
    const workHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_ergasias_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const apologistikaIntervalHours = facts.apologistika.currentApologistikaIntervals
        .filter((interval) => interval.isComplete && !interval.isZeroLength)
        .reduce((sum, interval) => sum + interval.durationMinutes / 60, 0);
    const declaredHours = toFiniteNumber(row.ores_ergasias);
    const declaredBreakHours = facts.declared.breaks
        .filter((interval) => interval.isComplete && !interval.isZeroLength)
        .reduce((sum, interval) => sum + interval.durationMinutes / 60, 0);
    const profileBreakMinutes = toFiniteNumber(employmentProfile.external_break_minutes);
    const knownBreakHours = profileBreakMinutes > 0
        ? profileBreakMinutes / 60
        : declaredBreakHours;
    const cardHoursAfterKnownBreak = Math.max(cardHours - knownBreakHours, 0);
    const workHoursCompatible =
        workHoursState.kind === 'ZERO' ||
        (workHoursState.kind === 'POSITIVE' &&
            [
                cardHours,
                cardHoursAfterKnownBreak,
                apologistikaIntervalHours,
                declaredHours
            ].some((expected) =>
                numbersMatch(workHoursState.value, expected)
            ));
    const unrelatedPositiveHours = apologistikaState.numericStates.some((state) => {
        if (state.kind !== 'POSITIVE') return false;
        if (state.field === 'ores_ergasias_apologistika') return false;
        return !AUTO_SOURCE_DERIVED_HOUR_FIELDS.has(state.field);
    });
    const positiveDerivedHours = apologistikaState.numericStates.filter(
        (state) =>
            state.kind === 'POSITIVE' && AUTO_SOURCE_DERIVED_HOUR_FIELDS.has(state.field)
    );
    const isSunday = new Date(row.hmeromhnia).getUTCDay() === 0;
    const derivedHoursCompatibleWithProvenance =
        positiveDerivedHours.length === 0 ||
        (toBoolean(row.apologistiko_biblio) &&
            positiveDerivedHours.every(
                (state) =>
                    !AUTO_SOURCE_HOLIDAY_DERIVED_HOUR_FIELDS.has(state.field) ||
                    holidayState.isHoliday ||
                    isSunday
            ));

    return (
        declaredRestOrNonWork &&
        cardHours !== null &&
        cardHours > 0 &&
        facts.cards.cardIntervalsNormalized.length > 0 &&
        facts.cards.incompleteCardPairs.length === 0 &&
        facts.leave.hasDeclaredLeave === false &&
        toBoolean(row.astheneia) === false &&
        facts.apologistika.existingFlags.astheneia_apologistika === false &&
        holidayState.blocksRepoTransfer === false &&
        manualOverride === false &&
        facts.apologistika.existingFlags.repo_apologistika === false &&
        facts.apologistika.existingFlags.adeia_apologistika === false &&
        facts.leave.kathgoria_adeias_apologistika === '' &&
        categoryCompatible &&
        apologistikaState.invalidNumericValue === false &&
        workHoursCompatible &&
        unrelatedPositiveHours === false &&
        derivedHoursCompatibleWithProvenance &&
        sourceIntervalsMatchAutoResult(row, facts, employmentProfile)
    );
}

function buildRowInfo(row, contexts) {
    const dateKey = dateKeyUtc(row.hmeromhnia);
    const rowKey = normalizeId(row._id || row.id) || dateKey;
    const auditValue =
        getContextValue(contexts.existingAuditCountByRowKey, rowKey) ??
        getContextValue(contexts.existingAuditCountByRowKey, dateKey);
    const existingAuditCount = Math.max(
        Number.parseInt(String(auditValue ?? 0), 10) || 0,
        0
    );
    const facts = buildApasxoliseisScenarioFacts(row, { existingAuditCount });
    const cardHours = toFiniteNumber(row.cards_ores_ergasias);
    const holidayState = resolveRepoTransferHolidayState(
        row,
        contexts.holidayByDateKey,
        dateKey
    );
    const manualOverride = row.is_locked === true || existingAuditCount > 0;
    const criticalWarnings = [
        ...(facts.warnings.missingCriticalFacts || []),
        ...(facts.warnings.conflictingFacts || [])
    ];
    const provisionalAutoCalculatedLeave = isProvisionalAutoCalculatedLeave({
        row,
        facts,
        cardHours,
        holidayState,
        manualOverride
    });
    const blockingDeclaredLeave = facts.leave.hasDeclaredLeave;
    const blockingSickness =
        toBoolean(row.astheneia) || facts.apologistika.existingFlags.astheneia_apologistika;
    const blockingManualOrAuditedState = manualOverride;
    const apologistikaState = inspectApologistikaState(row, facts);
    const provisionalAutoCalculatedSourceWork = isProvisionalAutoCalculatedSourceWork({
        row,
        facts,
        cardHours,
        holidayState,
        manualOverride,
        apologistikaState,
        employmentProfile: contexts.employmentProfile
    });

    return {
        row,
        dateKey,
        facts,
        cardHours,
        holidayState,
        manualOverride,
        criticalWarnings,
        blockingDeclaredLeave,
        provisionalAutoCalculatedLeave,
        provisionalAutoCalculatedSourceWork,
        blockingSickness,
        blockingManualOrAuditedState,
        apologistikaState
    };
}

function sourceExclusions(info) {
    const reasons = [];
    if (info.row.is_locked === true) reasons.push('SOURCE_LOCKED');
    if (info.manualOverride && info.row.is_locked !== true) reasons.push('SOURCE_MANUAL_OVERRIDE');
    if (
        info.blockingDeclaredLeave ||
        info.blockingSickness
    ) {
        reasons.push('SOURCE_LEAVE_OR_SICKNESS');
    }
    if (info.holidayState.blocksRepoTransfer) reasons.push('SOURCE_HOLIDAY');
    if (info.criticalWarnings.length > 0) reasons.push('SOURCE_CONFLICTING_FACTS');
    if (
        !info.facts.cards.cardIntervalsNormalized.length ||
        info.facts.cards.incompleteCardPairs.length > 0
    ) {
        reasons.push('SOURCE_INVALID_CARD_EVIDENCE');
    }
    if (
        !info.provisionalAutoCalculatedSourceWork &&
        info.apologistikaState.category &&
        info.apologistikaState.category !== 'ΕΡΓ'
    ) {
        reasons.push('SOURCE_CONFLICTING_APOLOGISTIKA_CATEGORY');
    }
    if (info.apologistikaState.invalidNumericValue) {
        reasons.push('SOURCE_INVALID_APOLOGISTIKA_NUMERIC_VALUE');
    }
    if (
        !info.provisionalAutoCalculatedSourceWork &&
        (info.apologistikaState.substantiveState || info.blockingManualOrAuditedState)
    ) {
        reasons.push('SOURCE_ALREADY_PROCESSED');
    }
    return reasons;
}

function targetExclusions(info) {
    const reasons = [];
    if (info.row.is_locked === true) reasons.push('TARGET_LOCKED');
    if (info.manualOverride && info.row.is_locked !== true) reasons.push('TARGET_MANUAL_OVERRIDE');
    if (info.blockingDeclaredLeave || info.blockingSickness) {
        reasons.push('TARGET_LEAVE_OR_SICKNESS');
    }
    if (info.holidayState.blocksRepoTransfer) reasons.push('TARGET_HOLIDAY');
    if (toBoolean(info.row.repo)) reasons.push('TARGET_CONFLICTING_REPO_STATE');
    const blockingCriticalWarnings = info.criticalWarnings.filter(
        (warning) =>
            !(
                info.cardHours === 0 &&
                warning === 'NORMALIZED_CARD_INTERVALS_WITHOUT_CARD_HOURS'
            )
    );
    if (blockingCriticalWarnings.length > 0) reasons.push('TARGET_CONFLICTING_FACTS');
    if (
        !info.provisionalAutoCalculatedLeave &&
        info.apologistikaState.category &&
        info.apologistikaState.category !== 'ΕΡΓ'
    ) {
        reasons.push('TARGET_CONFLICTING_APOLOGISTIKA_CATEGORY');
    }
    if (info.apologistikaState.invalidNumericValue) {
        reasons.push('TARGET_INVALID_APOLOGISTIKA_NUMERIC_VALUE');
    }
    if (
        !info.provisionalAutoCalculatedLeave &&
        (info.apologistikaState.substantiveState || info.blockingManualOrAuditedState)
    ) {
        reasons.push('TARGET_ALREADY_PROCESSED');
    }
    return reasons;
}

function targetWarnings(info) {
    if (info.cardHours !== 0) return [];
    const warnings = [];
    if (info.facts.cards.cardIntervalsRaw.some((interval) => interval.isComplete)) {
        warnings.push('TARGET_ZERO_HOURS_WITH_CARD_INTERVALS');
    }
    if (info.facts.cards.incompleteCardPairs.length > 0) {
        warnings.push('TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR');
    }
    return warnings;
}

function rowReference(info, semanticTargetCategory) {
    return {
        prodhlomena_oraria_id: normalizeId(info.row._id || info.row.id),
        hmeromhnia: info.dateKey,
        current_category: toTrimmedString(info.row.kathgoria_ergasias),
        semantic_target_category: semanticTargetCategory
    };
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return value;
}

function buildResult({
    status,
    reasons = [],
    warnings = [],
    week = {},
    employee = {},
    counts = {},
    source = null,
    target = null,
    semanticProposal = null
}) {
    return deepFreeze({
        scenario_code: SCENARIO_CODE,
        scenario_version: SCENARIO_VERSION,
        eligibility_status: status,
        requires_hr_review: true,
        can_auto_apply: false,
        reasons: [...new Set(reasons)],
        warnings: [...new Set(warnings)],
        week: {
            start_date: week.start_date || null,
            end_date: week.end_date || null
        },
        employee: {
            team: normalizePrimitiveString(employee.team),
            company_kod: normalizePrimitiveString(employee.company_kod),
            kodikos: normalizePrimitiveString(employee.kodikos),
            typos_apasxolhshs: normalizePrimitiveString(employee.typos_apasxolhshs),
            mhniaia_repo: normalizeRepoLimitForResult(employee.mhniaia_repo),
            profile_source: normalizePrimitiveString(employee.profile_source),
            profile_istoriko_id: normalizeId(employee.profile_istoriko_id),
            profile_effective_date: dateKeyUtc(employee.profile_effective_date),
            profile_changed_inside_week: employee.profile_changed_inside_week === true
        },
        counts: {
            source_candidates: counts.source_candidates ?? 0,
            target_candidates: counts.target_candidates ?? 0,
            existing_actual_repo: counts.existing_actual_repo ?? null,
            predicted_final_repo: counts.predicted_final_repo ?? null
        },
        source,
        target,
        semantic_proposal: semanticProposal
    });
}

function analyzeWeeklyRepoTransferSinglePair({
    weekRows = [],
    employmentProfile = {},
    holidayByDateKey = new Map(),
    existingAuditCountByRowKey = new Map()
} = {}) {
    const rows = Array.isArray(weekRows) ? weekRows : [];
    const profile = asPlainObject(employmentProfile);
    const base = {
        status: ELIGIBILITY_STATUS.INVALID_INPUT,
        reasons: [],
        week: {},
        employee: {
            typos_apasxolhshs: normalizeEmploymentType(profile.typos_apasxolhshs),
            mhniaia_repo: profile.mhniaia_repo,
            profile_source: profile.source,
            profile_istoriko_id: profile.istorikoId,
            profile_effective_date:
                profile.effective_date || profile.hmeromhnia_isxyos_oron_ergasias_apo,
            profile_changed_inside_week: profile.profile_changed_inside_week
        }
    };

    if (rows.length !== 7) {
        return buildResult({ ...base, reasons: ['INCOMPLETE_WEEK_DATA'] });
    }
    if (rows.some((row) => !isPlainObject(row))) {
        return buildResult({ ...base, reasons: ['INVALID_WEEK_ROW'] });
    }

    const keys = rows.map((row) => dateKeyUtc(row.hmeromhnia));
    if (keys.some((key) => !key)) {
        return buildResult({ ...base, reasons: ['INVALID_WEEK_DATE'] });
    }
    if (new Set(keys).size !== 7) {
        return buildResult({ ...base, reasons: ['DUPLICATE_WEEK_DATE'] });
    }

    const weekStartKeys = new Set(keys.map(startOfWeekSundayUtc));
    if (weekStartKeys.size !== 1) {
        return buildResult({ ...base, reasons: ['CROSS_WEEK_ROWS'] });
    }
    const weekStart = [...weekStartKeys][0];
    const expectedKeys = Array.from({ length: 7 }, (_, index) => addDaysUtc(weekStart, index));
    if (expectedKeys.some((key) => !keys.includes(key))) {
        return buildResult({ ...base, reasons: ['INCOMPLETE_WEEK_DATA'] });
    }
    base.week = { start_date: weekStart, end_date: addDaysUtc(weekStart, 6) };

    const identities = rows.map((row) => [
        toTrimmedString(row.team),
        toTrimmedString(row.company_kod),
        toTrimmedString(row.kodikos)
    ]);
    if (identities.some((parts) => parts.some((part) => !part))) {
        return buildResult({ ...base, reasons: ['MISSING_EMPLOYEE_IDENTITY'] });
    }
    if (new Set(identities.map((parts) => parts.join('|'))).size !== 1) {
        return buildResult({ ...base, reasons: ['MULTIPLE_EMPLOYEES'] });
    }
    [base.employee.team, base.employee.company_kod, base.employee.kodikos] = identities[0];

    const employmentType = normalizeEmploymentType(profile.typos_apasxolhshs);
    base.employee.typos_apasxolhshs = employmentType;
    if (employmentType === EMPLOYMENT_TYPE.ROTATIONAL) {
        return buildResult({
            ...base,
            status: ELIGIBILITY_STATUS.NOT_APPLICABLE,
            reasons: ['ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED']
        });
    }
    if (![EMPLOYMENT_TYPE.FULL, EMPLOYMENT_TYPE.PARTIAL].includes(employmentType)) {
        return buildResult({ ...base, reasons: ['UNSUPPORTED_EMPLOYMENT_TYPE'] });
    }

    const repoLimit = profile.mhniaia_repo;
    if (!Number.isSafeInteger(repoLimit) || ![1, 2].includes(repoLimit)) {
        return buildResult({
            ...base,
            status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: ['INVALID_MHNIAIA_REPO']
        });
    }
    base.employee.mhniaia_repo = repoLimit;

    const rowInfos = rows.map((row) =>
        buildRowInfo(row, {
            holidayByDateKey,
            existingAuditCountByRowKey,
            employmentProfile: profile
        })
    );
    const sourceCategory = employmentType === EMPLOYMENT_TYPE.FULL ? 'ΑΝ' : 'ΜΕ';
    const targetCategory = employmentType === EMPLOYMENT_TYPE.FULL ? 'ΑΝ' : 'ΜΕ';
    const potentialSources = rowInfos.filter(
        (info) =>
            toTrimmedString(info.row.kathgoria_ergasias) === sourceCategory &&
            info.cardHours !== null &&
            info.cardHours > 0
    );
    const cleanSources = potentialSources.filter((info) => sourceExclusions(info).length === 0);
    const potentialTargets = rowInfos.filter(
        (info) =>
            toTrimmedString(info.row.kathgoria_ergasias) === 'ΕΡΓ' &&
            info.cardHours === 0
    );
    const cleanTargets = potentialTargets.filter((info) => targetExclusions(info).length === 0);
    const counts = {
        source_candidates: cleanSources.length,
        target_candidates: cleanTargets.length
    };

    if (cleanSources.length !== 1) {
        const unsafeReasons = potentialSources.flatMap(sourceExclusions);
        return buildResult({
            ...base,
            status:
                cleanSources.length > 1 || potentialSources.length > 0
                    ? ELIGIBILITY_STATUS.NEEDS_REVIEW
                    : ELIGIBILITY_STATUS.NOT_APPLICABLE,
            reasons: [
                cleanSources.length > 1 ? 'MULTIPLE_SOURCE_CANDIDATES' : 'NO_SOURCE_CANDIDATE',
                ...unsafeReasons
            ],
            counts
        });
    }

    if (cleanTargets.length !== 1) {
        const unsafeReasons = potentialTargets.flatMap(targetExclusions);
        return buildResult({
            ...base,
            status:
                cleanTargets.length > 1 || potentialTargets.length > 0
                    ? ELIGIBILITY_STATUS.NEEDS_REVIEW
                    : ELIGIBILITY_STATUS.NOT_APPLICABLE,
            reasons: [
                cleanTargets.length > 1 ? 'MULTIPLE_TARGET_CANDIDATES' : 'NO_TARGET_CANDIDATE',
                ...unsafeReasons
            ],
            counts
        });
    }

    const isActualRepo = (info) => {
        if (info.cardHours !== 0) return false;
        const category = toTrimmedString(info.row.kathgoria_ergasias);
        if (employmentType === EMPLOYMENT_TYPE.FULL) {
            return category === 'ΑΝ' || toBoolean(info.row.repo);
        }
        return category === 'ΜΕ' || category === 'ΑΝ' || toBoolean(info.row.repo);
    };
    counts.existing_actual_repo = rowInfos.filter(isActualRepo).length;
    counts.predicted_final_repo = counts.existing_actual_repo + 1;

    if (counts.predicted_final_repo !== repoLimit) {
        const warnings = [...new Set(targetWarnings(cleanTargets[0]))].sort();
        return buildResult({
            ...base,
            status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: [
                counts.predicted_final_repo < repoLimit
                    ? 'REPO_DEFICIT_REMAINS'
                    : 'REPO_LIMIT_EXCEEDED'
            ],
            counts,
            warnings
        });
    }

    const warnings = [...new Set(targetWarnings(cleanTargets[0]))].sort();
    return buildResult({
        ...base,
        status: ELIGIBILITY_STATUS.ELIGIBLE,
        warnings,
        counts,
        source: rowReference(cleanSources[0], 'ΕΡΓ'),
        target: rowReference(cleanTargets[0], targetCategory),
        semanticProposal: {
            operation_type: 'REPO_TRANSFER_WITHIN_WEEK',
            atomic_pair_required: true,
            source_role: 'BECOMES_WORK',
            target_role: 'BECOMES_REPO'
        }
    });
}

module.exports = {
    analyzeWeeklyRepoTransferSinglePair,
    normalizeEmploymentType,
    SCENARIO_CODE,
    SCENARIO_VERSION,
    ELIGIBILITY_STATUS,
    EMPLOYMENT_TYPE
};
