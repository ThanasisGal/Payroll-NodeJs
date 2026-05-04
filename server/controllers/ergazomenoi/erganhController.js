const mongoose = require('mongoose');

const { Builder, By, Key, until } = require('selenium-webdriver');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const PDFDocument = require('pdfkit');
const { chromium } = require('playwright');

const Models_A = require('../../models/stathera_arxeia');
const Models_B = require('../../models/privileges');
const Models_C = require('../../models/companies');
const Models_D = require('../../models/ergazomenoi');

const { ArgiesModel, PeriodsModel } = Models_A;

const { UserPrivilegesModel } = Models_B;

const { CompaniesModel, PasswordsModel, YpokatasthmataModel } = Models_C;

const {
    ErgazomenoiModel,
    OrariaFromErganhModel,
    OrariaFromCardsModel,
    OrariaApologistikaModel,
    ProdhlomenaOrariaModel
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

// ============================================================
// Διαφορά σε ώρες (decimal) μεταξύ "HH:MM" - "HH:MM"
// Αν eos < apo → θεωρεί ότι περνάει μεσάνυχτα (+24h)
// ============================================================
function diffHours(apo, eos) {
    if (!apo || !eos) return 0;
    const [ah, am] = apo.split(':').map(Number);
    const [eh, em] = eos.split(':').map(Number);
    if (isNaN(ah) || isNaN(am) || isNaN(eh) || isNaN(em)) return 0;

    let apoMin = ah * 60 + am;
    let eosMin = eh * 60 + em;
    if (eosMin < apoMin) eosMin += 24 * 60; // crosses midnight
    return (eosMin - apoMin) / 60;
}

// Συνάρτηση για ανάγνωση του Excel αρχείου
async function readXLSFile(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    const data = [];

    worksheet.eachRow((row) => {
        const values = row.values.slice(1); // row.values[0] είναι άδειο
        data.push(values);
    });

    return data; // επιστρέφει πίνακα 2D
}

// ============================================================
// Βοηθητική συνάρτηση: ασφαλής μετατροπή σε Date
// ============================================================
function safeToDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

// ============================================================
// Βοηθητική συνάρτηση: ασφαλής .toISOString()
// ============================================================
function safeToISOString(value) {
    const d = safeToDate(value);
    if (!d) return null;
    return d.toISOString();
}

async function adjustOvernightEntries(data, interval) {
    // Αφαίρεση της πρώτης γραμμής (επικεφαλίδας)
    data.splice(0, 1); // Εναλλακτικά μπορούμε να χρησιμοποιήσουμε την data.shift();

    // Ξεκινάμε από τη δεύτερη γραμμή (αφού η πρώτη έχει αφαιρεθεί)
    for (let index = 0; index < data.length; index++) {
        let row = data[index];
        let afm = row[1];
        let startDate = row[4];
        let [day, month, year] = startDate.split('/'); // Εξαγωγή ημέρας, μήνα, έτους
        let startTime = row[5];
        let endTime = row[6];

        if (startTime && !endTime) {
            let nextRow = data[index + 1];
            if (nextRow && formatDate(nextRow[4]) === nextDay(startDate) && !nextRow[5]) {
                row[6] = nextRow[6]; // Παίρνει το EndTime της επόμενης γραμμής (nextRow)
                data.splice(index + 1, 1); // Διαγραφή της επόμενης εγγραφής
            }
        }
        if (!startTime && endTime) {
            let nextRow = data[index + 1];
            if (nextRow && formatDate(nextRow[4]) === nextDay(startDate) && !nextRow[6]) {
                row[5] = nextRow[5]; // Παίρνει το StartTime της επόμενης γραμμής (nextRow)
                data.splice(index + 1, 1); // Διαγραφή της επόμενης εγγραφής
            }
        }
        let roundedArrival = roundTime(row[5], interval);
        let roundedDeparture = roundTime(row[6], interval);
        row[5] = roundedArrival;
        row[6] = roundedDeparture;
    }
    return data; // Επιστροφή του τροποποιημένου πίνακα
}

// Συνάρτηση που επιστρέφει την επόμενη ημέρα στη μορφή dd/mm/yyyy
function nextDay(dateStr) {
    let [day, month, year] = dateStr.split('/');
    let date = new Date(`${year}-${month}-${day}`);
    date.setDate(date.getDate() + 1);

    let nextDay = String(date.getDate()).padStart(2, '0');
    let nextMonth = String(date.getMonth() + 1).padStart(2, '0'); // Οι μήνες ξεκινούν από το 0
    let nextYear = date.getFullYear();

    return `${nextDay}/${nextMonth}/${nextYear}`; // Επιστροφή της επόμενης ημέρας στη μορφή dd/mm/yyyy
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
        const roundedTotalMinutes =
            Math.round(totalMinutes / parseInt(interval)) * parseInt(interval);
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

    intervals.forEach((interval) => {
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
            let isEffectiveHoliday =
                (isHoliday && !hasCrossedMidnight) || (isNextHoliday && hasCrossedMidnight);

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
        margins: {
            top: mmToPoints(10),
            left: mmToPoints(10),
            right: mmToPoints(10),
            bottom: mmToPoints(10)
        }
    });

    const currentTimeInMs = Date.now();
    const fileName = `263${_company[0]._id}${currentTimeInMs}.pdf`;
    const outputPath = path.join(__dirname, '..', '..', '..', 'public', 'pdf', fileName);
    const readPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'public',
        'txt',
        '263-Parathrhseis Elegxoy.txt'
    );

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

        doc.fontSize(8)
            .font('./fonts/JetBrainsMono/JetBrainsMono-Bold.ttf')
            .fillColor('blue')
            .text(companyName, x, y, { align: 'left', width: 500 })
            .fillColor('black');

        const now = new Date();
        const dateStr = now.toLocaleDateString('el-GR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

        const printedText = `Εκτυπώθηκε την ${dateStr} ${timeStr}`;

        doc.fontSize(7)
            .font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
            .fillColor('gray')
            .text(printedText, x, y, { align: 'right', width: pageWidth - x })
            .fillColor('black');

        const lineY = y + mmToPoints(5);
        doc.moveTo(x, lineY)
            .strokeColor('grey')
            .lineTo(mmToPoints(200), lineY)
            .lineWidth(0.5)
            .stroke()
            .strokeColor('black')
            .fillColor('black');
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
            .strokeColor('grey')
            .lineTo(pageWidth, lineY)
            .lineWidth(0.5)
            .stroke();

        const currentYear = new Date().getFullYear();
        const footerText = `© 2009-${currentYear} WebPayrollSolutions.com * Τηλ. 2421056825 * Κιν. 6972012650 * eMail support@WebPayrollSolutions.com`;

        doc.fontSize(7)
            .fillColor('gray')
            .text(footerText, leftMargin, y, { align: 'left' })
            .fontSize(8)
            .text(`Σελ. ${pageNumber}`, pageWidth - rightMargin - mmToPoints(17.64), y, {
                align: 'right'
            });

        doc.fillColor('black');
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
    doc.fontSize(12)
        .font('./fonts/JetBrainsMono/JetBrainsMono-Bold.ttf')
        .text(
            'ΑΠΟΤΕΛΕΣΜΑΤΑ ΕΛΕΓΧΟΥ ΜΕΤΑ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ ΤΩΝ ΨΗΦΙΑΚΩΝ ΩΡΑΡΙΩΝ ΚΑΙ ΤΩΝ ΚΑΡΤΩΝ ΕΡΓΑΣΙΑΣ',
            { align: 'center' }
        );

    doc.moveDown(mmToPoints(0.4));

    const txtContent = await fs.promises.readFile(readPath, 'utf8');
    doc.fontSize(9)
        .font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
        .text(txtContent, {
            align: 'justify',
            indent: mmToPoints(10),
            height: mmToPoints(25),
            ellipsis: true
        });

    doc.moveDown((0.5 * 72) / 25.4);

    for (const employee of employees) {
        const startY = doc.y;
        const textX = mmToPoints(10);

        doc.fontSize(11)
            .font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
            .text(employee.onomateponymo, textX, startY, {
                width: nameWidthInPoints,
                align: 'left'
            });

        const formatDate = (dateStr) => {
            const [d, m, y] = dateStr.split(/[\/\-]/).map((x) => x.padStart(2, '0'));
            return `${d}/${m}/${y}`;
        };

        const combinedText = Array.isArray(employee.hmeromhnies)
            ? employee.hmeromhnies
                  .map((h) => {
                      const normalized = formatDate(h.trim());
                      return hmeromhniesArgion.includes(normalized) ? `${h} Αργία` : h;
                  })
                  .join(', ')
            : '';

        const textStartY = doc.y;
        const textHeight = doc.heightOfString(combinedText, {
            width: fullWidth,
            align: 'left'
        });

        checkPageChange(doc, textHeight);

        doc.fontSize(8)
            .font('./fonts/JetBrainsMono/JetBrainsMono-Regular.ttf')
            .text(combinedText, textX, textStartY, {
                width: fullWidth,
                align: 'left'
            });

        doc.moveDown((3 / 25.4) * 72);
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
        const url = `/pdf/${fileName}`; // ✔ προσωρινή μεταβλητή
        writeStream.on('finish', () => {
            _pdfUrlPath = url; // ✔ ορίζεται ΜΟΛΙΣ τελειώσει το γράψιμο
            resolve(url);
        });
        writeStream.on('error', reject);
    });
}

