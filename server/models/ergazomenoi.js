const { Schema: _Schema, model } = require('mongoose');

const Schema = _Schema;

const ErgazomenoiSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },
        kodikos: { type: String, trim: true },
        eponymo: { type: String, trim: true },
        onoma: { type: String, trim: true },
        afm: { type: String, trim: true, length: 9 },
        amka: { type: String, trim: true, length: 11 },
        eponymo_patera: { type: String, trim: true },
        patronymo: { type: String, trim: true },
        eponymo_mhteras: { type: String, trim: true },
        mhtronymo: { type: String, trim: true },
        energos: { type: Boolean, default: false },
        archived: { type: Boolean, default: false },
        fylo: { type: Boolean, default: false },
        doy: { type: String, trim: true },
        typos_taytothtas: { type: String, trim: true },
        adt: { type: String, trim: true },
        hmeromhnia_ekdoshs: { type: Date },
        hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy: { type: Date },
        arxh_ekdoshs: { type: String, trim: true },
        hmeromhnia_gennhshs: { type: Date },
        topos_gennhshs: { type: String, trim: true },
        arithmos_bibliarioy_anhlikoy: { type: String, trim: true },
        email: { type: String, trim: true },
        yphkoothta: { type: String, trim: true },
        eidikh_kathgoria_ergazomenoy: { type: String, trim: true },
        oikogeneiakh_katastash: { type: String, trim: true },
        arithmos_teknon: { type: Number, default: 0 },
        odos: { type: String, trim: true },
        arithmos: { type: String, trim: true },
        tk: { type: String, trim: true },
        thlefono: { type: String, trim: true },
        perifereia: { type: String, trim: true },
        nomos: { type: String, trim: true },
        dhmos: { type: String, trim: true },
        polh: { type: String, trim: true },
        ekpaideytiko_epipedo: { type: String, trim: true },
        forologikh_klimaka: { type: String, trim: true },
        trapeza: { type: String, trim: true },
        iban: { type: String, trim: true },

        hmeromhnia_proslhpshs: { type: Date },
        hmeromhnia_allaghs_symbashs: { type: Date },
        hmeromhnia_allaghs_orarioy_apo: { type: Date },
        hmeromhnia_allaghs_orarioy_eos: { type: Date },

        hmeromhnia_isxyos_oron_ergasias_apo: {
            type: Date
        },

        hmeromhnia_isxyos_oron_ergasias_eos: {
            type: Date
        },

        hmeromhnia_lhxhs_symbashs: { type: Date },
        hmeromhnia_apoxorhshs: { type: Date },
        afora_kataggelia_me_proeidopoihsh: { type: Boolean, default: false },
        hmeromhnia_koinopoihshs_kataggelias: { type: Date },
        mhnes_proeidopoihshs: { type: Number, default: 0 },
        logos_peratosis: { type: String, trim: true },
        parathrhseis_peratosis: { type: String, trim: true },
        afora_daneismo_ergazomenoy: { type: Boolean, default: false },
        typos_daneismoy: { type: String, defalt: null, trim: true },
        hmnia_enarxhs_daneismoy: { type: Date, default: null },
        hmnia_lhxhs_daneismoy: { type: Date, default: null },
        afora_dokimastikh_periodo: { type: Boolean, default: false },
        hmnia_lhxhs_dokimastikhs_periodoy: { type: Date },
        kathestos_apasxolhshs: { type: String, trim: true },
        sxesh_ergasias: { type: String, trim: true },
        proyphresia_se_eth: { type: Number, default: 0 },
        proyphresia_apozhmioshs_se_eth: { type: Number, default: 0 },
        proyphresia_se_mhnes: { type: Number, default: 0 },
        proyphresia_adeias_se_eth: { type: Number, default: 0 },
        synolo_proyphresias_se_eth: { type: Number, default: 0 },
        synolo_proyphresias_se_mhnes: { type: Number, default: 0 },
        misthologiko_klimakio: { type: Number, default: 0 },
        syggeneia: { type: Boolean, default: false },
        syggenikh_sxesh: { type: String, trim: true },
        thesh_eythynhs: { type: String, trim: true },
        eidikh_periptosh: { type: String, trim: true },
        topos_ergasias: { type: Boolean, default: false },
        topos_ergasias_parathrhseis: { type: String, trim: true },
        xronos_katabolhs_apodoxon: { type: String, trim: true },
        efarmostea_sse: { type: Boolean, default: false },
        efarmostea_sse_parathrhseis: { type: String, trim: true },

        plhrhs_apasxolhsh: { type: Boolean, default: false },
        mh_problepsimo_programma: { type: Boolean, default: false },
        hmeres_ores_anaforas: { type: String, trim: true },
        eidopoihsh_prin_thn_anathesh: { type: String, trim: true },
        prothesmia_akyroshs_ths_anatheshs: { type: String, trim: true },
        dieythethsh_ergasias: { type: Boolean, default: false },
        hmnia_enarxhs_dieythethshs_ergasias: { type: Date },
        hmnia_lhxhs_dieythethshs_ergasias: { type: Date },
        hmeres_ergasias_ebdomadas: { type: Number, default: 0 },
        ores_ergasias_ebdomadas: { type: Number, default: 0 },
        mo_oron_hmerhsias_ergasias: { type: Number, default: 0 },
        dialleima_se_lepta: { type: Number, default: 0 },
        dialleima_entos_ektos_orarioy: { type: Boolean, default: false },
        symbatikes_ores_ergasias: { type: Number, default: 0 },
        typos_orarioy: { type: Boolean, default: false },
        synexes_diakekomeno: { type: Boolean, default: false },
        pshfiakh_organosh: { type: Boolean, default: false },
        apasxolhsh_basei_symbashs: { type: String, trim: true },
        karta_ergasias: { type: Boolean, default: false },
        evelikth_proselefsh: { type: Number, default: 0 },
        apasxolhsh_gia_proth_fora: { type: Boolean, default: false },
        ora_enarxhs_proths_foras: { type: String },
        ora_apoxorhshs_proths_foras: { type: String },
        asfalish_me_tekmarta: { type: Boolean, default: false },
        asfalistikh_klash: { type: String, trim: true },
        epoxikos: { type: Boolean, default: false },
        tmhma: { type: String, trim: true },
        eidikothta_erganh: { type: String, trim: true },
        antikeimeno_ergasion: { type: String, trim: true },
        typos_ergazomenon: { type: String, trim: true },
        ypokatasthma: { type: String, trim: true },
        xarakthrismos_ergazomenon: { type: Boolean, default: false },
        eidikothta: { type: String, trim: true },
        diathesimothta: { type: Boolean, default: false },
        enarxh_diathesimothtas: { type: Date },
        lhxh_diathesimothtas: { type: Date },

        foreas_kyrias_asfalishs: { type: String, trim: true },
        foreas_epikoyrikhs_asfalishs: [{ type: String, trim: true }],
        kad_efka: { type: String, trim: true },
        eidikothta_efka: { type: String, trim: true },
        kpk_efka: { type: String, trim: true },
        kpk_efka_basei_symbashs: { type: String, trim: true },
        epa_efka: { type: String, trim: true },
        prosthetes_asfalistikes_apodoxes: { type: String, trim: true },
        meiosh_eisforon_ergazomenon: { type: Boolean, default: false },
        kodikos_meioshs: { type: String, trim: true },
        pososto_asfalismenoy_meioshs: { type: Number, default: 0 },
        pososto_ergodoth_meioshs: { type: Number, default: 0 },
        isxyei_apo_meioshs: { type: Date },
        isxyei_eos_meioshs: { type: Date },
        epidothsh_eisforon_ergodoth: { type: Boolean, default: false },
        kodikos_epidothshs: { type: String, trim: true },
        pososto_asfalismenoy_epidothshs: { type: Number, default: 0 },
        pososto_ergodoth_epidothshs: { type: Number, default: 0 },
        isxyei_apo_epidothshs: { type: Date },
        isxyei_eos_epidothshs: { type: Date },
        meiosh_eisforon_mhteron: { type: Boolean, default: false },
        kodikos_meioshs_eisforon_mhteron: { type: String, trim: true },
        pososto_asfalismenoy_eisforon_mhteron: { type: Number, default: 0 },
        pososto_ergodoth_eisforon_mhteron: { type: Number, default: 0 },
        isxyei_apo_eisforon_mhteron: { type: Date },
        isxyei_eos_eisforon_mhteron: { type: Date },
        palios_neos: { type: Boolean, default: false },
        amoibetai_me_sse: { type: Boolean, default: false },

        epidoma_anergias: { type: Boolean, default: false },
        dypa: { type: String, trim: true },
        arithmos_deltioy_anergias: { type: String, trim: true },
        systatiko_shmeioma: { type: Boolean, default: false },
        topothethsh_me_programma: { type: Boolean, default: false },
        ypoxreotikh_ek_toy_nomoy_katartish: { type: Boolean, default: false },
        programma_dypa: { type: String, trim: true },
        egkritikh_apofash_dypa: { type: String, trim: true },
        hmeromhnia_enarxhs_programmatos: { type: Date },
        hmeromhnia_lhxhs_programmatos: { type: Date },
        antikatastash_ergazomenoy: { type: Boolean, default: false },
        afm_antikatastath: { type: String, trim: true, length: 9 },
        amka_antikatastath: { type: String, trim: true, length: 11 },

        kentro_kostoys_1: { type: String, trim: true },
        pososto_apasxolhshs_kk1: { type: Number, default: 0 },
        kentro_kostoys_2: { type: String, trim: true },
        pososto_apasxolhshs_kk2: { type: Number, default: 0 },
        kentro_kostoys_3: { type: String, trim: true },
        pososto_apasxolhshs_kk3: { type: Number, default: 0 },
        kentro_kostoys_4: { type: String, trim: true },
        pososto_apasxolhshs_kk4: { type: Number, default: 0 },

        symbash: { type: String, trim: true },
        kathgoria_symbashs: { type: String, trim: true },
        eidikothta_symbashs: { type: String, trim: true },
        stoixeio_symbashs_01: { type: String, trim: true },
        poso_symbashs_01: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_01: { type: Number, default: 0 },
        stoixeio_symbashs_02: { type: String, trim: true },
        poso_symbashs_02: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_02: { type: Number, default: 0 },
        stoixeio_symbashs_03: { type: String, trim: true },
        poso_symbashs_03: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_03: { type: Number, default: 0 },
        stoixeio_symbashs_04: { type: String, trim: true },
        poso_symbashs_04: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_04: { type: Number, default: 0 },
        stoixeio_symbashs_05: { type: String, trim: true },
        poso_symbashs_05: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_05: { type: Number, default: 0 },
        stoixeio_symbashs_06: { type: String, trim: true },
        poso_symbashs_06: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_06: { type: Number, default: 0 },
        stoixeio_symbashs_07: { type: String, trim: true },
        poso_symbashs_07: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_07: { type: Number, default: 0 },
        stoixeio_symbashs_08: { type: String, trim: true },
        poso_symbashs_08: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_08: { type: Number, default: 0 },
        stoixeio_symbashs_09: { type: String, trim: true },
        poso_symbashs_09: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_09: { type: Number, default: 0 },
        stoixeio_symbashs_10: { type: String, trim: true },
        poso_symbashs_10: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_10: { type: Number, default: 0 },
        stoixeio_symbashs_11: { type: String, trim: true },
        poso_symbashs_11: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_11: { type: Number, default: 0 },
        stoixeio_symbashs_12: { type: String, trim: true },
        poso_symbashs_12: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_12: { type: Number, default: 0 },
        stoixeio_symbashs_13: { type: String, trim: true },
        poso_symbashs_13: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_13: { type: Number, default: 0 },
        stoixeio_symbashs_14: { type: String, trim: true },
        poso_symbashs_14: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_14: { type: Number, default: 0 },
        stoixeio_symbashs_15: { type: String, trim: true },
        poso_symbashs_15: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_15: { type: Number, default: 0 },
        synolo_symbashs: { type: Number, default: 0 },
        synolo_symbashs_basei_oron_ergasias: { type: Number, default: 0 },
        nomimosMisthos: { type: Number, default: 0 },
        nomimoHmeromisthio: { type: Number, default: 0 },
        nomimoOromisthio: { type: Number, default: 0 },
        pragmatikosMisthos: { type: Number, default: 0 },
        pragmatikoHmeromisthio: { type: Number, default: 0 },
        pragmatikoOromisthio: { type: Number, default: 0 },

        krathsh_01: { type: String, trim: true },
        ama_krathshs_01: { type: String, trim: true },
        krathsh_02: { type: String, trim: true },
        ama_krathshs_02: { type: String, trim: true },
        krathsh_03: { type: String, trim: true },
        ama_krathshs_03: { type: String, trim: true },
        krathsh_04: { type: String, trim: true },
        ama_krathshs_04: { type: String, trim: true },
        krathsh_05: { type: String, trim: true },
        ama_krathshs_05: { type: String, trim: true },
        krathsh_06: { type: String, trim: true },
        ama_krathshs_06: { type: String, trim: true },
        krathsh_07: { type: String, trim: true },
        ama_krathshs_07: { type: String, trim: true },
        epikoyrikh_xoris_efka: { type: String, trim: true },
        astheneia_xoris_efka: { type: String, trim: true },
        idiothta_sto_ergo_39: { type: String, trim: true },

        adeia_diamonhs_me_amesh_prosbash_gia_ergasia: { type: Boolean, default: false },
        eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: { type: String, trim: true },
        arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: { type: String, trim: true },
        hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia: { type: Date },
        adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia: { type: Boolean, default: false },
        eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: { type: String, trim: true },
        arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: { type: String, trim: true },
        hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia: { type: Date },
        adeia_eisodoy_gia_epoxikh_apasxolhsh: { type: Boolean, default: false },
        arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh: { type: String, trim: true },
        apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh: { type: Date },
        eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh: { type: Date },

        epaggelmatikh_katartish: { type: Boolean, default: false },
        antikeimeno_katartishs: { type: String, trim: true },
        thematiko_pedio: { type: String, trim: true },
        thematikh_enothta: { type: String, trim: true },
        foreas_katartishs: { type: String, trim: true },
        katartish_apo: { type: Date },
        katartish_eos: { type: Date },
        diarkeia_se_ores: { type: Number, default: 0 },
        etos_apokthshs: { type: Number, default: 0 },
        allh_glossa_01: { type: String, trim: true },
        allh_glossa_02: { type: String, trim: true },
        allh_glossa_03: { type: String, trim: true },
        allh_glossa_04: { type: String, trim: true },
        gnosh_ypologiston: { type: Boolean, default: false },
        allo_proson: { type: String, trim: true },

        symfonhtheis_misthos_genikos: { type: Number, default: 0 },
        symfonhtheis_misthos_apasxolhseis: { type: Number, default: 0 },
        paketo_apodoxon: { type: Number, default: 0 },
        mhniaia_repo: { type: Number, default: 0 },
        ypologismos_foroy: { type: Boolean, default: false },
        oros_sth_symbash_n_3986_2011: { type: Boolean, default: false },
        oysiodeis_oroi: { type: String, trim: true },
        kataggelia_katopin_eggrafhs_proeidopoihshs: { type: Boolean, default: false },
        hmeromhnia_eggrafhs_proeidopoihshs: { type: Date },
        omadikh_apolysh: { type: Boolean, default: false },
        arithmos_apofashs_gia_omadikh_apolysh: { type: String, trim: true },
        hmeromhnia_apofashs_gia_omadikh_apolysh: { type: Date },
        epidosh_me_dikastiko_epimelhth: { type: Boolean, default: false },
        hmeromhnia_epidoshs: { type: Date },
        hmeromhnia_katabolhs_ths_apozhmioshs: { type: Date },
        shmeioseis_apozhmioshs: { type: String, trim: true },
        parathrhseis: { type: String, trim: true },
        bibliario_anhlikoy_path: { type: String, default: null, trim: true },
        arxeio_nomimopoihtikon_eggrafon_path: { type: String, default: null, trim: true },
        arxeio_apodoxhs_oysiodon_oron_path: { type: String, default: null, trim: true },
        arxeio_apodoxhs_oron_atomikhs_symbashs_path: { type: String, default: null, trim: true },
        arxeio_symbashs_daneismoy_path: { type: String, default: null, trim: true },
        e3_xml_path: { type: String, default: null, index: true },
        bibliario_anhlikoy_base64: { type: String, default: null },
        arxeio_nomimopoihtikon_eggrafon_base64: { type: String, default: null },
        arxeio_apodoxhs_oysiodon_oron_base64: { type: String, default: null },
        arxeio_apodoxhs_oron_atomikhs_symbashs_base64: { type: String, default: null },
        arxeio_symbashs_daneismoy_base64: { type: String, default: null, trim: true },
        typos_metabolhs: [{ type: String, trim: true }],
        typos_metabolhs_table: { type: String, default: '[]' },
        allo_parathrhseis: { type: String, default: null, trim: true },

        createdAt: { type: Date, default: Date.now() },
        updatedAt: { type: Date, default: Date.now() }
    },
    {
        timestamps: true,
        collection: 'Ergazomenoi'
    }
);

