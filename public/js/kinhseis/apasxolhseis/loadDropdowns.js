const oneSpaces = '\u00A0'.repeat(1);
const twoSpaces = '\u00A0'.repeat(2);
const tenSpaces = '\u00A0'.repeat(10);

// import { ypologismosPragmatikonErgasimonHmeronMhna } from './apasxolhseis.js';
// export let hasRecord = false;

// Global shared parameters used by apasxolhseis.js and other external modules.
// Keep a real global variable (not only window.sharedParams) to avoid ReferenceError
// in scripts that read sharedParams directly.
//
// IMPORTANT:
// Some calculation listeners can run before an employee/period has fully loaded
// (for example from restoreOnBlur / initial input events). In that phase,
// apasxolhseis.js may read sharedParams.ergazomenoi.asfalish_me_tekmarta.
// Therefore we keep a safe baseline object instead of plain {}.
function createSafeSharedParams() {
    return {
        ergazomenoi: {},
        sxeshErgasias: {},
        kathestosApasxolhshs: {},
        oikogeneiakhKatastash: {},
        typosErgazomenoy: {},
        genikesParametroi: Array.from({ length: 40 }, () => ({ timh: '0' })),
        asfalistikesKlaseis: [],
        astheneies: [],
        etaireia: {},
        _TEAM: '',
        _COMPANY: '',
        _YPOKATASTHMA: '',
        _XRHSH: '',
        _KODIKOS_ETAIREIAS: '',
        _SYNOLO_ERGASIMON_HMERON_MHNA: 0,
        _ERGASIMES_HMERES_MHNA: 0,
        _MH_ERGASIMES_HMERES_MHNA: 0,
        _ETHSIES_ORES_YPERORION: 0,
        _PROSAYXHSH_HMERON_5MERHS_ERGASIAS: 0,
        startDate: null,
        endDate: null,
        isReady: false
    };
}

var sharedParams = window.sharedParams || createSafeSharedParams();
window.sharedParams = sharedParams;
let hasRecord = false;

function setOperationalPayrollPhaseContext(operationalPhaseContext) {
    const hasOperationalPhases =
        Array.isArray(operationalPhaseContext?.operationalPhases) &&
        operationalPhaseContext.operationalPhases.length > 0;
    const usableContext =
        operationalPhaseContext?.hasUsableSingleOperationalPhase === true ||
        (operationalPhaseContext?.hasOperationalSplit === true && hasOperationalPhases)
            ? operationalPhaseContext
            : null;

    window.apasxolhseisOperationalPayrollPhaseContext = usableContext;

    if (sharedParams) {
        sharedParams.operationalPayrollPhaseContext = usableContext;
    }
}

// Συνάρτηση φόρτωσης εργαζομένων
// export async function loadErgazomenoi(energoi, ypokatasthma) {

let metrhths = 0; // Μετρητής για αποφυγή flashing μεταξύ των tab κατά τον υπολογισμό του φόρου και του πληρωτέου

let _DOTO_PLHROTEO = false,
    _NEES_PLHROTEES_APODOXES = 0,
    _NEOS_FOROS = 0,
    _PROHGOYMENES_MIKTES_APODOXES = 0,
    _CHECK_HMERES_ASFALISHS = false;

let _KODIKOS_ETAIREIAS,
    _ID_ETAIREIAS,
    _KODIKOS_ERGAZOMENOY,
    _HMEROMHNIA_PROSLHPSHS,
    _HMEROMHNIA_APOXORHSHS,
    _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS,
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_LESS_365,
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_LESS_365,
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_GREATER_365,
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_GREATER_365,
    _TELOS_TREXONTOS_ERGASIAKOY_ETOYS,
    _ARXH_EPOMENOY_ERGASIAKOY_ETOYS,
    _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS,
    _HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS,
    _HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS,
    _TELOS_ERGASIAKHS_PERIODOY,
    _HMEROMHNIES_REPO,
    _MH_ERGASIMES_HMERES_REPO,
    _HMEROMHNIES_ARGION;

let _APASXOLHSH_BASEI_SYMBASHS = 0,
    _APODOXES_ORON_ERGASIAS = 0,
    _APODOXES_ORON_APOYSIAS = 0,
    _ARGIES = 0,
    _ASTHENEIES = 0,
    _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = 0,
    _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = 0,
    _HMERES_ARGION = 0,
    _KOINES_ARGIES = 0,
    _LHFTHEISA_ADEIA_ASTHENEIAS = 0,
    _MH_ERGASIMES_HMERES = 0,
    _PRAGMATIKES_HMERES_ASTHENEIAS = 0,
    _REPO = 0,
    _SYNOLO_DIKAIOYMENHS_ASTHENEIAS = 0,
    _SYNOLIKO_DIASTHMA_ASTHENEIAS = 0,
    _YPOLOIPO_ADEIAS_ASTHENEIAS = 0,
    _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS = 0,
    _SYNOLO_MIKTON_APODOXON = null;

let diasthmataAstheneias = {};
let diasthmataMhErgasimon = {};
let hmeromhniesMhErgasimon = {};
let diasthmataRepo = {};
let hmeromhniesRepo = {};
let diasthmataArgion = {};
let hmeromhniesArgion = {};
let diasthmataArgionSeRepoKaiMhErgasimes = {};
let hmeromhniesArgionSeRepoKaiMhErgasimes = {};

let lhftheisa_adeia = 0,
    synoloProhgoymenonHmeronAstheneias = 0,
    synoloProhgoymenonHmeronGreater3 = 0,
    synoloProhgoymenonHmeronLess3 = 0,
    geniko_synolo_astheneias = 0,
    differenceInDays = 0;

let anapaysh_repo_hmeromhnies,
    anapaysh_repo_timh,
    mh_ergasimes_basei_orarioy_timh,
    mh_ergasimes_hmeromhnies,
    argies_timh,
    argies_hmeromhnies,
    hmeromhnia_arxhs_ergasiakoy_etoys,
    hmeromhnia_teloys_ergasiakoy_etoys,
    hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys,
    hmeromhnia_teloys_epomenoy_ergasiakoy_etoys,
    synolo_less_3,
    synolo_greater_3,
    geniko_synolo_hmeron_astheneias,
    oldLess3Value,
    oldGreater3Value,
    oldSynoloValue,
    dikaioymenh_astheneia_trexontos_ergasiakoy_etoys,
    dikaioymenh_astheneia_trexontos_ergasiakoy_etoys_timh,
    lhfteisa_adeia_asteneias_prohgoymenon_mhnon,
    lhfteisa_adeia_asteneias_prohgoymenon_mhnon_timh,
    ypoloipo_adeias_astheneias_trexontos_etoys,
    ypoloipo_adeias_astheneias_trexontos_etoys_timh,
    dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys,
    dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys_timh,
    synolo_dikaioymenhs_adeias_astheneias,
    synolo_dikaioymenhs_adeias_astheneias_timh,
    lhftheisa_adeia_astheneias,
    lhftheisa_adeia_astheneias_timh,
    ypoloipo_adeias_astheneias,
    ypoloipo_adeias_astheneias_timh;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const loaderContainer = document.querySelector('.loader-container');
let apasxolhseisPipelineLoaderDepth = 0;
let apasxolhseisPipelineLoaderLockDepth = 0;
let apasxolhseisPipelineLoaderVisible = loaderContainer
    ? window.getComputedStyle(loaderContainer).display !== 'none'
    : false;
let apasxolhseisPipelineLoaderHideTimer = null;

async function waitForApasxolhseisKrathseisLoading() {
    const loadingPromise = window.apasxolhseisKrathseisLoadingPromise;

    if (!loadingPromise || typeof loadingPromise.then !== 'function') {
        return;
    }

    await loadingPromise;
}

function setApasxolhseisPipelineLoaderVisible(visible) {
    if (visible) {
        if (apasxolhseisPipelineLoaderHideTimer) {
            window.clearTimeout(apasxolhseisPipelineLoaderHideTimer);
            apasxolhseisPipelineLoaderHideTimer = null;
        }

        if (apasxolhseisPipelineLoaderVisible) {
            window.apasxolhseisPipelineLoaderActive = true;
            return;
        }

        apasxolhseisPipelineLoaderVisible = true;
        window.apasxolhseisPipelineLoaderActive = true;
        if (loaderContainer) {
            loaderContainer.style.display = 'grid';
        }
        return;
    }

    if (apasxolhseisPipelineLoaderHideTimer) {
        window.clearTimeout(apasxolhseisPipelineLoaderHideTimer);
        apasxolhseisPipelineLoaderHideTimer = null;
    }

    if (!apasxolhseisPipelineLoaderVisible) {
        window.apasxolhseisPipelineLoaderActive = false;
        return;
    }

    apasxolhseisPipelineLoaderHideTimer = window.setTimeout(() => {
        apasxolhseisPipelineLoaderHideTimer = null;

        if (apasxolhseisPipelineLoaderDepth > 0 || apasxolhseisPipelineLoaderLockDepth > 0) {
            return;
        }

        apasxolhseisPipelineLoaderVisible = false;
        window.apasxolhseisPipelineLoaderActive = false;
        if (loaderContainer) {
            loaderContainer.style.display = 'none';
        }
    }, 100);
}

function setApasxolhseisLoaderLockClass(locked) {
    document.body?.classList.toggle('apasxolhseis-loader-locked', !!locked);
    window.apasxolhseisLoaderLocked = !!locked;
}

function beginApasxolhseisPipelineLoader() {
    apasxolhseisPipelineLoaderLockDepth += 1;
    apasxolhseisPipelineLoaderDepth = Math.max(apasxolhseisPipelineLoaderDepth, 1);
    setApasxolhseisLoaderLockClass(true);
    setApasxolhseisPipelineLoaderVisible(true);
}

function endApasxolhseisPipelineLoader() {
    apasxolhseisPipelineLoaderLockDepth = Math.max(0, apasxolhseisPipelineLoaderLockDepth - 1);
    if (apasxolhseisPipelineLoaderLockDepth === 0) {
        apasxolhseisPipelineLoaderDepth = 0;
        setApasxolhseisLoaderLockClass(false);
        setApasxolhseisPipelineLoaderVisible(false);
    }
}

function showApasxolhseisPipelineLoader() {
    if (apasxolhseisPipelineLoaderLockDepth > 0) {
        setApasxolhseisPipelineLoaderVisible(true);
        return;
    }

    apasxolhseisPipelineLoaderDepth += 1;
    setApasxolhseisPipelineLoaderVisible(true);
}

function hideApasxolhseisPipelineLoader() {
    if (apasxolhseisPipelineLoaderLockDepth > 0) {
        // Όταν τρέχει employee/pipeline flow, κανένας εσωτερικός υπολογισμός
        // δεν επιτρέπεται να κρύψει τον loader. Κρύβεται μόνο στο τελικό end().
        return;
    }

    apasxolhseisPipelineLoaderDepth = Math.max(0, apasxolhseisPipelineLoaderDepth - 1);
    if (apasxolhseisPipelineLoaderDepth === 0) {
        setApasxolhseisPipelineLoaderVisible(false);
    }
}

function resetApasxolhseisPipelineLoader() {
    apasxolhseisPipelineLoaderDepth = 0;
    apasxolhseisPipelineLoaderLockDepth = 0;
    setApasxolhseisLoaderLockClass(false);
    setApasxolhseisPipelineLoaderVisible(false);
}

(function setupApasxolhseisCompactLoader() {
    if (window.apasxolhseisCompactLoader) return;

    const SHOW_DELAY_MS = 160;
    const MIN_VISIBLE_MS = 420;
    const STYLE_ID = 'apasxolhseisCompactLoaderStyles';
    const LOADER_ID = 'apasxolhseisCompactLoader';
    const LEGACY_LOADER_SELECTORS = [
        '#appLoader',
        '.app-loader',
        '.app-loader--simple',
        '.loader-container',
        '.content-dim-overlay'
    ];

    let depth = 0;
    let showTimer = null;
    let hideTimer = null;
    let shownAt = 0;
    let loaderElement = null;

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        const nonce =
            document.querySelector('script[nonce]')?.nonce ||
            document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ||
            '';
        if (nonce) {
            style.setAttribute('nonce', nonce);
        }
        style.textContent = `
.apasxolhseis-compact-loader {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 100000000;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: min(320px, calc(100vw - 32px));
    padding: 7px 11px;
    border: 1px solid rgba(15, 23, 42, 0.14);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
    color: #1f2937;
    font-size: 0.82rem;
    line-height: 1.2;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, calc(-50% - 6px));
    transition: opacity 140ms ease, transform 140ms ease;
}
.apasxolhseis-compact-loader-visible {
    opacity: 1;
    transform: translate(-50%, -50%);
}
body.apasxolhseis-compact-loader-active #appLoader,
body.apasxolhseis-compact-loader-active .app-loader,
body.apasxolhseis-compact-loader-active .app-loader--simple,
body.apasxolhseis-compact-loader-active .loader-container,
body.apasxolhseis-compact-loader-active .content-dim-overlay,
.apasxolhseis-legacy-loader-suppressed {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}
.apasxolhseis-compact-loader__spinner {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    border: 2px solid rgba(37, 99, 235, 0.2);
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: apasxolhseisCompactLoaderSpin 700ms linear infinite;
}
.apasxolhseis-compact-loader__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
@keyframes apasxolhseisCompactLoaderSpin {
    to {
        transform: rotate(360deg);
    }
}`;
        document.head.appendChild(style);
    }

    function ensureLoaderElement() {
        if (loaderElement && document.body.contains(loaderElement)) {
            return loaderElement;
        }

        ensureStyles();

        loaderElement = document.getElementById(LOADER_ID);
        if (!loaderElement) {
            loaderElement = document.createElement('div');
            loaderElement.id = LOADER_ID;
            loaderElement.className = 'apasxolhseis-compact-loader';
            loaderElement.setAttribute('role', 'status');
            loaderElement.setAttribute('aria-live', 'polite');

            const spinner = document.createElement('span');
            spinner.className = 'apasxolhseis-compact-loader__spinner';
            spinner.setAttribute('aria-hidden', 'true');

            const text = document.createElement('span');
            text.className = 'apasxolhseis-compact-loader__text';
            text.textContent = 'Φόρτωση απασχολήσεων...';

            loaderElement.append(spinner, text);
            document.body.appendChild(loaderElement);
        }

        return loaderElement;
    }

    function setMessage(message) {
        const element = ensureLoaderElement();
        const text = element.querySelector('.apasxolhseis-compact-loader__text');
        if (text) {
            text.textContent = message || 'Φόρτωση απασχολήσεων...';
        }
    }

    function setVisible(visible) {
        const element = ensureLoaderElement();
        element.classList.toggle('apasxolhseis-compact-loader-visible', visible);
        if (visible) {
            shownAt = Date.now();
        }
    }

    function setBodyActive(active) {
        document.body?.classList.toggle('apasxolhseis-compact-loader-active', !!active);
        LEGACY_LOADER_SELECTORS.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                if (element.closest(`#${LOADER_ID}`)) return;
                element.classList.toggle('apasxolhseis-legacy-loader-suppressed', !!active);
            });
        });
    }

    function clearTimers() {
        if (showTimer) {
            window.clearTimeout(showTimer);
            showTimer = null;
        }
        if (hideTimer) {
            window.clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    window.apasxolhseisCompactLoader = {
        show(message) {
            depth += 1;
            setMessage(message);
            setBodyActive(true);

            if (hideTimer) {
                window.clearTimeout(hideTimer);
                hideTimer = null;
            }

            if (showTimer || loaderElement?.classList.contains('apasxolhseis-compact-loader-visible')) {
                return;
            }

            showTimer = window.setTimeout(() => {
                showTimer = null;
                if (depth > 0) {
                    setVisible(true);
                }
            }, SHOW_DELAY_MS);
        },

        hide() {
            depth = Math.max(0, depth - 1);
            if (depth > 0) return;

            if (showTimer) {
                window.clearTimeout(showTimer);
                showTimer = null;
                setBodyActive(false);
                return;
            }

            const isVisible =
                loaderElement?.classList.contains('apasxolhseis-compact-loader-visible') === true;
            if (!isVisible) {
                setBodyActive(false);
                return;
            }

            const elapsed = Date.now() - shownAt;
            const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
            hideTimer = window.setTimeout(() => {
                hideTimer = null;
                if (depth === 0) {
                    setVisible(false);
                    setBodyActive(false);
                }
            }, remaining);
        },

        reset() {
            depth = 0;
            clearTimers();
            setBodyActive(false);
            if (loaderElement) {
                loaderElement.classList.remove('apasxolhseis-compact-loader-visible');
            }
        }
    };
})();

const saveButton = document.getElementById('saveButton');
const updateButton = document.getElementById('updateButton');
const undoButton = document.getElementById('undoButton');
const deleteButton = document.getElementById('deleteButton');

