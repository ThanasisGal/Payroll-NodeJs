require('dotenv').config();
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');

// ── Εισαγωγή του υπάρχοντος Model (ΟΧΙ νέο Schema) ───────────────────────────
const ErgazomenoiModel = require('./server/models/ergazomenoi');

// ── Βοηθητικές συναρτήσεις ────────────────────────────────────────────────────

/** Excel serial date ή string → JS Date */
function excelDateToJS(value) {
    if (!value && value !== 0) return null;
    if (typeof value === 'number') {
        const date = xlsx.SSF.parse_date_code(value);
        if (!date) return null;
        return new Date(date.y, date.m - 1, date.d);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        // DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
            const [d, m, y] = trimmed.split('/');
            return new Date(`${y}-${m}-${d}`);
        }
        const parsed = new Date(trimmed);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (value instanceof Date) return value;
    return null;
}

/** 1 / "ΝΑΙ" / "NAI" / "YES" / "TRUE" → true, τα υπόλοιπα → false */
function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const v = value.trim().toUpperCase();
        return ['ΝΑΙ', 'NAI', 'TRUE', '1', 'YES'].includes(v);
    }
    return false;
}

/** Οποιαδήποτε τιμή → trimmed string ή undefined */
function toStr(value) {
    if (value === null || value === undefined) return undefined;
    const s = String(value).trim();
    return s === '' ? undefined : s;
}

/** Οποιαδήποτε τιμή → αριθμός ή 0 */
function toNum(value) {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(value);
    return isNaN(n) ? 0 : n;
}

// ── PHASE 1: Εμφάνιση στηλών Excel ───────────────────────────────────────────
function printColumns(allRows) {
    const headers = allRows[0];
    const firstData = allRows[1] ?? {};
    console.log('\n── Γράμμα → Όνομα στήλης Excel → Τιμή 1ης εγγραφής ───────────────');
    Object.keys(headers).forEach((letter) => {
        const header = String(headers[letter] ?? '').padEnd(38);
        const value = firstData[letter] ?? '';
        console.log(`  ${letter.padEnd(4)} → "${header}" → ${value}`);
    });
    console.log('────────────────────────────────────────────────────────────────────\n');
}