ErgazomenoiSchema.index(
    { team: 1, company_kod: 1, ypokatasthma: 1, kodikos: 1 },
    { partialFilterExpression: { archived: false, energos: true } }
);

// 2. Ανενεργοί / αρχειοθετημένοι (για ιστορικό, admin προβολή)
ErgazomenoiSchema.index(
    { team: 1, company_kod: 1, kodikos: 1 },
    { partialFilterExpression: { archived: true } }
);

const ErgazomenoiModel = model('Ergazomenoi', ErgazomenoiSchema);

const ProdhlomenaOrariaSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },
        ypokatasthma: { type: String, trim: true },
        kodikos: { type: String, trim: true },
        hmeromhnia: { type: Date },
        kathgoria_ergasias: { type: String, trim: true },
        apo_ora_01: { type: String },
        eos_ora_01: { type: String },
        dialleima_apo_ora_01: { type: String },
        dialleima_eos_ora_01: { type: String },
        apo_ora_02: { type: String },
        eos_ora_02: { type: String },
        dialleima_apo_ora_02: { type: String },
        dialleima_eos_ora_02: { type: String },
        apo_ora_03: { type: String },
        eos_ora_03: { type: String },
        dialleima_apo_ora_03: { type: String },
        dialleima_eos_ora_03: { type: String },
        repo: { type: Boolean, default: false },
        argia: { type: Boolean, default: false },
        perigrafh_argias: { type: String, trim: true },
        adeia: { type: Boolean, default: false },
        kathgoria_adeias: { type: String, trim: true },
        astheneia: { type: Boolean, default: false },
        ores_ergasias: { type: Number, default: 0 },
        cards_apo_ora_01: { type: String },
        cards_eos_ora_01: { type: String },
        cards_apo_ora_02: { type: String },
        cards_eos_ora_02: { type: String },
        cards_apo_ora_03: { type: String },
        cards_eos_ora_03: { type: String },
        check_ergasia: { type: Boolean, default: false },
        cards_ores_ergasias: { type: Number, default: 0 },
        apo_ora_01_apologistika: { type: String },
        eos_ora_01_apologistika: { type: String },
        apo_ora_02_apologistika: { type: String },
        eos_ora_02_apologistika: { type: String },
        apo_ora_03_apologistika: { type: String },
        eos_ora_03_apologistika: { type: String },
        apologistiko_biblio: { type: Boolean, default: false },
        kathgoria_ergasias_apologistika: { type: String, trim: true },
        ores_ergasias_apologistika: { type: Number, default: 0 },
        ores_nyxtas_apologistika: { type: Number, default: 0 },
        ores_argion_prosayxhsh_apologistika: { type: Number, default: 0 },
        ores_argion_ergasia_apologistika: { type: Number, default: 0 },
        ores_yperergasias_apologistika: { type: Number, default: 0 },
        ores_yperergasias_nyxtas_apologistika: { type: Number, default: 0 },
        ores_yperergasias_argion_apologistika: { type: Number, default: 0 },
        ores_yperergasias_argion_nyxtas_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_nyxtas_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_argion_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_argion_nyxtas_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_nyxtas_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_argion_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: { type: Number, default: 0 },
        ores_prostheths_ergasias_apologistika: { type: Number, default: 0 },
        repo_apologistika: { type: Boolean, default: false },
        adeia_apologistika: { type: Boolean, default: false },
        kathgoria_adeias_apologistika: { type: String, trim: true },
        astheneia_apologistika: { type: Boolean, default: false },
        kyriakes_apologistika: { type: Boolean, default: false },
        ores_apoysias_apologistika: { type: Number, default: 0 },
        apo_ora_yperories: { type: String },
        eos_ora_yperories: { type: String },
        is_locked: { type: Boolean, default: false },
        locked_by: { type: String, trim: true },
        locked_at: { type: Date },
        unlocked_by: { type: String, trim: true },
        unlocked_at: { type: Date }
    },
    {
        collection: 'Prodhlomena_Oraria'
    }
);

