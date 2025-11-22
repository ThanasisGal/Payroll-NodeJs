// addStoixeiaSymbaseon.js
// Διαχείριση Στοιχείων Σύμβασης με Tom-Select dropdowns (FIXED)
// Last Updated: 2025-11-21

import { initTomDropdown } from '/static/js/dropdown-item.js';

let currentValues = {};
let data = {};

let _AA_STOIXEIOY = 0,
    _APODOXES = 0, 
    _HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = 0, 
    _HMEROMISTHIO = 0,
    _MISTHOS = 0,
    _NOMIMO_OROMISTHIO = 0, 
    _PLHRHS_APASXOLHSH, 
    _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = 0,
    _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = 0, 
    _ORES_HMERHSIAS_ERGASIAS = 0, 
    _PRAGMATIKO_OROMISTHIO = 0,
    _PRAGMATIKOS_MISTHOS = 0,
    _SYNTELESTHS_EBDOMADON_HMEROMISTHION = 0, 
    _SYNTELESTHS_EBDOMADON_MISTHOTON = 0, 
    _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = 0, 
    totalSymbashs = 0,
    totalBaseiOronErgasias = 0,
    _TOTAL_EXTRA_APODOXES = 0;

// ========================================================================
// ΑΡΧΙΚΟΠΟΙΗΣΗ
// ========================================================================

document.addEventListener("DOMContentLoaded", function () {
	_PLHRHS_APASXOLHSH = document.getElementById('plhrhs_apasxolhsh');
	generateSelectRowsOfSymbaseis();
	addEventListeners();
	calculateTotal();
	
	// Παρακολούθηση αλλαγών στην Ειδικότητα
	watchEidikothtaChanges();
});

// ========================================================================
// ΔΗΜΙΟΥΡΓΙΑ HTML ΓΙΑ ΤΑ ROWS (μέχρι 15, αλλά κρυφά αρχικά)
// ========================================================================

