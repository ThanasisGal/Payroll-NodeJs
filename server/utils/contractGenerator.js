// /**
//  * ============================================================================
//  * contractGenerator.js
//  * ============================================================================
//  * 
//  * Δημιουργεί PDF σύμβασης για έναν εργαζόμενο
//  * Καλείται από το postErgazomenoiForm μετά την αποθήκευση
//  */

// const PizZip = require("pizzip");
// const Docxtemplater = require("docxtemplater");
// const { promisify } = require("util");
// const path = require("path");
// const fs = require("fs-extra");
// const { exec } = require("child_process");
// const { PDFDocument } = require("pdf-lib");

// // Import text loader
// const { loadTextsByCategory, combineTexts, CATEGORIES } = require('./textLoader');

// // Import models
// const Models_A = require("../models/stathera_arxeia");
// const Models_C = require("../models/companies");

// const { PoleisModel, 
//         SxeseisErgasiasModel,
//         DoyModel,
//         EidikothtesEfarmoghsModel,
//       } = Models_A; 

// const { CompaniesModel,
//         NomimoiEkprosopoiModel,
//       } = Models_C;

// const execAsync = promisify(exec);

// // ============================================================================
// // CONFIGURATION - Environment-aware paths
// // ============================================================================

// const baseDir = process.cwd();

// const docxTemplatePath = path.join(
//     baseDir,
//     'public',
//     'templates',
//     'ΑΡΧΙΚΗ ΣΥΜΒΑΣΗ ΕΡΓΑΖΟΜΕΝΩΝ.docx'
// );

// const outputFolder = path.join(baseDir, 'public', 'pdf');

// // Ensure output folder exists at startup
// fs.ensureDirSync(outputFolder);

// // Verify template exists
// if (!fs.existsSync(docxTemplatePath)) {
//     console.error('❌ Template not found:', docxTemplatePath);
//     console.error('   Please ensure the template file exists at this location.');
// } else {
//     console.log('✅ Template loaded:', docxTemplatePath);
// }

// console.log('📁 Output folder:', outputFolder);

// // ============================================================================
// // Helper Functions
// // ============================================================================

// function formatDate(date) {
//     if (!date) return "";
//     let d = new Date(date),
//         month = '' + (d.getMonth() + 1),
//         day = '' + d.getDate(),
//         year = d.getFullYear();

//     if (month.length < 2) month = '0' + month;
//     if (day.length < 2) day = '0' + day;

//     return [day, month, year].join('/');
// }

// const calculateMonthsDifference = (startDate, endDate) => {
//     if (!endDate) return 0;
//     const start = new Date(startDate);
//     const end = new Date(endDate);
//     const yearsDifference = end.getFullYear() - start.getFullYear();
//     const monthsDifference = end.getMonth() - start.getMonth();
//     return yearsDifference * 12 + monthsDifference;
// };

// const numbersToWords = (n) => {
//     const ones = ['', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα', 'δέκα', 
//         'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεπτά', 'δεκαοκτώ', 'δεκαεννέα'];
//     const tens = ['', '', 'είκοσι', 'τριάντα', 'σαράντα', 'πενήντα', 'εξήντα', 'εβδομήντα', 'ογδόντα', 'ενενήντα'];
    
//     if (n < 20) return ones[n];
//     if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    
//     if (n < 1000) {
//         const hundreds = Math.floor(n / 100);
//         const remainder = n % 100;
//         const hundredsText = 
//         hundreds === 1 ? 'εκατό' + (remainder ? 'ν' : '') :
//         hundreds === 2 ? 'διακόσια' :
//         hundreds === 3 ? 'τριακόσια' :
//         hundreds === 4 ? 'τετρακόσια' :
//         hundreds === 5 ? 'πεντακόσια' :
//         hundreds === 6 ? 'εξακόσια' :
//         hundreds === 7 ? 'επτακόσια' :
//         hundreds === 8 ? 'οκτακόσια' :
//         hundreds === 9 ? 'εννιακόσια' : '';
//         return hundredsText + (remainder ? ' ' + numbersToWords(remainder) : '');
//     }

//     if (n < 1000000) {
//         return numbersToWords(Math.floor(n / 1000)) + ' χιλιάδες' + 
//              (n % 1000 ? ' ' + numbersToWords(n % 1000) : '');
//     }
  
//     return numbersToWords(Math.floor(n / 1000000)) + ' εκατομμύρια' + 
//         (n % 1000000 ? ' ' + numbersToWords(n % 1000000) : '');
// };

// const numberToText = (num, type = 'money') => {
//     const whole = Math.floor(num); 
//     const decimal = Math.round((num - whole) * 100); 
//     let wholeText = numbersToWords(whole);
//     let decimalText = decimal > 0 ? numbersToWords(decimal) : '';

//     switch(type) {
//         case 'money':
//             return decimalText 
//                 ? `${wholeText} ευρώ και ${decimalText} λεπτά` 
//                 : `${wholeText} ευρώ`;
//         case 'time':
//             return decimalText 
//                 ? `${wholeText} ώρες και ${decimalText} λεπτά` 
//                 : `${wholeText} ώρες`;
//         default:
//             return decimalText 
//                 ? `${wholeText} και ${decimalText}` 
//                 : `${wholeText}`;
//     }
// };

// // ============================================================================
// // Main Function: Generate Contract PDF
// // ============================================================================

// /**
//  * Δημιουργεί PDF σύμβασης για έναν εργαζόμενο
//  * 
//  * @param {Object} ergazomenos - Το document του εργαζόμενου από MongoDB
//  * @param {Object} userContext - { team, companyFolder }
//  * @returns {Promise<string>} - S3 key του generated PDF
//  */
// async function generateContractPDF(ergazomenos, userContext) {
//     try {
//         console.log(`\n📄 ════════════════════════════════════════════════════════`);
//         console.log(`📄 Generating contract PDF`);
//         console.log(`📄 Employee: ${ergazomenos.onoma} ${ergazomenos.eponymo}`);
//         console.log(`📄 Code: ${ergazomenos.kodikos}`);
//         console.log(`📄 Category: ${ergazomenos.eidikh_kathgoria_ergazomenoy || 'N/A'}`);
//         console.log(`📄 ════════════════════════════════════════════════════════\n`);
        
//         // Ensure output folder exists
//         await fs.ensureDir(outputFolder);
        
//         // Verify template exists
//         if (!await fs.pathExists(docxTemplatePath)) {
//             throw new Error(`Template file not found: ${docxTemplatePath}`);
//         }
        
//         // Fetch company data
//         const company = await CompaniesModel.findOne({ _id: ergazomenos.company_kod }).lean();
//         if (!company) {
//             throw new Error('Company not found');
//         }
        
