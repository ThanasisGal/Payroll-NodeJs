'use strict';

const { DAILY_NUMBER_FIELDS } = require('../../server/services/ergazomenoi/apasxoliseisEmploymentReviewReportService');

function reviewTotalsRow(overrides = {}) {
    return {
        ...Object.fromEntries(DAILY_NUMBER_FIELDS.map(([field]) => [field, 0])),
        _id: 'synthetic-row', kodikos: '0001', employeeName: 'ΣΥΝΘΕΤΙΚΟΣ ΕΡΓΑΖΟΜΕΝΟΣ',
        eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ', ypokatasthma: '0000',
        hmeromhnia: '2026-09-28', kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01: '08:00', eos_ora_01: '16:00', cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
        ores_ergasias: 8, cards_ores_ergasias: 8,
        ores_ergasias_apologistika: 8, ores_pragmatikhs_ergasias_apologistika: 8,
        effective_weekly_workdays: 5, effective_weekly_hours: 40,
        effective_typos_apasxolhshs: '0', effective_profile_source: 'ISTORIKO',
        repo: false, repo_apologistika: false, is_locked: false,
        ...overrides
    };
}

function legacyReviewTotalsRow(overrides = {}) {
    return reviewTotalsRow({ kodikos: '0002', history_terms_unavailable: true,
        effective_profile_source: 'LEGACY_FALLBACK_ASSUMED',
        compensation_breakdown_apologistika: {
            status: 'LEGACY_FALLBACK_ASSUMED', history_terms_unavailable: true,
            all_results_documented: false, calculation_executed: true,
            assumed_work_terms: { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 },
            rates: { paidHourlyRate: null, legalHourlyRate: null },
            amounts: { baseActualWorkAmount: null, premiumTotalAmount: null, grossWorkAmount: null },
            total_amount: null
        }, ...overrides });
}

function reviewTotalsFixture() {
    return { metadata: { team: 'SYNTHETIC', companyName: 'ΣΥΝΘΕΤΙΚΗ ΕΤΑΙΡΕΙΑ', branch: '0000',
        periodStart: '2026-09-01', periodEnd: '2026-09-30' }, rows: [
        reviewTotalsRow(),
        legacyReviewTotalsRow(),
        legacyReviewTotalsRow({ _id: 'synthetic-second-day', hmeromhnia: '2026-09-29',
            cards_eos_ora_01: '15:30', cards_ores_ergasias: 7.5,
            ores_ergasias_apologistika: 7.5, ores_pragmatikhs_ergasias_apologistika: 7.5,
            ores_apoysias_apologistika: 0.5 })
    ] };
}

module.exports = { reviewTotalsRow, legacyReviewTotalsRow, reviewTotalsFixture };
