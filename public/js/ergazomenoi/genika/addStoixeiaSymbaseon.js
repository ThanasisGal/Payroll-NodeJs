// addStoixeiaSymbaseon.js
// Διαχείριση Στοιχείων Σύμβασης με Tom-Select dropdowns
// Last Updated: 11/04/2026 - WITH SHARED UTILITIES + DYNAMIC ROWS + EXTRA APODOXES

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
        const decimalPart = parts[1].padEnd(decimals, '0');
        return parts[0] + '.' + decimalPart;
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

function syncHiddenTarget(idNum, value = '') {
    const hiddenTarget = document.getElementById(`stoixeio_symbashs_${idNum}_hidden`);
    if (hiddenTarget) {
        hiddenTarget.value = value ? pad4(value) : '';
    }
}

function applyNomimaFromSymbashTotals() {
    const typosErg = document.getElementById('typos_ergazomenon')?.value;

    // Για ημερομίσθιους ('Η'), οι τιμές έχουν ήδη υπολογιστεί σωστά
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

// ========================================================================
// GLOBAL VARIABLES
// ========================================================================

let currentValues = {};
let data = {};

// Flag που χρησιμοποιείται και από το manual F9/F10 flow, ώστε όταν
// επιλέγεται αυτόματα το EXTRA στοιχείο να μη τρέχουν παράλληλα οι
// κλασικοί handlers και ξαναγράφουν/μηδενίζουν το ποσό βάσει ωρών.
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
// MANUAL ΠΡΑΓΜΑΤΙΚΟ ΩΡΟΜΙΣΘΙΟ (F9 / F10)
// ========================================================================

let _MANUAL_OROMISTHIO_ACTIVE = false;
let _MANUAL_OROMISTHIO_VALUE = new Decimal(0);
let _MANUAL_OROMISTHIO_RECALC_RUNNING = false;
let _RECALC_BUTTON_BOUND = false;

const EXTRA_APODOXES_LABEL = 'EXTRA ΑΠΟΔΟΧΕΣ ΔΥΝΑΜΕΝΕΣ ΝΑ ΑΝΑΙΡΕΘΟΥΝ';

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
    setupManualPragmatikoOromisthioEditor();
});

// ========================================================================
// ΔΗΜΙΟΥΡΓΙΑ HTML ΓΙΑ ΤΑ ROWS (max 15 ως template)
// ========================================================================

function generateSelectRowsOfSymbaseis() {
    const container = document.getElementById('stoixeiaSymbaseonContainer');
    if (!container) {
        console.warn('⚠️ Container stoixeiaSymbaseonContainer not found');
        return;
    }

    container.innerHTML = '';

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
                        data-preload-all="true"
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
// ΔΥΝΑΜΙΚΟΣ ΑΡΙΘΜΟΣ ROWS
// ========================================================================

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
            const selectEl = document.getElementById(targetId);
            if (selectEl && selectEl.tomselect) {
                selectEl.tomselect.clear();
                selectEl.tomselect.clearOptions();
            }

            const rowNum = targetId.match(/\d+/)[0];
            const posoField = document.getElementById(`poso_symbashs_${rowNum}`);
            const posoBaseiField = document.getElementById(
                `poso_symbashs_basei_oron_ergasias_${rowNum}`
            );
            if (posoField) posoField.value = '';
            if (posoBaseiField) posoBaseiField.value = '';

            calculateTotal();
            applyNomimaFromSymbashTotals();
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

    console.log('📊 ADD calculateTotal:', {
        totalSymbashs: totalSymbashs.toString(),
        totalBaseiOronErgasias: totalBaseiOronErgasias.toString(),
        _TOTAL_EXTRA_APODOXES: _TOTAL_EXTRA_APODOXES.toString(),
        rowCount
    });

    const typosErg = document.getElementById('typos_ergazomenon')?.value;
    const eidKath = document.getElementById('eidikh_kathgoria_ergazomenoy')?.value;

    console.log('📊 ADD wage params:', {
        typosErg,
        eidKath,
        plhrhs: _PLHRHS_APASXOLHSH?.checked,
        ores: ores_ergasias_ebdomadas.toString(),
        hmeres: hmeres_ergasias_ebdomadas.toString()
    });

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

    // Αν έχει εφαρμοστεί manual πραγματικό ωρομίσθιο με F9/F10,
    // δεν αφήνουμε τον κλασικό επανυπολογισμό να επαναφέρει
    // Πραγματικό Ωρομίσθιο/Ημερομίσθιο/Μισθό στις νόμιμες τιμές.
    restoreManualPragmatikoOromisthioSnapshot();
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

    const hasExtraApodoxes = !_TOTAL_EXTRA_APODOXES.isZero();
    const totalBaseiMinusExtra = totalBaseiOronErgasias.minus(_TOTAL_EXTRA_APODOXES);

    console.log('📊 ADD calculateFullTimeWages:', { typosErg, eidKath, hasExtraApodoxes });

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
                _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
                pragmatikosMisthosValue = totalBaseiOronErgasias;
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

    console.log('📊 ADD FullTime RESULTS:', {
        nomimosMisthosValue: nomimosMisthosValue.toString(),
        nomimoHmeromisthioValue: nomimoHmeromisthioValue.toString(),
        pragmatikosMisthosValue: pragmatikosMisthosValue.toString(),
        pragmatikoHmeromisthioValue: pragmatikoHmeromisthioValue.toString()
    });

    if (nomimosMisthos) nomimosMisthos.value = formatForDisplay(nomimosMisthosValue, 2);
    if (nomimoHmeromisthio) nomimoHmeromisthio.value = formatForDisplay(nomimoHmeromisthioValue, 4);
    if (nomimoOromisthio) nomimoOromisthio.value = formatForDisplay(nomimoOromisthioValue, 4);
    if (pragmatikosMisthos) pragmatikosMisthos.value = formatForDisplay(pragmatikosMisthosValue, 2);
    if (pragmatikoHmeromisthio)
        pragmatikoHmeromisthio.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
    if (pragmatikoOromisthio)
        pragmatikoOromisthio.value = formatForDisplay(pragmatikoOromisthioValue, 4);
}

