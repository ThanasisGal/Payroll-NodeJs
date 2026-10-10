'use strict';
const C = require('../employeeHistoryAutomaticReconstructionContract');
const { Types } = require('mongoose');

// Structural facts from the reconstruction audit's BEFORE image, read on
// 2026-10-10: two compatible hire artifacts, one later work-terms event,
// incomplete profile fields and an unclosed earlier artifact. Dates, IDs,
// contract codes and all monetary amounts below are synthetic. This does not
// claim to reproduce the user's undocumented intermediate browser messages.
function tha0030DepartureStructure({ missingLatestValidity = false } = {}) {
    const scope = { team: 'TEST', company_kod: 'synthetic-company', kodikos: '0030' };
    const date = value => value == null ? null : new Date(value);
    const numeric = Object.fromEntries(Object.entries(C.PROFILE_FIELD_TYPES)
        .filter(([field, type]) => type === 'Number' && !['pososto_prosayxhshs_6hs_hmeras',
            'dialleima_se_lepta', 'evelikth_proselefsh', 'symbatikes_ores_ergasias'].includes(field))
        .map(([field]) => [field, 0]));
    const common = { ...scope, ...numeric, hmeromhnia_proslhpshs: date('2026-04-01'),
        hmeromhnia_lhxhs_symbashs: date('2026-12-31'), hmeromhnia_apoxorhshs: null,
        symbash: 'SYNTHETIC', kathgoria_symbashs: 'CATEGORY', eidikothta_symbashs: 'SPECIALTY',
        krathsh_01: '0111', misthologiko_klimakio: 1, nomimosMisthos: 1200,
        nomimoHmeromisthio: 48, nomimoOromisthio: 7.2, pragmatikoOromisthio: 7.2,
        poso_symbashs_01: 1000, poso_symbashs_02: 200, synolo_symbashs: 1200,
        stoixeio_symbashs_01: 'BASE', stoixeio_symbashs_02: 'ALLOWANCE',
        employment_profile_source: 'ERGOMENOI_CONTROLLER', __v: 0, history_reference_fence: 1,
        afora_allagh_oron_ergasias: true };
    const row = (index, changes) => ({ ...common,
        _id: new Types.ObjectId(`60000000000000000000000${index}`),
        aa_eggrafhs: String(index).padStart(4, '0'),
        createdAt: date(`2026-04-0${index}`), updatedAt: date('2026-06-01'), ...changes });
    const first = row(1, { hmeromhnia_allaghs_symbashs: date('2026-04-01'),
        hmeromhnia_isxyos_oron_ergasias_apo: date('2026-04-01'),
        hmeromhnia_isxyos_oron_ergasias_eos: date('2026-04-30'),
        hmeromhnia_allaghs_orarioy_apo: date('2026-04-01'),
        hmeromhnia_allaghs_orarioy_eos: date('2026-04-07'), afora_proslhpsh: true,
        hmeres_ergasias_ebdomadas: 2, ores_ergasias_ebdomadas: 16, mo_oron_hmerhsias_ergasias: 8,
        kathestos_apasxolhshs: '2', typos_apasxolhshs: '5',
        pragmatikosMisthos: 480, pragmatikoHmeromisthio: 57.6,
        poso_symbashs_basei_oron_ergasias_01: 400, poso_symbashs_basei_oron_ergasias_02: 80,
        synolo_symbashs_basei_oron_ergasias: 480 });
    const second = row(2, { ...first, _id: new Types.ObjectId('600000000000000000000002'),
        aa_eggrafhs: '0002', createdAt: date('2026-04-03'), hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_allaghs_orarioy_apo: date('2026-04-15'), hmeromhnia_allaghs_orarioy_eos: date('2026-04-21'),
        hmeres_ergasias_ebdomadas: 4, ores_ergasias_ebdomadas: 34, mo_oron_hmerhsias_ergasias: 8.5,
        pragmatikosMisthos: 1020, pragmatikoHmeromisthio: 61.2,
        poso_symbashs_basei_oron_ergasias_01: 850, poso_symbashs_basei_oron_ergasias_02: 170,
        synolo_symbashs_basei_oron_ergasias: 1020 });
    const last = row(3, { hmeromhnia_allaghs_symbashs: date('2026-05-01'),
        hmeromhnia_isxyos_oron_ergasias_apo: date('2026-05-01'), hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_allaghs_orarioy_apo: date('2026-05-01'), hmeromhnia_allaghs_orarioy_eos: date('2026-05-07'),
        afora_proslhpsh: false, hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
        pragmatikosMisthos: 1200, pragmatikoHmeromisthio: 48,
        poso_symbashs_basei_oron_ergasias_01: 1000, poso_symbashs_basei_oron_ergasias_02: 200,
        synolo_symbashs_basei_oron_ergasias: 1200 });
    const currentEmployee = { ...last, _id: new Types.ObjectId('600000000000000000000099'),
        energos: true, archived: false, dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false,
        evelikth_proselefsh: 120, symbatikes_ores_ergasias: 40, eidikh_kathgoria_ergazomenoy: 'OTHER',
        synexes_diakekomeno: false, typos_orarioy: false };
    delete currentEmployee.typos_apasxolhshs;
    delete currentEmployee.typos_ebdomadas;
    // Minimal blocking variant, NOT an assertion about the unrecorded failed
    // 0030 Save: the real work-terms event remains, but its explicit validity
    // is missing. Ordinary departure blocks; reconstruction restores it from
    // that event, without inventing lifecycle evidence from schedule dates.
    if (missingLatestValidity) last.hmeromhnia_isxyos_oron_ergasias_apo = null;
    return { scope, currentEmployee, completeHistoryRows: [first, last, second] };
}
module.exports = { tha0030DepartureStructure };
