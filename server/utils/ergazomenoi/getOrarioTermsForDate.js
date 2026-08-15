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

    d.setUTCHours(0, 0, 0, 0);
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

function buildCanonicalWorkTermsSnapshotFields(formData = {}, fallbackErgazomenos = {}) {
    const canonicalEmploymentType = resolveEmploymentTypeFromFormData(formData);
    const formWorkdays = resolveEffectiveWeeklyWorkdays(formData);
    const fallbackWorkdays = resolveEffectiveWeeklyWorkdays(fallbackErgazomenos);
    const effectiveWorkdays = formWorkdays ?? fallbackWorkdays;
    const sixthDayPremiumRate =
        Object.prototype.hasOwnProperty.call(formData, 'pososto_prosayxhshs_6hs_hmeras') &&
        String(formData.pososto_prosayxhshs_6hs_hmeras ?? '').trim() !== ''
            ? toNumberOrNull(formData.pososto_prosayxhshs_6hs_hmeras)
            : toNumberOrNull(fallbackErgazomenos.pososto_prosayxhshs_6hs_hmeras);

    return {
        kathestos_apasxolhshs: canonicalEmploymentType,
        typos_apasxolhshs: canonicalEmploymentType,
        typos_ebdomadas:
            formData.typos_ebdomadas ||
            getTyposEbdomadasFromHmeres(effectiveWorkdays),
        pososto_prosayxhshs_6hs_hmeras: sixthDayPremiumRate
    };
}

function getEffectiveTermsApo(record = {}) {
    if (Object.prototype.hasOwnProperty.call(
        record,
        'hmeromhnia_isxyos_oron_ergasias_apo'
    )) {
        return normalizeDateOnly(record.hmeromhnia_isxyos_oron_ergasias_apo);
    }

    return normalizeDateOnly(record.hmeromhnia_allaghs_orarioy_apo);
}

function getEffectiveTermsEos(record = {}) {
    if (Object.prototype.hasOwnProperty.call(
        record,
        'hmeromhnia_isxyos_oron_ergasias_eos'
    )) {
        // Explicit null is authoritative: the terms period remains open-ended.
        return normalizeDateOnly(record.hmeromhnia_isxyos_oron_ergasias_eos);
    }

    // Backward compatibility only for legacy documents where the terms-end
    // field is genuinely absent, not explicitly null.
    return normalizeDateOnly(record.hmeromhnia_allaghs_orarioy_eos);
}

const AUTHORITATIVE_WORK_TERMS_MUTATION_CODES = Object.freeze(['007', '008', '014', '015']);

function normalizeMutationCodes(value) {
    let values = value;
    if (typeof values === 'string') {
        const trimmed = values.trim();
        if (!trimmed) return [];
        try {
            values = JSON.parse(trimmed);
        } catch {
            values = trimmed.split(',');
        }
    }
    if (!Array.isArray(values)) values = [values];

    return [...new Set(values.map((item) => {
        const raw = item && typeof item === 'object'
            ? item.kodikos ?? item.code ?? item.value
            : item;
        const digits = String(raw ?? '').trim();
        return /^\d{1,3}$/.test(digits) ? digits.padStart(3, '0') : '';
    }).filter(Boolean))];
}

function isExplicitWorkTermsChange(formData = {}, { initialEmployment = false } = {}) {
    if (initialEmployment) return true;
    const mutationCodes = normalizeMutationCodes(formData.typos_metabolhs);
    return mutationCodes.some((code) => AUTHORITATIVE_WORK_TERMS_MUTATION_CODES.includes(code));
}

function resolveWorkTermsPeriodIntent(formData = {}, options = {}) {
    const isTermsChange = isExplicitWorkTermsChange(formData, options);
    const effectiveFrom = !isTermsChange
        ? null
        : options.initialEmployment
            ? normalizeDateOnly(
                formData.hmeromhnia_isxyos_oron_ergasias_apo ||
                formData.hmeromhnia_proslhpshs
            )
            : normalizeDateOnly(formData.hmeromhnia_metabolhs);
    return {
        isTermsChange,
        effectiveFrom,
        // Μία authoritative κατάσταση ισχύει μέχρι την επόμενη πραγματική μεταβολή.
        effectiveTo: null,
        valid: !isTermsChange || Boolean(effectiveFrom)
    };
}