function getExtraApodoxesCalcMode() {
    return (
        window._EXTRA_APODOXES_CALC_MODE ||
        document.getElementById('extra_apodoxes_calc_mode')?.value ||
        'actual_plus_extra'
    );
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

    const hasExtraApodoxes = !_TOTAL_EXTRA_APODOXES.isZero();
    const extraMode = getExtraApodoxesCalcMode();

    console.log('📊 calculatePartTimeWages:', {
        typosErg,
        eidKath,
        ores: ores.toString(),
        hmeres: hmeres.toString(),
        totalSymbashs: totalSymbashs.toString(),
        totalBaseiOronErgasias: totalBaseiOronErgasias.toString(),
        extraApodoxes: _TOTAL_EXTRA_APODOXES.toString(),
        hasExtraApodoxes,
        extraMode
    });

    function calcPragmatikaForMisthoto() {
        if (hasExtraApodoxes && extraMode === 'full_legal_plus_extra') {
            const fullLegalPlusExtra = totalSymbashs.plus(_TOTAL_EXTRA_APODOXES);

            _PRAGMATIKO_OROMISTHIO = fullLegalPlusExtra.div(
                toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
            );

            pragmatikosMisthosValue = _PRAGMATIKO_OROMISTHIO
                .times(ores)
                .times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON));
        } else {
            _PRAGMATIKO_OROMISTHIO = !ores.isZero()
                ? totalBaseiOronErgasias.div(
                      ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON))
                  )
                : new Decimal(0);

            pragmatikosMisthosValue = totalBaseiOronErgasias;
        }

        if (_PRAGMATIKO_OROMISTHIO.lt(_NOMIMO_OROMISTHIO)) {
            _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
        }

        pragmatikoHmeromisthioValue =
            !ores.isZero() && !hmeres.isZero()
                ? _PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs)
                : new Decimal(0);

        pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
    }

    function calcPragmatikaForHmeromisthio() {
        if (hasExtraApodoxes && extraMode === 'full_legal_plus_extra') {
            const fullLegalPlusExtra = totalSymbashs.plus(_TOTAL_EXTRA_APODOXES);

            _PRAGMATIKO_OROMISTHIO = fullLegalPlusExtra.times(
                toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO)
            );

            pragmatikosMisthosValue = _PRAGMATIKO_OROMISTHIO
                .times(ores)
                .times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION));
        } else {
            _PRAGMATIKO_OROMISTHIO = !ores.isZero()
                ? totalBaseiOronErgasias.div(
                      ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION))
                  )
                : new Decimal(0);

            pragmatikosMisthosValue = totalBaseiOronErgasias;
        }

        if (_PRAGMATIKO_OROMISTHIO.lt(_NOMIMO_OROMISTHIO)) {
            _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
        }

        pragmatikoHmeromisthioValue =
            !ores.isZero() && !hmeres.isZero()
                ? _PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs)
                : new Decimal(0);

        pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
    }

    switch (typosErg) {
        case 'Ω':
            if (eidKath === '0001') {
                _NOMIMO_OROMISTHIO = new Decimal(6)
                    .div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
                    .div(25)
                    .times(totalSymbashs);

                nomimosMisthosValue = totalSymbashs;
                nomimoHmeromisthioValue = totalSymbashs.div(
                    toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
                );
                nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

                calcPragmatikaForMisthoto();
            }
            break;

        case 'Μ':
            _NOMIMO_OROMISTHIO = totalSymbashs.div(
                toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
            );

            nomimosMisthosValue = totalSymbashs;
            nomimoHmeromisthioValue = totalSymbashs.div(
                toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)
            );
            nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

            calcPragmatikaForMisthoto();
            break;

        case 'Η':
            _NOMIMO_OROMISTHIO = totalSymbashs.times(
                toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO)
            );

            nomimoHmeromisthioValue = totalSymbashs;
            nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

            nomimosMisthosValue = nomimoOromisthioValue
                .times(toDecimal(window._ORES_ERGASIAS_EBDOMADAS_PLHROYS_APASXOLHSHS))
                .times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION));

            calcPragmatikaForHmeromisthio();
            break;
    }

    console.log('📊 PartTime RESULTS:', {
        nomimosMisthosValue: nomimosMisthosValue.toString(),
        nomimoHmeromisthioValue: nomimoHmeromisthioValue.toString(),
        nomimoOromisthioValue: nomimoOromisthioValue.toString(),
        pragmatikosMisthosValue: pragmatikosMisthosValue.toString(),
        pragmatikoHmeromisthioValue: pragmatikoHmeromisthioValue.toString(),
        pragmatikoOromisthioValue: pragmatikoOromisthioValue.toString()
    });

    if (nomimosMisthos) nomimosMisthos.value = formatForDisplay(nomimosMisthosValue, 2);
    if (nomimoHmeromisthio) nomimoHmeromisthio.value = formatForDisplay(nomimoHmeromisthioValue, 4);
    if (nomimoOromisthio) nomimoOromisthio.value = formatForDisplay(nomimoOromisthioValue, 4);

    if (pragmatikosMisthos) pragmatikosMisthos.value = formatForDisplay(pragmatikosMisthosValue, 2);
    if (pragmatikoHmeromisthio)
        pragmatikoHmeromisthio.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
    if (pragmatikoOromisthio)
        pragmatikoOromisthio.value = formatForDisplay(pragmatikoOromisthioValue, 4);
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
// TOM-SELECT ΓΙΑ ΣΤΟΙΧΕΙΑ ΣΥΜΒΑΣΗΣ
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
    }

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

        if (!row || !selectEl) continue;

        row.classList.remove('d-none');

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
                            // Όταν το F9/F10 επιλέγει αυτόματα την EXTRA γραμμή,
                            // δεν πρέπει να τρέξει ο κλασικός handler, γιατί θα φέρει
                            // data.poso = 0 και updatePosoBasedOnHours(..., false)
                            // θα μηδενίσει αμέσως τη χειροκίνητη διαφορά.
                            if (_isStoixeioChangeInProgress || this._manualExtraApplying) return;

                            if (value) {
                                await handleStoixeioChange(idNum, value);
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

async function handleStoixeioChange(rowIndex, selectedValue) {
    // Guard απαραίτητος για ADD mode:
    // Το TomSelect μπορεί να πυροδοτήσει change ακόμη και όταν εμείς κάνουμε
    // programmatic επιλογή της EXTRA γραμμής από το F9/F10 flow. Σε αυτή την περίπτωση
    // ο κανονικός handler δεν πρέπει να ξαναϋπολογίσει τη γραμμή και να τη μηδενίσει.
    if (_isStoixeioChangeInProgress) return;
    if (!selectedValue) return;

    _AA_STOIXEIOY = parseInt(rowIndex);

    const contract = document.getElementById('selectedSymbash')?.value?.padStart(4, '0');
    const category = document.getElementById('selectedKathgoria')?.value?.padStart(4, '0');
    const specialty = document.getElementById('selectedEidikothta')?.value?.padStart(4, '0');
    const klimakioEl = document.getElementById('misthologiko_klimakio');
    const klimakio = klimakioEl?.value?.padStart(2, '0') || '01';
    const hmeromhniaEl = document.getElementById('hmeromhnia_allaghs_symbashs');
    const hmeromhnia = hmeromhniaEl?.value || '';

    try {
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
        }
    } catch (error) {
        console.error('❌ Σφάλμα κατά την ενημέρωση αποδοχών:', error);
    }
}

