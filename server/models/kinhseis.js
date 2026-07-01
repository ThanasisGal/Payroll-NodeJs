const { Schema: _Schema, model } = require('mongoose');

const Schema = _Schema;

const ApoysiesSchema = new Schema({
    team: { type: String, trim: true },
    company_kod: { type: String, trim: true },
    kodikos: { type: String, trim: true },
    xrhsh: { type: String, trim: true },
    periodos: { type: String, trim: true },
    hmeromhnia: { type: Date },
    hmeres_apoysias: { type: Number, default: 0 },
    ores_apoysias: { type: Number, default: 0 }
});
const ApoysiesModel = model('Apoysies', ApoysiesSchema);

const ApasxolhseisSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },
        ypokatasthma: { type: String, trim: true },
        kodikos: { type: String, trim: true },
        xrhsh: { type: String, trim: true },
        periodos: { type: String, trim: true },
        typos_apodoxon: { type: String, trim: true },
        aa_misthodosias: { type: String, trim: true },
        exoflhsh: { type: String, trim: true },
        synolo_apodoxon: { type: Number, default: 0 },
        poso_plhromhs: { type: Number, default: 0 },
        symfonhtheis_misthos: { type: Number, default: 0 },
        nomimo_hmeromisthio: { type: Number, default: 0 },
        pragmatiko_hmeromisthio: { type: Number, default: 0 },
        nomimo_oromisthio: { type: Number, default: 0 },
        pragmatiko_oromisthio: { type: Number, default: 0 },
        hmeres_ergasias: { type: Number, default: 0 },
        ores_ergasias: { type: Number, default: 0 },
        hmeres_apoysias: { type: Number, default: 0 },
        ores_apoysias: { type: Number, default: 0 },
        hmeres_ergasias_meion_apoysies: { type: Number, default: 0 },
        ores_ergasias_meion_apoysies: { type: Number, default: 0 },
        hmeres_asfalishs: { type: Number, default: 0 },
        ores_argion: { type: Number, default: 0 },
        axia_argion: { type: Number, default: 0 },
        asfalistikh_axia_argion: { type: Number, default: 0 },
        ores_nyxtas: { type: Number, default: 0 },
        axia_nyxtas: { type: Number, default: 0 },
        asfalistikh_axia_nyxtas: { type: Number, default: 0 },
        ores_yperergasias: { type: Number, default: 0 },
        axia_yperergasias: { type: Number, default: 0 },
        asfalistikh_axia_yperergasias: { type: Number, default: 0 },
        ores_yperergasias_nyxtas: { type: Number, default: 0 },
        axia_yperergasias_nyxtas: { type: Number, default: 0 },
        asfalistikh_axia_yperergasias_nyxtas: { type: Number, default: 0 },
        ores_yperergasias_argion: { type: Number, default: 0 },
        axia_yperergasias_argion: { type: Number, default: 0 },
        asfalistikh_axia_yperergasias_argion: { type: Number, default: 0 },
        ores_yperergasias_argion_nyxtas: { type: Number, default: 0 },
        axia_yperergasias_argion_nyxtas: { type: Number, default: 0 },
        asfalistikh_axia_yperergasias_argion_nyxtas: { type: Number, default: 0 },
        ores_nomimhs_yperorias: { type: Number, default: 0 },
        axia_nomimhs_yperorias: { type: Number, default: 0 },
        asfalistikh_axia_nomimhs_yperorias: { type: Number, default: 0 },
        ores_nomimhs_yperorias_nyxtas: { type: Number, default: 0 },
        axia_nomimhs_yperorias_nyxtas: { type: Number, default: 0 },
        asfalistikh_axia_nomimhs_yperorias_nyxtas: { type: Number, default: 0 },
        ores_nomimhs_yperorias_argion: { type: Number, default: 0 },
        axia_nomimhs_yperorias_argion: { type: Number, default: 0 },
        asfalistikh_axia_nomimhs_yperorias_argion: { type: Number, default: 0 },
        ores_nomimhs_yperorias_argion_nyxtas: { type: Number, default: 0 },
        axia_nomimhs_yperorias_argion_nyxtas: { type: Number, default: 0 },
        asfalistikh_axia_nomimhs_yperorias_argion_nyxtas: { type: Number, default: 0 },
        ores_paranomhs_yperorias: { type: Number, default: 0 },
        axia_paranomhs_yperorias: { type: Number, default: 0 },
        asfalistikh_axia_paranomhs_yperorias: { type: Number, default: 0 },
        ores_paranomhs_yperorias_nyxtas: { type: Number, default: 0 },
        axia_paranomhs_yperorias_nyxtas: { type: Number, default: 0 },
        asfalistikh_axia_paranomhs_yperorias_nyxtas: { type: Number, default: 0 },
        ores_paranomhs_yperorias_argion: { type: Number, default: 0 },
        axia_paranomhs_yperorias_argion: { type: Number, default: 0 },
        asfalistikh_axia_paranomhs_yperorias_argion: { type: Number, default: 0 },
        ores_paranomhs_yperorias_argion_nyxtas: { type: Number, default: 0 },
        axia_paranomhs_yperorias_argion_nyxtas: { type: Number, default: 0 },
        asfalistikh_axia_paranomhs_yperorias_argion_nyxtas: { type: Number, default: 0 },
        ores_ergasias_6_hmeras: { type: Number, default: 0 },
        axia_ergasias_6_hmeras: { type: Number, default: 0 },
        ores_prostheths_ergasias: { type: Number, default: 0 },
        axia_prostheths_ergasias: { type: Number, default: 0 },
        synolo_prosayxhseon: { type: Number, default: 0 },
        taktikes_apodoxes_mh_ypologizomenes_se_dora_text: { type: String, trim: true },
        taktikes_apodoxes_mh_ypologizomenes_se_dora: { type: Number, default: 0 },
        taktikes_apodoxes_ypologizomenes_se_dora_text: { type: String, trim: true },
        taktikes_apodoxes_ypologizomenes_se_dora: { type: Number, default: 0 },
        sympsifistees_apodoxes: { type: Number, default: 0 },
        synolo_taktika_kataballomenon_apodoxon: { type: Number, default: 0 },
        epimerizomenes_se_mhnes_ergasias_text: { type: String, trim: true },
        epimerizomenes_se_mhnes_ergasias: { type: Number, default: 0 },
        prim_bonus_text: { type: String, trim: true },
        prim_bonus: { type: Number, default: 0 },
        apallassomenes_foroy_text: { type: String, trim: true },
        apallassomenes_foroy: { type: Number, default: 0 },
        apallassomenes_krathseon_text: { type: String, trim: true },
        apallassomenes_krathseon: { type: Number, default: 0 },
        synolo_ektakta_kataballomenon_apodoxon: { type: Number, default: 0 },
        meiosh_ergatikhs_eisforas: { type: Number, default: 0 },
        meiosh_ergodotikhs_eisforas: { type: Number, default: 0 },
        neo_pragmatiko_hmeromisthio: { type: Number, default: 0 },
        pragmatiko_hmeromisthio_astheneias: { type: Number, default: 0 },
        apo_hmeromhnia: { type: Date },
        eos_hmeromhnia: { type: Date },
        synolo_asfalistikhs_axias_prosayxhseon: { type: Number, default: 0 },
        synolo_mikton_apodoxon: { type: Number, default: 0 },
        synolo_krathseon_i: { type: Number, default: 0 },
        prokatabolh: { type: Number, default: 0 },
        plhroteo: { type: Number, default: 0 },
        krathsh_01: { type: String, trim: true },
        krathsh_02: { type: String, trim: true },
        krathsh_03: { type: String, trim: true },
        krathsh_04: { type: String, trim: true },
        krathsh_05: { type: String, trim: true },
        krathsh_06: { type: String, trim: true },
        krathsh_07: { type: String, trim: true },
        asfalistikesApodoxes_01: { type: Number, default: 0 },
        asfalistikesApodoxes_02: { type: Number, default: 0 },
        asfalistikesApodoxes_03: { type: Number, default: 0 },
        asfalistikesApodoxes_04: { type: Number, default: 0 },
        asfalistikesApodoxes_05: { type: Number, default: 0 },
        asfalistikesApodoxes_06: { type: Number, default: 0 },
        asfalistikesApodoxes_07: { type: Number, default: 0 },
        asfalistikes_apodoxes: { type: Number, default: 0 },
        asfalistikes_apodoxes_hidden: { type: Number, default: 0 },
        pososto_krathshs_ergazomenoy_01: { type: Number, default: 0 },
        pososto_krathshs_ergazomenoy_02: { type: Number, default: 0 },
        pososto_krathshs_ergazomenoy_03: { type: Number, default: 0 },
        pososto_krathshs_ergazomenoy_04: { type: Number, default: 0 },
        pososto_krathshs_ergazomenoy_05: { type: Number, default: 0 },
        pososto_krathshs_ergazomenoy_06: { type: Number, default: 0 },
        pososto_krathshs_ergazomenoy_07: { type: Number, default: 0 },
        pososto_krathshs_ergodoth_01: { type: Number, default: 0 },
        pososto_krathshs_ergodoth_02: { type: Number, default: 0 },
        pososto_krathshs_ergodoth_03: { type: Number, default: 0 },
        pososto_krathshs_ergodoth_04: { type: Number, default: 0 },
        pososto_krathshs_ergodoth_05: { type: Number, default: 0 },
        pososto_krathshs_ergodoth_06: { type: Number, default: 0 },
        pososto_krathshs_ergodoth_07: { type: Number, default: 0 },
        synolo_pososton_krathshs_01: { type: Number, default: 0 },
        synolo_pososton_krathshs_02: { type: Number, default: 0 },
        synolo_pososton_krathshs_03: { type: Number, default: 0 },
        synolo_pososton_krathshs_04: { type: Number, default: 0 },
        synolo_pososton_krathshs_05: { type: Number, default: 0 },
        synolo_pososton_krathshs_06: { type: Number, default: 0 },
        synolo_pososton_krathshs_07: { type: Number, default: 0 },
        poso_krathshs_ergazomenoy_01: { type: Number, default: 0 },
        poso_krathshs_ergazomenoy_02: { type: Number, default: 0 },
        poso_krathshs_ergazomenoy_03: { type: Number, default: 0 },
        poso_krathshs_ergazomenoy_04: { type: Number, default: 0 },
        poso_krathshs_ergazomenoy_05: { type: Number, default: 0 },
        poso_krathshs_ergazomenoy_06: { type: Number, default: 0 },
        poso_krathshs_ergazomenoy_07: { type: Number, default: 0 },
        poso_krathshs_ergodoth_01: { type: Number, default: 0 },
        poso_krathshs_ergodoth_02: { type: Number, default: 0 },
        poso_krathshs_ergodoth_03: { type: Number, default: 0 },
        poso_krathshs_ergodoth_04: { type: Number, default: 0 },
        poso_krathshs_ergodoth_05: { type: Number, default: 0 },
        poso_krathshs_ergodoth_06: { type: Number, default: 0 },
        poso_krathshs_ergodoth_07: { type: Number, default: 0 },
        synolo_poson_krathshs_01: { type: Number, default: 0 },
        synolo_poson_krathshs_02: { type: Number, default: 0 },
        synolo_poson_krathshs_03: { type: Number, default: 0 },
        synolo_poson_krathshs_04: { type: Number, default: 0 },
        synolo_poson_krathshs_05: { type: Number, default: 0 },
        synolo_poson_krathshs_06: { type: Number, default: 0 },
        synolo_poson_krathshs_07: { type: Number, default: 0 },
        axia_krathshs_ergazomenoy_01: { type: Number, default: 0 },
        axia_krathshs_ergazomenoy_02: { type: Number, default: 0 },
        axia_krathshs_ergazomenoy_03: { type: Number, default: 0 },
        axia_krathshs_ergazomenoy_04: { type: Number, default: 0 },
        axia_krathshs_ergazomenoy_05: { type: Number, default: 0 },
        axia_krathshs_ergazomenoy_06: { type: Number, default: 0 },
        axia_krathshs_ergazomenoy_07: { type: Number, default: 0 },
        axia_krathshs_ergodoth_01: { type: Number, default: 0 },
        axia_krathshs_ergodoth_02: { type: Number, default: 0 },
        axia_krathshs_ergodoth_03: { type: Number, default: 0 },
        axia_krathshs_ergodoth_04: { type: Number, default: 0 },
        axia_krathshs_ergodoth_05: { type: Number, default: 0 },
        axia_krathshs_ergodoth_06: { type: Number, default: 0 },
        axia_krathshs_ergodoth_07: { type: Number, default: 0 },
        kodikos_01: { type: String, trim: true },
        kodikos_02: { type: String, trim: true },
        kodikos_03: { type: String, trim: true },
        kodikos_04: { type: String, trim: true },
        kodikos_05: { type: String, trim: true },
        kodikos_06: { type: String, trim: true },
        kodikos_07: { type: String, trim: true },
        ypologizomenoStoForo_01: { type: Boolean, default: false },
        ypologizomenoStoForo_02: { type: Boolean, default: false },
        ypologizomenoStoForo_03: { type: Boolean, default: false },
        ypologizomenoStoForo_04: { type: Boolean, default: false },
        ypologizomenoStoForo_05: { type: Boolean, default: false },
        ypologizomenoStoForo_06: { type: Boolean, default: false },
        ypologizomenoStoForo_07: { type: Boolean, default: false },
        ypologizomenoEpiPlasmatikhs_01: { type: Boolean, default: false },
        ypologizomenoEpiPlasmatikhs_02: { type: Boolean, default: false },
        ypologizomenoEpiPlasmatikhs_03: { type: Boolean, default: false },
        ypologizomenoEpiPlasmatikhs_04: { type: Boolean, default: false },
        ypologizomenoEpiPlasmatikhs_05: { type: Boolean, default: false },
        ypologizomenoEpiPlasmatikhs_06: { type: Boolean, default: false },
        ypologizomenoEpiPlasmatikhs_07: { type: Boolean, default: false },
        plasmatikh_axia_01: { type: Number, default: 0 },
        plasmatikh_axia_02: { type: Number, default: 0 },
        plasmatikh_axia_03: { type: Number, default: 0 },
        plasmatikh_axia_04: { type: Number, default: 0 },
        plasmatikh_axia_05: { type: Number, default: 0 },
        plasmatikh_axia_06: { type: Number, default: 0 },
        plasmatikh_axia_07: { type: Number, default: 0 },
        apaiteitai_apodoxes_asfalishs_01: { type: Boolean, default: false },
        apaiteitai_apodoxes_asfalishs_02: { type: Boolean, default: false },
        apaiteitai_apodoxes_asfalishs_03: { type: Boolean, default: false },
        apaiteitai_apodoxes_asfalishs_04: { type: Boolean, default: false },
        apaiteitai_apodoxes_asfalishs_05: { type: Boolean, default: false },
        apaiteitai_apodoxes_asfalishs_06: { type: Boolean, default: false },
        apaiteitai_apodoxes_asfalishs_07: { type: Boolean, default: false },
        anotato_orio_palion_01: { type: Number, default: 0 },
        anotato_orio_palion_02: { type: Number, default: 0 },
        anotato_orio_palion_03: { type: Number, default: 0 },
        anotato_orio_palion_04: { type: Number, default: 0 },
        anotato_orio_palion_05: { type: Number, default: 0 },
        anotato_orio_palion_06: { type: Number, default: 0 },
        anotato_orio_palion_07: { type: Number, default: 0 },
        anotato_orio_neon_01: { type: Number, default: 0 },
        anotato_orio_neon_02: { type: Number, default: 0 },
        anotato_orio_neon_03: { type: Number, default: 0 },
        anotato_orio_neon_04: { type: Number, default: 0 },
        anotato_orio_neon_05: { type: Number, default: 0 },
        anotato_orio_neon_06: { type: Number, default: 0 },
        anotato_orio_neon_07: { type: Number, default: 0 },
        kad_01: { type: String, trim: true },
        kad_02: { type: String, trim: true },
        kad_03: { type: String, trim: true },
        kad_04: { type: String, trim: true },
        kad_05: { type: String, trim: true },
        kad_06: { type: String, trim: true },
        kad_07: { type: String, trim: true },
        eidikothta_01: { type: String, trim: true },
        eidikothta_02: { type: String, trim: true },
        eidikothta_03: { type: String, trim: true },
        eidikothta_04: { type: String, trim: true },
        eidikothta_05: { type: String, trim: true },
        eidikothta_06: { type: String, trim: true },
        eidikothta_07: { type: String, trim: true },
        kpk_01: { type: String, trim: true },
        kpk_02: { type: String, trim: true },
        kpk_03: { type: String, trim: true },
        kpk_04: { type: String, trim: true },
        kpk_05: { type: String, trim: true },
        kpk_06: { type: String, trim: true },
        kpk_07: { type: String, trim: true },
        se_typos_apodoxon_01: { type: String, trim: true },
        se_typos_apodoxon_02: { type: String, trim: true },
        se_typos_apodoxon_03: { type: String, trim: true },
        se_typos_apodoxon_04: { type: String, trim: true },
        se_typos_apodoxon_05: { type: String, trim: true },
        se_typos_apodoxon_06: { type: String, trim: true },
        se_typos_apodoxon_07: { type: String, trim: true },
        epa_01: { type: String, trim: true },
        epa_02: { type: String, trim: true },
        epa_03: { type: String, trim: true },
        epa_04: { type: String, trim: true },
        epa_05: { type: String, trim: true },
        epa_06: { type: String, trim: true },
        epa_07: { type: String, trim: true },
        synolo_axias_krathshs_ergazomenoy: { type: Number, default: 0 },
        synolo_axias_krathshs_ergodoth: { type: Number, default: 0 },
        synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro: { type: Number, default: 0 },
        synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro: { type: Number, default: 0 },
        synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro: { type: Number, default: 0 },
        synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro: { type: Number, default: 0 },
        ethsio_forologhteo_poso_taktikon_apodoxon: { type: Number, default: 0 },
        forologhteo_poso_taktikon_apodoxon: { type: Number, default: 0 },
        analogoyn_foros_pro_ekptoshs: { type: Number, default: 0 },
        mhniaios_analogoyn_foros_pro_ekptoshs: { type: Number, default: 0 },
        eisfora_allhleggyhs: { type: Number, default: 0 },
        ekptosh_logo_oikogeneiakhs_katastashs: { type: Number, default: 0 },
        mhniaia_ekptosh_logo_oikogeneiakhs_katastashs: { type: Number, default: 0 },
        analogoyn_foros_meta_thn_ekptosh: { type: Number, default: 0 },
        analogoyn_foros_epoxikon: { type: Number, default: 0 },
        synolo_ektakton_amoibon: { type: Number, default: 0 },
        analogoyn_foros_ektakton_amoibon: { type: Number, default: 0 },
        synolo_foroy: { type: Number, default: 0 },
        apo_hmeromhnia_astheneias_01: { type: Date },
        eos_hmeromhnia_astheneias_01: { type: Date },
        idios_logos_01: { type: Boolean, default: false },
        days_less_3_01: { type: Number, default: 0 },
        days_greater_3_01: { type: Number, default: 0 },
        synolo_astheneias_01: { type: Number, default: 0 },
        eidos_astheneias_01: { type: String, trim: true },
        adeia_kyhshs_loxeias_01: { type: Boolean, default: false },
        epidothsh_efka_01: { type: Number, default: 0 },
        apodoxes_astheneias_01: { type: Number, default: 0 },
        apo_hmeromhnia_astheneias_02: { type: Date },
        eos_hmeromhnia_astheneias_02: { type: Date },
        idios_logos_02: { type: Boolean, default: false },
        days_less_3_02: { type: Number, default: 0 },
        days_greater_3_02: { type: Number, default: 0 },
        synolo_astheneias_02: { type: Number, default: 0 },
        eidos_astheneias_02: { type: String, trim: true },
        adeia_kyhshs_loxeias_02: { type: Boolean, default: false },
        epidothsh_efka_02: { type: Number, default: 0 },
        apodoxes_astheneias_02: { type: Number, default: 0 },
        apo_hmeromhnia_astheneias_03: { type: Date },
        eos_hmeromhnia_astheneias_03: { type: Date },
        idios_logos_03: { type: Boolean, default: false },
        days_less_3_03: { type: Number, default: 0 },
        days_greater_3_03: { type: Number, default: 0 },
        synolo_astheneias_03: { type: Number, default: 0 },
        eidos_astheneias_03: { type: String, trim: true },
        adeia_kyhshs_loxeias_03: { type: Boolean, default: false },
        epidothsh_efka_03: { type: Number, default: 0 },
        apodoxes_astheneias_03: { type: Number, default: 0 },
        apo_hmeromhnia_astheneias_04: { type: Date },
        eos_hmeromhnia_astheneias_04: { type: Date },
        idios_logos_04: { type: Boolean, default: false },
        days_less_3_04: { type: Number, default: 0 },
        days_greater_3_04: { type: Number, default: 0 },
        synolo_astheneias_04: { type: Number, default: 0 },
        eidos_astheneias_04: { type: String, trim: true },
        adeia_kyhshs_loxeias_04: { type: Boolean, default: false },
        epidothsh_efka_04: { type: Number, default: 0 },
        apodoxes_astheneias_04: { type: Number, default: 0 },
        apo_hmeromhnia_astheneias_05: { type: Date },
        eos_hmeromhnia_astheneias_05: { type: Date },
        idios_logos_05: { type: Boolean, default: false },
        days_less_3_05: { type: Number, default: 0 },
        days_greater_3_05: { type: Number, default: 0 },
        synolo_astheneias_05: { type: Number, default: 0 },
        eidos_astheneias_05: { type: String, trim: true },
        adeia_kyhshs_loxeias_05: { type: Boolean, default: false },
        epidothsh_efka_05: { type: Number, default: 0 },
        apodoxes_astheneias_05: { type: Number, default: 0 },
        synolo_less_3: { type: Number, default: 0 },
        synolo_greater_3: { type: Number, default: 0 },
        geniko_synolo_hmeron_astheneias: { type: Number, default: 0 },
        geniko_synolo_epidothshs_efka: { type: Number, default: 0 },
        geniko_synolo_astheneias: { type: Number, default: 0 },
        ergasiako_etos: { type: String, trim: true },
        epomeno_ergasiako_etos: { type: String, trim: true },
        diasthma_apasxolhshs: { type: Number, default: 0 },
        dikaioymenh_astheneia_trexontos_ergasiakoy_etoys: { type: Number, default: 0 },
        diasthma_hmeron_astheneias: { type: Number, default: 0 },
        lhfteisa_adeia_asteneias_prohgoymenon_mhnon: { type: Number, default: 0 },
        mh_ergasimes_basei_orarioy: { type: Number, default: 0 },
        mh_ergasimes_hmeromhnies: { type: String, trim: true },
        ypoloipo_adeias_astheneias_trexontos_etoys: { type: Number, default: 0 },
        repo: { type: Number, default: 0 },
        repo_hmeromhnies: { type: String, trim: true },
        argies: { type: Number, default: 0 },
        argies_hmeromhnies: { type: String, trim: true },
        argies_mh_ergasimon_repo: { type: Number, default: 0 },
        argies_mh_ergasimon_repo_hmeromhnies: { type: String, trim: true },
        apo_hmeromhnia_adeias_01: { type: Date },
        eos_hmeromhnia_adeias_01: { type: Date },
        hmeres_adeias_01: { type: Number, default: 0 },
        eidos_adeias_01: { type: String, trim: true },
        apo_ora_01: { type: String },
        eos_ora_01: { type: String },
        ores_adeias_01: { type: String },
        apodoxes_epidomatos_adeias_01: { type: Number, default: 0 },
        apodoxes_adeias_01: { type: Number, default: 0 },
        apo_hmeromhnia_adeias_02: { type: Date },
        eos_hmeromhnia_adeias_02: { type: Date },
        hmeres_adeias_02: { type: Number, default: 0 },
        eidos_adeias_02: { type: String, trim: true },
        apo_ora_02: { type: String },
        eos_ora_02: { type: String },
        ores_adeias_02: { type: String },
        apodoxes_epidomatos_adeias_02: { type: Number, default: 0 },
        apodoxes_adeias_02: { type: Number, default: 0 },
        apo_hmeromhnia_adeias_03: { type: Date },
        eos_hmeromhnia_adeias_03: { type: Date },
        hmeres_adeias_03: { type: Number, default: 0 },
        eidos_adeias_03: { type: String, trim: true },
        apo_ora_03: { type: String },
        eos_ora_03: { type: String },
        ores_adeias_03: { type: String },
        apodoxes_epidomatos_adeias_03: { type: Number, default: 0 },
        apodoxes_adeias_03: { type: Number, default: 0 },
        apo_hmeromhnia_adeias_04: { type: Date },
        eos_hmeromhnia_adeias_04: { type: Date },
        hmeres_adeias_04: { type: Number, default: 0 },
        eidos_adeias_04: { type: String, trim: true },
        apo_ora_04: { type: String },
        eos_ora_04: { type: String },
        ores_adeias_04: { type: String },
        apodoxes_epidomatos_adeias_04: { type: Number, default: 0 },
        apodoxes_adeias_04: { type: Number, default: 0 },
        apo_hmeromhnia_adeias_05: { type: Date },
        eos_hmeromhnia_adeias_05: { type: Date },
        hmeres_adeias_05: { type: Number, default: 0 },
        eidos_adeias_05: { type: String, trim: true },
        apo_ora_05: { type: String },
        eos_ora_05: { type: String },
        ores_adeias_05: { type: String },
        apodoxes_epidomatos_adeias_05: { type: Number, default: 0 },
        apodoxes_adeias_05: { type: Number, default: 0 },
        synolo_hmeron_adeias: { type: Number, default: 0 },
        synolo_oron_adeias: { type: Number, default: 0 },
        synolo_apodoxon_epidomatos_adeias: { type: Number, default: 0 },
        synolo_apodoxon_adeias: { type: Number, default: 0 },
        hmerologiako_etos_adeias: { type: String, trim: true },
        epomeno_hmerologiako_etos_adeias: { type: String, trim: true },
        ergasiako_etos_adeias: { type: String, trim: true },
        etos_adeias: { type: Number, default: 0 },
        dikaioymenh_adeia: { type: Number, default: 0 },
        lhfteisa_adeia_prohgoymenon_mhnon: { type: Number, default: 0 },
        ypoloipo_adeias_trexontos_etoys: { type: Number, default: 0 },
        diasthma_hmeron_adeias: { type: Number, default: 0 },
        repo_adeias: { type: Number, default: 0 },
        repo_adeias_hmeromhnies: { type: String, trim: true },
        argies_adeias: { type: Number, default: 0 },
        argies_adeias_hmeromhnies: { type: String, trim: true },
        astheneies_adeias: { type: Number, default: 0 },
        astheneies_adeias_hmeromhnies: { type: String, trim: true },
        koines_hmeres_repo_argion_astheneion_adeias: { type: Number, default: 0 },
        koines_hmeres_repo_argion_astheneion_adeias_hmeromhnies: { type: String, trim: true },
        ypoloipo_adeias: { type: Number, default: 0 }
    },
    {
        collection: 'Apasxolhseis',
        timestamps: true
    }
);

