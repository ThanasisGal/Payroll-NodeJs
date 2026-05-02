// editStoixeiaSymbaseon.js
// Διαχείριση Στοιχείων Σύμβασης με Tom-Select dropdowns (Edit mode)
// Βασισμένο στο addStoixeiaSymbaseon.js — με preselect των αποθηκευμένων τιμών

const Decimal = window.Decimal;

import { initTomDropdown } from '../../dropdown-item.js';

import {
    toDecimal,
    formatDecimal,
    showAlert,
    fetchGenikesParametroi,
    fetchApodoxesData,
    updateGeneralParameters,
    updatePosoBasedOnHours
} from 'apodoxes-calculations';

// ========================================================================
// DECIMAL.JS CONFIGURATION
// ========================================================================

Decimal.set({
    precision: 28,
    rounding: Decimal.ROUND_HALF_UP,
    toExpNeg: -7,
    toExpPos: 15
});

// ========================================================================
// HELPERS
// ========================================================================

function formatForDisplay(decimalValue, decimals) {
    const rounded = toDecimal(decimalValue).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    const str = rounded.toString();
    const parts = str.split('.');
    if (parts.length === 1) {
        return str + '.' + '0'.repeat(decimals);
    } else {
        return parts[0] + '.' + parts[1].padEnd(decimals, '0');
    }
}

function safeSetValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        try {
            el.value = value;
        } catch (_) {}
    }
}

function pad4(v) {
    return String(v ?? '')
        .replace(/\D/g, '')
        .padStart(4, '0');
}

function setRowAmounts(idNum, poso, posoBasei) {
    const posoField = document.getElementById(`poso_symbashs_${idNum}`);
    const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);

    if (posoField) {
        posoField.value = parseFloat(poso || 0).toFixed(2);
    }

    if (posoBaseiField) {
        posoBaseiField.value = parseFloat(posoBasei || 0).toFixed(2);
    }
}

function clearRowAmounts(idNum) {
    const posoField = document.getElementById(`poso_symbashs_${idNum}`);
    const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);

    if (posoField) posoField.value = '';
    if (posoBaseiField) posoBaseiField.value = '';
}

function applyNomimaFromSymbashTotals() {
    const typosErg = document.getElementById('typos_ergazomenon')?.value;

    // Για ημερομίσθιους ('Η'), ο υπολογισμός γίνεται αποκλειστικά
    // από calculateFullTimeWages/calculatePartTimeWages — μην αντικαθιστάς.
    if (typosErg === 'Η') return;

    const synoloSymbashsEl = document.getElementById('synolo_symbashs');
    const nomimosMisthosEl = document.getElementById('nomimosMisthos');
    const nomimoHmeromisthioEl = document.getElementById('nomimoHmeromisthio');

    const synoloSymbashs = toDecimal(synoloSymbashsEl?.value);

    if (nomimosMisthosEl) {
        nomimosMisthosEl.value = formatForDisplay(synoloSymbashs, 2);
    }

    if (nomimoHmeromisthioEl) {
        nomimoHmeromisthioEl.value = formatForDisplay(
            synoloSymbashs.div(toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)),
            4
        );
    }
}

let _recalcInProgress = false;

function applyLockedTomStyle(tomInst) {
    if (!tomInst) return;

    tomInst.disable();

    const wrapper = tomInst.wrapper;
    const input = tomInst.control_input;

    wrapper?.classList.add('ts-disabled-selected');
    wrapper?.classList.add('ts-locked');

    if (input) {
        input.readOnly = true;
    }

    tomInst.refreshItems();
    tomInst.refreshState();
}

function removeLockedTomStyle(tomInst) {
    if (!tomInst) return;

    const wrapper = tomInst.wrapper;
    const input = tomInst.control_input;

    tomInst.enable();

    wrapper?.classList.remove('ts-disabled-selected');
    wrapper?.classList.remove('ts-locked');

    if (input) {
        input.readOnly = false;
    }

    requestAnimationFrame(() => {
        tomInst.refreshItems();
        tomInst.refreshState();
    });
}

function syncHiddenTarget(idNum, value = '') {
    const hiddenTarget = document.getElementById(`stoixeio_symbashs_${idNum}_hidden`);
    if (hiddenTarget) {
        hiddenTarget.value = value ? pad4(value) : '';
    }
}

function clearSingleStoixeioRow(idNum) {
    const selectEl = document.getElementById(`stoixeio_symbashs_${idNum}`);
    const row = document.getElementById(`row_${idNum}`);

    if (selectEl?.tomselect) {
        const tom = selectEl.tomselect;

        try {
            removeLockedTomStyle(tom);
            tom.ignoreFocusOpen = true;
            tom.clear(true);
            tom.clearOptions();
            tom.refreshItems();
            tom.refreshState();
            tom.close();
            tom.control_input?.blur();
            tom.ignoreFocusOpen = false;
        } catch (_) {}
    }

    syncHiddenTarget(idNum, '');
    clearRowAmounts(idNum);

    if (row) row.classList.remove('d-none');

    calculateTotal();
}

// ========================================================================
// GLOBAL VARIABLES
// ========================================================================

let currentValues = {};
let data = {};
let _isHydratingStoixeia = false;
let _suspendEidikothtaWatcher = false;
let _isStoixeioChangeInProgress = false;

// 🔵 Αριθμός στοιχείων σύμβασης για τη συγκεκριμένη σύμβαση/κατηγορία/ειδικότητα
let _AVAILABLE_STOIXEIA_COUNT = 0;

let _AA_STOIXEIOY = 0,
    _ARITHMOS_STOIXEION_SYMBASEON = 0,
    _HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = new Decimal(0),
    _HMEROMISTHIO = new Decimal(0),
    _MISTHOS = new Decimal(0),
    _NOMIMO_OROMISTHIO = new Decimal(0),
    _PLHRHS_APASXOLHSH,
    _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = new Decimal(0),
    _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = new Decimal(0),
    _ORES_ERGASIAS_EBDOMADAS_PLHROYS_APASXOLHSHS = new Decimal(0),
    _ORES_HMERHSIAS_ERGASIAS = new Decimal(0),
    _PRAGMATIKO_OROMISTHIO = new Decimal(0),
    _PRAGMATIKOS_MISTHOS = new Decimal(0),
    _SYNTELESTHS_EBDOMADON_HMEROMISTHION = new Decimal(0),
    _SYNTELESTHS_EBDOMADON_MISTHOTON = new Decimal(0),
    _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = new Decimal(0),
    totalSymbashs = new Decimal(0),
    totalBaseiOronErgasias = new Decimal(0),
    _TOTAL_EXTRA_APODOXES = new Decimal(0);

