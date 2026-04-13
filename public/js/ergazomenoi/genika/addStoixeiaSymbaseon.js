// // addStoixeiaSymbaseon.js
// // Διαχείριση Στοιχείων Σύμβασης με Tom-Select dropdowns
// // Last Updated: 24/11/2025 - WITH SHARED UTILITIES

// const Decimal = window.Decimal;

// import { initTomDropdown } from '../../dropdown-item.js';

// import {
//     toDecimal,
//     formatDecimal,
//     showAlert,
//     fetchGenikesParametroi,
//     fetchApodoxesData,
//     updateGeneralParameters,
//     updatePosoBasedOnHours
// } from 'apodoxes-calculations'; // ✅ Alias από importmap

// // ========================================================================
// // DECIMAL.JS CONFIGURATION
// // ========================================================================

// Decimal.set({
//     precision: 28,
//     rounding: Decimal.ROUND_HALF_UP,
//     toExpNeg: -7,
//     toExpPos: 15
// });

// // ========================================================================
// // HELPER:  FORMAT ΓΙΑ ΕΜΦΑΝΙΣΗ ΜΕ TRAILING ZEROS
// // ========================================================================

// function formatForDisplay(decimalValue, decimals) {
//     const rounded = toDecimal(decimalValue).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
//     const str = rounded.toString();
//     const parts = str.split('.');

//     if (parts.length === 1) {
//         return str + '.' + '0'.repeat(decimals);
//     } else {
//         const decimalPart = parts[1].padEnd(decimals, '0');
//         return parts[0] + '.' + decimalPart;
//     }
// }

// // ---------- 1) Safe setter helper  ----------
// function safeSetValue(id, value) {
//     const el = document.getElementById(id);
//     if (el) {
//         try {
//             el.value = value;
//         } catch (_) {
//             console.warn('safeSetValue: cannot set value for', id);
//         }
//     }
// }

// // ========================================================================
// // GLOBAL VARIABLES
// // ========================================================================

// let currentValues = {};
// let data = {};

// let _AA_STOIXEIOY = 0,
//     _ARITHMOS_STOIXEION_SYMBASEON = 0,
//     _HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = new Decimal(0),
//     _HMEROMISTHIO = new Decimal(0),
//     _MISTHOS = new Decimal(0),
//     _NOMIMO_OROMISTHIO = new Decimal(0),
//     _PLHRHS_APASXOLHSH,
//     _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = new Decimal(0),
//     _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = new Decimal(0),
//     _ORES_HMERHSIAS_ERGASIAS = new Decimal(0),
//     _PRAGMATIKO_OROMISTHIO = new Decimal(0),
//     _PRAGMATIKOS_MISTHOS = new Decimal(0),
//     _SYNTELESTHS_EBDOMADON_HMEROMISTHION = new Decimal(0),
//     _SYNTELESTHS_EBDOMADON_MISTHOTON = new Decimal(0),
//     _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = new Decimal(0),
//     totalSymbashs = new Decimal(0),
//     totalBaseiOronErgasias = new Decimal(0),
//     _TOTAL_EXTRA_APODOXES = new Decimal(0);

// // ========================================================================
// // ΑΡΧΙΚΟΠΟΙΗΣΗ
// // ========================================================================

// document.addEventListener('DOMContentLoaded', function () {
//     _PLHRHS_APASXOLHSH = document.getElementById('plhrhs_apasxolhsh');
//     generateSelectRowsOfSymbaseis();
//     setupAutocompleteHack();
//     addEventListeners();
//     calculateTotal();
//     watchEidikothtaChanges();
// });

// // ========================================================================
// // ΔΗΜΙΟΥΡΓΙΑ HTML ΓΙΑ ΤΑ ROWS
// // ========================================================================

// function generateSelectRowsOfSymbaseis() {
//     const container = document.getElementById('stoixeiaSymbaseonContainer');
//     if (!container) {
//         console.warn('⚠️ Container stoixeiaSymbaseonContainer not found');
//         return;
//     }

//     container.innerHTML = '';