// Μοναδική απασχόληση / κίνηση ανά εργαζόμενο, περίοδο, τύπο αποδοχών και α/α μισθοδοσίας
ApasxolhseisSchema.index(
    {
        team: 1,
        company_kod: 1,
        ypokatasthma: 1,
        kodikos: 1,
        xrhsh: 1,
        periodos: 1,
        typos_apodoxon: 1,
        aa_misthodosias: 1
    },
    {
        unique: true,
        name: 'uniq_apasxolhseis_team_company_ypok_kod_xrhsh_period_typos_aa'
    }
);

// Γρήγορη αναζήτηση όλων των απασχολήσεων μιας περιόδου / τύπου αποδοχών
ApasxolhseisSchema.index(
    {
        team: 1,
        company_kod: 1,
        ypokatasthma: 1,
        xrhsh: 1,
        periodos: 1,
        typos_apodoxon: 1
    },
    {
        name: 'idx_apasxolhseis_period_typos'
    }
);

// Γρήγορη αναζήτηση όλων των κινήσεων ενός εργαζομένου
ApasxolhseisSchema.index(
    {
        team: 1,
        company_kod: 1,
        ypokatasthma: 1,
        kodikos: 1,
        xrhsh: 1
    },
    {
        name: 'idx_apasxolhseis_employee_year'
    }
);

