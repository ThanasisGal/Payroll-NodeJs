// Συνάρτηση υπολογισμού πραγματικών εργάσιμων ημερών του μήνα
// export async function ypologismosPragmatikonErgasimonHmeronMhna(   year, 
async function ypologismosPragmatikonErgasimonHmeronMhna(   year, 
                                                            month, 
                                                            hmeres, 
                                                            genikesParametroi, 
                                                            argies, 
                                                            xarakthrismos_ergazomenoy,
                                                            hmeromhnia_proslhpshs,
                                                            hmeromhnia_apoxorhshs
                                                        ) 
    {
        let startDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1)).toISOString();
        let endDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10), 0)).toISOString();

        if (hmeromhnia_proslhpshs && (new Date(hmeromhnia_proslhpshs).toISOString() >= startDate && new Date(hmeromhnia_proslhpshs).toISOString() <= endDate)) {
            startDate = new Date(hmeromhnia_proslhpshs).toISOString();
        }
        if (hmeromhnia_apoxorhshs && (new Date(hmeromhnia_apoxorhshs).toISOString() >= startDate && new Date(hmeromhnia_apoxorhshs).toISOString() <= endDate)) {
            endDate = new Date(hmeromhnia_apoxorhshs).toISOString();
        }

        let count = 0;
        let apoDate = new Date(startDate);
        let eosDate = new Date(endDate);
        let _LEITOYRGIA_TIS_ARGIES = await getTimhByKodikos(genikesParametroi, "0008"); // Παίρνουμε την τιμή από το genikesParametroi με κωδικό '0008' (Λειτουργία κατά τις αργίες)
        let _PLHROMH_ERGATON_TIS_ARGIES = await getTimhByKodikos(genikesParametroi, "0009"); //  (Πληρωμή αργιών σε εργάτες)
        let holidays = await filterArgiesByMonth(argies, year, month)  // Επιλέγουμε τις αργίες του ζητούμενου μήνα
        let isHoliday = false;

        for (let day = apoDate; day <= eosDate; day.setDate(day.getDate() + 1)) {
            const isWeekend = (day.getDay() === 0 || day.getDay() === 6);
            const dayOfMonth = day.getDate();  // Παίρνουμε την ημέρα του μήνα
            isHoliday = (_LEITOYRGIA_TIS_ARGIES === "Ο") ? holidays.includes(dayOfMonth) : false;  // Σύγκριση μόνο με την ημέρα του μήνα
            
            if (isHoliday && xarakthrismos_ergazomenoy) isHoliday = false;    // Αργία και Υπάλληλος  ---> isHoliday = FALSE
            if (!isHoliday && !xarakthrismos_ergazomenoy && _PLHROMH_ERGATON_TIS_ARGIES === "Ο") isHoliday = true;

            if (hmeres === '5' && !isWeekend && !isHoliday) {
                count++;
            } else if (hmeres === '6' && day.getDay() !== 0 && !isHoliday) {
                count++;
            }
        }

        if (sharedParams.ergazomenoi.plhrhs_apasxolhsh) {
            const notWorkDaysResult = await getNotWorkDays({
                team: sharedParams._TEAM,
                company_kod: document.getElementById("company_kod").value,
                ypokatasthma: getCurrentEmployeeYpokatasthmaForNotWorkDays(),
                kodikos: document.getElementById("kodikosHidden").value,
                dateStart: startDate,
                dateEnd: endDate
            });
            const parsedMhErgasimes = parseFloat(notWorkDaysResult?.mhErgasimes);
            const mhErgasimes = Number.isFinite(parsedMhErgasimes) ? parsedMhErgasimes : 0;

            sharedParams._MH_ERGASIMES_HMERES_MHNA = mhErgasimes;
            sharedParams._SYNOLO_ERGASIMON_HMERON_MHNA = count;
            count = Math.max(0, count - mhErgasimes);

        }
        return Number.isFinite(count) ? count : 0;
    }

function getCurrentEmployeeYpokatasthmaForNotWorkDays() {
    const directYpokatasthma =
        document.getElementById('ypokatasthma_Hidden')?.value ||
        document.getElementById('ypokatasthmaHidden')?.value ||
        '';

    if (String(directYpokatasthma).trim()) {
        return String(directYpokatasthma).trim();
    }

    const employeeYpokatasthma =
        sharedParams?.ergazomenoi?.ypokatasthma ||
        sharedParams?.ergazomenoi?.ypokatasthma_kodikos ||
        '';

    return String(employeeYpokatasthma || '').trim();
}

let apasxolhseisCsrfTokenCache = '';
let apasxolhseisCsrfTokenPromise = null;

function readApasxolhseisCsrfTokenFromDom() {
    return (
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
        document.querySelector('meta[name="csrfToken"]')?.getAttribute('content') ||
        document.querySelector('input[name="_csrf"]')?.value ||
        document.querySelector('input[name="csrfToken"]')?.value ||
        window.csrfToken ||
        window.CSRF_TOKEN ||
        ''
    );
}

async function getApasxolhseisCsrfToken() {
    const domToken = readApasxolhseisCsrfTokenFromDom();
    if (domToken) {
        apasxolhseisCsrfTokenCache = domToken;
        return domToken;
    }

    if (apasxolhseisCsrfTokenCache) {
        return apasxolhseisCsrfTokenCache;
    }

    if (!apasxolhseisCsrfTokenPromise) {
        apasxolhseisCsrfTokenPromise = fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        })
            .then(async response => {
                if (!response.ok) return '';
                const data = await response.json().catch(() => ({}));
                return data.csrfToken || data._csrf || data.token || '';
            })
            .then(token => {
                apasxolhseisCsrfTokenCache = token || '';
                return apasxolhseisCsrfTokenCache;
            })
            .catch(() => '')
            .finally(() => {
                apasxolhseisCsrfTokenPromise = null;
            });
    }

    return apasxolhseisCsrfTokenPromise;
}

async function getApasxolhseisJsonPostHeaders() {
    const csrfToken = await getApasxolhseisCsrfToken();
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
    };

    if (csrfToken) {
        headers['CSRF-Token'] = csrfToken;
        headers['X-CSRF-Token'] = csrfToken;
        headers['X-XSRF-Token'] = csrfToken;
    }

    return { headers, csrfToken };
}

async function getNotWorkDays(params) {
    const payload = {
        team: params.team,
        company_kod: params.company_kod,
        ypokatasthma: params.ypokatasthma,
        kodikos: params.kodikos,
        startDate: params.dateStart,
        endDate: params.dateEnd
    };

    const hasValidDates =
        payload.startDate &&
        payload.endDate &&
        !Number.isNaN(new Date(payload.startDate).getTime()) &&
        !Number.isNaN(new Date(payload.endDate).getTime());

    if (!payload.team || !payload.company_kod || !payload.kodikos || !hasValidDates) {
        console.warn('Παράλειψη hmeres_mh_ergasias λόγω ελλιπών στοιχείων:', payload);
        return { mhErgasimes: 0 };
    }

    try {
        const { headers, csrfToken } = await getApasxolhseisJsonPostHeaders();
        const requestPayload = csrfToken ? { ...payload, _csrf: csrfToken } : payload;

        const data = await fetch('/api/kinhseis/hmeres_mh_ergasias', {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify(requestPayload)
        });

        let result = {};
        try {
            result = await data.json();
        } catch (jsonError) {
            result = {};
        }

        if (!data.ok) {
            console.warn('Αποτυχία hmeres_mh_ergasias. Χρησιμοποιείται mhErgasimes=0.', {
                status: data.status,
                payload,
                result
            });
            return { mhErgasimes: 0 };
        }

        const parsedMhErgasimes = parseFloat(result?.mhErgasimes);
        return {
            ...result,
            mhErgasimes: Number.isFinite(parsedMhErgasimes) ? parsedMhErgasimes : 0
        };
    } catch (error) {
        console.warn('Σφάλμα στο hmeres_mh_ergasias. Χρησιμοποιείται mhErgasimes=0.', {
            error,
            payload
        });
        return { mhErgasimes: 0 };
    }
}

async function filterArgiesByMonth(argies, year, month) {
    // Μετατροπή του year και month σε αριθμούς
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    
    return argies.filter(argia => {
        const argiaDate = new Date(argia.hmeromhnia);
        return argiaDate.getFullYear() === yearNum && argiaDate.getMonth() === monthNum - 1;
    }).map(argia => new Date(argia.hmeromhnia).getDate());  // Αποθηκεύει μόνο την ημέρα του μήνα
}

// Συνάρτηση για την λήψη μιας παραμέτρου (βάσει κωδικού) από το GenikesParametroi
async function getTimhByKodikos(genikesParametroi, kodikos) {
    const parametro = genikesParametroi.find(p => p.kodikos === kodikos);
    return parametro ? parametro.timh : null; // επιστρέφει null αν δεν βρεθεί τιμή
}

let _ORES_HMERHSIAS_ERGASIAS;
let firstTimeCalcPlhroteo = false;

// Δηλώνουμε το allowedKeys σε κοινό scope, π.χ. στο επίπεδο του script
const allowedKeys = [   // ΠΛΗΚΤΡΑ ΠΟΥ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΧΡΗΣΙΜΟΠΟΙΘΟΥΝ ΣΕ ΑΡΙΘΜΗΤΙΚΑ ΠΕΔΙΑ
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ",", ".", 
    "Backspace", "Delete",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", 
    "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9"
];