//     for (let i = 1; i <= 15; i++) {
//         const idNum = i.toString().padStart(2, '0');
//         const rowHTML = `
// 			<div class="row form-group align-items-center margin-top-0_75rem d-none showhide_row_${idNum} addStoixSymb001" id="row_${idNum}">
// 				<div class="col-0-5 text-center">
// 					<label class="col-form-label label-font-size">${i}</label>
// 				</div>
// 				<div class="col-7">
// 					<input type="hidden" name="stoixeio_symbashs_${idNum}_hidden" id="stoixeio_symbashs_${idNum}_hidden" />
// 					<select
// 						class="tom-dropdown selectpicker-dropdown-normal left-align w-100"
// 						name="stoixeio_symbashs_${idNum}"
// 						id="stoixeio_symbashs_${idNum}"
// 						data-target-input="stoixeio_symbashs_${idNum}_hidden"
// 						data-preload-all="true"
// 						data-pad-length="4">
// 					</select>
// 				</div>
// 				<div class="col-0-5"></div>
// 				<div class="col-1-5">
// 					<input
// 						type="number"
// 						class="form-control input-contents right-align clearAble addStoixSymb002"
// 						name="poso_symbashs_${idNum}"
// 						id="poso_symbashs_${idNum}"
// 						readonly
// 						autocomplete="off"
// 					/>
// 				</div>
// 				<div class="col-0-5"></div>
// 				<div class="col-1-5">
// 					<input
// 						type="number"
// 						class="form-control input-contents right-align numeric clearAble addStoixSymb003"
// 						name="poso_symbashs_basei_oron_ergasias_${idNum}"
// 						id="poso_symbashs_basei_oron_ergasias_${idNum}"
// 						step="0.01"
// 						autocomplete="off"
// 						readonly
//                 		data-autocomplete-hack="true"
// 					/>
// 				</div>
// 				<button type="button" class="btn rounded-4 col-0-3 clear-row border-0"
// 					id="clearSelectSymbaseon-${idNum}"
// 					data-bs-toggle="tooltip"
// 					data-bs-title="Καθαρισμός όλης της τρέχουσας γραμμής"
// 					data-bs-placement="bottom"
// 					data-target="stoixeio_symbashs_${idNum}">
// 					<i class="bi bi-x-lg cdarkred"></i>
// 				</button>
// 			</div>
// 		`;
//         container.insertAdjacentHTML('beforeend', rowHTML);
//     }
// }

// function setupAutocompleteHack() {
//     const container = document.getElementById('stoixeiaSymbaseonContainer');
//     if (!container) return;

//     // Event delegation:  ένας listener για όλα τα inputs
//     container.addEventListener(
//         'focus',
//         (e) => {
//             const input = e.target;
//             if (input.matches && input.matches('input[data-autocomplete-hack="true"]')) {
//                 input.removeAttribute('readonly');
//             }
//         },
//         true
//     ); // true = capture phase (πιάνει το focus πριν φτάσει στο input)
// }

// // ========================================================================
// // EVENT LISTENERS
// // ========================================================================

// function addEventListeners() {
//     const container = document.getElementById('stoixeiaSymbaseonContainer');
//     if (!container) return;

//     container.addEventListener('input', handleInputEvent);

//     container.addEventListener('click', (e) => {
//         const trashBtn = e.target.closest('.clear-row');
//         if (trashBtn) {
//             const targetId = trashBtn.dataset.target;
//             const selectEl = document.getElementById(targetId);
//             if (selectEl && selectEl.tomselect) {
//                 selectEl.tomselect.clear();
//                 selectEl.tomselect.clearOptions();
//             }

//             const rowNum = targetId.match(/\d+/)[0];
//             const posoField = document.getElementById(`poso_symbashs_${rowNum}`);
//             const posoBaseiField = document.getElementById(
//                 `poso_symbashs_basei_oron_ergasias_${rowNum}`
//             );
//             if (posoField) posoField.value = '';
//             if (posoBaseiField) posoBaseiField.value = '';

//             calculateTotal();
//         }
//     });
// }

// function handleInputEvent(event) {
//     if (event.target.type === 'number' && event.target.classList.contains('numeric')) {
//         const elementId = event.target.id;
//         const newValue = toDecimal(event.target.value);
//         const oldValue = currentValues[elementId]
//             ? toDecimal(currentValues[elementId])
//             : new Decimal(0);

//         _TOTAL_EXTRA_APODOXES = _TOTAL_EXTRA_APODOXES.plus(newValue).minus(oldValue);
//         currentValues[elementId] = newValue.toString();

//         formatNumericInput(event.target);

//         data.poso = newValue;
//         const rowMatch = elementId.match(/poso_symbashs_basei_oron_ergasias_(\d+)/);
//         if (rowMatch) {
//             _AA_STOIXEIOY = parseInt(rowMatch[1]);

//             let extraApodoxes = true;
//             if (data.genikesParametroi) {
//                 updateGeneralParameters(data.genikesParametroi);
//             }
//             updatePosoBasedOnHours(_AA_STOIXEIOY, data, elementId, extraApodoxes);
//         }

//         calculateTotal();
//     }
// }

// function formatNumericInput(input) {
//     if (!input || !input.value) {
//         return;
//     }

//     const cursorPosition = input.selectionStart;
//     const originalValue = input.value;

//     if (!originalValue) {
//         input.value = '';
//         return;
//     }

//     const numValue = toDecimal(originalValue);
//     const newValue = formatDecimal(numValue, 2);

