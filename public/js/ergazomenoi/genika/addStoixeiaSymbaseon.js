// // addStoixeiaSymbaseon.js
// // Διαχείριση Στοιχείων Σύμβασης με Tom-Select dropdowns (FIXED)
// // Last Updated: 23/11/2025 - WITH DECIMAL.JS PRECISION

// import { initTomDropdown } from '/static/js/dropdown-item.js';

// // ========================================================================
// // DECIMAL.JS CONFIGURATION
// // ========================================================================

// // Ρύθμιση Decimal.js για υψηλή ακρίβεια
// Decimal.set({ 
// 	precision: 28,           // Ακρίβεια 28 δεκαδικών ψηφίων
// 	rounding: Decimal.ROUND_HALF_UP,  // Στρογγυλοποίηση προς τα πάνω
// 	toExpNeg: -7,
// 	toExpPos: 15
// });

// let currentValues = {};
// let data = {};

// let _AA_STOIXEIOY = 0,
// 	_ARITHMOS_STOIXEION_SYMBASEON = 0,
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
// // HELPER FUNCTIONS ΓΙΑ DECIMAL
// // ========================================================================

// /**
//  * Μετατρέπει οποιαδήποτε τιμή σε Decimal με ασφάλεια
//  */
// function toDecimal(value) {
// 	if (value instanceof Decimal) return value;
// 	if (value === null || value === undefined || value === '') return new Decimal(0);
// 	try {
// 		return new Decimal(value);
// 	} catch (e) {
// 		console.warn('Invalid decimal value:', value);
// 		return new Decimal(0);
// 	}
// }

// /**
//  * Μορφοποιεί Decimal σε string με συγκεκριμένα δεκαδικά
//  */
// function formatDecimal(value, decimals = 2) {
// 	return toDecimal(value).toFixed(decimals);
// }

// function showAlert({ 
// 	title, 
// 	html, 
// 	icon = 'info', 
// 	confirmButtonText = 'Κλείσιμο',
// 	allowOutsideClick = false 
// } = {}) {
// 	return Swal.fire({
// 		backdrop: false,
// 		allowOutsideClick,
// 		icon,
// 		title,
// 		html,
// 		showConfirmButton: true,
// 		confirmButtonText,
// 		customClass: {
// 			confirmButton: `class-${icon} custom-confirm-button custom-swal-button`,
// 			title: 'custom-title',
// 			popup: 'custom-swal-popup',
// 		},
// 	});
// }

// // ========================================================================
// // ΑΡΧΙΚΟΠΟΙΗΣΗ
// // ========================================================================

// document.addEventListener("DOMContentLoaded", function () {
// 	_PLHRHS_APASXOLHSH = document.getElementById('plhrhs_apasxolhsh');
// 	generateSelectRowsOfSymbaseis();
// 	addEventListeners();
// 	calculateTotal();
	
// 	// Παρακολούθηση αλλαγών στην Ειδικότητα
// 	watchEidikothtaChanges();
// });

// // ========================================================================
// // ΔΗΜΙΟΥΡΓΙΑ HTML ΓΙΑ ΤΑ ROWS (μέχρι 15, αλλά κρυφά αρχικά)
// // ========================================================================

// function generateSelectRowsOfSymbaseis() {
// 	const container = document.getElementById('stoixeiaSymbaseonContainer');
// 	if (!container) {
// 		console.warn('⚠️ Container stoixeiaSymbaseonContainer not found');
// 		return;
// 	}
	
// 	container.innerHTML = ''; 

// 	// Δημιουργία μέχρι 15 rows (όλα d-none αρχικά)
// 	for (let i = 1; i <= 15; i++) {
// 		const idNum = i.toString().padStart(2, '0');
// 		const rowHTML = `
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
// 					<input type="number" class="form-control input-contents right-align clearAble addStoixSymb002" name="poso_symbashs_${idNum}" id="poso_symbashs_${idNum}" readonly />
// 				</div>
// 				<div class="col-0-5"></div>
// 				<div class="col-1-5">
// 					<input type="number" class="form-control input-contents right-align numeric clearAble addStoixSymb003" name="poso_symbashs_basei_oron_ergasias_${idNum}" 
// 						id="poso_symbashs_basei_oron_ergasias_${idNum}" step="0.01" />
// 				</div>
// 				<button type="button" class="btn rounded-4 col-0-3 clear-row border-0" 
// 					id="clearSelectSymbaseon-${idNum}" 
// 					data-bs-toggle="tooltip" 
// 					title="Καθαρισμός όλης της τρέχουσας γραμμής" 
// 					data-bs-placement="bottom" 
// 					data-target="stoixeio_symbashs_${idNum}">
// 					<i class="bi bi-x-lg cdarkred"></i>
// 				</button>
// 			</div>
// 		`;
// 		container.insertAdjacentHTML('beforeend', rowHTML);
// 	}
// }

// // ========================================================================
// // EVENT LISTENERS
// // ========================================================================

// function addEventListeners() {
// 	const container = document.getElementById('stoixeiaSymbaseonContainer');
// 	if (!container) return;
	
// 	container.addEventListener('input', handleInputEvent);

// 	// Event delegation για τα trash buttons
// 	container.addEventListener('click', (e) => {
// 		const trashBtn = e.target.closest('.clear-row');
// 		if (trashBtn) {
// 			const targetId = trashBtn.dataset.target;
// 			const selectEl = document.getElementById(targetId);
// 			if (selectEl && selectEl.tomselect) {
// 				selectEl.tomselect.clear();
// 				selectEl.tomselect.clearOptions();
// 			}
			
// 			// Καθαρισμός των ποσών
// 			const rowNum = targetId.match(/\d+/)[0];
// 			const posoField = document.getElementById(`poso_symbashs_${rowNum}`);
// 			const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${rowNum}`);
// 			if (posoField) posoField.value = '';
// 			if (posoBaseiField) posoBaseiField.value = '';
			
// 			calculateTotal();
// 		}
// 	});
// }

// function handleInputEvent(event) {
// 	if (event.target.type === 'number' && event.target.classList.contains('numeric')) {
// 		const elementId = event.target.id;
// 		const newValue = toDecimal(event.target.value);
// 		const oldValue = currentValues[elementId] ? toDecimal(currentValues[elementId]) : new Decimal(0);

// 		_TOTAL_EXTRA_APODOXES = _TOTAL_EXTRA_APODOXES.plus(newValue).minus(oldValue);
// 		currentValues[elementId] = newValue.toString();

// 		formatNumericInput(event.target);

// 		data.poso = newValue;
// 		const rowMatch = elementId.match(/poso_symbashs_basei_oron_ergasias_(\d+)/);
// 		if (rowMatch) {
// 			_AA_STOIXEIOY = parseInt(rowMatch[1]);
			
// 			let extraApodoxes = true;
// 			if (data.genikesParametroi) {
// 				updateGeneralParameters(data.genikesParametroi);
// 			}
// 			updatePosoBasedOnHours(_AA_STOIXEIOY, data, elementId, extraApodoxes);
// 		}