function generateSelectRowsOfSymbaseis() {
	const container = document.getElementById('stoixeiaSymbaseonContainer');
	if (!container) {
		console.warn('⚠️ Container stoixeiaSymbaseonContainer not found');
		return;
	}
	
	container.innerHTML = ''; 

	// Δημιουργία μέχρι 15 rows (όλα d-none αρχικά)
	for (let i = 1; i <= 15; i++) {
		const idNum = i.toString().padStart(2, '0');
		const rowHTML = `
			<div class="row form-group align-items-center d-none showhide_row_${idNum} addStoixSymb001" id="row_${idNum}">
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
					<input type="text" class="form-control input-contents right-align numeric clearAble addStoixSymb003" name="poso_symbashs_basei_oron_ergasias_${idNum}" 
						id="poso_symbashs_basei_oron_ergasias_${idNum}" />
				</div>
				<button type="button" class="btn rounded-4 mt-2 col-0-3 clear-row border-0" 
					id="clearSelectSymbaseon-${idNum}" 
					data-bs-toggle="tooltip" 
					title="Καθαρισμός του πεδίου Στοιχείο Σύμβασης" 
					data-bs-placement="bottom" 
					data-target="stoixeio_symbashs_${idNum}">
					<i class="bi bi-trash cred"></i>
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

	// Event delegation για τα trash buttons
	container.addEventListener('click', (e) => {
		const trashBtn = e.target.closest('.clear-row');
		if (trashBtn) {
			const targetId = trashBtn.dataset.target;
			const selectEl = document.getElementById(targetId);
			if (selectEl && selectEl.tomselect) {
				selectEl.tomselect.clear();
				selectEl.tomselect.clearOptions();
			}
			
			// Καθαρισμός των ποσών
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
	if (event.target.type === 'text' && event.target.classList.contains('numeric')) {
		const elementId = event.target.id;
		const newValue = parseFloat(event.target.value) || 0;
		const oldValue = currentValues[elementId] || 0;

		_TOTAL_EXTRA_APODOXES += newValue - oldValue;
		currentValues[elementId] = newValue;

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
	const numValue = parseFloat(originalValue);
	
	if (isNaN(numValue)) {
		input.value = '';
		return;
	}
	
	const newValue = numValue.toFixed(2);

	if (newValue !== originalValue) {
		input.value = newValue;
		const diff = newValue.length - originalValue.length;
		const newPos = Math.max(0, cursorPosition + diff);
		input.setSelectionRange(newPos, newPos);
	}
}

// ========================================================================
// API CALLS
// ========================================================================

async function fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, date) {

	try {
		// 🔑 Παίρνουμε το CSRF token
		const csrfToken = window.getCSRFToken();
		
		if (!csrfToken) {
		console.error('❌ CSRF token not found!');
		throw new Error('CSRF token missing. Please refresh the page.');
		}

		// 🆕 Το CSRF token πάει ΚΑΙ στα headers ΚΑΙ στο body
		const response = await fetch('/api/apodoxesErgazomenon', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'CSRF-Token': csrfToken,      // ← Header
				'X-CSRF-Token': csrfToken      // ← Alternative header
			},
			credentials: 'include',
			body: JSON.stringify({
				contract,
				category,
				specialty,
				selectedElement,
				klimakio,
				date,
				_csrf: csrfToken               // ← Body field (το πιο σημαντικό!)
			})
		});

		if (!response.ok) {
			const text = await response.text();
			console.error('❌ API Error Response:', text.substring(0, 300));
			
			if (response.status === 403) {
				throw new Error('CSRF validation failed. Please refresh the page and try again.');
			}
			
			throw new Error(`API Error: ${response.status} ${response.statusText}`);
		}

		const contentType = response.headers.get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			const text = await response.text();
			console.error('❌ Non-JSON Response:', text.substring(0, 300));
			throw new Error('Server returned HTML instead of JSON');
		}

		const data = await response.json();
		
		return data;

	} catch (error) {
		console.error('❌ Fetch Error:', error);
		throw error;
	}
}

// ========================================================================
// ΥΠΟΛΟΓΙΣΜΟΙ ΑΠΟΔΟΧΩΝ (κρατάω μόνο τις signatures για συντομία)
// ========================================================================

function updateGeneralParameters(parameters) {
	if (!parameters || !Array.isArray(parameters)) return;
	
	_ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = parseFloat(parameters[0]?.timh || 0);
	_SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = parseFloat(parameters[1]?.timh || 0);
	_SYNTELESTHS_EBDOMADON_MISTHOTON = parseFloat(parameters[2]?.timh || 0);
	_SYNTELESTHS_EBDOMADON_HMEROMISTHION = parseFloat(parameters[3]?.timh || 0);
	_ORES_HMERHSIAS_ERGASIAS = parseFloat(parameters[4]?.timh || 0);
	_HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = parseFloat(parameters[5]?.timh || 0);
	
	const eidKathEl = document.getElementById("eidikhKathgoriaErgazomenoy");
	_ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = parseFloat(eidKathEl?.value || 0);
}

function updatePosoBasedOnHours(i, data, posoBasedOnHoursFieldId, extraApodoxes) {
	const typeEl = document.getElementById('typos_ergazomenon');
	if (!typeEl) return;
	
	const type = typeEl.value;
	const posoBasedOnHoursField = document.getElementById(posoBasedOnHoursFieldId);
	
	const oresEl = document.getElementById("ores_ergasias_ebdomadas");
	const hmeresEl = document.getElementById("hmeres_ergasias_ebdomadas");
	
	const hours = parseFloat(oresEl?.value || 0);
	const days = parseFloat(hmeresEl?.value || 0);

	let calculatedValue = calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes);

	if (isNaN(calculatedValue)) {
		alert("Δεν είναι εφικτός ο υπολογισμός των αποδοχών βάσει των ωρών εργασίας γιατί δεν έχετε επιλέξει ΤΥΠΟ ΕΡΓΑΖΟΜΕΝΟΥ στην καρτέλλα Σταθερά Στοιχεία");
		if (posoBasedOnHoursField) posoBasedOnHoursField.value = "0.00";
	} else {
		if (posoBasedOnHoursField) posoBasedOnHoursField.value = parseFloat(calculatedValue).toFixed(2);
	}
}

function calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes) {
	let value = 0;

	if (_PLHRHS_APASXOLHSH && _PLHRHS_APASXOLHSH.checked) {
		switch (type) {
			case "Μ": value = data.poso; break;
			case "Η": value = calculateMonthlyWage(data, hours, days, true, type, extraApodoxes); break;
			case "Ω": value = calculateHourlyWage(data, hours, days, true, extraApodoxes); break;
			default: value = NaN;
		}
	} else {
		switch (type) {
			case "Μ": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
			case "Η": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
			case "Ω": value = calculateHourlyWage(data, hours, days, false, extraApodoxes); break;
			default: value = NaN;
		}
	}

	return value;
}

function calculateHourlyWage(data, hours, days, fullTime, extraApodoxes) {
	let value = 0;
	const eidKathEl = document.getElementById('eidikh_kathgoria_ergazomenoy');
	if (!eidKathEl) return value;

	switch (eidKathEl.value) {
		case "0001": // ΚΑΘΗΓΗΤΕΣ ΦΡΟΝΤΙΣΤΗΡΙΩΝ
		if (parseFloat(data.poso) !== 0) {
			if (!extraApodoxes) {
				_NOMIMO_OROMISTHIO = ((6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS) / 25) * parseFloat(data.poso);
				if (fullTime) {
					value = _NOMIMO_OROMISTHIO * hours * _SYNTELESTHS_EBDOMADON_MISTHOTON;
				} else {
					_PRAGMATIKO_OROMISTHIO = ((6 / _ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS) / 25) * parseFloat(data.poso);
					value = _PRAGMATIKO_OROMISTHIO * hours * _SYNTELESTHS_EBDOMADON_MISTHOTON;
				}
			} else {
				value = parseFloat(data.poso);
			}
		}
		break;
			default:
			value = NaN;
	}
	return value;
}

function calculateMonthlyWage(data, hours, days, fullTime, type, extraApodoxes) {
	let value = 0;
	if (parseFloat(data.poso) !== 0) {
		if (!extraApodoxes) {
			_NOMIMO_OROMISTHIO = (type === "Μ") 
				? parseFloat(data.poso) / _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS 
				: parseFloat(data.poso) * _SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO;
			_PRAGMATIKO_OROMISTHIO = _NOMIMO_OROMISTHIO;
			value = _PRAGMATIKO_OROMISTHIO * hours * (type === "Μ" ? _SYNTELESTHS_EBDOMADON_MISTHOTON : _SYNTELESTHS_EBDOMADON_HMEROMISTHION);
		} else {
			value = parseFloat(data.poso);
		}
	}  
	return value;
}

async function calculateTotal() {
	totalSymbashs = 0;
	totalBaseiOronErgasias = 0;
	_TOTAL_EXTRA_APODOXES = 0;
	_PRAGMATIKO_OROMISTHIO = 0;
	
	for (let i = 1; i <= 15; i++) {
		const idNum = i.toString().padStart(2, '0');
		const posoInput = document.getElementById(`poso_symbashs_${idNum}`);
		const posoInputBaseiOron = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
		
		totalSymbashs += parseFloat(posoInput?.value || 0);
		totalBaseiOronErgasias += parseFloat(posoInputBaseiOron?.value || 0);
		
		if (parseFloat(posoInputBaseiOron?.value || 0) !== 0 && parseFloat(posoInput?.value || 0) === 0) {
			_TOTAL_EXTRA_APODOXES += parseFloat(posoInputBaseiOron?.value || 0);
		}
	}

	const synoloSymb = document.getElementById('synolo_symbashs');
	const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
	
	if (synoloSymb) synoloSymb.value = totalSymbashs.toFixed(2);
	if (synoloBasei) synoloBasei.value = totalBaseiOronErgasias.toFixed(2);
	
	// Υπόλοιπος κώδικας υπολογισμών...
	setupAutomaticRecalculation();
}

function setupAutomaticRecalculation() {
	const pragmatikoOromisthioEl = document.getElementById('pragmatikoOromisthio');
	if (!pragmatikoOromisthioEl) return;
	
	const pragmatikoOromisthio = pragmatikoOromisthioEl.value;
	const isOromisthioValid = pragmatikoOromisthio && !isNaN(pragmatikoOromisthio) && parseFloat(pragmatikoOromisthio) !== 0;

	if (isOromisthioValid) {
		const ids = ['hmeromhnia_allaghs_symbashs', 'proyphresia_se_eth', 'proyphresia_se_mhnes',
		'eidikh_kathgoria_ergazomenoy', 'plhrhs_apasxolhsh', 'hmeres_ergasias_ebdomadas', 
		'ores_ergasias_ebdomadas', 'typos_ergazomenon', 'misthologiko_klimakio'];

		ids.forEach(id => {
			const element = document.getElementById(id);
			if (element && !element.__recalcBound) {
				element.__recalcBound = true;
				element.addEventListener('change', () => {
				if (typeof reCalculate === 'function') reCalculate();
				else calculateTotal();
				});
			}
		});
	}
}

// ========================================================================
// 🆕 TOM-SELECT ΓΙΑ ΣΤΟΙΧΕΙΑ ΣΥΜΒΑΣΗΣ (FIXED - με API fetch)
// ========================================================================

/**
 * Φορτώνει τα διαθέσιμα "Στοιχεία Σύμβασης" από το API
 * και αρχικοποιεί ΜΟΝΟ τα απαραίτητα Tom-Select dropdowns
 */
async function loadStoixeiaSymbaseonFromAPI() {
	try {
		const symbash = document.getElementById('symbash_stathera')?.value?.trim();
		const kathgoria = document.getElementById('kathgoria_symbashs_stathera')?.value?.trim();
		const eidikothta = document.getElementById('eidikothta_symbashs_stathera')?.value?.trim();

		if (!symbash || !kathgoria || !eidikothta) {
			console.warn('⚠️ Λείπουν Σύμβαση/Κατηγορία/Ειδικότητα');
			return;
		}

		// 🆕 Πρώτα κάνουμε fetch για να δούμε πόσα items υπάρχουν
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
			console.warn('⚠️ Δεν βρέθηκαν Στοιχεία Σύμβασης για αυτή την Ειδικότητα');
			alert('Δεν υπάρχουν διαθέσιμα Στοιχεία Σύμβασης για την επιλεγμένη Ειδικότητα.');
			return;
		}

		// Ενημέρωση των "selected" hidden fields
		const selectedSymbashEl = document.getElementById('selectedSymbash');
		const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
		const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
		
		if (selectedSymbashEl) selectedSymbashEl.value = symbash.padStart(4, '0');
		if (selectedKathgoriaEl) selectedKathgoriaEl.value = kathgoria.padStart(4, '0');
		if (selectedEidikothtaEl) selectedEidikothtaEl.value = eidikothta.padStart(4, '0');

		// Αρχικοποίηση των Tom-Select dropdowns με τα items
		await initializeTomSelectForStoixeia(items);
		
	} catch (error) {
		console.error('❌ Σφάλμα κατά τη φόρτωση Στοιχείων Σύμβασης:', error);
		alert(`Σφάλμα: ${error.message}`);
	}
}

/**
 * Αρχικοποιεί Tom-Select για τα dropdowns Στοιχείων Σύμβασης
 * Εμφανίζει ΜΟΝΟ όσα rows χρειάζονται (δυναμικά)
 */
async function initializeTomSelectForStoixeia(items) {
	if (!initTomDropdown) {
		console.error('❌ initTomDropdown not available! Make sure dropdown-item.js is loaded first.');
		return;
	}

	// Καταστροφή ΟΛΩΝ των παλιών instances (1-15)
	for (let i = 1; i <= 15; i++) {
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

	const numRows = Math.min(items.length, 15);

	// Παίρνουμε τις τιμές ΜΙΑ ΦΟΡΑ
	const symbashVal = (document.getElementById('symbash_stathera')?.value || '').trim().padStart(4, '0');
	const kathgoriaVal = (document.getElementById('kathgoria_symbashs_stathera')?.value || '').trim().padStart(4, '0');
	const eidikothtaVal = (document.getElementById('eidikothta_symbashs_stathera')?.value || '').trim().padStart(4, '0');

	// Αρχικοποίηση ΜΟΝΟ των απαραίτητων rows
	for (let i = 1; i <= numRows; i++) {
		const idNum = i.toString().padStart(2, '0');
		const selectId = `stoixeio_symbashs_${idNum}`;
		const rowId = `row_${idNum}`;
		
		const row = document.getElementById(rowId);
		const selectEl = document.getElementById(selectId);

		if (!row || !selectEl) continue;

		// Εμφάνιση του row
		row.classList.remove('d-none');

		// ✅ Χρήση του initTomDropdown με extraParams
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
						
						// Handler για αλλαγή
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

/**
 * Handler για αλλαγή σε ένα Στοιχείο Σύμβασης
 */
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
			alert('Δεν έχουν ενημερωθεί τα κλιμάκια της επιλεγείσας σύμβασης');
			return;
		}

		const posoFieldId = `poso_symbashs_${rowIndex}`;
		const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${rowIndex}`;
		const posoField = document.getElementById(posoFieldId);

		if (posoField) {
			posoField.value = data.poso || '0.00';
		}

		let extraApodoxes = false;
		updateGeneralParameters(data.genikesParametroi);
		updatePosoBasedOnHours(parseInt(rowIndex), data, posoBasedOnHoursFieldId, extraApodoxes);

		if (parseFloat(data.poso) !== 0) {
			calculateTotal();
		}

	} catch (error) {
		console.error('❌ Σφάλμα κατά την ενημέρωση αποδοχών:', error);
	}
}

