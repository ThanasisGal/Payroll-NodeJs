// /public/js/ergazomenoi/genika/selectRepo.js

function initializeSelectListeners() {
    const selects = document.querySelectorAll('select[id^="kathgoria_ergasias_"]');
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="repo_"]');

    selects.forEach((select) => {
        const selectId = select.id;

        if (select.dataset.selectRepoBound === '1') {
            return;
        }

        if (select.tomselect) {
            const tomSelect = select.tomselect;
            let isHandlingSelectChange = false;

            tomSelect.on('change', function (value) {
                if (isHandlingSelectChange) {
                    return;
                }

                isHandlingSelectChange = true;

                try {
                    handleSelectChange(selectId, value);
                } finally {
                    isHandlingSelectChange = false;
                }
            });

            tomSelect.on('clear', function () {
                if (select.dataset.clearingNow === '1') {
                    return;
                }

                select.dataset.clearingNow = '1';

                try {
                    const match = selectId.match(/\d+$/);
                    if (!match) {
                        return;
                    }

                    const idNum = match[0].padStart(2, '0');

                    const hiddenInput = document.querySelector(
                        '#kathgoria_ergasias_stathera_' + idNum
                    );
                    if (hiddenInput) {
                        hiddenInput.value = '';
                    }

                    const checkBox = document.querySelector('#repo_' + idNum);
                    const label = document.querySelector('#label-repo_' + idNum);
                    const dateField = document.querySelector('#hmeromhnia_' + idNum);

                    if (checkBox) {
                        checkBox.checked = false;

                        const apasxolhshTisArgiesInput =
                            document.getElementById('apasxolhshTisArgies');
                        const apasxolhshTisArgies = apasxolhshTisArgiesInput?.value === 'true';

                        checkBox.disabled = isHoliday(dateField) && !apasxolhshTisArgies;
                    }

                    if (label) {
                        label.textContent = 'ΟΧΙ';
                    }

                    clearTimeFields(idNum);
                    updateNumericFields(idNum, '');
                } finally {
                    setTimeout(() => {
                        select.dataset.clearingNow = '0';
                    }, 0);
                }
            });
        } else {
            select.addEventListener('change', function () {
                handleSelectChange(selectId, this.value);
            });
        }

        select.dataset.selectRepoBound = '1';
    });

    checkboxes.forEach((checkbox) => {
        if (checkbox.dataset.selectRepoBound === '1') {
            return;
        }

        checkbox.addEventListener('click', function (event) {
            const match = this.id.match(/\d+$/);
            if (!match) {
                return;
            }

            const idNum = match[0].padStart(2, '0');
            const selectElement = document.querySelector('#kathgoria_ergasias_' + idNum);
            const hiddenInput = document.querySelector('#kathgoria_ergasias_stathera_' + idNum);
            const label = document.querySelector('#label-repo_' + idNum);
            const dateField = document.querySelector('#hmeromhnia_' + idNum);

            const apasxolhshTisArgiesInput = document.getElementById('apasxolhshTisArgies');
            const apasxolhshTisArgies = apasxolhshTisArgiesInput?.value === 'true';

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
                newValue = isHoliday(dateField) && !apasxolhshTisArgies ? 'ΜΕ' : '';
                if (label) label.textContent = 'ΟΧΙ';
            }

            if (selectElement?.tomselect) {
                const tomSelect = selectElement.tomselect;

                tomSelect.clear();

                if (newValue && newValue !== '') {
                    const hasOptions = Object.keys(tomSelect.options).length > 0;

                    if (!hasOptions) {
                        tomSelect.open();

                        let attempts = 0;
                        const maxAttempts = 30;

                        const checkInterval = setInterval(() => {
                            attempts++;
                            const currentOptions = Object.keys(tomSelect.options).length;

                            if (currentOptions > 0) {
                                clearInterval(checkInterval);
                                tomSelect.close();

                                if (tomSelect.options[newValue]) {
                                    tomSelect.setValue(newValue);
                                }
                            } else if (attempts >= maxAttempts) {
                                clearInterval(checkInterval);
                                tomSelect.close();
                                console.error(
                                    `❌ Failed to load options after ${maxAttempts} attempts`
                                );
                            }
                        }, 100);
                    } else {
                        if (tomSelect.options[newValue]) {
                            tomSelect.setValue(newValue);
                        } else {
                            console.error(
                                `❌ Option '${newValue}' not found`,
                                Object.keys(tomSelect.options)
                            );
                        }
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

        checkbox.dataset.selectRepoBound = '1';
    });
}

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

function handleSelectChange(selectId, value) {
    const match = selectId.match(/\d+$/);
    if (!match) {
        return;
    }

    const idNum = match[0].padStart(2, '0');
    const checkBox = document.querySelector('#repo_' + idNum);
    const label = document.querySelector('#label-repo_' + idNum);
    const dateField = document.querySelector('#hmeromhnia_' + idNum);
    const hiddenInput = document.querySelector('#kathgoria_ergasias_stathera_' + idNum);

    if (hiddenInput) {
        hiddenInput.value = value || '';
    }

    if (checkBox) {
        checkBox.checked = value === 'ΑΝ';
    }

    if (label) {
        label.textContent = value === 'ΑΝ' ? 'ΝΑΙ' : 'ΟΧΙ';
    }

    updateNumericFields(idNum, value);

    if (value === 'ΑΝ' || value === 'ΜΕ') {
        handleHoliday(dateField, idNum, checkBox, value);
    }
}

function handleHoliday(dateField, idNum, checkbox, selectValue) {
    const apasxolhshTisArgiesInput = document.getElementById('apasxolhshTisArgies');
    const apasxolhshTisArgies = apasxolhshTisArgiesInput?.value === 'true';

    if (apasxolhshTisArgies) {
        return;
    }

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
                popup: 'custom-swal-popup'
            }
        });
    }
}

