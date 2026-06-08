#!/usr/bin/env node
// // =========================================================================
// // ✅ Compare / validate E3N JSON payload keys against WebE3N schema fields
// // =========================================================================
// // Usage:
// //   node scripts/compare-e3n-schema.js /path/to/e3n-payload.json
// //
// // Notes:
// // - This script does NOT submit anything to ERGANI.
// // - It only validates local JSON structure/keys and common WebE3N restrictions.
// // - It is intentionally dependency-free.
// // =========================================================================

// const fs = require('fs');
// const path = require('path');

// const payloadPath = process.argv[2];

// if (!payloadPath) {
//     console.error('❌ Usage: node scripts/compare-e3n-schema.js /path/to/e3n-payload.json');
//     process.exit(1);
// }

// const fullPath = path.resolve(payloadPath);

// if (!fs.existsSync(fullPath)) {
//     console.error(`❌ File not found: ${fullPath}`);
//     process.exit(1);
// }

// const EXPECTED_FIELDS = [
//     'f_aa_pararthmatos',
//     'f_rel_protocol',
//     'f_rel_date',
//     'f_ypiresia_sepe',
//     'f_ypiresia_oaed',
//     'f_kad_pararthmatos',
//     'f_kallikratis_pararthmatos',
//     'f_eponymo',
//     'f_onoma',
//     'f_onoma_patros',
//     'f_onoma_mitros',
//     'f_birthdate',
//     'f_sex',
//     'f_yphkoothta',
//     'f_typos_taytothtas',
//     'f_ar_taytothtas',
//     'f_ekdousa_arxh',
//     'f_date_ekdosis',
//     'f_date_ekdosis_lixi',
//     'f_res_permit_inst',
//     'f_res_permit_inst_type',
//     'f_res_permit_inst_ar',
//     'f_res_permit_inst_lixi',
//     'f_res_permit_ap',
//     'f_res_permit_ap_type',
//     'f_res_permit_ap_ar',
//     'f_res_permit_ap_lixi',
//     'f_res_permit_visa',
//     'f_res_permit_visa_ar',
//     'f_res_permit_visa_from',
//     'f_res_permit_visa_to',
//     'f_marital_status',
//     'f_arithmos_teknon',
//     'f_afm',
//     'f_doy',
//     'f_amika',
//     'f_amka',
//     'f_code_anergias',
//     'f_ar_vivliou_anilikou',
//     'f_epipedo_morfosis',
//     'f_proslipsidate',
//     'f_proslipsitime',
//     'f_apoxwrisitime',
//     'f_week_hours',
//     'f_eidikothta',
//     'f_eidikothta_anal',
//     'f_proipiresia',
//     'f_apodoxes',
//     'f_hour_apodoxes',
//     'f_sxeshapasxolisis',
//     'f_orismenou_apo',
//     'f_orismenou_ews',
//     'f_kathestosapasxolisis',
//     'f_xaraktirismos',
//     'f_special_case',
//     'f_responsible_position',
//     'f_working_time_digital_organization',
//     'f_full_employment_hours',
//     'f_week_days',
//     'f_euelikto_wrario_minutes',
//     'f_working_card',
//     'f_dialeimma_minutes',
//     'f_dialeimma_entos_wrariou',
//     'f_topothetisioaed',
//     'f_programaoaed',
//     'f_replaceprograma',
//     'f_replaceprograma_afm',
//     'f_replaceprograma_amka',
//     'f_trial_period',
//     'f_trial_date_to',
//     'f_basics_acceptance',
//     'f_file',
//     'f_file_symbash',
//     'f_comments',
//     'f_foreign_file',
//     'f_young_file',
//     'f_xronos_katavolis_apodoxon',
//     'f_ipoxreotiki_katartisi',
//     'f_efarmoste_sillogiki_simbasi',
//     'f_efarmoste_sillogiki_simbasi_comments',
//     'f_prosthetes_asfalistikes',
//     'f_kyria_asfalisi',
//     'EpikourikiSelections',
//     'f_mh_provlepsimo_programma',
//     'f_paraggelia_hmeres_hours',
//     'f_paraggelia_min_notification',
//     'f_paraggelia_notes',
//     'f_topos_ergasias',
//     'f_topos_ergasias_comment'
// ];

