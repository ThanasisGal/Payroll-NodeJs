// Pure parser for the daily schedule description returned by ERGANI II.
//
// Overtime annotations in the same cell are informational and must never be
// persisted as an additional declared-work interval. Legitimate split-shift
// intervals that appear before the overtime annotation remain untouched.

const SCHEDULE_CATEGORY = Object.freeze({
    NO_WORK: 'ME',
    REST: 'AN',
    WORK: 'ERG',
    TELEWORK: 'THL',
    UNKNOWN: ''
});

function normalizeCellText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function stripOvertimeAnnotation(value) {
    const sourceText = normalizeCellText(value);
    if (!sourceText) {
        return {
            scheduleText: '',
            ignoredOvertimeAnnotation: false
        };
    }

    // Supports both accented and unaccented spelling, for example:
    // "Υπερωρία 17:59-18:00" and "Υπερωρια 17:59-18:00".
    const marker = /\s+ΥΠΕΡΩΡ[ΙΊ]Α(?=\s|:|$)/iu;
    const match = marker.exec(sourceText);

    if (!match) {
        return {
            scheduleText: sourceText,
            ignoredOvertimeAnnotation: false
        };
    }

    return {
        scheduleText: sourceText.slice(0, match.index).trim(),
        ignoredOvertimeAnnotation: true
    };
}

function extractTimePairs(value) {
    const text = normalizeCellText(value);
    const regex = /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/g;
    const pairs = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        pairs.push({ from: match[1], to: match[2] });
    }

    return pairs;
}

function parseErganiScheduleCell(value) {
    const sourceText = normalizeCellText(value);
    const { scheduleText, ignoredOvertimeAnnotation } =
        stripOvertimeAnnotation(sourceText);
    const normalizedScheduleText = scheduleText.toLocaleUpperCase('el-GR');

    let category = SCHEDULE_CATEGORY.UNKNOWN;
    let pairs = [];

    if (/^ΜΗ\s+ΕΡΓΑΣΙΑ$/u.test(normalizedScheduleText)) {
        category = SCHEDULE_CATEGORY.NO_WORK;
    } else if (/^ΑΝΑΠΑΥΣΗ\s*\/\s*ΡΕΠΟ$/u.test(normalizedScheduleText)) {
        category = SCHEDULE_CATEGORY.REST;
    } else if (/^ΕΡΓΑΣΙΑ(?:\s|$)/u.test(normalizedScheduleText)) {
        category = SCHEDULE_CATEGORY.WORK;
        pairs = extractTimePairs(scheduleText);
    } else if (/^ΤΗΛΕΡΓΑΣΙΑ(?:\s|$)/u.test(normalizedScheduleText)) {
        category = SCHEDULE_CATEGORY.TELEWORK;
        pairs = extractTimePairs(scheduleText);
    }

    return Object.freeze({
        sourceText,
        scheduleText,
        category,
        pairs: Object.freeze(pairs),
        ignoredOvertimeAnnotation
    });
}

module.exports = {
    SCHEDULE_CATEGORY,
    stripOvertimeAnnotation,
    extractTimePairs,
    parseErganiScheduleCell
};