function watchEidikothtaChanges() {
    const eidikothtaHidden = document.getElementById('eidikothta_symbashs_stathera');
    const eidikothtaTable = document.getElementById('eidikothta_symbashs_table');

    if (!eidikothtaHidden) {
        console.warn('⚠️ Δε βρέθηκε το hidden field: eidikothta_symbashs_stathera');
        return;
    }

    let previousValue = eidikothtaHidden.value;
    let previousTable = eidikothtaTable?.value || '[]';

    const checkChange = () => {
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
// CLEAR HELPERS
// ========================================================================

function clearAllStoixeiaRows() {
    for (let i = 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');
        const selectId = `stoixeio_symbashs_${idNum}`;
        const selectEl = document.getElementById(selectId);

        if (selectEl?.tomselect) {
            try {
                selectEl.tomselect.destroy();
            } catch (e) {}
        }

        const posoField = document.getElementById(`poso_symbashs_${idNum}`);
        const posoBaseiField = document.getElementById(
            `poso_symbashs_basei_oron_ergasias_${idNum}`
        );
        if (posoField) posoField.value = '';
        if (posoBaseiField) posoBaseiField.value = '';

        const row = document.getElementById(`row_${idNum}`);
        if (row) row.classList.add('d-none');
    }

    _AVAILABLE_STOIXEIA_COUNT = 0;

    const synoloSymb = document.getElementById('synolo_symbashs');
    const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
    if (synoloSymb) synoloSymb.value = '0.00';
    if (synoloBasei) synoloBasei.value = '0.00';
}

window.clearStoixeiaSymbaseonContainer = function () {
    for (let i = 1; i <= 15; i++) {
        const idNum = i.toString().padStart(2, '0');
        const selectId = `stoixeio_symbashs_${idNum}`;
        const selectEl = document.getElementById(selectId);

        if (selectEl?.tomselect) {
            try {
                selectEl.tomselect.clear();
                selectEl.tomselect.clearOptions();
                selectEl.tomselect.destroy();
            } catch (e) {}
        }

        const posoField = document.getElementById(`poso_symbashs_${idNum}`);
        const posoBaseiField = document.getElementById(
            `poso_symbashs_basei_oron_ergasias_${idNum}`
        );
        if (posoField) posoField.value = '';
        if (posoBaseiField) posoBaseiField.value = '';

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
// MANUAL ΠΡΑΓΜΑΤΙΚΟ ΩΡΟΜΙΣΘΙΟ (F9/F10 ή διπλό κλικ)
// ------------------------------------------------------------------------
// F9 ή διπλό κλικ στο πεδίο pragmatikoOromisthio:
//      ξεκλειδώνει προσωρινά το readonly πεδίο για πληκτρολόγηση.
// F10:
//      κλειδώνει ξανά το πεδίο, υπολογίζει Πραγματικό Ημερομίσθιο/Μισθό,
//      βρίσκει το στοιχείο σύμβασης "EXTRA ΑΠΟΔΟΧΕΣ ΔΥΝΑΜΕΝΕΣ ΝΑ ΑΝΑΙΡΕΘΟΥΝ",
//      περνάει τη διαφορά στο ποσό βάσει ωρών εργασίας και ανανεώνει τα σύνολα.
// ========================================================================

const MANUAL_EXTRA_APODOXES_TEXT = 'EXTRA ΑΠΟΔΟΧΕΣ ΔΥΝΑΜΕΝΕΣ ΝΑ ΑΝΑΙΡΕΘΟΥΝ';

function normalizeManualDecimalValue(value) {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');
}

function getManualDecimalFromInput(input) {
    return toDecimal(normalizeManualDecimalValue(input?.value));
}

function normalizeManualInputInPlace(input) {
    if (!input) return '';

    const normalizedValue = normalizeManualDecimalValue(input.value);
    if (input.value !== normalizedValue) {
        input.value = normalizedValue;
    }

    return normalizedValue;
}

function getNomimoOromisthioValue() {
    const nomimoOromisthioEl = document.getElementById('nomimoOromisthio');

    // Παίρνουμε πρώτα την ΟΡΑΤΗ τιμή του πεδίου. Σε ορισμένες φόρμες/flows
    // το local _NOMIMO_OROMISTHIO μπορεί να μην έχει προλάβει να συγχρονιστεί,
    // ενώ το input στην οθόνη έχει ήδη σωστή τιμή.
    const inputValue = toDecimal(normalizeManualDecimalValue(nomimoOromisthioEl?.value));
    if (!inputValue.isNaN() && !inputValue.isZero()) {
        return inputValue;
    }

    // Fallback στο global/local υπολογισμένο νόμιμο ωρομίσθιο.
    const windowValue = toDecimal(window._NOMIMO_OROMISTHIO);
    if (!windowValue.isNaN() && !windowValue.isZero()) {
        return windowValue;
    }

    const localValue = toDecimal(_NOMIMO_OROMISTHIO);
    if (!localValue.isNaN() && !localValue.isZero()) {
        return localValue;
    }

    return new Decimal(0);
}

function validateManualOromisthioAgainstNomimo(neoOromisthio, oromisthioEl) {
    const nomimoOromisthioValue = getNomimoOromisthioValue();

    if (!nomimoOromisthioValue.isZero() && neoOromisthio.lt(nomimoOromisthioValue)) {
        if (oromisthioEl) {
            oromisthioEl.value = formatForDisplay(nomimoOromisthioValue, 4);
        }

        showAlert({
            icon: 'warning',
            title: 'Προσοχή',
            html: `Το πραγματικό (δωτό) ωρομίσθιο δεν μπορεί να είναι μικρότερο από το νόμιμο ωρομίσθιο.<br><br>Νόμιμο ωρομίσθιο: <strong>${formatForDisplay(nomimoOromisthioValue, 4)}</strong>`
        });
        return false;
    }

    return true;
}

function switchManualInputToText(input) {
    if (!input) return;

    if (!input.dataset.originalType) {
        input.dataset.originalType = input.getAttribute('type') || 'text';
    }

    // Το type="number" σε Chrome/Ubuntu δεν κρατάει πάντα την τιμή όταν ο χρήστης γράφει κόμμα.
    // Στο manual edit το γυρίζουμε προσωρινά σε text, ώστε το "10,5" να διαβαστεί κανονικά.
    input.setAttribute('type', 'text');
    input.setAttribute('inputmode', 'decimal');
}

function restoreManualInputType(input) {
    if (!input) return;

    const originalType = input.dataset.originalType || 'number';
    input.setAttribute('type', originalType);
}

let _manualPragmatikoOromisthioEnabled = false;
let _manualPragmatikoOromisthioApplying = false;
let _manualPragmatikoOromisthioActive = false;
let _manualPragmatikoOromisthioSnapshot = null;
let _manualExtraApodoxesRow = null;
let _manualExtraApodoxesItem = null;
let _manualExtraApodoxesDiafora = null;

function setupManualPragmatikoOromisthioEditor() {
    const input = document.getElementById('pragmatikoOromisthio');
    if (!input) return;

    input.title = 'F9 ή διπλό κλικ: Επεξεργασία | F10: Οριστικοποίηση';

    if (!input.__manualCommaNormalizeBound) {
        input.__manualCommaNormalizeBound = true;
        input.addEventListener('input', () => {
            if (_manualPragmatikoOromisthioEnabled) {
                normalizeManualInputInPlace(input);
            }
        });
    }

    setupManualRecalcButtonInterceptor();

    input.addEventListener('dblclick', (event) => {
        event.preventDefault();
        unlockManualPragmatikoOromisthio();
    });

    input.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await lockAndApplyManualPragmatikoOromisthio();
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            lockManualPragmatikoOromisthioWithoutApply();
        }
    });

    document.addEventListener('keydown', async (event) => {
        const activeEl = document.activeElement;
        const isManualInputFocused = activeEl?.id === 'pragmatikoOromisthio';

        if (event.key === 'F9') {
            event.preventDefault();
            unlockManualPragmatikoOromisthio();
            return;
        }

        if (event.key === 'F10') {
            event.preventDefault();
            if (_manualPragmatikoOromisthioEnabled || isManualInputFocused) {
                await lockAndApplyManualPragmatikoOromisthio();
            }
        }
    });
}

function unlockManualPragmatikoOromisthio() {
    const input = document.getElementById('pragmatikoOromisthio');
    if (!input) return;

    _manualPragmatikoOromisthioEnabled = true;
    switchManualInputToText(input);
    input.readOnly = false;
    input.classList.add('border-warning');
    input.classList.add('bg-warning-subtle');
    input.focus();
    input.select();
}

function lockManualPragmatikoOromisthioWithoutApply() {
    const input = document.getElementById('pragmatikoOromisthio');
    if (!input) return;

    _manualPragmatikoOromisthioEnabled = false;
    normalizeManualInputInPlace(input);
    restoreManualInputType(input);
    input.readOnly = true;
    input.classList.remove('border-warning');
    input.classList.remove('bg-warning-subtle');
}

async function lockAndApplyManualPragmatikoOromisthio() {
    if (_manualPragmatikoOromisthioApplying) return;

    const input = document.getElementById('pragmatikoOromisthio');
    if (!input) return;

    try {
        _manualPragmatikoOromisthioApplying = true;
        _manualPragmatikoOromisthioEnabled = false;
        normalizeManualInputInPlace(input);
        restoreManualInputType(input);
        input.readOnly = true;
        input.classList.remove('border-warning');
        input.classList.remove('bg-warning-subtle');

        await applyManualPragmatikoOromisthio();
    } finally {
        _manualPragmatikoOromisthioApplying = false;
    }
}

function getManualRecalcButton() {
    return (
        document.getElementById('reCalcButton') ||
        Array.from(
            document.querySelectorAll('button, input[type=button], input[type=submit]')
        ).find((el) =>
            normalizeGreekSearchText(el.textContent || el.value || '').includes(
                normalizeGreekSearchText('Επανυπολογισμός Αποδοχών')
            )
        ) ||
        null
    );
}

function setupManualRecalcButtonInterceptor() {
    const recalcButton = getManualRecalcButton();
    if (!recalcButton || recalcButton.__manualOromisthioInterceptorBound) return;

    recalcButton.__manualOromisthioInterceptorBound = true;

    // Capture phase: τρέχει ΠΡΙΝ από το reCalcApodoxes_Edit.js listener.
    // Έτσι, όταν υπάρχει manual ωρομίσθιο, δεν αφήνουμε το κουμπί να καλέσει
    // τον παλιό επανυπολογισμό που ξαναγράφει το πραγματικό ωρομίσθιο στο νόμιμο.
    recalcButton.addEventListener(
        'click',
        async (event) => {
            if (!_manualPragmatikoOromisthioActive || !_manualPragmatikoOromisthioSnapshot) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            // Το κουμπί επανυπολογισμού στο add mode μπορεί να ξαναγράψει την EXTRA γραμμή
            // σε 0.00. Γι' αυτό, όταν υπάρχει ενεργό manual F9/F10, ξανασφραγίζουμε ΠΡΩΤΑ
            // την επιλεγμένη EXTRA γραμμή και τη διαφορά, και ΜΕΤΑ κάνουμε calculateTotal().
            if (
                _manualExtraApodoxesRow &&
                _manualExtraApodoxesItem &&
                _manualExtraApodoxesDiafora
            ) {
                await applyExtraApodoxesToRow(
                    _manualExtraApodoxesRow,
                    _manualExtraApodoxesItem,
                    _manualExtraApodoxesDiafora
                );
                setManualExtraAmountToRow(_manualExtraApodoxesRow, _manualExtraApodoxesDiafora);
            }

            await calculateTotal();

            if (_manualExtraApodoxesRow && _manualExtraApodoxesDiafora) {
                setManualExtraAmountToRow(_manualExtraApodoxesRow, _manualExtraApodoxesDiafora);
                await calculateTotal();
            }

            restoreManualPragmatikoOromisthioSnapshot();

            // Τελικό async σφράγισμα, γιατί κάποιοι listeners του κουμπιού/φόρμας
            // μπορεί να τρέξουν στο επόμενο tick και να μηδενίσουν ξανά το ποσό.
            setTimeout(async () => {
                if (_manualExtraApodoxesRow && _manualExtraApodoxesDiafora) {
                    setManualExtraAmountToRow(_manualExtraApodoxesRow, _manualExtraApodoxesDiafora);
                    await calculateTotal();
                    restoreManualPragmatikoOromisthioSnapshot();
                }
            }, 150);

            showAlert({
                icon: 'success',
                title: 'Επιτυχία',
                html: 'Οι αποδοχές επανυπολογίστηκαν με βάση το manual πραγματικό ωρομίσθιο.',
                timer: 1200,
                showConfirmButton: false
            });
        },
        true
    );
}

function saveManualPragmatikoOromisthioSnapshot({ oromisthio, hmeromisthio, misthos }) {
    _manualPragmatikoOromisthioActive = true;
    _manualPragmatikoOromisthioSnapshot = {
        oromisthio: toDecimal(oromisthio),
        hmeromisthio: toDecimal(hmeromisthio),
        misthos: toDecimal(misthos)
    };
}

function saveManualExtraApodoxesSnapshot(row, item, diafora) {
    _manualExtraApodoxesRow = row;
    _manualExtraApodoxesItem = item ? { ...item } : null;
    _manualExtraApodoxesDiafora = toDecimal(diafora);
}

function restoreManualPragmatikoOromisthioSnapshot() {
    if (!_manualPragmatikoOromisthioActive || !_manualPragmatikoOromisthioSnapshot) return;

    const oromisthioEl = document.getElementById('pragmatikoOromisthio');
    const hmeromisthioEl = document.getElementById('pragmatikoHmeromisthio');
    const misthosEl = document.getElementById('pragmatikosMisthos');

    if (oromisthioEl) {
        oromisthioEl.value = formatForDisplay(_manualPragmatikoOromisthioSnapshot.oromisthio, 4);
    }
    if (hmeromisthioEl) {
        hmeromisthioEl.value = formatForDisplay(
            _manualPragmatikoOromisthioSnapshot.hmeromisthio,
            4
        );
    }
    if (misthosEl) {
        misthosEl.value = formatForDisplay(_manualPragmatikoOromisthioSnapshot.misthos, 2);
    }
}

function normalizeGreekSearchText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function getSelectedContractTriplet() {
    const symbash =
        document.getElementById('selectedSymbash')?.value ||
        document.getElementById('symbash_stathera')?.value ||
        document.getElementById('symbash')?.value ||
        '';

    const kathgoria =
        document.getElementById('selectedKathgoria')?.value ||
        document.getElementById('kathgoria_symbashs_stathera')?.value ||
        document.getElementById('kathgoria_symbashs')?.value ||
        '';

    const eidikothta =
        document.getElementById('selectedEidikothta')?.value ||
        document.getElementById('eidikothta_symbashs_stathera')?.value ||
        document.getElementById('eidikothta_symbashs')?.value ||
        '';

    return {
        symbash: pad4(symbash),
        kathgoria: pad4(kathgoria),
        eidikothta: pad4(eidikothta)
    };
}

function ensureManualCalculationParameters() {
    // Αν οι γενικές παράμετροι έχουν ήδη φορτωθεί από υπάρχοντα flows,
    // τα αντίστοιχα window.* υπάρχουν. Αν όχι, χρησιμοποιούμε τα local Decimal values.
    if (!window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS) {
        window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS;
    }
    if (!window._SYNTELESTHS_EBDOMADON_MISTHOTON) {
        window._SYNTELESTHS_EBDOMADON_MISTHOTON = _SYNTELESTHS_EBDOMADON_MISTHOTON;
    }
    if (!window._SYNTELESTHS_EBDOMADON_HMEROMISTHION) {
        window._SYNTELESTHS_EBDOMADON_HMEROMISTHION = _SYNTELESTHS_EBDOMADON_HMEROMISTHION;
    }
}

async function applyManualPragmatikoOromisthio() {
    ensureManualCalculationParameters();

    const oromisthioEl = document.getElementById('pragmatikoOromisthio');
    const hmeromisthioEl = document.getElementById('pragmatikoHmeromisthio');
    const misthosEl = document.getElementById('pragmatikosMisthos');
    const synoloBaseiEl = document.getElementById('synolo_symbashs_basei_oron_ergasias');

    // ΚΡΙΣΙΜΟ:
    // Κρατάμε το ΠΑΛΙΟ σύνολο βάσει ωρών ΠΡΙΝ πειραχθούν τα πεδία από τον manual υπολογισμό.
    // Από αυτό θα αφαιρεθεί ο νέος πραγματικός μισθός για να βρούμε τη διαφορά που θα μπει
    // στο poso_symbashs_basei_oron_ergasias_${row} του EXTRA στοιχείου.
    let previousSynoloBaseiOron = toDecimal(synoloBaseiEl?.value);

    // Αν ο χρήστης ξαναπατήσει F9/F10 ενώ υπάρχει ήδη manual EXTRA γραμμή,
    // το τρέχον σύνολο βάσει ωρών περιέχει και την παλιά διαφορά.
    // Την αφαιρούμε για να ξαναϋπολογιστεί η νέα διαφορά πάνω στην πραγματική βάση.
    if (_manualExtraApodoxesRow && _manualExtraApodoxesDiafora) {
        previousSynoloBaseiOron = previousSynoloBaseiOron.minus(_manualExtraApodoxesDiafora);
        if (previousSynoloBaseiOron.lt(0)) previousSynoloBaseiOron = new Decimal(0);
    }

    const neoOromisthio = getManualDecimalFromInput(oromisthioEl);

    if (neoOromisthio.lte(0)) {
        showAlert({
            icon: 'warning',
            title: 'Προσοχή',
            html: 'Το πραγματικό ωρομίσθιο πρέπει να είναι μεγαλύτερο από μηδέν.'
        });
        return;
    }

    if (!validateManualOromisthioAgainstNomimo(neoOromisthio, oromisthioEl)) {
        return;
    }

    const ores = toDecimal(document.getElementById('ores_ergasias_ebdomadas')?.value);
    const hmeres = toDecimal(document.getElementById('hmeres_ergasias_ebdomadas')?.value);
    const typosErg = document.getElementById('typos_ergazomenon')?.value || '';
    const isFullTime = Boolean(document.getElementById('plhrhs_apasxolhsh')?.checked);

    if (!isFullTime && (ores.lte(0) || hmeres.lte(0))) {
        showAlert({
            icon: 'warning',
            title: 'Προσοχή',
            html: 'Για μερική απασχόληση πρέπει να υπάρχουν ώρες και ημέρες εβδομαδιαίας εργασίας.'
        });
        return;
    }

    let pragmatikoHmeromisthioValue = new Decimal(0);
    let pragmatikosMisthosValue = new Decimal(0);

    if (isFullTime) {
        pragmatikoHmeromisthioValue = neoOromisthio.div(new Decimal(6).div(40));
        pragmatikosMisthosValue = neoOromisthio.times(
            toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
        );
    } else {
        const moOronHmeras = ores.div(hmeres);
        pragmatikoHmeromisthioValue = neoOromisthio.times(moOronHmeras);

        const weeklyFactor =
            typosErg === 'Η'
                ? toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION)
                : toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON);

        pragmatikosMisthosValue = neoOromisthio.times(ores).times(weeklyFactor);
    }

    // Τελική δικλείδα ασφαλείας: πριν γραφτούν Πραγματικός Μισθός/Ημερομίσθιο
    // και πριν ψάξουμε EXTRA γραμμή, ελέγχουμε ξανά ότι το δωτό ωρομίσθιο
    // δεν είναι κάτω από το νόμιμο.
    if (!validateManualOromisthioAgainstNomimo(neoOromisthio, oromisthioEl)) {
        return;
    }

    if (oromisthioEl) oromisthioEl.value = formatForDisplay(neoOromisthio, 4);
    if (hmeromisthioEl) hmeromisthioEl.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
    if (misthosEl) misthosEl.value = formatForDisplay(pragmatikosMisthosValue, 2);

    saveManualPragmatikoOromisthioSnapshot({
        oromisthio: neoOromisthio,
        hmeromisthio: pragmatikoHmeromisthioValue,
        misthos: pragmatikosMisthosValue
    });

    const diafora = pragmatikosMisthosValue.minus(previousSynoloBaseiOron);

    if (diafora.lte(0)) {
        showAlert({
            icon: 'info',
            title: 'Δεν απαιτούνται Extra Αποδοχές',
            html: `Ο υπολογισμένος πραγματικός μισθός (${formatForDisplay(
                pragmatikosMisthosValue,
                2
            )}) δεν είναι μεγαλύτερος από τις αποδοχές βάσει ωρών εργασίας (${formatForDisplay(
                previousSynoloBaseiOron,
                2
            )}).`
        });
        return;
    }

    const extraItem = await findExtraApodoxesStoixeioSymbashs();
    if (!extraItem) {
        showAlert({
            icon: 'warning',
            title: 'Δεν βρέθηκε στοιχείο σύμβασης',
            html: `Δεν βρέθηκε στοιχείο που να περιέχει:<br><strong>${MANUAL_EXTRA_APODOXES_TEXT}</strong>`
        });
        return;
    }

    const targetRow = findExistingOrFirstEmptyExtraRow(extraItem.value);
    if (!targetRow) {
        showAlert({
            icon: 'warning',
            title: 'Δεν υπάρχει διαθέσιμη γραμμή',
            html: 'Δεν βρέθηκε κενή γραμμή στα στοιχεία σύμβασης για να καταχωρηθούν οι Extra Αποδοχές.'
        });
        return;
    }

    saveManualExtraApodoxesSnapshot(targetRow, extraItem, diafora);
    await applyExtraApodoxesToRow(targetRow, extraItem, diafora);

    // Ανανεώνουμε σύνολα μετά την καταχώρηση της διαφοράς στη γραμμή EXTRA.
    await calculateTotal();

    // Σε ορισμένες περιπτώσεις το TomSelect/change flow μπορεί να καθυστερήσει ένα tick.
    // Γι' αυτό ξανασφραγίζουμε τη διαφορά στη γραμμή και ξαναϋπολογίζουμε τα σύνολα.
    setManualExtraAmountToRow(targetRow, diafora);
    await calculateTotal();

    // Επαναφέρουμε τις manual τιμές, ώστε το κουμπί/οι παλιοί υπολογισμοί να μη τις αντικαταστήσουν.
    if (oromisthioEl) oromisthioEl.value = formatForDisplay(neoOromisthio, 4);
    if (hmeromisthioEl) hmeromisthioEl.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
    if (misthosEl) misthosEl.value = formatForDisplay(pragmatikosMisthosValue, 2);

    // Και ένα τελευταίο async σφράγισμα για την οθόνη, χωρίς να πειράξει ο χρήστης κάτι.
    setTimeout(async () => {
        setManualExtraAmountToRow(targetRow, diafora);
        await calculateTotal();
        restoreManualPragmatikoOromisthioSnapshot();
    }, 150);

    showAlert({
        icon: 'success',
        title: 'Υπολογισμός ολοκληρώθηκε',
        timer: 1200,
        showConfirmButton: false,
        html: `Καταχωρήθηκαν Extra Αποδοχές: <strong>${formatForDisplay(diafora, 2)}</strong>`
    });
}

