// ============================================================================
// getOrarioTermsForDate.js
// ============================================================================
// Helper για εύρεση των όρων εργασίας που ίσχυαν σε συγκεκριμένη ημερομηνία.
//
// ΣΗΜΑΝΤΙΚΟ:
// - Τα hmeromhnia_allaghs_orarioy_apo/eos παραμένουν για τον ορισμό/παραγωγή
//   προδηλωμένων ωραρίων.
// - Τα hmeromhnia_isxyos_oron_ergasias_apo/eos είναι τα νέα πεδία που
//   χρησιμοποιούνται για την ιστορική ισχύ των όρων εργασίας
//   (5ήμερο/6ήμερο, 40h/30h κλπ).
// - Για παλιές εγγραφές που δεν έχουν ακόμα τα νέα πεδία, γίνεται fallback στα
//   hmeromhnia_allaghs_orarioy_apo/eos ώστε να μην σπάσουν παλιά δεδομένα.
// ============================================================================

function normalizeDateOnly(value) {
    if (!value) return null;

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
        return null;
    }

    d.setHours(0, 0, 0, 0);
    return d;
}

function toNumberOrZero(value) {
    if (value === null || value === undefined || value === '') return 0;

    const n = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
}

function normalizeEmploymentTypeValue(value) {
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

function resolveEmploymentTypeValue(record = {}) {
    const canonicalRaw = String(record.kathestos_apasxolhshs ?? '').trim();

    if (canonicalRaw !== '') {
        return normalizeEmploymentTypeValue(canonicalRaw);
    }

    return normalizeEmploymentTypeValue(record.typos_apasxolhshs);
}

function resolveEmploymentTypeFromFormData(formData = {}) {
    const canonicalCandidates = [
        formData.kathestos_apasxolhshs_stathera,
        formData.kathestos_apasxolhshs
    ];

    for (const candidate of canonicalCandidates) {
        if (String(candidate ?? '').trim() !== '') {
            return normalizeEmploymentTypeValue(candidate);
        }
    }

    return normalizeEmploymentTypeValue(formData.typos_apasxolhshs);
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;

    const n = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
}

function getTyposEbdomadasFromHmeres(hmeres) {
    const normalizedDays = toNumberOrNull(hmeres);
    if (normalizedDays === 5) return '5HMERH';
    if (normalizedDays === 6) return '6HMERH';
    return '';
}

function normalizeWeeklyWorkdaysValue(value) {
    if (value === 5 || value === 6) return value;
    if (typeof value !== 'string') return null;

    const raw = value.trim().toUpperCase();
    if (['5', '5HMERH', '5ΗΜΕΡΗ', '5ΗΜΕΡΟ'].includes(raw)) return 5;
    if (['6', '6HMERH', '6ΗΜΕΡΗ', '6ΗΜΕΡΟ'].includes(raw)) return 6;
    return null;
}

function resolveEffectiveWeeklyWorkdays(record = {}) {
    const candidates = [
        record.hmeres_ergasias_ebdomadas,
        record.typos_ebdomadas,
        record.apasxolhsh_basei_symbashs,
        record.apasxolhsh_basei_symbashs_stathera
    ];

    for (const candidate of candidates) {
        const normalized = normalizeWeeklyWorkdaysValue(candidate);
        if (normalized !== null) return normalized;
    }

    return null;
}

function normalizeExplicitWeeklyRepoValue(value) {
    const normalized = toNumberOrNull(value);
    return normalized === 1 || normalized === 2 ? normalized : null;
}

function repoFromWeeklyWorkdays(workdays) {
    if (workdays === 5) return 2;
    if (workdays === 6) return 1;
    return 0;
}

function resolveExpectedWeeklyRepo(record = {}) {
    const explicitRepo = normalizeExplicitWeeklyRepoValue(record.mhniaia_repo);
    if (explicitRepo !== null) return explicitRepo;

    return repoFromWeeklyWorkdays(resolveEffectiveWeeklyWorkdays(record));
}

function buildCanonicalWorkTermsSnapshotFields(formData = {}, fallbackErgazomenos = {}) {
    const canonicalEmploymentType = resolveEmploymentTypeFromFormData(formData);
    const explicitFormRepo = normalizeExplicitWeeklyRepoValue(formData.mhniaia_repo);
    const explicitFallbackRepo = normalizeExplicitWeeklyRepoValue(
        fallbackErgazomenos.mhniaia_repo
    );
    const formWorkdays = resolveEffectiveWeeklyWorkdays(formData);
    const fallbackWorkdays = resolveEffectiveWeeklyWorkdays(fallbackErgazomenos);
    const effectiveWorkdays = formWorkdays ?? fallbackWorkdays;
    const mhniaiaRepo =
        explicitFormRepo ?? explicitFallbackRepo ?? repoFromWeeklyWorkdays(effectiveWorkdays);

    return {
        kathestos_apasxolhshs: canonicalEmploymentType,
        typos_apasxolhshs: canonicalEmploymentType,
        typos_ebdomadas:
            formData.typos_ebdomadas ||
            getTyposEbdomadasFromHmeres(effectiveWorkdays),
        mhniaia_repo: mhniaiaRepo
    };
}

function getEffectiveTermsApo(record = {}) {
    return (
        normalizeDateOnly(record.hmeromhnia_isxyos_oron_ergasias_apo) ||
        normalizeDateOnly(record.hmeromhnia_allaghs_orarioy_apo)
    );
}

function getEffectiveTermsEos(record = {}) {
    return (
        normalizeDateOnly(record.hmeromhnia_isxyos_oron_ergasias_eos) ||
        normalizeDateOnly(record.hmeromhnia_allaghs_orarioy_eos)
    );
}

function buildFallbackTerms(ergazomenos = {}) {
    const hmeres = toNumberOrZero(ergazomenos.hmeres_ergasias_ebdomadas);
    const ores = toNumberOrZero(ergazomenos.ores_ergasias_ebdomadas);
    const mo =
        toNumberOrZero(ergazomenos.mo_oron_hmerhsias_ergasias) ||
        (hmeres > 0 ? +(ores / hmeres).toFixed(4) : 0);
    const employmentType = resolveEmploymentTypeValue(ergazomenos);

    return {
        source: 'ERG_AKTUAL',
        istorikoId: null,

        kathestos_apasxolhshs: employmentType,
        typos_apasxolhshs: employmentType,
        mhniaia_repo: resolveExpectedWeeklyRepo(ergazomenos),

        hmeres_ergasias_ebdomadas: hmeres,
        ores_ergasias_ebdomadas: ores,
        mo_oron_hmerhsias_ergasias: mo,

        typos_ebdomadas:
            ergazomenos.typos_ebdomadas ||
            getTyposEbdomadasFromHmeres(ergazomenos.apasxolhsh_basei_symbashs),

        hmeromhnia_isxyos_oron_ergasias_apo: null,
        hmeromhnia_isxyos_oron_ergasias_eos: null,

        hmeromhnia_allaghs_orarioy_apo: null,
        hmeromhnia_allaghs_orarioy_eos: null
    };
}

function buildTermsFromHistoryRecord(record) {
    const hmeres = toNumberOrZero(record.hmeres_ergasias_ebdomadas);
    const ores = toNumberOrZero(record.ores_ergasias_ebdomadas);
    const mo =
        toNumberOrZero(record.mo_oron_hmerhsias_ergasias) ||
        (hmeres > 0 ? +(ores / hmeres).toFixed(4) : 0);
    const employmentType = resolveEmploymentTypeValue(record);

    return {
        source: 'ISTORIKO',
        istorikoId: record._id || null,

        kathestos_apasxolhshs: employmentType,
        typos_apasxolhshs: employmentType,
        mhniaia_repo: resolveExpectedWeeklyRepo(record),

        hmeres_ergasias_ebdomadas: hmeres,
        ores_ergasias_ebdomadas: ores,
        mo_oron_hmerhsias_ergasias: mo,

        typos_ebdomadas: record.typos_ebdomadas || '',

        // Νέα πεδία ισχύος όρων εργασίας.
        hmeromhnia_isxyos_oron_ergasias_apo: record.hmeromhnia_isxyos_oron_ergasias_apo || null,
        hmeromhnia_isxyos_oron_ergasias_eos: record.hmeromhnia_isxyos_oron_ergasias_eos || null,

        // Παλιά πεδία ωραρίου. Τα κρατάμε για προβολή/debugging/backward compatibility.
        hmeromhnia_allaghs_orarioy_apo: record.hmeromhnia_allaghs_orarioy_apo || null,
        hmeromhnia_allaghs_orarioy_eos: record.hmeromhnia_allaghs_orarioy_eos || null
    };
}

function getOrarioTermsForDate(date, istorikoRows = [], ergazomenos = {}) {
    const targetDate = normalizeDateOnly(date);

    if (!targetDate) {
        return buildFallbackTerms(ergazomenos);
    }

    const validRows = Array.isArray(istorikoRows) ? istorikoRows : [];

    const matchingRows = validRows.filter((row) => {
        if (!row) return false;

        // Κοιτάμε μόνο εγγραφές που αφορούν αλλαγή όρων εργασίας.
        // Για παλιές εγγραφές χωρίς flag, επιτρέπουμε fallback αν έχουν ημερομηνίες.
        const hasNewTermsDates = Boolean(row.hmeromhnia_isxyos_oron_ergasias_apo);
        const hasLegacyDates = Boolean(row.hmeromhnia_allaghs_orarioy_apo);
        const isTermsChange =
            row.afora_allagh_oron_ergasias === true || hasNewTermsDates || hasLegacyDates;

        if (!isTermsChange) return false;

        const apo = getEffectiveTermsApo(row);
        const eos = getEffectiveTermsEos(row);

        if (!apo) return false;

        return targetDate >= apo && (!eos || targetDate <= eos);
    });

    if (matchingRows.length === 0) {
        return buildFallbackTerms(ergazomenos);
    }

    // Αν υπάρχουν overlapping εγγραφές, παίρνουμε την πιο πρόσφατη ημερομηνία
    // ισχύος όρων εργασίας. Αν δεν υπάρχει νέο πεδίο, fallback στην ημερομηνία ωραρίου.
    matchingRows.sort((a, b) => {
        const dateA = getEffectiveTermsApo(a);
        const dateB = getEffectiveTermsApo(b);

        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });

    return buildTermsFromHistoryRecord(matchingRows[0]);
}

module.exports = {
    getOrarioTermsForDate,
    resolveEmploymentTypeValue,
    resolveEmploymentTypeFromFormData,
    normalizeWeeklyWorkdaysValue,
    resolveEffectiveWeeklyWorkdays,
    resolveExpectedWeeklyRepo,
    buildCanonicalWorkTermsSnapshotFields,
    normalizeDateOnly,
    getEffectiveTermsApo,
    getEffectiveTermsEos
};