//         const poleis = await PoleisModel.findOne({ kodikos: company.polh }).lean();
//         const doy = await DoyModel.findOne({ kodikos: company.doy_company }).lean();
//         const nomimoiEkprosopoi = await NomimoiEkprosopoiModel.findOne({ 
//             companykod_object: ergazomenos.company_kod, 
//             kodikos: "0001" 
//         }).lean();
        
//         // Company name
//         let eponymia_Etairias = (company.eponymia ? company.eponymia.trim() : "") + " " 
//                                 + (company.fathername ? company.fathername.substring(0, 3).trim() : "") + " " 
//                                 + (company.firstname ? company.firstname.trim() : "");
        
//         // Gender-based variables
//         const _CAPITAL_ONOMASTIKH_A = ergazomenos.fylo ? "Η"  : "Ο" ;
//         const _CAPITAL_ONOMASTIKH_K = ergazomenos.fylo ? "Η"  : "ΟΣ";
//         const _CAPITAL_GENIKH_A     = ergazomenos.fylo ? "ΗΣ" : "ΟΥ";
//         const _CAPITAL_AITIATIKH_A  = ergazomenos.fylo ? "ΗΝ" : "ΟΝ";
//         const _ONOMASTIKH_A         = ergazomenos.fylo ? "η"  : "ο" ;
//         const _ONOMASTIKH_K         = ergazomenos.fylo ? "η"  : "ος";
//         const _GENIKH_A             = ergazomenos.fylo ? "ης" : "ου";
//         const _AITIATIKH_A          = ergazomenos.fylo ? "ην" : "ον";
//         const _ANTONYMIA_O          = ergazomenos.fylo ? "ή"  : "ός";
//         const _ANTONYMIA_G          = ergazomenos.fylo ? "ής" : "ού";
//         const _ANTONYMIA_A          = ergazomenos.fylo ? "ήν" : "όν";
        
//         // ✅ Load dynamic texts from S3 cache
//         let _HOTEL = "";
//         let _ADDITIONAL_CLAUSES = "";

//         let hotelParts = {};
        
//         if (ergazomenos.eidikh_kathgoria_ergazomenoy && userContext) {
//             try {
//                 console.log(`📚 Loading templates for category: ${ergazomenos.eidikh_kathgoria_ergazomenoy}`);
                
//                 const templates = loadTextsByCategory(
//                     userContext.team,
//                     userContext.companyFolder,
//                     CATEGORIES.SYMBASH,
//                     ergazomenos.eidikh_kathgoria_ergazomenoy
//                 );

//                 // ✅ NEW
//                 hotelParts = templates || {};
                
//                 if (Object.keys(templates).length > 0) {
//                     _HOTEL = combineTexts(templates);
//                     console.log(`✅ Loaded ${Object.keys(templates).length} templates (${_HOTEL.length} chars)`);
//                 } else {
//                     console.warn(`⚠️ No templates found for category ${ergazomenos.eidikh_kathgoria_ergazomenoy}`);
                    
//                     // Fallback για hotel
//                     if (ergazomenos.eidikh_kathgoria_ergazomenoy === "0009") {
//                         _HOTEL = "Ειδικότερα συμφωνείται ότι, με μονομερή ενέργεια ο εργοδότης έχει τη δυνατότητα εφαρμογής των ρυθμίσεων της δεσμευτικής για όλους τους εργοδότες ΣΣΕ Ξενοδοχειακών επιχειρήσεων όλης της χώρας 2025-2026, άρθρο 5 και τυχόν ισχύουσα δεσμευτική τοπική σε κάποια εγκατάσταση για την εφαρμογή του 5νθημέρου και την εργασία της έκτης ημέρας, κατά περίπτωση.";
//                         console.log('⚠️ Using fallback hardcoded text for hotel');
//                     }
//                 }
//             } catch (error) {
//                 console.error('❌ Error loading dynamic texts:', error);
//                 // Fallback
//                 if (ergazomenos.eidikh_kathgoria_ergazomenoy === "0009") {
//                     _HOTEL = "Ειδικότερα συμφωνείται ότι, με μονομερή ενέργεια ο εργοδότης έχει τη δυνατότητα εφαρμογής των ρυθμίσεων της δεσμευτικής για όλους τους εργοδότες ΣΣΕ Ξενοδοχειακών επιχειρήσεων όλης της χώρας 2025-2026, άρθρο 5 και τυχόν ισχύουσα δεσμευτική τοπική σε κάποια εγκατάσταση για την εφαρμογή του 5νθημέρου και την εργασία της έκτης ημέρας, κατά περίπτωση.";
//                 }
//                 // ✅ NEW: για να μην περάσει ποτέ undefined στο docx
//                 hotelParts = {};
//             }
//         }
        
//         // Epoxikothta
//         let epoxikothta = "";
//         if (ergazomenos.epoxikos) {
//             epoxikothta = "Συμφωνείται ότι, λόγω εποχικότητας και ειδικών συνθηκών λειτουργίας της μονάδας, να χορηγείται τμήμα της άδειας κατά τις περιόδους που υπάρχει περιορισμένη ή και ανύπαρκτη πληρότητα (νεκρή περίοδο).";
//         }
        
//         // Fetch related data
//         const polh = await PoleisModel.findOne({ kodikos: ergazomenos.polh }).lean();
//         const eidikothta = await EidikothtesEfarmoghsModel.findOne({ kodikos: ergazomenos.eidikothta }).lean();
//         const sxeshErgasias = await SxeseisErgasiasModel.findOne({ kodikos: ergazomenos.sxesh_ergasias}).lean();
        
//         // Apasxolhsh logic
//         let apasxolhsh, typos, typos_erg, typos_erg_genikh, typos_erg_genikh_capital, typos_erg_aitiatikh;
        
//         switch (ergazomenos.kathestos_apasxolhshs) {
//             case "0":
//                 apasxolhsh = "ΠΛΗΡΟΥΣ";
//                 typos = "μισθωτός";
//                 typos_erg = typos;
//                 typos_erg_genikh = "μισθωτού";
//                 typos_erg_genikh_capital = "ΜΙΣΘΩΤΟΥ";
//                 typos_erg_aitiatikh = "μισθωτό";
//                 break;
//             case "1":
//                 apasxolhsh = "ΜΕΡΙΚΗΣ";
//                 typos = "εργαζόμεν" + _ONOMASTIKH_K;
//                 typos_erg = typos;
//                 typos_erg_genikh = "εργαζόμεν" + _GENIKH_A;
//                 typos_erg_genikh_capital = "ΕΡΓΑΖΟΜΕΝ" + _CAPITAL_GENIKH_A;
//                 typos_erg_aitiatikh = "εργαζόμεν" + _AITIATIKH_A;
//                 break;
//             case "2":
//                 apasxolhsh = "ΕΚ ΠΕΡΙΤΡΟΠΗΣ";
//                 typos = "εργαζόμεν" + _ONOMASTIKH_K;
//                 typos_erg = typos;
//                 typos_erg_genikh = "εργαζόμεν" + _GENIKH_A;
//                 typos_erg_genikh_capital = "ΕΡΓΑΖΟΜΕΝ" + _CAPITAL_GENIKH_A;
//                 typos_erg_aitiatikh = "εργαζόμεν" + _AITIATIKH_A;
//                 break;
//             default:
//                 apasxolhsh = "..........";
//                 typos = "..........";
//                 typos_erg = typos;
//                 typos_erg_genikh = typos;
//                 typos_erg_genikh_capital = typos;
//                 typos_erg_aitiatikh = typos;
//                 break;
//         }
        
