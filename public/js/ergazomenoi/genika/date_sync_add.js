document.addEventListener('DOMContentLoaded', function() {
	const proslhpshsInput = document.getElementById('hmeromhnia_proslhpshs');
	const allaghsSymbashsInput = document.getElementById('hmeromhnia_allaghs_symbashs');
	const orarioyApoInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
	const orarioyEosInput = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

	// proslhpshsInput.addEventListener('change', handleProslhpshChange); 
	proslhpshsInput.addEventListener('blur', handleProslhpshChange);
	allaghsSymbashsInput.addEventListener('change', handleAllaghsChange);
	allaghsSymbashsInput.addEventListener('blur', handleAllaghsChange);
	// orarioyApoInput.addEventListener('change', handleOrarioyApoChange);
	orarioyApoInput.addEventListener('blur', handleOrarioyApoChange);
	// orarioyEosInput.addEventListener('change', handleOrarioyEosChange);
	orarioyEosInput.addEventListener('blur', handleOrarioyEosChange);

	async function handleProslhpshChange() {
		setAllDates(this.value);
		await updateOrarioyEosDate(this.value);
	}

	document.querySelectorAll('input[type="date"], input[type="time"]').forEach(input => {
		input.addEventListener('keydown', function(event) {
		if (event.key === 'Tab') {
			event.preventDefault();
	
			// Αποκτούμε όλα τα στοιχεία της φόρμας με την κατάλληλη σειρά
			const formElements = Array.from(document.querySelectorAll('input, select, textarea, button'));
			const index = formElements.indexOf(this);
	
			// Εύρεση του επόμενου στοιχείου
			const nextInput = formElements[index + 1];
			if (nextInput) {
			setTimeout(() => nextInput.focus(), 0); // Δίνουμε focus στο επόμενο στοιχείο
			}
		}
		});
	});

	function handleAllaghsChange() {
		setAllDates(this.value);
	}

	function handleOrarioyApoChange() {
		updateOrarioyEosDate(this.value);
	}

	function getLastDayOfMonth(date) {
		// Δημιουργία ημερομηνίας για τον επόμενο μήνα
		const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
		// Επιστροφή της τελευταίας ημέρας του τρέχοντος μήνα
		return new Date(nextMonth - 1);
	}

	async function handleOrarioyEosChange() {
		const eosDate = this.value;
		const apoDate = orarioyApoInput.value;
		let isValidDateChange = await validateDateChange(apoDate, eosDate);
		if (eosDate === "") {
			isValidDateChange = false;
		}

		if (!isValidDateChange) {
			let maxEosDate = new Date(apoDate);
			const formattedApoDate = formatDate(new Date(apoDate));
			const lastDayOfMonth = getLastDayOfMonth(maxEosDate);
			const formattedMaxDate = formatDate(lastDayOfMonth);

			alert(`Η Ημερ/νία Αλλαγής Ωραρίου πρέπει να αφορά μόνο το συγκεκριμένο μήνα και να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate}.`);

			this.value = formatDateToISO(lastDayOfMonth); // Reset to valid max date
		}
		const startDate = document.getElementById('hmeromhnia_allaghs_orarioy_apo').value;
		const endDate = this.value;
		updateDateDifference(startDate, endDate);
	}

	function setAllDates(value) {
		allaghsSymbashsInput.value = value;
		orarioyApoInput.value = value;
	}

	async function updateOrarioyEosDate(startDate) {
		const etos = parseInt(startDate.substring(0,4));
		const mhnas = parseInt(startDate.substring(5,7));
		const hmera = parseInt(startDate.substring(8,10));
		const lastDayOfMonth = new Date(etos, mhnas, 0).getDate();
		const differenceDaysToEndOfMonth = parseInt(lastDayOfMonth) - hmera;

		const startDateParsed = new Date(startDate);
		startDateParsed.setDate(startDateParsed.getDate() + differenceDaysToEndOfMonth); // Προσθέτει την διαφορά μεταξύ της τελευταίας ημέρας του μήνα και της ημέρας startDate
		const eosDate = formatDateToISO(startDateParsed);
		orarioyEosInput.value = eosDate;
		await updateDateDifference(startDate, eosDate);
	}

	async function validateDateChange(apoDate, eosDate) {
		const etos = parseInt(apoDate.substring(0,4));
		const mhnas = parseInt(apoDate.substring(5,7));
		const hmera = parseInt(apoDate.substring(8,10));
		const lastDayOfMonth = new Date(etos, mhnas, 0).getDate();
		const differenceDaysToEndOfMonth = parseInt(lastDayOfMonth) - hmera;
		const formattedApoDate = formatDate(new Date(apoDate));
		
		const maxDate = new Date(new Date(apoDate).setDate(new Date(apoDate).getDate() + differenceDaysToEndOfMonth));
		const formattedMaxDate = formatDate(maxDate);
		document.getElementById("differenceDaysToEndOfMonth").value = differenceDaysToEndOfMonth;

		if (new Date(eosDate) < new Date(apoDate) || new Date(eosDate) > maxDate) {
			alert(`Η Ημερ/νία Αλλαγής Ωραρίου ΕΩΣ πρέπει να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate}.`);
			return false;
		}
		return true;
	}

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
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			const differenceInDays = parseInt(document.getElementById('differenceInDays').value);

			for (let i = 1; i <= differenceInDays; i++) {  
				const kathgoriesErgasiasDropdown = document.getElementById(`kathgoria_ergasias_${i.toString().padStart(2, '0')}`);
				kathgoriesErgasiasDropdown.innerHTML = '<option value="" selected></option>'; // Προσθήκη προεπιλεγμένης επιλογής
				data.forEach(kathgoriaErgasias => {
					const textToConvert = removeGreekAccentsAndToUpper(kathgoriaErgasias.perigrafh);
					const option = new Option(textToConvert, kathgoriaErgasias.kodikos);
					kathgoriesErgasiasDropdown.appendChild(option); // Προσθήκη επιλογών στο dropdown
				});
			}
		} catch (error) {
		console.error('Error loading categories:', error);
		}
	}

	async function updateDateDifference(startDate, endDate) {
		// try {
			const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
		
			if (!csrfToken) {
				console.error('❌ CSRF token not found!');
				throw new Error('CSRF token missing. Please refresh the page.');
			}

			const response = await fetch('/api/dateDifference', {     // Υπολογίζει την διαφορά ημερών έως-από
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

			container.innerHTML = ''; // Clear previous fields

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
						<div class="col-0-5 text-center">
							<label for="hmeromhnia_${i1}" class="col-form-label field-required" id="day_label_${i1}"></label>
						</div>

						<div class="col-1-5 text-center">
							<input type="date" class="date-control input-date" id="hmeromhnia_${i1}" name="hmeromhnia_${i1}" value="" readonly />
						</div>

						<div class="col-2-75">
							<input
								type="hidden"
								name="kathgoria_ergasias_stathera_${i1}"
								id="kathgoria_ergasias_stathera_${i1}"
								class="form-control input-contents"
								value="kathgoria_ergasias_stathera_${i1}"
								readonly
							/>

							<select
								id="kathgoria_ergasias_${i1}"
								name="kathgoria_ergasias_${i1}"
								class="tom-dropdown left-align"
								aria-label="Κατηγορίες Εργασίας"
								data-api="/api/dropdown/statheraArxeia/kathgories_ergasias"
								single
								data-target-input="kathgoria_ergasias_stathera_${i1}"
								data-preselect="kathgoria_ergasias_stathera_${i1}"
								data-preload-all="true"
								data-pad-length="3"
								placeholder="Αναζήτηση Κατηγοριών Εργασίας">
							</select>
						</div>
				`;
				
				// <div class="row form-group align-items-center bg-white">
				for (let j = 1; j <= 3; j++) {
					if (j === 1) {
						divHtml += `
								<div class="col-0-25"></div>
								<div class="col-1-2">
									<input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" />
								</div>

								<div class="col-1-2 ml-0_1rem">
									<input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" />
								</div>

								<div class="col-0-5"></div>

								<div class="col-1-2">
									<input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" />
								</div>

								<div class="col-1-2 ml-0_2rem">
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
						// </div>
					} else {
						divHtml += `
							<div class="row form-group align-items-center bg-white">`;
								if (j === 2) {
									divHtml += `
										<div class="col-5 left-align">
											<input type="text" class="argia-label mt-0_5rem-fs0_7rem-border-0" tabIndex="-1" id="perigrafh_argias_${i1}" name="perigrafh_argias_${i1}" readonly />
										</div>
									`;
								} else {
									divHtml += `
										<div class="col-4-91 left-align">
											<label class="col-form-label field-required" id="holiday_label_${i1}"> &nbsp; </label>
										</div>
									`;
								}
								divHtml += `
									<div class="col-1-2 ml-0_7rem">
										<input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
									</div>

									<div class="col-1-2">
										<input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
									</div>

									<div class="col-0-5"></div>

									<div class="col-1-2 ml-0_3rem">
										<input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
									</div>

									<div class="col-1-2">
										<input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
									</div>
								</div>
							</div>
						`;
					}
				}
				
				divHtml += `<hr class="mt0_4rem-mb0_3rem" />`;
				container.innerHTML += divHtml;
			}				
			// loadKathgoriesErgasias();
			initializeSelectListeners();          // Βρίσκεται στο selectRepo.js
			updateDates();                        // Βρίσκεται στο getDaysFromDate.js
			// attachTimeInputListeners();           // Βρίσκεται στο calcOresApasxolhshs
			setupEnterKeyNavigation();

		// } catch (error) {
		// 	console.error('Error sending data to server:', error);
		// }
	}

	function formatDate(date) {
		const day = ('0' + date.getDate()).slice(-2);
		const month = ('0' + (date.getMonth() + 1)).slice(-2);
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}

	function formatDateToISO(date) {
		const day = ('0' + date.getDate()).slice(-2);
		const month = ('0' + (date.getMonth() + 1)).slice(-2);
		const year = date.getFullYear();
		return `${year}-${month}-${day}`;
	}

	function setupEnterKeyNavigation() {
		const inputs = document.querySelectorAll('#dynamicFields input, #dynamicFields select');
		inputs.forEach((input, index) => {
			// event listener για Enter
			input.addEventListener('keypress', function (event) {
				if (event.key === 'Enter') {
					event.preventDefault(); // Αποτροπή της default λειτουργίας
					// Βρίσκει το επόμενο στοιχείο και του δίνει focus
					const nextInput = inputs[index + 1];
					if (nextInput) {
						nextInput.focus();
					}
				}
			});
		
			// event listener για Tab και Shift + Tab
			input.addEventListener('keydown', function (event) {
				if (event.key === 'Tab') {
					event.preventDefault(); // Αποτροπή της default λειτουργίας
		
					if (event.shiftKey) {
						// Έλεγχος για Shift + Tab για μετάβαση στο προηγούμενο πεδίο
						const prevInput = inputs[index - 1];
						if (prevInput) {
							prevInput.focus();
						}
					} else {
						// Κανονικό Tab για μετάβαση στο επόμενο πεδίο
						const nextInput = inputs[index + 1];
						if (nextInput) {
							nextInput.focus();
						}
					}
				}
			});
		});
	}
});