//     if (newValue !== originalValue) {
//         if (input.type === 'text' && input.setSelectionRange) {
//             try {
//                 const diff = newValue.length - originalValue.length;
//                 const newPos = Math.max(0, cursorPosition + diff);
//                 input.setSelectionRange(newPos, newPos);
//             } catch (err) {
//                 // Αγνόησε σφάλματα
//             }
//         }

//         // input.value = newValue;
//         // const diff = newValue.length - originalValue.length;
//         // const newPos = Math.max(0, cursorPosition + diff);
//         // input.setSelectionRange(newPos, newPos);
//     }
// }

// // ========================================================================
// // ΥΠΟΛΟΓΙΣΜΟΙ ΣΥΝΟΛΩΝ
// // ========================================================================

// async function calculateTotal() {
//     // ✅ Αρχικοποίηση με Decimal objects (ΧΩΡΙΣ rounding)
//     totalSymbashs = new Decimal(0);
//     totalBaseiOronErgasias = new Decimal(0);
//     _TOTAL_EXTRA_APODOXES = new Decimal(0);
//     _PRAGMATIKO_OROMISTHIO = new Decimal(0);

//     const nomimosMisthos = document.getElementById('nomimosMisthos');
//     const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
//     const nomimoOromisthio = document.getElementById('nomimoOromisthio');
//     const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
//     const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
//     const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');

//     const oresEl = document.getElementById('ores_ergasias_ebdomadas');
//     const hmeresEl = document.getElementById('hmeres_ergasias_ebdomadas');

//     const ores_ergasias_ebdomadas = toDecimal(oresEl?.value);
//     const hmeres_ergasias_ebdomadas = toDecimal(hmeresEl?.value);

//     // ✅ Άθροισμα όλων των γραμμών (ΧΩΡΙΣ rounding)
//     for (let i = 1; i <= (_ARITHMOS_STOIXEION_SYMBASEON || 15); i++) {
//         const idNum = i.toString().padStart(2, '0');
//         const posoInput = document.getElementById(`poso_symbashs_${idNum}`);
//         const posoInputBaseiOron = document.getElementById(
//             `poso_symbashs_basei_oron_ergasias_${idNum}`
//         );

//         const posoValue = toDecimal(posoInput?.value);
//         const posoBaseiValue = toDecimal(posoInputBaseiOron?.value);

//         // Άθροισμα με πλήρη ακρίβεια
//         totalSymbashs = totalSymbashs.plus(posoValue);
//         totalBaseiOronErgasias = totalBaseiOronErgasias.plus(posoBaseiValue);

//         // Έλεγχος για extra αποδοχές
//         if (!posoBaseiValue.isZero() && posoValue.isZero()) {
//             _TOTAL_EXTRA_APODOXES = _TOTAL_EXTRA_APODOXES.plus(posoBaseiValue);
//         }
//     }

//     // ✅ Εμφάνιση συνόλων - Round ΚΑΙ format
//     safeSetValue('synolo_symbashs', formatForDisplay(totalSymbashs, 2));
//     safeSetValue(
//         'synolo_symbashs_basei_oron_ergasias',
//         formatForDisplay(totalBaseiOronErgasias, 2)
//     );
//     // Παίρνουμε τον τύπο εργαζομένου και ειδική κατηγορία
//     const typosErg = document.getElementById('typos_ergazomenon')?.value;
//     const eidKath = document.getElementById('eidikh_kathgoria_ergazomenoy')?.value;

//     // ✅ Υπολογισμοί ανάλογα με πλήρη/μερική απασχόληση
//     if (_PLHRHS_APASXOLHSH && _PLHRHS_APASXOLHSH.checked) {
//         calculateFullTimeWages(
//             typosErg,
//             eidKath,
//             ores_ergasias_ebdomadas,
//             hmeres_ergasias_ebdomadas
//         );
//     } else {
//         calculatePartTimeWages(
//             typosErg,
//             eidKath,
//             ores_ergasias_ebdomadas,
//             hmeres_ergasias_ebdomadas
//         );
//     }

//     // Setup automatic recalculation listeners
//     setupAutomaticRecalculation();
// }

// function calculateFullTimeWages(typosErg, eidKath, ores, hmeres) {
//     const nomimosMisthos = document.getElementById('nomimosMisthos');
//     const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
//     const nomimoOromisthio = document.getElementById('nomimoOromisthio');
//     const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
//     const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
//     const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');

//     // ✅ Όλοι οι υπολογισμοί με ΠΛΗΡΗ ακρίβεια (Decimal objects)
//     // ✅ ΑΡΧΙΚΟΠΟΙΗΣΗ με Decimal(0) - ΟΧΙ undefined!
//     let nomimosMisthosValue = new Decimal(0);
//     let nomimoHmeromisthioValue = new Decimal(0);
//     let nomimoOromisthioValue = new Decimal(0);
//     let pragmatikosMisthosValue = new Decimal(0);
//     let pragmatikoHmeromisthioValue = new Decimal(0);
//     let pragmatikoOromisthioValue = new Decimal(0);

