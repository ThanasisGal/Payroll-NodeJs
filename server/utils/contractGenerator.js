/**
 * ============================================================================
 * contractGenerator.js - FINAL WORKING VERSION WITH TABLE AS TEXT
 * ============================================================================
 * 
 * Δημιουργεί PDF σύμβασης για έναν εργαζόμενο
 * Καλείται από το postErgazomenoiForm μετά την αποθήκευση
 * 
 * ✅ FIXED: Table rendered as formatted text (NOT array loops)
 * ✅ FIXED: All placeholders validated
 * ✅ FIXED: Safe dynamic placeholder generation
 */

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const { PDFDocument, rgb } = require("pdf-lib");

const { loadTextsByCategory, combineTexts, CATEGORIES } = require('./textLoader');

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
}

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
// ✅ FIXED: Parse Table as Formatted Text String
// ============================================================================

/**
 * Κάνει parse πίνακα και επιστρέφει formatted string με fixed-width columns
 * @param {string} text - Raw text με | separators
 * @returns {string} Formatted table as text
 */
// ✅ Helper function: Word wrap
function wordWrap(text, maxWidth) {
    if (!text) return '';
    if (text.length <= maxWidth) return text;
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        
        if (testLine.length <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) {
                lines.push(currentLine);
            }
            
            if (word.length > maxWidth) {
                currentLine = word.substring(0, maxWidth - 3) + '...';
            } else {
                currentLine = word;
            }
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines.join('\n');
}

/**
 * Parse table με bullets και word-wrap
 */
function parseTableColumns(text) {
    const lines = (text || "").trim().split("\n");
    const formattedRows = [];
    
    const MAX_COL1_WIDTH = 55;
    const BULLET = '• '; // ✅ Bullet character (change this for different styles)
    const INDENT = '  '; // ✅ Indent για wrapped lines
    
    for (const line of lines) {
        const l = line.trim();
        if (!l || !l.includes('|')) continue;
        
        const parts = l.split("|");
        
        // Word-wrap col1
        const col1Text = (parts[0] || "").trim();
        const col1Wrapped = wordWrap(col1Text, MAX_COL1_WIDTH);
        
        // Add bullet to first line only
        const col1Lines = col1Wrapped.split('\n');
        const col1WithBullet = col1Lines.map((line, index) => {
            return (index === 0) ? BULLET + line : INDENT + line;
        }).join('\n');
        
        const row = [
            col1WithBullet,
            (parts[1] || "").trim(),
            (parts[2] || "").trim(),
            (parts[3] || "").trim()
        ].join('\t');
        
        formattedRows.push(row);
    }
    
    const result = formattedRows.join('\n');
    
    if (formattedRows.length > 0) {
        console.log(`   📊 Table: ${formattedRows.length} rows with bullets`);
    }
    
    return result;
}


// ============================================================================
// Image Insertion Helpers (από ektyposhSymbaseonController.js)
// ============================================================================

/**
 * Find text position in PDF
 */
async function findTextInPdf(pdfPath, searchText) {
    const pdfjsLib = require("pdfjs-dist");

    let position = null;
    const loadingTask = pdfjsLib.getDocument(pdfPath);
    const pdf = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        for (const item of textContent.items) {
            if (item.str.includes(searchText)) {
                console.log(`📍 Found text "${searchText}" on page ${pageNum}`);
                position = {
                    pageIndex: pageNum,
                    x: item.transform[4],
                    y: item.transform[5],
                    width: 120,
                    height: 70
                };
                break;
            }
        }
        if (position) break;
    }
    
    return position;
}

/**
 * Replace text with image in PDF
 */
async function replaceTextWithImage(pdfPath, outputPath, imageBase64, position) {
    if (!position) {
        console.log("⚠️ Text position not found, skipping image insertion");
        return false;
    }
    
    try {
        const existingPdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        
        // Decode base64 image
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Buffer.from(base64Data, 'base64');
        
        // Embed image (support PNG and JPG)
        let image;
        try {
            image = await pdfDoc.embedPng(imageBytes);
        } catch (pngError) {
            try {
                image = await pdfDoc.embedJpg(imageBytes);
            } catch (jpgError) {
                console.error('❌ Failed to embed image (not PNG or JPG)');
                return false;
            }
        }
        
        const page = pdfDoc.getPages()[position.pageIndex - 1];
        
        // Cover text with white rectangle
        page.drawRectangle({
            x: position.x,
            y: position.y,
            width: position.width + 5,
            height: 10,
            color: rgb(1, 1, 1),
            opacity: 1
        });
        
        // Draw image
        page.drawImage(image, {
            x: position.x,
            y: position.y - position.height + 28.35,
            width: position.width,
            height: position.height
        });
        
        const pdfBytesModified = await pdfDoc.save();
        await fs.writeFile(outputPath, pdfBytesModified);
        
        console.log('✅ Image inserted successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error replacing text with image:', error.message);
        return false;
    }
}