// 		calculateTotal();
// 	}
// }

// function formatNumericInput(input) {
// 	const cursorPosition = input.selectionStart;
// 	const originalValue = input.value;
	
// 	if (!originalValue) {
// 		input.value = '';
// 		return;
// 	}
	
// 	const numValue = toDecimal(originalValue);
// 	const newValue = formatDecimal(numValue, 2);

// 	if (newValue !== originalValue) {
// 		input.value = newValue;
// 		const diff = newValue.length - originalValue.length;
// 		const newPos = Math.max(0, cursorPosition + diff);
// 		input.setSelectionRange(newPos, newPos);
// 	}
// }

// // ========================================================================
// // API CALLS
// // ========================================================================

// /**
//  * Φορτώνει τις Γενικές Παραμέτρους από το backend
//  */
// async function fetchGenikesParametroi() {
// 	try {
// 		const response = await fetch('/api/genikesParametroi', {
// 			method: 'GET',
// 			headers: { 'Content-Type': 'application/json' },
// 			credentials: 'include'
// 		});

// 		if (!response.ok) {
// 			throw new Error(`API Error: ${response.status} ${response.statusText}`);
// 		}

// 		const result = await response.json();
		
// 		if (!result.success) {
// 			throw new Error('Failed to fetch genikes parametroi');
// 		}

// 		return result.data;

// 	} catch (error) {
// 		console.error('❌ Error fetching genikes parametroi:', error);
// 		throw error;
// 	}
// }

// async function fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, date) {
// 	try {
// 		const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
		
// 		if (!csrfToken) {
// 			console.error('❌ CSRF token not found!');
// 			throw new Error('CSRF token missing. Please refresh the page.');
// 		}

// 		const response = await fetch('/api/apodoxesErgazomenon', {
// 			method: 'POST',
// 			headers: {
// 				'Content-Type': 'application/json',
// 				'CSRF-Token': csrfToken,
// 				'X-CSRF-Token': csrfToken
// 			},
// 			credentials: 'include',
// 			body: JSON.stringify({
// 				contract,
// 				category,
// 				specialty,
// 				selectedElement,
// 				klimakio,
// 				date,
// 				_csrf: csrfToken
// 			})
// 		});

// 		if (!response.ok) {
// 			const text = await response.text();
// 			console.error('❌ API Error Response:', text.substring(0, 300));
			
// 			if (response.status === 403) {
// 				throw new Error('CSRF validation failed. Please refresh the page and try again.');
// 			}
			
// 			throw new Error(`API Error: ${response.status} ${response.statusText}`);
// 		}

// 		const contentType = response.headers.get('content-type');
// 		if (!contentType || !contentType.includes('application/json')) {
// 			const text = await response.text();
// 			console.error('❌ Non-JSON Response:', text.substring(0, 300));
// 			throw new Error('Server returned HTML instead of JSON');
// 		}

// 		const data = await response.json();
		
// 		return data;

// 	} catch (error) {
// 		console.error('❌ Fetch Error:', error);
// 		throw error;
// 	}
// }

// // ========================================================================
// // ΥΠΟΛΟΓΙΣΜΟΙ ΑΠΟΔΟΧΩΝ ΜΕ DECIMAL.JS
// // ========================================================================

// function updateGeneralParameters(parameters) {
// 	if (!parameters || !Array.isArray(parameters)) return;
	
// 	// Απευθείας πρόσβαση με index - γρήγορο και αξιόπιστο
// 	_ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = toDecimal(parameters[0]?.timh);
// 	_SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = toDecimal(parameters[1]?.timh);
// 	_SYNTELESTHS_EBDOMADON_MISTHOTON = toDecimal(parameters[2]?.timh);
// 	_SYNTELESTHS_EBDOMADON_HMEROMISTHION = toDecimal(parameters[3]?.timh);
// 	_ORES_HMERHSIAS_ERGASIAS = toDecimal(parameters[4]?.timh);
// 	_HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = toDecimal(parameters[5]?.timh);
// 	_ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = toDecimal(parameters[6]?.timh);
// 	_ARITHMOS_STOIXEION_SYMBASEON = toDecimal(parameters[22]?.timh);
// }

// function updatePosoBasedOnHours(i, data, posoBasedOnHoursFieldId, extraApodoxes) {
// 	const typeEl = document.getElementById('typos_ergazomenon');
// 	if (!typeEl) return;
	
// 	const type = typeEl.value;
// 	const posoBasedOnHoursField = document.getElementById(posoBasedOnHoursFieldId);
	
// 	const oresEl = document.getElementById("ores_ergasias_ebdomadas");
// 	const hmeresEl = document.getElementById("hmeres_ergasias_ebdomadas");
	
// 	const hours = toDecimal(oresEl?.value);
// 	const days = toDecimal(hmeresEl?.value);

// 	let calculatedValue = calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes);

// 	if (!calculatedValue || calculatedValue.isNaN()) {
// 		showAlert({
// 			icon: 'info',
// 			title: 'Λείπει ο Τύπος Εργαζομένου',
// 			html: 'Δεν είναι εφικτός ο υπολογισμός των αποδοχών βάσει των ωρών εργασίας γιατί δεν έχετε επιλέξει <strong>ΤΥΠΟ ΕΡΓΑΖΟΜΕΝΟΥ</strong> στην καρτέλλα <strong>Σταθερά Στοιχεία</strong>.'
// 		});

// 		if (posoBasedOnHoursField) posoBasedOnHoursField.value = "0.00";
// 	} else {
// 		if (posoBasedOnHoursField) posoBasedOnHoursField.value = formatDecimal(calculatedValue, 2);
// 	}
// }

// function calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes) {
// 	let value = new Decimal(0);

// 	if (_PLHRHS_APASXOLHSH && _PLHRHS_APASXOLHSH.checked) {
// 		switch (type) {
// 			case "Μ": value = toDecimal(data.poso); break;
// 			case "Η": value = calculateMonthlyWage(data, hours, days, true, type, extraApodoxes); break;
// 			case "Ω": value = calculateHourlyWage(data, hours, days, true, extraApodoxes); break;
// 			default: value = null;
// 		}
// 	} else {
// 		switch (type) {
// 			case "Μ": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
// 			case "Η": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
// 			case "Ω": value = calculateHourlyWage(data, hours, days, false, extraApodoxes); break;
// 			default: value = null;
// 		}
// 	}

// 	return value;
// }

// function calculateHourlyWage(data, hours, days, fullTime, extraApodoxes) {
// 	let value = new Decimal(0);
// 	const eidKathEl = document.getElementById('eidikh_kathgoria_ergazomenoy');
// 	if (!eidKathEl) return value;

// 	const poso = toDecimal(data.poso);

// 	switch (eidKathEl.value) {
// 		case "0001": // ΚΑΘΗΓΗΤΕΣ ΦΡΟΝΤΙΣΤΗΡΙΩΝ
// 			if (!poso.isZero()) {
// 				if (!extraApodoxes) {
// 					// (6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS / 25) * poso
// 					_NOMIMO_OROMISTHIO = new Decimal(6)
// 						.div(_ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS)
// 						.div(25)
// 						.times(poso);
					