//     switch (typosErg) {
//         case 'Ω':
//             if (eidKath === '0001') {
//                 // Υπολογισμοί χωρίς rounding
//                 _NOMIMO_OROMISTHIO = new Decimal(6)
//                     .div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
//                     .div(25)
//                     .times(totalSymbashs);

//                 _PRAGMATIKO_OROMISTHIO = new Decimal(6)
//                     .div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
//                     .div(25)
//                     .times(totalBaseiOronErgasias);

//                 if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
//                     _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
//                 }

//                 nomimosMisthosValue = _NOMIMO_OROMISTHIO
//                     .times(ores)
//                     .times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON));

//                 nomimoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(ores).div(hmeres);

//                 nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

//                 pragmatikosMisthosValue = totalBaseiOronErgasias;

//                 pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres);

//                 pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
//             }
//             break;

//         case 'Μ':
//             _NOMIMO_OROMISTHIO = totalSymbashs.div(
//                 toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
//             );

//             _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
//                 toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
//             );

//             if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
//                 _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
//             }

//             nomimosMisthosValue = _NOMIMO_OROMISTHIO
//                 .times(ores)
//                 .times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON));

//             nomimoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(
//                 toDecimal(window._ORES_HMERHSIAS_ERGASIAS)
//             );

//             nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

//             pragmatikosMisthosValue = _PRAGMATIKO_OROMISTHIO
//                 .times(ores)
//                 .times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON));

//             pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(
//                 toDecimal(window._ORES_HMERHSIAS_ERGASIAS)
//             );

//             pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
//             break;

//         case 'Η':
//             _NOMIMO_OROMISTHIO = totalSymbashs.times(
//                 toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO)
//             );

//             _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
//                 ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION))
//             );

//             if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
//                 _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
//             }

//             nomimosMisthosValue = _NOMIMO_OROMISTHIO
//                 .times(ores)
//                 .times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION));

//             nomimoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(
//                 toDecimal(window._ORES_HMERHSIAS_ERGASIAS)
//             );

//             nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

//             pragmatikosMisthosValue = totalBaseiOronErgasias;

//             if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
//                 pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres);
//             } else {
//                 pragmatikoHmeromisthioValue = new Decimal(0);
//             }

//             pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
//             break;
//     }

//     // ✅ Format για εμφάνιση
//     nomimosMisthos.value = formatForDisplay(nomimosMisthosValue, 2);
//     nomimoHmeromisthio.value = formatForDisplay(nomimoHmeromisthioValue, 4);
//     nomimoOromisthio.value = formatForDisplay(nomimoOromisthioValue, 4);

//     pragmatikosMisthos.value = formatForDisplay(pragmatikosMisthosValue, 2);
//     pragmatikoHmeromisthio.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
//     pragmatikoOromisthio.value = formatForDisplay(pragmatikoOromisthioValue, 4);
// }

// function calculatePartTimeWages(typosErg, eidKath, ores, hmeres) {
//     const nomimosMisthos = document.getElementById('nomimosMisthos');
//     const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
//     const nomimoOromisthio = document.getElementById('nomimoOromisthio');
//     const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
//     const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
//     const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');

//     // ✅ Υπολογισμός ωρών ανά ημέρα (ΧΩΡΙΣ rounding)
//     const _ores_apasxolhshs = ores.div(hmeres);

//     let nomimosMisthosValue, nomimoHmeromisthioValue, nomimoOromisthioValue;
//     let pragmatikosMisthosValue, pragmatikoHmeromisthioValue, pragmatikoOromisthioValue;

//     switch (typosErg) {
//         case 'Ω':
//             if (eidKath === '0001') {
//                 _NOMIMO_OROMISTHIO = new Decimal(6)
//                     .div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
//                     .div(25)
//                     .times(totalSymbashs);

//                 _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
//                     ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON))
//                 );

//                 if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
//                     _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
//                 }

//                 nomimosMisthosValue = _NOMIMO_OROMISTHIO
//                     .times(ores)
//                     .times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON));

//                 nomimoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(_ores_apasxolhshs);
//                 nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

//                 pragmatikosMisthosValue = totalBaseiOronErgasias;

//                 if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
//                     pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres);
//                 } else {
//                     pragmatikoHmeromisthioValue = new Decimal(0);
//                 }

//                 pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
//             }
//             break;

//         case 'Μ':
//             _NOMIMO_OROMISTHIO = totalSymbashs.div(
//                 toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS)
//             );

//             _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
//                 ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON))
//             );

//             if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
//                 _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
//             }

//             nomimosMisthosValue = _NOMIMO_OROMISTHIO
//                 .times(ores)
//                 .times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON));

