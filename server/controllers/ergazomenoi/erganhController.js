const mongoose = require("mongoose");

const { Builder, By, Key, until } = require("selenium-webdriver");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const PDFDocument = require("pdfkit");
const { chromium } = require("playwright");

const Models_A = require("../../models/stathera_arxeia");
const Models_B = require("../../models/privileges");
const Models_C = require("../../models/companies");
const Models_D = require("../../models/ergazomenoi");

const { ArgiesModel, 
        PeriodsModel
      } = Models_A; 

const { UserPrivilegesModel } = Models_B;

const { CompaniesModel,
        PasswordsModel,
        YpokatasthmataModel,
      } = Models_C;

const { ErgazomenoiModel,
        OrariaModel,
        OrariaFromCardsModel,
        OrariaApologistikaModel,
      } = Models_D;

// Έλεγχος αν είμαστε σε παραγωγή (production)
const isProduction = process.env.NODE_ENV === 'production';

const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 5000;

// Έλεγχος και δημιουργία του φακέλου downloads αν δεν υπάρχει
if (isProduction) {
    const downloadPath = '/tmp/downloads';
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        // Δίνουμε πλήρη δικαιώματα (777) στον φάκελο
        fs.chmodSync(downloadPath, 0o777);
    }
}

let team, company, username, _pdfUrlPath;

// Συνάρτηση για ανάγνωση του Excel αρχείου
async function readXLSFile(filePath) {
    // const workbook = xlsx.readFile(filePath);
    // const sheetName = workbook.SheetNames[0];
    // const worksheet = workbook.Sheets[sheetName];
    // return xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath); // ✅ σωστό await
      
    const worksheet = workbook.worksheets[0]; // ✅ παίρνουμε το πρώτο sheet
    const data = [];
      
    worksheet.eachRow((row) => {
        const values = row.values.slice(1); // ⚠️ row.values[0] είναι άδειο
        data.push(values);
    });
      
    return data; // ✅ επιστρέφει πίνακα 2D όπως το `header: 1`
}

async function adjustOvernightEntries(data, interval) {
    // Αφαίρεση της πρώτης γραμμής (επικεφαλίδας)
    data.splice(0, 1);  // Εναλλακτικά μπορούμε να χρησιμοποιήσουμε την data.shift();

    // Ξεκινάμε από τη δεύτερη γραμμή (αφού η πρώτη έχει αφαιρεθεί)
    for (let index = 0; index < data.length; index++) {
        let row = data[index];
        let afm = row[1];
        let startDate = row[4];
        let [day, month, year] = startDate.split('/');  // Εξαγωγή ημέρας, μήνα, έτους
        let startTime = row[5];
        let endTime = row[6];

        if (startTime && !endTime) {
            let nextRow = data[index + 1];
            if (nextRow && formatDate(nextRow[4]) === nextDay(startDate) && !nextRow[5]) {
                row[6] = nextRow[6];  // Παίρνει το EndTime της επόμενης γραμμής (nextRow)
                data.splice(index + 1, 1);  // Διαγραφή της επόμενης εγγραφής
            }
        }
        if (!startTime && endTime) {
            let nextRow = data[index + 1];
            if (nextRow && formatDate(nextRow[4]) === nextDay(startDate) && !nextRow[6]) {
                row[5] = nextRow[5];  // Παίρνει το StartTime της επόμενης γραμμής (nextRow)
                data.splice(index + 1, 1);  // Διαγραφή της επόμενης εγγραφής
            }
        }
        let roundedArrival = roundTime(row[5], interval);
        let roundedDeparture = roundTime(row[6], interval);
        row[5] = roundedArrival;
        row[6] = roundedDeparture;
    }
    return data;  // Επιστροφή του τροποποιημένου πίνακα
}

// Συνάρτηση που επιστρέφει την επόμενη ημέρα στη μορφή dd/mm/yyyy
function nextDay(dateStr) {
    let [day, month, year] = dateStr.split('/');
    let date = new Date(`${year}-${month}-${day}`);
    date.setDate(date.getDate() + 1);

    let nextDay = String(date.getDate()).padStart(2, '0');
    let nextMonth = String(date.getMonth() + 1).padStart(2, '0');  // Οι μήνες ξεκινούν από το 0
    let nextYear = date.getFullYear();

    return `${nextDay}/${nextMonth}/${nextYear}`;  // Επιστροφή της επόμενης ημέρας στη μορφή dd/mm/yyyy
}

// Συνάρτηση που διασφαλίζει ότι η ημερομηνία έχει σωστή μορφή dd/mm/yyyy
function formatDate(dateStr) {
    let [day, month, year] = dateStr.split('/');
    let formattedDay = String(day).padStart(2, '0');
    let formattedMonth = String(month).padStart(2, '0');
    return `${formattedDay}/${formattedMonth}/${year}`;
}

// Συνάρτηση για στρογγυλοποίηση της ώρας
function roundTime(timeStr, interval) {
    if (!interval) interval = 1;
    if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        const roundedTotalMinutes = Math.round(totalMinutes / parseInt(interval)) * parseInt(interval);
        const finalTotalMinutes = roundedTotalMinutes % (24 * 60);
        const finalHours = Math.floor(finalTotalMinutes / 60);
        const finalMinutes = finalTotalMinutes % 60;
        const formattedHours = String(finalHours).padStart(2, '0');
        const formattedMinutes = String(finalMinutes).padStart(2, '0');
        return `${formattedHours}:${formattedMinutes}`;
    }
}

// Συνάρτηση για μετατροπή ωρών σε λεπτά
function convertTimeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Συνάρτηση για υπολογισμό ωρών εργασίας, υπερεργασίας κλπ
function calculateWorkHoursForIntervals(intervals, isHoliday, isNextHoliday) {
    const NIGHT_START = 22 * 60;
    const NIGHT_END = 6 * 60;

    const WORK_HOURS_LIMIT = 8 * 60;
    const OVERTIME_LIMIT = WORK_HOURS_LIMIT + 60;
    const LEGAL_OVERTIME_LIMIT = OVERTIME_LIMIT + 180;

    let totalMinutesWorked = 0;

    let working = 0;
    let night = 0;
    let holiday = 0;
    let overwork = 0;
    let nightOverwork = 0;
    let holidayOverwork = 0;
    let nightHolidayOverwork = 0;
    let overtime = 0;
    let nightOvertime = 0;
    let holidayOvertime = 0;
    let nightHolidayOvertime = 0;
    let overtimeIllegal = 0;
    let nightOvertimeIllegal = 0;
    let holidayOvertimeIllegal = 0;
    let nightHolidayOvertimeIllegal = 0;
    let shift = 0;

    intervals.forEach(interval => {
        let startMinute = interval.start;
        let endMinute = interval.end;
        shift = interval.shift;
        let hasCrossedMidnight = false;
        let prevMinute = startMinute;

        for (let i = startMinute; i < endMinute; i++) {
            let currentMinute = i % 1440;
            
            // Ελέγχουμε αν το τρέχον λεπτό είναι πριν τα μεσάνυχτα ή μετά τα μεσάνυχτα.
            if (currentMinute < prevMinute) {
                hasCrossedMidnight = true;
            }
            
            let isNight = currentMinute >= NIGHT_START || currentMinute < NIGHT_END;
            // Ελέγχουμε αν είναι αργία πριν τα μεσάνυχτα ή μετά τα μεσάνυχτα
            let isEffectiveHoliday = (isHoliday && !hasCrossedMidnight) || (isNextHoliday && hasCrossedMidnight);

            if (totalMinutesWorked < WORK_HOURS_LIMIT) {
                if (isEffectiveHoliday) {
                holiday++;
                working++;
                if (isNight) night++;
            } else {
                working++;
                if (isNight) night++;
            }
        } else if (totalMinutesWorked < OVERTIME_LIMIT) {
            if (isNight && isEffectiveHoliday) {
                nightHolidayOverwork++;
            } else if (isEffectiveHoliday) {
                holidayOverwork++;
            } else if (isNight) {
                nightOverwork++;
            } else {
                overwork++;
            }
        } else if (totalMinutesWorked < LEGAL_OVERTIME_LIMIT) {
            if (isNight && isEffectiveHoliday) {
                nightHolidayOvertime++;
            } else if (isEffectiveHoliday) {
                holidayOvertime++;
            } else if (isNight) {
                nightOvertime++;
            } else {
                overtime++;
            }
        } else {
            if (isNight && isEffectiveHoliday) {
                nightHolidayOvertimeIllegal++;
            } else if (isEffectiveHoliday) {
                holidayOvertimeIllegal++;
            } else if (isNight) {
                nightOvertimeIllegal++;
            } else {
                overtimeIllegal++;
            }
        }

        prevMinute = currentMinute;
        totalMinutesWorked++;
        }
    });

    return {
        working: working / 60,
        night: night / 60,
        holiday: holiday / 60,
        overwork: overwork / 60,
        nightOverwork: nightOverwork / 60,
        holidayOverwork: holidayOverwork / 60,
        nightHolidayOverwork: nightHolidayOverwork / 60,
        overtime: overtime / 60,
        nightOvertime: nightOvertime / 60,
        holidayOvertime: holidayOvertime / 60,
        nightHolidayOvertime: nightHolidayOvertime / 60,
        overtimeIllegal: overtimeIllegal / 60,
        nightOvertimeIllegal: nightOvertimeIllegal / 60,
        holidayOvertimeIllegal: holidayOvertimeIllegal / 60,
        nightHolidayOvertimeIllegal: nightHolidayOvertimeIllegal / 60,
        shift: shift
    };
}

function calculateTimePeriodsInPairs(timePeriods, orariaNoCards) {
    // Συνάρτηση που μετατρέπει λεπτά σε "HH:MM"
    function minutesToTime(minutes) {
        let newHours = Math.floor(minutes / 60);
        let newMinutes = minutes % 60;
        return String(newHours).padStart(2, '0') + ':' + String(newMinutes).padStart(2, '0');
    }

    // Υπολογισμός για το πρώτο ζεύγος [0] και [1]
    if (typeof timePeriods[1] === 'undefined') {
        let apoOra = orariaNoCards[0]._doc.apo_ora_01;
        let eosOra = orariaNoCards[0]._doc.eos_ora_01;
        let apoOraInMinutes = convertTimeToMinutes(apoOra);
        let eosOraInMinutes = convertTimeToMinutes(eosOra);
        let minutesDiff = eosOraInMinutes - apoOraInMinutes;

        // let minutesDiff = orariaNoCards[0]._doc.eos_ora_01 - orariaNoCards[0]._doc.apo_ora_01;
        let timeInMinutes = convertTimeToMinutes(timePeriods[0]);
        let newTimeInMinutes = timeInMinutes + minutesDiff;
        timePeriods[1] = minutesToTime(newTimeInMinutes);
    }

    // Υπολογισμός για το δεύτερο ζεύγος [2] και [3] (αν υπάρχει)
    if (timePeriods.length >= 4 && typeof timePeriods[3] === 'undefined') {
        let minutesDiff = orariaNoCards[0]._doc.eos_ora_02 - orariaNoCards[0]._doc.apo_ora_02;
        let timeInMinutes = convertTimeToMinutes(timePeriods[2]);
        let newTimeInMinutes = timeInMinutes + minutesDiff;
        timePeriods[3] = minutesToTime(newTimeInMinutes);
    }

    // Υπολογισμός για το τρίτο ζεύγος [4] και [5] (αν υπάρχει)
    if (timePeriods.length >= 6 && typeof timePeriods[5] === 'undefined') {
        let minutesDiff = orariaNoCards[0]._doc.eos_ora_03 - orariaNoCards[0]._doc.apo_ora_03;
        let timeInMinutes = convertTimeToMinutes(timePeriods[4]);
        let newTimeInMinutes = timeInMinutes + minutesDiff;
        timePeriods[5] = minutesToTime(newTimeInMinutes);
    }

    return timePeriods;
}

function mmToPoints(mm) {
    return parseFloat(mm * 2.834645669);
}

