require('dotenv').config();
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');

// ── Εισαγωγή του υπάρχοντος Model (ΟΧΙ νέο Schema) ───────────────────────────
const { ErgazomenoiModel } = require('./server/models/ergazomenoi');

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

        // ISO 8601 format: 1979-10-16T00:00:00.000+00:00
        if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
            const parsed = new Date(trimmed);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

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

function getKodKlimakas(row) {
    const today = new Date('2026-03-28');
    const birthDate = new Date(excelDateToJS(row['H']));
    const age = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24 * 365.25));

    const klimaka = age <= 25 ? '00' : age < 30 ? '01' : '02';
    return klimaka + String(row['AO']).padStart(2, '0');
}

function mapRowToDocument(row, defaultTeam, defaultCompanyKod) {
    return {
        // ── Ταυτότητα εταιρείας ───────────────────────────────────────────────
        team: 'BLG',
        company_kod: '69c574ff25255bcae152f16f',
        kodikos: toStr(row['C']),

        // ── Προσωπικά στοιχεία ────────────────────────────────────────────────
        eponymo: toStr(row['D']),
        onoma: toStr(row['E']),
        afm: toStr(row['K']),
        amka: toStr(row['FH']),
        eponymo_patera: toStr(row['FJ']),
        patronymo: toStr(row['F']),
        eponymo_mhteras: toStr(row['FK']),
        mhtronymo: toStr(row['G']),
        fylo: row['EC'] === 1 ? false : row['NC'] === 2 ? true : null,
        hmeromhnia_gennhshs: excelDateToJS(row['H'])?.toISOString().startsWith('1900-01-01')
            ? null
            : excelDateToJS(row['H']),
        topos_gennhshs: toStr(row['I']),
        yphkoothta: toStr(row['J']),
        arithmos_bibliarioy_anhlikoy: toStr(row['FZ']),

        // ── Ταυτότητα / Διαβατήριο ────────────────────────────────────────────
        typos_taytothtas: toStr(row['FL']),
        adt: toStr(row['L']),
        hmeromhnia_ekdoshs: excelDateToJS(row['N'])?.toISOString().startsWith('1900-01-01')
            ? null
            : excelDateToJS(row['NW']),
        hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy: excelDateToJS(row['FS']),
        arxh_ekdoshs: toStr(row['M']),
        doy: row['S'] != 0 ? toStr(row['S']) : '',
        forologikh_klimaka: getKodKlimakas(row),

        // ── Επικοινωνία ───────────────────────────────────────────────────────
        email: toStr(row['FR']),
        thlefono: toStr(row['Y']),
        odos: toStr(row['O']),
        arithmos: toStr(row['FZ']),
        tk: toStr(row['Q']),
        polh: toStr(row['FZ']),
        dhmos: toStr(row['FZ']),
        nomos: toStr(row['FZ']),
        perifereia: toStr(row['FZ']),

        // ── Οικογενειακή κατάσταση ────────────────────────────────────────────
        oikogeneiakh_katastash: toStr(row['AG']),
        arithmos_teknon: toNum(row['AH']),
        eidikh_kathgoria_ergazomenoy: '0009',

        // ── Εκπαίδευση ────────────────────────────────────────────────────────
        ekpaideytiko_epipedo: toStr(row['AQ']),

        // ── Τραπεζικά ─────────────────────────────────────────────────────────
        trapeza: toStr(row['BB']),
        iban: toStr(row['BC']),

        // ── Εργασιακά - Ημερομηνίες ───────────────────────────────────────────
        hmeromhnia_proslhpshs: excelDateToJS(row['U'])?.toISOString().startsWith('1900-01-01')
            ? null
            : excelDateToJS(row['U']),
        hmeromhnia_allaghs_symbashs: excelDateToJS(row['AN'])
            ?.toISOString()
            .startsWith('1900-01-01')
            ? null
            : excelDateToJS(row['AN']),
        hmeromhnia_allaghs_orarioy_apo: excelDateToJS(row['U'])
            ?.toISOString()
            .startsWith('1900-01-01')
            ? null
            : excelDateToJS(row['U']),
        hmeromhnia_allaghs_orarioy_eos: excelDateToJS(
            new Date(new Date(row['U']).getTime() + 7 * 24 * 60 * 60 * 1000)
        ),
        hmeromhnia_lhxhs_symbashs: excelDateToJS(row['BT'])?.toISOString().startsWith('1900-01-01')
            ? null
            : excelDateToJS(row['BT']),
        hmeromhnia_apoxorhshs: excelDateToJS(row['W'])?.toISOString().startsWith('1900-01-01')
            ? null
            : excelDateToJS(row['W']),

        // ── Δανεισμός ─────────────────────────────────────────────────────────
        afora_daneismo_ergazomenoy: false,
        typos_daneismoy: toStr(row['FZ']),
        hmnia_enarxhs_daneismoy: null,
        hmnia_lhxhs_daneismoy: null,

        // ── Δοκιμαστική περίοδος ──────────────────────────────────────────────
        afora_dokimastikh_periodo: false,
        hmnia_lhxhs_dokimastikhs_periodoy: null,

        // ── Σχέση εργασίας ────────────────────────────────────────────────────
        kathestos_apasxolhshs: toStr(row['AB'] === -1 ? 0 : row['AB'] === 0 ? 1 : row['AB']),
        sxesh_ergasias: excelDateToJS(row['BT'])?.toISOString().startsWith('1900-01-01')
            ? '0'
            : '1',
        proyphresia_se_eth: Math.floor(toNum(row['X'])),
        proyphresia_se_mhnes: Math.round(parseFloat((toNum(row['X']) % 1).toFixed(2)) * 100),
        // proyphresia_adeias_se_eth: toNum(row['BC']),
        // synolo_proyphresias_se_eth: toNum(row['BD']),
        // synolo_proyphresias_se_mhnes: toNum(row['BE']),
        misthologiko_klimakio: toNum(row['Z']),
        syggeneia: false,
        syggenikh_sxesh: '',
        thesh_eythynhs: '1',
        eidikh_periptosh: '',
        topos_ergasias: false,
        // topos_ergasias: toBoolean(row['BK']),
        topos_ergasias_parathrhseis: '',
        xronos_katabolhs_apodoxon: 'ΕΝΤΟΣ 15ΗΜΕΡΟΥ ΑΠΟ ΤΟ ΤΕΛΟΣ ΚΑΘΕ ΜΙΣΘΟΛΟΓΙΚΗΣ ΠΕΡΙΟΔΟΥ',
        efarmostea_sse: true,
        efarmostea_sse_parathrhseis: 'Σ.Σ.Ε. ΞΕΝΟΔΟΧΟΫΠΑΛΛΗΛΩΝ ΟΛΗΣ ΤΗΣ ΧΩΡΑΣ',

        // ── Ωράριο ────────────────────────────────────────────────────────────
        plhrhs_apasxolhsh: toBoolean(row['AB']),
        mh_problepsimo_programma: false,
        hmeres_ores_anaforas: null,
        eidopoihsh_prin_thn_anathesh: null,
        prothesmia_akyroshs_ths_anatheshs: null,
        dieythethsh_ergasias: false,
        hmnia_enarxhs_dieythethshs: null,
        hmnia_lhxhs_dieythethshs_ergasias: null,
        hmeres_ergasias_ebdomadas: toNum(row['AC']),
        ores_ergasias_ebdomadas: toNum(row['AD']),
        mo_oron_hmerhsias_ergasias: toNum(row['BZ']),
        dialleima_se_lepta: 30,
        dialleima_entos_ektos_orarioy: false,
        symbatikes_ores_ergasias: 40,
        typos_orarioy: false,
        synexes_diakekomeno: false,
        pshfiakh_organosh: true,
        apasxolhsh_basei_symbashs: '5',
        karta_ergasias: true,
        evelikth_proselefsh: 120,
        apasxolhsh_gia_proth_fora: false,
        ora_enarxhs_proths_foras: '07:00',
        ora_apoxorhshs_proths_foras: '14:00',
        asfalish_me_tekmarta: false,
        asfalistikh_klash: '',
        epoxikos: row['AL'] === -1 ? true : false,

        // ── Οργανόγραμμα ─────────────────────────────────────────────────────
        tmhma: toStr(row['CP']),
        eidikothta_erganh: toStr(row['FQ']),
        antikeimeno_ergasion: '',
        typos_ergazomenon: toStr(row['AS']),
        ypokatasthma: String(row['AV']).padStart(4, '0'),
        xxarakthrismos_ergazomenon: row['AR'] === 1000 ? 'Μ' : 'Η',
        eidikothta: toStr(row['AP']),
        diathesimothta: false,
        enarxh_diathesimothtaxs: null,
        lhxh_diathesimothtas: null,

        // ── Ασφάλιση ΕΦΚΑ ─────────────────────────────────────────────────────
        foreas_kyrias_asfalishs: '001',
        foreas_epikoyrikhs_asfalishs: '001',
        kad_efka: toStr(row['AW']),
        eidikothta_efka: toStr(row['AX']),
        kpk_efka: toStr(row['AY']).padStart(4, '0'),
        kpk_efka_basei_symbashs: toStr(row['AY']),
        epa_efka: toStr(row['AZ']),
        prosthetes_asfalistikes_apodoxes: '',

        // ── Μειώσεις / Επιδοτήσεις εισφορών ──────────────────────────────────
        meiosh_eisforon_ergazomenon: false,
        kodikos_meioshs: '',
        pososto_asfalismenoy_meioshs: 0,
        pososto_ergodoth_meioshs: 0,
        isxyei_apo_meioshs: null,
        isxyei_eos_meioshs: null,
        epidothsh_eisforon_ergodoth: false,
        kodikos_epidothshs: '',
        pososto_asfalismenoy_epidothshs: 0,
        pososto_ergodoth_epidothshs: 0,
        isxyei_apo_epidothshs: null,
        isxyei_eos_epidothshs: null,
        meiosh_eisforon_mhteron: false,
        kodikos_meioshs_eisforon_mhteron: '',
        pososto_asfalismenoy_eisforon_mhteron: 0,
        pososto_ergodoth_eisforon_mhteron: 0,
        isxyei_apo_eisforon_mhteron: null,
        isxyei_eos_eisforon_mhteron: null,
        palios_neos: row['BP'] === -1 ? true : false,

        amoibetai_me_sse: false,

        // ── ΔΥΠΑ ──────────────────────────────────────────────────────────────
        epidoma_anergias: false,
        dypa: '',
        arithmos_deltioy_anergias: '',
        systatiko_shmeioma: false,
        topothethsh_me_programma: false,
        ypoxreotikh_ek_toy_nomoy_katartish: false,
        programma_dypa: '',
        egkritikh_apofash_dypa: '',
        hmeromhnia_enarxhs_programmatos: null,
        hmeromhnia_lhxhs_programmatos: null,
        antikatastash_ergazomenoy: false,
        afm_antikatastath: '',
        amka_antikatastath: '',

        // ── Κέντρα κόστους ────────────────────────────────────────────────────
        kentro_kostoys_1: toStr(row['BG']).padStart(4, '0'),
        pososto_apasxolhshs_kk1: toNum(row['BH']),
        kentro_kostoys_2: toStr(row['BI']).padStart(4, '0'),
        pososto_apasxolhshs_kk2: toNum(row['BJ']),
        kentro_kostoys_3: toStr(row['BK']).padStart(4, '0'),
        pososto_apasxolhshs_kk3: toNum(row['BL']),
        kentro_kostoys_4: toStr(row['BM']).padStart(4, '0'),
        pososto_apasxolhshs_kk4: toNum(row['BN']),

        // ── Κατάσταση εργαζόμενου ─────────────────────────────────────────────
        energos: toBoolean(row['FC']),
        archived: false,

        // ── Παρατηρήσεις ──────────────────────────────────────────────────────
        parathrhseis: toStr(row['T'])
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
