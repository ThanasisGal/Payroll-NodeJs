// /public/js/ergazomenoi/genika/date_sync_add.js

document.addEventListener('DOMContentLoaded', function () {
    const proslhpshsInput = document.getElementById('hmeromhnia_proslhpshs');
    const allaghsSymbashsInput = document.getElementById('hmeromhnia_allaghs_symbashs');
    const lhxhsSymbashsInput = document.getElementById('hmeromhnia_lhxhs_symbashs');
    const orarioyApoInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
    const orarioyEosInput = document.getElementById('hmeromhnia_allaghs_orarioy_eos');
    const isxyosOronErgasiasApoInput = document.getElementById(
        'hmeromhnia_isxyos_oron_ergasias_apo'
    );

    // ✅ ΝΕΟΣ: Κρατάμε το προηγούμενο value της λήξης σύμβασης
    let previousLhxhsValue = lhxhsSymbashsInput?.value || '';

    // ✅ ΝΕΟΣ: Debounce timers
    let lhxhsChangeTimer = null;
    // ✅ ΝΕΟ: Debounce timer για allaghs_symbashs
    let allaghsChangeTimer = null;

    // ✅ ΔΙΟΡΘΩΣΗ: proslhpshs μόνο blur
    proslhpshsInput.addEventListener('blur', handleProslhpshChange);

    // ✅ ΔΙΟΡΘΩΣΗ: allaghs_symbashs μόνο change (ΟΧΙ blur) + debounced
    allaghsSymbashsInput.addEventListener('change', handleAllaghsChangeDebounced);

    orarioyApoInput.addEventListener('change', handleOrarioyApoChange);
    orarioyApoInput.addEventListener('blur', handleOrarioyApoChange);
    orarioyApoInput.addEventListener('input', handleOrarioyApoChange);

    orarioyEosInput.addEventListener('blur', handleOrarioyEosChange);

    // ✅ ΔΙΟΡΘΩΣΗ: Χρήση debounced handler
    if (lhxhsSymbashsInput) {
        lhxhsSymbashsInput.addEventListener('change', handleLhxhsChangeDebounced);
        lhxhsSymbashsInput.addEventListener('blur', handleLhxhsChangeDebounced);
    }

    // Tab navigation για date/time inputs
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

    // =========================================================================
    // ✅ Event listeners για Μ.  Ο. ωρών ημερήσιας εργασίας
    // =========================================================================
    const hmeresInput = document.getElementById('hmeres_ergasias_ebdomadas');
    const oresInput = document.getElementById('ores_ergasias_ebdomadas');
    const moOronInput = document.getElementById('mo_oron_hmerhsias_ergasias');

    if (hmeresInput && oresInput && moOronInput) {
        // ✅ Event listeners για Μ. Ο.
        oresInput.addEventListener('blur', () => {
            calculateMoOron();
            validateOrarioErgasiasTab(); // ✅ Call μετά τον υπολογισμό
        });
        oresInput.addEventListener('change', () => {
            calculateMoOron();
            validateOrarioErgasiasTab();
        });
        hmeresInput.addEventListener('change', () => {
            calculateMoOron();
            validateOrarioErgasiasTab();
        });

        // ✅ ΜΟΝΟ change events για τα date fields (ΟΧΙ blur!)
        orarioyApoInput.addEventListener('change', validateOrarioErgasiasTab);
        orarioyEosInput.addEventListener('change', validateOrarioErgasiasTab);

        // ✅ EVENT LISTENER:  Validation για hmeres_ergasias_ebdomadas
        hmeresInput.addEventListener('blur', function () {
            const hmeres = parseFloat(this.value);

            // ✅ Έλεγχος:  > 0 και <= 7
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

                    setTimeout(() => {
                        inputElement.focus();
                    }, 100);
                });

                return;
            }

            // ✅ Valid value → Calculate MO
            calculateMoOron();
        });

        /**
         * ✅ Υπολογισμός Μ.Ο. ώρών με BINARY SEARCH για ακρίβεια
         */
        function calculateMoOron() {
            const hmeres = parseFloat(hmeresInput.value) || 0;
            const ores = parseFloat(oresInput.value) || 0;

            // ✅ Validation check για hmeres
            if (hmeres <= 0 || hmeres > 7) {
                moOronInput.value = '';
                return;
            }

            if (hmeres === 0 || ores === 0) {
                moOronInput.value = '';
                return;
            }

            // ✅ Binary search για το σωστό mo_oron
            let low = 0;
            let high = 10; // max 10 ώρες/ημέρα
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
                    break; // Exact match!
                }

                iterations++;
            }

            moOron = parseFloat(bestMoOron.toFixed(4));

            // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: moOron ΔΕΝ μπορεί να είναι > 10
            if (moOron > 10) {
                Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: 'error',
                    title: 'Προσοχή !!! ',
                    text: 'Ο Μ.Ο. ωρών ημερ��σιας εργασίας δεν μπορεί να υπερβαίνει τις 10 ώρες.  Παρακαλώ ελέγξτε τις τιμές που εισάγατε.',
                    showConfirmButton: true,
                    confirmButtonText: 'Εντάξει',
                    customClass: {
                        confirmButton: 'class-error custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                }).then(() => {
                    // ✅ Clear τα πεδία
                    oresInput.value = '';
                    moOronInput.value = '';

                    // ✅ Focus στο ores
                    setTimeout(() => {
                        oresInput.focus();
                    }, 100);
                });

                return;
            }

            const finalCheck = parseFloat((moOron * hmeres).toFixed(4));
            moOronInput.value = moOron.toFixed(4);
        }

        // ✅ Initial calculation (αν υπάρχουν τιμές)
        if (hmeresInput.value && oresInput.value) {
            const hmeres = parseFloat(hmeresInput.value);
            if (hmeres > 0 && hmeres <= 7) {
                calculateMoOron();
            }
        }
    }

    // =========================================================================
    // ✅ ΝΕΟΣ: Validation function για το "Ωράριο Εργασίας" tab (με debounce)
    // =========================================================================
    let validateOrarioDebounceTimer = null;

    function validateOrarioErgasiasTab() {
        // ✅ Clear previous timer
        if (validateOrarioDebounceTimer) {
            clearTimeout(validateOrarioDebounceTimer);
        }

        // ✅ Set new timer (300ms delay)
        validateOrarioDebounceTimer = setTimeout(() => {
            const apoDate = orarioyApoInput?.value;
            const eosDate = orarioyEosInput?.value;
            const hmeres = parseFloat(hmeresInput?.value);
            const ores = parseFloat(oresInput?.value);

            // ✅ Βρες το tab "Ωράριο Εργασίας"
            const orarioTab = Array.from(document.querySelectorAll('.menu_Links ul li')).find(
                (li) => li.textContent.trim() === 'Ωράριο Εργασίας'
            );

            if (!orarioTab) return;

            // ✅ Έλεγχος όλων των προϋποθέσεων
            const isValid =
                apoDate &&
                eosDate &&
                apoDate <= eosDate &&
                !isNaN(hmeres) &&
                hmeres > 0 &&
                !isNaN(ores) &&
                ores > 0;

            if (isValid) {
                // ✅ Enable το tab
                orarioTab.classList.remove('disabled');
            } else {
                // ❌ Disable το tab
                orarioTab.classList.add('disabled');
            }
        }, 300);
    }
    // ✅ Initial validation check (on page load)
    validateOrarioErgasiasTab();

    // =========================================================================
    // ✅ EVENT LISTENER: Κλικ στο tab "Ωράριο Εργασίας"
    // =========================================================================

    let hasInitializedOrariaTab = false;

    const menuLinks = document.querySelectorAll('.menu_Links ul li');

    menuLinks.forEach((li) => {
        if (li.textContent.trim() === 'Ωράριο Εργασίας') {
            li.addEventListener('click', async function () {
                // ✅ Έλεγχος αν το tab είναι disabled
                if (this.classList.contains('disabled')) {
                    // ❌ Δείξε μήνυμα
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

                    // ✅ Focus στο πρώτο κενό πεδίο
                    if (!apoDate) {
                        orarioyApoInput.focus();
                    } else if (!eosDate) {
                        orarioyEosInput.focus();
                    } else if (isNaN(hmeres) || hmeres <= 0) {
                        hmeresInput.focus();
                    } else if (isNaN(ores) || ores <= 0) {
                        oresInput.focus();
                    }

                    return; // ✅ Σταμάτα την εκτέλεση
                }

                // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Αν το mo_oron_hmerhsias_ergasias δεν έχει τιμή
                const moOronInput = document.getElementById('mo_oron_hmerhsias_ergasias');
                const moOronValue = moOronInput?.value || '';

                if (!moOronValue || moOronValue.trim() === '' || parseFloat(moOronValue) <= 0) {
                    // ❌ ΔΕΝ υπάρχει τιμή - Εμφάνισε μήνυμα
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

                    // ✅ ΒΗΜΑ 1: Hide ALL sections
                    document.querySelectorAll('section[data-section]').forEach((section) => {
                        section.classList.remove('visible');
                    });

                    // ✅ ΒΗΜΑ 2: Show "Σταθερά Στοιχεία" section
                    const statheraSection = document.querySelector(
                        'section[data-section="Σταθερά Στοιχεία"]'
                    );
                    if (statheraSection) {
                        statheraSection.classList.add('visible');
                    }

                    // ✅ ΒΗΜΑ 3: Update active tab in menu
                    const menuLinksInner = document.querySelectorAll('.menu_Links ul li');
                    menuLinksInner.forEach((menuLi) => {
                        if (menuLi.textContent.trim() === 'Σταθερά Στοιχεία') {
                            menuLi.classList.add('active');
                        } else {
                            menuLi.classList.remove('active');
                        }
                    });

                    // ✅ ΒΗΜΑ 4: Focus μετά το switch (ΧΩΡΙΣ scrollIntoView)
                    setTimeout(() => {
                        const hmeresInput = document.getElementById('hmeres_ergasias_ebdomadas');
                        if (hmeresInput) {
                            hmeresInput.focus();
                        }
                    }, 100);

                    // ✅ Σταμάτα την εκτέλεση
                    return;
                }

                // ✅ Έλεγχος αν έχει ήδη τρέξει
                if (hasInitializedOrariaTab) {
                    return;
                }

                // ✅ ΕΜΦΑΝΙΣΗ LOADER ΑΜΕΣΩΣ
                const loader = document.querySelector('.loader-container');
                if (loader) {
                    loader.classList.add('visible');
                    loader.classList.remove('is-hidden');
                }

                // ✅ Περίμενε για τα TomSelect controls
                try {
                    await waitForTomSelectControls();

                    // ✅ Τρέξε την autoSelectHolidaysOnInit
                    if (typeof autoSelectHolidaysOnInit === 'function') {
                        autoSelectHolidaysOnInit();
                    }

                    // ✅ Περίμενε για το auto-select να ολοκληρωθεί
                    await new Promise((resolve) => setTimeout(resolve, 200));

                    // ✅ Τώρα τρέξε το updateKathgoriaBackgroundColor
                    updateKathgoriaBackgroundColor();

                    // ✅ Extra call μετά από 500ms για να πιάσει τις τιμές
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    updateKathgoriaBackgroundColor();

                    hasInitializedOrariaTab = true;
                } catch (error) {
                    console.error('❌ Error:', error);
                } finally {
                    // ✅ ΑΠΟΚΡΥΨΗ LOADER
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

    /**
     * ✅ Helper function - Περίμενε μέχρι να υπάρχουν TomSelect controls
     */
    function waitForTomSelectControls() {
        return new Promise((resolve, reject) => {
            const maxWaitTime = 5000; // 5 seconds
            const checkInterval = 100; // Check every 100ms
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
        // ✅ Guard: χρονιά πρέπει να είναι λογική (4 ψηφία πλήρη)
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

    /**
     * ✅ ΝΕΟΣ HANDLER: Debounced version
     */
    function handleLhxhsChangeDebounced() {
        // Clear previous timer
        if (lhxhsChangeTimer) {
            clearTimeout(lhxhsChangeTimer);
        }

        // Set new timer (500ms delay)
        lhxhsChangeTimer = setTimeout(() => {
            handleLhxhsChange();
        }, 500);
    }

    /**
     * ✅ ΔΙΟΡΘΩΣΗ: Όταν αλλάξει / γίνει blur η λήξη σύμβασης
     * ΔΕΝ πειράζουμε πλέον το hmeromhnia_allaghs_orarioy_eos.
     *
     * Η λήξη σύμβασης χρησιμοποιείται μόνο για να μαρκάρουμε ως ΜΕ
     * τις δυναμικές ημέρες ωραρίου που είναι ΜΕΤΑ τη λήξη σύμβασης.
     */
    async function handleLhxhsChange() {
        const currentValue = lhxhsSymbashsInput?.value || '';

        // ✅ Guard: χρονιά πρέπει να είναι λογική
        if (currentValue) {
            const year = new Date(currentValue).getFullYear();
            if (year < 1900 || year > 2100) return;
        }

        // ✅ ΕΛΕΓΧΟΣ: Αν το value ΔΕΝ άλλαξε, μην κάνεις τίποτα
        if (currentValue === previousLhxhsValue) {
            return;
        }

        // ✅ Update το previous value
        previousLhxhsValue = currentValue;

        // ❗ ΣΗΜΑΝΤΙΚΟ:
        // Δεν καλούμε updateOrarioyEosDate() και δεν γράφουμε orarioyEosInput.value.
        // Άρα το blur/change της λήξης σύμβασης ΔΕΝ αλλάζει πλέον το ΕΩΣ ωραρίου.

        // ✅ Αν έχουν ήδη δημιουργηθεί οι δυναμικές ημέρες, ενημέρωσε μόνο τις κατηγορίες.
        applyDefaultKathgoriaMEAfterContractEnd();

        if (typeof updateKathgoriaBackgroundColor === 'function') {
            updateKathgoriaBackgroundColor();
        }
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

        if (eosDate === '') {
            isValidDateChange = false;
        }

        if (!isValidDateChange) {
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
        isxyosOronErgasiasApoInput.value = value;
        // Also trigger update for eos date
        updateOrarioyEosDate(value);
    }

    /**
     * ✅ ΔΙΟΡΘΩΣΗ: Υπολογισμός ΕΩΣ = ΑΠΟ + 7 ημέρες
     * ✅ ΕΛΕΓΧΟΣ 1: Cap στη λήξη σύμβασης
     * ✅ ΕΛΕΓΧΟΣ 2: Cap στο τέλος έτους
     * ✅ ΕΛΕΓΧΟΣ 3: Guard για μη λογικές χρονιές (π.χ. 0002 κατά πληκτρολόγηση)
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

        // ✅ ΝΕΟ: Guard για μη λογικές χρονιές
        // Όταν ο χρήστης πληκτρολογεί π.χ. "2" στο year, το Chrome δημιουργεί "0002-MM-DD"
        // new Date("0002-09-11").getFullYear() === 2  →  αποφεύγουμε τον υπολογισμό
        const year = startDateParsed.getFullYear();
        if (year < 1900 || year > 2100) {
            return;
        }

        // Calculate:  start + 7 days
        let eosDateParsed = new Date(startDateParsed);
        eosDateParsed.setDate(eosDateParsed.getDate() + 6);

        // =====================================================================
        // ΈΛΕΓΧΟΣ 1: Cap στη λήξη σύμβασης (αν υπάρχει και δεν είναι κενό)
        // =====================================================================
        if (
            lhxhsSymbashsInput &&
            lhxhsSymbashsInput.value &&
            lhxhsSymbashsInput.value.trim() !== ''
        ) {
            const lhxhsDate = new Date(lhxhsSymbashsInput.value);

            if (!isNaN(lhxhsDate.getTime())) {
                if (eosDateParsed > lhxhsDate) {
                    eosDateParsed = lhxhsDate;
                }
            }
        }

        // =====================================================================
        // ΈΛΕΓΧΟΣ 2: Cap στο τέλος έτους (31 Δεκεμβρίου)
        // ✅ ΔΙΟΡΘΩΣΗ: χρήση setMonth/setDate αντί new Date(year, 11, 31)
        // Το new Date(2, 11, 31) επιστρέφει 1902 λόγω JavaScript quirk για χρονιές 0-99!
        // =====================================================================
        const yearEnd = new Date(startDateParsed);
        yearEnd.setMonth(11);
        yearEnd.setDate(31);

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

        // ✅ ΝΕΟ: Guard για μη λογικές χρονιές
        if (apoDateObj.getFullYear() < 1900 || apoDateObj.getFullYear() > 2100) return false;
        if (eosDateObj.getFullYear() < 1900 || eosDateObj.getFullYear() > 2100) return false;

        // Check 1: eos δεν μπορεί να είναι πριν από apo
        if (eosDateObj < apoDateObj) {
            const formattedApoDate = formatDate(apoDateObj);
            alert(`Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι πριν από την ${formattedApoDate}.`);
            return false;
        }

        // Check 2: eos δεν μπορεί να είναι μετά τη λήξη σύμβασης
        if (lhxhsSymbashsInput && lhxhsSymbashsInput.value) {
            const lhxhsDate = new Date(lhxhsSymbashsInput.value);
            if (!isNaN(lhxhsDate.getTime()) && eosDateObj > lhxhsDate) {
                const formattedLhxhs = formatDate(lhxhsDate);
                alert(
                    `Η Ημερ/νία ΕΩΣ δεν μπορεί να είναι μετά τη λήξη της σύμβασης (${formattedLhxhs}).`
                );
                return false;
            }
        }

        // Check 3: eos δεν μπορεί να είναι μετά το τέλος του έτους
        // ✅ ΔΙΟΡΘΩΣΗ: χρήση setMonth/setDate
        const yearEnd = new Date(apoDateObj);
        yearEnd.setMonth(11);
        yearEnd.setDate(31);
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
            alert(
                `Η Ημερ/νία ΕΩΣ πρέπει να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate} (μέγιστο 31 ημέρες).`
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
        // ✅ Έλεγχος: Αν τρέχει ήδη, ��ην ξανατρέξεις
        if (isUpdatingDateDifference) {
            console.warn('⚠️ updateDateDifference already running, skipping...');
            return;
        }

        isUpdatingDateDifference = true;

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

            if (!csrfToken) {
                console.error('❌ CSRF token not found! ');
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
            if (!container) {
                return;
            }

            const oldSelects = container.querySelectorAll('select.tom-dropdown');
            oldSelects.forEach((sel) => {
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
								<input type="time" class="date-control clearableInput text-center" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" />
							</div>

							<div class="col-1-2 ml--0_2rem">
								<input type="time" class="date-control clearableInput text-center" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" />
							</div>

							<div class="col-0-5"></div>

							<div class="col-1-2">
								<input type="time" class="date-control clearableInput text-center" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" />
							</div>

							<div class="col-1-2 ml--0_1rem">
								<input type="time" class="date-control clearableInput text-center" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" />
							</div>

							<div class="col-0-75"></div>

							<div class="col-0-5 center-align checkbox-flex-center mt-0_4rem">
								<input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="repo_${i1}" name="repo_${i1}" tabIndex="-1"value="" />
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
									<input type="time" class="date-control clearableInput text-center" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" />
								</div>

								<div class="col-1-2">
									<input type="time" class="date-control clearableInput text-center" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" />
								</div>

								<div class="col-0-5"></div>

								<div class="col-1-2 ml-0_3rem">
									<input type="time" class="date-control clearableInput text-center" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" />
								</div>

								<div class="col-1-2">
									<input type="time" class="date-control clearableInput text-center" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" />
								</div>
							</div>
						`;
                    }

                    if (j === 3) {
                        const eidikh =
                            document.getElementById('eidikh_kathgoria_stathera')?.value || '';

                        // ✅ j=3 fields είναι disabled by default
                        // ✅ Enable ΜΟΝΟ αν eidikh === 0004/0005
                        const isHolidayEnabled = eidikh === '0004' || eidikh === '0005';
                        const disabledAttr = isHolidayEnabled ? '' : 'disabled';

                        divHtml += `
							<div class="row form-group align-items-center bg-white">
								<div class="col-5 left-align">
									<input type="text" class="argia-label mt-0_5rem-fs0_7rem-border-0" tabIndex="-1" id="holiday_label_${i1}" name="holiday_label_${i1}" readonly />
								</div>

								<div class="col-1-2 ml-0_7rem">
									<input type="time" class="date-control clearableInput text-center" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" ${disabledAttr} />
								</div>

								<div class="col-1-2">
									<input type="time" class="date-control clearableInput text-center" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" ${disabledAttr} />
								</div>

								<div class="col-0-5"></div>

								<div class="col-1-2 ml-0_3rem">
									<input type="time" class="date-control clearableInput text-center" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" ${disabledAttr} />
								</div>

								<div class="col-1-2">
									<input type="time" class="date-control clearableInput text-center" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" ${disabledAttr} />
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

            // ✅ ΝΕΟ:
            // Αφού μπουν οι ημερομηνίες στα hmeromhnia_XX,
            // όσα rows είναι ΜΕΤΑ τη λήξη σύμβασης παίρνουν default ΜΕ.
            // Το κάνουμε πριν το reinitTomDropdowns ώστε το data-preselect να βρει ήδη τιμή
            // στο hidden kathgoria_ergasias_stathera_XX.
            applyDefaultKathgoriaMEAfterContractEnd();

            setupEnterKeyNavigation();

            // Αρχικοποίηση TomSelect ΜΕΤΑ από μικρό delay
            setTimeout(() => {
                if (window.reinitTomDropdowns) {
                    window.reinitTomDropdowns(container);
                }

                if (window.initClearableInputs) {
                    window.initClearableInputs(container);
                }

                initializeSelectListeners();

                // ✅ ΝΕΟ:
                // Extra pass και ΜΕΤΑ το TomSelect init, ώστε να ενημερωθεί και το visual control.
                applyDefaultKathgoriaMEAfterContractEnd();

                if (typeof updateKathgoriaBackgroundColor === 'function') {
                    updateKathgoriaBackgroundColor();
                }
            }, 200);

            // ✅ Attach listeners για άμεσο υπολογισμό συνολικών ωρών εβδομάδας.
            // Πλέον δεν περιμένουμε μόνο blur στο eos_ora.
            // Ενημερώνεται σε input/change/blur από όλα τα ζεύγη ωρών και διαλειμμάτων.
            for (let i = 1; i <= data.differenceInDays; i++) {
                const i1 = i < 10 ? '0' + i : String(i);

                for (let j = 1; j <= 3; j++) {
                    const jj = j < 10 ? '0' + j : String(j);

                    [
                        `apo_ora_${jj}_${i1}`,
                        `eos_ora_${jj}_${i1}`,
                        `dialleima_apo_ora_${jj}_${i1}`,
                        `dialleima_eos_ora_${jj}_${i1}`
                    ].forEach((fieldId) => {
                        const field = document.getElementById(fieldId);
                        if (!field || field.dataset.weeklyTotalListenerBound === '1') return;

                        field.dataset.weeklyTotalListenerBound = '1';
                        field.addEventListener('input', () => calculateWeeklyTotalHours());
                        field.addEventListener('change', () => calculateWeeklyTotalHours());
                        field.addEventListener('blur', () => calculateWeeklyTotalHours());
                    });
                }

                const kathgoriaSelect = document.getElementById(`kathgoria_ergasias_${i1}`);
                if (kathgoriaSelect && kathgoriaSelect.dataset.weeklyTotalListenerBound !== '1') {
                    kathgoriaSelect.dataset.weeklyTotalListenerBound = '1';
                    kathgoriaSelect.addEventListener('change', () => calculateWeeklyTotalHours());
                }
            }

            calculateWeeklyTotalHours();
        } catch (error) {
            console.error('❌ Error in updateDateDifference:', error);
            throw error;
        } finally {
            // ✅ ΚΡΙΤΙΚΟ: Reset το flag
            isUpdatingDateDifference = false;
        }
    }

    // =========================================================================
    // ✅ HELPERS: Default ΜΕ μετά τη λήξη σύμβασης
    // =========================================================================

    /**
     * Parse ISO date YYYY-MM-DD ως local date, χωρίς timezone surprises.
     */
    function parseISODateOnly(value) {
        if (!value || typeof value !== 'string') return null;

        const parts = value.split('-').map(Number);
        if (parts.length !== 3) return null;

        const [year, month, day] = parts;
        if (!year || !month || !day) return null;
        if (year < 1900 || year > 2100) return null;

        const parsed = new Date(year, month - 1, day);
        if (isNaN(parsed.getTime())) return null;

        return parsed;
    }

    /**
     * Θέτει την κατηγορία εργασίας σε ΜΕ για όλες τις δυναμικές ημέρες
     * που είναι ΜΕΤΑ την hmeromhnia_lhxhs_symbashs.
     *
     * Δεν πειράζει τις ημέρες πριν/ίσες με τη λήξη σύμβασης, ώστε να μην
     * σβήνονται επιλογές που έχει ήδη κάνει ο χρήστης.
     */
    function applyDefaultKathgoriaMEAfterContractEnd() {
        const contractEndDate = parseISODateOnly(lhxhsSymbashsInput?.value || '');
        if (!contractEndDate) return;

        const differenceInDays = parseInt(document.getElementById('differenceInDays')?.value || 0);
        if (!differenceInDays || differenceInDays <= 0) return;

        for (let i = 1; i <= differenceInDays; i++) {
            const i1 = i < 10 ? '0' + i : String(i);

            const dayInput = document.getElementById(`hmeromhnia_${i1}`);
            const hiddenInput = document.getElementById(`kathgoria_ergasias_stathera_${i1}`);
            const selectElement = document.getElementById(`kathgoria_ergasias_${i1}`);

            if (!dayInput || !hiddenInput || !selectElement) continue;

            const rowDate = parseISODateOnly(dayInput.value);
            if (!rowDate) continue;

            // ✅ ΜΟΝΟ ημερομηνίες ΜΕΤΑ τη λήξη σύμβασης παίρνουν default ΜΕ
            if (rowDate > contractEndDate) {
                setKathgoriaErgasiasValue(selectElement, hiddenInput, 'ΜΕ');

                // ✅ Εφόσον η ημέρα είναι μετά τη λήξη σύμβασης, δεν επιτρέπουμε
                // συμπλήρωση ωρών εργασίας/διαλείμματος. Τα πεδία μένουν κλειδωμένα
                // όπως φαίνεται στο επιθυμητό αποτέλεσμα.
                disableAndClearTimeFieldsForDay(i1);
            }
        }
    }

    /**
     * Ενημερώνει και το hidden field και το select/TomSelect control.
     */
    function setKathgoriaErgasiasValue(selectElement, hiddenInput, value) {
        hiddenInput.value = value;

        if (selectElement.tomselect) {
            const ts = selectElement.tomselect;

            // Αν για οποιονδήποτε λόγο δεν έχει φορτωθεί ακόμη option ΜΕ,
            // το προσθέτουμε προσωρινά ώστε να μπορεί να εμφανιστεί.
            if (!ts.options[value]) {
                // ✅ Για το default ΜΕ θέλουμε να φαίνεται όπως στο dropdown:
                // "ΜΕ - ΜΗ ΕΡΓΑΣΙΑ" και όχι σκέτο "ΜΕ".
                const fallbackText = value === 'ΜΕ' ? 'ΜΕ  -  ΜΗ ΕΡΓΑΣΙΑ' : value;
                ts.addOption({ value, text: fallbackText });
            }

            ts.setValue(value, true);
            ts.refreshOptions(false);
        } else {
            selectElement.value = value;
        }

        // Ειδοποιούμε τυχόν listeners ότι άλλαξε η τιμή.
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Κλειδώνει και καθαρίζει τα πεδία ωρών/διαλείμματος μιας δυναμικής ημέρας.
     * Χρησιμοποιείται για ημέρες μετά τη λήξη σύμβασης, όπου η κατηγορία
     * μπαίνει αυτόματα σε ΜΕ - ΜΗ ΕΡΓΑΣΙΑ.
     */
    function disableAndClearTimeFieldsForDay(i1) {
        for (let j = 1; j <= 3; j++) {
            const fieldIds = [
                `apo_ora_0${j}_${i1}`,
                `eos_ora_0${j}_${i1}`,
                `dialleima_apo_ora_0${j}_${i1}`,
                `dialleima_eos_ora_0${j}_${i1}`
            ];

            fieldIds.forEach((fieldId) => {
                const field = document.getElementById(fieldId);
                if (!field) return;

                field.value = '';
                field.setAttribute('disabled', 'disabled');
                field.style.setProperty('background-color', '', 'important');
                field.style.setProperty('border-color', '#cccccc', 'important');
            });
        }
    }

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * ✅ Αλλαγή background color ανάλογα με την επιλογή + πεδία ωρών
     */
    function updateKathgoriaBackgroundColor() {
        const differenceInDays = parseInt(document.getElementById('differenceInDays')?.value || 0);
        const allTsControls = document.querySelectorAll('#dynamicFields .ts-control');

        // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ:  Πάρε το apasxolhshTisArgies
        const apasxolhshTisArgies =
            document.getElementById('apasxolhshTisArgies')?.value === 'true';

        for (let i = 1; i <= differenceInDays; i++) {
            let i1 = i < 10 ? '0' + i : i;
            const selectId = `kathgoria_ergasias_${i1}`;
            const selectElement = document.getElementById(selectId);

            if (!selectElement) {
                continue;
            }

            const tsControl = allTsControls[i - 1];

            if (!tsControl) {
                continue;
            }

            // ✅ Handler function
            const updateBackground = () => {
                const value = selectElement.value;
                const perigrafh_argias =
                    document.getElementById(`perigrafh_argias_${i1}`)?.value || '';
                const dateField = document.getElementById(`hmeromhnia_${i1}`);
                const isHoliday = dateField && dateField.style.color === 'red';

                // =========================================================================
                // CASE 1: value === 'ΜΕ'
                // =========================================================================
                if (value === 'ΜΕ') {
                    // ✅ Έλεγχος αν το perigrafh_argias ΔΕΝ είναι κενό
                    if (perigrafh_argias && perigrafh_argias.trim() !== '') {
                        // ✅ ΚΙΤΡΙΝΟ για TomSelect
                        tsControl.style.setProperty('background-color', '#eeff0223', 'important');
                        tsControl.style.setProperty('border-color', '#fbc02d', 'important');

                        // ✅ Βάψε ΟΛΑ τα πεδία ωρών (j=1,2,3) + ENABLE
                        for (let j = 1; j <= 3; j++) {
                            applyColorToTimeFields(i1, j, '#eeff0223', '#fbc02d', true);
                        }
                    }
                    // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Αν apasxolhshTisArgies === true ΚΑΙ είναι αργία
                    else if (apasxolhshTisArgies && isHoliday) {
                        // ✅ ΚΙΤΡΙΝΟ για TomSelect
                        tsControl.style.setProperty('background-color', '#eeff0223', 'important');
                        tsControl.style.setProperty('border-color', '#fbc02d', 'important');

                        // ✅ Πάρε το eidikh_kathgoria_stathera
                        const eidikh =
                            document.getElementById('eidikh_kathgoria_stathera')?.value || '';
                        const isSpecialCategory = eidikh === '0004' || eidikh === '0005';

                        // ✅ Enable j=1,2 πάντα + j=3 αν eidikh === 0004/0005
                        for (let j = 1; j <= 3; j++) {
                            const shouldEnable =
                                j === 1 || j === 2 || (j === 3 && isSpecialCategory);
                            applyColorToTimeFields(i1, j, '#eeff0223', '#fbc02d', shouldEnable);
                        }
                    } else {
                        // ❌ perigrafh_argias είναι κενό ΚΑΙ apasxolhshTisArgies === false → Reset
                        tsControl.style.setProperty('background-color', '', 'important');
                        tsControl.style.setProperty('border-color', '#cccccc', 'important');

                        for (let j = 1; j <= 3; j++) {
                            applyColorToTimeFields(i1, j, '', '#cccccc', false);
                        }
                    }
                }
                // =========================================================================
                // CASE 2: value === 'ΑΝ'
                // =========================================================================
                else if (value === 'ΑΝ') {
                    // ✅ ΠΡΑΣΙΝΟ για TomSelect
                    tsControl.style.setProperty('background-color', '#2b97001e', 'important');
                    tsControl.style.setProperty('border-color', '#66bb6a', 'important');

                    // ✅ Βάψε ΟΛΑ τα πεδία ωρών (j=1,2,3) ΧΩΡΙΣ enable
                    for (let j = 1; j <= 3; j++) {
                        applyColorToTimeFields(i1, j, '#2b97001e', '#66bb6a', false);
                    }
                }
                // =========================================================================
                // CASE 3: Άλλη τιμή
                // =========================================================================
                else {
                    // ✅ ΛΕΥΚΟ για TomSelect
                    tsControl.style.setProperty('background-color', '#ffffff', 'important');
                    tsControl.style.setProperty('border-color', '#cccccc', 'important');

                    for (let j = 1; j <= 3; j++) {
                        applyColorToTimeFields(i1, j, '', '#cccccc', false);
                    }
                }
            };

            // ✅ Attach listeners
            if (selectElement.tomselect) {
                selectElement.tomselect.on('change', updateBackground);
            } else {
                selectElement.addEventListener('change', updateBackground);
            }

            // ✅ Initial color update
            updateBackground();
        }
    }

    /**
     * ✅ Helper function - Εφαρμογή χρωμάτων σε πεδία ωρών + enable (μόνο αν shouldEnable === true)
     */
    function applyColorToTimeFields(i1, j, bgColor, borderColor, shouldEnable) {
        const fields = [
            `apo_ora_0${j}_${i1}`,
            `eos_ora_0${j}_${i1}`,
            `dialleima_apo_ora_0${j}_${i1}`,
            `dialleima_eos_ora_0${j}_${i1}`
        ];

        fields.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (field) {
                // ✅ Apply colors
                if (bgColor) {
                    field.style.setProperty('background-color', bgColor, 'important');
                    field.style.setProperty('border-color', borderColor, 'important');
                } else {
                    field.style.setProperty('background-color', '', 'important');
                    field.style.setProperty('border-color', borderColor, 'important');
                }

                // ✅ ΜΟΝΟ αν shouldEnable === true → removeAttribute('disabled')
                if (shouldEnable === true) {
                    field.removeAttribute('disabled');
                }
                // ✅ Για όλες τις άλλες περιπτώσεις (false) → ΔΕΝ αλλάζει το disabled state
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
        const moOronInput = document.getElementById('mo_oron_hmerhsias_ergasias');
        const moOron = parseFloat(moOronInput?.value) || 0;

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

            const kathgoriaInput = document.getElementById(`kathgoria_ergasias_stathera_${i1}`);
            const kathgoriaValue = kathgoriaInput?.value || '';

            if (!kathgoriaValue || !['ΑΝ', 'ΕΡΓ', 'ΜΕ', 'ΤΗΛ'].includes(kathgoriaValue)) {
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

            // ✅ Ενημέρωση και του κρυφού ημερήσιου total_hours_day_XX.
            // Αυτό είναι σημαντικό για την αποθήκευση στο ProdhlomenaOrariaModel.
            const dailyTotalInput = document.getElementById(`total_hours_day_${i1}`);
            if (dailyTotalInput) {
                dailyTotalInput.value = dailyHoursValue.toFixed(4);
            }

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

        // ✅ Γενικό σύνολο ωρών εβδομαδιαίου προδηλωμένου προγράμματος.
        // Ενημερώνεται ΠΑΝΤΑ, ακόμη και αν οι ώρες ξεπερνούν τις 40,
        // ώστε ο χρήστης να βλέπει το πραγματικό σύνολο που έχει πληκτρολογήσει.
        if (totalInput) {
            totalInput.value = totalHours;
        }

        if (parseFloat(totalHours) > 40) {
            return false;
        }

        // if (hasExceeded) {
        //     const daysMessage = exceededDays
        //         .map(
        //             (day) =>
        //                 `<div style="text-align: left; margin: 5px 0;">
        //                     <strong>${day.day}:</strong> ${day.hours} ώρες (Μ.Ο.: ${day.mo})
        //                 </div>`
        //         )
        //         .join('');

        //     Swal.fire({
        //         backdrop: false,
        //         allowOutsideClick: false,
        //         icon: 'warning',
        //         title: 'ΠΡΟΣΟΧΗ - ΥΠΕΡΒΑΣΗ ΩΡΩΝ !!!',
        //         html: `
        //             <div style="text-align: center;">
        //                 <p>Οι παρακάτω ημέρες έχουν περισσότερες ώρες από τον Μ.Ο. ημερήσιας εργασίας:</p>
        //                 ${daysMessage}
        //             </div>
        //         `,
        //         showConfirmButton: true,
        //         confirmButtonText: 'Το κατάλαβα',
        //         customClass: {
        //             confirmButton: 'class-warning custom-confirm-button custom-swal-button',
        //             title: 'custom-title',
        //             popup: 'custom-swal-popup'
        //         }
        //     });
        // }

        if (hasRestViolation) {
            const restMessage = restViolations
                .map(
                    (violation) =>
                        `<div style="text-align: left; margin: 5px 0;">
                            <strong>${violation.prevDay} → ${violation.currentDay}:</strong> ${violation.restHours} ώρες ανάπαυσης
                        </div>`
                )
                .join('');

            Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'error',
                title: 'ΠΡΟΣΟΧΗ - ΠΑΡΑΒΙΑΣΗ ΗΜΕΡΗΣΙΑΣ ΑΝΑΠΑΥΣΗΣ !!!',
                html: `
                    <div style="text-align: center;">
                        <p>Οι παρακάτω ημέρες δεν έχουν την απαιτούμενη ανάπαυση 11 ωρών:</p>
                        ${restMessage}
                        <br><br>
                        <p style="color: red; font-weight: bold;">Απαιτούνται τουλάχιστον 11 ώρες ανάπαυσης μεταξύ εργάσιμων ημερών!</p>
                    </div>
                `,
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
            if (oresErgasiasInput && oresErgasiasInput.value) {
                const expectedHours = parseFloat(oresErgasiasInput.value);
                const actualHours = parseFloat(totalHours);

                // if (actualHours !== expectedHours) {
                //     Swal.fire({
                //         backdrop: false,
                //         allowOutsideClick: false,
                //         icon: 'info',
                //         title: 'ΠΡΟΣΟΧΗ !!!',
                //         html: `Δεν συμφωνούν οι ώρες εβδομαδιαίας εργασίας με το σύνολο των ωρών του δηλωθέντος ωραρίου.<br>
                //                 Οι ώρες που δηλώθηκαν είναι <strong>${actualHours}</strong>, ενώ οι ώρες που αναμένονται σύμφωνα με το ωράριο είναι <strong>${expectedHours}</strong>.`,
                //         showConfirmButton: true,
                //         confirmButtonText: 'Κλείσιμο',
                //         customClass: {
                //             confirmButton: 'class-info custom-confirm-button custom-swal-button',
                //             title: 'custom-title',
                //             popup: 'custom-swal-popup'
                //         }
                //     });
                // }
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