// =======================================================================================================

class erganhController {
    // static mainEisagoghOrarionApoKartesForm = async (req, res) => {
    //     const locals = {
    //         title: 'Εισαγωγή Ωραρίων από Κάρτες',
    //         description: 'Web Payroll Solutions'
    //     };

    //     const companyId = req.session.companyInUse;
    //     const sessionUserId = req.session.userId;
    //     const sessionTeam = req.session.userTeam;

    //     try {
    //         // Έλεγχος CRUD των δικαιωμάτων του χρήστη
    //         const userPrivileges = await UserPrivilegesModel.findOne({
    //             userId: sessionUserId,
    //             form: 'EisagoghOrarionApoKartes'
    //         }).exec();

    //         const passwordsData = await PasswordsModel.find({
    //             companykod_object: companyId,
    //             kodikos: '0001'
    //         });

    //         const cleanedPasswordsData = passwordsData.map((data) => data._doc);

    //         res.render('ergazomenoi/programmata/eisagoghOrarionApoKartes', {
    //             userPrivileges: userPrivileges ? userPrivileges.privileges : {},
    //             locals,
    //             sessionTeam: sessionTeam,
    //             companyId: companyId,
    //             passwords: cleanedPasswordsData
    //         });
    //     } catch (error) {
    //         console.log('Error into erganhController -> mainEisagoghOrarionApoKartesForm :', error);
    //     }
    // };

    static mainApologistikosPinakasForm = async (req, res) => {
        const locals = {
            title: 'Απολογιστικός Πίνακας',
            description: 'Web Payroll Solutions'
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'ApologistikosPinakasOrarion'
            }).exec();

            const passwordsData = await PasswordsModel.find({
                companykod_object: companyId,
                kodikos: '0001'
            });

            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            res.render('ergazomenoi/programmata/apologistikosPinakasOrarion', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData
            });
        } catch (error) {
            console.log(
                'Error into programmataController -> mainApologistikosPinakasForm :',
                error
            );
        }
    };

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
    };

    static getPeriods = async (req, res) => {
        const xrhsh = req.session.yearInUse;

        try {
            const periodsData = await PeriodsModel.find({ xrhsh: xrhsh }).sort({ kodikos: 1 });

            res.json({ periodsData });
        } catch (error) {
            console.log('Error into erganhController -> getPeriods :', error);
        }
    };

    static mainExagoghOrarionSeErganhForm = async (req, res) => {
        const locals = {
            title: 'Ενημέρωση Ψηφιακών Ωραρίων ΕΓΑΝΗ',
            description: 'Web Payroll Solutions'
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'ExagoghOrarionSeErganh'
            }).exec();

            const ergazomenoi = await ErgazomenoiModel.find({
                team: sessionTeam,
                company_kod: companyId,
                energos: true
            });

            const passwordsData = await PasswordsModel.find({
                companykod_object: companyId,
                kodikos: '0001'
            });
            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            res.render('ergazomenoi/programmata/exagoghOrarionSeErganh', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                ergazomenoi: ergazomenoi
            });
        } catch (error) {
            console.log('Error into erganhController -> mainEisagoghOrarionApoErganhForm :', error);
        }
    };

    static mainLhpshOrarionApoErganhForm = async (req, res) => {
        const locals = {
            title: 'Λήψη Ωραρίων από Εργάνη',
            description: 'Web Payroll Solutions'
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;

        try {
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'LhpshOrarionApoErganh'
            }).exec();

            // Διαβάζουμε τα credentials με kodikos = '0002'
            const passwordsData = await PasswordsModel.find({
                companykod_object: companyId,
                kodikos: '0002'
            });

            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            res.render('ergazomenoi/programmata/lhpshOrarionApoErganh', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                rec: {}
            });
        } catch (error) {
            console.log('Error into erganhController -> mainLhpshOrarionApoErganhForm :', error);
        }
    };

    static lhpshOrarionApoErganh = async (req, res) => {
        try {
            const { selectedTeam, selectedCompany, fromDate, toDate, selectedPararthma } = req.body;

            // 1. Credentials από PasswordsModel (kodikos = '0002')
            const passwordRecord = await PasswordsModel.findOne({
                companykod_object: selectedCompany,
                kodikos: '0002'
            });

            if (!passwordRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials (kodikos=0002) για αυτή την εταιρεία'
                });
            }

            const username = passwordRecord.username;
            const password = passwordRecord.password;

            // 2. Στοιχεία session για το path αποθήκευσης
            const userTeam = req.session.userTeam;
            const companyKodikos = req.session.companyKodikos;
            const companyDescription = req.session.companyDescription;
            const periodInUseDescr = req.session.periodInUseDescr;
            const yearInUse = req.session.yearInUse;

            // 3. savePath
            const fileName = `${periodInUseDescr}_${yearInUse}.xlsx`;
            const savePath = path.join(
                process.cwd(),
                'uploads',
                's3-mock',
                'xlsx',
                userTeam,
                `${companyKodikos}_${companyDescription}`,
                'Oraria_Apo_Erganh',
                fileName
            );

            // 4. Διαγραφή παλιού αρχείου αν υπάρχει
            try {
                await fs.promises.unlink(savePath);
                console.log(`[lhpshOrarionApoErganh] Διαγράφηκε παλιό αρχείο: ${savePath}`);
            } catch (e) {
                // Δεν υπάρχει παλιό αρχείο — συνεχίζουμε κανονικά
            }

            // 5. Δημιουργία φακέλου
            await fs.promises.mkdir(path.dirname(savePath), { recursive: true });

            // 6. Download xlsx από Εργάνη ως Buffer
            const xlsxBuffer = await downloadOrariaToBuffer(
                username,
                password,
                fromDate,
                toDate,
                selectedPararthma
            );

            // 7α. Αποθήκευση τοπικά
            await fs.promises.writeFile(savePath, xlsxBuffer);
            console.log(`[lhpshOrarionApoErganh] Αποθηκεύτηκε τοπικά: ${savePath}`);

            // 8. Επεξεργασία xlsx ← ΠΡΩΤΑ
            await processOrariaXlsx(savePath, req.session.yearInUse);

            // 7β. ✅ Αποθήκευση στο S3 ← ΜΕΤΑ με το επεξεργασμένο αρχείο
            try {
                const { uploadBufferToS3 } = require('../../utils/s3Helper');
                const s3Key = `xlsx/${userTeam}/${companyKodikos}_${companyDescription}/Oraria_Apo_Erganh/${fileName}`;

                // ✅ Διάβασε το επεξεργασμένο αρχείο από τον δίσκο
                const processedBuffer = await fs.promises.readFile(savePath);

                await uploadBufferToS3(
                    processedBuffer,
                    s3Key,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
                console.log(`[lhpshOrarionApoErganh] ✅ Αποθηκεύτηκε στο S3: ${s3Key}`);
            } catch (s3Error) {
                console.error(`[lhpshOrarionApoKartes] ❌ S3 Error:`, s3Error.message);
            }

            return res.status(200).json({
                success: true,
                message: 'Επιτυχής Λήψη Ωραρίων',
                redirectUrl: '/ergazomenoi/programmata/lhpshOrarionApoErganh'
            });
        } catch (error) {
            console.log('Error into erganhController -> lhpshOrarionApoErganh :', error);
            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά τη Λήψη Ωραρίων'
            });
        }
    };

    static mainLhpshOrarionApoKartesForm = async (req, res) => {
        const locals = {
            title: 'Λήψη Ωραρίων από Εργάνη',
            description: 'Web Payroll Solutions'
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;

        try {
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'LhpshOrarionApoKartes'
            }).exec();

            // Διαβάζουμε τα credentials με kodikos = '0002'
            const passwordsData = await PasswordsModel.find({
                companykod_object: companyId,
                kodikos: '0002'
            });

            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            res.render('ergazomenoi/programmata/lhpshOrarionApoKartes', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                rec: {}
            });
        } catch (error) {
            console.log('Error into erganhController -> mainLhpshOrarionApoErganhForm :', error);
        }
    };

    static lhpshOrarionApoKartes = async (req, res) => {
        try {
            const { selectedPararthma, apoHmeromhnia, eosHmeromhnia } = req.body;

            // 1. Credentials (kodikos = '0002')
            const companyId = req.session.companyInUse;
            const passwordRecord = await PasswordsModel.findOne({
                companykod_object: companyId,
                kodikos: '0002'
            });

            if (!passwordRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials (kodikos=0002)'
                });
            }

            const username = passwordRecord.username;
            const password = passwordRecord.password;

            // 2. Session στοιχεία
            const userTeam = req.session.userTeam;
            const companyKodikos = req.session.companyKodikos;
            const companyDescription = req.session.companyDescription;
            const periodInUseDescr = req.session.periodInUseDescr;
            const yearInUse = req.session.yearInUse;

            // 3. savePath (local s3-mock)
            const fileName = `${periodInUseDescr}_${yearInUse}.xlsx`;
            const savePath = path.join(
                process.cwd(),
                'uploads',
                's3-mock',
                'xlsx',
                userTeam,
                `${companyKodikos}_${companyDescription}`,
                'Apasxolhseis_Apo_Kartes',
                fileName
            );

            // 4. Διαγραφή παλιού αρχείου
            try {
                await fs.promises.unlink(savePath);
                console.log(`[lhpshOrarionApoKartes] Διαγράφηκε παλιό: ${savePath}`);
            } catch (e) {
                /* δεν υπάρχει — ok */
            }

            // 5. Δημιουργία φακέλου
            await fs.promises.mkdir(path.dirname(savePath), { recursive: true });

            // 6. Download xlsx από Εργάνη
            const xlsxBuffer = await downloadKartesXlsxToBuffer(
                username,
                password,
                selectedPararthma,
                apoHmeromhnia,
                eosHmeromhnia
            );

            // 7α. Αποθήκευση τοπικά
            await fs.promises.writeFile(savePath, xlsxBuffer);
            console.log(`[lhpshOrarionApoKartes] Αποθηκεύτηκε τοπικά: ${savePath}`);

            // 8. Επεξεργασία xlsx + αποθήκευση MongoDB  ← ΠΡΩΤΑ η επεξεργασία
            await processKartesXlsx(savePath, apoHmeromhnia);

            // 7β. Αποθήκευση στο S3 ← ΜΕΤΑ ανέβασε το επεξεργασμένο αρχείο
            try {
                const { uploadBufferToS3 } = require('../../utils/s3Helper');
                const s3Key = `xlsx/${userTeam}/${companyKodikos}_${companyDescription}/Apasxolhseis_Apo_Kartes/${fileName}`;

                // ✅ Διάβασε το επεξεργασμένο αρχείο από το δίσκο
                const processedBuffer = await fs.promises.readFile(savePath);

                await uploadBufferToS3(
                    processedBuffer,
                    s3Key,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
                console.log(`[lhpshOrarionApoKartes] ✅ S3: ${s3Key}`);
            } catch (s3Error) {
                console.error(`[lhpshOrarionApoKartes] ❌ S3 Error:`, s3Error.message);
            }

            return res.status(200).json({
                success: true,
                message: 'Επιτυχής Λήψη Απασχολήσεων από Κάρτες',
                redirectUrl: '/ergazomenoi/programmata/lhpshOrarionApoKartes'
            });
        } catch (error) {
            console.error('[lhpshOrarionApoKartes] ❌', error);

            // ✅ Αναγνώριση Playwright TimeoutError
            const isTimeout =
                error?.name === 'TimeoutError' ||
                /Timeout .* exceeded/i.test(error?.message || '') ||
                /waiting for locator/i.test(error?.message || '');

            if (isTimeout) {
                return res.status(504).json({
                    success: false,
                    code: 'ERGANH_TIMEOUT',
                    message:
                        'Η σύνδεση με το πληροφοριακό σύστημα ΕΡΓΑΝΗ ΙΙ δεν ολοκληρώθηκε εγκαίρως. ' +
                        'Το σύστημα ενδέχεται να παρουσιάζει υψηλό φόρτο. ' +
                        'Παρακαλούμε δοκιμάστε ξανά σε λίγα λεπτά.'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά τη Λήψη Απασχολήσεων'
            });
        }
    };

    static mainCalcApasxolhseisPeriodoyForm = async (req, res) => {
        const locals = {
            title: 'Υπολογισμός Απασχολήσεων Βάσει Καρτών',
            description: 'Web Payroll Solutions'
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;

        try {
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'CalcApasxolhseisPeriodoy'
            }).exec();

            res.render('ergazomenoi/programmata/calcApasxolhseisPeriodoy', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                // passwords: cleanedPasswordsData,
                rec: {}
            });
        } catch (error) {
            console.log('Error into erganhController -> mainLhpshOrarionApoErganhForm :', error);
        }
    };

    static openErganh = async (req, res) => {
        try {
            const selectedCompany = req.session.companyInUse;

            if (!selectedCompany) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει επιλεγμένη εταιρεία.'
                });
            }

            const passwordRecord = await PasswordsModel.findOne({
                companykod_object: selectedCompany,
                kodikos: '0002'
            });

            if (!passwordRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials για ΕΡΓΑΝΗ.'
                });
            }

            return res.json({
                success: true,
                username: passwordRecord.username,
                password: passwordRecord.password,
                url: 'https://eservices.yeka.gr/'
            });
        } catch (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την ανάγνωση credentials ΕΡΓΑΝΗ.'
            });
        }
    };

    // static showErganhCredentials = async (req, res) => {
    //     try {
    //         const creds = req.session.erganhCredentials;

    //         if (!creds) {
    //             return res.status(404).send('Δεν βρέθηκαν προσωρινά credentials ΕΡΓΑΝΗ.');
    //         }

    //         return res.render('ergazomenoi/erganh/credentials', {
    //             username: creds.username,
    //             password: creds.password
    //         });
    //     } catch (err) {
    //         console.error(err);
    //         return res.status(500).send('Σφάλμα εμφάνισης credentials ΕΡΓΑΝΗ.');
    //     }
    // };
}

