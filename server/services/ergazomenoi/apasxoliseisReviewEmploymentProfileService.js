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
    normalizeEmploymentType,
    resolveFullTimeFromWorkTerms,
    resolveEmploymentRegimeFromWorkTerms,
    resolveEmploymentRegimeForDate,
    resolveReviewIsFullTimeProfile
};