const ApasxolhseisModel = model('Apasxolhseis', ApasxolhseisSchema);

const ApasxolhseisPeriodFactsSchema = new Schema(
    {
        team: { type: String, required: true, trim: true },
        company_kod: { type: String, required: true, trim: true },
        ypokatasthma: { type: String, trim: true, default: '' },
        kodikos: { type: String, required: true, trim: true },

        apo: { type: Date, required: true },
        eos: { type: Date, required: true },
        scope: {
            type: String,
            enum: ['MONTHLY', 'TERMINATION', 'MANUAL'],
            required: true,
            default: 'MANUAL'
        },

        status: {
            type: String,
            enum: ['READY', 'LOCKED', 'STALE', 'FAILED'],
            default: 'READY'
        },

        generatedAt: { type: Date },
        generatedBy: { type: String, trim: true },
        sourceVersion: { type: String, trim: true, default: 'workFactsPrecalc:v1' },

        locked: { type: Boolean, default: false },
        lockedAt: { type: Date },
        lockedBy: { type: String, trim: true },
        lockReason: { type: String, trim: true },

        phases: { type: Schema.Types.Mixed, default: [] },
        phaseSummary: { type: Schema.Types.Mixed, default: [] },
        dailyFacts: { type: Schema.Types.Mixed, default: [] },
        totals: { type: Schema.Types.Mixed, default: {} },
        warnings: [{ type: String, trim: true }],

        inputFingerprint: { type: String, trim: true, default: '' }
    },
    {
        collection: 'Apasxolhseis_Period_Facts',
        timestamps: true
    }
);