//         const differenceInMonths = calculateMonthsDifference(
//             ergazomenos.hmeromhnia_allaghs_symbashs, 
//             ergazomenos.hmeromhnia_lhxhs_symbashs
//         );
//         let diarkeia = ".";
//         if (differenceInMonths !== 0) {
//             diarkeia = `, διάρκειας ${differenceInMonths} μηνών και η οποία λήγει την ${formatDate(ergazomenos.hmeromhnia_lhxhs_symbashs)}.`;
//         }
        
//         const hmeres_lektika = numberToText(parseInt(ergazomenos.hmeres_ergasias_ebdomadas || 0), '');
//         const ores_lektika = numberToText(parseInt(ergazomenos.ores_ergasias_ebdomadas || 0), '');
//         const currentYear = new Date().getFullYear();

//         const col1 = [];
//         const col2 = [];
//         const col3 = [];

//         const hotel0004Raw = (hotelParts?._HOTEL_0004 || "").trim();
//         const lines = hotel0004Raw ? hotel0004Raw.split("\n") : [];

//         for (const line of lines) {
//             const l = line.trim();
//             if (!l) continue; // skip empty lines

//             const parts = l.split("|");   // ✅ εδώ είναι η αλλαγή

//             col1.push((parts[0] || "").trimEnd());
//             col2.push((parts[1] || "").trim());
//             col3.push((parts[2] || "").trim());
//         }

//         const HOTEL_0004_COL1 = col1.join("\n");
//         const HOTEL_0004_COL2 = col2.join("\n");
//         const HOTEL_0004_COL3 = col3.join("\n");
        
//         // ✅ Prepare data object για το DOCX template
//         const data = {
//             _YEAR: currentYear,
//             _SXESH_ERGASIAS: sxeshErgasias?.perigrafh || "..........",
//             _KATHESTOS_APASXOLHSHS: apasxolhsh,
//             _POLH: poleis?.perigrafh || "..........",
//             _HMEROMHNIA_PROSLHPSHS: formatDate(ergazomenos.hmeromhnia_proslhpshs),
//             _HMEROMHNIA_LHXHS_SYMBASHS: formatDate(ergazomenos.hmeromhnia_lhxhs_symbashs),
            
//             _ETAIREIA: company.firstname == "" ? "εταιρεία" : "επιχείρηση",
//             _ERGODOTHS: company.firstname == "" ? "η εταιρεία" : "η εργοδότρια",
//             _ERGODOTHS_XORIS_ARTHRO: company.firstname == "" ? "εταιρεία" : "εργοδότρια",
//             _ERGODOTHS_CAPITAL_A: company.firstname == "" ? "Η εταιρεία" : "Η εργοδότρια",
//             _ERGODOTHS_GENIKH: company.firstname == "" ? "της εταιρείας" : "της εργοδότριας",
//             _ERGODOTHS_AITIATIKH: company.firstname == "" ? "την εταιρεία" : "την εργοδότρια",
//             _EPONYMIA: eponymia_Etairias,
//             _ODOS: company.odos ? company.odos.trim() : "..........",
//             _ARITHMOS: company.arithmos ? company.arithmos.trim() : ".....",
//             _AFM_ETAIREIAS: company.afm ? company.afm.trim() : "..........",
//             _DOY_ETAIREIAS: doy?.perigrafh ? doy.perigrafh.trim() : "..........",
//             _DIALLEIMA: ergazomenos.dialleima_se_lepta || 0,
//             _DIALLEIMA_LEKTIKA: numberToText(parseInt(ergazomenos.dialleima_se_lepta || 0), ''),
//             _EKTOS_ENTOS_ORARIOY: ergazomenos.dialleima_entos_ektos_orarioy ? "ΕΝΤΟΣ ΩΡΑΡΙΟΥ" : "ΕΚΤΟΣ ΩΡΑΡΙΟΥ",
            
//             _EPONYMO_EKPROSOPOY: nomimoiEkprosopoi?.eponymia 
//                 ? (nomimoiEkprosopoi.eponymia.endsWith("Σ") 
//                     ? nomimoiEkprosopoi.eponymia.slice(0, -1).trim() 
//                     : nomimoiEkprosopoi.eponymia).trim() 
//                 : "..........",
//             _ONOMA_EKPROSOPOY: nomimoiEkprosopoi?.onoma 
//                 ? (nomimoiEkprosopoi.onoma.endsWith("Σ") 
//                     ? nomimoiEkprosopoi.onoma.slice(0, -1).trim() 
//                     : nomimoiEkprosopoi.onoma).trim() 
//                 : "..........",
//             _PATRONYMO_EKPROSOPOY: nomimoiEkprosopoi.onoma_patera 
//                 ? (nomimoiEkprosopoi.onoma_patera.endsWith("ΟΣ") 
//                     ? nomimoiEkprosopoi.onoma_patera.slice(0, -2) + "ΟΥ"
//                     : nomimoiEkprosopoi.onoma_patera.endsWith("Σ") 
//                     ? nomimoiEkprosopoi.onoma_patera.slice(0, -1).trim() 
//                     : nomimoiEkprosopoi.onoma_patera).trim()
//                 : "..........",
//             _DT_EKPROSOPOY: nomimoiEkprosopoi.typos_taytothtas,
//             _ADT_EKPROSOPOY: nomimoiEkprosopoi.arithmos_taytothtas,
//             _AFM_EKPROSOPOY: nomimoiEkprosopoi.afm,
//             _THLEFONO_EKPROSOPOY: nomimoiEkprosopoi.thlefono,
//             _EMAIL_EKPROSOPOY: nomimoiEkprosopoi.email,
//             _CAPITAL_ONOMASTIKH_A,
//             _ONOMASTIKH_A,
//             _CAPITAL_ONOMASTIKH_K,
//             _ONOMASTIKH_K,
//             _CAPITAL_GENIKH_A,
//             _GENIKH_A,
//             _CAPITAL_AITIATIKH_A,
//             _AITIATIKH_A,
//             _ANTONYMIA_O, 
//             _ANTONYMIA_G, 
//             _ANTONYMIA_A,
            