/**
 * Δημιουργεί placeholders για όλα τα templates μιας κατηγορίας
 * ✅ Tables rendered as formatted text (NOT arrays)
 * 
 * @param {Object} categoryParts - Templates object από loadTextsByCategory
 * @param {Object} ergazomenos - Employee data
 * @returns {Object} Placeholders για DOCX
 */
function generateCategoryPlaceholders(categoryParts, ergazomenos) {
    const placeholders = {};
    
    // ✅ Validation
    if (!categoryParts || typeof categoryParts !== 'object') {
        console.warn('⚠️ generateCategoryPlaceholders: categoryParts is invalid');
        return placeholders;
    }
    
    if (Object.keys(categoryParts).length === 0) {
        console.log('ℹ️ No category templates to process');
        return placeholders;
    }
    
    console.log(`🔧 Processing ${Object.keys(categoryParts).length} category templates...`);
    
    try {
        // 1️⃣ Βασικά placeholders (απλά templates)
        for (const [key, value] of Object.entries(categoryParts)) {
            if (key && typeof key === 'string' && key.trim().length > 0) {
                // Skip _0004 keys (handled separately)
                if (!key.endsWith('_0004')) {
                    placeholders[key] = (value !== undefined && value !== null) ? String(value) : "";
                }
            }
        }
        
        // 2️⃣ Special handling για _XXXX_0004 (πίνακες - as formatted text)
        let hasTable = false;
        for (const [key, value] of Object.entries(categoryParts)) {
            if (key && key.endsWith('_0004')) {
                try {
                    const tableText = parseTableColumns(value);
                    const prefix = key.replace('_0004', '');
                    
                    // ✅ Store as STRING (simple text replacement)
                    placeholders[`${prefix}_0004_TABLE`] = tableText || "";
                    
                    hasTable = tableText && tableText.length > 0;
                    
                    const rowCount = tableText ? tableText.split('\n').length : 0;
                    console.log(`   ✅ Table: ${key} → ${rowCount} rows, ${tableText.length} chars`);
                } catch (error) {
                    console.error(`   ❌ Error parsing table ${key}:`, error.message);
                }
            }
        }
        
        // 3️⃣ Special handling για _XXXX_0005 & _XXXX_0006 (conditional - διάλειμμα)
        for (const [key, value] of Object.entries(categoryParts)) {
            if (key && key.endsWith('_0005')) {
                const prefix = key.replace('_0005', '');
                const shouldShow = ergazomenos && ergazomenos.dialleima_entos_ektos_orarioy === true;
                placeholders[`${prefix}_0005`] = shouldShow ? (value || "") : "";
                
                if (shouldShow) {
                    console.log(`   ✅ Conditional: ${prefix}_0005 → SHOWN (διάλειμμα ΕΝΤΟΣ)`);
                }
            }
            
            if (key && key.endsWith('_0006')) {
                const prefix = key.replace('_0006', '');
                const shouldShow = ergazomenos && ergazomenos.dialleima_entos_ektos_orarioy === false;
                placeholders[`${prefix}_0006`] = shouldShow ? (value || "") : "";
                
                if (shouldShow) {
                    console.log(`   ✅ Conditional: ${prefix}_0006 → SHOWN (διάλειμμα ΕΚΤΟΣ)`);
                }
            }
        }
        
        // 4️⃣ ✅ Set _SHOW_TABLE flag
        placeholders._SHOW_TABLE = hasTable;
        
        if (hasTable) {
            console.log(`   ✅ _SHOW_TABLE = true`);
        } else {
            console.log(`   ℹ️ _SHOW_TABLE = false`);
        }
        
        console.log(`✅ Generated ${Object.keys(placeholders).length} dynamic placeholders`);
        
        return placeholders;
        
    } catch (error) {
        console.error('❌ Error in generateCategoryPlaceholders:', error);
        return {};
    }
}

// ============================================================================
// Main Function: Generate Contract PDF
// ============================================================================