ApasxolhseisPeriodFactsSchema.index(
    {
        team: 1,
        company_kod: 1,
        kodikos: 1,
        apo: 1,
        eos: 1,
        scope: 1
    },
    {
        unique: true,
        name: 'uniq_apasx_period_facts_employee_range_scope'
    }
);

ApasxolhseisPeriodFactsSchema.index(
    {
        team: 1,
        company_kod: 1,
        apo: 1,
        eos: 1,
        scope: 1,
        status: 1
    },
    {
        name: 'idx_apasx_period_facts_range_scope_status'
    }
);

ApasxolhseisPeriodFactsSchema.index(
    {
        team: 1,
        company_kod: 1,
        kodikos: 1,
        status: 1
    },
    {
        name: 'idx_apasx_period_facts_employee_status'
    }
);

const ApasxolhseisPeriodFactsModel = model(
    'ApasxolhseisPeriodFacts',
    ApasxolhseisPeriodFactsSchema
);

const PayrollPrecalcJobSchema = new Schema(
    {
        team: { type: String, required: true, trim: true },
        company_kod: { type: String, required: true, trim: true },
        ypokatasthma: { type: String, trim: true, default: '' },

        apo: { type: Date, required: true },
        eos: { type: Date, required: true },
        scope: {
            type: String,
            enum: ['MONTHLY', 'TERMINATION', 'MANUAL'],
            default: 'MONTHLY'
        },

        status: {
            type: String,
            enum: ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'],
            default: 'QUEUED'
        },

        jobKey: { type: String, required: true, trim: true },
        requestedBy: { type: String, trim: true },
        startedAt: { type: Date },
        finishedAt: { type: Date },

        employeesTotal: { type: Number, default: 0 },
        employeesDone: { type: Number, default: 0 },
        employeesSkipped: { type: Number, default: 0 },
        employeesFailed: { type: Number, default: 0 },

        processedKodikos: [{ type: String, trim: true }],
        failedEmployees: [
            {
                kodikos: { type: String, trim: true },
                errorMessage: { type: String, trim: true }
            }
        ],

        warnings: [{ type: String, trim: true }],
        errorMessage: { type: String, trim: true },

        force: { type: Boolean, default: false },
        sourceVersion: { type: String, trim: true, default: 'workFactsPrecalc:v1' }
    },
    {
        collection: 'Payroll_Precalc_Jobs',
        timestamps: true
    }
);

