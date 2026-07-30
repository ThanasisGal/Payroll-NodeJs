const mongoose = require('mongoose');

class CompanyUpdateValidationError extends Error {
    constructor(fieldName) {
        super(`Μη έγκυρη τιμή στο πεδίο ${fieldName}.`);
        this.name = 'CompanyUpdateValidationError';
        this.code = 'COMPANY_UPDATE_VALIDATION_ERROR';
        this.fieldName = fieldName;
        this.status = 400;
    }
}

class CompanyUsersRequiredError extends Error {
    constructor() {
        super('Πρέπει να επιλεγεί τουλάχιστον ένας χρήστης στη σελίδα «Διάφορα».');
        this.name = 'CompanyUsersRequiredError';
        this.code = 'COMPANY_USERS_REQUIRED';
        this.status = 400;
    }
}

function validationError(fieldName) {
    throw new CompanyUpdateValidationError(fieldName);
}

function normalizeOptionalDate(value, fieldName) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) validationError(fieldName);
        return value;
    }
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        validationError(fieldName);
    }
    const normalized = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(normalized.getTime()) || normalized.toISOString().slice(0, 10) !== value) {
        validationError(fieldName);
    }
    return normalized;
}

function normalizeOptionalNumber(value, fieldName) {
    if (value === null || value === undefined || value === '') return null;
    if ((typeof value !== 'string' && typeof value !== 'number') || !Number.isFinite(Number(value))) {
        validationError(fieldName);
    }
    return Number(value);
}

