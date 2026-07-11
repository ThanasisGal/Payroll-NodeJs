// module.exports = erganhController;

const mongoose = require('mongoose');

const { Builder, By, Key, until } = require('selenium-webdriver');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const fsPromises = require('fs').promises;
const PDFDocument = require('pdfkit');
const { chromium } = require('playwright');

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../../config/aws');

const { generateWTOXML } = require('../../utils/xmlGenerators/wto_v1Generator');
const { generateWtoXML, generateWTOWeekJSON } = require('../../utils/xmlGenerators/wtoGenerator');
const { generateWTOOvXML } = require('../../utils/xmlGenerators/wtoOv_v1Generator');
const { generateE7NXML, generateE7NJSON } = require('../../utils/xmlGenerators/e7N_v1Generator');
const { uploadE3ToErganh } = require('../../utils/erganh/e3Uploader');
const { uploadJsonDocumentToErgani } = require('../../utils/erganh/jsonDocumentUploader');
const {
    downloadSubmittedErganiPdfWithPlaywright
} = require('../../utils/erganh/erganiSubmittedPdfDownloader');
const { generateE3XML, generateE3NJSON } = require('../../utils/xmlGenerators/e3N_v1Generator');
const {
    compareE3NPreSubmit
} = require('../../services/ergani/e3nPreSubmitComparisonService');
const { generateMAJSON } = require('../../utils/xmlGenerators/e3_MA_v1Generator');
const { generateE5NJSON } = require('../../utils/xmlGenerators/e5N_v1Generator');
const {
    generateE6NMPXML,
    generateE6NMPJSON,
    generateE6NXPXML,
    generateE6NXPJSON,
    normalizeE6NType,
    E6N_CONFIG
} = require('../../utils/xmlGenerators/e6n_v1Generator');

async function tryGenerateE5NPdfForRest(
    ergazomenos,
    companyData,
    ypokatasthmataData,
    options = {}
) {
    // Για το WebE5N REST το f_file είναι υποχρεωτικό.
    // Προσπαθούμε να χρησιμοποιήσουμε τον υπάρχοντα PDF generator της εφαρμογής.
    // Αν δεν υπάρχει διαθέσιμος generator ή αποτύχει, αφήνουμε το generateE5NJSON()
    // να πετάξει καθαρό validation error για το f_file.
    const candidateModules = [
        '../../utils/pdfGenerators/e5nTemplatePdfGenerator',
        '../../utils/pdfGenerators/E5NTemplatePdfGenerator',
        '../../utils/pdfGenerators/e5NPdfGenerator',
        '../../utils/pdfGenerators/e5nPdfGenerator'
    ];

    for (const modulePath of candidateModules) {
        try {
            const mod = require(modulePath);
            const generateE5NPdf =
                mod.generateE5NPdf ||
                mod.generateE5NTemplatePdf ||
                mod.generatePdf ||
                mod.default ||
                (typeof mod === 'function' ? mod : null);

            if (typeof generateE5NPdf !== 'function') continue;

            console.log('[submitE5NToErganh] Δημιουργία PDF Ε5Ν με:', modulePath);
            const result = await generateE5NPdf(
                ergazomenos,
                companyData,
                ypokatasthmataData,
                options
            );

            const pdfPath =
                result?.s3Key ||
                result?.s3_key ||
                result?.relativePath ||
                result?.relative_path ||
                result?.path ||
                result?.pdfPath ||
                result?.pdf_path ||
                result?.key ||
                '';

            const pdfBase64 = result?.base64 || result?.pdfBase64 || result?.pdf_base64 || '';

            if (pdfPath || pdfBase64) {
                return { pdfPath, pdfBase64, result };
            }
        } catch (error) {
            if (error?.code === 'MODULE_NOT_FOUND') continue;
            console.error('[submitE5NToErganh] Αποτυχία δημιουργίας PDF Ε5Ν:', error.message);
            throw error;
        }
    }

    return { pdfPath: '', pdfBase64: '', result: null };
}

const {
    authenticateErgani,
    logoutErgani,
    getSubmissionDocument,
    cancelSubmittedDocument
} = require('../../utils/erganh/erganiRestClient');
const phaseDetectorService = require('../../services/kinhseis/phaseDetectorService');
const {
    buildApasxoliseisScenarioFacts
} = require('../../services/ergazomenoi/apasxoliseisScenarioFactsService');
const {
    matchApasxoliseisScenarioFacts
} = require('../../services/ergazomenoi/apasxoliseisScenarioMatcherService');
const {
    getApasxoliseisPolicyCatalog: getApasxoliseisPolicyCatalogDefinitions,
    getPolicyResultStatuses,
    getPolicyModes,
    validateApasxoliseisPolicyCatalog,
    POLICY_CATEGORIES
} = require('../../services/ergazomenoi/apasxoliseisPolicyCatalogService');
const {
    buildApasxoliseisPolicyPreviewRows,
    summarizeApasxoliseisPolicyPreviewResults
} = require('../../services/ergazomenoi/apasxoliseisPolicyPreviewService');
const {
    buildApasxoliseisPolicyPreviewGrouping
} = require('../../services/ergazomenoi/apasxoliseisPolicyPreviewGroupingService');
const {
    createPolicyPreviewApprovalRecord,
    listPolicyPreviewApprovalRecords
} = require('../../services/ergazomenoi/apasxoliseisPolicyPreviewApprovalService');

const Models_A = require('../../models/stathera_arxeia');
const Models_B = require('../../models/privileges');
const Models_C = require('../../models/companies');
const Models_D = require('../../models/ergazomenoi');

const { ArgiesModel, PeriodsModel } = Models_A;

const { UserPrivilegesModel } = Models_B;

const { CompaniesModel, PasswordsModel, YpokatasthmataModel } = Models_C;

const {
    ErgazomenoiModel,
    // Ιστορικό προσλήψεων/αλλαγών.
    // Χρησιμοποιείται στον υπολογισμό απασχολήσεων ώστε κάθε ημερομηνία
    // να διαβάζει τους όρους εργασίας που ίσχυαν τότε και όχι μόνο
    // την τρέχουσα εικόνα του εργαζόμενου.
    IstorikoProslhpseonAllagonModel,
    OrariaFromErganhModel,
    OrariaFromCardsModel,
    OrariaApologistikaModel,
    ProdhlomenaOrariaModel,
    ProdhlomenaOrariaDeviationsModel,
    ProdhlomenaOrariaAuditModel,
    ErgazomenoiErganhModel
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

function timeToMinutesSafe(time) {
    if (!time) return null;

    const s = String(time).trim();
    if (!/^\d{2}:\d{2}$/.test(s)) return null;

    const [hh, mm] = s.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;

    return hh * 60 + mm;
}

function minutesToTimeSafe(totalMinutes) {
    if (totalMinutes === null || totalMinutes === undefined) return '';

    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const hh = Math.floor(normalized / 60);
    const mm = normalized % 60;

    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function durationMinutesSafe(apoOra, eosOra) {
    const apo = timeToMinutesSafe(apoOra);
    const eos = timeToMinutesSafe(eosOra);

    if (apo === null || eos === null) return 0;

    let diff = eos - apo;
    if (diff < 0) diff += 1440;

    return diff;
}

function calculateNightMinutes(apoOra, eosOra) {
    const apo = timeToMinutesSafe(apoOra);
    const eos = timeToMinutesSafe(eosOra);

    if (apo === null || eos === null) return 0;

    let start = apo;
    let end = eos;

    if (end <= start) {
        end += 1440;
    }

    let totalNightMinutes = 0;

    for (let minute = start; minute < end; minute++) {
        const currentMinute = minute % 1440;

        const isNight = currentMinute >= 22 * 60 || currentMinute < 6 * 60;

        if (isNight) {
            totalNightMinutes++;
        }
    }

    return totalNightMinutes;
}

function checkEarlyOrLateCard(context, pairNo) {
    const { rec, proorhProseleyshMinutes, evelikthProselefshMinutes } = context;

    const apoField = `apo_ora_0${pairNo}`;
    const eosField = `eos_ora_0${pairNo}`;
    const cardApoField = `cards_apo_ora_0${pairNo}`;
    const apoApologField = `apo_ora_0${pairNo}_apologistika`;
    const eosApologField = `eos_ora_0${pairNo}_apologistika`;

    const cardApo = timeToMinutesSafe(rec[cardApoField]);
    const programApo = timeToMinutesSafe(rec[apoField]);

    if (cardApo === null || programApo === null) return {};

    const earlyLimit = programApo - proorhProseleyshMinutes;
    const lateLimit = programApo + evelikthProselefshMinutes;

    if (cardApo < earlyLimit || cardApo > lateLimit) {
        const programDuration = durationMinutesSafe(rec[apoField], rec[eosField]);
        const apologistikoEos = minutesToTimeSafe(cardApo + programDuration);

        return {
            apologistiko_biblio: true,
            [apoApologField]: rec[cardApoField] || '',
            [eosApologField]: apologistikoEos
        };
    }

    return {};
}

// ============================================================
// Ανακατασκευή απολογιστικού όταν υπάρχει ελλιπές ζεύγος κάρτας
// αλλά υπάρχει προδηλωμένο ωράριο για το ίδιο ζεύγος.
//
// Περιπτώσεις:
// 1) Λείπει cards_apo_ora_NN, υπάρχει cards_eos_ora_NN:
//    apo_ora_NN_apologistika = apo_ora_NN
//    eos_ora_NN_apologistika = cards_eos_ora_NN
//
// 2) Υπάρχει cards_apo_ora_NN, λείπει cards_eos_ora_NN:
//    apo_ora_NN_apologistika = cards_apo_ora_NN
//    eos_ora_NN_apologistika = eos_ora_NN
//
// Σημείωση:
// Το cards_ores_ergasias πρέπει να είναι η ΘΕΤΙΚΗ διάρκεια του
// ανακατασκευασμένου χρόνου εργασίας. Δηλαδή:
//    eos - apo
// και όχι apo - eos ή ores_ergasias - (eos - apo).
// Αλλιώς παράγονται αρνητικά/λανθασμένα αποτελέσματα.
// ============================================================
function checkIncompleteCardPairAgainstDeclared(context) {
    const { rec } = context;

    const update = {
        apo_ora_01_apologistika: rec.apo_ora_01_apologistika || '',
        eos_ora_01_apologistika: rec.eos_ora_01_apologistika || '',
        apo_ora_02_apologistika: rec.apo_ora_02_apologistika || '',
        eos_ora_02_apologistika: rec.eos_ora_02_apologistika || '',
        apo_ora_03_apologistika: rec.apo_ora_03_apologistika || '',
        eos_ora_03_apologistika: rec.eos_ora_03_apologistika || ''
    };

    let changed = false;

    for (let pairNo = 1; pairNo <= 3; pairNo++) {
        const p = String(pairNo).padStart(2, '0');

        const declaredApoField = `apo_ora_${p}`;
        const declaredEosField = `eos_ora_${p}`;
        const cardApoField = `cards_apo_ora_${p}`;
        const cardEosField = `cards_eos_ora_${p}`;
        const apoApologField = `apo_ora_${p}_apologistika`;
        const eosApologField = `eos_ora_${p}_apologistika`;

        const declaredApo = rec[declaredApoField];
        const declaredEos = rec[declaredEosField];
        const cardApo = rec[cardApoField];
        const cardEos = rec[cardEosField];

        const hasDeclaredApo = hasTime(declaredApo);
        const hasDeclaredEos = hasTime(declaredEos);
        const hasCardApo = hasTime(cardApo);
        const hasCardEos = hasTime(cardEos);

        // Χωρίς πλήρες προδηλωμένο ζεύγος δεν μπορούμε να ανακατασκευάσουμε ασφαλώς.
        if (!hasDeclaredApo || !hasDeclaredEos) continue;

        // Διάρκεια του συγκεκριμένου προδηλωμένου ζεύγους.
        // Παράδειγμα 16:00 - 00:00 => 8 ώρες.
        const declaredPairMinutes = durationMinutesSafe(declaredApo, declaredEos);
        if (declaredPairMinutes <= 0) continue;

        // ============================================================
        // Λείπει η είσοδος κάρτας, υπάρχει έξοδος.
        //
        // apo_ora_NN_apologistika = cards_eos_ora_NN - προδηλωμένη διάρκεια
        // eos_ora_NN_apologistika = cards_eos_ora_NN
        //
        // Παράδειγμα:
        // Προδηλωμένο 16:00 - 00:00 = 8 ώρες
        // Κάρτα: - 23:58
        // Απολογιστικό: 15:58 - 23:58
        // ============================================================
        if (!hasCardApo && hasCardEos) {
            const cardEosMinutes = timeToMinutesSafe(cardEos);
            if (cardEosMinutes === null) continue;

            update[apoApologField] = minutesToTimeSafe(cardEosMinutes - declaredPairMinutes);
            update[eosApologField] = cardEos;

            changed = true;
            continue;
        }

        // ============================================================
        // Υπάρχει είσοδος κάρτας, λείπει η έξοδος.
        //
        // apo_ora_NN_apologistika = cards_apo_ora_NN
        // eos_ora_NN_apologistika = cards_apo_ora_NN + προδηλωμένη διάρκεια
        //
        // Παράδειγμα:
        // Προδηλωμένο 16:00 - 00:00 = 8 ώρες
        // Κάρτα: 16:02 -
        // Απολογιστικό: 16:02 - 00:02
        // ============================================================
        if (hasCardApo && !hasCardEos) {
            const cardApoMinutes = timeToMinutesSafe(cardApo);
            if (cardApoMinutes === null) continue;

            update[apoApologField] = cardApo;
            update[eosApologField] = minutesToTimeSafe(cardApoMinutes + declaredPairMinutes);

            changed = true;
        }
    }

    if (!changed) return {};

    const apologistikaMinutes =
        durationMinutesSafe(update.apo_ora_01_apologistika, update.eos_ora_01_apologistika) +
        durationMinutesSafe(update.apo_ora_02_apologistika, update.eos_ora_02_apologistika) +
        durationMinutesSafe(update.apo_ora_03_apologistika, update.eos_ora_03_apologistika);

    return {
        apologistiko_biblio: true,
        ...update,

        // Για ελλιπές ζεύγος κάρτας, αφού ανακατασκευάζουμε απολογιστικό
        // ίσης διάρκειας με το προδηλωμένο ζεύγος, οι ώρες καρτών της ημέρας
        // δεν πρέπει να μένουν 0.00 ούτε να γίνονται αρνητικές.
        cards_ores_ergasias: toHours(apologistikaMinutes),
        ores_ergasias_apologistika: toHours(apologistikaMinutes)
    };
}

function hasTime(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

function getRawDeclaredIntervals(rec) {
    return [
        {
            index: 1,
            apo: rec.apo_ora_01,
            eos: rec.eos_ora_01
        },
        {
            index: 2,
            apo: rec.apo_ora_02,
            eos: rec.eos_ora_02
        },
        {
            index: 3,
            apo: rec.apo_ora_03,
            eos: rec.eos_ora_03
        }
    ]
        .map((interval) => {
            const expanded = expandIntervalFromTimes(interval.apo, interval.eos);

            if (!expanded) return null;

            return {
                ...interval,
                start: expanded.start,
                end: expanded.end
            };
        })
        .filter(Boolean);
}

function checkBrokenProgramVsBrokenCards(context) {
    const { rec, proorhProseleyshMinutes, evelikthProselefshMinutes } = context;

    const declaredIntervals = getRawDeclaredIntervals(rec);
    const cardIntervals = getRawCardIntervals(rec);

    if (declaredIntervals.length <= 1 || cardIntervals.length <= 1) return {};

    const cardIntervalsByIndex = new Map(cardIntervals.map((interval) => [interval.index, interval]));
    const matchedIntervals = [];

    for (const declaredInterval of declaredIntervals) {
        const cardInterval = cardIntervalsByIndex.get(declaredInterval.index);

        if (!cardInterval) continue;

        matchedIntervals.push({
            declaredInterval,
            cardInterval
        });
    }

    if (matchedIntervals.length <= 1) return {};

    const hasDeviation = matchedIntervals.some(({ declaredInterval, cardInterval }) => {
        const earlyLimit = declaredInterval.start - proorhProseleyshMinutes;
        const lateStartLimit = declaredInterval.start + evelikthProselefshMinutes;

        return (
            cardInterval.start < earlyLimit ||
            cardInterval.start > lateStartLimit ||
            cardInterval.end > declaredInterval.end
        );
    });

    if (!hasDeviation) return {};

    const update = {
        apologistiko_biblio: true,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: ''
    };

    for (const { declaredInterval, cardInterval } of matchedIntervals) {
        const p = String(declaredInterval.index).padStart(2, '0');
        const apoApologField = `apo_ora_${p}_apologistika`;
        const eosApologField = `eos_ora_${p}_apologistika`;
        const declaredDuration = Math.max(0, declaredInterval.end - declaredInterval.start);
        const earlyLimit = declaredInterval.start - proorhProseleyshMinutes;
        const lateStartLimit = declaredInterval.start + evelikthProselefshMinutes;
        const segmentNeedsDurationAnchor =
            cardInterval.start < earlyLimit ||
            cardInterval.start > lateStartLimit ||
            cardInterval.end > declaredInterval.end;

        update[apoApologField] = cardInterval.apo || '';
        update[eosApologField] = segmentNeedsDurationAnchor
            ? minutesToTimeSafe(cardInterval.start + declaredDuration)
            : cardInterval.eos || '';
    }

    return update;
}

function checkContinuousVsBrokenCards(context) {
    const { rec } = context;

    const programIsContinuous =
        hasTime(rec.apo_ora_01) &&
        hasTime(rec.eos_ora_01) &&
        !hasTime(rec.apo_ora_02) &&
        !hasTime(rec.eos_ora_02) &&
        !hasTime(rec.apo_ora_03) &&
        !hasTime(rec.eos_ora_03);

    const cardsAreBroken =
        hasTime(rec.cards_apo_ora_01) &&
        hasTime(rec.cards_eos_ora_01) &&
        hasTime(rec.cards_apo_ora_02) &&
        hasTime(rec.cards_eos_ora_02);

    if (!programIsContinuous || !cardsAreBroken) return {};

    const totalProgramMinutes = Math.round((Number(rec.ores_ergasias) || 0) * 60);

    const card1Minutes = durationMinutesSafe(rec.cards_apo_ora_01, rec.cards_eos_ora_01);
    const card2Minutes = durationMinutesSafe(rec.cards_apo_ora_02, rec.cards_eos_ora_02);

    const hasThirdCard = hasTime(rec.cards_apo_ora_03) && hasTime(rec.cards_eos_ora_03);

    const update = {
        apologistiko_biblio: true,
        apo_ora_01_apologistika: rec.cards_apo_ora_01 || '',
        eos_ora_01_apologistika: rec.cards_eos_ora_01 || '',
        apo_ora_02_apologistika: rec.cards_apo_ora_02 || ''
    };

    if (!hasThirdCard) {
        const remainingMinutes = totalProgramMinutes - card1Minutes;
        const card2Start = timeToMinutesSafe(rec.cards_apo_ora_02);

        update.eos_ora_02_apologistika =
            card2Start === null ? '' : minutesToTimeSafe(card2Start + remainingMinutes);

        update.apo_ora_03_apologistika = '';
        update.eos_ora_03_apologistika = '';

        return update;
    }

    update.eos_ora_02_apologistika = rec.cards_eos_ora_02 || '';
    update.apo_ora_03_apologistika = rec.cards_apo_ora_03 || '';

    const remainingMinutes = totalProgramMinutes - (card1Minutes + card2Minutes);
    const card3Start = timeToMinutesSafe(rec.cards_apo_ora_03);

    update.eos_ora_03_apologistika =
        card3Start === null ? '' : minutesToTimeSafe(card3Start + remainingMinutes);

    return update;
}

function checkBrokenProgramVsContinuousCards(context) {
    const { rec } = context;

    const programIsBroken =
        hasTime(rec.apo_ora_01) &&
        hasTime(rec.eos_ora_01) &&
        hasTime(rec.apo_ora_02) &&
        hasTime(rec.eos_ora_02);

    const cardsAreContinuous =
        hasTime(rec.cards_apo_ora_01) &&
        hasTime(rec.cards_eos_ora_01) &&
        !hasTime(rec.cards_apo_ora_02) &&
        !hasTime(rec.cards_eos_ora_02) &&
        !hasTime(rec.cards_apo_ora_03) &&
        !hasTime(rec.cards_eos_ora_03);

    if (!programIsBroken || !cardsAreContinuous) return {};

    const totalProgramMinutes = getDailyDeclaredMinutes(rec);
    const card1Start = timeToMinutesSafe(rec.cards_apo_ora_01);

    if (card1Start === null || totalProgramMinutes <= 0) return {};

    return {
        apologistiko_biblio: true,
        apo_ora_01_apologistika: rec.cards_apo_ora_01 || '',
        eos_ora_01_apologistika: minutesToTimeSafe(card1Start + totalProgramMinutes),
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: ''
    };
}

function getEmployeeDailyAverageMinutes(ergazomenos) {
    if (!ergazomenos) return 8 * 60;

    const raw =
        ergazomenos.mo_oron_hmerhsias_ergasias ??
        ergazomenos.m_o_hmerhsias_ergasias ??
        ergazomenos.mesos_oros_hmerhsias_ergasias ??
        ergazomenos.ores_ergasias ??
        8;

    if (typeof raw === 'string') {
        const trimmed = raw.trim();

        if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
            const [hh, mm] = trimmed.split(':').map(Number);
            return hh * 60 + mm;
        }

        const normalized = trimmed.replace(',', '.');
        const numeric = Number(normalized);

        if (!Number.isNaN(numeric) && numeric > 0) {
            return Math.round(numeric * 60);
        }
    }

    const numeric = Number(raw);

    if (!Number.isNaN(numeric) && numeric > 0) {
        return Math.round(numeric * 60);
    }

    return 8 * 60;
}

function hasDeclaredSchedule(rec) {
    return (
        hasTime(rec.apo_ora_01) ||
        hasTime(rec.eos_ora_01) ||
        hasTime(rec.apo_ora_02) ||
        hasTime(rec.eos_ora_02) ||
        hasTime(rec.apo_ora_03) ||
        hasTime(rec.eos_ora_03)
    );
}

function hasCardPairAny(rec, pairNo) {
    const p = String(pairNo).padStart(2, '0');

    return hasTime(rec[`cards_apo_ora_${p}`]) || hasTime(rec[`cards_eos_ora_${p}`]);
}

function absoluteMinuteAfter(referenceMinute, timeValue) {
    const minute = timeToMinutesSafe(timeValue);

    if (minute === null) return null;

    let absoluteMinute = minute;

    while (absoluteMinute <= referenceMinute) {
        absoluteMinute += 1440;
    }

    return absoluteMinute;
}

function checkNoDeclaredScheduleCards(context) {
    const { rec, ergazomenos } = context;

    if (hasDeclaredSchedule(rec)) return {};

    const hasPair1 = hasCardPairAny(rec, 1);
    const hasPair2 = hasCardPairAny(rec, 2);
    const hasPair3 = hasCardPairAny(rec, 3);

    if (!hasPair1 || hasPair3) return {};

    const dailyAverageMinutes = getEmployeeDailyAverageMinutes(ergazomenos);

    if (dailyAverageMinutes <= 0) return {};

    const update = {
        apologistiko_biblio: true,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: ''
    };

    const card1Start = timeToMinutesSafe(rec.cards_apo_ora_01);
    const card1End = timeToMinutesSafe(rec.cards_eos_ora_01);

    // A1: υπάρχει μόνο 1ο ζεύγος καρτών.
    if (!hasPair2) {
        if (card1Start !== null) {
            update.apo_ora_01_apologistika = minutesToTimeSafe(card1Start);
            update.eos_ora_01_apologistika = minutesToTimeSafe(card1Start + dailyAverageMinutes);
            return update;
        }

        if (card1End !== null) {
            update.apo_ora_01_apologistika = minutesToTimeSafe(card1End - dailyAverageMinutes);
            update.eos_ora_01_apologistika = minutesToTimeSafe(card1End);
            return update;
        }

        return {};
    }

    // B1: υπάρχουν 1ο και 2ο ζεύγος καρτών, χωρίς 3ο.
    // Η λογική αυτή εφαρμόζεται μόνο όταν το 1ο ζεύγος είναι πλήρες.
    if (card1Start === null || card1End === null) {
        return {};
    }

    let card1EndAbs = card1End;

    if (card1EndAbs <= card1Start) {
        card1EndAbs += 1440;
    }

    const firstPairMinutes = Math.max(0, card1EndAbs - card1Start);
    const remainingMinutes = Math.max(0, dailyAverageMinutes - firstPairMinutes);

    update.apo_ora_01_apologistika = minutesToTimeSafe(card1Start);
    update.eos_ora_01_apologistika = minutesToTimeSafe(card1EndAbs);

    if (remainingMinutes <= 0) {
        return update;
    }

    const card2Start = timeToMinutesSafe(rec.cards_apo_ora_02);
    const card2EndRaw = timeToMinutesSafe(rec.cards_eos_ora_02);

    // B1α: αν υπάρχει έναρξη στο 2ο ζεύγος, κρατάμε την έναρξη και συμπληρώνουμε το υπόλοιπο.
    if (card2Start !== null) {
        let card2StartAbs = card2Start;

        while (card2StartAbs <= card1EndAbs) {
            card2StartAbs += 1440;
        }

        update.apo_ora_02_apologistika = minutesToTimeSafe(card2StartAbs);
        update.eos_ora_02_apologistika = minutesToTimeSafe(card2StartAbs + remainingMinutes);

        return update;
    }

    // B1β: αν υπάρχει μόνο αποχώρηση στο 2ο ζεύγος, γυρίζουμε προς τα πίσω.
    if (card2EndRaw !== null) {
        const card2EndAbs = absoluteMinuteAfter(card1EndAbs, rec.cards_eos_ora_02);

        if (card2EndAbs === null) return update;

        let card2StartAbs = card2EndAbs - remainingMinutes;
        let finalCard2EndAbs = card2EndAbs;

        // Αν το κενό μεταξύ 1ου τέλους και 2ης έναρξης δεν είναι > 3h,
        // πιέζουμε την 2η έναρξη στο 1ο τέλος + 3h και ξαναϋπολογίζουμε τη 2η λήξη.
        if (card2StartAbs - card1EndAbs <= 3 * 60) {
            card2StartAbs = card1EndAbs + 3 * 60;
            finalCard2EndAbs = card2StartAbs + remainingMinutes;
        }

        update.apo_ora_02_apologistika = minutesToTimeSafe(card2StartAbs);
        update.eos_ora_02_apologistika = minutesToTimeSafe(finalCard2EndAbs);

        return update;
    }

    return update;
}

function checkNightHours(context) {
    const { rec, ergazomenos } = context;

    let totalNightMinutes = 0;

    for (const interval of getPayrollCalculationIntervals(rec, ergazomenos)) {
        for (let minute = interval.start; minute < interval.end; minute++) {
            if (isMinuteNight(minute)) {
                totalNightMinutes++;
            }
        }
    }

    return {
        ores_nyxtas_apologistika: +(totalNightMinutes / 60).toFixed(2)
    };
}

function addDaysUtc(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function dateKeyUtc(date) {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate()
    ).padStart(2, '0')}`;
}

function isSundayOrHoliday(date, argiesDateSet) {
    const d = new Date(date);

    // Κυριακή σε UTC
    const isSunday = d.getUTCDay() === 0;

    // Αργία από ArgiesModel
    const isHoliday = argiesDateSet.has(dateKeyUtc(d));

    return isSunday || isHoliday;
}

function calculateSundayHolidayMinutesForInterval(baseDate, apoOra, eosOra, argiesDateSet) {
    const apo = timeToMinutesSafe(apoOra);
    const eos = timeToMinutesSafe(eosOra);

    if (apo === null || eos === null) return 0;

    let start = apo;
    let end = eos;

    // Αν περνάει μεσάνυχτα
    if (end <= start) {
        end += 1440;
    }

    let totalMinutes = 0;

    // Κομμάτι 1: τρέχουσα ημερομηνία, από start μέχρι max 24:00
    const firstDayMinutes = Math.max(0, Math.min(end, 1440) - start);
    if (firstDayMinutes > 0 && isSundayOrHoliday(baseDate, argiesDateSet)) {
        totalMinutes += firstDayMinutes;
    }

    // Κομμάτι 2: επόμενη ημερομηνία, από 00:00 μέχρι end αν end > 24:00
    const secondDayMinutes = Math.max(0, end - 1440);
    if (secondDayMinutes > 0) {
        const nextDate = addDaysUtc(baseDate, 1);
        if (isSundayOrHoliday(nextDate, argiesDateSet)) {
            totalMinutes += secondDayMinutes;
        }
    }

    return totalMinutes;
}

function calculateSundayHolidayMinutesForRange(baseDate, start, end, argiesDateSet) {
    let totalMinutes = 0;

    for (let minute = start; minute < end; minute++) {
        if (isMinuteSundayOrHoliday(baseDate, minute, argiesDateSet)) {
            totalMinutes++;
        }
    }

    return totalMinutes;
}

function checkSundayHolidayHours(context) {
    const { rec, ergazomenos, argiesDateSet } = context;

    const isCurrentDateSunday = new Date(rec.hmeromhnia).getUTCDay() === 0;

    let cardHolidayMinutes = 0;

    for (const interval of getPayrollCalculationIntervals(rec, ergazomenos)) {
        cardHolidayMinutes += calculateSundayHolidayMinutesForRange(
            rec.hmeromhnia,
            interval.start,
            interval.end,
            argiesDateSet
        );
    }

    const hasDeclaredSchedule =
        hasTime(rec.apo_ora_01) ||
        hasTime(rec.eos_ora_01) ||
        hasTime(rec.apo_ora_02) ||
        hasTime(rec.eos_ora_02) ||
        hasTime(rec.apo_ora_03) ||
        hasTime(rec.eos_ora_03);

    const holidayHours = +(cardHolidayMinutes / 60).toFixed(2);

    return {
        ores_argion_prosayxhsh_apologistika: hasDeclaredSchedule ? holidayHours : 0,
        ores_argion_ergasia_apologistika: hasDeclaredSchedule ? 0 : holidayHours,
        kyriakes_apologistika: isCurrentDateSunday
    };
}

function checkRepoAdeiaAstheneiaApologistika(context) {
    const { rec } = context;

    const declaredHours = Number(rec.ores_ergasias || 0);
    const cardsHours = Number(rec.cards_ores_ergasias || 0);

    const update = {
        astheneia_apologistika: false
    };

    // ΡΕΠΟ / ΜΗ ΕΡΓΑΣΙΑ και δεν υπάρχουν κάρτες
    if ((rec.repo === true || declaredHours === 0) && cardsHours === 0) {
        update.repo_apologistika = true;
        update.adeia_apologistika = false;
        update.kathgoria_adeias_apologistika = '';
        return update;
    }

    // Έχει προδηλωμένη εργασία αλλά δεν υπάρχουν κάρτες
    if (declaredHours !== 0 && cardsHours === 0) {
        update.repo_apologistika = false;
        update.adeia_apologistika = true;
        update.kathgoria_adeias_apologistika = 'ΑΔΑΛ';
        return update;
    }

    // Κανονικά είχε κάρτες
    update.repo_apologistika = false;
    update.adeia_apologistika = false;
    update.kathgoria_adeias_apologistika = '';

    return update;
}

function canReviewEdit(req) {
    const userRole = String(req.session?.userRole || '')
        .trim()
        .toUpperCase();

    return userRole === 'A' || userRole === 'S';
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

function startOfWeekSundayUtc(date) {
    const d = new Date(date);
    const day = d.getUTCDay(); // Κυριακή = 0
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - day);
    return d;
}

function isDateInsideRange(date, fromDate, toDate) {
    const d = new Date(date).getTime();
    return d >= fromDate.getTime() && d <= toDate.getTime();
}

function getWeekKeySunday(date) {
    return dateKeyUtc(startOfWeekSundayUtc(date));
}

function endOfWeekSaturdayUtc(date) {
    const start = startOfWeekSundayUtc(date);
    const end = addDaysUtc(start, 6);
    end.setUTCHours(23, 59, 59, 999);
    return end;
}

function clampDateStartUtc(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function clampDateEndUtc(date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

function isZeroHours(value) {
    const num = Number(value || 0);
    return !Number.isFinite(num) || Math.abs(num) < 0.000001;
}

function isNonZeroHours(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) && Math.abs(num) >= 0.000001;
}

function isNoCardDeclaredWorkRow(row = {}) {
    return (
        String(row.kathgoria_ergasias || '').trim() === 'ΕΡΓ' &&
        isNonZeroHours(row.ores_ergasias) &&
        isZeroHours(row.cards_ores_ergasias)
    );
}

function getCompanyHolidayFlags(company = {}) {
    return {
        apasxolhsh_kata_tis_argies: company?.apasxolhsh_kata_tis_argies === true,
        leitoyrgia_stis_mh_ypoxreotikes_argies:
            company?.leitoyrgia_stis_mh_ypoxreotikes_argies === true
    };
}

function buildArgiesByDateKey(argies = []) {
    const map = new Map();

    for (const argia of argies) {
        if (!argia?.hmeromhnia) continue;
        map.set(dateKeyUtc(argia.hmeromhnia), {
            ypoxreotikh_argia: argia.ypoxreotikh_argia === true,
            description: String(argia.perigrafh || argia.perigrafh_argias || '').trim()
        });
    }

    return map;
}

function isMisthotosEmployee(row = {}) {
    return String(row.typos_ergazomenon || '').trim() === 'Μ';
}

function resolveNoCardsDisplayStatus(row = {}, { argiesByDateKey = new Map(), companyFlags = {} } = {}) {
    if (!isNoCardDeclaredWorkRow(row)) return '';

    const argia = argiesByDateKey.get(dateKeyUtc(row.hmeromhnia));
    if (!argia) return 'ΑΔΕΙΑ';

    if (argia.ypoxreotikh_argia === true) {
        return companyFlags.apasxolhsh_kata_tis_argies === true ? 'ΑΔΕΙΑ' : 'ΑΡΓΙΑ';
    }

    return companyFlags.leitoyrgia_stis_mh_ypoxreotikes_argies === true ? 'ΑΔΕΙΑ' : 'ΑΡΓΙΑ';
}

async function buildNoCardsDisplayContext({
    team,
    companyId,
    companyKodikos,
    etos,
    periodStart,
    periodEnd
}) {
    const trimmedCompanyId = String(companyId || '').trim();
    const companyQuery = mongoose.Types.ObjectId.isValid(trimmedCompanyId)
        ? { _id: trimmedCompanyId }
        : { kod: trimmedCompanyId };
    const company = trimmedCompanyId
        ? await CompaniesModel.findOne(companyQuery)
              .select('kod apasxolhsh_kata_tis_argies leitoyrgia_stis_mh_ypoxreotikes_argies')
              .lean()
        : null;
    const resolvedCompanyKodikos = String(companyKodikos || company?.kod || '').trim();
    const argies = resolvedCompanyKodikos
        ? await ArgiesModel.find({
              team,
              company_kod: resolvedCompanyKodikos,
              etos: String(etos || ''),
              hmeromhnia: mongoose.trusted({
                  $gte: periodStart,
                  $lte: periodEnd
              })
          })
              .select('hmeromhnia ypoxreotikh_argia perigrafh perigrafh_argias')
              .lean()
        : [];

    return {
        companyFlags: getCompanyHolidayFlags(company),
        argiesByDateKey: buildArgiesByDateKey(argies)
    };
}

function getExpectedWeeklyRepo(ergazomenos) {
    const raw = ergazomenos?.mhniaia_repo;
    const parsed = Number(raw ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isFullTimeWorkTerms(workTerms = {}) {
    const typos = String(workTerms.typos_apasxolhshs ?? '')
        .trim()
        .toUpperCase();

    if (typos === '0' || typos === 'PLHRHS' || typos === 'ΠΛΗΡΗΣ') {
        return true;
    }

    if (typos === '1' || typos === '2' || typos === 'MERIKH' || typos === 'EK_PERITROPHS') {
        return false;
    }

    const weeklyHours = Number(workTerms.ores_ergasias_ebdomadas || 0);
    return weeklyHours >= 40;
}

function asDateOnlyUtc(value, endOfDay = false) {
    const d = new Date(value);
    if (endOfDay) {
        d.setUTCHours(23, 59, 59, 999);
    } else {
        d.setUTCHours(0, 0, 0, 0);
    }
    return d;
}

function getEffectiveKathgoriaErgasias(row) {
    const apologistika = String(row?.kathgoria_ergasias_apologistika || '').trim();
    if (apologistika !== '') return apologistika;
    return String(row?.kathgoria_ergasias || '').trim();
}

function getEffectiveRepoProfileForDate(date, istorikoRows = [], ergazomenos = {}) {
    return getOrarioTermsForDate(date, istorikoRows, ergazomenos);
}

function getProfileSignature(profile = {}) {
    return [
        profile.source || '',
        profile.istorikoId ? String(profile.istorikoId) : '',
        String(profile.mhniaia_repo ?? ''),
        String(profile.typos_apasxolhshs ?? ''),
        String(profile.hmeres_ergasias_ebdomadas ?? ''),
        String(profile.ores_ergasias_ebdomadas ?? '')
    ].join('|');
}

function getProfileDateForDeviation(profile = {}, fallbackDate = null) {
    return (
        normalizeDateOnlyForCalc(profile.hmeromhnia_isxyos_oron_ergasias_apo) ||
        normalizeDateOnlyForCalc(profile.hmeromhnia_allaghs_orarioy_apo) ||
        normalizeDateOnlyForCalc(profile.hmeromhnia_allaghs_symbashs) ||
        normalizeDateOnlyForCalc(fallbackDate)
    );
}

function getWeeklyRepoProfileInfo({ week, istorikoRows = [], ergazomenos = {} }) {
    const signatures = new Set();
    const profiles = [];

    // Κανόνας σπασμένης εβδομάδας:
    // Για εβδομάδα Κυριακή-Σάββατο που έχει αλλαγή όρων εργασίας μέσα της,
    // ΔΕΝ κάνουμε αναλογικό υπολογισμό. Υπερισχύει το profile που ισχύει
    // στο τέλος της φυσικής εβδομάδας, δηλαδή το Σάββατο.
    const saturdayOfWeek = week.naturalWeekEnd || endOfWeekSaturdayUtc(week.weekStart);

    for (
        let day = clampDateStartUtc(week.weekStart);
        day.getTime() <= week.weekEnd.getTime();
        day = addDaysUtc(day, 1)
    ) {
        const profile = getEffectiveRepoProfileForDate(day, istorikoRows, ergazomenos);
        const signature = getProfileSignature(profile);
        signatures.add(signature);
        profiles.push({ day: new Date(day), profile, signature });
    }

    const firstProfile =
        profiles.length > 0
            ? profiles[0].profile
            : getEffectiveRepoProfileForDate(week.weekStart, istorikoRows, ergazomenos);

    const profileOfSaturday = getEffectiveRepoProfileForDate(
        saturdayOfWeek,
        istorikoRows,
        ergazomenos
    );

    const lastProfileInsidePeriod =
        profiles.length > 0
            ? profiles[profiles.length - 1].profile
            : getEffectiveRepoProfileForDate(week.weekEnd, istorikoRows, ergazomenos);

    const effectiveProfile = week.isFullWeek ? profileOfSaturday : lastProfileInsidePeriod;
    const firstSignature = getProfileSignature(firstProfile);
    const saturdaySignature = getProfileSignature(profileOfSaturday);

    return {
        expectedWeeklyRepo: getExpectedWeeklyRepo(effectiveProfile),
        profileChangedInsideWeek: signatures.size > 1 || firstSignature !== saturdaySignature,
        effectiveProfile,
        effectiveProfileDate: getProfileDateForDeviation(effectiveProfile, saturdayOfWeek),
        previousProfile: firstProfile,
        previousProfileDate: getProfileDateForDeviation(firstProfile, week.weekStart)
    };
}
function getWeekRangesInsidePeriod(apoDate, eosDate) {
    const periodStart = clampDateStartUtc(apoDate);
    const periodEnd = clampDateEndUtc(eosDate);
    const ranges = [];

    let cursor = startOfWeekSundayUtc(periodStart);

    while (cursor.getTime() <= periodEnd.getTime()) {
        const naturalWeekStart = startOfWeekSundayUtc(cursor);
        const naturalWeekEnd = endOfWeekSaturdayUtc(cursor);

        const weekStart =
            naturalWeekStart.getTime() < periodStart.getTime() ? periodStart : naturalWeekStart;
        const weekEnd = naturalWeekEnd.getTime() > periodEnd.getTime() ? periodEnd : naturalWeekEnd;

        const isFullWeek =
            dateKeyUtc(weekStart) === dateKeyUtc(naturalWeekStart) &&
            dateKeyUtc(weekEnd) === dateKeyUtc(naturalWeekEnd) &&
            weekStart.getUTCDay() === 0 &&
            weekEnd.getUTCDay() === 6;

        ranges.push({
            naturalWeekStart,
            naturalWeekEnd,
            weekStart,
            weekEnd,
            isFullWeek
        });

        cursor = addDaysUtc(naturalWeekStart, 7);
    }

    return ranges;
}

async function runWeeklyRepoPostCheck({
    sessionTeam,
    companyId,
    apoDate,
    eosDate,
    selectedYpokatasthma = '',
    noCardsDisplayContext = {}
}) {
    const result = {
        recordsChecked: 0,
        recordsUpdated: 0,
        deviations: []
    };

    const employeeQuery = {
        team: sessionTeam,
        company_kod: companyId,
        energos: true
    };

    if (selectedYpokatasthma) {
        employeeQuery.ypokatasthma = selectedYpokatasthma;
    }

    const employees = await ErgazomenoiModel.find(employeeQuery)
        .select(
            'ypokatasthma kodikos eponymo onoma mhniaia_repo ' +
                'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas ' +
                'mo_oron_hmerhsias_ergasias typos_apasxolhshs typos_ebdomadas ' +
                'typos_ergazomenon'
        )
        .sort({ kodikos: 1 })
        .lean();

    const employeesByKodikos = new Map();
    const kodikoi = [];

    for (const erg of employees) {
        if (!erg?.kodikos) continue;
        employeesByKodikos.set(String(erg.kodikos), erg);
        kodikoi.push(erg.kodikos);
    }

    if (kodikoi.length === 0) {
        return result;
    }

    const periodStart = clampDateStartUtc(apoDate);
    const periodEnd = clampDateEndUtc(eosDate);

    const istorikoRowsByKodikos = new Map();

    if (IstorikoProslhpseonAllagonModel) {
        const istorikoRows = await IstorikoProslhpseonAllagonModel.find({
            team: sessionTeam,
            company_kod: companyId,
            kodikos: mongoose.trusted({ $in: kodikoi }),
            $or: mongoose.trusted([
                {
                    hmeromhnia_isxyos_oron_ergasias_apo: mongoose.trusted({ $lte: periodEnd }),
                    $or: mongoose.trusted([
                        {
                            hmeromhnia_isxyos_oron_ergasias_eos: mongoose.trusted({
                                $gte: periodStart
                            })
                        },
                        { hmeromhnia_isxyos_oron_ergasias_eos: null }
                    ])
                },
                {
                    hmeromhnia_isxyos_oron_ergasias_apo: null,
                    hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({ $lte: periodEnd }),
                    $or: mongoose.trusted([
                        {
                            hmeromhnia_allaghs_orarioy_eos: mongoose.trusted({
                                $gte: periodStart
                            })
                        },
                        { hmeromhnia_allaghs_orarioy_eos: null }
                    ])
                },
                {
                    // Fallback για ιστορικά records που έχουν μόνο ημερομηνία αλλαγής σύμβασης.
                    hmeromhnia_isxyos_oron_ergasias_apo: null,
                    hmeromhnia_allaghs_orarioy_apo: null,
                    hmeromhnia_allaghs_symbashs: mongoose.trusted({ $lte: periodEnd })
                }
            ])
        })
            .select(
                'kodikos aa_eggrafhs hmeromhnia_allaghs_symbashs ' +
                    'hmeromhnia_allaghs_orarioy_apo hmeromhnia_allaghs_orarioy_eos ' +
                    'hmeromhnia_isxyos_oron_ergasias_apo hmeromhnia_isxyos_oron_ergasias_eos ' +
                    'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas ' +
                    'mo_oron_hmerhsias_ergasias typos_apasxolhshs typos_ebdomadas ' +
                    'mhniaia_repo employment_profile_source afora_allagh_oron_ergasias createdAt'
            )
            .sort({
                kodikos: 1,
                hmeromhnia_isxyos_oron_ergasias_apo: 1,
                hmeromhnia_allaghs_orarioy_apo: 1,
                hmeromhnia_allaghs_symbashs: 1,
                createdAt: 1
            })
            .lean();

        for (const row of istorikoRows) {
            const key = String(row.kodikos || '').trim();
            if (!key) continue;
            if (!istorikoRowsByKodikos.has(key)) istorikoRowsByKodikos.set(key, []);
            istorikoRowsByKodikos.get(key).push(row);
        }
    }

    const rows = await ProdhlomenaOrariaModel.find({
        team: sessionTeam,
        company_kod: companyId,
        kodikos: mongoose.trusted({ $in: kodikoi }),
        hmeromhnia: mongoose.trusted({
            $gte: periodStart,
            $lte: periodEnd
        })
    })
        .select(
            'team company_kod kodikos hmeromhnia kathgoria_ergasias kathgoria_ergasias_apologistika ' +
                'ores_ergasias cards_ores_ergasias apologistiko_biblio is_locked'
        )
        .sort({ kodikos: 1, hmeromhnia: 1 })
        .lean();

    result.recordsChecked = rows.length;

    const rowsByEmployeeAndDate = new Map();

    for (const row of rows) {
        const key = `${row.kodikos}|${dateKeyUtc(row.hmeromhnia)}`;
        rowsByEmployeeAndDate.set(key, row);
    }

    const bulkOps = [];
    const weekRanges = getWeekRangesInsidePeriod(apoDate, eosDate);

    for (const erg of employees) {
        const istorikoRows = istorikoRowsByKodikos.get(String(erg.kodikos)) || [];

        for (const week of weekRanges) {
            let pragmatikaRepo = 0;

            const weeklyProfileInfo = getWeeklyRepoProfileInfo({
                week,
                istorikoRows,
                ergazomenos: erg
            });

            const expectedWeeklyRepo = weeklyProfileInfo.expectedWeeklyRepo;
            const effectiveProfile = weeklyProfileInfo.effectiveProfile || {};
            const previousProfile = weeklyProfileInfo.previousProfile || {};

            for (
                let day = clampDateStartUtc(week.weekStart);
                day.getTime() <= week.weekEnd.getTime();
                day = addDaysUtc(day, 1)
            ) {
                const row = rowsByEmployeeAndDate.get(`${erg.kodikos}|${dateKeyUtc(day)}`);
                if (!row) continue;

                // Για τον post-check κοιτάμε ΠΑΝΤΑ την αρχική προδηλωμένη κατηγορία.
                // Το kathgoria_ergasias_apologistika είναι αποτέλεσμα του ελέγχου και
                // χρησιμοποιείται στο review/display, όχι σαν είσοδος του κανόνα.
                const kathgoriaErgasias = String(row.kathgoria_ergasias || '').trim();
                const oresErgasiasIsZero = isZeroHours(row.ores_ergasias);
                const cardsOresIsZero = isZeroHours(row.cards_ores_ergasias);
                const cardsOresIsNonZero = isNonZeroHours(row.cards_ores_ergasias);
                const dailyProfile = getEffectiveRepoProfileForDate(day, istorikoRows, erg);
                const isFullTimeProfile = isFullTimeWorkTerms(dailyProfile);

                const update = {};

                if (kathgoriaErgasias === 'ΑΝ' && oresErgasiasIsZero && cardsOresIsZero) {
                    if (isFullTimeProfile) {
                        pragmatikaRepo += 1;
                    }
                } else if (kathgoriaErgasias === 'ΑΝ' && oresErgasiasIsZero && cardsOresIsNonZero) {
                    update.kathgoria_ergasias_apologistika = 'ΕΡΓ';
                } else if (isNoCardDeclaredWorkRow(row)) {
                    const noCardsDisplayStatus = resolveNoCardsDisplayStatus(
                        row,
                        noCardsDisplayContext
                    );
                    update.apologistiko_biblio = false;
                    update.kathgoria_ergasias_apologistika = '';
                    update.ores_ergasias_apologistika = isMisthotosEmployee(dailyProfile)
                        ? Number(row.ores_ergasias || 0)
                        : 0;
                    update.ores_apoysias_apologistika = 0;
                    update.adeia_apologistika = noCardsDisplayStatus === 'ΑΔΕΙΑ';
                    update.argia = noCardsDisplayStatus === 'ΑΡΓΙΑ';
                    update.kathgoria_adeias_apologistika =
                        noCardsDisplayStatus === 'ΑΔΕΙΑ' ? 'ΑΔΑΛ' : '';
                }

                if (Object.keys(update).length > 0 && row.is_locked !== true) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: row._id },
                            update: { $set: update },
                            upsert: false
                        }
                    });
                }
            }

            if (week.isFullWeek && Number(pragmatikaRepo) !== Number(expectedWeeklyRepo)) {
                const excessRepo = Math.max(0, Number(pragmatikaRepo) - Number(expectedWeeklyRepo));

                result.deviations.push({
                    team: sessionTeam,
                    company_kod: companyId,
                    period_apo: asDateOnlyUtc(apoDate),
                    period_eos: asDateOnlyUtc(eosDate, true),
                    ypokatasthma: erg.ypokatasthma || '',
                    kodikos: erg.kodikos || '',
                    eponymo: erg.eponymo || '',
                    onoma: erg.onoma || '',
                    week_apo: asDateOnlyUtc(week.weekStart),
                    week_eos: asDateOnlyUtc(week.weekEnd),
                    weekStart: dateKeyUtc(week.weekStart),
                    weekEnd: dateKeyUtc(week.weekEnd),
                    expected_repo: expectedWeeklyRepo,
                    actual_repo: pragmatikaRepo,
                    mhniaia_repo: expectedWeeklyRepo,
                    pragmatikaRepo,
                    profile_changed_inside_week: weeklyProfileInfo.profileChangedInsideWeek,
                    excess_repo: excessRepo,
                    effective_mhniaia_repo: expectedWeeklyRepo,
                    effective_typos_apasxolhshs: effectiveProfile.typos_apasxolhshs || '',
                    effective_profile_source:
                        effectiveProfile.employment_profile_source || effectiveProfile.source || '',
                    effective_profile_date: weeklyProfileInfo.effectiveProfileDate,
                    effective_profile_istoriko_id: effectiveProfile.istorikoId || null,
                    previous_mhniaia_repo: getExpectedWeeklyRepo(previousProfile),
                    previous_typos_apasxolhshs: previousProfile.typos_apasxolhshs || '',
                    previous_profile_source:
                        previousProfile.employment_profile_source || previousProfile.source || '',
                    previous_profile_date: weeklyProfileInfo.previousProfileDate,
                    previous_profile_istoriko_id: previousProfile.istorikoId || null,
                    deviation_type: weeklyProfileInfo.profileChangedInsideWeek
                        ? 'PROFILE_CHANGED_INSIDE_WEEK'
                        : 'WEEKLY_REPO_MISMATCH',
                    note:
                        weeklyProfileInfo.profileChangedInsideWeek && excessRepo > 0
                            ? 'Υπάρχουν επιπλέον ρεπό σε εβδομάδα με αλλαγή όρων εργασίας. Να ελεγχθεί αν πρέπει να χαρακτηριστούν ως ΑΔΑΛ.'
                            : ''
                });
            }
        }
    }

    const CHUNK_SIZE = 1000;

    for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
        const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
        const writeResult = await ProdhlomenaOrariaModel.bulkWrite(chunk, { ordered: false });
        result.recordsUpdated += writeResult.modifiedCount || 0;
    }

    // Αποθήκευση αποκλίσεων ρεπό ανά περίοδο.
    // Πριν γράψουμε τα νέα αποτελέσματα, καθαρίζουμε μόνο τις αποκλίσεις
    // της ίδιας ομάδας/εταιρείας/περιόδου, ώστε το review να δείχνει πάντα
    // το τελευταίο αποτέλεσμα του υπολογισμού χωρίς να χρειάζεται νέο re-calc.
    await ProdhlomenaOrariaDeviationsModel.deleteMany({
        team: sessionTeam,
        company_kod: companyId,
        period_apo: asDateOnlyUtc(apoDate),
        period_eos: asDateOnlyUtc(eosDate, true)
    });

    if (result.deviations.length > 0) {
        await ProdhlomenaOrariaDeviationsModel.insertMany(
            result.deviations.map((d) => ({
                team: d.team,
                company_kod: d.company_kod,
                period_apo: d.period_apo,
                period_eos: d.period_eos,
                ypokatasthma: d.ypokatasthma,
                kodikos: d.kodikos,
                eponymo: d.eponymo,
                onoma: d.onoma,
                week_apo: d.week_apo,
                week_eos: d.week_eos,
                expected_repo: d.expected_repo,
                actual_repo: d.actual_repo,
                profile_changed_inside_week: d.profile_changed_inside_week,
                excess_repo: d.excess_repo,
                effective_mhniaia_repo: d.effective_mhniaia_repo,
                effective_typos_apasxolhshs: d.effective_typos_apasxolhshs,
                effective_profile_source: d.effective_profile_source,
                effective_profile_date: d.effective_profile_date,
                effective_profile_istoriko_id: d.effective_profile_istoriko_id,
                previous_mhniaia_repo: d.previous_mhniaia_repo,
                previous_typos_apasxolhshs: d.previous_typos_apasxolhshs,
                previous_profile_source: d.previous_profile_source,
                previous_profile_date: d.previous_profile_date,
                previous_profile_istoriko_id: d.previous_profile_istoriko_id,
                deviation_type: d.deviation_type,
                note: d.note
            })),
            { ordered: false }
        );
    }

    result.deviationsSaved = result.deviations.length;

    return result;
}

function getDailyDeclaredMinutes(rec) {
    const declaredFromIntervals =
        durationMinutesSafe(rec.apo_ora_01, rec.eos_ora_01) +
        durationMinutesSafe(rec.apo_ora_02, rec.eos_ora_02) +
        durationMinutesSafe(rec.apo_ora_03, rec.eos_ora_03);

    if (declaredFromIntervals > 0) {
        return declaredFromIntervals;
    }

    return Math.round((Number(rec.ores_ergasias) || 0) * 60);
}

function isPartTimeEmployee(ergazomenos) {
    return (
        ergazomenos.plhrhs_apasxolhsh === false ||
        ergazomenos.pliris_apasxolisi === false ||
        ergazomenos.plhrhs === false ||
        ergazomenos.merikh_apasxolhsh === true ||
        ergazomenos.meriki_apasxolisi === true
    );
}

function getBreakOffsetMinutes(ergazomenos) {
    const dialleimaEntos = ergazomenos.dialleima_entos_ektos_orarioy === true;
    const dialleimaMinutes = parseInt(ergazomenos.dialleima_se_lepta || 0, 10) || 0;

    return dialleimaEntos ? 0 : dialleimaMinutes;
}

function isDeclaredContinuousSchedule(rec) {
    return (
        hasTime(rec.apo_ora_01) &&
        hasTime(rec.eos_ora_01) &&
        !hasTime(rec.apo_ora_02) &&
        !hasTime(rec.eos_ora_02) &&
        !hasTime(rec.apo_ora_03) &&
        !hasTime(rec.eos_ora_03)
    );
}

function isCardsContinuousSchedule(rec) {
    return (
        hasTime(rec.cards_apo_ora_01) &&
        hasTime(rec.cards_eos_ora_01) &&
        !hasTime(rec.cards_apo_ora_02) &&
        !hasTime(rec.cards_eos_ora_02) &&
        !hasTime(rec.cards_apo_ora_03) &&
        !hasTime(rec.cards_eos_ora_03)
    );
}

function isZeroLengthTimePair(apoOra, eosOra) {
    const apo = timeToMinutesSafe(apoOra);
    const eos = timeToMinutesSafe(eosOra);

    return apo !== null && eos !== null && apo === eos;
}

function getRawCardIntervals(rec) {
    return [
        {
            index: 1,
            apo: rec.cards_apo_ora_01,
            eos: rec.cards_eos_ora_01
        },
        {
            index: 2,
            apo: rec.cards_apo_ora_02,
            eos: rec.cards_eos_ora_02
        },
        {
            index: 3,
            apo: rec.cards_apo_ora_03,
            eos: rec.cards_eos_ora_03
        }
    ]
        .map((interval) => {
            if (isZeroLengthTimePair(interval.apo, interval.eos)) return null;

            const expanded = expandIntervalFromTimes(interval.apo, interval.eos);

            if (!expanded) return null;

            return {
                ...interval,
                start: expanded.start,
                end: expanded.end
            };
        })
        .filter(Boolean);
}

function normalizeZeroLengthCardPairs(rec = {}) {
    let normalized = rec;
    let changed = false;

    for (let pairNo = 1; pairNo <= 3; pairNo++) {
        const p = String(pairNo).padStart(2, '0');
        const apoField = `cards_apo_ora_${p}`;
        const eosField = `cards_eos_ora_${p}`;

        if (!isZeroLengthTimePair(rec[apoField], rec[eosField])) continue;

        if (!changed) normalized = { ...rec };

        normalized[apoField] = '';
        normalized[eosField] = '';
        changed = true;
    }

    if (changed) {
        normalized.cards_ores_ergasias = +(getRawDailyCardsMinutes(normalized) / 60).toFixed(2);
    }

    return normalized;
}

function getRawDailyCardsMinutes(rec) {
    return getRawCardIntervals(rec).reduce(
        (total, interval) => total + Math.max(0, interval.end - interval.start),
        0
    );
}

function shouldSubtractExternalBreak(rec, ergazomenos) {
    if (!ergazomenos) return false;

    const breakMinutes = getBreakOffsetMinutes(ergazomenos);

    if (breakMinutes <= 0) return false;
    if (!isDeclaredContinuousSchedule(rec)) return false;
    if (!isCardsContinuousSchedule(rec)) return false;

    const rawCardsMinutes = getRawDailyCardsMinutes(rec);

    // Αν οι πραγματικές ώρες καρτών μείον το διάλειμμα πέφτουν κάτω από 4 ώρες,
    // δεν αφαιρούμε διάλειμμα για τη συγκεκριμένη ημερομηνία.
    return rawCardsMinutes - breakMinutes >= 4 * 60;
}

function expandIntervalFromTimes(apoOra, eosOra) {
    const apo = timeToMinutesSafe(apoOra);
    const eos = timeToMinutesSafe(eosOra);

    if (apo === null || eos === null) return null;

    let start = apo;
    let end = eos;

    if (end <= start) {
        end += 1440;
    }

    return { start, end };
}

function getDailyCardsMinutes(rec, ergazomenos = null) {
    return getCardIntervals(rec, ergazomenos).reduce(
        (total, interval) => total + Math.max(0, interval.end - interval.start),
        0
    );
}

function getNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;

    const normalized = String(value).replace(',', '.').trim();
    const n = Number(normalized);

    return Number.isFinite(n) ? n : fallback;
}

function normalizeDateOnlyForCalc(value) {
    if (!value) return null;

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) return null;

    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function buildWorkTermsFromEmployee(ergazomenos = {}) {
    const hmeres = getNumber(ergazomenos.hmeres_ergasias_ebdomadas, 5);
    const weeklyHours = getNumber(ergazomenos.ores_ergasias_ebdomadas, 40);
    const averageDailyHours =
        getNumber(ergazomenos.mo_oron_hmerhsias_ergasias, 0) || weeklyHours / Math.max(hmeres, 1);

    return {
        source: 'ERG_AKTUAL',
        istorikoId: null,
        hmeres_ergasias_ebdomadas: hmeres,
        ores_ergasias_ebdomadas: weeklyHours,
        mo_oron_hmerhsias_ergasias: averageDailyHours,
        typos_apasxolhshs: ergazomenos.typos_apasxolhshs || '',
        typos_ebdomadas: ergazomenos.typos_ebdomadas || '',
        typos_ergazomenon: ergazomenos.typos_ergazomenon || '',
        mhniaia_repo: getNumber(ergazomenos.mhniaia_repo, 0),
        employment_profile_source: 'ERG_AKTUAL',
        hmeromhnia_allaghs_symbashs: null
    };
}

function buildWorkTermsFromHistory(row = {}, fallbackErgazomenos = {}) {
    const fallback = buildWorkTermsFromEmployee(fallbackErgazomenos);

    const hmeres = getNumber(row.hmeres_ergasias_ebdomadas, fallback.hmeres_ergasias_ebdomadas);
    const weeklyHours = getNumber(row.ores_ergasias_ebdomadas, fallback.ores_ergasias_ebdomadas);
    const averageDailyHours =
        getNumber(row.mo_oron_hmerhsias_ergasias, 0) || weeklyHours / Math.max(hmeres, 1);

    return {
        source: 'ISTORIKO',
        istorikoId: row._id || null,
        hmeres_ergasias_ebdomadas: hmeres,
        ores_ergasias_ebdomadas: weeklyHours,
        mo_oron_hmerhsias_ergasias: averageDailyHours,
        typos_apasxolhshs: row.typos_apasxolhshs || fallback.typos_apasxolhshs || '',
        typos_ebdomadas: row.typos_ebdomadas || fallback.typos_ebdomadas || '',
        typos_ergazomenon: row.typos_ergazomenon || fallback.typos_ergazomenon || '',
        mhniaia_repo: getNumber(row.mhniaia_repo, fallback.mhniaia_repo || 0),
        employment_profile_source: row.employment_profile_source || 'ISTORIKO',
        hmeromhnia_allaghs_symbashs: row.hmeromhnia_allaghs_symbashs || null,
        hmeromhnia_allaghs_orarioy_apo: row.hmeromhnia_allaghs_orarioy_apo || null,
        hmeromhnia_allaghs_orarioy_eos: row.hmeromhnia_allaghs_orarioy_eos || null,
        hmeromhnia_isxyos_oron_ergasias_apo:
            row.hmeromhnia_isxyos_oron_ergasias_apo || row.hmeromhnia_allaghs_orarioy_apo || null,
        hmeromhnia_isxyos_oron_ergasias_eos: row.hmeromhnia_isxyos_oron_ergasias_eos || null
    };
}

function getIstorikoTermsApo(row = {}) {
    return (
        normalizeDateOnlyForCalc(row.hmeromhnia_isxyos_oron_ergasias_apo) ||
        normalizeDateOnlyForCalc(row.hmeromhnia_allaghs_orarioy_apo)
    );
}

function getIstorikoTermsEos(row = {}) {
    return (
        normalizeDateOnlyForCalc(row.hmeromhnia_isxyos_oron_ergasias_eos) ||
        normalizeDateOnlyForCalc(row.hmeromhnia_allaghs_orarioy_eos)
    );
}

function getOrarioTermsForDate(date, istorikoRows = [], ergazomenos = {}) {
    const targetDate = normalizeDateOnlyForCalc(date);

    if (!targetDate) {
        return buildWorkTermsFromEmployee(ergazomenos);
    }

    const matchingRows = (Array.isArray(istorikoRows) ? istorikoRows : [])
        .filter((row) => {
            if (!row) return false;

            const isOrarioChange =
                row.afora_allagh_oron_ergasias === true ||
                row.hmeromhnia_isxyos_oron_ergasias_apo ||
                row.hmeromhnia_isxyos_oron_ergasias_eos ||
                row.hmeromhnia_allaghs_orarioy_apo ||
                row.hmeromhnia_allaghs_orarioy_eos;

            if (!isOrarioChange) return false;

            // Για τους όρους εργασίας προτιμάμε τα νέα hmeromhnia_isxyos_oron_ergasias_*
            // και κρατάμε fallback στα παλιά hmeromhnia_allaghs_orarioy_* για παλιές εγγραφές.
            const apo = getIstorikoTermsApo(row);
            const eos = getIstorikoTermsEos(row);

            if (!apo) return false;

            return targetDate >= apo && (!eos || targetDate <= eos);
        })
        .sort((a, b) => {
            const apoA = getIstorikoTermsApo(a);
            const apoB = getIstorikoTermsApo(b);

            return (apoB?.getTime() || 0) - (apoA?.getTime() || 0);
        });

    if (matchingRows.length === 0) {
        // Fallback για παλιά δεδομένα ή εργαζομένους χωρίς ιστορικό.
        // ΣΗΜΑΝΤΙΚΟ: για σωστό 5ήμερο->6ήμερο μέσα στην περίοδο,
        // πρέπει να υπάρχει και η κλεισμένη προηγούμενη ιστορική εγγραφή.
        return buildWorkTermsFromEmployee(ergazomenos);
    }

    return buildWorkTermsFromHistory(matchingRows[0], ergazomenos);
}

function getEffectiveEmployeeForDate(rec, ergazomenos = {}, istorikoRows = []) {
    const workTerms = getOrarioTermsForDate(rec?.hmeromhnia, istorikoRows, ergazomenos);

    // Επιστρέφουμε merged object ώστε οι υπάρχουσες συναρτήσεις που περιμένουν
    // ergazomenos να συνεχίσουν να δουλεύουν χωρίς μεγάλο refactor.
    return {
        ...ergazomenos,
        ...workTerms,
        _workTermsSource: workTerms.source,
        _workTermsIstorikoId: workTerms.istorikoId
    };
}

function getWorkTimeRules(workTerms = {}) {
    // ============================================================
    // Κανόνες εργασίας με βάση το effective snapshot της ημέρας.
    // Δεν πρέπει να χρησιμοποιούμε μόνο την τρέχουσα εικόνα του εργαζόμενου,
    // γιατί μέσα στην περίοδο μπορεί να αλλάξει:
    // - 5ήμερο -> 6ήμερο ή αντίστροφα
    // - 40h -> 30h ή αντίστροφα
    // - πλήρης -> μερική απασχόληση ή αντίστροφα
    // ============================================================

    const hmeres = parseInt(workTerms.hmeres_ergasias_ebdomadas || 5, 10);
    const weeklyHours = getNumber(workTerms.ores_ergasias_ebdomadas, 40);

    const averageDailyHours =
        getNumber(workTerms.mo_oron_hmerhsias_ergasias, 0) || weeklyHours / Math.max(hmeres, 1);

    const contractualDailyLimitMinutes = Math.round(averageDailyHours * 60);

    if (hmeres === 6) {
        return {
            workingDaysPerWeek: 6,
            contractualDailyLimitMinutes,
            dailyLegalLimitMinutes: 8 * 60,
            weeklyOverworkThresholdMinutes: 40 * 60,
            weeklyLegalLimitMinutes: 48 * 60,
            weeklyOverworkCapMinutes: 8 * 60
        };
    }

    return {
        workingDaysPerWeek: 5,
        contractualDailyLimitMinutes,
        dailyLegalLimitMinutes: 9 * 60,
        weeklyOverworkThresholdMinutes: 40 * 60,
        weeklyLegalLimitMinutes: 45 * 60,
        weeklyOverworkCapMinutes: 5 * 60
    };
}

function isRegularWorkingDayForOverwork(rec, ergazomenos = null) {
    const workedMinutes = getPayrollDailyWorkMinutes(rec, ergazomenos);

    if (workedMinutes <= 0) return false;
    if (rec.argia === true) return false;

    return true;
}

function emptyClassifiedMinutes() {
    return {
        normal: 0,
        night: 0,
        holiday: 0,
        holidayNight: 0
    };
}

function addClassifiedMinute(bucket, rec, minuteFromBaseDate, argiesDateSet) {
    const isNight = isMinuteNight(minuteFromBaseDate);
    const isHoliday = isMinuteSundayOrHoliday(rec.hmeromhnia, minuteFromBaseDate, argiesDateSet);

    if (isNight && isHoliday) {
        bucket.holidayNight++;
    } else if (isHoliday) {
        bucket.holiday++;
    } else if (isNight) {
        bucket.night++;
    } else {
        bucket.normal++;
    }
}

function toHours(minutes) {
    return +(minutes / 60).toFixed(2);
}

function chunkArray(arr, size = 300) {
    const chunks = [];

    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }

    return chunks;
}

function normalizeEmploymentTypeForAdditionalWork(workTerms = {}) {
    const raw = String(workTerms.typos_apasxolhshs ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');

    if (['0', '00', 'ΠΛΗΡΗΣ', 'PLHRHS', 'PLIRIS', 'FULL', 'FULL_TIME'].includes(raw)) {
        return 'FULL';
    }

    if (['1', '01', 'ΜΕΡΙΚΗ', 'MERIKH', 'MERIKI', 'PART_TIME'].includes(raw)) {
        return 'PARTIAL';
    }

    if (
        [
            '2',
            '02',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ',
            'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ_ΑΠΑΣΧΟΛΗΣΗ',
            'EK_PERITROPHS',
            'EK_PERITROPHIS',
            'ROTATIONAL'
        ].includes(raw)
    ) {
        return 'ROTATIONAL';
    }

    // Fallback μόνο όταν λείπει καθαρός τύπος απασχόλησης.
    // Αν οι εβδομαδιαίες ώρες είναι <40 και το ημερήσιο συμβατικό όριο είναι >=8h,
    // το αντιμετωπίζουμε ως εκ περιτροπής, όχι ως μερική.
    const weeklyHours = getNumber(workTerms.ores_ergasias_ebdomadas, 0);
    const hmeres = Math.max(1, getNumber(workTerms.hmeres_ergasias_ebdomadas, 0));
    const averageDailyHours =
        getNumber(workTerms.mo_oron_hmerhsias_ergasias, 0) || weeklyHours / hmeres;

    if (weeklyHours > 0 && weeklyHours < 40) {
        return averageDailyHours >= 8 ? 'ROTATIONAL' : 'PARTIAL';
    }

    if (weeklyHours >= 40) {
        return 'FULL';
    }

    return '';
}

function isPartialEmploymentForAdditionalWork(workTerms = {}) {
    return normalizeEmploymentTypeForAdditionalWork(workTerms) === 'PARTIAL';
}

function calculateAdditionalAndOverworkForDay(context, weeklyState) {
    const { rec, ergazomenos, argiesDateSet } = context;

    const rules = getWorkTimeRules(ergazomenos);
    const employmentTypeForAdditional = normalizeEmploymentTypeForAdditionalWork(ergazomenos);
    const isPartialEmployment = employmentTypeForAdditional === 'PARTIAL';

    const declaredMinutes = getDailyDeclaredMinutes(rec);
    const dailyCardsMinutes = getPayrollDailyWorkMinutes(rec, ergazomenos);

    // Βάση ημέρας για το πότε ξεκινάει το extra:
    // - Αν υπάρχει προδηλωμένο πρόγραμμα, ξεκινάμε μετά τα προδηλωμένα λεπτά.
    // - Αν δεν υπάρχει προδηλωμένο, ξεκινάμε μετά το συμβατικό ημερήσιο όριο
    //   του εργαζομένου από τους effective όρους εργασίας/ιστορικό.
    const baseWorkMinutes =
        declaredMinutes > 0 ? declaredMinutes : rules.contractualDailyLimitMinutes;

    const regularDay = isRegularWorkingDayForOverwork(rec, ergazomenos);

    let prosthetiMinutes = 0;

    const yperergasia = emptyClassifiedMinutes();
    const nomimiYperoria = emptyClassifiedMinutes();
    const paranomiYperoria = emptyClassifiedMinutes();

    // ============================================================
    // Διάστημα νόμιμης υπερωρίας για ΕΡΓΑΝΗ.
    //
    // Κρατάμε ΜΟΝΟ τα λεπτά που τελικά ταξινομούνται ως νόμιμη
    // υπερωρία (όχι υπερεργασία και όχι παράνομη υπερωρία).
    // ============================================================
    let firstLegalOvertimeMinute = null;
    let totalLegalOvertimeMinutes = 0;

    const addLegalOvertimeMinute = (minute) => {
        if (firstLegalOvertimeMinute === null) {
            firstLegalOvertimeMinute = minute;
        }

        totalLegalOvertimeMinutes++;
        addClassifiedMinute(nomimiYperoria, rec, minute, argiesDateSet);
    };

    const buildResult = () => {
        const legalOvertimeBreakOffsetMinutes = shouldSubtractExternalBreak(rec, ergazomenos)
            ? getBreakOffsetMinutes(ergazomenos)
            : 0;

        const legalOvertimeStartTime =
            totalLegalOvertimeMinutes > 0 && firstLegalOvertimeMinute !== null
                ? minutesToTimeSafe(firstLegalOvertimeMinute + legalOvertimeBreakOffsetMinutes)
                : '';

        const legalOvertimeEndTime =
            totalLegalOvertimeMinutes > 0 && firstLegalOvertimeMinute !== null
                ? minutesToTimeSafe(
                      firstLegalOvertimeMinute +
                          legalOvertimeBreakOffsetMinutes +
                          totalLegalOvertimeMinutes
                  )
                : '';

        return {
            ores_prostheths_ergasias_apologistika: toHours(prosthetiMinutes),

            ores_yperergasias_apologistika: toHours(yperergasia.normal),
            ores_yperergasias_nyxtas_apologistika: toHours(yperergasia.night),
            ores_yperergasias_argion_apologistika: toHours(yperergasia.holiday),
            ores_yperergasias_argion_nyxtas_apologistika: toHours(yperergasia.holidayNight),

            ores_nominhs_yperorias_apologistika: toHours(nomimiYperoria.normal),
            ores_nominhs_yperorias_nyxtas_apologistika: toHours(nomimiYperoria.night),
            ores_nominhs_yperorias_argion_apologistika: toHours(nomimiYperoria.holiday),
            ores_nominhs_yperorias_argion_nyxtas_apologistika: toHours(nomimiYperoria.holidayNight),

            ores_paranomhs_yperorias_apologistika: toHours(paranomiYperoria.normal),
            ores_paranomhs_yperorias_nyxtas_apologistika: toHours(paranomiYperoria.night),
            ores_paranomhs_yperorias_argion_apologistika: toHours(paranomiYperoria.holiday),
            ores_paranomhs_yperorias_argion_nyxtas_apologistika: toHours(
                paranomiYperoria.holidayNight
            ),

            // Ώρα έναρξης/λήξης ΜΟΝΟ της νόμιμης υπερωρίας.
            // Δεν περιλαμβάνει υπερεργασία ούτε παράνομη υπερωρία.
            apo_ora_yperories: legalOvertimeStartTime,
            eos_ora_yperories: legalOvertimeEndTime
        };
    };

    if (dailyCardsMinutes <= 0) {
        return buildResult();
    }

    const intervals = getPayrollCalculationIntervals(rec, ergazomenos);

    // ============================================================
    // ΜΕΡΙΚΗ ΑΠΑΣΧΟΛΗΣΗ
    // ============================================================
    // Πλήρης απασχόληση: ΔΕΝ υπάρχει πρόσθετη εργασία εδώ.
    // Εκ περιτροπής: ΔΕΝ υπάρχει πρόσθετη εργασία εδώ.
    // Μερική:
    //   έως προδηλωμένες ώρες       -> κανονικά
    //   από προδηλωμένες έως 8h     -> πρόσθετη εργασία
    //   πάνω από 8h έως 11h         -> νόμιμη υπερωρία
    //   πάνω από 11h                -> παράνομη υπερωρία
    // ============================================================
    if (isPartialEmployment) {
        const partialDeclaredLimitMinutes = Math.min(baseWorkMinutes, 8 * 60);
        const partialAdditionalEndMinutes = 8 * 60;
        const partialLegalOvertimeEndMinutes = partialAdditionalEndMinutes + 3 * 60;

        let workedSoFarToday = 0;
        let regularWorkedSoFarToday = 0;

        for (const interval of intervals) {
            for (let minute = interval.start; minute < interval.end; minute++) {
                workedSoFarToday++;

                if (regularDay) {
                    regularWorkedSoFarToday++;
                }

                if (workedSoFarToday <= partialDeclaredLimitMinutes) {
                    continue;
                }

                if (workedSoFarToday <= partialAdditionalEndMinutes) {
                    prosthetiMinutes++;
                    continue;
                }

                if (workedSoFarToday <= partialLegalOvertimeEndMinutes) {
                    addLegalOvertimeMinute(minute);
                    continue;
                }

                addClassifiedMinute(paranomiYperoria, rec, minute, argiesDateSet);
            }
        }

        if (regularDay && weeklyState) {
            weeklyState.processedRegularMinutes += regularWorkedSoFarToday;
        }

        return buildResult();
    }

    // Η υπερεργασία πρέπει να προηγείται ΠΑΝΤΑ της νόμιμης υπερωρίας.
    // 5ήμερο πλήρους απασχόλησης: 8h -> 9h = υπερεργασία, >9h = υπερωρία.
    // 6ήμερο: από το συμβατικό ημερήσιο όριο μέχρι το dailyLegalLimit = υπερεργασία.
    // Αν για οποιονδήποτε λόγο η βάση ημέρας είναι ίση ή μεγαλύτερη από το dailyLegalLimit,
    // δίνουμε τουλάχιστον 1 ώρα ζώνη υπερεργασίας πριν ξεκινήσει η υπερωρία.
    const overworkStartMinutes = baseWorkMinutes;
    const overworkEndMinutes = Math.max(rules.dailyLegalLimitMinutes, baseWorkMinutes + 60);

    const legalOvertimeStartMinutes = overworkEndMinutes;
    const legalOvertimeEndMinutes = legalOvertimeStartMinutes + 3 * 60;

    let workedSoFarToday = 0;
    let regularWorkedSoFarToday = 0;

    for (const interval of intervals) {
        for (let minute = interval.start; minute < interval.end; minute++) {
            workedSoFarToday++;

            let weeklyRegularPosition = null;

            if (regularDay) {
                regularWorkedSoFarToday++;
                weeklyRegularPosition =
                    weeklyState.processedRegularMinutes + regularWorkedSoFarToday;
            }

            const isDailyIllegalOvertime = workedSoFarToday > legalOvertimeEndMinutes;

            const isDailyLegalOvertime =
                workedSoFarToday > legalOvertimeStartMinutes &&
                workedSoFarToday <= legalOvertimeEndMinutes;

            const isWeeklyLegalOvertime =
                regularDay &&
                weeklyRegularPosition !== null &&
                weeklyRegularPosition > rules.weeklyLegalLimitMinutes;

            if (isDailyIllegalOvertime) {
                addClassifiedMinute(paranomiYperoria, rec, minute, argiesDateSet);
                continue;
            }

            const isOverworkZone =
                regularDay &&
                workedSoFarToday > overworkStartMinutes &&
                workedSoFarToday <= overworkEndMinutes;

            // ============================================================
            // Κανόνας υπερεργασίας / υπερωρίας με εβδομαδιαίο 40ωρο.
            //
            // Το weeklyRegularCardsMinutes έχει ήδη υπολογιστεί για ΟΛΗ την
            // εβδομάδα του record. Για την 1η εβδομάδα της επιλεγμένης περιόδου
            // φορτώνουμε από την προηγούμενη Κυριακή (calculationStartDate), άρα
            // ο έλεγχος 40ώρου γίνεται σωστά και για μερική αρχική εβδομάδα.
            //
            // Αν η εβδομάδα ΔΕΝ ξεπερνά τις 40h:
            //   - η 9η ώρα της ημέρας ΔΕΝ είναι υπερεργασία
            //   - τα λεπτά πάνε σε νόμιμη υπερωρία
            //
            // Αν η εβδομάδα ξεπερνά τις 40h:
            //   - η 9η ώρα παραμένει υπερεργασία
            //   - πάνω από τη 9η ώρα πάει σε υπερωρία από τα isDailyLegalOvertime checks
            // ============================================================
            const weeklyRegularCardsMinutes = Number(weeklyState?.weeklyRegularCardsMinutes || 0);

            const weeklyDoesNotExceed40Hours =
                weeklyRegularCardsMinutes < rules.weeklyOverworkThresholdMinutes;

            if (isOverworkZone) {
                if (weeklyDoesNotExceed40Hours) {
                    addLegalOvertimeMinute(minute);
                } else {
                    addClassifiedMinute(yperergasia, rec, minute, argiesDateSet);
                }
                continue;
            }

            if (isDailyLegalOvertime || isWeeklyLegalOvertime) {
                addLegalOvertimeMinute(minute);
                continue;
            }
        }
    }

    if (regularDay) {
        weeklyState.processedRegularMinutes += regularWorkedSoFarToday;
    }

    return buildResult();
}

function getCardIntervals(rec, ergazomenos = null) {
    const intervals = getRawCardIntervals(rec);

    if (!shouldSubtractExternalBreak(rec, ergazomenos)) {
        return intervals;
    }

    const breakMinutes = getBreakOffsetMinutes(ergazomenos);

    return intervals
        .map((interval) => {
            if (interval.index !== 1) return interval;

            const adjustedEnd = interval.end - breakMinutes;

            if (adjustedEnd <= interval.start) {
                return null;
            }

            return {
                ...interval,
                eos: minutesToTimeSafe(adjustedEnd),
                end: adjustedEnd,
                externalBreakSubtractedMinutes: breakMinutes
            };
        })
        .filter(Boolean);
}

function expandIntervalMinutes(apoOra, eosOra) {
    return expandIntervalFromTimes(apoOra, eosOra);
}

function isMinuteNight(minuteFromBaseDate) {
    const minute = minuteFromBaseDate % 1440;

    // Νύχτα: 22:01 - 06:00.
    // Πρακτικά σε λεπτά: >= 22:00 και <= 06:00.
    return minute >= 22 * 60 || minute < 6 * 60;
}

function isMinuteSundayOrHoliday(baseDate, minuteFromBaseDate, argiesDateSet) {
    const dayOffset = Math.floor(minuteFromBaseDate / 1440);
    const d = addDaysUtc(baseDate, dayOffset);

    return isSundayOrHoliday(d, argiesDateSet);
}

function calculateOverworkClassifiedMinutes(
    rec,
    overworkStartOffset,
    overworkMinutes,
    argiesDateSet
) {
    if (!overworkMinutes || overworkMinutes <= 0) {
        return {
            normal: 0,
            night: 0,
            holiday: 0,
            holidayNight: 0
        };
    }

    let workedSoFar = 0;
    let remaining = overworkMinutes;

    let normal = 0;
    let night = 0;
    let holiday = 0;
    let holidayNight = 0;

    const intervals = getPayrollCalculationIntervals(rec, ergazomenos);

    for (const interval of intervals) {
        for (let minute = interval.start; minute < interval.end; minute++) {
            workedSoFar++;

            if (workedSoFar < overworkStartOffset) continue;
            if (remaining <= 0) break;

            const isNight = isMinuteNight(minute);
            const isHoliday = isMinuteSundayOrHoliday(rec.hmeromhnia, minute, argiesDateSet);

            if (isNight && isHoliday) {
                holidayNight++;
            } else if (isHoliday) {
                holiday++;
            } else if (isNight) {
                night++;
            } else {
                normal++;
            }

            remaining--;
        }

        if (remaining <= 0) break;
    }

    return { normal, night, holiday, holidayNight };
}

function calculateWorkSegmentClassifiedMinutes(rec, startOffset, segmentMinutes, argiesDateSet) {
    if (!segmentMinutes || segmentMinutes <= 0) {
        return {
            normal: 0,
            night: 0,
            holiday: 0,
            holidayNight: 0
        };
    }

    let workedSoFar = 0;
    let remaining = segmentMinutes;

    let normal = 0;
    let night = 0;
    let holiday = 0;
    let holidayNight = 0;

    const intervals = getCardIntervals(rec);

    for (const interval of intervals) {
        const expanded = expandIntervalMinutes(interval.apo, interval.eos);
        if (!expanded) continue;

        for (let minute = expanded.start; minute < expanded.end; minute++) {
            workedSoFar++;

            if (workedSoFar < startOffset) continue;
            if (remaining <= 0) break;

            const isNight = isMinuteNight(minute);
            const isHoliday = isMinuteSundayOrHoliday(rec.hmeromhnia, minute, argiesDateSet);

            if (isNight && isHoliday) {
                holidayNight++;
            } else if (isHoliday) {
                holiday++;
            } else if (isNight) {
                night++;
            } else {
                normal++;
            }

            remaining--;
        }

        if (remaining <= 0) break;
    }

    return { normal, night, holiday, holidayNight };
}

// ============================================================
// Υπολογισμός απολογιστικών λεπτών από τα πεδία *_apologistika.
// Χρησιμοποιείται όταν δεν υπάρχουν προδηλωμένα ωράρια ή όταν το
// απολογιστικό ωράριο έχει παραχθεί από κάρτες.
//
// Παράδειγμα:
// apo_ora_01_apologistika = 12:02
// eos_ora_01_apologistika = 20:02
// => 8.00 ώρες απολογιστικής εργασίας, ακόμη κι αν οι raw κάρτες
//    είναι 12:02 - 22:22.
// ============================================================
function getApologistikaMinutes(rec = {}) {
    return (
        durationMinutesSafe(rec.apo_ora_01_apologistika, rec.eos_ora_01_apologistika) +
        durationMinutesSafe(rec.apo_ora_02_apologistika, rec.eos_ora_02_apologistika) +
        durationMinutesSafe(rec.apo_ora_03_apologistika, rec.eos_ora_03_apologistika)
    );
}

function getApologistikaIntervals(rec = {}) {
    return [
        {
            index: 1,
            apo: rec.apo_ora_01_apologistika,
            eos: rec.eos_ora_01_apologistika
        },
        {
            index: 2,
            apo: rec.apo_ora_02_apologistika,
            eos: rec.eos_ora_02_apologistika
        },
        {
            index: 3,
            apo: rec.apo_ora_03_apologistika,
            eos: rec.eos_ora_03_apologistika
        }
    ]
        .map((interval) => {
            const expanded = expandIntervalFromTimes(interval.apo, interval.eos);

            if (!expanded) return null;

            return {
                ...interval,
                start: expanded.start,
                end: expanded.end,
                source: 'APOLOGISTIKA'
            };
        })
        .filter(Boolean);
}

function getEffectiveWorkIntervalsForApologistika(rec, ergazomenos = null) {
    const apologistikaIntervals = getApologistikaIntervals(rec);

    // Αν έχουν ήδη παραχθεί απολογιστικά ζεύγη, αυτά είναι το αναγνωρισμένο
    // απολογιστικό ωράριο και πρέπει να χρησιμοποιούνται στους υπολογισμούς
    // ωρών/νύχτας/αργίας/υπερεργασίας αντί για τις raw κάρτες.
    if (apologistikaIntervals.length > 0) {
        return apologistikaIntervals;
    }

    return getCardIntervals(rec, ergazomenos);
}

function getEffectiveDailyWorkMinutesForApologistika(rec, ergazomenos = null) {
    return getEffectiveWorkIntervalsForApologistika(rec, ergazomenos).reduce(
        (total, interval) => total + Math.max(0, interval.end - interval.start),
        0
    );
}

// ============================================================
// Intervals που χρησιμοποιούνται αποκλειστικά για payroll buckets
// (νύχτα, αργίες, πρόσθετη εργασία, υπερεργασία, υπερωρίες).
//
// Κανόνας:
// - Αν οι κάρτες είναι πλήρεις, υπολογίζουμε από τις πραγματικές κάρτες.
// - Αν υπάρχει ελλιπές ζεύγος κάρτας (μόνο είσοδος ή μόνο έξοδος) και
//   έχει παραχθεί απολογιστικό ζεύγος, χρησιμοποιούμε το απολογιστικό
//   ως ασφαλή ανακατασκευή του χρόνου.
// Έτσι δεν κόβουμε πραγματική υπερωρία από πλήρεις κάρτες, αλλά δεν
// μηδενίζουμε και τις ημέρες με ελλιπείς κάρτες.
// ============================================================
function hasIncompleteCardPair(rec = {}) {
    for (let n = 1; n <= 3; n++) {
        const p = String(n).padStart(2, '0');
        const hasApo = hasTime(rec[`cards_apo_ora_${p}`]);
        const hasEos = hasTime(rec[`cards_eos_ora_${p}`]);

        if (hasApo !== hasEos) {
            return true;
        }
    }

    return false;
}

function getPayrollCalculationIntervals(rec, ergazomenos = null) {
    const rawIntervals = getCardIntervals(rec, ergazomenos);
    const apologistikaIntervals = getApologistikaIntervals(rec);

    if (hasIncompleteCardPair(rec) && apologistikaIntervals.length > 0) {
        return apologistikaIntervals;
    }

    if (rawIntervals.length > 0) {
        return rawIntervals;
    }

    return apologistikaIntervals;
}

function getPayrollDailyWorkMinutes(rec, ergazomenos = null) {
    return getPayrollCalculationIntervals(rec, ergazomenos).reduce(
        (total, interval) => total + Math.max(0, interval.end - interval.start),
        0
    );
}

function checkOresApoysias(context) {
    const { rec, ergazomenos, proorhApoxorhshMinutes } = context;

    // ============================================================
    // Έλεγχος αν υπάρχουν καθόλου κάρτες εργασίας.
    // Αν ΟΛΑ τα πεδία καρτών είναι κενά ή null,
    // τότε δεν υπολογίζουμε ούτε ώρες εργασίας ούτε απουσίες.
    // ============================================================
    const cardFields = [
        rec.cards_apo_ora_01,
        rec.cards_apo_ora_02,
        rec.cards_apo_ora_03,
        rec.cards_eos_ora_01,
        rec.cards_eos_ora_02,
        rec.cards_eos_ora_03
    ];

    const hasAnyCardTime = cardFields.some(
        (value) => value !== null && value !== undefined && String(value).trim() !== ''
    );

    if (!hasAnyCardTime) {
        return {
            ores_ergasias_apologistika: 0,
            ores_apoysias_apologistika: 0
        };
    }

    // ============================================================
    // b = Προδηλωμένες ώρες ημέρας.
    // Από τα ζεύγη apo/eos ή fallback στο rec.ores_ergasias.
    // ============================================================
    const declaredMinutes = getDailyDeclaredMinutes(rec);
    const declaredHours = toHours(declaredMinutes);

    // ============================================================
    // a = Ώρες καρτών από ProdhlomenaOrariaModel.cards_ores_ergasias.
    //
    // ΠΡΟΣΟΧΗ:
    // Δεν αλλάζουμε το cards_ores_ergasias.
    // Το χρησιμοποιούμε μόνο ως βάση υπολογισμού.
    // ============================================================
    const cardsHours = Number(rec.cards_ores_ergasias || 0);

    // ============================================================
    // c = Διάλειμμα σε ώρες.
    //
    // getBreakOffsetMinutes(ergazomenos):
    // - αν dialleima_entos_ektos_orarioy === true  -> επιστρέφει 0
    // - αν dialleima_entos_ektos_orarioy === false -> επιστρέφει dialleima_se_lepta
    //
    // Άρα εφαρμόζει ακριβώς τη λογική:
    // αν το διάλειμμα είναι ΕΝΤΟΣ ωραρίου, c = 0
    // αν το διάλειμμα είναι ΕΚΤΟΣ ωραρίου, c = dialleima_se_lepta
    // ============================================================
    const breakMinutes = getBreakOffsetMinutes(ergazomenos);
    const breakHours = breakMinutes / 60;

    // ============================================================
    // e = a - c
    //
    // Αυτό ενημερώνει το ores_ergasias_apologistika.
    // Παράδειγμα:
    // cards_ores_ergasias = 10.00
    // διάλειμμα εκτός = 0.50
    // => ores_ergasias_apologistika = 9.50
    // ============================================================
    const effectiveCardsHours = Math.max(0, cardsHours - breakHours);

    // ============================================================
    // d = Επιτρεπόμενη πρόωρη αποχώρηση σε ώρες.
    // Από CompanyModel.xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta.
    // Έρχεται εδώ ως proorhApoxorhshMinutes.
    // ============================================================
    const toleranceHours = (Number(proorhApoxorhshMinutes) || 0) / 60;

    // ============================================================
    // f = ores_apoysias_apologistika
    //
    // if (e >= b) -> f = 0
    // if (e < b)  -> αν (b - e) > d τότε f = b - e, αλλιώς f = 0
    // ============================================================
    const absenceDiff = declaredHours - effectiveCardsHours;

    const absenceHours =
        declaredHours > 0 && absenceDiff > toleranceHours ? +absenceDiff.toFixed(2) : 0;

    // ============================================================
    // Σε αυτή τη φάση ΔΕΝ πειράζουμε:
    // - υπερεργασίες
    // - νόμιμες υπερωρίες
    // - παράνομες υπερωρίες
    // - apo_ora_yperories / eos_ora_yperories
    //
    // Αυτά θα υπολογιστούν/διορθωθούν σε επόμενη φάση.
    // ============================================================
    return {
        ores_ergasias_apologistika: +effectiveCardsHours.toFixed(2),
        ores_apoysias_apologistika: absenceHours
    };
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

// ============================================================================
// REVIEW EXPORT HELPERS - Excel/PDF grouped exports
// ============================================================================
function reviewNum(value) {
    const n = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}
function reviewHours(value) {
    return reviewNum(value).toFixed(2);
}
function reviewDateOnly(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
function reviewDateWithDay(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const days = ['Κυ', 'Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα'];
    return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
function reviewInterval(row, apoField, eosField) {
    const apo = String(row?.[apoField] || '').trim();
    const eos = String(row?.[eosField] || '').trim();
    return apo || eos ? `${apo || ''}-${eos || ''}` : '';
}
function reviewIntervals(row, apoPrefix, eosPrefix, suffix = '') {
    return [1, 2, 3]
        .map((n) => String(n).padStart(2, '0'))
        .map((p) => reviewInterval(row, `${apoPrefix}_${p}${suffix}`, `${eosPrefix}_${p}${suffix}`))
        .filter(Boolean)
        .join(' / ');
}

function reviewEffectiveKathgoria(row = {}) {
    const apologistiki = String(row.kathgoria_ergasias_apologistika || '').trim();
    return apologistiki || String(row.kathgoria_ergasias || '').trim();
}

function normalizeReviewNonFullNonWorkRow(row = {}, effectiveProfile = {}, phaseCode = '') {
    const declaredKathgoria = String(
        row.kathgoria_ergasias_original ?? row.kathgoria_ergasias ?? ''
    ).trim();
    const apologistikiKathgoria = String(row.kathgoria_ergasias_apologistika || '').trim();
    const reviewPhaseCode = String(phaseCode || '').trim();
    const isNonFullPhase =
        reviewPhaseCode === '1' ||
        reviewPhaseCode === '2' ||
        (!reviewPhaseCode && !isFullTimeWorkTerms(effectiveProfile));

    if (
        isNonFullPhase &&
        declaredKathgoria === 'ΕΡΓ' &&
        apologistikiKathgoria === 'ΑΝ'
    ) {
        return {
            ...row,
            kathgoria_ergasias_apologistika: 'ΜΕ',
            review_phase_code: reviewPhaseCode,
            review_kathestos_code: reviewPhaseCode
        };
    }

    return {
        ...row,
        review_phase_code: reviewPhaseCode,
        review_kathestos_code: reviewPhaseCode
    };
}

function findReviewOperationalPhaseForDate(phases = [], dateKey = '') {
    if (!dateKey) return null;

    return (
        phases.find((phase) => {
            const apoKey = String(phase?.apo || '').slice(0, 10);
            const eosKey = String(phase?.eos || '').slice(0, 10);
            return apoKey && eosKey && dateKey >= apoKey && dateKey <= eosKey;
        }) || null
    );
}

async function buildReviewPhaseContextByKodikos({
    team,
    company_kod,
    kodikoi = [],
    ypokatasthma = '',
    periodStart,
    periodEnd
}) {
    const phaseContextByKodikos = new Map();

    if (!team || !company_kod || !periodStart || !periodEnd || kodikoi.length === 0) {
        return phaseContextByKodikos;
    }

    const apo = dateKeyUtc(periodStart);
    const eos = dateKeyUtc(periodEnd);

    await Promise.all(
        kodikoi.map(async (kodikos) => {
            const key = String(kodikos || '').trim();
            if (!key) return;

            try {
                const phaseContext = await phaseDetectorService.detectPayrollPhasesForDateRange({
                    team,
                    company_kod,
                    kodikos: key,
                    ypokatasthma,
                    apo,
                    eos
                });
                phaseContextByKodikos.set(key, phaseContext);
            } catch (error) {
                console.error(
                    '[buildReviewPhaseContextByKodikos] phase detection failed:',
                    key,
                    error.message
                );
            }
        })
    );

    return phaseContextByKodikos;
}

function getReviewPhaseCodeForRow(row = {}, phaseContextByKodikos = new Map()) {
    const key = String(row.kodikos || '').trim();
    const phaseContext = phaseContextByKodikos.get(key);
    const phases = Array.isArray(phaseContext?.operationalPhases)
        ? phaseContext.operationalPhases
        : [];
    const phase = findReviewOperationalPhaseForDate(phases, dateKeyUtc(row.hmeromhnia));

    return String(phase?.detectedKathestosCode || '').trim();
}

function reviewIsFullTimeProfile(row = {}) {
    const reviewPhaseCode = String(row.review_phase_code ?? row.review_kathestos_code ?? '').trim();
    if (reviewPhaseCode === '0') return true;
    if (reviewPhaseCode === '1' || reviewPhaseCode === '2') return false;

    return (
        row.effective_is_full_time === true ||
        row.effective_is_full_time === 'true' ||
        row.effective_is_full_time === 1 ||
        row.effective_is_full_time === '1' ||
        String(row.effective_typos_apasxolhshs ?? row.typos_apasxolhshs ?? '').trim() === '0'
    );
}

function reviewProgramDisplay(row = {}) {
    const isDeclaredRestOrNonWork =
        row.apologistiko_biblio !== true &&
        reviewNum(row.ores_ergasias) === 0 &&
        reviewNum(row.cards_ores_ergasias) === 0;

    if (!isDeclaredRestOrNonWork) {
        return { text: reviewIntervals(row, 'apo_ora', 'eos_ora') || '-', type: '' };
    }

    if (reviewIsFullTimeProfile(row)) {
        return { text: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ', type: 'declared_repo' };
    }

    return { text: 'ΜΗ ΕΡΓΑΣΙΑ', type: 'non_work' };
}

function reviewApologistikoDisplay(row = {}) {
    const noCardsDisplayStatus = String(row.noCardsDisplayStatus || '').trim();
    if (noCardsDisplayStatus === 'ΑΔΕΙΑ' || noCardsDisplayStatus === 'ΑΡΓΙΑ') {
        return { text: noCardsDisplayStatus, type: `no_cards_${noCardsDisplayStatus}` };
    }

    const effectiveKathgoria = reviewEffectiveKathgoria(row);
    const hasNoCards = reviewNum(row.cards_ores_ergasias) === 0;
    const isFullTimeProfile = reviewIsFullTimeProfile(row);

    if (
        row.apologistiko_biblio === true &&
        effectiveKathgoria === 'ΑΝ' &&
        hasNoCards &&
        isFullTimeProfile
    ) {
        return { text: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ', type: 'repo' };
    }

    if (
        row.apologistiko_biblio === true &&
        (effectiveKathgoria === 'ΜΕ' ||
            (effectiveKathgoria === 'ΑΝ' && !isFullTimeProfile)) &&
        hasNoCards
    ) {
        return { text: 'ΜΗ ΕΡΓΑΣΙΑ', type: 'non_work' };
    }

    const intervals = reviewIntervals(row, 'apo_ora', 'eos_ora', '_apologistika');
    if (intervals) return { text: intervals, type: 'apologistiko' };

    if (String(row.kathgoria_adeias_apologistika || '').trim()) {
        return { text: '-', type: 'adeia_suggestion' };
    }

    return { text: '-', type: '' };
}

function reviewEmploymentTypeLabel(value) {
    const v = String(value ?? '').trim();
    if (v === '0') return 'Πλήρης';
    if (v === '1') return 'Μερική';
    if (v === '2') return 'Εκ Περιτροπής';
    return v || '-';
}

function buildReviewDeviationsFilter(req) {
    const filter = { team: req.session.userTeam, company_kod: req.session.companyInUse };
    const { apo_hmeromhnia, eos_hmeromhnia, ypokatasthma, kodikos } = req.query;

    if (apo_hmeromhnia && eos_hmeromhnia) {
        filter.period_apo = asDateOnlyUtc(`${apo_hmeromhnia}T00:00:00.000Z`);
        filter.period_eos = asDateOnlyUtc(`${eos_hmeromhnia}T23:59:59.999Z`, true);
    }

    if (ypokatasthma && String(ypokatasthma).trim() !== '') {
        filter.ypokatasthma = String(ypokatasthma).trim().padStart(4, '0');
    }

    if (kodikos && String(kodikos).trim() !== '') {
        filter.kodikos = String(kodikos).trim();
    }

    return filter;
}

function mapDeviationForReviewExport(d = {}) {
    return {
        _id: d._id,
        ypokatasthma: d.ypokatasthma || '',
        kodikos: d.kodikos || '',
        eponymo: d.eponymo || '',
        onoma: d.onoma || '',
        week_apo: d.week_apo,
        week_eos: d.week_eos,
        weekStart: dateKeyUtc(d.week_apo),
        weekEnd: dateKeyUtc(d.week_eos),
        expected_repo: Number(d.expected_repo || 0),
        actual_repo: Number(d.actual_repo || 0),
        profile_changed_inside_week: d.profile_changed_inside_week === true,
        excess_repo: Number(d.excess_repo || 0),
        effective_mhniaia_repo: Number(d.effective_mhniaia_repo || d.expected_repo || 0),
        effective_typos_apasxolhshs: d.effective_typos_apasxolhshs || '',
        effective_profile_source: d.effective_profile_source || '',
        effective_profile_date: d.effective_profile_date,
        previous_mhniaia_repo: Number(d.previous_mhniaia_repo || 0),
        previous_typos_apasxolhshs: d.previous_typos_apasxolhshs || '',
        previous_profile_date: d.previous_profile_date,
        deviation_type: d.deviation_type || '',
        note: d.note || ''
    };
}

function reviewDeviationProfileText(dev = {}) {
    const repo = dev.effective_mhniaia_repo ?? dev.expected_repo ?? '';
    const type = reviewEmploymentTypeLabel(dev.effective_typos_apasxolhshs);
    const parts = [];
    if (dev.profile_changed_inside_week) parts.push('Τελικό προφίλ εβδομάδας');
    if (type && type !== '-') parts.push(type);
    parts.push(`${repo} ρεπό`);
    if (dev.effective_profile_date)
        parts.push(`Ισχύει από: ${reviewDateOnly(dev.effective_profile_date)}`);
    return parts.join(' | ');
}

function reviewDeviationNoteText(dev = {}) {
    if (dev.profile_changed_inside_week) {
        const excess = Number(dev.actual_repo || 0) - Number(dev.expected_repo || 0);
        return [
            'Αλλαγή όρων εργασίας μέσα στην εβδομάδα.',
            'Υπερισχύουν οι όροι εργασίας που ίσχυαν το Σάββατο.',
            excess > 0 ? `Πλεονάζοντα ρεπό: ${excess}` : '',
            dev.note || ''
        ]
            .filter(Boolean)
            .join(' ');
    }

    return dev.note || '';
}

function reviewYperergasiaTotal(row) {
    return (
        reviewNum(row.ores_yperergasias_apologistika) +
        reviewNum(row.ores_yperergasias_nyxtas_apologistika) +
        reviewNum(row.ores_yperergasias_argion_apologistika) +
        reviewNum(row.ores_yperergasias_argion_nyxtas_apologistika)
    );
}
function reviewNomimiYperoriaTotal(row) {
    return (
        reviewNum(row.ores_nominhs_yperorias_apologistika) +
        reviewNum(row.ores_nominhs_yperorias_nyxtas_apologistika) +
        reviewNum(row.ores_nominhs_yperorias_argion_apologistika) +
        reviewNum(row.ores_nominhs_yperorias_argion_nyxtas_apologistika)
    );
}
function reviewParanomiYperoriaTotal(row) {
    return (
        reviewNum(row.ores_paranomhs_yperorias_apologistika) +
        reviewNum(row.ores_paranomhs_yperorias_nyxtas_apologistika) +
        reviewNum(row.ores_paranomhs_yperorias_argion_apologistika) +
        reviewNum(row.ores_paranomhs_yperorias_argion_nyxtas_apologistika)
    );
}

function reviewPdfOvertimeBreakdown(row = {}, fieldNames = []) {
    const labels = ['Καν.', 'Νύχ.', 'Αργ.', 'Αρ.Ν'];
    const parts = fieldNames
        .map((field, index) => ({
            label: labels[index],
            value: reviewNum(row[field])
        }))
        .filter((part) => part.value !== 0);

    const total = fieldNames.reduce((sum, field) => sum + reviewNum(row[field]), 0);
    const hasSpecialComponent = fieldNames.slice(1).some((field) => reviewNum(row[field]) !== 0);

    return {
        total,
        needsBreakdown: total !== 0 && hasSpecialComponent,
        parts
    };
}

function reviewPdfYperergasiaBreakdown(row = {}) {
    return reviewPdfOvertimeBreakdown(row, [
        'ores_yperergasias_apologistika',
        'ores_yperergasias_nyxtas_apologistika',
        'ores_yperergasias_argion_apologistika',
        'ores_yperergasias_argion_nyxtas_apologistika'
    ]);
}

function reviewPdfNomimiYperoriaBreakdown(row = {}) {
    return reviewPdfOvertimeBreakdown(row, [
        'ores_nominhs_yperorias_apologistika',
        'ores_nominhs_yperorias_nyxtas_apologistika',
        'ores_nominhs_yperorias_argion_apologistika',
        'ores_nominhs_yperorias_argion_nyxtas_apologistika'
    ]);
}

function reviewPdfParanomiYperoriaBreakdown(row = {}) {
    return reviewPdfOvertimeBreakdown(row, [
        'ores_paranomhs_yperorias_apologistika',
        'ores_paranomhs_yperorias_nyxtas_apologistika',
        'ores_paranomhs_yperorias_argion_apologistika',
        'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
    ]);
}
function reviewArgiaTotal(row) {
    return (
        reviewNum(row.ores_argion_prosayxhsh_apologistika) +
        reviewNum(row.ores_argion_ergasia_apologistika)
    );
}
function createReviewTotals() {
    return {
        ores_ergasias_apologistika: 0,
        ores_apoysias_apologistika: 0,
        ores_nyxtas_apologistika: 0,
        argia: 0,
        ores_prostheths_ergasias_apologistika: 0,

        // Σύνολα υπερεργασίας αναλυμένα όπως στις ημερήσιες γραμμές PDF
        ores_yperergasias_apologistika: 0,
        ores_yperergasias_nyxtas_apologistika: 0,
        ores_yperergasias_argion_apologistika: 0,
        ores_yperergasias_argion_nyxtas_apologistika: 0,
        yperergasia: 0,

        // Σύνολα νόμιμης υπερωρίας αναλυμένα όπως στις ημερήσιες γραμμές PDF
        ores_nominhs_yperorias_apologistika: 0,
        ores_nominhs_yperorias_nyxtas_apologistika: 0,
        ores_nominhs_yperorias_argion_apologistika: 0,
        ores_nominhs_yperorias_argion_nyxtas_apologistika: 0,
        nomimiYperoria: 0,

        // Σύνολα παράνομης υπερωρίας αναλυμένα όπως στις ημερήσιες γραμμές PDF
        ores_paranomhs_yperorias_apologistika: 0,
        ores_paranomhs_yperorias_nyxtas_apologistika: 0,
        ores_paranomhs_yperorias_argion_apologistika: 0,
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0,
        paranomiYperoria: 0
    };
}
function addReviewTotals(t, row) {
    t.ores_ergasias_apologistika += reviewNum(row.ores_ergasias_apologistika);
    t.ores_apoysias_apologistika += reviewNum(row.ores_apoysias_apologistika);
    t.ores_nyxtas_apologistika += reviewNum(row.ores_nyxtas_apologistika);
    t.argia += reviewArgiaTotal(row);
    t.ores_prostheths_ergasias_apologistika += reviewNum(row.ores_prostheths_ergasias_apologistika);

    t.ores_yperergasias_apologistika += reviewNum(row.ores_yperergasias_apologistika);
    t.ores_yperergasias_nyxtas_apologistika += reviewNum(row.ores_yperergasias_nyxtas_apologistika);
    t.ores_yperergasias_argion_apologistika += reviewNum(row.ores_yperergasias_argion_apologistika);
    t.ores_yperergasias_argion_nyxtas_apologistika += reviewNum(
        row.ores_yperergasias_argion_nyxtas_apologistika
    );
    t.yperergasia += reviewYperergasiaTotal(row);

    t.ores_nominhs_yperorias_apologistika += reviewNum(row.ores_nominhs_yperorias_apologistika);
    t.ores_nominhs_yperorias_nyxtas_apologistika += reviewNum(
        row.ores_nominhs_yperorias_nyxtas_apologistika
    );
    t.ores_nominhs_yperorias_argion_apologistika += reviewNum(
        row.ores_nominhs_yperorias_argion_apologistika
    );
    t.ores_nominhs_yperorias_argion_nyxtas_apologistika += reviewNum(
        row.ores_nominhs_yperorias_argion_nyxtas_apologistika
    );
    t.nomimiYperoria += reviewNomimiYperoriaTotal(row);

    t.ores_paranomhs_yperorias_apologistika += reviewNum(row.ores_paranomhs_yperorias_apologistika);
    t.ores_paranomhs_yperorias_nyxtas_apologistika += reviewNum(
        row.ores_paranomhs_yperorias_nyxtas_apologistika
    );
    t.ores_paranomhs_yperorias_argion_apologistika += reviewNum(
        row.ores_paranomhs_yperorias_argion_apologistika
    );
    t.ores_paranomhs_yperorias_argion_nyxtas_apologistika += reviewNum(
        row.ores_paranomhs_yperorias_argion_nyxtas_apologistika
    );
    t.paranomiYperoria += reviewParanomiYperoriaTotal(row);
}
function buildProdhlomenaReviewFilter(req) {
    const filter = { team: req.session.userTeam, company_kod: req.session.companyInUse };
    const {
        apo_hmeromhnia,
        eos_hmeromhnia,
        ypokatasthma,
        kodikos,
        only_apologistiko,
        only_nyxta,
        only_argia,
        only_yperergasia
    } = req.query;
    if (apo_hmeromhnia && eos_hmeromhnia)
        filter.hmeromhnia = mongoose.trusted({
            $gte: new Date(`${apo_hmeromhnia}T00:00:00.000Z`),
            $lte: new Date(`${eos_hmeromhnia}T23:59:59.999Z`)
        });
    if (ypokatasthma && String(ypokatasthma).trim() !== '')
        filter.ypokatasthma = String(ypokatasthma).trim().padStart(4, '0');
    if (kodikos && String(kodikos).trim() !== '') filter.kodikos = String(kodikos).trim();
    const andFilters = [];
    if (only_apologistiko === 'true') andFilters.push({ apologistiko_biblio: true });
    if (only_nyxta === 'true')
        andFilters.push({ ores_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) });
    if (only_argia === 'true')
        andFilters.push({
            $or: [
                { ores_argion_prosayxhsh_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_argion_ergasia_apologistika: mongoose.trusted({ $gt: 0 }) },
                { kyriakes_apologistika: true },
                { argia: true }
            ]
        });
    if (only_yperergasia === 'true')
        andFilters.push({
            $or: [
                { ores_prostheths_ergasias_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_yperergasias_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_yperergasias_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_yperergasias_argion_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_yperergasias_argion_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_nominhs_yperorias_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_nominhs_yperorias_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_nominhs_yperorias_argion_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_nominhs_yperorias_argion_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_paranomhs_yperorias_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_paranomhs_yperorias_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                { ores_paranomhs_yperorias_argion_apologistika: mongoose.trusted({ $gt: 0 }) },
                {
                    ores_paranomhs_yperorias_argion_nyxtas_apologistika: mongoose.trusted({
                        $gt: 0
                    })
                }
            ]
        });
    if (andFilters.length > 0) filter.$and = mongoose.trusted(andFilters);
    return filter;
}
const REVIEW_SELECT_FIELDS =
    'ypokatasthma kodikos hmeromhnia kathgoria_ergasias kathgoria_ergasias_apologistika apo_ora_01 eos_ora_01 apo_ora_02 eos_ora_02 apo_ora_03 eos_ora_03 ores_ergasias cards_apo_ora_01 cards_eos_ora_01 cards_apo_ora_02 cards_eos_ora_02 cards_apo_ora_03 cards_eos_ora_03 cards_ores_ergasias apo_ora_01_apologistika eos_ora_01_apologistika apo_ora_02_apologistika eos_ora_02_apologistika apo_ora_03_apologistika eos_ora_03_apologistika repo argia perigrafh_argias apologistiko_biblio kyriakes_apologistika repo_apologistika adeia_apologistika kathgoria_adeias_apologistika astheneia_apologistika ores_ergasias_apologistika ores_apoysias_apologistika ores_nyxtas_apologistika ores_argion_prosayxhsh_apologistika ores_argion_ergasia_apologistika ores_prostheths_ergasias_apologistika ores_yperergasias_apologistika ores_yperergasias_nyxtas_apologistika ores_yperergasias_argion_apologistika ores_yperergasias_argion_nyxtas_apologistika ores_nominhs_yperorias_apologistika ores_nominhs_yperorias_nyxtas_apologistika ores_nominhs_yperorias_argion_apologistika ores_nominhs_yperorias_argion_nyxtas_apologistika ores_paranomhs_yperorias_apologistika ores_paranomhs_yperorias_nyxtas_apologistika ores_paranomhs_yperorias_argion_apologistika ores_paranomhs_yperorias_argion_nyxtas_apologistika is_locked locked_by locked_at unlocked_by unlocked_at';
async function getReviewRowsForExport(req) {
    const rows = await ProdhlomenaOrariaModel.find(buildProdhlomenaReviewFilter(req))
        .select(REVIEW_SELECT_FIELDS)
        .sort({ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 })
        .lean();

    const kodikoi = [...new Set(rows.map((r) => r.kodikos).filter(Boolean))];

    const ergazomenoi = kodikoi.length
        ? await ErgazomenoiModel.find({
              team: req.session.userTeam,
              company_kod: req.session.companyInUse,
              kodikos: mongoose.trusted({ $in: kodikoi })
          })
              .select(
                  'kodikos eponymo onoma ypokatasthma mhniaia_repo ' +
                      'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas ' +
                      'mo_oron_hmerhsias_ergasias typos_apasxolhshs typos_ebdomadas'
              )
              .lean()
        : [];

    const ergByKodikos = new Map(ergazomenoi.map((e) => [e.kodikos, e]));

    const periodStart = req.query.apo_hmeromhnia
        ? clampDateStartUtc(`${req.query.apo_hmeromhnia}T00:00:00.000Z`)
        : rows.length
          ? clampDateStartUtc(rows[0].hmeromhnia)
          : null;

    const periodEnd = req.query.eos_hmeromhnia
        ? clampDateEndUtc(`${req.query.eos_hmeromhnia}T23:59:59.999Z`)
        : rows.length
          ? clampDateEndUtc(rows[rows.length - 1].hmeromhnia)
          : null;

    const istorikoRowsByKodikos = new Map();

    if (kodikoi.length > 0 && periodStart && periodEnd) {
        const istorikoRows = await IstorikoProslhpseonAllagonModel.find({
            team: req.session.userTeam,
            company_kod: req.session.companyInUse,
            kodikos: mongoose.trusted({ $in: kodikoi }),
            $or: mongoose.trusted([
                {
                    hmeromhnia_isxyos_oron_ergasias_apo: mongoose.trusted({ $lte: periodEnd }),
                    $or: mongoose.trusted([
                        {
                            hmeromhnia_isxyos_oron_ergasias_eos: mongoose.trusted({
                                $gte: periodStart
                            })
                        },
                        { hmeromhnia_isxyos_oron_ergasias_eos: null }
                    ])
                },
                {
                    hmeromhnia_isxyos_oron_ergasias_apo: null,
                    hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({ $lte: periodEnd }),
                    $or: mongoose.trusted([
                        { hmeromhnia_allaghs_orarioy_eos: mongoose.trusted({ $gte: periodStart }) },
                        { hmeromhnia_allaghs_orarioy_eos: null }
                    ])
                },
                {
                    hmeromhnia_isxyos_oron_ergasias_apo: null,
                    hmeromhnia_allaghs_orarioy_apo: null,
                    hmeromhnia_allaghs_symbashs: mongoose.trusted({ $lte: periodEnd })
                }
            ])
        })
            .select(
                'kodikos aa_eggrafhs hmeromhnia_allaghs_symbashs ' +
                    'hmeromhnia_allaghs_orarioy_apo hmeromhnia_allaghs_orarioy_eos ' +
                    'hmeromhnia_isxyos_oron_ergasias_apo hmeromhnia_isxyos_oron_ergasias_eos ' +
                    'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas ' +
                    'mo_oron_hmerhsias_ergasias typos_apasxolhshs typos_ebdomadas ' +
                    'mhniaia_repo employment_profile_source afora_allagh_oron_ergasias createdAt'
            )
            .sort({
                kodikos: 1,
                hmeromhnia_isxyos_oron_ergasias_apo: 1,
                hmeromhnia_allaghs_orarioy_apo: 1,
                hmeromhnia_allaghs_symbashs: 1,
                createdAt: 1
            })
            .lean();

        for (const row of istorikoRows) {
            const key = String(row.kodikos || '').trim();
            if (!key) continue;
            if (!istorikoRowsByKodikos.has(key)) istorikoRowsByKodikos.set(key, []);
            istorikoRowsByKodikos.get(key).push(row);
        }
    }

    const deviations = await ProdhlomenaOrariaDeviationsModel.find(buildReviewDeviationsFilter(req))
        .sort({ ypokatasthma: 1, kodikos: 1, week_apo: 1 })
        .lean();

    const phaseContextByKodikos = await buildReviewPhaseContextByKodikos({
        team: req.session.userTeam,
        company_kod: req.session.companyInUse,
        kodikoi,
        ypokatasthma: String(req.query.ypokatasthma || '').trim(),
        periodStart,
        periodEnd
    });

    const noCardsDisplayContext =
        periodStart && periodEnd
            ? await buildNoCardsDisplayContext({
                  team: req.session.userTeam,
                  companyId: req.session.companyInUse,
                  companyKodikos: req.session.companyKodikos,
                  etos: req.session.yearInUse,
                  periodStart,
                  periodEnd
              })
            : {};

    const enrichedRows = rows.map((row) => {
        const erg = ergByKodikos.get(row.kodikos) || {};
        const istorikoRowsForEmployee =
            istorikoRowsByKodikos.get(String(row.kodikos || '').trim()) || [];
        const effectiveProfile = getOrarioTermsForDate(
            row.hmeromhnia,
            istorikoRowsForEmployee,
            erg || {}
        );
        const reviewPhaseCode = getReviewPhaseCodeForRow(row, phaseContextByKodikos);
        const normalizedRow = normalizeReviewNonFullNonWorkRow(
            row,
            effectiveProfile,
            reviewPhaseCode
        );
        const effectiveKathgoria = getEffectiveKathgoriaErgasias(normalizedRow);

        return {
            ...normalizedRow,
            kathgoria_ergasias_original: normalizedRow.kathgoria_ergasias || '',
            kathgoria_ergasias: effectiveKathgoria,
            kathgoria_ergasias_effective: effectiveKathgoria,
            noCardsDisplayStatus: resolveNoCardsDisplayStatus(
                normalizedRow,
                noCardsDisplayContext
            ),
            eponymo: erg.eponymo || '',
            onoma: erg.onoma || '',
            employeeName: `${erg.eponymo || ''} ${erg.onoma || ''}`.trim(),
            exportYpokatasthma: normalizedRow.ypokatasthma || erg.ypokatasthma || '',
            effective_mhniaia_repo: getExpectedWeeklyRepo(effectiveProfile),
            effective_is_full_time:
                reviewPhaseCode === '0'
                    ? true
                    : reviewPhaseCode === '1' || reviewPhaseCode === '2'
                      ? false
                      : isFullTimeWorkTerms(effectiveProfile),
            effective_typos_apasxolhshs: effectiveProfile.typos_apasxolhshs || '',
            effective_typos_ebdomadas: effectiveProfile.typos_ebdomadas || '',
            effective_profile_source: effectiveProfile.source || '',
            effective_profile_date: getProfileDateForDeviation(
                effectiveProfile,
                normalizedRow.hmeromhnia
            ),
            effective_profile_istoriko_id: effectiveProfile.istorikoId || null
        };
    });

    enrichedRows.__deviations = deviations.map(mapDeviationForReviewExport);
    return enrichedRows;
}
function makeReviewPdfDocument() {
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        // Μικρότερα margins ώστε ο πίνακας να πιάνει πραγματικά όλο το πλάτος
        // της A4 landscape και να μην μένει κενός χώρος δεξιά.
        margins: { top: 18, left: 10, right: 10, bottom: 18 },
        bufferPages: true
    });

    const fontCandidates = [
        {
            regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        },
        {
            regular: path.join(process.cwd(), 'fonts/DejaVuSans/DejaVuSans.ttf'),
            bold: path.join(process.cwd(), 'fonts/DejaVuSans/DejaVuSans-Bold.ttf')
        },
        {
            regular: path.join(process.cwd(), 'fonts/JetBrainsMono/JetBrainsMono-Regular.ttf'),
            bold: path.join(process.cwd(), 'fonts/JetBrainsMono/JetBrainsMono-Bold.ttf')
        }
    ];

    const selectedFonts = fontCandidates.find(
        (candidate) => fs.existsSync(candidate.regular) && fs.existsSync(candidate.bold)
    );

    if (selectedFonts) {
        doc.registerFont('ReviewRegular', selectedFonts.regular);
        doc.registerFont('ReviewBold', selectedFonts.bold);
        doc.font('ReviewRegular');
    } else {
        doc.font('Helvetica');
    }

    return doc;
}

// ============================================================================
// E7N REST helpers
// ============================================================================
function parseErganiSubmitDate(value) {
    if (!value) return null;

    const raw = String(value).trim();
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);

    if (match) {
        const [, dd, mm, yyyy, hh = '00', min = '00'] = match;
        const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeFilenamePart(value, fallback = 'UNKNOWN') {
    const cleaned = String(value || fallback)
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 80);

    return cleaned || fallback;
}

async function saveSubmittedErganiPdfToS3({
    pdfBuffer,
    contentType,
    ergazomenos,
    companyData,
    restResult,
    submissionFolder = 'E7N'
}) {
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        return {
            pdfSaved: false,
            pdfFilename: null,
            pdfS3Key: null,
            pdfS3Url: null,
            pdfRelativePath: null,
            pdfSizeBytes: 0,
            pdfContentType: contentType || 'application/pdf',
            pdfSaveError: 'Δεν υπάρχει PDF buffer από το ΕΡΓΑΝΗ.'
        };
    }

    try {
        const { uploadBufferToS3 } = require('../../utils/s3Helper');

        const employeeId = safeFilenamePart(ergazomenos?._id || ergazomenos?.kodikos || 'E7N');
        const eponymo = safeFilenamePart(ergazomenos?.eponymo || 'UNKNOWN');
        const onoma = safeFilenamePart(ergazomenos?.onoma || 'UNKNOWN');
        const protocol = safeFilenamePart(restResult?.protocol || 'NO_PROTOCOL');
        const datePart = safeFilenamePart(String(restResult?.submitDate || '').replace(/\//g, '-'));

        const filename = `${employeeId}_${eponymo}_${onoma}_${protocol}_${datePart}.pdf`;
        const companyNameClean = safeFilenamePart(
            companyData?.eponymia || companyData?.perigrafh || 'UNKNOWN'
        );
        const companyKod = safeFilenamePart(companyData?.kod || companyData?.kodikos || 'UNKNOWN');
        const team = safeFilenamePart(ergazomenos?.team || 'NO_TEAM');

        const s3Key = `ergani-submissions/${team}/${companyKod}_${companyNameClean}/${safeFilenamePart(submissionFolder, 'E7N')}/${filename}`;

        const uploadResult = await uploadBufferToS3(
            pdfBuffer,
            s3Key,
            contentType || 'application/pdf'
        );

        return {
            pdfSaved: true,
            pdfFilename: filename,
            pdfS3Key: uploadResult.s3Key,
            pdfS3Url: uploadResult.s3Url || uploadResult.localPath || null,
            pdfRelativePath: uploadResult.s3Key,
            pdfSizeBytes: pdfBuffer.length,
            pdfContentType: contentType || 'application/pdf',
            pdfSaveError: null
        };
    } catch (err) {
        return {
            pdfSaved: false,
            pdfFilename: null,
            pdfS3Key: null,
            pdfS3Url: null,
            pdfRelativePath: null,
            pdfSizeBytes: pdfBuffer.length,
            pdfContentType: contentType || 'application/pdf',
            pdfSaveError: err.message || String(err)
        };
    }
}

function sanitizeErganiResultForResponse(restResult) {
    if (!restResult) return null;

    return {
        success: restResult.success === true,
        submission: restResult.submission || null,
        protocol: restResult.protocol || null,
        submitDate: restResult.submitDate || null,
        id: restResult.id || null,
        error: restResult.error || null,
        raw: restResult.raw || null,
        submittedPdf: restResult.submittedPdf
            ? {
                  fetched: !!restResult.submittedPdf.buffer,
                  contentType: restResult.submittedPdf.contentType || null,
                  sizeBytes: restResult.submittedPdf.buffer?.length || 0,
                  error: restResult.submittedPdf.error || null,
                  pdfDeferred: restResult.submittedPdf.pdfDeferred === true,
                  source: restResult.submittedPdf.source || null
              }
            : null
    };
}

function getErganiPdfDeferredWarning(pdfDeferred) {
    return pdfDeferred
        ? 'Η υποβολή ολοκληρώθηκε επιτυχώς. Το PDF δεν ήταν άμεσα διαθέσιμο από το ΕΡΓΑΝΗ και μπορεί να ανακτηθεί αργότερα από το ιστορικό ΕΡΓΑΝΗ.'
        : null;
}

function getErganiS3BucketFromUrl(url) {
    const raw = String(url || '').trim();
    if (!raw || raw.startsWith('file://')) return '';

    try {
        const parsed = new URL(raw);

        // Virtual-hosted-style S3 URL:
        // https://bucket-name.s3.eu-central-1.amazonaws.com/key
        const virtualHostedMatch = parsed.hostname.match(
            /^(.+)\.s3[.-][a-z0-9-]+\.amazonaws\.com$/i
        );
        if (virtualHostedMatch?.[1]) {
            return virtualHostedMatch[1];
        }

        // Path-style S3 URL:
        // https://s3.eu-central-1.amazonaws.com/bucket-name/key
        const pathStyleMatch = parsed.hostname.match(/^s3[.-][a-z0-9-]+\.amazonaws\.com$/i);
        if (pathStyleMatch) {
            return parsed.pathname.split('/').filter(Boolean)[0] || '';
        }
    } catch (_) {}

    return '';
}

function getErganiS3Bucket(rec = {}) {
    return (
        process.env.AWS_S3_BUCKET ||
        process.env.AWS_S3_BUCKET_NAME ||
        process.env.S3_BUCKET ||
        process.env.S3_BUCKET_NAME ||
        process.env.AWS_BUCKET ||
        process.env.AWS_BUCKET_NAME ||
        getErganiS3BucketFromUrl(rec.pdf_s3_url) ||
        'payroll-s3-uploader'
    );
}

function getErganiPdfRoute(id) {
    return id ? `/ergazomenoi/ergazomenoi/ergani/pdf/${id}` : '';
}

function formatDateDdMmYyyy(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();

    return `${dd}/${mm}/${yyyy}`;
}

class erganhController {
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

            const periodRec = await PeriodsModel.findOne({
                xrhsh: req.session.yearInUse,
                kodikos: req.session.periodInUse
            }).lean();

            res.render('ergazomenoi/programmata/apologistikosPinakasOrarion', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                periodRec: periodRec,
                rec: {}
            });
        } catch (error) {
            console.log(
                'Error into programmataController -> mainApologistikosPinakasForm :',
                error
            );
        }
    };

    static mainApologistikosPinakasYperorionForm = async (req, res) => {
        const locals = {
            title: 'Απολογιστικός Πίνακας Υπερωριών',
            description: 'Web Payroll Solutions'
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'ApologistikosPinakasYperorion'
            }).exec();

            const passwordsData = await PasswordsModel.find({
                companykod_object: companyId,
                kodikos: '0001'
            });

            const cleanedPasswordsData = passwordsData.map((data) => data._doc);

            const periodRec = await PeriodsModel.findOne({
                xrhsh: req.session.yearInUse,
                kodikos: req.session.periodInUse
            }).lean();

            res.render('ergazomenoi/programmata/apologistikosPinakasYperorion', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                periodRec: periodRec,
                rec: {}
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

            const periodRec = await PeriodsModel.findOne({
                xrhsh: req.session.yearInUse,
                kodikos: req.session.periodInUse
            }).lean();

            res.render('ergazomenoi/programmata/lhpshOrarionApoErganh', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                rec: {},
                periodRec
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
            let periodInUseDescr = req.session.periodInUseDescr;
            const yearInUse = req.session.yearInUse;

            // ============================================================
            // ✅ Έλεγχος μήνα από fromDate ("dd/mm/yyyy")
            // Αν ο μήνας ταιριάζει με το session.periodInUseDescr → χρήση session.
            // Αλλιώς → ανάκτηση perigrafh από PeriodsModel (xrhsh + kodikos).
            // ============================================================

            const _monthStr = fromDate ? fromDate.split('/')[1].padStart(2, '0') : null;

            // Βρες το αντίστοιχο Period για να ξέρουμε το "σωστό" perigrafh του μήνα
            let _periodForMonth = null;
            if (_monthStr) {
                _periodForMonth = await PeriodsModel.findOne({
                    xrhsh: yearInUse,
                    kodikos: _monthStr
                }).lean();
            }

            if (_periodForMonth && _periodForMonth.perigrafh !== req.session.periodInUseDescr) {
                // Ο μήνας του apo_hmeromhnia ΔΕΝ είναι ίδιος με την περίοδο της session
                periodInUseDescr = _periodForMonth.perigrafh;
            }

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

            const periodRec = await PeriodsModel.findOne({
                xrhsh: req.session.yearInUse,
                kodikos: req.session.periodInUse
            }).lean();

            res.render('ergazomenoi/programmata/lhpshOrarionApoKartes', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                passwords: cleanedPasswordsData,
                rec: {},
                periodRec
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
            let periodInUseDescr = req.session.periodInUseDescr;
            const yearInUse = req.session.yearInUse;

            // ============================================================
            // ✅ Έλεγχος μήνα από fromDate ("dd/mm/yyyy")
            // Αν ο μήνας ταιριάζει με το session.periodInUseDescr → χρήση session.
            // Αλλιώς → ανάκτηση perigrafh από PeriodsModel (xrhsh + kodikos).
            // ============================================================

            const _monthStr = apoHmeromhnia ? apoHmeromhnia.split('/')[1].padStart(2, '0') : null;

            // Βρες το αντίστοιχο Period για να ξέρουμε το "σωστό" perigrafh του μήνα
            let _periodForMonth = null;
            if (_monthStr) {
                _periodForMonth = await PeriodsModel.findOne({
                    xrhsh: yearInUse,
                    kodikos: _monthStr
                }).lean();
            }

            if (_periodForMonth && _periodForMonth.perigrafh !== req.session.periodInUseDescr) {
                // Ο μήνας του apo_hmeromhnia ΔΕΝ είναι ίδιος με την περίοδο της session
                periodInUseDescr = _periodForMonth.perigrafh;
                console.log(
                    `[lhpshOrarionApoErganh] ℹ️ Χρήση periodInUseDescr από PeriodsModel: "${periodInUseDescr}" ` +
                        `(session ήταν: "${req.session.periodInUseDescr}")`
                );
            }

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

            const periodRec = await PeriodsModel.findOne({
                xrhsh: req.session.yearInUse,
                kodikos: req.session.periodInUse
            }).lean();

            const companyRec = await CompaniesModel.findById(companyId)
                .select('xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta')
                .lean();

            const xronosEpitrepomenhsProorhsApoxorhshsSeLepta = Number(
                companyRec?.xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta || 0
            );

            res.render('ergazomenoi/programmata/calcApasxolhseisPeriodoy', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam: sessionTeam,
                companyId: companyId,
                rec: {},
                periodRec,
                xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta:
                    xronosEpitrepomenhsProorhsApoxorhshsSeLepta
            });
        } catch (error) {
            console.log('Error into erganhController -> mainCalcApasxolhseisPeriodoyForm :', error);
        }
    };

    static mainElegxosApasxolhseonPeriodoyForm = async (req, res) => {
        const locals = {
            title: 'Έλεγχος Απασχολήσεων Περιόδου',
            description: 'Web Payroll Solutions'
        };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const sessionTeam = req.session.userTeam;

        try {
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'ElegxosApasxolhseonPeriodoy'
            }).exec();

            const periodRec = await PeriodsModel.findOne({
                xrhsh: req.session.yearInUse,
                kodikos: req.session.periodInUse
            }).lean();

            res.render('ergazomenoi/programmata/elegxosApasxolhseonPeriodoy', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                sessionTeam,
                companyId,
                userRole: req.session.userRole,
                periodRec,
                rec: {}
            });
        } catch (error) {
            console.log(
                'Error into erganhController -> mainElegxosApasxolhseonPeriodoyForm :',
                error
            );

            res.status(500).send('Σφάλμα κατά την εμφάνιση της φόρμας ελέγχου απασχολήσεων.');
        }
    };

    static getProdhlomenaOrariaForReview = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;

            const {
                apo_hmeromhnia,
                eos_hmeromhnia,
                ypokatasthma,
                kodikos,
                only_apologistiko,
                only_nyxta,
                only_argia,
                only_yperergasia,
                page = 1,
                limit = 50
            } = req.query;

            const pageNum = Math.max(parseInt(page, 10) || 1, 1);
            const limitNum = Math.min(Math.max(parseInt(limit, 10) || 5000, 10), 10000);
            const skip = (pageNum - 1) * limitNum;

            const filter = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (apo_hmeromhnia && eos_hmeromhnia) {
                filter.hmeromhnia = mongoose.trusted({
                    $gte: new Date(`${apo_hmeromhnia}T00:00:00.000Z`),
                    $lte: new Date(`${eos_hmeromhnia}T23:59:59.999Z`)
                });
            }

            if (ypokatasthma && String(ypokatasthma).trim() !== '') {
                filter.ypokatasthma = String(ypokatasthma).trim().padStart(4, '0');
            }

            if (kodikos && String(kodikos).trim() !== '') {
                filter.kodikos = String(kodikos).trim();
            }

            const andFilters = [];

            if (only_apologistiko === 'true') {
                andFilters.push({ apologistiko_biblio: true });
            }

            if (only_nyxta === 'true') {
                andFilters.push({
                    $or: [
                        { ores_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                        { ores_yperergasias_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                        {
                            ores_nominhs_yperorias_nyxtas_apologistika: mongoose.trusted({ $gt: 0 })
                        },
                        {
                            ores_paranomhs_yperorias_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        }
                    ]
                });
            }

            if (only_argia === 'true') {
                andFilters.push({
                    $or: [
                        { argia: true },
                        { kyriakes_apologistika: true },
                        { ores_argion_prosayxhsh_apologistika: mongoose.trusted({ $gt: 0 }) },
                        { ores_argion_ergasia_apologistika: mongoose.trusted({ $gt: 0 }) },
                        { ores_yperergasias_argion_apologistika: mongoose.trusted({ $gt: 0 }) },
                        {
                            ores_yperergasias_argion_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        },
                        {
                            ores_nominhs_yperorias_argion_apologistika: mongoose.trusted({ $gt: 0 })
                        },
                        {
                            ores_nominhs_yperorias_argion_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        },
                        {
                            ores_paranomhs_yperorias_argion_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        },
                        {
                            ores_paranomhs_yperorias_argion_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        }
                    ]
                });
            }

            if (only_yperergasia === 'true') {
                andFilters.push({
                    $or: [
                        { ores_prostheths_ergasias_apologistika: mongoose.trusted({ $gt: 0 }) },
                        { ores_yperergasias_apologistika: mongoose.trusted({ $gt: 0 }) },
                        { ores_yperergasias_nyxtas_apologistika: mongoose.trusted({ $gt: 0 }) },
                        { ores_yperergasias_argion_apologistika: mongoose.trusted({ $gt: 0 }) },
                        {
                            ores_yperergasias_argion_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        },
                        { ores_nominhs_yperorias_apologistika: mongoose.trusted({ $gt: 0 }) },
                        {
                            ores_nominhs_yperorias_nyxtas_apologistika: mongoose.trusted({ $gt: 0 })
                        },
                        {
                            ores_nominhs_yperorias_argion_apologistika: mongoose.trusted({ $gt: 0 })
                        },
                        {
                            ores_nominhs_yperorias_argion_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        },
                        { ores_paranomhs_yperorias_apologistika: mongoose.trusted({ $gt: 0 }) },
                        {
                            ores_paranomhs_yperorias_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        },
                        {
                            ores_paranomhs_yperorias_argion_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        },
                        {
                            ores_paranomhs_yperorias_argion_nyxtas_apologistika: mongoose.trusted({
                                $gt: 0
                            })
                        }
                    ]
                });
            }

            if (andFilters.length > 0) {
                filter.$and = mongoose.trusted(andFilters);
            }

            const [rows, total] = await Promise.all([
                ProdhlomenaOrariaModel.find(filter)
                    .select(
                        'ypokatasthma kodikos hmeromhnia kathgoria_ergasias kathgoria_ergasias_apologistika ' +
                            'apo_ora_01 eos_ora_01 apo_ora_02 eos_ora_02 apo_ora_03 eos_ora_03 ' +
                            'cards_apo_ora_01 cards_eos_ora_01 cards_apo_ora_02 cards_eos_ora_02 cards_apo_ora_03 cards_eos_ora_03 ' +
                            'apo_ora_01_apologistika eos_ora_01_apologistika apo_ora_02_apologistika eos_ora_02_apologistika apo_ora_03_apologistika eos_ora_03_apologistika ' +
                            'repo argia perigrafh_argias apologistiko_biblio kyriakes_apologistika ' +
                            'ores_ergasias cards_ores_ergasias ores_apoysias_apologistika ores_nyxtas_apologistika ores_argion_prosayxhsh_apologistika ores_argion_ergasia_apologistika ' +
                            'ores_prostheths_ergasias_apologistika ' +
                            'ores_yperergasias_apologistika ores_yperergasias_nyxtas_apologistika ores_yperergasias_argion_apologistika ores_yperergasias_argion_nyxtas_apologistika ' +
                            'ores_nominhs_yperorias_apologistika ores_nominhs_yperorias_nyxtas_apologistika ores_nominhs_yperorias_argion_apologistika ores_nominhs_yperorias_argion_nyxtas_apologistika ' +
                            'ores_paranomhs_yperorias_apologistika ores_paranomhs_yperorias_nyxtas_apologistika ores_paranomhs_yperorias_argion_apologistika ores_paranomhs_yperorias_argion_nyxtas_apologistika ' +
                            'repo_apologistika adeia_apologistika kathgoria_adeias_apologistika astheneia_apologistika ' +
                            'ores_ergasias_apologistika ores_argion_prosayxhsh_apologistika ores_argion_ergasia_apologistika ' +
                            'is_locked locked_by locked_at unlocked_by unlocked_at'
                    )
                    .sort({ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                ProdhlomenaOrariaModel.countDocuments(filter)
            ]);

            const kodikoiRows = [...new Set(rows.map((r) => r.kodikos).filter(Boolean))];

            const ergazomenoi = await ErgazomenoiModel.find({
                team: sessionTeam,
                company_kod: companyId,
                kodikos: mongoose.trusted({ $in: kodikoiRows })
            })
                .select(
                    'kodikos eponymo onoma mhniaia_repo ' +
                        'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas ' +
                        'mo_oron_hmerhsias_ergasias typos_apasxolhshs typos_ebdomadas'
                )
                .lean();

            const ergByKodikos = new Map(ergazomenoi.map((e) => [e.kodikos, e]));

            // ============================================================
            // Ιστορικό profile ανά ημέρα για το review.
            // Δεν αρκεί η τρέχουσα εικόνα του ErgazomenoiModel, γιατί μέσα
            // στην περίοδο μπορεί να έχει αλλάξει 5ήμερο/6ήμερο ή
            // πλήρης/μερική/εκ περιτροπής απασχόληση.
            // ============================================================
            const reviewPeriodStart = apo_hmeromhnia
                ? clampDateStartUtc(`${apo_hmeromhnia}T00:00:00.000Z`)
                : rows.length > 0
                  ? clampDateStartUtc(rows[0].hmeromhnia)
                  : null;

            const reviewPeriodEnd = eos_hmeromhnia
                ? clampDateEndUtc(`${eos_hmeromhnia}T23:59:59.999Z`)
                : rows.length > 0
                  ? clampDateEndUtc(rows[rows.length - 1].hmeromhnia)
                  : null;

            const istorikoRowsByKodikos = new Map();

            if (
                IstorikoProslhpseonAllagonModel &&
                kodikoiRows.length > 0 &&
                reviewPeriodStart &&
                reviewPeriodEnd
            ) {
                const istorikoRows = await IstorikoProslhpseonAllagonModel.find({
                    team: sessionTeam,
                    company_kod: companyId,
                    kodikos: mongoose.trusted({ $in: kodikoiRows }),
                    $or: mongoose.trusted([
                        {
                            hmeromhnia_isxyos_oron_ergasias_apo: mongoose.trusted({
                                $lte: reviewPeriodEnd
                            }),
                            $or: mongoose.trusted([
                                {
                                    hmeromhnia_isxyos_oron_ergasias_eos: mongoose.trusted({
                                        $gte: reviewPeriodStart
                                    })
                                },
                                { hmeromhnia_isxyos_oron_ergasias_eos: null }
                            ])
                        },
                        {
                            hmeromhnia_isxyos_oron_ergasias_apo: null,
                            hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({
                                $lte: reviewPeriodEnd
                            }),
                            $or: mongoose.trusted([
                                {
                                    hmeromhnia_allaghs_orarioy_eos: mongoose.trusted({
                                        $gte: reviewPeriodStart
                                    })
                                },
                                { hmeromhnia_allaghs_orarioy_eos: null }
                            ])
                        },
                        {
                            hmeromhnia_isxyos_oron_ergasias_apo: null,
                            hmeromhnia_allaghs_orarioy_apo: null,
                            hmeromhnia_allaghs_symbashs: mongoose.trusted({
                                $lte: reviewPeriodEnd
                            })
                        }
                    ])
                })
                    .select(
                        'kodikos aa_eggrafhs hmeromhnia_allaghs_symbashs ' +
                            'hmeromhnia_allaghs_orarioy_apo hmeromhnia_allaghs_orarioy_eos ' +
                            'hmeromhnia_isxyos_oron_ergasias_apo hmeromhnia_isxyos_oron_ergasias_eos ' +
                            'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas ' +
                            'mo_oron_hmerhsias_ergasias typos_apasxolhshs typos_ebdomadas ' +
                            'mhniaia_repo employment_profile_source afora_allagh_oron_ergasias createdAt'
                    )
                    .sort({
                        kodikos: 1,
                        hmeromhnia_isxyos_oron_ergasias_apo: 1,
                        hmeromhnia_allaghs_orarioy_apo: 1,
                        hmeromhnia_allaghs_symbashs: 1,
                        createdAt: 1
                    })
                    .lean();

                for (const row of istorikoRows) {
                    const key = String(row.kodikos || '').trim();
                    if (!key) continue;
                    if (!istorikoRowsByKodikos.has(key)) istorikoRowsByKodikos.set(key, []);
                    istorikoRowsByKodikos.get(key).push(row);
                }
            }

            const deviationsFilter = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (apo_hmeromhnia && eos_hmeromhnia) {
                deviationsFilter.period_apo = asDateOnlyUtc(`${apo_hmeromhnia}T00:00:00.000Z`);
                deviationsFilter.period_eos = asDateOnlyUtc(
                    `${eos_hmeromhnia}T23:59:59.999Z`,
                    true
                );
            }

            if (ypokatasthma && String(ypokatasthma).trim() !== '') {
                deviationsFilter.ypokatasthma = String(ypokatasthma).trim().padStart(4, '0');
            }

            if (kodikos && String(kodikos).trim() !== '') {
                deviationsFilter.kodikos = String(kodikos).trim();
            }

            const deviations = await ProdhlomenaOrariaDeviationsModel.find(deviationsFilter)
                .sort({ ypokatasthma: 1, kodikos: 1, week_apo: 1 })
                .lean();

            const phaseContextByKodikos = await buildReviewPhaseContextByKodikos({
                team: sessionTeam,
                company_kod: companyId,
                kodikoi: kodikoiRows,
                ypokatasthma: String(ypokatasthma || '').trim(),
                periodStart: reviewPeriodStart,
                periodEnd: reviewPeriodEnd
            });

            const noCardsDisplayContext =
                reviewPeriodStart && reviewPeriodEnd
                    ? await buildNoCardsDisplayContext({
                          team: sessionTeam,
                          companyId,
                          companyKodikos: req.session.companyKodikos,
                          etos: req.session.yearInUse,
                          periodStart: reviewPeriodStart,
                          periodEnd: reviewPeriodEnd
                      })
                    : {};

            const enrichedRows = rows.map((r) => {
                const erg = ergByKodikos.get(r.kodikos);
                const istorikoRowsForEmployee =
                    istorikoRowsByKodikos.get(String(r.kodikos || '').trim()) || [];
                const effectiveProfile = getOrarioTermsForDate(
                    r.hmeromhnia,
                    istorikoRowsForEmployee,
                    erg || {}
                );
                const reviewPhaseCode = getReviewPhaseCodeForRow(r, phaseContextByKodikos);
                const normalizedRow = normalizeReviewNonFullNonWorkRow(
                    r,
                    effectiveProfile,
                    reviewPhaseCode
                );
                const effectiveKathgoria = getEffectiveKathgoriaErgasias(normalizedRow);

                return {
                    ...normalizedRow,
                    kathgoria_ergasias_original: normalizedRow.kathgoria_ergasias || '',
                    kathgoria_ergasias: effectiveKathgoria,
                    kathgoria_ergasias_effective: effectiveKathgoria,
                    noCardsDisplayStatus: resolveNoCardsDisplayStatus(
                        normalizedRow,
                        noCardsDisplayContext
                    ),
                    eponymo: erg?.eponymo || '',
                    onoma: erg?.onoma || '',

                    // Ιστορικά σωστό profile για την ΗΜΕΡΑ της εγγραφής.
                    // Χρησιμοποιείται από το frontend για display τύπου:
                    // - πλήρης + μη εργασία: ΑΝΑΠΑΥΣΗ/ΡΕΠΟ
                    // - μερική/εκ περιτροπής + μη εργασία: ΜΗ ΕΡΓΑΣΙΑ
                    effective_mhniaia_repo: getExpectedWeeklyRepo(effectiveProfile),
                    effective_is_full_time:
                        reviewPhaseCode === '0'
                            ? true
                            : reviewPhaseCode === '1' || reviewPhaseCode === '2'
                              ? false
                              : isFullTimeWorkTerms(effectiveProfile),
                    effective_typos_apasxolhshs: effectiveProfile.typos_apasxolhshs || '',
                    effective_typos_ebdomadas: effectiveProfile.typos_ebdomadas || '',
                    effective_profile_source: effectiveProfile.source || '',
                    effective_profile_date: getProfileDateForDeviation(
                        effectiveProfile,
                        normalizedRow.hmeromhnia
                    ),
                    effective_profile_istoriko_id: effectiveProfile.istorikoId || null
                };
            });

            const enrichedDeviations = deviations.map((d) => ({
                _id: d._id,
                ypokatasthma: d.ypokatasthma || '',
                kodikos: d.kodikos || '',
                eponymo: d.eponymo || '',
                onoma: d.onoma || '',
                week_apo: d.week_apo,
                week_eos: d.week_eos,
                weekStart: dateKeyUtc(d.week_apo),
                weekEnd: dateKeyUtc(d.week_eos),
                expected_repo: Number(d.expected_repo || 0),
                actual_repo: Number(d.actual_repo || 0),
                profile_changed_inside_week: d.profile_changed_inside_week === true,
                excess_repo: Number(d.excess_repo || 0),
                effective_mhniaia_repo: Number(d.effective_mhniaia_repo || d.expected_repo || 0),
                effective_typos_apasxolhshs: d.effective_typos_apasxolhshs || '',
                effective_profile_source: d.effective_profile_source || '',
                effective_profile_date: d.effective_profile_date,
                effective_profile_istoriko_id: d.effective_profile_istoriko_id || null,
                previous_mhniaia_repo: Number(d.previous_mhniaia_repo || 0),
                previous_typos_apasxolhshs: d.previous_typos_apasxolhshs || '',
                previous_profile_source: d.previous_profile_source || '',
                previous_profile_date: d.previous_profile_date,
                previous_profile_istoriko_id: d.previous_profile_istoriko_id || null,
                deviation_type: d.deviation_type || '',
                note: d.note || ''
            }));

            return res.json({
                success: true,
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                rows: enrichedRows,
                deviations: enrichedDeviations
            });
        } catch (error) {
            console.error('[getProdhlomenaOrariaForReview] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την ανάκτηση των απασχολήσεων.',
                error: error.message
            });
        }
    };

    static getApasxoliseisPolicyCatalog = async (_req, res) => {
        try {
            const validation = validateApasxoliseisPolicyCatalog();

            if (!validation.isValid) {
                return res.status(500).json({
                    success: false,
                    catalogVersion: 'foundation:v1',
                    validation,
                    errors: validation.errors
                });
            }

            return res.json({
                success: true,
                catalogVersion: 'foundation:v1',
                validation,
                categories: POLICY_CATEGORIES,
                modes: getPolicyModes(),
                resultStatuses: getPolicyResultStatuses(),
                policies: getApasxoliseisPolicyCatalogDefinitions()
            });
        } catch (error) {
            console.error('[getApasxoliseisPolicyCatalog] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την ανάκτηση του policy catalog απασχολήσεων.',
                error: error.message
            });
        }
    };

    static getProdhlomenaOrariaPolicyPreview = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;

            const {
                apo_hmeromhnia,
                eos_hmeromhnia,
                ypokatasthma,
                kodikos,
                page = 1,
                limit = 50,
                policy_code,
                mode
            } = req.query;

            const pageNum = Math.max(parseInt(page, 10) || 1, 1);
            const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
            const skip = (pageNum - 1) * limitNum;
            const filter = {
                team: sessionTeam,
                company_kod: companyId
            };
            let requestedPeriodStart = null;
            let requestedPeriodEnd = null;

            if (apo_hmeromhnia || eos_hmeromhnia) {
                const apoKey = String(apo_hmeromhnia || '').trim();
                const eosKey = String(eos_hmeromhnia || '').trim();

                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(apoKey) ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(eosKey)
                ) {
                    return res.status(400).json({
                        success: false,
                        message: 'Μη έγκυρο εύρος ημερομηνιών.'
                    });
                }

                requestedPeriodStart = new Date(`${apoKey}T00:00:00.000Z`);
                requestedPeriodEnd = new Date(`${eosKey}T23:59:59.999Z`);

                if (
                    Number.isNaN(requestedPeriodStart.getTime()) ||
                    Number.isNaN(requestedPeriodEnd.getTime()) ||
                    requestedPeriodStart.toISOString().slice(0, 10) !== apoKey ||
                    requestedPeriodEnd.toISOString().slice(0, 10) !== eosKey ||
                    requestedPeriodStart > requestedPeriodEnd
                ) {
                    return res.status(400).json({
                        success: false,
                        message: 'Μη έγκυρο εύρος ημερομηνιών.'
                    });
                }

                filter.hmeromhnia = mongoose.trusted({
                    $gte: requestedPeriodStart,
                    $lte: requestedPeriodEnd
                });
            }

            if (ypokatasthma && String(ypokatasthma).trim() !== '') {
                filter.ypokatasthma = String(ypokatasthma).trim().padStart(4, '0');
            }

            if (kodikos && String(kodikos).trim() !== '') {
                filter.kodikos = String(kodikos).trim();
            }

            const [rows, total] = await Promise.all([
                ProdhlomenaOrariaModel.find(filter)
                    .select(
                        'team company_kod ypokatasthma kodikos hmeromhnia ' +
                            'kathgoria_ergasias apo_ora_01 eos_ora_01 apo_ora_02 eos_ora_02 apo_ora_03 eos_ora_03 ' +
                            'apo_ora_01_break eos_ora_01_break apo_ora_02_break eos_ora_02_break apo_ora_03_break eos_ora_03_break ' +
                            'ores_ergasias repo adeia kathgoria_adeias astheneia ' +
                            'cards_apo_ora_01 cards_eos_ora_01 cards_apo_ora_02 cards_eos_ora_02 cards_apo_ora_03 cards_eos_ora_03 cards_ores_ergasias ' +
                            'apo_ora_01_apologistika eos_ora_01_apologistika apo_ora_02_apologistika eos_ora_02_apologistika apo_ora_03_apologistika eos_ora_03_apologistika ' +
                            'kathgoria_ergasias_apologistika ores_ergasias_apologistika apologistiko_biblio ' +
                            'repo_apologistika adeia_apologistika kathgoria_adeias_apologistika astheneia_apologistika argia kyriakes_apologistika ores_apoysias_apologistika ' +
                            'is_locked locked_by locked_at'
                    )
                    .sort({ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                ProdhlomenaOrariaModel.countDocuments(filter)
            ]);

            const kodikoiRows = [
                ...new Set(
                    rows
                        .map((row) => String(row.kodikos || '').trim())
                        .filter((rowKodikos) => rowKodikos !== '')
                )
            ];
            const employeeContextByKodikos = new Map();

            if (kodikoiRows.length > 0) {
                const employeeRows = await ErgazomenoiModel.find({
                    team: sessionTeam,
                    company_kod: companyId,
                    kodikos: mongoose.trusted({ $in: kodikoiRows })
                })
                    .select('kodikos karta_ergasias')
                    .lean();

                employeeRows.forEach((employee) => {
                    const employeeKodikos = String(employee.kodikos || '').trim();
                    if (!employeeKodikos) return;

                    employeeContextByKodikos.set(employeeKodikos, {
                        karta_ergasias: employee.karta_ergasias
                    });
                });
            }

            const rowStartDates = rows
                .map((row) => clampDateStartUtc(row.hmeromhnia))
                .filter(Boolean);
            const rowEndDates = rows
                .map((row) => clampDateEndUtc(row.hmeromhnia))
                .filter(Boolean);
            const periodStart =
                requestedPeriodStart ||
                (rowStartDates.length > 0
                    ? new Date(Math.min(...rowStartDates.map((date) => date.getTime())))
                    : null);
            const periodEnd =
                requestedPeriodEnd ||
                (rowEndDates.length > 0
                    ? new Date(Math.max(...rowEndDates.map((date) => date.getTime())))
                    : null);
            const scenarioContext =
                periodStart && periodEnd
                    ? await buildNoCardsDisplayContext({
                          team: sessionTeam,
                          companyId,
                          companyKodikos: req.session.companyKodikos,
                          etos: req.session.yearInUse,
                          periodStart,
                          periodEnd
                    })
                    : { companyFlags: {}, argiesByDateKey: new Map() };
            const companyFlags = scenarioContext.companyFlags || {};
            const normalizedCompanyFlags = {
                companyWorksOnMandatoryHoliday:
                    companyFlags.apasxolhsh_kata_tis_argies === true,
                companyWorksOnOptionalHoliday:
                    companyFlags.leitoyrgia_stis_mh_ypoxreotikes_argies === true
            };
            const previewRows = buildApasxoliseisPolicyPreviewRows({
                rows,
                argiesByDateKey: scenarioContext.argiesByDateKey || new Map(),
                companyFlags: normalizedCompanyFlags,
                employeeContextByKodikos,
                policyCode: String(policy_code || '').trim(),
                defaultPolicyMode: String(mode || '').trim()
            });
            const summary = summarizeApasxoliseisPolicyPreviewResults(previewRows);
            const grouping = buildApasxoliseisPolicyPreviewGrouping(previewRows);

            return res.json({
                success: true,
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                count: previewRows.length,
                summary,
                grouping,
                rows: previewRows
            });
        } catch (error) {
            console.error('[getProdhlomenaOrariaPolicyPreview] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την παραγωγή προεπισκόπησης πολιτικών απασχολήσεων.',
                error: error.message
            });
        }
    };

    static getProdhlomenaOrariaPolicyPreviewApprovals = async (req, res) => {
        try {
            const result = await listPolicyPreviewApprovalRecords({
                session: req.session,
                filters: req.query,
                page: req.query.page,
                limit: req.query.limit
            });

            return res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error('[getProdhlomenaOrariaPolicyPreviewApprovals] ❌', error);

            return res.status(error.statusCode || 500).json({
                success: false,
                message:
                    error.statusCode && error.statusCode < 500
                        ? error.message
                        : 'Σφάλμα κατά την ανάκτηση των αποφάσεων πολιτικών απασχολήσεων.'
            });
        }
    };

    static createProdhlomenaOrariaPolicyPreviewApproval = async (req, res) => {
        try {
            const approval = await createPolicyPreviewApprovalRecord({
                session: req.session,
                payload: req.body
            });

            return res.status(201).json({
                success: true,
                approval_id: approval._id,
                message: 'Η απόφαση καταγράφηκε επιτυχώς.'
            });
        } catch (error) {
            console.error('[createProdhlomenaOrariaPolicyPreviewApproval] ❌', error);

            return res.status(error.statusCode || 500).json({
                success: false,
                message:
                    error.statusCode && error.statusCode < 500
                        ? error.message
                        : 'Σφάλμα κατά την καταγραφή της απόφασης πολιτικής απασχολήσεων.'
            });
        }
    };

    static getProdhlomenaOrariaScenarioClassifications = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;

            const {
                apo_hmeromhnia,
                eos_hmeromhnia,
                ypokatasthma,
                kodikos,
                page = 1,
                limit = 50
            } = req.query;

            const pageNum = Math.max(parseInt(page, 10) || 1, 1);
            const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
            const skip = (pageNum - 1) * limitNum;
            const filter = {
                team: sessionTeam,
                company_kod: companyId
            };
            let requestedPeriodStart = null;
            let requestedPeriodEnd = null;

            if (apo_hmeromhnia || eos_hmeromhnia) {
                const apoKey = String(apo_hmeromhnia || '').trim();
                const eosKey = String(eos_hmeromhnia || '').trim();

                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(apoKey) ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(eosKey)
                ) {
                    return res.status(400).json({
                        success: false,
                        message: 'Μη έγκυρο εύρος ημερομηνιών.'
                    });
                }

                requestedPeriodStart = new Date(`${apoKey}T00:00:00.000Z`);
                requestedPeriodEnd = new Date(`${eosKey}T23:59:59.999Z`);

                if (
                    Number.isNaN(requestedPeriodStart.getTime()) ||
                    Number.isNaN(requestedPeriodEnd.getTime()) ||
                    requestedPeriodStart.toISOString().slice(0, 10) !== apoKey ||
                    requestedPeriodEnd.toISOString().slice(0, 10) !== eosKey ||
                    requestedPeriodStart > requestedPeriodEnd
                ) {
                    return res.status(400).json({
                        success: false,
                        message: 'Μη έγκυρο εύρος ημερομηνιών.'
                    });
                }

                filter.hmeromhnia = mongoose.trusted({
                    $gte: requestedPeriodStart,
                    $lte: requestedPeriodEnd
                });
            }

            if (ypokatasthma && String(ypokatasthma).trim() !== '') {
                filter.ypokatasthma = String(ypokatasthma).trim().padStart(4, '0');
            }

            if (kodikos && String(kodikos).trim() !== '') {
                filter.kodikos = String(kodikos).trim();
            }

            const [rows, total] = await Promise.all([
                ProdhlomenaOrariaModel.find(filter)
                    .select(
                        'team company_kod ypokatasthma kodikos hmeromhnia ' +
                            'kathgoria_ergasias apo_ora_01 eos_ora_01 apo_ora_02 eos_ora_02 apo_ora_03 eos_ora_03 ' +
                            'apo_ora_01_break eos_ora_01_break apo_ora_02_break eos_ora_02_break apo_ora_03_break eos_ora_03_break ' +
                            'ores_ergasias repo adeia kathgoria_adeias astheneia ' +
                            'cards_apo_ora_01 cards_eos_ora_01 cards_apo_ora_02 cards_eos_ora_02 cards_apo_ora_03 cards_eos_ora_03 cards_ores_ergasias ' +
                            'apo_ora_01_apologistika eos_ora_01_apologistika apo_ora_02_apologistika eos_ora_02_apologistika apo_ora_03_apologistika eos_ora_03_apologistika ' +
                            'kathgoria_ergasias_apologistika ores_ergasias_apologistika apologistiko_biblio ' +
                            'repo_apologistika adeia_apologistika kathgoria_adeias_apologistika astheneia_apologistika argia kyriakes_apologistika ores_apoysias_apologistika ' +
                            'is_locked locked_by locked_at'
                    )
                    .sort({ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                ProdhlomenaOrariaModel.countDocuments(filter)
            ]);

            const rowStartDates = rows
                .map((row) => clampDateStartUtc(row.hmeromhnia))
                .filter(Boolean);
            const rowEndDates = rows
                .map((row) => clampDateEndUtc(row.hmeromhnia))
                .filter(Boolean);
            const periodStart =
                requestedPeriodStart ||
                (rowStartDates.length > 0
                    ? new Date(Math.min(...rowStartDates.map((date) => date.getTime())))
                    : null);
            const periodEnd =
                requestedPeriodEnd ||
                (rowEndDates.length > 0
                    ? new Date(Math.max(...rowEndDates.map((date) => date.getTime())))
                    : null);
            const scenarioContext =
                periodStart && periodEnd
                    ? await buildNoCardsDisplayContext({
                          team: sessionTeam,
                          companyId,
                          companyKodikos: req.session.companyKodikos,
                          etos: req.session.yearInUse,
                          periodStart,
                          periodEnd
                      })
                    : { companyFlags: {}, argiesByDateKey: new Map() };
            const argiesByDateKey = scenarioContext.argiesByDateKey || new Map();
            const companyFlags = scenarioContext.companyFlags || {};

            const classificationRows = rows.map((row) => {
                const argiaRec = argiesByDateKey.get(dateKeyUtc(row.hmeromhnia));
                const isHoliday = Boolean(argiaRec);
                const facts = buildApasxoliseisScenarioFacts(row, {
                    holiday: {
                        isHoliday,
                        isMandatoryHoliday: argiaRec?.ypoxreotikh_argia === true,
                        isOptionalHoliday: isHoliday && argiaRec?.ypoxreotikh_argia !== true,
                        description: argiaRec?.description || ''
                    },
                    companyFlags: {
                        companyWorksOnMandatoryHoliday:
                            companyFlags.apasxolhsh_kata_tis_argies === true,
                        companyWorksOnOptionalHoliday:
                            companyFlags.leitoyrgia_stis_mh_ypoxreotikes_argies === true
                    }
                });
                const decision = matchApasxoliseisScenarioFacts(facts);

                return {
                    prodhlomena_oraria_id: facts.identity.prodhlomena_oraria_id,
                    team: facts.identity.team,
                    company_kod: facts.identity.company_kod,
                    ypokatasthma: facts.identity.ypokatasthma,
                    kodikos: facts.identity.kodikos,
                    hmeromhnia: facts.identity.hmeromhnia,
                    facts_summary: {
                        declared_category: facts.declared.kathgoria_ergasias,
                        declared_hours: facts.declared.declaredHours,
                        card_hours: facts.cards.cardHours,
                        has_cards: facts.cards.hasCards,
                        has_zero_length_card_interval: facts.cards.hasZeroLengthCardInterval,
                        is_holiday: facts.holiday.isHoliday,
                        is_mandatory_holiday: facts.holiday.isMandatoryHoliday,
                        is_optional_holiday: facts.holiday.isOptionalHoliday,
                        is_locked: facts.review.is_locked,
                        has_manual_override: facts.review.hasManualOverride
                    },
                    decision
                };
            });

            return res.json({
                success: true,
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                count: classificationRows.length,
                rows: classificationRows
            });
        } catch (error) {
            console.error('[getProdhlomenaOrariaScenarioClassifications] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την ταξινόμηση σεναρίων απασχολήσεων.',
                error: error.message
            });
        }
    };

    static exportProdhlomenaOrariaReviewExcel = async (req, res) => {
        try {
            const rows = await getReviewRowsForExport(req);
            const deviations = rows.__deviations || [];
            const deviationsByKodikos = new Map();
            deviations.forEach((dev) => {
                const key = String(dev.kodikos || '').trim();
                if (!key) return;
                if (!deviationsByKodikos.has(key)) deviationsByKodikos.set(key, []);
                deviationsByKodikos.get(key).push(dev);
            });

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Payroll-NodeJs';

            const worksheet = workbook.addWorksheet('Έλεγχος απασχολήσεων', {
                views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }],
                properties: { outlineLevelRow: 2 },
                pageSetup: {
                    paperSize: 9,
                    orientation: 'landscape',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    horizontalCentered: false,
                    verticalCentered: false,
                    margins: {
                        left: 0.15,
                        right: 0.15,
                        top: 0.25,
                        bottom: 0.25,
                        header: 0.1,
                        footer: 0.1
                    }
                }
            });

            // Πλάτη στηλών ρυθμισμένα ώστε το print preview να γεμίζει όλο το πλάτος
            // της Α4 Landscape. Το fitToWidth=1 θα κάνει scale down αν χρειαστεί,
            // αλλά δεν θα μένει κενό δεξιά από την τελευταία στήλη.
            worksheet.columns = [
                { header: 'Ημ/νία\nΗμέρα', key: 'hmeromhnia', width: 17 },
                { header: 'Παράρτημα', key: 'ypokatasthma', width: 9 },
                { header: 'Κωδικός', key: 'kodikos', width: 9 },
                { header: 'Επώνυμο', key: 'eponymo', width: 16 },
                { header: 'Όνομα', key: 'onoma', width: 14 },
                { header: 'Προδηλωμένο\nΩράριο', key: 'program', width: 22 },
                { header: 'Κάρτες\nΕργασίας', key: 'cards', width: 22 },
                { header: 'Απολογιστικό\nΩράριο', key: 'apologistiko_intervals', width: 22 },
                { header: 'Ώρες\nΕργασίας', key: 'ores_ergasias_apologistika', width: 9 },
                { header: 'Ώρες\nΑπουσίας', key: 'ores_apoysias_apologistika', width: 9 },
                { header: 'Ώρες\nΝύχτας', key: 'ores_nyxtas_apologistika', width: 9 },
                { header: 'Ώρες\nΑργίας', key: 'argia_total', width: 9 },
                {
                    header: 'Πρόσθετη\nΕργασία',
                    key: 'ores_prostheths_ergasias_apologistika',
                    width: 9
                },
                { header: 'Ώρες\nΥπερεργ.', key: 'yperergasia_total', width: 9 },
                { header: 'Νόμιμη\nΥπερωρία', key: 'nomimi_total', width: 9 },
                { header: 'Παράνομη\nΥπερωρία', key: 'paranomi_total', width: 9 },
                { header: 'Απολογ.\nΒιβλίο', key: 'apologistiko_biblio', width: 9 },
                { header: 'Άδεια\nΑπολογ.', key: 'adeia_apologistika', width: 9 },
                { header: 'Κατηγορία\nΆδειας', key: 'kathgoria_adeias_apologistika', width: 13 },
                { header: 'Κυριακή', key: 'kyriakes_apologistika', width: 9 },
                { header: 'Περιγραφή\nΑργίας', key: 'perigrafh_argias', width: 20 },
                { header: 'Κλειδ.', key: 'is_locked', width: 9 }
            ];

            const HEADER_ROW_HEIGHT = 42;
            const GROUP_ROW_HEIGHT = 22;
            const EMPLOYEE_TOTAL_ROW_HEIGHT = 20;
            const LAST_EXCEL_COLUMN = 'V';

            const styleExcelRange = (row, fromCol = 1, toCol = 22, styleFn = null) => {
                for (let col = fromCol; col <= toCol; col++) {
                    const cell = row.getCell(col);

                    if (styleFn) styleFn(cell, col);

                    cell.border = cell.border || {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                }
            };

            const numericColumnColors = {
                9: 'FFE2F0D9', // Ώρες
                10: 'FFFFC7CE', // Απουσίες
                11: 'FFD9EAF7', // Νύχτα
                12: 'FFFCE4D6', // Αργία
                13: 'FFEADCF8', // Πρόσθετη
                14: 'FFFFF2CC', // Υπερεργασία
                15: 'FFF8CBAD', // Νόμιμη υπερωρία
                16: 'FFF4CCCC' // Παράνομη υπερωρία
            };

            const applyNumericColors = (row) => {
                Object.entries(numericColumnColors).forEach(([col, color]) => {
                    const cell = row.getCell(Number(col));
                    const value = Number(String(cell.value ?? 0).replace(',', '.'));

                    if (Number.isFinite(value) && value !== 0) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: color }
                        };
                        cell.font = {
                            name: 'DejaVu Sans',
                            size: 9,
                            bold: true,
                            color: { argb: 'FF000000' }
                        };
                    }
                });
            };

            const applyBaseExcelFont = (cell, extra = {}) => {
                const oldFont = cell.font || {};
                cell.font = {
                    name: 'DejaVu Sans',
                    size: 9,
                    ...oldFont,
                    ...extra
                };
            };

            const centerColumns = new Set([2, 3, 17, 18, 19, 20, 21, 22]);

            const headerRow = worksheet.getRow(1);
            headerRow.height = HEADER_ROW_HEIGHT;
            headerRow.font = {
                name: 'DejaVu Sans',
                size: 7,
                bold: true,
                color: { argb: 'FFFFFFFF' }
            };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF212529' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

            let currentBranch = null;
            let currentEmployee = null;
            let currentEmployeeKodikos = '';
            let branchTotals = createReviewTotals();
            let employeeTotals = createReviewTotals();
            const grandTotals = createReviewTotals();

            const addTotalsRow = (label, t, level = 0, fill = 'FFD9EAD3', options = {}) => {
                const r = worksheet.addRow({
                    hmeromhnia: label,
                    ores_ergasias_apologistika: t.ores_ergasias_apologistika,
                    ores_apoysias_apologistika: t.ores_apoysias_apologistika,
                    ores_nyxtas_apologistika: t.ores_nyxtas_apologistika,
                    argia_total: t.argia,
                    ores_prostheths_ergasias_apologistika: t.ores_prostheths_ergasias_apologistika,
                    yperergasia_total: t.yperergasia,
                    nomimi_total: t.nomimiYperoria,
                    paranomi_total: t.paranomiYperoria
                });

                r.font = { name: 'DejaVu Sans', size: 9, bold: true };
                r.outlineLevel = level;
                r.height = options.employeeTotal ? EMPLOYEE_TOTAL_ROW_HEIGHT : undefined;

                worksheet.mergeCells(`A${r.number}:H${r.number}`);
                r.getCell(1).value = label;

                styleExcelRange(r, 1, 22, (c) => {
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                    c.alignment = {
                        vertical: 'middle',
                        horizontal: 'left',
                        wrapText: false,
                        shrinkToFit: true
                    };
                });

                for (let col = 9; col <= 16; col++) {
                    r.getCell(col).numFmt = '0.00';
                    r.getCell(col).alignment = {
                        vertical: 'middle',
                        horizontal: 'right',
                        wrapText: true
                    };
                }

                r.getCell(1).alignment = {
                    vertical: 'middle',
                    horizontal: 'left',
                    wrapText: false,
                    shrinkToFit: true
                };
                applyBaseExcelFont(r.getCell(1), { bold: true });

                applyNumericColors(r);

                return r;
            };

            const addDeviationRowsForEmployee = (kodikos) => {
                const employeeDeviations =
                    deviationsByKodikos.get(String(kodikos || '').trim()) || [];
                if (employeeDeviations.length === 0) return;

                const title = worksheet.addRow({ hmeromhnia: 'Αποκλίσεις εβδομαδιαίων ρεπό' });
                title.outlineLevel = 1;
                title.hidden = true;
                title.font = {
                    name: 'DejaVu Sans',
                    size: 9,
                    bold: true,
                    color: { argb: 'FF7F3300' }
                };
                title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

                const header = worksheet.addRow({
                    hmeromhnia: 'Από',
                    ypokatasthma: 'Έως',
                    kodikos: 'Αναμ.',
                    eponymo: 'Πραγμ.',
                    onoma: 'Προφίλ',
                    program: 'Σχόλιο'
                });
                header.outlineLevel = 1;
                header.hidden = true;
                header.font = { name: 'DejaVu Sans', size: 9, bold: true };
                header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

                employeeDeviations.forEach((dev) => {
                    const r = worksheet.addRow({
                        hmeromhnia: reviewDateWithDay(dev.week_apo),
                        ypokatasthma: reviewDateWithDay(dev.week_eos),
                        kodikos: dev.expected_repo,
                        eponymo: dev.actual_repo,
                        onoma: reviewDeviationProfileText(dev),
                        program: reviewDeviationNoteText(dev)
                    });
                    r.outlineLevel = 1;
                    r.hidden = true;
                    r.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: dev.profile_changed_inside_week ? 'FFFFF2CC' : 'FFFFFFFF' }
                    };
                });
            };

            const closeEmployee = () => {
                if (!currentEmployee) return;

                const totalRow = addTotalsRow(
                    `Σύνολα εργαζομένου: ${currentEmployee}`,
                    employeeTotals,
                    1,
                    'FFE2F0D9',
                    { employeeTotal: true }
                );
                totalRow.hidden = true;

                addDeviationRowsForEmployee(currentEmployeeKodikos);
                employeeTotals = createReviewTotals();
            };

            const closeBranch = () => {
                if (!currentBranch) return;
                closeEmployee();
                addTotalsRow(
                    `Σύνολα υποκαταστήματος: ${currentBranch}`,
                    branchTotals,
                    0,
                    'FFB7DEE8'
                );
                branchTotals = createReviewTotals();
            };

            for (const row of rows) {
                const branch = row.exportYpokatasthma || '-';
                const employeeKey = `${row.kodikos || ''} | ${row.employeeName || ''}`.trim();

                if (branch !== currentBranch) {
                    closeBranch();
                    currentBranch = branch;
                    currentEmployee = null;
                    currentEmployeeKodikos = '';

                    const br = worksheet.addRow({ hmeromhnia: `Υποκατάστημα: ${branch}` });
                    br.height = GROUP_ROW_HEIGHT;
                    worksheet.mergeCells(`A${br.number}:${LAST_EXCEL_COLUMN}${br.number}`);
                    br.getCell(1).value = `Υποκατάστημα: ${branch}`;
                    br.font = {
                        name: 'DejaVu Sans',
                        size: 9,
                        bold: true,
                        color: { argb: 'FFFFFFFF' }
                    };
                    styleExcelRange(br, 1, 22, (c) => {
                        c.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF305496' }
                        };
                        c.alignment = {
                            vertical: 'middle',
                            horizontal: 'left',
                            wrapText: false,
                            shrinkToFit: true
                        };
                    });
                }

                if (employeeKey !== currentEmployee) {
                    closeEmployee();
                    currentEmployee = employeeKey;
                    currentEmployeeKodikos = row.kodikos || '';

                    const employeeDeviations =
                        deviationsByKodikos.get(String(currentEmployeeKodikos || '').trim()) || [];
                    const changeBadge = employeeDeviations.some(
                        (dev) => dev.profile_changed_inside_week
                    )
                        ? '  |  ⚠ Αλλαγή όρων'
                        : '';
                    const er = worksheet.addRow({
                        hmeromhnia: `Εργαζόμενος: ${employeeKey}${changeBadge}`
                    });
                    er.height = GROUP_ROW_HEIGHT;
                    er.outlineLevel = 1;
                    er.hidden = true;
                    worksheet.mergeCells(`A${er.number}:${LAST_EXCEL_COLUMN}${er.number}`);
                    er.getCell(1).value = `Εργαζόμενος: ${employeeKey}${changeBadge}`;
                    er.font = { name: 'DejaVu Sans', size: 9, bold: true };
                    styleExcelRange(er, 1, 22, (c) => {
                        c.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFD9EAF7' }
                        };
                        c.alignment = {
                            vertical: 'middle',
                            horizontal: 'left',
                            wrapText: false,
                            shrinkToFit: true
                        };
                    });
                }

                const programDisplay = reviewProgramDisplay(row);
                const apologistikoDisplay = reviewApologistikoDisplay(row);

                const detail = worksheet.addRow({
                    hmeromhnia: reviewDateWithDay(row.hmeromhnia),
                    ypokatasthma: row.exportYpokatasthma || '',
                    kodikos: row.kodikos || '',
                    eponymo: row.eponymo || '',
                    onoma: row.onoma || '',
                    program: programDisplay.text,
                    cards: reviewIntervals(row, 'cards_apo_ora', 'cards_eos_ora'),
                    apologistiko_intervals: apologistikoDisplay.text,
                    ores_ergasias_apologistika: reviewNum(row.ores_ergasias_apologistika),
                    ores_apoysias_apologistika: reviewNum(row.ores_apoysias_apologistika),
                    ores_nyxtas_apologistika: reviewNum(row.ores_nyxtas_apologistika),
                    argia_total: reviewArgiaTotal(row),
                    ores_prostheths_ergasias_apologistika: reviewNum(
                        row.ores_prostheths_ergasias_apologistika
                    ),
                    yperergasia_total: reviewYperergasiaTotal(row),
                    nomimi_total: reviewNomimiYperoriaTotal(row),
                    paranomi_total: reviewParanomiYperoriaTotal(row),
                    apologistiko_biblio: row.apologistiko_biblio ? 'ΝΑΙ' : '',
                    repo: row.repo ? 'ΝΑΙ' : '',
                    adeia_apologistika: row.adeia_apologistika ? 'ΝΑΙ' : '',
                    kathgoria_adeias_apologistika: row.kathgoria_adeias_apologistika || '',
                    kyriakes_apologistika: row.kyriakes_apologistika ? 'ΝΑΙ' : '',
                    perigrafh_argias: row.perigrafh_argias || '',
                    is_locked: row.is_locked ? 'ΝΑΙ' : ''
                });

                detail.outlineLevel = 2;
                detail.hidden = true;

                detail.eachCell((c) => {
                    c.alignment = { vertical: 'middle', wrapText: true };
                    c.border = {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                });

                for (let col = 9; col <= 16; col++) detail.getCell(col).numFmt = '0.00';

                const displayFills = {
                    declared_repo: 'FFFFF2CC',
                    repo: 'FFFFF2CC',
                    non_work: 'FFE9ECEF',
                    adeia_suggestion: 'FFFDEBD0',
                    apologistiko: 'FFE2F0D9'
                };
                if (displayFills[programDisplay.type]) {
                    detail.getCell(6).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: displayFills[programDisplay.type] }
                    };
                    detail.getCell(6).font = {
                        name: 'DejaVu Sans',
                        size: 9,
                        bold: true,
                        color: { argb: 'FF000000' }
                    };
                }
                if (displayFills[apologistikoDisplay.type]) {
                    detail.getCell(8).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: displayFills[apologistikoDisplay.type] }
                    };
                    detail.getCell(8).font = {
                        name: 'DejaVu Sans',
                        size: 9,
                        bold: true,
                        color: { argb: 'FF000000' }
                    };
                }
                if (row.kathgoria_adeias_apologistika) {
                    detail.getCell(18).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFDEBD0' }
                    };
                    detail.getCell(19).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFDEBD0' }
                    };
                    detail.getCell(18).font = {
                        name: 'DejaVu Sans',
                        size: 9,
                        bold: true,
                        color: { argb: 'FF7F3300' }
                    };
                    detail.getCell(19).font = {
                        name: 'DejaVu Sans',
                        size: 9,
                        bold: true,
                        color: { argb: 'FF7F3300' }
                    };
                }

                if (row.is_locked) {
                    detail.eachCell((c) => {
                        if (!c.fill) {
                            c.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFF2CC' }
                            };
                        }
                    });
                }

                applyNumericColors(detail);

                addReviewTotals(employeeTotals, row);
                addReviewTotals(branchTotals, row);
                addReviewTotals(grandTotals, row);
            }

            closeBranch();
            addTotalsRow('Γενικά σύνολα', grandTotals, 0, 'FFFFC000');

            worksheet.eachRow((r, i) => {
                r.eachCell((c, colNumber) => {
                    applyBaseExcelFont(
                        c,
                        i === 1 ? { size: 7, bold: true, color: { argb: 'FFFFFFFF' } } : {}
                    );

                    c.alignment = c.alignment || { vertical: 'middle', wrapText: i === 1 };

                    if (centerColumns.has(colNumber)) {
                        c.alignment = {
                            ...c.alignment,
                            horizontal: 'center',
                            vertical: 'middle'
                        };
                    }

                    c.border = c.border || {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                });

                if (i > 1) {
                    for (let col = 9; col <= 16; col++) r.getCell(col).numFmt = '0.00';
                }
            });

            worksheet.autoFilter = { from: 'A1', to: 'V1' };

            // Τα πλάτη έχουν οριστεί ρητά πιο πάνω ώστε να γεμίζουν όλο το πλάτος
            // της Α4 Landscape. Δεν κάνουμε auto-fit εδώ, γιατί θα ξαναστενέψει/ανοίξει
            // απρόβλεπτα τις στήλες και θα χαλάσει το print layout.
            worksheet.pageSetup.printArea = `A1:${LAST_EXCEL_COLUMN}${worksheet.rowCount}`;
            worksheet.pageSetup.fitToPage = true;
            worksheet.pageSetup.fitToWidth = 1;
            worksheet.pageSetup.fitToHeight = 0;

            const buffer = await workbook.xlsx.writeBuffer();

            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="elegxos_apasxolhseon_grouped_${Date.now()}.xlsx"`
            );

            return res.send(buffer);
        } catch (error) {
            console.error('[exportProdhlomenaOrariaReviewExcel] ❌', error);
            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά το export Excel.',
                error: error.message
            });
        }
    };

    static exportProdhlomenaOrariaReviewPdf = async (req, res) => {
        try {
            const rows = await getReviewRowsForExport(req);
            const deviations = rows.__deviations || [];
            const deviationsByKodikos = new Map();
            deviations.forEach((dev) => {
                const key = String(dev.kodikos || '').trim();
                if (!key) return;
                if (!deviationsByKodikos.has(key)) deviationsByKodikos.set(key, []);
                deviationsByKodikos.get(key).push(dev);
            });

            const doc = makeReviewPdfDocument();

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `inline; filename="elegxos_apasxolhseon_${Date.now()}.pdf"`
            );

            doc.pipe(res);

            const left = doc.page.margins.left;
            const right = doc.page.width - doc.page.margins.right;
            // Κρατάμε επιπλέον χώρο για το footer, ώστε η τελευταία γραμμή
            // δεδομένων να μην πέφτει πάνω στο υποσέλιδο.
            const bottom = doc.page.height - doc.page.margins.bottom - 15;
            const availableWidth = right - left;
            let y = doc.page.margins.top;

            const regular = doc._fontFamilies.ReviewRegular ? 'ReviewRegular' : 'Helvetica';
            const bold = doc._fontFamilies.ReviewBold ? 'ReviewBold' : regular;
            const companyDisplayName =
                req.session.companyDescription ||
                req.session.companyDescr ||
                req.session.companyName ||
                req.session.companyKodikos ||
                '';
            const formatQueryDateForPdf = (value) =>
                value ? reviewDateOnly(`${value}T00:00:00.000Z`) || String(value) : '';

            const baseCols = [
                ['Ημερομηνία', 47],
                ['Προδηλωμένα\nΩράρια', 50],
                ['Από\nΚάρτες', 50],
                ['Απολογιστικά\nΩράρια', 58],
                ['Ώρες\nΕργασίας', 45],
                ['Ώρες\nΑπουσίας', 45],
                ['Ώρες\nΝύχτας', 43],
                ['Ώρες\nΑργιών', 43],
                ['Πρόσθετη\nΕργασία', 44],
                ['Υπερ-\nεργασία', 50],
                ['Νόμιμη\nΥπερωρία', 50],
                ['Παράνομη\nΥπερωρία', 50]
            ];

            const baseWidth = baseCols.reduce((sum, [, w]) => sum + w, 0);
            const scale = availableWidth / baseWidth;
            // Χρησιμοποιούμε δεκαδικά πλάτη και όχι Math.floor, ώστε το άθροισμα
            // να είναι ίσο με το διαθέσιμο πλάτος της σελίδας.
            const cols = baseCols.map(([label, w]) => [label, w * scale]);
            const tableWidth = availableWidth;
            const x0 = left;

            const numericPdfColors = {
                4: '#E2F0D9',
                5: '#F8CBAD',
                6: '#D9EAF7',
                7: '#FCE4D6',
                8: '#EADCF8',
                9: '#FFF2CC',
                10: '#F8CBAD',
                11: '#F4CCCC'
            };

            const numericTextColors = {
                5: '#9C0006',
                10: '#7F3300',
                11: '#9C0006'
            };

            const displayPdfFills = {
                declared_repo: '#FFF3CD',
                repo: '#FFF3CD',
                non_work: '#E9ECEF',
                adeia_suggestion: '#FDEBD0',
                apologistiko: '#DFF0D8'
            };

            const drawHeader = () => {
                const headerTopY = y;

                if (companyDisplayName) {
                    doc.font(regular)
                        .fontSize(6.4)
                        .fillColor('#555')
                        .text(String(companyDisplayName), left, headerTopY, {
                            width: availableWidth * 0.3,
                            align: 'left',
                            ellipsis: true,
                            lineBreak: false
                        });
                }

                doc.font(bold)
                    .fontSize(11)
                    .fillColor('#000')
                    .text(
                        'Έλεγχος Απασχολήσεων Από Κάρτες Εργασίας ΕΡΓΑΝΗ ΙΙ',
                        left,
                        headerTopY + 2,
                        {
                            width: availableWidth,
                            align: 'center'
                        }
                    );

                y += 17;

                doc.font(regular)
                    .fontSize(7.4)
                    .fillColor('#555')
                    .text(
                        `Περίοδος: ${formatQueryDateForPdf(req.query.apo_hmeromhnia)} έως ${formatQueryDateForPdf(req.query.eos_hmeromhnia)}`,
                        left,
                        y,
                        { width: availableWidth, align: 'center' }
                    );

                y += 13;
            };

            const addReviewPdfPage = () => {
                doc.addPage({
                    size: 'A4',
                    layout: 'landscape',
                    margins: { top: 18, left: 10, right: 10, bottom: 18 }
                });
                y = doc.page.margins.top;
                drawHeader();
            };

            const newPageIfNeeded = (height = 16) => {
                if (y + height <= bottom) return false;
                addReviewPdfPage();
                return true;
            };

            const drawCell = (x, rowY, w, h, value, options = {}) => {
                const {
                    fill = null,
                    font = regular,
                    fontSize = 6.4,
                    color = '#000',
                    align = 'left',
                    boldText = false,
                    ellipsis = true,
                    lineGap = 0
                } = options;

                if (fill) doc.save().rect(x, rowY, w, h).fill(fill).restore();

                doc.save()
                    .rect(x, rowY, w, h)
                    .strokeColor('#D9D9D9')
                    .lineWidth(0.25)
                    .stroke()
                    .restore();

                doc.font(boldText ? bold : font)
                    .fontSize(fontSize)
                    .fillColor(color)
                    .text(String(value || '-'), x + 1.2, rowY + 2, {
                        width: w - 2.4,
                        height: h - 3,
                        ellipsis,
                        align,
                        lineGap
                    });
            };

            const drawBreakdownCell = (x, rowY, w, h, breakdown, options = {}) => {
                const {
                    fill = null,
                    fontSize = 5.7,
                    color = '#000',
                    boldText = true,
                    paddingTop = 1.8,
                    paddingBottom = 1.7,
                    labelWidth = Math.max(16, w * 0.48)
                } = options;

                if (fill) doc.save().rect(x, rowY, w, h).fill(fill).restore();

                doc.save()
                    .rect(x, rowY, w, h)
                    .strokeColor('#D9D9D9')
                    .lineWidth(0.25)
                    .stroke()
                    .restore();

                const parts = Array.isArray(breakdown?.parts) ? breakdown.parts.slice(0, 4) : [];
                const usableHeight = Math.max(1, h - paddingTop - paddingBottom);
                const lineHeight = Math.max(
                    fontSize + 1.1,
                    usableHeight / Math.max(parts.length, 1)
                );

                parts.forEach((part, index) => {
                    const lineY = rowY + paddingTop + index * lineHeight;
                    doc.font(boldText ? bold : regular)
                        .fontSize(fontSize)
                        .fillColor(color)
                        .text(part.label, x + 1.6, lineY, {
                            width: labelWidth,
                            height: lineHeight,
                            ellipsis: true,
                            align: 'left'
                        });

                    doc.font(boldText ? bold : regular)
                        .fontSize(fontSize)
                        .fillColor(color)
                        .text(reviewHours(part.value), x + 1.6, lineY, {
                            width: w - 3.2,
                            height: lineHeight,
                            ellipsis: true,
                            align: 'right'
                        });
                });
            };

            const drawTotalsBreakdownCell = (x, rowY, w, h, breakdown, options = {}) => {
                const {
                    fill = null,
                    totalFontSize = 10.2,
                    detailFontSize = 5.7,
                    color = '#000',
                    paddingTop = 2.2,
                    labelWidth = Math.max(19, w * 0.5)
                } = options;

                if (fill) doc.save().rect(x, rowY, w, h).fill(fill).restore();

                doc.save()
                    .rect(x, rowY, w, h)
                    .strokeColor('#D9D9D9')
                    .lineWidth(0.25)
                    .stroke()
                    .restore();

                doc.font(bold)
                    .fontSize(totalFontSize)
                    .fillColor(color)
                    .text(reviewHours(breakdown?.total || 0), x + 1.6, rowY + paddingTop, {
                        width: w - 3.2,
                        height: totalFontSize + 2,
                        ellipsis: true,
                        align: 'right'
                    });

                const parts = Array.isArray(breakdown?.parts) ? breakdown.parts.slice(0, 4) : [];
                const detailsTop = rowY + paddingTop + totalFontSize + 3.6;
                const usableHeight = Math.max(1, rowY + h - 2.2 - detailsTop);
                const lineHeight = Math.max(
                    detailFontSize + 1.2,
                    usableHeight / Math.max(parts.length, 1)
                );

                parts.forEach((part, index) => {
                    const lineY = detailsTop + index * lineHeight;
                    doc.font(bold)
                        .fontSize(detailFontSize)
                        .fillColor(color)
                        .text(part.label, x + 1.6, lineY, {
                            width: labelWidth,
                            height: lineHeight,
                            ellipsis: true,
                            align: 'left'
                        });

                    doc.font(bold)
                        .fontSize(detailFontSize)
                        .fillColor(color)
                        .text(reviewHours(part.value), x + 1.6, lineY, {
                            width: w - 3.2,
                            height: lineHeight,
                            ellipsis: true,
                            align: 'right'
                        });
                });
            };

            const drawTableHeader = (options = {}) => {
                const labelsOverride = Array.isArray(options.labelsOverride)
                    ? options.labelsOverride
                    : null;
                newPageIfNeeded(27);
                let x = x0;
                const h = 26;
                doc.rect(x0, y, tableWidth, h).fill('#212529');
                doc.font(bold).fontSize(7.2).fillColor('#FFF');
                cols.forEach(([label, w], index) => {
                    const headerLabel = labelsOverride ? (labelsOverride[index] ?? label) : label;
                    doc.text(headerLabel, x + 1, y + 3.5, {
                        width: w - 2,
                        height: h - 7,
                        align: 'center',
                        lineGap: -0.2,
                        ellipsis: false
                    });
                    x += w;
                });
                y += h;
            };

            const drawEmployeeTotalsSummaryTableHeader = () => {
                const labels = cols.map(([label]) => label);
                labels[0] = 'Εργαζόμενος';
                labels[1] = '';
                labels[2] = '';
                labels[3] = '';
                drawTableHeader({ labelsOverride: labels });
            };

            let currentBranch = null;
            let currentEmployee = null;
            let currentEmployeeKodikos = '';
            let employeeTotals = createReviewTotals();
            let branchTotals = createReviewTotals();
            let printedEmployees = 0;
            let branchHeaderPending = false;
            const grandTotals = createReviewTotals();
            const employeeTotalsSummary = [];

            const cloneReviewTotalsForPdf = (sourceTotals = {}) => {
                const cloned = createReviewTotals();
                Object.keys(cloned).forEach((key) => {
                    cloned[key] = reviewNum(sourceTotals[key]);
                });
                return cloned;
            };

            const drawTotals = (label, totals, fill = '#E2F0D9', options = {}) => {
                const yperergasiaBreakdown = reviewPdfYperergasiaBreakdown(totals);
                const nomimiYperoriaBreakdown = reviewPdfNomimiYperoriaBreakdown(totals);
                const paranomiYperoriaBreakdown = reviewPdfParanomiYperoriaBreakdown(totals);
                const overtimeBreakdowns = {
                    9: yperergasiaBreakdown,
                    10: nomimiYperoriaBreakdown,
                    11: paranomiYperoriaBreakdown
                };
                const hasOvertimeBreakdown = Object.values(overtimeBreakdowns).some(
                    (breakdown) => breakdown?.needsBreakdown
                );

                const totalValueFontSize = options.totalValueFontSize || 10.2;
                const totalLabelFontSize = options.totalLabelFontSize || 7.2;
                const h = hasOvertimeBreakdown
                    ? options.breakdownHeight || 43
                    : options.normalHeight || 19;
                const movedToNewPage = newPageIfNeeded(h + 3);
                if (movedToNewPage && typeof options.afterPageBreak === 'function') {
                    options.afterPageBreak();
                }
                const rowY = y;
                doc.rect(x0, rowY, tableWidth, h).fill(fill);
                doc.rect(x0, rowY, tableWidth, h).strokeColor('#BFBFBF').lineWidth(0.25).stroke();
                doc.font(bold)
                    .fontSize(totalLabelFontSize)
                    .fillColor('#000')
                    .text(label, x0 + 2, rowY + 3.4, {
                        width: cols.slice(0, 4).reduce((a, [, w]) => a + w, 0) - 4,
                        height: h - 5,
                        ellipsis: true
                    });

                const values = [
                    reviewHours(totals.ores_ergasias_apologistika),
                    reviewHours(totals.ores_apoysias_apologistika),
                    reviewHours(totals.ores_nyxtas_apologistika),
                    reviewHours(totals.argia),
                    reviewHours(totals.ores_prostheths_ergasias_apologistika),
                    reviewHours(yperergasiaBreakdown.total),
                    reviewHours(nomimiYperoriaBreakdown.total),
                    reviewHours(paranomiYperoriaBreakdown.total)
                ];

                let x = x0 + cols.slice(0, 4).reduce((a, [, w]) => a + w, 0);
                values.forEach((value, i) => {
                    const numericIndex = 4 + i;
                    const n = Number(String(value || 0).replace(',', '.'));
                    const w = cols[numericIndex][1];
                    const breakdown = overtimeBreakdowns[numericIndex];
                    const cellFill =
                        Number.isFinite(n) && n !== 0 ? numericPdfColors[numericIndex] : fill;

                    if (breakdown?.needsBreakdown) {
                        drawTotalsBreakdownCell(x, rowY, w, h, breakdown, {
                            fill: cellFill,
                            totalFontSize: totalValueFontSize,
                            detailFontSize: options.breakdownFontSize || 5.7,
                            color: numericTextColors[numericIndex] || '#000',
                            labelWidth: Math.max(19, w * 0.5)
                        });
                    } else {
                        drawCell(x, rowY, w, h, value, {
                            fill: cellFill,
                            font: bold,
                            fontSize: totalValueFontSize,
                            color: numericTextColors[numericIndex] || '#000',
                            align: 'right',
                            boldText: true,
                            ellipsis: true
                        });
                    }
                    x += w;
                });

                if (options.strongBottomLine) {
                    doc.save()
                        .moveTo(x0, rowY + h)
                        .lineTo(x0 + tableWidth, rowY + h)
                        .strokeColor('#666666')
                        .lineWidth(0.9)
                        .stroke()
                        .restore();
                }

                y += h;
            };

            const drawBranchHeader = (branch) => {
                newPageIfNeeded(13);
                doc.rect(x0, y, tableWidth, 12).fill('#305496');
                doc.font(bold)
                    .fontSize(7.2)
                    .fillColor('#FFF')
                    .text(`Υποκατάστημα: ${branch}`, x0 + 3, y + 3, {
                        width: tableWidth - 6
                    });
                y += 12;
            };

            const drawEmployeeDeviations = (kodikos) => {
                const employeeDeviations =
                    deviationsByKodikos.get(String(kodikos || '').trim()) || [];
                if (employeeDeviations.length === 0) return;

                newPageIfNeeded(24);
                doc.rect(x0, y, tableWidth, 12).fill('#FFF3CD');
                doc.font(bold)
                    .fontSize(7)
                    .fillColor('#7F3300')
                    .text('Αποκλίσεις εβδομαδιαίων ρεπό', x0 + 3, y + 3, { width: tableWidth - 6 });
                y += 12;

                employeeDeviations.forEach((dev) => {
                    const lines = [
                        `${reviewDateWithDay(dev.week_apo)} - ${reviewDateWithDay(dev.week_eos)} | Αναμ.: ${dev.expected_repo} | Πραγμ.: ${dev.actual_repo}`,
                        reviewDeviationProfileText(dev),
                        reviewDeviationNoteText(dev)
                    ].filter(Boolean);
                    const text = lines.join('\n');

                    doc.font(dev.profile_changed_inside_week ? bold : regular).fontSize(6.1);
                    const textHeight = doc.heightOfString(text, {
                        width: tableWidth - 6,
                        lineGap: 0.45
                    });
                    const rowH = Math.max(18, textHeight + 7);
                    newPageIfNeeded(rowH + 1);

                    drawCell(x0, y, tableWidth, rowH, text, {
                        fill: dev.profile_changed_inside_week ? '#FFF3CD' : '#FFFFFF',
                        fontSize: 6.1,
                        color: '#000',
                        boldText: dev.profile_changed_inside_week,
                        ellipsis: false,
                        lineGap: 0.45
                    });
                    y += rowH;
                });
            };

            const drawEmployeeTotalsSummaryHeader = () => {
                newPageIfNeeded(43);
                doc.rect(x0, y, tableWidth, 14).fill('#305496');
                doc.font(bold)
                    .fontSize(8)
                    .fillColor('#FFF')
                    .text('Ανακεφαλαίωση συνόλων ανά εργαζόμενο', x0 + 3, y + 4, {
                        width: tableWidth - 6,
                        align: 'center'
                    });
                y += 14;
                drawEmployeeTotalsSummaryTableHeader();
            };

            const drawEmployeeTotalsSummaryPage = () => {
                if (employeeTotalsSummary.length === 0) return;

                addReviewPdfPage();
                drawEmployeeTotalsSummaryHeader();

                employeeTotalsSummary.forEach((entry) => {
                    const branchPart = entry.branch ? ` | Υποκ.: ${entry.branch}` : '';
                    drawTotals(
                        `Σύνολα εργαζομένου: ${entry.employee}${branchPart}`,
                        entry.totals,
                        '#E2F0D9',
                        {
                            breakdownHeight: 45,
                            normalHeight: 20,
                            breakdownFontSize: 5.8,
                            totalValueFontSize: 10.2,
                            totalLabelFontSize: 7.4,
                            strongBottomLine: true,
                            afterPageBreak: drawEmployeeTotalsSummaryHeader
                        }
                    );
                });
            };

            const closeEmployee = () => {
                if (!currentEmployee) return;
                drawTotals(`Σύνολα εργαζομένου: ${currentEmployee}`, employeeTotals, '#E2F0D9', {
                    breakdownHeight: 45,
                    normalHeight: 20,
                    breakdownFontSize: 5.8,
                    totalValueFontSize: 10.2,
                    totalLabelFontSize: 7.4,
                    strongBottomLine: true
                });
                employeeTotalsSummary.push({
                    branch: currentBranch,
                    employee: currentEmployee,
                    kodikos: currentEmployeeKodikos,
                    totals: cloneReviewTotalsForPdf(employeeTotals)
                });
                drawEmployeeDeviations(currentEmployeeKodikos);
                employeeTotals = createReviewTotals();
            };

            const closeBranch = () => {
                if (!currentBranch) return;
                closeEmployee();
                drawTotals(`Σύνολα υποκαταστήματος: ${currentBranch}`, branchTotals, '#B7DEE8', {
                    breakdownHeight: 45,
                    normalHeight: 20,
                    breakdownFontSize: 5.8,
                    totalValueFontSize: 10.2,
                    totalLabelFontSize: 7.4,
                    strongBottomLine: true
                });
                branchTotals = createReviewTotals();
            };

            drawHeader();

            for (const row of rows) {
                const branch = row.exportYpokatasthma || '-';
                const employee = `${row.kodikos || ''} | ${row.employeeName || ''}`.trim();

                if (branch !== currentBranch) {
                    closeBranch();
                    currentBranch = branch;
                    currentEmployee = null;
                    currentEmployeeKodikos = '';
                    branchHeaderPending = true;
                }

                if (employee !== currentEmployee) {
                    closeEmployee();

                    if (printedEmployees > 0) {
                        doc.addPage({
                            size: 'A4',
                            layout: 'landscape',
                            margins: { top: 18, left: 10, right: 10, bottom: 18 }
                        });
                        y = doc.page.margins.top;
                        drawHeader();
                        branchHeaderPending = true;
                    } else {
                        newPageIfNeeded(39);
                    }

                    if (branchHeaderPending) {
                        drawBranchHeader(currentBranch);
                        branchHeaderPending = false;
                    }

                    currentEmployee = employee;
                    currentEmployeeKodikos = row.kodikos || '';

                    const employeeDeviations =
                        deviationsByKodikos.get(String(currentEmployeeKodikos || '').trim()) || [];
                    const changeBadge = employeeDeviations.some(
                        (dev) => dev.profile_changed_inside_week
                    )
                        ? '  |  ⚠ Αλλαγή όρων'
                        : '';

                    newPageIfNeeded(38);
                    doc.rect(x0, y, tableWidth, 12).fill('#D9EAF7');
                    doc.font(bold)
                        .fontSize(7)
                        .fillColor('#000')
                        .text(`Εργαζόμενος: ${employee}${changeBadge}`, x0 + 3, y + 3, {
                            width: tableWidth - 6
                        });
                    y += 12;
                    drawTableHeader();
                    printedEmployees += 1;
                }

                newPageIfNeeded(15);

                const programDisplay = reviewProgramDisplay(row);
                const apologistikoDisplay = reviewApologistikoDisplay(row);
                const yperergasiaBreakdown = reviewPdfYperergasiaBreakdown(row);
                const nomimiYperoriaBreakdown = reviewPdfNomimiYperoriaBreakdown(row);
                const paranomiYperoriaBreakdown = reviewPdfParanomiYperoriaBreakdown(row);
                const overtimeBreakdowns = {
                    9: yperergasiaBreakdown,
                    10: nomimiYperoriaBreakdown,
                    11: paranomiYperoriaBreakdown
                };

                const vals = [
                    reviewDateWithDay(row.hmeromhnia),
                    programDisplay.text,
                    reviewIntervals(row, 'cards_apo_ora', 'cards_eos_ora'),
                    apologistikoDisplay.text,
                    reviewHours(row.ores_ergasias_apologistika),
                    reviewHours(row.ores_apoysias_apologistika),
                    reviewHours(row.ores_nyxtas_apologistika),
                    reviewHours(reviewArgiaTotal(row)),
                    reviewHours(row.ores_prostheths_ergasias_apologistika),
                    reviewHours(yperergasiaBreakdown.total),
                    reviewHours(nomimiYperoriaBreakdown.total),
                    reviewHours(paranomiYperoriaBreakdown.total)
                ];

                const hasOvertimeBreakdown = Object.values(overtimeBreakdowns).some(
                    (breakdown) => breakdown?.needsBreakdown
                );
                const rowY = y;
                const rowH = hasOvertimeBreakdown ? 24 : 14;
                let x = x0;

                vals.forEach((value, index) => {
                    const w = cols[index][1];
                    const isNumeric = index >= 4;
                    const n = isNumeric ? Number(String(value || 0).replace(',', '.')) : 0;
                    const breakdown = overtimeBreakdowns[index];
                    let fill = null;
                    if (index === 1) fill = displayPdfFills[programDisplay.type] || null;
                    if (index === 3) fill = displayPdfFills[apologistikoDisplay.type] || null;
                    if (!fill && isNumeric && Number.isFinite(n) && n !== 0)
                        fill = numericPdfColors[index];

                    if (breakdown?.needsBreakdown) {
                        drawBreakdownCell(x, rowY, w, rowH, breakdown, {
                            fill,
                            fontSize: 5.7,
                            color: numericTextColors[index] || '#000',
                            boldText: true
                        });
                    } else {
                        drawCell(x, rowY, w, rowH, value, {
                            fill,
                            font: regular,
                            fontSize: 6.2,
                            color: isNumeric ? numericTextColors[index] || '#000' : '#000',
                            align: isNumeric ? 'right' : 'left',
                            boldText:
                                (isNumeric && Number.isFinite(n) && n !== 0) ||
                                programDisplay.type ||
                                apologistikoDisplay.type
                        });
                    }
                    x += w;
                });

                y += rowH;

                addReviewTotals(employeeTotals, row);
                addReviewTotals(branchTotals, row);
                addReviewTotals(grandTotals, row);
            }

            closeBranch();
            drawTotals('Γενικά σύνολα', grandTotals, '#FFC000', {
                breakdownHeight: 45,
                normalHeight: 20,
                breakdownFontSize: 5.8,
                totalValueFontSize: 10.2,
                totalLabelFontSize: 7.4,
                strongBottomLine: true
            });
            drawEmployeeTotalsSummaryPage();

            const range = doc.bufferedPageRange();
            const footerLeftText = `(c) Copyright: www.WebPayrollSolutions.com  |  Ιωλκού 266α Βόλος  |  Τηλ. : 2421 0 56825  |  Κιν. : 697 20 12 650  |  eMail : support@WebPayrollSolutions.com`;
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                const footerY = doc.page.height - doc.page.margins.bottom - 8;

                doc.font(regular)
                    .fontSize(5.5)
                    .fillColor('#666')
                    .text(footerLeftText, left, footerY, {
                        width: availableWidth * 0.82,
                        align: 'left',
                        ellipsis: true,
                        lineBreak: false
                    });

                doc.font(regular)
                    .fontSize(6)
                    .fillColor('#666')
                    .text(`Σελίδα ${i + 1} / ${range.count}`, left, footerY, {
                        width: availableWidth,
                        align: 'right',
                        lineBreak: false
                    });
            }

            doc.end();
        } catch (error) {
            console.error('[exportProdhlomenaOrariaReviewPdf] ❌', error);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Σφάλμα κατά το export PDF.',
                    error: error.message
                });
            }
        }
    };

    static calcApasxolhseisPeriodoy = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;

            const {
                apo_hmeromhnia,
                eos_hmeromhnia,
                ypokatasthmata_stathera,
                proorh_proseleysh,
                proorhApoxorhsh_stathera
            } = req.body;

            if (!apo_hmeromhnia || !eos_hmeromhnia) {
                return res.status(400).json({
                    success: false,
                    message: 'Παρακαλώ συμπληρώστε Από και Έως ημερομηνία.'
                });
            }

            const apoDate = new Date(`${apo_hmeromhnia}T00:00:00.000Z`);
            const eosDate = new Date(`${eos_hmeromhnia}T23:59:59.999Z`);
            const calculationStartDate = startOfWeekSundayUtc(apoDate);

            const selectedYpokatasthma =
                ypokatasthmata_stathera && String(ypokatasthmata_stathera).trim() !== ''
                    ? String(ypokatasthmata_stathera).trim().padStart(4, '0')
                    : '';

            const proorhProseleyshMinutes = parseInt(proorh_proseleysh || 0, 10) || 0;
            const proorhApoxorhshMinutes = parseInt(proorhApoxorhsh_stathera || 0, 10) || 0;

            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId,
                energos: true
            };

            if (selectedYpokatasthma) {
                employeeQuery.ypokatasthma = selectedYpokatasthma;
            }

            const ergazomenoi = await ErgazomenoiModel.find(employeeQuery)
                .select(
                    'kodikos eponymo onoma ypokatasthma ' +
                        'aa_eggrafhs hmeres_ergasias_ebdomadas ' +
                        'ores_ergasias_ebdomadas mo_oron_hmerhsias_ergasias ' +
                        'typos_apasxolhshs typos_ebdomadas ' +
                        'dialleima_entos_ektos_orarioy dialleima_se_lepta ' +
                        'plhrhs_apasxolhsh pliris_apasxolisi plhrhs ' +
                        'merikh_apasxolhsh meriki_apasxolisi ' +
                        'evelikth_proselefsh'
                )
                .sort({ kodikos: 1 })
                .lean();

            console.log(`[calcApasxolhseisPeriodoy] Εργαζόμενοι: ${ergazomenoi.length}`);

            if (ergazomenoi.length === 0) {
                return res.json({
                    success: true,
                    message: 'Δεν βρέθηκαν εργαζόμενοι για τα κριτήρια επιλογής.',
                    employeesCount: 0,
                    recordsChecked: 0,
                    recordsUpdated: 0
                });
            }

            const employeesByKodikos = new Map();

            for (const erg of ergazomenoi) {
                employeesByKodikos.set(erg.kodikos, erg);
            }

            const kodikoi = ergazomenoi.map((e) => e.kodikos).filter(Boolean);

            // ============================================================
            // Ιστορικό όρων εργασίας για την περίοδο υπολογισμού.
            // Χρειαζόμαστε εγγραφές που τέμνονται με την περίοδο από την
            // αρχή της εβδομάδας υπολογισμού έως την ημερομηνία λήξης.
            // Έτσι ο υπολογισμός μπορεί να αλλάζει κανόνες ανά ημέρα.
            // ============================================================
            const istorikoRowsByKodikos = new Map();

            if (IstorikoProslhpseonAllagonModel && kodikoi.length > 0) {
                const istorikoQuery = {
                    team: sessionTeam,
                    company_kod: companyId,
                    kodikos: mongoose.trusted({ $in: kodikoi }),
                    afora_allagh_oron_ergasias: true,

                    // ------------------------------------------------------------
                    // Θέλουμε ιστορικές εγγραφές όρων εργασίας που τέμνονται με
                    // την περίοδο υπολογισμού.
                    //
                    // Προτεραιότητα έχουν τα νέα πεδία:
                    //   hmeromhnia_isxyos_oron_ergasias_apo/eos
                    //
                    // Για παλιά δεδομένα, όπου αυτά δεν υπάρχουν, κρατάμε fallback
                    // στα παλιά hmeromhnia_allaghs_orarioy_apo/eos.
                    //
                    // ΣΗΜΑΝΤΙΚΟ:
                    // Δεν χρησιμοποιούμε { $exists: false } σε Date fields εδώ,
                    // γιατί με sanitizeFilter/Mongoose μπορεί να γίνει cast σαν Date
                    // και να σκάσει CastError. Το { field: null } σε MongoDB
                    // καλύπτει και null και missing πεδία.
                    // ------------------------------------------------------------
                    $or: mongoose.trusted([
                        {
                            hmeromhnia_isxyos_oron_ergasias_apo: mongoose.trusted({
                                $lte: eosDate
                            }),
                            $or: mongoose.trusted([
                                {
                                    hmeromhnia_isxyos_oron_ergasias_eos: mongoose.trusted({
                                        $gte: calculationStartDate
                                    })
                                },
                                { hmeromhnia_isxyos_oron_ergasias_eos: null }
                            ])
                        },
                        {
                            // Fallback για παλιές εγγραφές χωρίς τα νέα πεδία ισχύος όρων.
                            hmeromhnia_isxyos_oron_ergasias_apo: null,
                            hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({
                                $lte: eosDate
                            }),
                            $or: mongoose.trusted([
                                {
                                    hmeromhnia_allaghs_orarioy_eos: mongoose.trusted({
                                        $gte: calculationStartDate
                                    })
                                },
                                { hmeromhnia_allaghs_orarioy_eos: null }
                            ])
                        }
                    ])
                };

                const istorikoRows = await IstorikoProslhpseonAllagonModel.find(istorikoQuery)
                    .select(
                        'kodikos aa_eggrafhs hmeromhnia_allaghs_orarioy_apo hmeromhnia_allaghs_orarioy_eos ' +
                            'hmeromhnia_isxyos_oron_ergasias_apo hmeromhnia_isxyos_oron_ergasias_eos ' +
                            'hmeres_ergasias_ebdomadas ores_ergasias_ebdomadas ' +
                            'mo_oron_hmerhsias_ergasias typos_apasxolhshs typos_ebdomadas ' +
                            'afora_allagh_oron_ergasias createdAt'
                    )
                    .sort({
                        kodikos: 1,
                        hmeromhnia_isxyos_oron_ergasias_apo: 1,
                        hmeromhnia_allaghs_orarioy_apo: 1,
                        createdAt: 1
                    })
                    .lean();

                for (const row of istorikoRows) {
                    const key = row.kodikos;
                    if (!istorikoRowsByKodikos.has(key)) {
                        istorikoRowsByKodikos.set(key, []);
                    }
                    istorikoRowsByKodikos.get(key).push(row);
                }

                console.log(
                    `[calcApasxolhseisPeriodoy] Ιστορικές εγγραφές όρων εργασίας: ${istorikoRows.length}`
                );
            } else {
                console.warn(
                    '[calcApasxolhseisPeriodoy] Δεν βρέθηκε διαθέσιμο IstorikoProslhpseonAllagonModel. Θα χρησιμοποιηθούν τα τρέχοντα στοιχεία εργαζομένων.'
                );
            }

            const kodikoiChunks = chunkArray(kodikoi, 300);
            const prodhlomena = [];

            for (const kodikoiChunk of kodikoiChunks) {
                const prodhlomenaQuery = {
                    team: sessionTeam,
                    company_kod: companyId,
                    kodikos: mongoose.trusted({ $in: kodikoiChunk }),
                    hmeromhnia: mongoose.trusted({
                        $gte: calculationStartDate,
                        $lte: eosDate
                    })
                };

                const chunkRecords = await ProdhlomenaOrariaModel.find(prodhlomenaQuery)
                    .select(
                        'kodikos hmeromhnia repo argia is_locked ' +
                            'ores_ergasias cards_ores_ergasias ' +
                            'apo_ora_01 eos_ora_01 apo_ora_02 eos_ora_02 apo_ora_03 eos_ora_03 ' +
                            'cards_apo_ora_01 cards_eos_ora_01 ' +
                            'cards_apo_ora_02 cards_eos_ora_02 ' +
                            'cards_apo_ora_03 cards_eos_ora_03'
                    )
                    .sort({ kodikos: 1, hmeromhnia: 1 })
                    .lean();

                prodhlomena.push(...chunkRecords);
            }

            prodhlomena.sort((a, b) => {
                const kodikosCompare = String(a.kodikos || '').localeCompare(
                    String(b.kodikos || '')
                );
                if (kodikosCompare !== 0) return kodikosCompare;

                return new Date(a.hmeromhnia).getTime() - new Date(b.hmeromhnia).getTime();
            });

            const noCardsDisplayContext = await buildNoCardsDisplayContext({
                team: sessionTeam,
                companyId,
                companyKodikos: req.session.companyKodikos,
                etos: req.session.yearInUse,
                periodStart: calculationStartDate,
                periodEnd: eosDate
            });

            const argiesDateSet = new Set(noCardsDisplayContext.argiesByDateKey.keys());

            console.log(
                `[calcApasxolhseisPeriodoy] Προδηλωμένα προς έλεγχο: ${prodhlomena.length}`
            );

            const weeklyStateMap = new Map();

            for (const rec of prodhlomena) {
                const ergazomenos = employeesByKodikos.get(rec.kodikos);
                if (!ergazomenos) continue;
                const calculationRec = normalizeZeroLengthCardPairs(rec);

                const istorikoRows = istorikoRowsByKodikos.get(calculationRec.kodikos) || [];
                const effectiveErgazomenos = getEffectiveEmployeeForDate(
                    calculationRec,
                    ergazomenos,
                    istorikoRows
                );

                const weekKey = `${calculationRec.kodikos}|${getWeekKeySunday(calculationRec.hmeromhnia)}`;

                if (!weeklyStateMap.has(weekKey)) {
                    const rules = getWorkTimeRules(effectiveErgazomenos);

                    const periodStartDate = new Date(apoDate);
                    const weekStartDate = startOfWeekSundayUtc(calculationRec.hmeromhnia);

                    const isFirstPartialWeek =
                        weekStartDate < periodStartDate && periodStartDate.getUTCDay() !== 0;

                    weeklyStateMap.set(weekKey, {
                        weeklyRegularCardsMinutes: 0,
                        processedRegularMinutes: 0,
                        weeklyOverworkCapMinutes: rules.weeklyOverworkCapMinutes,
                        weeklyLegalLimitMinutes: rules.weeklyLegalLimitMinutes,
                        usedOverworkMinutes: 0,

                        // true μόνο για την 1η εβδομάδα της περιόδου όταν η περίοδος δεν ξεκινά Κυριακή
                        isFirstPartialWeek
                    });
                }

                const preliminaryContext = {
                    rec: calculationRec,
                    ergazomenos: effectiveErgazomenos,
                    argiesDateSet,
                    proorhProseleyshMinutes,
                    proorhApoxorhshMinutes,
                    evelikthProselefshMinutes:
                        parseInt(effectiveErgazomenos.evelikth_proselefsh || 0, 10) || 0
                };

                const preliminaryUpdate = {};
                const preliminarySplitUpdate =
                    checkBrokenProgramVsBrokenCards(preliminaryContext);
                Object.assign(preliminaryUpdate, preliminarySplitUpdate);
                if (Object.keys(preliminarySplitUpdate).length === 0) {
                    Object.assign(preliminaryUpdate, checkEarlyOrLateCard(preliminaryContext, 1));
                    Object.assign(preliminaryUpdate, checkEarlyOrLateCard(preliminaryContext, 2));
                    Object.assign(preliminaryUpdate, checkEarlyOrLateCard(preliminaryContext, 3));
                }
                Object.assign(
                    preliminaryUpdate,
                    checkIncompleteCardPairAgainstDeclared(preliminaryContext)
                );
                Object.assign(preliminaryUpdate, checkContinuousVsBrokenCards(preliminaryContext));
                Object.assign(
                    preliminaryUpdate,
                    checkBrokenProgramVsContinuousCards(preliminaryContext)
                );
                Object.assign(preliminaryUpdate, checkNoDeclaredScheduleCards(preliminaryContext));

                const weeklyRec = { ...calculationRec, ...preliminaryUpdate };

                if (isRegularWorkingDayForOverwork(weeklyRec, effectiveErgazomenos)) {
                    weeklyStateMap.get(weekKey).weeklyRegularCardsMinutes +=
                        getPayrollDailyWorkMinutes(weeklyRec, effectiveErgazomenos);
                }
            }

            const bulkOps = [];

            for (const rec of prodhlomena) {
                const ergazomenos = employeesByKodikos.get(rec.kodikos);
                if (!ergazomenos) continue;
                const calculationRec = normalizeZeroLengthCardPairs(rec);

                const istorikoRows = istorikoRowsByKodikos.get(calculationRec.kodikos) || [];
                const effectiveErgazomenos = getEffectiveEmployeeForDate(
                    calculationRec,
                    ergazomenos,
                    istorikoRows
                );

                const context = {
                    rec: calculationRec,
                    // Από εδώ και κάτω οι υπάρχουσες συναρτήσεις λαμβάνουν effective
                    // εργαζόμενο, δηλαδή current employee + ιστορικούς όρους ημέρας.
                    ergazomenos: effectiveErgazomenos,
                    argiesDateSet,
                    proorhProseleyshMinutes,
                    proorhApoxorhshMinutes,
                    evelikthProselefshMinutes:
                        parseInt(effectiveErgazomenos.evelikth_proselefsh || 0, 10) || 0
                };

                const update = {};

                const splitUpdate = checkBrokenProgramVsBrokenCards(context);
                Object.assign(update, splitUpdate);
                if (Object.keys(splitUpdate).length === 0) {
                    Object.assign(update, checkEarlyOrLateCard(context, 1));
                    Object.assign(update, checkEarlyOrLateCard(context, 2));
                    Object.assign(update, checkEarlyOrLateCard(context, 3));
                }
                Object.assign(update, checkIncompleteCardPairAgainstDeclared(context));

                Object.assign(update, checkContinuousVsBrokenCards(context));
                Object.assign(update, checkBrokenProgramVsContinuousCards(context));
                Object.assign(update, checkNoDeclaredScheduleCards(context));

                // Από αυτό το σημείο και μετά οι υπολογισμοί πρέπει να βλέπουν το
                // ήδη παραγμένο απολογιστικό ωράριο, όχι μόνο το αρχικό rec/raw cards.
                const workingRec = { ...calculationRec, ...update };
                const workingContext = {
                    ...context,
                    rec: workingRec
                };

                Object.assign(update, checkNightHours(workingContext));
                Object.assign(update, checkSundayHolidayHours(workingContext));
                Object.assign(update, checkRepoAdeiaAstheneiaApologistika(workingContext));
                Object.assign(update, checkOresApoysias(workingContext));

                const weekKey = `${rec.kodikos}|${getWeekKeySunday(rec.hmeromhnia)}`;
                const weeklyState = weeklyStateMap.get(weekKey);

                if (weeklyState) {
                    Object.assign(
                        update,
                        calculateAdditionalAndOverworkForDay(workingContext, weeklyState)
                    );
                }

                if (Object.keys(update).length === 0) continue;
                if (!isDateInsideRange(rec.hmeromhnia, apoDate, eosDate)) continue;
                if (rec.is_locked === true) continue;

                bulkOps.push({
                    updateOne: {
                        filter: { _id: rec._id },
                        update: { $set: update },
                        upsert: false
                    }
                });
            }

            const CHUNK_SIZE = 1000;
            let totalModified = 0;

            for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
                const chunk = bulkOps.slice(i, i + CHUNK_SIZE);

                const result = await ProdhlomenaOrariaModel.bulkWrite(chunk, {
                    ordered: false
                });

                totalModified += result.modifiedCount || 0;
            }

            const weeklyRepoPostCheck = await runWeeklyRepoPostCheck({
                sessionTeam,
                companyId,
                apoDate,
                eosDate,
                selectedYpokatasthma,
                noCardsDisplayContext
            });

            console.log(
                `[calcApasxolhseisPeriodoy] ✅ Checked: ${prodhlomena.length}, Updated: ${totalModified}, RepoPostCheckUpdated: ${weeklyRepoPostCheck.recordsUpdated}, RepoDeviations: ${weeklyRepoPostCheck.deviations.length}`
            );

            return res.json({
                success: true,
                message: 'Ο υπολογισμός ολοκληρώθηκε επιτυχώς.',
                employeesCount: ergazomenoi.length,
                recordsChecked: prodhlomena.length,
                recordsUpdated: totalModified,
                weeklyRepoPostCheck: {
                    recordsChecked: weeklyRepoPostCheck.recordsChecked,
                    recordsUpdated: weeklyRepoPostCheck.recordsUpdated,
                    deviationsCount: weeklyRepoPostCheck.deviations.length,
                    deviationsSaved: weeklyRepoPostCheck.deviationsSaved || 0,
                    deviations: weeklyRepoPostCheck.deviations
                }
            });
        } catch (error) {
            console.error('[calcApasxolhseisPeriodoy] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά τον υπολογισμό απασχολήσεων περιόδου.'
            });
        }
    };

    static updateProdhlomenaOrariaReviewRecord = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;
            const changedBy =
                req.session.userName || req.session.username || req.session.userId || '';

            if (!canReviewEdit(req)) {
                return res.status(403).json({
                    success: false,
                    message: 'Δεν έχετε δικαίωμα για αποθήκευση αλλαγών.'
                });
            }

            const { id } = req.params;
            const { updates = {}, reason = '' } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Μη έγκυρο ID εγγραφής.'
                });
            }

            if (!reason || String(reason).trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Παρακαλώ συμπληρώστε αιτιολογία αλλαγής.'
                });
            }

            const allowedFields = [
                'cards_apo_ora_01',
                'cards_eos_ora_01',
                'cards_apo_ora_02',
                'cards_eos_ora_02',
                'cards_apo_ora_03',
                'cards_eos_ora_03',

                'apo_ora_01_apologistika',
                'eos_ora_01_apologistika',
                'apo_ora_02_apologistika',
                'eos_ora_02_apologistika',
                'apo_ora_03_apologistika',
                'eos_ora_03_apologistika',

                'apologistiko_biblio',
                'ores_nyxtas_apologistika',
                'ores_argion_prosayxhsh_apologistika',
                'kyriakes_apologistika',

                'ores_prostheths_ergasias_apologistika',

                'ores_yperergasias_apologistika',
                'ores_yperergasias_nyxtas_apologistika',
                'ores_yperergasias_argion_apologistika',
                'ores_yperergasias_argion_nyxtas_apologistika',

                'ores_nominhs_yperorias_apologistika',
                'ores_nominhs_yperorias_nyxtas_apologistika',
                'ores_nominhs_yperorias_argion_apologistika',
                'ores_nominhs_yperorias_argion_nyxtas_apologistika',

                'ores_paranomhs_yperorias_apologistika',
                'ores_paranomhs_yperorias_nyxtas_apologistika',
                'ores_paranomhs_yperorias_argion_apologistika',
                'ores_paranomhs_yperorias_argion_nyxtas_apologistika',

                'repo_apologistika',
                'adeia_apologistika',
                'kathgoria_adeias_apologistika',
                'astheneia_apologistika',

                'kyriakes_apologistika',
                'ores_ergasias_apologistika',
                'ores_argion_prosayxhsh_apologistika',
                'ores_argion_ergasia_apologistika',

                'ores_apoysias_apologistika'
            ];

            const cleanUpdates = {};

            for (const field of allowedFields) {
                if (Object.prototype.hasOwnProperty.call(updates, field)) {
                    cleanUpdates[field] = updates[field];
                }
            }

            if (Object.keys(cleanUpdates).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχουν επιτρεπτά πεδία για ενημέρωση.'
                });
            }

            const oldRecord = await ProdhlomenaOrariaModel.findOne({
                _id: id,
                team: sessionTeam,
                company_kod: companyId
            }).lean();

            if (!oldRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε η εγγραφή.'
                });
            }

            const oldValues = {};
            const newValues = {};

            for (const [field, value] of Object.entries(cleanUpdates)) {
                const oldValue = oldRecord[field];

                if (String(oldValue ?? '') !== String(value ?? '')) {
                    oldValues[field] = oldValue ?? '';
                    newValues[field] = value ?? '';
                }
            }

            if (Object.keys(newValues).length === 0) {
                return res.json({
                    success: true,
                    message: 'Δεν υπήρχαν αλλαγές για αποθήκευση.'
                });
            }

            cleanUpdates.is_locked = true;
            cleanUpdates.locked_by = changedBy;
            cleanUpdates.locked_at = new Date();

            await ProdhlomenaOrariaModel.updateOne(
                {
                    _id: id,
                    team: sessionTeam,
                    company_kod: companyId
                },
                {
                    $set: cleanUpdates
                }
            );

            await ProdhlomenaOrariaAuditModel.create({
                team: sessionTeam,
                company_kod: companyId,
                prodhlomena_oraria_id: oldRecord._id,
                kodikos: oldRecord.kodikos,
                ypokatasthma: oldRecord.ypokatasthma,
                hmeromhnia: oldRecord.hmeromhnia,
                changedBy,
                reason: String(reason).trim(),
                oldValues,
                newValues
            });

            return res.json({
                success: true,
                message: 'Η εγγραφή ενημερώθηκε επιτυχώς.'
            });
        } catch (error) {
            console.error('[updateProdhlomenaOrariaReviewRecord] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την ενημέρωση της εγγραφής.',
                error: error.message
            });
        }
    };

    static unlockProdhlomenaOrariaReviewRecord = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;
            const changedBy =
                req.session.userName || req.session.username || req.session.userId || '';

            if (!canReviewEdit(req)) {
                return res.status(403).json({
                    success: false,
                    message: 'Δεν έχετε δικαίωμα για ξεκλείδωμα εγγραφής.'
                });
            }

            const { id } = req.params;
            const { reason = '' } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Μη έγκυρο ID εγγραφής.'
                });
            }

            if (!reason || String(reason).trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Παρακαλώ συμπληρώστε αιτιολογία ξεκλειδώματος.'
                });
            }

            const oldRecord = await ProdhlomenaOrariaModel.findOne({
                _id: id,
                team: sessionTeam,
                company_kod: companyId
            }).lean();

            if (!oldRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε η εγγραφή.'
                });
            }

            if (oldRecord.is_locked !== true) {
                return res.json({
                    success: true,
                    message: 'Η εγγραφή δεν ήταν κλειδωμένη.'
                });
            }

            await ProdhlomenaOrariaModel.updateOne(
                {
                    _id: id,
                    team: sessionTeam,
                    company_kod: companyId
                },
                {
                    $set: {
                        is_locked: false,
                        unlocked_by: changedBy,
                        unlocked_at: new Date()
                    },
                    $unset: {
                        locked_by: '',
                        locked_at: ''
                    }
                }
            );

            await ProdhlomenaOrariaAuditModel.create({
                team: sessionTeam,
                company_kod: companyId,
                prodhlomena_oraria_id: oldRecord._id,
                kodikos: oldRecord.kodikos,
                ypokatasthma: oldRecord.ypokatasthma,
                hmeromhnia: oldRecord.hmeromhnia,
                changedBy,
                reason: String(reason).trim(),
                oldValues: {
                    is_locked: true,
                    locked_by: oldRecord.locked_by || '',
                    locked_at: oldRecord.locked_at || ''
                },
                newValues: {
                    is_locked: false,
                    unlocked_by: changedBy
                }
            });

            return res.json({
                success: true,
                message: 'Η εγγραφή ξεκλειδώθηκε επιτυχώς.'
            });
        } catch (error) {
            console.error('[unlockProdhlomenaOrariaReviewRecord] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά το ξεκλείδωμα της εγγραφής.',
                error: error.message
            });
        }
    };

    static restoreProdhlomenaOrariaReviewRecord = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;
            const changedBy = req.session.userName || req.session.username || '';

            if (!canReviewEdit(req)) {
                return res.status(403).json({
                    success: false,
                    message: 'Δεν έχετε δικαίωμα για επαναφορά εγγραφής.'
                });
            }

            const { id, auditId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(auditId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Μη έγκυρα IDs.'
                });
            }

            const audit = await ProdhlomenaOrariaAuditModel.findOne({
                _id: auditId,
                team: sessionTeam,
                company_kod: companyId,
                prodhlomena_oraria_id: id
            }).lean();

            if (!audit) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε audit record.'
                });
            }

            const oldRecord = await ProdhlomenaOrariaModel.findOne({
                _id: id,
                team: sessionTeam,
                company_kod: companyId
            }).lean();

            if (!oldRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε η εγγραφή.'
                });
            }

            const restoreValues = audit.oldValues || {};

            restoreValues.is_locked = true;
            restoreValues.locked_by = changedBy;
            restoreValues.locked_at = new Date();

            await ProdhlomenaOrariaModel.updateOne(
                {
                    _id: id,
                    team: sessionTeam,
                    company_kod: companyId
                },
                {
                    $set: restoreValues
                }
            );

            await ProdhlomenaOrariaAuditModel.create({
                team: sessionTeam,
                company_kod: companyId,
                prodhlomena_oraria_id: oldRecord._id,
                kodikos: oldRecord.kodikos,
                ypokatasthma: oldRecord.ypokatasthma,
                hmeromhnia: oldRecord.hmeromhnia,
                changedBy,
                reason: `RESTORE FROM AUDIT ${auditId}`,
                oldValues: audit.newValues || {},
                newValues: restoreValues
            });

            return res.json({
                success: true,
                message: 'Η επαναφορά ολοκληρώθηκε επιτυχώς.'
            });
        } catch (error) {
            console.error('[restoreProdhlomenaOrariaReviewRecord] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την επαναφορά.',
                error: error.message
            });
        }
    };

    static getProdhlomenaOrariaReviewAudit = async (req, res) => {
        try {
            const sessionTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Μη έγκυρο ID εγγραφής.'
                });
            }

            const rows = await ProdhlomenaOrariaAuditModel.find({
                team: sessionTeam,
                company_kod: companyId,
                prodhlomena_oraria_id: id
            })
                .sort({ changedAt: -1 })
                .limit(100)
                .lean();

            return res.json({
                success: true,
                rows
            });
        } catch (error) {
            console.error('[getProdhlomenaOrariaReviewAudit] ❌', error);

            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά την ανάκτηση ιστορικού αλλαγών.',
                error: error.message
            });
        }
    };

    // ============================================================================
    // ✅ E7N: Επιλογή τρόπου αποστολής στο ΕΡΓΑΝΗ
    //
    // Υποστηρίζει δύο ροές:
    // 1) XML + Playwright  -> Προσωρινή καταχώρηση στο ΕΡΓΑΝΗ
    // 2) JSON + REST API   -> Οριστική υποβολή στο ΕΡΓΑΝΗ και επιστροφή πρωτοκόλλου
    //
    // Αναμενόμενο body από fetch:
    // {
    //   "ergazomenosId": "...",                 // _id εργαζόμενου ή kodikos εργαζόμενου
    //   "ypokatasthma": "0",                    // προαιρετικά, αλλιώς από εργαζόμενο
    //   "erganiUploadMethod": "xml" | "rest",   // default: "xml"
    //   "options": { ... }                      // προαιρετικά overrides για ημερομηνίες/σχόλια
    // }
    // ============================================================================
    static submitE7NToErganh = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const userId = req.session?.userId || req.session?.user?._id || null;

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            const body = req.body || {};

            const ergazomenosId =
                body.ergazomenosId || body.employeeId || body.id || body.kodikos || '';

            if (!ergazomenosId) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ο εργαζόμενος για την υποβολή Ε7Ν.'
                });
            }

            const rawUploadMethod =
                body.erganiUploadMethod ||
                body.submissionMethod ||
                body.uploadMethod ||
                body.method ||
                'xml';

            const uploadMethod = String(rawUploadMethod).trim().toLowerCase();

            if (!['xml', 'rest', 'json', 'json_rest'].includes(uploadMethod)) {
                return res.status(400).json({
                    success: false,
                    message: 'Μη έγκυρος τρόπος αποστολής. Επιτρεπτές τιμές: xml ή rest.'
                });
            }

            // --------------------------------------------------------------------
            // 1) Φόρτωση εργαζομένου
            // --------------------------------------------------------------------
            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                employeeQuery._id = ergazomenosId;
            } else {
                employeeQuery.kodikos = String(ergazomenosId).trim();
            }

            const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε ο εργαζόμενος για την υποβολή Ε7Ν.'
                });
            }

            // --------------------------------------------------------------------
            // 2) Φόρτωση εταιρείας
            // --------------------------------------------------------------------
            let companyData = null;

            if (mongoose.Types.ObjectId.isValid(String(companyId))) {
                companyData = await CompaniesModel.findById(companyId).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({
                    kod: companyId
                }).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({
                    kodikos: companyId
                }).lean();
            }

            if (!companyData) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν τα στοιχεία της εταιρείας.'
                });
            }

            // --------------------------------------------------------------------
            // 3) Φόρτωση υποκαταστήματος
            // --------------------------------------------------------------------
            const selectedYpokatasthma =
                body.ypokatasthma ||
                body.ypokatasthmata ||
                body.ypokatasthmata_stathera ||
                ergazomenos.ypokatasthma ||
                ergazomenos.ypokatasthma_kodikos ||
                '0';

            let ypokatasthmataData = await YpokatasthmataModel.findOne({
                companykod_object: companyId,
                kodikos: String(selectedYpokatasthma)
            }).lean();

            if (!ypokatasthmataData) {
                ypokatasthmataData = await YpokatasthmataModel.findOne({
                    company: companyData.kod || companyData.kodikos || companyId,
                    kodikos: String(selectedYpokatasthma)
                }).lean();
            }

            if (!ypokatasthmataData) {
                return res.status(404).json({
                    success: false,
                    message: `Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`
                });
            }

            // --------------------------------------------------------------------
            // 4) Credentials ΕΡΓΑΝΗ από PasswordsModel, όπως στο υπάρχον XML flow
            // --------------------------------------------------------------------
            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            };

            // --------------------------------------------------------------------
            // 5) Options προς generator.
            // Κρατάμε όσα overrides έρχονται από body.options και επιτρέπουμε
            // και top-level fields για ευκολότερο fetch από UI.
            // --------------------------------------------------------------------
            const generatorOptions = {
                ...(body.options || {}),

                hmeromhnia_apoxorhshs:
                    body.hmeromhnia_apoxorhshs ||
                    body.hmeromhnia_apoxwrhshs ||
                    body.apolysisdate ||
                    body.options?.hmeromhnia_apoxorhshs ||
                    body.options?.hmeromhnia_apoxwrhshs ||
                    body.options?.apolysisdate,

                hmeromhnia_lhxhs_symbashs:
                    body.hmeromhnia_lhxhs_symbashs ||
                    body.lixisymbashdate ||
                    body.options?.hmeromhnia_lhxhs_symbashs ||
                    body.options?.lixisymbashdate,

                comments:
                    body.comments ||
                    body.f_comments ||
                    body.options?.comments ||
                    body.options?.f_comments ||
                    ''
            };

            // --------------------------------------------------------------------
            // 6Α) XML + Playwright -> Προσωρινή καταχώρηση
            // --------------------------------------------------------------------
            if (uploadMethod === 'xml') {
                const xmlResult = await generateE7NXML(
                    ergazomenos,
                    companyData,
                    ypokatasthmataData,
                    generatorOptions
                );

                const tmpXmlDir = path.join(process.cwd(), 'tmp', 'erganh-xml');

                if (!fs.existsSync(tmpXmlDir)) {
                    fs.mkdirSync(tmpXmlDir, { recursive: true });
                }

                const xmlFilename =
                    xmlResult.filename ||
                    `${String(ergazomenos._id || ergazomenos.kodikos || 'E7N')}_E7N.xml`;

                const xmlPath = path.join(tmpXmlDir, xmlFilename);

                fs.writeFileSync(xmlPath, xmlResult.xml, 'utf8');

                const uploadResult = await uploadE3ToErganh(
                    companyId,
                    xmlPath,
                    userId,
                    {
                        username: creds.username,
                        password: creds.password
                    },
                    {
                        xmlType: 'ma_222',
                        isPermanent: false
                    }
                );

                return res.status(uploadResult?.success ? 200 : 400).json({
                    success: !!uploadResult?.success,
                    uploadMethod: 'xml',
                    temporary: true,
                    finalSubmission: false,
                    message: uploadResult?.success
                        ? 'Το E7N XML δημιουργήθηκε και ανέβηκε στο ΕΡΓΑΝΗ ως προσωρινή καταχώρηση.'
                        : uploadResult?.userMessage ||
                          'Το E7N XML δημιουργήθηκε, αλλά η αποστολή στο ΕΡΓΑΝΗ απέτυχε.',
                    filename: xmlFilename,
                    xmlPath,
                    s3Key: xmlResult.s3Key,
                    s3Url: xmlResult.s3Url,
                    generator: {
                        success: xmlResult.success,
                        saveError: xmlResult.saveError || null
                    },
                    erganh: uploadResult
                });
            }

            // --------------------------------------------------------------------
            // 6Β) JSON + REST API -> Οριστική υποβολή
            // --------------------------------------------------------------------
            const jsonResult = await generateE7NJSON(
                ergazomenos,
                companyData,
                ypokatasthmataData,
                generatorOptions
            );

            const payload = jsonResult.payload || jsonResult.json;

            const restResult = await uploadJsonDocumentToErgani({
                submissionCode: 'WebE7N',
                payload,
                creds,
                fetchSubmittedPdf: true
            });

            const submittedPdfBuffer = restResult?.submittedPdf?.buffer || null;
            const submittedPdfContentType =
                restResult?.submittedPdf?.contentType || 'application/pdf';

            let pdfStorage = {
                pdfSaved: false,
                pdfFilename: null,
                pdfS3Key: null,
                pdfS3Url: null,
                pdfRelativePath: null,
                pdfSizeBytes: 0,
                pdfContentType: submittedPdfContentType,
                pdfSaveError: restResult?.submittedPdf?.error || null
            };

            if (restResult?.success) {
                const isValidPdfBuffer =
                    Buffer.isBuffer(submittedPdfBuffer) &&
                    submittedPdfBuffer.length > 5 &&
                    submittedPdfBuffer.subarray(0, 5).toString() === '%PDF-';

                if (isValidPdfBuffer) {
                    pdfStorage = await saveSubmittedErganiPdfToS3({
                        pdfBuffer: submittedPdfBuffer,
                        contentType: 'application/pdf',
                        ergazomenos,
                        companyData,
                        restResult
                    });
                } else {
                    pdfStorage = {
                        pdfSaved: false,
                        pdfFilename: null,
                        pdfS3Key: null,
                        pdfS3Url: null,
                        pdfRelativePath: null,
                        pdfSizeBytes: 0,
                        pdfContentType: null,
                        pdfSaveError:
                            restResult?.submittedPdf?.error ||
                            `Το ΕΡΓΑΝΗ δεν επέστρεψε έγκυρο PDF. Content-Type: ${
                                restResult?.submittedPdf?.rawContentType ||
                                restResult?.submittedPdf?.contentType ||
                                'unknown'
                            }`
                    };
                }
            }

            const effectiveSubmitDate = parseErganiSubmitDate(restResult?.submitDate) || new Date();

            const submissionYear = effectiveSubmitDate.getFullYear();
            const submissionMonth = effectiveSubmitDate.getMonth() + 1;
            const submissionDay = effectiveSubmitDate.getDate();

            const erganhLog = await ErgazomenoiErganhModel.create({
                team: sessionTeam,
                companykod_object: companyData?._id || companyId,
                companykod: companyData?.kod || companyData?.kodikos || '',

                ergazomenos_object: ergazomenos?._id,
                ergazomenos_kodikos: ergazomenos?.kodikos || '',
                ergazomenos_afm: ergazomenos?.afm || '',
                ergazomenos_eponymo: ergazomenos?.eponymo || '',
                ergazomenos_onoma: ergazomenos?.onoma || '',

                ypokatasthma_object: ypokatasthmataData?._id || null,
                ypokatasthma_kodikos:
                    ypokatasthmataData?.kodikos || ypokatasthmataData?.kod || selectedYpokatasthma,

                submission_code: 'WebE7N',
                submission_id: restResult?.submission?.id || null,
                submission_description: restResult?.submission?.description || '',
                process_code: 'ma_222',
                process_description: 'Λύση Σύμβασης Ορισμένου Χρόνου (E7N)',

                upload_method: 'REST',
                submission_status: restResult?.success ? 'SUCCESS' : 'FAILED',
                is_temporary: false,
                is_final: restResult?.success === true,
                environment: process.env.ERGANI_ENV || 'trial',

                protocol: restResult?.protocol || null,

                submit_date_text: restResult?.submitDate || null,
                submit_date: effectiveSubmitDate,
                erganh_submission_id: restResult?.id || null,

                submission_year: submissionYear,
                submission_month: submissionMonth,
                submission_day: submissionDay,

                pdf_s3_key: pdfStorage.pdfS3Key,
                pdf_s3_url: pdfStorage.pdfS3Url,
                pdf_relative_path: pdfStorage.pdfRelativePath,
                pdf_filename: pdfStorage.pdfFilename,
                pdf_content_type: pdfStorage.pdfContentType,
                pdf_size_bytes: pdfStorage.pdfSizeBytes,

                request_payload: payload,
                erganh_raw_response: restResult?.raw || null,
                error_message: restResult?.success ? pdfStorage.pdfSaveError : restResult?.error,

                created_by_user: userId,
                created_by_username: req.session?.userName || req.session?.username || ''
            });

            const sanitizedErgani = sanitizeErganiResultForResponse(restResult);
            const pdfDeferred = restResult?.submittedPdf?.pdfDeferred === true;

            return res.status(restResult?.success ? 200 : 400).json({
                success: !!restResult?.success,
                uploadMethod: 'rest',
                temporary: false,
                finalSubmission: true,
                message: restResult?.success
                    ? 'Το E7N υποβλήθηκε οριστικά μέσω REST API.'
                    : restResult?.error || 'Η οριστική υποβολή E7N μέσω REST API απέτυχε.',
                protocol: restResult?.protocol || null,
                submitDate: restResult?.submitDate || null,
                erganhSubmissionId: restResult?.id || null,
                erganhLogId: erganhLog?._id || null,
                pdfSaved: pdfStorage.pdfSaved,
                pdfUrl:
                    pdfStorage.pdfS3Key && erganhLog?._id
                        ? getErganiPdfRoute(erganhLog._id)
                        : pdfStorage.pdfRelativePath
                          ? `/uploads/s3-mock/${pdfStorage.pdfRelativePath}`
                          : pdfStorage.pdfS3Url || '',
                pdfS3Key: pdfStorage.pdfS3Key,
                pdfFilename: pdfStorage.pdfFilename,
                pdfSizeBytes: pdfStorage.pdfSizeBytes,
                pdfSaveError: pdfStorage.pdfSaveError,
                pdfDeferred,
                pdfWarning: getErganiPdfDeferredWarning(pdfDeferred),
                submission: restResult?.submission || null,
                erganh: sanitizedErgani
            });
        } catch (error) {
            console.error('[submitE7NToErganh] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την αποστολή E7N στο ΕΡΓΑΝΗ.',
                error: error.message || String(error)
            });
        }
    };

    // ============================================================================
    // ✅ E3N: Επιλογή τρόπου αποστολής στο ΕΡΓΑΝΗ
    //
    // Υποστηρίζει δύο ροές:
    // 1) XML + Playwright  -> Προσωρινή καταχώρηση στο ΕΡΓΑΝΗ
    // 2) JSON + REST API   -> Οριστική υποβολή στο ΕΡΓΑΝΗ και επιστροφή πρωτοκόλλου
    //
    // Αναμενόμενο body από fetch:
    // {
    //   "ergazomenosId": "...",                 // _id εργαζόμενου ή kodikos εργαζόμενου
    //   "ypokatasthma": "0",                    // προαιρετικά, αλλιώς από εργαζόμενο
    //   "erganiUploadMethod": "xml" | "rest"    // default: "xml"
    // }
    // ============================================================================
    static compareE3NBeforeRestSubmit = async (req, res) => {
        try {
            const result = await compareE3NPreSubmit({
                sessionTeam: req.session?.userTeam,
                companyId: req.session?.companyInUse,
                body: req.body || {}
            });

            return res.status(200).json(result);
        } catch (error) {
            console.error('[compareE3NBeforeRestSubmit] ❌', error.message || error);

            return res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά τον έλεγχο πριν την οριστική Ε3Ν.',
                error: error.message || String(error)
            });
        }
    };

    static submitE3NToErganh = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const userId = req.session?.userId || req.session?.user?._id || null;

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            const body = req.body || {};

            const ergazomenosId =
                body.ergazomenosId || body.employeeId || body.id || body.kodikos || '';

            if (!ergazomenosId) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ο εργαζόμενος για την υποβολή Ε3Ν.'
                });
            }

            const rawUploadMethod =
                body.erganiUploadMethod ||
                body.submissionMethod ||
                body.uploadMethod ||
                body.method ||
                'xml';

            const uploadMethod = String(rawUploadMethod).trim().toLowerCase();

            if (!['xml', 'rest', 'json', 'json_rest'].includes(uploadMethod)) {
                return res.status(400).json({
                    success: false,
                    message: 'Μη έγκυρος τρόπος αποστολής. Επιτρεπτές τιμές: xml ή rest.'
                });
            }

            // --------------------------------------------------------------------
            // 1) Φόρτωση εργαζομένου
            // --------------------------------------------------------------------
            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                employeeQuery._id = ergazomenosId;
            } else {
                employeeQuery.kodikos = String(ergazomenosId).trim();
            }

            const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε ο εργαζόμενος για την υποβολή Ε3Ν.'
                });
            }

            // --------------------------------------------------------------------
            // 2) Φόρτωση εταιρείας
            // --------------------------------------------------------------------
            let companyData = null;

            if (mongoose.Types.ObjectId.isValid(String(companyId))) {
                companyData = await CompaniesModel.findById(companyId).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({
                    kod: companyId
                }).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({
                    kodikos: companyId
                }).lean();
            }

            if (!companyData) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν τα στοιχεία της εταιρείας.'
                });
            }

            // --------------------------------------------------------------------
            // 3) Φόρτωση υποκαταστήματος
            // --------------------------------------------------------------------
            const selectedYpokatasthma =
                body.ypokatasthma ||
                body.ypokatasthmata ||
                body.ypokatasthmata_stathera ||
                ergazomenos.ypokatasthma ||
                ergazomenos.ypokatasthma_kodikos ||
                '0';

            let ypokatasthmataData = await YpokatasthmataModel.findOne({
                companykod_object: companyId,
                kodikos: String(selectedYpokatasthma)
            }).lean();

            if (!ypokatasthmataData) {
                ypokatasthmataData = await YpokatasthmataModel.findOne({
                    company: companyData.kod || companyData.kodikos || companyId,
                    kodikos: String(selectedYpokatasthma)
                }).lean();
            }

            if (!ypokatasthmataData) {
                return res.status(404).json({
                    success: false,
                    message: `Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`
                });
            }

            // --------------------------------------------------------------------
            // 4) Credentials ΕΡΓΑΝΗ από PasswordsModel, όπως στο υπάρχον flow
            // --------------------------------------------------------------------
            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            };

            // --------------------------------------------------------------------
            // 5Α) XML + Playwright -> Προσωρινή καταχώρηση
            // --------------------------------------------------------------------
            if (uploadMethod === 'xml') {
                const xmlResult = await generateE3XML(ergazomenos, companyData, ypokatasthmataData);

                const tmpXmlDir = path.join(process.cwd(), 'tmp', 'erganh-xml');

                if (!fs.existsSync(tmpXmlDir)) {
                    fs.mkdirSync(tmpXmlDir, { recursive: true });
                }

                const xmlFilename =
                    xmlResult.filename ||
                    `${String(ergazomenos._id || ergazomenos.kodikos || 'E3N')}_E3N.xml`;

                const xmlPath = path.join(tmpXmlDir, xmlFilename);

                fs.writeFileSync(xmlPath, xmlResult.xml, 'utf8');

                const uploadResult = await uploadE3ToErganh(
                    companyId,
                    xmlPath,
                    userId,
                    {
                        username: creds.username,
                        password: creds.password
                    },
                    {
                        // Για Πρόσληψη WebE3N:
                        // trial id: 93, production id: 213.
                        // Το XML portal flow συνήθως χρησιμοποιεί το production process code.
                        // Αν στο trial σου θέλει ρητά ma_93, άλλαξε μόνο αυτή τη γραμμή σε 'ma_93'.
                        xmlType: 'ma_213',
                        isPermanent: false
                    }
                );

                return res.status(uploadResult?.success ? 200 : 400).json({
                    success: !!uploadResult?.success,
                    uploadMethod: 'xml',
                    temporary: true,
                    finalSubmission: false,
                    message: uploadResult?.success
                        ? 'Το E3N XML δημιουργήθηκε και ανέβηκε στο ΕΡΓΑΝΗ ως προσωρινή καταχώρηση.'
                        : uploadResult?.userMessage ||
                          'Το E3N XML δημιουργήθηκε, αλλά η αποστολή στο ΕΡΓΑΝΗ απέτυχε.',
                    filename: xmlFilename,
                    xmlPath,
                    s3Key: xmlResult.s3Key,
                    s3Url: xmlResult.s3Url,
                    generator: {
                        success: xmlResult.success,
                        saveError: xmlResult.saveError || null
                    },
                    erganh: uploadResult
                });
            }

            // --------------------------------------------------------------------
            // 5Β) JSON + REST API -> Οριστική υποβολή
            // --------------------------------------------------------------------
            const jsonResult = await generateE3NJSON(ergazomenos, companyData, ypokatasthmataData);

            const payload = jsonResult.payload || jsonResult.json;

            const restResult = await uploadJsonDocumentToErgani({
                submissionCode: 'WebE3N',
                payload,
                creds,
                fetchSubmittedPdf: true
            });

            const submittedPdfBuffer = restResult?.submittedPdf?.buffer || null;
            const submittedPdfContentType =
                restResult?.submittedPdf?.contentType || 'application/pdf';

            let pdfStorage = {
                pdfSaved: false,
                pdfFilename: null,
                pdfS3Key: null,
                pdfS3Url: null,
                pdfRelativePath: null,
                pdfSizeBytes: 0,
                pdfContentType: submittedPdfContentType,
                pdfSaveError: restResult?.submittedPdf?.error || null
            };

            if (restResult?.success) {
                const isValidPdfBuffer =
                    Buffer.isBuffer(submittedPdfBuffer) &&
                    submittedPdfBuffer.length > 5 &&
                    submittedPdfBuffer.subarray(0, 5).toString() === '%PDF-';

                if (isValidPdfBuffer) {
                    pdfStorage = await saveSubmittedErganiPdfToS3({
                        pdfBuffer: submittedPdfBuffer,
                        contentType: 'application/pdf',
                        ergazomenos,
                        companyData,
                        restResult
                    });
                } else {
                    pdfStorage = {
                        pdfSaved: false,
                        pdfFilename: null,
                        pdfS3Key: null,
                        pdfS3Url: null,
                        pdfRelativePath: null,
                        pdfSizeBytes: 0,
                        pdfContentType: null,
                        pdfSaveError:
                            restResult?.submittedPdf?.error ||
                            `Το ΕΡΓΑΝΗ δεν επέστρεψε έγκυρο PDF. Content-Type: ${
                                restResult?.submittedPdf?.rawContentType ||
                                restResult?.submittedPdf?.contentType ||
                                'unknown'
                            }`
                    };
                }
            }

            const effectiveSubmitDate = parseErganiSubmitDate(restResult?.submitDate) || new Date();

            const submissionYear = effectiveSubmitDate.getFullYear();
            const submissionMonth = effectiveSubmitDate.getMonth() + 1;
            const submissionDay = effectiveSubmitDate.getDate();

            const erganhLog = await ErgazomenoiErganhModel.create({
                team: sessionTeam,
                companykod_object: companyData?._id || companyId,
                companykod: companyData?.kod || companyData?.kodikos || '',

                ergazomenos_object: ergazomenos?._id,
                ergazomenos_kodikos: ergazomenos?.kodikos || '',
                ergazomenos_afm: ergazomenos?.afm || '',
                ergazomenos_eponymo: ergazomenos?.eponymo || '',
                ergazomenos_onoma: ergazomenos?.onoma || '',

                ypokatasthma_object: ypokatasthmataData?._id || null,
                ypokatasthma_kodikos:
                    ypokatasthmataData?.kodikos || ypokatasthmataData?.kod || selectedYpokatasthma,

                submission_code: 'WebE3N',
                submission_id: restResult?.submission?.id || null,
                submission_description: restResult?.submission?.description || '',
                process_code: process.env.ERGANI_ENV === 'production' ? 'ma_213' : 'ma_93',
                process_description: 'Πρόσληψη (E3N)',

                upload_method: 'REST',
                submission_status: restResult?.success ? 'SUCCESS' : 'FAILED',
                is_temporary: false,
                is_final: restResult?.success === true,
                environment: process.env.ERGANI_ENV || 'trial',

                protocol: restResult?.protocol || null,

                submit_date_text: restResult?.submitDate || null,
                submit_date: effectiveSubmitDate,
                erganh_submission_id: restResult?.id || null,

                submission_year: submissionYear,
                submission_month: submissionMonth,
                submission_day: submissionDay,

                pdf_s3_key: pdfStorage.pdfS3Key,
                pdf_s3_url: pdfStorage.pdfS3Url,
                pdf_relative_path: pdfStorage.pdfRelativePath,
                pdf_filename: pdfStorage.pdfFilename,
                pdf_content_type: pdfStorage.pdfContentType,
                pdf_size_bytes: pdfStorage.pdfSizeBytes,

                request_payload: payload,
                erganh_raw_response: restResult?.raw || null,
                error_message: restResult?.success ? pdfStorage.pdfSaveError : restResult?.error,

                created_by_user: userId,
                created_by_username: req.session?.userName || req.session?.username || ''
            });

            const sanitizedErgani = sanitizeErganiResultForResponse(restResult);
            const pdfDeferred = restResult?.submittedPdf?.pdfDeferred === true;

            return res.status(restResult?.success ? 200 : 400).json({
                success: !!restResult?.success,
                uploadMethod: 'rest',
                temporary: false,
                finalSubmission: true,
                message: restResult?.success
                    ? 'Το E3N υποβλήθηκε οριστικά μέσω REST API.'
                    : restResult?.error || 'Η οριστική υποβολή E3N μέσω REST API απέτυχε.',
                protocol: restResult?.protocol || null,
                submitDate: restResult?.submitDate || null,
                erganhSubmissionId: restResult?.id || null,
                erganhLogId: erganhLog?._id || null,
                pdfSaved: pdfStorage.pdfSaved,
                pdfUrl:
                    pdfStorage.pdfS3Key && erganhLog?._id
                        ? getErganiPdfRoute(erganhLog._id)
                        : pdfStorage.pdfRelativePath
                          ? `/uploads/s3-mock/${pdfStorage.pdfRelativePath}`
                          : pdfStorage.pdfS3Url || '',
                pdfS3Key: pdfStorage.pdfS3Key,
                pdfFilename: pdfStorage.pdfFilename,
                pdfSizeBytes: pdfStorage.pdfSizeBytes,
                pdfSaveError: pdfStorage.pdfSaveError,
                pdfDeferred,
                pdfWarning: getErganiPdfDeferredWarning(pdfDeferred),
                submission: restResult?.submission || null,
                erganh: sanitizedErgani
            });
        } catch (error) {
            console.error('[submitE3NToErganh] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την αποστολή E3N στο ΕΡΓΑΝΗ.',
                error: error.message || String(error)
            });
        }
    };

    // ============================================================================
    // ✅ E6N XML / REST JSON UPLOAD - WebE6NMP / WebE6NXP
    //    WebE6NMP: Trial id 109 / Production id 221
    //    WebE6NXP: Trial id 107 / Production id 220
    // ============================================================================
    static submitE6NToErganh = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const userId = req.session?.userId || req.session?.user?._id || null;

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            const body = req.body || {};
            const ergazomenosId =
                body.ergazomenosId || body.employeeId || body.id || body.kodikos || '';

            if (!ergazomenosId) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ο εργαζόμενος για την υποβολή E6N.'
                });
            }

            const e6nType = normalizeE6NType(
                body.e6nType ||
                    body.submissionCode ||
                    body.submission_code ||
                    body.processCode ||
                    body.process_code ||
                    body.lhxh_type ||
                    body.type ||
                    'WebE6NXP'
            );
            const config = E6N_CONFIG[e6nType];

            const rawUploadMethod =
                body.erganiUploadMethod ||
                body.submissionMethod ||
                body.uploadMethod ||
                body.method ||
                'xml';

            const uploadMethod = String(rawUploadMethod).trim().toLowerCase();

            if (!['xml', 'rest', 'json', 'json_rest'].includes(uploadMethod)) {
                return res.status(400).json({
                    success: false,
                    message: 'Μη έγκυρος τρόπος αποστολής. Επιτρεπτές τιμές: xml ή rest.'
                });
            }

            // --------------------------------------------------------------------
            // 1) Φόρτωση εργαζομένου
            // --------------------------------------------------------------------
            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                employeeQuery._id = ergazomenosId;
            } else {
                employeeQuery.kodikos = String(ergazomenosId).trim();
            }

            const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε ο εργαζόμενος για την υποβολή E6N.'
                });
            }

            // --------------------------------------------------------------------
            // 2) Φόρτωση εταιρείας
            // --------------------------------------------------------------------
            let companyData = null;

            if (mongoose.Types.ObjectId.isValid(String(companyId))) {
                companyData = await CompaniesModel.findById(companyId).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kod: companyId }).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kodikos: companyId }).lean();
            }

            if (!companyData) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν τα στοιχεία της εταιρείας.'
                });
            }

            // --------------------------------------------------------------------
            // 3) Φόρτωση υποκαταστήματος
            // --------------------------------------------------------------------
            const selectedYpokatasthma =
                body.ypokatasthma ||
                body.ypokatasthmata ||
                body.ypokatasthmata_stathera ||
                ergazomenos.ypokatasthma ||
                ergazomenos.ypokatasthma_kodikos ||
                '0';

            let ypokatasthmataData = await YpokatasthmataModel.findOne({
                companykod_object: companyId,
                kodikos: String(selectedYpokatasthma)
            }).lean();

            if (!ypokatasthmataData) {
                ypokatasthmataData = await YpokatasthmataModel.findOne({
                    company: companyData.kod || companyData.kodikos || companyId,
                    kodikos: String(selectedYpokatasthma)
                }).lean();
            }

            if (!ypokatasthmataData) {
                return res.status(404).json({
                    success: false,
                    message: `Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`
                });
            }

            // --------------------------------------------------------------------
            // 4) Credentials ΕΡΓΑΝΗ από PasswordsModel
            // --------------------------------------------------------------------
            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            };

            // --------------------------------------------------------------------
            // 5) Options προς generator.
            // --------------------------------------------------------------------
            const generatorOptions = {
                ...(body.options || {}),

                hmeromhnia_apolysis:
                    body.hmeromhnia_apolysis ||
                    body.hmeromhnia_apolyshs ||
                    body.hmeromhnia_apoxorhshs ||
                    body.hmeromhnia_apoxwrhshs ||
                    body.apolysisdate ||
                    body.apoxwrisi_date ||
                    body.options?.hmeromhnia_apolysis ||
                    body.options?.hmeromhnia_apolyshs ||
                    body.options?.hmeromhnia_apoxorhshs ||
                    body.options?.hmeromhnia_apoxwrhshs ||
                    body.options?.apolysisdate ||
                    body.options?.apoxwrisi_date,

                proidopoihshdate:
                    body.f_proidopoihshdate ||
                    body.proidopoihshdate ||
                    body.hmeromhnia_koinopoihshs_kataggelias ||
                    body.hmeromhnia_proidopoihshs ||
                    body.hmeromhnia_proeidopoihshs ||
                    body.options?.f_proidopoihshdate ||
                    body.options?.proidopoihshdate ||
                    body.options?.hmeromhnia_koinopoihshs_kataggelias ||
                    body.options?.hmeromhnia_proidopoihshs ||
                    body.options?.hmeromhnia_proeidopoihshs,

                minesproidopoihsh:
                    body.f_minesproidopoihsh ||
                    body.minesproidopoihsh ||
                    body.mhnes_proeidopoihshs ||
                    body.mines_proidopoihshs ||
                    body.mines_proeidopoihshs ||
                    body.options?.f_minesproidopoihsh ||
                    body.options?.minesproidopoihsh ||
                    body.options?.mhnes_proeidopoihshs ||
                    body.options?.mines_proidopoihshs ||
                    body.options?.mines_proeidopoihshs,

                koinopoihshdate:
                    body.f_koinopoihshdate ||
                    body.koinopoihshdate ||
                    body.hmeromhnia_koinopoihshs ||
                    body.hmeromhnia_koinopoihshs_kataggelias ||
                    body.options?.f_koinopoihshdate ||
                    body.options?.koinopoihshdate ||
                    body.options?.hmeromhnia_koinopoihshs ||
                    body.options?.hmeromhnia_koinopoihshs_kataggelias,

                poso_apozimiosis:
                    body.f_posoapozimiosis ||
                    body.posoapozimiosis ||
                    body.poso_apozimiosis ||
                    body.options?.f_posoapozimiosis ||
                    body.options?.posoapozimiosis ||
                    body.options?.poso_apozimiosis,

                comments:
                    body.comments ||
                    body.f_comments ||
                    body.options?.comments ||
                    body.options?.f_comments ||
                    '',

                e6_pdf_base64:
                    body.e6_pdf_base64 ||
                    body.e6n_pdf_base64 ||
                    body.f_file ||
                    body.options?.e6_pdf_base64 ||
                    body.options?.e6n_pdf_base64 ||
                    body.options?.f_file,

                allowFallbackPdf:
                    body.allowFallbackPdf !== false && body.options?.allowFallbackPdf !== false
            };

            // --------------------------------------------------------------------
            // 6Α) XML + Playwright -> Προσωρινή καταχώρηση
            // --------------------------------------------------------------------
            if (uploadMethod === 'xml') {
                const xmlResult =
                    e6nType === 'MP'
                        ? await generateE6NMPXML(
                              ergazomenos,
                              companyData,
                              ypokatasthmataData,
                              generatorOptions
                          )
                        : await generateE6NXPXML(
                              ergazomenos,
                              companyData,
                              ypokatasthmataData,
                              generatorOptions
                          );

                const tmpXmlDir = path.join(process.cwd(), 'tmp', 'erganh-xml');

                if (!fs.existsSync(tmpXmlDir)) {
                    fs.mkdirSync(tmpXmlDir, { recursive: true });
                }

                const xmlFilename =
                    xmlResult.filename ||
                    `${String(ergazomenos._id || ergazomenos.kodikos || config.folder)}_${config.folder}.xml`;

                const xmlPath = path.join(tmpXmlDir, xmlFilename);

                fs.writeFileSync(xmlPath, xmlResult.xml, 'utf8');

                const uploadResult = await uploadE3ToErganh(
                    companyId,
                    xmlPath,
                    userId,
                    {
                        username: creds.username,
                        password: creds.password
                    },
                    {
                        xmlType: config.xmlType,
                        isPermanent: false
                    }
                );

                return res.status(uploadResult?.success ? 200 : 400).json({
                    success: !!uploadResult?.success,
                    uploadMethod: 'xml',
                    temporary: true,
                    finalSubmission: false,
                    submissionCode: config.submissionCode,
                    processCode: config.xmlType,
                    message: uploadResult?.success
                        ? `Το ${config.submissionCode} XML δημιουργήθηκε και ανέβηκε στο ΕΡΓΑΝΗ ως προσωρινή καταχώρηση.`
                        : uploadResult?.userMessage ||
                          `Το ${config.submissionCode} XML δημιουργήθηκε, αλλά η αποστολή στο ΕΡΓΑΝΗ απέτυχε.`,
                    filename: xmlFilename,
                    xmlPath,
                    s3Key: xmlResult.s3Key,
                    s3Url: xmlResult.s3Url,
                    generator: {
                        success: xmlResult.success,
                        saveError: xmlResult.saveError || null
                    },
                    erganh: uploadResult
                });
            }

            // --------------------------------------------------------------------
            // 6Β) JSON + REST API -> Οριστική υποβολή
            // --------------------------------------------------------------------
            const jsonResult =
                e6nType === 'MP'
                    ? await generateE6NMPJSON(
                          ergazomenos,
                          companyData,
                          ypokatasthmataData,
                          generatorOptions
                      )
                    : await generateE6NXPJSON(
                          ergazomenos,
                          companyData,
                          ypokatasthmataData,
                          generatorOptions
                      );

            const payload = jsonResult.payload || jsonResult.json;

            const restResult = await uploadJsonDocumentToErgani({
                submissionCode: config.submissionCode,
                payload,
                creds,
                fetchSubmittedPdf: true
            });

            const submittedPdfBuffer = restResult?.submittedPdf?.buffer || null;
            const submittedPdfContentType =
                restResult?.submittedPdf?.contentType || 'application/pdf';

            let pdfStorage = {
                pdfSaved: false,
                pdfFilename: null,
                pdfS3Key: null,
                pdfS3Url: null,
                pdfRelativePath: null,
                pdfSizeBytes: 0,
                pdfContentType: submittedPdfContentType,
                pdfSaveError: restResult?.submittedPdf?.error || null
            };

            if (restResult?.success) {
                const isValidPdfBuffer =
                    Buffer.isBuffer(submittedPdfBuffer) &&
                    submittedPdfBuffer.length > 5 &&
                    submittedPdfBuffer.subarray(0, 5).toString() === '%PDF-';

                if (isValidPdfBuffer) {
                    pdfStorage = await saveSubmittedErganiPdfToS3({
                        pdfBuffer: submittedPdfBuffer,
                        contentType: 'application/pdf',
                        ergazomenos,
                        companyData,
                        restResult,
                        submissionFolder: config.folder
                    });
                } else {
                    pdfStorage = {
                        pdfSaved: false,
                        pdfFilename: null,
                        pdfS3Key: null,
                        pdfS3Url: null,
                        pdfRelativePath: null,
                        pdfSizeBytes: 0,
                        pdfContentType: null,
                        pdfSaveError:
                            restResult?.submittedPdf?.error ||
                            `Το ΕΡΓΑΝΗ δεν επέστρεψε έγκυρο PDF. Content-Type: ${
                                restResult?.submittedPdf?.rawContentType ||
                                restResult?.submittedPdf?.contentType ||
                                'unknown'
                            }`
                    };
                }
            }

            const effectiveSubmitDate = parseErganiSubmitDate(restResult?.submitDate) || new Date();
            const submissionYear = effectiveSubmitDate.getFullYear();
            const submissionMonth = effectiveSubmitDate.getMonth() + 1;
            const submissionDay = effectiveSubmitDate.getDate();

            const erganhLog = await ErgazomenoiErganhModel.create({
                team: sessionTeam,
                companykod_object: companyData?._id || companyId,
                companykod: companyData?.kod || companyData?.kodikos || '',

                ergazomenos_object: ergazomenos?._id,
                ergazomenos_kodikos: ergazomenos?.kodikos || '',
                ergazomenos_afm: ergazomenos?.afm || '',
                ergazomenos_eponymo: ergazomenos?.eponymo || '',
                ergazomenos_onoma: ergazomenos?.onoma || '',

                ypokatasthma_object: ypokatasthmataData?._id || null,
                ypokatasthma_kodikos:
                    ypokatasthmataData?.kodikos || ypokatasthmataData?.kod || selectedYpokatasthma,

                submission_code: config.submissionCode,
                submission_id: restResult?.submission?.id || null,
                submission_description: restResult?.submission?.description || config.label,
                process_code: config.xmlType,
                process_description: config.label,

                upload_method: 'REST',
                submission_status: restResult?.success ? 'SUCCESS' : 'FAILED',
                is_temporary: false,
                is_final: restResult?.success === true,
                environment: process.env.ERGANI_ENV || 'trial',

                protocol: restResult?.protocol || null,
                submit_date_text: restResult?.submitDate || null,
                submit_date: effectiveSubmitDate,
                erganh_submission_id: restResult?.id || null,

                submission_year: submissionYear,
                submission_month: submissionMonth,
                submission_day: submissionDay,

                pdf_s3_key: pdfStorage.pdfS3Key,
                pdf_s3_url: pdfStorage.pdfS3Url,
                pdf_relative_path: pdfStorage.pdfRelativePath,
                pdf_filename: pdfStorage.pdfFilename,
                pdf_content_type: pdfStorage.pdfContentType,
                pdf_size_bytes: pdfStorage.pdfSizeBytes,

                request_payload: payload,
                erganh_raw_response: restResult?.raw || null,
                error_message: restResult?.success ? pdfStorage.pdfSaveError : restResult?.error,

                created_by_user: userId,
                created_by_username: req.session?.userName || req.session?.username || ''
            });

            const sanitizedErgani = sanitizeErganiResultForResponse(restResult);
            const pdfDeferred = restResult?.submittedPdf?.pdfDeferred === true;

            return res.status(restResult?.success ? 200 : 400).json({
                success: !!restResult?.success,
                uploadMethod: 'rest',
                temporary: false,
                finalSubmission: true,
                submissionCode: config.submissionCode,
                processCode: config.xmlType,
                message: restResult?.success
                    ? `Το ${config.submissionCode} υποβλήθηκε οριστικά μέσω REST API.`
                    : restResult?.error ||
                      `Η οριστική υποβολή ${config.submissionCode} μέσω REST API απέτυχε.`,
                protocol: restResult?.protocol || null,
                submitDate: restResult?.submitDate || null,
                erganhSubmissionId: restResult?.id || null,
                erganhLogId: erganhLog?._id || null,
                pdfSaved: pdfStorage.pdfSaved,
                pdfUrl:
                    pdfStorage.pdfS3Key && erganhLog?._id
                        ? getErganiPdfRoute(erganhLog._id)
                        : pdfStorage.pdfRelativePath
                          ? `/uploads/s3-mock/${pdfStorage.pdfRelativePath}`
                          : pdfStorage.pdfS3Url || '',
                pdfS3Key: pdfStorage.pdfS3Key,
                pdfFilename: pdfStorage.pdfFilename,
                pdfSizeBytes: pdfStorage.pdfSizeBytes,
                pdfSaveError: pdfStorage.pdfSaveError,
                pdfDeferred,
                pdfWarning: getErganiPdfDeferredWarning(pdfDeferred),
                submission: restResult?.submission || null,
                erganh: sanitizedErgani
            });
        } catch (error) {
            console.error('[submitE6NToErganh] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την αποστολή E6N στο ΕΡΓΑΝΗ.',
                error: error.message || String(error)
            });
        }
    };

    // ============================================================================
    // ✅ E5N REST JSON UPLOAD - WebE5N
    //    Trial Submission id: 101 / Production Submission id: 217
    // ============================================================================
    static submitE5NToErganh = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const userId = req.session?.userId || req.session?.user?._id || null;

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            const body = req.body || {};
            const ergazomenosId =
                body.ergazomenosId || body.employeeId || body.id || body.kodikos || '';

            if (!ergazomenosId) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ο εργαζόμενος για την υποβολή E5N.'
                });
            }

            const rawUploadMethod =
                body.erganiUploadMethod ||
                body.submissionMethod ||
                body.uploadMethod ||
                body.method ||
                'rest';

            const uploadMethod = String(rawUploadMethod).trim().toLowerCase();

            if (!['rest', 'json', 'json_rest'].includes(uploadMethod)) {
                return res.status(400).json({
                    success: false,
                    message: 'Η οριστική υποβολή WebE5N υποστηρίζεται μόνο μέσω REST API.'
                });
            }

            // --------------------------------------------------------------------
            // 1) Φόρτωση εργαζομένου
            // --------------------------------------------------------------------
            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                employeeQuery._id = ergazomenosId;
            } else {
                employeeQuery.kodikos = String(ergazomenosId).trim();
            }

            const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε ο εργαζόμενος για την υποβολή E5N.'
                });
            }

            // --------------------------------------------------------------------
            // 2) Φόρτωση εταιρείας
            // --------------------------------------------------------------------
            let companyData = null;

            if (mongoose.Types.ObjectId.isValid(String(companyId))) {
                companyData = await CompaniesModel.findById(companyId).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kod: companyId }).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kodikos: companyId }).lean();
            }

            if (!companyData) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν τα στοιχεία της εταιρείας.'
                });
            }

            // --------------------------------------------------------------------
            // 3) Φόρτωση υποκαταστήματος
            // --------------------------------------------------------------------
            const selectedYpokatasthma =
                body.ypokatasthma ||
                body.ypokatasthmata ||
                body.ypokatasthmata_stathera ||
                ergazomenos.ypokatasthma ||
                ergazomenos.ypokatasthma_kodikos ||
                '0';

            let ypokatasthmataData = await YpokatasthmataModel.findOne({
                companykod_object: companyId,
                kodikos: String(selectedYpokatasthma)
            }).lean();

            if (!ypokatasthmataData) {
                ypokatasthmataData = await YpokatasthmataModel.findOne({
                    company: companyData.kod || companyData.kodikos || companyId,
                    kodikos: String(selectedYpokatasthma)
                }).lean();
            }

            if (!ypokatasthmataData) {
                return res.status(404).json({
                    success: false,
                    message: `Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`
                });
            }

            // --------------------------------------------------------------------
            // 4) Credentials ΕΡΓΑΝΗ από PasswordsModel
            // --------------------------------------------------------------------
            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            };

            // --------------------------------------------------------------------
            // 5) PDF Ε5Ν + JSON + REST API -> Οριστική υποβολή WebE5N
            // --------------------------------------------------------------------
            const apoxorhshDateForE5N =
                body.hmeromhnia_apoxorhshs ||
                body.hmeromhnia_apoxwrhshs ||
                body.apoxwrisi_date ||
                ergazomenos.hmeromhnia_apoxorhshs ||
                ergazomenos.hmeromhnia_apoxwrhshs;

            const e5PdfResult = await tryGenerateE5NPdfForRest(
                ergazomenos,
                companyData,
                ypokatasthmataData,
                {
                    hmeromhnia_apoxorhshs: apoxorhshDateForE5N,
                    hmeromhnia_apoxwrhshs: apoxorhshDateForE5N,
                    apoxwrisi_date: apoxorhshDateForE5N,
                    userId,
                    requestBody: body
                }
            );

            const jsonResult = await generateE5NJSON(ergazomenos, companyData, ypokatasthmataData, {
                hmeromhnia_apoxorhshs: apoxorhshDateForE5N,
                hmeromhnia_apoxwrhshs: apoxorhshDateForE5N,
                apoxwrisi_date: apoxorhshDateForE5N,
                e5_pdf_path: e5PdfResult.pdfPath,
                e5_pdf_base64: e5PdfResult.pdfBase64
            });

            const payload = jsonResult.payload || jsonResult.json;

            const restResult = await uploadJsonDocumentToErgani({
                submissionCode: 'WebE5N',
                payload,
                creds,
                fetchSubmittedPdf: true
            });

            const submittedPdfBuffer = restResult?.submittedPdf?.buffer || null;
            const submittedPdfContentType =
                restResult?.submittedPdf?.contentType || 'application/pdf';

            let pdfStorage = {
                pdfSaved: false,
                pdfFilename: null,
                pdfS3Key: null,
                pdfS3Url: null,
                pdfRelativePath: null,
                pdfSizeBytes: 0,
                pdfContentType: submittedPdfContentType,
                pdfSaveError: restResult?.submittedPdf?.error || null
            };

            if (restResult?.success) {
                const isValidPdfBuffer =
                    Buffer.isBuffer(submittedPdfBuffer) &&
                    submittedPdfBuffer.length > 5 &&
                    submittedPdfBuffer.subarray(0, 5).toString() === '%PDF-';

                if (isValidPdfBuffer) {
                    pdfStorage = await saveSubmittedErganiPdfToS3({
                        pdfBuffer: submittedPdfBuffer,
                        contentType: 'application/pdf',
                        ergazomenos,
                        companyData,
                        restResult
                    });
                } else {
                    pdfStorage = {
                        pdfSaved: false,
                        pdfFilename: null,
                        pdfS3Key: null,
                        pdfS3Url: null,
                        pdfRelativePath: null,
                        pdfSizeBytes: 0,
                        pdfContentType: null,
                        pdfSaveError:
                            restResult?.submittedPdf?.error ||
                            `Το ΕΡΓΑΝΗ δεν επέστρεψε έγκυρο PDF. Content-Type: ${
                                restResult?.submittedPdf?.rawContentType ||
                                restResult?.submittedPdf?.contentType ||
                                'unknown'
                            }`
                    };
                }
            }

            const effectiveSubmitDate = parseErganiSubmitDate(restResult?.submitDate) || new Date();
            const submissionYear = effectiveSubmitDate.getFullYear();
            const submissionMonth = effectiveSubmitDate.getMonth() + 1;
            const submissionDay = effectiveSubmitDate.getDate();

            const erganhLog = await ErgazomenoiErganhModel.create({
                team: sessionTeam,
                companykod_object: companyData?._id || companyId,
                companykod: companyData?.kod || companyData?.kodikos || '',

                ergazomenos_object: ergazomenos?._id,
                ergazomenos_kodikos: ergazomenos?.kodikos || '',
                ergazomenos_afm: ergazomenos?.afm || '',
                ergazomenos_eponymo: ergazomenos?.eponymo || '',
                ergazomenos_onoma: ergazomenos?.onoma || '',

                ypokatasthma_object: ypokatasthmataData?._id || null,
                ypokatasthma_kodikos:
                    ypokatasthmataData?.kodikos || ypokatasthmataData?.kod || selectedYpokatasthma,

                submission_code: 'WebE5N',
                submission_id: restResult?.submission?.id || null,
                submission_description: restResult?.submission?.description || '',
                process_code: process.env.ERGANI_ENV === 'production' ? 'ma_217' : 'ma_101',
                process_description: 'Οικειοθελής Αποχώρηση (E5N)',

                upload_method: 'REST',
                submission_status: restResult?.success ? 'SUCCESS' : 'FAILED',
                is_temporary: false,
                is_final: restResult?.success === true,
                environment: process.env.ERGANI_ENV || 'trial',

                protocol: restResult?.protocol || null,
                submit_date_text: restResult?.submitDate || null,
                submit_date: effectiveSubmitDate,
                erganh_submission_id: restResult?.id || null,

                submission_year: submissionYear,
                submission_month: submissionMonth,
                submission_day: submissionDay,

                pdf_s3_key: pdfStorage.pdfS3Key,
                pdf_s3_url: pdfStorage.pdfS3Url,
                pdf_relative_path: pdfStorage.pdfRelativePath,
                pdf_filename: pdfStorage.pdfFilename,
                pdf_content_type: pdfStorage.pdfContentType,
                pdf_size_bytes: pdfStorage.pdfSizeBytes,

                request_payload: payload,
                erganh_raw_response: restResult?.raw || null,
                error_message: restResult?.success ? pdfStorage.pdfSaveError : restResult?.error,

                created_by_user: userId,
                created_by_username: req.session?.userName || req.session?.username || ''
            });

            const sanitizedErgani = sanitizeErganiResultForResponse(restResult);
            const pdfDeferred = restResult?.submittedPdf?.pdfDeferred === true;

            return res.status(restResult?.success ? 200 : 400).json({
                success: !!restResult?.success,
                uploadMethod: 'rest',
                temporary: false,
                finalSubmission: true,
                message: restResult?.success
                    ? 'Το E5N υποβλήθηκε οριστικά μέσω REST API.'
                    : restResult?.error || 'Η οριστική υποβολή E5N μέσω REST API απέτυχε.',
                protocol: restResult?.protocol || null,
                submitDate: restResult?.submitDate || null,
                erganhSubmissionId: restResult?.id || null,
                erganhLogId: erganhLog?._id || null,
                pdfSaved: pdfStorage.pdfSaved,
                pdfUrl:
                    pdfStorage.pdfS3Key && erganhLog?._id
                        ? getErganiPdfRoute(erganhLog._id)
                        : pdfStorage.pdfRelativePath
                          ? `/uploads/s3-mock/${pdfStorage.pdfRelativePath}`
                          : pdfStorage.pdfS3Url || '',
                pdfS3Key: pdfStorage.pdfS3Key,
                pdfFilename: pdfStorage.pdfFilename,
                pdfSizeBytes: pdfStorage.pdfSizeBytes,
                pdfSaveError: pdfStorage.pdfSaveError,
                pdfDeferred,
                pdfWarning: getErganiPdfDeferredWarning(pdfDeferred),
                submission: restResult?.submission || null,
                erganh: sanitizedErgani
            });
        } catch (error) {
            console.error('[submitE5NToErganh] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την αποστολή E5N στο ΕΡΓΑΝΗ.',
                error: error.message || String(error)
            });
        }
    };

    // ============================================================================
    // ✅ MA REST JSON UPLOAD - WebMA
    //    Trial Submission id: 127 / Production Submission id: 230
    // ============================================================================
    static submitMAToErganh = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const userId = req.session?.userId || req.session?.user?._id || null;

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            const body = req.body || {};
            const ergazomenosId =
                body.ergazomenosId || body.employeeId || body.id || body.kodikos || '';

            if (!ergazomenosId) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ο εργαζόμενος για την υποβολή ΜΑ.'
                });
            }

            const rawUploadMethod =
                body.erganiUploadMethod ||
                body.submissionMethod ||
                body.uploadMethod ||
                body.method ||
                'rest';

            const uploadMethod = String(rawUploadMethod).trim().toLowerCase();

            if (!['rest', 'json', 'json_rest'].includes(uploadMethod)) {
                return res.status(400).json({
                    success: false,
                    message: 'Η οριστική υποβολή WebMA υποστηρίζεται μόνο μέσω REST API.'
                });
            }

            // --------------------------------------------------------------------
            // 1) Φόρτωση εργαζομένου
            // --------------------------------------------------------------------
            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                employeeQuery._id = ergazomenosId;
            } else {
                employeeQuery.kodikos = String(ergazomenosId).trim();
            }

            const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε ο εργαζόμενος για την υποβολή ΜΑ.'
                });
            }

            // --------------------------------------------------------------------
            // 2) Φόρτωση εταιρείας
            // --------------------------------------------------------------------
            let companyData = null;

            if (mongoose.Types.ObjectId.isValid(String(companyId))) {
                companyData = await CompaniesModel.findById(companyId).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kod: companyId }).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kodikos: companyId }).lean();
            }

            if (!companyData) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν τα στοιχεία της εταιρείας.'
                });
            }

            // --------------------------------------------------------------------
            // 3) Φόρτωση υποκαταστήματος
            // --------------------------------------------------------------------
            const selectedYpokatasthma =
                body.ypokatasthma ||
                body.ypokatasthmata ||
                body.ypokatasthmata_stathera ||
                ergazomenos.ypokatasthma ||
                ergazomenos.ypokatasthma_kodikos ||
                '0';

            let ypokatasthmataData = await YpokatasthmataModel.findOne({
                companykod_object: companyId,
                kodikos: String(selectedYpokatasthma)
            }).lean();

            if (!ypokatasthmataData) {
                ypokatasthmataData = await YpokatasthmataModel.findOne({
                    company: companyData.kod || companyData.kodikos || companyId,
                    kodikos: String(selectedYpokatasthma)
                }).lean();
            }

            if (!ypokatasthmataData) {
                return res.status(404).json({
                    success: false,
                    message: `Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`
                });
            }

            // --------------------------------------------------------------------
            // 4) Credentials ΕΡΓΑΝΗ από PasswordsModel
            // --------------------------------------------------------------------
            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            };

            // --------------------------------------------------------------------
            // 5) JSON + REST API -> Οριστική υποβολή WebMA
            // --------------------------------------------------------------------
            const jsonResult = await generateMAJSON(ergazomenos, companyData, ypokatasthmataData, {
                hmeromhnia_metabolhs:
                    body.hmeromhnia_metabolhs ||
                    body.hmeromhniaMetabolhs ||
                    ergazomenos.hmeromhnia_metabolhs ||
                    ergazomenos.hmeromhnia_allaghs_orarioy_apo ||
                    ergazomenos.hmeromhnia_proslhpshs
            });

            const payload = jsonResult.payload || jsonResult.json;

            const restResult = await uploadJsonDocumentToErgani({
                submissionCode: 'WebMA',
                payload,
                creds,
                fetchSubmittedPdf: true
            });

            const submittedPdfBuffer = restResult?.submittedPdf?.buffer || null;
            const submittedPdfContentType =
                restResult?.submittedPdf?.contentType || 'application/pdf';

            let pdfStorage = {
                pdfSaved: false,
                pdfFilename: null,
                pdfS3Key: null,
                pdfS3Url: null,
                pdfRelativePath: null,
                pdfSizeBytes: 0,
                pdfContentType: submittedPdfContentType,
                pdfSaveError: restResult?.submittedPdf?.error || null
            };

            if (restResult?.success) {
                const isValidPdfBuffer =
                    Buffer.isBuffer(submittedPdfBuffer) &&
                    submittedPdfBuffer.length > 5 &&
                    submittedPdfBuffer.subarray(0, 5).toString() === '%PDF-';

                if (isValidPdfBuffer) {
                    pdfStorage = await saveSubmittedErganiPdfToS3({
                        pdfBuffer: submittedPdfBuffer,
                        contentType: 'application/pdf',
                        ergazomenos,
                        companyData,
                        restResult
                    });
                } else {
                    pdfStorage = {
                        pdfSaved: false,
                        pdfFilename: null,
                        pdfS3Key: null,
                        pdfS3Url: null,
                        pdfRelativePath: null,
                        pdfSizeBytes: 0,
                        pdfContentType: null,
                        pdfSaveError:
                            restResult?.submittedPdf?.error ||
                            `Το ΕΡΓΑΝΗ δεν επέστρεψε έγκυρο PDF. Content-Type: ${
                                restResult?.submittedPdf?.rawContentType ||
                                restResult?.submittedPdf?.contentType ||
                                'unknown'
                            }`
                    };
                }
            }

            const effectiveSubmitDate = parseErganiSubmitDate(restResult?.submitDate) || new Date();
            const submissionYear = effectiveSubmitDate.getFullYear();
            const submissionMonth = effectiveSubmitDate.getMonth() + 1;
            const submissionDay = effectiveSubmitDate.getDate();

            const erganhLog = await ErgazomenoiErganhModel.create({
                team: sessionTeam,
                companykod_object: companyData?._id || companyId,
                companykod: companyData?.kod || companyData?.kodikos || '',

                ergazomenos_object: ergazomenos?._id,
                ergazomenos_kodikos: ergazomenos?.kodikos || '',
                ergazomenos_afm: ergazomenos?.afm || '',
                ergazomenos_eponymo: ergazomenos?.eponymo || '',
                ergazomenos_onoma: ergazomenos?.onoma || '',

                ypokatasthma_object: ypokatasthmataData?._id || null,
                ypokatasthma_kodikos:
                    ypokatasthmataData?.kodikos || ypokatasthmataData?.kod || selectedYpokatasthma,

                submission_code: 'WebMA',
                submission_id: restResult?.submission?.id || null,
                submission_description: restResult?.submission?.description || '',
                process_code: process.env.ERGANI_ENV === 'production' ? 'ma_230' : 'ma_127',
                process_description: 'Μεταβολή Στοιχείων Εργασιακής Σχέσης (MA)',

                upload_method: 'REST',
                submission_status: restResult?.success ? 'SUCCESS' : 'FAILED',
                is_temporary: false,
                is_final: restResult?.success === true,
                environment: process.env.ERGANI_ENV || 'trial',

                protocol: restResult?.protocol || null,
                submit_date_text: restResult?.submitDate || null,
                submit_date: effectiveSubmitDate,
                erganh_submission_id: restResult?.id || null,

                submission_year: submissionYear,
                submission_month: submissionMonth,
                submission_day: submissionDay,

                pdf_s3_key: pdfStorage.pdfS3Key,
                pdf_s3_url: pdfStorage.pdfS3Url,
                pdf_relative_path: pdfStorage.pdfRelativePath,
                pdf_filename: pdfStorage.pdfFilename,
                pdf_content_type: pdfStorage.pdfContentType,
                pdf_size_bytes: pdfStorage.pdfSizeBytes,

                request_payload: payload,
                erganh_raw_response: restResult?.raw || null,
                error_message: restResult?.success ? pdfStorage.pdfSaveError : restResult?.error,

                created_by_user: userId,
                created_by_username: req.session?.userName || req.session?.username || ''
            });

            const sanitizedErgani = sanitizeErganiResultForResponse(restResult);
            const pdfDeferred = restResult?.submittedPdf?.pdfDeferred === true;

            return res.status(restResult?.success ? 200 : 400).json({
                success: !!restResult?.success,
                uploadMethod: 'rest',
                temporary: false,
                finalSubmission: true,
                message: restResult?.success
                    ? 'Το MA υποβλήθηκε οριστικά μέσω REST API.'
                    : restResult?.error || 'Η οριστική υποβολή MA μέσω REST API απέτυχε.',
                protocol: restResult?.protocol || null,
                submitDate: restResult?.submitDate || null,
                erganhSubmissionId: restResult?.id || null,
                erganhLogId: erganhLog?._id || null,
                pdfSaved: pdfStorage.pdfSaved,
                pdfUrl:
                    pdfStorage.pdfS3Key && erganhLog?._id
                        ? getErganiPdfRoute(erganhLog._id)
                        : pdfStorage.pdfRelativePath
                          ? `/uploads/s3-mock/${pdfStorage.pdfRelativePath}`
                          : pdfStorage.pdfS3Url || '',
                pdfS3Key: pdfStorage.pdfS3Key,
                pdfFilename: pdfStorage.pdfFilename,
                pdfSizeBytes: pdfStorage.pdfSizeBytes,
                pdfSaveError: pdfStorage.pdfSaveError,
                pdfDeferred,
                pdfWarning: getErganiPdfDeferredWarning(pdfDeferred),
                submission: restResult?.submission || null,
                erganh: sanitizedErgani
            });
        } catch (error) {
            console.error('[submitMAToErganh] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την αποστολή MA στο ΕΡΓΑΝΗ.',
                error: error.message || String(error)
            });
        }
    };

    static cancelE7NSubmission = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const userId = req.session?.userId || req.session?.user?._id || null;
            const username = req.session?.userName || req.session?.username || '';

            const { erganhLogId, cancelReason } = req.body || {};

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            if (!erganhLogId || !mongoose.Types.ObjectId.isValid(String(erganhLogId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ή δεν είναι έγκυρο το ID της υποβολής ΕΡΓΑΝΗ.'
                });
            }

            const erganhLog = await ErgazomenoiErganhModel.findOne({
                _id: erganhLogId,
                team: sessionTeam,
                companykod_object: companyId
            });

            if (!erganhLog) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε η υποβολή ΕΡΓΑΝΗ.'
                });
            }

            if (erganhLog.document_status === 'CANCELLED' || erganhLog.is_cancelled === true) {
                return res.status(400).json({
                    success: false,
                    message: 'Η υποβολή είναι ήδη ακυρωμένη.'
                });
            }

            if (!erganhLog.protocol || !erganhLog.submit_date_text || !erganhLog.submission_code) {
                return res.status(400).json({
                    success: false,
                    message: 'Η υποβολή δεν έχει πλήρη στοιχεία πρωτοκόλλου για ακύρωση.'
                });
            }

            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            };

            const auth = await authenticateErgani(creds);
            const accessToken =
                auth?.accessToken || auth?.AccessToken || auth?.token || auth?.Token;
            const refreshToken = auth?.refreshToken || auth?.RefreshToken || null;

            if (!accessToken) {
                return res.status(500).json({
                    success: false,
                    message: 'Το ΕΡΓΑΝΗ δεν επέστρεψε accessToken.'
                });
            }

            let cancelResult;

            try {
                cancelResult = await cancelSubmittedDocument(accessToken, {
                    submissionCode: erganhLog.submission_code,
                    protocol: erganhLog.protocol,
                    submittedDate: erganhLog.submit_date_text
                });
            } finally {
                if (refreshToken) {
                    await logoutErgani(accessToken, refreshToken).catch(() => {});
                }
            }

            const cancelMessage = String(cancelResult?.message || '').trim();

            const cancelAccepted =
                cancelResult?.success === true ||
                cancelMessage.includes('επιτυχ') ||
                cancelMessage.includes('ολοκληρώθηκε') ||
                cancelMessage.includes('ακυρώθηκε') ||
                cancelMessage.includes('ανακλήθηκε');

            if (!cancelAccepted) {
                erganhLog.cancel_reason = cancelReason || '';
                erganhLog.cancel_raw_response = cancelResult;
                erganhLog.error_message =
                    cancelMessage || 'Το ΕΡΓΑΝΗ δεν επιβεβαίωσε την ακύρωση της υποβολής.';

                await erganhLog.save();

                return res.status(400).json({
                    success: false,
                    message: cancelMessage || 'Το ΕΡΓΑΝΗ απέρριψε την ακύρωση της υποβολής.',
                    cancelResult
                });
            }

            erganhLog.document_status = 'CANCELLED';
            erganhLog.submission_status = 'CANCELLED';
            erganhLog.is_cancelled = true;
            erganhLog.cancelled_at = new Date();
            erganhLog.cancel_reason = cancelReason || '';
            erganhLog.cancelled_by_user = userId;
            erganhLog.cancelled_by_username = username;
            erganhLog.cancel_raw_response = cancelResult;
            erganhLog.error_message = null;

            await erganhLog.save();

            return res.json({
                success: true,
                message: cancelResult?.message || 'Η υποβολή ακυρώθηκε επιτυχώς.',
                erganhLogId: erganhLog._id,
                protocol: erganhLog.protocol,
                documentStatus: erganhLog.document_status,
                cancelResult
            });
        } catch (error) {
            console.error('[cancelE7NSubmission] ❌', error);

            return res.status(400).json({
                success: false,
                message: error?.message || 'Σφάλμα κατά την ακύρωση της υποβολής ΕΡΓΑΝΗ.',
                error: error?.message || String(error)
            });
        }
    };

    // ============================================================================
    // ✅ GET: Ιστορικό υποβολών ΕΡΓΑΝΗ εργαζόμενου
    // ============================================================================
    static getErgazomenosErganhHistory = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const { ergazomenosId } = req.params || {};

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            if (!ergazomenosId || !mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ή δεν είναι έγκυρο το ID εργαζόμενου.'
                });
            }

            const rows = await ErgazomenoiErganhModel.find({
                team: sessionTeam,
                companykod_object: companyId,
                ergazomenos_object: ergazomenosId
            })
                .sort({ createdAt: -1 })
                .lean();

            return res.json({
                success: true,
                data: rows.map((row) => ({
                    _id: row._id,
                    createdAt: row.createdAt,
                    protocol: row.protocol || '',
                    submitDate: row.submit_date_text || '',
                    processCode: row.process_code || '',
                    processDescription: row.process_description || '',
                    uploadMethod: row.upload_method || '',
                    submissionStatus: row.submission_status || '',
                    documentStatus: row.document_status || 'ACTIVE',
                    environment: row.environment || '',
                    pdfUrl: row.pdf_s3_key
                        ? `/ergazomenoi/ergazomenoi/ergani/pdf/${row._id}`
                        : row.pdf_relative_path
                          ? `/uploads/s3-mock/${row.pdf_relative_path}`
                          : '',
                    pdfFilename: row.pdf_filename || '',
                    pdfSaved: !!row.pdf_s3_url,
                    isCancelled: row.is_cancelled === true,
                    cancelledAt: row.cancelled_at || null,
                    cancelledProtocol: row.cancelled_protocol || '',
                    cancelReason: row.cancel_reason || '',
                    errorMessage: row.error_message || ''
                }))
            });
        } catch (error) {
            console.error('[getErgazomenosErganhHistory] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την ανάκτηση ιστορικού ΕΡΓΑΝΗ.'
            });
        }
    };

    static openErganiPdf = async (req, res) => {
        try {
            const rec = await ErgazomenoiErganhModel.findById(req.params.id).lean();

            if (!rec) {
                return res.status(404).send('PDF not found');
            }

            const localMockUrl = rec.pdf_relative_path
                ? `/uploads/s3-mock/${rec.pdf_relative_path}`
                : '';

            if (rec.pdf_s3_url?.startsWith('file://')) {
                if (localMockUrl) return res.redirect(localMockUrl);
                return res.status(404).send('PDF local path not found');
            }

            if (!rec.pdf_s3_key) {
                if (localMockUrl) return res.redirect(localMockUrl);
                return res.status(404).send('PDF S3 key not found');
            }

            const bucket = getErganiS3Bucket(rec);

            if (!bucket) {
                if (localMockUrl) return res.redirect(localMockUrl);
                return res.status(500).send('PDF bucket not configured');
            }

            const s3Response = await s3Client.send(
                new GetObjectCommand({
                    Bucket: bucket,
                    Key: rec.pdf_s3_key
                })
            );

            res.removeHeader('X-Frame-Options');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
            res.setHeader('Content-Type', s3Response.ContentType || 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="ergani.pdf"');
            res.setHeader('Cache-Control', 'private, max-age=300');

            if (s3Response.ContentLength) {
                res.setHeader('Content-Length', String(s3Response.ContentLength));
            }

            return s3Response.Body.pipe(res);
        } catch (err) {
            console.error('openErganiPdf error:', err);
            return res.status(500).send('PDF open error');
        }
    };

    static retrySubmittedErganiPdf = async (req, res) => {
        let accessToken = null;
        let refreshToken = null;
        let retryContext = {
            logId: req.params?.id || null,
            submissionCode: '',
            protocol: '',
            submitDate: '',
            env: process.env.ERGANI_ENV || 'trial'
        };

        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const { id } = req.params || {};

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ή δεν είναι έγκυρο το ID υποβολής ΕΡΓΑΝΗ.'
                });
            }

            const erganhLog = await ErgazomenoiErganhModel.findOne({
                _id: id,
                team: sessionTeam,
                $or: [{ companykod_object: companyId }, { companykod: String(companyId) }]
            });

            if (!erganhLog) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε η υποβολή ΕΡΓΑΝΗ για την επιλεγμένη εταιρεία.'
                });
            }

            retryContext = {
                ...retryContext,
                logId: String(erganhLog._id),
                submissionCode: erganhLog.submission_code || '',
                protocol: erganhLog.protocol || '',
                submitDate:
                    erganhLog.submit_date_text ||
                    (erganhLog.submit_date ? formatDateDdMmYyyy(erganhLog.submit_date) : '')
            };

            const existingPdfUrl = erganhLog.pdf_s3_key
                ? getErganiPdfRoute(erganhLog._id)
                : erganhLog.pdf_relative_path
                  ? `/uploads/s3-mock/${erganhLog.pdf_relative_path}`
                  : erganhLog.pdf_s3_url || '';

            console.log('[ERGANI PDF RETRY] start', retryContext);
            console.log('[ERGANI PDF RETRY] existing-pdf', {
                hasKey: !!erganhLog.pdf_s3_key,
                hasRelativePath: !!erganhLog.pdf_relative_path,
                hasS3Url: !!erganhLog.pdf_s3_url
            });

            if (existingPdfUrl) {
                return res.json({
                    success: true,
                    pdfSaved: true,
                    pdfUrl: existingPdfUrl,
                    protocol: erganhLog.protocol || null,
                    submitDate: erganhLog.submit_date_text || erganhLog.submit_date || null
                });
            }

            const submissionCode = erganhLog.submission_code || '';
            const protocol = erganhLog.protocol || '';
            const submitDate =
                erganhLog.submit_date_text ||
                (erganhLog.submit_date ? formatDateDdMmYyyy(erganhLog.submit_date) : '');

            if (!submissionCode || !protocol || !submitDate) {
                console.warn('[ERGANI PDF RETRY] unavailable', {
                    ...retryContext,
                    reason: 'missing-submissionCode-protocol-submitDate'
                });
                return res.json({
                    success: false,
                    pdfDeferred: true,
                    message:
                        'Η υποβολή έχει ολοκληρωθεί, αλλά δεν υπάρχουν πλήρη στοιχεία για ανάκτηση PDF.'
                });
            }

            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const auth = await authenticateErgani({
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            });

            accessToken = auth?.accessToken || auth?.AccessToken || auth?.token || auth?.Token;
            refreshToken = auth?.refreshToken || auth?.RefreshToken || null;

            if (!accessToken) {
                throw new Error('Το ΕΡΓΑΝΗ δεν επέστρεψε accessToken για ανάκτηση PDF.');
            }

            const timeoutMs = Number(process.env.ERGANI_REST_PDF_RETRY_TIMEOUT_MS || 15000);
            const retryTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000;

            let documentResult = null;

            console.log('[ERGANI PDF RETRY] direct-fetch start', retryContext);

            try {
                documentResult = await getSubmissionDocument(accessToken, {
                    submissionCode,
                    protocol,
                    issuedDate: submitDate,
                    timeoutMs: retryTimeoutMs
                });
            } catch (err) {
                documentResult = {
                    success: false,
                    buffer: null,
                    contentType: null,
                    sizeBytes: 0,
                    error: err.message || String(err),
                    source: 'direct-exception'
                };
            }

            console.log('[ERGANI PDF RETRY] direct-fetch result', {
                success: documentResult?.success === true,
                contentType: documentResult?.contentType || documentResult?.rawContentType || null,
                sizeBytes: documentResult?.sizeBytes || documentResult?.buffer?.length || 0,
                source:
                    documentResult?.source?.mode ||
                    documentResult?.source ||
                    documentResult?.source?.path ||
                    null,
                error: documentResult?.error || null
            });

            if (!documentResult?.success || !Buffer.isBuffer(documentResult.buffer)) {
                console.log('[ERGANI PDF RETRY] playwright-fetch start', retryContext);

                try {
                    documentResult = await downloadSubmittedErganiPdfWithPlaywright({
                        creds: {
                            username: erganhPasswordDoc.username,
                            password: erganhPasswordDoc.password,
                            userType: process.env.ERGANI_USERTYPE || '01'
                        },
                        submissionCode,
                        protocol,
                        submittedDate: submitDate,
                        headless: process.env.ERGANI_PDF_HEADLESS !== 'false',
                        timeoutMs: retryTimeoutMs
                    });
                } catch (err) {
                    documentResult = {
                        success: false,
                        buffer: null,
                        contentType: null,
                        sizeBytes: 0,
                        error: err.message || String(err),
                        source: 'playwright-exception',
                        debugHtmlPath: err.debugHtmlPath || null,
                        debugScreenshotPath: err.debugScreenshotPath || null
                    };
                }

                console.log('[ERGANI PDF RETRY] playwright-fetch result', {
                    success: documentResult?.success === true,
                    contentType: documentResult?.contentType || documentResult?.rawContentType || null,
                    sizeBytes: documentResult?.sizeBytes || documentResult?.buffer?.length || 0,
                    source: documentResult?.source || null,
                    error: documentResult?.error || null,
                    debugHtmlPath: documentResult?.debugHtmlPath || null,
                    debugScreenshotPath: documentResult?.debugScreenshotPath || null
                });
            }

            if (!documentResult?.success || !Buffer.isBuffer(documentResult.buffer)) {
                console.warn('[ERGANI PDF RETRY] unavailable', {
                    ...retryContext,
                    reason: documentResult?.error || 'no-pdf-buffer'
                });
                return res.json({
                    success: false,
                    pdfDeferred: true,
                    message:
                        'Το PDF υπάρχει στο ΕΡΓΑΝΗ, αλλά δεν ανακτήθηκε από την εφαρμογή. Ελέγξτε τα logs [ERGANI PDF RETRY].',
                    error: documentResult?.error || null
                });
            }

            const companyById = mongoose.Types.ObjectId.isValid(String(companyId))
                ? await CompaniesModel.findById(companyId).lean()
                : null;
            const companyData =
                companyById ||
                (await CompaniesModel.findOne({
                    team: sessionTeam,
                    $or: [
                        { kod: erganhLog.companykod || String(companyId) },
                        { kodikos: erganhLog.companykod || String(companyId) }
                    ]
                }).lean()) ||
                {};

            const pdfStorage = await saveSubmittedErganiPdfToS3({
                pdfBuffer: documentResult.buffer,
                contentType: documentResult.contentType || 'application/pdf',
                ergazomenos: {
                    _id: erganhLog.ergazomenos_object || erganhLog.ergazomenos_kodikos || erganhLog._id,
                    kodikos: erganhLog.ergazomenos_kodikos || '',
                    eponymo: erganhLog.ergazomenos_eponymo || '',
                    onoma: erganhLog.ergazomenos_onoma || '',
                    team: erganhLog.team || sessionTeam
                },
                companyData,
                restResult: {
                    protocol,
                    submitDate
                },
                submissionFolder: submissionCode
            });

            if (!pdfStorage.pdfSaved) {
                console.warn('[ERGANI PDF RETRY] unavailable', {
                    ...retryContext,
                    reason: pdfStorage.pdfSaveError || 'pdf-save-failed'
                });
                return res.json({
                    success: false,
                    pdfDeferred: true,
                    message: 'Το PDF ανακτήθηκε, αλλά δεν αποθηκεύτηκε.',
                    error: pdfStorage.pdfSaveError || null
                });
            }

            console.log('[ERGANI PDF RETRY] saved', {
                pdfSaved: pdfStorage.pdfSaved,
                pdfS3Key: pdfStorage.pdfS3Key || null,
                pdfRelativePath: pdfStorage.pdfRelativePath || null,
                pdfSizeBytes: pdfStorage.pdfSizeBytes || 0
            });

            erganhLog.pdf_s3_key = pdfStorage.pdfS3Key;
            erganhLog.pdf_s3_url = pdfStorage.pdfS3Url;
            erganhLog.pdf_relative_path = pdfStorage.pdfRelativePath;
            erganhLog.pdf_filename = pdfStorage.pdfFilename;
            erganhLog.pdf_content_type = pdfStorage.pdfContentType;
            erganhLog.pdf_size_bytes = pdfStorage.pdfSizeBytes;
            erganhLog.error_message = null;
            await erganhLog.save();

            return res.json({
                success: true,
                pdfSaved: true,
                pdfUrl: getErganiPdfRoute(erganhLog._id),
                protocol,
                submitDate,
                erganhLogId: erganhLog._id
            });
        } catch (error) {
            const timedOut = error?.code === 'ERGANI_TIMEOUT' || /timeout/i.test(String(error?.message || error));
            console.warn('[ERGANI PDF RETRY] unavailable', {
                ...retryContext,
                reason: error?.message || String(error)
            });
            return res.json({
                success: false,
                pdfDeferred: true,
                message: timedOut
                    ? 'Το PDF δεν είναι ακόμη διαθέσιμο από το ΕΡΓΑΝΗ.'
                    : error?.message || 'Αποτυχία ανάκτησης PDF από το ΕΡΓΑΝΗ.',
                error: error?.message || String(error)
            });
        } finally {
            if (accessToken && refreshToken) {
                try {
                    await logoutErgani(accessToken, refreshToken);
                } catch (err) {
                    console.warn('[retrySubmittedErganiPdf] Logout failed:', err.message || String(err));
                }
            }
        }
    };

    // ============================================================================
    // ✅ DASHBOARD: Στατιστικά υποβολών ΕΡΓΑΝΗ εταιρείας
    // ============================================================================
    static getCompanyErganhDashboard = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;

            const period = String(req.query?.period || '30').trim();

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            const now = new Date();

            let dateFrom;

            if (period === '60') {
                dateFrom = new Date(now);
                dateFrom.setDate(dateFrom.getDate() - 60);
            } else if (period === '90') {
                dateFrom = new Date(now);
                dateFrom.setDate(dateFrom.getDate() - 90);
            } else if (period === 'year' || period === 'annual' || period === 'etisia') {
                dateFrom = new Date(now.getFullYear(), 0, 1);
            } else {
                dateFrom = new Date(now);
                dateFrom.setDate(dateFrom.getDate() - 30);
            }

            const match = {
                team: sessionTeam,
                companykod_object: companyId,
                createdAt: mongoose.trusted({
                    $gte: dateFrom,
                    $lte: now
                })
            };

            const rows = await ErgazomenoiErganhModel.find(match)
                .sort({ createdAt: -1 })
                .limit(500)
                .lean();

            const totals = {
                total: rows.length,
                rest: rows.filter((r) => r.upload_method === 'REST').length,
                xml: rows.filter((r) => r.upload_method === 'XML').length,
                active: rows.filter((r) => (r.document_status || 'ACTIVE') === 'ACTIVE').length,
                cancelled: rows.filter((r) => r.document_status === 'CANCELLED').length,
                failed: rows.filter((r) => r.submission_status === 'FAILED').length,
                temporary: rows.filter((r) => r.is_temporary === true).length,
                final: rows.filter((r) => r.is_final === true).length
            };

            const byProcessMap = new Map();

            const byMonthProcessMap = new Map();

            rows.forEach((r) => {
                const d = new Date(r.submit_date || r.createdAt || new Date());

                const year = d.getFullYear();
                const month = d.getMonth() + 1;

                const monthKey = `${year}-${String(month).padStart(2, '0')}`;

                const monthLabel = `${String(month).padStart(2, '0')}/${year}`;

                const processKey = r.process_code || r.submission_code || 'UNKNOWN';

                const key = `${monthKey}_${processKey}`;

                if (!byMonthProcessMap.has(key)) {
                    byMonthProcessMap.set(key, {
                        monthKey,
                        monthLabel,
                        processCode: processKey,
                        processDescription: r.process_description || r.submission_description || '',
                        count: 0
                    });
                }

                byMonthProcessMap.get(key).count++;
            });

            const byMonthProcess = Array.from(byMonthProcessMap.values()).sort((a, b) => {
                if (a.monthKey === b.monthKey) {
                    return String(a.processCode).localeCompare(String(b.processCode));
                }

                return String(a.monthKey).localeCompare(String(b.monthKey));
            });

            rows.forEach((r) => {
                const key = r.process_code || r.submission_code || 'UNKNOWN';

                if (!byProcessMap.has(key)) {
                    byProcessMap.set(key, {
                        processCode: key,
                        processDescription: r.process_description || r.submission_description || '',
                        count: 0,
                        rest: 0,
                        xml: 0,
                        active: 0,
                        cancelled: 0,
                        failed: 0
                    });
                }

                const item = byProcessMap.get(key);

                item.count++;

                if (r.upload_method === 'REST') item.rest++;
                if (r.upload_method === 'XML') item.xml++;
                if ((r.document_status || 'ACTIVE') === 'ACTIVE') item.active++;
                if (r.document_status === 'CANCELLED') item.cancelled++;
                if (r.submission_status === 'FAILED') item.failed++;
            });

            const byProcess = Array.from(byProcessMap.values()).sort((a, b) => b.count - a.count);

            const latest = rows.slice(0, 20).map((r) => ({
                _id: r._id,
                id: r._id,
                erganhLogId: r._id,
                createdAt: r.createdAt,
                submitDate: r.submit_date_text || '',
                protocol: r.protocol || '',
                employee:
                    `${r.ergazomenos_eponymo || ''} ${r.ergazomenos_onoma || ''}`.trim() ||
                    r.ergazomenos_kodikos ||
                    '',
                employeeAfm: r.ergazomenos_afm || '',
                submissionCode: r.submission_code || '',
                processCode: r.process_code || '',
                processDescription: r.process_description || '',
                uploadMethod: r.upload_method || '',
                submissionStatus: r.submission_status || '',
                documentStatus: r.document_status || 'ACTIVE',
                pdfUrl: r.pdf_s3_key
                    ? getErganiPdfRoute(r._id)
                    : r.pdf_relative_path
                      ? `/uploads/s3-mock/${r.pdf_relative_path}`
                      : r.pdf_s3_url || '',
                pdfSaved: !!(r.pdf_s3_key || r.pdf_relative_path || r.pdf_s3_url),
                pdfDeferred:
                    r.upload_method === 'REST' &&
                    !!r.protocol &&
                    !(r.pdf_s3_key || r.pdf_relative_path || r.pdf_s3_url)
            }));

            return res.json({
                success: true,
                period,
                dateFrom,
                dateTo: now,
                totals,
                byProcess,
                byMonthProcess,
                latest
            });
        } catch (error) {
            console.error('[getCompanyErganhDashboard] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την ανάκτηση dashboard ΕΡΓΑΝΗ.'
            });
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

    // ============================================================================
    // ✅ WTOWeek: Οριστική υποβολή Σταθερού Εβδομαδιαίου μέσω REST JSON
    //
    // Submission:
    // - trial id: 80
    // - production id: 182
    // - code: WTOWeek
    // - description: Οργάνωση Χρόνου Εργασίας - Σταθερό Εβδομαδιαίο
    //
    // Αναμενόμενο body:
    // {
    //   "ergazomenosId": "...",
    //   "ypokatasthma": "0",                    // προαιρετικά
    //   "apo_hmeromhnia": "YYYY-MM-DD" | "dd/MM/yyyy", // προαιρετικά
    //   "eos_hmeromhnia": "YYYY-MM-DD" | "dd/MM/yyyy"  // προαιρετικά
    // }
    // ============================================================================
    static submitWTOWeekToErganh = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const userId = req.session?.userId || req.session?.user?._id || null;

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            const body = req.body || {};
            const ergazomenosId =
                body.ergazomenosId || body.employeeId || body.id || body.kodikos || '';

            if (!ergazomenosId) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ο εργαζόμενος για την υποβολή WTOWeek.'
                });
            }

            // --------------------------------------------------------------------
            // 1) Φόρτωση εργαζομένου
            // --------------------------------------------------------------------
            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                employeeQuery._id = ergazomenosId;
            } else {
                employeeQuery.kodikos = String(ergazomenosId).trim();
            }

            const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε ο εργαζόμενος για την υποβολή WTOWeek.'
                });
            }

            // --------------------------------------------------------------------
            // 2) Φόρτωση εταιρείας
            // --------------------------------------------------------------------
            let companyData = null;

            if (mongoose.Types.ObjectId.isValid(String(companyId))) {
                companyData = await CompaniesModel.findById(companyId).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kod: companyId }).lean();
            }

            if (!companyData) {
                companyData = await CompaniesModel.findOne({ kodikos: companyId }).lean();
            }

            if (!companyData) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν τα στοιχεία της εταιρείας.'
                });
            }

            // --------------------------------------------------------------------
            // 3) Φόρτωση υποκαταστήματος
            // --------------------------------------------------------------------
            const selectedYpokatasthma =
                body.ypokatasthma ||
                body.ypokatasthmata ||
                body.ypokatasthmata_stathera ||
                ergazomenos.ypokatasthma ||
                ergazomenos.ypokatasthma_kodikos ||
                '0';

            let ypokatasthmataData = await YpokatasthmataModel.findOne({
                companykod_object: companyId,
                kodikos: String(selectedYpokatasthma)
            }).lean();

            if (!ypokatasthmataData) {
                ypokatasthmataData = await YpokatasthmataModel.findOne({
                    company: companyData.kod || companyData.kodikos || companyId,
                    kodikos: String(selectedYpokatasthma)
                }).lean();
            }

            if (!ypokatasthmataData) {
                return res.status(404).json({
                    success: false,
                    message: `Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`
                });
            }

            // --------------------------------------------------------------------
            // 4) Credentials ΕΡΓΑΝΗ
            // --------------------------------------------------------------------
            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password,
                userType: process.env.ERGANI_USERTYPE || '01'
            };

            // --------------------------------------------------------------------
            // 5) Φόρτωση εβδομαδιαίου προγράμματος εργαζομένου
            // --------------------------------------------------------------------
            const parseDateInput = (value) => {
                if (!value) return null;
                const raw = String(value).trim();

                const gr = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (gr) {
                    const [, dd, mm, yyyy] = gr;
                    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    return Number.isNaN(d.getTime()) ? null : d;
                }

                const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
                if (iso) {
                    const [, yyyy, mm, dd] = iso;
                    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    return Number.isNaN(d.getTime()) ? null : d;
                }

                const d = new Date(raw);
                return Number.isNaN(d.getTime()) ? null : d;
            };

            const apoDate = parseDateInput(
                body.apo_hmeromhnia ||
                    body.fromDate ||
                    body.f_from_date ||
                    body.hmeromhnia_apo ||
                    ergazomenos.hmeromhnia_allaghs_orarioy_apo
            );
            const eosDate = parseDateInput(
                body.eos_hmeromhnia ||
                    body.toDate ||
                    body.f_to_date ||
                    body.hmeromhnia_eos ||
                    ergazomenos.hmeromhnia_allaghs_orarioy_eos
            );

            console.log('[WTOWeek DATE DEBUG]', {
                body_apo:
                    body.apo_hmeromhnia || body.fromDate || body.f_from_date || body.hmeromhnia_apo,
                employee_orario_apo: ergazomenos.hmeromhnia_allaghs_orarioy_apo,
                apoDate,
                eosDate
            });

            const scheduleQuery = {
                team: sessionTeam,
                company_kod: companyId,
                kodikos: ergazomenos.kodikos,
                ypokatasthma: String(selectedYpokatasthma)
            };

            if (apoDate || eosDate) {
                const hmeromhniaFilter = {};

                if (apoDate) {
                    hmeromhniaFilter.$gte = apoDate;
                }

                if (eosDate) {
                    const eosEnd = new Date(eosDate);
                    eosEnd.setHours(23, 59, 59, 999);
                    hmeromhniaFilter.$lte = eosEnd;
                }

                // Χρειάζεται mongoose.trusted(), αλλιώς το Mongoose κάνει cast όλο το
                // { $gte, $lte } σαν Date και βγάζει:
                // Cast to date failed for value "{ '$gte': ..., '$lte': ... }"
                scheduleQuery.hmeromhnia = mongoose.trusted(hmeromhniaFilter);
            }

            let schedules = await ProdhlomenaOrariaModel.find(scheduleQuery)
                .sort({ hmeromhnia: 1 })
                .limit(7)
                .lean();

            // Fallback: σε κάποιες εγκαταστάσεις το ypokatasthma μπορεί να είναι 0000/0 ή να λείπει.
            if (!schedules.length) {
                const fallbackQuery = {
                    team: sessionTeam,
                    company_kod: companyId,
                    kodikos: ergazomenos.kodikos
                };

                if (scheduleQuery.hmeromhnia) fallbackQuery.hmeromhnia = scheduleQuery.hmeromhnia;

                schedules = await ProdhlomenaOrariaModel.find(fallbackQuery)
                    .sort({ hmeromhnia: 1 })
                    .limit(7)
                    .lean();
            }

            if (!schedules.length) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Δεν βρέθηκε εβδομαδιαίο προδηλωμένο πρόγραμμα για τον εργαζόμενο WTOWeek.'
                });
            }

            // --------------------------------------------------------------------
            // 6) Δημιουργία JSON + REST submit
            // --------------------------------------------------------------------
            const jsonResult = await generateWTOWeekJSON(
                ergazomenos,
                companyData,
                ypokatasthmataData,
                schedules
            );

            const payload = jsonResult.payload || jsonResult.json;

            const restResult = await uploadJsonDocumentToErgani({
                submissionCode: 'WTOWeek',
                payload,
                creds,
                fetchSubmittedPdf: true
            });

            const submittedPdfBuffer = restResult?.submittedPdf?.buffer || null;
            const submittedPdfContentType =
                restResult?.submittedPdf?.contentType || 'application/pdf';

            let pdfStorage = {
                pdfSaved: false,
                pdfFilename: null,
                pdfS3Key: null,
                pdfS3Url: null,
                pdfRelativePath: null,
                pdfSizeBytes: 0,
                pdfContentType: submittedPdfContentType,
                pdfSaveError: restResult?.submittedPdf?.error || null
            };

            if (restResult?.success) {
                const isValidPdfBuffer =
                    Buffer.isBuffer(submittedPdfBuffer) &&
                    submittedPdfBuffer.length > 5 &&
                    submittedPdfBuffer.subarray(0, 5).toString() === '%PDF-';

                if (isValidPdfBuffer) {
                    pdfStorage = await saveSubmittedErganiPdfToS3({
                        pdfBuffer: submittedPdfBuffer,
                        contentType: 'application/pdf',
                        ergazomenos,
                        companyData,
                        restResult,
                        submissionFolder: 'WTOWeek'
                    });
                } else {
                    pdfStorage = {
                        pdfSaved: false,
                        pdfFilename: null,
                        pdfS3Key: null,
                        pdfS3Url: null,
                        pdfRelativePath: null,
                        pdfSizeBytes: 0,
                        pdfContentType: null,
                        pdfSaveError:
                            restResult?.submittedPdf?.error ||
                            `Το ΕΡΓΑΝΗ δεν επέστρεψε έγκυρο PDF. Content-Type: ${
                                restResult?.submittedPdf?.rawContentType ||
                                restResult?.submittedPdf?.contentType ||
                                'unknown'
                            }`
                    };
                }
            }

            const effectiveSubmitDate = parseErganiSubmitDate(restResult?.submitDate) || new Date();

            const erganhLog = await ErgazomenoiErganhModel.create({
                team: sessionTeam,
                companykod_object: companyData?._id || companyId,
                companykod: companyData?.kod || companyData?.kodikos || '',

                ergazomenos_object: ergazomenos?._id,
                ergazomenos_kodikos: ergazomenos?.kodikos || '',
                ergazomenos_afm: ergazomenos?.afm || '',
                ergazomenos_eponymo: ergazomenos?.eponymo || '',
                ergazomenos_onoma: ergazomenos?.onoma || '',

                ypokatasthma_object: ypokatasthmataData?._id || null,
                ypokatasthma_kodikos:
                    ypokatasthmataData?.kodikos || ypokatasthmataData?.kod || selectedYpokatasthma,

                submission_code: 'WTOWeek',
                submission_id: restResult?.submission?.id || null,
                submission_description: restResult?.submission?.description || '',
                process_code: process.env.ERGANI_ENV === 'production' ? 'ma_182' : 'ma_80',
                process_description: 'Οργάνωση Χρόνου Εργασίας - Σταθερό Εβδομαδιαίο',

                upload_method: 'REST',
                submission_status: restResult?.success ? 'SUCCESS' : 'FAILED',
                is_temporary: false,
                is_final: restResult?.success === true,
                environment: process.env.ERGANI_ENV || 'trial',

                protocol: restResult?.protocol || null,
                submit_date_text: restResult?.submitDate || null,
                submit_date: effectiveSubmitDate,
                erganh_submission_id: restResult?.id || null,

                submission_year: effectiveSubmitDate.getFullYear(),
                submission_month: effectiveSubmitDate.getMonth() + 1,
                submission_day: effectiveSubmitDate.getDate(),

                pdf_s3_key: pdfStorage.pdfS3Key,
                pdf_s3_url: pdfStorage.pdfS3Url,
                pdf_relative_path: pdfStorage.pdfRelativePath,
                pdf_filename: pdfStorage.pdfFilename,
                pdf_content_type: pdfStorage.pdfContentType,
                pdf_size_bytes: pdfStorage.pdfSizeBytes,

                request_payload: payload,
                erganh_raw_response: restResult?.raw || null,
                error_message: restResult?.success ? pdfStorage.pdfSaveError : restResult?.error,

                created_by_user: userId,
                created_by_username: req.session?.userName || req.session?.username || ''
            });

            const sanitizedErgani = sanitizeErganiResultForResponse(restResult);
            const pdfDeferred = restResult?.submittedPdf?.pdfDeferred === true;

            return res.status(restResult?.success ? 200 : 400).json({
                success: !!restResult?.success,
                uploadMethod: 'rest',
                temporary: false,
                finalSubmission: true,
                message: restResult?.success
                    ? 'Το WTOWeek υποβλήθηκε οριστικά μέσω REST API.'
                    : restResult?.error || 'Η οριστική υποβολή WTOWeek μέσω REST API απέτυχε.',
                protocol: restResult?.protocol || null,
                submitDate: restResult?.submitDate || null,
                erganhSubmissionId: restResult?.id || null,
                erganhLogId: erganhLog?._id || null,
                pdfSaved: pdfStorage.pdfSaved,
                pdfUrl:
                    pdfStorage.pdfS3Key && erganhLog?._id
                        ? getErganiPdfRoute(erganhLog._id)
                        : pdfStorage.pdfRelativePath
                          ? `/uploads/s3-mock/${pdfStorage.pdfRelativePath}`
                          : pdfStorage.pdfS3Url || '',
                pdfS3Key: pdfStorage.pdfS3Key,
                pdfFilename: pdfStorage.pdfFilename,
                pdfSizeBytes: pdfStorage.pdfSizeBytes,
                pdfSaveError: pdfStorage.pdfSaveError,
                pdfDeferred,
                pdfWarning: getErganiPdfDeferredWarning(pdfDeferred),
                submission: restResult?.submission || null,
                erganh: sanitizedErgani
            });
        } catch (error) {
            console.error('[submitWTOWeekToErganh] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά την οριστική υποβολή WTOWeek στο ΕΡΓΑΝΗ.',
                error: error.message || String(error)
            });
        }
    };

    static generateWTOApologistiko = async (req, res) => {
        try {
            const { ypokatasthmata, ypokatasthmata_stathera, apo_hmeromhnia, eos_hmeromhnia } =
                req.body || {};

            const selectedYpokatasthma = ypokatasthmata_stathera || ypokatasthmata || '';

            if (!selectedYpokatasthma || !apo_hmeromhnia || !eos_hmeromhnia) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπουν υποχρεωτικά πεδία: παράρτημα / από / έως ημερομηνία.'
                });
            }

            const companyKodikos = req.session?.companyInUse || req.session?.companyKodikos;
            const team = req.session?.userTeam || req.session?.team;

            const company = await CompaniesModel.findOne({
                kod: companyKodikos
            }).lean();

            const ypokatasthma = await YpokatasthmataModel.findOne({
                company: companyKodikos,
                kodikos: selectedYpokatasthma
            }).lean();

            const rows = await ProdhlomenaOrariaModel.find({
                team,
                company_kod: companyKodikos,
                ypokatasthma: selectedYpokatasthma,
                apologistiko_biblio: true,
                hmeromhnia: mongoose.trusted({
                    $gte: new Date(apo_hmeromhnia),
                    $lte: new Date(eos_hmeromhnia)
                })
            })
                .sort({ hmeromhnia: 1, kodikos: 1 })
                .lean();

            if (!rows.length) {
                return res.status(200).json({
                    success: false,
                    message:
                        'Δεν βρέθηκαν εγγραφές με απολογιστικό βιβλίο για το επιλεγμένο διάστημα.'
                });
            }

            const employeeCodes = [...new Set(rows.map((r) => r.kodikos).filter(Boolean))];

            const employees = await ErgazomenoiModel.find({
                team,
                company_kod: companyKodikos,
                kodikos: mongoose.trusted({ $in: employeeCodes })
            })
                .select('kodikos afm eponymo onoma')
                .lean();

            const employeeByKodikos = new Map(
                employees.map((emp) => [String(emp.kodikos).trim(), emp])
            );

            const enrichedRows = rows.map((row) => {
                const emp = employeeByKodikos.get(String(row.kodikos).trim()) || {};

                return {
                    ...row,
                    afm: emp.afm || '',
                    eponymo: emp.eponymo || '',
                    onoma: emp.onoma || ''
                };
            });

            const result = await generateWTOXML(company, ypokatasthma, enrichedRows, {
                team,
                companyKodikos: req.session?.companyKodikos || '',
                companyDescription: req.session?.companyDescription || '',
                ypokatasthma: selectedYpokatasthma,
                apo_hmeromhnia,
                eos_hmeromhnia
            });

            const tmpXmlDir = path.join(process.cwd(), 'tmp', 'erganh-xml');

            if (!fs.existsSync(tmpXmlDir)) {
                fs.mkdirSync(tmpXmlDir, { recursive: true });
            }

            const xmlPath = path.join(tmpXmlDir, result.filename);

            fs.writeFileSync(xmlPath, result.xml, 'utf8');

            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: req.session.userTeam,
                companykod_object: req.session.companyInUse,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                throw new Error('Δεν βρέθηκαν κωδικοί ΕΡΓΑΝΗ για την εταιρεία.');
            }

            const creds = {
                username: erganhPasswordDoc.username,
                password: erganhPasswordDoc.password
            };

            const uploadResult = await uploadE3ToErganh(
                req.session.companyInUse,
                xmlPath,
                req.session.userId || req.session.user?._id || null,
                creds,
                {
                    xmlType: 'wto_variable_apologistiko',
                    isPermanent: false
                }
            );

            return res.status(200).json({
                success: true,
                message: uploadResult?.success
                    ? 'Το XML δημιουργήθηκε και ανέβηκε στο ΕΡΓΑΝΗ ως προσωρινή υποβολή.'
                    : 'Το XML δημιουργήθηκε, αλλά η αποστολή στο ΕΡΓΑΝΗ απέτυχε.',
                xml: result.xml,
                filename: result.filename,
                s3Key: result.s3Key,
                s3Url: result.s3Url,
                uploadResult
            });
        } catch (error) {
            console.error('❌ [generateWTOApologistiko] Error:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Αποτυχία δημιουργίας XML απολογιστικού πίνακα.'
            });
        }
    };

    static generateWTOApologistikoYperorion = async (req, res) => {
        try {
            const { ypokatasthmata, ypokatasthmata_stathera, apo_hmeromhnia, eos_hmeromhnia } =
                req.body || {};

            const selectedYpokatasthma = ypokatasthmata_stathera || ypokatasthmata || '';

            if (!selectedYpokatasthma || !apo_hmeromhnia || !eos_hmeromhnia) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπουν υποχρεωτικά πεδία: παράρτημα / από / έως ημερομηνία.'
                });
            }

            const team = req.session?.userTeam || req.session?.team;
            const companyInUse = req.session?.companyInUse;
            const companyKodikos =
                req.session?.companyKodikos ||
                req.session?.companykod ||
                req.session?.company_kod ||
                req.session?.companyKod ||
                '';

            const userId = req.session?.user?._id?.toString() || req.session?.userId?.toString();

            const company = await CompaniesModel.findOne({
                _id: companyInUse
            }).lean();

            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε η εταιρεία στο session.'
                });
            }

            const finalCompanyKodikos =
                companyKodikos || company?.kod || company?.kodikos || company?.companykod || '';

            const ypokatasthma = await YpokatasthmataModel.findOne({
                companykod_object: companyInUse,
                kodikos: selectedYpokatasthma
            }).lean();

            const fromDate = new Date(`${apo_hmeromhnia}T00:00:00.000Z`);
            const toDate = new Date(`${eos_hmeromhnia}T23:59:59.999Z`);

            const rows = await ProdhlomenaOrariaModel.find({
                team,
                company_kod: companyInUse,
                ypokatasthma: selectedYpokatasthma,
                hmeromhnia: mongoose.trusted({
                    $gte: fromDate,
                    $lte: toDate
                }),
                apo_ora_yperories: mongoose.trusted({ $nin: [null, '', '--:--'] }),
                eos_ora_yperories: mongoose.trusted({ $nin: [null, '', '--:--'] })
            })
                .sort({ hmeromhnia: 1, kodikos: 1 })
                .lean();

            if (!rows.length) {
                return res.status(200).json({
                    success: false,
                    message:
                        'Δεν βρέθηκαν εγγραφές υπερωριών με συμπληρωμένα apo_ora_yperories / eos_ora_yperories για το επιλεγμένο διάστημα.'
                });
            }

            const employeeCodes = [...new Set(rows.map((r) => r.kodikos).filter(Boolean))];

            const employees = await ErgazomenoiModel.find({
                team,
                company_kod: companyInUse,
                kodikos: mongoose.trusted({ $in: employeeCodes })
            })
                .select('kodikos afm afm_ergazomenoy eponymo onoma')
                .lean();

            const employeeByKodikos = new Map(
                employees.map((emp) => [String(emp.kodikos).trim(), emp])
            );

            const enrichedRows = rows.map((row) => {
                const emp = employeeByKodikos.get(String(row.kodikos).trim()) || {};

                return {
                    ...row,
                    afm: emp.afm || emp.afm_ergazomenoy || row.afm || row.afm_ergazomenoy || '',
                    eponymo: emp.eponymo || row.eponymo || row.eponymo_ergazomenoy || '',
                    onoma: emp.onoma || row.onoma || row.onoma_ergazomenoy || ''
                };
            });

            const xmlResult = await generateWTOOvXML(company, ypokatasthma, enrichedRows, {
                team,
                companyKodikos: finalCompanyKodikos,
                companyDescription:
                    req.session?.companyDescription ||
                    req.session?.companyDescr ||
                    company?.perigrafh ||
                    company?.eponymia ||
                    company?.description ||
                    'UNKNOWN',
                ypokatasthma: selectedYpokatasthma,
                apo_hmeromhnia,
                eos_hmeromhnia,
                comments: ''
            });

            const credentials = await PasswordsModel.findOne({
                team,
                companykod_object: companyInUse,
                kodikos: '0002'
            }).lean();

            if (!credentials?.username || !credentials?.password) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Το XML δημιουργήθηκε, αλλά δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002.',
                    filename: xmlResult.filename,
                    s3Key: xmlResult.s3Key,
                    s3Url: xmlResult.s3Url
                });
            }

            const tmpXmlDir = path.join(process.cwd(), 'tmp', 'erganh-xml');

            if (!fs.existsSync(tmpXmlDir)) {
                fs.mkdirSync(tmpXmlDir, { recursive: true });
            }

            const xmlPath = path.join(tmpXmlDir, xmlResult.filename);

            fs.writeFileSync(xmlPath, xmlResult.xml, 'utf8');

            console.log('[WTO_OV] FINAL LOCAL XML PATH:', xmlPath);

            const uploadResult = await uploadE3ToErganh(
                companyInUse,
                xmlPath,
                userId,
                {
                    username: credentials.username,
                    password: credentials.password
                },
                {
                    xmlType: 'wto_yperories_apologistiko',
                    isPermanent: false
                }
            );

            return res.status(uploadResult.success ? 200 : 400).json({
                success: uploadResult.success,
                message: uploadResult.success
                    ? 'Το XML απολογιστικού πίνακα υπερωριών δημιουργήθηκε και ανέβηκε προσωρινά στο ΕΡΓΑΝΗ.'
                    : uploadResult.userMessage ||
                      'Το XML δημιουργήθηκε αλλά η αποστολή στο ΕΡΓΑΝΗ απέτυχε.',
                filename: xmlResult.filename,
                s3Key: xmlResult.s3Key,
                s3Url: xmlResult.s3Url,
                erganh: uploadResult
            });
        } catch (error) {
            console.error('[generateWTOApologistikoYperorion] ❌', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Σφάλμα κατά τη δημιουργία/αποστολή XML υπερωριών.'
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

                const body = await response.body();

                // Αν είναι Excel κράτησέ το, αλλιώς άσε το να περάσει κανονικά
                if (
                    contentType.includes('application/vnd') ||
                    contentType.includes('application/octet-stream') ||
                    contentType.includes('excel')
                ) {
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

// ============================================================
function normalizeYpokatasthma(value) {
    if (value === null || value === undefined) return '';

    let s = String(value).trim();

    // Αν έρθει σαν "1.00" ή number από Excel
    if (/^\d+(\.0+)?$/.test(s)) {
        s = String(parseInt(s, 10));
    }

    return s.padStart(4, '0');
}

async function saveTelikoToProdhlomena(sheetTeliko, sessionYearInUse) {
    const CHUNK_SIZE = 1000; // ops ανά bulkWrite
    const PARALLEL_CHUNKS = 5; // πόσα bulkWrites τρέχουν παράλληλα

    // -------- 1) Διάβασε όλες τις γραμμές --------
    const rows = [];
    sheetTeliko.eachRow((row, rowNumber) => {
        rows.push({
            rowNumber,
            ypokatasthma: normalizeYpokatasthma(row.getCell(1).value ?? row.getCell(1).text),
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
        afm: mongoose.trusted({ $in: uniqueAfms })
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
        argiesList = await ArgiesModel.find({ $or: mongoose.trusted(argiesOr) }).lean();
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

        // ✅ Αργία βάσει της τρέχουσας ημερομηνίας του Εργάνη_Τελικό
        const argiaKey = `${ergazomenos.team}|${ergazomenos.company_kod}|${hmeromhnia.getTime()}`;
        const argiaPerigrafh = argiesMap[argiaKey] || '';
        const isArgia = Object.prototype.hasOwnProperty.call(argiesMap, argiaKey);

        // ✅ ΡΕΠΟ; (στήλη F = "ΑΝ")
        let isRepo = current.kathgoria === 'ΑΝ';

        const record = {
            team: ergazomenos.team,
            company_kod: ergazomenos.company_kod,
            ypokatasthma: current.ypokatasthma,
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
            ores_ergasias: diffHours(current.apo_ora, current.eos_ora), // ✅ 1ο ζεύγος
            cards_apo_ora_01: '',
            cards_eos_ora_01: '',
            cards_apo_ora_02: '',
            cards_eos_ora_02: '',
            cards_apo_ora_03: '',
            cards_eos_ora_03: '',
            cards_ores_ergasias: 0,
            check_ergasia: false,

            apologistiko_biblio: false,
            apo_ora_01_apologistika: '',
            eos_ora_01_apologistika: '',
            apo_ora_02_apologistika: '',
            eos_ora_02_apologistika: '',
            apo_ora_03_apologistika: '',
            eos_ora_03_apologistika: '',

            ores_nyxtas_apologistika: 0,
            ores_argion_prosayxhsh_apologistika: 0,
            ores_argion_ergasia_apologistika: 0,
            kyriakes_apologistika: false,

            ores_prostheths_ergasias_apologistika: 0,

            ores_yperergasias_apologistika: 0,
            ores_yperergasias_nyxtas_apologistika: 0,
            ores_yperergasias_argion_apologistika: 0,
            ores_yperergasias_argion_nyxtas_apologistika: 0,

            ores_nominhs_yperorias_apologistika: 0,
            ores_nominhs_yperorias_nyxtas_apologistika: 0,
            ores_nominhs_yperorias_argion_apologistika: 0,
            ores_nominhs_yperorias_argion_nyxtas_apologistika: 0,

            ores_paranomhs_yperorias_apologistika: 0,
            ores_paranomhs_yperorias_nyxtas_apologistika: 0,
            ores_paranomhs_yperorias_argion_apologistika: 0,
            ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0,

            repo_apologistika: false,
            adeia_apologistika: false,
            kathgoria_adeias_apologistika: '',
            astheneia_apologistika: false,
            kyriakes_apologistika: false
        };

        // Συγχώνευση με τις 1-2 επόμενες γραμμές αν είναι ίδια ημ/νία & ΑΦΜ
        if (i + 1 < rows.length) {
            const next1 = rows[i + 1];
            const next1Date = parseGRDate(next1.hmeromhnia_raw);
            if (
                next1Date &&
                next1Date.getTime() === hmeromhnia.getTime() &&
                next1.afm === current.afm &&
                next1.ypokatasthma === current.ypokatasthma
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
                        next2.afm === current.afm &&
                        next2.ypokatasthma === current.ypokatasthma
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
                    ypokatasthma: record.ypokatasthma,
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

    // ============================================================
    // Αποφυγή duplicate γραμμών στο Κάρτες_Τελικό
    // Κόβει μόνο απολύτως ίδιες γραμμές.
    // Δεν κόβει διαφορετικά ζεύγη καρτών π.χ. 10:00-14:00 και 18:00-22:00.
    // ============================================================
    const writtenKartesRows = new Set();

    function writeTelikoKartes(colA, colB, colC, colD, colE, colF, colG, colH) {
        const dedupeKey = [
            String(colB || '').trim(), // ΑΦΜ
            String(colE || '').trim(), // Ημερομηνία
            String(colF || '').trim(), // Ώρα έναρξης κάρτας
            String(colG || '').trim() // Ώρα λήξης κάρτας
        ].join('|');

        if (writtenKartesRows.has(dedupeKey)) {
            return;
        }

        writtenKartesRows.add(dedupeKey);
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

    // ============================================================
    // ✅ ΤΩΡΑ γράψε το αρχείο (με τη στήλη H συμπληρωμένη)
    // ============================================================

    // ============================================================
    // FINAL SAFETY DEDUPE στο Κάρτες_Τελικό
    // Διαγραφή duplicate γραμμών bottom-up
    // Βάση: ΑΦΜ + Ημερομηνία + Από + Έως
    // ============================================================
    const finalSeen = new Set();
    const finalRowsToDelete = [];

    sheetTeliko.eachRow((row, rowNumber) => {
        const key = [
            String(row.getCell(2).text || row.getCell(2).value || '').trim(),
            String(row.getCell(5).text || row.getCell(5).value || '').trim(),
            String(row.getCell(6).text || row.getCell(6).value || '').trim(),
            String(row.getCell(7).text || row.getCell(7).value || '').trim()
        ].join('|');

        if (finalSeen.has(key)) {
            finalRowsToDelete.push({ rowNumber, key });
            return;
        }

        finalSeen.add(key);
    });

    finalRowsToDelete
        .sort((a, b) => b.rowNumber - a.rowNumber)
        .forEach(({ rowNumber, key }) => {
            sheetTeliko.spliceRows(rowNumber, 1);
        });

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
            ypokatasthma: normalizeYpokatasthma(row.getCell(1).value ?? row.getCell(1).text),
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

        const key = `${r.afm}|${r.ypokatasthma}|${hmeromhnia.getTime()}`;
        if (!groups.has(key)) {
            groups.set(key, {
                ypokatasthma: r.ypokatasthma,
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
        afm: mongoose.trusted({ $in: uniqueAfms })
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
            ypokatasthma: g.ypokatasthma,

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
            update.cards_ores_ergasias += diffHours(p.apo, p.eos);
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
                    ypokatasthma: g.ypokatasthma,
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
