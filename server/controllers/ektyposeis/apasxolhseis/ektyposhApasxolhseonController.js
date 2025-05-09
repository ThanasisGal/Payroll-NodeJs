import mongoose from 'mongoose';
import PizZip from 'pizzip';
import ExcelJS from 'exceljs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getDocument } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';

import Models_A from "../../../models/stathera_arxeia.js";
import Models_B from "../../../models/privileges.js";
import Models_C from "../../../models/companies.js";
import Models_D from "../../../models/ergazomenoi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { PoleisModel, 
        SxeseisErgasiasModel,
        DoyModel,
        EidikothtesEfarmoghsModel,
        TmhmataModel,
        PeriodsModel
      } = Models_A; 

const { UserPrivilegesModel } = Models_B;

const { CompaniesModel,
        NomimoiEkprosopoiModel,
        PasswordsModel,
        YpokatasthmataModel,
      } = Models_C;

const { ErgazomenoiModel,
        OrariaModel,
        OrariaFromCardsModel,
      } = Models_D;

const execAsync = promisify(exec);

const fileName = "ΑΤΟΜΙΚΕΣ ΕΚΚΑΘΑΡΙΣΕΙΣ ΜΙΣΘΟΔΟΣΙΑΣ.xlsx"

// Έλεγχος αν είμαστε σε παραγωγή (production)
const isProduction = process.env.NODE_ENV === 'production';

const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 5000;

// Έλεγχος του λειτουργικού συστήματος
const isWindows = process.platform === 'win32';

// Καθορισμός διαδρομής για το αρχείο .docx
const docxPath = isWindows
    ? 'C:/Payroll-NodeJs/public/templates/' + fileName
    : '/home/ubuntu/Payroll-NodeJs/public/templates/' + fileName;

// Καθορισμός εξόδου PDF
const outputFolder = isWindows
    ? 'C:/Payroll-NodeJs/public/xlsx/'
    : '/home/ubuntu/Payroll-NodeJs/public/xlsx/';

// Δημιουργία φακέλου εξόδου αν δεν υπάρχει
try {
    await fs.access(outputFolder);
} catch {
    // Ο κατάλογος δεν υπάρχει, επομένως τον δημιουργούμε
    await fs.mkdir(outputFolder, { recursive: true });
}

// Εύρση της θέσης του μοναδικού string "ΕΙΣΑΓΩΓΗ ΕΙΚΟΝΑΣ ΕΔΩ" για αντικατάσταση με εικόνα
async function findTextInPdf(pdfPath, searchText) {
    let position = null;
    const loadingTask = pdfjsLib.getDocument(pdfPath);
    const pdf = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        textContent.items.forEach((item) => {
            if (item.str.includes(searchText)) {
                console.log(`Found text on page ${pageNum} at item ${JSON.stringify(item.transform)}`);
                position = {
                    pageIndex: pageNum,
                    x: item.transform[4],
                    y: item.transform[5],
                    width: 120,
                    height: 70
                };
            }
        });
        if (position) break;
    }
    return position;
}

// Αντικατάσταση του string "ΕΙΣΑΓΩΓΗ ΕΙΚΟΝΑΣ ΕΔΩ" με την εικόνα (σφραγίδα - υπογραφή)
async function replaceTextWithImage(pdfPath, outputPath, imagePath, position) {
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    if (!position) {
        console.log("Text not found or position not provided");
        return false;
    }

    const imageBytes = await fs.readFile(imagePath);
    const image = await pdfDoc.embedPng(imageBytes, { quality: 50 });

    const page = pdfDoc.getPages()[position.pageIndex - 1];

    // Καλύπτουμε το παλιό κείμενο με λευκό «ορθογώνιο»
    page.drawRectangle({
        x: position.x,
        y: position.y,
        width: position.width + 5,
        height: 10,  
        color: rgb(1, 1, 1),
        opacity: 1
    });

    // Σχεδιάζουμε την εικόνα (σφραγίδα) στην επιθυμητή θέση
    page.drawImage(image, {
        x: position.x,
        y: position.y - position.height + 28.35, 
        width: position.width,
        height: position.height
    });

    const pdfBytesModified = await pdfDoc.save();
    console.log(outputPath);
    await fs.writeFile(outputPath, pdfBytesModified);
    return true;
}

function formatDate(date) {
    let d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [day, month, year].join('/');
}

