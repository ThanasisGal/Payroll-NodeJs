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

const { ErgazomenoiModel, OrariaFromErganhModel, OrariaFromCardsModel, OrariaApologistikaModel } =
    Models_D;

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

    // static eisagoghOrarionApoKartes = async (req, res) => {
    //     try {
    //         const {
    //             selectedTeam,
    //             selectedCompany,
    //             fromDate,
    //             toDate,
    //             selectedAfm,
    //             selectedUsername,
    //             selectedPassword,
    //             selectedPararthma,
    //             selectedInterval
    //         } = req.body;
    //         team = selectedTeam;
    //         company = selectedCompany;
    //         username = selectedUsername;

    //         processWorkHoursFromKartes(
    //             selectedUsername,
    //             selectedPassword,
    //             fromDate,
    //             toDate,
    //             selectedAfm,
    //             selectedPararthma,
    //             selectedInterval
    //         );
    //     } catch (error) {
    //         console.log('Error into erganhController -> eisagoghOrarionApoKartes :', error);
    //     }

    //     async function processWorkHoursFromKartes(
    //         username,
    //         password,
    //         fromDate,
    //         toDate,
    //         afm,
    //         pararthma,
    //         stroggylopoihsh
    //     ) {
    //         const start = process.hrtime();
    //         let excelFilePath;
    //         try {
    //             excelFilePath = await downloadKartesExcel(
    //                 username,
    //                 password,
    //                 fromDate,
    //                 toDate,
    //                 afm,
    //                 pararthma
    //             );
    //             const xlsData = await readXLSFile(excelFilePath);
    //             const newXlsData = await adjustOvernightEntries(xlsData, stroggylopoihsh);
    //             await updateOrariaFromCardsModelFromXLS(newXlsData, fromDate);
    //         } catch (error) {
    //             console.error('Σφάλμα κατά την εκτέλεση:', error);
    //         } finally {
    //             // Διαγραφή του αρχείου XLSX αφού ολοκληρωθεί η διαδικασία
    //             if (excelFilePath) {
    //                 try {
    //                     await fs.promises.unlink(excelFilePath);
    //                     res.json({
    //                         url: _pdfUrlPath,
    //                         success: true,
    //                         redirectUrl: '/ergazomenoi/programmata/eisagoghOrarionApoKartes'
    //                     });
    //                 } catch (unlinkError) {
    //                     console.error('Σφάλμα κατά τη διαγραφή του αρχείου:', unlinkError);
    //                 }
    //             }
    //         }

    //         for (let i = 0; i < 1e6; i++) {}

    //         const diff = process.hrtime(start);
    //         const timeInMs = diff[0] * 1000 + diff[1] / 1e6;
    //         console.log(`Execution time: ${timeInMs.toFixed(3)}ms`);
    //     }

    //     async function downloadKartesExcel(username, password, fromDate, toDate, afm, pararthma) {
    //         let directory;
    //         if (isProduction) {
    //             directory = '/tmp/downloads'; // π.χ. σε Linux server
    //         } else {
    //             directory = path.join(__dirname, 'downloads'); // σε Windows dev περιβάλλον
    //         }

    //         try {
    //             if (!fs.existsSync(directory)) {
    //                 fs.mkdirSync(directory, { recursive: true });
    //                 fs.chmodSync(directory, 0o777); // πλήρη δικαιώματα
    //             }
    //         } catch (error) {
    //             console.error('Error creating directory:', error);
    //             return null;
    //         }

    //         // Εκκίνηση του browser (Chromium) σε headless mode
    //         const browser = await chromium.launch({
    //             headless: true,
    //             args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
    //         });

    //         // Δημιουργούμε context και σελίδα με ενεργοποιημένα downloads
    //         const context = await browser.newContext({ acceptDownloads: true });
    //         const page = await context.newPage();

    //         try {
    //             // Μετάβαση στη σελίδα login
    //             await page.goto('https://eservices.yeka.gr/login.aspx');

    //             // Είσοδος (username/password -> Enter)
    //             await page.fill(
    //                 '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName',
    //                 username
    //             );
    //             await page.fill(
    //                 '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password',
    //                 password
    //             );
    //             await page.keyboard.press('Enter');

    //             // Πλοήγηση στο μενού
    //             await page.click(
    //                 'xpath=//*[@id="ctl00_ctl00_ContentHolder_ContentHolder_SdcTableMenu"]/div/ol/li[2]/ol/li[6]/ol/li[3]/div/a'
    //             );

    //             // Συμπλήρωση πεδίων
    //             if (pararthma) {
    //                 await page.selectOption(
    //                     '#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_PararthmaSelection_PararthmaListEdit',
    //                     pararthma
    //                 );
    //             }
    //             if (afm) {
    //                 await page.fill(
    //                     '#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_AfmEdit',
    //                     afm
    //                 );
    //             }

    //             // Μετατροπή σε μορφή χωρίς '-', όπως στο Selenium
    //             const fromDateStr = fromDate.replace(/-/g, '');
    //             const toDateStr = toDate.replace(/-/g, '');

    //             await page.click(
    //                 'xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateFromEdit"]'
    //             );
    //             await page.fill(
    //                 'xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateFromEdit"]',
    //                 fromDateStr
    //             );

    //             await page.click(
    //                 'xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateToEdit"]'
    //             );
    //             await page.fill(
    //                 'xpath=//*[@id="igtxtctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_DateToEdit"]',
    //                 toDateStr
    //             );

    //             // Πατάμε Search
    //             await page.click(
    //                 '#ctl00_ctl00_ContentHolder_ContentHolder_DailyWorkTimesSearchControl_SearchControlSearchButton'
    //             );

    //             const excelExportButton = page.locator('.ExcelExport');
    //             await excelExportButton.waitFor({ state: 'visible', timeout: 10000 });

    //             // Ξεκινάμε το download πατώντας το κουμπί
    //             const [download] = await Promise.all([
    //                 page.waitForEvent('download'), // Περιμένουμε να ξεκινήσει download
    //                 excelExportButton.click() // Κλικ στο κουμπί
    //             ]);

    //             // Αποθήκευση του αρχείου στο επιθυμητό path
    //             const filename = 'Grid.xlsx';
    //             const downloadPath = path.join(directory, filename);
    //             await download.saveAs(downloadPath);

    //             // Προαιρετικά, επιβεβαιώνουμε ότι το αρχείο υπάρχει και δεν είναι άδειο
    //             // (Η download.saveAs επιστρέφει μόνο όταν έχει τελειώσει η λήψη)
    //             const stats = fs.statSync(downloadPath);
    //             if (!stats || stats.size === 0) {
    //                 throw new Error('Το αρχείο XLSX είναι κενό ή δεν κατέβηκε σωστά!');
    //             }
    //             // Αφού βρέθηκε το αρχείο, το μετονομάζουμε/διαβάζουμε
    //             const newPath = await renameFileAndRead(
    //                 'erg_m_263',
    //                 username,
    //                 fromDate,
    //                 toDate,
    //                 directory
    //             );
    //             return newPath;
    //         } finally {
    //             // Κλείσιμο browser
    //             await browser.close();
    //         }
    //     }

    //     async function renameFileAndRead(prefix, username, fromDate, toDate, directory) {
    //         const filename = 'Grid.xlsx';
    //         const newFilename = `${prefix}_${username}__${fromDate.replace(/\//g, '-')}_${toDate.replace(/\//g, '-')}.xlsx`;
    //         const newDownloadPath = path.join(directory, newFilename);

    //         try {
    //             // Χρησιμοποιούμε το fs.promises.rename για να μετονομάσουμε το αρχείο
    //             await fs.promises.rename(path.join(directory, filename), newDownloadPath);

    //             // Τώρα μπορούμε να διαβάσουμε το αρχείο
    //             return newDownloadPath;
    //         } catch (err) {
    //             console.error('Error renaming the file or reading the file:', err);
    //         }
    //     }

    //     // Συνάρτηση για ομαδοποίηση των εργαζομένων ανά ΑΦΜ
    //     function groupByAFMCards(xlsData) {
    //         const grouped = {};
    //         for (const row of xlsData) {
    //             const afm = row[1];
    //             if (!grouped[afm]) {
    //                 grouped[afm] = [];
    //             }
    //             grouped[afm].push(row);
    //         }
    //         return grouped;
    //     }

    //     function findWeeksInMonth(year, month) {
    //         let monthInt = parseInt(month, 10);

    //         let startDate = new Date(Date.UTC(year, monthInt - 1, 1)); // Ορισμός της πρώτης ημέρας του μήνα
    //         let endDate = new Date(Date.UTC(year, monthInt, 0)); // Τελευταία ημέρα του μήνα
    //         let weeks = []; // Μεταβλητή για την αποθήκευση των εβδομάδων
    //         let currentDay = new Date(startDate); // Εύρεση της πρώτης ημέρας της πρώτης εβδομάδας

    //         // Επανάληψη μέχρι την τελευταία ημέρα του μήνα
    //         while (currentDay <= endDate) {
    //             let weekStart = new Date(currentDay);

    //             let dayOfWeek = weekStart.getDay(); // Εύρεση της Δευτέρας της τρέχουσας εβδομάδας (πρώτη ημέρα της εβδομάδας)
    //             let daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Αν είναι Κυριακή (0), πάει πίσω 6 ημέρες
    //             weekStart.setDate(weekStart.getDate() - daysToMonday);

    //             weeks.push(weekStart.toISOString().substring(0, 10)); // Προσθήκη στον πίνακα εβδομάδων

    //             currentDay.setDate(currentDay.getDate() + 7); // Προχωράμε στην επόμενη εβδομάδα
    //         }

    //         return weeks; // Επιστροφή του πίνακα με τις εβδομάδες
    //     }

    //     function processWeeks(weeks, year, month) {
    //         let monthInt = parseInt(month, 10); // Μετατροπή της συμβολοσειράς month σε ακέραιο αριθμό

    //         // Υπολογισμός της τελευταίας ημέρας του μήνα
    //         let endDate = new Date(Date.UTC(year, monthInt, 0)); // τελευταία ημέρα του μήνα

    //         // Πίνακας για τα διαστήματα των εβδομάδων
    //         let intervals = [];

    //         for (let i = 0; i < weeks.length; i++) {
    //             let startOfWeek, endOfWeek;

    //             if (i === 0) {
    //                 // Η πρώτη εβδομάδα ξεκινάει από την 1η ημέρα του μήνα
    //                 startOfWeek = new Date(Date.UTC(year, monthInt - 1, 1));
    //                 endOfWeek = new Date(
    //                     Date.UTC(year, monthInt - 1, new Date(weeks[i + 1]).getUTCDate() - 1)
    //                 );
    //             } else if (i === weeks.length - 1) {
    //                 // Η τελευταία εβδομάδα τελειώνει στην τελευταία ημέρα του μήνα
    //                 startOfWeek = new Date(
    //                     Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate())
    //                 );
    //                 endOfWeek = endDate; // Τελευταία ημέρα του μήνα
    //             } else {
    //                 // Ενδιάμεσες εβδομάδες
    //                 startOfWeek = new Date(
    //                     Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate())
    //                 );
    //                 endOfWeek = new Date(
    //                     Date.UTC(year, monthInt - 1, new Date(weeks[i + 1]).getUTCDate() - 1)
    //                 );
    //             }

    //             // Προσθήκη του διαστήματος στον πίνακα
    //             intervals.push({
    //                 start: startOfWeek.toISOString().substring(0, 10),
    //                 end: endOfWeek.toISOString().substring(0, 10)
    //             });
    //         }

    //         return intervals;
    //     }

    //     function getDaysFromLastMondayOfPreviousMonth(startYear, startMonth) {
    //         // Δημιουργία της πρώτης ημέρας του τρέχοντος μήνα
    //         const firstDayOfCurrentMonth = new Date(Date.UTC(startYear, startMonth - 1, 1));
    //         // Έλεγχος αν η πρώτη μέρα είναι Δευτέρα
    //         if (firstDayOfCurrentMonth.getDay() === 1) {
    //             return []; // Επιστροφή κενής λίστας καθώς δεν θέλουμε να κάνουμε τίποτα
    //         }

    //         // Δημιουργία της τελευταίας ημέρας του προηγούμενου μήνα
    //         const lastDayOfPreviousMonth = new Date(Date.UTC(startYear, startMonth - 1, 0));

    //         // Βρίσκουμε την τελευταία Δευτέρα του προηγούμενου μήνα
    //         const lastMondayOfPreviousMonth = new Date(
    //             Date.UTC(
    //                 lastDayOfPreviousMonth.getUTCFullYear(),
    //                 lastDayOfPreviousMonth.getUTCMonth(),
    //                 lastDayOfPreviousMonth.getUTCDate()
    //             )
    //         );

    //         const dayOfWeek = lastMondayOfPreviousMonth.getDay(); // 1 είναι η Δευτέρα

    //         // Αν δεν είναι Δευτέρα, πηγαίνει πίσω στις μέρες μέχρι να βρει τη Δευτέρα
    //         const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Πίσω από Κυριακή (6) ή από οποιαδήποτε μέρα μέχρι να βρούμε Δευτέρα
    //         lastMondayOfPreviousMonth.setDate(lastMondayOfPreviousMonth.getDate() - daysToSubtract);

    //         // Πίνακας για τις ημέρες που θέλουμε να αποθηκεύσουμε
    //         const daysBetween = [];

    //         // Ξεκινάμε από την τελευταία Δευτέρα του προηγούμενου μήνα μέχρι την προηγούμενη της πρώτης μέρας του τρέχοντα μήνα
    //         let currentDay = lastMondayOfPreviousMonth;

    //         while (currentDay < firstDayOfCurrentMonth) {
    //             daysBetween.push(
    //                 new Date(
    //                     Date.UTC(
    //                         currentDay.getUTCFullYear(),
    //                         currentDay.getUTCMonth(),
    //                         currentDay.getUTCDate()
    //                     )
    //                 )
    //             ); // Προσθήκη της ημερομηνίας στον πίνακα
    //             currentDay.setDate(currentDay.getDate() + 1); // Μετακινήση στην επόμενη ημέρα
    //         }

    //         return daysBetween;
    //     }

    //     // Συνάρτηση για ενημέρωση του OrariaModel με βάση το Excel
    //     async function updateOrariaFromCardsModelFromXLS(xlsData, fromDate) {
    //         // const batchSize = 500; // Μέγεθος της παρτίδας (batch)
    //         const employeeData = groupByAFMCards(xlsData); // Ομαδοποίηση δεδομένων ανά ΑΦΜ

    //         const _company = await CompaniesModel.find(
    //             { _id: company },
    //             'kod eponymia firstname fathername _id'
    //         ).lean();
    //         const companyCode = _company[0].kod.toString().padStart(4, '0');
    //         const companyName =
    //             _company[0].eponymia.trim() +
    //             ' ' +
    //             _company[0].fathername.substring(0, 3).trim() +
    //             ' ' +
    //             _company[0].firstname.trim();

    //         const argies = await ArgiesModel.find(
    //             { team: team, company_kod: companyCode, etos: new Date(fromDate).getFullYear() },
    //             'hmeromhnia -_id'
    //         ).lean();

    //         // Μετατροπή των ημερομηνιών στη μορφή "ηη/μμ/εεεε"
    //         const hmeromhniesArgion = argies.map((argia) => {
    //             const date = new Date(argia.hmeromhnia); // Μετατροπή της ημερομηνίας σε Date object
    //             // Μετατροπή στη μορφή ηη/μμ/εεεε
    //             return date.toLocaleDateString('el-GR', {
    //                 day: '2-digit',
    //                 month: '2-digit',
    //                 year: 'numeric'
    //             });
    //         });

    //         let checkMonth, checkYear;
    //         let _argia = false;

    //         for (const afm in employeeData) {
    //             const operations = []; // Αποθηκεύουμε τις λειτουργίες ενημέρωσης εδώ
    //             const operations_cards = [];
    //             let employees = [];
    //             const rows = employeeData[afm]; // Δεδομένα για τον τρέχοντα εργαζόμενο

    //             // Βρίσκουμε τον εργαζόμενο με βάση το ΑΦΜ
    //             const ergazomenos = await ErgazomenoiModel.findOne({ afm });
    //             if (!ergazomenos) {
    //                 console.log(`Δεν βρέθηκε εργαζόμενος με ΑΦΜ: ${afm}`);
    //                 continue;
    //             }

    //             const kodikos = ergazomenos.kodikos;
    //             const onomateponymo =
    //                 ergazomenos.eponymo.substring(0, 20).trim() +
    //                 '\u00A0' +
    //                 ergazomenos.patronymo.substring(0, 3).trim() +
    //                 '\u00A0' +
    //                 ergazomenos.onoma.substring(0, 14).trim();

    //             // Βρίσκουμε τις καταγεγραμμένες ημερομηνίες από το Excel
    //             let recordedDays = rows.map((row) => {
    //                 const [day, month, year] = row[4].split('/').map(Number);
    //                 return new Date(Date.UTC(year, month - 1, day)).toISOString().substring(0, 10);
    //             });

    //             let uniqueRecordedDays = [...new Set(recordedDays)];

    //             checkMonth = parseInt(uniqueRecordedDays[0].split('-')[1]) - 1;
    //             checkYear = parseInt(uniqueRecordedDays[0].split('-')[0]);

    //             // Υπολογισμός της 1ης ημέρας του μήνα βάσει του fromDate
    //             let currentDate = new Date(Date.UTC(checkYear, checkMonth, 1)); // Πρώτη ημέρα του δοσμένου μήνα
    //             let lastDayOfMonth = new Date(Date.UTC(checkYear, checkMonth + 1, 0)); // Τελευταία ημέρα του μήνα

    //             let allDays = [];

    //             while (currentDate <= lastDayOfMonth) {
    //                 allDays.push(currentDate.toISOString().substring(0, 10));
    //                 currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    //             }

    //             // Περνάμε από όλες τις ημέρες του μήνα
    //             for (const hmeromhniaErgasias of allDays) {
    //                 const existingRow = rows.filter((row) => {
    //                     const [dayStr, monthStr, yearStr] = row[4].split('/');
    //                     const rowDate = new Date(Date.UTC(yearStr, monthStr - 1, dayStr))
    //                         .toISOString()
    //                         .substring(0, 10);
    //                     return rowDate === hmeromhniaErgasias;
    //                 });

    //                 const orariaNoCards = await OrariaModel.find({
    //                     team: team,
    //                     company_kod: company,
    //                     kodikos: kodikos,
    //                     hmeromhnia: new Date(hmeromhniaErgasias)
    //                 });

    //                 if (existingRow.length !== 0) {
    //                     // Αν η ημέρα υπάρχει στο Excel, προσθέτουμε την εγγραφή της

    //                     const rowDate = existingRow[0][4]; // Π.χ., "1/8/2024"
    //                     const [day, month, year] = rowDate.split('/').map(Number); // Εξαγωγή ημέρας, μήνα, έτους
    //                     const date = new Date(Date.UTC(year, month - 1, day)); // Δημιουργία UTC ημερομηνία
    //                     checkMonth = month;
    //                     checkYear = year;
    //                     const rowDateFormatted =
    //                         day.toString().padStart(2, '0') +
    //                         '/' +
    //                         month.toString().padStart(2, '0') +
    //                         '/' +
    //                         year.toString();
    //                     const nextDate = new Date(date);
    //                     nextDate.setUTCDate(date.getUTCDate() + 1);
    //                     const dayOfWeek = date.getDay();
    //                     const nextDayOfWeek = nextDate.getDay();
    //                     const nextDateFormatted = nextDate.toLocaleDateString('el-GR', {
    //                         day: '2-digit',
    //                         month: '2-digit',
    //                         year: 'numeric'
    //                     });

    //                     // const workData = existingRow[8]; // Εργασία (ένατο κελί)

    //                     _argia = hmeromhniesArgion.includes(rowDateFormatted);
    //                     const isHoliday = hmeromhniesArgion.includes(rowDateFormatted);
    //                     const isSunday = dayOfWeek === 0; // 0 = Κυριακή
    //                     const isNextHoliday = hmeromhniesArgion.includes(nextDateFormatted);
    //                     const isNextSunday = nextDayOfWeek === 0; // 0 = Κυριακή

    //                     let orariaDataFromCards = {
    //                         kathgoria_ergasias: '',
    //                         apo_ora_01: null,
    //                         eos_ora_01: null,
    //                         apo_ora_02: null,
    //                         eos_ora_02: null,
    //                         apo_ora_03: null,
    //                         eos_ora_03: null,
    //                         repo: false,
    //                         adeia: false,
    //                         astheneia: false,
    //                         argia: false,
    //                         perigrafh_argias: '',
    //                         kathgoria_adeias: '',
    //                         ores_ergasias: 0,
    //                         ores_nyxtas: 0,
    //                         ores_argion: 0,
    //                         ores_yperergasias: 0,
    //                         ores_yperergasias_nyxtas: 0,
    //                         ores_yperergasias_argion: 0,
    //                         ores_yperergasias_argion_nyxtas: 0,
    //                         ores_nominhs_yperorias: 0,
    //                         ores_nominhs_yperorias_nyxtas: 0,
    //                         ores_nominhs_yperorias_argion: 0,
    //                         ores_nominhs_yperorias_argion_nyxtas: 0,
    //                         ores_paranomhs_yperorias: 0,
    //                         ores_paranomhs_yperorias_nyxtas: 0,
    //                         ores_paranomhs_yperorias_argion: 0,
    //                         ores_paranomhs_yperorias_argion_nyxtas: 0
    //                     };

    //                     let orariaDataFromCards_cards = {
    //                         kathgoria_ergasias_cards: '',
    //                         apo_ora_01_cards: null,
    //                         eos_ora_01_cards: null,
    //                         apo_ora_02_cards: null,
    //                         eos_ora_02_cards: null,
    //                         apo_ora_03_cards: null,
    //                         eos_ora_03_cards: null,
    //                         repo_cards: false,
    //                         adeia_cards: false,
    //                         astheneia_cards: false,
    //                         argia_cards: false,
    //                         perigrafh_argias_cards: '',
    //                         kathgoria_adeias_cards: '',
    //                         ores_ergasias_cards: 0,
    //                         ores_nyxtas_cards: 0,
    //                         ores_argion_cards: 0,
    //                         ores_yperergasias_cards: 0,
    //                         ores_yperergasias_nyxtas_cards: 0,
    //                         ores_yperergasias_argion_cards: 0,
    //                         ores_yperergasias_argion_nyxtas_cards: 0,
    //                         ores_nominhs_yperorias_cards: 0,
    //                         ores_nominhs_yperorias_nyxtas_cards: 0,
    //                         ores_nominhs_yperorias_argion_cards: 0,
    //                         ores_nominhs_yperorias_argion_nyxtas_cards: 0,
    //                         ores_paranomhs_yperorias_cards: 0,
    //                         ores_paranomhs_yperorias_nyxtas_cards: 0,
    //                         ores_paranomhs_yperorias_argion_cards: 0,
    //                         ores_paranomhs_yperorias_argion_nyxtas_cards: 0
    //                     };

    //                     orariaDataFromCards.kathgoria_ergasias = 'ΕΡΓ';
    //                     orariaDataFromCards.repo = false;

    //                     orariaDataFromCards_cards.kathgoria_ergasias_cards = 'ΕΡΓ';
    //                     orariaDataFromCards_cards.repo_cards = false;

    //                     let timePeriods = [];

    //                     // Ελέγχουμε πόσες εγγραφές υπάρχουν για τη συγκεκριμένη ημερομηνία
    //                     if (existingRow.length === 1) {
    //                         // Αν υπάρχει 1 εγγραφή
    //                         timePeriods[0] =
    //                             typeof existingRow[0][5] === 'undefined'
    //                                 ? orariaNoCards[0]._doc.apo_ora_01
    //                                 : existingRow[0][5]; // Ώρα προσέλευσης
    //                         timePeriods[1] = existingRow[0][6]; // Ώρα αποχώρησης
    //                     } else if (existingRow.length === 2) {
    //                         // Αν υπάρχουν 2 εγγραφές
    //                         timePeriods[0] =
    //                             typeof existingRow[0][5] === 'undefined'
    //                                 ? orariaNoCards[0]._doc.apo_ora_01
    //                                 : existingRow[0][5]; // Ώρα προσέλευσης  1ης εγγραφής
    //                         timePeriods[2] =
    //                             typeof existingRow[1][5] === 'undefined'
    //                                 ? orariaNoCards[1]._doc.apo_ora_02
    //                                 : existingRow[1][5]; // Ώρα προσέλευσης  2ης εγγραφής
    //                         timePeriods[1] = existingRow[0][6]; // Ώρα αποχώρησης 1ης εγγραφής
    //                         timePeriods[3] = existingRow[1][6]; // Ώρα αποχώρησης 2ης εγγραφής
    //                     } else if (existingRow.length === 3) {
    //                         // Αν υπάρχουν 3 εγγραφές
    //                         timePeriods[0] =
    //                             typeof existingRow[0][5] === 'undefined'
    //                                 ? orariaNoCards[0]._doc.apo_ora_01
    //                                 : existingRow[0][5]; // Ώρα προσέλευσης  1ης εγγραφής
    //                         timePeriods[2] =
    //                             typeof existingRow[1][5] === 'undefined'
    //                                 ? orariaNoCards[1]._doc.apo_ora_02
    //                                 : existingRow[1][5]; // Ώρα προσέλευσης  2ης εγγραφής
    //                         timePeriods[3] =
    //                             typeof existingRow[2][5] === 'undefined'
    //                                 ? orariaNoCards[2]._doc.apo_ora_03
    //                                 : existingRow[2][5]; // Ώρα προσέλευσης  3ης εγγραφής
    //                         timePeriods[1] = existingRow[0][6]; // Ώρα αποχώρησης 1ης εγγραφής
    //                         timePeriods[3] = existingRow[1][6]; // Ώρα αποχώρησης 2ης εγγραφής
    //                         timePeriods[5] = existingRow[2][6]; // Ώρα αποχώρησης 3ης εγγραφής
    //                     }

    //                     calculateTimePeriodsInPairs(timePeriods, orariaNoCards);

    //                     // Εισαγωγή των ωρών ανάλογα με τον αριθμό των περιόδων
    //                     if (timePeriods.length === 2) {
    //                         orariaDataFromCards.apo_ora_01 = timePeriods[0];
    //                         orariaDataFromCards.eos_ora_01 = timePeriods[1];

    //                         orariaDataFromCards_cards.apo_ora_01_cards = timePeriods[0];
    //                         orariaDataFromCards_cards.eos_ora_01_cards = timePeriods[1];
    //                     } else if (timePeriods.length === 4) {
    //                         orariaDataFromCards.apo_ora_01 = timePeriods[0];
    //                         orariaDataFromCards.eos_ora_01 = timePeriods[1];
    //                         orariaDataFromCards.apo_ora_02 = timePeriods[2];
    //                         orariaDataFromCards.eos_ora_02 = timePeriods[3];

    //                         orariaDataFromCards_cards.apo_ora_01_cards = timePeriods[0];
    //                         orariaDataFromCards_cards.eos_ora_01_cards = timePeriods[1];
    //                         orariaDataFromCards_cards.apo_ora_02_cards = timePeriods[2];
    //                         orariaDataFromCards_cards.eos_ora_02_cards = timePeriods[3];
    //                     } else if (timePeriods.length === 6) {
    //                         orariaDataFromCards.apo_ora_01 = timePeriods[0];
    //                         orariaDataFromCards.eos_ora_01 = timePeriods[1];
    //                         orariaDataFromCards.apo_ora_02 = timePeriods[2];
    //                         orariaDataFromCards.eos_ora_02 = timePeriods[3];
    //                         orariaDataFromCards.apo_ora_03 = timePeriods[4];
    //                         orariaDataFromCards.eos_ora_03 = timePeriods[5];

    //                         orariaDataFromCards_cards.apo_ora_01_cards = timePeriods[0];
    //                         orariaDataFromCards_cards.eos_ora_01_cards = timePeriods[1];
    //                         orariaDataFromCards_cards.apo_ora_02_cards = timePeriods[2];
    //                         orariaDataFromCards_cards.eos_ora_02_cards = timePeriods[3];
    //                         orariaDataFromCards_cards.apo_ora_03_cards = timePeriods[4];
    //                         orariaDataFromCards_cards.eos_ora_03_cards = timePeriods[5];
    //                     }

    //                     let intervals = [];

    //                     for (let j = 1; j <= 3; j++) {
    //                         const startTimeInput = orariaDataFromCards[`apo_ora_0${j}`];
    //                         const endTimeInput = orariaDataFromCards[`eos_ora_0${j}`];
    //                         if (!startTimeInput || !endTimeInput) {
    //                             continue;
    //                         }

    //                         let startTime = convertTimeToMinutes(startTimeInput);
    //                         let endTime = convertTimeToMinutes(endTimeInput);
    //                         if (endTime < startTime) endTime += 1440;

    //                         intervals.push({ start: startTime, end: endTime, shift: j });
    //                     }

    //                     // Υπολογισμός ωρών εργασίας, υπερεργασίας κλπ
    //                     const workHours = calculateWorkHoursForIntervals(
    //                         intervals,
    //                         isHoliday || isSunday,
    //                         isNextHoliday || isNextSunday
    //                     );

    //                     orariaDataFromCards.argia = isHoliday;
    //                     orariaDataFromCards.ores_ergasias = workHours.working;
    //                     orariaDataFromCards.ores_nyxtas = workHours.night;
    //                     orariaDataFromCards.ores_argion = workHours.holiday;
    //                     orariaDataFromCards.ores_yperergasias = workHours.overwork;
    //                     orariaDataFromCards.ores_yperergasias_nyxtas = workHours.nightOverwork;
    //                     orariaDataFromCards.ores_yperergasias_argion = workHours.holidayOverwork;
    //                     orariaDataFromCards.ores_yperergasias_argion_nyxtas =
    //                         workHours.nightHolidayOverwork;
    //                     orariaDataFromCards.ores_nominhs_yperorias = workHours.overtime;
    //                     orariaDataFromCards.ores_nominhs_yperorias_nyxtas = workHours.nightOvertime;
    //                     orariaDataFromCards.ores_nominhs_yperorias_argion =
    //                         workHours.holidayOvertime;
    //                     orariaDataFromCards.ores_nominhs_yperorias_argion_nyxtas =
    //                         workHours.nightHolidayOvertime;
    //                     orariaDataFromCards.ores_paranomhs_yperorias = workHours.overtimeIllegal;
    //                     orariaDataFromCards.ores_paranomhs_yperorias_nyxtas =
    //                         workHours.nightOvertimeIllegal;
    //                     orariaDataFromCards.ores_paranomhs_yperorias_argion =
    //                         workHours.holidayOvertimeIllegal;
    //                     orariaDataFromCards.ores_paranomhs_yperorias_argion_nyxtas =
    //                         workHours.nightHolidayOvertimeIllegal;

    //                     orariaDataFromCards_cards.argia_cards = isHoliday;
    //                     orariaDataFromCards_cards.ores_ergasias_cards = workHours.working;
    //                     orariaDataFromCards_cards.ores_nyxtas_cards = workHours.night;
    //                     orariaDataFromCards_cards.ores_argion_cards = workHours.holiday;
    //                     orariaDataFromCards_cards.ores_yperergasias_cards = workHours.overwork;
    //                     orariaDataFromCards_cards.ores_yperergasias_nyxtas_cards =
    //                         workHours.nightOverwork;
    //                     orariaDataFromCards_cards.ores_yperergasias_argion_cards =
    //                         workHours.holidayOverwork;
    //                     orariaDataFromCards_cards.ores_yperergasias_argion_nyxtas_cards =
    //                         workHours.nightHolidayOverwork;
    //                     orariaDataFromCards_cards.ores_nominhs_yperorias_cards = workHours.overtime;
    //                     orariaDataFromCards_cards.ores_nominhs_yperorias_nyxtas_cards =
    //                         workHours.nightOvertime;
    //                     orariaDataFromCards_cards.ores_nominhs_yperorias_argion_cards =
    //                         workHours.holidayOvertime;
    //                     orariaDataFromCards_cards.ores_nominhs_yperorias_argion_nyxtas_cards =
    //                         workHours.nightHolidayOvertime;
    //                     orariaDataFromCards_cards.ores_paranomhs_yperorias_cards =
    //                         workHours.overtimeIllegal;
    //                     orariaDataFromCards_cards.ores_paranomhs_yperorias_nyxtas_cards =
    //                         workHours.nightOvertimeIllegal;
    //                     orariaDataFromCards_cards.ores_paranomhs_yperorias_argion_cards =
    //                         workHours.holidayOvertimeIllegal;
    //                     orariaDataFromCards_cards.ores_paranomhs_yperorias_argion_nyxtas_cards =
    //                         workHours.nightHolidayOvertimeIllegal;

    //                     // Προσθήκη της λειτουργίας ενημέρωσης στη λίστα operations
    //                     operations.push({
    //                         updateOne: {
    //                             filter: {
    //                                 team: team,
    //                                 company_kod: company,
    //                                 kodikos,
    //                                 hmeromhnia: new Date(hmeromhniaErgasias)
    //                             },
    //                             update: {
    //                                 $set: orariaDataFromCards,
    //                                 $setOnInsert: {
    //                                     team: team,
    //                                     company_kod: company,
    //                                     kodikos: kodikos,
    //                                     hmeromhnia: new Date(hmeromhniaErgasias)
    //                                 }
    //                             },
    //                             upsert: true
    //                         }
    //                     });

    //                     operations_cards.push({
    //                         updateOne: {
    //                             filter: {
    //                                 team: team,
    //                                 company_kod: company,
    //                                 kodikos,
    //                                 hmeromhnia: new Date(hmeromhniaErgasias)
    //                             },
    //                             update: {
    //                                 $set: orariaDataFromCards_cards,
    //                                 $setOnInsert: {
    //                                     team: team,
    //                                     company_kod: company,
    //                                     kodikos: kodikos,
    //                                     hmeromhnia: new Date(hmeromhniaErgasias)
    //                                 }
    //                             },
    //                             upsert: true
    //                         }
    //                     });
    //                 } else {
    //                     // Αν η ημέρα δεν υπάρχει στο Excel, προσθέτουμε την εγγραφή με την αντίστοιχη ημερομηνία απ' το ψηφιακό ωράριο
    //                     let orariaDataFromCards = {
    //                         kathgoria_ergasias:
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' ||
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ' ||
    //                             orariaNoCards[0]._doc.argia === true
    //                                 ? orariaNoCards[0]._doc.kathgoria_ergasias
    //                                 : '',
    //                         apo_ora_01: orariaNoCards[0]._doc.apo_ora_01,
    //                         eos_ora_01: orariaNoCards[0]._doc.eos_ora_01,
    //                         apo_ora_02: orariaNoCards[0]._doc.apo_ora_02,
    //                         eos_ora_02: orariaNoCards[0]._doc.eos_ora_02,
    //                         apo_ora_03: orariaNoCards[0]._doc.apo_ora_03,
    //                         eos_ora_03: orariaNoCards[0]._doc.eos_ora_03,
    //                         repo: orariaNoCards[0]._doc.repo,
    //                         adeia:
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' ||
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ'
    //                                 ? orariaNoCards[0]._doc.adeia
    //                                 : true,
    //                         astheneia: orariaNoCards[0]._doc.astheneia,
    //                         argia: orariaNoCards[0]._doc.argia,
    //                         perigrafh_argias: orariaNoCards[0]._doc.perigrafh_argias,
    //                         kathgoria_adeias:
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' ||
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ'
    //                                 ? orariaNoCards[0]._doc.kathgoria_adeias
    //                                 : 'Ορφανό χτύπημα',
    //                         ores_ergasias: orariaNoCards[0]._doc.ores_ergasias,
    //                         ores_nyxtas: orariaNoCards[0]._doc.ores_nyxtas,
    //                         ores_argion: orariaNoCards[0]._doc.ores_argion,
    //                         ores_yperergasias: orariaNoCards[0]._doc.ores_yperergasias,
    //                         ores_yperergasias_nyxtas:
    //                             orariaNoCards[0]._doc.ores_yperergasias_nyxtas,
    //                         ores_yperergasias_argion:
    //                             orariaNoCards[0]._doc.ores_yperergasias_argion,
    //                         ores_yperergasias_argion_nyxtas:
    //                             orariaNoCards[0]._doc.ores_yperergasias_argion_nyxtas,
    //                         ores_nominhs_yperorias: orariaNoCards[0]._doc.ores_nominhs_yperorias,
    //                         ores_nominhs_yperorias_nyxtas:
    //                             orariaNoCards[0]._doc.ores_nominhs_yperorias_nyxtas,
    //                         ores_nominhs_yperorias_argion:
    //                             orariaNoCards[0]._doc.ores_nominhs_yperorias_argion,
    //                         ores_nominhs_yperorias_argion_nyxtas:
    //                             orariaNoCards[0]._doc.ores_nominhs_yperorias_argion_nyxtas,
    //                         ores_paranomhs_yperorias:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias,
    //                         ores_paranomhs_yperorias_nyxtas:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias_nyxtas,
    //                         ores_paranomhs_yperorias_argion:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion,
    //                         ores_paranomhs_yperorias_argion_nyxtas:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion_nyxtas
    //                     };

    //                     let orariaDataFromCards_cards = {
    //                         kathgoria_ergasias_cards:
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' ||
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ' ||
    //                             orariaNoCards[0]._doc.argia === true
    //                                 ? orariaNoCards[0]._doc.kathgoria_ergasias
    //                                 : '',
    //                         apo_ora_01_cards: orariaNoCards[0]._doc.apo_ora_01,
    //                         eos_ora_01_cards: orariaNoCards[0]._doc.eos_ora_01,
    //                         apo_ora_02_cards: orariaNoCards[0]._doc.apo_ora_02,
    //                         eos_ora_02_cards: orariaNoCards[0]._doc.eos_ora_02,
    //                         apo_ora_03_cards: orariaNoCards[0]._doc.apo_ora_03,
    //                         eos_ora_03_cards: orariaNoCards[0]._doc.eos_ora_03,
    //                         repo_cards: orariaNoCards[0]._doc.repo,
    //                         adeia_cards:
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' ||
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ'
    //                                 ? orariaNoCards[0]._doc.adeia
    //                                 : true,
    //                         astheneia_cards: orariaNoCards[0]._doc.astheneia,
    //                         argia_cards: orariaNoCards[0]._doc.argia,
    //                         perigrafh_argias_cards: orariaNoCards[0]._doc.perigrafh_argias,
    //                         kathgoria_adeias_cards:
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΜΕ' ||
    //                             orariaNoCards[0]._doc.kathgoria_ergasias === 'ΑΝ'
    //                                 ? orariaNoCards[0]._doc.kathgoria_adeias
    //                                 : 'Ορφανό χτύπημα',
    //                         ores_ergasias_cards: orariaNoCards[0]._doc.ores_ergasias,
    //                         ores_nyxtas_cards: orariaNoCards[0]._doc.ores_nyxtas,
    //                         ores_argion_cards: orariaNoCards[0]._doc.ores_argion,
    //                         ores_yperergasias_cards: orariaNoCards[0]._doc.ores_yperergasias,
    //                         ores_yperergasias_nyxtas_cards:
    //                             orariaNoCards[0]._doc.ores_yperergasias_nyxtas,
    //                         ores_yperergasias_argion_cards:
    //                             orariaNoCards[0]._doc.ores_yperergasias_argion,
    //                         ores_yperergasias_argion_nyxtas_cards:
    //                             orariaNoCards[0]._doc.ores_yperergasias_argion_nyxtas,
    //                         ores_nominhs_yperorias_cards:
    //                             orariaNoCards[0]._doc.ores_nominhs_yperorias,
    //                         ores_nominhs_yperorias_nyxtas_cards:
    //                             orariaNoCards[0]._doc.ores_nominhs_yperorias_nyxtas,
    //                         ores_nominhs_yperorias_argion_cards:
    //                             orariaNoCards[0]._doc.ores_nominhs_yperorias_argion,
    //                         ores_nominhs_yperorias_argion_nyxtas_cards:
    //                             orariaNoCards[0]._doc.ores_nominhs_yperorias_argion_nyxtas,
    //                         ores_paranomhs_yperorias_cards:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias,
    //                         ores_paranomhs_yperorias_nyxtas_cards:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias_nyxtas,
    //                         ores_paranomhs_yperorias_argion_cards:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion,
    //                         ores_paranomhs_yperorias_argion_nyxtas_cards:
    //                             orariaNoCards[0]._doc.ores_paranomhs_yperorias_argion_nyxtas
    //                     };

    //                     if (
    //                         orariaNoCards[0]._doc.kathgoria_ergasias !== 'ΜΕ' &&
    //                         orariaNoCards[0]._doc.kathgoria_ergasias !== 'ΑΝ'
    //                     ) {
    //                         let existingEmployee = employees.find(
    //                             (employee) => employee.onomateponymo === onomateponymo
    //                         );

    //                         let hmeromhniaArgias =
    //                             orariaNoCards[0]._doc.argia === true
    //                                 ? new Date(hmeromhniaErgasias).toLocaleDateString() + ' Αργία'
    //                                 : new Date(hmeromhniaErgasias).toLocaleDateString();

    //                         if (existingEmployee) {
    //                             // Αν υπάρχει, προσθέστε την ημερομηνία στις ήδη υπάρχουσες
    //                             existingEmployee.hmeromhnies.push(hmeromhniaArgias);
    //                         } else {
    //                             // Αν δεν υπάρχει, προσθέστε τον εργαζόμενο στον πίνακα
    //                             employees.push({
    //                                 onomateponymo: onomateponymo,
    //                                 hmeromhnies: [hmeromhniaArgias]
    //                             });
    //                         }
    //                     }

    //                     operations.push({
    //                         updateOne: {
    //                             filter: {
    //                                 team: team,
    //                                 company_kod: company,
    //                                 kodikos,
    //                                 hmeromhnia: new Date(hmeromhniaErgasias)
    //                             },
    //                             update: {
    //                                 $set: orariaDataFromCards,
    //                                 $setOnInsert: {
    //                                     team: team,
    //                                     company_kod: company,
    //                                     kodikos: kodikos,
    //                                     hmeromhnia: new Date(hmeromhniaErgasias)
    //                                 }
    //                             },
    //                             upsert: true
    //                         }
    //                     });

    //                     operations_cards.push({
    //                         updateOne: {
    //                             filter: {
    //                                 team: team,
    //                                 company_kod: company,
    //                                 kodikos,
    //                                 hmeromhnia: new Date(hmeromhniaErgasias)
    //                             },
    //                             update: {
    //                                 $set: orariaDataFromCards_cards,
    //                                 $setOnInsert: {
    //                                     team: team,
    //                                     company_kod: company,
    //                                     kodikos: kodikos,
    //                                     hmeromhnia: new Date(hmeromhniaErgasias)
    //                                 }
    //                             },
    //                             upsert: true
    //                         }
    //                     });
    //                 }
    //             }

    //             let weeksInMonth = findWeeksInMonth(checkYear, checkMonth);
    //             let intervals = processWeeks(weeksInMonth, checkYear, checkMonth);

    //             const daysOfPreviousMonth = getDaysFromLastMondayOfPreviousMonth(
    //                 checkYear,
    //                 checkMonth
    //             );
    //             const firstDate = daysOfPreviousMonth[0];
    //             const lastDate = daysOfPreviousMonth[daysOfPreviousMonth.length - 1];

    //             const orariaProhgMhna = await OrariaModel.find({
    //                 team: team,
    //                 company_kod: company,
    //                 kodikos: kodikos,
    //                 hmeromhnia: { $gte: new Date(firstDate), $lte: new Date(lastDate) }
    //             }).sort({ hmeromhnia: 1 });

    //             // Υπολογισμός του συνόλου των πεδίων
    //             const data = orariaProhgMhna.reduce(
    //                 (accumulator, schedule) => {
    //                     return {
    //                         ores_ergasias:
    //                             accumulator.ores_ergasias + (schedule.ores_ergasias || 0),
    //                         ores_yperergasias:
    //                             accumulator.ores_yperergasias + (schedule.ores_yperergasias || 0),
    //                         ores_yperergasias_nyxtas:
    //                             accumulator.ores_yperergasias_nyxtas +
    //                             (schedule.ores_yperergasias_nyxtas || 0),
    //                         ores_yperergasias_argion:
    //                             accumulator.ores_yperergasias_argion +
    //                             (schedule.ores_yperergasias_argion || 0),
    //                         ores_yperergasias_argion_nyxtas:
    //                             accumulator.ores_yperergasias_argion_nyxtas +
    //                             (schedule.ores_yperergasias_argion_nyxtas || 0)
    //                     };
    //                 },
    //                 {
    //                     ores_ergasias: 0,
    //                     ores_yperergasias: 0,
    //                     ores_yperergasias_nyxtas: 0,
    //                     ores_yperergasias_argion: 0,
    //                     ores_yperergasias_argion_nyxtas: 0
    //                 }
    //             );

    //             const total = Object.values(data).reduce((sum, value) => sum + value, 0);
    //             let weeklyTotal = 0;

    //             for (let i = 0; i < intervals.length; i++) {
    //                 let fromDay = parseInt(intervals[i].start.substring(8, 10)) - 1;
    //                 let toDay = parseInt(intervals[i].end.substring(8, 10)) - 1;
    //                 if (i === 0) {
    //                     weeklyTotal = total;
    //                 } else {
    //                     weeklyTotal = 0;
    //                 }

    //                 // Πρώτα υπολογίζουμε το συνολικό weeklyTotal για όλες τις ημέρες της εβδομάδας
    //                 for (let j = fromDay; j <= toDay; j++) {
    //                     // Έλεγχος αν το incValues έχει τιμές (δηλαδή δεν είναι undefined ή null)
    //                     const incValues = operations[j]?.updateOne?.update?.$set;

    //                     if (incValues && Object.keys(incValues).length > 0) {
    //                         // Ορισμός των πεδίων που θέλουμε να αθροίσουμε
    //                         const fieldsToSum = [
    //                             'ores_ergasias',
    //                             'ores_yperergasias',
    //                             'ores_yperergasias_nyxtas',
    //                             'ores_yperergasias_argion',
    //                             'ores_yperergasias_argion_nyxtas'
    //                         ];

    //                         // Χρήση Object.entries() για να αθροίσουμε μόνο τα επιθυμητά πεδία
    //                         weeklyTotal += Object.entries(incValues)
    //                             .filter(([key]) => fieldsToSum.includes(key)) // Επιλογή μόνο των επιθυμητών πεδίων
    //                             .reduce((sum, [, value]) => sum + value, 0); // Άθροισμα των τιμών
    //                     }
    //                 }

    //                 // Τώρα, αφού έχει υπολογιστεί το weeklyTotal για όλη την εβδομάδα, κάνουμε τον έλεγχο
    //                 if (weeklyTotal <= 40) {
    //                     // Εδώ γίνονται οι ενημερώσεις για όλες τις ημέρες
    //                     for (let j = fromDay; j <= toDay; j++) {
    //                         let ores_ergasias =
    //                             (operations[j].updateOne.update.$set.ores_ergasias || 0) +
    //                             (operations[j].updateOne.update.$set.ores_yperergasias || 0) +
    //                             (operations[j].updateOne.update.$set.ores_yperergasias_nyxtas ||
    //                                 0) +
    //                             (operations[j].updateOne.update.$set.ores_yperergasias_argion ||
    //                                 0) +
    //                             (operations[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion_nyxtas || 0);

    //                         let ores_nyxtas =
    //                             (operations[j].updateOne.update.$set.ores_nyxtas || 0) +
    //                             (operations[j].updateOne.update.$set.ores_yperergasias_nyxtas ||
    //                                 0) +
    //                             (operations[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion_nyxtas || 0);

    //                         let ores_argion =
    //                             (operations[j].updateOne.update.$set.ores_argion || 0) +
    //                             (operations[j].updateOne.update.$set.ores_yperergasias_argion ||
    //                                 0) +
    //                             (operations[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion_nyxtas || 0);

    //                         operations[j].updateOne.update.$set.ores_ergasias = ores_ergasias;
    //                         operations[j].updateOne.update.$set.ores_nyxtas = ores_nyxtas;
    //                         operations[j].updateOne.update.$set.ores_argion = ores_argion;
    //                         operations[j].updateOne.update.$set.ores_yperergasias = 0;
    //                         operations[j].updateOne.update.$set.ores_yperergasias_nyxtas = 0;
    //                         operations[j].updateOne.update.$set.ores_yperergasias_argion = 0;
    //                         operations[j].updateOne.update.$set.ores_yperergasias_argion_nyxtas = 0;

    //                         let ores_ergasias_cards =
    //                             (operations_cards[j].updateOne.update.$set.ores_ergasias || 0) +
    //                             (operations_cards[j].updateOne.update.$set.ores_yperergasias || 0) +
    //                             (operations_cards[j].updateOne.update.$set
    //                                 .ores_yperergasias_nyxtas || 0) +
    //                             (operations_cards[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion || 0) +
    //                             (operations_cards[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion_nyxtas || 0);

    //                         let ores_nyxtas_cards =
    //                             (operations_cards[j].updateOne.update.$set.ores_nyxtas || 0) +
    //                             (operations_cards[j].updateOne.update.$set
    //                                 .ores_yperergasias_nyxtas || 0) +
    //                             (operations_cards[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion_nyxtas || 0);

    //                         let ores_argion_cards =
    //                             (operations_cards[j].updateOne.update.$set.ores_argion || 0) +
    //                             (operations_cards[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion || 0) +
    //                             (operations_cards[j].updateOne.update.$set
    //                                 .ores_yperergasias_argion_nyxtas || 0);

    //                         operations_cards[j].updateOne.update.$set.ores_ergasias = ores_ergasias;
    //                         operations_cards[j].updateOne.update.$set.ores_nyxtas = ores_nyxtas;
    //                         operations_cards[j].updateOne.update.$set.ores_argion = ores_argion;
    //                         operations_cards[j].updateOne.update.$set.ores_yperergasias = 0;
    //                         operations_cards[j].updateOne.update.$set.ores_yperergasias_nyxtas = 0;
    //                         operations_cards[j].updateOne.update.$set.ores_yperergasias_argion = 0;
    //                         operations_cards[
    //                             j
    //                         ].updateOne.update.$set.ores_yperergasias_argion_nyxtas = 0;
    //                     }
    //                 }
    //             }

    //             await generatePDF(_company, companyName, employees, hmeromhniesArgion);

    //             // Εκτέλεση τυχόν υπόλοιπων operations
    //             if (operations.length > 0) {
    //                 await OrariaFromCardsModel.bulkWrite(operations);
    //             }

    //             if (operations_cards.length > 0) {
    //                 await OrariaApologistikaModel.bulkWrite(operations_cards);
    //             }
    //         }
    //     }
    // };

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
            console.log(`[lhpshOrarionApoErganh] Αποθηκεύτηκε: ${savePath}`);

            // 7β. ✅ Αποθήκευση στο S3
            const { uploadBufferToS3 } = require('../../utils/s3Helper');

            const s3Key = `xlsx/${userTeam}/${companyKodikos}_${companyDescription}/Oraria_Apo_Erganh/${fileName}`;

            await uploadBufferToS3(
                xlsxBuffer,
                s3Key,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );

            console.log(`[lhpshOrarionApoErganh] ✅ Αποθηκεύτηκε στο S3: ${s3Key}`);

            // 8. Επεξεργασία xlsx
            await processOrariaXlsx(savePath);

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

            // 7β. Αποθήκευση στο S3
            try {
                const { uploadBufferToS3 } = require('../../utils/s3Helper');
                const s3Key = `xlsx/${userTeam}/${companyKodikos}_${companyDescription}/Apasxolhseis_Apo_Kartes/${fileName}`;

                await uploadBufferToS3(
                    xlsxBuffer,
                    s3Key,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
                console.log(`[lhpshOrarionApoKartes] ✅ S3: ${s3Key}`);
            } catch (s3Error) {
                console.error(`[lhpshOrarionApoKartes] ❌ S3 Error:`, s3Error.message);
            }

            // 8. Επεξεργασία xlsx + αποθήκευση MongoDB
            await processKartesXlsx(savePath);

            return res.status(200).json({
                success: true,
                message: 'Επιτυχής Λήψη Απασχολήσεων από Κάρτες',
                redirectUrl: '/ergazomenoi/programmata/lhpshOrarionApoKartes'
            });
        } catch (error) {
            console.error('[lhpshOrarionApoKartes] ❌', error);
            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά τη Λήψη Απασχολήσεων'
            });
        }
    };
}