// ========================================================================
// ΑΡΧΙΚΟΠΟΙΗΣΗ
// ========================================================================

document.addEventListener('DOMContentLoaded', function () {
    _PLHRHS_APASXOLHSH = document.getElementById('plhrhs_apasxolhsh');
    generateSelectRowsOfSymbaseis();
    setupAutocompleteHack();
    addEventListeners();
    calculateTotal();
    watchEidikothtaChanges();
    loadExistingStoixeia();
});

// ========================================================================
// ΔΗΜΙΟΥΡΓΙΑ HTML ΓΙΑ ΤΑ ROWS (max 15 ως template — εμφανίζονται δυναμικά)
// ========================================================================

function generateSelectRowsOfSymbaseis() {
    const container = document.getElementById('stoixeiaSymbaseonContainer');
    if (!container) {
        console.warn('⚠️ Container stoixeiaSymbaseonContainer not found');
        return;
    }

    container.innerHTML = '';

    // Δημιουργούμε πάντα 15 rows στο DOM (ως max template).
    // Θα εμφανίζονται μόνο τα απαραίτητα βάσει _AVAILABLE_STOIXEIA_COUNT.
    for (let i = 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');
        const rowHTML = `
            <div class="row form-group align-items-center margin-top-0_75rem d-none showhide_row_${idNum} addStoixSymb001" id="row_${idNum}">
                <div class="col-0-5 text-center">
                    <label class="col-form-label label-font-size">${i}</label>
                </div>
                <div class="col-7">
                    <input type="hidden" name="stoixeio_symbashs_${idNum}_hidden" id="stoixeio_symbashs_${idNum}_hidden" />
                    <select 
                        class="tom-dropdown selectpicker-dropdown-normal left-align w-100" 
                        name="stoixeio_symbashs_${idNum}" 
                        id="stoixeio_symbashs_${idNum}"
                        data-target-input="stoixeio_symbashs_${idNum}_hidden"
                        data-pad-length="4">
                    </select>
                </div>
                <div class="col-0-5"></div>
                <div class="col-1-5">
                    <input 
                        type="number" 
                        class="form-control input-contents right-align clearAble addStoixSymb002" 
                        name="poso_symbashs_${idNum}" 
                        id="poso_symbashs_${idNum}" 
                        readonly 
                        autocomplete="off" 
                    />
                </div>
                <div class="col-0-5"></div>
                <div class="col-1-5">
                    <input 
                        type="number" 
                        class="form-control input-contents right-align numeric clearAble addStoixSymb003" 
                        name="poso_symbashs_basei_oron_ergasias_${idNum}" 
                        id="poso_symbashs_basei_oron_ergasias_${idNum}" 
                        step="0.01" 
                        autocomplete="off"
                        readonly
                        data-autocomplete-hack="true"
                    />
                </div>
                <button type="button" class="btn rounded-4 col-0-3 clear-row border-0" 
                    id="clearSelectSymbaseon-${idNum}" 
                    data-bs-toggle="tooltip" 
                    data-bs-title="Καθαρισμός όλης της τρέχουσας γραμμής" 
                    data-bs-placement="bottom" 
                    data-target="stoixeio_symbashs_${idNum}">
                    <i class="bi bi-x-lg cdarkred"></i>
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    }
}

function setupAutocompleteHack() {
    const container = document.getElementById('stoixeiaSymbaseonContainer');
    if (!container) return;

    container.addEventListener(
        'focus',
        (e) => {
            const input = e.target;
            if (input.matches && input.matches('input[data-autocomplete-hack="true"]')) {
                input.removeAttribute('readonly');
            }
        },
        true
    );
}

// ========================================================================
// FETCH ΑΡΙΘΜΟΥ ΣΤΟΙΧΕΙΩΝ ΓΙΑ ΣΥΓΚΕΚΡΙΜΕΝΗ ΣΥΜΒΑΣΗ/ΚΑΤΗΓΟΡΙΑ/ΕΙΔΙΚΟΤΗΤΑ
// ========================================================================

async function fetchAvailableStoixeiaCount(symbashVal, kathgoriaVal, eidikothtaVal) {
    try {
        const url = new URL('/api/dropdown/symbaseis/stoixeio_symbashs', window.location.origin);
        url.searchParams.set('symbash_stathera', symbashVal);
        url.searchParams.set('kathgoria_symbashs_stathera', kathgoriaVal);
        url.searchParams.set('eidikothta_symbashs_stathera', eidikothtaVal);
        url.searchParams.set('limit', '50');

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            console.warn(`⚠️ fetchAvailableStoixeiaCount: API returned ${response.status}`);
            return 0;
        }

        const apiData = await response.json();
        const items = Array.isArray(apiData.items) ? apiData.items : [];
        return items.length;
    } catch (err) {
        console.error('❌ fetchAvailableStoixeiaCount failed:', err);
        return 0;
    }
}

/**
 * Επιστρέφει τον αριθμό rows που πρέπει να εμφανίζονται.
 * Προτεραιότητα: _AVAILABLE_STOIXEIA_COUNT > _ARITHMOS_STOIXEION_SYMBASEON > fallback 15
 * Ποτέ δεν ξεπερνάει το 15.
 */
function getEffectiveRowCount() {
    if (_AVAILABLE_STOIXEIA_COUNT > 0) {
        return Math.min(_AVAILABLE_STOIXEIA_COUNT, 15);
    }
    if (_ARITHMOS_STOIXEION_SYMBASEON > 0) {
        return Math.min(_ARITHMOS_STOIXEION_SYMBASEON, 15);
    }
    return 15;
}

// ========================================================================
// ΦΟΡΤΩΣΗ ΑΠΟΘΗΚΕΥΜΕΝΩΝ ΣΤΟΙΧΕΙΩΝ (Edit mode hydration)
// ========================================================================
async function loadExistingStoixeia() {
    const symbash = document.getElementById('symbash_stathera')?.value?.trim();
    const kathgoria = document.getElementById('kathgoria_symbashs_stathera')?.value?.trim();
    const eidikothta = document.getElementById('eidikothta_symbashs_stathera')?.value?.trim();

    if (!symbash || !kathgoria || !eidikothta) return;
    _isHydratingStoixeia = true;
    _suspendEidikothtaWatcher = true;

    // Παίρνουμε τα saved items (μέχρι 15 max)
    const savedItems = [];
    for (let i = 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');

        const stoixeioVal = document
            .getElementById(`stoixeioSymbashsHidden_${idNum}`)
            ?.value?.trim();

        const posoVal = document.getElementById(`posoSymbashsHidden_${idNum}`)?.value?.trim();

        const posoBaseiVal = document
            .getElementById(`posoSymbashsBaseiOronErgasiasHidden_${idNum}`)
            ?.value?.trim();

        if (stoixeioVal && stoixeioVal !== '0' && stoixeioVal !== '0000') {
            savedItems.push({
                index: i,
                idNum,
                stoixeio: pad4(stoixeioVal),
                poso: posoVal || '0.00',
                posoBasei: posoBaseiVal || '0.00'
            });
        }
    }

    if (savedItems.length === 0) return;

    // Φέρνουμε Γενικές Παραμέτρους
    try {
        const gp = await fetchGenikesParametroi();
        updateGeneralParameters(gp);

        window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = toDecimal(gp[0]?.timh);
        window._ORES_ERGASIAS_EBDOMADAS_PLHROYS_APASXOLHSHS = toDecimal(gp[55]?.timh);
        window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = toDecimal(gp[1]?.timh);
        window._SYNTELESTHS_EBDOMADON_MISTHOTON = toDecimal(gp[2]?.timh);
        window._SYNTELESTHS_EBDOMADON_HMEROMISTHION = toDecimal(gp[3]?.timh);
        window._ORES_HMERHSIAS_ERGASIAS = toDecimal(gp[4]?.timh);
        window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = toDecimal(gp[5]?.timh);
        window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = toDecimal(gp[6]?.timh);
        window._ARITHMOS_STOIXEION_SYMBASEON = toDecimal(gp[22]?.timh);

        _ARITHMOS_STOIXEION_SYMBASEON = window._ARITHMOS_STOIXEION_SYMBASEON.toNumber();
    } catch (err) {
        console.error('❌ Σφάλμα γενικών παραμέτρων:', err);
    }

    const symbashVal = pad4(symbash);
    const kathgoriaVal = pad4(kathgoria);
    const eidikothtaVal = pad4(eidikothta);

    const selectedSymbashEl = document.getElementById('selectedSymbash');
    const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
    const selectedEidikothtaEl = document.getElementById('selectedEidikothta');

    if (selectedSymbashEl) selectedSymbashEl.value = symbashVal;
    if (selectedKathgoriaEl) selectedKathgoriaEl.value = kathgoriaVal;
    if (selectedEidikothtaEl) selectedEidikothtaEl.value = eidikothtaVal;

    // 🔵 Φέρνουμε τον πραγματικό αριθμό στοιχείων σύμβασης από το API
    _AVAILABLE_STOIXEIA_COUNT = await fetchAvailableStoixeiaCount(
        symbashVal,
        kathgoriaVal,
        eidikothtaVal
    );

    const numRows = getEffectiveRowCount();

    for (let i = 1; i <= numRows; i++) {
        const idNum = i.toString().padStart(2, '0');
        const selectId = `stoixeio_symbashs_${idNum}`;
        const rowId = `row_${idNum}`;
        const row = document.getElementById(rowId);
        const selectEl = document.getElementById(selectId);
        const saved = savedItems.find((x) => x.idNum === idNum) || null;

        if (!row || !selectEl) continue;

        row.classList.remove('d-none');

        if (selectEl.tomselect) {
            try {
                selectEl.tomselect.destroy();
            } catch (_) {}
        }

        selectEl.removeAttribute('data-preselect');

        if (saved) {
            selectEl.removeAttribute('data-preload-all');
        } else {
            selectEl.setAttribute('data-preload-all', 'true');
        }

        try {
            initTomDropdown({
                selector: `#${selectId}`,
                url: '/api/dropdown/symbaseis/stoixeio_symbashs',
                extraParams: {
                    symbash_stathera: symbashVal,
                    kathgoria_symbashs_stathera: kathgoriaVal,
                    eidikothta_symbashs_stathera: eidikothtaVal,
                    padLength: '4'
                },
                minChars: 0,
                hooks: {
                    onInitialize: function () {
                        if (saved) {
                            this._preselectDone = true;
                        }

                        this.on('change', async (value) => {
                            if (
                                _isHydratingStoixeia ||
                                this._preselecting ||
                                this._suspendItemAddFlow
                            )
                                return;
                            if (_isStoixeioChangeInProgress) return;

                            syncHiddenTarget(idNum, value || '');

                            if (value) {
                                await handleStoixeioChange(idNum, value);
                            } else {
                                clearRowAmounts(idNum);
                                calculateTotal();

                                requestAnimationFrame(async () => {
                                    applyNomimaFromSymbashTotals();
                                    // await runFullRecalculation();
                                });
                            }
                        });
                    }
                }
            });
        } catch (err) {
            console.error(`❌ initTomDropdown failed row ${idNum}:`, err);
            continue;
        }

        const tomInst = selectEl.tomselect;
        if (!tomInst) continue;

        if (saved) {
            try {
                const oneUrl = new URL(
                    '/api/dropdown/symbaseis/stoixeio_symbashs',
                    window.location.origin
                );
                oneUrl.searchParams.set('symbash_stathera', symbashVal);
                oneUrl.searchParams.set('kathgoria_symbashs_stathera', kathgoriaVal);
                oneUrl.searchParams.set('eidikothta_symbashs_stathera', eidikothtaVal);
                oneUrl.searchParams.set('value', saved.stoixeio);

                const oneRes = await fetch(oneUrl, { credentials: 'include' });
                const oneJson = await oneRes.json();
                const matchedItem = oneJson?.items?.[0];

                if (matchedItem) {
                    const kodikos =
                        matchedItem.kodikos != null
                            ? pad4(matchedItem.kodikos)
                            : pad4(matchedItem.value ?? '');

                    const label =
                        matchedItem.label ??
                        matchedItem.text ??
                        `${kodikos} - ${matchedItem.perigrafh ?? ''}`;

                    const normalized = {
                        ...matchedItem,
                        value: kodikos,
                        label: String(label),
                        text: String(label)
                    };

                    if (!tomInst.options[kodikos]) {
                        tomInst.addOption(normalized);
                    }

                    tomInst._preselecting = true;
                    tomInst._suspendItemAddFlow = true;
                    tomInst._preselectDone = true;
                    tomInst.ignoreFocusOpen = true;

                    try {
                        tomInst.setValue(kodikos, true);
                        syncHiddenTarget(idNum, kodikos);

                        requestAnimationFrame(() => {
                            tomInst.refreshItems();
                            tomInst.refreshState();
                            applyLockedTomStyle(tomInst);

                            setTimeout(() => {
                                setRowAmounts(idNum, saved.poso, saved.posoBasei);
                            }, 0);

                            setTimeout(() => {
                                tomInst._preselecting = false;
                                tomInst.ignoreFocusOpen = false;
                            }, 50);
                        });
                    } catch (setErr) {
                        console.error(`❌ row ${idNum}: setValue/disable FAILED:`, setErr);
                    } finally {
                        setTimeout(() => {
                            tomInst._suspendItemAddFlow = false;
                        }, 350);
                    }
                } else {
                    console.warn(
                        `⚠️ Δεν βρέθηκε στοιχείο σύμβασης ${saved.stoixeio} για row ${idNum}`
                    );
                }
            } catch (err) {
                console.error(`❌ fetch saved stoixeio failed row ${idNum}:`, err);
            }
        }
    }

    // Κρύβουμε τα rows που δεν χρειάζονται
    for (let i = numRows + 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');
        const row = document.getElementById(`row_${idNum}`);
        if (row) row.classList.add('d-none');
    }

    setTimeout(() => {
        calculateTotal();

        requestAnimationFrame(async () => {
            applyNomimaFromSymbashTotals();
            // await runFullRecalculation();
        });

        _isHydratingStoixeia = false;
        _suspendEidikothtaWatcher = false;
    }, 400);
}

