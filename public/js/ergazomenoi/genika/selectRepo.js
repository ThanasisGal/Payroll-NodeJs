// /public/js/ergazomenoi/genika/selectRepo.js

// =========================================================================
// MAIN FUNCTION
// =========================================================================

function initializeSelectListeners() {
	const selects = document.querySelectorAll('select[id^="kathgoria_ergasias_"]');
	const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="repo_"]');

	selects.forEach(select => {
		const selectId = select.id;

		if (select.tomselect) {
			const tomSelect = select.tomselect;

			// ✅ Event:   Όταν αλλάξει η τιμή
			tomSelect.on('change', function(value) {
				handleSelectChange(selectId, value);
				
				// ✅ Disable μετά την επιλογή
				if (value && value !== '') {
					setTimeout(() => {
						tomSelect.disable();
					}, 50);
				}
			});

			// ✅ Event:   Όταν πατηθεί το trash (clear)
			tomSelect.on('clear', function() {
				// ✅ Enable το select
				tomSelect.enable();
				
				// ✅ Clear το hidden input
				const idNum = selectId.match(/\d+$/)[0].padStart(2, '0');
				const hiddenInput = document.querySelector('#kathgoria_ergasias_stathera_' + idNum);
				if (hiddenInput) {
					hiddenInput.value = '';
				}
				
				// ✅ Reset checkbox και label
				const checkBox = document.querySelector('#repo_' + idNum);
				const label = document.querySelector('#label-repo_' + idNum);
				const dateField = document.querySelector('#hmeromhnia_' + idNum);
				
				if (checkBox) {
					checkBox.checked = false;
					
					// ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ:  Πάρε την τιμή του apasxolhshTisArgies
					const apasxolhshTisArgiesInput = document.getElementById('apasxolhshTisArgies');
					const apasxolhshTisArgies = apasxolhshTisArgiesInput?.value === 'true';
					
					// ✅ Enable repo (εκτός αν είναι αργία ΚΑΙ δεν επιτρέπονται)
					if (isHoliday(dateField) && !apasxolhshTisArgies) {
						checkBox.disabled = true;
					} else {
						checkBox.disabled = false;
					}
				}
				
				if (label) {
					label.textContent = 'ΟΧΙ';
				}
				
				// ✅ Enable όλα τα time fields
				updateNumericFields(idNum, '');
			});

		} else {
			// Fallback για κανονικό select
			select.addEventListener('change', function() {
				handleSelectChange(selectId, this.value);
				
				if (this.value && this.value !== '') {
					this.disabled = true;
				}
			});
		}
	});

	checkboxes.forEach(checkbox => {
		checkbox.addEventListener('click', function(event) {
			const idNum = this.id. match(/\d+$/)[0].padStart(2, '0');
			const selectElement = document.querySelector('#kathgoria_ergasias_' + idNum);
			const hiddenInput = document.querySelector('#kathgoria_ergasias_stathera_' + idNum);
			const label = document.querySelector('#label-repo_' + idNum);
			const dateField = document.querySelector('#hmeromhnia_' + idNum);

			// ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ:  Πάρε την τιμή του apasxolhshTisArgies
			const apasxolhshTisArgiesInput = document.getElementById('apasxolhshTisArgies');
			const apasxolhshTisArgies = apasxolhshTisArgiesInput?. value === 'true';

			// ✅ ΕΛΕΓΧΟΣ:  Αν είναι αργία ΚΑΙ apasxolhshTisArgies === false
			if (isHoliday(dateField) && !apasxolhshTisArgies && this.checked) {
				event.preventDefault();
				this.checked = false;
				return;
			}

			let newValue;
			if (this.checked) {
				newValue = 'ΑΝ';
				if (label) label.textContent = 'ΝΑΙ';
			} else {
				// ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ:  Αν apasxolhshTisArgies === true, δεν κάνει auto "ΜΕ"
				newValue = (isHoliday(dateField) && !apasxolhshTisArgies) ? 'ΜΕ' : '';
				if (label) label.textContent = 'ΟΧΙ';
			}

			if (selectElement?. tomselect) {
				const tomSelect = selectElement.tomselect;
				
				// ✅ Enable πρώτα
				tomSelect.enable();
				
				// ✅ Clear
				tomSelect.clear();
				
				// ✅ Αν έχει value, κάνε setValue ΜΕ RETRY
				if (newValue && newValue !== '') {
					// Έλεγχος αν έχουν φορτώσει τα options
					const hasOptions = Object.keys(tomSelect.options).length > 0;
					
					if (! hasOptions) {
						// ❌ ΔΕΝ έχουν φορτώσει - ΑΝΑΓΚΑΣΤΙΚΟ PRELOAD
						tomSelect.open();
						
						let attempts = 0;
						const maxAttempts = 30;
						
						const checkInterval = setInterval(() => {
							attempts++;
							const currentOptions = Object.keys(tomSelect.options).length;
							
							if (currentOptions > 0) {
								// ✅ Φόρτωσαν!  
								clearInterval(checkInterval);
								tomSelect.close();
								
								if (tomSelect.options[newValue]) {
									tomSelect. setValue(newValue);
								}
								
								setTimeout(() => {
									tomSelect.disable();
								}, 50);
							} else if (attempts >= maxAttempts) {
								// ❌ Timeout
								clearInterval(checkInterval);
								tomSelect.close();
								console.error(`❌ Failed to load options after ${maxAttempts} attempts`);
							}
						}, 100);
					} else {
						// ✅ Έχουν ήδη φορτώσει
						if (tomSelect.options[newValue]) {
							tomSelect.setValue(newValue);
						} else {
							console.error(`❌ Option '${newValue}' not found!  Available: `, Object.keys(tomSelect.options));
						}
						
						setTimeout(() => {
							tomSelect. disable();
						}, 50);
					}
				}
			} else if (selectElement) {
				selectElement.value = newValue;
			}

			if (hiddenInput) {
				hiddenInput.value = newValue;
			}

			updateNumericFields(idNum, newValue);
			handleHoliday(dateField, idNum, this, newValue);
		});
	});
}

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