// const RULES = {
//     f_aa_pararthmatos: { pattern: /^[0-9]{1,5}$/ },
//     f_rel_protocol: { maxLength: 50 },
//     f_ypiresia_sepe: { pattern: /^[0-9]{5}$/ },
//     f_ypiresia_oaed: { pattern: /^[0-9]{6}$/ },
//     f_kad_pararthmatos: { pattern: /^[0-9]{4}$/ },
//     f_kallikratis_pararthmatos: { pattern: /^[0-9]{8}$/ },
//     f_eponymo: { minLength: 1, maxLength: 50 },
//     f_onoma: { minLength: 1, maxLength: 30 },
//     f_onoma_patros: { minLength: 1, maxLength: 30 },
//     f_onoma_mitros: { minLength: 1, maxLength: 30 },
//     f_sex: { enum: ['0', '1'] },
//     f_yphkoothta: { pattern: /^[0-9]{3}$/ },
//     f_typos_taytothtas: { pattern: /^[A-ZΑ-Ω]{1,10}$/ },
//     f_ar_taytothtas: { minLength: 1, maxLength: 20 },
//     f_ekdousa_arxh: { maxLength: 50 },
//     f_res_permit_inst: { enum: ['', '0', '1'] },
//     f_res_permit_inst_type: { pattern: /^[0-9]{0,5}$/ },
//     f_res_permit_inst_ar: { maxLength: 20 },
//     f_res_permit_ap: { enum: ['', '0', '1'] },
//     f_res_permit_ap_type: { pattern: /^[0-9]{0,5}$/ },
//     f_res_permit_ap_ar: { maxLength: 20 },
//     f_res_permit_visa: { enum: ['', '0', '1'] },
//     f_res_permit_visa_ar: { maxLength: 20 },
//     f_marital_status: { enum: ['0', '1', '2', '3'] },
//     f_arithmos_teknon: { pattern: /^[0-9]{1,2}$/ },
//     f_afm: { pattern: /^[0-9]{9}$/ },
//     f_doy: { pattern: /^([0-9]{4}| *)$/ },
//     f_amika: { pattern: /^[0-9]{0,20}$/ },
//     f_amka: { pattern: /^[0-9]{0,20}$/ },
//     f_code_anergias: { maxLength: 20 },
//     f_ar_vivliou_anilikou: { maxLength: 20 },
//     f_epipedo_morfosis: { pattern: /^[0-9]{1,10}$/ },
//     f_proslipsitime: { pattern: /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/ },
//     f_apoxwrisitime: { pattern: /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/ },
//     f_week_hours: { pattern: /^([0-9]{3}|[0-9]+)(,[0-9])$/ },
//     f_eidikothta: { pattern: /^[0-9]{1,6}$/ },
//     f_eidikothta_anal: { maxLength: 255 },
//     f_proipiresia: { pattern: /^[0-9]{1,3}$/ },
//     f_apodoxes: { pattern: /^([0-9]{1,3}(\.([0-9]{3}\.)*[0-9]{3})?|[0-9]+)(,[0-9][0-9])$/ },
//     f_hour_apodoxes: { pattern: /^([0-9]{1,3}(\.([0-9]{3}\.)*[0-9]{3})?|[0-9]+)(,[0-9][0-9])$/ },
//     f_sxeshapasxolisis: { enum: ['0', '1'] },
//     f_kathestosapasxolisis: { enum: ['0', '1', '2'] },
//     f_xaraktirismos: { enum: ['0', '1'] },
//     f_special_case: { enum: ['', '2', '3'] },
//     f_responsible_position: { enum: ['', '1', '2', '3', '4'] },
//     f_working_time_digital_organization: { enum: ['0', '1'] },
//     f_full_employment_hours: { pattern: /^([0-9]{2}|[0-9]+)(,[0-9])$/ },
//     f_week_days: { enum: ['5', '6'] },
//     f_euelikto_wrario_minutes: { pattern: /^[0-9]{1,3}$/ },
//     f_working_card: { enum: ['0', '1'] },
//     f_dialeimma_minutes: { pattern: /^[0-9]{1,3}$/ },
//     f_dialeimma_entos_wrariou: { enum: ['0', '1'] },
//     f_topothetisioaed: { enum: ['0', '1'] },
//     f_programaoaed: { pattern: /^[0-9-]{0,10}$/ },
//     f_replaceprograma: { enum: ['', '0', '1'] },
//     f_replaceprograma_afm: { pattern: /^([0-9]{9}| *)$/ },
//     f_replaceprograma_amka: { pattern: /^([0-9]{0,20}| *)$/ },
//     f_trial_period: { enum: ['0', '1'] },
//     f_basics_acceptance: { enum: ['0', '1'] },
//     f_comments: { maxLength: 100 },
//     f_xronos_katavolis_apodoxon: { minLength: 1, maxLength: 100 },
//     f_ipoxreotiki_katartisi: { enum: ['0', '1'] },
//     f_efarmoste_sillogiki_simbasi: { enum: ['0', '1'] },
//     f_efarmoste_sillogiki_simbasi_comments: { maxLength: 500 },
//     f_prosthetes_asfalistikes: { maxLength: 500 },
//     f_kyria_asfalisi: { pattern: /^[0-9]{1,10}$/ },
//     f_mh_provlepsimo_programma: { enum: ['0', '1'] },
//     f_paraggelia_hmeres_hours: { maxLength: 1000 },
//     f_paraggelia_min_notification: { maxLength: 50 },
//     f_paraggelia_notes: { maxLength: 50 },
//     f_topos_ergasias: { enum: ['0', '1'] },
//     f_topos_ergasias_comment: { maxLength: 500 }
// };