// 					if (fullTime) {
// 						value = _NOMIMO_OROMISTHIO
// 							.times(hours)
// 							.times(_SYNTELESTHS_EBDOMADON_MISTHOTON);
// 					} else {
// 						_PRAGMATIKO_OROMISTHIO = new Decimal(6)
// 							.div(_ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS)
// 							.div(25)
// 							.times(poso);
// 						value = _PRAGMATIKO_OROMISTHIO
// 							.times(hours)
// 							.times(_SYNTELESTHS_EBDOMADON_MISTHOTON);
// 					}
// 				} else {
// 					value = poso;
// 				}
// 			}
// 			break;
// 		default:
// 			value = null;
// 	}
// 	return value;
// }

// function calculateMonthlyWage(data, hours, days, fullTime, type, extraApodoxes) {
// 	let value = new Decimal(0);
// 	const poso = toDecimal(data.poso);
	
// 	if (!poso.isZero()) {
// 		if (!extraApodoxes) {
// 			if (type === "Μ") {
// 				_NOMIMO_OROMISTHIO = poso.div(_ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS);
// 			} else {
// 				_NOMIMO_OROMISTHIO = poso.times(_SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO);
// 			}
			
// 			_PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
			
// 			const syntelesths = type === "Μ" 
// 				? _SYNTELESTHS_EBDOMADON_MISTHOTON 
// 				: _SYNTELESTHS_EBDOMADON_HMEROMISTHION;
			
// 			value = _NOMIMO_OROMISTHIO.times(hours).times(syntelesths);
// 		} else {
// 			value = poso;
// 		}
// 	}  
// 	return value;
// }

// async function calculateTotal() {
// 	// Reset όλων των μεταβλητών με Decimal
// 	totalSymbashs = new Decimal(0);
// 	totalBaseiOronErgasias = new Decimal(0);
// 	_TOTAL_EXTRA_APODOXES = new Decimal(0);
// 	_PRAGMATIKO_OROMISTHIO = new Decimal(0);
	
// 	const nomimosMisthos = document.getElementById('nomimosMisthos');
// 	const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
// 	const nomimoOromisthio = document.getElementById('nomimoOromisthio');
// 	const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
// 	const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
// 	const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');
	
// 	const ores_ergasias_ebdomadas = toDecimal(document.getElementById("ores_ergasias_ebdomadas")?.value);
// 	const hmeres_ergasias_ebdomadas = toDecimal(document.getElementById("hmeres_ergasias_ebdomadas")?.value);

// 	// Υπολογισμός συνόλων με Decimal
// 	for (let i = 1; i <= _ARITHMOS_STOIXEION_SYMBASEON; i++) {
// 		const idNum = i.toString().padStart(2, '0');
// 		const posoInput = document.getElementById(`poso_symbashs_${idNum}`);
// 		const posoInputBaseiOron = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
		
// 		const posoValue = toDecimal(posoInput?.value);
// 		const posoBaseiValue = toDecimal(posoInputBaseiOron?.value);
		
// 		totalSymbashs = totalSymbashs.plus(posoValue);
// 		totalBaseiOronErgasias = totalBaseiOronErgasias.plus(posoBaseiValue);
		
// 		if (!posoBaseiValue.isZero() && posoValue.isZero()) {
// 			_TOTAL_EXTRA_APODOXES = _TOTAL_EXTRA_APODOXES.plus(posoBaseiValue);
// 		}
// 	}

// 	document.getElementById('synolo_symbashs').value = formatDecimal(totalSymbashs, 2);
// 	document.getElementById('synolo_symbashs_basei_oron_ergasias').value = formatDecimal(totalBaseiOronErgasias, 2);
	
// 	const typosErg = document.getElementById('typos_ergazomenon')?.value;
// 	const eidKath = document.getElementById('eidikh_kathgoria_ergazomenoy')?.value;
	
// 	if (_PLHRHS_APASXOLHSH.checked) {
// 		switch (typosErg) {
// 			case "Ω":
// 				if (eidKath === "0001") {
// 					_NOMIMO_OROMISTHIO = new Decimal(6)
// 						.div(_ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS)
// 						.div(25)
// 						.times(totalSymbashs);
					
// 					_PRAGMATIKO_OROMISTHIO = new Decimal(6)
// 						.div(_ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS)
// 						.div(25)
// 						.times(totalBaseiOronErgasias);
					
// 					nomimosMisthos.value = formatDecimal(
// 						_NOMIMO_OROMISTHIO.times(ores_ergasias_ebdomadas).times(_SYNTELESTHS_EBDOMADON_MISTHOTON),
// 						2
// 					);
// 					nomimoHmeromisthio.value = formatDecimal(
// 						_NOMIMO_OROMISTHIO.times(ores_ergasias_ebdomadas).div(hmeres_ergasias_ebdomadas),
// 						2
// 					);
// 					nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
					
// 					pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);
// 					pragmatikoHmeromisthio.value = formatDecimal(
// 						_PRAGMATIKO_OROMISTHIO.times(ores_ergasias_ebdomadas).div(hmeres_ergasias_ebdomadas),
// 						2
// 					);
// 					pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
// 				}
// 				break;
				
// 			case "Μ":
// 				_NOMIMO_OROMISTHIO = totalSymbashs.div(_ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS);
// 				_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(_ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS);
				
// 				nomimosMisthos.value = formatDecimal(
// 					_NOMIMO_OROMISTHIO.times(ores_ergasias_ebdomadas).times(_SYNTELESTHS_EBDOMADON_MISTHOTON),
// 					2
// 				);
// 				nomimoHmeromisthio.value = formatDecimal(
// 					_NOMIMO_OROMISTHIO.times(_ORES_HMERHSIAS_ERGASIAS),
// 					2
// 				);
// 				nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
				
// 				pragmatikosMisthos.value = formatDecimal(
// 					_PRAGMATIKO_OROMISTHIO.times(ores_ergasias_ebdomadas).times(_SYNTELESTHS_EBDOMADON_MISTHOTON),
// 					2
// 				);
// 				pragmatikoHmeromisthio.value = formatDecimal(
// 					_PRAGMATIKO_OROMISTHIO.times(_ORES_HMERHSIAS_ERGASIAS),
// 					2
// 				);
// 				pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
// 				break;
				
// 			case "Η":
// 				_NOMIMO_OROMISTHIO = totalSymbashs.times(_SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO);
// 				_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
// 					ores_ergasias_ebdomadas.times(_SYNTELESTHS_EBDOMADON_HMEROMISTHION)
// 				);
				
// 				nomimosMisthos.value = formatDecimal(
// 					_NOMIMO_OROMISTHIO.times(ores_ergasias_ebdomadas).times(_SYNTELESTHS_EBDOMADON_HMEROMISTHION),
// 					2
// 				);
// 				nomimoHmeromisthio.value = formatDecimal(
// 					_NOMIMO_OROMISTHIO.times(_ORES_HMERHSIAS_ERGASIAS),
// 					2
// 				);
// 				nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
// 				pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