//             _EPONYMIA_ERGAZOMENOY: (ergazomenos.eponymo || "") + " " + (ergazomenos.onoma || ""),
//             _PATRONYMO_ERGAZOMENOY: ergazomenos.patronymo 
//                 ? (ergazomenos.patronymo.endsWith("ΟΣ") 
//                     ? ergazomenos.patronymo.slice(0, -2) + "ΟΥ"
//                     : ergazomenos.patronymo.endsWith("Σ") 
//                     ? ergazomenos.patronymo.slice(0, -1).trim() 
//                     : ergazomenos.patronymo.endsWith("ΥΣ") 
//                     ? ergazomenos.patronymo.slice(0, -2) + "Α"
//                     : ergazomenos.patronymo).trim()
//                 : "..........",
//             _POLH_ERGAZOMENOY: polh?.perigrafh ? polh.perigrafh.trim() : "..........",
//             _ODOS_ERGAZOMENOY: ergazomenos.odos || "..........",
//             _ARITHMOS_ERGAZOMENOY: ergazomenos.arithmos || "..........",
//             _DT_ERGAZOMENOY: ergazomenos.typos_taytothtas || "..........",
//             _ADT_ERGAZOMENOY: ergazomenos.adt || "..........",
//             _AFM_ERGAZOMENOY: ergazomenos.afm || "..........",
//             _THLEFONO_ERGAZOMENOY: ergazomenos.thlefono || "..........",
//             _EMAIL_ERGAZOMENOY: ergazomenos.email || "..........",
//             _TYPOS_ERGAZOMENOY: typos,
//             _DIARKEIA: diarkeia,
            
//             _HMERES_LEKTIKA: hmeres_lektika,
//             _HMERES_APASXOLHSHS: ergazomenos.hmeres_ergasias_ebdomadas || "....",
//             _ORES_LEKTIKA: ores_lektika,
//             _ORES_APASXOLHSHS: ergazomenos.ores_ergasias_ebdomadas || "....",
//             _EYELIKTH_PROSELEYSH: ergazomenos.evelikth_proselefsh || '0',
//             _ANTIKEIMENO: antikeimeno_ergasion || "........................",
//             _XRONOS_KATABOLHS_APODOXON: xronos_katabolhs_apodoxon,
            
//             // ✅ Dynamic texts
//             _HOTEL,
//             _ADDITIONAL_CLAUSES,
//             _EPOXIKOTHTA: epoxikothta,

//             // ✅ NEW: χειροκίνητα placeholders για docx: {_HOTEL_0001}..{_HOTEL_0004}
//             // (ποτέ undefined — πάντα string)
            
//             _HOTEL_0001: hotelParts._HOTEL_0001 || "",
//             _HOTEL_0002: hotelParts._HOTEL_0002 || "",
//             _HOTEL_0003: hotelParts._HOTEL_0003 || "",
//             _HOTEL_0004_COL1: HOTEL_0004_COL1,
//             _HOTEL_0004_COL2: HOTEL_0004_COL2,
//             _HOTEL_0004_COL3: HOTEL_0004_COL3,
//             _HOTEL_0005: hotelParts._HOTEL_0005 || "",
//             _HOTEL_0006: hotelParts._HOTEL_0006 || "",
//             _HOTEL_0005: ergazomenos.dialleima_entos_ektos_orarioy
//                 ? (hotelParts._HOTEL_0005 || "")
//                 : "",
//             _HOTEL_0006: ergazomenos.dialleima_entos_ektos_orarioy
//                 ? ""
//                 : (hotelParts._HOTEL_0006 || ""),
//             _HOTEL_0007: hotelParts._HOTEL_0007 || "",

//             _TYPOS_ERG: typos_erg,
//             _TYPOS_ERG_GENIKH: typos_erg_genikh,
//             _TYPOS_ERG_GENIKH_CAPITAL: typos_erg_genikh_capital,
//             _TYPOS_ERG_AITIATIKH: typos_erg_aitiatikh,
//             _EIDIKOTHTA: eidikothta?.perigrafh || "..........",
            
//             _MIKTES_APODOXES: ergazomenos.synolo_symbashs_basei_oron_ergasias || 0,
//             _MIKTES_APODOXES_LEKTIKA: numberToText(
//                 parseFloat(ergazomenos.synolo_symbashs_basei_oron_ergasias || 0), ''
//             ),
//         };
        
//         // ✅ Generate DOCX
//         console.log('📝 Generating DOCX from template...');
//         const content = await fs.readFile(docxTemplatePath, 'binary');
//         const zip = new PizZip(content);
//         const doc = new Docxtemplater(zip, {
//             paragraphLoop: true,
//             linebreaks: true,
//         });
//         doc.render(data);
        
//         // Save temporary DOCX
//         const timestamp = Date.now();
//         const tempDocxPath = path.join(outputFolder, `contract_${ergazomenos.kodikos}_${timestamp}.docx`);
//         const updatedDocx = doc.getZip().generate({ type: 'nodebuffer' });
//         await fs.writeFile(tempDocxPath, updatedDocx);
        
//         console.log('✅ DOCX generated:', path.basename(tempDocxPath));
        
//         // ✅ Convert to PDF με LibreOffice
//         console.log('🔄 Converting DOCX to PDF with LibreOffice...');
        
//         // Detect LibreOffice path
//         const isWindows = process.platform === 'win32';
//         const libreOfficePath = isWindows
//             ? `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`
//             : `/usr/bin/libreoffice`;
        
//         const libreOfficeCommand = `${libreOfficePath} --headless --convert-to pdf "${tempDocxPath}" --outdir "${outputFolder}"`;
        
//         try {
//             await execAsync(libreOfficeCommand);
//         } catch (execError) {
//             console.error('❌ LibreOffice conversion failed:', execError);
//             throw new Error('PDF conversion failed');
//         }
        
//         const tempPdfPath = path.join(outputFolder, `contract_${ergazomenos.kodikos}_${timestamp}.pdf`);
        
//         // Verify PDF was created
//         if (!await fs.pathExists(tempPdfPath)) {
//             throw new Error('PDF file was not created');
//         }
        
//         console.log('✅ PDF generated:', path.basename(tempPdfPath));
        
//         // ✅ Upload to S3
//         console.log('☁️  Uploading PDF to S3...');
//         const { uploadBufferToS3 } = require('./s3Helper');
        
//         const s3Key = `contracts/${userContext.team}/${userContext.companyFolder}/employee_${ergazomenos.kodikos}_contract.pdf`;
        
//         const pdfBuffer = await fs.readFile(tempPdfPath);
//         await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');
        
//         console.log(`✅ PDF uploaded to S3: ${s3Key}`);
        