PayrollPrecalcJobSchema.index(
    { jobKey: 1 },
    { unique: true, name: 'uniq_payroll_precalc_job_key' }
);

PayrollPrecalcJobSchema.index(
    {
        team: 1,
        company_kod: 1,
        apo: 1,
        eos: 1,
        scope: 1,
        status: 1
    },
    {
        name: 'idx_payroll_precalc_job_range_scope_status'
    }
);

PayrollPrecalcJobSchema.index(
    {
        status: 1,
        startedAt: 1
    },
    {
        name: 'idx_payroll_precalc_job_status_started'
    }
);

const PayrollPrecalcJobModel = model('PayrollPrecalcJob', PayrollPrecalcJobSchema);

const PayrollPrecalcSettingsSchema = new Schema(
    {
        team: { type: String, required: true, trim: true },
        company_kod: { type: String, required: true, trim: true },
        ypokatasthma: { type: String, trim: true, default: '' },

        precalcEnabled: { type: Boolean, default: false },
        monthlyRunDay: { type: Number, min: 1, max: 28, default: 2 },
        monthlyRunTime: {
            type: String,
            trim: true,
            default: '02:30',
            match: /^([01]\d|2[0-3]):[0-5]\d$/
        },
        timezone: { type: String, trim: true, default: 'Europe/Athens' },

        periodMode: {
            type: String,
            enum: ['PREVIOUS_MONTH'],
            default: 'PREVIOUS_MONTH'
        },
        scope: {
            type: String,
            enum: ['MONTHLY'],
            default: 'MONTHLY'
        },

        lastRunAt: { type: Date },
        nextRunAt: { type: Date },

        updatedBy: { type: String, trim: true },
        notes: { type: String, trim: true },

        sourceVersion: { type: String, trim: true, default: 'workFactsPrecalc:v1' }
    },
    {
        collection: 'Payroll_Precalc_Settings',
        timestamps: true
    }
);