// 				if (!ores_ergasias_ebdomadas.isZero() && !hmeres_ergasias_ebdomadas.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
// 					pragmatikoHmeromisthio.value = formatDecimal(
// 						_PRAGMATIKO_OROMISTHIO.times(ores_ergasias_ebdomadas).div(hmeres_ergasias_ebdomadas),
// 						2
// 					);
// 				} else {
// 					pragmatikoHmeromisthio.value = "0.00";
// 				}
// 				pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
// 				break;
// 		}
// 	} else {
// 		// Μερική απασχόληση
// 		const _ores_apasxolhshs = ores_ergasias_ebdomadas.div(hmeres_ergasias_ebdomadas);

// 		switch (typosErg) {
// 			case "Ω":
// 				if (eidKath === "0001") {
// 					_NOMIMO_OROMISTHIO = new Decimal(6)
// 						.div(_ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS)
// 						.div(25)
// 						.times(totalSymbashs);
					
// 					_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
// 						ores_ergasias_ebdomadas.times(_SYNTELESTHS_EBDOMADON_MISTHOTON)
// 					);

// 					nomimosMisthos.value = formatDecimal(
// 						_NOMIMO_OROMISTHIO.times(ores_ergasias_ebdomadas).times(_SYNTELESTHS_EBDOMADON_MISTHOTON),
// 						2
// 					);
// 					nomimoHmeromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO.times(_ores_apasxolhshs), 2);
// 					nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);

// 					pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

// 					if (!ores_ergasias_ebdomadas.isZero() && !hmeres_ergasias_ebdomadas.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
// 						pragmatikoHmeromisthio.value = formatDecimal(
// 							_PRAGMATIKO_OROMISTHIO.times(ores_ergasias_ebdomadas).div(hmeres_ergasias_ebdomadas),
// 							2
// 						);
// 					} else {
// 						pragmatikoHmeromisthio.value = "0.00";
// 					}
// 					pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
// 				}
// 				break;
				
// 			case "Μ":
// 				_NOMIMO_OROMISTHIO = totalSymbashs.div(_ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS);
// 				_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
// 					ores_ergasias_ebdomadas.times(_SYNTELESTHS_EBDOMADON_MISTHOTON)
// 				);
				
// 				nomimosMisthos.value = formatDecimal(
// 					_NOMIMO_OROMISTHIO.times(ores_ergasias_ebdomadas).times(_SYNTELESTHS_EBDOMADON_MISTHOTON),
// 					2
// 				);
// 				nomimoHmeromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO.times(_ores_apasxolhshs), 2);
// 				nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
// 				pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

// 				if (!ores_ergasias_ebdomadas.isZero() && !hmeres_ergasias_ebdomadas.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
// 					pragmatikoHmeromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs), 2);
// 				} else {
// 					pragmatikoHmeromisthio.value = "0.00";
// 				}
// 				pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
// 				break;
				
// 			case "Η":
// 				_NOMIMO_OROMISTHIO = totalSymbashs.times(_SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO);
// 				_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
// 					ores_ergasias_ebdomadas.times(_SYNTELESTHS_EBDOMADON_HMEROMISTHION)
// 				);
			
// 				nomimosMisthos.value = formatDecimal(
// 					_NOMIMO_OROMISTHIO.times(ores_ergasias_ebdomadas).times(_SYNTELESTHS_EBDOMADON_HMEROMISTHION),
// 					2
// 				);
// 				nomimoHmeromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO.times(_ores_apasxolhshs), 2);
// 				nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
// 				pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

// 				if (!ores_ergasias_ebdomadas.isZero() && !hmeres_ergasias_ebdomadas.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
// 					pragmatikoHmeromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs), 2);
// 				} else {
// 					pragmatikoHmeromisthio.value = "0.00";
// 				}
// 				pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
// 				break;
// 		}
// 	}
	
// 	setupAutomaticRecalculation();
// }

// function setupAutomaticRecalculation() {
// 	const pragmatikoOromisthioEl = document.getElementById('pragmatikoOromisthio');
// 	if (!pragmatikoOromisthioEl) return;
	
// 	const pragmatikoOromisthio = pragmatikoOromisthioEl.value;
// 	const oromisthioValue = toDecimal(pragmatikoOromisthio);
// 	const isOromisthioValid = pragmatikoOromisthio && !oromisthioValue.isNaN() && !oromisthioValue.isZero();

// 	if (isOromisthioValid) {
// 		const ids = ['hmeromhnia_allaghs_symbashs', 'proyphresia_se_eth', 'proyphresia_se_mhnes',
// 		'eidikh_kathgoria_ergazomenoy', 'plhrhs_apasxolhsh', 'hmeres_ergasias_ebdomadas', 
// 		'ores_ergasias_ebdomadas', 'typos_ergazomenon', 'misthologiko_klimakio'];

// 		ids.forEach(id => {
// 			const element = document.getElementById(id);
// 			if (element && !element.__recalcBound) {
// 				element.__recalcBound = true;
// 				element.addEventListener('change', () => {
// 					if (typeof reCalculate === 'function') reCalculate();
// 					else calculateTotal();
// 				});
// 			}
// 		});
// 	}
// }

// // ========================================================================
// // TOM-SELECT ΓΙΑ ΣΤΟΙΧΕΙΑ ΣΥΜΒΑΣΗΣ
// // ========================================================================

// async function loadStoixeiaSymbaseonFromAPI() {
// 	try {
// 		const symbash = document.getElementById('symbash_stathera')?.value?.trim();
// 		const kathgoria = document.getElementById('kathgoria_symbashs_stathera')?.value?.trim();
// 		const eidikothta = document.getElementById('eidikothta_symbashs_stathera')?.value?.trim();

// 		if (!symbash || !kathgoria || !eidikothta) {
// 			console.warn('⚠️ Λείπουν Σύμβαση/Κατηγορία/Ειδικότητα');
// 			return;
// 		}

// 		const url = new URL('/api/dropdown/symbaseis/stoixeio_symbashs', window.location.origin);
// 		url.searchParams.set('symbash_stathera', symbash.padStart(4, '0'));
// 		url.searchParams.set('kathgoria_symbashs_stathera', kathgoria.padStart(4, '0'));
// 		url.searchParams.set('eidikothta_symbashs_stathera', eidikothta.padStart(4, '0'));
// 		url.searchParams.set('limit', 50);

// 		const response = await fetch(url, {
// 			method: 'GET',
// 			headers: { 'Content-Type': 'application/json' },
// 			credentials: 'include'
// 		});

// 		if (!response.ok) {
// 			throw new Error(`API Error: ${response.status} ${response.statusText}`);
// 		}

// 		const apiData = await response.json();
// 		const items = Array.isArray(apiData.items) ? apiData.items : [];

// 		if (items.length === 0) {
// 			showAlert({
// 				icon: 'warning',
// 				title: 'Προσοχή !!!',
// 				html: 'Δεν υπάρχουν διαθέσιμα <strong>Στοιχεία Σύμβασης</strong> για την επιλεγμένη Ειδικότητα.'
// 			});
// 			return;
// 		}