ProdhlomenaOrariaSchema.index({
    team: 1,
    company_kod: 1,
    ypokatasthma: 1,
    kodikos: 1,
    hmeromhnia: 1
});

ProdhlomenaOrariaSchema.index({
    team: 1,
    company_kod: 1,
    hmeromhnia: 1,
    kodikos: 1
});

const ProdhlomenaOrariaModel = model('ProdhlomenaOraria', ProdhlomenaOrariaSchema);

const ProdhlomenaOrariaAuditSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },

        prodhlomena_oraria_id: {
            type: Schema.Types.ObjectId,
            ref: 'ProdhlomenaOraria'
        },

        kodikos: { type: String, trim: true },
        ypokatasthma: { type: String, trim: true },
        hmeromhnia: { type: Date },

        changedBy: { type: String, trim: true },
        changedAt: { type: Date, default: Date.now },

        reason: { type: String, trim: true },

        oldValues: { type: Object, default: {} },
        newValues: { type: Object, default: {} }
    },
    {
        collection: 'Prodhlomena_Oraria_Audit'
    }
);

ProdhlomenaOrariaAuditSchema.index({
    team: 1,
    company_kod: 1,
    prodhlomena_oraria_id: 1,
    changedAt: -1
});

const ProdhlomenaOrariaAuditModel = model('ProdhlomenaOrariaAudit', ProdhlomenaOrariaAuditSchema);

