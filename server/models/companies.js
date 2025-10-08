const { Schema: _Schema, model } = require("mongoose");

const Schema = _Schema;

const CompaniesSchema = new Schema(
    {
        team: { type: String, required: true, trim: true },
        user_id: { type: String, required: true, trim: true },
        kod: { type: String, required: true, trim: true },
        eponymia: { type: String, required: true, trim: true },
        firstname: { type: String, trim: true },
        fathername: { type: String, trim: true },
        activity: { type: String, trim: true },
        afm: { type: String, trim: true, length: 9 },
        adt: { type: String, trim: true, length: 12 },
        titlos: { type: String, trim: true },
        odos: { type: String, trim: true },
        arithmos: { type: String, trim: true },
        tk: { type: String, trim: true },
        perifereia: { type: String, trim: true },
        nomos: { type: String, trim: true },
        dhmos: { type: String, trim: true },
        polh: { type: String, trim: true },
        thlefono: { type: String, trim: true },
        fax: { type: String, trim: true },
        email: { type: String, trim: true },
        anenergh: { type: Boolean, default: false },
        nomikh_morfh: { type: String, trim: true },
        pararthma_efka: { type: String, trim: true },
        doy_company: { type: String, trim: true },
        tameio1: { type: String, trim: true },
        ame1: { type: String, trim: true },
        tameio2: { type: String, trim: true },
        ame2: { type: String, trim: true },
        tameio3: { type: String, trim: true },
        ame3: { type: String, trim: true },
        tameio4: { type: String, trim: true },
        ame4: { type: String, trim: true },
        kad1: { type: String, trim: true },
        kad2: { type: String, trim: true },
        kad3: { type: String, trim: true },
        kad4: { type: String, trim: true },
        kad5: { type: String, trim: true },
        kad6: { type: String, trim: true },
        texnikos_asfaleias: { type: String, trim: true },
        iatros_ergasias: { type: String, trim: true },
        logisths: { type: String, trim: true },
        doy_logisth: { type: String, trim: true },
        emmesos_ergodoths: { type: String, trim: true },
        nomikh_morfh_emmesoy_ergodoth: { type: String, trim: true },
        diadoxos_ergodoths: { type: String, trim: true },
        nomikh_morfh_diadoxoy_ergodoth: { type: String, trim: true },
        oikodomika: { type: Boolean, default: false },
        doropasxa_apd: { type: Boolean, default: false },
        doroxrist_apd: { type: Boolean, default: false },
        ypologismos_epi_pragmatikoy_oromisthioy: { type: Boolean, default: false },
        keimeno_exoflhshs: { type: String, trim: true },
        users: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        sfragida: String,
        imagePath: { type: String, trim: true },
    },
    {
        timestamps: {
            createdAt: "createdAt",
            updatedAt: "updatedAt",
            currentTime: () => Date.now(), // προαιρετικό: ενιαία πηγή χρόνου
        },
    }
);
const CompaniesModel = model("Companies", CompaniesSchema);

const YpokatasthmataSchema = new Schema({
    team: { type: String, trim: true }, // Το team από το CompaniesModel
    companykod_object: { type: String, trim: true }, // Το company_id από το CompaniesModel
    companykod: { type: String, trim: true }, // Το kod από το CompaniesModel
    kodikos: { type: String, trim: true, length: 4 }, // Ο κωδικός του υποκαταστήματος (αα/εταιρεία)
    perigrafh: { type: String, trim: true },
    odos: { type: String, trim: true },
    arithmos: { type: String, trim: true },
    tk: { type: String, trim: true },
    perifereia: { type: String, trim: true },
    nomos: { type: String, trim: true },
    dhmos: { type: String, trim: true },
    polh: { type: String, trim: true },
    pararthma_efka: { type: String, trim: true },
    drasthriothta: { type: String, trim: true },
    thlefono: { type: String, trim: true },
    fax: { type: String, trim: true },
    email: { type: String, trim: true },
    apasxolhsh5hmeron: { type: Boolean, default: false },
    epoxikothta: { type: Boolean, default: false },
    ap_pinaka: { type: String, trim: true },
    hmnia_katatheshs: { type: Date },
    oikodomika_erga: { type: Boolean, default: false },
    amoe: { type: String, trim: true },
    eidos_ergoy: { type: String, trim: true },
    username_ergoy: { type: String, trim: true },
    password_ergoy: { type: String, trim: true },
    ypergolabia: { type: Boolean, default: false },
    afm_ergolaboy: { type: String, trim: true },
    eponymo_ergolaboy: { type: String, trim: true },
    onoma_ergolaboy: { type: String, trim: true },
    patronymo_ergolaboy: { type: String, trim: true },
    odos_ergolaboy: { type: String, trim: true },
    arithmos_ergolaboy: { type: String, trim: true },
    tk_ergolaboy: { type: String, trim: true },
    polh_ergolaboy: { type: String, trim: true },
    ame_ergolaboy: { type: String, trim: true },
    pararthma_efka_ergolaboy: { type: String, trim: true },
    sepe_ergoy: { type: String, trim: true },
    dypa_ergoy: { type: String, trim: true },
    username_ypergol_ergoy: { type: String, trim: true },
    password_ypergol_ergoy: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now() },
    updatedAt: { type: Date, default: Date.now() },
});
const YpokatasthmataModel = model("Ypokatasthmata", YpokatasthmataSchema);