// 		const selectedSymbashEl = document.getElementById('selectedSymbash');
// 		const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
// 		const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
		
// 		if (selectedSymbashEl) selectedSymbashEl.value = symbash.padStart(4, '0');
// 		if (selectedKathgoriaEl) selectedKathgoriaEl.value = kathgoria.padStart(4, '0');
// 		if (selectedEidikothtaEl) selectedEidikothtaEl.value = eidikothta.padStart(4, '0');

// 		// Fetch Γενικές Παράμετροι
// 		const genikesParametroi = await fetchGenikesParametroi();
// 		updateGeneralParameters(genikesParametroi);

// 		await initializeTomSelectForStoixeia(items);
		
// 	} catch (error) {
// 		showAlert({
// 			icon: 'error',
// 			title: 'Σφάλμα κατά τη φόρτωση Στοιχείων Σύμβασης',
// 			html: `Σφάλμα: ${error.message}`
// 		});
// 	}
// }

// async function initializeTomSelectForStoixeia(items) {
// 	if (!initTomDropdown) {
// 		console.error('❌ initTomDropdown not available! Make sure dropdown-item.js is loaded first.');
// 		return;
// 	}

// 	let aa_stoixeion_symbaseon = (_ARITHMOS_STOIXEION_SYMBASEON !== 0) ? _ARITHMOS_STOIXEION_SYMBASEON : 15;

// 	for (let i = 1; i <= aa_stoixeion_symbaseon; i++) {
// 		const idNum = i.toString().padStart(2, '0');
// 		const selectId = `stoixeio_symbashs_${idNum}`;
// 		const rowId = `row_${idNum}`;
// 		const selectEl = document.getElementById(selectId);
// 		const row = document.getElementById(rowId);
		
// 		if (selectEl?.tomselect) {
// 			try {
// 				selectEl.tomselect.destroy();
// 			} catch (e) {
// 				console.warn(`⚠️ Failed to destroy ${selectId}:`, e);
// 			}
// 		}
		
// 		if (row) row.classList.add('d-none');
// 	}

// 	const numRows = Math.min(items.length, aa_stoixeion_symbaseon);

// 	const symbashVal = (document.getElementById('symbash_stathera')?.value || '').trim().padStart(4, '0');
// 	const kathgoriaVal = (document.getElementById('kathgoria_symbashs_stathera')?.value || '').trim().padStart(4, '0');
// 	const eidikothtaVal = (document.getElementById('eidikothta_symbashs_stathera')?.value || '').trim().padStart(4, '0');

// 	for (let i = 1; i <= numRows; i++) {
// 		const idNum = i.toString().padStart(2, '0');
// 		const selectId = `stoixeio_symbashs_${idNum}`;
// 		const rowId = `row_${idNum}`;
		
// 		const row = document.getElementById(rowId);
// 		const selectEl = document.getElementById(selectId);

// 		if (!row || !selectEl) continue;

// 		row.classList.remove('d-none');

// 		try {
// 			await initTomDropdown({
// 				selector: `#${selectId}`,
// 				url: '/api/dropdown/symbaseis/stoixeio_symbashs',
// 				extraParams: {
// 					symbash_stathera: symbashVal,
// 					kathgoria_symbashs_stathera: kathgoriaVal,
// 					eidikothta_symbashs_stathera: eidikothtaVal,
// 					padLength: '4'
// 				},
// 				minChars: 0,
// 				hooks: {
// 					onInitialize: function() {
// 						this.on('change', async (value) => {
// 							if (value) {
// 								await handleStoixeioChange(idNum, value);
// 							}
// 						});
// 					}
// 				}
// 			});

// 		} catch (err) {
// 			console.error(`❌ Failed to init Tom-Select for ${selectId}:`, err);
// 		}
// 	}
// }

// async function handleStoixeioChange(rowIndex, selectedValue) {
// 	if (!selectedValue) return;

// 	_AA_STOIXEIOY = parseInt(rowIndex);

// 	const contract = document.getElementById("selectedSymbash")?.value?.padStart(4, '0');
// 	const category = document.getElementById("selectedKathgoria")?.value?.padStart(4, '0');
// 	const specialty = document.getElementById("selectedEidikothta")?.value?.padStart(4, '0');
// 	const klimakioEl = document.getElementById("misthologiko_klimakio");
// 	const klimakio = klimakioEl?.value?.padStart(2, '0') || '01';
// 	const hmeromhniaEl = document.getElementById("hmeromhnia_allaghs_symbashs");
// 	const hmeromhnia = hmeromhniaEl?.value || '';

// 	try {
// 		data = await fetchApodoxesData(
// 			contract, 
// 			category, 
// 			specialty, 
// 			selectedValue.padStart(4, '0'), 
// 			klimakio, 
// 			hmeromhnia
// 		);
		
// 		if (!data.success) {
// 			showAlert({
// 				icon: 'warning',
// 				title: 'Προσοχή !!!',
// 				html: 'Δεν έχουν ενημερωθεί <strong>τα κλιμάκια</strong> της επιλεγείσας σύμβασης'
// 			});
// 			return;
// 		}

// 		const posoFieldId = `poso_symbashs_${rowIndex}`;
// 		const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${rowIndex}`;
// 		const posoField = document.getElementById(posoFieldId);

// 		if (posoField) {
// 			posoField.value = formatDecimal(data.poso, 2);
// 		}

// 		let extraApodoxes = false;
// 		updateGeneralParameters(data.genikesParametroi);
// 		updatePosoBasedOnHours(parseInt(rowIndex), data, posoBasedOnHoursFieldId, extraApodoxes);

// 		const posoValue = toDecimal(data.poso);
// 		if (!posoValue.isZero()) {
// 			calculateTotal();
// 		}

// 	} catch (error) {
// 		console.error('❌ Σφάλμα κατά την ενημέρωση αποδοχών:', error);
// 	}
// }

// function watchEidikothtaChanges() {
// 	const eidikothtaHidden = document.getElementById('eidikothta_symbashs_stathera');
// 	const eidikothtaTable = document.getElementById('eidikothta_symbashs_table');
	
// 	if (!eidikothtaHidden) {
// 		console.warn('⚠️ Δε βρέθηκε το hidden field: eidikothta_symbashs_stathera');
// 		return;
// 	}

// 	let previousValue = eidikothtaHidden.value;
// 	let previousTable = eidikothtaTable?.value || '[]';

// 	const checkChange = () => {
// 		const currentValue = eidikothtaHidden.value?.trim();
// 		const currentTable = eidikothtaTable?.value || '[]';
		
// 		const valueChanged = currentValue !== previousValue;
// 		const tableChanged = currentTable !== previousTable;

// 		if (valueChanged || tableChanged) {
// 			previousValue = currentValue;
// 			previousTable = currentTable;
		
// 			if (!currentValue) {
// 				clearAllStoixeiaRows();
// 				return;
// 			}
		