const ProdhlomenaOrariaDeviationsSchema = new Schema(
    {
        team: { type: String, trim: true, index: true },
        company_kod: { type: String, trim: true, index: true },

        period_apo: { type: Date, index: true },
        period_eos: { type: Date, index: true },

        ypokatasthma: { type: String, trim: true, index: true },
        kodikos: { type: String, trim: true, index: true },
        eponymo: { type: String, trim: true },
        onoma: { type: String, trim: true },

        week_apo: { type: Date, index: true },
        week_eos: { type: Date, index: true },

        expected_repo: { type: Number, default: 0 },
        actual_repo: { type: Number, default: 0 },

        // Όταν αλλάζουν οι όροι εργασίας μέσα στην ίδια εβδομάδα,
        // ο έλεγχος ρεπό χρησιμοποιεί το profile που ισχύει το Σάββατο.
        profile_changed_inside_week: { type: Boolean, default: false },
        excess_repo: { type: Number, default: 0 },

        effective_mhniaia_repo: { type: Number, default: 0 },
        effective_typos_apasxolhshs: { type: String, trim: true, default: '' },
        effective_profile_source: { type: String, trim: true, default: '' },
        effective_profile_date: { type: Date },
        effective_profile_istoriko_id: {
            type: Schema.Types.ObjectId,
            ref: 'IstorikoProslhpseonAllagon'
        },

        previous_mhniaia_repo: { type: Number, default: 0 },
        previous_typos_apasxolhshs: { type: String, trim: true, default: '' },
        previous_profile_source: { type: String, trim: true, default: '' },
        previous_profile_date: { type: Date },
        previous_profile_istoriko_id: {
            type: Schema.Types.ObjectId,
            ref: 'IstorikoProslhpseonAllagon'
        },

        deviation_type: { type: String, trim: true, default: '' },
        note: { type: String, trim: true, default: '' },

        created_by: { type: String, trim: true },
        created_by_user: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true,
        collection: 'Prodhlomena_Oraria_Deviations'
    }
);