document.addEventListener("DOMContentLoaded", function() {
    let skipBlurForField1 = false;
    let disableKeyupForPlhroteo = false; 
    let _MHNES_YPOLOGISMOY_FOROY = 0;
    // Ακρόαση του custom event
    document.addEventListener('sharedParamsLoaded', async function(event) {
        let sharedParams = event.detail;

        _MHNES_YPOLOGISMOY_FOROY  = parseInt(sharedParams.genikesParametroi[29].timh);
        _ORES_HMERHSIAS_ERGASIAS = parseFloat(sharedParams.ergazomenoi.ores_ergasias_ebdomadas) / parseFloat(sharedParams.ergazomenoi.hmeres_ergasias_ebdomadas);
        // ΕΡΓΑΣΙΑ ΒΑΣΕΙ ΣΥΜΒΑΣΗΣ 
        sharedParams._PROSAYXHSH_HMERON_5MERHS_ERGASIAS = (sharedParams.ergazomenoi.apasxolhsh_basei_symbashs !== "5") ? 1 : (parseFloat(sharedParams.genikesParametroi[9].timh) / parseFloat(sharedParams.genikesParametroi[4].timh)).toFixed(2);
    }); 

    const nomimoOromisthio = document.getElementById("nomimoOromisthio");
    const pragmatikoHmeromisthio = document.getElementById("pragmatikoHmeromisthio");
    const pragmatikoOromisthio = document.getElementById("pragmatikoOromisthio");
    const hmeresErgasias = document.getElementById("hmeresErgasias");
    const oresErgasias = document.getElementById("oresErgasias");
    const hmeresApoysias = document.getElementById("hmeresApoysias");
    const oresApoysias = document.getElementById("oresApoysias");
    const hmeresErgasiasMeionApoysies = document.getElementById("hmeresErgasiasMeionApoysies");
    const oresErgasiasMeionApoysies = document.getElementById("oresErgasiasMeionApoysies");
    const hmeresAsfalishs = document.getElementById("hmeresAsfalishs");
    const hmeresAstheneias = document.getElementById("geniko_synolo_hmeron_astheneias");
    const apodoxesAstheneias = document.getElementById("geniko_synolo_astheneias");
    const exoflhsh = document.getElementById("exoflhsh");
    const posoPlhromhs = document.getElementById("poso_plhromhs");
    const deleteButton = document.getElementById("deleteButton");

    function safeNumber(value, defaultValue = 0) {
        if (value === null || value === undefined) return defaultValue;
        const normalized = String(value).replace(',', '.').trim();
        if (normalized === '') return defaultValue;
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : defaultValue;
    }

    function setInputValueSafe(id, value, decimals = 2) {
        const element = document.getElementById(id);
        if (!element) return;
        const parsed = safeNumber(value, 0);
        element.value = parsed.toFixed(decimals);
    }

    async function formatInputOnBlur(event, decimals) {
        const inputValue = event.target.value;
        if (isNaN(Number(inputValue)) || inputValue === '') {
            event.target.value = Number('0').toFixed(decimals);
        } else {
            event.target.value = Number(inputValue).toFixed(decimals);
        }
    }
    
    let hmeresApoysiasFromOres = 0;
    let plhroteoDebounceTimeout;
    let allaghForoy = false;

    // Debounce/coalesce για τον υπολογισμό πληρωτέου.
    // Κατά τη μαζική φόρτωση εργαζομένου αλλάζουν πολλά πεδία μαζί και παλαιότερα
    // καλούσαν το calcPlhroteo δεκάδες/εκατοντάδες φορές. Με αυτό κρατάμε μόνο
    // έναν τελικό υπολογισμό ανά μικρό burst αλλαγών, χωρίς να αλλάζει η business logic.
    const CALC_PLHROTEO_DEBOUNCE_MS = 80;
    let calcPlhroteoTimer = null;
    let calcPlhroteoRunning = false;
    let calcPlhroteoPendingAfterRun = false;
    let calcPlhroteoResolvers = [];

    function resolveCalcPlhroteoQueue() {
        const resolvers = calcPlhroteoResolvers;
        calcPlhroteoResolvers = [];
        resolvers.forEach((resolve) => {
            try {
                resolve();
            } catch (error) {
                console.warn('Αδυναμία resolve calcPlhroteo promise:', error);
            }
        });
    }

    /**
     * Coalesced async runner για βαριούς υπολογισμούς.
     *
     * Όταν κατά τη φόρτωση/αλλαγή εργαζομένου αλλάζουν πολλά πεδία μαζί,
     * τα ίδια calculations ζητούνται δεκάδες φορές. Δεν αλλάζουμε τη λογική
     * τους· απλώς κρατάμε έναν τελικό υπολογισμό ανά μικρό burst αλλαγών.
     */
    function createCoalescedAsyncRunner(getCoreFn, debounceMs = 60) {
        let timer = null;
        let running = false;
        let waiters = [];

        const resolveWaiters = (batch, value) => {
            batch.forEach(({ resolve }) => {
                try {
                    resolve(value);
                } catch (error) {
                    console.warn('Αδυναμία resolve coalesced calculation:', error);
                }
            });
        };

        const rejectWaiters = (batch, error) => {
            batch.forEach(({ reject }) => {
                try {
                    reject(error);
                } catch (rejectError) {
                    console.warn('Αδυναμία reject coalesced calculation:', rejectError);
                }
            });
        };

        const run = async () => {
            if (running) return;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            const batch = waiters;
            waiters = [];
            if (!batch.length) return;

            running = true;
            try {
                const coreFn = getCoreFn();
                const result = (typeof coreFn === 'function') ? await coreFn() : undefined;
                resolveWaiters(batch, result);
            } catch (error) {
                rejectWaiters(batch, error);
            } finally {
                running = false;
                if (waiters.length && !timer) {
                    timer = setTimeout(run, debounceMs);
                }
            }
        };

        return () => new Promise((resolve, reject) => {
            waiters.push({ resolve, reject });

            if (running) return;

            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(run, debounceMs);
        });
    }

    let calcSynoloMiktonApodoxonCoreRef = null;
    const runCalcSynoloMiktonApodoxonCoalesced = createCoalescedAsyncRunner(
        () => calcSynoloMiktonApodoxonCoreRef,
        60
    );

    let handleSynoloMiktonChangeCoreRef = null;
    const runHandleSynoloMiktonChangeCoalesced = createCoalescedAsyncRunner(
        () => handleSynoloMiktonChangeCoreRef,
        60
    );

    // Pipeline φόρτωσης εργαζομένου:
    // Κατά τη μαζική συμπλήρωση πεδίων δεν αφήνουμε τα change/input/blur
    // να ξεκινήσουν 200 φορές την ίδια αλυσίδα υπολογισμών.
    // Οι τιμές γράφονται silent και στο τέλος εκτελείται μία πλήρης σειρά υπολογισμών.
    window.apasxolhseisEmployeeLoadPipeline = window.apasxolhseisEmployeeLoadPipeline || false;
    window.apasxolhseisSuppressFieldEvents = window.apasxolhseisSuppressFieldEvents || false;

    function isEmployeeLoadPipelineActive() {
        return window.apasxolhseisEmployeeLoadPipeline === true;
    }

    function shouldIgnoreFieldEventDuringLoad() {
        return window.apasxolhseisSuppressFieldEvents === true;
    }

    async function finishValueCalculation(options = {}) {
        if (isEmployeeLoadPipelineActive()) return;

        if (options.includeAsfalistikhAxia) {
            await calcSynoloAsfalistikhsAxias();
        }
        await calcSynoloMiktonApodoxon();

        if (typeof window.handleSynoloMiktonChange === 'function') {
            await window.handleSynoloMiktonChange();
        } else if (typeof handleSynoloMiktonChange === 'function') {
            await handleSynoloMiktonChange();
        }
    }


    // ========================== ΥΠΟΛΟΓΙΣΜΟΣ ΗΜΕΡΩΝ ΕΡΓΑΣΙΑΣ ============================
    async function runHmeresErgasiasCalculationCore() {
        if (!(sharedParams && !hasRecord)) return;

        const data = await fetch(`/api/kinhseis/calcApoysies?team=${sharedParams._TEAM}&company=${sharedParams._COMPANY}&xrhsh=${sharedParams._XRHSH}&employeeKod=${sharedParams.ergazomenoi.kodikos}&startDate=${sharedParams.startDate}&endDate=${sharedParams.endDate}`);
        const dataResult = await data.json();

        let typos_apodoxon = document.getElementById("typosApodoxon_Hidden").value;
        if (!window.isManualEntry) {
            await checkHmeresErgasias();
        } else {
            await handleTyposApodoxon(typos_apodoxon, sharedParams);
        }

        hmeresApoysias.value = (dataResult.total_hmeres_apoysias && !isNaN(dataResult.total_hmeres_apoysias))
            ? parseInt(dataResult.total_hmeres_apoysias)
            : 0;

        if (isEmployeeLoadPipelineActive()) {
            await window.calcHmeresErgasiasMeionApoysies();
        } else {
            hmeresApoysias.dispatchEvent(new Event("change"));
        }

        oresApoysias.value = (dataResult.total_ores_apoysias && !isNaN(dataResult.total_ores_apoysias))
            ? parseFloat(dataResult.total_ores_apoysias).toFixed(2)
            : 0;

        await calcOresApoysias();
        await finishValueCalculation();
    }

    window.apasxolhseisRunHmeresErgasiasCalculation = runHmeresErgasiasCalculationCore;

    hmeresErgasias.addEventListener('change', async (event) => {
        if (shouldIgnoreFieldEventDuringLoad()) return;
        await runHmeresErgasiasCalculationCore();
    });

    async function calcOresErgasias() {
        _APODOXES_ORON_ERGASIAS = parseFloat(document.getElementById("oresErgasias").value) * pragmatikoOromisthio.value;
        await finishValueCalculation();
    }

    oresErgasias.addEventListener('input', async (event) => {
        if (shouldIgnoreFieldEventDuringLoad()) return;
        await calcOresErgasias();
    });

    oresApoysias.addEventListener('input', async (event) => {
        if (shouldIgnoreFieldEventDuringLoad()) return;
        _APODOXES_ORON_APOYSIAS = parseFloat(document.getElementById("oresApoysias").value) * pragmatikoOromisthio.value;
        await finishValueCalculation();
    });

    async function checkHmeresErgasias() {
        let typos_apodoxon = document.getElementById("typosApodoxon_Hidden").value;
        await handleTyposApodoxon(typos_apodoxon, sharedParams);
    }
    
    async function handleTyposApodoxon(typos_apodoxon, sharedParams) {
    try {
        const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
        const functionName = `handleTypos${typos_apodoxon}`; // π.χ. handleTypos001

        if (typeof window[functionName] === "function") {
            await window[functionName](sharedParams);
        } else {
            console.warn(`Η συνάρτηση ${functionName} δεν είναι φορτωμένη.`);
        }
    } catch (error) {
        console.error(`Σφάλμα κατά την εκτέλεση του υπολογισμού:`, error);
    }
    }

    async function calcOresApoysias () {
        if (!sharedParams || hasRecord) return;
        
        const oresApoysiasVal = parseFloat(oresApoysias.value) || 0;
        hmeresApoysiasFromOres = 0; // Επαναφορά σε 0 πριν τον υπολογισμό

        if (oresApoysiasVal === 0) {
            // Αν οι ώρες απουσίας είναι 0
            oresErgasiasMeionApoysies.value = "0.00";
            if (isEmployeeLoadPipelineActive()) {
                await calcOresErgasias();
            } else {
                oresErgasias.dispatchEvent(new Event("input"));
            }
            return;
        }

        oresErgasiasMeionApoysies.value = parseFloat(oresApoysiasVal).toFixed(2);
        if (isEmployeeLoadPipelineActive()) {
            await calcOresErgasias();
        } else {
            oresErgasias.dispatchEvent(new Event("input"));
        }
    }

    window.ypologismosAxiasKrathseon = ypologismosAxiasKrathseon;

    window.calcMiktesApodoxes = async function () {
        if (hasRecord) return;

        let typos_apodoxon = document.getElementById("typosApodoxon_Hidden").value;
        await handleYpologismoi(typos_apodoxon, sharedParams);
        if (!isEmployeeLoadPipelineActive()) {
            await calcSynoloMiktonApodoxon();
        }
    }

    async function handleYpologismoi(typos_apodoxon, sharedParams) {
        try {
            // const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
            const functionName = `handleCalcs${typos_apodoxon}`; // π.χ. handleCalcs001
    
            if (typeof window[functionName] === "function") {
                await window[functionName](sharedParams);
            } else {
                console.warn(`Η συνάρτηση ${functionName} δεν είναι φορτωμένη.`);
            }
        } catch (error) {
            console.error(`Σφάλμα κατά την εκτέλεση του υπολογισμού:`, error);
        }
    }

    window.calcHmeresErgasiasMeionApoysies = async function () {  // ΥΠΟΛΟΓΙΣΜΟΣ ΗΜΕΡΩΝ ΕΡΓΑΣΙΑΣ ΜΕΙΟΝ ΑΠΟΥΣΙΕΣ
        if (hasRecord) return;

        const hmeresApoysiasValue = parseFloat(hmeresApoysias.value) || 0;
        const hmeresErgasiasValue = parseFloat(hmeresErgasias.value) || 0;
        const hmeresAstheneiasValue = parseInt(hmeresAstheneias.value)  || 0;

        // Αφαιρούμε τις ημέρες απουσίας από τις ώρες και τις ημέρες απουσίας
        if (hmeresErgasias.value > parseFloat(sharedParams.genikesParametroi[5].timh)) hmeresErgasias.value = parseFloat(sharedParams.genikesParametroi[5].timh);        
        
        hmeresErgasiasMeionApoysies.value = parseFloat(parseFloat(hmeresErgasias.value) - (parseFloat(hmeresApoysias.value) * (parseFloat(sharedParams.genikesParametroi[9].timh) / parseFloat(sharedParams.genikesParametroi[4].timh))) - hmeresAstheneiasValue).toFixed(2); 

        if (!_CHECK_HMERES_ASFALISHS) {
            hmeresAsfalishs.value = Math.min(parseFloat(sharedParams.genikesParametroi[5].timh), Math.round(
                parseFloat(hmeresErgasiasMeionApoysies.value) + parseFloat(hmeresAstheneias.value)
            ));
        }
                
        await calcMiktesApodoxes();
        if (!isEmployeeLoadPipelineActive()) {
            await handleSynoloMiktonChange();
        }
    }

    async function calcSynoloAsfalistikhsAxias() {
        if (hasRecord) return;

        let synolo_asfalistikhs_axias;
        let synoloAsfalistikhsAxias = document.getElementById("synoloAsfalistikhsAxias");
        if (typeof synolo_asfalistikhs_axias === "undefined") {
            synolo_asfalistikhs_axias = 0;
        }
        synolo_asfalistikhs_axias = parseFloat(
                                        parseFloat(document.getElementById("asfalistikhAxiaArgion").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaNyxtas").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaYperergasias").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaYperergasiasNyxtas").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaYperergasiasArgion").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaYperergasiasArgionNyxtas").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaNomimhsYperorias").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaNomimhsYperoriasArgion").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaNomimhsYperoriasNyxtas").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaNomimhsYperoriasArgionNyxtas").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaParanomhsYperorias").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaParanomhsYperoriasArgion").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaParanomhsYperoriasNyxtas").value) +
                                        parseFloat(document.getElementById("asfalistikhAxiaParanomhsYperoriasArgionNyxtas").value)
                                    ).toFixed(2);
    
    
        synoloAsfalistikhsAxias.value = parseFloat(synolo_asfalistikhs_axias).toFixed(2);
    }

    async function calcAxiaArgion() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΑΡΓΙΩΝ
        if (hasRecord) return;

        let oresArgion = parseFloat(document.getElementById("oresArgion").value) || 0;
        const axiaArgion = document.getElementById("axiaArgion");
        const asfalistikhAxiaArgion = document.getElementById("asfalistikhAxiaArgion");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[11].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[11].timh) / 100;

        // Έλεγχος για το εάν τα πεδία υπάρχουν και αποφυγή σφαλμάτων
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio?.value || 0) : parseFloat(pragmatikoOromisthio?.value || 0);

        // Έλεγχος αν η εταιρεία πληρώνει προσαυξήσεις με πραγματικό ωρομίσθιο αντί για νόμινο
        if (sharedParams.etaireia.ypologismos_epi_pragmatikoy_oromisthioy) {
            oromisthio = parseFloat(pragmatikoOromisthio?.value || 0);
        }

        // Τελικός Υπολογισμός
        let axia = oromisthio * timhPercent * oresArgion || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia : 0;
        let asfalistikhAxia = prosayxhsh;

        // Ενημέρωση πεδίων
        axiaArgion.value = axia.toFixed(2);
        asfalistikhAxiaArgion.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaNyxterinon() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΝΥΧΤΕΡΙΝΩΝ
        if (hasRecord) return;

        let oresNyxtas = parseFloat(document.getElementById("oresNyxtas").value) || 0;
        let axiaNyxtas = document.getElementById("axiaNyxtas");
        let asfalistikhAxiaNyxtas =document.getElementById("asfalistikhAxiaNyxtas") ;
        
        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[10].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[10].timh) / 100;
        
        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio?.value || 0) : parseFloat(pragmatikoOromisthio?.value || 0);
        
        // Έλεγχος αν η εταιρεία πληρώνει προσαυξήσεις με πραγματικό ωρομίσθιο αντί για νόμινο
        if (sharedParams.etaireia.ypologismos_epi_pragmatikoy_oromisthioy) {
            oromisthio = parseFloat(pragmatikoOromisthio?.value || 0);
        }

        if (sharedParams.ergazomenoi.eidikh_kathgoria_ergazomenoy !== "0017") {  // Αποκλειστικά Νυχτερινή Εργασία
            // Τελικός Υπολογισμός
            let axia = oromisthio * timhPercent * oresNyxtas || 0;
            let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia : 0;
            let asfalistikhAxia = prosayxhsh;

            // Ενημέρωση πεδίων
            axiaNyxtas.value = axia.toFixed(2);
            asfalistikhAxiaNyxtas.value =  asfalistikhAxia.toFixed(2);
        } else {
            if (parseFloat(sharedParams.ergazomenoi.pragmatikosMisthos) > parseFloat(sharedParams.ergazomenoi.nomimosMisthos)) {
                let pososto_yperbashs_pragmatikoy_misthoy = parseFloat((parseFloat(sharedParams.ergazomenoi.pragmatikosMisthos) - parseFloat(sharedParams.ergazomenoi.nomimosMisthos)) / parseFloat(sharedParams.ergazomenoi.nomimosMisthos)).toFixed(4);

                let neo_pososto_nyxterinon = parseFloat(pososto_yperbashs_pragmatikoy_misthoy) >= timhPercent ? timhPercent : parseFloat(timhPercent - parseFloat(pososto_yperbashs_pragmatikoy_misthoy)).toFixed(4);

                let axia = oromisthio * parseFloat(neo_pososto_nyxterinon) * oresNyxtas || 0;
                let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia : 0;
                let asfalistikhAxia = prosayxhsh;
    
                // Ενημέρωση πεδίων
                axiaNyxtas.value = axia.toFixed(2);
                asfalistikhAxiaNyxtas.value =  asfalistikhAxia.toFixed(2);
            } else {
                // Τελικός Υπολογισμός
                let axia = oromisthio * timhPercent * oresNyxtas || 0;
                let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia : 0;
                let asfalistikhAxia = prosayxhsh;

                // Ενημέρωση πεδίων
                axiaNyxtas.value = axia.toFixed(2);
                asfalistikhAxiaNyxtas.value =  asfalistikhAxia.toFixed(2);
            }
        }

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaYperergasion() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΥΠΕΡΕΡΓΑΣΙΩΝ
        if (hasRecord) return;

        let oresYperergasias = parseFloat(document.getElementById("oresYperergasias").value);
        let axiaYperergasias = document.getElementById("axiaYperergasias");
        let asfalistikhAxiaYperergasias = document.getElementById("asfalistikhAxiaYperergasias");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[12].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[12].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let axia = (oromisthio + (oromisthio * timhPercent)) * oresYperergasias || 0;
        let axia1 = oromisthio * oresYperergasias;
        let prosayxhsh = sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaYperergasias.value = axia.toFixed(2);
        asfalistikhAxiaYperergasias.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaYperergasionNyxtas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΥΠΕΡΕΡΓΑΣΙΩΝ ΝΥΧΤΑΣ
        if (hasRecord) return;

        let oresYperergasiasNyxtas = parseFloat(document.getElementById("oresYperergasiasNyxtas").value);
        let axiaYperergasiasNyxtas = document.getElementById("axiaYperergasiasNyxtas");
        let asfalistikhAxiaYperergasiasnNyxtas = document.getElementById("asfalistikhAxiaYperergasiasNyxtas");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[12].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[12].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[10].ypologismos;   // % Προσάυξησης Νύχτας
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[10].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_nyxtas = oromisthio1 * timhPercent1;
        let oromisthio_nyxtas = oromisthio + prosayxhsh_nyxtas;
        let axia = (oromisthio_nyxtas + (oromisthio_nyxtas * timhPercent)) * oresYperergasiasNyxtas || 0;
        let axia1 = oromisthio1 * oresYperergasiasNyxtas || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh;

        // Ενημέρωση πεδίου
        axiaYperergasiasNyxtas.value = axia.toFixed(2);
        asfalistikhAxiaYperergasiasnNyxtas.value = asfalistikhAxia.toFixed(2);
        
        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaYperergasionArgion() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΥΠΕΡΕΡΓΑΣΙΩΝ ΑΡΓΙΩΝ
        if (hasRecord) return;

        let oresYperergasiasArgion = parseFloat(document.getElementById("oresYperergasiasArgion").value);
        let axiaYperergasiasArgion = document.getElementById("axiaYperergasiasArgion");
        let asfalistikhAxiaYperergasiasArgion = document.getElementById("asfalistikhAxiaYperergasiasArgion");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[12].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[12].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[11].ypologismos;   // % Προσάυξησης Αργιών
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[11].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_argion = oromisthio1 * timhPercent1;
        let oromisthio_argion = oromisthio + prosayxhsh_argion;
        let axia = (oromisthio_argion + (oromisthio_argion * timhPercent)) * oresYperergasiasArgion || 0;
        let axia1 = oromisthio1 * oresYperergasiasArgion || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh;

        // Ενημέρωση πεδίου
        axiaYperergasiasArgion.value = axia.toFixed(2);
        asfalistikhAxiaYperergasiasArgion.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaYperergasionArgionNyxtas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΥΠΕΡΕΡΓΑΣΙΩΝ ΑΡΓΙΩΝ ΝΥΧΤΑΣ
        if (hasRecord) return;

        let oresYperergasiasArgionNyxtas = parseFloat(document.getElementById("oresYperergasiasArgionNyxtas").value);
        let axiaYperergasiasArgionNyxtas = document.getElementById("axiaYperergasiasArgionNyxtas");
        let asfalistikhAxiaYperergasiasArgionNyxtas = document.getElementById("asfalistikhAxiaYperergasiasArgionNyxtas");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[12].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[12].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[11].ypologismos;
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[11].timh) / 100;   // % Προσάυξησης Αργιών
        let ypologismos2 = sharedParams.genikesParametroi[10].ypologismos;
        let timhPercent2 = parseFloat(sharedParams.genikesParametroi[10].timh) / 100;   // % Προσάυξησης Νύχτας

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio2 = ypologismos2 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_nyxtas = oromisthio2 * timhPercent2;
        let prosayxhsh_argion = oromisthio1 * timhPercent1;
        let oromisthio_argion = oromisthio + prosayxhsh_argion + prosayxhsh_nyxtas;
        let axia = (oromisthio_argion + (oromisthio_argion * timhPercent)) * oresYperergasiasArgionNyxtas || 0;
        let axia1 = oromisthio1 * oresYperergasiasArgionNyxtas || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh;

        // Ενημέρωση πεδίου
        axiaYperergasiasArgionNyxtas.value = axia.toFixed(2);
        asfalistikhAxiaYperergasiasArgionNyxtas.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaNomimonYperorion() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΝΟΜΙΜΩΝ ΥΠΕΡΩΡΙΩΝ
        if (hasRecord) return;

        let oresNomimhsYperorias = parseFloat(document.getElementById("oresNomimhsYperorias").value);
        let axiaNomimhsYperorias = document.getElementById("axiaNomimhsYperorias");
        let asfalistikhAxiaNomimhsYperorias = document.getElementById("asfalistikhAxiaNomimhsYperorias");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[14].ypologismos;
        if (document.getElementById("orioYperorion_Hidden").value > parseFloat(sharedParams.genikesParametroi[13].timh)) {
            message = `
            <p class="bold-text">Προσοχή !!! Υπέρβαση Υπερωριών</p>
            <p>&nbsp;</p>
            <p>Ο/Η εργαζόμενος/η έχει υπερβεί το όριο των ετήσιων ωρών των υπερωριών. Οι ώρες που είναι μεγαλύτερες του ορίου των ${sharedParams.genikesParametroi[13].timh} ωρών <strong>θεωρούνται</strong> παράνομες</p>`
            showAlert(message);
        }
        let timhPercent = parseFloat(sharedParams.genikesParametroi[14].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let axia = (oromisthio + (oromisthio * timhPercent)) * oresNomimhsYperorias || 0;
        let axia1 = oromisthio * oresNomimhsYperorias;
        let prosayxhsh = sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaNomimhsYperorias.value = axia.toFixed(2);
        asfalistikhAxiaNomimhsYperorias.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaNomimonYperorionArgion() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΝΟΜΙΜΩΝ ΥΠΕΡΩΡΙΩΝ ΑΡΓΙΩΝ
        if (hasRecord) return;

        let oresNomimhsYperoriasArgion = parseFloat(document.getElementById("oresNomimhsYperoriasArgion").value);
        let axiaNomimhsYperoriasArgion = document.getElementById("axiaNomimhsYperoriasArgion");
        let asfalistikhAxiaNomimhsYperoriasArgion = document.getElementById("asfalistikhAxiaNomimhsYperoriasArgion");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[14].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[14].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[11].ypologismos;   // % Προσάυξησης Αργιών
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[11].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_argion = oromisthio1 * timhPercent1;
        let oromisthio_argion = oromisthio + prosayxhsh_argion;
        let axia = (oromisthio_argion + (oromisthio_argion * timhPercent)) * oresNomimhsYperoriasArgion || 0;
        let axia1 = oromisthio * oresNomimhsYperoriasArgion || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaNomimhsYperoriasArgion.value = axia.toFixed(2) ;
        asfalistikhAxiaNomimhsYperoriasArgion.value = asfalistikhAxia.toFixed(2) ;
        
        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaNomimonYperorionNyxtas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΝΟΜΙΜΩΝ ΥΠΕΡΩΡΙΩΝ ΝΥΧΤΑΣ
        if (hasRecord) return;

        let oresNomimhsYperoriasNyxtas = parseFloat(document.getElementById("oresNomimhsYperoriasNyxtas").value);
        let axiaNomimhsYperoriasNyxtas = document.getElementById("axiaNomimhsYperoriasNyxtas");
        let asfalistikhAxiaNomimhsYperoriasNyxtas = document.getElementById("asfalistikhAxiaNomimhsYperoriasNyxtas");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[14].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[14].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[10].ypologismos;   // % Προσάυξησης Νύχτας
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[10].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_nyxtas = oromisthio1 * timhPercent1;
        let oromisthio_nyxtas = oromisthio + prosayxhsh_nyxtas;
        let axia = (oromisthio_nyxtas + (oromisthio_nyxtas * timhPercent)) * oresNomimhsYperoriasNyxtas || 0;
        let axia1 = oromisthio * oresNomimhsYperoriasArgion || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaNomimhsYperoriasNyxtas.value = axia.toFixed(2);
        asfalistikhAxiaNomimhsYperoriasNyxtas.value = asfalistikhAxia.toFixed(2) ;

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaNomimonYperorionArgionNyxtas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΝΟΜΙΜΩΝ ΥΠΕΡΩΡΙΩΝ ΑΡΓΙΩΝ ΝΥΧΤΑΣ
        if (hasRecord) return;

        let oresNomimhsYperoriasArgionNyxtas = parseFloat(document.getElementById("oresNomimhsYperoriasArgionNyxtas").value);
        let axiaNomimhsYperoriasArgionNyxtas = document.getElementById("axiaNomimhsYperoriasArgionNyxtas");
        let asfalistikhAxiaNomimhsYperoriasArgionNyxtas = document.getElementById("asfalistikhAxiaNomimhsYperoriasArgionNyxtas");
        
        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[14].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[14].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[11].ypologismos;
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[11].timh) / 100;   // % Προσάυξησης Αργιών
        let ypologismos2 = sharedParams.genikesParametroi[10].ypologismos;
        let timhPercent2 = parseFloat(sharedParams.genikesParametroi[10].timh) / 100;   // % Προσάυξησης Νύχτας

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio2 = ypologismos2 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_nyxtas = oromisthio2 * timhPercent2;
        let prosayxhsh_argion = oromisthio1 * timhPercent1;
        let oromisthio_argion = oromisthio + prosayxhsh_argion + prosayxhsh_nyxtas;
        let axia = (oromisthio_argion + (oromisthio_argion * timhPercent)) * oresNomimhsYperoriasArgionNyxtas || 0;
        let axia1 = oromisthio * oresNomimhsYperoriasArgionNyxtas || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaNomimhsYperoriasArgionNyxtas.value = axia.toFixed(2);
        asfalistikhAxiaNomimhsYperoriasArgionNyxtas.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaParanomonYperorion() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΠΑΡΑΝΟΜΩΝ ΥΠΕΡΩΡΙΩΝ
        if (hasRecord) return;

        let oresParanomhsYperorias = parseFloat(document.getElementById("oresParanomhsYperorias").value);
        let axiaParanomhsYperorias = document.getElementById("axiaParanomhsYperorias");
        let asfalistikhAxiaParanomhsYperorias = document.getElementById("asfalistikhAxiaParanomhsYperorias");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[15].ypologismos;
        if (document.getElementById("orioYperorion_Hidden").value > parseFloat(sharedParams.genikesParametroi[13].timh)) {
            message = `
            <p class="bold-text">Προσοχή !!! Υπέρβαση Υπερωριών</p>
            <p style="margin-top: 3rem;">Ο/Η εργαζόμενος/η έχει υπερβεί το όριο των ετήσιων ωρών των υπερωριών. Οι ώρες που είναι μεγαλύτερες του ορίου των ${sharedParams.genikesParametroi[13].timh} ωρών <strong>θεωρούνται</strong> παράνομες</p>`
            showAlert(message);
        }
        let timhPercent = parseFloat(sharedParams.genikesParametroi[15].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let axia = (oromisthio + (oromisthio * timhPercent)) * oresParanomhsYperorias || 0;
        let axia1 = oromisthio * oresParanomhsYperorias || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaParanomhsYperorias.value = axia.toFixed(2);
        asfalistikhAxiaParanomhsYperorias.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaParanomonYperorionArgion() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΠΑΡΑΝΟΜΩΝ ΥΠΕΡΩΡΙΩΝ ΑΡΓΙΩΝ
        let oresParanomhsYperoriasArgion = parseFloat(document.getElementById("oresParanomhsYperoriasArgion").value);
        let axiaParanomhsYperoriasArgion = document.getElementById("axiaParanomhsYperoriasArgion");
        let asfalistikhAxiaParanomhsYperoriasArgion = document.getElementById("asfalistikhAxiaParanomhsYperoriasArgion");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[15].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[15].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[11].ypologismos;   // % Προσάυξησης Αργιών
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[11].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_argion = oromisthio1 * timhPercent1;
        let oromisthio_argion = oromisthio + prosayxhsh_argion;
        let axia = (oromisthio_argion + (oromisthio_argion * timhPercent)) * oresParanomhsYperoriasArgion || 0;
        let axia1 = oromisthio * oresParanomhsYperoriasArgion || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaParanomhsYperoriasArgion.value = axia.toFixed(2) ;
        asfalistikhAxiaParanomhsYperoriasArgion.value = asfalistikhAxia.toFixed(2) ;

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaParanomonYperorionNyxtas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΠΑΡΑΝΟΜΩΝ ΥΠΕΡΩΡΙΩΝ ΝΥΧΤΑΣ
        if (hasRecord) return;

        let oresParanomhsYperoriasNyxtas = parseFloat(document.getElementById("oresParanomhsYperoriasNyxtas").value);
        let axiaParanomhsYperoriasNyxtas = document.getElementById("axiaParanomhsYperoriasNyxtas");
        let asfalistikhAxiaParanomhsYperoriasNyxtas = document.getElementById("asfalistikhAxiaParanomhsYperoriasNyxtas");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[14].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[14].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[10].ypologismos;   // % Προσάυξησης Νύχτας
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[10].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_nyxtas = oromisthio1 * timhPercent1;
        let oromisthio_nyxtas = oromisthio + prosayxhsh_nyxtas;
        let axia = (oromisthio_nyxtas + (oromisthio_nyxtas * timhPercent)) * oresParanomhsYperoriasNyxtas || 0;
        let axia1 = oromisthio * oresParanomhsYperoriasNyxtas || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaParanomhsYperoriasNyxtas.value = axia.toFixed(2);
        asfalistikhAxiaParanomhsYperoriasNyxtas.value = asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaParanomonYperorionArgionNyxtas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΝΟΜΙΜΩΝ ΥΠΕΡΩΡΙΩΝ ΑΡΓΙΩΝ ΝΥΧΤΑΣ
        if (hasRecord) return;

        let oresParanomhsYperoriasArgionNyxtas = parseFloat(document.getElementById("oresParanomhsYperoriasArgionNyxtas").value);
        let axiaParanomhsYperoriasArgionNyxtas = document.getElementById("axiaParanomhsYperoriasArgionNyxtas");
        let asfalistikhAxiaParanomhsYperoriasArgionNyxtas = document.getElementById("asfalistikhAxiaParanomhsYperoriasArgionNyxtas");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[14].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[14].timh) / 100;
        let ypologismos1 = sharedParams.genikesParametroi[11].ypologismos;
        let timhPercent1 = parseFloat(sharedParams.genikesParametroi[11].timh) / 100;   // % Προσάυξησης Αργιών
        let ypologismos2 = sharedParams.genikesParametroi[10].ypologismos;
        let timhPercent2 = parseFloat(sharedParams.genikesParametroi[10].timh) / 100;   // % Προσάυξησης Νύχτας

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio1 = ypologismos1 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);
        let oromisthio2 = ypologismos2 !== "Π" ? parseFloat(nomimoOromisthio.value) : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let prosayxhsh_nyxtas = oromisthio2 * timhPercent2;
        let prosayxhsh_argion = oromisthio1 * timhPercent1;
        let oromisthio_argion = oromisthio + prosayxhsh_argion + prosayxhsh_nyxtas;
        let axia = (oromisthio_argion + (oromisthio_argion * timhPercent)) * oresParanomhsYperoriasArgionNyxtas || 0;
        let axia1 = oromisthio * oresParanomhsYperoriasArgionNyxtas || 0;
        let prosayxhsh = (sharedParams.ergazomenoi.plhrhs_apasxolhsh && sharedParams.ergazomenoi.karta_ergasias) ? axia - axia1 || 0 : 0;
        let asfalistikhAxia = prosayxhsh || 0;

        // Ενημέρωση πεδίου
        axiaParanomhsYperoriasArgionNyxtas.value = axia.toFixed(2);
        asfalistikhAxiaParanomhsYperoriasArgionNyxtas.value =asfalistikhAxia.toFixed(2);

        await finishValueCalculation({ includeAsfalistikhAxia: true });
    }

    async function calcAxiaErgasias6Hmeras() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΕΡΓΑΣΙΑΣ 6ης ΗΜΕΡΑΣ
        if (hasRecord) return;

        let oresErgasias6Hmeras = parseFloat(document.getElementById("oresErgasias6Hmeras").value);
        let axiaErgasias6Hmeras = document.getElementById("axiaErgasias6Hmeras");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[16].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[16].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" 
            ? parseFloat(nomimoOromisthio.value)
            : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let axia = (oromisthio + (oromisthio * timhPercent)) * oresErgasias6Hmeras || 0;

        // Ενημέρωση πεδίου
        axiaErgasias6Hmeras.value = axia.toFixed(2);
        await finishValueCalculation();
    }
    
    async function calcAxiaProsthethsErgasias() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΠΡΟΣΘΕΤΗΣ ΕΡΓΑΣΙΑΣ ΜΕΡΙΚΩΣ ΑΠΑΣΧΟΛΟΥΜΕΝΩΝ
        if (hasRecord) return;

        let oresProsthethsErgasias = parseFloat(document.getElementById("oresProsthethsErgasias").value);
        let axiaProsthethsErgasias = document.getElementById("axiaProsthethsErgasias");

        // Λήψη παραμέτρων
        let ypologismos = sharedParams.genikesParametroi[17].ypologismos;
        let timhPercent = parseFloat(sharedParams.genikesParametroi[17].timh) / 100;

        // Υπολογισμός βάσει τύπου
        let oromisthio = ypologismos !== "Π" 
            ? parseFloat(nomimoOromisthio.value)
            : parseFloat(pragmatikoOromisthio.value);

        // Τελικός Υπολογισμός
        let axia = (oromisthio + (oromisthio * timhPercent)) * oresProsthethsErgasias || 0;

        // Ενημέρωση πεδίου
        axiaProsthethsErgasias.value = axia.toFixed(2);
        await finishValueCalculation();
    }

    async function calcAxiaMeioshsErgatikhsEisforas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΜΕΙΩΣΗΣ ΕΡΓΑΤΙΚΗΣ ΕΙΣΦΟΡΑΣ
        if (hasRecord) return;

        if (
            sharedParams.ergazomenoi.kathestos_apasxolhshs !== "0" ||
            !sharedParams.ergazomenoi.meiosh_eisforon_ergazomenon ||
            sharedParams.ergazomenoi.symbash !== sharedParams.genikesParametroi[21].timh
        ) {
            document.getElementById("meioshErgatikhsEisforas").value = "0.00";
            return;
        }
    
        const timhPercent = parseFloat(sharedParams.genikesParametroi[20].timh) / 100;
        let poso = 0;
    
        if (sharedParams.ergazomenoi.typos_ergazomenon === "Μ") {
            const axia = parseFloat(sharedParams.ergazomenoi.nomimosMisthos);
            poso = axia * timhPercent;
        } else {
            const axia = parseFloat(sharedParams.ergazomenoi.nomimosHmeromisthio);
            const hmeresErgasias = parseFloat(document.getElementById("hmeresErgasias").value);
            poso = axia * timhPercent * hmeresErgasias;
        }
    
        const meioshField = document.getElementById("meioshErgatikhsEisforas");
        meioshField.value = poso.toFixed(2);
    
        // Αποθηκεύστε την υπολογισμένη τιμή στο dataset για παρακολούθηση αλλαγών
        meioshField.dataset.initialValue = poso.toFixed(2);
    }

    async function taktikesApodoxesMhYpologizomenesSeDora() {  // ΤΑΚΤΙΚΕΣ ΑΠΟΔΟΧΕΣ ΜΗ ΥΠΟΛΟΓΙΖΟΜΕΝΕΣ ΣΕ ΔΩΡΑ
        if (hasRecord) return;

        await finishValueCalculation();
    }

    async function sympsifisteesApodoxes() {  // ΤΑΚΤΙΚΕΣ ΑΠΟΔΟΧΕΣ ΜΗ ΥΠΟΛΟΓΙΖΟΜΕΝΕΣ ΣΕ ΔΩΡΑ
        if (hasRecord) return;

        await finishValueCalculation();
    }

    async function taktikesApodoxesYpologizomenesSeDora() {  // ΤΑΚΤΙΚΕΣ ΑΠΟΔΟΧΕΣ ΥΠΟΛΟΓΙΖΟΜΕΝΕΣ ΣΕ ΔΩΡΑ
        if (hasRecord) return;

        await finishValueCalculation();
    }

    async function epimerizomenesSeMhnesErgasias() {  // ΕΚΤΑΚΤΕΣ ΑΠΟΔΟΧΕΣ ΕΠΙΜΕΡΙΖΟΜΕΝΣ ΣΕ ΣΤΟΥΣ ΜΗΝΕΣ ΕΡΓΑΣΙΑΣ
        if (hasRecord) return;

        await finishValueCalculation();
    }

    async function primBonus() {  // ΕΚΤΑΚΤΑ ΠΡΙΜ / BONUS
        if (hasRecord) return;

        await finishValueCalculation();
    }

    async function apallassomenesForoy() {  // ΕΚΤΑΚΤΕΣ ΑΠΟΔΟΧΕΣ ΑΠΑΛΑΣΣΟΜΕΝΕΣ ΤΟΥ ΦΟΡΟΥ
        if (hasRecord) return;

        const isValid = await validateFields();
        if (isValid) {
            await finishValueCalculation();
        }
    }

    async function apallassomenesKrathseon() {  // ΕΚΤΑΚΤΕΣ ΑΠΟΔΟΧΕΣ ΑΠΑΛΑΣΣΟΜΕΝΕΣ ΤΩΝ ΚΡΑΤΗΣΕΩΝ
        if (hasRecord) return;

        await finishValueCalculation();
    }

    async function synoloForoy() {  // ΑΛΛΑΓΗ ΥΠΟΛΟΓΙΣΜΕΝΟΥ ΠΟΣΟΥ ΦΟΡΟΥ
        if (hasRecord) return;

        allaghForoy = true;
        await calcPlhroteo();
    }

    async function validateFields() {  // ΕΛΕΓΧΟΣ ΑΝ ΕΧΕΙΣ ΔΟΘΕΙ ΠΟΣΟ ΠΡΩΤΑ ΣΤΙΣ ΑΠΑΛΛΑΣΣΟΜΕΝΕΣ ΤΩΝ ΚΡΑΤΗΣΕΩΝ ΚΑΙ ΜΕΤΑ ΤΟΥ ΦΟΡΟΥ
        const field1 = document.getElementById('apallassomenesForoy');
        const field2 = document.getElementById('apallassomenesKrathseon');
    
        if (parseFloat(field2.value) !== 0) {
            // 1) Απενεργοποιούμε προσωρινά το blur στο field1
            skipBlurForField1 = true;

            // 2) Αφαιρούμε το focus (αλλά "φρενάρουμε" το blur-logic)
            field1.blur();

            // 3) Φτιάχνουμε το μήνυμα
            const message = `
                <p class="bold-text">Προσοχή !!! Περιορισμός της Εφαρμογής</p>
                <p>&nbsp;</p>
                <p>Για να έχετε <strong>σωστούς υπολογισμούς</strong> Φόρου και κρατήσεων, πρέπει <strong>πρώτα</strong> να δώσετε τις Απαλλασσόμενες του Φόρου αποδοχές και <strong>μετά</strong> τις Απαλλασσόμενες των Κρατήσεων</p>
            `;

            // 4) Εμφανίζουμε το modal
            await showAlert(message, () => {
                field2.value = 0;
                field1.value = 0;
                // 5) Μόλις κλείσει το modal, ξανα-ενεργοποιούμε το blur
                skipBlurForField1 = false;

                // Αν θες ξανά focus στο field1 ή σε άλλο πεδίο, π.χ.:
                setTimeout(() => {
                    field1.focus();
                }, 0); 
            });
            
            return false; // Επιστροφή false μετά το modal
        }
    
        return true; // Επιστροφή true αν δεν υπάρχει πρόβλημα
    }
    
    exoflhsh.addEventListener("change", async () => {   // EΝΗΜΕΡΩΣΗ ΤΟΥ ΠΟΣΟΥ ΠΛΗΡΩΜΗΣ 
        if (hasRecord) return;

        let selectedValue = exoflhsh.value;
        switch(selectedValue) {
            case "0":
                document.getElementById("poso_plhromhs").value = parseFloat(document.getElementById("plhroteo").value) || 0;
                document.getElementById("exoflhsh_Hidden").value = "0";
                document.getElementById("poso_plhromhs_Hidden").value = parseFloat(document.getElementById("plhroteo").value) || 0;
                document.getElementById("poso_plhromhs").focus();
                break;
            case "1":
                document.getElementById("poso_plhromhs").value = 0;
                document.getElementById("exoflhsh_Hidden").value = "1";
                document.getElementById("poso_plhromhs_Hidden").value = 0;
                document.getElementById("poso_plhromhs").focus();
                break;
            case "2":
                document.getElementById("poso_plhromhs").focus();
                document.getElementById("exoflhsh_Hidden").value = "2";
                break;
            default:
                document.getElementById("exoflhsh_Hidden").value = null;
                document.getElementById("poso_plhromhs").focus();
                return;
        }
    })

    posoPlhromhs.addEventListener("blur", async () => {
        document.getElementById("poso_plhromhs_Hidden").value = parseFloat(document.getElementById("poso_plhromhs").value);
    })

    document.getElementById("meioshErgatikhsEisforas").addEventListener("input", (event) => {   // ΜΕΙΩΣΗ ΕΡΓΑΤΙΚΗΣ ΕΙΣΦΟΡΑΣ
        if (hasRecord) return;

        const meioshField = event.target;
    
        // Αποθήκευση θέσης δρομέα πριν την ενημέρωση της τιμής
        const cursorPosition = meioshField.selectionStart;
    
        // Εισαγωγή νέας τιμής από τον χρήστη
        const newValue = meioshField.value;
    
        // Έλεγχος αν η τιμή είναι έγκυρος αριθμός
        if (isNaN(parseFloat(newValue)) && newValue !== "") {
        // Αν δεν είναι αριθμός, διατηρεί την προηγούμενη τιμή
        meioshField.value = meioshField.dataset.initialValue;
        meioshField.setSelectionRange(cursorPosition, cursorPosition);
        return;
        }
    
        // Ενημέρωση dataset με την μη μορφοποιημένη τιμή
        meioshField.dataset.initialValue = newValue;
    
        // Επαναφορά της θέσης του δρομέα
        meioshField.setSelectionRange(cursorPosition, cursorPosition);
    });
    
    // EventListener για το "blur" για να μορφοποιούμε την τιμή όταν ο χρήστης ολοκληρώνει την εισαγωγή
    document.getElementById("meioshErgatikhsEisforas").addEventListener("blur", (event) => {
        const meioshField = event.target;
    
        // Αν η τιμή είναι έγκυρη, μορφοποιούμε τη νέα τιμή
        const newValue = parseFloat(meioshField.value);
        if (!isNaN(newValue)) {
        meioshField.value = newValue.toFixed(2);
        meioshField.dataset.initialValue = meioshField.value;
        }
    });
    
    async function calcAxiaEpidothshsErgodotikhsEisforas() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΑΞΙΑΣ ΕΠΙΔΟΤΗΣΗΣ ΕΡΓΟΔΟΤΙΚΗΣ ΕΙΣΦΟΡΑΣ (ΕΡΓΑΖΟΜΕΝΟΙ < 25 ΕΤΩΝ)
        if (hasRecord) return;

        if (!sharedParams.ergazomenoi.hmeromhnia_gennhshs || !sharedParams.ergazomenoi.epidothsh_eisforon_ergodoth) {
            document.getElementById("epidothshErgodotikhsEisforas").value = "0.00";
            return
        }
        var hmeromhniaGennhshs = new Date(sharedParams.ergazomenoi.hmeromhnia_gennhshs);
        var today = new Date();
        var age = today.getFullYear() - hmeromhniaGennhshs.getFullYear();
        var m = today.getMonth() - hmeromhniaGennhshs.getMonth();

        if (m < 0 || (m === 0 && today.getDate() < hmeromhniaGennhshs.getDate())) {
            age--;
        }

        if (age && age < parseFloat(sharedParams.genikesParametroi[19].timh)) {
            let timhPercent = parseFloat(sharedParams.genikesParametroi[18].timh) / 100;
            document.getElementById("epidothshErgodotikhsEisforas").value = (parseFloat(document.getElementById("synoloMiktonApodoxon").value) * timhPercent).toFixed(2);
        }
    }

    // Προσθήκη Event Listener για την εμφάνιση 2 δεκαδικών όταν το πεδίο χάνει την εστίαση
    document.getElementById("epidothshErgodotikhsEisforas").addEventListener("blur", (event) => {
        const field = event.target;
        const value = parseFloat(field.value);

        if (!isNaN(value)) {
        // Μορφοποίηση με 2 δεκαδικά
        field.value = value.toFixed(2);
        } else {
        // Αν η τιμή δεν είναι αριθμός, την επαναφέρει σε "0.00"
        field.value = "0.00";
        }
    });

    async function calcSynoloAsfalistikonApodoxon() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΣΥΝΟΛΟΥ ΑΣΦΑΛΙΣΤΙΚΩΝ ΑΠΟΔΟΧΩΝ
        if (hasRecord) return;

        if (!sharedParams.ergazomenoi.asfalish_me_tekmarta) {
            document.getElementById("asfalistikes_apodoxes").value = parseFloat(
                parseFloat(document.getElementById("synoloMiktonApodoxon").value || 0) -
                // parseFloat(document.getElementById("synoloProsayxhseon").value || 0) - 
                parseFloat(document.getElementById("synoloAsfalistikhsAxias").value || 0) -
                parseFloat(document.getElementById("apallassomenesKrathseon").value || 0) 
                // + parseFloat(document.getElementById("geniko_synolo_astheneias").value || 0))
            ).toFixed(2);

            document.getElementById("asfalistikes_apodoxes_hidden").value = parseFloat(
                parseFloat(document.getElementById("synoloProsayxhseon").value || 0) + 
                parseFloat(document.getElementById("synoloMiktonApodoxon_Hidden").value || 0) - 
                parseFloat(document.getElementById("synoloAsfalistikhsAxias").value || 0) -
                (parseFloat(document.getElementById("apallassomenesKrathseon").value || 0) + 
                parseFloat(document.getElementById("geniko_synolo_astheneias").value || 0))
            ).toFixed(2);

        } else {





        }
        await ypologismosAxiasKrathseon(sharedParams);
    }

    async function calcSynoloMiktonApodoxonCore() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΣΥΝΟΛΟΥ ΜΙΚΤΩΝ ΑΠΟΔΟΧΩΝ
        if (hasRecord) return;

        let synolo_mikton_apodoxon = 0;
        let prosayxhseis = 0;

        prosayxhseis = parseFloat(
            parseFloat(document.getElementById("axiaArgion").value || 0) + 
            parseFloat(document.getElementById("axiaNyxtas").value || 0) + 
            parseFloat(document.getElementById("axiaYperergasias").value || 0) + 
            parseFloat(document.getElementById("axiaYperergasiasNyxtas").value || 0) + 
            parseFloat(document.getElementById("axiaYperergasiasArgion").value || 0) + 
            parseFloat(document.getElementById("axiaYperergasiasArgionNyxtas").value || 0) +
            parseFloat(document.getElementById("axiaNomimhsYperorias").value || 0) + 
            parseFloat(document.getElementById("axiaNomimhsYperoriasNyxtas").value || 0) + 
            parseFloat(document.getElementById("axiaNomimhsYperoriasArgion").value || 0) + 
            parseFloat(document.getElementById("axiaNomimhsYperoriasArgionNyxtas").value || 0) +
            parseFloat(document.getElementById("axiaParanomhsYperorias").value || 0) + 
            parseFloat(document.getElementById("axiaParanomhsYperoriasNyxtas").value || 0) + 
            parseFloat(document.getElementById("axiaParanomhsYperoriasArgion").value || 0) + 
            parseFloat(document.getElementById("axiaParanomhsYperoriasArgionNyxtas").value || 0) +
            parseFloat(document.getElementById("axiaErgasias6Hmeras").value || 0) +
            parseFloat(document.getElementById("axiaProsthethsErgasias").value || 0)).toFixed(2);

        document.getElementById("synoloProsayxhseon").value = prosayxhseis;

        synolo_mikton_apodoxon = 
            parseFloat(document.getElementById("synoloMiktonApodoxon_Hidden").value || 0) + 
            parseFloat(_APODOXES_ORON_ERGASIAS || 0) -
            parseFloat(_APODOXES_ORON_APOYSIAS || 0) + 
            parseFloat(document.getElementById("synoloProsayxhseon").value || 0) + 
            parseFloat(document.getElementById("axiaParanomhsYperoriasArgionNyxtas").value || 0) +
            parseFloat(document.getElementById("axiaErgasias6Hmeras").value || 0) +
            parseFloat(document.getElementById("axiaProsthethsErgasias").value || 0) +
            parseFloat(document.getElementById("taktikesApodoxesMhYpologizomenesSeDora").value || 0) +
            parseFloat(document.getElementById("taktikesApodoxesYpologizomenesSeDora").value || 0) +
            parseFloat(document.getElementById("sympsifisteesApodoxes").value || 0) +
            parseFloat(document.getElementById("epimerizomenesSeMhnesErgasias").value || 0) +
            parseFloat(document.getElementById("primBonus").value || 0) +
            parseFloat(document.getElementById("apallassomenesForoy").value || 0) +
            parseFloat(document.getElementById("apallassomenesKrathseon").value || 0) -
            parseFloat(document.getElementById("geniko_synolo_astheneias").value || 0);
    
        document.getElementById("synoloMiktonApodoxon").value = synolo_mikton_apodoxon.toFixed(2);

        await calcSynoloAsfalistikonApodoxon();
        await calcAxiaMeioshsErgatikhsEisforas();
        await calcAxiaEpidothshsErgodotikhsEisforas(); 

        document.getElementById("neoPragmatikoHmeromisthio").value = parseFloat(document.getElementById("hmeresAsfalishs").value) === 0 ? parseFloat(synolo_mikton_apodoxon) : (parseFloat(parseFloat(synolo_mikton_apodoxon) / parseFloat(document.getElementById("hmeresAsfalishs").value)) || 0).toFixed(4);

        document.getElementById("synoloTaktikaKataballomenonApodoxon").value = parseFloat(
            parseFloat(document.getElementById("taktikesApodoxesMhYpologizomenesSeDora").value || 0) +
            parseFloat(document.getElementById("taktikesApodoxesYpologizomenesSeDora").value || 0) +
            parseFloat(document.getElementById("sympsifisteesApodoxes").value || 0)).toFixed(2);

        document.getElementById("synoloEktaktaKataballomenonApodoxon").value = parseFloat(
            parseFloat(document.getElementById("epimerizomenesSeMhnesErgasias").value || 0) +
            parseFloat(document.getElementById("primBonus").value || 0) +
            parseFloat(document.getElementById("apallassomenesForoy").value || 0) +
            parseFloat(document.getElementById("apallassomenesKrathseon").value || 0)).toFixed(2);
    }

    calcSynoloMiktonApodoxonCoreRef = calcSynoloMiktonApodoxonCore;

    async function calcSynoloMiktonApodoxon() {
        return runCalcSynoloMiktonApodoxonCoalesced();
    }
        
    async function recalculateAllHourValuesForEmployeeLoad() {
        // Βήμα Γ pipeline: υπολογισμός αξιών ωρών με τις υπάρχουσες συναρτήσεις.
        // Το finishValueCalculation() επιστρέφει όσο είναι ενεργό το pipeline, άρα
        // οι παρακάτω κλήσεις ενημερώνουν αξίες χωρίς να ξεκινούν κρατήσεις/φόρο κάθε φορά.
        await calcOresErgasias();
        _APODOXES_ORON_APOYSIAS = safeNumber(document.getElementById("oresApoysias")?.value) * safeNumber(pragmatikoOromisthio?.value);

        await calcAxiaArgion();
        await calcAxiaNyxterinon();
        await calcAxiaYperergasion();
        await calcAxiaYperergasionNyxtas();
        await calcAxiaYperergasionArgion();
        await calcAxiaYperergasionArgionNyxtas();
        await calcAxiaNomimonYperorion();
        await calcAxiaNomimonYperorionArgion();
        await calcAxiaNomimonYperorionNyxtas();
        await calcAxiaNomimonYperorionArgionNyxtas();
        await calcAxiaParanomonYperorion();
        await calcAxiaParanomonYperorionArgion();
        await calcAxiaParanomonYperorionNyxtas();
        await calcAxiaParanomonYperorionArgionNyxtas();
        await calcAxiaErgasias6Hmeras();
        await calcAxiaProsthethsErgasias();
        await calcSynoloAsfalistikhsAxias();
    }

    window.recalculateApasxolhseisAfterEmployeeLoad = async function(options = {}) {
        if (hasRecord) return;

        const previousPipeline = window.apasxolhseisEmployeeLoadPipeline;
        const previousSuppress = window.apasxolhseisSuppressFieldEvents;

        window.apasxolhseisEmployeeLoadPipeline = true;
        window.apasxolhseisSuppressFieldEvents = true;

        try {
            // Α) Αν χρειάζεται, υπολογίζουμε ημέρες/ώρες εργασίας χωρίς change cascade.
            if (options.runHmeresErgasias !== false) {
                await runHmeresErgasiasCalculationCore();
            }

            // Β-Γ) Ώρες από ProdhlomenaOrariaModel υπάρχουν ήδη στα πεδία.
            // Υπολογίζουμε όλες τις αξίες ωρών με τις ίδιες υπάρχουσες συναρτήσεις.
            await recalculateAllHourValuesForEmployeeLoad();

            // Δ) Μικτά.
            await calcSynoloMiktonApodoxonCore();

            // Ε) Κρατήσεις. Καλούμε το core απευθείας για να μη μπει στο debounce/coalescing.
            if (typeof handleSynoloMiktonChangeCoreRef === 'function') {
                await handleSynoloMiktonChangeCoreRef();
            } else {
                await runHandleSynoloMiktonChangeCoalesced();
            }

            // ΣΤ) Φόρος + Πληρωτέο. Καλούμε το core απευθείας ώστε το pipeline
            // να ολοκληρωθεί πραγματικά πριν κλείσει ο loader.
            await calcPlhroteoCore();

            if (calcPlhroteoTimer) {
                clearTimeout(calcPlhroteoTimer);
                calcPlhroteoTimer = null;
            }
            resolveCalcPlhroteoQueue();
        } finally {
            window.apasxolhseisEmployeeLoadPipeline = previousPipeline;
            window.apasxolhseisSuppressFieldEvents = previousSuppress;
        }
    };

    async function calcPlhroteoCore() {  // ΥΠΟΛΟΓΙΣΜΟΣ ΠΛΗΡΩΤΕΟΥ ΠΟΣΟΥ
        if (hasRecord) return;

        let ethsio_forologhteo_eisodhma = 0;
        const originalValue = document.getElementById("synoloKrathseon_I").value;
        const floatValue = safeNumber(originalValue);
        const epimerizomenesSeMhnesErgasias = document.getElementById("epimerizomenesSeMhnesErgasias").value;
        const floatValue_EpimerizomenesSeMhnesErgasias = safeNumber(epimerizomenesSeMhnesErgasias);
        const synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro = document.getElementById("synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro").value;
        const floatValue_synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro = safeNumber(synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro);
        const primBonus = document.getElementById("primBonus").value;
        const floatValue_PrimBonus = safeNumber(primBonus);
        const apallassomenesForoy = document.getElementById("apallassomenesForoy").value;
        const floatValue_ΑpallassomenesForoy = safeNumber(apallassomenesForoy);
        const apallassomenesKrathseon = document.getElementById("apallassomenesKrathseon").value;
        const floatValue_ApallassomenesKrathseon = safeNumber(apallassomenesKrathseon);
        const arithmosPaidion = sharedParams.ergazomenoi.arithmos_teknon;
        const forologhteo_poso_taktikon_apodoxon = document.getElementById("forologhteo_poso_taktikon_apodoxon") 
        let plhroteo = document.getElementById("plhroteo");

        document.getElementById("synolo_ektakton_amoibon").value = 
        (
            parseFloat(floatValue_EpimerizomenesSeMhnesErgasias) +
            floatValue_PrimBonus +
            floatValue_ΑpallassomenesForoy +
            floatValue_ApallassomenesKrathseon
        ).toFixed(2);

        // Δεν γράφουμε πλέον κάθε ενδιάμεσο υπολογισμό στην console.
        forologhteo_poso_taktikon_apodoxon.value =
        (
            parseFloat(document.getElementById("synoloMiktonApodoxon").value || 0) -
            floatValue_synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro -
            parseFloat(document.getElementById("synolo_ektakton_amoibon").value)
        ).toFixed(2);    
        
        ethsio_forologhteo_eisodhma = parseFloat(forologhteo_poso_taktikon_apodoxon.value * _MHNES_YPOLOGISMOY_FOROY).toFixed(2);
        document.getElementById("ethsio_forologhteo_poso_taktikon_apodoxon").value = ethsio_forologhteo_eisodhma;

        const result = await handleKlimakiaForoy();

        if (result) {
            window._AA_FOROLOGIKHS_KLIMAKAS = result._AA_FOROLOGIKHS_KLIMAKAS;
            window._KLIMAKA_FOROY = result._KLIMAKA_FOROY;
            window._EKPTOSH_FOROY = result._EKPTOSH_FOROY;
            window._APODOXES_PRO_EKPTOSHS_FOROY = result._APODOXES_PRO_EKPTOSHS_FOROY;
            window._APODOXES_PRO_EKPTOSHS_FOROY_PIN0 = result._APODOXES_PRO_EKPTOSHS_FOROY_PIN0;
            window._APODOXES_PRO_EKPTOSHS_FOROY_PIN1 = result._APODOXES_PRO_EKPTOSHS_FOROY_PIN1;

            let synolo_foroy = 0;

            if (!allaghForoy) {
                await calcForos(); // Χρησιμοποιεί τα window._*
                synolo_foroy = document.getElementById("synolo_foroy").value || '0.00';
            } else {
                synolo_foroy = document.getElementById("synoloForoy").value || '0.00';
            }
            let floatValue_SynoloForoy = parseFloat(synolo_foroy.replace(',', '.'));

            document.getElementById("synoloForoy").value = parseFloat(floatValue_SynoloForoy).toFixed(2);

            plhroteo.value =
            (
                parseFloat(document.getElementById("synoloMiktonApodoxon").value || 0) +
                parseFloat(document.getElementById("meioshErgatikhsEisforas").value || 0) -
                floatValue - floatValue_SynoloForoy
            ).toFixed(2);

            if (!allaghForoy && !isEmployeeLoadPipelineActive()) {
                clearTimeout(plhroteoDebounceTimeout);
                plhroteoDebounceTimeout = setTimeout(async () => {
                    await updatePlhroteoWithComparison();
                }, 300); // Χρονικό διάστημα σταθεροποίησης (300ms)
            }

            document.getElementById("exoflhsh").value = "0";
            document.getElementById("poso_plhromhs").value = parseFloat(plhroteo.value) || 0;
            document.getElementById("poso_plhromhs_Hidden").value = parseFloat(plhroteo.value) || 0;
        }
    }

    window.calcPlhroteo = function() {
        if (hasRecord) return Promise.resolve();

        const promise = new Promise((resolve) => {
            calcPlhroteoResolvers.push(resolve);
        });

        if (calcPlhroteoTimer) {
            clearTimeout(calcPlhroteoTimer);
        }

        calcPlhroteoTimer = setTimeout(async () => {
            calcPlhroteoTimer = null;

            if (calcPlhroteoRunning) {
                calcPlhroteoPendingAfterRun = true;
                return;
            }

            calcPlhroteoRunning = true;
            try {
                await calcPlhroteoCore();
            } catch (error) {
                console.error('Σφάλμα στον υπολογισμό πληρωτέου:', error);
            } finally {
                calcPlhroteoRunning = false;
                resolveCalcPlhroteoQueue();
            }

            if (calcPlhroteoPendingAfterRun) {
                calcPlhroteoPendingAfterRun = false;
                window.calcPlhroteo();
            }
        }, CALC_PLHROTEO_DEBOUNCE_MS);

        return promise;
    }
    
    // ----------------------------- E V E N T   L I S T E N E R S ----------------------------------

    // Λίστα με όλα τα πεδία και τις συναρτήσεις τους
    // Ορισμός των πεδίων (fields) με τις αντίστοιχες συναρτήσεις τους
    
    const fields = [
        { id: "oresErgasias", functions: { calc: calcOresErgasias, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "hmeresApoysias", functions: { calc: calcHmeresErgasiasMeionApoysies, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "oresApoysias", functions: { calc: calcOresApoysias, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "oresArgion", functions: { calc: calcAxiaArgion, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresNyxtas", functions: { calc: calcAxiaNyxterinon, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresYperergasias", functions: { calc: calcAxiaYperergasion, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresYperergasiasArgion", functions: { calc: calcAxiaYperergasionArgion, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresYperergasiasNyxtas", functions: { calc: calcAxiaYperergasionNyxtas, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresYperergasiasArgionNyxtas", functions: { calc: calcAxiaYperergasionArgionNyxtas, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresNomimhsYperorias", functions: { calc: calcAxiaNomimonYperorion, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresNomimhsYperoriasArgion", functions: { calc: calcAxiaNomimonYperorionArgion, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresNomimhsYperoriasNyxtas", functions: { calc: calcAxiaNomimonYperorionNyxtas, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresNomimhsYperoriasArgionNyxtas", functions: { calc: calcAxiaNomimonYperorionArgionNyxtas, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresParanomhsYperorias", functions: { calc: calcAxiaParanomonYperorion, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresParanomhsYperoriasArgion", functions: { calc: calcAxiaParanomonYperorionArgion, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresParanomhsYperoriasNyxtas", functions: { calc: calcAxiaParanomonYperorionNyxtas, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresParanomhsYperoriasArgionNyxtas", functions: { calc: calcAxiaParanomonYperorionArgionNyxtas, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresErgasias6Hmeras", functions: { calc: calcAxiaErgasias6Hmeras, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "oresProsthethsErgasias", functions: { calc: calcAxiaProsthethsErgasias, blur: (event) => formatInputOnBlur(event, 4) } },
        { id: "taktikesApodoxesMhYpologizomenesSeDora", functions: { calc: taktikesApodoxesMhYpologizomenesSeDora, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "taktikesApodoxesYpologizomenesSeDora", functions: { calc: taktikesApodoxesYpologizomenesSeDora, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "sympsifisteesApodoxes", functions: { calc: sympsifisteesApodoxes, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "epimerizomenesSeMhnesErgasias", functions: { calc: epimerizomenesSeMhnesErgasias, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "primBonus", functions: { calc: primBonus, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "apallassomenesForoy", functions: { calc: apallassomenesForoy, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "apallassomenesKrathseon", functions: { calc: apallassomenesKrathseon, blur: (event) => formatInputOnBlur(event, 2) } },
        { id: "synoloForoy", functions: { calc: synoloForoy, blur: (event) => formatInputOnBlur(event, 2) } },
    
        // Προσθήκη του plhroteo (dblclick -> αφαίρεση readonly -> focus)
        { id: "plhroteo", functions: 
            {
                // Όταν γίνεται υπολογισμός (π.χ. μετά από change/blur/key), τρέχει αυτή η συνάρτηση
                calc: async (event) => {
                    if (hasRecord) return;

                    if (event && event.target) {
                        event.target.setAttribute("readonly", true); // Επαναφορά του readonly
                    }
                    await calcMiktesApodoxesApoPlhroteo();
                    await finishValueCalculation();
                    if (_DOTO_PLHROTEO) {
                        document.getElementById("dotoPlhroteo_Hidden").value = true;
                        await calcNeesSympsifisteesApodoxes();
                    } else {
                        document.getElementById("dotoPlhroteo_Hidden").value = false;
                    }
                },
    
                // Διπλό κλικ -> αφαιρούμε το readonly και εστιάζουμε
                dblclick: (event) => {
                    if (hasRecord) return;

                    if (_SYNOLO_MIKTON_APODOXON === null) {
                        _SYNOLO_MIKTON_APODOXON = parseFloat(document.getElementById("synoloMiktonApodoxon").value);
                    }
                    disableKeyupForPlhroteo = true; // Απενεργοποίηση του keyup
                    event.target.removeAttribute("readonly");
                    document.getElementById("plhroteo").value = document.getElementById("symfonhtheisMisthos").value;
                    event.target.focus();
                } 
            }
        }
    ];
  
  
    // Συνάρτηση που προσθέτει τους event listeners σε κάθε πεδίο του fields
  
    const addEventListeners = (id, { calc, blur, dblclick }) => {
        const element = document.getElementById(id);
        if (!element) return;  // Αν δεν βρεθεί στοιχείο στο DOM, απλά τερματίζουμε
    
        // 1. change
        element.addEventListener("change", async () => {
            if (shouldIgnoreFieldEventDuringLoad()) return;
            if (typeof calc === "function") {
                await calc();
            }
        });
    
        // 2. keyup
        element.addEventListener("keyup", async (event) => {
            if (shouldIgnoreFieldEventDuringLoad()) return;
            if (id === "plhroteo" && disableKeyupForPlhroteo) return;
            // if (id === "synoloForoy" && allaghForoy) return;
            // Μόνο αν το πλήκτρο είναι στα επιτρεπόμενα, κάνουμε calc
            if (allowedKeys.includes(event.key) && typeof calc === "function") {
                await calc();
            }
        });
    
        // 3. blur
        let dblclickHappened = false;

        // Προσθήκη event listener για dblclick στο στοιχείο
        if (id === "plhroteo") {
            element.addEventListener("dblclick", () => {
                dblclickHappened = true;
            });
        }
        
        element.addEventListener("blur", async (event) => {
            if (shouldIgnoreFieldEventDuringLoad()) return;
            // Αν το πεδίο είναι το plhroteo και δεν έχει γίνει dblclick, επιστρέφουμε
            if (id === "plhroteo" && !dblclickHappened) {
                return;
            }
        
            // Ειδικός έλεγχος για apallassomenesForoy
            if (id === "apallassomenesForoy" && skipBlurForField1) {
                return;
            }
        
            // Αν υπάρχει custom blur συνάρτηση, εκτελούμε πρώτα αυτήν
            if (typeof blur === "function") {
                await blur(event);
            }
        
            // Μετά κάνουμε calc (αν υπάρχει)
            if (typeof calc === "function") {
                if (id === "plhroteo") {
                    element.setAttribute("readonly", true);
                }
                await calc();
            }
        
            // Επαναφορά της κατάστασης dblclick
            if (id === "plhroteo") {
                dblclickHappened = false;
            }
        });
        
        // 4. dblclick
        if (typeof dblclick === "function") {
            element.addEventListener("dblclick", (event) => {
                dblclick(event);
            });
        }
    };
  
    // 5. Προσθήκη listeners σε όλα τα πεδία του πίνακα fields
    fields.forEach(({ id, functions }) => addEventListeners(id, functions));
  
    //  Κύρια Συνάρτηση: ypologismosAxiasKrathseon
    async function ypologismosAxiasKrathseon(sharedParams) {
        // if (hasRecord) return;

        // 12. Flag για Αποφυγή Αναδρομικών Ενημερώσεων
        let isUpdating = false; // Δήλωση στην αρχή

        // 13. Μεταβλητή για την Παρακολούθηση της Προηγούμενης Τιμής
        let previousValue = 0; // Αρχική τιμή, θα ενημερωθεί στην αρχικοποίηση

        //  1. ΔΗΛΩΝΟΥΜΕ ΒΑΣΙΚΑ ΠΕΔΙΑ
        const asfalistikesApodoxes = document.getElementById('asfalistikes_apodoxes');
        const asfalistikesApodoxesHidden = document.getElementById('asfalistikes_apodoxes_hidden');
        const synoloMiktonApodoxon = document.getElementById('synoloMiktonApodoxon');

        // Έλεγχος ύπαρξης βασικών πεδίων
        if (!asfalistikesApodoxes) {
            console.error('Το στοιχείο "asfalistikes_apodoxes" δεν βρέθηκε στο DOM.');
            return;
        }
        if (!asfalistikesApodoxesHidden) {
            console.error('Το στοιχείο "asfalistikes_apodoxes_hidden" δεν βρέθηκε στο DOM.');
            return;
        }
        if (!synoloMiktonApodoxon) {
            console.error('Το στοιχείο "synoloMiktonApodoxon" δεν βρέθηκε στο DOM.');
            return;
        }

        /***************************************************************
         * 2. Πεδία συνόλων κρατήσεων
         ***************************************************************/
        const synoloAxiasFields = {
            ergazomenoy: document.getElementById('synolo_axias_krathshs_ergazomenoy'),
            ergodoth: document.getElementById('synolo_axias_krathshs_ergodoth'),
            ergazomenoyYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro'),
            ergazomenoyMhYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro'),
            ergodothYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro'),
            ergodothMhYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro'),
            krathseon: document.getElementById('synoloKrathseon_I'),
        };

        // Άλλα πεδία που μπορεί να χρειάζεσαι
        const plhroteoField = document.getElementById('plhroteo');
        const meioshErgatikhsEisforas = document.getElementById('meioshErgatikhsEisforas');

        /***************************************************************
         * 3. ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ
         ***************************************************************/
        // 3.1 Μορφοποίηση αριθμών για το input (με τελεία)
        function formatNumberForInput(value, decimals = 2) {
            const num = parseFloat(value || '0');
            if (isNaN(num)) return '0.00';
            return num.toFixed(decimals);
        }

        // 3.2 Μορφοποίηση αριθμών για εμφάνιση (με κόμμα)
        function formatNumberForDisplay(value, decimals = 2) {
            const num = parseFloat(value || '0');
            if (isNaN(num)) return '0,00';
            return num.toFixed(decimals).replace('.', ',');
        }

        // 3.3 getAnotatoOrio - Υπολογισμός του ανώτατου ορίου από sharedParams
        function getAnotatoOrio(index) {
            if (!sharedParams?.ergazomenoi || typeof sharedParams.ergazomenoi.palios_neos === 'undefined') {
                // Αν δεν ξέρουμε αν είναι παλιός/νέος, χρησιμοποιούμε μέγιστη τιμή
                return Number.MAX_VALUE;
            }

            const isNeos = sharedParams.ergazomenoi.palios_neos === true;
            const fieldId = isNeos
                ? `anotato_orio_neon_${index}`
                : `anotato_orio_palion_${index}`;

            const el = document.getElementById(fieldId);
            if (!el) {
                console.error(`Το στοιχείο με το ID "${fieldId}" δεν βρέθηκε στο DOM.`);
                return Number.MAX_VALUE;
            }

            const val = parseFloat((el.value || '0').replace(',', '.'));
            return isNaN(val) ? Number.MAX_VALUE : val;
        }

        /***************************************************************
         * 4. (ΝΕΟ) Συναρτήσεις για φόρτωση «πλασματικής αξίας» από τη βάση
         ***************************************************************/
        // Εδώ ορίζουμε την τρέχουσα μισθολογική περίοδο, π.χ. Οκτώβριος 2024 (1/10 - 31/10).
        const arxh_periodoy = new Date(document.getElementById("etos").value + "-" + document.getElementById("periodos").value + "-01T00:00:00.000Z");
        const telosPeriodoy = new Date(arxh_periodoy);
        telosPeriodoy.setMonth(arxh_periodoy.getMonth() + 1);
        
        // Αφαίρεση ενός μιλλιδευτερόλεπτου για να βρούμε το τέλος της περιόδου
        telosPeriodoy.setMilliseconds(telosPeriodoy.getMilliseconds() - 1);
        const telos_periodoy = new Date(telosPeriodoy);

        const startPeriod = arxh_periodoy;
        const endPeriod   = telos_periodoy;

        // 4.1 Συνάρτηση που ελέγχει αν μια εγγραφή PosostaKrathseon καλύπτει την περίοδο
        async function isWithinPeriod(posostaDoc) {
            const isxyeiApo = posostaDoc.isxyei_apo ? new Date(posostaDoc.isxyei_apo) : null;
            const isxyeiEos = posostaDoc.isxyei_eos ? new Date(posostaDoc.isxyei_eos) : null;

            if (!isxyeiApo || !isxyeiEos) {
                return false; // Δεν έχουμε σωστές ημερομηνίες
            }

            // Θέλουμε: 
            //   startPeriod >= isxyei_apo AND endPeriod <= isxyei_eos
            //   Δλδ να «περικλείει» η περίοδος των ημερομηνιών μας από το range.
            if (startPeriod >= isxyeiApo && endPeriod <= isxyeiEos) {
                return true;
            }
            return false;
        }

        /***************************************************************
         * 5. Αρχικοποίηση: initializeInitialValues
         *    + Φόρτωση πλασματικής αξίας από DB αν χρειάζεται
         ***************************************************************/
        async function initializeInitialValues() {
            for (let i = 1; i <= 7; i++) {
                const idx = i.toString().padStart(2, '0');
                const field = document.getElementById(`asfalistikesApodoxes_${idx}`);
                if (!field) continue;
        
                // (Α) Παίρνουμε την τρέχουσα τιμή σαν 'safeVal'
                const asfVal = parseFloat((field.value || '0').replace(',', '.'));
                const safeVal = isNaN(asfVal) ? 0 : asfVal;
        
                // (Β) Αποθηκεύουμε στα dataset
                field.dataset.initialValue = safeVal;
                field.dataset.previousValue = safeVal;
        
                // (Γ) Φέρνουμε τον kodikos_XX (αν υπάρχει κάπου στο DOM).
                const kodikosEl = document.getElementById(`kodikos_${idx}`);
                let kodikosVal = '';
                if (kodikosEl) {
                    kodikosVal = (kodikosEl.value || '').trim();
                }
        
                // (Γ1) Φόρτωση τυχόν κρυφών πεδίων για πλασματική αξία
                const epiPlasmatikhsEl = document.getElementById(`ypologizomenoEpiPlasmatikhs_${idx}`);
                const plasmatikhAxiaEl = document.getElementById(`plasmatikh_axia_${idx}`);
        
                // Αν υπάρχουν κρυφά πεδία, ελέγχουμε την τιμή τους
                let alreadyKnownPlasmatikh = false;
                if (epiPlasmatikhsEl && plasmatikhAxiaEl) {
                    const isPlasmatikhs = epiPlasmatikhsEl.value === 'true'; 
                    const plasmatikhVal = parseFloat((plasmatikhAxiaEl.value || '0').replace(',', '.'));
        
                    if (isPlasmatikhs && !isNaN(plasmatikhVal)) {
                        // => Γνωρίζουμε ήδη ότι είναι πλασματική, βάζουμε την τιμή
                        field.value = formatNumberForInput(plasmatikhVal, 2);
                        field.dataset.isPlasmatikh = 'true';
                        alreadyKnownPlasmatikh = true;
                    }
                }
            }
        }
        
        /***************************************************************
         * 6. Υπολογισμός Κρατήσεων: calculateValues
         ***************************************************************/
        async function calculateValues() {
            const totals = {
                ergazomenoy: 0,
                ergodoth: 0,
                ergazomenoyYpologizomenhStoForo: 0,
                ergazomenoyMhYpologizomenhStoForo: 0,
                ergodothYpologizomenhStoForo: 0,
                ergodothMhYpologizomenhStoForo: 0,
            };

            for (let i = 1; i <= 7; i++) {
                const idx = i.toString().padStart(2, '0');
                const fields = {
                    asfalistikesApodoxes: document.getElementById(`asfalistikesApodoxes_${idx}`),
                    posostoErgazomenoy: document.getElementById(`pososto_krathshs_ergazomenoy_${idx}`),
                    posostoErgodoth: document.getElementById(`pososto_krathshs_ergodoth_${idx}`),
                    posoErgazomenoy: document.getElementById(`poso_krathshs_ergazomenoy_${idx}`),
                    posoErgodoth: document.getElementById(`poso_krathshs_ergodoth_${idx}`),
                    axiaErgazomenoy: document.getElementById(`axia_krathshs_ergazomenoy_${idx}`),
                    axiaErgodoth: document.getElementById(`axia_krathshs_ergodoth_${idx}`),
                    ypologizomenoStoForo: document.getElementById(`ypologizomenoStoForo_${idx}`),
                };

                if (
                    !fields.asfalistikesApodoxes ||
                    !fields.posostoErgazomenoy ||
                    !fields.posostoErgodoth ||
                    !fields.ypologizomenoStoForo
                ) {
                    continue;
                }

                // Ελέγχουμε αν είναι «κλειδωμένο» σε πλασματική
                const isPlasmatikh = fields.asfalistikesApodoxes.dataset.isPlasmatikh === 'true';

                let asfVal = parseFloat((fields.asfalistikesApodoxes.value || '0').replace(',', '.'));
                if (isNaN(asfVal)) asfVal = 0;

                // Αν ΔΕΝ είναι πλασματική, μπορεί να υπόκειται σε ανώτατο όριο
                let adjustedVal = asfVal;
                if (!isPlasmatikh) {
                    const anotatoOrio = getAnotatoOrio(idx);
                    adjustedVal = Math.min(asfVal, anotatoOrio);
                }

                // Ποσοστά και ποσά κράτησης
                const pErgaz = parseFloat((fields.posostoErgazomenoy.value || '0').replace(',', '.')) / 100;
                const pErgod = parseFloat((fields.posostoErgodoth.value || '0').replace(',', '.')) / 100;
                const psErg = parseFloat((fields.posoErgazomenoy.value || '0').replace(',', '.'));
                const psErd = parseFloat((fields.posoErgodoth.value || '0').replace(',', '.'));

                const axiaErgaz = adjustedVal * pErgaz + (psErg || 0);
                const axiaErgod = adjustedVal * pErgod + (psErd || 0);

                // Προσθέτουμε στα totals
                totals.ergazomenoy += axiaErgaz;
                totals.ergodoth += axiaErgod;

                // Αν υπολογίζεται στο φόρο...
                if (fields.ypologizomenoStoForo.value.toLowerCase() === 'true') {
                    totals.ergazomenoyYpologizomenhStoForo += axiaErgaz;
                    totals.ergodothYpologizomenhStoForo += axiaErgod;
                } else {
                    totals.ergazomenoyMhYpologizomenhStoForo += axiaErgaz;
                    totals.ergodothMhYpologizomenhStoForo += axiaErgod;
                }

                // Ενημερώνουμε τις αξίες στα αντίστοιχα πεδία (με τελεία, 4 δεκαδικά)
                if (fields.axiaErgazomenoy) {
                    fields.axiaErgazomenoy.value = formatNumberForInput(axiaErgaz, 4);
                }
                if (fields.axiaErgodoth) {
                    fields.axiaErgodoth.value = formatNumberForInput(axiaErgod, 4);
                }
            }

            // Ενημέρωση συνόλων με κόμμα για εμφάνιση
            if (synoloAxiasFields.ergazomenoy) {
                synoloAxiasFields.ergazomenoy.value = formatNumberForDisplay(totals.ergazomenoy, 2);
            }
            if (synoloAxiasFields.ergodoth) {
                synoloAxiasFields.ergodoth.value = formatNumberForDisplay(totals.ergodoth, 2);
            }
            if (synoloAxiasFields.ergazomenoyYpologizomenhStoForo) {
                synoloAxiasFields.ergazomenoyYpologizomenhStoForo.value =
                    formatNumberForDisplay(totals.ergazomenoyYpologizomenhStoForo, 2);
            }
            if (synoloAxiasFields.ergazomenoyMhYpologizomenhStoForo) {
                synoloAxiasFields.ergazomenoyMhYpologizomenhStoForo.value =
                    formatNumberForDisplay(totals.ergazomenoyMhYpologizomenhStoForo, 2);
            }
            if (synoloAxiasFields.ergodothYpologizomenhStoForo) {
                synoloAxiasFields.ergodothYpologizomenhStoForo.value =
                    formatNumberForDisplay(totals.ergodothYpologizomenhStoForo, 2);
            }
            if (synoloAxiasFields.ergodothMhYpologizomenhStoForo) {
                synoloAxiasFields.ergodothMhYpologizomenhStoForo.value =
                    formatNumberForDisplay(totals.ergodothMhYpologizomenhStoForo, 2);
            }

            // Για παράδειγμα, το σύνολο των κρατήσεων (εργαζόμενου) στο πεδίο krathseon
            if (synoloAxiasFields.krathseon) {
                synoloAxiasFields.krathseon.value = formatNumberForDisplay(totals.ergazomenoy, 2);
            }

            // Αν υπάρχει κάποια συνάρτηση calcPlhroteo() για έξτρα υπολογισμούς
            if (firstTimeCalcPlhroteo) {
                if (typeof calcPlhroteo === 'function') {
                    await calcPlhroteo();
                }
            }
        }

        /***************************************************************
         * 7. Συνάρτηση: updateAsfalistikesApodoxesXX
         *    Ενημερώνει όλα τα πεδία asfalistikesApodoxes_XX, ΕΚΤΟΣ
         *    από εκείνα που είναι «κλειδωμένα» σε πλασματική αξία.
         ***************************************************************/
        async function updateAsfalistikesApodoxesXX(newValue) {
            for (let i = 1; i <= 7; i++) {
                const idx = i.toString().padStart(2, '0');
                const field = document.getElementById(`asfalistikesApodoxes_${idx}`);

                if (!field) continue;

                // Αν αυτό το πεδίο είναι «κλειδωμένο» σε πλασματική, το προσπερνάμε
                if (field.dataset.isPlasmatikh === 'true') {
                    continue;
                }

                // Παίρνουμε το ανώτατο όριο (μόνο για ενημέρωση visual, η ουσία γίνεται στο calculate)
                const anotato = getAnotatoOrio(idx);
                const updatedVal = Math.min(newValue, anotato);

                field.value = formatNumberForInput(updatedVal, 2);
            }
        }

        /***************************************************************
         * 8. Συνάρτηση: handleSynoloMiktonChange
         *    Όταν αλλάζει το "synoloMiktonApodoxon", ενημερώνουμε
         *    asfalistikesApodoxes και τα επιμέρους πεδία
         ***************************************************************/
        async function handleSynoloMiktonChangeCore() {
            const apallassomenesKrathseon = document.getElementById("apallassomenesKrathseon");
            
            let miktesApodoxesPlusAstheneia = parseFloat(synoloMiktonApodoxon.value || '0') - parseFloat((document.getElementById("synoloAsfalistikhsAxias").value || '0').replace(',', '.')) - (parseFloat(document.getElementById("apallassomenesKrathseon").value || 0));   // + parseFloat(document.getElementById("geniko_synolo_astheneias").value || 0));
            let newVal = parseFloat(miktesApodoxesPlusAstheneia || 0);
            // let newVal = parseFloat((synoloMiktonApodoxon.value || '0').replace(',', '.'));
            if (isNaN(newVal)) {
                newVal = 0;
            }

            // Ενημέρωση asfalistikesApodoxes value
            isUpdating = true;
            asfalistikesApodoxes.value = formatNumberForInput(newVal, 2);
            isUpdating = false;

            // Ενημέρωση ΚΑΘΕ asfalistikesApodoxes_XX (εκτός των κλειδωμένων)
            await updateAsfalistikesApodoxesXX(newVal);

            // Ενημέρωση previousValue
            previousValue = newVal;

            // Recalculate values
            await calculateValues();
        }

        handleSynoloMiktonChangeCoreRef = handleSynoloMiktonChangeCore;

        async function handleSynoloMiktonChange() {
            return runHandleSynoloMiktonChangeCoalesced();
        }

        /***************************************************************
         * 9. Συνάρτηση: handleAsfalistikesApodoxesChange
         ***************************************************************/
        async function handleAsfalistikesApodoxesChange() {
            // Αν το flag isUpdating είναι ενεργό, αγνοούμε την αλλαγή
            if (isUpdating) {
                return;
            }

            // Αποθήκευση της προηγούμενης τιμής
            const oldValue = previousValue;
            let newVal = parseFloat((asfalistikesApodoxes.value || '0').replace(',', '.'));
            if (isNaN(newVal)) {
                newVal = 0;
            }

            // Ενημέρωση previousValue
            previousValue = newVal;

            // Ενημέρωση asfalistikesApodoxes_XX fields (χειροκίνητη)
            await updateAsfalistikesApodoxesXXManualChange(oldValue, newVal);

            // Recalculate values
            await calculateValues();
        }

        /***************************************************************
         * 10. Συνάρτηση: updateAsfalistikesApodoxesXXManualChange
         ***************************************************************/
        async function updateAsfalistikesApodoxesXXManualChange(oldValue, newValue) {
            // Ενημερώνει ΟΛΑ τα πεδία, εκτός αυτών που είναι «κλειδωμένα»
            for (let i = 1; i <= 7; i++) {
                const idx = i.toString().padStart(2, '0');
                const field = document.getElementById(`asfalistikesApodoxes_${idx}`);
                if (!field) continue;

                // Αν είναι κλειδωμένο σε πλασματική, μην το αλλάζεις
                if (field.dataset.isPlasmatikh === 'true') {
                    continue;
                }

                // Αλλιώς, ενημερώνουμε
                const anotato = getAnotatoOrio(idx);
                const updatedVal = Math.min(newValue, anotato);
                field.value = formatNumberForInput(updatedVal, 2);
            }
        }

        // Κάνουμε τις συναρτήσεις global (αν χρειάζεται)
        window.handleSynoloMiktonChange = handleSynoloMiktonChange;
        window.handleAsfalistikesApodoxesChange = handleAsfalistikesApodoxesChange;

        /***************************************************************
         * 11. Αρχική Φόρτωση: Αρχικοποίηση και πρώτος υπολογισμός
         ***************************************************************/
        // (Α) Αρχικοποίηση (μαζί με φόρτωση πλασματικών)
        await initializeInitialValues(); 
        // (Β) Πρώτος υπολογισμός
        await calculateValues();

        // Συγχρονίζουμε το hidden πεδίο με το τρέχον asfalistikes_apodoxes
        asfalistikesApodoxesHidden.value = asfalistikesApodoxes.value;

        /***************************************************************
         * 12. Event Listeners
         ***************************************************************/
        if (!window.__apasxAsfalistikesListenersAttached) {
            synoloMiktonApodoxon.addEventListener('change', async () => {
                if (shouldIgnoreFieldEventDuringLoad()) return;
                await handleSynoloMiktonChange();
            });

        // Όταν γράφει ο χρήστης μέσα στο asfalistikesApodoxes
            asfalistikesApodoxes.addEventListener('input', async () => {
                if (shouldIgnoreFieldEventDuringLoad()) return;
                await handleAsfalistikesApodoxesChange();
            });

            asfalistikesApodoxes.addEventListener('change', async () => {
                if (shouldIgnoreFieldEventDuringLoad()) return;
                await handleAsfalistikesApodoxesChange();
            });

            window.__apasxAsfalistikesListenersAttached = true;
        }
    }

    async function updatePlhroteoWithComparison() {
        if (hasRecord) return;

        // Περίμενε τον υπολογισμό του plhroteo
    
        const allaghPlhroteoy = document.getElementById("allaghPlhroteoy_Hidden");
        const valueAllagh = parseFloat(allaghPlhroteoy.value || '0');
        const valuePlhroteo = parseFloat(document.getElementById("plhroteo").value || 0);
        const diafora = parseFloat(valueAllagh) - valuePlhroteo;

        if (!isNaN(valueAllagh) && valueAllagh !== 0) {
            if (!sharedParams.ergazomenoi.ypologismos_foroy) {
                return;
            }
            let diafora = parseFloat(valueAllagh) - valuePlhroteo;
            if (diafora !== 0) {
                const synoloForoyField = document.getElementById("synolo_foroy");
                let floatValue_SynoloForoy = parseFloat(synoloForoyField.value.replace(',', '.') || '0.00');
    
                if (diafora > 0) {
                    floatValue_SynoloForoy -= parseFloat(diafora).toFixed(2);
                    if (!isNaN(valuePlhroteo) && !isNaN(diafora)) {
                        document.getElementById("plhroteo").value = (valuePlhroteo + diafora).toFixed(2);
                    }
                    // document.getElementById("plhroteo").value = (valuePlhroteo + parseFloat(diafora)).toFixed(2);
                } else {
                    floatValue_SynoloForoy += parseFloat(diafora).toFixed(2);
                    if (!isNaN(valuePlhroteo) && !isNaN(diafora)) {
                        document.getElementById("plhroteo").value = (valuePlhroteo - diafora).toFixed(2);
                    }
                    // document.getElementById("plhroteo").value = (valuePlhroteo - parseFloat(diafora)).toFixed(2);
                }
    
                // Ενημέρωση του συνολικού φόρου
                synoloForoyField.value = parseFloat(floatValue_SynoloForoy).toFixed(2);
            }
        }
    }
    
        // async function handleKlimakiaForoy() {
        //     if (hasRecord) return;

        //     try {
        //         let module;
        //         const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'; 
                
        //         // Χρησιμοποιούμε dynamic import()
        //         const baseUrl = import.meta.url;
        //         const prodPath = new URL('../../min.js/kinhseis/klimakiaForoy.min.js', baseUrl);
        //         const devPath  = new URL('../ypologismoi/klimakiaForoy.js', baseUrl);

        //         module = await import(isProduction ? prodPath : devPath);

        //         // Απόσυγκέντρωση των συναρτήσεων αφού φορτωθεί το module
        //         const { 
        //             initializeKlimakiaForoy, 
        //             fetchData, 
        //             fetchEkptoshForoy, 
        //             fetchEisodhmaProForoyMeioshs,
        //             _EKPTOSH_FOROY 
        //         } = module;
                        
        //         // Καλείται η συνάρτηση του module με το sharedParams
        //         if (module) {
        //             await initializeKlimakiaForoy();
        //             await fetchData();
        //             await fetchEkptoshForoy();
        //             await fetchEisodhmaProForoyMeioshs();
        //         }

        //         // Επιστροφή των δεδομένων
        //         return { _EKPTOSH_FOROY };

        //     } catch (error) {
        //         console.error(`Σφάλμα κατά τη φόρτωση του module:`, error);
        //     }
        // }

async function handleKlimakiaForoy() {
    try {
        let klimakiaForoyModule;

        if (typeof window !== "undefined" && window.KlimakiaForoyModule) {
            klimakiaForoyModule = window.KlimakiaForoyModule;
        } else if (typeof module !== "undefined" && typeof require === "function") {
            klimakiaForoyModule = require("./klimakiaForoy.js");
        } else {
            throw new Error("KlimakiaForoy module not found in any environment");
        }

        await klimakiaForoyModule.initializeKlimakiaForoy();
        await klimakiaForoyModule.fetchData();
        await klimakiaForoyModule.fetchEkptoshForoy();
        await klimakiaForoyModule.fetchEisodhmaProForoyMeioshs();

        // Επιστρέφουμε όλα τα αντικείμενα (Κλίμακα φόρου, έκπτωση φόρου κλπ)
        return klimakiaForoyModule.getAllArraysFromKlimakiaForoy();

    } catch (error) {
        console.error("Error in handleKlimakiaForoy:", error);
        return null;
    }
}

    async function calcNeesSympsifisteesApodoxes() {
        if (hasRecord) return;

        document.getElementById("plhroteo").value = parseFloat(parseFloat(_NEES_PLHROTEES_APODOXES) - parseFloat(document.getElementById("prokatabolh").value)).toFixed(2);
        document.getElementById("synoloForoy").value = parseFloat(_NEOS_FOROS).toFixed(2);
        document.getElementById("synoloMiktonApodoxon").value = parseFloat(
            parseFloat(_NEES_PLHROTEES_APODOXES) +
            parseFloat(document.getElementById("synoloKrathseon_I").value.replace(',', '.')) +
            parseFloat(_NEOS_FOROS))
        .toFixed(2);
        document.getElementById("sympsifisteesApodoxes").value = parseFloat(parseFloat(document.getElementById("synoloMiktonApodoxon").value) - parseFloat(_PROHGOYMENES_MIKTES_APODOXES)).toFixed(2);
    }

}); 