const calculateMonthsDifference = (startDate, endDate) => {
    if (!endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const yearsDifference = end.getFullYear() - start.getFullYear();
    const monthsDifference = end.getMonth() - start.getMonth();

    // Συνολική διαφορά σε μήνες
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

// Συνάρτηση για μετατροπή αριθμού με δεκαδικά σε λεκτική περιγραφή
const numberToText = (num, type = 'money') => {
    const whole = Math.floor(num); 
    const decimal = Math.round((num - whole) * 100); 

    let wholeText = numbersToWords(whole);
    let decimalText = decimal > 0 ? numbersToWords(decimal) : '';

    switch(type) {
        case 'money': // Χρήση για ποσά σε ευρώ
            return decimalText 
                ? `${wholeText} ευρώ και ${decimalText} λεπτά` 
                : `${wholeText} ευρώ`;
        case 'time': // Χρήση για ώρες και λεπτά
            return decimalText 
                ? `${wholeText} ώρες και ${decimalText} λεπτά` 
                : `${wholeText} ώρες`;
        default: // Απλά αριθμοί
            return decimalText 
                ? `${wholeText} και ${decimalText}` 
                : `${wholeText}`;
    }
};

// Αν υπάρχει μία κενή σελίδα στο τέλος της εκτύπωσης με μόνο επικεφαλίδα και υποσέλιδο την διαγράφουμε
async function removeUnwantedPages(pdfPath) {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = new Uint8Array(dataBuffer);

    const pdfDoc = await getDocument({ data }).promise;
    const numPages = pdfDoc.numPages;
    let pagesToRemove = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        // Check if the page is empty or contains minimal text
        if (textContent.items.length < 23) {
            let inHeaderOrFooter = textContent.items.every(item => {
                return item.transform[5] > 750 || item.transform[5] < 100;  // y-coordinate
            });
            if (inHeaderOrFooter) {
                pagesToRemove.push(i - 1); // `pdf-lib` uses zero-based index for page indices
            }
        }
    }

    if (pagesToRemove.length > 0) {
        const existingPdfBytes = await fs.readFile(pdfPath);
        const existingPdfDoc = await PDFDocument.load(existingPdfBytes);
        const newPdfDoc = await PDFDocument.create();

        const copiedPages = await newPdfDoc.copyPages(existingPdfDoc, existingPdfDoc.getPageIndices().filter(i => !pagesToRemove.includes(i)));
        copiedPages.forEach(page => newPdfDoc.addPage(page));

        const pdfBytes = await newPdfDoc.save();
        await fs.writeFile(pdfPath, pdfBytes);
        console.log(`Removed ${pagesToRemove.length} unwanted pages`);
        const fontPath = isWindows
            ? 'C:/Payroll-NodeJs/fonts/DejaVuSans/DejaVuSansCondensed.ttf'
            : '/home/ubuntu/Payroll-NodeJs/fonts/DejaVuSans/DejaVuSansCondensed.ttf';

        updateFooter(pdfPath, fontPath);
    }
}

//  Αν διαγράφτηκε κενή σελίδα στο τέλος αναπροσαρμόζουμε την το υποσέλιδο με την σωστή αρίθμηση
async function updateFooter(pdfPath, fontPath) {
    let i = 0;
    const existingPdfBytes = await fs.readFile(pdfPath);
    const fontBytes = await fs.readFile(fontPath);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    pdfDoc.registerFontkit(fontkit);  // Εγγραφή του fontkit πριν από τη χρήση προσαρμοσμένης γραμματοσειράς
    const customFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();

    pages.forEach(page => {
        i++ ;
        const { width, height } = page.getSize();
        const text = `Σελ. ${i} από ${pages.length}`;
        const textSize = 8;
        const textWidth = customFont.widthOfTextAtSize(text, textSize);
        const textHeight = customFont.heightAtSize(textSize);

        // Σχεδιάζουμε ένα λευκό ορθογώνιο που να καλύπτει την περιοχή του κειμένου
        page.drawRectangle({
            x: width - textWidth - 30,
            y: 61 - textHeight + 2, // Λίγο κάτω από το κείμενο για να καλύψει το ύψος του κειμένου
            width: textWidth,
            height: textHeight + 5, // Λίγο περισσότερο για περιθώριο
            color: rgb(1, 1, 1) // Λευκό χρώμα
        });
        
        // Προσθέτουμε το κείμενο πάνω από το λευκό ορθογώνιο
        page.drawText(text, {
            x: width - textWidth - 33,
            y: 61,
            size: textSize,
            font: customFont,
            color: rgb(0.50, 0.50, 0.50)  //ανοιχτό γκρι χρώμα
        });
    });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(pdfPath, pdfBytes);
    console.log('Updated footers in the PDF.');
}

//  Δημιουργούμε ένα compressed αρχείο από το ...contract_merged.pdf
async function compressAndSavePdf(pdfPath, company) {
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pdfBytes = await pdfDoc.save({
        useObjectStreams: true, // Ενεργοποίηση της συμπίεσης αντικειμένων
    });
    const finalPdfPath = path.join(outputFolder, `${company}_contract_merged_compressed.pdf`);
    try {
        await fs.writeFile(finalPdfPath, pdfBytes);
        console.log(`Το συμπιεσμένο PDF αρχείο αποθηκεύτηκε επιτυχώς στο ${finalPdfPath}`);
    } catch (error) {
        console.error(`Error κατά την αποθήκευση του συμπιεσμένου PDF αρχείου: ${error.message}`);
    }
    return finalPdfPath;
}

// Εισαγωγή του exec από το child_process

class ektyposhApasxolhseonController {
    static mainApodeixeisErgazomenonForm = async (req, res) => {
        const locals = {
            title: "Εκτύπωση Ατομικών Εκκαθαρίσεων",
            description: "Web Payroll System",
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;
    
        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "EktyposhAtomikonEkkathariseon",
            }).lean();
    
            const ergazomenoi = await ErgazomenoiModel.find({ team: sessionTeam, company_kod: companyId, energos: true });

            const passwordsData = await PasswordsModel.find({ companykod_object: companyId, kodikos: "0001" });
            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            res.render("ektyposeis/apasxolhseis/atomikesEkkathariseis", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                ergazomenoi: ergazomenoi,
            });
        } catch (error) {
            console.log("Error into ektyposhSymbaseonController -> mainApodeixeisErgazomenonForm :", error);
        }
    }

    static getTmhmata = async (req, res) => {
        try {
            const { search = '', page = 1 } = req.query;
            const limit = 50;
            const skip = (parseInt(page) - 1) * limit;
            const regex = new RegExp(search, 'i');
        
            const query = {
                $or: [{ perigrafh: regex }, { kodikos: regex }],
            };
        
            const tmhmata = await TmhmataModel.find(query)
                .sort({ kodikos: 1 })
                .skip(skip)
                .limit(limit);
        
            const count = await TmhmataModel.countDocuments(query);
            const hasMore = skip + tmhmata.length < count;
        
            const items = tmhmata.map(t => ({
                value: t._id,
                label: `${t.kodikos} - ${t.perigrafh}`,
            }));
            console.log({ limit, skip, count, returned: tmhmata.length });
            
            res.json({ items, hasMore });
        } catch (error) {
            res.status(500).send(error);
        }
    };
      
    static getPeriodoi = async (req, res) => {
        try {
            const sessionEtos = req.session.yearInUse;

            const { search = '', page = 1 } = req.query;
            const limit = 50;
            const skip = (parseInt(page) - 1) * limit;
            const regex = new RegExp(search, 'i');
        
            const query = {
                $or: [
                    { perigrafh: regex },
                    { kodikos: regex }
                  ],
                  xrhsh: sessionEtos
                };
        
            const periodoi = await PeriodsModel.find(query)
                .sort({ kodikos: 1 })
                .skip(skip)
                .limit(limit);
        
            const count = await PeriodsModel.countDocuments(query);
            const hasMore = skip + tmhmata.length < count;
        
            const items = periodoi.map(t => ({
                value: t._id,
                label: `${t.kodikos} - ${t.perigrafh}`,
            }));
            console.log({ limit, skip, count, returned: periodoi.length });
            
            res.json({ items, hasMore });
        } catch (error) {
            res.status(500).send(error);
        }
    };
      
    static createPdf = async (req, res) => { 
        const { team, company, kodikoi, username, password, ypokatasthma } = req.body;

        try {
            // Διαγράφουμε τυχόν παλιά αρχεία για να μη συσσωρεύονται
            const files = await fs.readdir(outputFolder);

            const failedInitialDeletes = [];

            for (const file of files) {
                if (file.startsWith(`${company}_contract_`)) {
                    const filePath = path.join(outputFolder, file);
                    try {
                        await fs.unlink(filePath);
                        console.log(`✅ Διαγράφηκε: ${filePath}`);
                    } catch (err) {
                        if (err.code === 'EBUSY' || err.code === 'EPERM') {
                            console.warn(`❌ Δεν διαγράφηκε (ανοικτό): ${filePath}`);
                            failedInitialDeletes.push(file);
                        } else {
                            console.error(`❌ Άλλο σφάλμα κατά τη διαγραφή: ${filePath}`, err);
                        }
                    }
                }
            }

            // Αν υπάρχουν προβλήματα με αρχεία ήδη ανοικτά, σταμάτα και ενημέρωσε
            if (failedInitialDeletes.length > 0) {
                return res.json({
                    success: false,
                    fileLink: '',
                    redirectUrl: "/ektyposeis/symbaseis/ektyposhSymbaseonErgazomenon",
                    checkMessage: "EBUSY",
                    warningMessage: `❌ Δεν είναι δυνατή η δημιουργία νέων αρχείων. Κλείσε πρώτα τα παρακάτω αρχεία:\n${failedInitialDeletes.join(', ')}`
                });
            }

            const companies = await CompaniesModel.findOne({ _id: company }).lean();
            const poleis = await PoleisModel.findOne({ kodikos: companies.polh }).lean();
            const doy = await DoyModel.findOne({ kodikos: companies.doy_company }).lean();
            const nomimoiEkprosopoi = await NomimoiEkprosopoiModel.findOne({ companykod_object: company, kodikos: "0001" }).lean();
            const employees = await ErgazomenoiModel.find({
                team: team,
                company_kod: company,
                kodikos: { $in: kodikoi },
                ...(ypokatasthma ? { ypokatasthma: ypokatasthma } : {})
            }).lean();
        
            let eponymia_Etairias = (companies.eponymia ? companies.eponymia.trim() : "") + " " 
                                    + (companies.fathername ? companies.fathername.substring(0, 3).trim() : "") + " " 
                                    + (companies.firstname ? companies.firstname.trim() : "");

            // Ανάγνωση του πρότυπου αρχείου .docx
            const content = await fs.readFile(docxPath, 'binary');
            const zip = new PizZip(content);
            let index = 1;

            // Το Docxtemplater instance θα ανανεώνεται σε κάθε εργαζόμενο.
            // Για να μην αλλοιώσουμε το zip, θα παίρνουμε clone σε κάθε βρόχο.
            for (const symbash of employees) {
                const doc = new Docxtemplater(zip.clone());

                // Προσδιορίζουμε κάποιες λέξεις/αντωνυμίες με βάση το φύλο
                let _CAPITAL_ONOMASTIKH_A, _ONOMASTIKH_A, _CAPITAL_ONOMASTIKH_K, _ONOMASTIKH_K, 
                    _GENIKH_A, _CAPITAL_GENIKH_A, _AITIATIKH_A, _CAPITAL_AITIATIKH_A,
                    _ANTONYMIA_O, _ANTONYMIA_G, _ANTONYMIA_A, _HOTEL;

                _CAPITAL_ONOMASTIKH_A = symbash.fylo ? "Ο"  : "Η";
                _CAPITAL_ONOMASTIKH_K = symbash.fylo ? "ΟΣ" : "Η";
                _CAPITAL_GENIKH_A     = symbash.fylo ? "ΟΥ" : "ΗΣ";
                _CAPITAL_AITIATIKH_A  = symbash.fylo ? "ΟΝ" : "ΗΝ";
                _ONOMASTIKH_A         = symbash.fylo ? "ο"  : "η";
                _ONOMASTIKH_K         = symbash.fylo ? "ος" : "η";
                _GENIKH_A             = symbash.fylo ? "ου" : "ης";
                _AITIATIKH_A          = symbash.fylo ? "ον" : "ην";

                _ANTONYMIA_O          = symbash.fylo ? "ός" : "ή";
                _ANTONYMIA_G          = symbash.fylo ? "ού" : "ής";
                _ANTONYMIA_A          = symbash.fylo ? "όν" : "ήν";

                if (symbash.eidikh_kathgoria_ergazomenoy === "0009") {
                    _HOTEL = "Ειδικότερα συμφωνείται ότι, με μονομερή ενέργεια ο εργοδότης έχει τη δυνατότητα εφαρμογής των ρυθμίσεων της δεσμευτικής για όλους τους εργοδότες ΣΣΕ Ξενοδοχειακών επιχειρήσεων όλης της χώρας 2023 -2024, άρθρο 5 και τυχόν ισχύουσα δεσμευτική τοπική σε κάποια εγκατάσταση για την εφαρμογή του 5νθημέρου και την εργασία της έκτης ημέρας, κατά περίπτωση.";
                } else {
                _HOTEL = "";
                }
            
                let epoxikothta;
                if (symbash.epoxikos) {
                    epoxikothta = "Συμφωνείται ότι, λόγω εποχικότητας και ειδικών συνθηκών λειτουργίας της μονάδας, να χορηγείται τμήμα της άδειας κατά τις περιόδους που υπάρχει περιορισμένη ή και ανύπαρκτη πληρότητα (νεκρή περίοδο).";
                } else {
                    epoxikothta = "";
                }

                const polh = await PoleisModel.findOne({ kodikos: symbash.polh }).lean();
                const eidikothta = await EidikothtesEfarmoghsModel.findOne({ kodikos: symbash.eidikothta }).lean();

                let apasxolhsh, typos, typos_erg, typos_erg_genikh, diarkeia, typos_erg_genikh_capital, typos_erg_aitiatikh;
                
                const sxeshErgasias = await SxeseisErgasiasModel.findOne({ kodikos: symbash.sxesh_ergasias}).lean();
                const ypokatasthmata = await YpokatasthmataModel.findOne({ companykod_object: company, kodikos: symbash.ypokatasthma }).lean();

                let polh_ypok, ypok_address, edra_ypok;

                if (ypokatasthmata) {
                    polh_ypok = await PoleisModel.findOne({ kodikos: ypokatasthmata.polh }).lean();
                    if (symbash.ypokatasthma !== "0000") {
                        edra_ypok = " το " + ypokatasthmata.perigrafh;
                        ypok_address = "( " 
                            + (ypokatasthmata.odos ? ypokatasthmata.odos.trim() : "") + " "
                            + (ypokatasthmata.arithmos ? ypokatasthmata.arithmos.trim() : "") + " "
                            + (polh_ypok && polh_ypok.onoma ? polh_ypok.onoma.trim() : "") 
                            + " )";
                    } else {
                        edra_ypok = "η " + ypokatasthmata.perigrafh;
                        ypok_address = "";
                    }
                }

                switch (symbash.kathestos_apasxolhshs) {
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

                const differenceInMonths = calculateMonthsDifference(symbash.hmeromhnia_allaghs_symbashs, symbash.hmeromhnia_lhxhs_symbashs);
                if (differenceInMonths !== 0) {
                    diarkeia = `, διάρκειας ${differenceInMonths} μηνών και η οποία λήγει την ${formatDate(symbash.hmeromhnia_lhxhs_symbashs)}.`;
                } else {
                    diarkeia = ".";
                }

                const hmeres_lektika = numberToText(parseInt(symbash.hmeres_ergasias_ebdomadas), '')
                const ores_lektika = numberToText(parseInt(symbash.ores_ergasias_ebdomadas), '')
                const currentYear = new Date().getFullYear();

                const data = {
                    _YEAR: currentYear,
                    _SXESH_ERGASIAS: sxeshErgasias?.perigrafh ? sxeshErgasias.perigrafh : "..........",
                    _KATHESTOS_APASXOLHSHS: apasxolhsh,
                    _POLH: poleis?.perigrafh ? poleis.perigrafh : "..........",
                    _HMEROMHNIA_PROSLHPSHS: formatDate(symbash.hmeromhnia_proslhpshs),

                    _ETAIREIA: companies.firstname == "" ? "εταιρία" : "επιχείρηση",
                    _ERGODOTHS: companies.firstname == "" ? "η εταιρία" : "η εργοδότρια",
                    _ERGODOTHS_XORIS_ARTHRO: companies.firstname == "" ? "εταιρία" : "εργοδότρια",
                    _ERGODOTHS_CAPITAL_A: companies.firstname == "" ? "Η εταιρία" : "Η εργοδότρια",
                    _ERGODOTHS_GENIKH: companies.firstname == "" ? "της εταιρίας" : "της εργοδότριας",
                    _ERGODOTHS_AITIATIKH: companies.firstname == "" ? "την εταιρία" : "την εργοδότρια",
                    _EPONYMIA: eponymia_Etairias,
                    _ODOS: companies.odos ? companies.odos.trim() : "..........",
                    _ARITHMOS: companies.arithmos ? companies.arithmos.trim() : ".....",
                    _AFM: companies.afm ? companies.afm.trim() : "..........",
                    _DOY: doy?.perigrafh ? doy.perigrafh.trim() : "..........",
                    _DIALLEIMA: symbash.dialleima_se_lepta,
                    _DIALLEIMA_LEKTIKA: numberToText(parseInt(symbash.dialleima_se_lepta), ''),
                    _EKTOS_ENTOS_ORARIOY: symbash.dialleima_entos_ektos_orarioy 
                        ? "ΕΝΤΟΣ ΩΡΑΡΙΟΥ (αποτελεί χρόνο εργασίας και δεν επεκτείνει το ωράριο εργασίας)" 
                        : "ΕΚΤΟΣ ΩΡΑΡΙΟΥ (δεν αποτελεί χρόνο εργασίας και επεκτείνει το ωράριο εργασίας)",

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
                    _YPOGRAFON_EKPROSOPOS: nomimoiEkprosopoi 
                        ? (nomimoiEkprosopoi.eponymia.trim() + " " + nomimoiEkprosopoi.onoma.trim()) 
                        : "..........",
                    _DT_EKPROSOPOY: nomimoiEkprosopoi?.typos_taytothtas ? nomimoiEkprosopoi.typos_taytothtas.trim() : ".....",
                    _ADT_EKPROSOPOY: nomimoiEkprosopoi?.arithmos_taytothtas ? nomimoiEkprosopoi.arithmos_taytothtas.trim() : "..........",
                    _AFM_EKPROSOPOY: nomimoiEkprosopoi?.afm ? nomimoiEkprosopoi.afm : "..........",
                    _THLEFONO_EKPROSOPOY: nomimoiEkprosopoi?.thlefono ? nomimoiEkprosopoi.thlefono.trim() : "..........",
                    _EMAIL_EKPROSOPOY: nomimoiEkprosopoi?.email ? nomimoiEkprosopoi.email.trim() : "..........",
                    
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
                
                    _EPONYMIA_ERGAZOMENOY: 
                        (symbash.eponymo ? symbash.eponymo.trim() : "") 
                        + " " 
                        + (symbash.onoma ? symbash.onoma.trim() : ""),
                    _PATRONYMO_ERGAZOMENOY: symbash.patronymo 
                        ? (symbash.patronymo.endsWith("ΟΣ") 
                            ? symbash.patronymo.slice(0, -2) + "ΟΥ"
                            : symbash.patronymo.endsWith("Σ") 
                            ? symbash.patronymo.slice(0, -1).trim() 
                            : symbash.patronymo).trim()
                        : "..........",
                    _POLH_ERGAZOMENOY: polh?.perigrafh ? polh.perigrafh.trim() : "..........",
                    _ODOS_ERGAZOMENOY: symbash.odos ? symbash.odos.trim() : "..........",
                    _ARITHMOS_ERGAZOMENOY: symbash.arithmos ? symbash.arithmos.trim() : "..........",
                    _DT_ERGAZOMENOY: symbash.typos_taytothtas ? symbash.typos_taytothtas.trim() : "..........",
                    _ADT_ERGAZOMENOY: symbash.adt ? symbash.adt.trim() : "..........",
                    _AFM_ERGAZOMENOY: symbash.afm ? symbash.afm.trim() : "..........",
                    _THLEFONO_ERGAZOMENOY: symbash.thlefono ? symbash.thlefono.trim() : "..........",
                    _EMAIL_ERGAZOMENOY: symbash.thlefono ? symbash.thlefono.trim() : "..........",
                    _TYPOS_ERGAZOMENOY: typos,
                    _DIARKEIA: diarkeia,

                    _HMERES_LEKTIKA: hmeres_lektika,
                    _HMERES_APASXOLHSHS: symbash.hmeres_ergasias_ebdomadas ? symbash.hmeres_ergasias_ebdomadas : "....",

                    _ORES_LEKTIKA: ores_lektika,
                    _ORES_APASXOLHSHS: symbash.ores_ergasias_ebdomadas ? symbash.ores_ergasias_ebdomadas : "....",
                    _EYELIKTH_PROSELEYSH: symbash.evelikth_proselefsh ? symbash.evelikth_proselefsh : '0',

                    _HOTEL,
                    _TYPOS_ERG: typos_erg,
                    _TYPOS_ERG_GENIKH: typos_erg_genikh,
                    _TYPOS_ERG_GENIKH_CAPITAL: typos_erg_genikh_capital,
                    _YPOKATASTHMA_EDRA: edra_ypok,
                    _YPOKATASTHMA_ADDRESS: ypok_address,
                    _TYPOS_ERG_AITIATIKH: typos_erg_aitiatikh,
                    _EIDIKOTHTA: eidikothta?.perigrafh ? eidikothta.perigrafh : "..........",

                    _MIKTES_APODOXES: symbash.synolo_symbashs_basei_oron_ergasias,
                    _MIKTES_APODOXES_LEKTIKA: numberToText(
                        parseFloat(symbash.synolo_symbashs_basei_oron_ergasias), ''
                    ),
                    _EPOXIKOTHTA: epoxikothta
                };

                // Γεμίζουμε το docx με τα data
                doc.render(data);

                // Αποθηκεύουμε προσωρινά το αρχείο docx
                const tempDocxPath = path.join(outputFolder, `${company}_contract_${index}.docx`);
                const updatedDocx = doc.getZip().generate({ type: 'nodebuffer' });
                await fs.writeFile(tempDocxPath, updatedDocx);

                // Μικρή καθυστέρηση για ασφάλεια
                await new Promise(resolve => setTimeout(resolve, 300));

                // Ελέγχουμε αν δημιουργήθηκε το docx
                try {
                    await fs.access(tempDocxPath);
                } catch (error) {
                    console.error(`Error: Το αρχείο ${tempDocxPath} δεν δημιουργήθηκε.`);
                    index++;
                    continue;
                }
            
                // Ετοιμάζουμε εντολή μετατροπής LibreOffice
                const libreOfficePath = isWindows
                ? `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`
                : `/usr/bin/libreoffice`; // default path από apt
            
                const libreOfficeCommand = `${libreOfficePath} --headless --convert-to pdf "${tempDocxPath}" --outdir "${outputFolder}"`;

                // Εφαρμόζουμε την εντολή
                await new Promise(resolve => setTimeout(resolve, 100));
                await execAsync(libreOfficeCommand);

                // Μονοπάτι PDF που προέκυψε από το docx
                const tempPdfPath = path.join(outputFolder, `${company}_contract_${index}.pdf`);

                try {
                    // Ελέγχουμε αν το PDF δημιουργήθηκε
                    await fs.access(tempPdfPath);
                    console.log(`Το αρχείο PDF ${tempPdfPath} δημιουργήθηκε επιτυχώς.`);

                    // Εισάγουμε την σφραγίδα επάνω στο PDF
                    const imagePath = companies.imagePath;
                    const searchText = 'ΕΙΣΑΓΩΓΗ ΕΙΚΟΝΑΣ ΕΔΩ';

                    // 1. Βρίσκουμε τη θέση του κειμένου
                    const position = await findTextInPdf(tempPdfPath, searchText);

                    // 2. Αν υπάρχει, αντικαθιστούμε με την εικόνα
                    if (position) {
                        await replaceTextWithImage(tempPdfPath, tempPdfPath, imagePath, position);
                    } else {
                        console.log("No position found for text");
                    }

                    // Αφαίρεση ανεπιθύμητων σελίδων
                    await removeUnwantedPages(tempPdfPath);
                } catch (error) {
                    console.error(`Error: Το αρχείο PDF ${tempPdfPath} δεν δημιουργήθηκε.`);
                }
        
                // Διαγραφή του προσωρινού αρχείου .docx
                setTimeout(async () => {
                    try {
                        await fs.unlink(tempDocxPath);
                    } catch (unlinkError) {
                        console.error(`Error κατά τη διαγραφή του προσωρινού .docx: ${unlinkError.message}`);
                    }
                }, 500);

                index++;
            } // Τέλος for (employees)

            // Μετά το πέρας όλων των εργαζομένων, μαζεύουμε όλα τα ...contract_X.pdf για συγχώνευση
            let pdfFiles = [];
            for (let i = 1; i < index; i++) { 
                const tempPdfPath = path.join(outputFolder, `${company}_contract_${i}.pdf`);
                if (await fs.access(tempPdfPath).then(() => true).catch(() => false)) {
                    pdfFiles.push(tempPdfPath);
                } else {
                    console.error(`Το αρχείο PDF ${company}_contract_${i}.pdf δεν βρέθηκε.`);
                }
            }
        
            async function mergePdfs(pdfPaths) {
                if (pdfPaths.length === 1) {
                    // Αν υπάρχει μόνο ένα, το μετονομάζουμε
                    const singlePdfPath = pdfPaths[0];
                    const finalPdfPath = path.join(outputFolder, `${company}_contract_merged.pdf`);
                    try {
                        await fs.rename(singlePdfPath, finalPdfPath);
                        console.log(`Το αρχείο ${singlePdfPath} μετονομάστηκε επιτυχώς σε ${finalPdfPath}`);
                    } catch (error) {
                        console.error(`Error κατά τη μετονομασία του αρχείου: ${error.message}`);
                    }
                    return finalPdfPath;
                } else if (pdfPaths.length > 1) {
                    const mergedPdfDoc = await PDFDocument.create();
        
                    for (const pdfPath of pdfPaths) {
                        let pdfBytes;
                        try {
                            pdfBytes = await fs.readFile(pdfPath);
                        } catch (error) {
                            console.error(`Error κατά την ανάγνωση του αρχείου PDF: ${error.message}`);
                        }
                        const pdfDoc = await PDFDocument.load(pdfBytes);
                        const copiedPages = await mergedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
                        copiedPages.forEach(page => mergedPdfDoc.addPage(page)); 
                    }
                
                    const finalPdfPath = path.join(outputFolder, `${company}_contract_merged.pdf`); 
                    try {
                        await fs.writeFile(finalPdfPath, await mergedPdfDoc.save());
                        console.log(`Το αρχείο PDF αποθηκεύτηκε επιτυχώς στο ${finalPdfPath}`);
                    } catch (error) {
                        console.error(`Error κατά την αποθήκευση του PDF αρχείου: ${error.message}`);
                    }
                    return finalPdfPath;
                }
            }

            // Κλήση της συνάρτησης συγχώνευσης
            const mergedPdfPath = await mergePdfs(pdfFiles);
            const checkMessage = "ok";

            const finalPdfPath = path.join(outputFolder, `${company}_contract_merged.pdf`);

            await compressAndSavePdf(finalPdfPath, company);

            // Ετοιμάζουμε ένα link για το τελικό merged PDF
            const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
            const pdfFilename = path.basename(mergedPdfPath);
            const pdfLink = `${baseUrl}/pdf/${pdfFilename}`;
            
            // const pdfLink = isProduction 
            //     ? `https://${host}/pdf/${path.basename(mergedPdfPath)}`
            //     : `http://${host}:${port}/pdf/${path.basename(mergedPdfPath)}`;

            const htmlLink = `Το PDF αρχείο των συμβάσεων έχει δημιουργηθεί. </br> Κάντε κλικ <a href="${pdfLink}" target="_blank" style="font-weight: 700 !important;">εδώ</a> για να το εκτυπώσετε. </br> <strong>ΠΡΟΣΟΧΗ!!!</strong> </br> Τα αρχεία που δημιουργήθηκαν θα διαγραφούν σε 3 λεπτά.`;
        
            const failedDeletes = [];

            setTimeout(async () => {
              try {
                const allFiles = await fs.readdir(outputFolder);
                const filesToDelete = allFiles.filter(file =>
                  file.startsWith(`${company}_contract_`) &&
                  (file.endsWith('.docx') || file.endsWith('.pdf'))
                );
            
                for (const file of filesToDelete) {
                  const filePath = path.join(outputFolder, file);
                  try {
                    await fs.unlink(filePath);
                    console.log(`✅ Διαγράφηκε: ${filePath}`);
                  } catch (err) {
                    if (err.code === 'EBUSY' || err.code === 'EPERM') {
                      console.warn(`❌ Δεν διαγράφηκε (ανοικτό): ${filePath}`);
                      failedDeletes.push(file);
                    }
                  }
                }
            
                if (failedDeletes.length > 0) {
                  res.locals.warningMessage = `⚠ Ορισμένα αρχεία (${failedDeletes.length}) δεν διαγράφηκαν επειδή είναι ανοικτά. Παρακαλώ κλείστε τα PDF ή Word αρχεία για να καθαριστούν.`;
                }
            
              } catch (err) {
                console.error("❌ Σφάλμα κατά τη διαγραφή αρχείων:", err);
              }
            }, 180000);
            
            res.json({ 
                success: true, 
                redirectUrl: "/ektyposeis/symbaseis/ektyposhSymbaseonErgazomenon", 
                fileLink: htmlLink,
                checkMessage: checkMessage,
                warningMessage: res.locals.warningMessage || null
            });

        } catch (error) {
            console.error('Error fetching contracts:', error);
            res.status(500).send('Error fetching contracts');
        }
    }
}

export default ektyposhApasxolhseonController;