ProdhlomenaOrariaDeviationsSchema.index({ team: 1, company_kod: 1, period_apo: 1, period_eos: 1 });
ProdhlomenaOrariaDeviationsSchema.index({
    team: 1,
    company_kod: 1,
    kodikos: 1,
    week_apo: 1,
    week_eos: 1
});

const ProdhlomenaOrariaDeviationsModel = model(
    'ProdhlomenaOrariaDeviations',
    ProdhlomenaOrariaDeviationsSchema
);

const OrariaFromErganhSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },
        kodikos: { type: String, trim: true },
        hmeromhnia: { type: Date },
        kathgoria_ergasias: { type: String, trim: true },
        apo_ora_01: { type: String },
        eos_ora_01: { type: String },
        apo_ora_02: { type: String },
        eos_ora_02: { type: String },
        apo_ora_03: { type: String },
        eos_ora_03: { type: String }
    },
    {
        collection: 'Oraria_Apo_Erganh'
    }
);

OrariaFromErganhSchema.index(
    {
        team: 1,
        company_kod: 1,
        kodikos: 1,
        hmeromhnia: 1
    },
    { unique: false }
);

const OrariaFromErganhModel = model('OrariaFromErganh', OrariaFromErganhSchema);

const OrariaFromCardsSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },
        kodikos: { type: String, trim: true },
        hmeromhnia: { type: Date },
        kathgoria_ergasias: { type: String, trim: true },
        apo_ora_01: { type: String },
        eos_ora_01: { type: String },
        apo_ora_02: { type: String },
        eos_ora_02: { type: String },
        apo_ora_03: { type: String },
        eos_ora_03: { type: String }
    },
    {
        collection: 'Oraria_Apo_Kartes'
    }
);