const NomimoiEkprosopoiSchema = new Schema(
    {
        team: { type: String, trim: true }, // Το team από το CompaniesModel
        companykod_object: { type: String, trim: true }, // Το company_id από το CompaniesModel
        companykod: { type: String, trim: true }, // Το kod από το CompaniesModel
        kodikos: { type: String, trim: true, length: 4 }, // Ο κωδικός του εκπροσώπου (αα/εταιρεία)
        nomiko_prosopo: { type: Boolean, default: false },
        nomikh_morfh: { type: String, trim: true },
        eponymia: { type: String, trim: true },
        onoma: { type: String, trim: true },
        eponymo_patera: { type: String, trim: true },
        onoma_patera: { type: String, trim: true },
        onoma_mhteras: { type: String, trim: true },
        eponymo_syzygoy: { type: String, trim: true },
        onoma_syzygoy: { type: String, trim: true },
        hmnia_gennhshs: { type: Date },
        topos_gennhshs: { type: String, trim: true },
        perifereia: { type: String, trim: true },
        nomos: { type: String, trim: true },
        dhmos: { type: String, trim: true },
        polh: { type: String, trim: true },
        odos: { type: String, trim: true },
        arithmos: { type: String, trim: true },
        tk: { type: String, trim: true },
        thlefono: { type: String, trim: true },
        email: { type: String, trim: true },
        typos_taytothtas: { type: String, trim: true },
        arithmos_taytothtas: { type: String, trim: true },
        hmnia_ekdoshs: { type: Date },
        arxh_ekdoshs: { type: String, trim: true },
        afm: { type: String, trim: true },
        doy: { type: String, trim: true },
        ame: { type: String, trim: true },
        idiothta: { type: String, trim: true },
        hmnia_enarjhs_idiothtas: { type: Date },
    },
    {
        timestamps: {
            createdAt: "createdAt",
            updatedAt: "updatedAt",
            currentTime: () => Date.now(), // προαιρετικό: ενιαία πηγή χρόνου
        },
    }
);
const NomimoiEkprosopoiModel = model("NomimoiEkprosopoi", NomimoiEkprosopoiSchema);

const PasswordsSchema = new Schema({
    team: { type: String, trim: true }, // Το team από το CompaniesModel
    companykod_object: { type: String, trim: true }, // Το company_id από το CompaniesModel
    companykod: { type: String, trim: true }, // Το kod από το CompaniesModel
    kodikos: { type: String, trim: true, length: 4 }, // Ο κωδικός του κωδικού πρόσβασης (αα / εταιρεία)
    perigrafh: { type: String, trim: true },
    username: { type: String, trim: true },
    password: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now() },
    updatedAt: { type: Date, default: Date.now() },
});
const PasswordsModel = model("Passwords", PasswordsSchema);

const AntistoixiseisSchema = new Schema({
    team: { type: String, trim: true },
    companyId: { 
                    type: Schema.Types.ObjectId, 
                    ref: 'Companies' 
               },
    companyKod: { type: String, trim: true }, // Το kod από το CompaniesModel
    krathshId: { 
                    type: Schema.Types.ObjectId, 
                    ref: 'Krathseis' 
               },
    krathshKod: { type: String, trim: true },
    aa_eggrafhs: { type: String, trim: true },
    kpk: { type: String, trim: true }, 
    apo_typos_apodoxon: { type: String, trim: true, length: 3 }, 
    se_typos_apodoxon: { type: String, trim: true, length: 3 }, 
    kad: { type: String, trim: true }, 
    eidikothta: { type: String, trim: true },
    epa: { type: String, trim: true }, 
    createdAt: { type: Date, default: Date.now() },
    updatedAt: { type: Date, default: Date.now() },
});
const AntistoixiseisModel = model("Antistoixiseis", AntistoixiseisSchema);

const BanksPerCompanySchema = new Schema({
    team: { type: String, trim: true }, // Το team από το CompaniesModel
    companykod_object: { type: String, trim: true }, // Το company_id από το CompaniesModel
    companykod: { type: String, trim: true }, // Το kod από το CompaniesModel
    kodikos: { type: String, trim: true }, 
    kodikos_dias: { type: String, trim: true, length: 3 },
    perigrafh: { type: String, trim: true }, 
    logariasmos_1: { type: String, trim: true }, 
    logariasmos_2: { type: String, trim: true }, 
    logariasmos_3: { type: String, trim: true }, 
    createdAt: { type: Date, default: Date.now() },
    updatedAt: { type: Date, default: Date.now() },
});
const BanksPerCompanyModel = model("BanksPerCompany", BanksPerCompanySchema);

module.exports = {  CompaniesModel, 
                    YpokatasthmataModel, 
                    NomimoiEkprosopoiModel, 
                    PasswordsModel,
                    AntistoixiseisModel,
                    BanksPerCompanyModel,
                 };