//             nomimoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(_ores_apasxolhshs);
//             nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

//             pragmatikosMisthosValue = totalBaseiOronErgasias;

//             if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
//                 pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs);
//             } else {
//                 pragmatikoHmeromisthioValue = new Decimal(0);
//             }

//             pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
//             break;

//         case 'Η':
//             // const aaa = new Decimal(13);
//             // const seh = toDecimal(aaa.div(toDecimal(3)));
//             _NOMIMO_OROMISTHIO = totalSymbashs.times(
//                 toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO)
//             );

//             // _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias
//             // 	. div(ores.times(toDecimal(seh)));
//             _PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
//                 ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION))
//             );

//             if (_PRAGMATIKO_OROMISTHIO < _NOMIMO_OROMISTHIO) {
//                 _PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
//             }

//             nomimosMisthosValue = _NOMIMO_OROMISTHIO
//                 .times(ores)
//                 .times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION));

//             nomimoHmeromisthioValue = _NOMIMO_OROMISTHIO.times(_ores_apasxolhshs);
//             nomimoOromisthioValue = _NOMIMO_OROMISTHIO;

//             pragmatikosMisthosValue = totalBaseiOronErgasias;

//             if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
//                 pragmatikoHmeromisthioValue = _PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs);
//             } else {
//                 pragmatikoHmeromisthioValue = new Decimal(0);
//             }

//             pragmatikoOromisthioValue = _PRAGMATIKO_OROMISTHIO;
//             break;
//     }

//     // ✅ Format για εμφάνιση
//     nomimosMisthos.value = formatForDisplay(nomimosMisthosValue, 2);
//     nomimoHmeromisthio.value = formatForDisplay(nomimoHmeromisthioValue, 4);
//     nomimoOromisthio.value = formatForDisplay(nomimoOromisthioValue, 4);

//     pragmatikosMisthos.value = formatForDisplay(pragmatikosMisthosValue, 2);
//     pragmatikoHmeromisthio.value = formatForDisplay(pragmatikoHmeromisthioValue, 4);
//     pragmatikoOromisthio.value = formatForDisplay(pragmatikoOromisthioValue, 4);
// }

// function setupAutomaticRecalculation() {
//     const pragmatikoOromisthioEl = document.getElementById('pragmatikoOromisthio');
//     if (!pragmatikoOromisthioEl) return;

//     const pragmatikoOromisthio = pragmatikoOromisthioEl.value;
//     const oromisthioValue = toDecimal(pragmatikoOromisthio);
//     const isOromisthioValid =
//         pragmatikoOromisthio && !oromisthioValue.isNaN() && !oromisthioValue.isZero();

//     if (isOromisthioValid) {
//         const ids = [
//             'hmeromhnia_allaghs_symbashs',
//             'proyphresia_se_eth',
//             'proyphresia_se_mhnes',
//             'eidikh_kathgoria_ergazomenoy',
//             'plhrhs_apasxolhsh',
//             'hmeres_ergasias_ebdomadas',
//             'ores_ergasias_ebdomadas',
//             'typos_ergazomenon',
//             'misthologiko_klimakio'
//         ];

//         ids.forEach((id) => {
//             const element = document.getElementById(id);
//             if (element && !element.__recalcBound) {
//                 element.__recalcBound = true;
//                 element.addEventListener('change', () => {
//                     if (typeof window.reCalculate === 'function') window.reCalculate();
//                     else calculateTotal();
//                 });
//             }
//         });
//     }
// }

// // ========================================================================
// // TOM-SELECT ΓΙΑ ΣΤΟΙΧΕΙΑ ΣΥΜΒΑΣΗΣ
// // ========================================================================

// async function loadStoixeiaSymbaseonFromAPI() {
//     try {
//         const symbash = document.getElementById('symbash_stathera')?.value?.trim();
//         const kathgoria = document.getElementById('kathgoria_symbashs_stathera')?.value?.trim();
//         const eidikothta = document.getElementById('eidikothta_symbashs_stathera')?.value?.trim();

//         if (!symbash || !kathgoria || !eidikothta) {
//             console.warn('⚠️ Λείπουν Σύμβαση/Κατηγορία/Ειδικότητα');
//             return;
//         }

//         const url = new URL('/api/dropdown/symbaseis/stoixeio_symbashs', window.location.origin);
//         url.searchParams.set('symbash_stathera', symbash.padStart(4, '0'));
//         url.searchParams.set('kathgoria_symbashs_stathera', kathgoria.padStart(4, '0'));
//         url.searchParams.set('eidikothta_symbashs_stathera', eidikothta.padStart(4, '0'));
//         url.searchParams.set('limit', 50);

//         const response = await fetch(url, {
//             method: 'GET',
//             headers: { 'Content-Type': 'application/json' },
//             credentials: 'include'
//         });

