'use strict';

// Entirely synthetic: no database, exported employee, credential or real amount.
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const F = require('../../server/services/ergazomenoi/fixtures/unifiedEmployeeHistorySettlementFixtures');
const catalogs = {
    KPK_EFKA: [{ code: '0101', label: 'Συνθετικό πακέτο ασφάλισης' }],
    CONTRACT_TYPE: [{ code: '01', label: 'Συνθετική σύμβαση ιδιωτικού δικαίου' }],
    CONTRACT_CATEGORY: [{ code: '01', label: 'Συνθετική κατηγορία υπαλλήλων', afora_thn_symbash: '01' }],
    CONTRACT_SPECIALTY: [{ code: '01', label: 'Συνθετική ειδικότητα γραφείου', afora_thn_symbash_kathgoria: '0101' }],
    CONTRACT_ITEM: [{ code: 'BASIC', label: 'Συνθετικός βασικός μισθός', afora_thn_symbash_kathgoria_eidikothta: '010101' }]
};
function employee0002HistoryProposalFixture({ datedInitialProfile = true, reviewRequired = true } = {}) {
    const facts = Object.fromEntries(Object.entries(C.PROFILE_FIELD_TYPES).map(([field, type]) =>
        [field, type === 'Number' ? 0 : type === 'Boolean' ? false : type === 'Array' ? [] : null]));
    Object.assign(facts, { symbash: '01', kathgoria_symbashs: '01', eidikothta_symbashs: '01',
        kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        symbatikes_ores_ergasias: 40, misthologiko_klimakio: 2, krathsh_01: '0101',
        nomimosMisthos: 1000, pragmatikosMisthos: 1100, synolo_symbashs: 1100,
        dialleima_se_lepta: 30, afora_allagh_dialleimatos: true,
        stoixeio_symbashs_01: 'BASIC', poso_symbashs_01: 1000, poso_symbashs_basei_oron_ergasias_01: 1000 });
    const rows = [
        F.period(1, { ...facts, hire: '2026-02-02', from: datedInitialProfile ? '2026-02-02' : null,
            hmeromhnia_allaghs_symbashs: '2026-02-02', afora_proslhpsh: true,
            afora_allagh_oron_ergasias: datedInitialProfile,
            hmeromhnia_allaghs_orarioy_apo: '2026-02-02', hmeromhnia_allaghs_orarioy_eos: '2026-02-08',
            hmeromhnia_isxyos_dialleimatos_apo: '2026-02-02' }),
        F.period(2, { ...facts, hire: '2026-02-02', from: '2026-04-01', to: '2026-06-02',
            hmeromhnia_allaghs_symbashs: '2026-04-01', hmeromhnia_isxyos_dialleimatos_apo: '2026-04-01',
            pragmatikosMisthos: 1300, nomimoOromisthio: 7.35 }),
        F.period(3, { ...facts, hire: '2026-02-02', from: '2026-06-03',
            hmeromhnia_allaghs_symbashs: '2026-06-03', hmeromhnia_isxyos_dialleimatos_apo: '2026-06-03',
            pragmatikosMisthos: 1400, nomimoOromisthio: 8 })
    ];
    if (datedInitialProfile) delete rows[0][C.END];
    delete rows[0].eidikothta_symbashs;
    delete rows[0].nomimoOromisthio;
    for (const row of rows) delete row.krathsh_02;
    const input = F.input(rows);
    Object.assign(input.scope, { team: 'THA', kodikos: '0002' });
    for (const row of [input.currentEmployee, ...input.completeHistoryRows]) Object.assign(row, input.scope);
    // Explicit synthetic provenance exercises the real REVIEW_REQUIRED/no-
    // questions branch, without a stub planner. Tracking begins before the gap.
    if (reviewRequired) input.currentEmployee.employment_import_provenance = {
        version: 1, source: 'PREVIOUS_PAYROLL_APPLICATION', status: 'VERIFIED',
        hireDate: '2026-02-02', trackingStartDate: '2026-02-03', verifiedBy: 'SYNTHETIC-ADMIN',
        verifiedAt: '2026-02-03T12:00:00.000Z', auditId: '650000000000000000000099'
    };
    return input;
}
module.exports = { employee0002HistoryProposalFixture, catalogs };