async function generateContractPDF(ergazomenos, userContext) {
    try {
        console.log(`\n📄 ════════════════════════════════════════════════════════`);
        console.log(`📄 Generating contract PDF`);
        console.log(`📄 Employee: ${ergazomenos.onoma} ${ergazomenos.eponymo}`);
        console.log(`📄 Code: ${ergazomenos.kodikos}`);
        console.log(`📄 Category: ${ergazomenos.eidikh_kathgoria_ergazomenoy || 'N/A'}`);
        console.log(`📄 ════════════════════════════════════════════════════════\n`);
        
        await fs.ensureDir(outputFolder);
        
        if (!await fs.pathExists(docxTemplatePath)) {
            throw new Error(`Template file not found: ${docxTemplatePath}`);
        }
        
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
        
        let eponymia_Etairias = (company.eponymia ? company.eponymia.trim() : "") + " " 
                                + (company.fathername ? company.fathername.substring(0, 3).trim() : "") + " " 
                                + (company.firstname ? company.firstname.trim() : "");
        
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
                } else {
                    console.warn(`⚠️ No templates found for category ${ergazomenos.eidikh_kathgoria_ergazomenoy}`);
                }
            } catch (error) {
                console.error('❌ Error loading dynamic texts:', error);
                categoryParts = {};
            }
        }
        
        let epoxikothta = "";
        if (ergazomenos.epoxikos) {
            epoxikothta = "Συμφωνείται ότι, λόγω εποχικότητας και ειδικών συνθηκών λειτουργίας της μονάδας, να χορηγείται τμήμα της άδειας κατά τις περιόδους που υπάρχει περιορισμένη ή και ανύπαρκτη πληρότητα (νεκρή περίοδο).";
        }
        
        const polh = await PoleisModel.findOne({ kodikos: ergazomenos.polh }).lean();
        const eidikothta = await EidikothtesEfarmoghsModel.findOne({ kodikos: ergazomenos.eidikothta }).lean();
        const sxeshErgasias = await SxeseisErgasiasModel.findOne({ kodikos: ergazomenos.sxesh_ergasias}).lean();
        
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
            _ERGODOTHS_GENIKH: company.firstname == "" ? "της εταιρείας" : "των εργοδότριας",
            _ERGODOTHS_AITIATIKH: company.firstname == "" ? "την εταιρεία" : "την εργοδότρια",
            _EPONYMIA: eponymia_Etairias,
            _ODOS: company.odos ? company.odos.trim() : "..........",
            _ARITHMOS: company.arithmos ? company.arithmos.trim() : ".....",
            _AFM_ETAIREIAS: company.afm ? company.afm.trim() : "..........",
            _DOY_ETAIREIAS: doy?.perigrafh ? doy.perigrafh.trim() : "..........",
            _DIALLEIMA: ergazomenos.dialleima_se_lepta || 0,
            _DIALLEIMA_LEKTIKA: numberToText(parseInt(ergazomenos.dialleima_se_lepta || 0), ''),
            _EKTOS_ENTOS_ORARIOY: ergazomenos.dialleima_entos_ektos_orarioy ? "ΕΝΤΟΣ ΩΡΑΡΙΟΥ" : "ΕΚΤΟΣ ΩΡΑΡΙΟΥ",

            _YPOGRAFON_EKPROSOPOS: nomimoiEkprosopoi.eponymia.trim() + " " + nomimoiEkprosopoi.onoma.trim(),

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
            _PATRONYMO_EKPROSOPOY: nomimoiEkprosopoi?.onoma_patera 
                ? (nomimoiEkprosopoi.onoma_patera.endsWith("ΟΣ") 
                    ? nomimoiEkprosopoi.onoma_patera.slice(0, -2) + "ΟΥ"
                    : nomimoiEkprosopoi.onoma_patera.endsWith("Σ") 
                    ? nomimoiEkprosopoi.onoma_patera.slice(0, -1).trim() 
                    : nomimoiEkprosopoi.onoma_patera).trim()
                : "..........",
            _DT_EKPROSOPOY: nomimoiEkprosopoi?.typos_taytothtas || "..........",
            _ADT_EKPROSOPOY: nomimoiEkprosopoi?.arithmos_taytothtas || "..........",
            _AFM_EKPROSOPOY: nomimoiEkprosopoi?.afm || "..........",
            _THLEFONO_EKPROSOPOY: nomimoiEkprosopoi?.thlefono || "..........",
            _EMAIL_EKPROSOPOY: nomimoiEkprosopoi?.email || "..........",
            
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
            
            _ANTIKEIMENO: ergazomenos.antikeimeno_ergasion || eidikothta?.perigrafh || "........................",
            _XRONOS_KATABOLHS_APODOXON: ergazomenos.xronos_katabolhs_apodoxon || "την τελευταία εργάσιμη ημέρα του μήνα",
            _YPOKATASTHMA_EDRA: ergazomenos.ypokatasthma || 
                (poleis?.perigrafh ? `την ${poleis.perigrafh}` : "την έδρα της εταιρείας"),
            _YPOKATASTHMA_ADDRESS: ergazomenos.ypokatasthma_address || 
                (company.odos && company.arithmos 
                    ? `${company.odos} ${company.arithmos}, ${poleis?.perigrafh || ""}`
                    : "........................"),
            
            _COMBINED_TEXT,
            _HOTEL: _COMBINED_TEXT,
            _ADDITIONAL_CLAUSES: "",
            _EPOXIKOTHTA: epoxikothta,
            
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
        
        console.log('\n🔧 Generating dynamic placeholders...');
        const dynamicPlaceholders = generateCategoryPlaceholders(categoryParts, ergazomenos);
        
        Object.assign(data, dynamicPlaceholders);
        
        console.log('\n🔍 Validating placeholders...');
        const undefinedKeys = [];
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) {
                undefinedKeys.push(key);
                data[key] = "";
            }
        }
        
        if (undefinedKeys.length > 0) {
            console.warn(`⚠️ Fixed ${undefinedKeys.length} undefined placeholders:`);
            undefinedKeys.forEach(k => console.warn(`   - ${k}`));
        } else {
            console.log(`✅ All ${Object.keys(data).length} placeholders validated`);
        }
        
        console.log('\n📝 Generating DOCX from template...');
        const content = await fs.readFile(docxTemplatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });
        
        doc.render(data);
        
        const timestamp = Date.now();
        const tempDocxPath = path.join(outputFolder, `contract_${ergazomenos.kodikos}_${timestamp}.docx`);
        const updatedDocx = doc.getZip().generate({ type: 'nodebuffer' });
        await fs.writeFile(tempDocxPath, updatedDocx);
        
        console.log('✅ DOCX generated:', path.basename(tempDocxPath));
        
        console.log('🔄 Converting DOCX to PDF with LibreOffice...');
        
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
        
        if (!await fs.pathExists(tempPdfPath)) {
            throw new Error('PDF file was not created');
        }
        
        console.log('✅ PDF generated:', path.basename(tempPdfPath));

        // ============================================================================
        // ✅ INSERT COMPANY STAMP (ΣΦΡΑΓΙΔΑ) INTO PDF
        // ============================================================================

        if (company.sfragida) {
            try {
                console.log('🖼️  Inserting company stamp into PDF...');
                
                const searchText = 'ΕΙΣΑΓΩΓΗ ΕΙΚΟΝΑΣ ΕΔΩ';
                const position = await findTextInPdf(tempPdfPath, searchText);
                
                if (position) {
                    const success = await replaceTextWithImage(
                        tempPdfPath,
                        tempPdfPath,
                        company.sfragida,
                        position
                    );
                    
                    if (success) {
                        console.log('✅ Company stamp inserted successfully');
                    } else {
                        console.warn('⚠️ Failed to insert stamp');
                    }
                } else {
                    console.warn('⚠️ Text "ΕΙΣΑΓΩΓΗ ΕΙΚΟΝΑΣ ΕΔΩ" not found in PDF');
                }
                
            } catch (stampError) {
                console.error('❌ Error inserting stamp:', stampError.message);
                // Continue without stamp (non-fatal error)
            }
        } else {
            console.log('ℹ️  No company stamp (sfragida) available');
        }

        console.log('☁️  Uploading PDF to S3...');
        const { uploadBufferToS3 } = require('./s3Helper');

        // ✅ Sanitize filename components
        const sanitizeFilename = (str) => {
            if (!str) return 'UNKNOWN';
            
            return str
                .trim()
                .toUpperCase()
                .replace(/\s+/g, '_')           // Spaces → underscore
                .replace(/[\/\\:*?"<>|]/g, '')  // ✅ Remove ΜΟΝΟ τους παράνομους χαρακτήρες
                .substring(0, 50);
        };

        const kodikos = ergazomenos.kodikos;
        const eponymo = sanitizeFilename(ergazomenos.eponymo || 'UNKNOWN');
        const onoma = sanitizeFilename(ergazomenos.onoma || 'UNKNOWN');

        const s3Key = `contracts/${userContext.team}/${userContext.companyFolder}/${kodikos}_${eponymo}_${onoma}_contract.pdf`;

        const pdfBuffer = await fs.readFile(tempPdfPath);
        await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');

        console.log(`✅ PDF uploaded to S3: ${s3Key}`);

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
        
        if (error.properties) {
            console.error('\n📋 Template Error Details:');
            console.error(JSON.stringify(error.properties, null, 2));
        }
        
        console.error('❌ ════════════════════════════════════════════════════════\n');
        throw error;
    }
}

module.exports = {
    generateContractPDF
};