// ========================================================================
// EVENT LISTENERS
// ========================================================================

function addEventListeners() {
    const container = document.getElementById('stoixeiaSymbaseonContainer');
    if (!container) return;

    container.addEventListener('input', handleInputEvent);

    container.addEventListener('click', (e) => {
        const trashBtn = e.target.closest('.clear-row');
        if (trashBtn) {
            const targetId = trashBtn.dataset.target;
            const rowNumMatch = targetId?.match(/\d+/);
            if (!rowNumMatch) return;

            const rowNum = rowNumMatch[0];
            clearSingleStoixeioRow(rowNum);
        }
    });
}

function handleInputEvent(event) {
    if (_isStoixeioChangeInProgress) return;

    if (event.target.type === 'number' && event.target.classList.contains('numeric')) {
        const elementId = event.target.id;
        const newValue = toDecimal(event.target.value);
        const oldValue = currentValues[elementId]
            ? toDecimal(currentValues[elementId])
            : new Decimal(0);

        _TOTAL_EXTRA_APODOXES = _TOTAL_EXTRA_APODOXES.plus(newValue).minus(oldValue);
        currentValues[elementId] = newValue.toString();

        formatNumericInput(event.target);

        data.poso = newValue;
        const rowMatch = elementId.match(/poso_symbashs_basei_oron_ergasias_(\d+)/);
        if (rowMatch) {
            _AA_STOIXEIOY = parseInt(rowMatch[1]);
            let extraApodoxes = true;
            if (data.genikesParametroi) {
                updateGeneralParameters(data.genikesParametroi);
            }
            updatePosoBasedOnHours(_AA_STOIXEIOY, data, elementId, extraApodoxes);
        }

        calculateTotal();
        applyNomimaFromSymbashTotals();
        triggerRecalcButton();
    }
}