async function generatePDF(_company, companyName, employees, hmeromhniesArgion) {
        const doc = new PDFDocument({
        size: 'A4',
        margins: { top: mmToPoints(10), left: mmToPoints(10), right: mmToPoints(10), bottom: mmToPoints(10) }
    });

    const currentTimeInMs = Date.now();
    const fileName = `263${_company[0]._id}${currentTimeInMs}.pdf`;
    const outputPath = path.join(__dirname, '..', '..', '..', 'public', 'pdf', fileName);
    const readPath = path.join(__dirname, '..', '..', '..', 'public', 'txt', '263-Parathrhseis Elegxoy.txt');

    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    let currentPage = 1;
    const fullWidth = mmToPoints(190); // max printable width
    const nameWidthInPoints = mmToPoints(80);
    const pageHeight = mmToPoints(297) - mmToPoints(10);
    const rightMargin = mmToPoints(10);

    const addHeader = (doc, companyName) => {
        const x = mmToPoints(10);
        const y = mmToPoints(10);
        const pageWidth = mmToPoints(200);

        doc.fontSize(8).font('./fonts/JetBrainsMono/JetBrainsMono-Bold.ttf')
            .fillColor("blue")
            .text(companyName, x, y, { align: 'left', width: 500 })
            .fillColor("black");

        const now = new Date();
        const dateStr = now.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

        const printedText = `Εκτυπώθηκε την ${dateStr} ${timeStr}`;

        doc.fontSize(7).font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
            .fillColor('gray')
            .text(printedText, x, y, { align: 'right', width: pageWidth - x })
            .fillColor('black');

        const lineY = y + mmToPoints(5);
        doc.moveTo(x, lineY)
            .strokeColor("grey")
            .lineTo(mmToPoints(200), lineY)
            .lineWidth(0.5)
            .stroke()
            .strokeColor("black")
            .fillColor("black");
    };

    const addFooter = (doc, pageNumber) => {
        const pageWidth = mmToPoints(200);
        const pageHeight = mmToPoints(297);
        const rightMargin = mmToPoints(10);
        const leftMargin = mmToPoints(10);
        const bottomMargin = mmToPoints(5);
        const y = pageHeight - bottomMargin - leftMargin;
        const lineY = pageHeight - mmToPoints(16);

        doc.moveTo(leftMargin, lineY)
            .strokeColor("grey")
            .lineTo(pageWidth, lineY)
            .lineWidth(0.5)
            .stroke();

        const currentYear = new Date().getFullYear();
        const footerText = `© 2009-${currentYear} WebPayrollSolutions.com * Τηλ. 2421056825 * Κιν. 6972012650 * eMail support@WebPayrollSolutions.com`;

        doc.fontSize(7)
            .fillColor("gray")
            .text(footerText, leftMargin, y, { align: 'left' })
            .fontSize(8)
            .text(`Σελ. ${pageNumber}`, pageWidth - rightMargin - mmToPoints(17.64), y, { align: 'right' });

        doc.fillColor("black");
    };

    const checkPageChange = (doc, contentHeight) => {
        if (doc.y + contentHeight > pageHeight) {
            addFooter(doc, currentPage);
            doc.addPage();
            currentPage++;
            addHeader(doc, companyName);
        }
    };

    // ========== ΕΚΤΥΠΩΣΗ ΠΕΡΙΕΧΟΜΕΝΟΥ ==========
    addHeader(doc, companyName);

    doc.moveDown(mmToPoints(0.5));
    doc.fontSize(12).font('./fonts/JetBrainsMono/JetBrainsMono-Bold.ttf')
        .text('ΑΠΟΤΕΛΕΣΜΑΤΑ ΕΛΕΓΧΟΥ ΜΕΤΑ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ ΤΩΝ ΨΗΦΙΑΚΩΝ ΩΡΑΡΙΩΝ ΚΑΙ ΤΩΝ ΚΑΡΤΩΝ ΕΡΓΑΣΙΑΣ', { align: 'center' });

    doc.moveDown(mmToPoints(0.4));

    const txtContent = await fs.promises.readFile(readPath, 'utf8');
    doc.fontSize(9).font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
        .text(txtContent, { align: 'justify', indent: mmToPoints(10), height: mmToPoints(25), ellipsis: true });

    doc.moveDown(0.5 * 72 / 25.4);

    for (const employee of employees) {
        const startY = doc.y;
        const textX = mmToPoints(10);

        doc.fontSize(11).font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
            .text(employee.onomateponymo, textX, startY, {
                width: nameWidthInPoints,
                align: 'left'
            });

        const formatDate = (dateStr) => {
            const [d, m, y] = dateStr.split(/[\/\-]/).map(x => x.padStart(2, '0'));
            return `${d}/${m}/${y}`;
        };
        
        const combinedText = Array.isArray(employee.hmeromhnies)
            ? employee.hmeromhnies.map(h => {
                const normalized = formatDate(h.trim());
                return hmeromhniesArgion.includes(normalized) ? `${h} Αργία` : h;
            }).join(', ')
            : '';
        
        const textStartY = doc.y;
        const textHeight = doc.heightOfString(combinedText, {
            width: fullWidth,
            align: 'left'
        });

        checkPageChange(doc, textHeight);

        doc.fontSize(8).font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
            .text(combinedText, textX, textStartY, {
                width: fullWidth,
                align: 'left'
            });

        doc.moveDown(3 / 25.4 * 72);
        const y = doc.y - 80;
        doc.moveTo(mmToPoints(10), y)
            .lineTo(mmToPoints(200) - rightMargin, y)
            .lineWidth(0.5)
            .stroke();

        doc.moveDown(14.17323);
    }

    addFooter(doc, currentPage);

    // return new Promise((resolve, reject) => {
    //     doc.end();
    //     _pdfUrlPath = `/pdf/${fileName}`;
    //     writeStream.on('finish', () => resolve(`/pdf/${fileName}`));
    //     writeStream.on('error', reject);
    // });

    return new Promise((resolve, reject) => {
        doc.end();
        const url = `/pdf/${fileName}`;                 // ✔ προσωρινή μεταβλητή
        writeStream.on('finish', () => {
            _pdfUrlPath = url;                          // ✔ ορίζεται ΜΟΛΙΣ τελειώσει το γράψιμο
            resolve(url);
        });
        writeStream.on('error', reject);
    });
}

// =======================================================================================================

class erganhController {

    static mainEisagoghOrarionApoErganhForm = async (req, res) => {
        const locals = {
            title: "Εισαγωγή Ωραρίων από Εργάνη",
            description: "Web Payroll System",
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;
    
        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "EisagoghOrarionApoErganh",
            }).exec();
        