//         if (!response.ok) {
//             throw new Error(`API Error: ${response.status} ${response.statusText}`);
//         }

//         const apiData = await response.json();
//         const items = Array.isArray(apiData.items) ? apiData.items : [];

//         if (items.length === 0) {
//             showAlert({
//                 icon: 'warning',
//                 title: 'Προσοχή !!!',
//                 html: 'Δεν υπάρχουν διαθέσιμα <strong>Στοιχεία Σύμβασης</strong> για την επιλεγμένη Ειδικότητα.'
//             });
//             return;
//         }

//         const selectedSymbashEl = document.getElementById('selectedSymbash');
//         const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
//         const selectedEidikothtaEl = document.getElementById('selectedEidikothta');

//         if (selectedSymbashEl) selectedSymbashEl.value = symbash.padStart(4, '0');
//         if (selectedKathgoriaEl) selectedKathgoriaEl.value = kathgoria.padStart(4, '0');
//         if (selectedEidikothtaEl) selectedEidikothtaEl.value = eidikothta.padStart(4, '0');

//         const genikesParametroi = await fetchGenikesParametroi();
//         updateGeneralParameters(genikesParametroi);

//         // Ενημέρωση global για χρήση στο shared module
//         window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = toDecimal(genikesParametroi[0]?.timh);
//         window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = toDecimal(
//             genikesParametroi[1]?.timh
//         );
//         window._SYNTELESTHS_EBDOMADON_MISTHOTON = toDecimal(genikesParametroi[2]?.timh);
//         window._SYNTELESTHS_EBDOMADON_HMEROMISTHION = toDecimal(genikesParametroi[3]?.timh);
//         window._ORES_HMERHSIAS_ERGASIAS = toDecimal(genikesParametroi[4]?.timh);
//         window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = toDecimal(genikesParametroi[5]?.timh);
//         window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = toDecimal(genikesParametroi[6]?.timh);
//         window._ARITHMOS_STOIXEION_SYMBASEON = toDecimal(genikesParametroi[22]?.timh);

//         _ARITHMOS_STOIXEION_SYMBASEON = window._ARITHMOS_STOIXEION_SYMBASEON.toNumber();

//         await initializeTomSelectForStoixeia(items);
//     } catch (error) {
//         showAlert({
//             icon: 'error',
//             title: 'Σφάλμα κατά τη φόρτωση Στοιχείων Σύμβασης',
//             html: `Σφάλμα: ${error.message}`
//         });
//     }
// }

// async function initializeTomSelectForStoixeia(items) {
//     if (!initTomDropdown) {
//         console.error(
//             '❌ initTomDropdown not available! Make sure dropdown-item.js is loaded first.'
//         );
//         return;
//     }

//     let aa_stoixeion_symbaseon =
//         _ARITHMOS_STOIXEION_SYMBASEON !== 0 ? _ARITHMOS_STOIXEION_SYMBASEON : 15;

//     for (let i = 1; i <= aa_stoixeion_symbaseon; i++) {
//         const idNum = i.toString().padStart(2, '0');
//         const selectId = `stoixeio_symbashs_${idNum}`;
//         const rowId = `row_${idNum}`;
//         const selectEl = document.getElementById(selectId);
//         const row = document.getElementById(rowId);

//         if (selectEl?.tomselect) {
//             try {
//                 selectEl.tomselect.destroy();
//             } catch (e) {
//                 console.warn(`⚠️ Failed to destroy ${selectId}:`, e);
//             }
//         }

//         if (row) row.classList.add('d-none');
//     }

//     const numRows = Math.min(items.length, aa_stoixeion_symbaseon);

//     const symbashVal = (document.getElementById('symbash_stathera')?.value || '')
//         .trim()
//         .padStart(4, '0');
//     const kathgoriaVal = (document.getElementById('kathgoria_symbashs_stathera')?.value || '')
//         .trim()
//         .padStart(4, '0');
//     const eidikothtaVal = (document.getElementById('eidikothta_symbashs_stathera')?.value || '')
//         .trim()
//         .padStart(4, '0');

//     for (let i = 1; i <= numRows; i++) {
//         const idNum = i.toString().padStart(2, '0');
//         const selectId = `stoixeio_symbashs_${idNum}`;
//         const rowId = `row_${idNum}`;

//         const row = document.getElementById(rowId);
//         const selectEl = document.getElementById(selectId);

//         if (!row || !selectEl) continue;

//         row.classList.remove('d-none');