async function findExtraApodoxesStoixeioSymbashs() {
    const { symbash, kathgoria, eidikothta } = getSelectedContractTriplet();

    if (
        !symbash ||
        !kathgoria ||
        !eidikothta ||
        symbash === '0000' ||
        kathgoria === '0000' ||
        eidikothta === '0000'
    ) {
        return null;
    }

    const url = new URL('/api/dropdown/symbaseis/stoixeio_symbashs', window.location.origin);
    url.searchParams.set('symbash_stathera', symbash);
    url.searchParams.set('kathgoria_symbashs_stathera', kathgoria);
    url.searchParams.set('eidikothta_symbashs_stathera', eidikothta);
    url.searchParams.set('limit', '100');

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });

    if (!response.ok) return null;

    const json = await response.json();
    const items = Array.isArray(json.items) ? json.items : [];
    const targetText = normalizeGreekSearchText(MANUAL_EXTRA_APODOXES_TEXT);

    return (
        items.find((item) => {
            const searchable = normalizeGreekSearchText(
                `${item.label || ''} ${item.text || ''} ${item.perigrafh || ''}`
            );
            return (
                searchable.includes(targetText) ||
                (searchable.includes('EXTRA') &&
                    searchable.includes('ΑΠΟΔΟΧΕΣ') &&
                    searchable.includes('ΑΝΑΙΡΕΘΟΥΝ'))
            );
        }) || null
    );
}

