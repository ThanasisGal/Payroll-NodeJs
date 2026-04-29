// /public/js/ergazomenoi/genika/date_sync_edit.js

document.addEventListener('DOMContentLoaded', function () {
    const proslhpshsInput = document.getElementById('hmeromhnia_proslhpshs');
    const allaghsSymbashsInput = document.getElementById('hmeromhnia_allaghs_symbashs');
    const lhxhsSymbashsInput = document.getElementById('hmeromhnia_lhxhs_symbashs');
    const orarioyApoInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
    const orarioyEosInput = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

    let previousLhxhsValue = lhxhsSymbashsInput?.value || '';
    let lhxhsChangeTimer = null;
    // ✅ ΝΕΟ: Debounce timer για allaghs_symbashs
    let allaghsChangeTimer = null;

    document.addEventListener(
        'click',
        function (event) {
            const clearBtn = event.target.closest(
                '.clear-button, .ts-clear, .remove, .trash, [data-ts-item-remove]'
            );
            if (clearBtn) {
            }
        },
        true
    );

    proslhpshsInput.addEventListener('blur', handleProslhpshChange);

    // ✅ ΔΙΟΡΘΩΣΗ: μόνο 'change' + debounced (ΟΧΙ blur)
    allaghsSymbashsInput.addEventListener('change', handleAllaghsChangeDebounced);

    orarioyApoInput.addEventListener('change', handleOrarioyApoChange);
    orarioyApoInput.addEventListener('blur', handleOrarioyApoChange);
    orarioyApoInput.addEventListener('input', handleOrarioyApoChange);

    orarioyEosInput.addEventListener('blur', handleOrarioyEosChange);

    if (lhxhsSymbashsInput) {
        lhxhsSymbashsInput.addEventListener('change', handleLhxhsChangeDebounced);
        lhxhsSymbashsInput.addEventListener('blur', handleLhxhsChangeDebounced);
    }

    document.querySelectorAll('input[type="date"], input[type="time"]').forEach((input) => {
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Tab') {
                event.preventDefault();
                const formElements = Array.from(
                    document.querySelectorAll('input, select, textarea, button')
                );
                const index = formElements.indexOf(this);
                const nextInput = formElements[index + 1];
                if (nextInput) {
                    setTimeout(() => nextInput.focus(), 0);
                }
            }
        });
    });

    const hmeresInput = document.getElementById('hmeres_ergasias_ebdomadas');
    const oresInput = document.getElementById('ores_ergasias_ebdomadas');
    const moOronInput = document.getElementById('mo_oron_hmerhsias_ergasias');

    if (hmeresInput && oresInput && moOronInput) {
        oresInput.addEventListener('blur', () => {
            calculateMoOron();
            validateOrarioErgasiasTab();
        });
        oresInput.addEventListener('change', () => {
            calculateMoOron();
            validateOrarioErgasiasTab();
        });
        hmeresInput.addEventListener('change', () => {
            calculateMoOron();
            validateOrarioErgasiasTab();
        });

        orarioyApoInput.addEventListener('change', validateOrarioErgasiasTab);
        orarioyEosInput.addEventListener('change', validateOrarioErgasiasTab);

        hmeresInput.addEventListener('blur', function () {
            const hmeres = parseFloat(this.value);

            if (isNaN(hmeres) || hmeres <= 0 || hmeres > 7) {
                const inputElement = this;

                Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: 'warning',
                    title: 'ΠΡΟΣΟΧΗ!',
                    text: 'Οι ημέρες εβδομαδιαίας εργασίας πρέπει να είναι μεταξύ 1 και 7.',
                    showConfirmButton: true,
                    confirmButtonText: 'Εντάξει',
                    customClass: {
                        confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                }).then(() => {
                    inputElement.value = '';
                    moOronInput.value = '';
                    setTimeout(() => inputElement.focus(), 100);
                });

                return;
            }

            calculateMoOron();
        });

        function calculateMoOron() {
            const hmeres = parseFloat(hmeresInput.value) || 0;
            const ores = parseFloat(oresInput.value) || 0;

            if (hmeres <= 0 || hmeres > 7 || hmeres === 0 || ores === 0) {
                moOronInput.value = '';
                return;
            }

            let low = 0;
            let high = 10;
            let moOron = ores / hmeres;
            let bestMoOron = moOron;
            let bestDiff = Math.abs(moOron * hmeres - ores);
            let iterations = 0;

            while (high - low > 0.0001 && iterations < 100) {
                moOron = (low + high) / 2;
                const check = moOron * hmeres;

                if (Math.abs(check - ores) < bestDiff) {
                    bestDiff = Math.abs(check - ores);
                    bestMoOron = moOron;
                }

                if (check < ores) {
                    low = moOron;
                } else if (check > ores) {
                    high = moOron;
                } else {
                    break;
                }

                iterations++;
            }

            moOron = parseFloat(bestMoOron.toFixed(4));

            if (moOron > 10) {
                Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: 'error',
                    title: 'Προσοχή!!!',
                    text: 'Ο Μ.Ο. ωρών ημερήσιας εργασίας δεν μπορεί να υπερβαίνει τις 10 ώρες. Παρακαλώ ελέγξτε τις τιμές που εισάγατε.',
                    showConfirmButton: true,
                    confirmButtonText: 'Εντάξει',
                    customClass: {
                        confirmButton: 'class-error custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                }).then(() => {
                    oresInput.value = '';
                    moOronInput.value = '';
                    setTimeout(() => oresInput.focus(), 100);
                });
            }

            moOronInput.value = moOron.toFixed(4);
        }

        if (hmeresInput.value && oresInput.value) {
            const hmeres = parseFloat(hmeresInput.value);
            if (hmeres > 0 && hmeres <= 7) {
                calculateMoOron();
            }
        }
    }

    let validateOrarioDebounceTimer = null;

    function validateOrarioErgasiasTab() {
        if (validateOrarioDebounceTimer) {
            clearTimeout(validateOrarioDebounceTimer);
        }

        validateOrarioDebounceTimer = setTimeout(() => {
            const apoDate = orarioyApoInput?.value;
            const eosDate = orarioyEosInput?.value;
            const hmeres = parseFloat(hmeresInput?.value);
            const ores = parseFloat(oresInput?.value);

            const orarioTab = Array.from(document.querySelectorAll('.menu_Links ul li')).find(
                (li) => li.textContent.trim() === 'Ωράριο Εργασίας'
            );

            if (!orarioTab) return;

            const isValid =
                apoDate &&
                eosDate &&
                apoDate <= eosDate &&
                !isNaN(hmeres) &&
                hmeres > 0 &&
                !isNaN(ores) &&
                ores > 0;

            if (isValid) {
                orarioTab.classList.remove('disabled');
            } else {
                orarioTab.classList.add('disabled');
            }
        }, 300);
    }

    async function bootstrapOrarioOnFormLoad() {
        const apoDate = orarioyApoInput?.value?.trim();
        const eosDate = orarioyEosInput?.value?.trim();

        if (!apoDate || !eosDate) return;

        const apoObj = new Date(apoDate);
        const eosObj = new Date(eosDate);

        if (isNaN(apoObj.getTime()) || isNaN(eosObj.getTime())) return;

        // ✅ ΝΕΟ: Guard για μη λογικές χρονιές
        if (apoObj.getFullYear() < 1900 || apoObj.getFullYear() > 2100) return;
        if (eosObj.getFullYear() < 1900 || eosObj.getFullYear() > 2100) return;

        if (eosObj < apoObj) return;

        await updateDateDifference(apoDate, eosDate);

        try {
            await waitForTomSelectControls();

            if (typeof autoSelectHolidaysOnInit === 'function') {
                autoSelectHolidaysOnInit();
            }

            updateKathgoriaBackgroundColor();
            hasInitializedOrariaTab = true;

            setTimeout(() => {
                calculateWeeklyTotalHours();
            }, 100);
        } catch (err) {
            console.error('bootstrapOrarioOnFormLoad failed:', err);
        }
    }

    validateOrarioErgasiasTab();

    setTimeout(() => {
        bootstrapOrarioOnFormLoad();
    }, 0);

    let hasInitializedOrariaTab = false;

    const menuLinks = document.querySelectorAll('.menu_Links ul li');

    menuLinks.forEach((li) => {
        if (li.textContent.trim() === 'Ωράριο Εργασίας') {
            li.addEventListener('click', async function () {
                if (this.classList.contains('disabled')) {
                    const apoDate = orarioyApoInput?.value;
                    const eosDate = orarioyEosInput?.value;
                    const hmeres = parseFloat(hmeresInput?.value);
                    const ores = parseFloat(oresInput?.value);

                    let missingFields = [];
                    if (!apoDate) missingFields.push('Ημερομηνία Αλλαγής Ωραρίου (ΑΠΟ)');
                    if (!eosDate) missingFields.push('Ημερομηνία Αλλαγής Ωραρίου (ΕΩΣ)');
                    if (apoDate && eosDate && apoDate > eosDate) {
                        missingFields.push('Η Ημερομηνία ΑΠΟ πρέπει να είναι <= ΕΩΣ');
                    }
                    if (isNaN(hmeres) || hmeres <= 0)
                        missingFields.push('Ημέρες Εργασίας Εβδομάδας');
                    if (isNaN(ores) || ores <= 0) missingFields.push('Ώρες Εργασίας Εβδομάδας');

                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'warning',
                        title: 'ΠΡΟΣΟΧΗ!',
                        html: `
                            <div style="text-align: center;">
                                <p>Για να ενεργοποιηθεί το <strong>Ωράριο Εργασίας</strong>, πρέπει να συμπληρώσετε:</p>
                                <ul style="text-align: left; display: inline-block; margin-top: 10px;">
                                    ${missingFields.map((field) => `<li>${field}</li>`).join('')}
                                </ul>
                            </div>
                        `,
                        showConfirmButton: true,
                        confirmButtonText: 'Εντάξει',
                        customClass: {
                            confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });

                    if (!apoDate) orarioyApoInput.focus();
                    else if (!eosDate) orarioyEosInput.focus();
                    else if (isNaN(hmeres) || hmeres <= 0) hmeresInput.focus();
                    else if (isNaN(ores) || ores <= 0) oresInput.focus();

                    return;
                }

                const moOronEl = document.getElementById('mo_oron_hmerhsias_ergasias');
                const moOronValue = moOronEl?.value || '';

                if (!moOronValue || moOronValue.trim() === '' || parseFloat(moOronValue) <= 0) {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'warning',
                        title: 'ΠΡΟΣΟΧΗ!',
                        text: 'Παρακαλώ συμπληρώστε πρώτα τις Ημέρες και Ώρες Εβδομαδιαίας Εργασίας για να υπολογιστεί ο Μ.Ο. ωρών ημερήσιας εργασίας.',
                        showConfirmButton: true,
                        confirmButtonText: 'Εντάξει',
                        customClass: {
                            confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });

                    document.querySelectorAll('section[data-section]').forEach((section) => {
                        section.classList.remove('visible');
                    });

                    const statheraSection = document.querySelector(
                        'section[data-section="Σταθερά Στοιχεία"]'
                    );
                    if (statheraSection) statheraSection.classList.add('visible');

                    document.querySelectorAll('.menu_Links ul li').forEach((menuLi) => {
                        if (menuLi.textContent.trim() === 'Σταθερά Στοιχεία') {
                            menuLi.classList.add('active');
                        } else {
                            menuLi.classList.remove('active');
                        }
                    });

                    setTimeout(() => {
                        const hEl = document.getElementById('hmeres_ergasias_ebdomadas');
                        if (hEl) hEl.focus();
                    }, 100);

                    return;
                }

                if (hasInitializedOrariaTab) {
                    return;
                }

                const loader = document.querySelector('.loader-container');
                if (loader) {
                    loader.classList.add('visible');
                    loader.classList.remove('is-hidden');
                }

                try {
                    await waitForTomSelectControls();

                    if (typeof autoSelectHolidaysOnInit === 'function') {
                        autoSelectHolidaysOnInit();
                    }

                    await new Promise((resolve) => setTimeout(resolve, 200));
                    updateKathgoriaBackgroundColor();

                    hasInitializedOrariaTab = true;
                } catch (error) {
                    console.error('❌ Error:', error);
                } finally {
                    setTimeout(() => {
                        if (loader) {
                            loader.classList.remove('visible');
                            loader.classList.add('is-hidden');
                        }
                    }, 100);
                }
            });
        }
    });

    function waitForTomSelectControls() {
        return new Promise((resolve, reject) => {
            const maxWaitTime = 15000;
            const checkInterval = 100;
            let elapsedTime = 0;

            const interval = setInterval(() => {
                const tsControls = document.querySelectorAll('#dynamicFields .ts-control');
                const differenceInDays = parseInt(
                    document.getElementById('differenceInDays')?.value || 0
                );

                if (tsControls.length >= differenceInDays && differenceInDays > 0) {
                    clearInterval(interval);
                    resolve();
                }

                elapsedTime += checkInterval;
                if (elapsedTime >= maxWaitTime) {
                    clearInterval(interval);
                    reject(new Error('Timeout waiting for TomSelect controls'));
                }
            }, checkInterval);
        });
    }

    // =========================================================================
    // HANDLERS
    // =========================================================================

    async function handleProslhpshChange() {
        const value = this.value;
        if (!value) return;
        // ✅ Guard: χρονιά πρέπει να είναι λογική
        const year = new Date(value).getFullYear();
        if (year < 1900 || year > 2100) return;

        setAllDates(value);
        await updateOrarioyEosDate(value);
    }

    // ✅ ΝΕΟ: Debounced handler για allaghs_symbashs
    function handleAllaghsChangeDebounced() {
        if (allaghsChangeTimer) clearTimeout(allaghsChangeTimer);
        allaghsChangeTimer = setTimeout(() => {
            handleAllaghsChange();
        }, 500);
    }

    function handleAllaghsChange() {
        const value = allaghsSymbashsInput.value;
        if (!value) return;
        // ✅ Guard: χρονιά πρέπει να είναι λογική
        const year = new Date(value).getFullYear();
        if (year < 1900 || year > 2100) return;

        setAllDates(value);
    }

    async function handleOrarioyApoChange() {
        const value = this.value;
        if (!value) return;
        // ✅ Guard: χρονιά πρέπει να είναι λογική
        const year = new Date(value).getFullYear();
        if (year < 1900 || year > 2100) return;

        await updateOrarioyEosDate(value);
    }

    function handleLhxhsChangeDebounced() {
        if (lhxhsChangeTimer) clearTimeout(lhxhsChangeTimer);
        lhxhsChangeTimer = setTimeout(() => handleLhxhsChange(), 500);
    }

    async function handleLhxhsChange() {
        const currentValue = lhxhsSymbashsInput?.value || '';

        // ✅ Guard: χρονιά πρέπει να είναι λογική
        if (currentValue) {
            const year = new Date(currentValue).getFullYear();
            if (year < 1900 || year > 2100) return;
        }

        if (currentValue === previousLhxhsValue) return;
        previousLhxhsValue = currentValue;

        const apoDate = orarioyApoInput?.value;
        if (!apoDate) return;

        const startDateParsed = new Date(apoDate);
        if (isNaN(startDateParsed.getTime())) return;

        // ✅ Guard: χρονιά apoDate
        const apoYear = startDateParsed.getFullYear();
        if (apoYear < 1900 || apoYear > 2100) return;

        let eosDateParsed = new Date(startDateParsed);
        eosDateParsed.setDate(eosDateParsed.getDate() + 6);

        if (currentValue && currentValue.trim() !== '') {
            const lhxhsDate = new Date(currentValue);
            if (!isNaN(lhxhsDate.getTime()) && eosDateParsed > lhxhsDate) {
                eosDateParsed = lhxhsDate;
            }
        }

        // ✅ ΔΙΟΡΘΩΣΗ yearEnd: setMonth/setDate αντί new Date(year, 11, 31)
        const yearEnd = new Date(startDateParsed);
        yearEnd.setMonth(11);
        yearEnd.setDate(31);
        if (eosDateParsed > yearEnd) eosDateParsed = yearEnd;

        orarioyEosInput.value = formatDateToISO(eosDateParsed);
    }

    async function handleOrarioyEosChange() {
        const eosDate = this.value;
        const apoDate = orarioyApoInput.value;

        // ✅ Guard: χρονιά πρέπει να είναι λογική
        if (eosDate) {
            const year = new Date(eosDate).getFullYear();
            if (year < 1900 || year > 2100) return;
        }

        let isValidDateChange = await validateDateChange(apoDate, eosDate);

        if (eosDate === '') isValidDateChange = false;

        if (!isValidDateChange) {
            await updateOrarioyEosDate(apoDate);
            return;
        }

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
        updateOrarioyEosDate(value);
    }

    /**
     * ✅ ΔΙΟΡΘΩΣΗ: Guard για μη λογικές χρονιές + fix yearEnd
     */
    async function updateOrarioyEosDate(startDate) {
        if (!startDate) return;

        const startDateParsed = new Date(startDate);
        if (isNaN(startDateParsed.getTime())) return;

        // ✅ ΝΕΟ: Guard για μη λογικές χρονιές
        // Όταν ο χρήστης πληκτρολογεί π.χ. "2" στο year, το Chrome φτιάχνει "0002-MM-DD"
        const year = startDateParsed.getFullYear();
        if (year < 1900 || year > 2100) return;

        let eosDateParsed = new Date(startDateParsed);
        eosDateParsed.setDate(eosDateParsed.getDate() + 6);

        if (lhxhsSymbashsInput?.value && lhxhsSymbashsInput.value.trim() !== '') {
            const lhxhsDate = new Date(lhxhsSymbashsInput.value);
            if (!isNaN(lhxhsDate.getTime()) && eosDateParsed > lhxhsDate) {
                eosDateParsed = lhxhsDate;
            }
        }

        // ✅ ΔΙΟΡΘΩΣΗ: χρήση setMonth/setDate αντί new Date(year, 11, 31)
        // new Date(2, 11, 31) επιστρέφει 1902 λόγω JavaScript quirk για χρονιές 0-99!
        const yearEnd = new Date(startDateParsed);
        yearEnd.setMonth(11);
        yearEnd.setDate(31);
        if (eosDateParsed > yearEnd) eosDateParsed = yearEnd;

        orarioyEosInput.value = formatDateToISO(eosDateParsed);

        await updateDateDifference(startDate, formatDateToISO(eosDateParsed));
    }

    async function validateDateChange(apoDate, eosDate) {
        if (!apoDate || !eosDate) return false;

        const apoDateObj = new Date(apoDate);
        const eosDateObj = new Date(eosDate);

        // ✅ ΝΕΟ: Guard για μη λογικές χρονιές
        if (apoDateObj.getFullYear() < 1900 || apoDateObj.getFullYear() > 2100) return false;
        if (eosDateObj.getFullYear() < 1900 || eosDateObj.getFullYear() > 2100) return false;

        if (eosDateObj < apoDateObj) {
            alert(`Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι πριν από την ${formatDate(apoDateObj)}.`);
            return false;
        }

        if (lhxhsSymbashsInput?.value) {
            const lhxhsDate = new Date(lhxhsSymbashsInput.value);
            if (!isNaN(lhxhsDate.getTime()) && eosDateObj > lhxhsDate) {
                alert(
                    `Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι μετά τη λήξη της σύμβασης (${formatDate(lhxhsDate)}).`
                );
                return false;
            }
        }

        // ✅ ΔΙΟΡΘΩΣΗ yearEnd: setMonth/setDate
        const yearEnd = new Date(apoDateObj);
        yearEnd.setMonth(11);
        yearEnd.setDate(31);
        if (eosDateObj > yearEnd) {
            alert(`Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι μετά την ${formatDate(yearEnd)}.`);
            return false;
        }

        const maxDate = new Date(apoDateObj);
        maxDate.setDate(maxDate.getDate() + 31);
        if (eosDateObj > maxDate) {
            alert(
                `Η Ημερ/νία ΕΩΣ πρέπει να είναι μεταξύ της ${formatDate(apoDateObj)} και της ${formatDate(maxDate)} (μέγιστο 31 ημέρες).`
            );
            return false;
        }

        return true;
    }

    // =========================================================================
    // API CALLS
    // =========================================================================

    let isUpdatingDateDifference = false;

    async function updateDateDifference(startDate, endDate) {
        if (isUpdatingDateDifference) {
            return;
        }

        isUpdatingDateDifference = true;

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

            if (!csrfToken) {
                throw new Error('CSRF token missing. Please refresh the page.');
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
            if (!container) return;

            const oldSelects = container.querySelectorAll('select.tom-dropdown');
            oldSelects.forEach((sel) => {
                if (sel.id && window.destroyTomSelectById) {
                    window.destroyTomSelectById(sel.id);
                }
            });

            container.innerHTML = '';

            const kodikos = document.getElementById('kodikosHidden')?.value || '';
            let prodhlomenaMap = {};

            try {
                const prodhlomenaResponse = await fetch('/api/getProdhlomenaOraria', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken,
                        'X-CSRF-Token': csrfToken
                    },
                    credentials: 'include',
                    body: JSON.stringify({ kodikos, startDate, endDate })
                });

                if (prodhlomenaResponse.ok) {
                    const prodhlomenaData = await prodhlomenaResponse.json();

                    prodhlomenaData.forEach((record) => {
                        const dateKey = record.hmeromhnia.toString().split('T')[0];
                        prodhlomenaMap[dateKey] = record;
                    });
                }
            } catch (prodError) {
                console.warn('⚠️ Δεν ήταν δυνατή η φόρτωση ProdhlomenaOraria:', prodError);
            }

            for (let i = 1; i <= data.differenceInDays; i++) {
                const i1 = i < 10 ? '0' + i : String(i);

                const currentDateObj = new Date(startDate);
                currentDateObj.setDate(currentDateObj.getDate() + (i - 1));
                const yyyy = currentDateObj.getFullYear();
                const mm = String(currentDateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(currentDateObj.getDate()).padStart(2, '0');
                const currentDateKey = `${yyyy}-${mm}-${dd}`;

                const prod = prodhlomenaMap[currentDateKey] || null;

                const pKathgoria = prod?.kathgoria_ergasias || '';
                const pApoOra01 = prod?.apo_ora_01 || '';
                const pEosOra01 = prod?.eos_ora_01 || '';
                const pDialApo01 = prod?.dialleima_apo_ora_01 || '';
                const pDialEos01 = prod?.dialleima_eos_ora_01 || '';
                const pApoOra02 = prod?.apo_ora_02 || '';
                const pEosOra02 = prod?.eos_ora_02 || '';
                const pDialApo02 = prod?.dialleima_apo_ora_02 || '';
                const pDialEos02 = prod?.dialleima_eos_ora_02 || '';
                const pApoOra03 = prod?.apo_ora_03 || '';
                const pEosOra03 = prod?.eos_ora_03 || '';
                const pDialApo03 = prod?.dialleima_apo_ora_03 || '';
                const pDialEos03 = prod?.dialleima_eos_ora_03 || '';
                const pRepo = prod?.repo || false;
                const pArgia = prod?.argia || false;
                const pPerigrafh = prod?.perigrafh_argias || '';

                const labelRepoText = pRepo ? 'ΝΑΙ' : 'ΟΧΙ';
                const labelArgiaText = pArgia ? 'ΝΑΙ' : 'ΟΧΙ';

                const eidikh = document.getElementById('eidikh_kathgoria_stathera')?.value || '';
                const isHolidayEnabled = eidikh === '0004' || eidikh === '0005' || pApoOra03 !== '';
                const disabledAttr = isHolidayEnabled ? '' : 'disabled';

                const divHtml = `
                    <input type="hidden" name="total_hours_day_${i1}"                       id="total_hours_day_${i1}"                       value="0" />
                    <input type="hidden" name="night_hours_day_${i1}"                       id="night_hours_day_${i1}"                       value="0" />
                    <input type="hidden" name="holiday_hours_day_${i1}"                     id="holiday_hours_day_${i1}"                     value="0" />
                    <input type="hidden" name="overwork_hours_day_${i1}"                    id="overwork_hours_day_${i1}"                    value="0" />
                    <input type="hidden" name="night_overwork_hours_day_${i1}"              id="night_overwork_hours_day_${i1}"              value="0" />
                    <input type="hidden" name="holiday_overwork_hours_day_${i1}"            id="holiday_overwork_hours_day_${i1}"            value="0" />
                    <input type="hidden" name="night_holiday_overwork_hours_day_${i1}"      id="night_holiday_overwork_hours_day_${i1}"      value="0" />
                    <input type="hidden" name="overtimeNomimh_hours_day_${i1}"              id="overtimeNomimh_hours_day_${i1}"              value="0" />
                    <input type="hidden" name="night_overtimeNomimh_hours_day_${i1}"        id="night_overtimeNomimh_hours_day_${i1}"        value="0" />
                    <input type="hidden" name="holiday_overtimeNomimh_hours_day_${i1}"      id="holiday_overtimeNomimh_hours_day_${i1}"      value="0" />
                    <input type="hidden" name="night_holiday_overtimeNomimh_hours_day_${i1}" id="night_holiday_overtimeNomimh_hours_day_${i1}" value="0" />
                    <input type="hidden" name="overtimeParanomh_hours_day_${i1}"            id="overtimeParanomh_hours_day_${i1}"            value="0" />
                    <input type="hidden" name="night_overtimeParanomh_hours_day_${i1}"      id="night_overtimeParanomh_hours_day_${i1}"      value="0" />
                    <input type="hidden" name="holiday_overtimeParanomh_hours_day_${i1}"    id="holiday_overtimeParanomh_hours_day_${i1}"    value="0" />
                    <input type="hidden" name="night_holiday_overtimeParanomh_hours_day_${i1}" id="night_holiday_overtimeParanomh_hours_day_${i1}" value="0" />
                    <div class="row form-group align-items-center bg-white">
                        <div class="col-0-5 align-left">
                            <label for="hmeromhnia_${i1}" class="col-form-label field-required" id="day_label_${i1}"></label>
                        </div>

                        <div class="col-1-5 align-center">
                            <input type="date" class="date-control input-date"
                                id="hmeromhnia_${i1}" name="hmeromhnia_${i1}"
                                value="" readonly />
                        </div>

                        <div class="col-2-75">
                            <input type="hidden"
                                name="kathgoria_ergasias_sthathera_${i1}"
                                id="kathgoria_ergasias_stathera_${i1}"
                                value="${pKathgoria}" />
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

                        <div class="col-1-2">
                            <input type="time" class="date-control clearableInput text-center"
                                id="apo_ora_01_${i1}" name="apo_ora_01_${i1}"
                                value="${pApoOra01}" />
                        </div>
                        <div class="col-1-2">
                            <input type="time" class="date-control clearableInput text-center"
                                id="eos_ora_01_${i1}" name="eos_ora_01_${i1}"
                                value="${pEosOra01}" />
                        </div>
                        <div class="col-0-5"></div>
                            <div class="col-1-2">
                            <input type="time" class="date-control clearableInput text-center"
                                id="dialleima_apo_ora_01_${i1}" name="dialleima_apo_ora_01_${i1}"
                                value="${pDialApo01}" />
                        </div>
                        <div class="col-1-1-80">
                            <input type="time" class="date-control clearableInput text-center"
                                id="dialleima_eos_ora_01_${i1}" name="dialleima_eos_ora_01_${i1}"
                                value="${pDialEos01}" />
                        </div>

                        <div class="col-0-75"></div>

                        <div class="col-0-5 center-align checkbox-flex-center mt-0_4rem">
                            <input type="checkbox" class="form-check-input custom-checkbox checkbox-class"
                                id="repo_${i1}" name="repo_${i1}" tabIndex="-1"
                                ${pRepo ? 'checked' : ''} />
                            <label for="repo_${i1}" class="ml0_75-fs-0_875vw" id="label-repo_${i1}">
                                ${labelRepoText}
                            </label>
                        </div>
                        <div class="col-0-5 center-align checkbox-flex-center dispno-mt-0_4rem">
                            <input type="checkbox" class="form-check-input custom-checkbox checkbox-class"
                                id="argia_${i1}" name="argia_${i1}"
                                ${pArgia ? 'checked' : ''} />
                            <label for="argia_${i1}" class="ml0_75-fs-0_875vw" id="label-argia_${i1}">
                                ${labelArgiaText}
                            </label>
                        </div>

                        <div class="row form-group align-items-center bg-white mb-2">
                            <div class="col-5-0 left-align">
                                <input type="text" class="argia-label mt-0_5rem-fs0_7rem-border-0"
                                    tabIndex="-1"
                                    id="perigrafh_argias_${i1}" name="perigrafh_argias_${i1}"
                                    value="${pPerigrafh}" readonly />
                            </div>
                            <div class="col-1-2-1">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="apo_ora_02_${i1}" name="apo_ora_02_${i1}"
                                    value="${pApoOra02}" />
                            </div>
                            <div class="col-1-2-01">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="eos_ora_02_${i1}" name="eos_ora_02_${i1}"
                                    value="${pEosOra02}" />
                            </div>
                            <div class="col-0-5"></div>
                                <div class="col-1-2 ml-0_2_1rem">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="dialleima_apo_ora_02_${i1}" name="dialleima_apo_ora_02_${i1}"
                                    value="${pDialApo02}" />
                            </div>
                            <div class="col-1-2">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="dialleima_eos_ora_02_${i1}" name="dialleima_eos_ora_02_${i1}"
                                    value="${pDialEos02}" />
                            </div>
                        </div>

                        <div class="row form-group align-items-center bg-white">
                            <div class="col-5-0 left-align">
                                <input type="text" class="argia-label mt-0_5rem-fs0_7rem-border-0"
                                    tabIndex="-1"
                                    id="holiday_label_${i1}" name="holiday_label_${i1}" readonly />
                            </div>
                            <div class="col-1-2-1">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="apo_ora_03_${i1}" name="apo_ora_03_${i1}"
                                    value="${pApoOra03}" ${disabledAttr} />
                            </div>
                            <div class="col-1-2-01">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="eos_ora_03_${i1}" name="eos_ora_03_${i1}"
                                    value="${pEosOra03}" ${disabledAttr} />
                            </div>
                            <div class="col-0-5"></div>
                                <div class="col-1-2 ml-0_3rem">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="dialleima_apo_ora_03_${i1}" name="dialleima_apo_ora_03_${i1}"
                                    value="${pDialApo03}" ${disabledAttr} />
                            </div>
                            <div class="col-1-2 ml--0_1rem">
                                <input type="time" class="date-control clearableInput text-center"
                                    id="dialleima_eos_ora_03_${i1}" name="dialleima_eos_ora_03_${i1}"
                                    value="${pDialEos03}" ${disabledAttr} />
                            </div>
                        </div>

                    </div>
                    <hr class="mt0_4rem-mb0_3rem" />
                `;

                container.insertAdjacentHTML('beforeend', divHtml);
            }

            updateDates();
            setupEnterKeyNavigation();

            setTimeout(() => {
                if (window.reinitTomDropdowns) window.reinitTomDropdowns(container);
                if (window.initClearableInputs) window.initClearableInputs(container);
                initializeSelectListeners();
            }, 200);

            for (let i = 1; i <= data.differenceInDays; i++) {
                const i1 = i < 10 ? '0' + i : String(i);

                for (let j = 1; j <= 3; j++) {
                    const jj = j < 10 ? '0' + j : String(j);
                    const eosOraEl = document.getElementById(`eos_ora_${jj}_${i1}`);
                    if (eosOraEl) {
                        eosOraEl.addEventListener('blur', () => calculateWeeklyTotalHours());
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error in updateDateDifference:', error);
            throw error;
        } finally {
            isUpdatingDateDifference = false;
        }
    }

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    function updateKathgoriaBackgroundColor() {
        const differenceInDays = parseInt(document.getElementById('differenceInDays')?.value || 0);
        const allTsControls = document.querySelectorAll('#dynamicFields .ts-control');
        const apasxolhshTisArgies =
            document.getElementById('apasxolhshTisArgies')?.value === 'true';

        for (let i = 1; i <= differenceInDays; i++) {
            const i1 = i < 10 ? '0' + i : String(i);
            const selectElement = document.getElementById(`kathgoria_ergasias_${i1}`);
            if (!selectElement) continue;

            const tsControl = allTsControls[i - 1];
            if (!tsControl) continue;

            const updateBackground = () => {
                const value = selectElement.value;
                const perigrafh = document.getElementById(`perigrafh_argias_${i1}`)?.value || '';
                const dateField = document.getElementById(`hmeromhnia_${i1}`);
                const isHoliday = dateField && dateField.style.color === 'red';

                if (value === 'ΜΕ') {
                    if (perigrafh && perigrafh.trim() !== '') {
                        tsControl.style.setProperty('background-color', '#eeff0223', 'important');
                        tsControl.style.setProperty('border-color', '#fbc02d', 'important');
                        for (let j = 1; j <= 3; j++) {
                            applyColorToTimeFields(i1, j, '#eeff0223', '#fbc02d', true);
                        }
                    } else if (apasxolhshTisArgies && isHoliday) {
                        tsControl.style.setProperty('background-color', '#eeff0223', 'important');
                        tsControl.style.setProperty('border-color', '#fbc02d', 'important');
                        const eidikh =
                            document.getElementById('eidikh_kathgoria_stathera')?.value || '';
                        const isSpecialCat = eidikh === '0004' || eidikh === '0005';
                        for (let j = 1; j <= 3; j++) {
                            applyColorToTimeFields(
                                i1,
                                j,
                                '#eeff0223',
                                '#fbc02d',
                                j === 1 || j === 2 || (j === 3 && isSpecialCat)
                            );
                        }
                    } else {
                        tsControl.style.setProperty('background-color', '', 'important');
                        tsControl.style.setProperty('border-color', '#cccccc', 'important');
                        for (let j = 1; j <= 3; j++) {
                            applyColorToTimeFields(i1, j, '', '#cccccc', false);
                        }
                    }
                } else if (value === 'ΑΝ') {
                    tsControl.style.setProperty('background-color', '#2b97001e', 'important');
                    tsControl.style.setProperty('border-color', '#66bb6a', 'important');
                    for (let j = 1; j <= 3; j++) {
                        applyColorToTimeFields(i1, j, '#2b97001e', '#66bb6a', false);
                    }
                } else {
                    tsControl.style.setProperty('background-color', '#ffffff', 'important');
                    tsControl.style.setProperty('border-color', '#cccccc', 'important');
                    for (let j = 1; j <= 3; j++) {
                        applyColorToTimeFields(i1, j, '', '#cccccc', false);
                    }
                }
            };

            if (!selectElement.dataset.bgListenerBound) {
                if (selectElement.tomselect) {
                    selectElement.tomselect.on('change', function () {
                        updateBackground();
                    });
                } else {
                    selectElement.addEventListener('change', function () {
                        updateBackground();
                    });
                }
                selectElement.dataset.bgListenerBound = '1';
            }

            updateBackground();

            const initialValue =
                selectElement.value ||
                document.getElementById(`kathgoria_ergasias_stathera_${i1}`)?.value ||
                '';
            if (typeof updateNumericFields === 'function') {
                updateNumericFields(i1, initialValue);
            }
        }
    }

    function applyColorToTimeFields(i1, j, bgColor, borderColor, shouldEnable) {
        const jj = j < 10 ? '0' + j : String(j);
        const fields = [
            `apo_ora_${jj}_${i1}`,
            `eos_ora_${jj}_${i1}`,
            `dialleima_apo_ora_${jj}_${i1}`,
            `dialleima_eos_ora_${jj}_${i1}`
        ];

        fields.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;

            if (bgColor) {
                field.style.setProperty('background-color', bgColor, 'important');
                field.style.setProperty('border-color', borderColor, 'important');
            } else {
                field.style.setProperty('background-color', '', 'important');
                field.style.setProperty('border-color', borderColor, 'important');
            }

            if (shouldEnable === true) {
                field.removeAttribute('disabled');
            }
        });
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
            input.addEventListener('keypress', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const nextInput = inputs[index + 1];
                    if (nextInput) nextInput.focus();
                }
            });

            input.addEventListener('keydown', function (event) {
                if (event.key === 'Tab') {
                    event.preventDefault();
                    if (event.shiftKey) {
                        const prevInput = inputs[index - 1];
                        if (prevInput) prevInput.focus();
                    } else {
                        const nextInput = inputs[index + 1];
                        if (nextInput) nextInput.focus();
                    }
                }
            });
        });
    }

    function calculateWeeklyTotalHours() {
        let totalMinutes = 0;
        const differenceInDays = parseInt(document.getElementById('differenceInDays')?.value || 0);
        const moOronEl = document.getElementById('mo_oron_hmerhsias_ergasias');
        const moOron = parseFloat(moOronEl?.value) || 0;

        const dailyHours = {};
        let hasExceeded = false;
        const exceededDays = [];
        let hasRestViolation = false;
        const restViolations = [];
        let previousDayEndTime = null;
        let allKathgoriesCompleted = true;

        for (let i = 1; i <= differenceInDays; i++) {
            const i1 = i < 10 ? '0' + i : String(i);
            let dailyMinutes = 0;

            const kathgoriaVal =
                document.getElementById(`kathgoria_ergasias_stathera_${i1}`)?.value || '';
            if (!kathgoriaVal || !['ΑΝ', 'ΕΡΓ', 'ΜΕ', 'ΤΗΛ'].includes(kathgoriaVal)) {
                allKathgoriesCompleted = false;
            }

            let currentDayStartTime = null;
            let currentDayEndTime = null;

            for (let j = 1; j <= 3; j++) {
                const jj = j < 10 ? '0' + j : String(j);
                const apoOra = document.getElementById(`apo_ora_${jj}_${i1}`)?.value;
                const eosOra = document.getElementById(`eos_ora_${jj}_${i1}`)?.value;

                if (!apoOra || !eosOra) continue;

                const apoMinutes = timeToMinutes(apoOra);
                const eosMinutes = timeToMinutes(eosOra);
                let diffMinutes = eosMinutes - apoMinutes;
                if (diffMinutes < 0) diffMinutes += 24 * 60;

                dailyMinutes += diffMinutes;
                totalMinutes += diffMinutes;

                if (currentDayStartTime === null) currentDayStartTime = apoMinutes;
                currentDayEndTime = eosMinutes;
            }

            const dailyHoursValue = dailyMinutes / 60;
            dailyHours[i1] = dailyHoursValue;

            if (moOron > 0 && dailyHoursValue > moOron) {
                hasExceeded = true;
                const dayLabel =
                    document.getElementById(`day_label_${i1}`)?.textContent || `Ημέρα ${i}`;
                exceededDays.push({
                    day: dayLabel,
                    hours: dailyHoursValue.toFixed(2),
                    mo: moOron.toFixed(4)
                });
            }

            if (i > 1 && previousDayEndTime !== null && currentDayStartTime !== null) {
                const prevI1 = i - 1 < 10 ? '0' + (i - 1) : String(i - 1);

                let prevDayHadWork = false;
                for (let j = 1; j <= 3; j++) {
                    const jj = j < 10 ? '0' + j : String(j);
                    const prevApoOra = document.getElementById(`apo_ora_${jj}_${prevI1}`)?.value;
                    const prevEosOra = document.getElementById(`eos_ora_${jj}_${prevI1}`)?.value;
                    if (prevApoOra && prevEosOra) {
                        prevDayHadWork = true;
                        break;
                    }
                }

                if (prevDayHadWork && dailyMinutes > 0 && previousDayEndTime > 0) {
                    let restMinutes = currentDayStartTime - previousDayEndTime;
                    if (restMinutes < 0) restMinutes += 24 * 60;
                    const restHours = restMinutes / 60;

                    if (restHours < 11) {
                        hasRestViolation = true;
                        const prevLabel =
                            document.getElementById(`day_label_${prevI1}`)?.textContent ||
                            `Ημέρα ${i - 1}`;
                        const currentLabel =
                            document.getElementById(`day_label_${i1}`)?.textContent || `Ημέρα ${i}`;
                        restViolations.push({
                            prevDay: prevLabel,
                            currentDay: currentLabel,
                            restHours: restHours.toFixed(2)
                        });
                    }
                }
            }

            previousDayEndTime =
                dailyMinutes > 0 && currentDayEndTime !== null && currentDayEndTime > 0
                    ? currentDayEndTime
                    : null;
        }

        const totalHours = (totalMinutes / 60).toFixed(2);
        const totalInput = document.getElementById('total_hours_day');

        if (totalInput && parseFloat(totalHours) <= 40) {
            totalInput.value = totalHours;
        } else if (parseFloat(totalHours) > 40) {
            return false;
        }

        if (hasExceeded) {
            const daysMessage = exceededDays
                .map(
                    (day) =>
                        `<div style="text-align:left; margin:5px 0;">
                    <strong>${day.day}:</strong> ${day.hours} ώρες (Μ.Ο.: ${day.mo})
                </div>`
                )
                .join('');

            Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'warning',
                title: 'ΠΡΟΣΟΧΗ - ΥΠΕΡΒΑΣΗ ΩΡΩΝ!!!',
                html: `
                    <div style="text-align:center;">
                        <p>Οι παρακάτω ημέρες έχουν περισσότερες ώρες από τον Μ.Ο. ημερήσιας εργασίας:</p>
                        ${daysMessage}
                    </div>`,
                showConfirmButton: true,
                confirmButtonText: 'Το κατάλαβα',
                customClass: {
                    confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
        }

        if (hasRestViolation) {
            const restMessage = restViolations
                .map(
                    (v) =>
                        `<div style="text-align:left; margin:5px 0;">
                    <strong>${v.prevDay} → ${v.currentDay}:</strong> ${v.restHours} ώρες ανάπαυσης
                </div>`
                )
                .join('');

            Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'error',
                title: 'ΠΡΟΣΟΧΗ - ΠΑΡΑΒΙΑΣΗ ΗΜΕΡΗΣΙΑΣ ΑΝΑΠΑΥΣΗΣ!!!',
                html: `
                    <div style="text-align:center;">
                        <p>Οι παρακάτω ημέρες δεν έχουν την απαιτούμενη ανάπαυση 11 ωρών:</p>
                        ${restMessage}
                        <br><br>
                        <p style="color:red; font-weight:bold;">Απαιτούνται τουλάχιστον 11 ώρες ανάπαυσης μεταξύ εργάσιμων ημερών!</p>
                    </div>`,
                showConfirmButton: true,
                confirmButtonText: 'Το κατάλαβα',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
        }

        if (allKathgoriesCompleted) {
            const oresErgasiasInput = document.getElementById('ores_ergasias_ebdomadas');
            if (oresErgasiasInput?.value) {
                const expectedHours = parseFloat(oresErgasiasInput.value);
                const actualHours = parseFloat(totalHours);

                if (actualHours !== expectedHours) {
                    Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'info',
                        title: 'ΠΡΟΣΟΧΗ!!!',
                        text: 'Δεν συμφωνούν οι ώρες εβδομαδιαίας εργασίας με το σύνολο των ωρών του δηλωθέντος ωραρίου.',
                        showConfirmButton: true,
                        confirmButtonText: 'Κλείσιμο',
                        customClass: {
                            confirmButton: 'class-info custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });
                }
            }
        }

        return true;
    }

    function timeToMinutes(timeString) {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
});