// 			clearAllStoixeiaRows();
// 			setTimeout(() => loadStoixeiaSymbaseonFromAPI(), 150);
// 		}
// 	};

// 	const observer = new MutationObserver(checkChange);
// 	observer.observe(eidikothtaHidden, { attributes: true, attributeFilter: ['value'] });

// 	if (eidikothtaTable) {
// 		const tableObserver = new MutationObserver(checkChange);
// 		tableObserver.observe(eidikothtaTable, { attributes: true, attributeFilter: ['value'] });
// 	}

// 	['change', 'input'].forEach(eventType => {
// 		eidikothtaHidden.addEventListener(eventType, checkChange);
// 		eidikothtaTable?.addEventListener(eventType, checkChange);
// 	});

// 	window.addEventListener('eidikothtaChanged', checkChange);
// }

// function clearAllStoixeiaRows() {
// 	const limit = _ARITHMOS_STOIXEION_SYMBASEON || 15;
	
// 	for (let i = 1; i <= limit; i++) {
// 		const idNum = i.toString().padStart(2, '0');
// 		const selectId = `stoixeio_symbashs_${idNum}`;
// 		const selectEl = document.getElementById(selectId);
		
// 		if (selectEl?.tomselect) {
// 			try {
// 				selectEl.tomselect.destroy();
// 			} catch (e) {
// 				console.warn(`⚠️ Failed to destroy ${selectId}:`, e);
// 			}
// 		}
		
// 		const posoField = document.getElementById(`poso_symbashs_${idNum}`);
// 		const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
// 		if (posoField) posoField.value = '';
// 		if (posoBaseiField) posoBaseiField.value = '';
		
// 		const row = document.getElementById(`row_${idNum}`);
// 		if (row) row.classList.add('d-none');
// 	}
	
// 	const synoloSymb = document.getElementById('synolo_symbashs');
// 	const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
// 	if (synoloSymb) synoloSymb.value = '0.00';
// 	if (synoloBasei) synoloBasei.value = '0.00';
// }

// window.clearStoixeiaSymbaseonContainer = function() {
// 	const limit = _ARITHMOS_STOIXEION_SYMBASEON || 15;
	
// 	for (let i = 1; i <= limit; i++) {
// 		const idNum = i.toString().padStart(2, '0');
// 		const selectId = `stoixeio_symbashs_${idNum}`;
// 		const selectEl = document.getElementById(selectId);
		
// 		if (selectEl?.tomselect) {
// 			try {
// 				selectEl.tomselect.clear();
// 				selectEl.tomselect.clearOptions();
// 				selectEl.tomselect.destroy();
// 			} catch (e) {}
// 		}
		
// 		const posoField = document.getElementById(`poso_symbashs_${idNum}`);
// 		const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
// 		if (posoField) posoField.value = '';
// 		if (posoBaseiField) posoBaseiField.value = '';
		
// 		const row = document.getElementById(`row_${idNum}`);
// 		if (row) row.classList.add('d-none');
// 	}
	
// 	const synoloSymb = document.getElementById('synolo_symbashs');
// 	const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
// 	if (synoloSymb) synoloSymb.value = '0.00';
// 	if (synoloBasei) synoloBasei.value = '0.00';
	
// 	const selectedSymbashEl = document.getElementById('selectedSymbash');
// 	const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
// 	const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
// 	if (selectedSymbashEl) selectedSymbashEl.value = '';
// 	if (selectedKathgoriaEl) selectedKathgoriaEl.value = '';
// 	if (selectedEidikothtaEl) selectedEidikothtaEl.value = '';
	
// 	const fields = [
// 		'nomimosMisthos', 'nomimoHmeromisthio', 'nomimoOromisthio',
// 		'pragmatikosMisthos', 'pragmatikoHmeromisthio', 'pragmatikoOromisthio'
// 	];
// 	fields.forEach(id => {
// 		const el = document.getElementById(id);
// 		if (el) el.value = '0.00';
// 	});
// };

// // ========================================================================
// // GLOBAL EXPORTS
// // ========================================================================

// window.loadStoixeiaSymbaseonFromAPI = loadStoixeiaSymbaseonFromAPI;
// window.calculateTotal = calculateTotal;






// addStoixeiaSymbaseon.js
// Διαχείριση Στοιχείων Σύμβασης με Tom-Select dropdowns
// Last Updated: 24/11/2025 - WITH SHARED UTILITIES

import { initTomDropdown } from '/static/js/dropdown-item.js';
import { 
	toDecimal, 
	formatDecimal, 
	showAlert,
	fetchGenikesParametroi,
	fetchApodoxesData,
	updateGeneralParameters,
	updatePosoBasedOnHours
} from 'apodoxes-calculations';  // ✅ Alias από importmap

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
// GLOBAL VARIABLES
// ========================================================================

let currentValues = {};
let data = {};

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

document.addEventListener("DOMContentLoaded", function () {
	_PLHRHS_APASXOLHSH = document.getElementById('plhrhs_apasxolhsh');
	generateSelectRowsOfSymbaseis();
	addEventListeners();
	calculateTotal();
	watchEidikothtaChanges();
});

// ========================================================================
// ΔΗΜΙΟΥΡΓΙΑ HTML ΓΙΑ ΤΑ ROWS
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
					<input type="number" class="form-control input-contents right-align clearAble addStoixSymb002" name="poso_symbashs_${idNum}" id="poso_symbashs_${idNum}" readonly />
				</div>
				<div class="col-0-5"></div>
				<div class="col-1-5">
					<input type="number" class="form-control input-contents right-align numeric clearAble addStoixSymb003" name="poso_symbashs_basei_oron_ergasias_${idNum}" 
						id="poso_symbashs_basei_oron_ergasias_${idNum}" step="0.01" />
				</div>
				<button type="button" class="btn rounded-4 col-0-3 clear-row border-0" 
					id="clearSelectSymbaseon-${idNum}" 
					data-bs-toggle="tooltip" 
					title="Καθαρισμός όλης της τρέχουσας γραμμής" 
					data-bs-placement="bottom" 
					data-target="stoixeio_symbashs_${idNum}">
					<i class="bi bi-x-lg cdarkred"></i>
				</button>
			</div>
		`;
		container.insertAdjacentHTML('beforeend', rowHTML);
	}
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
			const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${rowNum}`);
			if (posoField) posoField.value = '';
			if (posoBaseiField) posoBaseiField.value = '';
			
			calculateTotal();
		}
	});
}

function handleInputEvent(event) {
	if (event.target.type === 'number' && event.target.classList.contains('numeric')) {
		const elementId = event.target.id;
		const newValue = toDecimal(event.target.value);
		const oldValue = currentValues[elementId] ? toDecimal(currentValues[elementId]) : new Decimal(0);

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
	}
}