document.addEventListener('DOMContentLoaded', function () {
    // Global variables

    let firstTimeCalcPlhroteo = false;

    let selectedTeam = document.getElementById('team')
        ? document.getElementById('team').value
        : null;
    let selectedCompany = document.getElementById('company_kod')
        ? document.getElementById('company_kod').value
        : null;
    let _etaireia = null;
    let _ergazomenoi = null;
    let _sxeshErgasias = null;
    let _kathestosApasxolhshs = null;
    let _oikogeneiakhKatastash = null;
    let _typosErgazomenoy = null;
    let _genikesParametroi = null;
    let _asfalistikesKlaseis = null;
    let _astheneies = null;
    let _argies = null;
    let message = null;

    let _MHNAS_APASXOLHSHS = null;
    let _SELECTED_ERGAZOMENOS = null;
    let _PRAGMATIKES_HMERES_ERGASIAS_MHNA = null;
    let _YPOKATASTHMA = null;

    // DOM elements
    const ypokatasthmataDropdown = document.getElementById('ypokatasthma');
    const ergazomenoiDropdown = document.getElementById('ergazomenos_kin');
    const periodoiDropdown = document.getElementById('periodos');
    const typoiApodoxonDropdown = document.getElementById('typosApodoxon');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const generateWorkFactsSnapshotButton = document.getElementById(
        'generateWorkFactsSnapshotButton'
    );
    const generateBatchWorkFactsSnapshotsButton = document.getElementById(
        'generateBatchWorkFactsSnapshotsButton'
    );
    const generateAllWorkFactsSnapshotsJobButton = document.getElementById(
        'generateAllWorkFactsSnapshotsJobButton'
    );
    const previewPayrollCalculationUnitsButton = document.getElementById(
        'previewPayrollCalculationUnitsButton'
    );
    const configureWorkFactsSchedulerSlotButton = document.getElementById(
        'configureWorkFactsSchedulerSlotButton'
    );
    let ergazomenoiOptionsCache = [];
    let forcedErgazomenosRecordForNavigation = null;

    // Client-side cache για τα στοιχεία εργαζομένου που φορτώνονται από
    // /api/kinhseis/getLoipaStoixeiaErgazomenoy/...
    // Στόχος: όταν ο χρήστης πατάει prev/next και επιστρέφει σε εργαζόμενο
    // που έχει ήδη φορτωθεί, να μην ξαναγίνεται ίδιο fetch.
    const EMPLOYEE_DETAILS_CACHE_TTL_MS = 5 * 60 * 1000;
    const PAYROLL_DATA_CACHE_TTL_MS = 90 * 1000;
    const ANNUAL_OVERTIME_CACHE_TTL_MS = 5 * 60 * 1000;
    const STATIC_LOOKUP_CACHE_TTL_MS = 10 * 60 * 1000;
    const ADJACENT_PREFETCH_RADIUS = 2;

    const employeeDetailsCache = new Map();
    const employeeDetailsInFlight = new Map();
    const apasxolhseisCache = new Map();
    const apasxolhseisInFlight = new Map();
    const annualOvertimeCache = new Map();
    const annualOvertimeInFlight = new Map();
    const calcTotalsCache = new Map();
    const calcTotalsInFlight = new Map();
    const staticLookupCache = new Map();
    const staticLookupInFlight = new Map();

    let lastSessionTyposApodoxonSent = null;
    let lastSessionPeriodosSent = null;

    function getInputValue(id, defaultValue = '') {
        const element = document.getElementById(id);

        if (!element || element.value === undefined || element.value === null) {
            return defaultValue;
        }

        return String(element.value).trim();
    }

    function getCsrfToken() {
        return (
            document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
            document.querySelector('input[name="_csrf"]')?.value ||
            ''
        );
    }

    function getJsonHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        const csrfToken = getCsrfToken();

        if (csrfToken) {
            headers['CSRF-Token'] = csrfToken;
            headers['X-CSRF-Token'] = csrfToken;
        }

        return headers;
    }

    function showSnapshotActionMessage(icon, title, text) {
        if (window.Swal && typeof window.Swal.fire === 'function') {
            return window.Swal.fire({
                icon,
                title,
                text,
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-info custom-confirm-button custom-swal-button'
                }
            });
        }

        window.alert(text || title);
        return Promise.resolve();
    }

    function escapeSnapshotSummaryHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getSchedulerSlotTimezone() {
        return 'Europe/Athens';
    }

    function formatDateInputValue(date) {
        return [
            String(date.getFullYear()).padStart(4, '0'),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function formatTimeInputValue(date) {
        return [
            String(date.getHours()).padStart(2, '0'),
            String(date.getMinutes()).padStart(2, '0')
        ].join(':');
    }

    function getRoundedSchedulerSlotStartTime(stepMinutes = 5) {
        const date = new Date();
        const step = Number.parseInt(stepMinutes, 10) || 5;
        const roundedMinutes = Math.ceil(date.getMinutes() / step) * step;
        date.setMinutes(roundedMinutes, 0, 0);

        return formatTimeInputValue(date);
    }

    function getSchedulerSlotYpokatasthmaValue() {
        const currentSharedParams = window.sharedParams || sharedParams || {};
        const ypokatasthma =
            normalizeYpokatasthmaValue(currentSharedParams._YPOKATASTHMA) ||
            normalizeYpokatasthmaValue(currentSharedParams.ypokatasthma) ||
            normalizeYpokatasthmaValue(getInputValue('ypokatasthma_Hidden')) ||
            normalizeYpokatasthmaValue(ypokatasthmataDropdown?.value);

        return ypokatasthma || 'ALL';
    }

    function buildSchedulerSlotOptionLabel(slot = {}) {
        const slotDate = slot.slotDate || '-';
        const slotTime = slot.slotTime || '-';
        const timezone = slot.timezone || getSchedulerSlotTimezone();

        return `${slotDate} ${slotTime} (${timezone})`;
    }

    function buildSchedulerSlotModalHtml(state = {}) {
        const slots = Array.isArray(state.slots) ? state.slots : [];
        const selectedYpokatasthma = state.ypokatasthma || getSchedulerSlotYpokatasthmaValue();
        const selectedStepMinutes = String(state.stepMinutes || '5');
        const selectedSlotKey = state.selectedSlotKey || slots[0]?.slotKey || '';
        const slotsHtml = slots.length
            ? `
                <div class="mb-2 text-start">
                    <label for="availableSchedulerSlotSelect" class="form-label mb-1">Διαθέσιμες ώρες</label>
                    <select id="availableSchedulerSlotSelect" class="form-select form-select-sm">
                        ${slots.map((slot) => {
                            const value = escapeSnapshotSummaryHtml(slot.slotKey || `${slot.slotDate}|${slot.slotTime}`);
                            const selected = value === escapeSnapshotSummaryHtml(selectedSlotKey) ? ' selected' : '';
                            return `<option value="${value}"${selected}>${escapeSnapshotSummaryHtml(buildSchedulerSlotOptionLabel(slot))}</option>`;
                        }).join('')}
                    </select>
                </div>
            `
            : `
                <div class="alert alert-secondary py-2 mb-2 text-start">
                    Πατήστε "Αναζήτηση διαθέσιμων ωρών" για να εμφανιστούν διαθέσιμα slots.
                </div>
            `;
        const messageHtml = state.message
            ? `<div id="schedulerSlotValidationMessage" class="alert alert-${escapeSnapshotSummaryHtml(state.messageType || 'info')} py-2 mb-2 text-start">${escapeSnapshotSummaryHtml(state.message)}</div>`
            : '<div id="schedulerSlotValidationMessage" class="d-none"></div>';

        return `
            <div class="text-start">
                ${messageHtml}
                <div class="row g-2 mb-2">
                    <div class="col-6">
                        <label for="schedulerSlotStartDate" class="form-label mb-1">Ημερομηνία έναρξης</label>
                        <input type="date" id="schedulerSlotStartDate" class="form-control form-control-sm" value="${escapeSnapshotSummaryHtml(state.startDate || formatDateInputValue(new Date()))}">
                    </div>
                    <div class="col-6">
                        <label for="schedulerSlotStartTime" class="form-label mb-1">Ώρα έναρξης</label>
                        <input type="time" id="schedulerSlotStartTime" class="form-control form-control-sm" step="300" value="${escapeSnapshotSummaryHtml(state.startTime || getRoundedSchedulerSlotStartTime(5))}">
                    </div>
                </div>
                <div class="row g-2 mb-2">
                    <div class="col-6">
                        <label for="schedulerSlotStepMinutes" class="form-label mb-1">Βήμα</label>
                        <select id="schedulerSlotStepMinutes" class="form-select form-select-sm">
                            <option value="5"${selectedStepMinutes === '5' ? ' selected' : ''}>5 λεπτά</option>
                            <option value="10"${selectedStepMinutes === '10' ? ' selected' : ''}>10 λεπτά</option>
                        </select>
                    </div>
                    <div class="col-6">
                        <label for="schedulerSlotYpokatasthma" class="form-label mb-1">Υποκατάστημα</label>
                        <input type="text" id="schedulerSlotYpokatasthma" class="form-control form-control-sm" value="${escapeSnapshotSummaryHtml(selectedYpokatasthma)}" readonly>
                    </div>
                </div>
                <div class="mb-2">
                    <label for="schedulerSlotNotes" class="form-label mb-1">Notes</label>
                    <textarea id="schedulerSlotNotes" class="form-control form-control-sm" rows="2">${escapeSnapshotSummaryHtml(state.notes || '')}</textarea>
                </div>
                ${slotsHtml}
                <div class="d-flex justify-content-end gap-2 mt-3">
                    <button type="button" class="btn btn-sm btn-secondary" id="schedulerSlotCancelButton">Ακύρωση</button>
                    <button type="button" class="btn btn-sm btn-info" id="schedulerSlotSearchButton">Αναζήτηση διαθέσιμων ωρών</button>
                    <button type="button" class="btn btn-sm btn-success" id="schedulerSlotConfigureButton"${slots.length ? '' : ' disabled'}>Δέσμευση και ρύθμιση</button>
                </div>
            </div>
        `;
    }

    function getSchedulerSlotModalStateFromDom(previousState = {}) {
        return {
            ...previousState,
            startDate: getInputValue('schedulerSlotStartDate', previousState.startDate || ''),
            startTime: getInputValue('schedulerSlotStartTime', previousState.startTime || ''),
            timezone: previousState.timezone || getSchedulerSlotTimezone(),
            stepMinutes: getInputValue('schedulerSlotStepMinutes', previousState.stepMinutes || '5'),
            ypokatasthma: getInputValue(
                'schedulerSlotYpokatasthma',
                previousState.ypokatasthma || getSchedulerSlotYpokatasthmaValue()
            ),
            notes: getInputValue('schedulerSlotNotes', previousState.notes || ''),
            selectedSlotKey: getInputValue(
                'availableSchedulerSlotSelect',
                previousState.selectedSlotKey || ''
            )
        };
    }

    function getSchedulerSlotApiMessage(response, data, fallbackMessage) {
        if (response.status === 400) {
            const warnings = Array.isArray(data?.warnings) ? data.warnings.join(' | ') : '';
            return data?.message || warnings || 'Ελέγξτε τα στοιχεία της φόρμας.';
        }

        if (response.status === 403) {
            return 'Δεν έχετε δικαίωμα για ρύθμιση scheduler.';
        }

        if (response.status === 409) {
            return 'Η ώρα δεσμεύτηκε ήδη. Επιλέξτε άλλη διαθέσιμη ώρα.';
        }

        if (response.status >= 500) {
            return 'Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά αργότερα.';
        }

        return data?.message || fallbackMessage;
    }

    async function fetchAvailableSchedulerSlots(state = {}) {
        const params = new URLSearchParams({
            startDate: state.startDate,
            startTime: state.startTime,
            timezone: state.timezone || getSchedulerSlotTimezone(),
            stepMinutes: String(state.stepMinutes || '5'),
            limit: '20',
            maxDays: '31'
        });
        const response = await fetch(
            `/api/kinhseis/workFactsSchedulerSlots/available?${params.toString()}`,
            {
                method: 'GET',
                credentials: 'same-origin',
                skipLoader: true
            }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success !== true) {
            const error = new Error(
                getSchedulerSlotApiMessage(
                    response,
                    data,
                    'Δεν ήταν δυνατή η ανάκτηση διαθέσιμων slots.'
                )
            );
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return Array.isArray(data.slots) ? data.slots : [];
    }

    async function postConfigureSchedulerSlot(state = {}) {
        const slot = (Array.isArray(state.slots) ? state.slots : []).find((item) => {
            const key = item.slotKey || `${item.slotDate}|${item.slotTime}`;
            return key === state.selectedSlotKey;
        });

        if (!slot) {
            const error = new Error('Επιλέξτε διαθέσιμη ώρα.');
            error.status = 400;
            throw error;
        }

        const payload = {
            slotDate: slot.slotDate,
            slotTime: slot.slotTime,
            timezone: slot.timezone || state.timezone || getSchedulerSlotTimezone(),
            stepMinutes: Number.parseInt(state.stepMinutes, 10) || 5,
            ypokatasthma: state.ypokatasthma || 'ALL',
            notes: state.notes || ''
        };
        const response = await fetch('/api/kinhseis/workFactsSchedulerSlots/configure', {
            method: 'POST',
            credentials: 'same-origin',
            skipLoader: true,
            headers: getJsonHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success !== true) {
            const error = new Error(
                getSchedulerSlotApiMessage(
                    response,
                    data,
                    'Δεν ήταν δυνατή η ρύθμιση scheduler slot.'
                )
            );
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return {
            data,
            slot
        };
    }

    function updateSchedulerSlotModal(state) {
        window.Swal.update({
            html: buildSchedulerSlotModalHtml(state)
        });
        attachSchedulerSlotModalHandlers(state);
    }

    function setSchedulerSlotButtonLoading(button, loadingText) {
        if (!button) return () => {};

        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = loadingText;

        return () => {
            button.innerHTML = originalHtml;
            button.disabled = false;
        };
    }

    function attachSchedulerSlotModalHandlers(state) {
        const cancelButton = document.getElementById('schedulerSlotCancelButton');
        const searchButton = document.getElementById('schedulerSlotSearchButton');
        const configureButton = document.getElementById('schedulerSlotConfigureButton');

        if (cancelButton) {
            cancelButton.addEventListener('click', function () {
                window.Swal.close();
            });
        }

        if (searchButton) {
            searchButton.addEventListener('click', async function () {
                const nextState = getSchedulerSlotModalStateFromDom(state);
                if (!nextState.startDate || !nextState.startTime) {
                    updateSchedulerSlotModal({
                        ...nextState,
                        messageType: 'warning',
                        message: 'Συμπληρώστε ημερομηνία και ώρα έναρξης.'
                    });
                    return;
                }

                const restoreButton = setSchedulerSlotButtonLoading(
                    searchButton,
                    'Αναζήτηση...'
                );

                try {
                    const slots = await fetchAvailableSchedulerSlots(nextState);
                    updateSchedulerSlotModal({
                        ...nextState,
                        slots,
                        selectedSlotKey: slots[0]?.slotKey || '',
                        messageType: slots.length ? 'info' : 'warning',
                        message: slots.length
                            ? `Βρέθηκαν ${slots.length} διαθέσιμα slots.`
                            : 'Δεν βρέθηκαν διαθέσιμες ώρες με τα κριτήρια που δώσατε.'
                    });
                } catch (error) {
                    updateSchedulerSlotModal({
                        ...nextState,
                        slots: [],
                        messageType: error.status === 403 ? 'warning' : 'danger',
                        message: error.message || 'Δεν ήταν δυνατή η ανάκτηση διαθέσιμων slots.'
                    });
                } finally {
                    restoreButton();
                }
            });
        }

        if (configureButton) {
            configureButton.addEventListener('click', async function () {
                const nextState = getSchedulerSlotModalStateFromDom(state);
                const restoreButton = setSchedulerSlotButtonLoading(
                    configureButton,
                    'Ρύθμιση...'
                );

                try {
                    const result = await postConfigureSchedulerSlot(nextState);
                    window.Swal.close();
                    await showSnapshotActionMessage(
                        'success',
                        'Ολοκληρώθηκε',
                        `Ρυθμίστηκε scheduler slot για ${result.slot.slotDate} ${result.slot.slotTime}.`
                    );
                } catch (error) {
                    if (error.status === 409) {
                        const refreshedState = {
                            ...nextState,
                            messageType: 'warning',
                            message: 'Η ώρα δεσμεύτηκε ήδη. Επιλέξτε άλλη διαθέσιμη ώρα.'
                        };

                        try {
                            const slots = await fetchAvailableSchedulerSlots(refreshedState);
                            updateSchedulerSlotModal({
                                ...refreshedState,
                                slots,
                                selectedSlotKey: slots[0]?.slotKey || ''
                            });
                        } catch (refreshError) {
                            updateSchedulerSlotModal({
                                ...refreshedState,
                                slots: [],
                                message:
                                    refreshError.message ||
                                    'Η ώρα δεσμεύτηκε ήδη. Δεν ήταν δυνατή η ανανέωση διαθέσιμων ωρών.'
                            });
                        }
                        return;
                    }

                    updateSchedulerSlotModal({
                        ...nextState,
                        messageType: error.status === 403 ? 'warning' : 'danger',
                        message: error.message || 'Δεν ήταν δυνατή η ρύθμιση scheduler slot.'
                    });
                } finally {
                    restoreButton();
                }
            });
        }
    }

    async function handleConfigureWorkFactsSchedulerSlotClick(event) {
        const button = event.currentTarget;
        if (!button || button.disabled) return;

        if (!window.Swal || typeof window.Swal.fire !== 'function') {
            await showSnapshotActionMessage(
                'error',
                'Μη διαθέσιμο',
                'Δεν είναι διαθέσιμο το παράθυρο ρύθμισης scheduler.'
            );
            return;
        }

        const initialState = {
            startDate: formatDateInputValue(new Date()),
            startTime: getRoundedSchedulerSlotStartTime(5),
            timezone: getSchedulerSlotTimezone(),
            stepMinutes: '5',
            ypokatasthma: getSchedulerSlotYpokatasthmaValue(),
            notes: '',
            slots: []
        };

        await window.Swal.fire({
            title: 'Ρύθμιση scheduler',
            html: buildSchedulerSlotModalHtml(initialState),
            width: 'min(720px, calc(100vw - 2rem))',
            showConfirmButton: false,
            showCancelButton: false,
            allowOutsideClick: false,
            didOpen: function () {
                attachSchedulerSlotModalHandlers(initialState);
            }
        });
    }

    function getSnapshotSummaryTotals(data = {}) {
        const totals = data.totals && typeof data.totals === 'object' ? data.totals : {};

        return {
            eligible: Number.parseInt(totals.eligible, 10) || 0,
            generated: Number.parseInt(totals.generated, 10) || 0,
            reused: Number.parseInt(totals.reused, 10) || 0,
            locked: Number.parseInt(totals.locked, 10) || 0,
            failed: Number.parseInt(totals.failed, 10) || 0,
            skippedExistingReady: Number.parseInt(totals.skippedExistingReady, 10) || 0,
            dryRunEligible: Number.parseInt(totals.dryRunEligible, 10) || 0
        };
    }

    function buildBatchSnapshotSummaryHtml(data = {}, options = {}) {
        const totals = getSnapshotSummaryTotals(data);
        const warnings = Array.isArray(data.warnings) ? data.warnings : [];
        const rows = [
            ['Περίοδος', `${data.apo || '-'} έως ${data.eos || '-'}`],
            ['Max εργαζόμενοι', data.maxEmployees || 5],
            ['Eligible', totals.eligible],
            ['Dry-run eligible', totals.dryRunEligible],
            ['Generated', totals.generated],
            ['Reused READY', totals.reused],
            ['Locked', totals.locked],
            ['Failed', totals.failed],
            ['Skipped existing READY', totals.skippedExistingReady]
        ];
        const summaryRows = rows
            .map(([label, value]) => (
                `<div><strong>${escapeSnapshotSummaryHtml(label)}:</strong> ` +
                `${escapeSnapshotSummaryHtml(value)}</div>`
            ))
            .join('');
        const warningHtml = warnings.length
            ? '<hr><div><strong>Warnings:</strong></div>' +
              warnings
                  .slice(0, 5)
                  .map((warning) => `<div>${escapeSnapshotSummaryHtml(warning)}</div>`)
                  .join('')
            : '';
        const intro = options.intro ? `<p>${escapeSnapshotSummaryHtml(options.intro)}</p>` : '';

        return intro + summaryRows + warningHtml;
    }

    async function confirmBatchSnapshotGenerate(dryRunData) {
        const html = buildBatchSnapshotSummaryHtml(dryRunData, {
            intro:
                'Θα δημιουργηθούν snapshots για έως 5 εργαζόμενους της περιόδου. ' +
                'Δεν θα γίνει overwrite σε υπάρχοντα READY ή locked snapshots.'
        });

        if (window.Swal && typeof window.Swal.fire === 'function') {
            const result = await window.Swal.fire({
                icon: 'question',
                title: 'Επιβεβαίωση batch snapshots',
                html,
                showCancelButton: true,
                confirmButtonText: 'Δημιουργία',
                cancelButtonText: 'Ακύρωση',
                customClass: {
                    confirmButton: 'class-info custom-confirm-button custom-swal-button',
                    cancelButton: 'class-secondary custom-cancel-button custom-swal-button'
                }
            });

            return result.isConfirmed === true;
        }

        return window.confirm(
            'Θα δημιουργηθούν snapshots για έως 5 εργαζόμενους της περιόδου. Συνέχεια;'
        );
    }

    async function showBatchSnapshotResult(data = {}) {
        const totals = getSnapshotSummaryTotals(data);
        const icon = data.success === false
            ? 'error'
            : totals.failed > 0 || data.partialFailure === true
                ? 'warning'
                : 'success';

        if (window.Swal && typeof window.Swal.fire === 'function') {
            return window.Swal.fire({
                icon,
                title: data.success === false
                    ? 'Αποτυχία batch snapshot'
                    : 'Ολοκληρώθηκε batch snapshot',
                html: buildBatchSnapshotSummaryHtml(data),
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-info custom-confirm-button custom-swal-button'
                }
            });
        }

        return showSnapshotActionMessage(
            icon,
            data.success === false ? 'Αποτυχία batch snapshot' : 'Ολοκληρώθηκε batch snapshot',
            `Generated: ${totals.generated}, Reused: ${totals.reused}, ` +
                `Locked: ${totals.locked}, Failed: ${totals.failed}`
        );
    }

    function getSnapshotActionPayload() {
        const currentSharedParams = window.sharedParams || sharedParams || {};
        const employee = currentSharedParams.ergazomenoi || {};
        const kodikos = String(employee.kodikos || getInputValue('kodikosHidden')).trim();
        const apo = currentSharedParams.startDate;
        const eos = currentSharedParams.endDate;
        const ypokatasthma =
            normalizeYpokatasthmaValue(currentSharedParams._YPOKATASTHMA) ||
            normalizeYpokatasthmaValue(currentSharedParams.ypokatasthma) ||
            normalizeYpokatasthmaValue(getInputValue('ypokatasthma_Hidden')) ||
            '0000';

        return {
            kodikos,
            apo,
            eos,
            ypokatasthma,
            scope: 'MONTHLY',
            force: false
        };
    }

    function getBatchSnapshotActionPayload(dryRun) {
        const currentSharedParams = window.sharedParams || sharedParams || {};
        const apo = currentSharedParams.startDate;
        const eos = currentSharedParams.endDate;
        const ypokatasthma =
            normalizeYpokatasthmaValue(currentSharedParams._YPOKATASTHMA) ||
            normalizeYpokatasthmaValue(currentSharedParams.ypokatasthma) ||
            normalizeYpokatasthmaValue(getInputValue('ypokatasthma_Hidden')) ||
            '0000';

        return {
            apo,
            eos,
            ypokatasthma,
            scope: 'MONTHLY',
            force: false,
            maxEmployees: 5,
            dryRun: dryRun === true
        };
    }

    function getAllBatchSnapshotJobPayload() {
        const currentSharedParams = window.sharedParams || sharedParams || {};
        const apo = currentSharedParams.startDate;
        const eos = currentSharedParams.endDate;
        const ypokatasthma =
            normalizeYpokatasthmaValue(currentSharedParams._YPOKATASTHMA) ||
            normalizeYpokatasthmaValue(currentSharedParams.ypokatasthma) ||
            normalizeYpokatasthmaValue(getInputValue('ypokatasthma_Hidden')) ||
            '0000';

        return {
            apo,
            eos,
            ypokatasthma,
            scope: 'MONTHLY',
            force: false
        };
    }

    function normalizePreviewDateInputValue(value) {
        const raw = String(value || '').trim().slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
    }

    function getPreviewYpokatasthmaValue() {
        const currentSharedParams = window.sharedParams || sharedParams || {};
        const ypokatasthma =
            normalizeYpokatasthmaValue(currentSharedParams._YPOKATASTHMA) ||
            normalizeYpokatasthmaValue(currentSharedParams.ypokatasthma) ||
            normalizeYpokatasthmaValue(getInputValue('ypokatasthma_Hidden')) ||
            normalizeYpokatasthmaValue(ypokatasthmataDropdown?.value);

        return ypokatasthma || 'ALL';
    }

    function getPreviewActionDefaults() {
        const currentSharedParams = window.sharedParams || sharedParams || {};
        const employee = currentSharedParams.ergazomenoi || {};
        const employeeId = String(employee.kodikos || getInputValue('kodikosHidden')).trim();

        return {
            apoDate: normalizePreviewDateInputValue(currentSharedParams.startDate),
            eosDate: normalizePreviewDateInputValue(currentSharedParams.endDate),
            employeeId,
            ypokatasthma: getPreviewYpokatasthmaValue()
        };
    }

    async function promptPayrollCalculationUnitsPreviewParams(defaults = {}) {
        if (!window.Swal || typeof window.Swal.fire !== 'function') {
            return null;
        }

        const result = await window.Swal.fire({
            icon: 'info',
            title: 'Preview μισθοδοσιών',
            html: `
                <div class="text-start">
                    <div class="alert alert-info py-2 mb-3">
                        Δεν έγινε αποθήκευση. Το preview είναι μόνο ενημερωτικό.
                    </div>
                    <div class="row g-2">
                        <div class="col-6">
                            <label for="previewPayrollApoDate" class="form-label mb-1">Από</label>
                            <input type="date" id="previewPayrollApoDate" class="form-control form-control-sm" value="${escapeSnapshotSummaryHtml(defaults.apoDate || '')}">
                        </div>
                        <div class="col-6">
                            <label for="previewPayrollEosDate" class="form-label mb-1">Έως</label>
                            <input type="date" id="previewPayrollEosDate" class="form-control form-control-sm" value="${escapeSnapshotSummaryHtml(defaults.eosDate || '')}">
                        </div>
                    </div>
                    <div class="small text-muted mt-2">
                        Εργαζόμενος: ${escapeSnapshotSummaryHtml(defaults.employeeId || 'όλοι οι εργαζόμενοι του scope')}
                    </div>
                    <div class="small text-muted">
                        Υποκατάστημα: ${escapeSnapshotSummaryHtml(defaults.ypokatasthma || 'ALL')}
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Προβολή preview',
            cancelButtonText: 'Ακύρωση',
            focusConfirm: false,
            customClass: {
                confirmButton: 'class-info custom-confirm-button custom-swal-button',
                cancelButton: 'class-secondary custom-cancel-button custom-swal-button'
            },
            preConfirm: function () {
                const apoDate = normalizePreviewDateInputValue(
                    document.getElementById('previewPayrollApoDate')?.value
                );
                const eosDate = normalizePreviewDateInputValue(
                    document.getElementById('previewPayrollEosDate')?.value
                );

                if (!apoDate || !eosDate) {
                    window.Swal.showValidationMessage('Συμπληρώστε ημερομηνίες Από και Έως.');
                    return false;
                }

                if (apoDate > eosDate) {
                    window.Swal.showValidationMessage('Η ημερομηνία Από πρέπει να είναι <= Έως.');
                    return false;
                }

                return {
                    apoDate,
                    eosDate,
                    employeeId: defaults.employeeId || '',
                    ypokatasthma: defaults.ypokatasthma || 'ALL'
                };
            }
        });

        return result.isConfirmed ? result.value : null;
    }

    function buildPayrollCalculationUnitsPreviewUrl(params = {}) {
        const query = new URLSearchParams();
        query.set('apoDate', params.apoDate);
        query.set('eosDate', params.eosDate);

        if (params.employeeId) {
            query.set('employeeId', params.employeeId);
        }

        if (params.ypokatasthma) {
            query.set('ypokatasthma', params.ypokatasthma);
        }

        return `/api/kinhseis/payrollCalculationUnits/preview?${query.toString()}`;
    }

    async function fetchPayrollCalculationUnitsPreview(params = {}) {
        const response = await fetch(buildPayrollCalculationUnitsPreviewUrl(params), {
            method: 'GET',
            credentials: 'same-origin',
            skipLoader: true
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success !== true) {
            const error = new Error(
                data?.message ||
                    (response.status === 400
                        ? 'Λείπουν ή δεν είναι έγκυρα στοιχεία.'
                        : response.status === 403
                            ? 'Δεν έχετε δικαίωμα για το preview.'
                            : 'Αποτυχία preview μισθοδοσιών.')
            );
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data;
    }

    function formatPayrollPhaseLabel(value) {
        const raw = String(value || '').trim();
        const normalized = raw.toUpperCase();
        const map = {
            PLHRHS: 'ΠΛΗΡΗΣ',
            PLIHRIS: 'ΠΛΗΡΗΣ',
            FULL: 'ΠΛΗΡΗΣ',
            MERIKH: 'ΜΕΡΙΚΗ',
            MERIKI: 'ΜΕΡΙΚΗ',
            PARTIAL: 'ΜΕΡΙΚΗ',
            EK_PERITROPHS: 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ',
            EK_PERITROPIS: 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ',
            EK_PERITROPH: 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ',
            ROTATING: 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ'
        };

        return map[normalized] || raw;
    }

    function formatPayrollPreviewDate(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return raw;
        return `${match[3]}/${match[2]}/${match[1]}`;
    }

    function formatPayrollPreviewWarning(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';

        const employeeMatch = raw.match(/^EMPLOYEE:([^:]+):(.*)$/);
        const employeePrefix = employeeMatch ? `Εργαζόμενος ${employeeMatch[1]}: ` : '';
        const message = employeeMatch ? employeeMatch[2] : raw;
        const warningMap = {
            CONTRACT_HISTORY_MISSING: 'Δεν βρέθηκε ιστορικό σύμβασης',
            PREDECLARED_HOURS_MISSING: 'Προδηλωμένη εργασία χωρίς απολογιστικές ώρες'
        };
        const code = Object.keys(warningMap).find((warningCode) =>
            message.includes(warningCode)
        );

        if (!code) {
            return employeePrefix + message;
        }

        return employeePrefix + message.replace(code, warningMap[code]);
    }

    function buildPreviewPhaseGroupsHtml(groupsByPhase = []) {
        if (!Array.isArray(groupsByPhase) || groupsByPhase.length === 0) {
            return '<div class="text-muted small">Δεν υπάρχουν ομάδες ανά φάση.</div>';
        }

        return groupsByPhase
            .map((group) => {
                const phaseLabel = formatPayrollPhaseLabel(
                    group.phaseLabel || group.printPhaseKey || '-'
                );

                return (
                    '<div class="border rounded p-2 mb-2 bg-white">' +
                    `<div><strong>${escapeSnapshotSummaryHtml(phaseLabel)}</strong></div>` +
                    `<div>Εργαζόμενοι: ${escapeSnapshotSummaryHtml(group.employeesCount || 0)}</div>` +
                    `<div>Μισθοδοσίες: ${escapeSnapshotSummaryHtml(group.calculationUnitsCount || 0)}</div>` +
                    `<div>Εκτυπώσεις: ${escapeSnapshotSummaryHtml(group.printGroupsCount || 0)}</div>` +
                    '</div>'
                );
            })
            .join('');
    }

    function buildPreviewEmployeeHtml(employee = {}) {
        const units = Array.isArray(employee.units) ? employee.units : [];
        const printGroups = Array.isArray(employee.printGroups) ? employee.printGroups : [];
        const unitsHtml = units.length
            ? units
                  .map((unit) => {
                      const phaseLabel = formatPayrollPhaseLabel(unit.phaseLabel || '-');
                      const fromDate = formatPayrollPreviewDate(unit.fromDate || '-');
                      const toDate = formatPayrollPreviewDate(unit.toDate || '-');

                      return (
                          '<li class="mb-1">' +
                          `α/α ${escapeSnapshotSummaryHtml(unit.aa_misthodosias || '-')} ` +
                          `${escapeSnapshotSummaryHtml(fromDate || '-')} έως ${escapeSnapshotSummaryHtml(toDate || '-')} ` +
                          `(${escapeSnapshotSummaryHtml(phaseLabel)})` +
                          '</li>'
                      );
                  })
                  .join('')
            : '<li class="text-muted">Δεν υπάρχουν μισθοδοσίες.</li>';
        const printGroupsHtml = printGroups.length
            ? printGroups
                  .map((group) => {
                      const phaseLabel = formatPayrollPhaseLabel(
                          group.phaseLabel || group.printPhaseKey || '-'
                      );

                      return (
                          '<li class="mb-1">' +
                          `${escapeSnapshotSummaryHtml(phaseLabel)} ` +
                          `α/α: ${escapeSnapshotSummaryHtml((group.aa_misthodosiasList || []).join(', ') || '-')} ` +
                          `διαστήματα: ${escapeSnapshotSummaryHtml(group.intervalsCount || 0)}` +
                          '</li>'
                      );
                  })
                  .join('')
            : '<li class="text-muted">Δεν υπάρχουν εκτυπώσεις.</li>';

        return `
            <div class="border rounded p-2 mb-2 bg-white">
                <div><strong>${escapeSnapshotSummaryHtml(employee.kodikos || '-')}</strong> ${escapeSnapshotSummaryHtml(employee.fullName || '')}</div>
                <div>Μισθοδοσίες: ${escapeSnapshotSummaryHtml(employee.calculationUnitsCount || 0)}</div>
                <div>Εκτυπώσεις: ${escapeSnapshotSummaryHtml(employee.printGroupsCount || 0)}</div>
                <div class="mt-2"><strong>Μισθοδοσίες</strong></div>
                <ul class="mb-2 ps-3">${unitsHtml}</ul>
                <div><strong>Εκτυπώσεις</strong></div>
                <ul class="mb-0">${printGroupsHtml}</ul>
            </div>
        `;
    }

    function buildPayrollCalculationUnitsPreviewHtml(data = {}) {
        const totals = data.totals && typeof data.totals === 'object' ? data.totals : {};
        const period = data.period && typeof data.period === 'object' ? data.period : {};
        const periodApo = formatPayrollPreviewDate(period.apo || '');
        const periodEos = formatPayrollPreviewDate(period.eos || '');
        const periodHtml = periodApo || periodEos
            ? `<div class="small text-muted mb-3">Περίοδος: ${escapeSnapshotSummaryHtml(periodApo || '-')} έως ${escapeSnapshotSummaryHtml(periodEos || '-')}</div>`
            : '';
        const employees = Array.isArray(data.employees) ? data.employees : [];
        const warnings = Array.isArray(data.warnings) ? data.warnings : [];
        const employeesHtml = employees.length
            ? employees.map(buildPreviewEmployeeHtml).join('')
            : '<div class="text-muted">Δεν βρέθηκαν εργαζόμενοι.</div>';
        const warningsHtml = warnings.length
            ? '<hr><h6>Προειδοποιήσεις</h6><div class="d-grid gap-2">' +
              warnings
                  .slice(0, 12)
                  .map((warning) => (
                      '<div class="alert alert-warning py-2 px-2 mb-0 small apasxolhseis-preview-warning">' +
                      escapeSnapshotSummaryHtml(formatPayrollPreviewWarning(warning)) +
                      '</div>'
                  ))
                  .join('') +
              '</div>'
            : '';

        return `
            <div class="text-start apasxolhseis-preview-modal-content">
                <div class="alert alert-info py-2">
                    Δεν έγινε αποθήκευση. Το preview είναι μόνο ενημερωτικό.
                </div>
                ${periodHtml}
                <div class="row g-2 mb-3">
                    <div class="col-6 col-lg-3">
                        <div class="border rounded p-2 bg-white h-100">
                            <div class="small text-muted">Εργαζόμενοι</div>
                            <div class="fw-semibold">${escapeSnapshotSummaryHtml(totals.employeesCount || 0)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="border rounded p-2 bg-white h-100">
                            <div class="small text-muted">Μισθοδοσίες</div>
                            <div class="fw-semibold">${escapeSnapshotSummaryHtml(totals.calculationUnitsCount || 0)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="border rounded p-2 bg-white h-100">
                            <div class="small text-muted">Αποθηκεύσεις</div>
                            <div class="fw-semibold">${escapeSnapshotSummaryHtml(totals.saveOperationsCount || 0)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="border rounded p-2 bg-white h-100">
                            <div class="small text-muted">Εκτυπώσεις</div>
                            <div class="fw-semibold">${escapeSnapshotSummaryHtml(totals.printGroupsCount || 0)}</div>
                        </div>
                    </div>
                </div>
                <hr>
                <h6>Ομάδες ανά φάση</h6>
                ${buildPreviewPhaseGroupsHtml(data.groupsByPhase)}
                <hr>
                <h6>Ανά εργαζόμενο</h6>
                ${employeesHtml}
                ${warningsHtml}
            </div>
        `;
    }

    async function postBatchSnapshotAction(payload) {
        const csrfToken = getCsrfToken();
        const requestPayload = csrfToken ? { ...payload, _csrf: csrfToken } : payload;
        const response = await fetch('/api/kinhseis/workFactsSnapshot/batch-generate', {
            method: 'POST',
            credentials: 'same-origin',
            skipLoader: true,
            headers: getJsonHeaders(),
            body: JSON.stringify(requestPayload)
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok && data?.success !== true) {
            const error = new Error(data?.message || data?.reason || 'Αποτυχία batch snapshot.');
            error.payload = data;
            throw error;
        }

        return data;
    }

    function buildBatchJobProgressHtml(job = {}) {
        const employeesTotal = Number.parseInt(job.employeesTotal, 10) || 0;
        const employeesDone = Number.parseInt(job.employeesDone, 10) || 0;
        const employeesSkipped = Number.parseInt(job.employeesSkipped, 10) || 0;
        const employeesFailed = Number.parseInt(job.employeesFailed, 10) || 0;
        const completed = employeesDone + employeesSkipped + employeesFailed;
        const percent = employeesTotal > 0
            ? Math.min(100, Math.round((completed / employeesTotal) * 100))
            : 0;
        const processedKodikos = Array.isArray(job.processedKodikos)
            ? job.processedKodikos
            : [];
        const lastProcessedKodikos = processedKodikos.length
            ? processedKodikos[processedKodikos.length - 1]
            : '-';
        const warningsCount = Array.isArray(job.warnings) ? job.warnings.length : 0;

        return [
            ['Status', job.status || '-'],
            ['Σύνολο εργαζομένων', employeesTotal],
            ['Generated', employeesDone],
            ['Skipped', employeesSkipped],
            ['Failed', employeesFailed],
            ['Progress', employeesTotal > 0 ? `${percent}%` : '-'],
            ['Τελευταίος κωδικός', lastProcessedKodikos],
            ['Warnings', warningsCount]
        ]
            .map(([label, value]) => (
                `<div><strong>${escapeSnapshotSummaryHtml(label)}:</strong> ` +
                `${escapeSnapshotSummaryHtml(value)}</div>`
            ))
            .join('');
    }

    function buildBatchJobFinalHtml(job = {}) {
        const failedEmployees = Array.isArray(job.failedEmployees) ? job.failedEmployees : [];
        const warningsCount = Array.isArray(job.warnings) ? job.warnings.length : 0;
        const failedHtml = failedEmployees.length
            ? '<hr><div><strong>Failed employees:</strong></div>' +
              failedEmployees
                  .slice(0, 5)
                  .map((employee) => (
                      '<div>' +
                      `${escapeSnapshotSummaryHtml(employee.kodikos || '-')}: ` +
                      `${escapeSnapshotSummaryHtml(employee.errorMessage || '-')}` +
                      '</div>'
                  ))
                  .join('')
            : '';
        const errorHtml = job.errorMessage
            ? `<hr><div><strong>Error:</strong> ${escapeSnapshotSummaryHtml(job.errorMessage)}</div>`
            : '';

        return buildBatchJobProgressHtml({
            ...job,
            warnings: Array.from({ length: warningsCount })
        }) + failedHtml + errorHtml;
    }

    async function confirmAllBatchSnapshotJob() {
        const text =
            'Θα ξεκινήσει batch job για όλους τους eligible εργαζόμενους της περιόδου. ' +
            'Δεν θα γίνει overwrite σε υπάρχοντα READY ή locked snapshots. ' +
            'Το job θα συνεχίσει στο background όσο η εφαρμογή τρέχει.';
        const html = `
            <div class="apasxolhseis-snapshot-confirm-html">
                <p>Θα ξεκινήσει batch job για όλους τους eligible εργαζόμενους της περιόδου.</p>
                <p class="mb-0">Δεν θα γίνει overwrite σε υπάρχοντα READY ή locked snapshots. Το job θα συνεχίσει στο background όσο η εφαρμογή τρέχει.</p>
            </div>
        `;

        if (window.Swal && typeof window.Swal.fire === 'function') {
            const result = await window.Swal.fire({
                icon: 'question',
                title: 'Snapshots για όλη την περίοδο',
                html,
                width: 'min(720px, calc(100vw - 2rem))',
                showCancelButton: true,
                confirmButtonText: 'Δημιουργία',
                cancelButtonText: 'Ακύρωση',
                customClass: {
                    popup: 'apasxolhseis-snapshot-confirm-popup',
                    htmlContainer: 'apasxolhseis-snapshot-confirm-html',
                    actions: 'apasxolhseis-snapshot-confirm-actions',
                    confirmButton: 'class-info custom-confirm-button custom-swal-button',
                    cancelButton: 'class-secondary custom-cancel-button custom-swal-button'
                }
            });

            return result.isConfirmed === true;
        }

        return window.confirm(text);
    }

    async function postAllBatchSnapshotJob(payload) {
        const csrfToken = getCsrfToken();
        const requestPayload = csrfToken ? { ...payload, _csrf: csrfToken } : payload;
        const response = await fetch('/api/kinhseis/workFactsSnapshot/batch-jobs', {
            method: 'POST',
            credentials: 'same-origin',
            skipLoader: true,
            headers: getJsonHeaders(),
            body: JSON.stringify(requestPayload)
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok && data?.success !== true) {
            const error = new Error(data?.message || data?.reason || 'Αποτυχία εκκίνησης job.');
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data;
    }

    async function fetchBatchSnapshotJobStatus(jobId) {
        const response = await fetch(
            `/api/kinhseis/workFactsSnapshot/batch-jobs/${encodeURIComponent(jobId)}`,
            {
                method: 'GET',
                credentials: 'same-origin',
                skipLoader: true
            }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success !== true) {
            const error = new Error(data?.message || data?.reason || 'Αποτυχία status job.');
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data.job || {};
    }

    async function showBatchJobProgress(job = {}) {
        if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire({
                title: 'Batch snapshots σε εξέλιξη',
                html: buildBatchJobProgressHtml(job),
                allowOutsideClick: false,
                allowEscapeKey: true,
                showConfirmButton: false
            });
            return Promise.resolve();
        }

        window.alert('Batch snapshots σε εξέλιξη.');
    }

    function updateBatchJobProgress(job = {}) {
        if (
            window.Swal &&
            typeof window.Swal.update === 'function' &&
            typeof window.Swal.isVisible === 'function' &&
            window.Swal.isVisible()
        ) {
            window.Swal.update({
                title: 'Batch snapshots σε εξέλιξη',
                html: buildBatchJobProgressHtml(job)
            });
        }
    }

    async function showBatchJobFinalResult(job = {}) {
        const status = String(job.status || '').trim();
        const isFailed = status === 'FAILED' || status === 'CANCELLED';

        if (window.Swal && typeof window.Swal.fire === 'function') {
            return window.Swal.fire({
                icon: isFailed ? 'error' : 'success',
                title: isFailed
                    ? 'Απέτυχε batch snapshots'
                    : 'Ολοκληρώθηκε batch snapshots',
                html: buildBatchJobFinalHtml(job),
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-info custom-confirm-button custom-swal-button'
                }
            });
        }

        return showSnapshotActionMessage(
            isFailed ? 'error' : 'success',
            isFailed ? 'Απέτυχε batch snapshots' : 'Ολοκληρώθηκε batch snapshots',
            `Status: ${status || '-'}`
        );
    }

    async function pollBatchSnapshotJob(jobId) {
        const terminalStatuses = new Set(['SUCCESS', 'FAILED', 'CANCELLED']);
        const timeoutMs = 10 * 60 * 1000;
        const intervalMs = 2000;
        const startedAt = Date.now();
        let lastJob = {};

        while (Date.now() - startedAt <= timeoutMs) {
            const job = await fetchBatchSnapshotJobStatus(jobId);
            lastJob = job;
            updateBatchJobProgress(job);

            if (terminalStatuses.has(String(job.status || '').trim())) {
                return job;
            }

            await new Promise((resolve) => {
                window.setTimeout(resolve, intervalMs);
            });
        }

        const timeoutError = new Error('batch_job_poll_timeout');
        timeoutError.lastJob = lastJob;
        throw timeoutError;
    }

    async function handlePreviewPayrollCalculationUnitsClick(event) {
        const button = event.currentTarget;
        if (!button || button.disabled) return;

        if (!window.Swal || typeof window.Swal.fire !== 'function') {
            await showSnapshotActionMessage(
                'error',
                'Μη διαθέσιμο',
                'Δεν είναι διαθέσιμο το παράθυρο preview.'
            );
            return;
        }

        const params = await promptPayrollCalculationUnitsPreviewParams(
            getPreviewActionDefaults()
        );

        if (!params) return;

        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = 'Preview...';

        try {
            const data = await fetchPayrollCalculationUnitsPreview(params);

            await window.Swal.fire({
                icon: 'info',
                title: 'Preview μισθοδοσιών',
                html: buildPayrollCalculationUnitsPreviewHtml(data),
                width: 'min(960px, calc(100vw - 2rem))',
                confirmButtonText: 'Εντάξει',
                customClass: {
                    popup: 'apasxolhseis-preview-swal-popup',
                    htmlContainer: 'apasxolhseis-preview-swal-html',
                    confirmButton: 'class-info custom-confirm-button custom-swal-button'
                }
            });
        } catch (error) {
            const title = error.status === 400
                ? 'Λάθος στοιχεία'
                : error.status === 403
                    ? 'Δεν έχετε δικαίωμα'
                    : 'Σφάλμα preview';

            await showSnapshotActionMessage(
                error.status === 400 || error.status === 403 ? 'warning' : 'error',
                title,
                error.payload?.message || error.message || 'Αποτυχία preview μισθοδοσιών.'
            );
        } finally {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
    }

    async function handleGenerateWorkFactsSnapshotClick(event) {
        const button = event.currentTarget;
        if (!button || button.disabled) return;

        const payload = getSnapshotActionPayload();

        if (!payload.kodikos || !payload.apo || !payload.eos) {
            await showSnapshotActionMessage(
                'warning',
                'Λείπουν στοιχεία',
                'Επιλέξτε εργαζόμενο και περίοδο πρώτα.'
            );
            return;
        }

        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = 'Δημιουργία...';

        try {
            const csrfToken = getCsrfToken();
            const requestPayload = csrfToken ? { ...payload, _csrf: csrfToken } : payload;
            const response = await fetch('/api/kinhseis/workFactsSnapshot/generate', {
                method: 'POST',
                credentials: 'same-origin',
                skipLoader: true,
                headers: getJsonHeaders(),
                body: JSON.stringify(requestPayload)
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 409 && data?.reason === 'locked_snapshot') {
                await showSnapshotActionMessage(
                    'warning',
                    'Κλειδωμένο snapshot',
                    'Το snapshot είναι κλειδωμένο και δεν μπορεί να αλλάξει.'
                );
                return;
            }

            if (!response.ok || data?.success !== true) {
                await showSnapshotActionMessage(
                    'error',
                    'Σφάλμα',
                    data?.message || data?.reason || 'Αποτυχία δημιουργίας snapshot.'
                );
                return;
            }

            if (data.reused === true) {
                await showSnapshotActionMessage(
                    'info',
                    'Υπάρχον snapshot',
                    'Υπάρχει ήδη έτοιμο snapshot για την περίοδο.'
                );
                return;
            }

            await showSnapshotActionMessage(
                'success',
                'Ολοκληρώθηκε',
                'Δημιουργήθηκε snapshot περιόδου.'
            );
        } catch (error) {
            await showSnapshotActionMessage(
                'error',
                'Σφάλμα',
                'Αποτυχία δημιουργίας snapshot.'
            );
        } finally {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
    }

    async function handleGenerateBatchWorkFactsSnapshotsClick(event) {
        const button = event.currentTarget;
        if (!button || button.disabled) return;

        const dryRunPayload = getBatchSnapshotActionPayload(true);

        if (!dryRunPayload.apo || !dryRunPayload.eos) {
            await showSnapshotActionMessage(
                'warning',
                'Λείπει περίοδος',
                'Επιλέξτε περίοδο πρώτα.'
            );
            return;
        }

        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = 'Έλεγχος...';

        try {
            const dryRunData = await postBatchSnapshotAction(dryRunPayload);
            const dryRunTotals = getSnapshotSummaryTotals(dryRunData);

            if (dryRunTotals.eligible === 0) {
                await showSnapshotActionMessage(
                    'info',
                    'Δεν βρέθηκαν εργαζόμενοι',
                    'Δεν βρέθηκαν εργαζόμενοι που τέμνουν την επιλεγμένη περίοδο.'
                );
                return;
            }

            const confirmed = await confirmBatchSnapshotGenerate(dryRunData);
            if (!confirmed) return;

            button.innerHTML = 'Δημιουργία...';
            const generateData = await postBatchSnapshotAction(
                getBatchSnapshotActionPayload(false)
            );

            await showBatchSnapshotResult(generateData);
        } catch (error) {
            if (error.payload) {
                await showBatchSnapshotResult(error.payload);
                return;
            }

            await showSnapshotActionMessage(
                'error',
                'Σφάλμα',
                'Αποτυχία batch snapshot.'
            );
        } finally {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
    }

    async function handleGenerateAllWorkFactsSnapshotsJobClick(event) {
        const button = event.currentTarget;
        if (!button || button.disabled) return;

        if (button.dataset.allowed === '0') {
            await showSnapshotActionMessage(
                'warning',
                'Δεν έχετε δικαίωμα',
                'Δεν έχετε δικαίωμα για batch snapshots.'
            );
            return;
        }

        const payload = getAllBatchSnapshotJobPayload();

        if (!payload.apo || !payload.eos) {
            await showSnapshotActionMessage(
                'warning',
                'Λείπει περίοδος',
                'Επιλέξτε περίοδο πρώτα.'
            );
            return;
        }

        const confirmed = await confirmAllBatchSnapshotJob();
        if (!confirmed) return;

        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = 'Εκκίνηση...';

        try {
            const startedJob = await postAllBatchSnapshotJob(payload);
            const jobId = startedJob.jobId;

            if (!jobId) {
                throw new Error('missing_job_id');
            }

            if (startedJob.reason === 'already_running') {
                await showSnapshotActionMessage(
                    'info',
                    'Υπάρχει ενεργό job',
                    'Υπάρχει ήδη ενεργό batch snapshot job. Θα συνεχιστεί η παρακολούθηση.'
                );
            }

            await showBatchJobProgress({
                status: startedJob.status || 'RUNNING',
                employeesTotal: 0,
                employeesDone: 0,
                employeesSkipped: 0,
                employeesFailed: 0,
                processedKodikos: [],
                warnings: []
            });

            const finalJob = await pollBatchSnapshotJob(jobId);
            await showBatchJobFinalResult(finalJob);
        } catch (error) {
            if (error.message === 'batch_job_poll_timeout') {
                await showSnapshotActionMessage(
                    'warning',
                    'Το job συνεχίζει',
                    'Το polling σταμάτησε λόγω χρόνου. Το job μπορεί να συνεχίζει στο background.'
                );
                return;
            }

            if (error.status === 403 || error.payload?.reason === 'insufficient_privileges') {
                await showSnapshotActionMessage(
                    'warning',
                    'Δεν έχετε δικαίωμα',
                    'Δεν έχετε δικαίωμα για batch snapshots.'
                );
                return;
            }

            if (error.status === 404 || error.payload?.reason === 'not_found') {
                await showSnapshotActionMessage(
                    'error',
                    'Δεν βρέθηκε job',
                    'Δεν βρέθηκε το batch job.'
                );
                return;
            }

            if (error.payload?.reason === 'force_not_allowed') {
                await showSnapshotActionMessage(
                    'error',
                    'Μη επιτρεπτή ενέργεια',
                    'Το force:true δεν επιτρέπεται.'
                );
                return;
            }

            await showSnapshotActionMessage(
                'error',
                'Σφάλμα',
                error.payload?.message || 'Αποτυχία batch snapshot job.'
            );
        } finally {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
    }

    function extractResponseArray(payload) {
        if (Array.isArray(payload)) return payload;

        if (!payload || typeof payload !== 'object') return [];

        if (Array.isArray(payload.items)) return payload.items;
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.results)) return payload.results;
        if (Array.isArray(payload.docs)) return payload.docs;
        if (Array.isArray(payload.records)) return payload.records;

        return [];
    }

    function normalizeYpokatasthmaValue(value) {
        const normalizedValue = String(value || '').trim();

        if (
            !normalizedValue ||
            normalizedValue === '__ALL__' ||
            normalizedValue === 'ΟΛΑ...' ||
            normalizedValue === 'ALL'
        ) {
            return '';
        }

        return normalizedValue;
    }

    function syncYpokatasthmaHidden() {
        const hiddenElement = document.getElementById('ypokatasthma_Hidden');

        if (!hiddenElement) return '';

        hiddenElement.value = normalizeYpokatasthmaValue(ypokatasthmataDropdown?.value);

        return hiddenElement.value;
    }

    function getEnergoiSelection() {
        const selectEmployes = document.getElementById('selectEmployes');
        return selectEmployes ? selectEmployes.checked : true;
    }

    function syncEnergoiHidden(energoiValue) {
        const hiddenElement = document.getElementById('energoi');
        const finalValue = typeof energoiValue === 'boolean' ? energoiValue : getEnergoiSelection();

        if (hiddenElement) {
            hiddenElement.value = finalValue ? 'true' : 'false';
        }

        return finalValue ? 'true' : 'false';
    }

    function getErgazomenoiTomSelect() {
        return ergazomenoiDropdown?.tomselect || null;
    }

    function getTyposApodoxonTomSelect() {
        return typoiApodoxonDropdown?.tomselect || null;
    }

    function getPeriodosTomSelect() {
        return periodoiDropdown?.tomselect || null;
    }

    function normalizeTyposApodoxonOption(item = {}) {
        const kodikos = String(item.kodikos ?? item.value ?? item.id ?? '').trim();
        const rawPerigrafh = String(item.perigrafh ?? item.label ?? item.text ?? '').trim();
        const label = rawPerigrafh ? removeGreekAccentsAndToUpper(rawPerigrafh) : kodikos;

        return {
            ...item,
            value: kodikos,
            id: kodikos,
            kodikos,
            label,
            text: label,
            perigrafh: rawPerigrafh
        };
    }

    async function waitForTomSelect(selectElement, timeoutMs = 1200) {
        const startedAt = Date.now();

        while (selectElement && !selectElement.tomselect && Date.now() - startedAt < timeoutMs) {
            await delay(25);
        }

        return selectElement?.tomselect || null;
    }

    async function ensureTyposApodoxonOption(value) {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue) return null;

        const tom = await waitForTomSelect(typoiApodoxonDropdown);

        if (tom?.options?.[normalizedValue]) {
            return tom.options[normalizedValue];
        }

        const items = await fetchStaticLookupArray(
            `dropdown:typoiApodoxon:value:${normalizedValue}`,
            `/api/dropdown/kinhseis/apasxolhseis/typoiApodoxon?value=${encodeURIComponent(normalizedValue)}&search=&page=1&limit=1`
        );

        const item = normalizeTyposApodoxonOption(items[0] || { kodikos: normalizedValue });

        if (tom && item.value) {
            tom.addOption(item);
            tom.refreshOptions(false);
        }

        return item;
    }

    async function setTyposApodoxonTomValue(value, silent = true) {
        const normalizedValue = String(value || '').trim();
        const hidden = document.getElementById('typosApodoxon_Hidden');
        const typApodHidden = document.getElementById('typ_apod');

        if (hidden) hidden.value = normalizedValue;
        if (typApodHidden) typApodHidden.value = normalizedValue;

        const tom = await waitForTomSelect(typoiApodoxonDropdown);

        if (!normalizedValue) {
            if (tom) {
                tom.clear(silent);
                tom.refreshItems();
            } else if (typoiApodoxonDropdown) {
                typoiApodoxonDropdown.value = '';
            }
            return;
        }

        await ensureTyposApodoxonOption(normalizedValue);

        if (tom) {
            if (tom.getValue() !== normalizedValue) {
                tom.setValue(normalizedValue, silent);
            }
            tom.refreshItems();
            tom.refreshOptions(false);
            return;
        }

        if (typoiApodoxonDropdown) {
            if (
                !Array.from(typoiApodoxonDropdown.options || []).some(
                    (option) => option.value === normalizedValue
                )
            ) {
                const item = await ensureTyposApodoxonOption(normalizedValue);
                typoiApodoxonDropdown.appendChild(
                    new Option(item?.label || normalizedValue, normalizedValue)
                );
            }
            typoiApodoxonDropdown.value = normalizedValue;
        }
    }

    function normalizePeriodosOption(item = {}) {
        const kodikos = String(item.kodikos ?? item.value ?? item.id ?? '').trim();
        const rawPerigrafh = String(item.perigrafh ?? item.label ?? item.text ?? '').trim();
        const label = rawPerigrafh ? removeGreekAccentsAndToUpper(rawPerigrafh) : kodikos;

        return {
            ...item,
            value: kodikos,
            id: kodikos,
            kodikos,
            label,
            text: label,
            perigrafh: rawPerigrafh
        };
    }

    async function ensurePeriodosOption(value) {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue) return null;

        const tom = await waitForTomSelect(periodoiDropdown);

        if (tom?.options?.[normalizedValue]) {
            return tom.options[normalizedValue];
        }

        const xrhsh = getInputValue('etos') || new Date().getFullYear().toString();
        const items = await fetchStaticLookupArray(
            `dropdown:periodoi:${xrhsh}:value:${normalizedValue}`,
            `/api/dropdown/periodoi?xrhsh=${encodeURIComponent(xrhsh)}&value=${encodeURIComponent(normalizedValue)}&search=&page=1&limit=1`
        );

        const item = normalizePeriodosOption(items[0] || { kodikos: normalizedValue });

        if (tom && item.value) {
            tom.addOption(item);
            tom.refreshOptions(false);
        }

        return item;
    }

    async function setPeriodosTomValue(value, silent = true) {
        const normalizedValue = String(value || '').trim();
        const periodosHidden = document.getElementById('periodos_Hidden');
        const mhnasHidden = document.getElementById('mhnas');

        if (periodosHidden) periodosHidden.value = normalizedValue;
        if (mhnasHidden) mhnasHidden.value = normalizedValue;

        const tom = await waitForTomSelect(periodoiDropdown);

        if (!normalizedValue) {
            if (tom) {
                tom.clear(silent);
                tom.refreshItems();
            } else if (periodoiDropdown) {
                periodoiDropdown.value = '';
            }
            return;
        }

        await ensurePeriodosOption(normalizedValue);

        if (tom) {
            if (tom.getValue() !== normalizedValue) {
                tom.setValue(normalizedValue, silent);
            }
            tom.refreshItems();
            tom.refreshOptions(false);
            return;
        }

        if (periodoiDropdown) {
            if (
                !Array.from(periodoiDropdown.options || []).some(
                    (option) => option.value === normalizedValue
                )
            ) {
                const item = await ensurePeriodosOption(normalizedValue);
                periodoiDropdown.appendChild(
                    new Option(item?.label || normalizedValue, normalizedValue)
                );
            }
            periodoiDropdown.value = normalizedValue;
        }
    }

    function normalizeErgazomenosOption(item = {}) {
        const kodikos = String(item.kodikos ?? item.value ?? '').trim();
        const eponymo = String(item.eponymo ?? '')
            .trim()
            .toUpperCase();
        const patronymo = String(item.patronymo ?? '')
            .trim()
            .toUpperCase();
        const onoma = String(item.onoma ?? '')
            .trim()
            .toUpperCase();
        const id = String(item.id ?? item._id ?? item.value ?? '').trim();
        const ypokatasthma = String(item.ypokatasthma ?? '').trim();
        const afm = String(item.afm ?? '').trim();
        const amka = String(item.amka ?? '').trim();
        const fullName = String(item.fullName ?? `${eponymo} ${patronymo} ${onoma}`).trim();
        const label = String(
            item.label ||
                item.text ||
                [eponymo, patronymo, onoma, kodikos].filter(Boolean).join(' ')
        ).trim();

        return {
            ...item,
            value: kodikos,
            label,
            text: label,
            id,
            _id: id,
            kodikos,
            eponymo,
            patronymo,
            onoma,
            ypokatasthma,
            afm,
            amka,
            fullName
        };
    }

    function resetErgazomenoiTomDropdown() {
        const tom = getErgazomenoiTomSelect();

        ergazomenoiOptionsCache = [];

        if (tom) {
            tom.clear(true);
            tom.clearOptions();
            tom.refreshOptions(false);
            return;
        }

        if (ergazomenoiDropdown) {
            ergazomenoiDropdown.innerHTML = '';
            const emptyOption = new Option('', '');
            ergazomenoiDropdown.appendChild(emptyOption);
        }
    }

    function setErgazomenoiDropdownOptions(items = []) {
        const normalizedItems = items
            .map((item) => normalizeErgazomenosOption(item))
            .filter((item) => item.value);

        ergazomenoiOptionsCache = normalizedItems;

        const tom = getErgazomenoiTomSelect();

        if (tom) {
            tom.clear(true);
            tom.clearOptions();
            normalizedItems.forEach((item) => tom.addOption(item));
            tom.refreshOptions(false);

            return;
        }

        ergazomenoiDropdown.innerHTML = '';
        const emptyOption = new Option('', '');
        ergazomenoiDropdown.appendChild(emptyOption);

        normalizedItems.forEach((item) => {
            const option = new Option(item.label, item.value);
            option.dataset.id = item.id;
            option.dataset.kodikos = item.kodikos;
            ergazomenoiDropdown.appendChild(option);
        });
    }

    function getSelectedErgazomenosRecord() {
        const selectedValue = String(ergazomenoiDropdown?.value || '').trim();

        if (!selectedValue) return null;

        const tom = getErgazomenoiTomSelect();
        const tomRecord = tom?.options?.[selectedValue];

        if (tomRecord) {
            return normalizeErgazomenosOption(tomRecord);
        }

        const cachedRecord = ergazomenoiOptionsCache.find(
            (item) => item.value === selectedValue || item.kodikos === selectedValue
        );

        if (cachedRecord) return cachedRecord;

        const selectedOption = ergazomenoiDropdown?.options?.[ergazomenoiDropdown.selectedIndex];

        if (!selectedOption) return null;

        return normalizeErgazomenosOption({
            value: selectedOption.value,
            kodikos: selectedOption.dataset?.kodikos || selectedOption.value,
            id: selectedOption.dataset?.id || selectedOption.value,
            label: selectedOption.textContent || selectedOption.text || selectedOption.value
        });
    }

    function buildErgazomenoiDropdownQueryString(energoi, ypokatasthma) {
        const hmeromhniaArxhsPeriodoy =
            getInputValue('etos') + '-' + getInputValue('mhnas') + '-01T00:00:00.000';
        const syncedEnergoiValue = syncEnergoiHidden(energoi ?? getEnergoiSelection());

        const params = new URLSearchParams({
            team: getInputValue('team'),
            company: getInputValue('company_kod'),
            ypokatasthma: normalizeYpokatasthmaValue(ypokatasthma || syncYpokatasthmaHidden()),
            energoi: syncedEnergoiValue,
            hmeromhnia_arxhs_periodoy: hmeromhniaArxhsPeriodoy,
            search: '',
            page: '1',
            limit: '500'
        });

        return params.toString();
    }

    function buildEmployeeDetailsCacheKey(kodikos) {
        return [
            getInputValue('team'),
            getInputValue('company_kod'),
            String(kodikos || '').trim()
        ].join('|');
    }

    function pruneEmployeeDetailsCache() {
        const now = Date.now();

        employeeDetailsCache.forEach((entry, key) => {
            if (!entry || now - entry.timestamp > EMPLOYEE_DETAILS_CACHE_TTL_MS) {
                employeeDetailsCache.delete(key);
            }
        });
    }

    function getCachedEmployeeDetails(kodikos) {
        pruneEmployeeDetailsCache();

        const key = buildEmployeeDetailsCacheKey(kodikos);
        const entry = employeeDetailsCache.get(key);

        if (!entry) return null;

        return entry.payload;
    }

    function setCachedEmployeeDetails(kodikos, payload) {
        if (!kodikos || !payload?.ergazomenoi) return;

        employeeDetailsCache.set(buildEmployeeDetailsCacheKey(kodikos), {
            timestamp: Date.now(),
            payload
        });
    }

    function pruneTimedCache(cache, ttlMs) {
        const now = Date.now();

        cache.forEach((entry, key) => {
            if (!entry || now - entry.timestamp > ttlMs) {
                cache.delete(key);
            }
        });
    }

    function getTimedCache(cache, key, ttlMs) {
        pruneTimedCache(cache, ttlMs);

        const entry = cache.get(key);
        if (!entry) return null;

        return entry.payload;
    }

    function setTimedCache(cache, key, payload) {
        cache.set(key, {
            timestamp: Date.now(),
            payload
        });
    }

    async function fetchJsonWithCache(cache, inFlightCache, cacheKey, url, ttlMs) {
        const cachedPayload = getTimedCache(cache, cacheKey, ttlMs);
        if (cachedPayload !== null) return cachedPayload;

        const inFlightRequest = inFlightCache.get(cacheKey);
        if (inFlightRequest) return inFlightRequest;

        const request = fetch(url, {
            method: 'GET',
            credentials: 'same-origin'
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Fetch failed with status ${response.status}: ${url}`);
                }

                const payload = await response.json();
                setTimedCache(cache, cacheKey, payload);

                return payload;
            })
            .finally(() => {
                inFlightCache.delete(cacheKey);
            });

        inFlightCache.set(cacheKey, request);

        return request;
    }

    async function fetchStaticLookupArray(cacheKey, url) {
        const payload = await fetchJsonWithCache(
            staticLookupCache,
            staticLookupInFlight,
            cacheKey,
            url,
            STATIC_LOOKUP_CACHE_TTL_MS
        );

        return extractResponseArray(payload);
    }

    function getAdjacentRecordsForPrefetch(currentRecord = {}) {
        const currentValue = String(currentRecord.value || currentRecord.kodikos || '').trim();

        if (!currentValue || !ergazomenoiOptionsCache.length) return [];

        const currentIndex = ergazomenoiOptionsCache.findIndex(
            (item) => item.value === currentValue || item.kodikos === currentValue
        );

        if (currentIndex < 0) return [];

        const records = [];

        for (let distance = 1; distance <= ADJACENT_PREFETCH_RADIUS; distance += 1) {
            [currentIndex - distance, currentIndex + distance].forEach((index) => {
                const record = ergazomenoiOptionsCache[index];

                if (record?.kodikos) {
                    records.push({ record, distance });
                }
            });
        }

        return records;
    }

    function clearPayrollDataCaches() {
        apasxolhseisCache.clear();
        apasxolhseisInFlight.clear();
        annualOvertimeCache.clear();
        annualOvertimeInFlight.clear();
        calcTotalsCache.clear();
        calcTotalsInFlight.clear();
    }

    function buildAnnualOvertimeCacheKey(employeeKod) {
        return [
            getInputValue('team'),
            getInputValue('company_kod'),
            String(employeeKod || '').trim(),
            getInputValue('etos')
        ].join('|');
    }

    async function fetchAnnualOvertime(employeeKod) {
        const normalizedKodikos = String(employeeKod || '').trim();
        if (!normalizedKodikos) return {};

        const cacheKey = buildAnnualOvertimeCacheKey(normalizedKodikos);
        const params = new URLSearchParams({
            team: getInputValue('team'),
            company: getInputValue('company_kod'),
            employeeKod: normalizedKodikos,
            xrhsh: getInputValue('etos')
        });

        return fetchJsonWithCache(
            annualOvertimeCache,
            annualOvertimeInFlight,
            cacheKey,
            `/api/kinhseis/getEthsioSynoloYperorion?${params.toString()}`,
            ANNUAL_OVERTIME_CACHE_TTL_MS
        );
    }

    async function fetchApasxolhseis(queryString) {
        const normalizedQueryString = String(queryString || '').trim();
        if (!normalizedQueryString) return null;

        return fetchJsonWithCache(
            apasxolhseisCache,
            apasxolhseisInFlight,
            normalizedQueryString,
            `/api/kinhseis/getApasxolhseis?${normalizedQueryString}`,
            PAYROLL_DATA_CACHE_TTL_MS
        );
    }

    function buildCalcTotalsQueryString(employeeKod, startDateISOString, endDateISOString) {
        const params = new URLSearchParams({
            team: getInputValue('team'),
            company: getInputValue('company_kod'),
            employeeKod: String(employeeKod || '').trim(),
            startDate: startDateISOString,
            endDate: endDateISOString
        });

        return params.toString();
    }

    async function fetchCalcTotals(employeeKod, startDateISOString, endDateISOString) {
        const queryString = buildCalcTotalsQueryString(
            employeeKod,
            startDateISOString,
            endDateISOString
        );

        return fetchJsonWithCache(
            calcTotalsCache,
            calcTotalsInFlight,
            queryString,
            `/api/kinhseis/calcTotals?${queryString}`,
            PAYROLL_DATA_CACHE_TTL_MS
        );
    }

    async function fetchOperationalPayrollPhaseContext(employeeKod, ypokatasthma) {
        const normalizedEmployeeKod = String(employeeKod || '').trim();
        if (!normalizedEmployeeKod) return null;

        const params = new URLSearchParams({
            employeeKod: normalizedEmployeeKod
        });
        const normalizedYpokatasthma = normalizeYpokatasthmaValue(ypokatasthma);
        if (normalizedYpokatasthma) {
            params.set('ypokatasthma', normalizedYpokatasthma);
        }

        try {
            const response = await fetch(`/api/kinhseis/detectPayrollPhases?${params.toString()}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) return null;

            const payload = await response.json();
            const data = payload?.data || {};
            const operationalPhases = Array.isArray(data.operationalPhases)
                ? data.operationalPhases
                : [];
            const diagnosticPhases = Array.isArray(data.phases) ? data.phases : [];
            const operationalPhasesCount =
                Number.isInteger(data.operationalPhasesCount)
                    ? data.operationalPhasesCount
                    : operationalPhases.length;
            const hasOperationalSplit = data.hasOperationalSplit === true;
            const absenceHoursByDiagnosticPhase = new Map(
                diagnosticPhases.map((phase) => {
                    const phaseNo = Number.parseInt(phase?.phaseNo, 10);
                    const dailyRows = Array.isArray(phase?.daily) ? phase.daily : [];
                    const absenceHours = dailyRows.reduce((sum, day) => {
                        const parsed = parseFloat(day?.absenceHours || 0);
                        return sum + (Number.isFinite(parsed) ? parsed : 0);
                    }, 0);

                    return [phaseNo, absenceHours];
                })
            );
            const enrichedOperationalPhases = operationalPhases.map((phase) => {
                const sourcePhaseNos = Array.isArray(phase?.sourcePhaseNos)
                    ? phase.sourcePhaseNos
                    : [];
                const absenceHours = sourcePhaseNos.reduce((sum, phaseNo) => {
                    const parsedPhaseNo = Number.parseInt(phaseNo, 10);
                    return sum + (absenceHoursByDiagnosticPhase.get(parsedPhaseNo) || 0);
                }, 0);

                return {
                    ...phase,
                    absenceHours: +absenceHours.toFixed(4)
                };
            });
            const operationalPhase =
                operationalPhasesCount === 1 ? enrichedOperationalPhases[0] || null : null;
            const operationalPhaseCode = operationalPhase
                ? String(operationalPhase.detectedKathestosCode || '').trim()
                : '';
            const hasUsableSingleOperationalPhase =
                operationalPhasesCount === 1 && ['0', '1', '2'].includes(operationalPhaseCode);

            return {
                hasUsableSingleOperationalPhase,
                operationalPhaseCode,
                operationalPhase,
                operationalPhases: enrichedOperationalPhases,
                operationalPhasesCount,
                hasOperationalSplit
            };
        } catch (error) {
            return null;
        }
    }

    function getSnapshotPhaseSummaryForOperationalPhase(phaseSummary, operationalPhase) {
        if (!Array.isArray(phaseSummary) || !phaseSummary.length || !operationalPhase) {
            return null;
        }

        const operationalPhaseNo = Number.parseInt(operationalPhase?.phaseNo, 10);
        const phaseKey = String(operationalPhase?.phaseKey || '').trim();

        return phaseSummary.find((summary) => {
            const summaryOperationalPhaseNo = Number.parseInt(
                summary?.operationalPhaseNo,
                10
            );

            if (
                Number.isInteger(operationalPhaseNo) &&
                Number.isInteger(summaryOperationalPhaseNo) &&
                operationalPhaseNo === summaryOperationalPhaseNo
            ) {
                return true;
            }

            return phaseKey && String(summary?.phaseKey || '').trim() === phaseKey;
        }) || null;
    }

    function toSnapshotNumber(value, fallback = 0) {
        const parsed = Number(String(value ?? '').replace(',', '.').trim());
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeSnapshotDateOnly(value) {
        const raw = String(value || '').trim().slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
    }

    function getSnapshotDailyFactsForSummary(dailyFacts, summary) {
        const phaseKey = String(summary?.phaseKey || '').trim();
        const operationalPhaseNo = Number.parseInt(summary?.operationalPhaseNo, 10);
        const summaryApo = normalizeSnapshotDateOnly(summary?.apo);
        const summaryEos = normalizeSnapshotDateOnly(summary?.eos);
        let matchedDailyFacts = [];

        if (phaseKey) {
            matchedDailyFacts = dailyFacts.filter(
                (day) => String(day?.phaseKey || '').trim() === phaseKey
            );
        }

        if (
            !matchedDailyFacts.length &&
            Number.isInteger(operationalPhaseNo)
        ) {
            matchedDailyFacts = dailyFacts.filter((day) => {
                const dayOperationalPhaseNo = Number.parseInt(day?.operationalPhaseNo, 10);
                return (
                    Number.isInteger(dayOperationalPhaseNo) &&
                    dayOperationalPhaseNo === operationalPhaseNo
                );
            });
        }

        if (!matchedDailyFacts.length && summaryApo && summaryEos) {
            matchedDailyFacts = dailyFacts.filter((day) => {
                const dayDate = normalizeSnapshotDateOnly(day?.date);
                return dayDate && dayDate >= summaryApo && dayDate <= summaryEos;
            });
        }

        return matchedDailyFacts;
    }

    function buildSnapshotOperationalPhasesFromFacts(snapshot = {}, diagnostics = {}) {
        const phaseSummary = Array.isArray(snapshot.phaseSummary) ? snapshot.phaseSummary : [];
        const dailyFacts = Array.isArray(snapshot.dailyFacts) ? snapshot.dailyFacts : [];
        const debug = {
            phaseSummaryCount: phaseSummary.length,
            dailyFactsCount: dailyFacts.length,
            matchedPhaseSummaryCount: 0,
            derivedOperationalPhasesCount: 0
        };

        if (!phaseSummary.length || !dailyFacts.length) {
            diagnostics.reason = 'snapshot_missing_operational_structure';
            diagnostics.debug = debug;
            return [];
        }

        const derivedOperationalPhases = phaseSummary
            .map((summary) => {
                const daily = getSnapshotDailyFactsForSummary(dailyFacts, summary);
                if (!daily.length) return null;

                const workingHours = toSnapshotNumber(summary?.workingHours);
                const workedDays = daily.filter(
                    (day) => toSnapshotNumber(day?.workingHours) > 0
                ).length;

                return {
                    phaseKey: summary.phaseKey || '',
                    phaseNo: summary.phaseNo || null,
                    operationalPhaseNo: summary.operationalPhaseNo || null,
                    apo: summary.apo || '',
                    eos: summary.eos || '',
                    detectedKathestosCode: summary.effectiveKathestosCode || '',
                    detectedKathestos: summary.effectiveKathestos || '',
                    totalHours: workingHours,
                    workingHours,
                    workedDays,
                    absenceHours: toSnapshotNumber(summary?.absenceHours),
                    insuranceExemptionEligible:
                        summary.insuranceExemptionEligible === true,
                    warnings: Array.isArray(summary.warnings) ? summary.warnings : [],
                    source: summary.source || 'SNAPSHOT_PHASE_SUMMARY',
                    daily
                };
            })
            .filter(Boolean);

        debug.matchedPhaseSummaryCount = derivedOperationalPhases.length;
        debug.derivedOperationalPhasesCount = derivedOperationalPhases.length;

        diagnostics.debug = debug;

        if (derivedOperationalPhases.length !== phaseSummary.length) {
            diagnostics.reason = 'snapshot_phase_daily_match_failed';
            return [];
        }

        return derivedOperationalPhases.length === phaseSummary.length
            ? derivedOperationalPhases
            : [];
    }

    function buildOperationalPayrollPhaseContextFromSnapshot(snapshotResponse, diagnostics = {}) {
        const snapshot = snapshotResponse?.snapshot;
        const capabilities = snapshotResponse?.capabilities || {};
        const hasUsableWorkFacts =
            capabilities.hasDailyFacts === true || capabilities.hasPhaseSummary === true;

        diagnostics.debug = {
            success: snapshotResponse?.success === true,
            usable: snapshotResponse?.usable === true,
            source: snapshotResponse?.source || '',
            status: snapshotResponse?.status || '',
            hasSnapshot: Boolean(snapshot),
            capabilities,
            operationalPhasesCount: Array.isArray(snapshot?.operationalPhases)
                ? snapshot.operationalPhases.length
                : 0,
            phaseSummaryCount: Array.isArray(snapshot?.phaseSummary)
                ? snapshot.phaseSummary.length
                : 0,
            dailyFactsCount: Array.isArray(snapshot?.dailyFacts) ? snapshot.dailyFacts.length : 0
        };

        if (snapshotResponse?.success !== true) {
            diagnostics.reason = 'snapshot_not_success';
            return null;
        }

        if (snapshotResponse?.usable !== true || snapshotResponse?.source !== 'snapshot') {
            diagnostics.reason = 'snapshot_not_usable';
            return null;
        }

        if (snapshotResponse?.status !== 'READY') {
            diagnostics.reason = 'snapshot_not_ready';
            return null;
        }

        if (!snapshot) {
            diagnostics.reason = 'snapshot_missing_payload';
            return null;
        }

        if (!hasUsableWorkFacts) {
            diagnostics.reason = 'snapshot_missing_work_facts';
            return null;
        }

        const operationalPhases = Array.isArray(snapshot.operationalPhases)
            ? snapshot.operationalPhases
            : [];
        const derivedOperationalPhases = operationalPhases.length
            ? operationalPhases
            : buildSnapshotOperationalPhasesFromFacts(snapshot, diagnostics);
        if (!derivedOperationalPhases.length) {
            diagnostics.reason = diagnostics.reason || 'snapshot_missing_operational_structure';
            return null;
        }

        const phaseSummary = Array.isArray(snapshot.phaseSummary) ? snapshot.phaseSummary : [];
        const enrichedOperationalPhases = derivedOperationalPhases.map((phase) => {
            const summary = getSnapshotPhaseSummaryForOperationalPhase(phaseSummary, phase);
            if (!summary || phase?.absenceHours !== undefined) return phase;

            return {
                ...phase,
                absenceHours: summary.absenceHours
            };
        });
        const operationalPhasesCount = enrichedOperationalPhases.length;
        const hasOperationalSplit = operationalPhasesCount > 1;
        const operationalPhase =
            operationalPhasesCount === 1 ? enrichedOperationalPhases[0] || null : null;
        const operationalPhaseCode = operationalPhase
            ? String(operationalPhase.detectedKathestosCode || '').trim()
            : '';
        const hasUsableSingleOperationalPhase =
            operationalPhasesCount === 1 && ['0', '1', '2'].includes(operationalPhaseCode);

        diagnostics.reason = '';
        diagnostics.debug = {
            ...diagnostics.debug,
            operationalPhasesCount,
            hasOperationalSplit,
            source: operationalPhases.length ? 'persisted_operational_phases' : 'derived_facts'
        };

        return {
            hasUsableSingleOperationalPhase,
            operationalPhaseCode,
            operationalPhase,
            operationalPhases: enrichedOperationalPhases,
            operationalPhasesCount,
            hasOperationalSplit,
            phases: Array.isArray(snapshot.phases) ? snapshot.phases : [],
            phaseSummary,
            dailyFacts: Array.isArray(snapshot.dailyFacts) ? snapshot.dailyFacts : [],
            totals: snapshot.totals && typeof snapshot.totals === 'object' ? snapshot.totals : {},
            warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings : [],
            source: 'snapshot',
            sourceReason: '',
            snapshotId: snapshot.id || '',
            snapshotGeneratedAt: snapshot.generatedAt || null,
            snapshotStatus: snapshotResponse.status,
            snapshotSourceVersion: snapshot.sourceVersion || '',
            snapshotInputFingerprint: snapshot.inputFingerprint || ''
        };
    }

    async function fetchWorkFactsSnapshotContext({
        employeeKod,
        startDateISOString,
        endDateISOString,
        ypokatasthma
    } = {}) {
        const normalizedEmployeeKod = String(employeeKod || '').trim();
        if (!normalizedEmployeeKod || !startDateISOString || !endDateISOString) {
            return {
                ok: false,
                source: 'none',
                reason: 'missing_required_params',
                context: null
            };
        }

        const params = new URLSearchParams({
            kodikos: normalizedEmployeeKod,
            apo: startDateISOString,
            eos: endDateISOString
        });
        const normalizedYpokatasthma = normalizeYpokatasthmaValue(ypokatasthma);
        if (normalizedYpokatasthma) {
            params.set('ypokatasthma', normalizedYpokatasthma);
        }

        try {
            const response = await fetch(`/api/kinhseis/workFactsSnapshot?${params.toString()}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                return {
                    ok: false,
                    source: 'error',
                    reason: `http_${response.status}`,
                    debug: null,
                    context: null
                };
            }

            const payload = await response.json();
            const diagnostics = {};
            let context = null;

            try {
                context = buildOperationalPayrollPhaseContextFromSnapshot(payload, diagnostics);
            } catch (error) {
                diagnostics.reason = 'snapshot_context_build_failed';
                diagnostics.debug = {
                    message: error?.message || ''
                };
            }

            if (context) {
                return {
                    ok: true,
                    source: 'snapshot',
                    reason: '',
                    debug: diagnostics.debug || null,
                    context
                };
            }

            return {
                ok: false,
                source: payload?.source || 'none',
                reason: diagnostics.reason || payload?.reason || 'snapshot_context_build_failed',
                debug: diagnostics.debug || null,
                context: null
            };
        } catch (error) {
            return {
                ok: false,
                source: 'error',
                reason: 'fetch_error',
                debug: {
                    message: error?.message || ''
                },
                context: null
            };
        }
    }

    async function fetchOperationalPayrollPhaseContextWithSnapshotFallback({
        employeeKod,
        startDateISOString,
        endDateISOString,
        ypokatasthma
    }) {
        const snapshotResult = await fetchWorkFactsSnapshotContext({
            employeeKod,
            startDateISOString,
            endDateISOString,
            ypokatasthma
        });

        if (snapshotResult.ok && snapshotResult.context) {
            return snapshotResult.context;
        }

        const liveContext = await fetchOperationalPayrollPhaseContext(employeeKod, ypokatasthma);

        return liveContext
            ? {
                ...liveContext,
                source: 'live',
                sourceReason: snapshotResult.reason || 'snapshot_unavailable',
                snapshotFallbackDebug: snapshotResult.debug || null
            }
            : null;
    }

    async function fetchEmployeeDetails(kodikos) {
        const normalizedKodikos = String(kodikos || '').trim();

        if (!normalizedKodikos) return null;

        const cachedPayload = getCachedEmployeeDetails(normalizedKodikos);
        if (cachedPayload) return cachedPayload;

        const cacheKey = buildEmployeeDetailsCacheKey(normalizedKodikos);
        const inFlightRequest = employeeDetailsInFlight.get(cacheKey);

        if (inFlightRequest) return inFlightRequest;

        const request = fetch(
            `/api/kinhseis/getLoipaStoixeiaErgazomenoy/${selectedTeam}/${selectedCompany}/${normalizedKodikos}`,
            {
                method: 'GET',
                credentials: 'same-origin'
            }
        )
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Employee details fetch failed with status ${response.status}`);
                }

                const payload = await response.json();
                setCachedEmployeeDetails(normalizedKodikos, payload);

                return payload;
            })
            .finally(() => {
                employeeDetailsInFlight.delete(cacheKey);
            });

        employeeDetailsInFlight.set(cacheKey, request);

        return request;
    }

    function prefetchAdjacentEmployeeDetails(currentRecord = {}) {
        getAdjacentRecordsForPrefetch(currentRecord).forEach(({ record, distance }) => {
            if (getCachedEmployeeDetails(record.kodikos)) return;

            window.setTimeout(
                () => {
                    fetchEmployeeDetails(record.kodikos).catch(() => {
                        // Background prefetch only. Do not interrupt the user flow.
                    });
                },
                (distance - 1) * 120
            );
        });
    }

    function getApasxolhseisYpokatasthmaForQuery() {
        const selectedFilterYpokatasthma = normalizeYpokatasthmaValue(
            getInputValue('ypokatasthma_Hidden')
        );

        if (selectedFilterYpokatasthma) return selectedFilterYpokatasthma;

        const selectedRecordYpokatasthma = normalizeYpokatasthmaValue(
            getSelectedErgazomenosRecord()?.ypokatasthma
        );

        if (selectedRecordYpokatasthma) return selectedRecordYpokatasthma;

        return normalizeYpokatasthmaValue(_ergazomenoi?.ypokatasthma);
    }

    function buildApasxolhseisQueryString(overrides = {}) {
        syncYpokatasthmaHidden();

        const params = new URLSearchParams({
            team: getInputValue('team'),
            company: getInputValue('company_kod'),
            ypokatasthma: normalizeYpokatasthmaValue(
                overrides.ypokatasthma ?? getApasxolhseisYpokatasthmaForQuery()
            ),
            employeeKod: String(overrides.employeeKod ?? getInputValue('kodikosHidden')).trim(),
            xrhsh: getInputValue('etos'),
            periodos: String(overrides.periodos ?? periodoiDropdown.value ?? '').trim(),
            typos_apodoxon: String(
                overrides.typos_apodoxon ?? typoiApodoxonDropdown.value ?? ''
            ).trim(),
            aa_misthodosias: String(
                overrides.aa_misthodosias ?? getInputValue('aaMisthodosias', '1')
            ).trim()
        });

        return params.toString();
    }

    function prefetchAdjacentPayrollData(currentRecord = {}, startDateISOString, endDateISOString) {
        if (!periodoiDropdown.value || !typoiApodoxonDropdown.value) return;

        getAdjacentRecordsForPrefetch(currentRecord).forEach(({ record, distance }) => {
            window.setTimeout(
                () => {
                    fetchAnnualOvertime(record.kodikos).catch(() => {
                        // Background prefetch only. Do not interrupt the user flow.
                    });

                    const queryString = buildApasxolhseisQueryString({
                        employeeKod: record.kodikos,
                        ypokatasthma: record.ypokatasthma
                    });

                    fetchApasxolhseis(queryString).catch(() => {
                        // Background prefetch only. Do not interrupt the user flow.
                    });

                    if (startDateISOString && endDateISOString) {
                        fetchCalcTotals(record.kodikos, startDateISOString, endDateISOString).catch(
                            () => {
                                // Background prefetch only. Do not interrupt the user flow.
                            }
                        );
                    }
                },
                (distance - 1) * 120
            );
        });
    }

    syncYpokatasthmaHidden();
    syncEnergoiHidden();

    const selectEmployesCheckbox = document.getElementById('selectEmployes');
    if (selectEmployesCheckbox) {
        selectEmployesCheckbox.addEventListener('change', function () {
            syncEnergoiHidden();
        });
    }

    if (ypokatasthmataDropdown) {
        ypokatasthmataDropdown.addEventListener('change', function () {
            syncYpokatasthmaHidden();
            window.setTimeout(syncYpokatasthmaHidden, 0);
            clearPayrollDataCaches();

            if (typeof window.loadErgazomenoi === 'function') {
                window.loadErgazomenoi(getEnergoiSelection(), syncYpokatasthmaHidden());
            }
        });
    }

    if (generateWorkFactsSnapshotButton) {
        generateWorkFactsSnapshotButton.addEventListener(
            'click',
            handleGenerateWorkFactsSnapshotClick
        );
    }

    if (generateBatchWorkFactsSnapshotsButton) {
        generateBatchWorkFactsSnapshotsButton.addEventListener(
            'click',
            handleGenerateBatchWorkFactsSnapshotsClick
        );
    }

    if (generateAllWorkFactsSnapshotsJobButton) {
        generateAllWorkFactsSnapshotsJobButton.addEventListener(
            'click',
            handleGenerateAllWorkFactsSnapshotsJobClick
        );
    }

    if (previewPayrollCalculationUnitsButton) {
        previewPayrollCalculationUnitsButton.addEventListener(
            'click',
            handlePreviewPayrollCalculationUnitsClick
        );
    }

    if (configureWorkFactsSchedulerSlotButton) {
        configureWorkFactsSchedulerSlotButton.addEventListener(
            'click',
            handleConfigureWorkFactsSchedulerSlotClick
        );
    }

    ['saveButton', 'editButton', 'undoButton', 'deleteButton'].forEach((buttonId) => {
        const button = document.getElementById(buttonId);

        if (!button) return;

        button.addEventListener('click', function () {
            window.setTimeout(clearPayrollDataCaches, 1000);
        });
    });

    function restoreErgazomenosSelectionFromRecord(record = {}, silent = true) {
        const value = String(record.value || '').trim();

        if (!value || !ergazomenoiDropdown) return false;

        const tom = getErgazomenoiTomSelect();

        if (tom) {
            if (!tom.options[value]) {
                tom.addOption(record);
            }

            tom.setValue(value, silent);
            tom.refreshItems();
            tom.refreshOptions(false);

            if (typeof tom.close === 'function') {
                tom.close();
            }

            return true;
        }

        ergazomenoiDropdown.value = value;

        if (!silent) {
            const event = new Event('change', { bubbles: true });
            ergazomenoiDropdown.dispatchEvent(event);
        }

        return true;
    }

    // Προσθήκη event listeners στα κουμπιά προηγούμενου/επόμενου εργαζομένου.
    if (prevButton) {
        prevButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            navigateDropdown(-1);
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            navigateDropdown(1);
        });
    }

    // Συνάρτηση για πλοήγηση στο dropdown εργαζομένων.
    function navigateDropdown(direction) {
        if (!ergazomenoiOptionsCache.length) {
            updateButtonStates();
            return;
        }

        const currentValue = String(ergazomenoiDropdown.value || '').trim();
        let currentIndex = ergazomenoiOptionsCache.findIndex((item) => item.value === currentValue);

        if (currentIndex < 0) {
            currentIndex = direction > 0 ? -1 : ergazomenoiOptionsCache.length;
        }

        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= ergazomenoiOptionsCache.length) {
            newIndex = ergazomenoiOptionsCache.length - 1;
        }

        if (newIndex === currentIndex) {
            updateButtonStates();
            return;
        }

        const nextRecord = ergazomenoiOptionsCache[newIndex];

        if (!nextRecord?.value) {
            updateButtonStates();
            return;
        }

        forcedErgazomenosRecordForNavigation = nextRecord;
        restoreErgazomenosSelectionFromRecord(nextRecord, true);
        handleDropdownChange();
        updateButtonStates();
    }

    // Συνάρτηση χειρισμού αλλαγής του dropdownload
    async function handleDropdownChange() {
        updateButtonStates();

        const forcedRecord = forcedErgazomenosRecordForNavigation;
        forcedErgazomenosRecordForNavigation = null;

        window.apasxolhseisCompactLoader?.reset();
        window.apasxolhseisCompactLoader?.show('Φόρτωση απασχολήσεων...');

        try {
            await clearFormFields();

            if (forcedRecord) {
                restoreErgazomenosSelectionFromRecord(forcedRecord, true);
            }

            document.getElementById('synoloMiktonApodoxon_Hidden').value = 0;

            const selectedErgazomenos = forcedRecord
                ? String(forcedRecord.value || '').trim()
                : String(ergazomenoiDropdown.value || '').trim();
            const selectedRecord = forcedRecord || getSelectedErgazomenosRecord();

            if (selectedErgazomenos && selectedRecord?.kodikos) {
                _SELECTED_ERGAZOMENOS = selectedRecord.id || selectedErgazomenos; // Ορισμός global μεταβλητής

                document.getElementById('idHidden').value =
                    selectedRecord.id || selectedErgazomenos;
                document.getElementById('kodikosHidden').value = selectedRecord.kodikos;
                const selectedKodikos = selectedRecord.kodikos;
                try {
                    const result = await fetchEmployeeDetails(selectedKodikos);

                    if (!result?.ergazomenoi) {
                        throw new Error('Δεν βρέθηκαν στοιχεία εργαζομένου.');
                    }

                    // Ανάθεση τιμών στις global μεταβλητές
                    _ergazomenoi = result.ergazomenoi;
                    _sxeshErgasias = result.sxeshErgasias;
                    _kathestosApasxolhshs = result.kathestosApasxolhshs;
                    _oikogeneiakhKatastash = result.oikogeneiakhKatastash;
                    _typosErgazomenoy = result.typosErgazomenoy;
                    _genikesParametroi = result.genikesParametroi;
                    _asfalistikesKlaseis = result.asfalistikesKlaseis;
                    _argies = result.argies;
                    _etaireia = result.etaireia;
                    _astheneies = result.astheneies;

                    document.getElementById('ergazomenos_Hidden').value =
                        _ergazomenoi.eponymo.trim() +
                        ' ' +
                        _ergazomenoi.patronymo.substring(0, 3).trim() +
                        ' ' +
                        _ergazomenoi.onoma.trim();
                    updateLabelsFromHidden('ergazomenos_Hidden', [
                        'ergazomenosLabel_Krathseis',
                        'ergazomenosLabel_Foroi',
                        'ergazomenosLabel_Astheneia',
                        'ergazomenosLabel_Adeies'
                    ]);

                    // Ενημέρωση των στοιχείων του DOM με τα δεδομένα που λήφθηκαν
                    let originalDate, year, month, day, formattedDate;
                    document.getElementById('value1').textContent = _ergazomenoi.kodikos;
                    if (_ergazomenoi.hmeromhnia_proslhpshs) {
                        originalDate = _ergazomenoi.hmeromhnia_proslhpshs.slice(0, 10);
                        [year, month, day] = originalDate.split('-');
                        formattedDate = `${day}/${month}/${year}`;
                        document.getElementById('hmeromhnia_proslhpshs_hidden').value =
                            originalDate;
                        document.getElementById('value2').textContent = formattedDate;
                    } else {
                        document.getElementById('value2').textContent = '';
                    }

                    if (_ergazomenoi.hmeromhnia_lhxhs_symbashs) {
                        originalDate = _ergazomenoi.hmeromhnia_lhxhs_symbashs.slice(0, 10);
                        [year, month, day] = originalDate.split('-');
                        formattedDate = `${day}/${month}/${year}`;
                        document.getElementById('hmeromhnia_lhxhs_symbashs_hidden').value =
                            originalDate;
                        document.getElementById('value3').textContent = formattedDate;
                    } else {
                        document.getElementById('value3').textContent = '';
                    }

                    if (_ergazomenoi.hmeromhnia_apoxorhshs) {
                        originalDate = _ergazomenoi.hmeromhnia_apoxorhshs.slice(0, 10);
                        [year, month, day] = originalDate.split('-');
                        formattedDate = `${day}/${month}/${year}`;
                        document.getElementById('hmeromhnia_apoxorhshs_hidden').value =
                            originalDate;
                        document.getElementById('value4').textContent = formattedDate;
                    } else {
                        document.getElementById('value4').textContent = '';
                    }

                    document.getElementById('value5').textContent =
                        _ergazomenoi.xarakthrismos_ergazomenon ? 'ΥΠΑΛΛΗΛΟΣ' : 'ΕΡΓΑΤΗΣ';
                    document.getElementById('value6').textContent =
                        _ergazomenoi?.oikogeneiakh_katastash
                            ? _oikogeneiakhKatastash?.perigrafh
                            : '';
                    document.getElementById('value7').textContent = parseInt(
                        _ergazomenoi.arithmos_teknon
                    );
                    document.getElementById('value8').textContent = _ergazomenoi?.typos_ergazomenon
                        ? _typosErgazomenoy?.perigrafh
                        : '';
                    document.getElementById('value9').textContent =
                        _ergazomenoi?.kathestos_apasxolhshs ? _kathestosApasxolhshs?.perigrafh : '';
                    document.getElementById('value10').textContent = _ergazomenoi?.sxesh_ergasias
                        ? _sxeshErgasias?.perigrafh
                        : '';
                    document.getElementById('value11').textContent = parseFloat(
                        _ergazomenoi.ores_ergasias_ebdomadas
                    ).toFixed(2);
                    document.getElementById('value12').textContent = parseFloat(
                        _ergazomenoi.hmeres_ergasias_ebdomadas
                    ).toFixed(2);
                    document.getElementById('value13').textContent = _ergazomenoi.palios_neos
                        ? 'ΝΕΟΣ'
                        : 'ΠΑΛΙΟΣ';
                    document.getElementById('value14').textContent = parseFloat(
                        _ergazomenoi.symfonhtheis_misthos_genikos
                    ).toFixed(2);
                    document.getElementById('value15').textContent = parseFloat(
                        _ergazomenoi.symfonhtheis_misthos_apasxolhseis
                    ).toFixed(2);
                    document.getElementById('value16').textContent = parseInt(
                        _ergazomenoi.paketo_apodoxon
                    );
                    document.getElementById('value17').textContent = parseInt(
                        _ergazomenoi.mhniaia_repo
                    );
                    document.getElementById('eidikhKathgoriaErgazomenoy_Hidden').value =
                        _ergazomenoi.eidikh_kathgoria_ergazomenoy;
                    document.getElementById('oikogeneiakhKatastash_Hidden').value =
                        _ergazomenoi.oikogeneiakh_katastash;
                    document.getElementById('typosErgazomenon_Hidden').value =
                        _ergazomenoi.typos_ergazomenon;
                    document.getElementById('sxeshErgasias_Hidden').value =
                        _ergazomenoi.sxesh_ergasias;
                    document.getElementById('kathestosApasxolhshs_Hidden').value =
                        _ergazomenoi.kathestos_apasxolhshs;
                    document.getElementById('apasxolhshBaseiSymbashs_Hidden').value =
                        _ergazomenoi.apasxolhsh_basei_symbashs;

                    const oresProsthethsErgasias =
                        document.getElementById('oresProsthethsErgasias');
                    const axiaProsthethsErgasias =
                        document.getElementById('axiaProsthethsErgasias');
                    const meioshErgatikhsEisforas =
                        document.getElementById('meioshErgatikhsEisforas');
                    const epidothshErgodotikhsEisforas = document.getElementById(
                        'epidothshErgodotikhsEisforas'
                    );
                    if (document.getElementById('kathestosApasxolhshs_Hidden').value === '1') {
                        oresProsthethsErgasias.disabled = false;
                        axiaProsthethsErgasias.disabled = false;
                    } else {
                        oresProsthethsErgasias.disabled = true;
                        axiaProsthethsErgasias.disabled = true;
                    }

                    if (document.getElementById('kathestosApasxolhshs_Hidden').value === '0') {
                        meioshErgatikhsEisforas.disabled = false;
                    } else {
                        meioshErgatikhsEisforas.disabled = true;
                    }

                    applySelectedEmployeeBaseValues();
                    document.getElementById('oresErgasias').focus();
                    await loadTypoiApodoxon();
                    await loadPeriods();
                    await runEmployeePeriodFlowOnce('employee-change');

                    prefetchAdjacentEmployeeDetails(selectedRecord);
                } catch (error) {
                    console.error('Fetch error:', error);
                }
            } else {
                document.getElementById('kodikosHidden').value = '';
            }
        } catch (error) {
            console.error('Dropdown change error:', error);
        } finally {
            window.apasxolhseisCompactLoader?.hide();
        }
    }

    // Προσθήκη event listener για το dropdown
    ergazomenoiDropdown.addEventListener('change', handleDropdownChange);

    // Η κλήση κατά την αρχική φόρτωση των εργαζομένων γίνεται από το toggleLabelKinhseis.js

    async function loadErgazomenoi(energoi, ypokatasthma) {
        syncEnergoiHidden(energoi ?? getEnergoiSelection());
        pruneEmployeeDetailsCache();
        clearPayrollDataCaches();

        const selectedTeamValue = getInputValue('team');
        const selectedCompanyValue = getInputValue('company_kod');
        const ypokatasthmaForQuery = normalizeYpokatasthmaValue(
            ypokatasthma || syncYpokatasthmaHidden()
        );

        resetErgazomenoiTomDropdown();

        try {
            const ergazomenoiQueryString = buildErgazomenoiDropdownQueryString(
                energoi,
                ypokatasthmaForQuery
            );

            const response = await fetch(
                `/api/dropdown/kinhseis/apasxolhseis/ergazomenoi?${ergazomenoiQueryString}`,
                {
                    method: 'GET',
                    credentials: 'same-origin'
                }
            );

            const payload = await response.json();
            const data = extractResponseArray(payload);

            if (data.length === 0) {
                const menuLinks = document.querySelectorAll('.menu_Links ul li');
                menuLinks.forEach((link) => {
                    link.classList.add('disabled');
                });

                await clearFormFields();
                await clearValueFields();

                message = `
            <p class="bold-text">Προσοχή !!!)</p>
            <p>&nbsp;</p>
            <p>Δεν βρέθηκαν εργαζόμενοι που να πληρούν τα κριτήρια αναζήτησης.</p>`;
                showAlert(message);
                updateButtonStates();
                return;
            }

            const menuLinks = document.querySelectorAll('.menu_Links ul li');
            menuLinks.forEach((link) => {
                link.classList.remove('disabled');
            });

            setErgazomenoiDropdownOptions(data);
            updateButtonStates();
        } catch (error) {
            console.error('Error loading ergazomenoi dropdown:', {
                error,
                selectedTeamValue,
                selectedCompanyValue,
                ypokatasthmaForQuery
            });
        }
    }
    // Συνάρτηση για ενημέρωση της κατάστασης των κουμπιών
    function updateButtonStates() {
        if (!prevButton || !nextButton) return;

        const currentValue = String(ergazomenoiDropdown?.value || '').trim();
        const currentIndex = ergazomenoiOptionsCache.findIndex(
            (item) => item.value === currentValue
        );
        const hasOptions = ergazomenoiOptionsCache.length > 0;

        prevButton.disabled = !hasOptions || currentIndex <= 0;
        nextButton.disabled =
            !hasOptions || currentIndex < 0 || currentIndex >= ergazomenoiOptionsCache.length - 1;
    }

    window.loadErgazomenoi = loadErgazomenoi;
    window.navigateDropdown = navigateDropdown;

    async function loadYpokatasthmata() {
        /*
            Το υποκατάστημα πλέον αρχικοποιείται από το κοινό TomDropdown σύστημα
            μέσω dropdownManager.js / dropdown-item.js και του data-api στο EJS:
            /api/dropdown/ergazomenoi/ypokatasthma

            Κρατάμε αυτή τη συνάρτηση μόνο για συμβατότητα, ώστε αν την καλέσει
            παλιός κώδικας να μην φορτώσει ξανά native options από /api/ypokatasthmata.
        */
        syncYpokatasthmaHidden();
        updateLabelsFromHidden('ypokatasthma_Hidden', [
            'ypokatasthmaLabel_Krathseis',
            'ypokatasthmaLabel_Foroi',
            'ypokatasthmaLabel_Astheneia'
        ]);
    }

    // Συνάρτηση φόρτωσης περιόδων
    async function loadPeriods() {
        if (!_SELECTED_ERGAZOMENOS) return;

        _MHNAS_APASXOLHSHS = String(document.getElementById('mhnas')?.value || '').trim();

        if (!_MHNAS_APASXOLHSHS) return;

        try {
            // Στην αλλαγή εργαζομένου η περίοδος μπαίνει silent.
            // Δεν πυροδοτούμε periodos change εδώ, γιατί αυτό άνοιγε ξανά
            // το ίδιο sharedParams / getApasxolhseis flow πολλές φορές.
            await setPeriodosTomValue(_MHNAS_APASXOLHSHS, true);
        } catch (error) {
            console.error(error);
        }
    }

    function formatValue(value, decimals = 2) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed.toFixed(decimals) : (0).toFixed(decimals);
    }

    function getMixedOperationalNonFullHours(operationalPhaseContext) {
        const phases = Array.isArray(operationalPhaseContext?.operationalPhases)
            ? operationalPhaseContext.operationalPhases
            : [];
        if (operationalPhaseContext?.hasOperationalSplit !== true || phases.length <= 1) {
            return null;
        }

        const phaseCodes = phases.map((phase) =>
            String(phase?.detectedKathestosCode || '').trim()
        );
        const hasFullPhase = phaseCodes.includes('0');
        const hasNonFullPhase = phaseCodes.some((code) => code === '1' || code === '2');
        const hasOnlyKnownPayrollCodes = phaseCodes.every(
            (code) => code === '0' || code === '1' || code === '2'
        );

        if (!hasFullPhase || !hasNonFullPhase || !hasOnlyKnownPayrollCodes) {
            return null;
        }

        return phases.reduce((sum, phase) => {
            const phaseCode = String(phase?.detectedKathestosCode || '').trim();
            if (phaseCode !== '1' && phaseCode !== '2') return sum;

            const parsedHours = parseFloat(String(phase?.totalHours ?? '').replace(',', '.'));
            return sum + (Number.isFinite(parsedHours) ? parsedHours : 0);
        }, 0);
    }

    function setNumericInputValue(id, value, decimals = 2) {
        const element = document.getElementById(id);
        if (!element) return;

        const parsed = parseFloat(value);
        element.value = Number.isFinite(parsed) ? parsed.toFixed(decimals) : (0).toFixed(decimals);
    }

    function applySelectedEmployeeBaseValues() {
        if (!_ergazomenoi) return;

        setNumericInputValue('synoloApodoxon', _ergazomenoi.synolo_symbashs_basei_oron_ergasias, 2);
        setNumericInputValue(
            'symfonhtheisMisthos',
            _ergazomenoi.symfonhtheis_misthos_apasxolhseis,
            2
        );
        // Τα ωρομίσθια πρέπει να παραμένουν με 4 δεκαδικά, όπως στη ΒΔ,
        // γιατί χρησιμοποιούνται ως βάση στους υπολογισμούς αξιών ωρών/απουσιών.
        setNumericInputValue('pragmatikoOromisthio', _ergazomenoi.pragmatikoOromisthio, 4);
        setNumericInputValue('pragmatikoHmeromisthio', _ergazomenoi.pragmatikoHmeromisthio, 2);
        setNumericInputValue('nomimoOromisthio', _ergazomenoi.nomimoOromisthio, 4);
        setNumericInputValue('nomimoHmeromisthio', _ergazomenoi.nomimoHmeromisthio, 2);
    }

    function buildPeriodDateRange(yearValue, periodValue) {
        const year = parseInt(String(yearValue || '').trim(), 10);
        const month = parseInt(String(periodValue || '').trim(), 10);

        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
            return {
                startDateISOString: null,
                endDateISOString: null
            };
        }

        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const endDate = new Date(Date.UTC(year, month - 1, lastDayOfMonth, 0, 0, 0, 0));

        return {
            startDateISOString: startDate.toISOString(),
            endDateISOString: endDate.toISOString()
        };
    }

    let employeePeriodFlowSeq = 0;
    let activeEmployeePeriodFlowKey = '';
    let activeEmployeePeriodFlowPromise = null;
    let lastCompletedEmployeePeriodFlowKey = '';

    function normalizeDateOnly(value) {
        if (!value) return null;
        const raw = String(value).slice(0, 10);
        const date = new Date(`${raw}T00:00:00.000Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('\"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function formatDateForGreekMessage(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function isEmployeeHireDateAfterPeriodEnd(employee, endDateISOString) {
        const hireDate = normalizeDateOnly(employee?.hmeromhnia_proslhpshs);
        const periodEnd = normalizeDateOnly(endDateISOString);

        if (!hireDate || !periodEnd) {
            return false;
        }

        return hireDate.getTime() > periodEnd.getTime();
    }

    function showEmployeeOutsidePeriodMessage(employee, endDateISOString) {
        const hireDate = normalizeDateOnly(employee?.hmeromhnia_proslhpshs);
        const periodEnd = normalizeDateOnly(endDateISOString);
        const employeeName = [employee?.eponymo, employee?.onoma].filter(Boolean).join(' ').trim();
        const safeEmployeeName = escapeHtml(employeeName || 'του/της εργαζόμενου/ης');
        const hireDateText = escapeHtml(formatDateForGreekMessage(hireDate));
        const periodEndText = escapeHtml(formatDateForGreekMessage(periodEnd));

        const message = `
            <div class="apasxolhseis-outside-period-message">
                <p>Ο/Η εργαζόμενος/η <strong>${safeEmployeeName}</strong> έχει ημερομηνία πρόσληψης μεταγενέστερη από τη λήξη της επιλεγμένης περιόδου.</p>
                <div class="apasxolhseis-outside-period-dates">
                    <div><span>Ημ/νία πρόσληψης:</span> <strong>${hireDateText}</strong></div>
                    <div><span>Λήξη περιόδου:</span> <strong>${periodEndText}</strong></div>
                </div>
                <p class="apasxolhseis-outside-period-footer">Δεν θα γίνουν υπολογισμοί απασχόλησης για αυτή την περίοδο.</p>
            </div>`;

        if (window.Swal && typeof window.Swal.fire === 'function') {
            return window.Swal.fire({
                title: 'Εργαζόμενος εκτός περιόδου',
                html: message,
                icon: 'warning',
                width: 'min(560px, 92vw)',
                customClass: {
                    popup: 'swal-employee-out-of-period'
                },
                confirmButtonText: 'ΟΚ',
                allowOutsideClick: false,
                allowEscapeKey: true
            });
        }

        return showAlert(message);
    }

    function queueEmployeeOutsidePeriodMessage(employee, endDateISOString) {
        const employeeSnapshot = employee ? { ...employee } : employee;
        const periodEndSnapshot = endDateISOString;

        setTimeout(() => {
            showEmployeeOutsidePeriodMessage(employeeSnapshot, periodEndSnapshot);
        }, 0);
    }

    function getEmployeePeriodFlowKey(selectedPeriodos) {
        return [
            getInputValue('team'),
            getInputValue('company_kod'),
            getApasxolhseisYpokatasthmaForQuery(),
            getInputValue('kodikosHidden'),
            getInputValue('etos'),
            String(selectedPeriodos || periodoiDropdown.value || '').trim(),
            String(typoiApodoxonDropdown.value || '').trim(),
            getInputValue('aaMisthodosias', '1')
        ].join('|');
    }

    async function runEmployeePeriodFlowOnce(source = 'unknown', options = {}) {
        const selectedPeriodos = String(periodoiDropdown.value || '').trim();

        // TomSelect μπορεί να πυροδοτήσει change με κενή τιμή κατά το αρχικό init/clear.
        // Η Περίοδος είναι υποχρεωτικό πεδίο, οπότε δεν συνεχίζουμε με κενή τιμή.
        if (!selectedPeriodos) {
            return;
        }

        if (!_ergazomenoi || !getInputValue('kodikosHidden')) {
            return;
        }

        const flowKey = getEmployeePeriodFlowKey(selectedPeriodos);

        if (
            !options.force &&
            activeEmployeePeriodFlowPromise &&
            activeEmployeePeriodFlowKey === flowKey
        ) {
            return activeEmployeePeriodFlowPromise;
        }

        if (
            !options.force &&
            !activeEmployeePeriodFlowPromise &&
            lastCompletedEmployeePeriodFlowKey === flowKey
        ) {
            return;
        }

        const flowId = ++employeePeriodFlowSeq;
        activeEmployeePeriodFlowKey = flowKey;

        const isCurrentFlow = () => flowId === employeePeriodFlowSeq;

        activeEmployeePeriodFlowPromise = (async () => {
            const previousSuppress = window.apasxolhseisSuppressFieldEvents;

            window.apasxolhseisCompactLoader?.show('Φόρτωση απασχολήσεων...');

            try {
                window.apasxolhseisSuppressFieldEvents = true;

                const periodosHidden = document.getElementById('periodos_Hidden');
                const mhnasHidden = document.getElementById('mhnas');
                if (periodosHidden) periodosHidden.value = selectedPeriodos;
                if (mhnasHidden) mhnasHidden.value = selectedPeriodos;

                const etosXrhshs = document.getElementById('etos')?.value || '';
                const { startDateISOString, endDateISOString } = buildPeriodDateRange(
                    etosXrhshs,
                    selectedPeriodos
                );

                if (!startDateISOString || !endDateISOString) {
                    console.error('Αδύνατη η δημιουργία ημερομηνιών περιόδου:', {
                        etosXrhshs,
                        selectedPeriodos,
                        source
                    });
                    return;
                }

                sharedParams = {
                    ergazomenoi: _ergazomenoi,
                    sxeshErgasias: _sxeshErgasias,
                    kathestosApasxolhshs: _kathestosApasxolhshs,
                    oikogeneiakhKatastash: _oikogeneiakhKatastash,
                    typosErgazomenoy: _typosErgazomenoy,
                    genikesParametroi: _genikesParametroi,
                    asfalistikesKlaseis: _asfalistikesKlaseis,
                    astheneies: _astheneies,
                    etaireia: _etaireia,
                    _TEAM: document.getElementById('team').value,
                    _COMPANY: document.getElementById('company_kod').value,
                    _YPOKATASTHMA: syncYpokatasthmaHidden(),
                    _XRHSH: document.getElementById('etos').value,
                    _KODIKOS_ETAIREIAS: _etaireia.kod,
                    _SYNOLO_ERGASIMON_HMERON_MHNA: 0,
                    _ERGASIMES_HMERES_MHNA: 0,
                    _MH_ERGASIMES_HMERES_MHNA: 0,
                    _ETHSIES_ORES_YPERORION: 0,
                    _PROSAYXHSH_HMERON_5MERHS_ERGASIAS: 0,
                    startDate: startDateISOString,
                    endDate: endDateISOString,
                    operationalPayrollPhaseContext: null,
                    isReady: true
                };

                console.log('Shared parameters updated:', sharedParams);

                window.sharedParams = sharedParams;
                setOperationalPayrollPhaseContext(null);

                if (!isCurrentFlow()) return;

                if (isEmployeeHireDateAfterPeriodEnd(_ergazomenoi, endDateISOString)) {
                    await clearFormFields();
                    if (!isCurrentFlow()) return;

                    applySelectedEmployeeBaseValues();
                    await setTyposApodoxonTomValue(typoiApodoxonDropdown.value, true);
                    await setPeriodosTomValue(selectedPeriodos, true);
                    queueEmployeeOutsidePeriodMessage(_ergazomenoi, endDateISOString);
                    applyButtonPermissions(false);
                    lastCompletedEmployeePeriodFlowKey = flowKey;
                    return;
                }

                await clearFormFields();
                if (!isCurrentFlow()) return;

                // Το clearFormFields καθαρίζει τα πεδία αποδοχών. Τα βασικά ποσά
                // του επιλεγμένου εργαζομένου πρέπει να μπουν ξανά πριν ξεκινήσει
                // ο υπολογισμός αξιών/κρατήσεων/φόρου.
                applySelectedEmployeeBaseValues();

                await setTyposApodoxonTomValue(typoiApodoxonDropdown.value, true);
                await setPeriodosTomValue(selectedPeriodos, true);

                await updateSessionPeriodos(selectedPeriodos);
                if (!isCurrentFlow()) return;

                const ethsiesYperories_result = await fetchAnnualOvertime(
                    document.getElementById('kodikosHidden').value
                );
                if (!isCurrentFlow()) return;

                const parsedEthsiesOresYperorion = parseFloat(
                    ethsiesYperories_result?.total_ores_yperorias
                );
                let _ETHSIES_ORES_YPERORION = Number.isFinite(parsedEthsiesOresYperorion)
                    ? parsedEthsiesOresYperorion
                    : 0;
                document.getElementById('orioYperorion_Hidden').value = _ETHSIES_ORES_YPERORION;
                document.getElementById('aa_misthodosias_Hidden').value =
                    document.getElementById('aaMisthodosias').value;

                sharedParams.startDate = startDateISOString;
                sharedParams.endDate = endDateISOString;

                const apasxolhseisQueryString = buildApasxolhseisQueryString({
                    periodos: selectedPeriodos
                });
                const apasxolhseis_result = await fetchApasxolhseis(apasxolhseisQueryString);
                if (!isCurrentFlow()) return;

                if (!apasxolhseis_result || apasxolhseis_result.length === 0) {
                    hasRecord = false;

                    document.querySelectorAll('[id^=saveButton]').forEach((saveButton) => {
                        applyButtonPermissions(hasRecord);
                    });

                    _PRAGMATIKES_HMERES_ERGASIAS_MHNA =
                        await ypologismosPragmatikonErgasimonHmeronMhna(
                            document.getElementById('etos').value,
                            selectedPeriodos,
                            document.getElementById('apasxolhshBaseiSymbashs_Hidden').value,
                            _genikesParametroi,
                            _argies,
                            _ergazomenoi.xarakthrismos_ergazomenon,
                            _ergazomenoi.hmeromhnia_proslhpshs,
                            _ergazomenoi.hmeromhnia_apoxorhshs
                        );
                    if (!isCurrentFlow()) return;

                    if (_PRAGMATIKES_HMERES_ERGASIAS_MHNA === 0) {
                        message = `
                        <p class="bold-text">Τα στοιχεία του εργαζόμενου είναι ελλιπή.</p>
                        <p>&nbsp;</p>
                        <p class="apasxolhseis-swal-retry-message">Διορθώστε τα στοιχεία του και ξαναπροσπαθήστε...</p>`;
                        showAlert(message);
                    }

                    sharedParams._ERGASIMES_HMERES_MHNA = _PRAGMATIKES_HMERES_ERGASIAS_MHNA;

                    const calcTotalsEmployeeKod = sharedParams.ergazomenoi.kodikos;
                    const calcTotalsPromise = fetchCalcTotals(
                        calcTotalsEmployeeKod,
                        startDateISOString,
                        endDateISOString
                    ).then(
                        (result) => ({ result }),
                        (error) => ({ error })
                    );

                    document.dispatchEvent(new Event('sharedParamsReady'));
                    await waitForApasxolhseisKrathseisLoading();
                    if (!isCurrentFlow()) return;

                    document.getElementById('kodikosHidden').value = calcTotalsEmployeeKod;
                    const calcTotalsState = await calcTotalsPromise;
                    if (calcTotalsState.error) {
                        throw calcTotalsState.error;
                    }
                    const result = calcTotalsState.result;
                    if (!isCurrentFlow()) return;

                    document.getElementById('oresArgion').value = formatValue(
                        result.total_ores_argion
                    );
                    document.getElementById('oresNyxtas').value = formatValue(
                        result.total_ores_nyxtas
                    );
                    document.getElementById('oresApoysias').value = formatValue(
                        result.total_ores_apoysias
                    );
                    document.getElementById('hmeresApoysias').value =
                        result.total_hmeres_apoysias && !isNaN(result.total_hmeres_apoysias)
                            ? parseInt(result.total_hmeres_apoysias)
                            : 0;

                    document.getElementById('oresYperergasias').value = formatValue(
                        result.total_ores_yperergasias
                    );
                    document.getElementById('oresYperergasiasArgion').value = formatValue(
                        result.total_ores_yperergasias_argion
                    );
                    document.getElementById('oresYperergasiasNyxtas').value = formatValue(
                        result.total_ores_yperergasias_nyxtas
                    );
                    document.getElementById('oresYperergasiasArgionNyxtas').value = formatValue(
                        result.total_ores_yperergasias_argion_nyxtas
                    );

                    document.getElementById('oresNomimhsYperorias').value = formatValue(
                        result.total_ores_nomimhs_yperorias
                    );
                    document.getElementById('oresNomimhsYperoriasArgion').value = formatValue(
                        result.total_ores_nomimhs_yperorias_argion
                    );
                    document.getElementById('oresNomimhsYperoriasNyxtas').value = formatValue(
                        result.total_ores_nomimhs_yperorias_nyxtas
                    );
                    document.getElementById('oresNomimhsYperoriasArgionNyxtas').value = formatValue(
                        result.total_ores_nomimhs_yperorias_argion_nyxtas
                    );

                    document.getElementById('oresParanomhsYperorias').value = formatValue(
                        result.total_ores_paranomhs_yperorias
                    );
                    document.getElementById('oresParanomhsYperoriasArgion').value = formatValue(
                        result.total_ores_paranomhs_yperorias_argion
                    );
                    document.getElementById('oresParanomhsYperoriasNyxtas').value = formatValue(
                        result.total_ores_paranomhs_yperorias_nyxtas
                    );
                    document.getElementById('oresParanomhsYperoriasArgionNyxtas').value =
                        formatValue(result.total_ores_paranomhs_yperorias_argion_nyxtas);

                    var hmeresErgasiasElem = document.getElementById('hmeresErgasias');
                    var oresErgasiasElem = document.getElementById('oresErgasias');
                    window.isManualEntry = false;

                    if (Object.keys(result).length === 0) {
                        hmeresErgasiasElem.readOnly = false;
                        oresErgasiasElem.readOnly = false;
                        hmeresErgasiasElem.value = 0;
                        oresErgasiasElem.value = 0;
                        window.isManualEntry = true;
                        hmeresErgasiasElem.focus();
                    } else {
                        hmeresErgasiasElem.readOnly = true;
                        oresErgasiasElem.readOnly = false;
                    }

                    const totalOresErgasias = _ergazomenoi.karta_ergasias
                        ? result.total_ores_ergasias_apologistika
                        : result.total_ores_ergasias_prodhlomenes;
                    const operationalPhaseContext =
                        await fetchOperationalPayrollPhaseContextWithSnapshotFallback({
                            employeeKod: document.getElementById('kodikosHidden').value,
                            startDateISOString,
                            endDateISOString,
                            ypokatasthma: getApasxolhseisYpokatasthmaForQuery()
                        });
                    if (!isCurrentFlow()) return;
                    setOperationalPayrollPhaseContext(operationalPhaseContext);

                    const useOperationalPhaseRule =
                        operationalPhaseContext?.hasUsableSingleOperationalPhase === true;
                    const operationalPhaseCode =
                        operationalPhaseContext?.operationalPhaseCode || '';
                    const shouldUpdateHmeresErgasias =
                        !useOperationalPhaseRule || operationalPhaseCode === '0';
                    const shouldUpdateOresErgasias =
                        !useOperationalPhaseRule ||
                        operationalPhaseCode === '1' ||
                        operationalPhaseCode === '2';
                    const mixedOperationalNonFullHours =
                        getMixedOperationalNonFullHours(operationalPhaseContext);

                    if (mixedOperationalNonFullHours !== null) {
                        oresErgasiasElem.value = formatValue(mixedOperationalNonFullHours, 4);
                    } else if (shouldUpdateOresErgasias) {
                        oresErgasiasElem.value = formatValue(
                            totalOresErgasias ?? result.total_ores_ergasias,
                            4
                        );
                    } else if (useOperationalPhaseRule && operationalPhaseCode === '0') {
                        oresErgasiasElem.value = '0.0000';
                    }

                    if (shouldUpdateHmeresErgasias) {
                        hmeresErgasiasElem.value =
                            result.countNotAN_ME && !isNaN(result.countNotAN_ME)
                                ? parseInt(result.countNotAN_ME)
                                : 0;
                    } else if (
                        useOperationalPhaseRule &&
                        (operationalPhaseCode === '1' || operationalPhaseCode === '2')
                    ) {
                        hmeresErgasiasElem.value = '0';
                    }

                    window.apasxolhseisSuppressFieldEvents = previousSuppress;

                    if (typeof window.recalculateApasxolhseisAfterEmployeeLoad === 'function') {
                        await window.recalculateApasxolhseisAfterEmployeeLoad({
                            runHmeresErgasias: true
                        });
                    } else {
                        let event = new Event('change');
                        document.getElementById('hmeresErgasias').dispatchEvent(event);
                    }
                    if (!isCurrentFlow()) return;

                    document.dispatchEvent(
                        new CustomEvent('sharedParamsLoaded', { detail: sharedParams })
                    );
                    if (!isCurrentFlow()) return;

                    prefetchAdjacentPayrollData(
                        getSelectedErgazomenosRecord(),
                        startDateISOString,
                        endDateISOString
                    );
                } else {
                    await handleFillFields(apasxolhseis_result, sharedParams);
                    if (!isCurrentFlow()) return;

                    document.dispatchEvent(
                        new CustomEvent('sharedParamsLoaded', { detail: sharedParams })
                    );
                    if (!isCurrentFlow()) return;

                    applyButtonPermissions(hasRecord);

                    prefetchAdjacentPayrollData(
                        getSelectedErgazomenosRecord(),
                        startDateISOString,
                        endDateISOString
                    );
                }

                lastCompletedEmployeePeriodFlowKey = flowKey;
            } finally {
                window.apasxolhseisSuppressFieldEvents = previousSuppress;
                window.apasxolhseisCompactLoader?.hide();

                if (activeEmployeePeriodFlowKey === flowKey) {
                    activeEmployeePeriodFlowKey = '';
                    activeEmployeePeriodFlowPromise = null;
                }
            }
        })();

        return activeEmployeePeriodFlowPromise;
    }

    periodoiDropdown.addEventListener('change', async () => {
        const selectedPeriodos = String(periodoiDropdown.value || '').trim();

        if (
            window.apasxolhseisSuppressFieldEvents === true ||
            window.apasxolhseisEmployeeLoadPipeline === true
        ) {
            if (selectedPeriodos) {
                const periodosHidden = document.getElementById('periodos_Hidden');
                const mhnasHidden = document.getElementById('mhnas');
                if (periodosHidden) periodosHidden.value = selectedPeriodos;
                if (mhnasHidden) mhnasHidden.value = selectedPeriodos;
            }
            return;
        }

        await runEmployeePeriodFlowOnce('periodos-change');
    });

    async function loadTypoiApodoxon() {
        if (!_SELECTED_ERGAZOMENOS) return;

        const selectedTyposApodoxon = String(
            document.getElementById('typosApodoxon_Hidden')?.value ||
                typoiApodoxonDropdown?.value ||
                document.getElementById('typ_apod')?.value ||
                ''
        ).trim();

        try {
            await setTyposApodoxonTomValue(selectedTyposApodoxon, true);
        } catch (error) {
            console.error(error);
        }
    }

    typoiApodoxonDropdown.addEventListener('change', async () => {
        const selectedTyposApodoxon = String(typoiApodoxonDropdown.value || '').trim();

        // TomSelect μπορεί να πυροδοτήσει change με κενή τιμή κατά το αρχικό init/clear.
        // Ο Τύπος Αποδοχών είναι υποχρεωτικό πεδίο, οπότε δεν στέλνουμε ποτέ κενό
        // στο /api/update_session_typosApodoxon και δεν μηδενίζουμε τα hidden fields.
        if (!selectedTyposApodoxon) {
            return;
        }

        document.getElementById('typosApodoxon_Hidden').value = selectedTyposApodoxon;
        const typApodHidden = document.getElementById('typ_apod');
        if (typApodHidden) typApodHidden.value = selectedTyposApodoxon;

        if (
            window.apasxolhseisSuppressFieldEvents === true ||
            window.apasxolhseisEmployeeLoadPipeline === true
        ) {
            return;
        }

        await updateSession(selectedTyposApodoxon);

        if (periodoiDropdown.value) {
            await runEmployeePeriodFlowOnce('typos-apodoxon-change');
        }
    });

    async function updateSession(selectedTyposApodoxon) {
        const normalizedTyposApodoxon = String(selectedTyposApodoxon || '').trim();

        if (!normalizedTyposApodoxon) return;
        if (lastSessionTyposApodoxonSent === normalizedTyposApodoxon) return;

        try {
            const response = await fetch('/api/update_session_typosApodoxon', {
                method: 'POST',
                headers: getJsonHeaders(),
                credentials: 'same-origin',
                body: JSON.stringify({ typosApodoxon: normalizedTyposApodoxon })
            });

            const result = await response.json();

            if (!result.success) {
                console.error('Σφάλμα κατά την ενημέρωση του session:', result.message);
                return;
            }

            lastSessionTyposApodoxonSent = normalizedTyposApodoxon;
        } catch (error) {
            console.error('Σφάλμα κατά την αποστολή των δεδομένων:', error);
        }
    }

    async function updateSessionPeriodos(selectedPeriodos) {
        const normalizedPeriodos = String(selectedPeriodos || '').trim();

        if (!normalizedPeriodos) return;
        if (lastSessionPeriodosSent === normalizedPeriodos) return;

        try {
            const response = await fetch('/api/update_session_periodos', {
                method: 'POST',
                headers: getJsonHeaders(),
                credentials: 'same-origin',
                body: JSON.stringify({ periodos: normalizedPeriodos })
            });

            const result = await response.json();

            if (!result.success) {
                console.error('Σφάλμα κατά την ενημέρωση του session:', result.message);
                return;
            }

            lastSessionPeriodosSent = normalizedPeriodos;
        } catch (error) {
            console.error('Σφάλμα κατά την αποστολή των δεδομένων:', error);
        }
    }

    async function mhnyma() {
        Swal.fire({
            icon: 'info',
            title: ' ',
            html: `
                Υπάρχει ήδη η εγγραφή...
            `,
            showConfirmButton: false,
            timer: 1500
        });
    }

    async function updatePosostaFields(i) {
        const index = i.toString().padStart(2, '0');
        const dropdown = document.getElementById(`krathsh_${index}`);
        const selectedOption = dropdown.options[dropdown.selectedIndex];

        if (!selectedOption) return;

        // Ενημέρωση τιμών των πεδίων
        setValue(
            `pososto_krathshs_ergazomenoy_${index}`,
            selectedOption.dataset.posostoErgazomenoy,
            4,
            false,
            true
        );
        setValue(
            `pososto_krathshs_ergodoth_${index}`,
            selectedOption.dataset.posostoErgodoth,
            4,
            false,
            true
        );
        setValue(
            `synolo_pososton_krathshs_${index}`,
            selectedOption.dataset.synoloPososton,
            4,
            false,
            true
        );

        setValue(
            `poso_krathshs_ergazomenoy_${index}`,
            selectedOption.dataset.posoErgazomenoy,
            2,
            false,
            true
        );
        setValue(
            `poso_krathshs_ergodoth_${index}`,
            selectedOption.dataset.posoErgodoth,
            2,
            false,
            true
        );
        setValue(
            `synolo_poson_krathshs_${index}`,
            selectedOption.dataset.synoloPoson,
            2,
            false,
            true
        );

        setValue(
            `anotato_orio_palion_${index}`,
            selectedOption.dataset.anotatoOrioPalion,
            2,
            false,
            true
        );
        setValue(
            `anotato_orio_neon_${index}`,
            selectedOption.dataset.anotatoOrioNeon,
            2,
            false,
            true
        );

        setValue(
            `ypologizomenoStoForo_${index}`,
            selectedOption.dataset.ypologizomenoStoForo,
            null,
            true
        );
        setValue(
            `ypologizomenoEpiPlasmatikhs_${index}`,
            selectedOption.dataset.ypologizomenoEpiPlasmatikhs,
            null,
            true
        );
        setValue(`plasmatikh_axia_${index}`, selectedOption.dataset.plasmatikhAxia, 2, false, true);
        setValue(
            `asfalistikesApodoxes_${index}`,
            selectedOption.dataset.asfalistikesApodoxes,
            2,
            false,
            true
        );
        setValue(
            `apaiteitai_apodoxes_asfalishs_${index}`,
            selectedOption.dataset.apaiteitaiApodoxesAsfalishs,
            null,
            true
        );

        setValue(`kad_${index}`, selectedOption.dataset.kad, null, false, false);
        setValue(`eidikothta_${index}`, selectedOption.dataset.eidikothta, null, false, false);
        setValue(`kpk_${index}`, selectedOption.dataset.kpk, null, false, false);
        setValue(
            `se_typos_apodoxon_${index}`,
            selectedOption.dataset.se_typos_apodoxon,
            null,
            false,
            false
        );
        setValue(`epa_${index}`, selectedOption.dataset.epa, null, false, false);

        // Έλεγχος αν πρέπει τα πεδία να είναι readonly
        const readonlyFields = [
            `pososto_krathshs_ergazomenoy_${index}`,
            `pososto_krathshs_ergodoth_${index}`,
            `poso_krathshs_ergazomenoy_${index}`,
            `poso_krathshs_ergodoth_${index}`
        ];

        if (dropdown.selectedIndex === 0) {
            readonlyFields.forEach((fieldId) => {
                const field = document.getElementById(fieldId);
                if (field) field.setAttribute('readonly', true);
            });
        } else {
            readonlyFields.forEach((fieldId) => {
                const field = document.getElementById(fieldId);
                if (field) field.removeAttribute('readonly');
            });
        }

        // Υπολογισμός αξίας κρατήσεων
        await ypologismosAxiasKrathseon();
    }

    function setValue(fieldId, value, decimalPlaces = null, isBoolean = false, format = false) {
        const field = document.getElementById(fieldId);

        if (!field) {
            console.warn(`Field with ID "${fieldId}" not found.`);
            return;
        }

        if (isBoolean) {
            field.value = value === 'true' ? 'true' : 'false'; // Εξασφαλίζει ότι η τιμή είναι πάντα "true" ή "false"
            return;
        }

        if (decimalPlaces === null) {
            field.value = value || ''; // Αντιστοίχιση της αρχικής τιμής ως string
            return;
        }

        const parsedValue = parseFloat(value);

        if (isNaN(parsedValue)) {
            field.value = decimalPlaces ? `0.${'0'.repeat(decimalPlaces)}` : '';
        } else {
            field.value = format
                ? parsedValue.toFixed(decimalPlaces).replace('.', ',')
                : parsedValue.toFixed(decimalPlaces);
        }
    }

    async function clearRowFields(index) {
        const fields = [
            `krathsh_${index}`,
            `pososto_krathshs_ergazomenoy_${index}`,
            `pososto_krathshs_ergodoth_${index}`,
            `synolo_pososton_krathshs_${index}`,
            `poso_krathshs_ergazomenoy_${index}`,
            `poso_krathshs_ergodoth_${index}`,
            `synolo_poson_krathshs_${index}`,
            `axia_krathshs_ergazomenoy_${index}`,
            `axia_krathshs_ergodoth_${index}`,
            `ypologizomenoStoForo_${index}`,
            `ypologizomenoEpiPlasmatikhs_${index}`,
            `plasmatikh_axia_${index}`,
            `asfalistikesApodoxes_${index}`,
            `apaiteitai_apodoxes_asfalishs_${index}`,
            `kad_${index}`,
            `eidikothta_${index}`,
            `kpk_${index}`,
            `se_typos_apodoxon_${index}`,
            `epa_${index}`
        ];

        fields.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (field.tagName === 'SELECT') {
                    field.selectedIndex = 0; // Επαναφορά της επιλογής
                } else {
                    field.value = ''; // Επαναφορά της τιμής
                }
            }
        });

        // Έλεγχος αν το dropdown είναι κενό
        const dropdown = document.getElementById(`krathsh_${index}`);
        const readonlyFields = [
            `pososto_krathshs_ergazomenoy_${index}`,
            `pososto_krathshs_ergodoth_${index}`,
            `poso_krathshs_ergazomenoy_${index}`,
            `poso_krathshs_ergodoth_${index}`
        ];

        if (!dropdown || dropdown.selectedIndex === 0) {
            // Κάνε τα πεδία readonly αν δεν υπάρχει επιλεγμένο στοιχείο
            readonlyFields.forEach((fieldId) => {
                const field = document.getElementById(fieldId);
                if (field) field.setAttribute('readonly', true);
            });
        } else {
            // Αφαίρεσε το readonly αν υπάρχει επιλεγμένο στοιχείο
            readonlyFields.forEach((fieldId) => {
                const field = document.getElementById(fieldId);
                if (field) field.removeAttribute('readonly');
            });
        }
        await ypologismosAxiasKrathseon();
        // await calcPlhroteo();
    }

    async function handleFillFields(apasxolhseis_result, sharedParams) {
        if (hasRecord) return;

        const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

        try {
            // Χρησιμοποιούμε dynamic import()
            let module = isProduction
                ? await import('/min.js/kinhseis/fillFieldsKinhseon.min.js')
                : await import('../ypologismoi/fillFieldsKinhseon.js');

            // Αποσυγκέντρωση των συναρτήσεων αφού φορτωθεί το module
            const {
                fillFields,
                loadKrathseis_Edit,
                updatePosostaFields_Edit,
                setValue_Edit,
                clearRowFields_Edit
            } = module;

            // Καλείται η συνάρτηση του module με το sharedParams
            if (module) {
                await fillFields(apasxolhseis_result, sharedParams);
            }
        } catch (error) {
            console.error(`Σφάλμα κατά τη φόρτωση του module:`, error);
        }
    }
});