async function downloadOrariaToBuffer(username, password, fromDate, toDate, pararthma) {
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

async function processOrariaXlsx(filePath, sessionTeam) {
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

    await workbook.xlsx.writeFile(filePath);
    console.log(`[processOrariaXlsx] Επεξεργασία ολοκληρώθηκε: ${filePath}`);

    // ============================================================
    // 4) Αποθήκευση στο OrariaFromErganhModel
    // ============================================================
    await saveTelikoToMongo(sheetTeliko, sessionTeam);
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

async function saveTelikoToMongo(sheetTeliko, sessionTeam) {
    const rows = [];
    sheetTeliko.eachRow((row, rowNumber) => {
        rows.push({
            rowNumber,
            afm: row.getCell(2).text?.trim(),
            eponimo: row.getCell(3).text?.trim(),
            onoma: row.getCell(4).text?.trim(),
            hmeromhnia_raw: row.getCell(5).value,
            kathgoria: row.getCell(6).text?.trim(),
            apo_ora: row.getCell(7).text?.trim(),
            eos_ora: row.getCell(8).text?.trim()
        });
    });

    // ✅ ΒΗΜΑ 1: Μάζεψε όλα τα μοναδικά AFM
    const uniqueAfms = [...new Set(rows.map((r) => r.afm).filter(Boolean))];

    // ✅ ΒΗΜΑ 2: Φόρτωσε όλους τους εργαζόμενους με ΜΙΑ query
    const ergazomenoiList = await ErgazomenoiModel.find({
        afm: { $in: uniqueAfms }
    }).lean();

    // ✅ ΒΗΜΑ 3: Map afm → ergazomenos για γρήγορη αναζήτηση
    const ergazomenoiMap = {};
    ergazomenoiList.forEach((e) => {
        ergazomenoiMap[e.afm] = e;
    });

    // ✅ ΒΗΜΑ 4: Φτιάξε τα records
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
                `[saveTelikoToMongo] ⚠️ Άκυρη ημερομηνία στη γραμμή ${current.rowNumber} ` +
                    `(raw: "${current.hmeromhnia_raw}") για ΑΦΜ: ${current.afm} — παραλείπεται`
            );
            i++;
            continue;
        }

        const hmeromhniaStr = hmeromhnia.toISOString().split('T')[0];

        const ergazomenos = ergazomenoiMap[current.afm];

        if (!ergazomenos) {
            // console.log(`[saveTelikoToMongo] ⚠️ Δεν βρέθηκε εργαζόμενος με ΑΦΜ: ${current.afm}`);
            i++;
            continue;
        }

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
            eos_ora_03: ''
        };

        // Έλεγξε επόμενη γραμμή — ίδια ημερομηνία;
        if (i + 1 < rows.length) {
            const next1 = rows[i + 1];
            const next1Date = parseGRDate(next1.hmeromhnia_raw);

            if (next1Date && next1Date.getTime() === hmeromhnia.getTime()) {
                record.apo_ora_02 = next1.apo_ora || '';
                record.eos_ora_02 = next1.eos_ora || '';
                i++;

                if (i + 1 < rows.length) {
                    const next2 = rows[i + 1];
                    const next2Date = parseGRDate(next2.hmeromhnia_raw);

                    if (next2Date && next2Date.getTime() === hmeromhnia.getTime()) {
                        record.apo_ora_03 = next2.apo_ora || '';
                        record.eos_ora_03 = next2.eos_ora || '';
                        i++;
                    }
                }
            }
        }

        // ✅ Προσθήκη στο bulkOps array — ΟΧΙ await εδώ
        bulkOps.push({
            updateOne: {
                filter: {
                    team: ergazomenos.team,
                    company_kod: ergazomenos.company_kod,
                    kodikos: ergazomenos.kodikos,
                    hmeromhnia: hmeromhnia
                },
                update: { $set: record },
                upsert: true
            }
        });

        // console.log(
        //     `[saveTelikoToMongo] 📋 ${ergazomenos.kodikos} | ${hmeromhniaStr} | ${record.kathgoria_ergasias}`
        // );

        i++;
    }

    // ✅ ΒΗΜΑ 5: ΜΙΑ μόνο κλήση στη ΒΔ για ΟΛΑ τα records
    if (bulkOps.length > 0) {
        const result = await OrariaFromErganhModel.bulkWrite(bulkOps, { ordered: false });
    }

    async function processKartesXlsx(filePath) {
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

        function writeTelikoKartes(colA, colB, colC, colD, colE, colF, colG) {
            const row = sheetTeliko.getRow(telikoRow++);
            row.getCell(1).value = colA;
            row.getCell(2).value = colB;
            row.getCell(3).value = colC;
            row.getCell(4).value = colD;
            row.getCell(5).value = colE;
            row.getCell(6).value = colF ?? '';
            row.getCell(7).value = colG ?? '';
            row.commit();
        }

        // ============================================================
        // Βοηθητική: σύγκριση ημερομηνιών (στήλη E)
        // ============================================================
        function sameDate(val1, val2) {
            if (!val1 || !val2) return false;
            const d1 =
                val1 instanceof Date ? val1.toISOString().split('T')[0] : String(val1).trim();
            const d2 =
                val2 instanceof Date ? val2.toISOString().split('T')[0] : String(val2).trim();
            return d1 === d2;
        }

        // ============================================================
        // 9) Επεξεργασία γραμμών από γραμμή 2
        // ============================================================
        const arxikoRows = [];
        sheetArxiko.eachRow((row, rowNumber) => {
            if (rowNumber < 2) return;
            arxikoRows.push({
                A: row.getCell(1).value,
                B: row.getCell(2).value,
                C: row.getCell(3).value,
                D: row.getCell(4).value,
                E: row.getCell(5).value,
                F: row.getCell(6).text?.trim() || '',
                G: row.getCell(7).text?.trim() || ''
            });
        });

        let i = 0;
        while (i < arxikoRows.length) {
            const cur = arxikoRows[i];
            const next = arxikoRows[i + 1];

            const hasF = !!cur.F;
            const hasG = !!cur.G;

            // 9.1) F ✅  G ✅ → γράψε κανονικά
            if (hasF && hasG) {
                writeTelikoKartes(cur.A, cur.B, cur.C, cur.D, cur.E, cur.F, cur.G);
                i++;
                continue;
            }

            // 9.2) F ✅  G ❌ → επόμενη: διαφ. ημ/νία, F ❌, G ✅
            if (hasF && !hasG && next) {
                const nextHasF = !!next.F;
                const nextHasG = !!next.G;
                const diffDate = !sameDate(cur.E, next.E);

                if (diffDate && !nextHasF && nextHasG) {
                    // Συγχώνευση: cur.F + next.G
                    writeTelikoKartes(cur.A, cur.B, cur.C, cur.D, cur.E, cur.F, next.G);
                    i += 2; // skip next
                    continue;
                }

                // 9.3) F ✅  G ❌ → επόμενη: διαφ. ημ/νία, F ✅
                if (diffDate && nextHasF) {
                    writeTelikoKartes(cur.A, cur.B, cur.C, cur.D, cur.E, cur.F, '');
                    i++;
                    continue;
                }
            }

            // 9.4) F ❌  G ✅ → επόμενη: διαφ. ημ/νία, F ✅, G ✅
            if (!hasF && hasG && next) {
                const nextHasF = !!next.F;
                const nextHasG = !!next.G;
                const diffDate = !sameDate(cur.E, next.E);

                if (diffDate && nextHasF && nextHasG) {
                    writeTelikoKartes(cur.A, cur.B, cur.C, cur.D, cur.E, '', cur.G);
                    i++;
                    continue;
                }
            }

            // Default: γράψε ό,τι έχεις
            writeTelikoKartes(cur.A, cur.B, cur.C, cur.D, cur.E, cur.F, cur.G);
            i++;
        }

        await workbook.xlsx.writeFile(filePath);
        console.log(`[processKartesXlsx] ✅ Επεξεργασία ολοκληρώθηκε: ${filePath}`);

        // ============================================================
        // Αποθήκευση στο OrariaFromCardsModel
        // ============================================================
        await saveKartesTelikoToMongo(sheetTeliko);
    }

    // ============================================================
    // saveKartesTelikoToMongo
    // Στήλες: A=col1, B=afm, C=eponimo, D=onoma, E=hmeromhnia,
    //         F=apo_ora, G=eos_ora
    // ============================================================
    async function saveKartesTelikoToMongo(sheetTeliko) {
        const rows = [];
        sheetTeliko.eachRow((row, rowNumber) => {
            rows.push({
                rowNumber,
                afm: row.getCell(2).text?.trim(),
                eponimo: row.getCell(3).text?.trim(),
                onoma: row.getCell(4).text?.trim(),
                hmeromhnia_raw: row.getCell(5).value,
                apo_ora: row.getCell(6).text?.trim(),
                eos_ora: row.getCell(7).text?.trim()
            });
        });

        // ΒΗΜΑ 1: Μοναδικά AFM
        const uniqueAfms = [...new Set(rows.map((r) => r.afm).filter(Boolean))];

        // ΒΗΜΑ 2: Φόρτωσε εργαζόμενους με ΜΙΑ query
        const ergazomenoiList = await ErgazomenoiModel.find({
            afm: { $in: uniqueAfms }
        }).lean();

        // ΒΗΜΑ 3: Map afm → ergazomenos
        const ergazomenoiMap = {};
        ergazomenoiList.forEach((e) => {
            ergazomenoiMap[e.afm] = e;
        });

        // ΒΗΜΑ 4: Φτιάξε records
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
                    `[saveKartesTelikoToMongo] ⚠️ Άκυρη ημερομηνία γραμμή ${current.rowNumber} ` +
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

            const record = {
                team: ergazomenos.team,
                company_kod: ergazomenos.company_kod,
                kodikos: ergazomenos.kodikos,
                hmeromhnia: hmeromhnia,
                kathgoria_ergasias: 'ΕΡΓ',
                apo_ora_01: current.apo_ora || '',
                eos_ora_01: current.eos_ora || '',
                apo_ora_02: '',
                eos_ora_02: '',
                apo_ora_03: '',
                eos_ora_03: ''
            };

            // Έλεγξε επόμενη γραμμή — ίδια ημερομηνία;
            if (i + 1 < rows.length) {
                const next1 = rows[i + 1];
                const next1Date = parseGRDate(next1.hmeromhnia_raw);

                if (next1Date && next1Date.getTime() === hmeromhnia.getTime()) {
                    record.apo_ora_02 = next1.apo_ora || '';
                    record.eos_ora_02 = next1.eos_ora || '';
                    i++;

                    if (i + 1 < rows.length) {
                        const next2 = rows[i + 1];
                        const next2Date = parseGRDate(next2.hmeromhnia_raw);

                        if (next2Date && next2Date.getTime() === hmeromhnia.getTime()) {
                            record.apo_ora_03 = next2.apo_ora || '';
                            record.eos_ora_03 = next2.eos_ora || '';
                            i++;
                        }
                    }
                }
            }

            bulkOps.push({
                updateOne: {
                    filter: {
                        team: ergazomenos.team,
                        company_kod: ergazomenos.company_kod,
                        kodikos: ergazomenos.kodikos,
                        hmeromhnia: hmeromhnia
                    },
                    update: { $set: record },
                    upsert: true
                }
            });

            i++;
        }

        // ΒΗΜΑ 5: ΜΙΑ κλήση στη ΒΔ
        if (bulkOps.length > 0) {
            const result = await OrariaFromCardsModel.bulkWrite(bulkOps, { ordered: false });
            console.log(
                `[saveKartesTelikoToMongo] ✅ ${result.upsertedCount} inserted, ${result.modifiedCount} updated`
            );
        }
    }
}

module.exports = erganhController;
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
        // 4α) Υπολογισμός: Δευτέρα της εβδομάδας του apoHmeromhnia
        // apoHmeromhnia: "dd/mm/yyyy"
        // ============================================================
        const [apoDay, apoMonth, apoYear] = apoHmeromhnia.split('/').map(Number);
        const apoDate = new Date(Date.UTC(apoYear, apoMonth - 1, apoDay));

        const dayOfWeek = apoDate.getUTCDay(); // 0=Κυρ, 1=Δευ, ..., 6=Σαβ

        // Δευτέρα της εβδομάδας (ή ίδια ημέρα αν Κυριακή)
        let daysToSubtract;
        if (dayOfWeek === 0) {
            daysToSubtract = 0; // Κυριακή → ίδια
        } else {
            daysToSubtract = dayOfWeek - 1; // Δευ=0, Τρι=1, ...
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
        // eosHmeromhnia: "dd/mm/yyyy"
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

        // ============================================================
        // Συμπλήρωση ημερομηνιών στη φόρμα (χωρίς '/')
        // ============================================================
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
        await page.waitForSelector('img.ExcelExport', {
            state: 'visible',
            timeout: 20000
        });

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