function formatNumericInput(input) {
	const cursorPosition = input.selectionStart;
	const originalValue = input.value;
	
	if (!originalValue) {
		input.value = '';
		return;
	}
	
	const numValue = toDecimal(originalValue);
	const newValue = formatDecimal(numValue, 2);

	if (newValue !== originalValue) {
		input.value = newValue;
		const diff = newValue.length - originalValue.length;
		const newPos = Math.max(0, cursorPosition + diff);
		input.setSelectionRange(newPos, newPos);
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
	
	const nomimosMisthos = document.getElementById('nomimosMisthos');
	const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
	const nomimoOromisthio = document.getElementById('nomimoOromisthio');
	const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
	const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
	const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');
	
	const ores_ergasias_ebdomadas = toDecimal(document.getElementById("ores_ergasias_ebdomadas")?.value);
	const hmeres_ergasias_ebdomadas = toDecimal(document.getElementById("hmeres_ergasias_ebdomadas")?.value);

	for (let i = 1; i <= (_ARITHMOS_STOIXEION_SYMBASEON || 15); i++) {
		const idNum = i.toString().padStart(2, '0');
		const posoInput = document.getElementById(`poso_symbashs_${idNum}`);
		const posoInputBaseiOron = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
		
		const posoValue = toDecimal(posoInput?.value);
		const posoBaseiValue = toDecimal(posoInputBaseiOron?.value);
		
		totalSymbashs = totalSymbashs.plus(posoValue);
		totalBaseiOronErgasias = totalBaseiOronErgasias.plus(posoBaseiValue);
		
		if (!posoBaseiValue.isZero() && posoValue.isZero()) {
			_TOTAL_EXTRA_APODOXES = _TOTAL_EXTRA_APODOXES.plus(posoBaseiValue);
		}
	}

	document.getElementById('synolo_symbashs').value = formatDecimal(totalSymbashs, 2);
	document.getElementById('synolo_symbashs_basei_oron_ergasias').value = formatDecimal(totalBaseiOronErgasias, 2);
	
	const typosErg = document.getElementById('typos_ergazomenon')?.value;
	const eidKath = document.getElementById('eidikh_kathgoria_ergazomenoy')?.value;
	
	if (_PLHRHS_APASXOLHSH && _PLHRHS_APASXOLHSH.checked) {
		calculateFullTimeWages(typosErg, eidKath, ores_ergasias_ebdomadas, hmeres_ergasias_ebdomadas);
	} else {
		calculatePartTimeWages(typosErg, eidKath, ores_ergasias_ebdomadas, hmeres_ergasias_ebdomadas);
	}
	
	setupAutomaticRecalculation();
}

function calculateFullTimeWages(typosErg, eidKath, ores, hmeres) {
	const nomimosMisthos = document.getElementById('nomimosMisthos');
	const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
	const nomimoOromisthio = document.getElementById('nomimoOromisthio');
	const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
	const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
	const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');

	switch (typosErg) {
		case "Ω":
			if (eidKath === "0001") {
				_NOMIMO_OROMISTHIO = new Decimal(6)
					.div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
					.div(25)
					.times(totalSymbashs);
				
				_PRAGMATIKO_OROMISTHIO = new Decimal(6)
					.div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
					.div(25)
					.times(totalBaseiOronErgasias);
				
				nomimosMisthos.value = formatDecimal(
					_NOMIMO_OROMISTHIO.times(ores).times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON)),
					2
				);
				nomimoHmeromisthio.value = formatDecimal(
					_NOMIMO_OROMISTHIO.times(ores).div(hmeres),
					2
				);
				nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
				
				pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);
				pragmatikoHmeromisthio.value = formatDecimal(
					_PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres),
					2
				);
				pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
			}
			break;
			
		case "Μ":
			_NOMIMO_OROMISTHIO = totalSymbashs.div(toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS));
			_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS));
			
			nomimosMisthos.value = formatDecimal(
				_NOMIMO_OROMISTHIO.times(ores).times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON)),
				2
			);
			nomimoHmeromisthio.value = formatDecimal(
				_NOMIMO_OROMISTHIO.times(toDecimal(window._ORES_HMERHSIAS_ERGASIAS)),
				2
			);
			nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
			
			pragmatikosMisthos.value = formatDecimal(
				_PRAGMATIKO_OROMISTHIO.times(ores).times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON)),
				2
			);
			pragmatikoHmeromisthio.value = formatDecimal(
				_PRAGMATIKO_OROMISTHIO.times(toDecimal(window._ORES_HMERHSIAS_ERGASIAS)),
				2
			);
			pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
			break;
			
		case "Η":
			_NOMIMO_OROMISTHIO = totalSymbashs.times(toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO));
			_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
				ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION))
			);
			
			nomimosMisthos.value = formatDecimal(
				_NOMIMO_OROMISTHIO.times(ores).times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION)),
				2
			);
			nomimoHmeromisthio.value = formatDecimal(
				_NOMIMO_OROMISTHIO.times(toDecimal(window._ORES_HMERHSIAS_ERGASIAS)),
				2
			);
			nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
			pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

			if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
				pragmatikoHmeromisthio.value = formatDecimal(
					_PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres),
					2
				);
			} else {
				pragmatikoHmeromisthio.value = "0.00";
			}
			pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
			break;
	}
}

function calculatePartTimeWages(typosErg, eidKath, ores, hmeres) {
	const nomimosMisthos = document.getElementById('nomimosMisthos');
	const nomimoHmeromisthio = document.getElementById('nomimoHmeromisthio');
	const nomimoOromisthio = document.getElementById('nomimoOromisthio');
	const pragmatikosMisthos = document.getElementById('pragmatikosMisthos');
	const pragmatikoHmeromisthio = document.getElementById('pragmatikoHmeromisthio');
	const pragmatikoOromisthio = document.getElementById('pragmatikoOromisthio');

	const _ores_apasxolhshs = ores.div(hmeres);

	switch (typosErg) {
		case "Ω":
			if (eidKath === "0001") {
				_NOMIMO_OROMISTHIO = new Decimal(6)
					.div(toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS))
					.div(25)
					.times(totalSymbashs);
				
				_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
					ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON))
				);

				nomimosMisthos.value = formatDecimal(
					_NOMIMO_OROMISTHIO.times(ores).times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON)),
					2
				);
				nomimoHmeromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO.times(_ores_apasxolhshs), 2);
				nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);

				pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

				if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
					pragmatikoHmeromisthio.value = formatDecimal(
						_PRAGMATIKO_OROMISTHIO.times(ores).div(hmeres),
						2
					);
				} else {
					pragmatikoHmeromisthio.value = "0.00";
				}
				pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
			}
			break;
			
		case "Μ":
			_NOMIMO_OROMISTHIO = totalSymbashs.div(toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS));
			_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
				ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON))
			);
			
			nomimosMisthos.value = formatDecimal(
				_NOMIMO_OROMISTHIO.times(ores).times(toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON)),
				2
			);
			nomimoHmeromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO.times(_ores_apasxolhshs), 2);
			nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
			pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

			if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
				pragmatikoHmeromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs), 2);
			} else {
				pragmatikoHmeromisthio.value = "0.00";
			}
			pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
			break;
			
		case "Η":
			_NOMIMO_OROMISTHIO = totalSymbashs.times(toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO));
			_PRAGMATIKO_OROMISTHIO = totalBaseiOronErgasias.div(
				ores.times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION))
			);
		
			nomimosMisthos.value = formatDecimal(
				_NOMIMO_OROMISTHIO.times(ores).times(toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION)),
				2
			);
			nomimoHmeromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO.times(_ores_apasxolhshs), 2);
			nomimoOromisthio.value = formatDecimal(_NOMIMO_OROMISTHIO, 2);
			pragmatikosMisthos.value = formatDecimal(totalBaseiOronErgasias, 2);

			if (!ores.isZero() && !hmeres.isZero() && !_PRAGMATIKO_OROMISTHIO.isZero()) {
				pragmatikoHmeromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO.times(_ores_apasxolhshs), 2);
			} else {
				pragmatikoHmeromisthio.value = "0.00";
			}
			pragmatikoOromisthio.value = formatDecimal(_PRAGMATIKO_OROMISTHIO, 2);
			break;
	}
}