// ── MAPPING: Γράμμα στήλης Excel → πεδίο ErgazomenoiModel ───────────────────
// ⚠️  Μετά το PHASE=1, αντικατέστησε τα γράμματα με τα ΠΡΑΓΜΑΤΙΚΑ
//     γράμματα που είδες στην έξοδο.
//
//     Πίνακας αντιστοίχισης αριθμού → γράμμα:
//     1=A  2=B  3=C  4=D  5=E  6=F  7=G  8=H  9=I  10=J
//     11=K 12=L 13=M 14=N 15=O 16=P 17=Q 18=R 19=S 20=T
//     21=U 22=V 23=W 24=X 25=Y 26=Z 27=AA 28=AB ... 52=AZ
//     53=BA 54=BB 55=BC ... 78=BZ 79=CA ...
function mapRowToDocument(row, defaultTeam, defaultCompanyKod) {
    return {
        // ── Ταυτότητα εταιρείας ───────────────────────────────────────────────
        team: 'XAL',
        company_kod: '0001',
        kodikos: toStr(row['C']),

        // ── Προσωπικά στοιχεία ────────────────────────────────────────────────
        eponymo: toStr(row['D']),
        onoma: toStr(row['E']),
        afm: toStr(row['F']),
        amka: toStr(row['G']),
        eponymo_patera: toStr(row['H']),
        patronymo: toStr(row['I']),
        eponymo_mhteras: toStr(row['J']),
        mhtronymo: toStr(row['K']),
        fylo: toBoolean(row['L']),
        hmeromhnia_gennhshs: excelDateToJS(row['M']),
        topos_gennhshs: toStr(row['N']),
        yphkoothta: toStr(row['O']),
        arithmos_bibliarioy_anhlikoy: toStr(row['P']),

        // ── Ταυτότητα / Διαβατήριο ────────────────────────────────────────────
        typos_taytothtas: toStr(row['Q']),
        adt: toStr(row['R']),
        hmeromhnia_ekdoshs: excelDateToJS(row['S']),
        hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy: excelDateToJS(row['T']),
        arxh_ekdoshs: toStr(row['U']),
        doy: toStr(row['V']),
        forologikh_klimaka: toStr(row['W']),

        // ── Επικοινωνία ───────────────────────────────────────────────────────
        email: toStr(row['X']),
        thlefono: toStr(row['Y']),
        odos: toStr(row['Z']),
        arithmos: toStr(row['AA']),
        tk: toStr(row['AB']),
        polh: toStr(row['AC']),
        dhmos: toStr(row['AD']),
        nomos: toStr(row['AE']),
        perifereia: toStr(row['AF']),

        // ── Οικογενειακή κατάσταση ────────────────────────────────────────────
        oikogeneiakh_katastash: toStr(row['AG']),
        arithmos_teknon: toNum(row['AH']),
        eidikh_kathgoria_ergazomenoy: toStr(row['AI']),

        // ── Εκπαίδευση ────────────────────────────────────────────────────────
        ekpaideytiko_epipedo: toStr(row['AJ']),

        // ── Τραπεζικά ─────────────────────────────────────────────────────────
        trapeza: toStr(row['AK']),
        iban: toStr(row['AL']),

        // ── Εργασιακά - Ημερομηνίες ───────────────────────────────────────────
        hmeromhnia_proslhpshs: excelDateToJS(row['AM']),
        hmeromhnia_allaghs_symbashs: excelDateToJS(row['AN']),
        hmeromhnia_allaghs_orarioy_apo: excelDateToJS(row['AO']),
        hmeromhnia_allaghs_orarioy_eos: excelDateToJS(row['AP']),
        hmeromhnia_lhxhs_symbashs: excelDateToJS(row['AQ']),
        hmeromhnia_apoxorhshs: excelDateToJS(row['AR']),

        // ── Δανεισμός ─────────────────────────────────────────────────────────
        afora_daneismo_ergazomenoy: toBoolean(row['AS']),
        typos_daneismoy: toStr(row['AT']),
        hmnia_enarxhs_daneismoy: excelDateToJS(row['AU']),
        hmnia_lhxhs_daneismoy: excelDateToJS(row['AV']),

        // ── Δοκιμαστική περίοδος ──────────────────────────────────────────────
        afora_dokimastikh_periodo: toBoolean(row['AW']),
        hmnia_lhxhs_dokimastikhs_periodoy: excelDateToJS(row['AX']),

        // ── Σχέση εργασίας ────────────────────────────────────────────────────
        kathestos_apasxolhshs: toStr(row['AY']),
        sxesh_ergasias: toStr(row['AZ']),
        proyphresia_se_eth: toNum(row['BA']),
        proyphresia_se_mhnes: toNum(row['BB']),
        proyphresia_adeias_se_eth: toNum(row['BC']),
        synolo_proyphresias_se_eth: toNum(row['BD']),
        synolo_proyphresias_se_mhnes: toNum(row['BE']),
        misthologiko_klimakio: toNum(row['BF']),
        syggeneia: toBoolean(row['BG']),
        syggenikh_sxesh: toStr(row['BH']),
        thesh_eythynhs: toStr(row['BI']),
        eidikh_periptosh: toStr(row['BJ']),
        topos_ergasias: toBoolean(row['BK']),
        topos_ergasias_parathrhseis: toStr(row['BL']),
        xronos_katabolhs_apodoxon: toStr(row['BM']),
        efarmostea_sse: toBoolean(row['BN']),
        efarmostea_sse_parathrhseis: toStr(row['BO']),

        // ── Ωράριο ────────────────────────────────────────────────────────────
        plhrhs_apasxolhsh: toBoolean(row['BP']),
        mh_problepsimo_programma: toBoolean(row['BQ']),
        hmeres_ores_anaforas: toStr(row['BR']),
        eidopoihsh_prin_thn_anathesh: toStr(row['BS']),
        prothesmia_akyroshs_ths_anatheshs: toStr(row['BT']),
        dieythethsh_ergasias: toBoolean(row['BU']),
        hmnia_enarxhs_dieythethshs_ergasias: excelDateToJS(row['BV']),
        hmnia_lhxhs_dieythethshs_ergasias: excelDateToJS(row['BW']),
        hmeres_ergasias_ebdomadas: toNum(row['BX']),
        ores_ergasias_ebdomadas: toNum(row['BY']),
        mo_oron_hmerhsias_ergasias: toNum(row['BZ']),
        dialleima_se_lepta: toNum(row['CA']),
        dialleima_entos_ektos_orarioy: toBoolean(row['CB']),
        symbatikes_ores_ergasias: toNum(row['CC']),
        typos_orarioy: toBoolean(row['CD']),
        synexes_diakekomeno: toBoolean(row['CE']),
        pshfiakh_organosh: toBoolean(row['CF']),
        apasxolhsh_basei_symbashs: toStr(row['CG']),
        karta_ergasias: toBoolean(row['CH']),
        evelikth_proselefsh: toNum(row['CI']),
        apasxolhsh_gia_proth_fora: toBoolean(row['CJ']),
        ora_enarxhs_proths_foras: toStr(row['CK']),
        ora_apoxorhshs_proths_foras: toStr(row['CL']),
        asfalish_me_tekmarta: toBoolean(row['CM']),
        asfalistikh_klash: toStr(row['CN']),
        epoxikos: toBoolean(row['CO']),

        // ── Οργανόγραμμα ────────────���─────────────────────────────────────────
        tmhma: toStr(row['CP']),
        eidikothta_erganh: toStr(row['CQ']),
        antikeimeno_ergasion: toStr(row['CR']),
        typos_ergazomenon: toStr(row['CS']),
        ypokatasthma: toStr(row['CT']),
        xarakthrismos_ergazomenon: toBoolean(row['CU']),
        eidikothta: toStr(row['CV']),
        diathesimothta: toBoolean(row['CW']),
        enarxh_diathesimothtas: excelDateToJS(row['CX']),
        lhxh_diathesimothtas: excelDateToJS(row['CY']),

        // ── Ασφάλιση ΕΦΚΑ ─────────────────────────────────────────────────────
        foreas_kyrias_asfalishs: toStr(row['CZ']),
        // foreas_epikoyrikhs_asfalishs είναι array - χειρίζεται παρακάτω
        kad_efka: toStr(row['DA']),
        eidikothta_efka: toStr(row['DB']),
        kpk_efka: toStr(row['DC']),
        kpk_efka_basei_symbashs: toStr(row['DD']),
        epa_efka: toStr(row['DE']),
        prosthetes_asfalistikes_apodoxes: toStr(row['DF']),

        // ── Μειώσεις / Επιδοτήσεις εισφορών ──────────────────────────────────
        meiosh_eisforon_ergazomenon: toBoolean(row['DG']),
        kodikos_meioshs: toStr(row['DH']),
        pososto_asfalismenoy_meioshs: toNum(row['DI']),
        pososto_ergodoth_meioshs: toNum(row['DJ']),
        isxyei_apo_meioshs: excelDateToJS(row['DK']),
        isxyei_eos_meioshs: excelDateToJS(row['DL']),
        epidothsh_eisforon_ergodoth: toBoolean(row['DM']),
        kodikos_epidothshs: toStr(row['DN']),
        pososto_asfalismenoy_epidothshs: toNum(row['DO']),
        pososto_ergodoth_epidothshs: toNum(row['DP']),
        isxyei_apo_epidothshs: excelDateToJS(row['DQ']),
        isxyei_eos_epidothshs: excelDateToJS(row['DR']),
        meiosh_eisforon_mhteron: toBoolean(row['DS']),
        kodikos_meioshs_eisforon_mhteron: toStr(row['DT']),
        pososto_asfalismenoy_eisforon_mhteron: toNum(row['DU']),
        pososto_ergodoth_eisforon_mhteron: toNum(row['DV']),
        isxyei_apo_eisforon_mhteron: excelDateToJS(row['DW']),
        isxyei_eos_eisforon_mhteron: excelDateToJS(row['DX']),
        palios_neos: toBoolean(row['DY']),
        amoibetai_me_sse: toBoolean(row['DZ']),

        // ── ΔΥΠΑ ──────────────────────────────────────────────────────────────
        epidoma_anergias: toBoolean(row['EA']),
        dypa: toStr(row['EB']),
        arithmos_deltioy_anergias: toStr(row['EC']),
        systatiko_shmeioma: toBoolean(row['ED']),
        topothethsh_me_programma: toBoolean(row['EE']),
        ypoxreotikh_ek_toy_nomoy_katartish: toBoolean(row['EF']),
        programma_dypa: toStr(row['EG']),
        egkritikh_apofash_dypa: toStr(row['EH']),
        hmeromhnia_enarxhs_programmatos: excelDateToJS(row['EI']),
        hmeromhnia_lhxhs_programmatos: excelDateToJS(row['EJ']),
        antikatastash_ergazomenoy: toBoolean(row['EK']),
        afm_antikatastath: toStr(row['EL']),
        amka_antikatastath: toStr(row['EM']),

        // ── Κέντρα κόστους ────────────────────────────────────────────────────
        kentro_kostoys_1: toStr(row['EN']),
        pososto_apasxolhshs_kk1: toNum(row['EO']),
        kentro_kostoys_2: toStr(row['EP']),
        pososto_apasxolhshs_kk2: toNum(row['EQ']),
        kentro_kostoys_3: toStr(row['ER']),
        pososto_apasxolhshs_kk3: toNum(row['ES']),
        kentro_kostoys_4: toStr(row['ET']),
        pososto_apasxolhshs_kk4: toNum(row['EU']),

        // ── Κατάσταση εργαζόμενου ─────────────────────────────────────────────
        energos: toBoolean(row['EV']),
        archived: false,

        // ── Παρατηρήσεις ──────────────────────────────────────────────────────
        parathrhseis: toStr(row['EW'])
    };
}