// const DATE_FIELDS = [
//     'f_rel_date',
//     'f_birthdate',
//     'f_date_ekdosis',
//     'f_date_ekdosis_lixi',
//     'f_res_permit_inst_lixi',
//     'f_res_permit_ap_lixi',
//     'f_res_permit_visa_from',
//     'f_res_permit_visa_to',
//     'f_proslipsidate',
//     'f_orismenou_apo',
//     'f_orismenou_ews',
//     'f_trial_date_to'
// ];

// function isValidDateOrBlank(value) {
//     const str = String(value ?? '').trim();
//     if (str === '') return true;
//     if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;

//     const [dd, mm, yyyy] = str.split('/').map(Number);
//     const d = new Date(yyyy, mm - 1, dd);
//     return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
// }

// function getAnaggelia(payload) {
//     const rows = payload?.AnaggeliesE3N?.AnaggeliaE3N;

//     if (!Array.isArray(rows) || rows.length === 0) {
//         throw new Error('Invalid payload shape. Expected AnaggeliesE3N.AnaggeliaE3N[]');
//     }

//     return rows[0];
// }

// function validateValue(field, value) {
//     const errors = [];
//     const str = String(value ?? '');
//     const rule = RULES[field];

//     if (DATE_FIELDS.includes(field) && !isValidDateOrBlank(str)) {
//         errors.push(`${field}: invalid date '${str}'`);
//     }

//     if (!rule) return errors;

//     if (rule.minLength !== undefined && str.length < rule.minLength) {
//         errors.push(`${field}: length ${str.length} < ${rule.minLength}`);
//     }

//     if (rule.maxLength !== undefined && str.length > rule.maxLength) {
//         errors.push(`${field}: length ${str.length} > ${rule.maxLength}`);
//     }