//         try {
//             await initTomDropdown({
//                 selector: `#${selectId}`,
//                 url: '/api/dropdown/symbaseis/stoixeio_symbashs',
//                 extraParams: {
//                     symbash_stathera: symbashVal,
//                     kathgoria_symbashs_stathera: kathgoriaVal,
//                     eidikothta_symbashs_stathera: eidikothtaVal,
//                     padLength: '4'
//                 },
//                 minChars: 0,
//                 hooks: {
//                     onInitialize: function () {
//                         this.on('change', async (value) => {
//                             if (value) {
//                                 await handleStoixeioChange(idNum, value);
//                             }
//                         });
//                     }
//                 }
//             });
//         } catch (err) {
//             console.error(`❌ Failed to init Tom-Select for ${selectId}:`, err);
//         }
//     }
// }

// async function handleStoixeioChange(rowIndex, selectedValue) {
//     if (!selectedValue) return;

//     _AA_STOIXEIOY = parseInt(rowIndex);

//     const contract = document.getElementById('selectedSymbash')?.value?.padStart(4, '0');
//     const category = document.getElementById('selectedKathgoria')?.value?.padStart(4, '0');
//     const specialty = document.getElementById('selectedEidikothta')?.value?.padStart(4, '0');
//     const klimakioEl = document.getElementById('misthologiko_klimakio');
//     const klimakio = klimakioEl?.value?.padStart(2, '0') || '01';
//     const hmeromhniaEl = document.getElementById('hmeromhnia_allaghs_symbashs');
//     const hmeromhnia = hmeromhniaEl?.value || '';

//     try {
//         data = await fetchApodoxesData(
//             contract,
//             category,
//             specialty,
//             selectedValue.padStart(4, '0'),
//             klimakio,
//             hmeromhnia
//         );

//         if (!data.success) {
//             showAlert({
//                 icon: 'warning',
//                 title: 'Προσοχή !!!',
//                 html: 'Δεν έχουν ενημερωθεί <strong>τα κλιμάκια</strong> της επιλεγείσας σύμβασης'
//             });
//             return;
//         }

//         const posoFieldId = `poso_symbashs_${rowIndex}`;
//         const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${rowIndex}`;
//         const posoField = document.getElementById(posoFieldId);

//         if (posoField) {
//             posoField.value = formatDecimal(data.poso, 2);
//         }

//         let extraApodoxes = false;
//         updateGeneralParameters(data.genikesParametroi);
//         updatePosoBasedOnHours(parseInt(rowIndex), data, posoBasedOnHoursFieldId, extraApodoxes);

//         const posoValue = toDecimal(data.poso);
//         if (!posoValue.isZero()) {
//             calculateTotal();
//         }
//     } catch (error) {
//         console.error('❌ Σφάλμα κατά την ενημέρωση αποδοχών:', error);
//     }
// }

// function watchEidikothtaChanges() {
//     const eidikothtaHidden = document.getElementById('eidikothta_symbashs_stathera');
//     const eidikothtaTable = document.getElementById('eidikothta_symbashs_table');

//     if (!eidikothtaHidden) {
//         console.warn('⚠️ Δε βρέθηκε το hidden field: eidikothta_symbashs_stathera');
//         return;
//     }

//     let previousValue = eidikothtaHidden.value;
//     let previousTable = eidikothtaTable?.value || '[]';

//     const checkChange = () => {
//         const currentValue = eidikothtaHidden.value?.trim();
//         const currentTable = eidikothtaTable?.value || '[]';

//         const valueChanged = currentValue !== previousValue;
//         const tableChanged = currentTable !== previousTable;

//         if (valueChanged || tableChanged) {
//             previousValue = currentValue;
//             previousTable = currentTable;

//             if (!currentValue) {
//                 clearAllStoixeiaRows();
//                 return;
//             }

//             clearAllStoixeiaRows();
//             setTimeout(() => loadStoixeiaSymbaseonFromAPI(), 150);
//         }
//     };

//     const observer = new MutationObserver(checkChange);
//     observer.observe(eidikothtaHidden, { attributes: true, attributeFilter: ['value'] });

//     if (eidikothtaTable) {
//         const tableObserver = new MutationObserver(checkChange);
//         tableObserver.observe(eidikothtaTable, { attributes: true, attributeFilter: ['value'] });
//     }

//     ['change', 'input'].forEach((eventType) => {
//         eidikothtaHidden.addEventListener(eventType, checkChange);
//         eidikothtaTable?.addEventListener(eventType, checkChange);
//     });

//     window.addEventListener('eidikothtaChanged', checkChange);
// }

// function clearAllStoixeiaRows() {
//     const limit = _ARITHMOS_STOIXEION_SYMBASEON || 15;

//     for (let i = 1; i <= limit; i++) {
//         const idNum = i.toString().padStart(2, '0');
//         const selectId = `stoixeio_symbashs_${idNum}`;
//         const selectEl = document.getElementById(selectId);

//         if (selectEl?.tomselect) {
//             try {
//                 selectEl.tomselect.destroy();
//             } catch (e) {
//                 console.warn(`⚠️ Failed to destroy ${selectId}:`, e);
//             }
//         }