function findExistingOrFirstEmptyExtraRow(extraValue) {
    const rowCount = getEffectiveRowCount();
    let firstEmpty = null;

    for (let i = 1; i <= rowCount; i++) {
        const idNum = i.toString().padStart(2, '0');
        const hidden = document.getElementById(`stoixeio_symbashs_${idNum}_hidden`);
        const selectEl = document.getElementById(`stoixeio_symbashs_${idNum}`);
        const selectedValue = pad4(
            hidden?.value || selectEl?.value || selectEl?.tomselect?.getValue?.() || ''
        );

        if (selectedValue === pad4(extraValue)) {
            return idNum;
        }

        if (!firstEmpty && (!selectedValue || selectedValue === '0000')) {
            firstEmpty = idNum;
        }
    }

    return firstEmpty;
}

async function ensureTomSelectForManualRow(idNum) {
    const selectId = `stoixeio_symbashs_${idNum}`;
    const selectEl = document.getElementById(selectId);
    const row = document.getElementById(`row_${idNum}`);
    if (!selectEl) return null;

    if (row) row.classList.remove('d-none');

    if (selectEl.tomselect) {
        return selectEl.tomselect;
    }

    const { symbash, kathgoria, eidikothta } = getSelectedContractTriplet();

    await initTomDropdown({
        selector: `#${selectId}`,
        url: '/api/dropdown/symbaseis/stoixeio_symbashs',
        extraParams: {
            symbash_stathera: symbash,
            kathgoria_symbashs_stathera: kathgoria,
            eidikothta_symbashs_stathera: eidikothta,
            padLength: '4'
        },
        minChars: 0,
        hooks: {
            onInitialize: function () {
                this.on('change', async (value) => {
                    syncManualHiddenTarget(idNum, value || '');

                    // Programmatic EXTRA selection από F9/F10: μην αφήσεις τον
                    // κανονικό handler να γράψει 0.00 πάνω στη χειροκίνητη διαφορά.
                    if (_isStoixeioChangeInProgress || this._manualExtraApplying) return;

                    if (typeof handleStoixeioChange === 'function' && value) {
                        await handleStoixeioChange(idNum, value);
                    } else if (!value) {
                        clearManualRowAmounts(idNum);
                        calculateTotal();
                    }
                });
            }
        }
    });

    return selectEl.tomselect || null;
}