PayrollPrecalcSettingsSchema.index(
    {
        team: 1,
        company_kod: 1,
        ypokatasthma: 1
    },
    {
        unique: true,
        name: 'uniq_payroll_precalc_settings_company_branch'
    }
);

PayrollPrecalcSettingsSchema.index(
    {
        precalcEnabled: 1,
        nextRunAt: 1
    },
    {
        name: 'idx_payroll_precalc_settings_enabled_next_run'
    }
);

PayrollPrecalcSettingsSchema.index(
    {
        team: 1,
        company_kod: 1,
        precalcEnabled: 1
    },
    {
        name: 'idx_payroll_precalc_settings_company_enabled'
    }
);

const PayrollPrecalcSettingsModel = model(
    'PayrollPrecalcSettings',
    PayrollPrecalcSettingsSchema
);

const PayrollPrecalcSchedulerSlotSchema = new Schema(
    {
        team: { type: String, required: true, trim: true },
        company_kod: { type: String, required: true, trim: true },
        ypokatasthma: { type: String, trim: true, default: 'ALL' },

        slotKey: { type: String, required: true, trim: true },
        slotAt: { type: Date, required: true },
        slotDate: { type: String, required: true, trim: true },
        slotTime: { type: String, required: true, trim: true },
        timezone: { type: String, trim: true, default: 'Europe/Athens' },
        stepMinutes: { type: Number, default: 5 },

        status: {
            type: String,
            enum: ['RESERVED', 'RELEASED', 'CANCELLED'],
            default: 'RESERVED'
        },

        settingId: { type: Schema.Types.ObjectId },
        reservedBy: { type: String, trim: true },
        reservedAt: { type: Date, default: Date.now },

        releasedAt: { type: Date },
        releasedBy: { type: String, trim: true },
        releaseReason: { type: String, trim: true },

        notes: { type: String, trim: true },
        sourceVersion: { type: String, trim: true, default: 'workFactsPrecalc:v1' }
    },
    {
        collection: 'Payroll_Precalc_Scheduler_Slots',
        timestamps: true
    }
);

