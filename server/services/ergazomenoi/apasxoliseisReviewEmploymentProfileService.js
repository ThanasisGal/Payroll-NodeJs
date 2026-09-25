function normalizeEmploymentType(value) {
    const raw = String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');

    if (['0', '00', 'ΠΛΗΡΗΣ', 'PLHRHS', 'PLIRIS', 'FULL', 'FULL_TIME'].includes(raw)) {
        return '0';
    }

    if (['1', '01', 'ΜΕΡΙΚΗ', 'MERIKH', 'MERIKI', 'PART_TIME'].includes(raw)) {
        return '1';
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
        return '2';
    }

    return '';
}

function positiveNumber(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveFullTimeFromWorkTerms(workTerms = {}) {
    const employmentType =
        normalizeEmploymentType(workTerms.kathestos_apasxolhshs) ||
        normalizeEmploymentType(workTerms.typos_apasxolhshs);

    if (employmentType === '0') return true;
    if (employmentType === '1' || employmentType === '2') return false;

    const weeklyHours = positiveNumber(workTerms.ores_ergasias_ebdomadas);
    if (weeklyHours !== null) return weeklyHours >= 40;

    const weeklyDays = positiveNumber(workTerms.hmeres_ergasias_ebdomadas);
    const dailyHours = positiveNumber(workTerms.mo_oron_hmerhsias_ergasias);
    if (weeklyDays !== null && dailyHours !== null) {
        return weeklyDays * dailyHours >= 40;
    }

    return null;
}

const EMPLOYMENT_REGIME = Object.freeze({
    FULL_TIME: 'FULL_TIME',
    NON_FULL: 'NON_FULL',
    UNKNOWN: 'UNKNOWN'
});

const NO_WORK_EMPLOYMENT_TYPE = Object.freeze({
    FULL_TIME: 'FULL_TIME', PART_TIME: 'PART_TIME', ROTATIONAL: 'ROTATIONAL', UNKNOWN: 'UNKNOWN'
});
const NO_WORK_CLASSIFICATION = Object.freeze({
    REST_REPO: 'REST_REPO', NON_WORK: 'NON_WORK'
});

function normalizeWeeklySystemDays(value) {
    if (value === 5 || value === 6) return value;
    if (typeof value !== 'string') return null;
    const raw = value.trim().toUpperCase().replace(/\s+/g, '');
    if (['5', '5HMERH', '5ΗΜΕΡΗ', '5ΗΜΕΡΟ'].includes(raw)) return 5;
    if (['6', '6HMERH', '6ΗΜΕΡΗ', '6ΗΜΕΡΟ'].includes(raw)) return 6;
    return null;
}

function contractualWeeklyDays(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 7 ? parsed : null;
}

function resolveNoWorkDaySemanticFromWorkTerms(workTerms = {}) {
    const contractType = normalizeEmploymentType(workTerms.kathestos_apasxolhshs);
    const employmentTypeValue = normalizeEmploymentType(workTerms.typos_apasxolhshs);
    const normalizedType = contractType && employmentTypeValue &&
        contractType !== employmentTypeValue ? '' : contractType || employmentTypeValue;
    const employmentType = normalizedType === '0' ? NO_WORK_EMPLOYMENT_TYPE.FULL_TIME
        : normalizedType === '1' ? NO_WORK_EMPLOYMENT_TYPE.PART_TIME
            : normalizedType === '2' ? NO_WORK_EMPLOYMENT_TYPE.ROTATIONAL
                : NO_WORK_EMPLOYMENT_TYPE.UNKNOWN;
    const weeklySystemDays = normalizeWeeklySystemDays(workTerms.typos_ebdomadas);
    const contractualDays = contractualWeeklyDays(workTerms.hmeres_ergasias_ebdomadas);
    const resolved = (classification, erganiCode, reason) => Object.freeze({ status: 'RESOLVED',
        classification, ergani_code: erganiCode, employment_type: employmentType,
        weekly_system_days: weeklySystemDays, contractual_weekly_days: contractualDays, reason });
    if (employmentType === NO_WORK_EMPLOYMENT_TYPE.FULL_TIME) {
        return resolved(NO_WORK_CLASSIFICATION.REST_REPO, 'ΑΝ', 'FULL_TIME_REST_REPO');
    }
    if (employmentType === NO_WORK_EMPLOYMENT_TYPE.ROTATIONAL) {
        return resolved(NO_WORK_CLASSIFICATION.NON_WORK, 'ΜΕ', 'ROTATIONAL_NON_WORK');
    }
    if (employmentType === NO_WORK_EMPLOYMENT_TYPE.PART_TIME &&
        weeklySystemDays !== null && contractualDays !== null) {
        const restRepo = contractualDays >= weeklySystemDays;
        return resolved(restRepo ? NO_WORK_CLASSIFICATION.REST_REPO : NO_WORK_CLASSIFICATION.NON_WORK,
            restRepo ? 'ΑΝ' : 'ΜΕ', restRepo
                ? 'PART_TIME_MEETS_WEEKLY_SYSTEM_THRESHOLD'
                : 'PART_TIME_BELOW_WEEKLY_SYSTEM_THRESHOLD');
    }
    return Object.freeze({ status: 'UNKNOWN', classification: null, ergani_code: null,
        employment_type: employmentType, weekly_system_days: weeklySystemDays,
        contractual_weekly_days: contractualDays,
        reason: employmentType === NO_WORK_EMPLOYMENT_TYPE.UNKNOWN ? 'UNKNOWN_EMPLOYMENT_TYPE'
            : weeklySystemDays === null ? 'WEEKLY_SYSTEM_UNKNOWN' : 'CONTRACTUAL_WEEKLY_DAYS_UNKNOWN' });
}

function resolveNoWorkDaySemanticForDate({ date, effectiveProfilesByDate = {},
    effectiveProfile = {} } = {}) {
    const hasDateSpecificProfile = Boolean(date &&
        Object.prototype.hasOwnProperty.call(effectiveProfilesByDate || {}, date));
    const workTerms = hasDateSpecificProfile ? effectiveProfilesByDate[date] : effectiveProfile;
    return Object.freeze({ ...resolveNoWorkDaySemanticFromWorkTerms(workTerms),
        workTerms: workTerms && typeof workTerms === 'object' ? workTerms : {},
        source: hasDateSpecificProfile ? 'DATE_EFFECTIVE' : 'BASE_FALLBACK' });
}

function resolveEmploymentRegimeFromWorkTerms(workTerms = {}) {
    const fullTime = resolveFullTimeFromWorkTerms(workTerms);
    return fullTime === true ? EMPLOYMENT_REGIME.FULL_TIME
        : fullTime === false ? EMPLOYMENT_REGIME.NON_FULL
            : EMPLOYMENT_REGIME.UNKNOWN;
}

function resolveEmploymentRegimeForDate({ date, effectiveProfilesByDate = {},
    effectiveProfile = {} } = {}) {
    const hasDateSpecificProfile = Boolean(date &&
        Object.prototype.hasOwnProperty.call(effectiveProfilesByDate || {}, date));
    const workTerms = hasDateSpecificProfile
        ? effectiveProfilesByDate[date] : effectiveProfile;
    return Object.freeze({
        regime: resolveEmploymentRegimeFromWorkTerms(workTerms),
        workTerms: workTerms && typeof workTerms === 'object' ? workTerms : {},
        source: hasDateSpecificProfile ? 'DATE_EFFECTIVE' : 'BASE_FALLBACK'
    });
}

function resolveReviewIsFullTimeProfile(workTerms = {}, phaseCode = '') {
    return resolveFullTimeFromWorkTerms(workTerms);
}

module.exports = {
    EMPLOYMENT_REGIME,
    NO_WORK_EMPLOYMENT_TYPE,
    NO_WORK_CLASSIFICATION,
    normalizeEmploymentType,
    normalizeWeeklySystemDays,
    resolveNoWorkDaySemanticFromWorkTerms,
    resolveNoWorkDaySemanticForDate,
    resolveFullTimeFromWorkTerms,
    resolveEmploymentRegimeFromWorkTerms,
    resolveEmploymentRegimeForDate,
    resolveReviewIsFullTimeProfile
};
