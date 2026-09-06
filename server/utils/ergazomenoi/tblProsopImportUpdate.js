'use strict';

// Only spreadsheet-backed fields may update an existing employee. Constants in
// mapRowToDocument are INSERT defaults, not instructions to reset local values.
// A missing/blank source cell is not an explicit deletion command.
const SOURCE_COLUMNS = Object.freeze({
    kodikos: ['C'], eponymo: ['D'], onoma: ['E'], afm: ['K'], amka: ['FH'],
    eponymo_patera: ['FJ'], patronymo: ['F'], eponymo_mhteras: ['FK'], mhtronymo: ['G'],
    fylo: ['EC'], hmeromhnia_gennhshs: ['H'], topos_gennhshs: ['I'], yphkoothta: ['J'],
    arithmos_bibliarioy_anhlikoy: ['FZ'], typos_taytothtas: ['J'], adt: ['L'],
    hmeromhnia_ekdoshs: ['NW'], hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy: ['FS'],
    arxh_ekdoshs: ['M'], doy: ['S'], forologikh_klimaka: ['H', 'AO'], email: ['FR'],
    thlefono: ['R'], odos: ['O'], arithmos: ['FZ'], tk: ['Q'], polh: ['FZ'],
    dhmos: ['FZ'], nomos: ['FZ'], perifereia: ['FZ'],
    oikogeneiakh_katastash: ['AO'], arithmos_teknon: ['AO'], ekpaideytiko_epipedo: ['AQ'],
    trapeza: ['BB'], iban: ['BC'], hmeromhnia_proslhpshs: ['U'],
    hmeromhnia_allaghs_symbashs: ['V'],
    // Existing mapper derives both schedule boundaries from U; preserve that mapping.
    hmeromhnia_allaghs_orarioy_apo: ['U'], hmeromhnia_allaghs_orarioy_eos: ['U'],
    hmeromhnia_lhxhs_symbashs: ['BT'],
    hmeromhnia_apoxorhshs: ['W'], typos_daneismoy: ['FZ'], kathestos_apasxolhshs: ['AB'],
    sxesh_ergasias: ['BT'], proyphresia_se_eth: ['X'], proyphresia_se_mhnes: ['X'],
    misthologiko_klimakio: ['Z'], plhrhs_apasxolhsh: ['AB'],
    hmeres_ergasias_ebdomadas: ['AC'], ores_ergasias_ebdomadas: ['AD'],
    mo_oron_hmerhsias_ergasias: ['AC', 'AD'], epoxikos: ['AL'],
    eidikothta_erganh: ['FQ'], typos_ergazomenon: ['AS'], ypokatasthma: ['AV'],
    xarakthrismos_ergazomenon: ['AR'], eidikothta: ['AP'], kad_efka: ['AW'],
    eidikothta_efka: ['AX'], kpk_efka: ['AY'], kpk_efka_basei_symbashs: ['AY'],
    epa_efka: ['AZ'], palios_neos: ['BP'],
    kentro_kostoys_1: ['BG'], pososto_apasxolhshs_kk1: ['BH'],
    kentro_kostoys_2: ['BI'], pososto_apasxolhshs_kk2: ['BJ'],
    kentro_kostoys_3: ['BK'], pososto_apasxolhshs_kk3: ['BL'],
    kentro_kostoys_4: ['BM'], pososto_apasxolhshs_kk4: ['BN'],
    energos: ['FC'], parathrhseis: ['T'], symbash: ['BU'], kathgoria_symbashs: ['BU', 'BV'],
    ...Object.fromEntries(['BZ', 'CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'CH']
        .map((column, i) => [`stoixeio_symbashs_${String(i + 3).padStart(2, '0')}`, [column]]))
});
function supplied(value) {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('result' in value) return supplied(value.result);
        if ('text' in value) return supplied(value.text);
    }
    return value !== null && value !== undefined && String(value).trim() !== '';
}
function buildTblProsopExistingUpdate(row, mapped) {
    const fields = {};
    for (const [field, columns] of Object.entries(SOURCE_COLUMNS)) {
        if (columns.every((column) => supplied(row[column])) && mapped[field] !== undefined) {
            fields[field] = mapped[field];
        }
    }
    return { $set: fields };
}
module.exports = { SOURCE_COLUMNS, buildTblProsopExistingUpdate };