/**
 * Παρακολούθηση αλλαγών στην Ειδικότητα
 * ✅ Reload ακόμα και μετά από clear
 */
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

		// 🆕 Trigger load ΚΑΙ όταν γεμίζει (από empty → value)
		if (valueChanged || tableChanged) {
			previousValue = currentValue;
			previousTable = currentTable;
		
			// 🆕 Καθαρισμός ΚΑΙ όταν γίνεται empty
			if (!currentValue) {
				clearAllStoixeiaRows();
				return;
			}
		
			// Καθαρισμός των παλιών Tom-Select instances
			clearAllStoixeiaRows();
		
			// Φόρτωση νέων
			setTimeout(() => loadStoixeiaSymbaseonFromAPI(), 150);
		}
	};

	// MutationObserver
	const observer = new MutationObserver(checkChange);
	observer.observe(eidikothtaHidden, { attributes: true, attributeFilter: ['value'] });

	if (eidikothtaTable) {
		const tableObserver = new MutationObserver(checkChange);
		tableObserver.observe(eidikothtaTable, { attributes: true, attributeFilter: ['value'] });
	}

	// Event listeners
	['change', 'input'].forEach(eventType => {
		eidikothtaHidden.addEventListener(eventType, checkChange);
		eidikothtaTable?.addEventListener(eventType, checkChange);
	});

	// Custom event
	window.addEventListener('eidikothtaChanged', checkChange);
}