function formatNumericInput(input) {
    if (!input || !input.value) return;

    const cursorPosition = input.selectionStart;
    const originalValue = input.value;
    if (!originalValue) {
        input.value = '';
        return;
    }

    const numValue = toDecimal(originalValue);
    const newValue = formatDecimal(numValue, 2);

    if (newValue !== originalValue) {
        if (input.type === 'text' && input.setSelectionRange) {
            try {
                const diff = newValue.length - originalValue.length;
                const newPos = Math.max(0, cursorPosition + diff);
                input.setSelectionRange(newPos, newPos);
            } catch (err) {}
        }
    }
}

// ========================================================================
// ΧΕΙΡΙΣΜΟΣ ΑΛΛΑΓΗΣ ΣΤΟΙΧΕΙΟΥ (από τον χρήστη)
// ========================================================================

async function handleStoixeioChange(rowIndex, selectedValue) {
    if (!selectedValue) return;

    _isStoixeioChangeInProgress = true;
    _AA_STOIXEIOY = parseInt(rowIndex);

    const contract = document.getElementById('selectedSymbash')?.value?.padStart(4, '0');
    const category = document.getElementById('selectedKathgoria')?.value?.padStart(4, '0');
    const specialty = document.getElementById('selectedEidikothta')?.value?.padStart(4, '0');
    const klimakioEl = document.getElementById('misthologiko_klimakio');
    const klimakio = klimakioEl?.value?.padStart(2, '0') || '01';
    const hmeromhniaEl = document.getElementById('hmeromhnia_allaghs_symbashs');
    const hmeromhnia = hmeromhniaEl?.value || '';

    data = await fetchApodoxesData(
        contract,
        category,
        specialty,
        selectedValue.padStart(4, '0'),
        klimakio,
        hmeromhnia
    );

    if (!data.success) {
        showAlert({
            icon: 'warning',
            title: 'Προσοχή !!!',
            html: 'Δεν έχουν ενημερωθεί <strong>τα κλιμάκια</strong> της επιλεγείσας σύμβασης'
        });
        return;
    }

    const posoFieldId = `poso_symbashs_${rowIndex}`;
    const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${rowIndex}`;
    const posoField = document.getElementById(posoFieldId);

    if (posoField) {
        posoField.value = formatDecimal(data.poso, 2);
    }

    let extraApodoxes = false;
    updateGeneralParameters(data.genikesParametroi);
    updatePosoBasedOnHours(parseInt(rowIndex), data, posoBasedOnHoursFieldId, extraApodoxes);

    const posoValue = toDecimal(data.poso);
    if (!posoValue.isZero()) {
        calculateTotal();
        applyNomimaFromSymbashTotals();

        // await runFullRecalculation();

        // Τελικό σφράγισμα
        setTimeout(() => {
            calculateTotal();
            applyNomimaFromSymbashTotals();
        }, 500);
    }
    // } catch (error) {
    //     console.error('❌ Σφάλμα κατά την ενημέρωση αποδοχών:', error);
    // } finally {
    //     setTimeout(() => {
    //         _isStoixeioChangeInProgress = false;
    //     }, 600);
    // }
}

// ========================================================================
// ΥΠΟΛΟΓΙΣΜΟΙ ΣΥΝΟΛΩΝ
// ========================================================================
async function calculateTotal() {
    totalSymbashs = new Decimal(0);
    totalBaseiOronErgasias = new Decimal(0);
    _TOTAL_EXTRA_APODOXES = new Decimal(0);
    _PRAGMATIKO_OROMISTHIO = new Decimal(0);

    const oresEl = document.getElementById('ores_ergasias_ebdomadas');
    const hmeresEl = document.getElementById('hmeres_ergasias_ebdomadas');

    const ores_ergasias_ebdomadas = toDecimal(oresEl?.value);
    const hmeres_ergasias_ebdomadas = toDecimal(hmeresEl?.value);

    // 🔵 Χρησιμοποιούμε τον πραγματικό αριθμό στοιχείων
    const rowCount = getEffectiveRowCount();

    for (let i = 1; i <= rowCount; i++) {
        const idNum = i.toString().padStart(2, '0');
        const posoInput = document.getElementById(`poso_symbashs_${idNum}`);
        const posoInputBaseiOron = document.getElementById(
            `poso_symbashs_basei_oron_ergasias_${idNum}`
        );

        const posoValue = toDecimal(posoInput?.value);
        const posoBaseiValue = toDecimal(posoInputBaseiOron?.value);

        totalSymbashs = totalSymbashs.plus(posoValue);
        totalBaseiOronErgasias = totalBaseiOronErgasias.plus(posoBaseiValue);

        if (!posoBaseiValue.isZero() && posoValue.isZero()) {
            _TOTAL_EXTRA_APODOXES = _TOTAL_EXTRA_APODOXES.plus(posoBaseiValue);
        }
    }

    safeSetValue('synolo_symbashs', formatForDisplay(totalSymbashs, 2));
    safeSetValue(
        'synolo_symbashs_basei_oron_ergasias',
        formatForDisplay(totalBaseiOronErgasias, 2)
    );

    const typosErg = document.getElementById('typos_ergazomenon')?.value;
    const eidKath = document.getElementById('eidikh_kathgoria_ergazomenoy')?.value;

    if (_PLHRHS_APASXOLHSH && _PLHRHS_APASXOLHSH.checked) {
        calculateFullTimeWages(
            typosErg,
            eidKath,
            ores_ergasias_ebdomadas,
            hmeres_ergasias_ebdomadas
        );
    } else {
        calculatePartTimeWages(
            typosErg,
            eidKath,
            ores_ergasias_ebdomadas,
            hmeres_ergasias_ebdomadas
        );
    }

    setupAutomaticRecalculation();

    applyNomimaFromSymbashTotals();
}

function calculateFullTimeWages(typosErg, eidKath, ores, hmeres) {
    const nomimosMisthos = document.getElementById('nomimosMisthos');
    const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
    const nomimoOromisthio = document.getElementById('nomimoOromisthio');
    const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
    const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
    const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');

    let nomimosMisthosValue = new Decimal(0);
    let nomimoHmeromisthioValue = new Decimal(0);
    let nomimoOromisthioValue = new Decimal(0);
    let pragmatikosMisthosValue = new Decimal(0);
    let pragmatikoHmeromisthioValue = new Decimal(0);
    let pragmatikoOromisthioValue = new Decimal(0);

    // 🔵 Υπάρχουν δωτά στοιχεία; (posoBasei > 0 και poso == 0)
    const hasExtraApodoxes = !_TOTAL_EXTRA_APODOXES.isZero();
    // Ποσό βάσει ωρών ΧΩΡΙΣ τα δωτά (για υπολογισμό πραγματικού ημερομισθίου)
    const totalBaseiMinusExtra = totalBaseiOronErgasias.minus(_TOTAL_EXTRA_APODOXES);

    switch (typosErg) {
        case 'Ω':
            if (eidKath === '0001') {
                _NOMIMO_OROMISTHIO = new Decimal(6)
                    .div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
                    .div(25)
                    .times(totalSymbashs);

                _PRAGMATIKO_OROMISTHIO = new Decimal(6)
                    .div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
                    .div(25)
                    .times(totalBaseiOronErgasias);

                if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
                    _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                }

                nomimosMisthosValue = totalSymbashs;
                nomimoHmeromisthioValue = totalSymbashs.div(
                    toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
                );
                nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

                if (hasExtraApodoxes) {
                    // 🔵 Δωτά στοιχεία: πραγματικό ωρομίσθιο = νόμιμο ωρομίσθιο
                    _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                    pragmatikosMisthosValue = totalBaseiOronErgasias;
                    pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres);
                    pragmatikoOromisthioValue = _NOMIMO_OROMISTHIO;
                } else {
                    pragmatikosMisthosValue = totalBaseiOronErgasias;
                    pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres);
                    pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
                }
            }
            break;

        case 'Μ':
            _NOMIMO_OROMISTHIO = totalSymbashs.div(
                toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
            );
            _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
                toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
            );

            if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
            }

            nomimosMisthosValue = totalSymbashs;
            nomimoHmeromisthioValue = totalSymbashs.div(
                toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
            );
            nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

            if (hasExtraApodoxes) {
                // 🔵 Δωτά στοιχεία
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                // Ημερομίσθιο βάσει (totalBasei - extra) / ημέρες πλήρους
                pragmatikoHmeromisthioValue = totalBaseiMinusExtra.div(
                    toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
                );
                pragmatikoOromisthioValue = _NOMIMO_OROMISTHIO;
            } else {
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(
                    toDecimal(window._ORES_HMERHSIAS_ERGASIAS)
                );
                pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
            }
            break;

        case 'Η':
            _NOMIMO_OROMISTHIO = totalSymbashs.times(
                toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO)
            );
            _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
                ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION))
            );

            if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
            }

            nomimosMisthosValue = totalSymbashs;
            nomimoHmeromisthioValue = totalSymbashs.div(
                toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
            );
            nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

            if (hasExtraApodoxes) {
                // 🔵 Δωτά στοιχεία
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                if (!ores.isZero() && !hmeres.isZero()) {
                    pragmatikoHmeromisthioValue = totalBaseiMinusExtra.div(
                        toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
                    );
                } else {
                    pragmatikoHmeromisthioValue = new Decimal(0);
                }
                pragmatikoOromisthioValue = _NOMIMO_OROMISTHIO;
            } else {
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
                    pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres);
                } else {
                    pragmatikoHmeromisthioValue = new Decimal(0);
                }
                pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
            }
            break;
    }

    if (nomimosMisthos) nomimosMisthos.value = formatForDisplay(nomimosMisthosValue, 2);
    if (nomimoHmeromisthio) nomimoHmeromisthio.value = formatForDisplay(nomimoHmeromisthioValue, 4);
    if (nomimoOromisthio) nomimoOromisthio.value = formatForDisplay(nomimoOromisthioValue, 4);
    if (pragmatikosMisthos) pragmatikosMisthos.value = formatForDisplay(pragmatikosMisthosValue, 2);
    if (pragmatikoHmeromisthio)
        pragmatikoHmeromisthio.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
    if (pragmatikoOromisthio)
        pragmatikoOromisthio.value = formatForDisplay(pragmatikoOromisthioValue, 4);
}

function calculatePartTimeWages(typosErg, eidKath, ores, hmeres) {
    const nomimosMisthos = document.getElementById('nomimosMisthos');
    const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
    const nomimoOromisthio = document.getElementById('nomimoOromisthio');
    const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
    const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
    const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');

    const _ores_apasxolhshs = !hmeres.isZero() ? ores.div(hmeres) : new Decimal(0);

    let nomimosMisthosValue = new Decimal(0);
    let nomimoHmeromisthioValue = new Decimal(0);
    let nomimoOromisthioValue = new Decimal(0);
    let pragmatikosMisthosValue = new Decimal(0);
    let pragmatikoHmeromisthioValue = new Decimal(0);
    let pragmatikoOromisthioValue = new Decimal(0);

    // 🔵 Υπάρχουν δωτά στοιχεία;
    const hasExtraApodoxes = !_TOTAL_EXTRA_APODOXES.isZero();
    const totalBaseiMinusExtra = totalBaseiOronErgasias.minus(_TOTAL_EXTRA_APODOXES);

    switch (typosErg) {
        case 'Ω':
            if (eidKath === '0001') {
                _NOMIMO_OROMISTHIO = new Decimal(6)
                    .div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
                    .div(25)
                    .times(totalSymbashs);

                _PRAGMATIKO_OROMISTHIO = !ores.isZero()
                    ? totalBaseiOronErgasias.div(
                          ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON))
                      )
                    : new Decimal(0);

                if (_PRAGMATIKO_OROMISTHIO.lt(_NOMIMO_OROMISTHIO)) {
                    _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                }

                nomimosMisthosValue = totalSymbashs;
                nomimoHmeromisthioValue = totalSymbashs.div(
                    toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
                );
                nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

                if (hasExtraApodoxes) {
                    _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                    pragmatikosMisthosValue = totalBaseiOronErgasias;
                    if (!ores.isZero() && !hmeres.isZero()) {
                        pragmatikoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(_ores_apasxolhshs);
                    } else {
                        pragmatikoHmeromisthioValue = new Decimal(0);
                    }
                    pragmatikoOromisthioValue = _NOMIMO_OROMISTHIO;
                } else {
                    pragmatikosMisthosValue = totalBaseiOronErgasias;
                    if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
                        pragmatikoHmeromisthioValue =
                            _PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs);
                    } else {
                        pragmatikoHmeromisthioValue = new Decimal(0);
                    }
                    pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
                }
            }
            break;

        case 'Μ':
            _NOMIMO_OROMISTHIO = totalSymbashs.div(
                toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
            );

            _PRAGMATIKO_OROMISTHIO = !ores.isZero()
                ? totalBaseiOronErgasias.div(
                      ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON))
                  )
                : new Decimal(0);

            if (_PRAGMATIKO_OROMISTHIO.lt(_NOMIMO_OROMISTHIO)) {
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
            }

            nomimosMisthosValue = totalSymbashs;
            nomimoHmeromisthioValue = totalSymbashs.div(
                toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
            );
            nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

            if (hasExtraApodoxes) {
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                if (!ores.isZero() && !hmeres.isZero()) {
                    pragmatikoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(_ores_apasxolhshs);
                } else {
                    pragmatikoHmeromisthioValue = new Decimal(0);
                }
                pragmatikoOromisthioValue = _NOMIMO_OROMISTHIO;
            } else {
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
                    pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs);
                } else {
                    pragmatikoHmeromisthioValue = new Decimal(0);
                }
                pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
            }
            break;

        case 'Η':
            _NOMIMO_OROMISTHIO = totalSymbashs.times(
                toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO)
            );

            _PRAGMATIKO_OROMISTHIO = !ores.isZero()
                ? totalBaseiOronErgasias.div(
                      ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION))
                  )
                : new Decimal(0);

            if (_PRAGMATIKO_OROMISTHIO.lt(_NOMIMO_OROMISTHIO)) {
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
            }

            nomimoHmeromisthioValue = totalSymbashs;
            nomimoOromisthioValue = _NOMIMO_OROMISTHIO;
            nomimosMisthosValue = nomimoOromisthioValue
                .times(toDecimal(window._ORES_ERGASIAS_EBDOMADAS_PLHROYS_APASXOLHSHS))
                .times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION));

            if (hasExtraApodoxes) {
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                if (!ores.isZero() && !hmeres.isZero()) {
                    pragmatikoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(_ores_apasxolhshs);
                } else {
                    pragmatikoHmeromisthioValue = new Decimal(0);
                }
                pragmatikoOromisthioValue = _NOMIMO_OROMISTHIO;
            } else {
                pragmatikosMisthosValue = totalBaseiOronErgasias;
                if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
                    pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs);
                } else {
                    pragmatikoHmeromisthioValue = new Decimal(0);
                }
                pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
            }
            break;
    }

    if (nomimosMisthos) {
        nomimosMisthos.value = formatForDisplay(nomimosMisthosValue, 2);
    }
    if (nomimoHmeromisthio) {
        nomimoHmeromisthio.value = formatForDisplay(nomimoHmeromisthioValue, 4);
    }
    if (nomimoOromisthio) {
        nomimoOromisthio.value = formatForDisplay(nomimoOromisthioValue, 4);
    }
    if (pragmatikosMisthos) {
        pragmatikosMisthos.value = formatForDisplay(pragmatikosMisthosValue, 2);
    }
    if (pragmatikoHmeromisthio) {
        pragmatikoHmeromisthio.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
    }
    if (pragmatikoOromisthio) {
        pragmatikoOromisthio.value = formatForDisplay(pragmatikoOromisthioValue, 4);
    }
}

function setupAutomaticRecalculation() {
    const pragmatikoOromisthioEl = document.getElementById('pragmatikoOromisthio');
    if (!pragmatikoOromisthioEl) return;

    const pragmatikoOromisthio = pragmatikoOromisthioEl.value;
    const oromisthioValue = toDecimal(pragmatikoOromisthio);
    const isOromisthioValid =
        pragmatikoOromisthio && !oromisthioValue.isNaN() && !oromisthioValue.isZero();

    if (isOromisthioValid) {
        const ids = [
            'hmeromhnia_allaghs_symbashs',
            'proyphresia_se_eth',
            'proyphresia_se_mhnes',
            'eidikh_kathgoria_ergazomenoy',
            'plhrhs_apasxolhsh',
            'hmeres_ergasias_ebdomadas',
            'ores_ergasias_ebdomadas',
            'typos_ergazomenon',
            'misthologiko_klimakio'
        ];

        ids.forEach((id) => {
            const element = document.getElementById(id);
            if (element && !element.__recalcBound) {
                element.__recalcBound = true;
                element.addEventListener('change', () => {
                    calculateTotal();
                    applyNomimaFromSymbashTotals();
                });
            }
        });
    }
}

// ========================================================================
// WATCH EIDIKOTHTA CHANGES
// ========================================================================

function watchEidikothtaChanges() {
    const eidikothtaHidden = document.getElementById('eidikothta_symbashs_stathera');
    const eidikothtaTable = document.getElementById('eidikothta_symbashs_table');

    if (!eidikothtaHidden) {
        console.warn('⚠️ Δε βρέθηκε το hidden field: eidikothta_symbashs_stathera');
        return;
    }

    let previousValue = eidikothtaHidden.value;
    let previousTable = eidikothtaTable?.value || '[]';
    let isInitialLoad = true;

    const checkChange = () => {
        if (_suspendEidikothtaWatcher) {
            return;
        }

        if (isInitialLoad) {
            isInitialLoad = false;
            return;
        }

        const currentValue = eidikothtaHidden.value?.trim();
        const currentTable = eidikothtaTable?.value || '[]';

        const valueChanged = currentValue !== previousValue;
        const tableChanged = currentTable !== previousTable;

        if (valueChanged || tableChanged) {
            previousValue = currentValue;
            previousTable = currentTable;

            if (!currentValue) {
                clearAllStoixeiaRows();
                return;
            }

            clearAllStoixeiaRows();
            setTimeout(() => loadStoixeiaSymbaseonFromAPI(), 150);
        }
    };

    const observer = new MutationObserver(checkChange);
    observer.observe(eidikothtaHidden, { attributes: true, attributeFilter: ['value'] });

    if (eidikothtaTable) {
        const tableObserver = new MutationObserver(checkChange);
        tableObserver.observe(eidikothtaTable, { attributes: true, attributeFilter: ['value'] });
    }

    ['change', 'input'].forEach((eventType) => {
        eidikothtaHidden.addEventListener(eventType, checkChange);
        eidikothtaTable?.addEventListener(eventType, checkChange);
    });

    window.addEventListener('eidikothtaChanged', checkChange);
}

// ========================================================================
// ΦΟΡΤΩΣΗ ΑΠΟ API (για αλλαγή eidikothta από τον χρήστη)
// ========================================================================

async function loadStoixeiaSymbaseonFromAPI() {
    try {
        const symbash = document.getElementById('symbash_stathera')?.value?.trim();
        const kathgoria = document.getElementById('kathgoria_symbashs_stathera')?.value?.trim();
        const eidikothta = document.getElementById('eidikothta_symbashs_stathera')?.value?.trim();

        if (!symbash || !kathgoria || !eidikothta) {
            console.warn('⚠️ Λείπουν Σύμβαση/Κατηγορία/Ειδικότητα');
            return;
        }

        const url = new URL('/api/dropdown/symbaseis/stoixeio_symbashs', window.location.origin);
        url.searchParams.set('symbash_stathera', symbash.padStart(4, '0'));
        url.searchParams.set('kathgoria_symbashs_stathera', kathgoria.padStart(4, '0'));
        url.searchParams.set('eidikothta_symbashs_stathera', eidikothta.padStart(4, '0'));
        url.searchParams.set('limit', 50);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const apiData = await response.json();
        const items = Array.isArray(apiData.items) ? apiData.items : [];

        if (items.length === 0) {
            showAlert({
                icon: 'warning',
                title: 'Προσοχή !!!',
                html: 'Δεν υπάρχουν διαθέσιμα <strong>Στοιχεία Σύμβασης</strong> για την επιλεγμένη Ειδικότητα.'
            });
            return;
        }

        // 🔵 Ενημέρωση _AVAILABLE_STOIXEIA_COUNT από τα πραγματικά items
        _AVAILABLE_STOIXEIA_COUNT = items.length;

        const selectedSymbashEl = document.getElementById('selectedSymbash');
        const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
        const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
        if (selectedSymbashEl) selectedSymbashEl.value = symbash.padStart(4, '0');
        if (selectedKathgoriaEl) selectedKathgoriaEl.value = kathgoria.padStart(4, '0');
        if (selectedEidikothtaEl) selectedEidikothtaEl.value = eidikothta.padStart(4, '0');

        const genikesParametroi = await fetchGenikesParametroi();
        updateGeneralParameters(genikesParametroi);

        window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = toDecimal(genikesParametroi[0]?.timh);
        window._ORES_ERGASIAS_EBDOMADAS_PLHROYS_APASXOLHSHS = toDecimal(
            genikesParametroi[55]?.timh
        );
        window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = toDecimal(
            genikesParametroi[1]?.timh
        );
        window._SYNTELESTHS_EBDOMADON_MISTHOTON = toDecimal(genikesParametroi[2]?.timh);
        window._SYNTELESTHS_EBDOMADON_HMEROMISTHION = toDecimal(genikesParametroi[3]?.timh);
        window._ORES_HMERHSIAS_ERGASIAS = toDecimal(genikesParametroi[4]?.timh);
        window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = toDecimal(genikesParametroi[5]?.timh);
        window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = toDecimal(genikesParametroi[6]?.timh);
        window._ARITHMOS_STOIXEION_SYMBASEON = toDecimal(genikesParametroi[22]?.timh);
        _ARITHMOS_STOIXEION_SYMBASEON = window._ARITHMOS_STOIXEION_SYMBASEON.toNumber();

        await initializeTomSelectForStoixeia(items);
    } catch (error) {
        showAlert({
            icon: 'error',
            title: 'Σφάλμα κατά τη φόρτωση Στοιχείων Σύμβασης',
            html: `Σφάλμα: ${error.message}`
        });
    }
}

async function initializeTomSelectForStoixeia(items) {
    if (!initTomDropdown) {
        console.error('❌ initTomDropdown not available!');
        return;
    }

    // Καθαρισμός ΟΛΩΝ των rows (μέχρι 15)
    for (let i = 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');
        const selectId = `stoixeio_symbashs_${idNum}`;
        const rowId = `row_${idNum}`;
        const selectEl = document.getElementById(selectId);
        const row = document.getElementById(rowId);

        if (selectEl?.tomselect) {
            try {
                selectEl.tomselect.destroy();
            } catch (e) {}
        }
        if (row) row.classList.add('d-none');

        syncHiddenTarget(idNum, '');
        clearRowAmounts(idNum);
    }

    // 🔵 Εμφανίζουμε μόνο τόσα rows όσα τα items
    const numRows = Math.min(items.length, 15);

    const symbashVal = (document.getElementById('symbash_stathera')?.value || '')
        .trim()
        .padStart(4, '0');
    const kathgoriaVal = (document.getElementById('kathgoria_symbashs_stathera')?.value || '')
        .trim()
        .padStart(4, '0');
    const eidikothtaVal = (document.getElementById('eidikothta_symbashs_stathera')?.value || '')
        .trim()
        .padStart(4, '0');

    for (let i = 1; i <= numRows; i++) {
        const idNum = i.toString().padStart(2, '0');
        const selectId = `stoixeio_symbashs_${idNum}`;
        const rowId = `row_${idNum}`;
        const row = document.getElementById(rowId);
        const selectEl = document.getElementById(selectId);

        row.classList.remove('d-none');
        selectEl.setAttribute('data-preload-all', 'true');

        try {
            await initTomDropdown({
                selector: `#${selectId}`,
                url: '/api/dropdown/symbaseis/stoixeio_symbashs',
                extraParams: {
                    symbash_stathera: symbashVal,
                    kathgoria_symbashs_stathera: kathgoriaVal,
                    eidikothta_symbashs_stathera: eidikothtaVal,
                    padLength: '4'
                },
                minChars: 0,
                hooks: {
                    onInitialize: function () {
                        this.on('change', async (value) => {
                            if (
                                _isHydratingStoixeia ||
                                this._preselecting ||
                                this._suspendItemAddFlow
                            )
                                return;
                            if (_isStoixeioChangeInProgress) return;

                            syncHiddenTarget(idNum, value || '');

                            if (value) {
                                await handleStoixeioChange(idNum, value);
                            } else {
                                clearRowAmounts(idNum);
                                calculateTotal();

                                requestAnimationFrame(async () => {
                                    applyNomimaFromSymbashTotals();
                                    // await runFullRecalculation();
                                });
                            }
                        });
                    }
                }
            });
        } catch (err) {
            console.error(`❌ Failed to init Tom-Select for ${selectId}:`, err);
        }
    }
}