//     if (rule.enum && !rule.enum.includes(str)) {
//         errors.push(`${field}: value '${str}' not in [${rule.enum.join(', ')}]`);
//     }

//     if (rule.pattern && !rule.pattern.test(str)) {
//         errors.push(`${field}: value '${str}' does not match ${rule.pattern}`);
//     }

//     return errors;
// }

// try {
//     const payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
//     const anaggelia = getAnaggelia(payload);

//     const payloadFields = Object.keys(anaggelia);
//     const missing = EXPECTED_FIELDS.filter((field) => !payloadFields.includes(field));
//     const extra = payloadFields.filter((field) => !EXPECTED_FIELDS.includes(field));

//     const validationErrors = [];

//     for (const field of payloadFields) {
//         if (field === 'EpikourikiSelections') continue;
//         validationErrors.push(...validateValue(field, anaggelia[field]));
//     }

//     const epikourikiRows = anaggelia?.EpikourikiSelections?.EpikourikiSelectionsE3N || [];
//     if (Array.isArray(epikourikiRows)) {
//         for (const [idx, row] of epikourikiRows.entries()) {
//             const value = String(row?.f_kod_epikourikis ?? '');
//             if (!/^[0-9]{1,10}$/.test(value)) {
//                 validationErrors.push(
//                     `EpikourikiSelectionsE3N[${idx}].f_kod_epikourikis: invalid '${value}'`
//                 );
//             }
//         }
//     } else {
//         validationErrors.push('EpikourikiSelections.EpikourikiSelectionsE3N must be an array');
//     }

//     console.log('============================================================');
//     console.log('✅ WebE3N JSON schema compare');
//     console.log('============================================================');
//     console.log(`Schema keys:  ${EXPECTED_FIELDS.length}`);
//     console.log(`Payload keys: ${payloadFields.length}`);
//     console.log(`Missing:      ${missing.length}`);
//     console.log(`Extra:        ${extra.length}`);
//     console.log(`Validation:   ${validationErrors.length} issue(s)`);
//     console.log('');

//     if (missing.length) console.log('Missing keys:', missing);
//     if (extra.length) console.log('Extra keys:', extra);
//     if (validationErrors.length) {
//         console.log('Validation issues:');
//         validationErrors.forEach((err) => console.log(` - ${err}`));
//     }

//     if (missing.length || extra.length || validationErrors.length) {
//         process.exit(2);
//     }

//     console.log('🎉 OK: payload matches expected WebE3N structure and basic restrictions.');
// } catch (error) {
//     console.error('❌ Compare failed:', error.message);
//     process.exit(1);
// }

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function getRecord(obj, label) {
    const arr = obj?.AnaggeliesE3N?.AnaggeliaE3N;
    if (!Array.isArray(arr) || !arr[0] || typeof arr[0] !== 'object') {
        throw new Error(`${label}: Δεν βρέθηκε AnaggeliesE3N.AnaggeliaE3N[0]`);
    }
    return arr[0];
}

const [schemaPath, payloadPath] = process.argv.slice(2);

if (!schemaPath || !payloadPath) {
    console.error('Usage: node scripts/compare-e3n-schema.js <schema-sample.json> <payload.json>');
    process.exit(1);
}

const schemaRecord = getRecord(readJson(schemaPath), 'Schema');
const payloadRecord = getRecord(readJson(payloadPath), 'Payload');

const schemaKeys = Object.keys(schemaRecord).sort();
const payloadKeys = Object.keys(payloadRecord).sort();

const missing = schemaKeys.filter((key) => !payloadKeys.includes(key));
const extra = payloadKeys.filter((key) => !schemaKeys.includes(key));

console.log('Schema keys:', schemaKeys.length);
console.log('Payload keys:', payloadKeys.length);
console.log('Missing:', missing.length ? missing : 'None');
console.log('Extra:', extra.length ? extra : 'None');

if (missing.length || extra.length) process.exitCode = 2;