/**
 * Καθαρίζει όλα τα rows (helper για reload)
 */
function clearAllStoixeiaRows() {
	for (let i = 1; i <= 15; i++) {
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
		
		// Καθαρισμός πεδίων ποσών
		const posoField = document.getElementById(`poso_symbashs_${idNum}`);
		const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
		if (posoField) posoField.value = '';
		if (posoBaseiField) posoBaseiField.value = '';
		
		// Απόκρυψη row
		const row = document.getElementById(`row_${idNum}`);
		if (row) row.classList.add('d-none');
	}
	
	// Καθαρισμός συνόλων
	const synoloSymb = document.getElementById('synolo_symbashs');
	const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
	if (synoloSymb) synoloSymb.value = '0.00';
	if (synoloBasei) synoloBasei.value = '0.00';

}

/**
 * Καθαρίζει όλο το container των Στοιχείων Σύμβασης
 * (exposed globally για χρήση από symbaseisDropdownChain3.js)
 */
window.clearStoixeiaSymbaseonContainer = function() {
	// Καθαρισμός όλων των Tom-Select instances
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
		
		// Καθαρισμός πεδίων ποσών
		const posoField = document.getElementById(`poso_symbashs_${idNum}`);
		const posoBaseiField = document.getElementById(`poso_symbashs_basei_oron_ergasias_${idNum}`);
		if (posoField) posoField.value = '';
		if (posoBaseiField) posoBaseiField.value = '';
		
		// Απόκρυψη row
		const row = document.getElementById(`row_${idNum}`);
		if (row) row.classList.add('d-none');
	}
	
	// Καθαρισμός συνόλων
	const synoloSymb = document.getElementById('synolo_symbashs');
	const synoloBasei = document.getElementById('synolo_symbashs_basei_oron_ergasias');
	if (synoloSymb) synoloSymb.value = '0.00';
	if (synoloBasei) synoloBasei.value = '0.00';
	
	// Καθαρισμός hidden fields
	const selectedSymbashEl = document.getElementById('selectedSymbash');
	const selectedKathgoriaEl = document.getElementById('selectedKathgoria');
	const selectedEidikothtaEl = document.getElementById('selectedEidikothta');
	if (selectedSymbashEl) selectedSymbashEl.value = '';
	if (selectedKathgoriaEl) selectedKathgoriaEl.value = '';
	if (selectedEidikothtaEl) selectedEidikothtaEl.value = '';
	
	// Καθαρισμός και των υπολογισμών μισθών/ωρομισθίων
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
