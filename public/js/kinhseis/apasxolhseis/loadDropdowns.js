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

function setApasxolhseisPipelineLoaderVisible(visible) {
    window.apasxolhseisPipelineLoaderActive = !!visible;
    if (loaderContainer) {
        loaderContainer.style.display = visible ? 'grid' : 'none';
    }
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

            if (normalizedItems.length > 0) {
                tom.setValue(normalizedItems[0].value, false);
            }

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

        if (normalizedItems.length > 0) {
            ergazomenoiDropdown.value = normalizedItems[0].value;
            const event = new Event('change', { bubbles: true });
            ergazomenoiDropdown.dispatchEvent(event);
        }
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

        beginApasxolhseisPipelineLoader();

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
            endApasxolhseisPipelineLoader();
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

            beginApasxolhseisPipelineLoader();

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
                    isReady: true
                };

                console.log('Shared parameters updated:', sharedParams);

                window.sharedParams = sharedParams;

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

                    document.dispatchEvent(new Event('sharedParamsReady'));
                    document.getElementById('kodikosHidden').value =
                        sharedParams.ergazomenoi.kodikos;
                    const result = await fetchCalcTotals(
                        document.getElementById('kodikosHidden').value,
                        startDateISOString,
                        endDateISOString
                    );
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

                    hmeresErgasiasElem.value =
                        result.countNotAN_ME && !isNaN(result.countNotAN_ME)
                            ? parseInt(result.countNotAN_ME)
                            : 0;

                    document.dispatchEvent(
                        new CustomEvent('sharedParamsLoaded', { detail: sharedParams })
                    );
                    if (!isCurrentFlow()) return;

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

                    prefetchAdjacentPayrollData(
                        getSelectedErgazomenosRecord(),
                        startDateISOString,
                        endDateISOString
                    );
                } else {
                    document.dispatchEvent(
                        new CustomEvent('sharedParamsLoaded', { detail: sharedParams })
                    );
                    if (!isCurrentFlow()) return;

                    await handleFillFields(apasxolhseis_result, sharedParams);
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
                endApasxolhseisPipelineLoader();

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
