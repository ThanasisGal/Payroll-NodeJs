// Pure facts extractor for Apasxoliseis scenario classification.
// This module must stay free of DB, controller, route, and network dependencies.

const DECLARED_INTERVAL_FIELDS = [
    ['apo_ora_01', 'eos_ora_01'],
    ['apo_ora_02', 'eos_ora_02'],
    ['apo_ora_03', 'eos_ora_03']
];

const DECLARED_BREAK_FIELDS = [
    ['apo_ora_01_break', 'eos_ora_01_break'],
    ['apo_ora_02_break', 'eos_ora_02_break'],
    ['apo_ora_03_break', 'eos_ora_03_break']
];

const CARD_INTERVAL_FIELDS = [
    ['cards_apo_ora_01', 'cards_eos_ora_01'],
    ['cards_apo_ora_02', 'cards_eos_ora_02'],
    ['cards_apo_ora_03', 'cards_eos_ora_03']
];

const APOLOGISTIKA_INTERVAL_FIELDS = [
    ['apo_ora_01_apologistika', 'eos_ora_01_apologistika'],
    ['apo_ora_02_apologistika', 'eos_ora_02_apologistika'],
    ['apo_ora_03_apologistika', 'eos_ora_03_apologistika']
];

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function toNumberOrZero(value) {
    if (value === null || value === undefined || value === '') return 0;

    const n = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
}

function toBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeTimeValue(value) {
    if (value === null || value === undefined) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const hours = String(value.getHours()).padStart(2, '0');
        const minutes = String(value.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    const raw = toTrimmedString(value);
    if (!raw) return null;

    const match = raw.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
    if (!match) return null;

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);

    if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(value) {
    const normalized = normalizeTimeValue(value);
    if (!normalized) return null;

    const [hours, minutes] = normalized.split(':').map((part) => Number.parseInt(part, 10));
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

    return hours * 60 + minutes;
}

function buildIntervalsFromFields(row = {}, fieldPairs = []) {
    return fieldPairs.map(([startField, endField], zeroBasedIndex) => {
        const start = normalizeTimeValue(row?.[startField]);
        const end = normalizeTimeValue(row?.[endField]);
        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);
        const hasStart = start !== null;
        const hasEnd = end !== null;
        const isComplete = hasStart && hasEnd;
        const isZeroLength = isComplete && startMinutes === endMinutes;
        const isOvernight = isComplete && !isZeroLength && endMinutes < startMinutes;
        let durationMinutes = 0;

        if (isComplete && !isZeroLength) {
            durationMinutes = isOvernight
                ? endMinutes + 24 * 60 - startMinutes
                : endMinutes - startMinutes;
        }

        return {
            index: zeroBasedIndex + 1,
            start,
            end,
            startMinutes,
            endMinutes,
            isComplete,
            isZeroLength,
            isOvernight,
            durationMinutes
        };
    });
}

function buildDeclaredIntervals(row = {}) {
    return buildIntervalsFromFields(row, DECLARED_INTERVAL_FIELDS);
}

function buildCardIntervals(row = {}) {
    return buildIntervalsFromFields(row, CARD_INTERVAL_FIELDS);
}

function buildApologistikaIntervals(row = {}) {
    return buildIntervalsFromFields(row, APOLOGISTIKA_INTERVAL_FIELDS);
}

function buildBreakIntervals(row = {}) {
    return buildIntervalsFromFields(row, DECLARED_BREAK_FIELDS);
}

function getCompleteNonZeroIntervals(intervals = []) {
    return intervals.filter((interval) => interval.isComplete && !interval.isZeroLength);
}

function getIncompleteIntervals(intervals = []) {
    return intervals.filter((interval) => !interval.isComplete && (interval.start || interval.end));
}

function buildExistingFlags(row = {}) {
    return {
        apologistiko_biblio: toBoolean(row.apologistiko_biblio),
        repo_apologistika: toBoolean(row.repo_apologistika),
        adeia_apologistika: toBoolean(row.adeia_apologistika),
        astheneia_apologistika: toBoolean(row.astheneia_apologistika),
        argia: toBoolean(row.argia),
        kyriakes_apologistika: toBoolean(row.kyriakes_apologistika)
    };
}

function buildWarnings({ row, declared, cards }) {
    const missingCriticalFacts = [];
    const conflictingFacts = [];

    if (!row || typeof row !== 'object') {
        missingCriticalFacts.push('MISSING_ROW');
    }

    if (!row?.hmeromhnia) {
        missingCriticalFacts.push('MISSING_HMEROMHNIA');
    }

    if (!toTrimmedString(row?.kathgoria_ergasias)) {
        missingCriticalFacts.push('MISSING_KATHGORIA_ERGASIAS');
    }

    if (
        declared.isDeclaredWork &&
        !declared.hasDeclaredHours &&
        declared.hasDeclaredIntervals
    ) {
        conflictingFacts.push('DECLARED_WORK_INTERVALS_WITHOUT_DECLARED_HOURS');
    }

    if (cards.cardHours > 0 && cards.cardIntervalsNormalized.length === 0) {
        conflictingFacts.push('CARD_HOURS_WITHOUT_NORMALIZED_CARD_INTERVALS');
    }

    if (cards.cardHours === 0 && cards.cardIntervalsNormalized.length > 0) {
        conflictingFacts.push('NORMALIZED_CARD_INTERVALS_WITHOUT_CARD_HOURS');
    }

    return {
        missingCriticalFacts,
        conflictingFacts,
        legalClassificationPending: false
    };
}