// ── Κύρια συνάρτηση ───────────────────────────────────────────────────────────
async function main() {
    const PHASE = process.env.PHASE || '1';

    // 1. Φόρτωση Excel
    const FILE_PATH = path.resolve(process.env.EXCEL_PATH || './tblProsop.xlsx');
    const workbook = xlsx.readFile(FILE_PATH);
    const sheetName = process.env.SHEET_NAME || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const allRows = xlsx.utils.sheet_to_json(sheet, { defval: null, header: 'A' });
    const dataRows = allRows.slice(1); // αφαίρεση γραμμής headers

    console.log(`\n📄  File  : ${FILE_PATH}`);
    console.log(`📄  Sheet : "${sheetName}"`);
    console.log(`📊  Γραμμές δεδομένων: ${dataRows.length}`);

    // ── PHASE 1: Μόνο εμφάνιση στηλών ────────────────────────────────────────
    if (PHASE === '1') {
        printColumns(allRows);
        console.log('👉  Ενημέρωσε το mapping στη mapRowToDocument()');
        console.log('    και τρέξε ξανά με PHASE=2 για να ξεκινήσει η εισαγωγή.\n');
        return;
    }

    // ── PHASE 2: Εισαγωγή στο MongoDB Atlas ──────────────────────────────────
    const MONGO_URI = process.env.MONGODB_URL;
    if (!MONGO_URI) {
        console.error('❌  Δεν βρέθηκε MONGODB_URL στο .env');
        process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅  Σύνδεση στο MongoDB Atlas επιτυχής\n');

    const DEFAULT_TEAM = process.env.DEFAULT_TEAM || 'TEAM_A';
    const DEFAULT_COMPANY_KOD = process.env.DEFAULT_COMPANY_KOD || 'COMP_001';

    let inserted = 0,
        updated = 0,
        skipped = 0,
        errors = 0;

    for (const row of dataRows) {
        const doc = mapRowToDocument(row, DEFAULT_TEAM, DEFAULT_COMPANY_KOD);

        // Παράλειψη εγγραφών χωρίς AMKA
        if (!doc.amka) {
            console.warn(`  ⚠️  Παράλειψη (χωρίς AMKA): ${doc.eponymo ?? ''} ${doc.onoma ?? ''}`);
            skipped++;
            continue;
        }

        try {
            const result = await ErgazomenoiModel.updateOne(
                {
                    amka: doc.amka, // ← κύριο κλειδί
                    company_kod: doc.company_kod // ← + εταιρεία
                },
                { $set: doc },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                inserted++;
                console.log(`  ✅  [ΝΕΟ]    ${doc.eponymo} ${doc.onoma} (AMKA: ${doc.amka})`);
            } else {
                updated++;
                console.log(`  🔄  [UPDATE] ${doc.eponymo} ${doc.onoma} (AMKA: ${doc.amka})`);
            }
        } catch (err) {
            errors++;
            console.error(`  ❌  [ERROR]  ${doc.eponymo} ${doc.onoma} → ${err.message}`);
        }
    }

    // Σύνοψη αποτελεσμάτων
    console.log('\n══════════════════════════════════════════════════');
    console.log(`  ✅  Νέες εγγραφές  : ${inserted}`);
    console.log(`  🔄  Ενημερωμένες   : ${updated}`);
    console.log(`  ⚠️   Παραλείφθηκαν : ${skipped}`);
    console.log(`  ❌  Σφάλματα       : ${errors}`);
    console.log(`  📊  Σύνολο         : ${inserted + updated + skipped + errors}`);
    console.log('══════════════════════════════════════════════════');

    await mongoose.disconnect();
    console.log('👋  Αποσύνδεση από MongoDB Atlas\n');
}

main().catch((err) => {
    console.error('💥  Κρίσιμο σφάλμα:', err);
    process.exit(1);
});
