'use strict';

// Presentation evidence only. Never copy a row/profile/request into diagnostics.
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

function dates(values = []) {
    return [...new Set(values.map(dateKeyUtc).filter(Boolean))].sort();
}

function number(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dailyEvidence(row = {}, facts = {}) {
    const category = value => ['ΕΡΓ', 'ΑΝ', 'ΜΕ', 'ΑΔΕΙΑ', 'ΑΣΘΕΝΕΙΑ', 'ΑΠΟΥΣΙΑ', 'ΑΡΓΙΑ']
        .includes(value) ? value : null;
    const time = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
        ? value : null;
    return {
        declared_hours: number(row.ores_ergasias) ?? number(facts.declaredWorkHours),
        card_hours: number(row.cards_ores_ergasias) ?? number(facts.cardHours),
        actual_hours: number(facts.actualWorkHours),
        declared_category: category(row.kathgoria_ergasias),
        actual_category: category(row.kathgoria_ergasias_apologistika),
        declared_repo: typeof row.repo === 'boolean' ? row.repo : null,
        actual_repo: typeof row.repo_apologistika === 'boolean' ? row.repo_apologistika : null,
        unresolved_pairs: (facts.unresolvedCardPairNumbers || []).filter(value => [1, 2, 3].includes(value)),
        card_intervals: [1, 2, 3].map(index => ({
            start: time(row[`cards_apo_ora_0${index}`]),
            end: time(row[`cards_eos_ora_0${index}`])
        })).filter(interval => interval.start || interval.end)
    };
}

function diagnostic(code, affectedDates = [], evidence = {}) {
    return { code, dates: dates(affectedDates), evidence };
}

function analysisDiagnostics(codes = [], analysis = {}) {
    return codes.map(code => {
        const affectedDates = (analysis.dailyFacts || [])
            .filter(day => (day.reasons || []).includes(code) ||
                (code === 'CARD_VERIFICATION_PENDING' && (day.unresolvedCardPairNumbers || []).length))
            .map(day => day.hmeromhnia);
        if (['MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE', 'ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION'].includes(code))
            affectedDates.push(analysis.sixthDayIdentity);
        if (code === 'WORKED_DECLARED_REPO_DAYS_REQUIRE_HR_CLASSIFICATION')
            affectedDates.push(...(analysis.canonicalRepoDayIdentities || []));
        return diagnostic(code, affectedDates);
    });
}

module.exports = { dates, dailyEvidence, diagnostic, analysisDiagnostics };