function buildApasxoliseisScenarioFacts(row, context = {}) {
    const sourceRow = row && typeof row === 'object' ? row : {};
    const declaredIntervals = buildDeclaredIntervals(sourceRow);
    const cardIntervalsRaw = buildCardIntervals(sourceRow);
    const currentApologistikaIntervals = buildApologistikaIntervals(sourceRow);
    const breaks = buildBreakIntervals(sourceRow);
    const declaredHours = toNumberOrZero(sourceRow.ores_ergasias);
    const cardHours = toNumberOrZero(sourceRow.cards_ores_ergasias);
    const currentApologistikaHours = toNumberOrZero(sourceRow.ores_ergasias_apologistika);
    const kathgoriaErgasias = toTrimmedString(sourceRow.kathgoria_ergasias);
    const cardIntervalsNormalized = getCompleteNonZeroIntervals(cardIntervalsRaw);
    const existingAuditCount = Math.max(
        Number.parseInt(String(context.existingAuditCount ?? 0), 10) || 0,
        0
    );

    const declared = {
        kathgoria_ergasias: kathgoriaErgasias,
        declaredIntervals,
        declaredHours,
        isDeclaredWork: kathgoriaErgasias === 'ΕΡΓ',
        isDeclaredRepo: kathgoriaErgasias === 'ΑΝ' || toBoolean(sourceRow.repo),
        isDeclaredNonWork: kathgoriaErgasias === 'ΜΕ',
        hasDeclaredIntervals: getCompleteNonZeroIntervals(declaredIntervals).length > 0,
        hasDeclaredHours: declaredHours > 0,
        breaks
    };

    const cards = {
        cardIntervalsRaw,
        cardIntervalsNormalized,
        hasCards: cardIntervalsNormalized.length > 0 || cardHours > 0,
        hasZeroLengthCardInterval: cardIntervalsRaw.some((interval) => interval.isZeroLength),
        cardHours,
        incompleteCardPairs: getIncompleteIntervals(cardIntervalsRaw)
    };

    const apologistika = {
        currentApologistikaCategory: toTrimmedString(
            sourceRow.kathgoria_ergasias_apologistika
        ),
        currentApologistikaIntervals,
        currentApologistikaHours,
        existingFlags: buildExistingFlags(sourceRow)
    };

    const leave = {
        hasDeclaredLeave:
            toBoolean(sourceRow.adeia) || toTrimmedString(sourceRow.kathgoria_adeias) !== '',
        kathgoria_adeias: toTrimmedString(sourceRow.kathgoria_adeias),
        adeia_apologistika: toBoolean(sourceRow.adeia_apologistika),
        kathgoria_adeias_apologistika: toTrimmedString(
            sourceRow.kathgoria_adeias_apologistika
        )
    };

    const holidayContext = context.holiday || {};
    const companyFlags = context.companyFlags || {};
    const holiday = {
        isHoliday: toBoolean(holidayContext.isHoliday),
        isMandatoryHoliday: toBoolean(holidayContext.isMandatoryHoliday),
        isOptionalHoliday: toBoolean(holidayContext.isOptionalHoliday),
        holidayDescription: toTrimmedString(holidayContext.description),
        companyWorksOnMandatoryHoliday: toBoolean(
            companyFlags.companyWorksOnMandatoryHoliday
        ),
        companyWorksOnOptionalHoliday: toBoolean(
            companyFlags.companyWorksOnOptionalHoliday
        )
    };

    const review = {
        is_locked: toBoolean(sourceRow.is_locked),
        locked_by: toTrimmedString(sourceRow.locked_by),
        locked_at: sourceRow.locked_at || null,
        existingAuditCount,
        hasManualOverride: toBoolean(sourceRow.is_locked) || existingAuditCount > 0
    };

    const facts = {
        identity: {
            prodhlomena_oraria_id: sourceRow._id || sourceRow.id || null,
            team: toTrimmedString(sourceRow.team),
            company_kod: toTrimmedString(sourceRow.company_kod),
            ypokatasthma: toTrimmedString(sourceRow.ypokatasthma),
            kodikos: toTrimmedString(sourceRow.kodikos),
            hmeromhnia: sourceRow.hmeromhnia || null
        },
        declared,
        cards,
        apologistika,
        leave,
        holiday,
        review,
        warnings: null
    };

    facts.warnings = buildWarnings({
        row,
        declared,
        cards
    });

    return facts;
}

module.exports = {
    buildApasxoliseisScenarioFacts,
    normalizeTimeValue,
    timeToMinutes,
    buildIntervalsFromFields,
    buildDeclaredIntervals,
    buildCardIntervals,
    buildApologistikaIntervals
};