OrariaFromCardsSchema.index(
    {
        team: 1,
        company_kod: 1,
        kodikos: 1,
        hmeromhnia: 1
    },
    { unique: false }
);

const OrariaFromCardsModel = model('OrariaFromCards', OrariaFromCardsSchema);

const OrariaApologistikaSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },
        kodikos: { type: String, trim: true },
        dialleima: { type: String, trim: true },
        entos_ektos: { type: Boolean, default: false },
        evelikth_proseleysh: { type: Number, default: 0 },
        hmeromhnia: { type: Date },
        kathgoria_ergasias: { type: String, trim: true },
        apo_ora_01_oraria: { type: String },
        eos_ora_01_oraria: { type: String },
        apo_ora_02_oraria: { type: String },
        eos_ora_02_oraria: { type: String },
        apo_ora_03_oraria: { type: String },
        eos_ora_03_oraria: { type: String },
        dialleima_apo_ora_01_oraria: { type: String },
        dialleima_eos_ora_01_oraria: { type: String },
        dialleima_apo_ora_02_oraria: { type: String },
        dialleima_eos_ora_02_oraria: { type: String },
        dialleima_apo_ora_03_oraria: { type: String },
        dialleima_eos_ora_03_oraria: { type: String },
        repo_oraria: { type: Boolean, default: false },
        adeia_oraria: { type: Boolean, default: false },
        astheneia_oraria: { type: Boolean, default: false },
        argia_oraria: { type: Boolean, default: false },
        perigrafh_argias_oraria: { type: String, trim: true },
        kathgoria_adeias_oraria: { type: String, trim: true },
        apo_ora_01_cards: { type: String },
        eos_ora_01_cards: { type: String },
        apo_ora_02_cards: { type: String },
        eos_ora_02_cards: { type: String },
        apo_ora_03_cards: { type: String },
        eos_ora_03_cards: { type: String },
        dialleima_apo_ora_01_cards: { type: String },
        dialleima_eos_ora_01_cards: { type: String },
        dialleima_apo_ora_02_cards: { type: String },
        dialleima_eos_ora_02_cards: { type: String },
        dialleima_apo_ora_03_cards: { type: String },
        dialleima_eos_ora_03_cards: { type: String },
        apo_ora_01_apologistika: { type: String },
        eos_ora_01_apologistika: { type: String },
        apo_ora_02_apologistika: { type: String },
        eos_ora_02_apologistika: { type: String },
        apo_ora_03_apologistika: { type: String },
        eos_ora_03_apologistika: { type: String },
        dialleima_apo_ora_01_apologistika: { type: String },
        dialleima_eos_ora_01_apologistika: { type: String },
        dialleima_apo_ora_02_apologistika: { type: String },
        dialleima_eos_ora_02_apologistika: { type: String },
        dialleima_apo_ora_03_apologistika: { type: String },
        dialleima_eos_ora_03_apologistika: { type: String },
        repo_apologistika: { type: Boolean, default: false },
        adeia_apologistika: { type: Boolean, default: false },
        astheneia_apologistika: { type: Boolean, default: false },
        argia_apologistika: { type: Boolean, default: false },
        perigrafh_argias_apologistika: { type: String, trim: true },
        kathgoria_adeias_apologistika: { type: String, trim: true },
        ores_ergasias_apologistika: { type: Number, default: 0 },
        ores_nyxtas_apologistika: { type: Number, default: 0 },
        ores_argion_apologistika: { type: Number, default: 0 },
        ores_yperergasias_apologistika: { type: Number, default: 0 },
        ores_yperergasias_nyxtas_apologistika: { type: Number, default: 0 },
        ores_yperergasias_argion_apologistika: { type: Number, default: 0 },
        ores_yperergasias_argion_nyxtas_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_nyxtas_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_argion_apologistika: { type: Number, default: 0 },
        ores_nominhs_yperorias_argion_nyxtas_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_nyxtas_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_argion_apologistika: { type: Number, default: 0 },
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: { type: Number, default: 0 },
        apologistiko_biblio: { type: Boolean, default: false }
    },
    {
        collection: 'Oraria_Apologistika'
    }
);

OrariaApologistikaSchema.index(
    {
        team: 1,
        company_kod: 1,
        kodikos: 1,
        hmeromhnia: 1
    },
    { unique: false }
);

const OrariaApologistikaModel = model('OrariaApologistika', OrariaApologistikaSchema);