PayrollPrecalcSchedulerSlotSchema.index(
    { slotKey: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'RESERVED' },
        name: 'idx_payroll_precalc_scheduler_slot_reserved_unique'
    }
);

PayrollPrecalcSchedulerSlotSchema.index(
    {
        status: 1,
        slotAt: 1
    },
    {
        name: 'idx_payroll_precalc_scheduler_slot_status_at'
    }
);

PayrollPrecalcSchedulerSlotSchema.index(
    {
        team: 1,
        company_kod: 1,
        ypokatasthma: 1,
        status: 1
    },
    {
        name: 'idx_payroll_precalc_scheduler_slot_target_status'
    }
);

const PayrollPrecalcSchedulerSlotModel = model(
    'PayrollPrecalcSchedulerSlot',
    PayrollPrecalcSchedulerSlotSchema
);

const AstheneiesSchema = new Schema({
    team: { type: String, trim: true },
    company_kod: { type: String, trim: true },
    kodikos: { type: String, trim: true },
    xrhsh: { type: String, trim: true },
    periodos: { type: String, trim: true },
    apo_hmeromhnia_01: { type: Date },
    eos_hmeromhnia_01: { type: Date },
    idios_logos_01: { type: Boolean, default: false },
    days_less_3_01: { type: Number, default: 0 },
    days_greater_3_01: { type: Number, default: 0 },
    synolo_astheneias_01: { type: Number, default: 0 },
    adeia_kyhshs_loxeias_01: { type: Boolean, default: false },
    epidothsh_efka_01: { type: Number, default: 0 },
    apodoxes_astheneias_01: { type: Number, default: 0 },
    eidos_astheneias_01: { type: String, trim: true },
    apo_hmeromhnia_02: { type: Date },
    eos_hmeromhnia_02: { type: Date },
    idios_logos_02: { type: Boolean, default: false },
    days_less_3_02: { type: Number, default: 0 },
    days_greater_3_02: { type: Number, default: 0 },
    synolo_astheneias_02: { type: Number, default: 0 },
    adeia_kyhshs_loxeias_02: { type: Boolean, default: false },
    epidothsh_efka_02: { type: Number, default: 0 },
    apodoxes_astheneias_02: { type: Number, default: 0 },
    eidos_astheneias_02: { type: String, trim: true },
    apo_hmeromhnia_03: { type: Date },
    eos_hmeromhnia_03: { type: Date },
    idios_logos_03: { type: Boolean, default: false },
    days_less_3_03: { type: Number, default: 0 },
    days_greater_3_03: { type: Number, default: 0 },
    synolo_astheneias_03: { type: Number, default: 0 },
    adeia_kyhshs_loxeias_03: { type: Boolean, default: false },
    epidothsh_efka_03: { type: Number, default: 0 },
    apodoxes_astheneias_03: { type: Number, default: 0 },
    eidos_astheneias_03: { type: String, trim: true },
    apo_hmeromhnia_04: { type: Date },
    eos_hmeromhnia_04: { type: Date },
    idios_logos_04: { type: Boolean, default: false },
    days_less_3_04: { type: Number, default: 0 },
    days_greater_3_04: { type: Number, default: 0 },
    synolo_astheneias_04: { type: Number, default: 0 },
    adeia_kyhshs_loxeias_04: { type: Boolean, default: false },
    epidothsh_efka_04: { type: Number, default: 0 },
    apodoxes_astheneias_04: { type: Number, default: 0 },
    eidos_astheneias_04: { type: String, trim: true },
    apo_hmeromhnia_05: { type: Date },
    eos_hmeromhnia_05: { type: Date },
    idios_logos_05: { type: Boolean, default: false },
    days_less_3_05: { type: Number, default: 0 },
    days_greater_3_05: { type: Number, default: 0 },
    synolo_astheneias_05: { type: Number, default: 0 },
    adeia_kyhshs_loxeias_05: { type: Boolean, default: false },
    epidothsh_efka_05: { type: Number, default: 0 },
    apodoxes_astheneias_05: { type: Number, default: 0 },
    eidos_astheneias_05: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now() },
    updatedAt: { type: Date, default: Date.now() }
});
const AstheneiesModel = model('Astheneies', AstheneiesSchema);

