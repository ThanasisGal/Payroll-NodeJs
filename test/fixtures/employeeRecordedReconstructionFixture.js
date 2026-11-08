'use strict';
// Positive transaction scenarios own their hire/amendment documents. Keep the
// raw sparse planner fixtures unchanged: they intentionally require review.
const raw = require('../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { clone } = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const START = 'hmeromhnia_isxyos_oron_ergasias_apo';
// Independent documents for positive 0006 writes. The raw coincident legacy
// artifacts remain unchanged for rejection/compatibility tests. Only missing
// validity boundaries are reconstructed from these documents' own dated events.
function recorded0006BoundaryStructure() {
    const data = raw.real0006BoundaryStructure();
    const { completeSyntheticEmploymentTerms } = require('./employeeCompleteProfileFixture');
    const { buildCompleteProfileSnapshot } = require('../../server/utils/ergazomenoi/employmentProfileHistory');
    const documents = [
        { from: '2026-04-23', pay: 1120, kpk: '0961', arrival: 0 },
        { from: '2026-05-01', pay: 1200, kpk: '0962', arrival: 30 },
        { from: '2026-05-25', pay: 1300, kpk: '0963', arrival: 120 }
    ];
    data.completeHistoryRows = data.completeHistoryRows.map((row, index) => {
        const document = documents[index];
        const terms = { ...completeSyntheticEmploymentTerms({
            krathsh_01: document.kpk, pragmatikosMisthos: document.pay,
            synolo_symbashs: document.pay, evelikth_proselefsh: document.arrival,
            dialleima_se_lepta: 30 }),
            hmeromhnia_proslhpshs: new Date('2026-04-23'),
            hmeromhnia_allaghs_symbashs: new Date(document.from),
            hmeromhnia_lhxhs_symbashs: new Date('2026-10-15'),
            hmeromhnia_apoxorhshs: null };
        return { ...row, ...buildCompleteProfileSnapshot({ current: terms, effectiveFrom: document.from }),
            afora_proslhpsh: index === 0, afora_allagh_oron_ergasias: true,
            [START]: null, hmeromhnia_isxyos_oron_ergasias_eos: null };
    });
    data.currentEmployee = { ...data.currentEmployee, ...data.completeHistoryRows[2],
        _id: data.currentEmployee._id,
        [START]: new Date(documents[2].from),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-10-15') };
    return data;
}
function recordedLegacyArtifacts() {
    const data = recorded0006BoundaryStructure();
    data.completeHistoryRows.forEach((row, index) => { row._id = `synthetic-000${index + 1}`; });
    data.currentEmployee._id = 'synthetic-current';
    return data;
}
// Positive composite departure control: the three independent documents
// explicitly date the initial terms and both amendments. Keep the ambiguous
// raw 0030 reproduction available to every negative/legacy compatibility test.
function recordedDepartureStructure() {
    const data = require('../../server/services/ergazomenoi/fixtures/tha0030SanitizedDepartureReconstructionFixture')
        .tha0030DepartureStructure({ missingLatestValidity: true });
    const { completeSyntheticEmploymentTerms } = require('./employeeCompleteProfileFixture');
    const { buildCompleteProfileSnapshot } = require('../../server/utils/ergazomenoi/employmentProfileHistory');
    const documents = { '0001': { from: '2026-04-01', arrival: 0 },
        '0002': { from: '2026-04-15', arrival: 30 }, '0003': { from: '2026-05-01', arrival: 120 } };
    data.completeHistoryRows = data.completeHistoryRows.map(row => {
        const document = documents[row.aa_eggrafhs];
        const source = { ...completeSyntheticEmploymentTerms(), ...row,
            typos_apasxolhshs: row.kathestos_apasxolhshs,
            typos_ebdomadas: row.hmeres_ergasias_ebdomadas === 5 ? '5HMERH' : '',
            eidikh_kathgoria_ergazomenoy: 'OTHER',
            evelikth_proselefsh: document.arrival, symbatikes_ores_ergasias: 40,
            dialleima_se_lepta: 30, hmeromhnia_allaghs_symbashs: new Date(document.from) };
        return { ...row, ...buildCompleteProfileSnapshot({ current: source, effectiveFrom: document.from }),
            afora_proslhpsh: row.aa_eggrafhs === '0001',
            [START]: null, hmeromhnia_isxyos_oron_ergasias_eos: null };
    });
    const terminal = data.completeHistoryRows.find(row => row.aa_eggrafhs === '0003');
    data.currentEmployee = { ...data.currentEmployee, ...terminal, _id: data.currentEmployee._id,
        [START]: new Date('2026-05-01'), hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-12-31') };
    return data;
}
function recorded(factory, kind) {
    const data = clone(factory());
    const initial = kind === 'A' ? { from: '2026-04-24', pay: 1120, kpk: '0961' }
        : { from: '2026-04-23', pay: 1200, kpk: '0962' };
    const amendment = kind === 'A' ? { from: '2026-05-25', pay: 1220, end: '2026-10-05' }
        : { from: '2026-05-17', pay: 1260, end: '2026-10-15' };
    const facts = (pay, kpk) => ({ krathsh_01: kpk, symbash: 'SYNTHETIC_CONTRACT',
        kathgoria_symbashs: 'SYNTHETIC_RECON_CATEGORY', eidikothta_symbashs: 'SYNTHETIC_RECON_SPECIALTY',
        nomimosMisthos: 1040, pragmatikosMisthos: pay, synolo_symbashs: pay,
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
        evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40, dialleima_se_lepta: 0 });
    for (const row of data.completeHistoryRows) {
        const from = row[START] || row.hmeromhnia_allaghs_symbashs || initial.from;
        const terms = facts(from >= amendment.from ? amendment.pay : initial.pay, initial.kpk);
        // Initial values are from the separate hire document, never the amendment.
        for (const [field, value] of Object.entries(terms)) if (row[field] == null) row[field] = value;
    }
    Object.assign(data.currentEmployee, facts(amendment.pay, initial.kpk), {
        [START]: amendment.from, hmeromhnia_isxyos_oron_ergasias_eos: amendment.end });
    return data;
}
module.exports = { ...raw, recorded0006BoundaryStructure, recordedLegacyArtifacts,
    recordedDepartureStructure,
    caseA: () => recorded(raw.caseA, 'A'),
    caseB: () => recorded(raw.caseB, 'B'),
    caseBWithProfileEvidence: () => recorded(raw.caseBWithProfileEvidence, 'B') };