function getPreviousUtcDate(value) {
    const date = normalizeDateOnly(value);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() - 1);
    return date;
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
        pososto_prosayxhshs_6hs_hmeras: ergazomenos.pososto_prosayxhshs_6hs_hmeras,
        nomimoOromisthio: toNumberOrZero(ergazomenos.nomimoOromisthio),
        pragmatikoOromisthio: toNumberOrZero(ergazomenos.pragmatikoOromisthio),
        eidikh_kathgoria_ergazomenoy: ergazomenos.eidikh_kathgoria_ergazomenoy || '',
        eidikh_periptosh: ergazomenos.eidikh_periptosh || '',

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

function buildTermsFromHistoryRecord(record, fallbackErgazomenos = {}) {
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
        pososto_prosayxhshs_6hs_hmeras:
            toNumberOrNull(record.pososto_prosayxhshs_6hs_hmeras) ??
            toNumberOrNull(fallbackErgazomenos.pososto_prosayxhshs_6hs_hmeras),
        nomimoOromisthio:
            toNumberOrNull(record.nomimoOromisthio) ??
            toNumberOrZero(fallbackErgazomenos.nomimoOromisthio),
        pragmatikoOromisthio:
            toNumberOrNull(record.pragmatikoOromisthio) ??
            toNumberOrZero(fallbackErgazomenos.pragmatikoOromisthio),
        eidikh_kathgoria_ergazomenoy:
            record.eidikh_kathgoria_ergazomenoy ||
            fallbackErgazomenos.eidikh_kathgoria_ergazomenoy ||
            '',
        eidikh_periptosh:
            record.eidikh_periptosh || fallbackErgazomenos.eidikh_periptosh || '',

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
        // Το explicit false είναι authoritative: πρόκειται για schedule-only history row.
        // Legacy rows χωρίς flag κρατούν το παλιό date-based fallback.
        const hasExplicitFlag = Object.prototype.hasOwnProperty.call(
            row,
            'afora_allagh_oron_ergasias'
        );
        const isTermsChange = hasExplicitFlag
            ? row.afora_allagh_oron_ergasias === true
            : hasNewTermsDates || hasLegacyDates;

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
        const effectiveDifference = (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        if (effectiveDifference) return effectiveDifference;

        // Secondary safety only. Equal valid effective starts must not depend on
        // engine sort stability; this does not repair invalid overlapping ranges.
        for (const field of ['updatedAt', 'createdAt']) {
            const parsedA = a[field] ? new Date(a[field]) : null;
            const parsedB = b[field] ? new Date(b[field]) : null;
            const timeA = parsedA && !Number.isNaN(parsedA.getTime()) ? parsedA.getTime() : 0;
            const timeB = parsedB && !Number.isNaN(parsedB.getTime()) ? parsedB.getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
        }
        const aaDifference = Number.parseInt(b.aa_eggrafhs, 10) -
            Number.parseInt(a.aa_eggrafhs, 10);
        if (Number.isFinite(aaDifference) && aaDifference) return aaDifference;
        return String(b._id || '').localeCompare(String(a._id || ''));
    });

    return buildTermsFromHistoryRecord(matchingRows[0], ergazomenos);
}

module.exports = {
    getOrarioTermsForDate,
    resolveEmploymentTypeValue,
    resolveEmploymentTypeFromFormData,
    normalizeWeeklyWorkdaysValue,
    resolveEffectiveWeeklyWorkdays,
    buildCanonicalWorkTermsSnapshotFields,
    normalizeDateOnly,
    getEffectiveTermsApo,
    getEffectiveTermsEos,
    isExplicitWorkTermsChange,
    resolveWorkTermsPeriodIntent,
    normalizeMutationCodes,
    AUTHORITATIVE_WORK_TERMS_MUTATION_CODES,
    getPreviousUtcDate
};