//         // Cleanup temp files
//         console.log('🧹 Cleaning up temporary files...');
//         try {
//             await fs.unlink(tempDocxPath);
//             await fs.unlink(tempPdfPath);
//             console.log('✅ Temporary files cleaned');
//         } catch (cleanupError) {
//             console.warn('⚠️ Failed to clean up temp files:', cleanupError.message);
//         }
        
//         console.log(`\n✅ ════════════════════════════════════════════════════════`);
//         console.log(`✅ Contract PDF generation complete!`);
//         console.log(`✅ S3 Key: ${s3Key}`);
//         console.log(`✅ ════════════════════════════════════════════════════════\n`);
        
//         return s3Key;
        
//     } catch (error) {
//         console.error('\n❌ ════════════════════════════════════════════════════════');
//         console.error('❌ Error generating contract PDF');
//         console.error('❌ ════════════════════════════════════════════════════════');
//         console.error('Error:', error.message);
//         console.error('Stack:', error.stack);
//         console.error('❌ ════════════════════════════════════════════════════════\n');
//         throw error;
//     }
// }

// module.exports = {
//     generateContractPDF
// };

/**
 * ============================================================================
 * contractGenerator.js - UPDATED with Dynamic Category System
 * ============================================================================
 * 
 * Δημιουργεί PDF σύμβασης για έναν εργαζόμενο
 * Καλείται από το postErgazomenoiForm μετά την αποθήκευση
 * 
 * ✅ NEW: Υποστηρίζει όλες τις ειδικές κατηγορίες αυτόματα
 */

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const { PDFDocument } = require("pdf-lib");

// Import text loader
const { loadTextsByCategory, combineTexts, CATEGORIES } = require('./textLoader');

// Import models
const Models_A = require("../models/stathera_arxeia");
const Models_C = require("../models/companies");

const { PoleisModel, 
        SxeseisErgasiasModel,
        DoyModel,
        EidikothtesEfarmoghsModel,
      } = Models_A; 

const { CompaniesModel,
        NomimoiEkprosopoiModel,
      } = Models_C;

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURATION - Environment-aware paths
// ============================================================================

const baseDir = process.cwd();

const docxTemplatePath = path.join(
    baseDir,
    'public',
    'templates',
    'ΑΡΧΙΚΗ ΣΥΜΒΑΣΗ ΕΡΓΑΖΟΜΕΝΩΝ.docx'
);

const outputFolder = path.join(baseDir, 'public', 'pdf');

// Ensure output folder exists at startup
fs.ensureDirSync(outputFolder);

// Verify template exists
if (!fs.existsSync(docxTemplatePath)) {
    console.error('❌ Template not found:', docxTemplatePath);
    console.error('   Please ensure the template file exists at this location.');
} else {
    console.log('✅ Template loaded:', docxTemplatePath);
}

console.log('📁 Output folder:', outputFolder);

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date) {
    if (!date) return "";
    let d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [day, month, year].join('/');
}

const calculateMonthsDifference = (startDate, endDate) => {
    if (!endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const yearsDifference = end.getFullYear() - start.getFullYear();
    const monthsDifference = end.getMonth() - start.getMonth();
    return yearsDifference * 12 + monthsDifference;
};

const numbersToWords = (n) => {
    const ones = ['', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα', 'δέκα', 
        'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεπτά', 'δεκαοκτώ', 'δεκαεννέα'];
    const tens = ['', '', 'είκοσι', 'τριάντα', 'σαράντα', 'πενήντα', 'εξήντα', 'εβδομήντα', 'ογδόντα', 'ενενήντα'];
    
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    
    if (n < 1000) {
        const hundreds = Math.floor(n / 100);
        const remainder = n % 100;
        const hundredsText = 
        hundreds === 1 ? 'εκατό' + (remainder ? 'ν' : '') :
        hundreds === 2 ? 'διακόσια' :
        hundreds === 3 ? 'τριακόσια' :
        hundreds === 4 ? 'τετρακόσια' :
        hundreds === 5 ? 'πεντακόσια' :
        hundreds === 6 ? 'εξακόσια' :
        hundreds === 7 ? 'επτακόσια' :
        hundreds === 8 ? 'οκτακόσια' :
        hundreds === 9 ? 'εννιακόσια' : '';
        return hundredsText + (remainder ? ' ' + numbersToWords(remainder) : '');
    }

    if (n < 1000000) {
        return numbersToWords(Math.floor(n / 1000)) + ' χιλιάδες' + 
             (n % 1000 ? ' ' + numbersToWords(n % 1000) : '');
    }
  
    return numbersToWords(Math.floor(n / 1000000)) + ' εκατομμύρια' + 
        (n % 1000000 ? ' ' + numbersToWords(n % 1000000) : '');
};

const numberToText = (num, type = 'money') => {
    const whole = Math.floor(num); 
    const decimal = Math.round((num - whole) * 100); 
    let wholeText = numbersToWords(whole);
    let decimalText = decimal > 0 ? numbersToWords(decimal) : '';

    switch(type) {
        case 'money':
            return decimalText 
                ? `${wholeText} ευρώ και ${decimalText} λεπτά` 
                : `${wholeText} ευρώ`;
        case 'time':
            return decimalText 
                ? `${wholeText} ώρες και ${decimalText} λεπτά` 
                : `${wholeText} ώρες`;
        default:
            return decimalText 
                ? `${wholeText} και ${decimalText}` 
                : `${wholeText}`;
    }
};

// ============================================================================
// ✅ NEW: Dynamic Category Placeholder Generation
// ============================================================================

/**
 * Δημιουργεί placeholders για όλα τα templates μιας κατηγορίας
 * 
 * @param {Object} categoryParts - Templates object από loadTextsByCategory
 * @param {Object} ergazomenos - Employee data
 * @returns {Object} Placeholders για DOCX
 * 
 * ΠΑΡΑΔΕΙΓΜΑ:
 * Input: { "_HOTEL_0001": "text1", "_HOTEL_0002": "text2", "_HOTEL_0004": "col1|col2|col3" }
 * Output: { 
 *   "_HOTEL_0001": "text1",
 *   "_HOTEL_0002": "text2",
 *   "_HOTEL_0004_COL1": "col1",
 *   "_HOTEL_0004_COL2": "col2",
 *   "_HOTEL_0004_COL3": "col3"
 * }
 */
function generateCategoryPlaceholders(categoryParts, ergazomenos) {
    const placeholders = {};
    
    // 1️⃣ Βασικά placeholders (απλά templates)
    for (const [key, value] of Object.entries(categoryParts)) {
        placeholders[key] = value || "";
    }
    
    // 2️⃣ Special handling για _XXXX_0004 (πίνακες με columns)
    for (const [key, value] of Object.entries(categoryParts)) {
        if (key.endsWith('_0004')) {
            const cols = parseTableColumns(value);
            const prefix = key.replace('_0004', '');
            
            placeholders[`${prefix}_0004_COL1`] = cols.col1;
            placeholders[`${prefix}_0004_COL2`] = cols.col2;
            placeholders[`${prefix}_0004_COL3`] = cols.col3;
        }
    }
    
    // 3️⃣ Special handling για _XXXX_0005 & _XXXX_0006 (conditional - διάλειμμα)
    for (const [key, value] of Object.entries(categoryParts)) {
        if (key.endsWith('_0005')) {
            const prefix = key.replace('_0005', '');
            // Εμφανίζεται ΜΟΝΟ αν το διάλειμμα είναι ΕΝΤΟΣ ωραρίου
            placeholders[`${prefix}_0005`] = ergazomenos.dialleima_entos_ektos_orarioy ? value : "";
        }
        if (key.endsWith('_0006')) {
            const prefix = key.replace('_0006', '');
            // Εμφανίζεται ΜΟΝΟ αν το διάλειμμα είναι ΕΚΤΟΣ ωραρίου
            placeholders[`${prefix}_0006`] = ergazomenos.dialleima_entos_ektos_orarioy ? "" : value;
        }
    }
    
    return placeholders;
}

/**
 * Κάνει parse πίνακα με columns (format: "col1|col2|col3")
 * 
 * @param {string} text - Raw text με | separators
 * @returns {Object} { col1, col2, col3 }
 */
function parseTableColumns(text) {
    const col1 = [];
    const col2 = [];
    const col3 = [];
    const col4 = [];
    
    const lines = (text || "").trim().split("\n");
    
    for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        
        const parts = l.split("|");
        col1.push((parts[0] || "").trimEnd());
        col2.push((parts[1] || "").trim());
        col3.push((parts[2] || "").trim());
        col4.push((parts[3] || "").trim());
    }
    
    return {
        col1: col1.join("\n"),
        col2: col2.join("\n"),
        col3: col3.join("\n"),
        col4: col4.join("\n")
    };
}

