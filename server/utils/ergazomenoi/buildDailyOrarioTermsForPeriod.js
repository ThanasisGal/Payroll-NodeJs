// ============================================================================
// buildDailyOrarioTermsForPeriod.js
// ============================================================================
// Δημιουργεί μία γραμμή ανά ημερομηνία της περιόδου υπολογισμού,
// με τους όρους εργασίας που ίσχυαν εκείνη την ημέρα.
// ============================================================================

const { getOrarioTermsForDate, normalizeDateOnly } = require('./getOrarioTermsForDate');

function formatDateYMD(date) {
    const d = normalizeDateOnly(date);
    if (!d) return '';

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
}

function addDays(date, days) {
    const d = normalizeDateOnly(date);
    if (!d) return null;

    d.setDate(d.getDate() + days);
    return d;
}

function buildDailyOrarioTermsForPeriod({
    periodApo,
    periodEos,
    istorikoRows = [],
    ergazomenos = {}
}) {
    const apo = normalizeDateOnly(periodApo);
    const eos = normalizeDateOnly(periodEos);

    if (!apo || !eos || apo > eos) {
        return [];
    }

    const result = [];

    for (let current = apo; current <= eos; current = addDays(current, 1)) {
        const terms = getOrarioTermsForDate(current, istorikoRows, ergazomenos);

        result.push({
            hmeromhnia: formatDateYMD(current),
            date: new Date(current),

            source: terms.source,
            istorikoId: terms.istorikoId,

            hmeres_ergasias_ebdomadas: terms.hmeres_ergasias_ebdomadas,
            ores_ergasias_ebdomadas: terms.ores_ergasias_ebdomadas,
            mo_oron_hmerhsias_ergasias: terms.mo_oron_hmerhsias_ergasias,

            typos_apasxolhshs: terms.typos_apasxolhshs,
            typos_ebdomadas: terms.typos_ebdomadas,

            // Νέα πεδία ισχύος όρων εργασίας.
            hmeromhnia_isxyos_oron_ergasias_apo: terms.hmeromhnia_isxyos_oron_ergasias_apo,
            hmeromhnia_isxyos_oron_ergasias_eos: terms.hmeromhnia_isxyos_oron_ergasias_eos,

            // Παλιά πεδία ωραρίου, μόνο για backward compatibility/debugging.
            hmeromhnia_allaghs_orarioy_apo: terms.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_allaghs_orarioy_eos: terms.hmeromhnia_allaghs_orarioy_eos
        });
    }

    return result;
}

module.exports = {
    buildDailyOrarioTermsForPeriod,
    formatDateYMD,
    addDays
};
