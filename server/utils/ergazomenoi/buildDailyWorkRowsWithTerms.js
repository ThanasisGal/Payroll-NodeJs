// ============================================================================
// buildDailyWorkRowsWithTerms.js
// ============================================================================
// Ενώνει τις πραγματικές ημερήσιες ώρες εργασίας με το σωστό ιστορικό καθεστώς
// εργασίας που ίσχυε εκείνη την ημερομηνία.
// ============================================================================

const {
    buildDailyOrarioTermsForPeriod,
    formatDateYMD
} = require('./buildDailyOrarioTermsForPeriod');

function toNumberOrZero(value) {
    if (value === null || value === undefined || value === '') return 0;

    const n = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
}

function normalizeWorkHoursRow(row = {}) {
    const hmeromhnia = formatDateYMD(row.hmeromhnia || row.date || row.imerominia || row.day);

    return {
        ...row,
        hmeromhnia,

        // Προσαρμόζεις εδώ τα field names ανάλογα με το πώς λέγονται
        // οι πραγματικές ώρες στο δικό σου σύστημα.
        pragmatikes_ores:
            toNumberOrZero(row.pragmatikes_ores) ||
            toNumberOrZero(row.ores_ergasias) ||
            toNumberOrZero(row.synolo_oron) ||
            toNumberOrZero(row.hours),

        // Προαιρετικά χρήσιμα πεδία για debugging/reports.
        apo_ora: row.apo_ora || row.apo || '',
        eos_ora: row.eos_ora || row.eos || '',
        einai_anapaush: row.einai_anapaush || false,
        einai_argia: row.einai_argia || false,
        einai_adeia: row.einai_adeia || false,
        sxolio: row.sxolio || ''
    };
}

function buildWorkHoursMap(workHoursRows = []) {
    const map = new Map();

    for (const rawRow of workHoursRows || []) {
        const row = normalizeWorkHoursRow(rawRow);

        if (!row.hmeromhnia) continue;

        const existing = map.get(row.hmeromhnia);

        if (!existing) {
            map.set(row.hmeromhnia, row);
            continue;
        }

        // Αν υπάρχουν περισσότερες από μία εγγραφές ίδιας ημερομηνίας,
        // αθροίζουμε τις ώρες.
        existing.pragmatikes_ores += row.pragmatikes_ores;

        // Κρατάμε ενδεικτικά και τις αρχικές γραμμές για debugging.
        existing._mergedRows = existing._mergedRows || [existing];
        existing._mergedRows.push(row);

        map.set(row.hmeromhnia, existing);
    }

    return map;
}

function buildDailyWorkRowsWithTerms({
    periodApo,
    periodEos,
    istorikoRows = [],
    ergazomenos = {},
    workHoursRows = []
}) {
    const dailyTerms = buildDailyOrarioTermsForPeriod({
        periodApo,
        periodEos,
        istorikoRows,
        ergazomenos
    });

    const workHoursMap = buildWorkHoursMap(workHoursRows);

    return dailyTerms.map((dayTerms) => {
        const workRow = workHoursMap.get(dayTerms.hmeromhnia);
        const pragmatikesOres = workRow ? toNumberOrZero(workRow.pragmatikes_ores) : 0;

        return {
            ...dayTerms,

            pragmatikes_ores: pragmatikesOres,

            apo_ora: workRow?.apo_ora || '',
            eos_ora: workRow?.eos_ora || '',

            einai_anapaush: workRow?.einai_anapaush || false,
            einai_argia: workRow?.einai_argia || false,
            einai_adeia: workRow?.einai_adeia || false,

            sxolio: workRow?.sxolio || '',

            hasWorkRow: Boolean(workRow),
            _workRow: workRow || null
        };
    });
}

module.exports = {
    buildDailyWorkRowsWithTerms,
    normalizeWorkHoursRow,
    buildWorkHoursMap,
    toNumberOrZero
};
