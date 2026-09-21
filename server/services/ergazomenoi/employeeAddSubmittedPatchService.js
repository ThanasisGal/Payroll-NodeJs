'use strict';

// Source names for aliases in the existing Add mapping. Values still come from
// that mapping; this table controls only whether a value was actually submitted.
const ALIASES = Object.freeze({
    eponymo: ['eponymoHidden'], onoma: ['onomaHidden'],
    afm: ['afm_ergazomenoyHidden'], amka: ['amka_ergazomenoyHidden'],
    doy: ['doy_stathera'], typos_taytothtas: ['taytothta_stathera'],
    yphkoothta: ['yphkoothta_stathera'],
    eidikh_kathgoria_ergazomenoy: ['eidikh_kathgoria_stathera'],
    oikogeneiakh_katastash: ['oikogeneiakh_katastash_stathera'],
    perifereia: ['perifereia_stathera'], nomos: ['nomos_stathera'],
    dhmos: ['dhmos_stathera'], polh: ['polh_stathera'],
    ekpaideytiko_epipedo: ['ekpaideytiko_epipedo_stathera'],
    trapeza: ['trapeza_stathera'],
    hmeromhnia_isxyos_oron_ergasias_apo:
        ['hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_allaghs_orarioy_apo'],
    afora_kataggelia_me_proeidopoihsh: ['kataggelia_me_proeidopoihsh'],
    hmeromhnia_koinopoihshs_kataggelias: ['hmnia_koinopoihshs_kataggelias'],
    logos_peratosis: ['logos_peratoshs_stathera'],
    parathrhseis_peratosis: ['parathrhseis_peratoshs'],
    afora_daneismo_ergazomenoy: ['afora_daneismo_ergazomenoy'],
    typos_daneismoy: ['typos_daneismoy_stathera'],
    kathestos_apasxolhshs: ['kathestos_apasxolhshs_stathera'],
    sxesh_ergasias: ['sxesh_ergasias_stathera'],
    syggenikh_sxesh: ['syggenikh_sxesh_stathera'],
    thesh_eythynhs: ['thesh_eythynhs_stathera'],
    eidikh_periptosh: ['eidikh_periptosh_stathera'],
    efarmostea_sse_parathrhseis: ['parathrhseis_efarmosteas_sse'],
    apasxolhsh_basei_symbashs: ['apasxolhsh_basei_symbashs_stathera'],
    evelikth_proselefsh: ['evelikth_proselefsh_add'],
    asfalistikh_klash: ['asfalistikh_klash_stathera'],
    tmhma: ['tmhma_stathera'], eidikothta_erganh: ['eidikothta_erganh_stathera'],
    typos_ergazomenon: ['typos_ergazomenon_stathera'],
    ypokatasthma: ['ypokatasthma_stathera'],
    eidikothta: ['eidikothta_stathera'],
    foreas_kyrias_asfalishs: ['foreas_kyrias_asfalishs_stathera'],
    kad_efka: ['kad_efka_stathera'], eidikothta_efka: ['eidikothta_efka_stathera'],
    kpk_efka: ['kpk_efka_stathera'],
    kpk_efka_basei_symbashs: ['kpk_efka_basei_symbashs_stathera', 'kpk_efka_basei_symbashs',
        'tmp_kpk_efka_stathera'],
    epa_efka: ['epa_efka_stathera'],
    eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia:
        ['eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia_stathera'],
    eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia:
        ['eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia_stathera'],
    thematiko_pedio: ['thematiko_pedio_stathera'],
    thematikh_enothta: ['thematikh_enothta_stathera'],
    foreas_katartishs: ['foreas_katartishs_stathera'],
    oysiodeis_oroi: ['oysiodeis_oroi_stathera'],
    kodikos_meioshs: ['kodikos_meioshs_stathera'],
    pososto_asfalismenoy_meioshs: ['pososto_asfalismenoy_meioshs_stathera'],
    pososto_ergodoth_meioshs: ['pososto_ergodoth_meioshs_stathera'],
    isxyei_apo_meioshs: ['isxyei_apo_meioshs_stathera'],
    isxyei_eos_meioshs: ['isxyei_eos_meioshs_stathera'],
    kodikos_epidothshs: ['kodikos_epidothshs_stathera'],
    pososto_asfalismenoy_epidothshs: ['pososto_asfalismenoy_epidothshs_stathera'],
    pososto_ergodoth_epidothshs: ['pososto_ergodoth_epidothshs_stathera'],
    isxyei_apo_epidothshs: ['isxyei_apo_epidothshs_stathera'],
    isxyei_eos_epidothshs: ['isxyei_eos_epidothshs_stathera'],
    meiosh_eisforon_mhteron: ['meiosh_eisforon_mhteron_stathera'],
    kodikos_meioshs_eisforon_mhteron: ['kodikos_meioshs_eisforon_mhteron_stathera'],
    pososto_asfalismenoy_eisforon_mhteron:
        ['pososto_asfalismenoy_eisforon_mhteron_stathera'],
    pososto_ergodoth_eisforon_mhteron:
        ['pososto_ergodoth_eisforon_mhteron_stathera'],
    isxyei_apo_eisforon_mhteron: ['isxyei_apo_eisforon_mhteron_stathera'],
    isxyei_eos_eisforon_mhteron: ['isxyei_eos_eisforon_mhteron_stathera'],
    dypa: ['dypa_stathera'], programma_dypa: ['programma_dypa_stathera'],
    kentro_kostoys_1: ['kentro_kostoys_1_stathera'],
    kentro_kostoys_2: ['kentro_kostoys_2_stathera'],
    kentro_kostoys_3: ['kentro_kostoys_3_stathera'],
    kentro_kostoys_4: ['kentro_kostoys_4_stathera'],
    symbash: ['symbash_stathera'],
    kathgoria_symbashs: ['kathgoria_symbashs_stathera'],
    eidikothta_symbashs: ['eidikothta_symbashs_stathera'],
    typos_apasxolhshs: ['kathestos_apasxolhshs_stathera', 'kathestos_apasxolhshs'],
    typos_ebdomadas: ['typos_ebdomadas', 'hmeres_ergasias_ebdomadas',
        'apasxolhsh_basei_symbashs_stathera'],
    afora_allagh_oron_ergasias: ['hmeromhnia_isxyos_oron_ergasias_apo',
        'hmeromhnia_allaghs_orarioy_apo', 'hmeres_ergasias_ebdomadas',
        'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias']
});

const NEVER_CORRECT = new Set(['_id', 'team', 'company_kod', 'kodikos',
    'createdAt', 'updatedAt', 'aa_eggrafhs', 'afora_proslhpsh']);
function submittedAddPatch(document, submittedKeys, ownedFields) {
    const values = document.toObject();
    return Object.fromEntries(Object.entries(values).filter(([field]) => {
        if (NEVER_CORRECT.has(field) || !ownedFields.has(field)) return false;
        const sources = ALIASES[field] || [field];
        return sources.some(key => submittedKeys.has(key));
    }));
}
function submittedProfileForm(formData, submittedKeys) {
    return Object.fromEntries(Object.entries(formData).filter(([key]) => submittedKeys.has(key)));
}
module.exports = { submittedAddPatch, submittedProfileForm };