//         const posoField = document.getElementById(`poso_symbashs_${idNum}`);
//         const posoBaseiField = document.getElementById(
//             `poso_symbashs_basei_oron_ergasias_${idNum}`
//         );
//         if (posoField) posoField.value = '';
//         if (posoBaseiField) posoBaseiField.value = '';

//         const row = document.getElementById(`row_${idNum}`);
//         if (row) row.classList.add('d-none');
//     }

//     const synoloSymb = document.getElementById('synolo_symbashs');
//     const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
//     if (synoloSymb) synoloSymb.value = '0.00';
//     if (synoloBasei) synoloBasei.value = '0.00';
// }

// window.clearStoixeiaSymbaseonContainer = function () {
//     const limit = _ARITHMOS_STOIXEION_SYMBASEON || 15;

//     for (let i = 1; i <= limit; i++) {
//         const idNum = i.toString().padStart(2, '0');
//         const selectId = `stoixeio_symbashs_${idNum}`;
//         const selectEl = document.getElementById(selectId);

//         if (selectEl?.tomselect) {
//             try {
//                 selectEl.tomselect.clear();
//                 selectEl.tomselect.clearOptions();
//                 selectEl.tomselect.destroy();
//             } catch (e) {}
//         }

//         const posoField = document.getElementById(`poso_symbashs_${idNum}`);
//         const posoBaseiField = document.getElementById(
//             `poso_symbashs_basei_oron_ergasias_${idNum}`
//         );
//         if (posoField) posoField.value = '';
//         if (posoBaseiField) posoBaseiField.value = '';

//         const row = document.getElementById(`row_${idNum}`);
//         if (row) row.classList.add('d-none');
//     }

//     const synoloSymb = document.getElementById('synolo_symbashs');
//     const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
//     if (synoloSymb) synoloSymb.value = '0.00';
//     if (synoloBasei) synoloBasei.value = '0.00';

//     const selectedSymbashEl = document.getElementById('selectedSymbash');
//     const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
//     const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
//     if (selectedSymbashEl) selectedSymbashEl.value = '';
//     if (selectedKathgoriaEl) selectedKathgoriaEl.value = '';
//     if (selectedEidikothtaEl) selectedEidikothtaEl.value = '';

//     const fields = [
//         'nomimosMisthos',
//         'nomimoHmeromisthio',
//         'nomimoOromisthio',
//         'pragmatikosMisthos',
//         'pragmatikoHmeromisthio',
//         'pragmatikoOromisthio'
//     ];
//     fields.forEach((id) => {
//         const el = document.getElementById(id);
//         if (el) el.value = '0.00';
//     });
// };

// // ========================================================================
// // GLOBAL EXPORTS
// // ========================================================================

// window.loadStoixeiaSymbaseonFromAPI = loadStoixeiaSymbaseonFromAPI;
// window.calculateTotal = calculateTotal;

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

function applyNomimaFromSymbashTotals() {
    const synoloSymbashsEl = document.getElementById('synolo_symbashs');
    const nomimosMisthosEl = document.getElementById('nomimosMisthos');
    const nomimoHmeromisthioEl = document.getElementById('nomimoHmeromisthio');

    const synoloSymbashs = toDecimal(synoloSymbashsEl?.value);

    console.log('📌 ADD applyNomimaFromSymbashTotals:', {
        synolo_symbashs_raw: synoloSymbashsEl?.value,
        synoloSymbashs: synoloSymbashs.toString(),
        _HMERES: window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS?.toString(),
        nomimosMisthos_BEFORE: nomimosMisthosEl?.value
    });

    if (nomimosMisthosEl) {
        nomimosMisthosEl.value = formatForDisplay(synoloSymbashs, 2);
    }

    if (nomimoHmeromisthioEl) {
        nomimoHmeromisthioEl.value = formatForDisplay(
            synoloSymbashs.div(toDecimal(window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS)),
            4
        );
    }

    console.log('📌 ADD applyNomimaFromSymbashTotals AFTER:', {
        nomimosMisthos: nomimosMisthosEl?.value,
        nomimoHmeromisthio: nomimoHmeromisthioEl?.value
    });
}

// ========================================================================
// GLOBAL VARIABLES
// ========================================================================

let currentValues = {};
let data = {};

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
    const totalBaseiMinusExtra = totalBaseiOronErgasias.minus(_TOTAL_EXTRA_APODOXES);

    console.log('📊 ADD calculatePartTimeWages:', { typosErg, eidKath, hasExtraApodoxes });

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
    }

    console.log('📊 ADD PartTime RESULTS:', {
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
// GLOBAL EXPORTS
// ========================================================================

window.loadStoixeiaSymbaseonFromAPI = loadStoixeiaSymbaseonFromAPI;
window.calculateTotal = calculateTotal;