function handleSelectChange(selectId, value) {
	const idNum = selectId.match(/\d+$/)[0].padStart(2, '0');
	const checkBox = document.querySelector('#repo_' + idNum);
	const label = document.querySelector('#label-repo_' + idNum);
	const dateField = document.querySelector('#hmeromhnia_' + idNum);
	const hiddenInput = document.querySelector('#kathgoria_ergasias_stathera_' + idNum);

	if (hiddenInput) {
		hiddenInput.value = value;
	}

	if (checkBox) {
		checkBox.checked = (value === 'ΑΝ');
	}
	
	if (label) {
		label.textContent = (value === 'ΑΝ') ? 'ΝΑΙ' :  'ΟΧΙ';
	}

	updateNumericFields(idNum, value);

	if (value === 'ΑΝ' || value === 'ΜΕ') {
		handleHoliday(dateField, idNum, checkBox, value);
	}
}

function handleHoliday(dateField, idNum, checkbox, selectValue) {
	// ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ:  Πάρε την τιμή του apasxolhshTisArgies
	const apasxolhshTisArgiesInput = document.getElementById('apasxolhshTisArgies');
	const apasxolhshTisArgies = apasxolhshTisArgiesInput?.value === 'true';
	
	// ✅ Αν apasxolhshTisArgies === true, ΔΕΝ εμφανίζεται warning
	if (apasxolhshTisArgies) {
		return;
	}
	
	// ❌ Παλία λογική (μόνο αν apasxolhshTisArgies === false)
	if (isHoliday(dateField) && (checkbox?.checked || selectValue === 'ΑΝ')) {
		Swal.fire({
			backdrop: false,
			allowOutsideClick: false,
			icon: 'warning',
			title: 'ΠΡΟΣΟΧΗ - ΛΑΘΟΣ ΟΡΙΣΜΟΣ ΡΕΠΟ !!! ',
			html: `
				<div style="text-align: center;">
					<p>Η ημερομηνία είναι αργία και η εταιρεία ΔΕΝ επιτρέπεται να λειτουργεί κατά τις Κυριακές - Αργίες.</p>
					<br>
					<p>Μπορείτε να επιλέξετε Repo, με δική σας ευθύνη.</p>
				</div>
			`,
			showConfirmButton: true,
			confirmButtonText: 'To κατάλαβα',
			customClass: {
				confirmButton: 'class-warning custom-confirm-button custom-swal-button',
				title: 'custom-title',
				popup: 'custom-swal-popup',
			},
		});
	}
}

function isHoliday(dateField) {
	return dateField && dateField.style.color === 'red';
}

