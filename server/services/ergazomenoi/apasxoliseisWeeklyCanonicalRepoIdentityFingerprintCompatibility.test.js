'use strict';

const assert = require('node:assert/strict');
const {
    APPLICABILITY,
    fingerprint,
    buildCanonicalWeeklyDecisionSnapshot,
    resolvePreloadedWeeklyCanonicalDecision
} = require('./apasxoliseisWeeklyCanonicalDecisionService');

const rows = Array.from({ length: 7 }, (_, index) => ({
    _id: `row-${index}`,
    hmeromhnia: `2026-06-${String(29 + index).padStart(2, '0')}`,
    kathgoria_ergasias: index === 1 || index === 3 ? 'ΑΝ' : 'ΕΡΓ',
    kathgoria_ergasias_apologistika: index === 0 ? '' : 'ΕΡΓ',
    repo: index === 1 || index === 3,
    repo_apologistika: false,
    ores_ergasias: index === 1 || index === 3 ? 0 : 8,
    ores_ergasias_apologistika: index === 0 ? 0 : 8,
    cards_ores_ergasias: index === 0 ? 0 : 8,
    cards_apo_ora_01: index === 0 ? '' : '14:00',
    cards_eos_ora_01: index === 0 ? '' : '22:00'
}));
rows.forEach((row, index) => {
    const date = new Date('2026-06-29T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    row.hmeromhnia = date;
});

function input(profile, history) {
    const actualWorkFacts = Object.fromEntries(rows.map((row) => {
        const date = row.hmeromhnia.toISOString().slice(0, 10);
        const worked = Number(row.cards_ores_ergasias || 0) > 0;
        return [date, {
            category: row.kathgoria_ergasias_apologistika || row.kathgoria_ergasias,
            actualWorkHours: Number(row.cards_ores_ergasias || 0),
            countsAsActualWorkDay: worked,
            cardVerificationStatus: 'READY',
            reasons: []
        }];
    }));
    return {
        team: 'THA', company_kod: 'company', ypokatasthma: '0000',
        employee_kodikos: '0014', employee_id: 'employee-0014',
        week_start: '2026-06-29', week_end: '2026-07-05',
        weekly_rows: rows,
        current_repo_identities: ['2026-06-29', '2026-06-30', '2026-07-02'],
        actual_work_facts: actualWorkFacts, effective_profile: profile, profile_history: [history],
        canonical_status: 'NEEDS_HR_DECISION',
        canonical_reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'],
        policy_version: 'sepe-weekly-sixth-seventh-day:v3',
        source_version: 'weekly-post-check-canonical-decision-input:v1',
        applied_atomic_repo_transfer: null
    };
}

const storedInput = input({ kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, pososto_prosayxhshs_6hs_hmeras: null },
{ _id: 'history-0005', kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40 });
const stored = buildCanonicalWeeklyDecisionSnapshot(storedInput);
const record = {
    ...stored.scope,
    decision_status: 'RECORDED',
    decision_type: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    decision_payload: { current_repo_identities: ['2026-06-30', '2026-07-02'] },
    decision_payload_fingerprint: fingerprint({
        current_repo_identities: ['2026-06-30', '2026-07-02']
    }),
    snapshot_fingerprint: stored.fingerprint,
    canonical_snapshot: stored.snapshot,
    created_at: new Date('2026-08-14T12:08:28.775Z')
};

const currentInput = input({ kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, pososto_prosayxhshs_6hs_hmeras: 0,
    eidikh_kathgoria_ergazomenoy: '0009', pragmatikoOromisthio: 12.5,
    effective_break_configuration: { source: 'BREAK_CONFIGURATION_HISTORY' },
    effective_break_minutes: 20, effective_break_inside_schedule: true,
    dialleima_se_lepta: 20, dialleima_entos_ektos_orarioy: true },
{ _id: 'history-0005', kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, afora_allagh_dialleimatos: true,
    hmeromhnia_isxyos_dialleimatos_apo: '2026-07-01', dialleima_se_lepta: 20,
    dialleima_entos_ektos_orarioy: true, updatedAt: '2026-08-14T13:00:00.000Z' });

let resolved = resolvePreloadedWeeklyCanonicalDecision({
    currentInput, records: [record]
});
assert.equal(resolved.applicability, APPLICABILITY.APPLICABLE);

const specialCategoryOnly = input({ ...storedInput.effective_profile,
    eidikh_kathgoria_ergazomenoy: '0009' }, storedInput.profile_history[0]);
assert.equal(resolvePreloadedWeeklyCanonicalDecision({
    currentInput: specialCategoryOnly, records: [record]
}).applicability, APPLICABILITY.APPLICABLE);

const premiumOnly = input({ ...storedInput.effective_profile,
    pososto_prosayxhshs_6hs_hmeras: 0 }, storedInput.profile_history[0]);
assert.equal(resolvePreloadedWeeklyCanonicalDecision({
    currentInput: premiumOnly, records: [record]
}).applicability, APPLICABILITY.APPLICABLE);

const breakOnly = input({ ...storedInput.effective_profile,
    dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false,
    effective_break_configuration: { source: 'BREAK_CONFIGURATION_HISTORY' }
}, storedInput.profile_history[0]);
assert.equal(resolvePreloadedWeeklyCanonicalDecision({
    currentInput: breakOnly, records: [record]
}).applicability, APPLICABILITY.APPLICABLE);

const hourlyRateOnly = input({ ...storedInput.effective_profile,
    pragmatikoOromisthio: 15.25, nomimoOromisthio: 8.75
}, storedInput.profile_history[0]);
assert.equal(resolvePreloadedWeeklyCanonicalDecision({
    currentInput: hourlyRateOnly, records: [record]
}).applicability, APPLICABILITY.APPLICABLE);

const changedBusinessInput = input({ ...currentInput.effective_profile,
    hmeres_ergasias_ebdomadas: 6 }, currentInput.profile_history[0]);
resolved = resolvePreloadedWeeklyCanonicalDecision({
    currentInput: changedBusinessInput, records: [record]
});
assert.equal(resolved.applicability, APPLICABILITY.STALE);

const sicknessInput = input(storedInput.effective_profile, storedInput.profile_history[0]);
sicknessInput.weekly_rows = sicknessInput.weekly_rows.map((row) =>
    row.hmeromhnia.toISOString().slice(0, 10) === '2026-07-02'
        ? { ...row, kathgoria_ergasias_apologistika: 'ΑΣΘΕΝΕΙΑ' }
        : row);
sicknessInput.actual_work_facts['2026-07-02'] = {
    ...sicknessInput.actual_work_facts['2026-07-02'],
    category: 'ΑΣΘΕΝΕΙΑ', actualWorkHours: 0, countsAsActualWorkDay: false
};
sicknessInput.current_repo_identities = ['2026-06-29', '2026-06-30'];
assert.equal(resolvePreloadedWeeklyCanonicalDecision({
    currentInput: sicknessInput, records: [record]
}).applicability, APPLICABILITY.STALE);

const actualFactsChanged = input(storedInput.effective_profile, storedInput.profile_history[0]);
actualFactsChanged.actual_work_facts['2026-06-30'] = {
    ...actualFactsChanged.actual_work_facts['2026-06-30'],
    actualWorkHours: 0, countsAsActualWorkDay: false
};
actualFactsChanged.current_repo_identities = ['2026-06-29', '2026-07-02'];
assert.equal(resolvePreloadedWeeklyCanonicalDecision({
    currentInput: actualFactsChanged, records: [record]
}).applicability, APPLICABILITY.STALE);

const tampered = { ...record, canonical_snapshot: {
    ...record.canonical_snapshot, current_repo_identities: ['2026-06-29']
} };
resolved = resolvePreloadedWeeklyCanonicalDecision({
    currentInput, records: [tampered]
});
assert.equal(resolved.applicability, APPLICABILITY.STALE);

console.log('weekly canonical repo-identity fingerprint compatibility: PASS');