function syncManualHiddenTarget(idNum, value = '') {
    if (typeof syncHiddenTarget === 'function') {
        syncHiddenTarget(idNum, value);
        return;
    }

    const hiddenTarget = document.getElementById(`stoixeio_symbashs_${idNum}_hidden`);
    if (hiddenTarget) hiddenTarget.value = value ? pad4(value) : '';
}

function clearManualRowAmounts(idNum) {
    if (typeof clearRowAmounts === 'function') {
        clearRowAmounts(idNum);
        return;
    }

    const posoField = document.getElementById(`poso_symbashs_${idNum}`);
    const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
    if (posoField) posoField.value = '';
    if (posoBaseiField) posoBaseiField.value = '';
}

async function applyExtraApodoxesToRow(idNum, extraItem, diafora) {
    const tom = await ensureTomSelectForManualRow(idNum);
    const selectEl = document.getElementById(`stoixeio_symbashs_${idNum}`);
    const kodikos = pad4(extraItem.value || extraItem.kodikos || '');
    const label = String(
        extraItem.label || extraItem.text || `${kodikos} - ${extraItem.perigrafh || ''}`
    );

    // Μπλοκάρουμε προσωρινά τους αυτόματους handlers του stoixeio change,
    // γιατί αλλιώς μπορούν να ξαναγράψουν το posoBasei της EXTRA γραμμής σε 0.00.
    const previousStoixeioFlag = _isStoixeioChangeInProgress;
    _isStoixeioChangeInProgress = true;

    try {
        if (tom) {
            tom._manualExtraApplying = true;

            const normalized = {
                ...extraItem,
                value: kodikos,
                label,
                text: label,
                kodikos
            };

            if (!tom.options[kodikos]) {
                tom.addOption(normalized);
            }

            try {
                if (typeof removeLockedTomStyle === 'function') removeLockedTomStyle(tom);
            } catch (_) {}

            tom.setValue(kodikos, true);

            // Σε add mode θέλουμε να ενημερωθεί σίγουρα και το πραγματικό <select>,
            // γιατί το silent setValue του TomSelect δεν πυροδοτεί change handlers.
            if (selectEl) selectEl.value = kodikos;

            tom.refreshOptions(false);
            tom.refreshItems();
            tom.refreshState();

            try {
                if (typeof applyLockedTomStyle === 'function') applyLockedTomStyle(tom);
            } catch (_) {}
        } else if (selectEl) {
            selectEl.value = kodikos;
        }

        syncManualHiddenTarget(idNum, kodikos);
        setManualExtraAmountToRow(idNum, diafora);
    } finally {
        setTimeout(() => {
            const rowSelectEl = document.getElementById(`stoixeio_symbashs_${idNum}`);
            if (rowSelectEl?.tomselect) {
                rowSelectEl.tomselect._manualExtraApplying = false;
            }
            _isStoixeioChangeInProgress = previousStoixeioFlag;
        }, 250);
    }
}

function setManualExtraAmountToRow(idNum, diafora) {
    const posoField = document.getElementById(`poso_symbashs_${idNum}`);
    const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);

    if (posoField) {
        posoField.value = '0.00';
    }

    if (posoBaseiField) {
        posoBaseiField.value = formatForDisplay(diafora, 2);
        currentValues[posoBaseiField.id] = diafora.toString();
    }
}

function triggerRecalcButton() {
    if (_manualPragmatikoOromisthioActive) {
        restoreManualPragmatikoOromisthioSnapshot();
        return;
    }

    const reCalcButton = getManualRecalcButton();
    if (reCalcButton && !reCalcButton.__triggeredFromStoixeiaSymbaseon) {
        try {
            reCalcButton.__triggeredFromStoixeiaSymbaseon = true;
            reCalcButton.click();
        } finally {
            setTimeout(() => {
                reCalcButton.__triggeredFromStoixeiaSymbaseon = false;
            }, 0);
        }
    }
}

// ========================================================================
// GLOBAL EXPORTS
// ========================================================================

window.loadStoixeiaSymbaseonFromAPI = loadStoixeiaSymbaseonFromAPI;
window.calculateTotal = calculateTotal;
window.calculatePartTimeWages = calculatePartTimeWages;