// ========================================================================
// CLEAR HELPERS
// ========================================================================

function clearAllStoixeiaRows() {
    // Καθαρισμός ΟΛΩΝ (μέχρι 15), ανεξαρτήτως _AVAILABLE_STOIXEIA_COUNT
    for (let i = 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');
        const selectId = `stoixeio_symbashs_${idNum}`;
        const selectEl = document.getElementById(selectId);

        if (selectEl?.tomselect) {
            try {
                removeLockedTomStyle(selectEl.tomselect);
                selectEl.tomselect.destroy();
            } catch (e) {}
        }

        syncHiddenTarget(idNum, '');
        clearRowAmounts(idNum);

        const row = document.getElementById(`row_${idNum}`);
        if (row) row.classList.add('d-none');
    }

    // Μηδενισμός count μέχρι να φορτωθεί νέα ειδικότητα
    _AVAILABLE_STOIXEIA_COUNT = 0;

    const synoloSymb = document.getElementById('synolo_symbashs');
    const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
    if (synoloSymb) synoloSymb.value = '0.00';
    if (synoloBasei) synoloBasei.value = '0.00';
}

window.clearStoixeiaSymbaseonContainer = function () {
    // Καθαρισμός ΟΛΩΝ (μέχρι 15)
    for (let i = 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');
        const selectId = `stoixeio_symbashs_${idNum}`;
        const selectEl = document.getElementById(selectId);

        if (selectEl?.tomselect) {
            try {
                removeLockedTomStyle(selectEl.tomselect);
                selectEl.tomselect.clear(true);
                selectEl.tomselect.clearOptions();
                selectEl.tomselect.destroy();
            } catch (e) {}
        }

        syncHiddenTarget(idNum, '');
        clearRowAmounts(idNum);

        const row = document.getElementById(`row_${idNum}`);
        if (row) row.classList.add('d-none');
    }

    _AVAILABLE_STOIXEIA_COUNT = 0;

    const synoloSymb = document.getElementById('synolo_symbashs');
    const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
    if (synoloSymb) synoloSymb.value = '0.00';
    if (synoloBasei) synoloBasei.value = '0.00';

    const selectedSymbashEl = document.getElementById('selectedSymbash');
    const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
    const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
    if (selectedSymbashEl) selectedSymbashEl.value = '';
    if (selectedKathgoriaEl) selectedKathgoriaEl.value = '';
    if (selectedEidikothtaEl) selectedEidikothtaEl.value = '';

    const fields = [
        'nomimosMisthos',
        'nomimoHmeromisthio',
        'nomimoOromisthio',
        'pragmatikosMisthos',
        'pragmatikoHmeromisthio',
        'pragmatikoOromisthio'
    ];
    fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '0.00';
    });
};

// ========================================================================
// GLOBAL EXPORTS
// ========================================================================

window.loadStoixeiaSymbaseonFromAPI = loadStoixeiaSymbaseonFromAPI;
window.calculateTotal = calculateTotal;