function normalizeObjectIdArray(value, fieldName) {
    if (!Array.isArray(value)) {
        if (fieldName === 'selectedUsers') throw new CompanyUsersRequiredError();
        validationError(fieldName);
    }
    const normalized = [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
    if (normalized.length === 0 && fieldName === 'selectedUsers') {
        throw new CompanyUsersRequiredError();
    }
    if (!normalized.every((item) => mongoose.isValidObjectId(item))) {
        validationError(fieldName);
    }
    return normalized.map((item) => new mongoose.Types.ObjectId(item));
}

function normalizeCompanyUpdatePayload(formData) {
    const company = {
        eponymia: formData.eponymia,
        firstname: formData.firstName,
        fathername: formData.fatherName,
        activity: formData.activity,
        afm: formData.afm,
        adt: formData.adt,
        titlos: formData.titlos,
        odos: formData.odos,
        arithmos: formData.arithmos,
        tk: formData.tk,
        perifereia: formData.perifereies,
        nomos: formData.nomos,
        dhmos: formData.dhmos,
        polh: formData.polh,
        thlefono: formData.thlefono,
        fax: formData.fax,
        email: formData.email,
        anenergh: formData.anenergh === true,
        nomikh_morfh: formData.nomikhmorfh_stathera,
        pararthma_efka: formData.pararthmaefka_stathera,
        doy_company: formData.doy_stathera,
        tameio1: formData.kodikos_tameioy1,
        tameio2: formData.kodikos_tameioy2,
        tameio3: formData.kodikos_tameioy3,
        tameio4: formData.kodikos_tameioy4,
        ame1: formData.ame1,
        ame2: formData.ame2,
        ame3: formData.ame3,
        ame4: formData.ame4,
        kad1: formData.koddrast1,
        kad2: formData.koddrast2,
        kad3: formData.koddrast3,
        kad4: formData.koddrast4,
        kad5: formData.koddrast5,
        kad6: formData.koddrast6,
        texnikos_asfaleias: formData.kod_ta,
        iatros_ergasias: formData.kod_ia,
        logisths: formData.kod_lo,
        doy_logisth: formData.doy_logisths,
        emmesos_ergodoths: formData.kod_em_erg,
        diadoxos_ergodoths: formData.kod_diad_erg,
        oikodomika: formData.oikodomika === true,
        doropasxa_apd: formData.doropasxa_apd === true,
        doroxrist_apd: formData.doroxrist_apd === true,
        ypologismos_epi_pragmatikoy_oromisthioy:
            formData.ypologismos_epi_pragmatikoy_oromisthioy === true,
        apasxolhsh_kata_tis_argies: formData.apasxolhsh_kata_tis_argies === true,
        leitoyrgia_stis_mh_ypoxreotikes_argies:
            formData.leitoyrgia_stis_mh_ypoxreotikes_argies === true,
        apousies_epireazoun_asfalistikes_hmeres:
            formData.apousies_epireazoun_asfalistikes_hmeres === true,
        apoysies_meionoyn_apodoxes: formData.apoysies_meionoyn_apodoxes === true,
        hmeromhnia_payshs_polyetias_apo: normalizeOptionalDate(
            formData.hmeromhnia_payshs_polyetias_apo,
            'hmeromhnia_payshs_polyetias_apo'
        ),
        hmeromhnia_payshs_polyetias_eos: normalizeOptionalDate(
            formData.hmeromhnia_payshs_polyetias_eos,
            'hmeromhnia_payshs_polyetias_eos'
        ),
        xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta: normalizeOptionalNumber(
            formData.xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta,
            'xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta'
        ),
        tropos_ypologismoy_pragmatikoy_oromisthioy:
            formData.tropos_ypologismoy_pragmatikoy_oromisthioy,
        keimeno_exoflhshs: formData.keimeno_exoflhshs,
        users: normalizeObjectIdArray(formData.selectedUsers, 'selectedUsers')
    };
    if (formData.sfragida) company.sfragida = formData.sfragida;

    const relatedOperations = [];
    const addRelatedOperation = (code, modelKey, stage, payload) => {
        const normalizedCode = String(code ?? '').trim().toUpperCase();
        if (!normalizedCode) return;
        relatedOperations.push({ modelKey, stage, kod: normalizedCode, payload });
    };

    if (String(formData.kod_ta ?? '').trim()) {
        addRelatedOperation(formData.kod_ta, 'texnikosAsfaleias', 'TEXNIKOS_ASFALEIAS_UPSERT', {
            eponymo: formData.eponymo_ta,
            onoma: formData.onoma_ta,
            afm: formData.afm_ta,
            dieythynsh: formData.dieythynsh_ta,
            thlefono: formData.thlefono_ta,
            ores: normalizeOptionalNumber(formData.ores_ta, 'ores_ta'),
            ap_katatheshs: formData.ap_katatheshs_ta,
            hmnia_katatheshs: normalizeOptionalDate(
                formData.hmnia_katatheshs_ta,
                'hmnia_katatheshs_ta'
            ),
            isxyei_eos: normalizeOptionalDate(formData.isxyei_eos_ta, 'isxyei_eos_ta')
        });
    }
    if (String(formData.kod_ia ?? '').trim()) {
        addRelatedOperation(formData.kod_ia, 'iatrosErgasias', 'IATROS_ERGASIAS_UPSERT', {
            eponymo: formData.eponymo_ia,
            onoma: formData.onoma_ia,
            afm: formData.afm_ia,
            dieythynsh: formData.dieythynsh_ia,
            thlefono: formData.thlefono_ia,
            ores: normalizeOptionalNumber(formData.ores_ia, 'ores_ia'),
            ap_katatheshs: formData.ap_katatheshs_ia,
            hmnia_katatheshs: normalizeOptionalDate(
                formData.hmnia_katatheshs_ia,
                'hmnia_katatheshs_ia'
            ),
            isxyei_eos: normalizeOptionalDate(formData.isxyei_eos_ia, 'isxyei_eos_ia')
        });
    }
    if (String(formData.kod_lo ?? '').trim()) {
        addRelatedOperation(formData.kod_lo, 'logisths', 'LOGISTHS_UPSERT', {
            eponymo: formData.eponymo_lo,
            onoma: formData.onoma_lo,
            afm: formData.afm_lo,
            dieythynsh: formData.dieythynsh_lo,
            thlefono: formData.thlefono_lo,
            doy: formData.doy_logisths,
            arithmos_adeias: formData.arithmos_adeias_lo,
            kathgoria_adeias: formData.kathgoria_adeias_lo
        });
    }
    if (String(formData.kod_em_erg ?? '').trim()) {
        addRelatedOperation(
            formData.kod_em_erg,
            'emmesosErgodoths',
            'EMMESOS_ERGODOTHS_UPSERT',
            {
                eponymo: formData.eponymo_em_erg,
                onoma: formData.onoma_em_erg,
                dieythynsh: formData.dieythynsh_em_erg,
                thlefono: formData.thlefono_em_erg,
                afm: formData.afm_em_erg,
                titlos: formData.titlos_em_erg,
                nomikhMorfh: formData.nomikhmorfh_emmesoyErgodoth,
                drasthriothta: formData.drasthriothta_em_erg,
                email: formData.email_em_erg,
                daneismosApo: normalizeOptionalDate(
                    formData.daneismos_epa_apo_em_erg,
                    'daneismos_epa_apo_em_erg'
                ),
                daneismosEos: normalizeOptionalDate(
                    formData.daneismos_epa_eos_em_erg,
                    'daneismos_epa_eos_em_erg'
                )
            }
        );
    }
    if (String(formData.kod_diad_erg ?? '').trim()) {
        addRelatedOperation(
            formData.kod_diad_erg,
            'diadoxosErgodoths',
            'DIADOXOS_ERGODOTHS_UPSERT',
            {
                eponymo: formData.eponymo_diad_erg,
                onoma: formData.onoma_diad_erg,
                dieythynsh: formData.dieythynsh_diad_erg,
                thlefono: formData.thlefono_diad_erg,
                afm: formData.afm_diad_erg,
                titlos: formData.titlos_diad_erg,
                nomikhMorfh: formData.nomikhmorfh_diadoxoyErgodoth,
                drasthriothta: formData.drasthriothta_diad_erg,
                email: formData.email_diad_erg
            }
        );
    }

    return { company, relatedOperations };
}

module.exports = {
    CompanyUpdateValidationError,
    CompanyUsersRequiredError,
    normalizeOptionalDate,
    normalizeOptionalNumber,
    normalizeObjectIdArray,
    normalizeCompanyUpdatePayload
};