function isHoliday(dateField) {
    return dateField && dateField.style.color === 'red';
}

function updateNumericFields(idNum, selectValue) {
    const timeFields = ['apo_ora', 'eos_ora', 'dialleima_apo_ora', 'dialleima_eos_ora'];
    const eidikh = document.getElementById('eidikh_kathgoria_stathera')?.value || '';
    const isSpecialCategory = eidikh === '0004' || eidikh === '0005';

    const apasxolhshTisArgies = document.getElementById('apasxolhshTisArgies')?.value === 'true';
    const dateField = document.getElementById(`hmeromhnia_${idNum}`);
    const isHolidayDate = isHoliday(dateField);

    // ✅ Καθόρισε χρώμα βάσει τιμής
    let bgColor = '';
    let borderColor = '#cccccc';

    if (selectValue === 'ΑΝ') {
        bgColor = '#2b97001e';
        borderColor = '#66bb6a';
    } else if (selectValue === 'ΜΕ' && isHolidayDate) {
        bgColor = '#eeff0223';
        borderColor = '#fbc02d';
    } else if (selectValue === 'ΜΕ') {
        bgColor = '';
        borderColor = '#cccccc';
    } else {
        bgColor = '#ffffff';
        borderColor = '#cccccc';
    }

    timeFields.forEach((field) => {
        for (let j = 1; j <= 3; j++) {
            const timeInput = document.querySelector(`#${field}_0${j}_${idNum}`);
            if (!timeInput) continue;

            // ✅ Disabled/Enabled λογική
            if (selectValue === 'ΑΝ' || selectValue === 'ΜΕ') {
                timeInput.value = '';
                timeInput.disabled = true;
            } else {
                if (j === 1 || j === 2) {
                    timeInput.disabled = false;
                } else if (j === 3 && isSpecialCategory) {
                    timeInput.disabled = false;
                } else {
                    timeInput.disabled = true;
                }
            }

            // ✅ Χρωματισμός time inputs
            timeInput.style.setProperty('background-color', bgColor, 'important');
            timeInput.style.setProperty('border-color', borderColor, 'important');
        }
    });

    // ✅ Χρωματισμός TomSelect control
    const selectEl = document.getElementById(`kathgoria_ergasias_${idNum}`);
    const tsControl =
        selectEl?.closest('.ts-wrapper')?.querySelector('.ts-control') ??
        selectEl?.parentElement?.querySelector('.ts-control');

    if (tsControl) {
        tsControl.style.setProperty('background-color', bgColor, 'important');
        tsControl.style.setProperty('border-color', borderColor, 'important');
    }
}

function clearTimeFields(idNum) {
    const timeFields = ['apo_ora', 'eos_ora', 'dialleima_apo_ora', 'dialleima_eos_ora'];
    timeFields.forEach((field) => {
        for (let j = 1; j <= 3; j++) {
            const timeInput = document.querySelector(`#${field}_0${j}_${idNum}`);
            if (timeInput) {
                timeInput.value = '';
            }
        }
    });
}

// =========================================================================
// AUTO-SELECT HOLIDAYS
// =========================================================================

function autoSelectHolidaysOnInit() {
    const differenceInDays = parseInt(document.getElementById('differenceInDays')?.value || 0);
    const apasxolhshTisArgies = document.getElementById('apasxolhshTisArgies')?.value === 'true';

    for (let i = 1; i <= differenceInDays; i++) {
        const i1 = i < 10 ? '0' + i : i.toString();
        const dateField = document.getElementById(`hmeromhnia_${i1}`);
        const selectElement = document.getElementById(`kathgoria_ergasias_${i1}`);
        const checkBox = document.getElementById(`repo_${i1}`);
        const label = document.getElementById(`label-repo_${i1}`);
        const hiddenInput = document.getElementById(`kathgoria_ergasias_stathera_${i1}`);

        if (isHoliday(dateField)) {
            if (!apasxolhshTisArgies) {
                if (checkBox) {
                    checkBox.checked = false;
                    checkBox.disabled = true;
                }

                if (label) {
                    label.textContent = 'ΟΧΙ';
                }

                if (selectElement?.tomselect) {
                    setValueWithRetry(selectElement.tomselect, 'ΜΕ', i1, hiddenInput);
                } else if (selectElement) {
                    selectElement.value = 'ΜΕ';
                    if (hiddenInput) hiddenInput.value = 'ΜΕ';
                }

                updateNumericFields(i1, 'ΜΕ');
            } else if (checkBox) {
                checkBox.disabled = false;
            }
        } else if (checkBox) {
            checkBox.disabled = false;
        }
    }
}

function setValueWithRetry(tomSelect, value, idNum, hiddenInput) {
    let attempts = 0;
    const maxAttempts = 20;

    if (Object.keys(tomSelect.options).length === 0) {
        tomSelect.open();
    }

    const checkInterval = setInterval(() => {
        attempts++;
        const hasOptions = Object.keys(tomSelect.options).length > 0;

        if (hasOptions) {
            clearInterval(checkInterval);
            tomSelect.close();

            if (tomSelect.options[value]) {
                tomSelect.setValue(value);

                if (hiddenInput) {
                    hiddenInput.value = value;
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