function setupAutomaticRecalculation() {
	const pragmatikoOromisthioEl = document.getElementById('pragmatikoOromisthio');
	if (!pragmatikoOromisthioEl) return;
	
	const pragmatikoOromisthio = pragmatikoOromisthioEl.value;
	const oromisthioValue = toDecimal(pragmatikoOromisthio);
	const isOromisthioValid = pragmatikoOromisthio && !oromisthioValue.isNaN() && !oromisthioValue.isZero();

	if (isOromisthioValid) {
		const ids = ['hmeromhnia_allaghs_symbashs', 'proyphresia_se_eth', 'proyphresia_se_mhnes',
		'eidikh_kathgoria_ergazomenoy', 'plhrhs_apasxolhsh', 'hmeres_ergasias_ebdomadas', 
		'ores_ergasias_ebdomadas', 'typos_ergazomenon', 'misthologiko_klimakio'];

		ids.forEach(id => {
			const element = document.getElementById(id);
			if (element && !element.__recalcBound) {
				element.__recalcBound = true;
				element.addEventListener('change', () => {
					if (typeof window.reCalculate === 'function') window.reCalculate();
					else calculateTotal();
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

		const selectedSymbashEl = document.getElementById('selectedSymbash');
		const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
		const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
		
		if (selectedSymbashEl) selectedSymbashEl.value = symbash.padStart(4, '0');
		if (selectedKathgoriaEl) selectedKathgoriaEl.value = kathgoria.padStart(4, '0');
		if (selectedEidikothtaEl) selectedEidikothtaEl.value = eidikothta.padStart(4, '0');

		const genikesParametroi = await fetchGenikesParametroi();
		updateGeneralParameters(genikesParametroi);

		// Ενημέρωση global για χρήση στο shared module
		window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = toDecimal(genikesParametroi[0]?.timh);
		window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = toDecimal(genikesParametroi[1]?.timh);
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
		console.error('❌ initTomDropdown not available! Make sure dropdown-item.js is loaded first.');
		return;
	}

	let aa_stoixeion_symbaseon = (_ARITHMOS_STOIXEION_SYMBASEON !== 0) ? _ARITHMOS_STOIXEION_SYMBASEON : 15;

	for (let i = 1; i <= aa_stoixeion_symbaseon; i++) {
		const idNum = i.toString().padStart(2, '0');
		const selectId = `stoixeio_symbashs_${idNum}`;
		const rowId = `row_${idNum}`;
		const selectEl = document.getElementById(selectId);
		const row = document.getElementById(rowId);
		
		if (selectEl?.tomselect) {
			try {
				selectEl.tomselect.destroy();
			} catch (e) {
				console.warn(`⚠️ Failed to destroy ${selectId}:`, e);
			}
		}
		
		if (row) row.classList.add('d-none');
	}

	const numRows = Math.min(items.length, aa_stoixeion_symbaseon);

	const symbashVal = (document.getElementById('symbash_stathera')?.value || '').trim().padStart(4, '0');
	const kathgoriaVal = (document.getElementById('kathgoria_symbashs_stathera')?.value || '').trim().padStart(4, '0');
	const eidikothtaVal = (document.getElementById('eidikothta_symbashs_stathera')?.value || '').trim().padStart(4, '0');

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
					onInitialize: function() {
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

	const contract = document.getElementById("selectedSymbash")?.value?.padStart(4, '0');
	const category = document.getElementById("selectedKathgoria")?.value?.padStart(4, '0');
	const specialty = document.getElementById("selectedEidikothta")?.value?.padStart(4, '0');
	const klimakioEl = document.getElementById("misthologiko_klimakio");
	const klimakio = klimakioEl?.value?.padStart(2, '0') || '01';
	const hmeromhniaEl = document.getElementById("hmeromhnia_allaghs_symbashs");
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

	['change', 'input'].forEach(eventType => {
		eidikothtaHidden.addEventListener(eventType, checkChange);
		eidikothtaTable?.addEventListener(eventType, checkChange);
	});

	window.addEventListener('eidikothtaChanged', checkChange);
}

function clearAllStoixeiaRows() {
	const limit = _ARITHMOS_STOIXEION_SYMBASEON || 15;
	
	for (let i = 1; i <= limit; i++) {
		const idNum = i.toString().padStart(2, '0');
		const selectId = `stoixeio_symbashs_${idNum}`;
		const selectEl = document.getElementById(selectId);
		
		if (selectEl?.tomselect) {
			try {
				selectEl.tomselect.destroy();
			} catch (e) {
				console.warn(`⚠️ Failed to destroy ${selectId}:`, e);
			}
		}
		
		const posoField = document.getElementById(`poso_symbashs_${idNum}`);
		const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
		if (posoField) posoField.value = '';
		if (posoBaseiField) posoBaseiField.value = '';
		
		const row = document.getElementById(`row_${idNum}`);
		if (row) row.classList.add('d-none');
	}
	
	const synoloSymb = document.getElementById('synolo_symbashs');
	const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
	if (synoloSymb) synoloSymb.value = '0.00';
	if (synoloBasei) synoloBasei.value = '0.00';
}

window.clearStoixeiaSymbaseonContainer = function() {
	const limit = _ARITHMOS_STOIXEION_SYMBASEON || 15;
	
	for (let i = 1; i <= limit; i++) {
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
		const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
		if (posoField) posoField.value = '';
		if (posoBaseiField) posoBaseiField.value = '';
		
		const row = document.getElementById(`row_${idNum}`);
		if (row) row.classList.add('d-none');
	}
	
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
		'nomimosMisthos', 'nomimoHmeromisthio', 'nomimoOromisthio',
		'pragmatikosMisthos', 'pragmatikoHmeromisthio', 'pragmatikoOromisthio'
	];
	fields.forEach(id => {
		const el = document.getElementById(id);
		if (el) el.value = '0.00';
	});
};

// ========================================================================
// GLOBAL EXPORTS
// ========================================================================

window.loadStoixeiaSymbaseonFromAPI = loadStoixeiaSymbaseonFromAPI;
window.calculateTotal = calculateTotal;
