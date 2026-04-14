// /public/js/ergazomenoi/genika/date_sync_edit.js

document.addEventListener('DOMContentLoaded', function () {
    const proslhpshsInput = document.getElementById('hmeromhnia_proslhpshs');
    const allaghsSymbashsInput = document.getElementById('hmeromhnia_allaghs_symbashs');
    const lhxhsSymbashsInput = document.getElementById('hmeromhnia_lhxhs_symbashs');
    const orarioyApoInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
    const orarioyEosInput = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

    // ✅ ΝΕΟΣ: Κρατάμε το προηγούμενο value της λήξης σύμβασης
    let previousLhxhsValue = lhxhsSymbashsInput?.value || '';

    // ✅ ΝΕΟΣ: Debounce timer
    let lhxhsChangeTimer = null;

    // Event listeners
    proslhpshsInput.addEventListener('blur', handleProslhpshChange);
    allaghsSymbashsInput.addEventListener('change', handleAllaghsChange);
    allaghsSymbashsInput.addEventListener('blur', handleAllaghsChange);

    orarioyApoInput.addEventListener('change', handleOrarioyApoChange);
    orarioyApoInput.addEventListener('blur', handleOrarioyApoChange);
    orarioyApoInput.addEventListener('input', handleOrarioyApoChange);

    orarioyEosInput.addEventListener('blur', handleOrarioyEosChange);

    // ✅ ΔΙΟΡΘΩΣΗ: Χρήση debounced handler για λήξη σύμβασης
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
    // ✅ Event listeners για Μ.Ο. ωρών ημερήσιας εργασίας
    // =========================================================================
    const hmeresInput = document.getElementById('hmeres_ergasias_ebdomadas');
    const oresInput = document.getElementById('ores_ergasias_ebdomadas');
    const moOronInput = document.getElementById('mo_oron_hmerhsias_ergasias');

    if (hmeresInput && oresInput && moOronInput) {
        // ✅ Event listeners για Μ.Ο.
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

        // ✅ EVENT LISTENER: Validation για hmeres_ergasias_ebdomadas
        hmeresInput.addEventListener('blur', function () {
            const hmeres = parseFloat(this.value);

            // ✅ Έλεγχος: > 0 και <= 7
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
                    text: 'Ο Μ.Ο. ωρών ημερήσιας εργασίας δεν μπορεί να υπερβαίνει τις 10 ώρες.  Παρακαλώ ελέγξτε τις τιμές που εισάγατε.',
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
        setAllDates(this.value);
        await updateOrarioyEosDate(this.value);
    }

    function handleAllaghsChange() {
        setAllDates(this.value);
    }

    function handleOrarioyApoChange() {
        if (proslhpshsInput.value > this.value) {
            const etos = parseInt(proslhpshsInput.value.substring(0, 4));
            const mhnas = parseInt(proslhpshsInput.value.substring(5, 7));
            const hmera = parseInt(proslhpshsInput.value.substring(8, 10));

            alert(
                `Η Ημερoμηνία πρόσληψης είναι η ${hmera}/${mhnas}/${etos}. Δεν επιτρέπεται να δώσετε μικρότερη απ' αυτή την ημερομηνία.`
            );
            this.value = proslhpshsInput.value;
        }
        updateOrarioyEosDate(this.value);
    }

    /**
     * ✅ ΝΕΟΣ HANDLER: Debounced version για λήξη σύμβασης
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
     * ✅ Όταν αλλάξει η λήξη σύμβασης — ΕΩΣ = τέλος μήνα (edit logic)
     */
    async function handleLhxhsChange() {
        const currentValue = lhxhsSymbashsInput?.value || '';

        // ✅ ΕΛΕΓΧΟΣ: Αν το value ΔΕΝ άλλαξε, μην κάνεις τίποτα
        if (currentValue === previousLhxhsValue) {
            return;
        }

        // ✅ Update το previous value
        previousLhxhsValue = currentValue;

        // ✅ Re-calculate eos date ΜΟΝΟ αν υπάρχει apoDate
        const apoDate = orarioyApoInput?.value;
        if (!apoDate) return;

        // ΕΩΣ = τέλος μήνα (edit logic)
        const etos = parseInt(apoDate.substring(0, 4));
        const mhnas = parseInt(apoDate.substring(5, 7));
        const hmera = parseInt(apoDate.substring(8, 10));
        const lastDayOfMonth = new Date(etos, mhnas, 0).getDate();
        const differenceDaysToEndOfMonth = lastDayOfMonth - hmera;

        const startDateParsed = new Date(apoDate);
        if (isNaN(startDateParsed.getTime())) {
            return;
        }

        let eosDateParsed = new Date(startDateParsed);
        eosDateParsed.setDate(eosDateParsed.getDate() + differenceDaysToEndOfMonth);

        // Cap στη λήξη σύμβασης
        if (currentValue && currentValue.trim() !== '') {
            const lhxhsDate = new Date(currentValue);
            if (!isNaN(lhxhsDate.getTime()) && eosDateParsed > lhxhsDate) {
                eosDateParsed = lhxhsDate;
            }
        }

        const eosDate = formatDateToISO(eosDateParsed);
        orarioyEosInput.value = eosDate;
        // ΔΕΝ καλούμε updateDateDifference εδώ
    }

    async function handleOrarioyEosChange() {
        const eosDate = this.value;
        const apoDate = orarioyApoInput.value;
        let isValidDateChange = await validateDateChange(apoDate, eosDate);
        if (eosDate === '') {
            isValidDateChange = false;
        }

        if (!isValidDateChange) {
            let maxEosDate = new Date(apoDate);
            const formattedApoDate = formatDate(new Date(apoDate));
            const lastDayOfMonth = getLastDayOfMonth(maxEosDate);
            const formattedMaxDate = formatDate(lastDayOfMonth);

            alert(
                `Η Ημερ/νία Αλλαγής Ωραρίου πρέπει να αφορά μόνο το συγκεκριμένο μήνα και να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate}.`
            );

            this.value = formatDateToISO(lastDayOfMonth); // Reset to valid max date
        }
        const startDate = document.getElementById('hmeromhnia_allaghs_orarioy_apo').value;
        const endDate = this.value;
        updateDateDifference(startDate, endDate);
    }

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    function setAllDates(value) {
        allaghsSymbashsInput.value = value;
        orarioyApoInput.value = value;
    }

    async function updateOrarioyEosDate(startDate) {
        const etos = parseInt(startDate.substring(0, 4));
        const mhnas = parseInt(startDate.substring(5, 7));
        const hmera = parseInt(startDate.substring(8, 10));
        const lastDayOfMonth = new Date(etos, mhnas, 0).getDate();
        const differenceDaysToEndOfMonth = parseInt(lastDayOfMonth) - hmera;

        const startDateParsed = new Date(startDate);
        startDateParsed.setDate(startDateParsed.getDate() + differenceDaysToEndOfMonth); // Προσθέτει την διαφορά μεταξύ της τελευταίας ημέρας του μήνα και της ημέρας startDate
        const eosDate = formatDateToISO(startDateParsed);
        orarioyEosInput.value = eosDate;
        await updateDateDifference(startDate, eosDate);
    }

    async function validateDateChange(apoDate, eosDate) {
        const etos = parseInt(apoDate.substring(0, 4));
        const mhnas = parseInt(apoDate.substring(5, 7));
        const hmera = parseInt(apoDate.substring(8, 10));
        const lastDayOfMonth = new Date(etos, mhnas, 0).getDate();
        const differenceDaysToEndOfMonth = parseInt(lastDayOfMonth) - hmera;
        const formattedApoDate = formatDate(new Date(apoDate));

        const maxDate = new Date(
            new Date(apoDate).setDate(new Date(apoDate).getDate() + differenceDaysToEndOfMonth)
        );
        const formattedMaxDate = formatDate(maxDate);
        document.getElementById('differenceDaysToEndOfMonth').value = differenceDaysToEndOfMonth;

        if (new Date(eosDate) < new Date(apoDate) || new Date(eosDate) > maxDate) {
            alert(
                `Η Ημερ/νία Αλλαγής Ωραρίου ΕΩΣ πρέπει να είναι μεταξύ της ${formattedApoDate} και της ${formattedMaxDate}.`
            );
            return false;
        }
        return true;
    }

    function getLastDayOfMonth(date) {
        // Δημιουργία ημερομηνίας για τον επόμενο μήνα
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        // Επιστροφή της τελευταίας ημέρας του τρέχοντος μήνα
        return new Date(nextMonth - 1);
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    async function createEmptyObjectWithDate(currentDate, team, company_kod, kodikos) {
        return {
            team: team,
            company_kod: company_kod,
            kodikos: kodikos,
            hmeromhnia: currentDate.toISOString(),
            kathgoria_ergasias: '',
            apo_ora_01: null,
            eos_ora_01: null,
            apo_ora_02: null,
            eos_ora_02: null,
            apo_ora_03: null,
            eos_ora_03: null,
            dialleima_apo_ora_01: null,
            dialleima_eos_ora_01: null,
            dialleima_apo_ora_02: null,
            dialleima_eos_ora_02: null,
            dialleima_apo_ora_03: null,
            dialleima_eos_ora_03: null,
            repo: false,
            adeia: false,
            astheneia: false,
            argia: false,
            perigrafh_argias: '',
            kathgoria_adeias: '',
            ores_ergasias: 0,
            ores_nyxtas: 0,
            ores_argion: 0,
            ores_yperergasias: 0,
            ores_yperergasias_nyxtas: 0,
            ores_yperergasias_argion: 0,
            ores_yperergasias_argion_nyxtas: 0,
            ores_nominhs_yperorias: 0,
            ores_nominhs_yperorias_nyxtas: 0,
            ores_nominhs_yperorias_argion: 0,
            ores_nominhs_yperorias_argion_nyxtas: 0,
            ores_paranomhs_yperorias: 0,
            ores_paranomhs_yperorias_nyxtas: 0,
            ores_paranomhs_yperorias_argion: 0,
            ores_paranomhs_yperorias_argion_nyxtas: 0
        };
    }

    // =========================================================================
    // API CALLS
    // =========================================================================

    let isUpdatingDateDifference = false;

    async function updateDateDifference(startDate, endDate) {
        // ✅ Έλεγχος: Αν τρέχει ήδη, μην ξανατρέξεις
        if (isUpdatingDateDifference) {
            console.warn('⚠️ updateDateDifference already running, skipping...');
            return;
        }

        isUpdatingDateDifference = true;

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

            if (!csrfToken) {
                console.error('❌ CSRF token not found!');
                throw new Error('CSRF token missing. Please refresh the page.');
            }

            const response = await fetch('/api/dateDifference', {
                // Υπολογίζει την διαφορά ημερών έως-από
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

            const team = document.getElementById('team').value;
            const company_kod = document.getElementById('company_kod').value;
            const kodikos = document.getElementById('kodikosHidden').value;
            const hmeromhnia_allaghs_orarioy_apo = document.getElementById(
                'hmeromhnia_allaghs_orarioy_apo'
            ).value;
            const hmeromhnia_allaghs_orarioy_eos = document.getElementById(
                'hmeromhnia_allaghs_orarioy_eos'
            ).value;

            const orariaResponse = await fetch('/api/getOraria', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    team,
                    company_kod,
                    kodikos,
                    hmeromhnia_allaghs_orarioy_apo,
                    hmeromhnia_allaghs_orarioy_eos
                })
            });

            const orariaData = await orariaResponse.json();

            let synolo = Array(15).fill(0);

            const container = document.getElementById('dynamicFields');

            // Destroy old TomSelect instances before clearing
            const oldSelects = container.querySelectorAll('select.tom-dropdown');
            oldSelects.forEach((sel) => {
                if (sel.id && window.destroyTomSelectById) {
                    window.destroyTomSelectById(sel.id);
                }
            });

            container.innerHTML = ''; // Αρχικοποίηση (καθαρισμός) του HTML

            if (orariaData.length > 0) {
                if (!Array.isArray(orariaData)) {
                    console.error('Τα δεδομένα δεν είναι πίνακας!');
                } else {
                    const fromDate = new Date(hmeromhnia_allaghs_orarioy_apo); // Μετατροπή σε αντικείμενο Date
                    const toDate = new Date(hmeromhnia_allaghs_orarioy_eos); // Μετατροπή σε αντικείμενο Date
                    // Λήψη της πρώτης και τελευταίας ημερομηνίας του πίνακα
                    let firstDate = new Date(orariaData[0].hmeromhnia);
                    let lastDate = new Date(orariaData[orariaData.length - 1].hmeromhnia);

                    if (firstDate > fromDate) {
                        const promises = [];
                        let currentDate = new Date(fromDate);
                        // Προσθήκη αντικειμένων μέχρι να φτάσουμε στην πρώτη ημερομηνία του πίνακα
                        while (currentDate < firstDate) {
                            promises.push(
                                await createEmptyObjectWithDate(
                                    currentDate,
                                    team,
                                    company_kod,
                                    kodikos
                                )
                            );
                            currentDate = addDays(currentDate, 1);
                        }
                        const results = await Promise.all(promises);
                        orariaData.unshift(...results); // Εισαγωγή με σωστή σειρά
                    }

                    // Ενημέρωση της πρώτης ημερομηνίας του πίνακα μετά την εισαγωγή
                    firstDate = new Date(orariaData[0].hmeromhnia);

                    // Αν η τελευταία ημερομηνία του πίνακα είναι μικρότερη από την "ΕΩΣ"
                    if (lastDate < toDate) {
                        let currentDate = addDays(lastDate, 1);
                        const promises_eos = []; // Πίνακας για αποθήκευση των υποσχέσεων (promises)

                        // Προσθήκη αντικειμένων μέχρι να φτάσουμε στην ημερομηνία "ΕΩΣ"
                        while (currentDate <= toDate) {
                            promises_eos.push(
                                createEmptyObjectWithDate(currentDate, team, company_kod, kodikos)
                            );
                            currentDate = addDays(currentDate, 1);
                        }
                        const results = await Promise.all(promises_eos);
                        orariaData.push(...results);
                    }

                    // ** Εύρεση των κενών ημερομηνιών και προσθήκη τους **
                    const datesSet = new Set(
                        orariaData.map((item) => new Date(item.hmeromhnia).toDateString())
                    );

                    let currentDate = new Date(fromDate);
                    while (currentDate <= toDate) {
                        if (!datesSet.has(currentDate.toDateString())) {
                            // Η ημερομηνία λείπει, δημιουργούμε το κενό αντικείμενο
                            const missingObj = await createEmptyObjectWithDate(
                                currentDate,
                                team,
                                company_kod,
                                kodikos
                            );
                            orariaData.push(missingObj);
                        }
                        currentDate = addDays(currentDate, 1);
                    }

                    // Ταξινόμηση του πίνακα για να διατηρηθεί η σωστή σειρά
                    orariaData.sort((a, b) => new Date(a.hmeromhnia) - new Date(b.hmeromhnia));
                }

                for (let i = 1; i <= data.differenceInDays; i++) {
                    let i1 = i < 10 ? '0' + i : i;
                    let ores_ergasias = orariaData[i - 1].ores_ergasias || 0;
                    let ores_nyxtas = orariaData[i - 1].ores_nyxtas || 0;
                    let ores_argion = orariaData[i - 1].ores_argion || 0;

                    let ores_yperergasias = orariaData[i - 1].ores_yperergasias || 0;
                    let ores_yperergasias_nyxtas = orariaData[i - 1].ores_yperergasias_nyxtas || 0;
                    let ores_yperergasias_argion = orariaData[i - 1].ores_yperergasias_argion || 0;
                    let ores_yperergasias_argion_nyxtas =
                        orariaData[i - 1].ores_yperergasias_argion_nyxtas || 0;

                    let ores_nominhs_yperorias = orariaData[i - 1].ores_nominhs_yperorias || 0;
                    let ores_nominhs_yperorias_nyxtas =
                        orariaData[i - 1].ores_nominhs_yperorias_nyxtas || 0;
                    let ores_nominhs_yperorias_argion =
                        orariaData[i - 1].ores_nominhs_yperorias_argion || 0;
                    let ores_nominhs_yperorias_argion_nyxtas =
                        orariaData[i - 1].ores_nominhs_yperorias_argion_nyxtas || 0;

                    let ores_paranomhs_yperorias = orariaData[i - 1].ores_paranomhs_yperorias || 0;
                    let ores_paranomhs_yperorias_nyxtas =
                        orariaData[i - 1].ores_paranomhs_yperorias_nyxtas || 0;
                    let ores_paranomhs_yperorias_argion =
                        orariaData[i - 1].ores_paranomhs_yperorias_argion || 0;
                    let ores_paranomhs_yperorias_argion_nyxtas =
                        orariaData[i - 1].ores_paranomhs_yperorias_argion_nyxtas || 0;

                    synolo[0] += parseFloat(ores_ergasias);
                    synolo[1] += parseFloat(ores_nyxtas);
                    synolo[2] += parseFloat(ores_argion);
                    synolo[3] += parseFloat(ores_yperergasias);
                    synolo[4] += parseFloat(ores_yperergasias_nyxtas);
                    synolo[5] += parseFloat(ores_yperergasias_argion);
                    synolo[6] += parseFloat(ores_yperergasias_argion_nyxtas);
                    synolo[7] += parseFloat(ores_nominhs_yperorias);
                    synolo[8] += parseFloat(ores_nominhs_yperorias_nyxtas);
                    synolo[9] += parseFloat(ores_nominhs_yperorias_argion);
                    synolo[10] += parseFloat(ores_nominhs_yperorias_argion_nyxtas);
                    synolo[11] += parseFloat(ores_paranomhs_yperorias);
                    synolo[12] += parseFloat(ores_paranomhs_yperorias_nyxtas);
                    synolo[13] += parseFloat(ores_paranomhs_yperorias_argion);
                    synolo[14] += parseFloat(ores_paranomhs_yperorias_argion_nyxtas);

                    let hmeromhnia = orariaData[i - 1].hmeromhnia || null;
                    let kathgoria_ergasias = orariaData[i - 1].kathgoria_ergasias || '';
                    let repo = orariaData[i - 1].repo || false;
                    const labelRepoText = repo ? 'ΝΑΙ' : 'ΟΧΙ';
                    let argia = orariaData[i - 1].argia || false;
                    const labelArgiaText = argia ? 'ΝΑΙ' : 'ΟΧΙ';
                    let perigrafh_argias = orariaData[i - 1].perigrafh_argias || '';

                    let divHtml = `
            <input type="hidden" name="total_hours_day_${i1}" id="total_hours_day_${i1}" value="${ores_ergasias}" />
            <input type="hidden" name="night_hours_day_${i1}" id="night_hours_day_${i1}" value="${ores_nyxtas}" />
            <input type="hidden" name="holiday_hours_day_${i1}" id="holiday_hours_day_${i1}" value="${ores_argion}" />
            <input type="hidden" name="overwork_hours_day_${i1}" id="overwork_hours_day_${i1}" value="${ores_yperergasias}" />
            <input type="hidden" name="night_overwork_hours_day_${i1}" id="night_overwork_hours_day_${i1}" value="${ores_yperergasias_nyxtas}" />
            <input type="hidden" name="holiday_overwork_hours_day_${i1}" id="holiday_overwork_hours_day_${i1}" value="${ores_yperergasias_argion}" />
            <input type="hidden" name="night_holiday_overwork_hours_day_${i1}" id="night_holiday_overwork_hours_day_${i1}" value="${ores_yperergasias_argion_nyxtas}" />
            <input type="hidden" name="overtimeNomimh_hours_day_${i1}" id="overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias}" />
            <input type="hidden" name="night_overtimeNomimh_hours_day_${i1}" id="night_overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias_nyxtas}" />
            <input type="hidden" name="holiday_overtimeNomimh_hours_day_${i1}" id="holiday_overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias_argion}" />
            <input type="hidden" name="night_holiday_overtimeNomimh_hours_day_${i1}" id="night_holiday_overtimeNomimh_hours_day_${i1}" value="${ores_nominhs_yperorias_argion_nyxtas}" />
            <input type="hidden" name="overtimeParanomh_hours_day_${i1}" id="overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias}" />
            <input type="hidden" name="night_overtimeParanomh_hours_day_${i1}" id="night_overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias_nyxtas}" />
            <input type="hidden" name="holiday_overtimeParanomh_hours_day_${i1}" id="holiday_overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias_argion}" />
            <input type="hidden" name="night_holiday_overtimeParanomh_hours_day_${i1}" id="night_holiday_overtimeParanomh_hours_day_${i1}" value="${ores_paranomhs_yperorias_argion_nyxtas}" />

            <div class="row form-group align-items-center" style="background-color: #ffffff;">
              <div class="col-0-5 text-center">
                <label for="hmeromhnia_${i1}" class="col-form-label field-required" id="day_label_${i1}"></label>
              </div>

              <div class="col-1-5 text-center">
                <input type="date" class="date-control input-date" id="hmeromhnia_${i1}" name="hmeromhnia_${i1}" ${hmeromhnia ? `value="${new Date(hmeromhnia).toISOString().split('T')[0]}"` : ''} readonly />
              </div>

              <div class="col-2-5">
                <input type="hidden" name="kathgoria_ergasias_sthathera_${i1}" id="kathgoria_ergasias_stathera_${i1}" value="${kathgoria_ergasias}" />
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
              
              <div class="col-0-5"></div>`;

                    for (let j = 1; j <= 3; j++) {
                        let apo_ora = orariaData[i - 1][`apo_ora_0${j}`] || '';
                        let eos_ora = orariaData[i - 1][`eos_ora_0${j}`] || '';
                        let dialleima_apo_ora = orariaData[i - 1][`dialleima_apo_ora_0${j}`] || '';
                        let dialleima_eos_ora = orariaData[i - 1][`dialleima_eos_ora_0${j}`] || '';
                        if (j === 1) {
                            divHtml += `
                    <div class="col-1-1-75" style="margin-left: -0.6rem;">
                      <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="${apo_ora}" />
                    </div>

                    <div class="col-1-1-75">
                      <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="${eos_ora}" />
                    </div>

                    <div class="col-0-5"></div>

                    <div class="col-1-1-85" style="margin-left: -0.1rem;">
                      <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="${dialleima_apo_ora}" />
                    </div>

                      <div class="col-1-1-75" style="margin-left: -0.1rem;">
                        <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="${dialleima_eos_ora}" />
                      </div>

                      <div class="col-0-5"></div>

                      <div class="col-0-5 center-align checkbox-flex-center" style="margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="repo_${i1}" name="repo_${i1}" ${repo ? 'checked' : ''} />
                        <label for="repo_${i1}" id="label-repo_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ${labelRepoText}
                        </label>
                      </div>

                      <div class="col-0-5 center-align checkbox-flex-center" style="display: none; margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="argia_${i1}" name="argia_${i1}" ${argia ? 'checked' : ''} />
                        <label for="argia_${i1}" id="label-argia_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ${labelArgiaText}
                        </label>
                      </div>`;
                        } else {
                            divHtml += `
                    <div class="row form-group align-items-center" style="background-color: #ffffff; ">`;
                            if (j === 2) {
                                divHtml += `
                          <div class="col-5 left-align">
                            <input type="text" class="argia-label" tabIndex="-1" id="perigrafh_argias_${i1}" name="perigrafh_argias_${i1}" value="${perigrafh_argias}" style="margin-top: -0.5rem; font-size: 0.7rem; border: 0;" readonly />
                          </div>`;
                            } else {
                                divHtml += `
                          <div class="col-5 left-align">
                            <label class="col-form-label field-required" id="holiday_label_${i1}"> &nbsp; </label>
                          </div>`;
                            }
                            divHtml += `
                        <div class="col-1-2">
                          <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="${apo_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>

                        <div class="col-1-2">
                          <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="${eos_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>

                        <div class="col-0-5"></div>

                        <div class="col-1-2">
                          <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="${dialleima_apo_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>

                        <div class="col-1-2">
                          <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="${dialleima_eos_ora}" ${j === 3 ? 'disabled' : ''} />
                        </div>
                  </div>`;
                        }
                    }
                    divHtml += `<hr style="margin-top: 0.4rem; margin-bottom: 0.3rem;" /></div>`;
                    container.innerHTML += divHtml;
                }

                document.getElementById('total_hours_day').value = parseFloat(synolo[0]).toFixed(2);
                document.getElementById('night_hours_day').value = parseFloat(synolo[1]).toFixed(2);
                document.getElementById('holiday_hours_day').value = parseFloat(synolo[2]).toFixed(
                    2
                );

                document.getElementById('overwork_hours_day').value = parseFloat(synolo[3]).toFixed(
                    2
                );
                document.getElementById('night_overwork_hours_day').value = parseFloat(
                    synolo[4]
                ).toFixed(2);
                document.getElementById('holiday_overwork_hours_day').value = parseFloat(
                    synolo[5]
                ).toFixed(2);
                document.getElementById('night_holiday_overwork_hours_day').value = parseFloat(
                    synolo[6]
                ).toFixed(2);

                document.getElementById('overtimeNomimh_hours_day').value = parseFloat(
                    synolo[7]
                ).toFixed(2);
                document.getElementById('night_overtimeNomimh_hours_day').value = parseFloat(
                    synolo[8]
                ).toFixed(2);
                document.getElementById('holiday_overtimeNomimh_hours_day').value = parseFloat(
                    synolo[9]
                ).toFixed(2);
                document.getElementById('night_holiday_overtimeNomimh_hours_day').value =
                    parseFloat(synolo[10]).toFixed(2);

                document.getElementById('overtimeParanomh_hours_day').value = parseFloat(
                    synolo[11]
                ).toFixed(2);
                document.getElementById('night_overtimeParanomh_hours_day').value = parseFloat(
                    synolo[12]
                ).toFixed(2);
                document.getElementById('holiday_overtimeParanomh_hours_day').value = parseFloat(
                    synolo[13]
                ).toFixed(2);
                document.getElementById('night_holiday_overtimeParanomh_hours_day').value =
                    parseFloat(synolo[14]).toFixed(2);
            } else {
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
  
            <div class="row form-group align-items-center" style="background-color: #ffffff;">
              <div class="col-0-5 text-center">
                <label for="hmeromhnia_${i1}" class="col-form-label field-required" id="day_label_${i1}"></label>
              </div>
  
              <div class="col-1-5 text-center">
                <input type="date" class="date-control input-date" id="hmeromhnia_${i1}" name="hmeromhnia_${i1}" value="" readonly />
              </div>
  
              <div class="col-2-5">
                <input type="hidden" name="kathgoria_ergasias_sthathera_${i1}" id="kathgoria_ergasias_stathera_${i1}" value="" />
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
              </div>`;

                    for (let j = 1; j <= 3; j++) {
                        if (j === 1) {
                            divHtml += `
                    <div class="col-0-5"></div>
                      <div class="col-1-2">
                        <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-1-2" style="margin-left: -0.1rem;">
                        <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-0-5"></div>
  
                      <div class="col-1-2">
                        <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-1-2" style="margin-left: -0.2rem;">
                        <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" />
                      </div>
  
                      <div class="col-0-5"></div>
  
                      <div class="col-0-5 center-align checkbox-flex-center" style="margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="repo_${i1}" name="repo_${i1}" value="" />
                        <label for="repo_${i1}" id="label-repo_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ΟΧΙ
                        </label>
                      </div>
  
                      <div class="col-0-5 center-align checkbox-flex-center" style="display: none; margin-top: -0.4rem;">
                        <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="argia_${i1}" name="argia_${i1}" value="" />
                        <label for="argia_${i1}" id="label-argia_${i1}" style="margin-left: 0.75rem; font-size: 0.875vw;">
                          ΟΧΙ
                        </label>
                      </div>`;
                        } else {
                            divHtml += `
                    <div class="row form-group align-items-center" style="background-color: #ffffff; ">`;
                            if (j === 2) {
                                divHtml += `
                          <div class="col-5 left-align">
                            <input type="text" class="argia-label" tabIndex="-1" id="perigrafh_argias_${i1}" name="perigrafh_argias_${i1}" style="margin-top: -0.5rem; font-size: 0.7rem; border: 0;" readonly />
                          </div>`;
                            } else {
                                divHtml += `
                          <div class="col-5 left-align">
                            <label class="col-form-label field-required" id="holiday_label_${i1}"> &nbsp; </label>
                          </div>`;
                            }
                            divHtml += `
                        <div class="col-1-2" style="margin-left: .7rem;">
                          <input type="time" class="date-control" id="apo_ora_0${j}_${i1}" name="apo_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
  
                        <div class="col-1-2">
                          <input type="time" class="date-control" id="eos_ora_0${j}_${i1}" name="eos_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
  
                        <div class="col-0-5"></div>
  
                        <div class="col-1-2" style="margin-left: .3rem;">
                          <input type="time" class="date-control" id="dialleima_apo_ora_0${j}_${i1}" name="dialleima_apo_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
  
                        <div class="col-1-2">
                          <input type="time" class="date-control" id="dialleima_eos_ora_0${j}_${i1}" name="dialleima_eos_ora_0${j}_${i1}" value="" ${j === 3 ? 'disabled' : ''} />
                        </div>
                    </div>`;
                        }
                    }
                    divHtml += `<hr style="margin-top: 0.4rem; margin-bottom: 0.3rem;" /></div>`;
                    container.innerHTML += divHtml;
                }
                synolo = Array(15).fill(0);

                document.getElementById('total_hours_day').value = parseFloat(synolo[0]).toFixed(2);
                document.getElementById('night_hours_day').value = parseFloat(synolo[1]).toFixed(2);
                document.getElementById('holiday_hours_day').value = parseFloat(synolo[2]).toFixed(
                    2
                );

                document.getElementById('overwork_hours_day').value = parseFloat(synolo[3]).toFixed(
                    2
                );
                document.getElementById('night_overwork_hours_day').value = parseFloat(
                    synolo[4]
                ).toFixed(2);
                document.getElementById('holiday_overwork_hours_day').value = parseFloat(
                    synolo[5]
                ).toFixed(2);
                document.getElementById('night_holiday_overwork_hours_day').value = parseFloat(
                    synolo[6]
                ).toFixed(2);

                document.getElementById('overtimeNomimh_hours_day').value = parseFloat(
                    synolo[7]
                ).toFixed(2);
                document.getElementById('night_overtimeNomimh_hours_day').value = parseFloat(
                    synolo[8]
                ).toFixed(2);
                document.getElementById('holiday_overtimeNomimh_hours_day').value = parseFloat(
                    synolo[9]
                ).toFixed(2);
                document.getElementById('night_holiday_overtimeNomimh_hours_day').value =
                    parseFloat(synolo[10]).toFixed(2);

                document.getElementById('overtimeParanomh_hours_day').value = parseFloat(
                    synolo[11]
                ).toFixed(2);
                document.getElementById('night_overtimeParanomh_hours_day').value = parseFloat(
                    synolo[12]
                ).toFixed(2);
                document.getElementById('holiday_overtimeParanomh_hours_day').value = parseFloat(
                    synolo[13]
                ).toFixed(2);
                document.getElementById('night_holiday_overtimeParanomh_hours_day').value =
                    parseFloat(synolo[14]).toFixed(2);
            }

            updateDates();
            setupEnterKeyNavigation();
            attachTimeInputListeners(); // Βρίσκεται στο calcOresApasxolhshs

            setTimeout(() => {
                if (window.reinitTomDropdowns) {
                    window.reinitTomDropdowns(container);
                }
                if (window.initClearableInputs) {
                    window.initClearableInputs(container);
                }
                initializeSelectListeners();
            }, 200);

            // ✅ Attach blur listeners για υπολογισμό συνολικών ωρών εβδομάδας
            for (let i = 1; i <= data.differenceInDays; i++) {
                let i1 = i < 10 ? '0' + i : i;

                for (let j = 1; j <= 3; j++) {
                    const eosOraInput = document.getElementById(`eos_ora_0${j}_${i1}`);
                    if (eosOraInput) {
                        eosOraInput.addEventListener('blur', function () {
                            calculateWeeklyTotalHours();
                        });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error in updateDateDifference:', error);
            throw error;
        } finally {
            // ✅ ΚΡΙΤΙΚΟ: Reset το flag
            isUpdatingDateDifference = false;
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

        // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Πάρε το apasxolhshTisArgies
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

    /**
     * Υπολογισμός ΣΥΝΟΛΙΚΩΝ ωρών για ΟΛΗ την εβδομάδα
     */
    function calculateWeeklyTotalHours() {
        let totalMinutes = 0;
        const differenceInDays = parseInt(document.getElementById('differenceInDays')?.value || 0);

        // ✅ Πάρε το Μ.Ο. ωρών ημερήσιας εργασίας
        const moOronInput = document.getElementById('mo_oron_hmerhsias_ergasias');
        const moOron = parseFloat(moOronInput?.value) || 0;

        // ✅ Object για tracking ημερήσιων συνόλων
        const dailyHours = {};
        let hasExceeded = false;
        const exceededDays = [];

        // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Tracking για ημερήσια ανάπαυση 11 ωρών
        let hasRestViolation = false;
        const restViolations = [];
        let previousDayEndTime = null; // Ώρα λήξης προηγούμενης ημέρας

        // ✅ Έλεγχος αν ΟΛΑ τα kathgoria_ergasias έχουν τιμή
        let allKathgoriesCompleted = true;

        // Για κάθε ημέρα
        for (let i = 1; i <= differenceInDays; i++) {
            let i1 = i < 10 ? '0' + i : i;
            let dailyMinutes = 0;

            // ✅ Έλεγχος αν το kathgoria_ergasias έχει τιμή
            const kathgoriaInput = document.getElementById(`kathgoria_ergasias_stathera_${i1}`);
            const kathgoriaValue = kathgoriaInput?.value || '';

            if (!kathgoriaValue || !['ΑΝ', 'ΕΡΓ', 'ΜΕ', 'ΤΗΛ'].includes(kathgoriaValue)) {
                allKathgoriesCompleted = false;
            }

            // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Βρες την πρώτη ώρα έναρξης και τελευταία ώρα λήξης της ημέρας
            let currentDayStartTime = null;
            let currentDayEndTime = null;

            // Για κάθε j (1, 2, 3)
            for (let j = 1; j <= 3; j++) {
                const apoOra = document.getElementById(`apo_ora_0${j}_${i1}`)?.value;
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

                dailyMinutes += diffMinutes;
                totalMinutes += diffMinutes;

                // ✅ Track πρώτη ώρα έναρξης
                if (currentDayStartTime === null) {
                    currentDayStartTime = apoMinutes;
                }

                // ✅ Track τελευταία ώρα λήξης
                currentDayEndTime = eosMinutes;
            }

            // ✅ Μετατροπή σε ώρες για την ημέρα
            const dailyHoursValue = dailyMinutes / 60;
            dailyHours[i1] = dailyHoursValue;

            // ✅ ΕΛΕΓΧΟΣ: Ημερήσιο σύνολο > Μ.Ο.?
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

            // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Ημερήσια ανάπαυση 11 ωρών (ΜΕΣΑ στο loop!)
            if (i > 1 && previousDayEndTime !== null && currentDayStartTime !== null) {
                const prevDayNum = i - 1;
                const prevDayI1 = prevDayNum < 10 ? '0' + prevDayNum : prevDayNum.toString();

                // Βρες αν η προηγούμενη ημέρα είχε εργασία
                let prevDayHadWork = false;
                for (let j = 1; j <= 3; j++) {
                    const prevApoOra = document.getElementById(`apo_ora_0${j}_${prevDayI1}`)?.value;
                    const prevEosOra = document.getElementById(`eos_ora_0${j}_${prevDayI1}`)?.value;

                    if (prevApoOra && prevEosOra && prevApoOra !== '' && prevEosOra !== '') {
                        prevDayHadWork = true;
                        break;
                    }
                }

                // ✅ Μόνο αν ΚΑΙ οι 2 ημέρες έχουν εργασία
                if (prevDayHadWork && dailyMinutes > 0 && previousDayEndTime > 0) {
                    // Υπολόγισε τη διαφορά
                    let restMinutes = currentDayStartTime - previousDayEndTime;

                    // Αν η διαφορά είναι αρνητική, σημαίνει ότι περάσαμε στην επόμενη μέρα
                    if (restMinutes < 0) {
                        restMinutes += 24 * 60;
                    }

                    const restHours = restMinutes / 60;

                    // ✅ Έλεγχος: < 11 ώρες ανάπαυση
                    if (restHours < 11) {
                        hasRestViolation = true;

                        const prevDayLabel =
                            document.getElementById(`day_label_${prevDayI1}`)?.textContent ||
                            `Ημέρα ${prevDayNum}`;
                        const currentDayLabel =
                            document.getElementById(`day_label_${i1}`)?.textContent || `Ημέρα ${i}`;

                        restViolations.push({
                            prevDay: prevDayLabel,
                            currentDay: currentDayLabel,
                            restHours: restHours.toFixed(2)
                        });
                    }
                }
            }

            // ✅ Update previousDayEndTime για την επόμενη επανάληψη
            if (dailyMinutes > 0 && currentDayEndTime !== null && currentDayEndTime > 0) {
                previousDayEndTime = currentDayEndTime;
            } else {
                previousDayEndTime = null;
            }
        } // ← ΕΔΩ τελειώνει το for loop

        const totalHours = (totalMinutes / 60).toFixed(2);
        const totalInput = document.getElementById('total_hours_day');

        // ✅ ΕΛΕΓΧΟΣ 1: Μόνο αν totalHours <= 40
        if (totalInput && parseFloat(totalHours) <= 40) {
            totalInput.value = totalHours;
        } else if (parseFloat(totalHours) > 40) {
            return false;
        }

        // ✅ ΕΛΕΓΧΟΣ: Ημερήσιο σύνολο > Μ.Ο.?
        if (hasExceeded) {
            let daysMessage = exceededDays
                .map(
                    (day) =>
                        `<div style="text-align: left; margin: 5px 0;">
					<strong>${day.day}:</strong> ${day.hours} ώρες (Μ.Ο.: ${day.mo})
				</div>`
                )
                .join('');

            Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'warning',
                title: 'ΠΡΟΣΟΧΗ - ΥΠΕΡΒΑΣΗ ΩΡΩΝ !!! ',
                html: `
					<div style="text-align: center;">
						<p>Οι παρακάτω ημέρες έχουν περισσότερες ώρες από τον Μ.Ο. ημερήσιας εργασίας:</p>
						${daysMessage}
					</div>
				`,
                showConfirmButton: true,
                confirmButtonText: 'Το κατάλαβα',
                customClass: {
                    confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
        }

        // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Ημερήσια ανάπαυση < 11 ώρες
        if (hasRestViolation) {
            let restMessage = restViolations
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

        // ✅ ΕΛΕΓΧΟΣ 2: Σύγκριση με ores_ergasias_ebdomadas
        if (allKathgoriesCompleted) {
            const oresErgasiasInput = document.getElementById('ores_ergasias_ebdomadas');
            if (oresErgasiasInput && oresErgasiasInput.value) {
                const expectedHours = parseFloat(oresErgasiasInput.value);
                const actualHours = parseFloat(totalHours);

                if (actualHours !== expectedHours) {
                    Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'info',
                        title: 'ΠΡΟΣΟΧΗ !!!',
                        text: 'Δεν συμφωνούν οι ώρες εβδομαδιαίας εργασίας με το σύνολο των ωρών του δηλωθέντος ωραρίου',
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

    /**
     * Μετατροπή "HH:MM" σε λεπτά
     */
    function timeToMinutes(timeString) {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
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