const IstorikoProslhpseonAllagonSchema = new Schema(
    {
        team: { type: String, trim: true },
        company_kod: { type: String, trim: true },
        kodikos: { type: String, trim: true },
        aa_eggrafhs: { type: String, trim: true },
        hmeromhnia_proslhpshs: { type: Date },
        hmeromhnia_allaghs_symbashs: { type: Date },
        hmeromhnia_allaghs_orarioy_apo: { type: Date },
        hmeromhnia_allaghs_orarioy_eos: { type: Date },

        hmeromhnia_isxyos_oron_ergasias_apo: {
            type: Date
        },

        hmeromhnia_isxyos_oron_ergasias_eos: {
            type: Date
        },

        hmeromhnia_lhxhs_symbashs: { type: Date },
        hmeromhnia_apoxorhshs: { type: Date },
        afora_proslhpsh: { type: Boolean, default: false },
        kathestos_apasxolhshs: { type: String, trim: true },
        hmeres_ergasias_ebdomadas: {
            type: Number,
            default: 0
        },

        ores_ergasias_ebdomadas: {
            type: Number,
            default: 0
        },

        mo_oron_hmerhsias_ergasias: {
            type: Number,
            default: 0
        },

        // Π.χ. PLHRHS, MERIKH, EK_PERITROPHS
        typos_apasxolhshs: {
            type: String,
            trim: true,
            default: ''
        },

        // Π.χ. 5ήμερο, 6ήμερο κλπ — βοηθάει σε debugging/reports
        typos_ebdomadas: {
            type: String,
            trim: true,
            default: ''
        },

        // Για να ξέρουμε ότι η συγκεκριμένη εγγραφή αφορά αλλαγή ωραρίου/ημερών εργασίας
        afora_allagh_oron_ergasias: {
            type: Boolean,
            default: false
        },

        mhniaia_repo: {
            type: Number,
            default: 0
        },

        // Για να ξέρουμε ποια εγγραφή χρησιμοποιήθηκε σαν profile αλλαγής
        // στον έλεγχο απασχολήσεων / deviations.
        employment_profile_source: {
            type: String,
            trim: true,
            default: ''
        },

        misthologiko_klimakio: { type: Number, default: 0 },
        symbash: { type: String, trim: true },
        kathgoria_symbashs: { type: String, trim: true },
        eidikothta_symbashs: { type: String, trim: true },
        stoixeio_symbashs_01: { type: String, trim: true },
        poso_symbashs_01: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_01: { type: Number, default: 0 },
        stoixeio_symbashs_02: { type: String, trim: true },
        poso_symbashs_02: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_02: { type: Number, default: 0 },
        stoixeio_symbashs_03: { type: String, trim: true },
        poso_symbashs_03: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_03: { type: Number, default: 0 },
        stoixeio_symbashs_04: { type: String, trim: true },
        poso_symbashs_04: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_04: { type: Number, default: 0 },
        stoixeio_symbashs_05: { type: String, trim: true },
        poso_symbashs_05: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_05: { type: Number, default: 0 },
        stoixeio_symbashs_06: { type: String, trim: true },
        poso_symbashs_06: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_06: { type: Number, default: 0 },
        stoixeio_symbashs_07: { type: String, trim: true },
        poso_symbashs_07: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_07: { type: Number, default: 0 },
        stoixeio_symbashs_08: { type: String, trim: true },
        poso_symbashs_08: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_08: { type: Number, default: 0 },
        stoixeio_symbashs_09: { type: String, trim: true },
        poso_symbashs_09: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_09: { type: Number, default: 0 },
        stoixeio_symbashs_10: { type: String, trim: true },
        poso_symbashs_10: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_10: { type: Number, default: 0 },
        stoixeio_symbashs_11: { type: String, trim: true },
        poso_symbashs_11: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_11: { type: Number, default: 0 },
        stoixeio_symbashs_12: { type: String, trim: true },
        poso_symbashs_12: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_12: { type: Number, default: 0 },
        stoixeio_symbashs_13: { type: String, trim: true },
        poso_symbashs_13: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_13: { type: Number, default: 0 },
        stoixeio_symbashs_14: { type: String, trim: true },
        poso_symbashs_14: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_14: { type: Number, default: 0 },
        stoixeio_symbashs_15: { type: String, trim: true },
        poso_symbashs_15: { type: Number, default: 0 },
        poso_symbashs_basei_oron_ergasias_15: { type: Number, default: 0 },
        synolo_symbashs: { type: Number, default: 0 },
        synolo_symbashs_basei_oron_ergasias: { type: Number, default: 0 },
        nomimosMisthos: { type: Number, default: 0 },
        nomimoHmeromisthio: { type: Number, default: 0 },
        nomimoOromisthio: { type: Number, default: 0 },
        pragmatikosMisthos: { type: Number, default: 0 },
        pragmatikoHmeromisthio: { type: Number, default: 0 },
        pragmatikoOromisthio: { type: Number, default: 0 },
        krathsh_01: { type: String, trim: true },
        krathsh_02: { type: String, trim: true },
        krathsh_03: { type: String, trim: true },
        krathsh_04: { type: String, trim: true },
        krathsh_05: { type: String, trim: true },
        krathsh_06: { type: String, trim: true },
        krathsh_07: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now() },
        updatedAt: { type: Date, default: Date.now() }
    },
    {
        collection: 'Istoriko_Proslhpseon_Allagon'
    }
);