function updateNumericFields(idNum, selectValue) {
    const timeFields = ['apo_ora', 'eos_ora', 'dialleima_apo_ora', 'dialleima_eos_ora'];
    const eidikh = document.getElementById("eidikh_kathgoria_stathera")?.value || '';
    const isSpecialCategory = (eidikh === "0004" || eidikh === "0005");
    
    // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Πάρε το apasxolhshTisArgies
    const apasxolhshTisArgies = document.getElementById('apasxolhshTisArgies')?.value === 'true';
    const dateField = document.getElementById(`hmeromhnia_${idNum}`);
    const isHolidayDate = isHoliday(dateField);

    timeFields.forEach(field => {
        for (let j = 1; j <= 3; j++) {
            const timeInput = document.querySelector(`#${field}_0${j}_${idNum}`);
            if (timeInput) {
                // ✅ CASE 1: ΑΝ → disabled
                if (selectValue === 'ΑΝ') {
                    timeInput.disabled = true;
                }
                // ✅ CASE 2: ΜΕ ΚΑΙ apasxolhshTisArgies === true ΚΑΙ είναι αργία
                else if (selectValue === 'ΜΕ' && apasxolhshTisArgies && isHolidayDate) {
                    // ✅ Enable j=1,2 πάντα + j=3 αν eidikh === 0004/0005
                    if (j === 1 || j === 2) {
                        timeInput.disabled = false;
                    } else if (j === 3 && isSpecialCategory) {
                        timeInput.disabled = false;
                    } else {
                        timeInput.disabled = true;
                    }
                }
                // ✅ CASE 3: ΜΕ (χωρίς apasxolhshTisArgies)
                else if (selectValue === 'ΜΕ') {
                    timeInput.disabled = true;
                }
                // ✅ CASE 4: Άλλη τιμή (ΕΡΓ, ΤΗΛ, κλπ.)
                else {
                    if (j === 1 || j === 2) {
                        timeInput.disabled = false;
                    } else if (j === 3 && isSpecialCategory) {
                        timeInput. disabled = false;
                    } else {
                        timeInput. disabled = true;
                    }
                }
            }
        }
    });
}

// =========================================================================
// AUTO-SELECT HOLIDAYS
// =========================================================================

/**
 * ✅ Ελέγχει όλες τις ημερομηνίες και auto-select "ΜΕ" αν είναι αργία
 */
function autoSelectHolidaysOnInit() {
    const differenceInDays = parseInt(document. getElementById('differenceInDays')?.value || 0);
    const apasxolhshTisArgies = document.getElementById('apasxolhshTisArgies')?.value === 'true';
    
    for (let i = 1; i <= differenceInDays; i++) {
        const i1 = i < 10 ? '0' + i : i. toString();
        const dateField = document.getElementById(`hmeromhnia_${i1}`);
        const selectElement = document.getElementById(`kathgoria_ergasias_${i1}`);
        const checkBox = document.getElementById(`repo_${i1}`);
        const label = document.getElementById(`label-repo_${i1}`);
        const hiddenInput = document.getElementById(`kathgoria_ergasias_stathera_${i1}`);
        
        // ✅ Αν είναι αργία
        if (isHoliday(dateField)) {
            // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ:  Αν apasxolhshTisArgies === false, disable repo
            if (!apasxolhshTisArgies) {
                if (checkBox) {
                    checkBox.checked = false;
                    checkBox.disabled = true;
                }
                
                if (label) {
                    label.textContent = 'ΟΧΙ';
                }
                
                // ✅ Set "ΜΕ"
                if (selectElement?. tomselect) {
                    setValueWithRetry(selectElement. tomselect, 'ΜΕ', i1, hiddenInput);
                } else if (selectElement) {
                    selectElement.value = 'ΜΕ';
                    selectElement.disabled = true;
                    if (hiddenInput) hiddenInput.value = 'ΜΕ';
                }
                
                updateNumericFields(i1, 'ΜΕ');
            } else {
                // ✅ apasxolhshTisArgies === true → Enable repo
                if (checkBox) {
                    checkBox.disabled = false;
                }
            }
        } else {
            // ✅ Αν ΔΕΝ είναι αργία, enable το repo
            if (checkBox) {
                checkBox.disabled = false;
            }
        }
    }
}

/**
 * ✅ Προσπαθεί να κάνει setValue με retry (περιμένει να φορτώσουν τα options)
 */
function setValueWithRetry(tomSelect, value, idNum, hiddenInput) {
	let attempts = 0;
	const maxAttempts = 20;
	
	// ✅ Αν δεν έχουν φορτώσει, άνοιξε το dropdown
	if (Object.keys(tomSelect.options).length === 0) {
		tomSelect.open();
	}
	
	const checkInterval = setInterval(() => {
		attempts++;
		const hasOptions = Object.keys(tomSelect.options).length > 0;
		
		if (hasOptions) {
			clearInterval(checkInterval);
			
			// ✅ Κλείσε το dropdown
			tomSelect.close();
			
			// ✅ Έλεγχος αν υπάρχει το option "ΜΕ"
			if (tomSelect.options[value]) {
				tomSelect.enable();
				tomSelect.setValue(value);
				
				setTimeout(() => {
					tomSelect. disable();
				}, 50);
				
				// ✅ Update hidden input
				if (hiddenInput) {
					hiddenInput. value = value;
				}
			} else {
				console.error(`❌ Option "${value}" not found in TomSelect options for ${idNum}`);
			}
		} else if (attempts >= maxAttempts) {
			clearInterval(checkInterval);
			tomSelect.close();
			console.error(`❌ Failed to load options for ${idNum} after ${maxAttempts} attempts`);
		}
	}, 100);
}