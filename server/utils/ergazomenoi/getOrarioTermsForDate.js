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

    return {
        source: 'ERG_AKTUAL',
        istorikoId: null,

        hmeres_ergasias_ebdomadas: hmeres,
        ores_ergasias_ebdomadas: ores,
        mo_oron_hmerhsias_ergasias: mo,

        typos_apasxolhshs: ergazomenos.typos_apasxolhshs || '',
        typos_ebdomadas: ergazomenos.typos_ebdomadas || '',

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

    return {
        source: 'ISTORIKO',
        istorikoId: record._id || null,

        hmeres_ergasias_ebdomadas: hmeres,
        ores_ergasias_ebdomadas: ores,
        mo_oron_hmerhsias_ergasias: mo,

        typos_apasxolhshs: record.typos_apasxolhshs || '',
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
    normalizeDateOnly,
    getEffectiveTermsApo,
    getEffectiveTermsEos
};