const IstorikoProslhpseonAllagonModel = model(
    'IstorikoProslhpseonAllagon',
    IstorikoProslhpseonAllagonSchema
);

const ErgazomenoiErganhSchema = new Schema(
    {
        team: { type: String, trim: true, index: true },
        companykod_object: { type: Schema.Types.ObjectId, ref: 'Companies', index: true },
        companykod: { type: String, trim: true, index: true },

        ergazomenos_object: { type: Schema.Types.ObjectId, ref: 'Ergazomenoi', index: true },
        ergazomenos_kodikos: { type: String, trim: true, index: true },
        ergazomenos_afm: { type: String, trim: true, index: true },
        ergazomenos_eponymo: { type: String, trim: true },
        ergazomenos_onoma: { type: String, trim: true },

        ypokatasthma_object: { type: Schema.Types.ObjectId, ref: 'Ypokatasthmata' },
        ypokatasthma_kodikos: { type: String, trim: true },

        submission_code: { type: String, trim: true, index: true },
        submission_id: { type: Number },
        submission_description: { type: String, trim: true },
        process_code: { type: String, trim: true, index: true },
        process_description: { type: String, trim: true },

        upload_method: { type: String, enum: ['XML', 'REST'], required: true, index: true },
        submission_status: {
            type: String,
            enum: ['SUCCESS', 'FAILED', 'TEMPORARY', 'CANCELLED'],
            required: true,
            index: true
        },
        is_temporary: { type: Boolean, default: false },
        is_final: { type: Boolean, default: false },
        environment: { type: String, trim: true, default: 'trial', index: true },

        protocol: { type: String, trim: true, index: true },
        submit_date_text: { type: String, trim: true },
        submit_date: { type: Date },
        erganh_submission_id: { type: String, trim: true, index: true },

        // ---------------------------------------------------------------------
        // Βοηθητικά πεδία αναφορών / dashboard
        // ---------------------------------------------------------------------
        submission_year: {
            type: Number,
            index: true
        },

        submission_month: {
            type: Number,
            index: true
        },

        submission_day: {
            type: Number,
            index: true
        },

        pdf_s3_key: { type: String, trim: true },
        pdf_s3_url: { type: String, trim: true },
        pdf_relative_path: { type: String, trim: true },
        pdf_filename: { type: String, trim: true },
        pdf_content_type: { type: String, trim: true, default: 'application/pdf' },
        pdf_size_bytes: { type: Number, default: 0 },

        xml_s3_key: { type: String, trim: true },
        xml_s3_url: { type: String, trim: true },
        xml_filename: { type: String, trim: true },

        request_payload: { type: Schema.Types.Mixed },
        erganh_raw_response: { type: Schema.Types.Mixed },
        error_message: { type: String, trim: true },

        created_by_user: { type: Schema.Types.ObjectId, ref: 'User' },
        created_by_username: { type: String, trim: true },
        // ---------------------------------------------------------------------
        // Κατάσταση εγγράφου ΕΡΓΑΝΗ
        // ---------------------------------------------------------------------
        document_status: {
            type: String,
            enum: ['ACTIVE', 'CANCELLED'],
            default: 'ACTIVE',
            index: true
        },

        // ---------------------------------------------------------------------
        // Στοιχεία ακύρωσης υποβολής
        // ---------------------------------------------------------------------
        is_cancelled: {
            type: Boolean,
            default: false,
            index: true
        },

        cancelled_protocol: {
            type: String,
            trim: true,
            index: true
        },

        cancelled_at: {
            type: Date
        },

        cancel_reason: {
            type: String,
            trim: true
        },

        cancelled_by_user: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },

        cancelled_by_username: {
            type: String,
            trim: true
        },

        cancel_raw_response: {
            type: Schema.Types.Mixed
        }
    },
    {
        timestamps: true,
        collection: 'Ergazomenoi_Erganh'
    }
);

ErgazomenoiErganhSchema.index({ team: 1, companykod_object: 1, ergazomenos_object: 1 });
ErgazomenoiErganhSchema.index({ submission_code: 1, protocol: 1, submit_date_text: 1 });
ErgazomenoiErganhSchema.index({ ergazomenos_object: 1, createdAt: -1 });
ErgazomenoiErganhSchema.index({ companykod_object: 1, submission_year: 1, submission_month: 1 });
ErgazomenoiErganhSchema.index({ companykod_object: 1, createdAt: -1 });

const ErgazomenoiErganhModel = model('ErgazomenoiErganh', ErgazomenoiErganhSchema);

module.exports = {
    ErgazomenoiModel,
    ProdhlomenaOrariaModel,
    ProdhlomenaOrariaAuditModel,
    ProdhlomenaOrariaDeviationsModel,
    OrariaFromErganhModel,
    OrariaFromCardsModel,
    OrariaApologistikaModel,
    IstorikoProslhpseonAllagonModel,
    ErgazomenoiErganhModel
};
