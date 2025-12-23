// /public/js/ergazomenoi/genika/date_sync_add.js

document.addEventListener('DOMContentLoaded', function() {
	const proslhpshsInput = document.getElementById('hmeromhnia_proslhpshs');
	const allaghsSymbashsInput = document.getElementById('hmeromhnia_allaghs_symbashs');
	const lhxhsSymbashsInput = document.getElementById('hmeromhnia_lhxhs_symbashs');
	const orarioyApoInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
	const orarioyEosInput = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

	// Event listeners
	proslhpshsInput.addEventListener('blur', handleProslhpshChange);
	allaghsSymbashsInput.addEventListener('change', handleAllaghsChange);
	allaghsSymbashsInput.addEventListener('blur', handleAllaghsChange);
	
	orarioyApoInput.addEventListener('change', handleOrarioyApoChange);
	orarioyApoInput.addEventListener('blur', handleOrarioyApoChange);
	orarioyApoInput.addEventListener('input', handleOrarioyApoChange);
	
	orarioyEosInput.addEventListener('blur', handleOrarioyEosChange);

	// ✅ ΝΕΟΣ EVENT LISTENER:  Όταν αλλάξει η λήξη σύμβασης
	if (lhxhsSymbashsInput) {
		lhxhsSymbashsInput.addEventListener('change', handleLhxhsChange);
		lhxhsSymbashsInput.addEventListener('blur', handleLhxhsChange);
	}

	// Tab navigation για date/time inputs
	document.querySelectorAll('input[type="date"], input[type="time"]').forEach(input => {
		input. addEventListener('keydown', function(event) {
			if (event.key === 'Tab') {
				event.preventDefault();
				const formElements = Array.from(document.querySelectorAll('input, select, textarea, button'));
				const index = formElements.indexOf(this);
				const nextInput = formElements[index + 1];
				if (nextInput) {
					setTimeout(() => nextInput.focus(), 0);
				}
			}
		});
	});

	// =========================================================================
	// HANDLERS
	// =========================================================================

	async function handleProslhpshChange() {
		setAllDates(this. value);
		await updateOrarioyEosDate(this. value);
	}

	function handleAllaghsChange() {
		setAllDates(this.value);
	}

	async function handleOrarioyApoChange() {
		await updateOrarioyEosDate(this.value);
	}

	/**
	 * ✅ ΝΕΟΣ HANDLER:  Όταν αλλάξει η λήξη σύμβασης
	 */
	async function handleLhxhsChange() {
		// Re-calculate eos date με τους νέους περιορισμούς
		const apoDate = orarioyApoInput.value;
		if (apoDate) {
			await updateOrarioyEosDate(apoDate);
		}
	}

	async function handleOrarioyEosChange() {
		const eosDate = this.value;
		const apoDate = orarioyApoInput.value;
		
		let isValidDateChange = await validateDateChange(apoDate, eosDate);
		
		if (eosDate === "") {
			isValidDateChange = false;
		}

		if (! isValidDateChange) {
			// Reset to default (apo + 7 days με caps)
			await updateOrarioyEosDate(apoDate);
			return;
		}

		// Update difference calculation
		const startDate = document.getElementById('hmeromhnia_allaghs_orarioy_apo').value;
		const endDate = this.value;
		await updateDateDifference(startDate, endDate);
	}

	// =========================================================================
	// CORE FUNCTIONS
	// =========================================================================

	function setAllDates(value) {
		allaghsSymbashsInput.value = value;
		orarioyApoInput.value = value;
		// Also trigger update for eos date
		updateOrarioyEosDate(value);
	}

	/**
	 * ✅ ΔΙΟΡΘΩΣΗ: Υπολογισμός ΕΩΣ = ΑΠΟ + 7 ημέρες
	 * ✅ ΕΛΕΓΧΟΣ 1: Cap στη λήξη σύμβασης
	 * ✅ ΕΛΕΓΧΟΣ 2: Cap στο τέλος έτους
	 */
	async function updateOrarioyEosDate(startDate) {
		if (!startDate) {
			return;
		}

		// Parse start date
		const startDateParsed = new Date(startDate);
		
		if (isNaN(startDateParsed.getTime())) {
			return;
		}

		// Calculate: start + 7 days
		let eosDateParsed = new Date(startDateParsed);
		eosDateParsed.setDate(eosDateParsed.getDate() + 6);

		// =====================================================================
		// ΈΛΕΓΧΟΣ 1: Cap στη λήξη σύμβασης (αν υπάρχει και δεν είναι κενό)
		// =====================================================================
		if (lhxhsSymbashsInput && lhxhsSymbashsInput.value && lhxhsSymbashsInput.value. trim() !== '') {
			const lhxhsDate = new Date(lhxhsSymbashsInput.value);
			
			if (!isNaN(lhxhsDate.getTime())) {
				if (eosDateParsed > lhxhsDate) {
					eosDateParsed = lhxhsDate;
				}
			}
		}

		// =====================================================================
		// ΈΛΕΓΧΟΣ 2: Cap στο τέλος έτους (31 Δεκεμβρίου)
		// =====================================================================
		const yearEnd = new Date(startDateParsed.getFullYear(), 11, 31); // December 31st
		
		if (eosDateParsed > yearEnd) {
			eosDateParsed = yearEnd;
		}

		// =====================================================================
		// Format και Update
		// =====================================================================
		const eosDate = formatDateToISO(eosDateParsed);

		// Update field
		orarioyEosInput.value = eosDate;

		// Update difference calculation
		await updateDateDifference(startDate, eosDate);
	}

	/**
	 * Validation για manual changes στο eos field
	 */
	async function validateDateChange(apoDate, eosDate) {
		if (!apoDate || !eosDate) {
			return false;
		}

		const apoDateObj = new Date(apoDate);
		const eosDateObj = new Date(eosDate);

		// Check 1: eos δεν μπορεί να είναι πριν από apo
		if (eosDateObj < apoDateObj) {
			const formattedApoDate = formatDate(apoDateObj);
			alert(`Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι πριν από την ${formattedApoDate}. `);
			return false;
		}

		// Check 2: eos δεν μπορεί να είναι μετά τη λήξη σύμβασης
		if (lhxhsSymbashsInput && lhxhsSymbashsInput.value) {
			const lhxhsDate = new Date(lhxhsSymbashsInput.value);
			if (!isNaN(lhxhsDate.getTime()) && eosDateObj > lhxhsDate) {
				const formattedLhxhs = formatDate(lhxhsDate);
				alert(`Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι μετά τη λήξη της σύμβασης (${formattedLhxhs}).`);
				return false;
			}
		}

		// Check 3: eos δεν μπορεί να είναι μετά το τέλος του έτους
		const yearEnd = new Date(apoDateObj.getFullYear(), 11, 31);
		if (eosDateObj > yearEnd) {
			const formattedYearEnd = formatDate(yearEnd);
			alert(`Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι μετά την ${formattedYearEnd}.`);
			return false;
		}

		// Check 4: Optional - max 31 days difference
		const maxDate = new Date(apoDateObj);
		maxDate.setDate(maxDate.getDate() + 31);

		if (eosDateObj > maxDate) {
			const formattedApoDate = formatDate(apoDateObj);
			const formattedMaxDate = formatDate(maxDate);
			alert(`Η Ημερ/νία ΕΩΣ πρέπει να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate} (μέγιστο 31 ημέρες).`);
			return false;
		}

		return true;
	}

	// =========================================================================
	// API CALLS
	// =========================================================================

	async function loadKathgoriesErgasias() { 
		try {
			const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

			const response = await fetch('/api/kathgoriesErgasias', {
				method: 'GET',
				credentials: 'same-origin',
				headers: {
					'Accept': 'application/json',
					'X-CSRF-Token': csrfToken || '',
					'X-Requested-With': 'XMLHttpRequest',
					'Cache-Control': 'no-store'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response. status}`);
			}

			const data = await response.json();
			const differenceInDays = parseInt(document.getElementById('differenceInDays').value);

			for (let i = 1; i <= differenceInDays; i++) {  
				const kathgoriesErgasiasDropdown = document.getElementById(`kathgoria_ergasias_${i.toString().padStart(2, '0')}`);
				kathgoriesErgasiasDropdown.innerHTML = '<option value="" selected></option>';
				data.forEach(kathgoriaErgasias => {
					const textToConvert = removeGreekAccentsAndToUpper(kathgoriaErgasias.perigrafh);
					const option = new Option(textToConvert, kathgoriaErgasias.kodikos);
					kathgoriesErgasiasDropdown.appendChild(option);
				});
			}
		} catch (error) {
			console.error('Error loading categories:', error);
		}
	}

	async function updateDateDifference(startDate, endDate) {
		const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
	
		if (!csrfToken) {
			console.error('❌ CSRF token not found! ');
			throw new Error('CSRF token missing.  Please refresh the page.');
		}

		const response = await fetch('/api/dateDifference', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'CSRF-Token': csrfToken,
				'X-CSRF-Token': csrfToken
			},
			credentials: 'include',
			body: JSON.stringify({ startDate, endDate })
		});
		
		const data = await response.json();
		document.getElementById('differenceInDays').value = data.differenceInDays;

		const container = document.getElementById('dynamicFields');
		if (!container) {
			return;
		}

		const oldSelects = container.querySelectorAll('select.tom-dropdown');
		oldSelects.forEach(sel => {
			if (sel.id && window.destroyTomSelectById) {
				window.destroyTomSelectById(sel.id);
			}
		});

		container.innerHTML = ''; // Καθαρίζει το container

		for (let i = 1; i <= data.differenceInDays; i++) {
			let i1 = i < 10 ? '0' + i : i;
			
			let divHtml = `
				<input type="hidden" name="total_hours_day_${i1}" id="total_hours_day_${i1}" value="0" />
				<input type="hidden" name="night_hours_day_${i1}" id="night_hours_day_${i1}" value="0" />
				<input type="hidden" name="holiday_hours_day_${i1}" id="holiday_hours_day_${i1}" value="0" />
				<input type="hidden" name="overwork_hours_day_${i1}" id="overwork_hours_day_${i1}" value="0" />
				<input type="hidden" name="night_overwork_hours_day_${i1}" id="night_overwork_hours_day_${i1}" value="0" />
				<input type="hidden" name="holiday_overwork_hours_day_${i1}" id="holiday_overwork_hours_day_${i1}" value="0" />
				<input type="hidden" name="night_holiday_overwork_hours_day_${i1}" id="night_holiday_overwork_hours_day_${i1}" value="0" />
				<input type="hidden" name="overtimeNomimh_hours_day_${i1}" id="overtimeNomimh_hours_day_${i1}" value="0" />
				<input type="hidden" name="night_overtimeNomimh_hours_day_${i1}" id="night_overtimeNomimh_hours_day_${i1}" value="0" />
				<input type="hidden" name="holiday_overtimeNomimh_hours_day_${i1}" id="holiday_overtimeNomimh_hours_day_${i1}" value="0" />
				<input type="hidden" name="night_holiday_overtimeNomimh_hours_day_${i1}" id="night_holiday_overtimeNomimh_hours_day_${i1}" value="0" />
				<input type="hidden" name="overtimeParanomh_hours_day_${i1}" id="overtimeParanomh_hours_day_${i1}" value="0" />
				<input type="hidden" name="night_overtimeParanomh_hours_day_${i1}" id="night_overtimeParanomh_hours_day_${i1}" value="0" />
				<input type="hidden" name="holiday_overtimeParanomh_hours_day_${i1}" id="holiday_overtimeParanomh_hours_day_${i1}" value="0" />
				<input type="hidden" name="night_holiday_overtimeParanomh_hours_day_${i1}" id="night_holiday_overtimeParanomh_hours_day_${i1}" value="0" />
				
				<div class="row form-group align-items-center bg-white">
					<div class="col-0-5 align-left">
						<label for="hmeromhnia_${i1}" class="col-form-label field-required" id="day_label_${i1}"></label>
					</div>

					<div class="col-1-5 align-center">
						<input type="date" class="date-control input-date" id="hmeromhnia_${i1}" name="hmeromhnia_${i1}" value="" readonly />
					</div>

					<div class="col-2-75">
						<input type="hidden" name="kathgoria_ergasias_sthathera_${i1}" id="kathgoria_ergasias_stathera_${i1}" />

						<select 
							class="tom-dropdown selectpicker-dropdown-normal left-align w-100" 
							name="kathgoria_ergasias_${i1}" 
							id="kathgoria_ergasias_${i1}"
							data-api="/api/dropdown/ergazomenoi/kathgoria_ergasias"
							data-target-input="kathgoria_ergasias_stathera_${i1}"
							data-preselect="kathgoria_ergasias_stathera_${i1}"
							data-preload-all="true"
							data-pad-length="3">
						</select>
					</div>

					<div class="col-0-25"></div>
				`;
			
			for (let j = 1; j <= 3; j++) {
				if (j === 1) {
					divHtml += `
						<div class="col-1-2">
							<input type="time" class="date-control clearableInput" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" />
						</div>

						<div class="col-1-2 ml--0_2rem">
							<input type="time" class="date-control clearableInput" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" />
						</div>

						<div class="col-0-5"></div>

						<div class="col-1-2">
							<input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" />
						</div>

						<div class="col-1-2 ml--0_1rem">
							<input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" />
						</div>

						<div class="col-0-75"></div>

						<div class="col-0-5 center-align checkbox-flex-center mt-0_4rem">
							<input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="repo_${i1}" name="repo_${i1}" value="" />
							<label for="repo_${i1}" class="ml0_75-fs-0_875vw" id="label-repo_${i1}">
								ΟΧΙ
							</label>
						</div>

						<div class="col-0-5 center-align checkbox-flex-center dispno-mt-0_4rem">
							<input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="argia_${i1}" name="argia_${i1}" value="" />
							<label for="argia_${i1}" class="ml0_75-fs-0_875vw" id="label-argia_${i1}">
								ΟΧΙ
							</label>
						</div>
					`;
				}

				if (j === 2) {
					divHtml += `
						<div class="row form-group align-items-center bg-white mb-2">
							<div class="col-5 left-align">
								<input type="text" class="argia-label mt-0_5rem-fs0_7rem-border-0" tabIndex="-1" id="perigrafh_argias_${i1}" name="perigrafh_argias_${i1}" readonly />
							</div>

							<div class="col-1-2 ml-0_7rem">
								<input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" />
							</div>

							<div class="col-1-2">
								<input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" />
							</div>

							<div class="col-0-5"></div>

							<div class="col-1-2 ml-0_3rem">
								<input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" />
							</div>

							<div class="col-1-2">
								<input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" />
							</div>
						</div>
					`;
				} 

				if (j === 3) {
					const eidikh = document.getElementById('eidikh_kathgoria_stathera')?. value || '';
					const isHolidayEnabled = (eidikh === '0004' || eidikh === '0005');
					const disabledAttr = isHolidayEnabled ? '' : 'disabled';

					divHtml += `
						<div class="row form-group align-items-center bg-white">
							<div class="col-5 left-align">
								<input type="text" class="argia-label mt-0_5rem-fs0_7rem-border-0" tabIndex="-1" id="holiday_label_${i1}" name="holiday_label_${i1}" readonly />
							</div>

							<div class="col-1-2 ml-0_7rem">
								<input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" ${disabledAttr} />
							</div>

							<div class="col-1-2">
								<input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" ${disabledAttr} />
							</div>

							<div class="col-0-5"></div>

							<div class="col-1-2 ml-0_3rem">
								<input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" ${disabledAttr} />
							</div>

							<div class="col-1-2">
								<input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" ${disabledAttr} />
							</div>
						</div>
					`;
					} 
			}
			
			divHtml += `<hr class="mt0_4rem-mb0_3rem" />`;
			container.insertAdjacentHTML('beforeend', divHtml);
		}				

		// ✅ Κλήση ΜΟΝΟ ΜΙΑ ΦΟΡΑ (ΕΞΩ από το loop)
		updateDates();
		setupEnterKeyNavigation();

		// Αρχικοποίηση TomSelect ΜΕΤΑ από μικρό delay
		setTimeout(() => {
			if (window. reinitTomDropdowns) {
				window.reinitTomDropdowns(container);
			}

			if (window.initClearableInputs) {
				window.initClearableInputs(container);
			}

			// ✅ Αρχικοποίηση listeners
			initializeSelectListeners();
			
			// ✅ Auto-select "ΜΕ" για αργίες
			setTimeout(() => {
				if (typeof autoSelectHolidaysOnInit === 'function') {
					autoSelectHolidaysOnInit();
				}
			}, 500);
		}, 100);

		// ✅ Attach blur listeners για υπολογισμό συνολικών ωρών εβδομάδας
		for (let i = 1; i <= data.differenceInDays; i++) {
			let i1 = i < 10 ? '0' + i : i;
			
			for (let j = 1; j <= 3; j++) {
				const eosOraInput = document.getElementById(`eos_ora_0${j}_${i1}`);
				if (eosOraInput) {
					eosOraInput.addEventListener('blur', function() {
						calculateWeeklyTotalHours();
					});
				}
			}
		}
	}

	// =========================================================================
	// UTILITY FUNCTIONS
	// =========================================================================

	function formatDate(date) {
		const day = ('0' + date.getDate()).slice(-2);
		const month = ('0' + (date. getMonth() + 1)).slice(-2);
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}

	function formatDateToISO(date) {
		const day = ('0' + date. getDate()).slice(-2);
		const month = ('0' + (date.getMonth() + 1)).slice(-2);
		const year = date.getFullYear();
		return `${year}-${month}-${day}`;
	}

	function setupEnterKeyNavigation() {
		const inputs = document.querySelectorAll('#dynamicFields input, #dynamicFields select');
		inputs.forEach((input, index) => {
			input.addEventListener('keypress', function (event) {
				if (event.key === 'Enter') {
					event.preventDefault();
					const nextInput = inputs[index + 1];
					if (nextInput) {
						nextInput.focus();
					}
				}
			});
		
			input.addEventListener('keydown', function (event) {
				if (event.key === 'Tab') {
					event.preventDefault();
		
					if (event.shiftKey) {
						const prevInput = inputs[index - 1];
						if (prevInput) {
							prevInput.focus();
						}
					} else {
						const nextInput = inputs[index + 1];
						if (nextInput) {
							nextInput.focus();
						}
					}
				}
			});
		});
	}

	/**
	 * Υπολογισμός ΣΥΝΟΛΙΚΩΝ ωρών για ΟΛΗ την εβδομάδα
	 */
	function calculateWeeklyTotalHours() {
		let totalMinutes = 0;
		const differenceInDays = parseInt(document.getElementById('differenceInDays')?.value || 0);

		// Για κάθε ημέρα
		for (let i = 1; i <= differenceInDays; i++) {
			let i1 = i < 10 ?  '0' + i :  i;

			// Για κάθε j (1, 2, 3)
			for (let j = 1; j <= 3; j++) {
				const apoOra = document. getElementById(`apo_ora_0${j}_${i1}`)?.value;
				const eosOra = document.getElementById(`eos_ora_0${j}_${i1}`)?.value;

				if (!apoOra || !eosOra) {
					continue;
				}

				const apoMinutes = timeToMinutes(apoOra);
				const eosMinutes = timeToMinutes(eosOra);
				let diffMinutes = eosMinutes - apoMinutes;

				if (diffMinutes < 0) {
					diffMinutes += 24 * 60;
				}

				totalMinutes += diffMinutes;
			}
		}

		const totalHours = (totalMinutes / 60).toFixed(2);
		const totalInput = document. getElementById('total_hours_day');

		// ✅ ΕΛΕΓΧΟΣ 1: Μόνο αν totalHours <= 40
		if (totalInput && parseFloat(totalHours) <= 40) {
			totalInput.value = totalHours;
			console.log(`✅ WEEKLY TOTAL:  ${totalHours} hours`);
		} else if (parseFloat(totalHours) > 40) {
			console.warn(`⚠️ Total hours (${totalHours}) exceeds 40!  Not updating input.`);
			return false;
		}

		// ✅ ΕΛΕΓΧΟΣ 2: Σύγκριση με hmeres_ergasias_ebdomadas
		const hmeresErgasiasInput = document.getElementById('hmeres_ergasias_ebdomadas');
		if (hmeresErgasiasInput && hmeresErgasiasInput.value) {
			const expectedHours = parseFloat(hmeresErgasiasInput.value);
			const actualHours = parseFloat(totalHours);

			if (actualHours !== expectedHours) {
				Swal.fire({
					backdrop: false,
					allowOutsideClick: false,
					icon: 'info',
					title: 'ΠΡΟΣΟΧΗ !!!',
					text:  'Δεν συμφωνούν οι ώρες εβδομαδιαίας εργασίας με το σύνολο των ωρών του δηλωθέντος ωραρίου',
					showConfirmButton: true,
					confirmButtonText: 'Κλείσιμο',
					customClass: {
						confirmButton: 'class-info custom-confirm-button custom-swal-button',
						title:  'custom-title',
						popup: 'custom-swal-popup',
					},
				}).then(() => {
					try {
						const firstEosOra = document. getElementById('eos_ora_01_01');
						if (firstEosOra) {
							firstEosOra.focus();
						}
					} catch (_) {}
				});
				return false;
			}
		}

		return true;
	}

	/**
	 * Μετατροπή "HH:MM" σε λεπτά
	 */
	function timeToMinutes(timeString) {
		if (!timeString) return 0;
		const [hours, minutes] = timeString.split(':').map(Number);
		return hours * 60 + minutes;
	}

});