const AdeiesSchema = new Schema({
    team: { type: String, trim: true },
    company_kod: { type: String, trim: true },
    kodikos: { type: String, trim: true },
    xrhsh: { type: String, trim: true },
    periodos: { type: String, trim: true },
    apo_hmeromhnia_adeias_01: { type: Date },
    apo_hmeromhnia_adeias_02: { type: Date },
    apo_hmeromhnia_adeias_03: { type: Date },
    apo_hmeromhnia_adeias_04: { type: Date },
    apo_hmeromhnia_adeias_05: { type: Date },
    eos_hmeromhnia_adeias_01: { type: Date },
    eos_hmeromhnia_adeias_02: { type: Date },
    eos_hmeromhnia_adeias_03: { type: Date },
    eos_hmeromhnia_adeias_04: { type: Date },
    eos_hmeromhnia_adeias_05: { type: Date },
    hmeres_adeias_01: { type: Number, default: 0 },
    hmeres_adeias_02: { type: Number, default: 0 },
    hmeres_adeias_03: { type: Number, default: 0 },
    hmeres_adeias_04: { type: Number, default: 0 },
    hmeres_adeias_05: { type: Number, default: 0 },
    eidos_adeias_01: { type: String, trim: true },
    eidos_adeias_02: { type: String, trim: true },
    eidos_adeias_03: { type: String, trim: true },
    eidos_adeias_04: { type: String, trim: true },
    eidos_adeias_05: { type: String, trim: true },
    epidoma_adeias_01: { type: Number, default: 0 },
    epidoma_adeias_02: { type: Number, default: 0 },
    epidoma_adeias_03: { type: Number, default: 0 },
    epidoma_adeias_04: { type: Number, default: 0 },
    epidoma_adeias_05: { type: Number, default: 0 },
    apodoxes_adeias_01: { type: Number, default: 0 },
    apodoxes_adeias_02: { type: Number, default: 0 },
    apodoxes_adeias_03: { type: Number, default: 0 },
    apodoxes_adeias_04: { type: Number, default: 0 },
    apodoxes_adeias_05: { type: Number, default: 0 }
});
const AdeiesModel = model('Adeies', AdeiesSchema);
module.exports = {
    ApoysiesModel,
    ApasxolhseisModel,
    ApasxolhseisPeriodFactsModel,
    PayrollPrecalcJobModel,
    PayrollPrecalcSettingsModel,
    PayrollPrecalcSchedulerSlotModel,
    AstheneiesModel,
    AdeiesModel
};