async function downloadOrariaToBuffer(username, password, fromDate, toDate, pararthma) {
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    try {
        // ============================================================
        // 1) LOGIN
        // ============================================================
        await page.goto('https://eservices.yeka.gr/login.aspx?ReturnUrl=%2f', {
            waitUntil: 'domcontentloaded',
            timeout: 25000
        });

        await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName', username);
        await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password', password);

        await Promise.allSettled([
            page.waitForLoadState('domcontentloaded', { timeout: 25000 }),
            page.click('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Login')
        ]);

        await page.waitForTimeout(400);

        // ============================================================
        // 2) ΜΕΝΟΥ
        // ============================================================
        await page.click('a.menu-dropdown:has(span.menu-text:text-is("ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ"))');
        await page.waitForTimeout(300);

        await page.click(
            'a.menu-dropdown:has(span.menu-text:text-is("Ψηφιακή Οργάνωση Χρόνου Εργασίας"))'
        );
        await page.waitForTimeout(300);

        await Promise.allSettled([
            page.waitForLoadState('domcontentloaded', { timeout: 25000 }),
            page.click('a[href="/Mitroa/ErgazomenosWorkingSearch.aspx"]')
        ]);

        await page.waitForTimeout(400);

        // ============================================================
        // 3) ΦΟΡΜΑ ΑΝΑΖΗΤΗΣΗΣ
        // ============================================================
        if (pararthma !== null && pararthma !== undefined && pararthma !== '') {
            await page.selectOption(
                '#ctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_PararthmaSelection_PararthmaListEdit',
                String(pararthma)
            );
            await page.waitForTimeout(200);
        }

        const fromDateFormatted = fromDate.replace(/\//g, '');
        const toDateFormatted = toDate.replace(/\//g, '');

        await page.click(
            '#igtxtctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_DateFromEdit'
        );
        await page.keyboard.type(fromDateFormatted);
        await page.waitForTimeout(200);

        await page.click(
            '#igtxtctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_DateToEdit'
        );
        await page.keyboard.type(toDateFormatted);
        await page.waitForTimeout(200);

        await Promise.allSettled([
            page.waitForLoadState('domcontentloaded', { timeout: 25000 }),
            page.click(
                '#ctl00_ctl00_ContentHolder_ContentHolder_ErgazomenosWorkingSearchControl_SearchControlSearchButton'
            )
        ]);

        // ============================================================
        // 4) ΕΞΑΓΩΓΗ EXCEL
        // ============================================================
        await page.waitForSelector('img.ExcelExport', {
            state: 'visible',
            timeout: 20000
        });

        // Απενεργοποίησε τυχόν προηγούμενο route intercept
        await context.unroute('**/*');

        let excelBuffer = null;

        // Intercept ΜΟΝΟ το ErgazomenosWorkingSearch POST response
        await context.route('**/ErgazomenosWorkingSearch.aspx', async (route, request) => {
            if (request.method() === 'POST') {
                const response = await route.fetch();
                const contentType = response.headers()['content-type'] || '';
                console.log(`[INTERCEPT] content-type: ${contentType}`);

                const body = await response.body();
                console.log(`[INTERCEPT] body size: ${body.length}`);

                // Αν είναι Excel κράτησέ το, αλλιώς άσε το να περάσει κανονικά
                if (
                    contentType.includes('application/vnd') ||
                    contentType.includes('application/octet-stream') ||
                    contentType.includes('excel')
                ) {
                    console.log('[INTERCEPT] ✅ Excel response πιάστηκε!');
                    excelBuffer = body;
                }

                await route.fulfill({ response });
            } else {
                await route.continue();
            }
        });

        await page.evaluate(() => {
            __doPostBack(
                'ctl00$ctl00$ContentHolder$ContentHolder$ErgazomenosWorkingSearchControl$ErgazomenosWorkingGridControl$Grid$Grid',
                'ExcelExport$1'
            );
        });

        // Περίμενε μέχρι να πιαστεί το Excel (max 30 sec)
        const startTime = Date.now();
        while (!excelBuffer && Date.now() - startTime < 30000) {
            await page.waitForTimeout(500);
        }

        if (!excelBuffer) {
            throw new Error('Δεν ήρθε Excel response μέσα σε 30 δευτερόλεπτα');
        }

        console.log(`[DEBUG] Excel buffer size: ${excelBuffer.length}`);

        // ============================================================
        // 5) BUFFER
        // ============================================================
        return excelBuffer;
    } finally {
        // ============================================================
        // 6) ΚΛΕΙΣΙΜΟ BROWSER
        // ============================================================
        await browser.close();
    }
}

async function processOrariaXlsx(filePath, sessionTeam, sessionYearInUse) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // 1) Μετονόμασε το τρέχον φύλλο σε Εργάνη_Αρχικό
    const sheetArxiko = workbook.worksheets[0];
    sheetArxiko.name = 'Εργάνη_Αρχικό';

    // 2) Δημιούργησε νέο φύλλο Εργάνη_Τελικό
    const sheetTeliko = workbook.addWorksheet('Εργάνη_Τελικό');

    let teliko_row = 1;

    function extractTimePairs(text) {
        const regex = /(\d{2}:\d{2})-(\d{2}:\d{2})/g;
        const pairs = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            pairs.push({ from: match[1], to: match[2] });
        }
        return pairs;
    }

    function writeTeliko(rowNum, colA, colB, colC, colD, colE, colF, colG, colH) {
        const newRow = sheetTeliko.getRow(rowNum);
        newRow.getCell(1).value = colA;
        newRow.getCell(2).value = colB;
        newRow.getCell(3).value = colC;
        newRow.getCell(4).value = colD;
        newRow.getCell(5).value = colE;
        newRow.getCell(6).value = colF;
        newRow.getCell(7).value = colG ?? '';
        newRow.getCell(8).value = colH ?? '';
        newRow.commit();
    }

    // 3) Επεξεργασία γραμμών από γραμμή 2
    sheetArxiko.eachRow((row, rowNumber) => {
        if (rowNumber < 2) return;

        const colI = row.getCell(9).text?.trim();

        const colA = row.getCell(1).value;
        const colB = row.getCell(2).value;
        const colC = row.getCell(3).value;
        const colD = row.getCell(4).value;
        const colE = row.getCell(5).value;

        if (colI === 'ΜΗ ΕΡΓΑΣΙΑ') {
            writeTeliko(teliko_row++, colA, colB, colD, colC, colE, 'ΜΕ', '', '');
            return;
        }
        if (colI === 'ΑΝΑΠΑΥΣΗ/ΡΕΠΟ') {
            writeTeliko(teliko_row++, colA, colB, colD, colC, colE, 'ΑΝ', '', '');
            return;
        }
        if (colI?.startsWith('ΕΡΓΑΣΙΑ ')) {
            const pairs = extractTimePairs(colI);
            pairs.forEach((pair) => {
                writeTeliko(teliko_row++, colA, colB, colD, colC, colE, 'ΕΡΓ', pair.from, pair.to);
            });
            return;
        }
        if (colI?.startsWith('ΤΗΛΕΡΓΑΣΙΑ ')) {
            const pairs = extractTimePairs(colI);
            pairs.forEach((pair) => {
                writeTeliko(teliko_row++, colA, colB, colD, colC, colE, 'ΤΗΛ', pair.from, pair.to);
            });
            return;
        }

        writeTeliko(teliko_row++, colA, colB, colD, colC, colE, '', '', '');
    });

    // ============================================================
    // ✅ Έλεγχος και διαγραφή γραμμών:
    // F κενό, G έχει τιμή, ίδια ημερομηνία με επόμενη γραμμή
    // ============================================================
    const telikoRowsForCheck = [];
    sheetTeliko.eachRow((row, rowNumber) => {
        telikoRowsForCheck.push({
            rowNumber,
            E: row.getCell(5).text?.trim() || '',
            F: row.getCell(6).text?.trim() || '',
            G: row.getCell(7).text?.trim() || ''
        });
    });

    const rowsToDelete = new Set();

    for (let j = 0; j < telikoRowsForCheck.length; j++) {
        const cur = telikoRowsForCheck[j];
        const next = telikoRowsForCheck[j + 1];

        if (!cur.F && !!cur.G && next && cur.E === next.E) {
            rowsToDelete.add(cur.rowNumber);
        }
    }

    if (rowsToDelete.size > 0) {
        // Διαβάζουμε όλες τις γραμμές του sheetTeliko
        const allTelikoRows = [];
        sheetTeliko.eachRow((row) => {
            const cells = [];
            for (let c = 1; c <= 7; c++) {
                cells.push(row.getCell(c).value);
            }
            allTelikoRows.push({ rowNumber: row.number, cells });
        });

        // Κρατάμε μόνο τις γραμμές που ΔΕΝ διαγράφονται
        const filteredRows = allTelikoRows.filter((r) => !rowsToDelete.has(r.rowNumber));

        // Καθαρίζουμε το sheetTeliko και ξαναγράφουμε
        sheetTeliko.spliceRows(1, sheetTeliko.rowCount);

        filteredRows.forEach((r, idx) => {
            const newRow = sheetTeliko.getRow(idx + 1);
            r.cells.forEach((val, colIdx) => {
                newRow.getCell(colIdx + 1).value = val;
            });
            newRow.commit();
        });

        console.log(
            `[processKartesXlsx] 🗑️ Διαγράφηκαν ${rowsToDelete.size} γραμμές από Κάρτες_Τελικό`
        );
    }

    await workbook.xlsx.writeFile(filePath);
    console.log(`[processOrariaXlsx] Επεξεργασία ολοκληρώθηκε: ${filePath}`);

    // ============================================================
    // 4) Αποθήκευση στο ProdhlomenaOrariaModel
    // ============================================================
    await saveTelikoToProdhlomena(sheetTeliko, sessionYearInUse);
}

