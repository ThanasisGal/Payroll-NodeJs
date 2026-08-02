// Pure weekly analyzer for one semantic repo-transfer pair.
// This module must stay free of DB, controller, route, network, and write dependencies.

const {
    buildApasxoliseisScenarioFacts,
    buildApologistikaIntervals
} = require('./apasxoliseisScenarioFactsService');
const {
    resolveEffectiveExpectedWeeklyRepo
} = require('./apasxoliseisWeeklyRepoTransferExpectedRepoResolverService');
const {
    analyzeWeeklySixthSeventhDay,
    STATUS: SIXTH_DAY_STATUS
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    LEAVE_PROVENANCE,
    classifyLeaveProvenance
} = require('./apasxoliseisLeaveProvenanceService');
const {
    dateKeyUtc,
    startOfWeekMondayUtc
} = require('../../utils/date/mondaySundayWeek');

const SCENARIO_CODE = 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR';
const SCENARIO_VERSION = 'repo-transfer-single-pair:v4';
const SCENARIO_VERSION_V2 = 'repo-transfer-single-pair:v4';

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

const EMPLOYMENT_FAMILY = Object.freeze({
    FULL: 'FULL',
    PARTIAL_FAMILY: 'PARTIAL_FAMILY'
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

function classifyCardHours(value) {
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
    return Number.isSafeInteger(value) && value >= 1 && value <= 6 ? value : null;
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

function addDaysUtc(dateKey, days) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function normalizeEmploymentType(value) {
    const raw = toTrimmedString(value).toUpperCase().replace(/\s+/g, '_');

    if (['0', '00', 'ΠΛΗΡΗΣ', 'PLHRHS', 'PLIHRIS', 'PLIRIS', 'FULL', 'FULL_TIME'].includes(raw)) {
        return EMPLOYMENT_TYPE.FULL;
    }
    if (['1', '01', 'ΜΕΡΙΚΗ', 'MERIKH', 'MERIKI', 'PARTIAL', 'PART_TIME'].includes(raw)) {
        return EMPLOYMENT_TYPE.PARTIAL;
    }
    if (
        [
            '2',
            '02',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ_ΑΠΑΣΧΟΛΗΣΗ',
            'EK_PERITROPHS',
            'EK_PERITROPIS',
            'EK_PERITROPH',
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
    const actualWorkHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_pragmatikhs_ergasias_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const absenceHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_apoysias_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const paidLeaveHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_adeias_pistomenes_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const holidayCreditedHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_argias_pistomenes_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const unrelatedPositiveHours = apologistikaState.numericStates.some(
        (state) =>
            state.kind === 'POSITIVE' &&
            ![
                'ores_ergasias_apologistika',
                'ores_apoysias_apologistika',
                'ores_pragmatikhs_ergasias_apologistika',
                'ores_adeias_pistomenes_apologistika',
                'ores_argias_pistomenes_apologistika'
            ].includes(state.field)
    );
    const declaredHours = toFiniteNumber(row.ores_ergasias);
    const workHoursMatchFallback =
        workHoursState.kind === 'ZERO' ||
        (workHoursState.kind === 'POSITIVE' &&
            declaredHours !== null &&
            workHoursState.value === declaredHours);
    const paidLeaveHoursCompatible =
        paidLeaveHoursState.kind === 'ZERO' ||
        (paidLeaveHoursState.kind === 'POSITIVE' &&
            declaredHours !== null &&
            numbersMatch(paidLeaveHoursState.value, declaredHours));
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
        classifyLeaveProvenance(row) === LEAVE_PROVENANCE.AUTO_CALCULATED_LEAVE &&
        facts.declared.isDeclaredWork &&
        cardHours === 0 &&
        blockingSickness === false &&
        holidayState.blocksRepoTransfer === false &&
        manualOverride === false &&
        autoLeaveMarker &&
        compatibleCalculatedCategory &&
        compatibleLeaveCategory &&
        apologistikaState.invalidNumericValue === false &&
        workHoursMatchFallback &&
        absenceHoursState.kind === 'ZERO' &&
        actualWorkHoursState.kind === 'ZERO' &&
        paidLeaveHoursCompatible &&
        holidayCreditedHoursState.kind === 'ZERO' &&
        unrelatedPositiveHours === false &&
        hasCompleteNonZeroApologistikaInterval(row) === false &&
        facts.apologistika.existingFlags.repo_apologistika === false
    );
}

const AUTO_SOURCE_DERIVED_HOUR_FIELDS = new Set([
    'ores_pragmatikhs_ergasias_apologistika',
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
    const isBlankUnscheduledDay =
        toTrimmedString(row.kathgoria_ergasias) === '' &&
        toFiniteNumber(row.ores_ergasias) === 0 &&
        facts.declared.hasDeclaredIntervals === false;
    const declaredRestOrNonWork =
        facts.declared.isDeclaredRepo ||
        facts.declared.isDeclaredNonWork ||
        isBlankUnscheduledDay ||
        toBoolean(row.repo);
    const categoryCompatible = ['', 'ΕΡΓ'].includes(apologistikaState.category);
    const workHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_ergasias_apologistika'
    ) || { kind: 'ZERO', value: 0 };
    const actualWorkHoursState = apologistikaState.numericStates.find(
        (state) => state.field === 'ores_pragmatikhs_ergasias_apologistika'
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
    const actualWorkHoursCompatible =
        actualWorkHoursState.kind === 'ZERO' ||
        (actualWorkHoursState.kind === 'POSITIVE' &&
            [cardHours, cardHoursAfterKnownBreak, apologistikaIntervalHours]
                .some((expected) => numbersMatch(actualWorkHoursState.value, expected)));
    const unrelatedPositiveHours = apologistikaState.numericStates.some((state) => {
        if (state.kind !== 'POSITIVE') return false;
        if (state.field === 'ores_ergasias_apologistika') return false;
        return !AUTO_SOURCE_DERIVED_HOUR_FIELDS.has(state.field);
    });
    const positiveDerivedHours = apologistikaState.numericStates.filter(
        (state) =>
            state.kind === 'POSITIVE' &&
            AUTO_SOURCE_DERIVED_HOUR_FIELDS.has(state.field) &&
            state.field !== 'ores_pragmatikhs_ergasias_apologistika'
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
        actualWorkHoursCompatible &&
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
    const cardHoursState = classifyCardHours(row.cards_ores_ergasias);
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
    const leaveProvenance = classifyLeaveProvenance(row);
    const blockingDeclaredLeave =
        leaveProvenance === LEAVE_PROVENANCE.HR_DECLARED_LEAVE;
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
        cardHoursState,
        holidayState,
        manualOverride,
        criticalWarnings,
        blockingDeclaredLeave,
        leaveProvenance,
        provisionalAutoCalculatedLeave,
        provisionalAutoCalculatedSourceWork,
        blockingSickness,
        blockingManualOrAuditedState,
        apologistikaState
    };
}

function sourceExclusions(info) {
    const reasons = [];
    const blockingCriticalWarnings = info.criticalWarnings.filter(
        (warning) =>
            !(
                info.provisionalAutoCalculatedSourceWork &&
                warning === 'MISSING_KATHGORIA_ERGASIAS'
            )
    );
    if (info.row.is_locked === true) reasons.push('SOURCE_LOCKED');
    if (info.manualOverride && info.row.is_locked !== true) reasons.push('SOURCE_MANUAL_OVERRIDE');
    if (
        info.blockingDeclaredLeave ||
        info.blockingSickness
    ) {
        reasons.push('SOURCE_LEAVE_OR_SICKNESS');
    }
    if (info.holidayState.blocksRepoTransfer) reasons.push('SOURCE_HOLIDAY');
    if (blockingCriticalWarnings.length > 0) reasons.push('SOURCE_CONFLICTING_FACTS');
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
            effective_expected_weekly_repo:
                normalizeRepoLimitForResult(employee.effective_expected_weekly_repo),
            repo_resolution_source:
                normalizePrimitiveString(employee.repo_resolution_source),
            scheduled_work_days:
                Number.isSafeInteger(employee.scheduled_work_days)
                    ? employee.scheduled_work_days
                    : null,
            effective_weekly_workdays:
                Number.isSafeInteger(employee.effective_weekly_workdays)
                    ? employee.effective_weekly_workdays
                    : null,
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
        weekly_resolution: counts.sixth_seventh_day
            ? {
                  expected_repo: employee.effective_expected_weekly_repo ?? null,
                  current_actual_repo: counts.existing_actual_repo ?? null,
                  resolved_repo: counts.resolved_repo ?? counts.predicted_final_repo ?? null,
                  actual_workdays: counts.actual_workdays ?? null,
                  sixth_day_count: counts.sixth_day_count ?? 0,
                  seventh_day_count: counts.seventh_day_count ?? 0,
                  sixth_seventh_day: counts.sixth_seventh_day
              }
            : null,
        source,
        target,
        semantic_proposal: semanticProposal
    });
}

function analyzeWeeklyRepoTransferSinglePairInternal(input = {}, options = {}) {
    const {
        weekRows = [],
        employmentProfile = {},
        holidayByDateKey = new Map(),
        existingAuditCountByRowKey = new Map()
    } = input;
    const repoLimitIsValid =
        typeof options.repoLimitIsValid === 'function'
            ? options.repoLimitIsValid
            : (value) => Number.isSafeInteger(value) && [1, 2].includes(value);
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

    const weekStartKeys = new Set(
        keys.map((key) => dateKeyUtc(startOfWeekMondayUtc(key)))
    );
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

    const repoResolution = resolveEffectiveExpectedWeeklyRepo({
        weekRows: rows,
        effectiveProfile: profile
    });
    if (!repoResolution.ok) {
        return buildResult({
            ...base,
            status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: [repoResolution.reason],
            employee: {
                ...base.employee,
                scheduled_work_days: repoResolution.scheduledWorkDays,
                effective_weekly_workdays: repoResolution.effectiveWeeklyWorkdays
            }
        });
    }
    const repoLimit = repoResolution.effectiveExpectedWeeklyRepo;
    if (!repoLimitIsValid(repoLimit)) {
        return buildResult({
            ...base,
            status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: ['INVALID_EFFECTIVE_EXPECTED_WEEKLY_REPO']
        });
    }
    base.employee.mhniaia_repo = repoLimit;
    base.employee.effective_expected_weekly_repo = repoLimit;
    base.employee.repo_resolution_source = repoResolution.repoResolutionSource;
    base.employee.scheduled_work_days = repoResolution.scheduledWorkDays;
    base.employee.effective_weekly_workdays = repoResolution.effectiveWeeklyWorkdays;

    const rowInfos = rows.map((row) =>
        buildRowInfo(row, {
            holidayByDateKey,
            existingAuditCountByRowKey,
            employmentProfile: profile
        })
    );
    const sourceCategory = employmentType === EMPLOYMENT_TYPE.FULL ? 'ΑΝ' : 'ΜΕ';
    const targetCategory = employmentType === EMPLOYMENT_TYPE.FULL ? 'ΑΝ' : 'ΜΕ';
    const potentialSources = rowInfos.filter((info) => {
        const category = toTrimmedString(info.row.kathgoria_ergasias);
        const isFullTimeBlankUnscheduledSource =
            employmentType === EMPLOYMENT_TYPE.FULL &&
            category === '' &&
            toFiniteNumber(info.row.ores_ergasias) === 0 &&
            info.facts.declared.hasDeclaredIntervals === false &&
            info.provisionalAutoCalculatedSourceWork;

        return (
            (category === sourceCategory || isFullTimeBlankUnscheduledSource) &&
            info.cardHours !== null &&
            info.cardHours > 0
        );
    });
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

    if (
        cleanSources[0].dateKey.slice(0, 7) !==
        cleanTargets[0].dateKey.slice(0, 7)
    ) {
        return buildResult({
            ...base,
            status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: ['CROSS_MONTH_REPO_TRANSFER_NOT_ALLOWED'],
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
    counts.resolved_repo = counts.predicted_final_repo;

    const sixthDayProjectionRows = rows.map((row) => {
        const id = normalizeId(row._id || row.id);
        if (id === normalizeId(cleanSources[0].row._id || cleanSources[0].row.id)) {
            return { ...row, kathgoria_ergasias_apologistika: 'ΕΡΓ' };
        }
        if (id === normalizeId(cleanTargets[0].row._id || cleanTargets[0].row.id)) {
            return {
                ...row,
                kathgoria_ergasias_apologistika: targetCategory,
                repo_apologistika: true,
                adeia_apologistika: false,
                kathgoria_adeias_apologistika: '',
                ores_apoysias_apologistika: 0,
                ores_ergasias_apologistika: 0
            };
        }
        return row;
    });
    const sixthSeventhDay = analyzeWeeklySixthSeventhDay({
        weekRows: sixthDayProjectionRows,
        effectiveProfile: profile
    });
    counts.actual_workdays = Array.isArray(sixthSeventhDay.dailyFacts)
        ? sixthSeventhDay.dailyFacts.filter((day) => day.countsAsActualWorkDay).length
        : null;
    counts.sixth_day_count = sixthSeventhDay.sixthDay ? 1 : 0;
    counts.seventh_day_count = sixthSeventhDay.seventhDay ? 1 : 0;
    counts.sixth_seventh_day = {
        policy_version: sixthSeventhDay.policyVersion,
        status: sixthSeventhDay.status,
        reasons: [...(sixthSeventhDay.reasons || [])],
        warnings: [...(sixthSeventhDay.warnings || [])],
        sixth_day: sixthSeventhDay.sixthDay || null,
        seventh_day: sixthSeventhDay.seventhDay || null
    };

    if (counts.predicted_final_repo !== repoLimit) {
        const warnings = [...new Set(targetWarnings(cleanTargets[0]))].sort();
        const sixthDayExplainsOneMissingRepo =
            employmentType === EMPLOYMENT_TYPE.FULL &&
            Number(profile.hmeres_ergasias_ebdomadas) === 5 &&
            counts.predicted_final_repo === repoLimit - 1 &&
            counts.actual_workdays === 6 &&
            sixthSeventhDay.status === SIXTH_DAY_STATUS.READY &&
            Boolean(sixthSeventhDay.sixthDay) &&
            !sixthSeventhDay.seventhDay;
        if (sixthDayExplainsOneMissingRepo) {
            return buildResult({
                ...base,
                status: ELIGIBILITY_STATUS.ELIGIBLE,
                warnings: [...warnings, ...(sixthSeventhDay.warnings || [])],
                counts,
                source: rowReference(cleanSources[0], 'ΕΡΓ'),
                target: rowReference(cleanTargets[0], targetCategory),
                semanticProposal: {
                    operation_type: 'REPO_TRANSFER_WITHIN_WEEK',
                    atomic_pair_required: true,
                    source_role: 'BECOMES_WORK',
                    target_role: 'BECOMES_REPO',
                    repo_deficit_resolution: 'ONE_REPO_PLUS_CLASSIFIED_SIXTH_DAY'
                }
            });
        }
        const unresolvedFiveDaySixthDayDecision =
            employmentType === EMPLOYMENT_TYPE.FULL &&
            Number(profile.hmeres_ergasias_ebdomadas) === 5 &&
            counts.predicted_final_repo === repoLimit - 1 &&
            counts.actual_workdays === 6 &&
            sixthSeventhDay.status === SIXTH_DAY_STATUS.NEEDS_HR_DECISION;
        if (unresolvedFiveDaySixthDayDecision) {
            return buildResult({
                ...base,
                status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
                reasons: [...new Set(sixthSeventhDay.reasons || [])].sort(),
                counts,
                warnings: [...warnings, ...(sixthSeventhDay.warnings || [])]
            });
        }
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

function analyzeWeeklyRepoTransferSinglePairV1(input = {}) {
    return analyzeWeeklyRepoTransferSinglePairInternal(input, {
        repoLimitIsValid: (value) =>
            Number.isSafeInteger(value) && value >= 1 && value <= 6
    });
}

function employmentFamily(employmentType) {
    if (employmentType === EMPLOYMENT_TYPE.FULL) return EMPLOYMENT_FAMILY.FULL;
    if ([EMPLOYMENT_TYPE.PARTIAL, EMPLOYMENT_TYPE.ROTATIONAL].includes(employmentType)) {
        return EMPLOYMENT_FAMILY.PARTIAL_FAMILY;
    }
    return null;
}

function resolveRepoTransferContractVersion(employmentProfile = {}) {
    const employmentType = normalizeEmploymentType(employmentProfile.typos_apasxolhshs);
    return employmentFamily(employmentType) === EMPLOYMENT_FAMILY.FULL ? 'v1' : 'v2';
}

function analyzeWeeklyRepoTransferForEmploymentContract(input = {}) {
    return resolveRepoTransferContractVersion(input.employmentProfile) === 'v1'
        ? analyzeWeeklyRepoTransferSinglePairV1(input)
        : analyzeWeeklyRepoTransferSinglePairV2(input);
}

function withScenarioVersion(result, scenarioVersion) {
    return deepFreeze({ ...result, scenario_version: scenarioVersion });
}

function partialSourceFacts(info) {
    const declared = info.facts.declared;
    return (
        declared.isDeclaredNonWork &&
        declared.hasDeclaredHours === false &&
        declared.hasDeclaredIntervals === false &&
        info.cardHours !== null &&
        info.cardHours > 0 &&
        info.facts.cards.cardIntervalsNormalized.length > 0 &&
        info.facts.cards.incompleteCardPairs.length === 0
    );
}

function partialTargetFacts(info) {
    const declared = info.facts.declared;
    return (
        declared.isDeclaredWork &&
        (declared.hasDeclaredHours || declared.hasDeclaredIntervals) &&
        ['ZERO', 'INVALID'].includes(info.cardHoursState.kind)
    );
}

function partialTargetCardEvidenceExclusions(info) {
    const reasons = [];
    if (info.cardHoursState.kind === 'INVALID') {
        reasons.push('TARGET_INVALID_CARD_HOURS_VALUE');
    }
    if (info.facts.cards.cardIntervalsNormalized.length > 0) {
        reasons.push('TARGET_ZERO_HOURS_WITH_CARD_INTERVALS');
    }
    if (info.facts.cards.incompleteCardPairs.length > 0) {
        reasons.push('TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR');
    }
    if (info.facts.cards.hasZeroLengthCardInterval) {
        reasons.push('TARGET_ZERO_HOURS_WITH_ZERO_LENGTH_CARD_INTERVAL');
    }
    if (info.facts.cards.hasInvalidCardTimeValue) {
        reasons.push('TARGET_INVALID_CARD_TIME_VALUE');
    }
    return reasons;
}

function partialTargetExclusions(info) {
    return [
        ...targetExclusions(info),
        ...partialTargetCardEvidenceExclusions(info)
    ];
}

function analyzeWeeklyRepoTransferSinglePairV2(input = {}) {
    const rows = Array.isArray(input.weekRows) ? input.weekRows : [];
    const profile = asPlainObject(input.employmentProfile);
    const employmentType = normalizeEmploymentType(profile.typos_apasxolhshs);
    const family = employmentFamily(employmentType);

    // FULL deliberately retains the exact v1 analyzer and result contract.
    if (family === EMPLOYMENT_FAMILY.FULL) {
        return analyzeWeeklyRepoTransferSinglePairV1(input);
    }
    if (!family) {
        return withScenarioVersion(
            analyzeWeeklyRepoTransferSinglePairV1(input),
            SCENARIO_VERSION_V2
        );
    }

    // Rotational/discontinuous profiles reuse the same common weekly resolver and
    // established MERIKH pair analysis. Only the normalized identity changes here.
    const equivalentInput = {
        ...input,
        employmentProfile: {
            ...profile,
            typos_apasxolhshs: EMPLOYMENT_TYPE.PARTIAL
        }
    };
    const establishedResult = analyzeWeeklyRepoTransferSinglePairInternal(
        equivalentInput,
        {
            repoLimitIsValid: (value) =>
                Number.isSafeInteger(value) && value >= 1 && value <= 6
        }
    );
    if (rows.length !== 7 || rows.some((row) => !isPlainObject(row))) {
        return withScenarioVersion(establishedResult, SCENARIO_VERSION_V2);
    }

    const rowInfos = rows.map((row) =>
        buildRowInfo(row, {
            holidayByDateKey: input.holidayByDateKey || new Map(),
            existingAuditCountByRowKey: input.existingAuditCountByRowKey || new Map(),
            employmentProfile: profile
        })
    );
    const strictSources = rowInfos.filter(partialSourceFacts);
    const cleanSources = strictSources.filter((info) => sourceExclusions(info).length === 0);
    const strictTargets = rowInfos.filter(partialTargetFacts);
    const cleanTargets = strictTargets.filter(
        (info) => partialTargetExclusions(info).length === 0
    );
    const common = {
        ...establishedResult,
        scenario_version: SCENARIO_VERSION_V2,
        employee: {
            ...establishedResult.employee,
            typos_apasxolhshs: employmentType
        }
    };
    if (
        establishedResult.eligibility_status === ELIGIBILITY_STATUS.INVALID_INPUT ||
        establishedResult.reasons.includes('INVALID_EXPLICIT_MHNIAIA_REPO') ||
        establishedResult.reasons.includes('INVALID_EFFECTIVE_WEEKLY_WORKDAYS')
    ) {
        return deepFreeze(common);
    }

    if (cleanSources.length !== 1) {
        return deepFreeze({
            ...common,
            eligibility_status: strictSources.length > 0
                ? ELIGIBILITY_STATUS.NEEDS_REVIEW
                : ELIGIBILITY_STATUS.NOT_APPLICABLE,
            reasons: [
                cleanSources.length > 1 ? 'MULTIPLE_SOURCE_CANDIDATES' : 'NO_SOURCE_CANDIDATE',
                ...strictSources.flatMap(sourceExclusions)
            ],
            counts: {
                ...common.counts,
                source_candidates: cleanSources.length,
                target_candidates: cleanTargets.length
            },
            source: null,
            target: null,
            semantic_proposal: null
        });
    }

    if (strictTargets.length === 0) {
        return deepFreeze({
            ...common,
            eligibility_status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: ['NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'],
            counts: {
                ...common.counts,
                source_candidates: 1,
                target_candidates: 0
            },
            source: rowReference(cleanSources[0], 'ΕΡΓ'),
            target: null,
            semantic_proposal: {
                operation_type: 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY',
                atomic_pair_required: false,
                runtime_apply_supported: false,
                investigation_guidance: ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ'],
                source_role: 'SOURCE_BECOMES_WORK'
            }
        });
    }

    if (cleanTargets.length === 0) {
        const blockedTargets = strictTargets
            .map((info) => ({
                ...rowReference(info, null),
                blocker_reasons: [...new Set(partialTargetExclusions(info))].sort()
            }))
            .sort(
                (left, right) =>
                    left.hmeromhnia.localeCompare(right.hmeromhnia) ||
                    String(left.prodhlomena_oraria_id || '').localeCompare(
                        String(right.prodhlomena_oraria_id || '')
                    )
            );
        const blockedTargetReasons = [
            ...new Set(blockedTargets.flatMap((target) => target.blocker_reasons))
        ].sort();
        return deepFreeze({
            ...common,
            eligibility_status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: blockedTargetReasons,
            counts: {
                ...common.counts,
                source_candidates: 1,
                target_candidates: 0
            },
            source: rowReference(cleanSources[0], 'ΕΡΓ'),
            target: null,
            semantic_proposal: {
                operation_type: 'PARTIAL_OFFSET_TARGET_BLOCKED',
                atomic_pair_required: false,
                runtime_apply_supported: false,
                investigation_guidance: [],
                source_role: 'SOURCE_BECOMES_WORK',
                blocked_target_candidates_count: blockedTargets.length,
                blocked_target_reasons: blockedTargetReasons,
                blocked_target_candidates: blockedTargets
            }
        });
    }

    if (cleanTargets.length > 1) {
        return deepFreeze({
            ...common,
            eligibility_status: ELIGIBILITY_STATUS.NEEDS_REVIEW,
            reasons: ['MULTIPLE_TARGET_CANDIDATES'],
            counts: {
                ...common.counts,
                source_candidates: 1,
                target_candidates: cleanTargets.length
            },
            source: null,
            target: null,
            semantic_proposal: null
        });
    }

    if (establishedResult.eligibility_status !== ELIGIBILITY_STATUS.ELIGIBLE) {
        return deepFreeze(common);
    }

    return deepFreeze({
        ...common,
        source: rowReference(cleanSources[0], 'ΕΡΓ'),
        target: rowReference(cleanTargets[0], 'ΜΕ'),
        semantic_proposal: {
            ...establishedResult.semantic_proposal,
            source_role: 'SOURCE_BECOMES_WORK',
            target_role: 'TARGET_BECOMES_REPO',
            employment_family: EMPLOYMENT_FAMILY.PARTIAL_FAMILY
        }
    });
}

function analyzeWeeklyRepoTransferSinglePair(input = {}) {
    return analyzeWeeklyRepoTransferSinglePairV1(input);
}

module.exports = {
    analyzeWeeklyRepoTransferSinglePair,
    analyzeWeeklyRepoTransferSinglePairV1,
    analyzeWeeklyRepoTransferSinglePairV2,
    normalizeEmploymentType,
    SCENARIO_CODE,
    SCENARIO_VERSION,
    SCENARIO_VERSION_V2,
    ELIGIBILITY_STATUS,
    EMPLOYMENT_TYPE,
    EMPLOYMENT_FAMILY,
    employmentFamily,
    resolveRepoTransferContractVersion,
    analyzeWeeklyRepoTransferForEmploymentContract
};