            const passwordsData = await PasswordsModel.find({ companykod_object: companyId, kodikos: "0001" });
            
            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            res.render("ergazomenoi/programmata/eisagoghOrarionApoErganh", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
            });   
        } catch (error) {
            console.log("Error into erganhController -> mainEisagoghOrarionApoErganhForm :", error);
        }
    };

    static mainEisagoghOrarionApoKartesForm = async (req, res) => {
        const locals = {
            title: "Εισαγωγή Ωραρίων από Κάρτες",
            description: "Web Payroll System",
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;
    
        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: "EisagoghOrarionApoKartes",
            }).exec();
        
            const passwordsData = await PasswordsModel.find({ companykod_object: companyId, kodikos: "0001" });
            
            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            res.render("ergazomenoi/programmata/eisagoghOrarionApoKartes", {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
            });   
        } catch (error) {
            console.log("Error into erganhController -> mainEisagoghOrarionApoKartesForm :", error);
        }
    };

    static mainApologistikosPinakasForm = async (req, res) => {
        const locals = {
        title: "Απολογιστικός Πίνακας",
        description: "Web Payroll System",
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;
    
        try {
        // Έλεγχος CRUD των δικαιωμάτων του χρήστη
        const userPrivileges = await UserPrivilegesModel.findOne({
            userId: sessionUserId,
            form: "ApologistikosPinakasOrarion",
        }).exec();
    
        const passwordsData = await PasswordsModel.find({ companykod_object: companyId, kodikos: "0001" });
        
        const cleanedPasswordsData = passwordsData.map((data) => data._doc);

        res.render("ergazomenoi/programmata/apologistikosPinakasOrarion", {
            userPrivileges: userPrivileges ? userPrivileges.privileges : {},
            locals,
            sessionTeam: sessionTeam,
            companyId: companyId,
            passwords: cleanedPasswordsData,
        });
        } catch (error) {
        console.log("Error into programmataController -> mainApologistikosPinakasForm :", error);
        }
    };

    static eisagoghOrarionApoErganh = async (req, res) => {
        try {
        const { selectedTeam, selectedCompany, fromDate, toDate, selectedAfm, selectedUsername, selectedPassword, selectedPararthma } = req.body;
        team = selectedTeam;
        company = selectedCompany;
        username = selectedUsername;

        // let directory;

        processWorkHours(selectedUsername, selectedPassword, fromDate, toDate, selectedAfm, selectedPararthma);

        } catch (error) {
        console.log("Error into erganhController -> eisagoghOrarionApoErganh :", error);
        }

        async function processWorkHours(username, password, fromDate, toDate, afm, pararthma) {
        const start = process.hrtime();
        let excelFilePath;
        try {
            excelFilePath = await downloadOrariaExcel(username, password, fromDate, toDate, afm, pararthma);
            const xlsData = await readXLSFile(excelFilePath);
            await updateOrariaModelFromXLS(xlsData, fromDate);
        } catch (error) {
            console.error('Σφάλμα κατά την εκτέλεση:', error);
            console.error('Stack Trace:', error.stack);  // Εκτυπώνει το stack trace του σφάλματος
        } finally {
            // Διαγραφή του αρχείου XLSX αφού ολοκληρωθεί η διαδικασία
            if (excelFilePath) {
            try {
                await fs.promises.unlink(excelFilePath);
                res.json({ success: true, redirectUrl: "/ergazomenoi/programmata/eisagoghOrarionApoErganh" });
            } catch (unlinkError) {
                console.error('Σφάλμα κατά τη διαγραφή του αρχείου:', unlinkError);
            }
            }
        }

        for (let i = 0; i < 1e6; i++) {}
        
        const diff = process.hrtime(start);
        const timeInMs = diff[0] * 1000 + diff[1] / 1e6;
        console.log(`Execution time: ${timeInMs.toFixed(3)}ms`);
        }
        
        async function downloadOrariaExcel(username, password, fromDate, toDate, afm, pararthma) {
        // 1) Ορισμός φακέλου για τα downloads
        let directory;
        if (isProduction) {
            directory = '/tmp/downloads'; // π.χ. σε Linux server
        } else {
            directory = path.join(__dirname, 'downloads'); // σε Windows dev περιβάλλον
        }
        
        // 2) Δημιουργία φακέλου (αν δεν υπάρχει) και ορισμός δικαιωμάτων
        try {
            if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
            fs.chmodSync(directory, 0o777); // πλήρη δικαιώματα
            }
        } catch (error) {
            console.error('Error creating directory:', error);
            return; // Σταματάμε αν αποτύχει
        }
        
        // 3) Εκκίνηση Browser (Chromium) με Playwright
        const browser = await chromium.launch({
            headless: true,    // χωρίς GUI
            args: [
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage'
            ]
        });
        
        // 4) Δημιουργία Browser Context με ρυθμίσεις λήψης (προεραιτικό)
        const context = await browser.newContext({
            acceptDownloads: true,      // Να επιτρέπονται τα downloads
            // Σε Playwright 1.20+ μπορείς να ορίσεις download path
            // απλά κρατάμε manual τρόπο παρακάτω
        });
        
        // 5) Άνοιγμα νέας σελίδας
        const page = await context.newPage();
        
        try {
            // 6) Μετάβαση στη σελίδα login
            await page.goto('https://eservices.yeka.gr/login.aspx');
        
            // 7) Είσοδος (login)
            //   - Συμπληρώνουμε πεδία username / password
            await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName', username);
            await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password', password);
            //   - Πατάμε Enter ή κλικ σε κουμπί
            await page.keyboard.press('Enter'); 
        
            // 8) Πλοήγηση στη σελίδα, συμπλήρωση πεδίων
            //    - Περιμένουμε να φορτώσει η επόμενη σελίδα
            //    - Χρησιμοποιούμε selectors αντί για driver.findElement()
        
            await page.click('xpath=//*[@id="ctl00_ctl00_ContentHolder_ContentHolder_SdcTableMenu"]/div/ol/li[2]/ol/li[3]/ol/li[4]/div/a');

            if (pararthma) {
            await page.selectOption('#ctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_PararthmaSelection_PararthmaListEdit', pararthma);
            }
        
            if (afm) {
            await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_AfmEdit', afm);
            }
        
            // 9) Συμπλήρωση ημερομηνιών (fromDate / toDate)
            const fromDateStr = fromDate.replace(/-/g, '');
            const toDateStr   = toDate.replace(/-/g, '');
        
            // Κάνουμε κλικ στο πεδίο και γράφουμε την τιμή
            await page.click('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_DateFromEdit"]');
            await page.fill('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_DateFromEdit"]', fromDateStr);
        
            await page.click('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_DateToEdit"]');
            await page.fill('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_DateToEdit"]', toDateStr);
        
            // 10) Πατάμε Search
            await page.click('#ctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_SearchControlSearchButton');
        
            // 11) Περιμένουμε να εμφανιστεί το κουμπί ExcelExport
            const excelExportButton = page.locator('.ExcelExport');
            await excelExportButton.waitFor({ state: 'visible', timeout: 10000 });
        
            // 12) Ξεκινάμε το download πατώντας το κουμπί
            // Σε Playwright, μπορούμε να περιμένουμε το event "download"
            const [ download ] = await Promise.all([
            page.waitForEvent('download'),    // Περιμένουμε να ξεκινήσει download
            excelExportButton.click()         // Κλικ στο κουμπί
            ]);
        
            // 13) Αποθήκευση του αρχείου στο επιθυμητό path
            const filename = 'Grid.xlsx';
            const downloadPath = path.join(directory, filename);
        
            // Playwright κατεβάζει σε προσωρινό path• μπορούμε να το αποθηκεύσουμε όπου θέλουμε:
            await download.saveAs(downloadPath);
        
            // 14) Προαιρετικά, επιβεβαιώνουμε ότι το αρχείο υπάρχει και δεν είναι άδειο
            // (Η download.saveAs επιστρέφει μόνο όταν έχει τελειώσει η λήψη)
            const stats = fs.statSync(downloadPath);
            if (!stats || stats.size === 0) {
            throw new Error('Το αρχείο XLSX είναι κενό ή δεν κατέβηκε σωστά!');
            }
        
            // 15) Μετονομασία / Επεξεργασία μέσω της συνάρτησης που ήδη έχεις
            const newPath = await renameFileAndRead("erg_m_234", username, fromDate, toDate, directory);
        
            return newPath;
        
        } catch (error) {
            console.error('Error during operation:', error);
        } finally {
            // 16) Κλείνουμε browser
            await browser.close();
        }
        }

        async function renameFileAndRead(prefix, username, fromDate, toDate, directory) {
        const filename = 'Grid.xlsx';
        const newFilename = `${prefix}_${username}__${fromDate.replace(/\//g, '-')}_${toDate.replace(/\//g, '-')}.xlsx`;
        const newDownloadPath = path.join(directory, newFilename);
    
        try {
            // Χρησιμοποιούμε το fs.promises.rename για να μετονομάσουμε το αρχείο
            await fs.promises.rename(path.join(directory, filename), newDownloadPath);
    
            // Τώρα μπορούμε να διαβάσουμε το αρχείο
            return newDownloadPath;
        } catch (err) {
            console.error('Error renaming the file or reading the file:', err);
        }
        }
    
        // Συνάρτηση για εξαγωγή ωρών από το string
        function extractTimePeriods(workString) {
        const timePeriods = workString.match(/\d{2}:\d{2}/g);
        return timePeriods ? timePeriods : [];
        }

        // Συνάρτηση για ομαδοποίηση των εργαζομένων ανά ΑΦΜ
        function groupByAFM(xlsData) {
        const grouped = {};
        for (const row of xlsData.slice(1)) { // Παραλείπουμε την πρώτη γραμμή (επικεφαλίδα)
            const afm = row[1];
            if (!grouped[afm]) {
                grouped[afm] = [];
            }
            grouped[afm].push(row);
        }
        return grouped;
        }

        function findWeeksInMonth(year, month) {
        let monthInt = parseInt(month, 10); 

        let startDate = new Date(Date.UTC(year, monthInt -1, 1)); // Ορισμός της πρώτης ημέρας του μήνα
        let endDate = new Date(Date.UTC(year, monthInt, 0)); // Τελευταία ημέρα του μήνα
        let weeks = []; // Μεταβλητή για την αποθήκευση των εβδομάδων
        let currentDay = new Date(startDate); // Εύρεση της πρώτης ημέρας της πρώτης εβδομάδας
    
        // Επανάληψη μέχρι την τελευταία ημέρα του μήνα
        while (currentDay <= endDate) {
            let weekStart = new Date(currentDay);
    
            let dayOfWeek = weekStart.getDay(); // Εύρεση της Δευτέρας της τρέχουσας εβδομάδας (πρώτη ημέρα της εβδομάδας)
            let daysToMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Αν είναι Κυριακή (0), πάει πίσω 6 ημέρες
            weekStart.setDate(weekStart.getDate() - daysToMonday);
    
            weeks.push(weekStart.toISOString().substring(0, 10)); // Προσθήκη στον πίνακα εβδομάδων
    
            currentDay.setDate(currentDay.getDate() + 7); // Προχωράμε στην επόμενη εβδομάδα
        }
    
        return weeks; // Επιστροφή του πίνακα με τις εβδομάδες
        }

        function processWeeks(weeks, year, month) {
        let monthInt = parseInt(month, 10); // Μετατροπή της συμβολοσειράς month σε ακέραιο αριθμό
    
        // Υπολογισμός της τελευταίας ημέρας του μήνα
        let endDate = new Date(Date.UTC(year, monthInt, 0)); // τελευταία ημέρα του μήνα

        // Πίνακας για τα διαστήματα των εβδομάδων
        let intervals = [];
    
        for (let i = 0; i < weeks.length; i++) {
            let startOfWeek, endOfWeek;
    
            if (i === 0) {
                // Η πρώτη εβδομάδα ξεκινάει από την 1η ημέρα του μήνα
                startOfWeek = new Date(Date.UTC(year, monthInt - 1, 1));
                endOfWeek = new Date(Date.UTC(year, monthInt -1, new Date(weeks[i + 1]).getUTCDate() - 1));
            } else if (i === weeks.length - 1) {
                // Η τελευταία εβδομάδα τελειώνει στην τελευταία ημέρα του μήνα
                startOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate()));
                endOfWeek = endDate; // Τελευταία ημέρα του μήνα
            } else {
                // Ενδιάμεσες εβδομάδες
                startOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate()));
                endOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i + 1]).getUTCDate() - 1));
            }
    
            // Προσθήκη του διαστήματος στον πίνακα
            intervals.push({
                start: startOfWeek.toISOString().substring(0, 10),
                end: endOfWeek.toISOString().substring(0, 10)
            });
        }
    
        return intervals;
        }

        function getDaysFromLastMondayOfPreviousMonth(startYear, startMonth) {
        // Δημιουργία της πρώτης ημέρας του τρέχοντος μήνα
        const firstDayOfCurrentMonth = new Date(Date.UTC(startYear, startMonth - 1, 1));
        // Έλεγχος αν η πρώτη μέρα είναι Δευτέρα
        if (firstDayOfCurrentMonth.getDay() === 1) {
            return []; // Επιστροφή κενής λίστας καθώς δεν θέλουμε να κάνουμε τίποτα
        }

        // Δημιουργία της τελευταίας ημέρας του προηγούμενου μήνα
        const lastDayOfPreviousMonth = new Date(Date.UTC(startYear, startMonth - 1, 0));

        // Βρίσκουμε την τελευταία Δευτέρα του προηγούμενου μήνα
        const lastMondayOfPreviousMonth = new Date(Date.UTC( lastDayOfPreviousMonth.getUTCFullYear(), lastDayOfPreviousMonth.getUTCMonth(), lastDayOfPreviousMonth.getUTCDate() ));

        const dayOfWeek = lastMondayOfPreviousMonth.getDay(); // 1 είναι η Δευτέρα
        
        // Αν δεν είναι Δευτέρα, πηγαίνει πίσω στις μέρες μέχρι να βρει τη Δευτέρα
        const daysToSubtract = (dayOfWeek === 0) ? 6 : (dayOfWeek - 1); // Πίσω από Κυριακή (6) ή από οποιαδήποτε μέρα μέχρι να βρούμε Δευτέρα
        lastMondayOfPreviousMonth.setDate(lastMondayOfPreviousMonth.getDate() - daysToSubtract);
    
        // Πίνακας για τις ημέρες που θέλουμε να αποθηκεύσουμε
        const daysBetween = [];
        
        // Ξεκινάμε από την τελευταία Δευτέρα του προηγούμενου μήνα μέχρι την προηγούμενη της πρώτης μέρας του τρέχοντα μήνα
        let currentDay = lastMondayOfPreviousMonth;
        
        while (currentDay < firstDayOfCurrentMonth) {
            daysBetween.push(new Date(Date.UTC( currentDay.getUTCFullYear(), currentDay.getUTCMonth(), currentDay.getUTCDate() ))); // Προσθήκη της ημερομηνίας στον πίνακα
            currentDay.setDate(currentDay.getDate() + 1); // Μετακινήση στην επόμενη ημέρα
        }
        
        return daysBetween;
        }

        // Συνάρτηση για ενημέρωση του OrariaModel με βάση το Excel
        async function updateOrariaModelFromXLS(xlsData, fromDate) {
        // const batchSize = 500; // Μέγεθος της παρτίδας (batch)
        const employeeData = groupByAFM(xlsData); // Ομαδοποίηση δεδομένων ανά ΑΦΜ
        
        const _company = await CompaniesModel.find({_id: company}, 'kod -_id').lean();
        const companyCode = _company[0].kod.toString().padStart(4, "0");

        const argies = await ArgiesModel.find({team: team, company_kod: companyCode, etos: new Date(fromDate).getFullYear()}, 'hmeromhnia -_id').lean();

        // Μετατροπή των ημερομηνιών στη μορφή "ηη/μμ/εεεε"
        const hmeromhniesArgion = argies.map(argia => {
            const date = new Date(argia.hmeromhnia); // Μετατροπή της ημερομηνίας σε Date object
            // Μετατροπή στη μορφή ηη/μμ/εεεε
            return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        });

        let checkMonth, checkYear;
        let _argia = false;
        for (const afm in employeeData) {
            const operations = []; // Αποθηκεύουμε τις λειτουργίες ενημέρωσης εδώ
            const operations_oraria = []; // Αποθηκεύουμε τις λειτουργίες ενημέρωσης εδώ
            const rows = employeeData[afm]; // Δεδομένα για τον τρέχοντα εργαζόμενο

            // Βρίσκουμε τον εργαζόμενο με βάση το ΑΦΜ
            const ergazomenos = await ErgazomenoiModel.findOne({ afm });
            if (!ergazomenos) {
            console.log(`Δεν βρέθηκε εργαζόμενος με ΑΦΜ: ${afm}`);
            continue;
            }
            const kodikos = ergazomenos.kodikos;

            // Βρίσκουμε τις καταγεγραμμένες ημερομηνίες από το Excel
            let recordedDays = rows.map(row => {
            const [day, month, year] = row[4].split('/').map(Number);
            return new Date(Date.UTC(year, month - 1, day)).toISOString().substring(0, 10);
            });

            checkMonth = parseInt(recordedDays[0].split('-')[1]) -1;
            checkYear = parseInt(recordedDays[0].split('-')[0]);

            // Υπολογισμός της 1ης ημέρας του μήνα βάσει του fromDate
            let currentDate = new Date(Date.UTC(checkYear, checkMonth, 1)); // Πρώτη ημέρα του δοσμένου μήνα
            let lastDayOfMonth = new Date(Date.UTC(checkYear, checkMonth + 1, 0)); // Τελευταία ημέρα του μήνα

            let allDays = [];
            while (currentDate <= lastDayOfMonth) {
            allDays.push(currentDate.toISOString().substring(0, 10));
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }

            // Περνάμε από όλες τις ημέρες του μήνα
            allDays.forEach(hmeromhniaErgasias => {
            const existingRow = rows.find(row => {
                const [dayStr, monthStr, yearStr] = row[4].split('/');
                const rowDate = new Date(Date.UTC(yearStr, monthStr - 1, dayStr)).toISOString().substring(0, 10);
                return rowDate === hmeromhniaErgasias;
            });

            if (existingRow) {
                // Αν η ημέρα υπάρχει στο Excel, προσθέτουμε την εγγραφή της
                // const afm = existingRow[1]; // ΑΦΜ (δεύτερο κελί)

                const rowDate = existingRow[4]; // Π.χ., "1/8/2024"
                const [day, month, year] = rowDate.split('/').map(Number); // Εξαγωγή ημέρας, μήνα, έτους
                const date = new Date(Date.UTC(year, month - 1, day)); // Δημιουργία UTC ημερομηνία
                checkMonth = month;
                checkYear = year;
                const rowDateFormatted = day.toString().padStart(2, "0") + "/" + month.toString().padStart(2, "0") + "/" + year.toString()
                const nextDate = new Date(date);
                nextDate.setUTCDate(date.getUTCDate() + 1);
                const dayOfWeek = date.getDay();
                const nextDayOfWeek = nextDate.getDay();
                const nextDateFormatted = nextDate.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
                const workData = existingRow[8]; // Εργασία (ένατο κελί)
    
                _argia = hmeromhniesArgion.includes(rowDateFormatted);
                const isHoliday = hmeromhniesArgion.includes(rowDateFormatted);
                const isSunday = dayOfWeek === 0; // 0 = Κυριακή
                const isNextHoliday = hmeromhniesArgion.includes(nextDateFormatted);
                const isNextSunday = nextDayOfWeek === 0; // 0 = Κυριακή

                let orariaData = {
                kathgoria_ergasias: '', 
                apo_ora_01: null,
                eos_ora_01: null,
                apo_ora_02: null,
                eos_ora_02: null,
                apo_ora_03: null,
                eos_ora_03: null,
                repo: false,
                adeia: false,
                astheneia: false,
                argia: false,
                perigrafh_argias: "",
                kathgoria_adeias: "",
                ores_ergasias: 0,
                ores_nyxtas: 0,
                ores_argion: 0,
                ores_yperergasias: 0,
                ores_yperergasias_nyxtas: 0,
                ores_yperergasias_argion: 0,
                ores_yperergasias_argion_nyxtas: 0,
                ores_nominhs_yperorias: 0,
                ores_nominhs_yperorias_nyxtas: 0,
                ores_nominhs_yperorias_argion: 0,
                ores_nominhs_yperorias_argion_nyxtas: 0,
                ores_paranomhs_yperorias: 0,
                ores_paranomhs_yperorias_nyxtas: 0,
                ores_paranomhs_yperorias_argion: 0,
                ores_paranomhs_yperorias_argion_nyxtas: 0
                };
    
                let orariaData_oraria = {
                kathgoria_ergasias: '', 
                apo_ora_01_oraria: null,
                eos_ora_01_oraria: null,
                apo_ora_02_oraria: null,
                eos_ora_02_oraria: null,
                apo_ora_03_oraria: null,
                eos_ora_03_oraria: null,
                repo_oraria: false,
                adeia_oraria: false,
                astheneia_oraria: false,
                argia_oraria: false,
                perigrafh_argias_oraria: "",
                kathgoria_adeias_oraria: "",
                ores_ergasias_oraria: 0,
                ores_nyxtas_oraria: 0,
                ores_argion_oraria: 0,
                ores_yperergasias_oraria: 0,
                ores_yperergasias_nyxtas_oraria: 0,
                ores_yperergasias_argion_oraria: 0,
                ores_yperergasias_argion_nyxtas_oraria: 0,
                ores_nominhs_yperorias_oraria: 0,
                ores_nominhs_yperorias_nyxtas_oraria: 0,
                ores_nominhs_yperorias_argion_oraria: 0,
                ores_nominhs_yperorias_argion_nyxtas_oraria: 0,
                ores_paranomhs_yperorias_oraria: 0,
                ores_paranomhs_yperorias_nyxtas_oraria: 0,
                ores_paranomhs_yperorias_argion_oraria: 0,
                ores_paranomhs_yperorias_argion_nyxtas_oraria: 0
                };
    
                // Καθορισμός της κατηγορίας εργασίας
                if (workData.includes('ΜΗ ΕΡΓΑΣΙΑ')) {
                orariaData.kathgoria_ergasias = 'ΜΕ';
                orariaData.repo = false;
                orariaData_oraria.kathgoria_ergasias = 'ΜΕ';
                orariaData_oraria.repo_oraria = false;
                } else if (workData.includes('ΑΝΑΠΑΥΣΗ/ΡΕΠΟ')) {
                orariaData.kathgoria_ergasias = 'ΑΝ';
                orariaData.repo = true;
                orariaData_oraria.kathgoria_ergasias = 'ΑΝ';
                orariaData_oraria.repo_oraria = true;
                } else if (workData.includes('ΕΡΓΑΣΙΑ')) {
                orariaData.kathgoria_ergasias = 'ΕΡΓ';
                orariaData.repo = false;
                orariaData_oraria.kathgoria_ergasias = 'ΕΡΓ';
                orariaData_oraria.repo_oraria = false;
                } else if (workData.includes('ΤΗΛΕΡΓΑΣΙΑ')) {
                orariaData.kathgoria_ergasias = 'ΤΗΛ';
                orariaData.repo = false;
                orariaData_oraria.kathgoria_ergasias = 'ΤΗΛ';
                orariaData_oraria.repo_oraria = false;
                }
            
                const timePeriods = extractTimePeriods(workData);
                
                // Εισαγωγή των ωρών ανάλογα με τον αριθμό των περιόδων
                if (timePeriods.length === 2) {
                orariaData.apo_ora_01 = timePeriods[0];
                orariaData.eos_ora_01 = timePeriods[1];

                orariaData_oraria.apo_ora_01_oraria = timePeriods[0];
                orariaData_oraria.eos_ora_01_oraria = timePeriods[1];
                } else if (timePeriods.length === 4) {
                orariaData.apo_ora_01 = timePeriods[0];
                orariaData.eos_ora_01 = timePeriods[1];
                orariaData.apo_ora_02 = timePeriods[2];
                orariaData.eos_ora_02 = timePeriods[3];

                orariaData_oraria.apo_ora_01_oraria = timePeriods[0];
                orariaData_oraria.eos_ora_01_oraria = timePeriods[1];
                orariaData_oraria.apo_ora_02_oraria = timePeriods[2];
                orariaData_oraria.eos_ora_02_oraria = timePeriods[3];
                } else if (timePeriods.length === 6) {
                orariaData.apo_ora_01 = timePeriods[0];
                orariaData.eos_ora_01 = timePeriods[1];
                orariaData.apo_ora_02 = timePeriods[2];
                orariaData.eos_ora_02 = timePeriods[3];
                orariaData.apo_ora_03 = timePeriods[4];
                orariaData.eos_ora_03 = timePeriods[5];

                orariaData_oraria.apo_ora_01_oraria = timePeriods[0];
                orariaData_oraria.eos_ora_01_oraria = timePeriods[1];
                orariaData_oraria.apo_ora_02_oraria = timePeriods[2];
                orariaData_oraria.eos_ora_02_oraria = timePeriods[3];
                orariaData_oraria.apo_ora_03_oraria = timePeriods[4];
                orariaData_oraria.eos_ora_03_oraria = timePeriods[5];
                }
    
                let intervals = [];
    
                for (let j = 1; j <= 3; j++) {
                const startTimeInput = orariaData[`apo_ora_0${j}`];
                const endTimeInput = orariaData[`eos_ora_0${j}`];
                if (!startTimeInput || !endTimeInput) {
                    continue;
                }
    
                let startTime = convertTimeToMinutes(startTimeInput);
                let endTime = convertTimeToMinutes(endTimeInput);
                if (endTime < startTime) endTime += 1440;
            
                intervals.push({ start: startTime, end: endTime, shift: j });
                }
            
                // Υπολογισμός ωρών εργασίας, υπερεργασίας κλπ
                const workHours = calculateWorkHoursForIntervals(intervals, isHoliday || isSunday, isNextHoliday || isNextSunday);
    
                orariaData.argia = isHoliday;
                orariaData.ores_ergasias = workHours.working;
                orariaData.ores_nyxtas = workHours.night;
                orariaData.ores_argion = workHours.holiday;
                orariaData.ores_yperergasias = workHours.overwork;
                orariaData.ores_yperergasias_nyxtas = workHours.nightOverwork;
                orariaData.ores_yperergasias_argion = workHours.holidayOverwork;
                orariaData.ores_yperergasias_argion_nyxtas = workHours.nightHolidayOverwork;
                orariaData.ores_nominhs_yperorias = workHours.overtime;
                orariaData.ores_nominhs_yperorias_nyxtas = workHours.nightOvertime;
                orariaData.ores_nominhs_yperorias_argion = workHours.holidayOvertime;
                orariaData.ores_nominhs_yperorias_argion_nyxtas = workHours.nightHolidayOvertime;
                orariaData.ores_paranomhs_yperorias = workHours.overtimeIllegal;
                orariaData.ores_paranomhs_yperorias_nyxtas = workHours.nightOvertimeIllegal;
                orariaData.ores_paranomhs_yperorias_argion = workHours.holidayOvertimeIllegal;
                orariaData.ores_paranomhs_yperorias_argion_nyxtas = workHours.nightHolidayOvertimeIllegal;
    
                orariaData_oraria.argia_oraria = isHoliday;
                orariaData_oraria.ores_ergasias_oraria = workHours.working;
                orariaData_oraria.ores_nyxtas_oraria = workHours.night;
                orariaData_oraria.ores_argion_oraria = workHours.holiday;
                orariaData_oraria.ores_yperergasias_oraria = workHours.overwork;
                orariaData_oraria.ores_yperergasias_nyxtas_oraria = workHours.nightOverwork;
                orariaData_oraria.ores_yperergasias_argion_oraria = workHours.holidayOverwork;
                orariaData_oraria.ores_yperergasias_argion_nyxtas_oraria = workHours.nightHolidayOverwork;
                orariaData_oraria.ores_nominhs_yperorias_oraria = workHours.overtime;
                orariaData_oraria.ores_nominhs_yperorias_nyxtas_oraria = workHours.nightOvertime;
                orariaData_oraria.ores_nominhs_yperorias_argion_oraria = workHours.holidayOvertime;
                orariaData_oraria.ores_nominhs_yperorias_argion_nyxtas_oraria = workHours.nightHolidayOvertime;
                orariaData_oraria.ores_paranomhs_yperorias_oraria = workHours.overtimeIllegal;
                orariaData_oraria.ores_paranomhs_yperorias_nyxtas_oraria = workHours.nightOvertimeIllegal;
                orariaData_oraria.ores_paranomhs_yperorias_argion_oraria = workHours.holidayOvertimeIllegal;
                orariaData_oraria.ores_paranomhs_yperorias_argion_nyxtas_oraria = workHours.nightHolidayOvertimeIllegal;
    
                // Προσθήκη της λειτουργίας ενημέρωσης στη λίστα operations
                operations.push({
                updateOne: {
                    filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                    update: {
                    $set: orariaData,
                    $setOnInsert: {
                        team: team,
                        company_kod: company,
                        kodikos: kodikos,
                        hmeromhnia: new Date(hmeromhniaErgasias)
                    }
                    },
                    upsert: true
                }
                });

                operations_oraria.push({
                updateOne: {
                    filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                    update: {
                        $set: orariaData_oraria,
                        $setOnInsert: {
                            team: team,
                            company_kod: company,
                            kodikos: kodikos,
                            hmeromhnia: new Date(hmeromhniaErgasias)
                        }
                    },
                    upsert: true
                }
                });
    
            } else {
                // Αν η ημέρα δεν υπάρχει στο Excel, προσθέτουμε κενή εγγραφή
                let orariaData = {
                kathgoria_ergasias: 'ΜΕ',
                apo_ora_01: null,
                eos_ora_01: null,
                apo_ora_02: null,
                eos_ora_02: null,
                apo_ora_03: null,
                eos_ora_03: null,
                repo: false,
                adeia: false,
                astheneia: false,
                argia: _argia,
                perigrafh_argias: "",
                kathgoria_adeias: "",
                ores_ergasias: 0,
                ores_nyxtas: 0,
                ores_argion: 0,
                ores_yperergasias: 0,
                ores_yperergasias_nyxtas: 0,
                ores_yperergasias_argion: 0,
                ores_yperergasias_argion_nyxtas: 0,
                ores_nominhs_yperorias: 0,
                ores_nominhs_yperorias_nyxtas: 0,
                ores_nominhs_yperorias_argion: 0,
                ores_nominhs_yperorias_argion_nyxtas: 0,
                ores_paranomhs_yperorias: 0,
                ores_paranomhs_yperorias_nyxtas: 0,
                ores_paranomhs_yperorias_argion: 0,
                ores_paranomhs_yperorias_argion_nyxtas: 0
                };
        
                let orariaData_oraria = {
                kathgoria_ergasias: 'ΜΕ',
                apo_ora_01_oraria: null,
                eos_ora_01_oraria: null,
                apo_ora_02_oraria: null,
                eos_ora_02_oraria: null,
                apo_ora_03_oraria: null,
                eos_ora_03_oraria: null,
                repo_oraria: false,
                adeia_oraria: false,
                astheneia_oraria: false,
                argia_oraria: _argia,
                perigrafh_argias_oraria: "",
                kathgoria_adeias_oraria: "",
                ores_ergasias_oraria: 0,
                ores_nyxtas_oraria: 0,
                ores_argion_oraria: 0,
                ores_yperergasias_oraria: 0,
                ores_yperergasias_nyxtas_oraria: 0,
                ores_yperergasias_argion_oraria: 0,
                ores_yperergasias_argion_nyxtas_oraria: 0,
                ores_nominhs_yperorias_oraria: 0,
                ores_nominhs_yperorias_nyxtas_oraria: 0,
                ores_nominhs_yperorias_argion_oraria: 0,
                ores_nominhs_yperorias_argion_nyxtas_oraria: 0,
                ores_paranomhs_yperorias_oraria: 0,
                ores_paranomhs_yperorias_nyxtas_oraria: 0,
                ores_paranomhs_yperorias_argion_oraria: 0,
                ores_paranomhs_yperorias_argion_nyxtas_oraria: 0
                };
        
                operations.push({
                updateOne: {
                    filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                    update: {
                    $set: orariaData,
                    $setOnInsert: {
                        team: team,
                        company_kod: company,
                        kodikos: kodikos,
                        hmeromhnia: new Date(hmeromhniaErgasias)
                    }
                    },
                    upsert: true
                }
                });

                operations_oraria.push({
                updateOne: {
                    filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                    update: {
                    $set: orariaData_oraria,
                    $setOnInsert: {
                        team: team,
                        company_kod: company,
                        kodikos: kodikos,
                        hmeromhnia: new Date(hmeromhniaErgasias)
                    }
                    },
                    upsert: true
                }
                });
            }
            });

            let weeksInMonth = findWeeksInMonth(checkYear, checkMonth);
            let intervals = processWeeks(weeksInMonth, checkYear, checkMonth);

            const daysOfPreviousMonth = getDaysFromLastMondayOfPreviousMonth(checkYear, checkMonth);
            const firstDate = daysOfPreviousMonth[0]; 
            const lastDate = daysOfPreviousMonth[daysOfPreviousMonth.length - 1]; 

            const orariaProhgMhna = await OrariaModel.find({
            team: team,
            company_kod: company,
            kodikos: kodikos,
            hmeromhnia: { $gte: new Date(firstDate), $lte: new Date(lastDate) }
            }).sort({ hmeromhnia: 1 });
        
            // Υπολογισμός του συνόλου των πεδίων
            const data = orariaProhgMhna.reduce((accumulator, schedule) => {
            return {
                ores_ergasias: accumulator.ores_ergasias + schedule.ores_ergasias,
                ores_yperergasias: accumulator.ores_yperergasias + schedule.ores_yperergasias,
                ores_yperergasias_nyxtas: accumulator.ores_yperergasias_nyxtas + schedule.ores_yperergasias_nyxtas,
                ores_yperergasias_argion: accumulator.ores_yperergasias_argion + schedule.ores_yperergasias_argion,
                ores_yperergasias_argion_nyxtas: accumulator.ores_yperergasias_argion_nyxtas + schedule.ores_yperergasias_argion_nyxtas
            };
            }, {
            ores_ergasias: 0,
            ores_yperergasias: 0,
            ores_yperergasias_nyxtas: 0,
            ores_yperergasias_argion: 0,
            ores_yperergasias_argion_nyxtas: 0
            });

            const total = Object.values(data).reduce((sum, value) => sum + value, 0);
            let weeklyTotal = 0, weeklyTotal_oraria = 0;

            for (let i = 0; i < intervals.length; i++) {
            let fromDay = parseInt(intervals[i].start.substring(8, 10)) -1;
            let toDay = parseInt(intervals[i].end.substring(8, 10)) - 1;
            if (i === 0) {
                weeklyTotal = total;
            } else {
                weeklyTotal = 0;
            }

            // Πρώτα υπολογίζουμε το συνολικό weeklyTotal για όλες τις ημέρες της εβδομάδας
            for (let j = fromDay; j <= toDay; j++) {
                // Έλεγχος αν το incValues έχει τιμές (δηλαδή δεν είναι undefined ή null)
                const incValues = operations[j]?.updateOne?.update?.$set;
                
                if (incValues && Object.keys(incValues).length > 0) {
                // Ορισμός των πεδίων που θέλουμε να αθροίσουμε
                const fieldsToSum = ['ores_ergasias', 'ores_yperergasias', 'ores_yperergasias_nyxtas', 'ores_yperergasias_argion', 'ores_yperergasias_argion_nyxtas'];
                
                // Χρήση Object.entries() για να αθροίσουμε μόνο τα επιθυμητά πεδία
                weeklyTotal += Object.entries(incValues)
                    .filter(([key]) => fieldsToSum.includes(key))  // Επιλογή μόνο των επιθυμητών πεδίων
                    .reduce((sum, [, value]) => sum + value, 0);   // Άθροισμα των τιμών
                }

            }

            // Τώρα, αφού έχει υπολογιστεί το weeklyTotal για όλη την εβδομάδα, κάνουμε τον έλεγχο
            if (weeklyTotal <= 40) {
                // Εδώ γίνονται οι ενημερώσεις για όλες τις ημέρες
                for (let j = fromDay; j <= toDay; j++) {
                let ores_ergasias = (operations[j].updateOne.update.$set.ores_ergasias || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
                
                let ores_nyxtas =   (operations[j].updateOne.update.$set.ores_nyxtas || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
                
                let ores_argion =   (operations[j].updateOne.update.$set.ores_argion || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                    (operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);

                operations[j].updateOne.update.$set.ores_ergasias = ores_ergasias;
                operations[j].updateOne.update.$set.ores_nyxtas = ores_nyxtas;
                operations[j].updateOne.update.$set.ores_argion = ores_argion;
                operations[j].updateOne.update.$set.ores_yperergasias = 0;
                operations[j].updateOne.update.$set.ores_yperergasias_nyxtas = 0;
                operations[j].updateOne.update.$set.ores_yperergasias_argion = 0;
                operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas = 0;

                let ores_ergasias_oraria = (operations_oraria[j].updateOne.update.$set.ores_ergasias || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
                
                let ores_nyxtas_oraria =   (operations_oraria[j].updateOne.update.$set.ores_nyxtas || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
                
                let ores_argion_oraria =   (operations_oraria[j].updateOne.update.$set.ores_argion || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                            (operations_oraria[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);

                operations_oraria[j].updateOne.update.$set.ores_ergasias_oraria = ores_ergasias;
                operations_oraria[j].updateOne.update.$set.ores_nyxtas_oraria = ores_nyxtas;
                operations_oraria[j].updateOne.update.$set.ores_argion_oraria = ores_argion;
                operations_oraria[j].updateOne.update.$set.ores_yperergasias_oraria = 0;
                operations_oraria[j].updateOne.update.$set.ores_yperergasias_nyxtas_oraria = 0;
                operations_oraria[j].updateOne.update.$set.ores_yperergasias_argion_oraria = 0;
                operations_oraria[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas_oraria = 0;
                }
            }
            }

            // Εκτέλεση τυχόν υπόλοιπων operations
            if (operations.length > 0) {
            await OrariaModel.bulkWrite(operations);
            }

            if (operations_oraria.length > 0) {
            await OrariaApologistikaModel.bulkWrite(operations_oraria);
            }
        }
        }  
    }

  static eisagoghOrarionApoKartes = async (req, res) => {
    try {
      const { selectedTeam, selectedCompany, fromDate, toDate, selectedAfm, selectedUsername, selectedPassword, selectedPararthma, selectedInterval } = req.body;
      team = selectedTeam;
      company = selectedCompany;
      username = selectedUsername;

      processWorkHoursFromKartes(selectedUsername, selectedPassword, fromDate, toDate, selectedAfm, selectedPararthma, selectedInterval);

    } catch (error) {
      console.log("Error into erganhController -> eisagoghOrarionApoKartes :", error);
    }

    async function processWorkHoursFromKartes(username, password, fromDate, toDate, afm, pararthma, stroggylopoihsh) {
      const start = process.hrtime();
      let excelFilePath;
      try {
        excelFilePath = await downloadKartesExcel(username, password, fromDate, toDate, afm, pararthma);
        const xlsData = await readXLSFile(excelFilePath);
        const newXlsData = await adjustOvernightEntries(xlsData, stroggylopoihsh);
        await updateOrariaFromCardsModelFromXLS(newXlsData, fromDate);
      } catch (error) {
        console.error('Σφάλμα κατά την εκτέλεση:', error);
      } 
      finally {
        // Διαγραφή του αρχείου XLSX αφού ολοκληρωθεί η διαδικασία
        if (excelFilePath) {
          try {
            await fs.promises.unlink(excelFilePath);
            res.json({ url: _pdfUrlPath, success: true, redirectUrl: "/ergazomenoi/programmata/eisagoghOrarionApoKartes" });
          } catch (unlinkError) {
            console.error('Σφάλμα κατά τη διαγραφή του αρχείου:', unlinkError);
          }
        }
      }
      
      for (let i = 0; i < 1e6; i++) {}
    
      const diff = process.hrtime(start);
      const timeInMs = diff[0] * 1000 + diff[1] / 1e6;
      console.log(`Execution time: ${timeInMs.toFixed(3)}ms`);

    }

    async function downloadKartesExcel(username, password, fromDate, toDate, afm, pararthma) {
        let directory;
        if (isProduction) {
            directory = '/tmp/downloads'; // π.χ. σε Linux server
        } else {
            directory = path.join(__dirname, 'downloads'); // σε Windows dev περιβάλλον
        }
            
        try {
            if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
            fs.chmodSync(directory, 0o777); // πλήρη δικαιώματα
            }
        } catch (error) {
            console.error('Error creating directory:', error);
            return null;
        }
        
        // Εκκίνηση του browser (Chromium) σε headless mode
        const browser = await chromium.launch({
            headless: true,
            args: [
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage'
            ]
        });
        
        // Δημιουργούμε context και σελίδα με ενεργοποιημένα downloads
        const context = await browser.newContext({ acceptDownloads: true });
        const page = await context.newPage();
        
        try {
            // Μετάβαση στη σελίδα login
            await page.goto('https://eservices.yeka.gr/login.aspx');
        
            // Είσοδος (username/password -> Enter)
            await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName', username);
            await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password', password);
            await page.keyboard.press('Enter'); 
        
            // Πλοήγηση στο μενού
            await page.click('xpath=//*[@id="ctl00_ctl00_ContentHolder_ContentHolder_SdcTableMenu"]/div/ol/li[2]/ol/li[6]/ol/li[3]/div/a');
        
            // Συμπλήρωση πεδίων
            if (pararthma) {
                await page.selectOption('#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_PararthmaSelection_PararthmaListEdit', pararthma);
            }
            if (afm) {
                await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_AfmEdit', afm);
            }
        
            // Μετατροπή σε μορφή χωρίς '-', όπως στο Selenium
            const fromDateStr = fromDate.replace(/-/g, '');
            const toDateStr   = toDate.replace(/-/g, '');
        
            await page.click('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateFromEdit"]');
            await page.fill('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateFromEdit"]', fromDateStr);
        
            await page.click('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateToEdit"]');
            await page.fill('xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateToEdit"]', toDateStr);
        
            // Πατάμε Search
            await page.click('#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_SearchControlSearchButton');

            const excelExportButton = page.locator('.ExcelExport');
            await excelExportButton.waitFor({ state: 'visible', timeout: 10000 });
        
            // Ξεκινάμε το download πατώντας το κουμπί
            const [ download ] = await Promise.all([
                page.waitForEvent('download'),    // Περιμένουμε να ξεκινήσει download
                excelExportButton.click()         // Κλικ στο κουμπί
            ]);

            // Αποθήκευση του αρχείου στο επιθυμητό path
            const filename = 'Grid.xlsx';
            const downloadPath = path.join(directory, filename);
            await download.saveAs(downloadPath);
        
            // Προαιρετικά, επιβεβαιώνουμε ότι το αρχείο υπάρχει και δεν είναι άδειο
            // (Η download.saveAs επιστρέφει μόνο όταν έχει τελειώσει η λήψη)
            const stats = fs.statSync(downloadPath);
            if (!stats || stats.size === 0) {
                throw new Error('Το αρχείο XLSX είναι κενό ή δεν κατέβηκε σωστά!');
            }
            // Αφού βρέθηκε το αρχείο, το μετονομάζουμε/διαβάζουμε
            const newPath = await renameFileAndRead('erg_m_263', username, fromDate, toDate, directory);
            return newPath;      
        } 
        finally {
            // Κλείσιμο browser
            await browser.close();
        }
    }

    async function renameFileAndRead(prefix, username, fromDate, toDate, directory) {
      const filename = 'Grid.xlsx';
      const newFilename = `${prefix}_${username}__${fromDate.replace(/\//g, '-')}_${toDate.replace(/\//g, '-')}.xlsx`;
      const newDownloadPath = path.join(directory, newFilename);
  
      try {
          // Χρησιμοποιούμε το fs.promises.rename για να μετονομάσουμε το αρχείο
          await fs.promises.rename(path.join(directory, filename), newDownloadPath);
  
          // Τώρα μπορούμε να διαβάσουμε το αρχείο
          return newDownloadPath;
      } catch (err) {
          console.error('Error renaming the file or reading the file:', err);
      }
    }

    // Συνάρτηση για ομαδοποίηση των εργαζομένων ανά ΑΦΜ
    function groupByAFMCards(xlsData) {
      const grouped = {};
      for (const row of xlsData) { 
          const afm = row[1];
          if (!grouped[afm]) {
              grouped[afm] = [];
          }
          grouped[afm].push(row);
      }
      return grouped;
    }

    function findWeeksInMonth(year, month) {
      let monthInt = parseInt(month, 10); 

      let startDate = new Date(Date.UTC(year, monthInt -1, 1)); // Ορισμός της πρώτης ημέρας του μήνα
      let endDate = new Date(Date.UTC(year, monthInt, 0)); // Τελευταία ημέρα του μήνα
      let weeks = []; // Μεταβλητή για την αποθήκευση των εβδομάδων
      let currentDay = new Date(startDate); // Εύρεση της πρώτης ημέρας της πρώτης εβδομάδας
  
      // Επανάληψη μέχρι την τελευταία ημέρα του μήνα
      while (currentDay <= endDate) {
          let weekStart = new Date(currentDay);
  
          let dayOfWeek = weekStart.getDay(); // Εύρεση της Δευτέρας της τρέχουσας εβδομάδας (πρώτη ημέρα της εβδομάδας)
          let daysToMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Αν είναι Κυριακή (0), πάει πίσω 6 ημέρες
          weekStart.setDate(weekStart.getDate() - daysToMonday);
  
          weeks.push(weekStart.toISOString().substring(0, 10)); // Προσθήκη στον πίνακα εβδομάδων
  
          currentDay.setDate(currentDay.getDate() + 7); // Προχωράμε στην επόμενη εβδομάδα
      }
  
      return weeks; // Επιστροφή του πίνακα με τις εβδομάδες
    }

    function processWeeks(weeks, year, month) {
      let monthInt = parseInt(month, 10); // Μετατροπή της συμβολοσειράς month σε ακέραιο αριθμό
  
      // Υπολογισμός της τελευταίας ημέρας του μήνα
      let endDate = new Date(Date.UTC(year, monthInt, 0)); // τελευταία ημέρα του μήνα

      // Πίνακας για τα διαστήματα των εβδομάδων
      let intervals = [];
  
      for (let i = 0; i < weeks.length; i++) {
          let startOfWeek, endOfWeek;
  
          if (i === 0) {
              // Η πρώτη εβδομάδα ξεκινάει από την 1η ημέρα του μήνα
              startOfWeek = new Date(Date.UTC(year, monthInt - 1, 1));
              endOfWeek = new Date(Date.UTC(year, monthInt -1, new Date(weeks[i + 1]).getUTCDate() - 1));
          } else if (i === weeks.length - 1) {
              // Η τελευταία εβδομάδα τελειώνει στην τελευταία ημέρα του μήνα
              startOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate()));
              endOfWeek = endDate; // Τελευταία ημέρα του μήνα
          } else {
              // Ενδιάμεσες εβδομάδες
              startOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate()));
              endOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i + 1]).getUTCDate() - 1));
          }
  
          // Προσθήκη του διαστήματος στον πίνακα
          intervals.push({
              start: startOfWeek.toISOString().substring(0, 10),
              end: endOfWeek.toISOString().substring(0, 10)
          });
      }
  
      return intervals;
    }

    function getDaysFromLastMondayOfPreviousMonth(startYear, startMonth) {
      // Δημιουργία της πρώτης ημέρας του τρέχοντος μήνα
      const firstDayOfCurrentMonth = new Date(Date.UTC(startYear, startMonth - 1, 1));
      // Έλεγχος αν η πρώτη μέρα είναι Δευτέρα
      if (firstDayOfCurrentMonth.getDay() === 1) {
        return []; // Επιστροφή κενής λίστας καθώς δεν θέλουμε να κάνουμε τίποτα
      }

      // Δημιουργία της τελευταίας ημέρας του προηγούμενου μήνα
      const lastDayOfPreviousMonth = new Date(Date.UTC(startYear, startMonth - 1, 0));

      // Βρίσκουμε την τελευταία Δευτέρα του προηγούμενου μήνα
      const lastMondayOfPreviousMonth = new Date(Date.UTC( lastDayOfPreviousMonth.getUTCFullYear(), lastDayOfPreviousMonth.getUTCMonth(), lastDayOfPreviousMonth.getUTCDate() ));

      const dayOfWeek = lastMondayOfPreviousMonth.getDay(); // 1 είναι η Δευτέρα
      
      // Αν δεν είναι Δευτέρα, πηγαίνει πίσω στις μέρες μέχρι να βρει τη Δευτέρα
      const daysToSubtract = (dayOfWeek === 0) ? 6 : (dayOfWeek - 1); // Πίσω από Κυριακή (6) ή από οποιαδήποτε μέρα μέχρι να βρούμε Δευτέρα
      lastMondayOfPreviousMonth.setDate(lastMondayOfPreviousMonth.getDate() - daysToSubtract);
  
      // Πίνακας για τις ημέρες που θέλουμε να αποθηκεύσουμε
      const daysBetween = [];
    
      // Ξεκινάμε από την τελευταία Δευτέρα του προηγούμενου μήνα μέχρι την προηγούμενη της πρώτης μέρας του τρέχοντα μήνα
      let currentDay = lastMondayOfPreviousMonth;
      
      while (currentDay < firstDayOfCurrentMonth) {
        daysBetween.push(new Date(Date.UTC( currentDay.getUTCFullYear(), currentDay.getUTCMonth(), currentDay.getUTCDate() ))); // Προσθήκη της ημερομηνίας στον πίνακα
        currentDay.setDate(currentDay.getDate() + 1); // Μετακινήση στην επόμενη ημέρα
      }
    
      return daysBetween;
    }


    // Συνάρτηση για ενημέρωση του OrariaModel με βάση το Excel
    async function updateOrariaFromCardsModelFromXLS(xlsData, fromDate) {
        // const batchSize = 500; // Μέγεθος της παρτίδας (batch)
        const employeeData = groupByAFMCards(xlsData); // Ομαδοποίηση δεδομένων ανά ΑΦΜ
      
        const _company = await CompaniesModel.find({_id: company}, 'kod eponymia firstname fathername _id').lean();
        const companyCode = _company[0].kod.toString().padStart(4, "0");
        const companyName = _company[0].eponymia.trim() + " " + _company[0].fathername.substring(0,3).trim() + " " + _company[0].firstname.trim();

        const argies = await ArgiesModel.find({team: team, company_kod: companyCode, etos: new Date(fromDate).getFullYear()}, 'hmeromhnia -_id').lean();

        // Μετατροπή των ημερομηνιών στη μορφή "ηη/μμ/εεεε"
        const hmeromhniesArgion = argies.map(argia => {
            const date = new Date(argia.hmeromhnia); // Μετατροπή της ημερομηνίας σε Date object
            // Μετατροπή στη μορφή ηη/μμ/εεεε
            return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        });

        let checkMonth, checkYear;
        let _argia = false;

        for (const afm in employeeData) {
            const operations = []; // Αποθηκεύουμε τις λειτουργίες ενημέρωσης εδώ
            const operations_cards = []; 
            let employees = [];
            const rows = employeeData[afm]; // Δεδομένα για τον τρέχοντα εργαζόμενο

            // Βρίσκουμε τον εργαζόμενο με βάση το ΑΦΜ
            const ergazomenos = await ErgazomenoiModel.findOne({ afm });
            if (!ergazomenos) {
                console.log(`Δεν βρέθηκε εργαζόμενος με ΑΦΜ: ${afm}`);
                continue;
            }
            
            const kodikos = ergazomenos.kodikos;
            const onomateponymo = ergazomenos.eponymo.substring(0, 20).trim() + '\u00A0' +
                                ergazomenos.patronymo.substring(0, 3).trim() + '\u00A0' + 
                                ergazomenos.onoma.substring(0, 14).trim()

            // Βρίσκουμε τις καταγεγραμμένες ημερομηνίες από το Excel
            let recordedDays = rows.map(row => {
                const [day, month, year] = row[4].split('/').map(Number);
                return new Date(Date.UTC(year, month - 1, day)).toISOString().substring(0, 10);
            });

            let uniqueRecordedDays = [...new Set(recordedDays)];

            checkMonth = parseInt(uniqueRecordedDays[0].split('-')[1]) -1;
            checkYear = parseInt(uniqueRecordedDays[0].split('-')[0]);

            // Υπολογισμός της 1ης ημέρας του μήνα βάσει του fromDate
            let currentDate = new Date(Date.UTC(checkYear, checkMonth, 1)); // Πρώτη ημέρα του δοσμένου μήνα
            let lastDayOfMonth = new Date(Date.UTC(checkYear, checkMonth + 1, 0)); // Τελευταία ημέρα του μήνα

            let allDays = [];

            while (currentDate <= lastDayOfMonth) {
                allDays.push(currentDate.toISOString().substring(0, 10));
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }

            // Περνάμε από όλες τις ημέρες του μήνα
            for (const hmeromhniaErgasias of allDays) {
                const existingRow = rows.filter(row => {
                    const [dayStr, monthStr, yearStr] = row[4].split('/');
                    const rowDate = new Date(Date.UTC(yearStr, monthStr - 1, dayStr)).toISOString().substring(0, 10);
                    return rowDate === hmeromhniaErgasias;
                });

                const orariaNoCards = await OrariaModel.find({
                    team: team,
                    company_kod: company,
                    kodikos: kodikos,
                    hmeromhnia: new Date(hmeromhniaErgasias)
                });
          
                if (existingRow.length !== 0) {
                    // Αν η ημέρα υπάρχει στο Excel, προσθέτουμε την εγγραφή της

                    const rowDate = existingRow[0][4]; // Π.χ., "1/8/2024"
                    const [day, month, year] = rowDate.split('/').map(Number); // Εξαγωγή ημέρας, μήνα, έτους
                    const date = new Date(Date.UTC(year, month - 1, day)); // Δημιουργία UTC ημερομηνία
                    checkMonth = month;
                    checkYear = year;
                    const rowDateFormatted = day.toString().padStart(2, "0") + "/" + month.toString().padStart(2, "0") + "/" + year.toString()
                    const nextDate = new Date(date);
                    nextDate.setUTCDate(date.getUTCDate() + 1);
                    const dayOfWeek = date.getDay();
                    const nextDayOfWeek = nextDate.getDay();
                    const nextDateFormatted = nextDate.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
                    // const workData = existingRow[8]; // Εργασία (ένατο κελί)
  
                    _argia = hmeromhniesArgion.includes(rowDateFormatted);
                    const isHoliday = hmeromhniesArgion.includes(rowDateFormatted);
                    const isSunday = dayOfWeek === 0; // 0 = Κυριακή
                    const isNextHoliday = hmeromhniesArgion.includes(nextDateFormatted);
                    const isNextSunday = nextDayOfWeek === 0; // 0 = Κυριακή

                    let orariaDataFromCards = {
                        kathgoria_ergasias: '', 
                        apo_ora_01: null,
                        eos_ora_01: null,
                        apo_ora_02: null,
                        eos_ora_02: null,
                        apo_ora_03: null,
                        eos_ora_03: null,
                        repo: false,
                        adeia: false,
                        astheneia: false,
                        argia: false,
                        perigrafh_argias: "",
                        kathgoria_adeias: "",
                        ores_ergasias: 0,
                        ores_nyxtas: 0,
                        ores_argion: 0,
                        ores_yperergasias: 0,
                        ores_yperergasias_nyxtas: 0,
                        ores_yperergasias_argion: 0,
                        ores_yperergasias_argion_nyxtas: 0,
                        ores_nominhs_yperorias: 0,
                        ores_nominhs_yperorias_nyxtas: 0,
                        ores_nominhs_yperorias_argion: 0,
                        ores_nominhs_yperorias_argion_nyxtas: 0,
                        ores_paranomhs_yperorias: 0,
                        ores_paranomhs_yperorias_nyxtas: 0,
                        ores_paranomhs_yperorias_argion: 0,
                        ores_paranomhs_yperorias_argion_nyxtas: 0
                    };
  
                    let orariaDataFromCards_cards = {
                        kathgoria_ergasias_cards: '', 
                        apo_ora_01_cards: null,
                        eos_ora_01_cards: null,
                        apo_ora_02_cards: null,
                        eos_ora_02_cards: null,
                        apo_ora_03_cards: null,
                        eos_ora_03_cards: null,
                        repo_cards: false,
                        adeia_cards: false,
                        astheneia_cards: false,
                        argia_cards: false,
                        perigrafh_argias_cards: "",
                        kathgoria_adeias_cards: "",
                        ores_ergasias_cards: 0,
                        ores_nyxtas_cards: 0,
                        ores_argion_cards: 0,
                        ores_yperergasias_cards: 0,
                        ores_yperergasias_nyxtas_cards: 0,
                        ores_yperergasias_argion_cards: 0,
                        ores_yperergasias_argion_nyxtas_cards: 0,
                        ores_nominhs_yperorias_cards: 0,
                        ores_nominhs_yperorias_nyxtas_cards: 0,
                        ores_nominhs_yperorias_argion_cards: 0,
                        ores_nominhs_yperorias_argion_nyxtas_cards: 0,
                        ores_paranomhs_yperorias_cards: 0,
                        ores_paranomhs_yperorias_nyxtas_cards: 0,
                        ores_paranomhs_yperorias_argion_cards: 0,
                        ores_paranomhs_yperorias_argion_nyxtas_cards: 0
                    };
  
                    orariaDataFromCards.kathgoria_ergasias = 'ΕΡΓ';
                    orariaDataFromCards.repo = false;

                    orariaDataFromCards_cards.kathgoria_ergasias_cards = 'ΕΡΓ';
                    orariaDataFromCards_cards.repo_cards = false;

                    let timePeriods = [];

                    // Ελέγχουμε πόσες εγγραφές υπάρχουν για τη συγκεκριμένη ημερομηνία
                    if (existingRow.length === 1) {
                        // Αν υπάρχει 1 εγγραφή
                        timePeriods[0] = typeof existingRow[0][5] === 'undefined' ? orariaNoCards[0]._doc.apo_ora_01 : existingRow[0][5]; // Ώρα προσέλευσης
                        timePeriods[1] = existingRow[0][6]; // Ώρα αποχώρησης
                    } else if (existingRow.length === 2) {
                        // Αν υπάρχουν 2 εγγραφές
                        timePeriods[0] = typeof existingRow[0][5] === 'undefined' ? orariaNoCards[0]._doc.apo_ora_01 : existingRow[0][5]; // Ώρα προσέλευσης  1ης εγγραφής
                        timePeriods[2] = typeof existingRow[1][5] === 'undefined' ? orariaNoCards[1]._doc.apo_ora_02 : existingRow[1][5]; // Ώρα προσέλευσης  2ης εγγραφής
                        timePeriods[1] = existingRow[0][6]; // Ώρα αποχώρησης 1ης εγγραφής
                        timePeriods[3] = existingRow[1][6]; // Ώρα αποχώρησης 2ης εγγραφής
                    } else if (existingRow.length === 3) {
                      // Αν υπάρχουν 3 εγγραφές
                        timePeriods[0] = typeof existingRow[0][5] === 'undefined' ? orariaNoCards[0]._doc.apo_ora_01 : existingRow[0][5]; // Ώρα προσέλευσης  1ης εγγραφής
                        timePeriods[2] = typeof existingRow[1][5] === 'undefined' ? orariaNoCards[1]._doc.apo_ora_02 : existingRow[1][5]; // Ώρα προσέλευσης  2ης εγγραφής
                        timePeriods[3] = typeof existingRow[2][5] === 'undefined' ? orariaNoCards[2]._doc.apo_ora_03 : existingRow[2][5]; // Ώρα προσέλευσης  3ης εγγραφής
                        timePeriods[1] = existingRow[0][6]; // Ώρα αποχώρησης 1ης εγγραφής
                        timePeriods[3] = existingRow[1][6]; // Ώρα αποχώρησης 2ης εγγραφής
                        timePeriods[5] = existingRow[2][6]; // Ώρα αποχώρησης 3ης εγγραφής
                    }

                    calculateTimePeriodsInPairs(timePeriods, orariaNoCards);

                    // Εισαγωγή των ωρών ανάλογα με τον αριθμό των περιόδων
                    if (timePeriods.length === 2) {
                        orariaDataFromCards.apo_ora_01 = timePeriods[0];
                        orariaDataFromCards.eos_ora_01 = timePeriods[1];

                        orariaDataFromCards_cards.apo_ora_01_cards = timePeriods[0];
                        orariaDataFromCards_cards.eos_ora_01_cards = timePeriods[1];
                    } else if (timePeriods.length === 4) {
                        orariaDataFromCards.apo_ora_01 = timePeriods[0];
                        orariaDataFromCards.eos_ora_01 = timePeriods[1];
                        orariaDataFromCards.apo_ora_02 = timePeriods[2];
                        orariaDataFromCards.eos_ora_02 = timePeriods[3];

                        orariaDataFromCards_cards.apo_ora_01_cards = timePeriods[0];
                        orariaDataFromCards_cards.eos_ora_01_cards = timePeriods[1];
                        orariaDataFromCards_cards.apo_ora_02_cards = timePeriods[2];
                        orariaDataFromCards_cards.eos_ora_02_cards = timePeriods[3];
                    } else if (timePeriods.length === 6) {
                        orariaDataFromCards.apo_ora_01 = timePeriods[0];
                        orariaDataFromCards.eos_ora_01 = timePeriods[1];
                        orariaDataFromCards.apo_ora_02 = timePeriods[2];
                        orariaDataFromCards.eos_ora_02 = timePeriods[3];
                        orariaDataFromCards.apo_ora_03 = timePeriods[4];
                        orariaDataFromCards.eos_ora_03 = timePeriods[5];

                        orariaDataFromCards_cards.apo_ora_01_cards = timePeriods[0];
                        orariaDataFromCards_cards.eos_ora_01_cards = timePeriods[1];
                        orariaDataFromCards_cards.apo_ora_02_cards = timePeriods[2];
                        orariaDataFromCards_cards.eos_ora_02_cards = timePeriods[3];
                        orariaDataFromCards_cards.apo_ora_03_cards = timePeriods[4];
                        orariaDataFromCards_cards.eos_ora_03_cards = timePeriods[5];
                    }

                    let intervals = [];
  
                    for (let j = 1; j <= 3; j++) {
                        const startTimeInput = orariaDataFromCards[`apo_ora_0${j}`];
                        const endTimeInput = orariaDataFromCards[`eos_ora_0${j}`];
                        if (!startTimeInput || !endTimeInput) {
                            continue;
                        }
  
                        let startTime = convertTimeToMinutes(startTimeInput);
                        let endTime = convertTimeToMinutes(endTimeInput);
                        if (endTime < startTime) endTime += 1440;
        
                        intervals.push({ start: startTime, end: endTime, shift: j });
                    }
        
                    // Υπολογισμός ωρών εργασίας, υπερεργασίας κλπ
                    const workHours = calculateWorkHoursForIntervals(intervals, isHoliday || isSunday, isNextHoliday || isNextSunday);
  
                   
                    orariaDataFromCards.argia = isHoliday;
                    orariaDataFromCards.ores_ergasias = workHours.working;
                    orariaDataFromCards.ores_nyxtas = workHours.night;
                    orariaDataFromCards.ores_argion = workHours.holiday;
                    orariaDataFromCards.ores_yperergasias = workHours.overwork;
                    orariaDataFromCards.ores_yperergasias_nyxtas = workHours.nightOverwork;
                    orariaDataFromCards.ores_yperergasias_argion = workHours.holidayOverwork;
                    orariaDataFromCards.ores_yperergasias_argion_nyxtas = workHours.nightHolidayOverwork;
                    orariaDataFromCards.ores_nominhs_yperorias = workHours.overtime;
                    orariaDataFromCards.ores_nominhs_yperorias_nyxtas = workHours.nightOvertime;
                    orariaDataFromCards.ores_nominhs_yperorias_argion = workHours.holidayOvertime;
                    orariaDataFromCards.ores_nominhs_yperorias_argion_nyxtas = workHours.nightHolidayOvertime;
                    orariaDataFromCards.ores_paranomhs_yperorias = workHours.overtimeIllegal;
                    orariaDataFromCards.ores_paranomhs_yperorias_nyxtas = workHours.nightOvertimeIllegal;
                    orariaDataFromCards.ores_paranomhs_yperorias_argion = workHours.holidayOvertimeIllegal;
                    orariaDataFromCards.ores_paranomhs_yperorias_argion_nyxtas = workHours.nightHolidayOvertimeIllegal;
  
                    orariaDataFromCards_cards.argia_cards = isHoliday;
                    orariaDataFromCards_cards.ores_ergasias_cards = workHours.working;
                    orariaDataFromCards_cards.ores_nyxtas_cards = workHours.night;
                    orariaDataFromCards_cards.ores_argion_cards = workHours.holiday;
                    orariaDataFromCards_cards.ores_yperergasias_cards = workHours.overwork;
                    orariaDataFromCards_cards.ores_yperergasias_nyxtas_cards = workHours.nightOverwork;
                    orariaDataFromCards_cards.ores_yperergasias_argion_cards = workHours.holidayOverwork;
                    orariaDataFromCards_cards.ores_yperergasias_argion_nyxtas_cards = workHours.nightHolidayOverwork;
                    orariaDataFromCards_cards.ores_nominhs_yperorias_cards = workHours.overtime;
                    orariaDataFromCards_cards.ores_nominhs_yperorias_nyxtas_cards = workHours.nightOvertime;
                    orariaDataFromCards_cards.ores_nominhs_yperorias_argion_cards = workHours.holidayOvertime;
                    orariaDataFromCards_cards.ores_nominhs_yperorias_argion_nyxtas_cards = workHours.nightHolidayOvertime;
                    orariaDataFromCards_cards.ores_paranomhs_yperorias_cards = workHours.overtimeIllegal;
                    orariaDataFromCards_cards.ores_paranomhs_yperorias_nyxtas_cards = workHours.nightOvertimeIllegal;
                    orariaDataFromCards_cards.ores_paranomhs_yperorias_argion_cards = workHours.holidayOvertimeIllegal;
                    orariaDataFromCards_cards.ores_paranomhs_yperorias_argion_nyxtas_cards = workHours.nightHolidayOvertimeIllegal;
  
                    // Προσθήκη της λειτουργίας ενημέρωσης στη λίστα operations
                    operations.push({
                        updateOne: {
                            filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                            update: {
                                $set: orariaDataFromCards,
                                $setOnInsert: {
                                    team: team,
                                    company_kod: company,
                                    kodikos: kodikos,
                                    hmeromhnia: new Date(hmeromhniaErgasias)
                                }
                            },
                            upsert: true
                        }
                    });
  
                    operations_cards.push({
                        updateOne: {
                            filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                            update: {
                                $set: orariaDataFromCards_cards,
                                $setOnInsert: {
                                    team: team,
                                    company_kod: company,
                                    kodikos: kodikos,
                                    hmeromhnia: new Date(hmeromhniaErgasias)
                                }
                            },
                            upsert: true
                        }
                    });
  
                } else {
                    // Αν η ημέρα δεν υπάρχει στο Excel, προσθέτουμε την εγγραφή με την αντίστοιχη ημερομηνία απ' το ψηφιακό ωράριο
                    let orariaDataFromCards = {
                        kathgoria_ergasias: (orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' || orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ' || orariaNoCards[0]._doc.argia === true) ? orariaNoCards[0]._doc.kathgoria_ergasias : '',
                        apo_ora_01: orariaNoCards[0]._doc.apo_ora_01,
                        eos_ora_01: orariaNoCards[0]._doc.eos_ora_01,
                        apo_ora_02: orariaNoCards[0]._doc.apo_ora_02,
                        eos_ora_02: orariaNoCards[0]._doc.eos_ora_02,
                        apo_ora_03: orariaNoCards[0]._doc.apo_ora_03,
                        eos_ora_03: orariaNoCards[0]._doc.eos_ora_03,
                        repo: orariaNoCards[0]._doc.repo,
                        adeia: (orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' || orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ') ? orariaNoCards[0]._doc.adeia: true,
                        astheneia: orariaNoCards[0]._doc.astheneia,
                        argia: orariaNoCards[0]._doc.argia,
                        perigrafh_argias: orariaNoCards[0]._doc.perigrafh_argias,
                        kathgoria_adeias: (orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' || orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ') ? orariaNoCards[0]._doc.kathgoria_adeias : "Ορφανό χτύπημα",
                        ores_ergasias: orariaNoCards[0]._doc.ores_ergasias,
                        ores_nyxtas: orariaNoCards[0]._doc.ores_nyxtas,
                        ores_argion: orariaNoCards[0]._doc.ores_argion,
                        ores_yperergasias: orariaNoCards[0]._doc.ores_yperergasias,
                        ores_yperergasias_nyxtas: orariaNoCards[0]._doc.ores_yperergasias_nyxtas,
                        ores_yperergasias_argion: orariaNoCards[0]._doc.ores_yperergasias_argion,
                        ores_yperergasias_argion_nyxtas: orariaNoCards[0]._doc.ores_yperergasias_argion_nyxtas,
                        ores_nominhs_yperorias: orariaNoCards[0]._doc.ores_nominhs_yperorias,
                        ores_nominhs_yperorias_nyxtas: orariaNoCards[0]._doc.ores_nominhs_yperorias_nyxtas,
                        ores_nominhs_yperorias_argion: orariaNoCards[0]._doc.ores_nominhs_yperorias_argion,
                        ores_nominhs_yperorias_argion_nyxtas: orariaNoCards[0]._doc.ores_nominhs_yperorias_argion_nyxtas,
                        ores_paranomhs_yperorias: orariaNoCards[0]._doc.ores_paranomhs_yperorias,
                        ores_paranomhs_yperorias_nyxtas: orariaNoCards[0]._doc.ores_paranomhs_yperorias_nyxtas,
                        ores_paranomhs_yperorias_argion: orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion,
                        ores_paranomhs_yperorias_argion_nyxtas: orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion_nyxtas
                    };

                    let orariaDataFromCards_cards = {
                        kathgoria_ergasias_cards: (orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' || orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ' || orariaNoCards[0]._doc.argia === true) ? orariaNoCards[0]._doc.kathgoria_ergasias : '',
                        apo_ora_01_cards: orariaNoCards[0]._doc.apo_ora_01,
                        eos_ora_01_cards: orariaNoCards[0]._doc.eos_ora_01,
                        apo_ora_02_cards: orariaNoCards[0]._doc.apo_ora_02,
                        eos_ora_02_cards: orariaNoCards[0]._doc.eos_ora_02,
                        apo_ora_03_cards: orariaNoCards[0]._doc.apo_ora_03,
                        eos_ora_03_cards: orariaNoCards[0]._doc.eos_ora_03,
                        repo_cards: orariaNoCards[0]._doc.repo,
                        adeia_cards: (orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' || orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ') ? orariaNoCards[0]._doc.adeia : true,
                        astheneia_cards: orariaNoCards[0]._doc.astheneia,
                        argia_cards: orariaNoCards[0]._doc.argia,
                        perigrafh_argias_cards: orariaNoCards[0]._doc.perigrafh_argias,
                        kathgoria_adeias_cards: (orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' || orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ') ? orariaNoCards[0]._doc.kathgoria_adeias : "Ορφανό χτύπημα",
                        ores_ergasias_cards: orariaNoCards[0]._doc.ores_ergasias,
                        ores_nyxtas_cards: orariaNoCards[0]._doc.ores_nyxtas,
                        ores_argion_cards: orariaNoCards[0]._doc.ores_argion,
                        ores_yperergasias_cards: orariaNoCards[0]._doc.ores_yperergasias,
                        ores_yperergasias_nyxtas_cards: orariaNoCards[0]._doc.ores_yperergasias_nyxtas,
                        ores_yperergasias_argion_cards: orariaNoCards[0]._doc.ores_yperergasias_argion,
                        ores_yperergasias_argion_nyxtas_cards: orariaNoCards[0]._doc.ores_yperergasias_argion_nyxtas,
                        ores_nominhs_yperorias_cards: orariaNoCards[0]._doc.ores_nominhs_yperorias,
                        ores_nominhs_yperorias_nyxtas_cards: orariaNoCards[0]._doc.ores_nominhs_yperorias_nyxtas,
                        ores_nominhs_yperorias_argion_cards: orariaNoCards[0]._doc.ores_nominhs_yperorias_argion,
                        ores_nominhs_yperorias_argion_nyxtas_cards: orariaNoCards[0]._doc.ores_nominhs_yperorias_argion_nyxtas,
                        ores_paranomhs_yperorias_cards: orariaNoCards[0]._doc.ores_paranomhs_yperorias,
                        ores_paranomhs_yperorias_nyxtas_cards: orariaNoCards[0]._doc.ores_paranomhs_yperorias_nyxtas,
                        ores_paranomhs_yperorias_argion_cards: orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion,
                        ores_paranomhs_yperorias_argion_nyxtas_cards: orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion_nyxtas
                    };

                    if (orariaNoCards[0]._doc.kathgoria_ergasias !== 'ΜΕ' && orariaNoCards[0]._doc.kathgoria_ergasias !== 'ΑΝ') {
                        let existingEmployee = employees.find(employee => employee.onomateponymo === onomateponymo);

                        let hmeromhniaArgias = orariaNoCards[0]._doc.argia === true 
                            ? new Date(hmeromhniaErgasias).toLocaleDateString() + " Αργία" 
                            : new Date(hmeromhniaErgasias).toLocaleDateString();
          
                        if (existingEmployee) {
                            // Αν υπάρχει, προσθέστε την ημερομηνία στις ήδη υπάρχουσες
                            existingEmployee.hmeromhnies.push(hmeromhniaArgias);
                        } else {
                            // Αν δεν υπάρχει, προσθέστε τον εργαζόμενο στον πίνακα
                            employees.push({
                                onomateponymo: onomateponymo,
                                hmeromhnies: [hmeromhniaArgias]
                            });
                        }
                    }

                    operations.push({
                        updateOne: {
                            filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                            update: {
                                $set: orariaDataFromCards,
                                $setOnInsert: {
                                    team: team,
                                    company_kod: company,
                                    kodikos: kodikos,
                                    hmeromhnia: new Date(hmeromhniaErgasias)
                                }
                            },
                            upsert: true
                        }
                    });
            
                    operations_cards.push({
                        updateOne: {
                            filter: { team: team, company_kod: company, kodikos, hmeromhnia: new Date(hmeromhniaErgasias) },
                            update: {
                                $set: orariaDataFromCards_cards,
                                $setOnInsert: {
                                    team: team,
                                    company_kod: company,
                                    kodikos: kodikos,
                                    hmeromhnia: new Date(hmeromhniaErgasias)
                                }
                            },
                            upsert: true
                        }
                    });

                }
            };

            let weeksInMonth = findWeeksInMonth(checkYear, checkMonth);
            let intervals = processWeeks(weeksInMonth, checkYear, checkMonth);

            const daysOfPreviousMonth = getDaysFromLastMondayOfPreviousMonth(checkYear, checkMonth);
            const firstDate = daysOfPreviousMonth[0]; 
            const lastDate = daysOfPreviousMonth[daysOfPreviousMonth.length - 1]; 

            const orariaProhgMhna = await OrariaModel.find({
                team: team,
                company_kod: company,
                kodikos: kodikos,
                hmeromhnia: { $gte: new Date(firstDate), $lte: new Date(lastDate) }
            }).sort({ hmeromhnia: 1 });
    
            // Υπολογισμός του συνόλου των πεδίων
            const data = orariaProhgMhna.reduce((accumulator, schedule) => {
                return {
                    ores_ergasias: accumulator.ores_ergasias + (schedule.ores_ergasias || 0),
                    ores_yperergasias: accumulator.ores_yperergasias + (schedule.ores_yperergasias || 0),
                    ores_yperergasias_nyxtas: accumulator.ores_yperergasias_nyxtas + (schedule.ores_yperergasias_nyxtas || 0),
                    ores_yperergasias_argion: accumulator.ores_yperergasias_argion + (schedule.ores_yperergasias_argion || 0),
                    ores_yperergasias_argion_nyxtas: accumulator.ores_yperergasias_argion_nyxtas + (schedule.ores_yperergasias_argion_nyxtas || 0)
                };
            },  {
                    ores_ergasias: 0,
                    ores_yperergasias: 0,
                    ores_yperergasias_nyxtas: 0,
                    ores_yperergasias_argion: 0,
                    ores_yperergasias_argion_nyxtas: 0
                }
            );

            const total = Object.values(data).reduce((sum, value) => sum + value, 0);
            let weeklyTotal = 0;

            for (let i = 0; i < intervals.length; i++) {
                let fromDay = parseInt(intervals[i].start.substring(8, 10)) -1;
                let toDay = parseInt(intervals[i].end.substring(8, 10)) - 1;
                if (i === 0) {
                    weeklyTotal = total;
                } else {
                    weeklyTotal = 0;
                }

                // Πρώτα υπολογίζουμε το συνολικό weeklyTotal για όλες τις ημέρες της εβδομάδας
                for (let j = fromDay; j <= toDay; j++) {
                    // Έλεγχος αν το incValues έχει τιμές (δηλαδή δεν είναι undefined ή null)
                    const incValues = operations[j]?.updateOne?.update?.$set;
            
                    if (incValues && Object.keys(incValues).length > 0) {
                    // Ορισμός των πεδίων που θέλουμε να αθροίσουμε
                        const fieldsToSum = ['ores_ergasias', 'ores_yperergasias', 'ores_yperergasias_nyxtas', 'ores_yperergasias_argion', 'ores_yperergasias_argion_nyxtas'];
              
                        // Χρήση Object.entries() για να αθροίσουμε μόνο τα επιθυμητά πεδία
                        weeklyTotal += Object.entries(incValues)
                            .filter(([key]) => fieldsToSum.includes(key))  // Επιλογή μόνο των επιθυμητών πεδίων
                            .reduce((sum, [, value]) => sum + value, 0);   // Άθροισμα των τιμών
                    }
                }

                // Τώρα, αφού έχει υπολογιστεί το weeklyTotal για όλη την εβδομάδα, κάνουμε τον έλεγχο
                if (weeklyTotal <= 40) {
                    // Εδώ γίνονται οι ενημερώσεις για όλες τις ημέρες
                    for (let j = fromDay; j <= toDay; j++) {
                        let ores_ergasias = (operations[j].updateOne.update.$set.ores_ergasias || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
              
                        let ores_nyxtas =   (operations[j].updateOne.update.$set.ores_nyxtas || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
              
                        let ores_argion =   (operations[j].updateOne.update.$set.ores_argion || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                            (operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);

                        operations[j].updateOne.update.$set.ores_ergasias = ores_ergasias;
                        operations[j].updateOne.update.$set.ores_nyxtas = ores_nyxtas;
                        operations[j].updateOne.update.$set.ores_argion = ores_argion
                        operations[j].updateOne.update.$set.ores_yperergasias = 0;
                        operations[j].updateOne.update.$set.ores_yperergasias_nyxtas = 0;
                        operations[j].updateOne.update.$set.ores_yperergasias_argion = 0;
                        operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas = 0;

                        let ores_ergasias_cards =   (operations_cards[j].updateOne.update.$set.ores_ergasias || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
              
                        let ores_nyxtas_cards =     (operations_cards[j].updateOne.update.$set.ores_nyxtas || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias_nyxtas || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);
              
                        let ores_argion_cards =     (operations_cards[j].updateOne.update.$set.ores_argion || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias_argion || 0) +
                                                    (operations_cards[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas || 0);


                        operations_cards[j].updateOne.update.$set.ores_ergasias = ores_ergasias;
                        operations_cards[j].updateOne.update.$set.ores_nyxtas = ores_nyxtas;
                        operations_cards[j].updateOne.update.$set.ores_argion = ores_argion
                        operations_cards[j].updateOne.update.$set.ores_yperergasias = 0;
                        operations_cards[j].updateOne.update.$set.ores_yperergasias_nyxtas = 0;
                        operations_cards[j].updateOne.update.$set.ores_yperergasias_argion = 0;
                        operations_cards[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas = 0;
                    }
                }
            }

            await generatePDF(_company, companyName, employees, hmeromhniesArgion);

            // Εκτέλεση τυχόν υπόλοιπων operations
            if (operations.length > 0) {
                await OrariaFromCardsModel.bulkWrite(operations);
            }

            if (operations_cards.length > 0) {
                await OrariaApologistikaModel.bulkWrite(operations_cards);
            }
        }  
    }   
  }

  static deletePdfFile = async (req, res) => {
    const pdfUrl = req.body.pdfUrl;
    const pdfFilePath = path.join(__dirname, '..', '..', '..', 'public', pdfUrl);
    try {
      await fsPromises.unlink(pdfFilePath);
      console.log('Το PDF αρχείο διαγράφηκε επιτυχώς.');
      res.json({ success: true, message: 'Το PDF διαγράφηκε επιτυχώς' });
    } catch (err) {
      console.error('Σφάλμα κατά τη διαγραφή του PDF αρχείου:', err);
      res.status(500).json({ success: false, message: 'Αδυναμία διαγραφής του PDF' });
    }
  }

  static getPeriods = async (req, res) => {
    const xrhsh = req.session.yearInUse;
  
    try {
 
      const periodsData = await PeriodsModel.find({ xrhsh: xrhsh }).sort({ kodikos: 1 });
      
      res.json({ periodsData });
    } catch (error) {
      console.log("Error into erganhController -> getPeriods :", error);
    }
  };

  static mainExagoghOrarionSeErganhForm = async (req, res) => {
    const locals = {
      title: "Ενημέρωση Ψηφιακών Ωραρίων ΕΓΑΝΗ",
      description: "Web Payroll System",
    };

    const companyId = req.session.companyInUse;
    const sessionUserId = req.session.userId;
    const sessionTeam = req.session.userTeam;
  
    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "ExagoghOrarionSeErganh",
      }).exec();
  
      const ergazomenoi = await ErgazomenoiModel.find({ team: sessionTeam, company_kod: companyId, energos: true });

      const passwordsData = await PasswordsModel.find({ companykod_object: companyId, kodikos: "0001" });
      const cleanedPasswordsData = passwordsData.map((data) => data._doc);

      res.render("ergazomenoi/programmata/exagoghOrarionSeErganh", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        sessionTeam: sessionTeam,
        companyId: companyId,
        passwords: cleanedPasswordsData,
        ergazomenoi: ergazomenoi,
      });   
    } catch (error) {
      console.log("Error into erganhController -> mainEisagoghOrarionApoErganhForm :", error);
    }
  };

}

module.exports = erganhController;