// ============================================================================
// Main Function: Generate Contract PDF
// ============================================================================

/**
 * Δημιουργεί PDF σύμβασης για έναν εργαζόμενο
 * 
 * @param {Object} ergazomenos - Το document του εργαζόμενου από MongoDB
 * @param {Object} userContext - { team, companyFolder }
 * @returns {Promise<string>} - S3 key του generated PDF
 */
async function generateContractPDF(ergazomenos, userContext) {
    try {
        console.log(`\n📄 ════════════════════════════════════════════════════════`);
        console.log(`📄 Generating contract PDF`);
        console.log(`📄 Employee: ${ergazomenos.onoma} ${ergazomenos.eponymo}`);
        console.log(`📄 Code: ${ergazomenos.kodikos}`);
        console.log(`📄 Category: ${ergazomenos.eidikh_kathgoria_ergazomenoy || 'N/A'}`);
        console.log(`📄 ════════════════════════════════════════════════════════\n`);
        
        // Ensure output folder exists
        await fs.ensureDir(outputFolder);
        
        // Verify template exists
        if (!await fs.pathExists(docxTemplatePath)) {
            throw new Error(`Template file not found: ${docxTemplatePath}`);
        }
        
        // Fetch company data
        const company = await CompaniesModel.findOne({ _id: ergazomenos.company_kod }).lean();
        if (!company) {
            throw new Error('Company not found');
        }
        
        const poleis = await PoleisModel.findOne({ kodikos: company.polh }).lean();
        const doy = await DoyModel.findOne({ kodikos: company.doy_company }).lean();
        const nomimoiEkprosopoi = await NomimoiEkprosopoiModel.findOne({ 
            companykod_object: ergazomenos.company_kod, 
            kodikos: "0001" 
        }).lean();
        
        // Company name
        let eponymia_Etairias = (company.eponymia ? company.eponymia.trim() : "") + " " 
                                + (company.fathername ? company.fathername.substring(0, 3).trim() : "") + " " 
                                + (company.firstname ? company.firstname.trim() : "");
        
        // Gender-based variables
        const _CAPITAL_ONOMASTIKH_A = ergazomenos.fylo ? "Η"  : "Ο" ;
        const _CAPITAL_ONOMASTIKH_K = ergazomenos.fylo ? "Η"  : "ΟΣ";
        const _CAPITAL_GENIKH_A     = ergazomenos.fylo ? "ΗΣ" : "ΟΥ";
        const _CAPITAL_AITIATIKH_A  = ergazomenos.fylo ? "ΗΝ" : "ΟΝ";
        const _ONOMASTIKH_A         = ergazomenos.fylo ? "η"  : "ο" ;
        const _ONOMASTIKH_K         = ergazomenos.fylo ? "η"  : "ος";
        const _GENIKH_A             = ergazomenos.fylo ? "ης" : "ου";
        const _AITIATIKH_A          = ergazomenos.fylo ? "ην" : "ον";
        const _ANTONYMIA_O          = ergazomenos.fylo ? "ή"  : "ός";
        const _ANTONYMIA_G          = ergazomenos.fylo ? "ής" : "ού";
        const _ANTONYMIA_A          = ergazomenos.fylo ? "ήν" : "όν";
        
        // ✅ NEW: Load dynamic texts (UNIVERSAL για όλες τις κατηγορίες)
        let categoryParts = {};
        let _COMBINED_TEXT = "";
        
        if (ergazomenos.eidikh_kathgoria_ergazomenoy && userContext) {
            try {
                console.log(`📚 Loading templates for category: ${ergazomenos.eidikh_kathgoria_ergazomenoy}`);
                
                const templates = loadTextsByCategory(
                    userContext.team,
                    userContext.companyFolder,
                    CATEGORIES.SYMBASH,
                    ergazomenos.eidikh_kathgoria_ergazomenoy
                );

                categoryParts = templates || {};
                
                if (Object.keys(templates).length > 0) {
                    _COMBINED_TEXT = combineTexts(templates);
                    console.log(`✅ Loaded ${Object.keys(templates).length} templates (${_COMBINED_TEXT.length} chars)`);
                    console.log(`📋 Template keys: ${Object.keys(templates).join(', ')}`);
                } else {
                    console.warn(`⚠️ No templates found for category ${ergazomenos.eidikh_kathgoria_ergazomenoy}`);
                }
            } catch (error) {
                console.error('❌ Error loading dynamic texts:', error);
                categoryParts = {};
            }
        }
        
        // Epoxikothta
        let epoxikothta = "";
        if (ergazomenos.epoxikos) {
            epoxikothta = "Συμφωνείται ότι, λόγω εποχικότητας και ειδικών συνθηκών λειτουργίας της μονάδας, να χορηγείται τμήμα της άδειας κατά τις περιόδους που υπάρχει περιορισμένη ή και ανύπαρκτη πληρότητα (νεκρή περίοδο).";
        }
        
        // Fetch related data
        const polh = await PoleisModel.findOne({ kodikos: ergazomenos.polh }).lean();
        const eidikothta = await EidikothtesEfarmoghsModel.findOne({ kodikos: ergazomenos.eidikothta }).lean();
        const sxeshErgasias = await SxeseisErgasiasModel.findOne({ kodikos: ergazomenos.sxesh_ergasias}).lean();
        
        // Apasxolhsh logic
        let apasxolhsh, typos, typos_erg, typos_erg_genikh, typos_erg_genikh_capital, typos_erg_aitiatikh;
        
        switch (ergazomenos.kathestos_apasxolhshs) {
            case "0":
                apasxolhsh = "ΠΛΗΡΟΥΣ";
                typos = "μισθωτός";
                typos_erg = typos;
                typos_erg_genikh = "μισθωτού";
                typos_erg_genikh_capital = "ΜΙΣΘΩΤΟΥ";
                typos_erg_aitiatikh = "μισθωτό";
                break;
            case "1":
                apasxolhsh = "ΜΕΡΙΚΗΣ";
                typos = "εργαζόμεν" + _ONOMASTIKH_K;
                typos_erg = typos;
                typos_erg_genikh = "εργαζόμεν" + _GENIKH_A;
                typos_erg_genikh_capital = "ΕΡΓΑΖΟΜΕΝ" + _CAPITAL_GENIKH_A;
                typos_erg_aitiatikh = "εργαζόμεν" + _AITIATIKH_A;
                break;
            case "2":
                apasxolhsh = "ΕΚ ΠΕΡΙΤΡΟΠΗΣ";
                typos = "εργαζόμεν" + _ONOMASTIKH_K;
                typos_erg = typos;
                typos_erg_genikh = "εργαζόμεν" + _GENIKH_A;
                typos_erg_genikh_capital = "ΕΡΓΑΖΟΜΕΝ" + _CAPITAL_GENIKH_A;
                typos_erg_aitiatikh = "εργαζόμεν" + _AITIATIKH_A;
                break;
            default:
                apasxolhsh = "..........";
                typos = "..........";
                typos_erg = typos;
                typos_erg_genikh = typos;
                typos_erg_genikh_capital = typos;
                typos_erg_aitiatikh = typos;
                break;
        }
        
        const differenceInMonths = calculateMonthsDifference(
            ergazomenos.hmeromhnia_allaghs_symbashs, 
            ergazomenos.hmeromhnia_lhxhs_symbashs
        );
        let diarkeia = ".";
        if (differenceInMonths !== 0) {
            diarkeia = `, διάρκειας ${differenceInMonths} μηνών και η οποία λήγει την ${formatDate(ergazomenos.hmeromhnia_lhxhs_symbashs)}.`;
        }
        
        const hmeres_lektika = numberToText(parseInt(ergazomenos.hmeres_ergasias_ebdomadas || 0), '');
        const ores_lektika = numberToText(parseInt(ergazomenos.ores_ergasias_ebdomadas || 0), '');
        const currentYear = new Date().getFullYear();

        // ✅ Prepare data object για το DOCX template
        const data = {
            _YEAR: currentYear,
            _SXESH_ERGASIAS: sxeshErgasias?.perigrafh || "..........",
            _KATHESTOS_APASXOLHSHS: apasxolhsh,
            _POLH: poleis?.perigrafh || "..........",
            _HMEROMHNIA_PROSLHPSHS: formatDate(ergazomenos.hmeromhnia_proslhpshs),
            _HMEROMHNIA_LHXHS_SYMBASHS: formatDate(ergazomenos.hmeromhnia_lhxhs_symbashs),
            
            _ETAIREIA: company.firstname == "" ? "εταιρεία" : "επιχείρηση",
            _ERGODOTHS: company.firstname == "" ? "η εταιρεία" : "η εργοδότρια",
            _ERGODOTHS_XORIS_ARTHRO: company.firstname == "" ? "εταιρεία" : "εργοδότρια",
            _ERGODOTHS_CAPITAL_A: company.firstname == "" ? "Η εταιρεία" : "Η εργοδότρια",
            _ERGODOTHS_GENIKH: company.firstname == "" ? "της εταιρείας" : "της εργοδότριας",
            _ERGODOTHS_AITIATIKH: company.firstname == "" ? "την εταιρεία" : "την εργοδότρια",
            _EPONYMIA: eponymia_Etairias,
            _ODOS: company.odos ? company.odos.trim() : "..........",
            _ARITHMOS: company.arithmos ? company.arithmos.trim() : ".....",
            _AFM_ETAIREIAS: company.afm ? company.afm.trim() : "..........",
            _DOY_ETAIREIAS: doy?.perigrafh ? doy.perigrafh.trim() : "..........",
            _DIALLEIMA: ergazomenos.dialleima_se_lepta || 0,
            _DIALLEIMA_LEKTIKA: numberToText(parseInt(ergazomenos.dialleima_se_lepta || 0), ''),
            _EKTOS_ENTOS_ORARIOY: ergazomenos.dialleima_entos_ektos_orarioy ? "ΕΝΤΟΣ ΩΡΑΡΙΟΥ" : "ΕΚΤΟΣ ΩΡΑΡΙΟΥ",
            
            _EPONYMO_EKPROSOPOY: nomimoiEkprosopoi?.eponymia 
                ? (nomimoiEkprosopoi.eponymia.endsWith("Σ") 
                    ? nomimoiEkprosopoi.eponymia.slice(0, -1).trim() 
                    : nomimoiEkprosopoi.eponymia).trim() 
                : "..........",
            _ONOMA_EKPROSOPOY: nomimoiEkprosopoi?.onoma 
                ? (nomimoiEkprosopoi.onoma.endsWith("Σ") 
                    ? nomimoiEkprosopoi.onoma.slice(0, -1).trim() 
                    : nomimoiEkprosopoi.onoma).trim() 
                : "..........",
            _PATRONYMO_EKPROSOPOY: nomimoiEkprosopoi.onoma_patera 
                ? (nomimoiEkprosopoi.onoma_patera.endsWith("ΟΣ") 
                    ? nomimoiEkprosopoi.onoma_patera.slice(0, -2) + "ΟΥ"
                    : nomimoiEkprosopoi.onoma_patera.endsWith("Σ") 
                    ? nomimoiEkprosopoi.onoma_patera.slice(0, -1).trim() 
                    : nomimoiEkprosopoi.onoma_patera).trim()
                : "..........",
            _DT_EKPROSOPOY: nomimoiEkprosopoi.typos_taytothtas,
            _ADT_EKPROSOPOY: nomimoiEkprosopoi.arithmos_taytothtas,
            _AFM_EKPROSOPOY: nomimoiEkprosopoi.afm,
            _THLEFONO_EKPROSOPOY: nomimoiEkprosopoi.thlefono,
            _EMAIL_EKPROSOPOY: nomimoiEkprosopoi.email,
            _CAPITAL_ONOMASTIKH_A,
            _ONOMASTIKH_A,
            _CAPITAL_ONOMASTIKH_K,
            _ONOMASTIKH_K,
            _CAPITAL_GENIKH_A,
            _GENIKH_A,
            _CAPITAL_AITIATIKH_A,
            _AITIATIKH_A,
            _ANTONYMIA_O, 
            _ANTONYMIA_G, 
            _ANTONYMIA_A,
            
            _EPONYMIA_ERGAZOMENOY: (ergazomenos.eponymo || "") + " " + (ergazomenos.onoma || ""),
            _PATRONYMO_ERGAZOMENOY: ergazomenos.patronymo 
                ? (ergazomenos.patronymo.endsWith("ΟΣ") 
                    ? ergazomenos.patronymo.slice(0, -2) + "ΟΥ"
                    : ergazomenos.patronymo.endsWith("Σ") 
                    ? ergazomenos.patronymo.slice(0, -1).trim() 
                    : ergazomenos.patronymo.endsWith("ΥΣ") 
                    ? ergazomenos.patronymo.slice(0, -2) + "Α"
                    : ergazomenos.patronymo).trim()
                : "..........",
            _POLH_ERGAZOMENOY: polh?.perigrafh ? polh.perigrafh.trim() : "..........",
            _ODOS_ERGAZOMENOY: ergazomenos.odos || "..........",
            _ARITHMOS_ERGAZOMENOY: ergazomenos.arithmos || "..........",
            _DT_ERGAZOMENOY: ergazomenos.typos_taytothtas || "..........",
            _ADT_ERGAZOMENOY: ergazomenos.adt || "..........",
            _AFM_ERGAZOMENOY: ergazomenos.afm || "..........",
            _THLEFONO_ERGAZOMENOY: ergazomenos.thlefono || "..........",
            _EMAIL_ERGAZOMENOY: ergazomenos.email || "..........",
            _TYPOS_ERGAZOMENOY: typos,
            _DIARKEIA: diarkeia,
            
            _HMERES_LEKTIKA: hmeres_lektika,
            _HMERES_APASXOLHSHS: ergazomenos.hmeres_ergasias_ebdomadas || "....",
            _ORES_LEKTIKA: ores_lektika,
            _ORES_APASXOLHSHS: ergazomenos.ores_ergasias_ebdomadas || "....",
            _EYELIKTH_PROSELEYSH: ergazomenos.evelikth_proselefsh || '0',
            
            // ✅ NEW: Universal category system
            _COMBINED_TEXT,  // Όλα τα templates μαζί
            
            // ✅ Backward compatibility
            _HOTEL: _COMBINED_TEXT,  // Για παλιά templates που χρησιμοποιούν {_HOTEL}
            _ADDITIONAL_CLAUSES: "",
            _EPOXIKOTHTA: epoxikothta,
            
            // ✅ Dynamic placeholders για ΟΛΕΣ τις κατηγορίες
            ...generateCategoryPlaceholders(categoryParts, ergazomenos),
            
            _TYPOS_ERG: typos_erg,
            _TYPOS_ERG_GENIKH: typos_erg_genikh,
            _TYPOS_ERG_GENIKH_CAPITAL: typos_erg_genikh_capital,
            _TYPOS_ERG_AITIATIKH: typos_erg_aitiatikh,
            _EIDIKOTHTA: eidikothta?.perigrafh || "..........",
            
            _MIKTES_APODOXES: ergazomenos.synolo_symbashs_basei_oron_ergasias || 0,
            _MIKTES_APODOXES_LEKTIKA: numberToText(
                parseFloat(ergazomenos.synolo_symbashs_basei_oron_ergasias || 0), ''
            ),
        };
        
        // ✅ Generate DOCX
        console.log('📝 Generating DOCX from template...');
        const content = await fs.readFile(docxTemplatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });
        doc.render(data);
        
        // Save temporary DOCX
        const timestamp = Date.now();
        const tempDocxPath = path.join(outputFolder, `contract_${ergazomenos.kodikos}_${timestamp}.docx`);
        const updatedDocx = doc.getZip().generate({ type: 'nodebuffer' });
        await fs.writeFile(tempDocxPath, updatedDocx);
        
        console.log('✅ DOCX generated:', path.basename(tempDocxPath));
        
        // ✅ Convert to PDF με LibreOffice
        console.log('🔄 Converting DOCX to PDF with LibreOffice...');
        
        // Detect LibreOffice path
        const isWindows = process.platform === 'win32';
        const libreOfficePath = isWindows
            ? `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`
            : `/usr/bin/libreoffice`;
        
        const libreOfficeCommand = `${libreOfficePath} --headless --convert-to pdf "${tempDocxPath}" --outdir "${outputFolder}"`;
        
        try {
            await execAsync(libreOfficeCommand);
        } catch (execError) {
            console.error('❌ LibreOffice conversion failed:', execError);
            throw new Error('PDF conversion failed');
        }
        
        const tempPdfPath = path.join(outputFolder, `contract_${ergazomenos.kodikos}_${timestamp}.pdf`);
        
        // Verify PDF was created
        if (!await fs.pathExists(tempPdfPath)) {
            throw new Error('PDF file was not created');
        }
        
        console.log('✅ PDF generated:', path.basename(tempPdfPath));
        
        // ✅ Upload to S3
        console.log('☁️  Uploading PDF to S3...');
        const { uploadBufferToS3 } = require('./s3Helper');
        
        const s3Key = `contracts/${userContext.team}/${userContext.companyFolder}/employee_${ergazomenos.kodikos}_contract.pdf`;
        
        const pdfBuffer = await fs.readFile(tempPdfPath);
        await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');
        
        console.log(`✅ PDF uploaded to S3: ${s3Key}`);
        
        // Cleanup temp files
        console.log('🧹 Cleaning up temporary files...');
        try {
            await fs.unlink(tempDocxPath);
            await fs.unlink(tempPdfPath);
            console.log('✅ Temporary files cleaned');
        } catch (cleanupError) {
            console.warn('⚠️ Failed to clean up temp files:', cleanupError.message);
        }
        
        console.log(`\n✅ ════════════════════════════════════════════════════════`);
        console.log(`✅ Contract PDF generation complete!`);
        console.log(`✅ S3 Key: ${s3Key}`);
        console.log(`✅ ════════════════════════════════════════════════════════\n`);
        
        return s3Key;
        
    } catch (error) {
        console.error('\n❌ ════════════════════════════════════════════════════════');
        console.error('❌ Error generating contract PDF');
        console.error('❌ ════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('❌ ════════════════════════════════════════════════════════\n');
        throw error;
    }
}

module.exports = {
    generateContractPDF
};