// ============================================================
// Βοηθητική: parse GR locale date "ηη/μμ/εεεε" → UTC midnight Date
// Δουλεύει και με "2/3/2026" και με "02/03/2026"
// ============================================================
function parseGRDate(value) {
    if (!value) return null;

    // Αν είναι ήδη JS Date object (από ExcelJS)
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        // Κρατάμε μόνο ηη/μμ/εεεε — αγνοούμε ώρα/timezone
        const day = value.getDate(); // τοπική ώρα του server
        const month = value.getMonth(); // 0-based
        const year = value.getFullYear();
        return new Date(Date.UTC(year, month, day)); // UTC midnight
    }

    // Αν είναι string "ηη/μμ/εεεε" ή "η/μ/εεεε"
    if (typeof value === 'string') {
        const parts = value.trim().split('/');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-based
        const year = parseInt(parts[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        return new Date(Date.UTC(year, month, day)); // UTC midnight
    }

    // Αριθμός (Excel serial date)
    if (typeof value === 'number') {
        // ExcelJS serial → JS Date (local) → UTC midnight
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const ms = value * 24 * 60 * 60 * 1000;
        const d = new Date(excelEpoch.getTime() + ms);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    return null;
}

// async function saveTelikoToMongo(sheetTeliko, sessionTeam) {
//     const rows = [];
//     sheetTeliko.eachRow((row, rowNumber) => {
//         rows.push({
//             rowNumber,
//             afm: row.getCell(2).text?.trim(),
//             eponimo: row.getCell(3).text?.trim(),
//             onoma: row.getCell(4).text?.trim(),
//             hmeromhnia_raw: row.getCell(5).value,
//             kathgoria: row.getCell(6).text?.trim(),
//             apo_ora: row.getCell(7).text?.trim(),
//             eos_ora: row.getCell(8).text?.trim()
//         });
//     });

//     // ✅ ΒΗΜΑ 1: Μάζεψε όλα τα μοναδικά AFM
//     const uniqueAfms = [...new Set(rows.map((r) => r.afm).filter(Boolean))];

//     // ✅ ΒΗΜΑ 2: Φόρτωσε όλους τους εργαζόμενους με ΜΙΑ query
//     const ergazomenoiList = await ErgazomenoiModel.find({
//         afm: { $in: uniqueAfms }
//     }).lean();

//     // ✅ ΒΗΜΑ 3: Map afm → ergazomenos για γρήγορη αναζήτηση
//     const ergazomenoiMap = {};
//     ergazomenoiList.forEach((e) => {
//         ergazomenoiMap[e.afm] = e;
//     });

//     // ✅ ΒΗΜΑ 4: Φτιάξε τα records
//     const bulkOps = [];
//     let i = 0;

//     while (i < rows.length) {
//         const current = rows[i];

//         if (!current.afm) {
//             i++;
//             continue;
//         }

//         const hmeromhnia = parseGRDate(current.hmeromhnia_raw);

//         if (!hmeromhnia) {
//             console.warn(
//                 `[saveTelikoToMongo] ⚠️ Άκυρη ημερομηνία στη γραμμή ${current.rowNumber} ` +
//                     `(raw: "${current.hmeromhnia_raw}") για ΑΦΜ: ${current.afm} — παραλείπεται`
//             );
//             i++;
//             continue;
//         }

//         const hmeromhniaStr = hmeromhnia.toISOString().split('T')[0];

//         const ergazomenos = ergazomenoiMap[current.afm];

//         if (!ergazomenos) {
//             // console.log(`[saveTelikoToMongo] ⚠️ Δεν βρέθηκε εργαζόμενος με ΑΦΜ: ${current.afm}`);
//             i++;
//             continue;
//         }

//         const record = {
//             team: ergazomenos.team,
//             company_kod: ergazomenos.company_kod,
//             kodikos: ergazomenos.kodikos,
//             hmeromhnia: hmeromhnia,
//             kathgoria_ergasias: current.kathgoria,
//             apo_ora_01: current.apo_ora || '',
//             eos_ora_01: current.eos_ora || '',
//             apo_ora_02: '',
//             eos_ora_02: '',
//             apo_ora_03: '',
//             eos_ora_03: ''
//         };

//         // Έλεγξε επόμενη γραμμή — ίδια ημερομηνία;
//         if (i + 1 < rows.length) {
//             const next1 = rows[i + 1];
//             const next1Date = parseGRDate(next1.hmeromhnia_raw);

//             if (next1Date && next1Date.getTime() === hmeromhnia.getTime()) {
//                 record.apo_ora_02 = next1.apo_ora || '';
//                 record.eos_ora_02 = next1.eos_ora || '';
//                 i++;

//                 if (i + 1 < rows.length) {
//                     const next2 = rows[i + 1];
//                     const next2Date = parseGRDate(next2.hmeromhnia_raw);

//                     if (next2Date && next2Date.getTime() === hmeromhnia.getTime()) {
//                         record.apo_ora_03 = next2.apo_ora || '';
//                         record.eos_ora_03 = next2.eos_ora || '';
//                         i++;
//                     }
//                 }
//             }
//         }

//         // ✅ Προσθήκη στο bulkOps array — ΟΧΙ await εδώ
//         bulkOps.push({
//             updateOne: {
//                 filter: {
//                     team: ergazomenos.team,
//                     company_kod: ergazomenos.company_kod,
//                     kodikos: ergazomenos.kodikos,
//                     hmeromhnia: hmeromhnia
//                 },
//                 update: { $set: record },
//                 upsert: true
//             }
//         });

//         // console.log(
//         //     `[saveTelikoToMongo] 📋 ${ergazomenos.kodikos} | ${hmeromhniaStr} | ${record.kathgoria_ergasias}`
//         // );

//         i++;
//     }

//     // ✅ ΒΗΜΑ 5: ΜΙΑ μόνο κλήση στη ΒΔ για ΟΛΑ τα records
//     if (bulkOps.length > 0) {
//         const result = await OrariaFromErganhModel.bulkWrite(bulkOps, { ordered: false });
//     }
// }

// ============================================================
// Αποθήκευση στο ProdhlomenaOrariaModel
// - merge ζευγών ωρών ίδιας ημερομηνίας (έως 3)
// - argia / perigrafh_argias από ArgiesModel
// - repo = true αν F = "ΑΝ"
// - parallel bulkWrite σε chunks
// ============================================================
async function saveTelikoToProdhlomena(sheetTeliko, sessionYearInUse) {
    const CHUNK_SIZE = 1000; // ops ανά bulkWrite
    const PARALLEL_CHUNKS = 5; // πόσα bulkWrites τρέχουν παράλληλα

    // -------- 1) Διάβασε όλες τις γραμμές --------
    const rows = [];
    sheetTeliko.eachRow((row, rowNumber) => {
        rows.push({
            rowNumber,
            afm: row.getCell(2).text?.trim(),
            eponimo: row.getCell(3).text?.trim(),
            onoma: row.getCell(4).text?.trim(),
            hmeromhnia_raw: row.getCell(5).value,
            kathgoria: row.getCell(6).text?.trim(), // ΜΕ / ΑΝ / ΕΡΓ / ΤΗΛ
            apo_ora: row.getCell(7).text?.trim(),
            eos_ora: row.getCell(8).text?.trim()
        });
    });

    // -------- 2) Φόρτωσε εργαζόμενους ΜΙΑ φορά --------
    const uniqueAfms = [...new Set(rows.map((r) => r.afm).filter(Boolean))];
    const ergazomenoiList = await ErgazomenoiModel.find({
        afm: { $in: uniqueAfms }
    }).lean();

    const ergazomenoiMap = {};
    ergazomenoiList.forEach((e) => {
        ergazomenoiMap[e.afm] = e;
    });

    // -------- 3) Φόρτωσε ΟΛΕΣ τις Αργίες των (team, company_kod, etos) ΜΙΑ φορά --------
    const teamCompanyPairs = new Set();
    ergazomenoiList.forEach((e) => {
        if (e.team && e.company_kod) {
            teamCompanyPairs.add(`${e.team}|${e.company_kod}`);
        }
    });

    const argiesOr = [...teamCompanyPairs].map((pair) => {
        const [team, company_kod] = pair.split('|');
        return { team, company_kod, etos: String(sessionYearInUse) };
    });

    let argiesList = [];
    if (argiesOr.length > 0) {
        argiesList = await ArgiesModel.find({ $or: argiesOr }).lean();
    }

    // Map: "team|company_kod|<timestamp ημερομηνίας UTC>" -> perigrafh
    const argiesMap = {};
    argiesList.forEach((a) => {
        if (!a.hmeromhnia) return;
        // Κανονικοποίηση σε UTC midnight για ασφαλή σύγκριση
        const d = new Date(a.hmeromhnia);
        const key = `${a.team}|${a.company_kod}|${Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate()
        )}`;
        argiesMap[key] = a.perigrafh || '';
    });

    // -------- 4) Φτιάξε τα bulk ops --------
    const bulkOps = [];
    let i = 0;

    while (i < rows.length) {
        const current = rows[i];

        if (!current.afm) {
            i++;
            continue;
        }

        const hmeromhnia = parseGRDate(current.hmeromhnia_raw);
        if (!hmeromhnia) {
            console.warn(
                `[saveTelikoToProdhlomena] ⚠️ Άκυρη ημερομηνία γραμμή ${current.rowNumber} ` +
                    `(raw: "${current.hmeromhnia_raw}") ΑΦΜ: ${current.afm} — παραλείπεται`
            );
            i++;
            continue;
        }

        const ergazomenos = ergazomenoiMap[current.afm];
        if (!ergazomenos) {
            i++;
            continue;
        }

        // ✅ Αργία;
        const argiaKey = `${ergazomenos.team}|${ergazomenos.company_kod}|${hmeromhnia.getTime()}`;
        const argiaPerigrafh = argiesMap[argiaKey];
        const isArgia = argiaPerigrafh !== undefined;

        // ✅ ΡΕΠΟ; (στήλη F = "ΑΝ")
        let isRepo = current.kathgoria === 'ΑΝ';

        const record = {
            team: ergazomenos.team,
            company_kod: ergazomenos.company_kod,
            kodikos: ergazomenos.kodikos,
            hmeromhnia: hmeromhnia,
            kathgoria_ergasias: current.kathgoria,
            apo_ora_01: current.apo_ora || '',
            eos_ora_01: current.eos_ora || '',
            apo_ora_02: '',
            eos_ora_02: '',
            apo_ora_03: '',
            eos_ora_03: '',
            repo: isRepo,
            argia: isArgia,
            perigrafh_argias: isArgia ? argiaPerigrafh : '',
            ores_ergasias: diffHours(current.apo_ora, current.eos_ora) // ✅ 1ο ζεύγος
        };

        // Συγχώνευση με τις 1-2 επόμενες γραμμές αν είναι ίδια ημ/νία & ΑΦΜ
        if (i + 1 < rows.length) {
            const next1 = rows[i + 1];
            const next1Date = parseGRDate(next1.hmeromhnia_raw);
            if (
                next1Date &&
                next1Date.getTime() === hmeromhnia.getTime() &&
                next1.afm === current.afm
            ) {
                record.apo_ora_02 = next1.apo_ora || '';
                record.eos_ora_02 = next1.eos_ora || '';
                record.ores_ergasias += diffHours(next1.apo_ora, next1.eos_ora); // ✅ 2ο ζεύγος
                if (next1.kathgoria === 'ΑΝ') record.repo = true;
                i++;

                if (i + 1 < rows.length) {
                    const next2 = rows[i + 1];
                    const next2Date = parseGRDate(next2.hmeromhnia_raw);
                    if (
                        next2Date &&
                        next2Date.getTime() === hmeromhnia.getTime() &&
                        next2.afm === current.afm
                    ) {
                        record.apo_ora_03 = next2.apo_ora || '';
                        record.eos_ora_03 = next2.eos_ora || '';
                        record.ores_ergasias += diffHours(next2.apo_ora, next2.eos_ora); // ✅ 3ο ζεύγος
                        if (next2.kathgoria === 'ΑΝ') record.repo = true;
                        i++;
                    }
                }
            }
        }

        bulkOps.push({
            updateOne: {
                filter: {
                    team: record.team,
                    company_kod: record.company_kod,
                    kodikos: record.kodikos,
                    hmeromhnia: record.hmeromhnia
                },
                update: { $set: record },
                upsert: true
            }
        });

        i++;
    }

    if (bulkOps.length === 0) {
        console.log('[saveTelikoToProdhlomena] Δεν υπάρχουν εγγραφές προς αποθήκευση');
        return;
    }

    // -------- 5) Σπάσε σε chunks --------
    const chunks = [];
    for (let k = 0; k < bulkOps.length; k += CHUNK_SIZE) {
        chunks.push(bulkOps.slice(k, k + CHUNK_SIZE));
    }

    // -------- 6) Παράλληλη εκτέλεση με όριο concurrency --------
    let totalUpserted = 0;
    let totalModified = 0;

    for (let k = 0; k < chunks.length; k += PARALLEL_CHUNKS) {
        const batch = chunks.slice(k, k + PARALLEL_CHUNKS);
        const results = await Promise.all(
            batch.map((chunk) => ProdhlomenaOrariaModel.bulkWrite(chunk, { ordered: false }))
        );
        results.forEach((r) => {
            totalUpserted += r.upsertedCount || 0;
            totalModified += r.modifiedCount || 0;
        });
    }

    console.log(
        `[saveTelikoToProdhlomena] ✅ ${totalUpserted} inserted, ${totalModified} updated ` +
            `(records: ${bulkOps.length}, chunks: ${chunks.length}, parallel: ${PARALLEL_CHUNKS})`
    );
}

async function processKartesXlsx(filePath, apoHmeromhnia) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // 7) Μετονόμασε το τρέχον φύλλο σε Κάρτες_Αρχικό
    const sheetArxiko = workbook.worksheets[0];
    sheetArxiko.name = 'Κάρτες_Αρχικό';

    // 8) Δημιούργησε νέο φύλλο Κάρτες_Τελικό
    const sheetTeliko = workbook.addWorksheet('Κάρτες_Τελικό');

    // ============================================================
    // Βοηθητική: γράψε γραμμή στο Κάρτες_Τελικό
    // ============================================================
    let telikoRow = 1;

    function writeTelikoKartes(colA, colB, colC, colD, colE, colF, colG, colH) {
        const row = sheetTeliko.getRow(telikoRow++);
        row.getCell(1).value = colA;
        row.getCell(2).value = colB;
        row.getCell(3).value = colC;
        row.getCell(4).value = colD;
        row.getCell(5).value = colE;
        row.getCell(6).value = colF ?? '';
        row.getCell(7).value = colG ?? '';
        row.getCell(8).value = colH ?? '';
        row.commit();
    }

    // ============================================================
    // Βοηθητική: σύγκριση ημερομηνιών (στήλη E) ως "dd/mm/yyyy"
    // ============================================================
    function sameDate(val1, val2) {
        if (!val1 || !val2) return false;
        return String(val1).trim() === String(val2).trim();
    }

    // ============================================================
    // Βοηθητική: "dd/mm/yyyy" → επόμενη ημέρα "dd/mm/yyyy"
    // ============================================================
    function nextDayStr(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        const d = new Date(
            Date.UTC(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
        );
        d.setUTCDate(d.getUTCDate() + 1);
        return (
            String(d.getUTCDate()).padStart(2, '0') +
            '/' +
            String(d.getUTCMonth() + 1).padStart(2, '0') +
            '/' +
            d.getUTCFullYear()
        );
    }

    // ============================================================
    // Βοηθητική: καθάρισε ώρα από '*' (πχ "00:30*" → "00:30")
    // Πάντα κρατάμε τους πρώτους 5 χαρακτήρες αν υπάρχουν.
    // ============================================================
    function cleanTime(t) {
        if (!t) return '';
        const s = String(t).trim();
        return s.length >= 5 ? s.substring(0, 5) : s;
    }

    // ============================================================
    // Βοηθητική: συνδύασε ημ/νία "dd/mm/yyyy" + ώρα "HH:MM" → JS Date (UTC)
    // Αν addOneDayIfSmall=true και ώρα < 12:00 → +1 ημέρα (overnight)
    // ============================================================
    function combineDateTime(dateStr, timeStr, addOneDayIfSmall = false) {
        if (!dateStr || !timeStr) return null;
        const dParts = dateStr.split('/');
        if (dParts.length !== 3) return null;
        const [hh, mm] = timeStr.split(':').map(Number);
        if (isNaN(hh) || isNaN(mm)) return null;

        const d = new Date(
            Date.UTC(
                parseInt(dParts[2], 10),
                parseInt(dParts[1], 10) - 1,
                parseInt(dParts[0], 10),
                hh,
                mm
            )
        );
        if (addOneDayIfSmall && hh < 12) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d;
    }

    // ============================================================
    // 9) Διάβασε γραμμές από Κάρτες_Αρχικό (από γραμμή 2)
    // ============================================================
    const arxikoRows = [];
    sheetArxiko.eachRow((row, rowNumber) => {
        if (rowNumber < 2) return;

        // ✅ Μορφοποίηση ημερομηνίας στήλης E ως "dd/mm/yyyy"
        const rawDate = row.getCell(5).value;
        let formattedDate = '';
        if (rawDate instanceof Date) {
            const d = String(rawDate.getUTCDate()).padStart(2, '0');
            const m = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
            const y = rawDate.getUTCFullYear();
            formattedDate = `${d}/${m}/${y}`;
        } else if (typeof rawDate === 'string') {
            formattedDate = rawDate.trim();
        } else if (typeof rawDate === 'number') {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const d = new Date(excelEpoch.getTime() + rawDate * 24 * 60 * 60 * 1000);
            formattedDate =
                String(d.getUTCDate()).padStart(2, '0') +
                '/' +
                String(d.getUTCMonth() + 1).padStart(2, '0') +
                '/' +
                d.getUTCFullYear();
        }

        arxikoRows.push({
            A: row.getCell(1).value,
            B: row.getCell(2).text?.trim() || '', // AFM ως string
            C: row.getCell(3).value,
            D: row.getCell(4).value,
            E: formattedDate, // "dd/mm/yyyy"
            F: row.getCell(6).text?.trim() || '',
            G: row.getCell(7).text?.trim() || ''
        });
    });

    // ✅ Ταξινόμηση κατά B (AFM) και E (ημερομηνία)
    arxikoRows.sort((a, b) => {
        if (a.B < b.B) return -1;
        if (a.B > b.B) return 1;

        const toDate = (str) => {
            if (!str) return new Date(0);
            const parts = str.split('/');
            if (parts.length !== 3) return new Date(0);
            return new Date(
                Date.UTC(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
            );
        };

        return toDate(a.E) - toDate(b.E);
    });

    // ✅ Καθάρισε όλες τις γραμμές από γραμμή 2 και κάτω στο Αρχικό
    const lastRow = sheetArxiko.lastRow?.number ?? 1;
    for (let r = 2; r <= lastRow; r++) {
        const row = sheetArxiko.getRow(r);
        row.values = [];
        row.commit();
    }

    // ✅ Γράψε τις ταξινομημένες γραμμές πίσω στο Κάρτες_Αρχικό
    arxikoRows.forEach((r, idx) => {
        const row = sheetArxiko.getRow(idx + 2);
        row.getCell(1).value = r.A;
        row.getCell(2).value = r.B;
        row.getCell(3).value = r.C;
        row.getCell(4).value = r.D;
        row.getCell(5).value = r.E;
        row.getCell(6).value = r.F;
        row.getCell(7).value = r.G;
        row.commit();
    });

    // ============================================================
    // Εξαγωγή μήνα/έτους φίλτρου από apoHmeromhnia "dd/mm/yyyy"
    // ============================================================
    const [_apoDay, _apoMonth, _apoYear] = apoHmeromhnia.split('/').map(Number);

    // ============================================================
    // ✅ PHASE 1: Merge overnight shifts σε ΟΛΕΣ τις γραμμές
    // (current: F✅ G❌  +  next: ίδιος ΑΦΜ, ημ/νία = next day, F❌ G✅)
    // ============================================================
    const merged = [];
    let i = 0;

    while (i < arxikoRows.length) {
        const cur = arxikoRows[i];
        const next = arxikoRows[i + 1];

        const curF = cleanTime(cur.F);
        const curG = cleanTime(cur.G);

        // F ✅ G ❌ → ψάξε επόμενη για overnight closing
        if (curF && !curG && next) {
            const nextF = cleanTime(next.F);
            const nextG = cleanTime(next.G);
            const sameAfm = cur.B === next.B;

            const curDate = parseGRDate(cur.E);
            const nextDate = parseGRDate(next.E);
            const isNextDay =
                curDate &&
                nextDate &&
                nextDate.getTime() === curDate.getTime() + 24 * 60 * 60 * 1000;

            if (sameAfm && isNextDay && !nextF && nextG) {
                // ✅ MERGE: cur.F + next.G (καθαρισμένο από *)
                merged.push({
                    A: cur.A,
                    B: cur.B,
                    C: cur.C,
                    D: cur.D,
                    E: cur.E,
                    F: curF,
                    G: nextG
                });
                i += 2; // skip next
                continue;
            }
        }

        // Default → πέρασε αυτούσια (καθαρίζοντας ώρες από '*')
        merged.push({
            A: cur.A,
            B: cur.B,
            C: cur.C,
            D: cur.D,
            E: cur.E,
            F: curF,
            G: curG
        });
        i++;
    }

    // ============================================================
    // ✅ PHASE 2: Φίλτρο μήνα/έτους και γράψιμο στο sheetTeliko
    // ============================================================
    merged.forEach((row) => {
        const parts = row.E ? row.E.split('/') : null;
        const m = parts ? parseInt(parts[1], 10) : null;
        const y = parts ? parseInt(parts[2], 10) : null;

        if (m === _apoMonth && y === _apoYear) {
            writeTelikoKartes(row.A, row.B, row.C, row.D, row.E, row.F, row.G, '');
        }
    });

    // ============================================================
    // ✅ Έλεγχος και διαγραφή γραμμών από Κάρτες_Τελικό:
    // F κενό, G έχει τιμή, ίδια ημερομηνία με επόμενη γραμμή
    // (πιάνει ορφανές αποχωρήσεις πχ 6/3 με μόνο G)
    // ============================================================
    const telikoRowsForCheck = [];
    sheetTeliko.eachRow((row, rowNumber) => {
        telikoRowsForCheck.push({
            rowNumber,
            E: row.getCell(5).text?.trim() || '',
            F: row.getCell(6).text?.trim() || '',
            G: row.getCell(7).text?.trim() || ''
        });
    });

    const rowsToDelete = new Set();

    for (let j = 0; j < telikoRowsForCheck.length; j++) {
        const cur = telikoRowsForCheck[j];
        const next = telikoRowsForCheck[j + 1];

        if (
            !cur.F &&
            !!cur.G &&
            next &&
            parseGRDate(cur.E)?.getTime() === parseGRDate(next.E)?.getTime()
        ) {
            rowsToDelete.add(cur.rowNumber);
        }
    }

    if (rowsToDelete.size > 0) {
        const allTelikoRows = [];
        sheetTeliko.eachRow((row) => {
            const cells = [];
            for (let c = 1; c <= 8; c++) {
                cells.push(row.getCell(c).value);
            }
            allTelikoRows.push({ rowNumber: row.number, cells });
        });

        const filteredRows = allTelikoRows.filter((r) => !rowsToDelete.has(r.rowNumber));

        sheetTeliko.spliceRows(1, sheetTeliko.rowCount);

        filteredRows.forEach((r, idx) => {
            const newRow = sheetTeliko.getRow(idx + 1);
            r.cells.forEach((val, colIdx) => {
                newRow.getCell(colIdx + 1).value = val;
            });
            newRow.commit();
        });

        console.log(
            `[processKartesXlsx] 🗑️ Διαγράφηκαν ${rowsToDelete.size} γραμμές από Κάρτες_Τελικό`
        );
    }

    // ============================================================
    // ✅ Υπολογισμός στήλης H (κανόνας 11ώρου ημερήσιας ανάπαυσης)
    // H='Ok'     αν: (F πρώτης γραμμής επόμενης ημ/νίας ίδιου ΑΦΜ)
    //                - (G τελευταίας γραμμής τρέχουσας ημ/νίας) >= 11h
    // H='Not Ok' αν διαφορά < 11h
    // H=''       αν δεν είναι η τελευταία γραμμή της ημέρας ή δεν υπάρχει επόμενη
    // ============================================================
    const telikoAll = [];
    sheetTeliko.eachRow((row, rowNumber) => {
        telikoAll.push({
            rowNumber,
            afm: row.getCell(2).text?.trim() || '',
            E: row.getCell(5).text?.trim() || '',
            F: cleanTime(row.getCell(6).text || ''),
            G: cleanTime(row.getCell(7).text || '')
        });
    });

    const hValues = new Array(telikoAll.length).fill('');

    for (let n = 0; n < telikoAll.length; n++) {
        const cur = telikoAll[n];
        const next = telikoAll[n + 1];

        const isLastOfDate = !next || next.afm !== cur.afm || !sameDate(cur.E, next.E);

        // ✅ Μόνο η τελευταία γραμμή κάθε ημ/νίας παίρνει τιμή
        if (!isLastOfDate) continue;

        // Βρες την επόμενη γραμμή ίδιου ΑΦΜ με διαφορετική ημερομηνία
        let nextRow = null;
        for (let k = n + 1; k < telikoAll.length; k++) {
            if (telikoAll[k].afm === cur.afm && !sameDate(telikoAll[k].E, cur.E)) {
                nextRow = telikoAll[k];
                break;
            }
        }

        // Αν δεν υπάρχει επόμενη ημερομηνία ή λείπει G/F → δεν μπορούμε να κρίνουμε
        if (!nextRow || !cur.G || !nextRow.F) continue;

        // Υπολογισμός: G (τέλος εργασίας) — αν G < F της ίδιας γραμμής → overnight
        const curHasOvernight = cur.F && cur.G && cleanTime(cur.G) < cleanTime(cur.F);
        const endDateTime = combineDateTime(cur.E, cur.G, curHasOvernight);
        const startDateTime = combineDateTime(nextRow.E, nextRow.F, false);

        if (!endDateTime || !startDateTime) continue;

        const diffH = (startDateTime.getTime() - endDateTime.getTime()) / (1000 * 60 * 60);

        // ✅ Ok ή Not Ok ανάλογα με το αν τηρείται το 11ώρο
        hValues[n] = diffH >= 11 ? 'Ok' : 'Not Ok';
    }

    // Γράψε τις τιμές H πίσω στο sheet
    for (let n = 0; n < telikoAll.length; n++) {
        if (hValues[n]) {
            const row = sheetTeliko.getRow(telikoAll[n].rowNumber);
            row.getCell(8).value = hValues[n];
            row.commit();
        }
    }

    console.log('[processKartesXlsx] ✅ Στήλη H (11ώρο ανάπαυσης) υπολογίστηκε');

    // ============================================================
    // ✅ ΤΩΡΑ γράψε το αρχείο (με τη στήλη H συμπληρωμένη)
    // ============================================================
    await workbook.xlsx.writeFile(filePath);
    console.log(`[processKartesXlsx] ✅ Επεξεργασία ολοκληρώθηκε: ${filePath}`);

    // ============================================================
    // Αποθήκευση στο OrariaFromCardsModel
    // ============================================================
    await saveKartesTelikoToMongo(sheetTeliko);
}

// ============================================================
// saveKartesTelikoToMongo  →  ενημερώνει ProdhlomenaOrariaModel
// (ΟΧΙ OrariaFromCardsModel)
//
// Λογική:
//  - Group card rows κατά (afm, hmeromhnia)
//  - Για κάθε group, βρίσκει το ΥΠΑΡΧΟΝ έγγραφο ProdhlomenaOraria
//    (team, company_kod, kodikos, hmeromhnia)
//  - Ενημερώνει ΜΟΝΟ τα πεδία:
//       cards_apo_ora_01..03 / cards_eos_ora_01..03
//       cards_ores_ergasias  (άθροισμα ωρών όλων των ζευγών της κάρτας)
//       check_ergasia        (true αν H τελευταίας γραμμής = 'Not Ok', αλλιώς false)
//  - Δεν δημιουργεί νέα έγγραφα (upsert: false)
// ============================================================
async function saveKartesTelikoToMongo(sheetTeliko) {
    // -------- 1) Διάβασε όλες τις γραμμές του sheet --------
    const rows = [];
    sheetTeliko.eachRow((row, rowNumber) => {
        rows.push({
            rowNumber,
            afm: row.getCell(2).text?.trim(),
            eponimo: row.getCell(3).text?.trim(),
            onoma: row.getCell(4).text?.trim(),
            hmeromhnia_raw: row.getCell(5).value,
            apo_ora: row.getCell(6).text?.trim(),
            eos_ora: row.getCell(7).text?.trim(),
            h_check: row.getCell(8).text?.trim() || '' // 'Ok' / 'Not Ok' / ''
        });
    });

    // -------- 2) Group κατά (afm + hmeromhnia) --------
    const groups = new Map();

    for (const r of rows) {
        if (!r.afm) continue;

        const hmeromhnia = parseGRDate(r.hmeromhnia_raw);
        if (!hmeromhnia) {
            console.warn(
                `[saveKartesTelikoToMongo] ⚠️ Άκυρη ημ/νία γραμμή ${r.rowNumber} ` +
                    `(raw: "${r.hmeromhnia_raw}") ΑΦΜ: ${r.afm} — παραλείπεται`
            );
            continue;
        }

        const key = `${r.afm}|${hmeromhnia.getTime()}`;
        if (!groups.has(key)) {
            groups.set(key, {
                afm: r.afm,
                hmeromhnia: hmeromhnia,
                pairs: [],
                lastH: ''
            });
        }
        const g = groups.get(key);
        g.pairs.push({
            apo: r.apo_ora || '',
            eos: r.eos_ora || '',
            h_check: r.h_check
        });
        g.lastH = r.h_check || g.lastH;
    }

    // -------- 3) Φόρτωσε ergazomenoi με ΜΙΑ query --------
    const uniqueAfms = [...new Set([...groups.values()].map((g) => g.afm))];
    const ergazomenoiList = await ErgazomenoiModel.find({
        afm: { $in: uniqueAfms }
    }).lean();

    const ergazomenoiMap = {};
    ergazomenoiList.forEach((e) => {
        ergazomenoiMap[e.afm] = e;
    });

    // -------- 4) Φτιάξε bulk ops --------
    const bulkOps = [];
    let skippedNoErg = 0;

    for (const g of groups.values()) {
        const ergazomenos = ergazomenoiMap[g.afm];
        if (!ergazomenos) {
            skippedNoErg++;
            continue;
        }

        const update = {
            cards_apo_ora_01: '',
            cards_eos_ora_01: '',
            cards_apo_ora_02: '',
            cards_eos_ora_02: '',
            cards_apo_ora_03: '',
            cards_eos_ora_03: '',
            cards_ores_ergasias: 0, // ✅ μετονομάστηκε
            check_ergasia: false
        };

        for (let idx = 0; idx < Math.min(g.pairs.length, 3); idx++) {
            const p = g.pairs[idx];
            const suffix = String(idx + 1).padStart(2, '0'); // "01" / "02" / "03"
            update[`cards_apo_ora_${suffix}`] = p.apo;
            update[`cards_eos_ora_${suffix}`] = p.eos;
            update.cards_ores_ergasias += diffHours(p.apo, p.eos); // ✅ μετονομάστηκε
        }

        if (g.pairs.length > 3) {
            console.warn(
                `[saveKartesTelikoToMongo] ⚠️ ΑΦΜ ${g.afm} ` +
                    `${g.hmeromhnia.toISOString().split('T')[0]}: ` +
                    `${g.pairs.length} ζεύγη — αποθηκεύονται μόνο τα πρώτα 3`
            );
        }

        // ✅ check_ergasia: 'Not Ok' → true, αλλιώς ('Ok' ή '') → false
        update.check_ergasia = g.lastH === 'Not Ok';

        bulkOps.push({
            updateOne: {
                filter: {
                    team: ergazomenos.team,
                    company_kod: ergazomenos.company_kod,
                    kodikos: ergazomenos.kodikos,
                    hmeromhnia: g.hmeromhnia
                },
                update: { $set: update },
                upsert: false
            }
        });
    }

    // -------- 5) ΜΙΑ κλήση στη ΒΔ --------
    if (bulkOps.length > 0) {
        const result = await ProdhlomenaOrariaModel.bulkWrite(bulkOps, { ordered: false });
        console.log(
            `[saveKartesTelikoToMongo] ✅ ProdhlomenaOraria — ` +
                `matched: ${result.matchedCount}, modified: ${result.modifiedCount}` +
                (skippedNoErg ? `, skipped (no ergazomenos): ${skippedNoErg}` : '')
        );
    } else {
        console.log('[saveKartesTelikoToMongo] Δεν υπάρχουν εγγραφές προς ενημέρωση');
    }
}

async function downloadKartesXlsxToBuffer(
    username,
    password,
    pararthma,
    apoHmeromhnia,
    eosHmeromhnia
) {
    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    try {
        // ============================================================
        // 1) LOGIN
        // ============================================================
        await page.goto(
            'https://eservices.yeka.gr/(S(kscbsvaffyzprn0p1havg3k1))/login.aspx?ReturnUrl=%2f',
            { waitUntil: 'domcontentloaded', timeout: 25000 }
        );

        await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName', username);
        await page.fill('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password', password);

        await Promise.allSettled([
            page.waitForLoadState('domcontentloaded', { timeout: 25000 }),
            page.click('#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Login')
        ]);

        await page.waitForTimeout(400);

        // ============================================================
        // 2) ΜΕΝΟΥ: ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ → Κάρτα Εργασίας → Ημερολόγιο
        // ============================================================
        await page.click('a.menu-dropdown:has(span.menu-text:text-is("ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ"))');
        await page.waitForTimeout(300);

        await page.click('a.menu-dropdown:has(span.menu-text:text-is("Κάρτα Εργασίας"))');
        await page.waitForTimeout(300);

        await Promise.allSettled([
            page.waitForLoadState('domcontentloaded', { timeout: 25000 }),
            page.click('a[href="/WTO/Workcard/DailyWorkTimesSearch.aspx"]')
        ]);

        await page.waitForTimeout(400);

        // ============================================================
        // 3) ΠΑΡΑΡΤΗΜΑ
        // ============================================================
        if (pararthma !== null && pararthma !== undefined && pararthma !== '') {
            await page.selectOption(
                '#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_PararthmaSelection_PararthmaListEdit',
                String(pararthma)
            );
            await page.waitForTimeout(200);
        }

        // ============================================================
        // 4α) Υπολογισμός: Κυριακή της εβδομάδας του apoHmeromhnia
        // ============================================================
        const [apoDay, apoMonth, apoYear] = apoHmeromhnia.split('/').map(Number);
        const apoDate = new Date(Date.UTC(apoYear, apoMonth - 1, apoDay));

        const dayOfWeek = apoDate.getUTCDay(); // 0=Κυρ, 1=Δευ, ..., 6=Σαβ
        let daysToSubtract;
        if (dayOfWeek === 0 && apoDay === 1) {
            daysToSubtract = 1; // Κυριακή ΚΑΙ 1η μήνα → Σάββατο προηγ. μήνα
        } else {
            daysToSubtract = dayOfWeek;
        }

        const proigoumenesHmeresPrevWeekDate = new Date(apoDate);
        proigoumenesHmeresPrevWeekDate.setUTCDate(apoDate.getUTCDate() - daysToSubtract);

        const fromDateForSearch =
            String(proigoumenesHmeresPrevWeekDate.getUTCDate()).padStart(2, '0') +
            '/' +
            String(proigoumenesHmeresPrevWeekDate.getUTCMonth() + 1).padStart(2, '0') +
            '/' +
            proigoumenesHmeresPrevWeekDate.getUTCFullYear();

        // ============================================================
        // 4β) Υπολογισμός: eosHmeromhnia + 1 ημέρα
        // ============================================================
        const [eosDay, eosMonth, eosYear] = eosHmeromhnia.split('/').map(Number);
        const eosDate = new Date(Date.UTC(eosYear, eosMonth - 1, eosDay));
        eosDate.setUTCDate(eosDate.getUTCDate() + 1);

        const epomeniEosDate =
            String(eosDate.getUTCDate()).padStart(2, '0') +
            '/' +
            String(eosDate.getUTCMonth() + 1).padStart(2, '0') +
            '/' +
            eosDate.getUTCFullYear();

        const fromDateFormatted = fromDateForSearch.replace(/\//g, '');
        const toDateFormatted = epomeniEosDate.replace(/\//g, '');

        await page.click(
            '#igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateFromEdit'
        );
        await page.keyboard.type(fromDateFormatted);
        await page.waitForTimeout(200);

        await page.click(
            '#igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateToEdit'
        );
        await page.keyboard.type(toDateFormatted);
        await page.waitForTimeout(200);

        await Promise.allSettled([
            page.waitForLoadState('domcontentloaded', { timeout: 25000 }),
            page.click(
                '#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_SearchControlSearchButton'
            )
        ]);

        // ============================================================
        // 5) ΕΞΑΓΩΓΗ EXCEL μέσω intercept
        // ============================================================
        try {
            await page.waitForSelector('img.ExcelExport', {
                state: 'visible',
                timeout: 20000
            });
        } catch (e) {
            const err = new Error('ERGANH_TIMEOUT: Δεν φόρτωσε εγκαίρως το κουμπί εξαγωγής Excel.');
            err.name = 'TimeoutError';
            throw err;
        }

        await context.unroute('**/*');

        let excelBuffer = null;

        await context.route('**/DailyWorkTimesSearch.aspx', async (route, request) => {
            if (request.method() === 'POST') {
                const response = await route.fetch();
                const contentType = response.headers()['content-type'] || '';
                const body = await response.body();

                if (
                    contentType.includes('application/vnd') ||
                    contentType.includes('application/octet-stream') ||
                    contentType.includes('excel')
                ) {
                    console.log('[KARTES-INTERCEPT] ✅ Excel response πιάστηκε!');
                    excelBuffer = body;
                }

                await route.fulfill({ response });
            } else {
                await route.continue();
            }
        });

        await page.evaluate(() => {
            __doPostBack(
                'ctl00$ctl00$ContentHolder$ContentHolder$DailyWorkTimesSearchControl$DailyWorkTimesGridControl$Grid$Grid',
                'ExcelExport$1'
            );
        });

        const startTime = Date.now();
        while (!excelBuffer && Date.now() - startTime < 30000) {
            await page.waitForTimeout(500);
        }

        if (!excelBuffer) {
            throw new Error('[KARTES] Δεν ήρθε Excel response μέσα σε 30 δευτερόλεπτα');
        }

        console.log(`[KARTES] Excel buffer size: ${excelBuffer.length}`);
        return excelBuffer;
    } finally {
        await browser.close();
    }
}

module.exports = erganhController;
