// public\js\ergazomenoi\genika\getFieldValues.js

document.addEventListener('DOMContentLoaded', () => {
    const isEmpty = (v) => !String(v ?? '').trim();
    const isEmptyArray = (v) => !Array.isArray(v) || v.length === 0;
    let message = '';
    let erganiUploadInProgress = false;

    // ============================================================================
    // ✅ PROGRESS ANIMATION FUNCTION
    // ============================================================================
    function startProgressAnimation() {
        const steps = [
            { percent: 15, text: 'Αποθήκευση στοιχείων εργαζόμενου...', duration: 800 },
            { percent: 30, text: 'Δημιουργία DOCX από template...', duration: 1500 },
            { percent: 50, text: 'Συμπλήρωση στοιχείων σύμβασης...', duration: 2000 },
            { percent: 70, text: 'Μετατροπή DOCX σε PDF...', duration: 3000 },
            { percent: 85, text: 'Ανέβασμα στο S3 Cloud...', duration: 1500 },
            { percent: 95, text: 'Δημιουργία presigned URL...', duration: 800 }
        ];

        let currentStepIndex = 0;

        function updateProgress() {
            if (currentStepIndex >= steps.length) return;

            const step = steps[currentStepIndex];
            const progressBar = document.getElementById('pdf-progress-bar');
            const progressText = document.getElementById('progress-step-text');

            if (progressBar && progressText) {
                progressBar.style.width = `${step.percent}%`;
                progressBar.textContent = `${step.percent}%`;
                progressBar.setAttribute('aria-valuenow', step.percent);
                progressText.textContent = step.text;
            }

            currentStepIndex++;

            if (currentStepIndex < steps.length) {
                setTimeout(updateProgress, step.duration);
            }
        }

        // Start animation
        setTimeout(updateProgress, 150);
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        event.stopPropagation();

        const formData = {};
        const filePromises = [];
        const sections = document.querySelectorAll('.card-body');

        // =========================================================================
        // COLLECT FORM DATA
        // =========================================================================

        sections.forEach((section) => {
            const inputs = section.querySelectorAll('input, select, textarea');
            inputs.forEach((input) => {
                // =====================================================================
                // ✅ INPUT HANDLING
                // =====================================================================
                if (input.tagName === 'INPUT') {
                    // ✅ 1. CHECKBOX (πρώτο, γιατί έχει priority)
                    if (input.type === 'checkbox') {
                        formData[input.name] = input.checked === true;
                    }

                    // ✅ 2. HIDDEN BOOLEAN (δεύτερο)
                    else if (
                        input.type === 'hidden' &&
                        (input.value === 'true' || input.value === 'false')
                    ) {
                        formData[input.name] = input.value === 'true';
                    }

                    // ✅ 3. DATE (κενό)
                    else if (input.type === 'date') {
                        formData[input.name] = input.value === '' ? null : input.value;
                    }

                    // ✅ 4. TIME (κενό)
                    else if (input.type === 'time') {
                        formData[input.name] = input.value === '' ? null : input.value;
                    }

                    // ✅ 5. NUMBER
                    else if (input.type === 'number') {
                        const parsed = parseFloat(input.value);
                        formData[input.name] = isNaN(parsed) ? 0 : parsed;
                    }

                    // ✅ 6. FILE
                    else if (input.type === 'file' && input.files.length > 0) {
                        const filePromise = new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = function (e) {
                                formData[input.name] = e.target.result;
                                resolve();
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(input.files[0]);
                        });
                        filePromises.push(filePromise);
                    }

                    // ✅ 7. READONLY/DISABLED (τελευταίο fallback)
                    else if (input.hasAttribute('readonly') || input.hasAttribute('disabled')) {
                        // Ειδική περίπτωση: αν είναι number, parse το
                        if (input.type === 'number') {
                            const parsed = parseFloat(input.value);
                            formData[input.name] = isNaN(parsed) ? 0 : parsed;
                        } else {
                            formData[input.name] = input.value;
                        }
                    }

                    // ✅ 8. DEFAULT (κανονικό input)
                    else {
                        formData[input.name] = input.value;
                    }
                }

                // =====================================================================
                // ✅ TEXTAREA HANDLING
                // =====================================================================
                else if (input.tagName === 'TEXTAREA') {
                    formData[input.name] = input.value;
                }

                // =====================================================================
                // ✅ SELECT HANDLING
                // =====================================================================
                else if (input.tagName === 'SELECT') {
                    if (input.multiple) {
                        const selectedOptions = Array.from(input.selectedOptions).map(
                            (option) => option.value
                        );
                        formData[input.name] = selectedOptions.length > 0 ? selectedOptions : [];
                    } else {
                        formData[input.name] =
                            input.selectedIndex === -1
                                ? null
                                : input.options[input.selectedIndex].value;
                    }
                }
            });
        });

        // =========================================================================
        // ✅ CONVERT PDFs TO BASE64 (using pdfUploadModule - PRIMARY SOURCE)
        // =========================================================================

        // Map document types to form field names
        const pdfMappings = {
            arxeio_symbashs: 'arxeio_apodoxhs_oron_atomikhs_symbashs_base64',
            oysiodeis_oroi: 'arxeio_apodoxhs_oysiodon_oron_base64',
            anhlikoi: 'bibliario_anhlikoy_base64',
            allodapoi: 'arxeio_nomimopoihtikon_eggrafon_base64',
            symbash_daneismoy: 'arxeio_symbashs_daneismoy_base64'
        };

        // ✅ PRIMARY: Get files from pdfUploadModule (selectedFiles)
        if (window.pdfUploadModule) {
            for (const [documentType, base64Field] of Object.entries(pdfMappings)) {
                try {
                    const base64Data = await window.pdfUploadModule.getFileAsBase64(documentType);

                    if (base64Data) {
                        formData[base64Field] = base64Data;
                    }
                } catch (error) {
                    console.error(`❌ Failed to convert ${documentType}:`, error);
                }
            }
        } else {
            console.warn('⚠️ pdfUploadModule not loaded!');
        }

        // ✅ FALLBACK: Check pdfPreviewModule (for drag & drop without modal confirm)
        if (window.pdfPreviewModule) {
            for (const [documentType, base64Field] of Object.entries(pdfMappings)) {
                // Only use if field is still empty
                if (!formData[base64Field] && window.pdfPreviewModule.hasFile(documentType)) {
                    try {
                        const base64Data =
                            await window.pdfPreviewModule.getFileAsBase64(documentType);

                        if (base64Data) {
                            formData[base64Field] = base64Data;
                        }
                    } catch (error) {
                        console.error(
                            `❌ Failed to convert ${documentType} from preview module:`,
                            error
                        );
                    }
                }
            }
        }

        console.log('📦 Συλλεγμένα δεδομένα φόρμας:', formData);

        try {
            await Promise.all(filePromises);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

            // =========================================================================
            // VALIDATION
            // =========================================================================

            // Ορισμός critical fields
            const CRITICAL_FIELDS = {
                email: '⚠️ Emai Εργαζόμενου/ης',
                karta_ergasias: '⚠️ Κάρτα Εργασίας',
                evelikth_proselefsh: '⚠️ Ευέλικτη Προσέλευση (λεπτά)',
                systatiko_shmeioma: '⚠️ Τοποθέτηση με Συστατικό Σημείωμα',
                topothethsh_me_programma: '⚠️ Τοποθέτηση με Πρόγραμμα'
            };

            const errors = [];

            // Helper function
            const addError = (fieldName, displayName) => {
                const value = formData[fieldName];

                // 1️⃣ Κανονικός έλεγχος κενού
                if (isEmpty(value)) {
                    const isCritical = CRITICAL_FIELDS.hasOwnProperty(fieldName);
                    errors.push({
                        text: isCritical ? CRITICAL_FIELDS[fieldName] : displayName,
                        critical: isCritical
                    });
                    return;
                }

                // 2️⃣ Ειδικός έλεγχος για μηδενικές αποδοχές
                if (
                    (fieldName === 'pragmatikosMisthos' || fieldName === 'pragmatikoOromisthio') &&
                    Number(value) === 0
                ) {
                    const isCritical = CRITICAL_FIELDS.hasOwnProperty(fieldName);

                    errors.push({
                        text: `${displayName} είναι < από το ελάχιστο της ΣΣΕ`,
                        critical: isCritical
                    });
                }
            };

            // Έλεγχοι
            addError('eponymoHidden', 'Επώνυμο');
            addError('onomaHidden', 'Όνομα');
            addError('afm_ergazomenoyHidden', 'ΑΦΜ');
            addError('amka_ergazomenoyHidden', 'ΑΜΚΑ');
            addError('patronymo', 'Πατρώνυμο');
            addError('mhtronymo', 'Μητρώνυμο');
            addError('taytothta_stathera', 'Tύπος Νομ. Εγγράφου');
            addError('adt', 'Αριθμός Νομ. Εγγράφου');
            addError('hmeromhnia_gennhshs', 'Ημ/νία Γέννησης');
            addError('yphkoothta_stathera', 'Υπηκοότητα');
            addError('oikogeneiakh_katastash_stathera', 'Οικογενειακή Κατάσταση');
            addError('arithmos_teknon', 'Αριθ. Τέκνων/Προστ. Μελών');
            addError('ekpaideytiko_epipedo_stathera', 'Εκπαιδευτικό Επίπεδο');
            addError('hmeromhnia_proslhpshs', 'Ημ/νία Πρόσληψης');
            addError('ores_ergasias_ebdomadas', 'Ώρες Εβδ/διαίας Εργασίας');
            addError('ora_enarxhs_proths_foras', 'Ώρα Έναρξης την 1η Ημέρα');
            addError(
                'ora_apoxorhshs_proths_foras',
                'Ώρα Αποχώρησης από την Εργασία (κατά την 1η ημέρα πρόσληψης)'
            );
            addError('eidikothta_erganh_stathera', 'Ειδικότητα ΕΡΓΑΝΗ');
            addError('proyphresia_se_eth', 'Έτη Προϋπηρεσίας');
            addError('pragmatikosMisthos', 'Πραγματικός Μισθός');
            addError('pragmatikoOromisthio', 'Πραγματικό Ορομίσθιο');
            addError('kathestos_apasxolhshs_stathera', 'Καθεστώς Απασχόλησης');
            addError('sxesh_ergasias_stathera', 'Σχέση Εργασίας');
            addError('xarakthrismos_ergazomenon', 'Χαρακτηρισμός Εργαζόμενου/ης');
            addError('systatiko_shmeioma', 'Τοποθέτηση με Συστατικό Σημείωμα');
            addError('topothethsh_me_programma', 'Τοποθέτηση με Πρόγραμμα');
            addError('epidoma_anergias', 'Λήψη Επιδόματος Ανεργίας');
            addError('symbatikes_ores_ergasias', 'Συμβατικές Ώρες Εργασίας');
            addError('apasxolhsh_basei_symbashs_stathera', 'Απασχόληση Βάσει Σύμβασης');
            addError('dialleima_se_lepta', 'Διάλλειμα (Σε Λεπτά)');
            addError('dialleima_entos_ektos_orarioy', 'Εντός/Εκτός Ωραρίου');

            // ✅ Ειδικός έλεγχος για Κάρτα Εργασίας και Ευέλικτη Προσέλευση
            const evelikthField = document.getElementById('evelikth_proselefsh');

            if (evelikthField) {
                if (evelikthField.hasAttribute('disabled') || evelikthField.disabled) {
                    addError('karta_ergasias', 'Κάρτα Εργασίας');
                } else {
                    if (
                        formData.evelikth_proselefsh === '0' ||
                        formData.evelikth_proselefsh === 0 ||
                        isEmpty(formData.evelikth_proselefsh)
                    ) {
                        addError('evelikth_proselefsh', 'Ευέλικτη Προσέλευση (λεπτά)');
                    }
                }
            }

            if (errors.length) {
                const hasNonCriticalErrors = errors.some((error) => !error.critical);

                if (hasNonCriticalErrors) {
                    const errorItems = errors
                        .map((error, index) => {
                            const cssClass = error.critical
                                ? 'error-item error-critical'
                                : 'error-item';
                            return `<div class="${cssClass}"><strong>${index + 1}</strong>.${error.text}</div>`;
                        })
                        .join('');

                    const gridHTML = `
                        <div class="error-grid-container">
                            <div class="error-grid">${errorItems}</div>
                        </div>
                    `;

                    const validationResult = await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'warning',
                        title: 'ΠΡΟΣΟΧΗ !!!',
                        html: `<p class="error-header">Τα παρακάτω ${errors.length} πεδία είναι υποχρεωτικά για την πρόσληψη:</p>
                        <p class="warning-header">Τα πεδία με το εικονίδιο ⚠️ είναι προειδοποιητικά και μόνο για επανέλεγχο</p>${gridHTML}`,
                        heightAuto: true,
                        showCancelButton: true,
                        confirmButtonText: 'Συνέχεια',
                        cancelButtonText: 'Κλείσιμο',
                        customClass: {
                            confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                            cancelButton: 'class-secondary custom-cancel-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup',
                            htmlContainer: 'custom-html-container'
                        },
                        didOpen: () => {
                            const confirmBtn = document.querySelector('.swal2-confirm');
                            const cancelBtn = document.querySelector('.swal2-cancel');

                            if (confirmBtn) {
                                confirmBtn.title = 'Αποθήκευση ΜΟΝΟ των στοιχείων του εργαζόμενου';
                            }
                            if (cancelBtn) {
                                cancelBtn.title = 'Επιστροφή για ΔΙΟΡΘΩΣΗ των ελλείψεων';
                            }
                        }
                    });

                    // ✅ "Κλείσιμο" → σταματάμε
                    if (validationResult.isDismissed) {
                        // return;
                    }

                    // ✅ "Συνέχεια" → συνεχίζουμε με skipValidation = true
                    // (παραλείπουμε schedule checks + disabled checkboxes στο ΕΡΓΑΝΗ modal)
                }
            }

            // =====================================================================
            // ✅ FLAG: αν φτάσαμε εδώ μέσω "Συνέχεια" από validation errors
            // =====================================================================
            const skipScheduleValidation = errors.length > 0 && errors.some((e) => !e.critical);

            // =========================================================================
            // ✅ PRE-VALIDATION: Check WTO schedules (παραλείπεται αν skipScheduleValidation)
            // =========================================================================

            if (!skipScheduleValidation) {
                console.log('🔍 [PRE-VALIDATION] Checking weekly schedule...');

                const days = ['01', '02', '03', '04', '05', '06', '07'];
                const scheduleErrors = [];
                const emptyDays = [];

                days.forEach((day) => {
                    const category = (formData[`kathgoria_ergasias_${day}`] || '').trim();
                    if (!category) {
                        const label = document.getElementById(`day_label_${day}`);
                        const dateStr = label ? label.textContent.trim() : `Ημέρα ${day}`;
                        emptyDays.push(dateStr);
                    }
                });

                if (emptyDays.length > 0) {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'error',
                        title: 'Ελλιπές Εβδομαδιαίο Ωράριο',
                        html: `
                            <p><strong>${emptyDays.length}</strong> ημέρες δεν έχουν Κατηγορία Εργασίας:</p>
                            <ul style="text-align: left; padding-left: 20px; margin-top: 10px;">
                                ${emptyDays.map((date) => `<li><strong>${date}</strong></li>`).join('')}
                            </ul>
                            <p class="text-muted" style="margin-top: 15px; font-size: 0.9rem;">
                                Πήγαινε στην καρτέλα <strong>"Ωράριο Εργασίας"</strong> και συμπλήρωσε την κατηγορία για όλες τις ημέρες (ΕΡΓ, ΤΗΛ, ΑΝ, ΜΕ).
                            </p>
                        `,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: 'class-error custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });
                    // return;
                }

                console.log('✅ [PRE-VALIDATION] All days have categories');

                days.forEach((day) => {
                    const category = (formData[`kathgoria_ergasias_${day}`] || '')
                        .trim()
                        .toUpperCase();
                    const label = document.getElementById(`day_label_${day}`);
                    const dateStr = label ? label.textContent.trim() : `Ημέρα ${day}`;

                    const apo1 = (formData[`apo_ora_01_${day}`] || '').trim();
                    const eos1 = (formData[`eos_ora_01_${day}`] || '').trim();
                    const apo2 = (formData[`apo_ora_02_${day}`] || '').trim();
                    const eos2 = (formData[`eos_ora_02_${day}`] || '').trim();
                    const apo3 = (formData[`apo_ora_03_${day}`] || '').trim();
                    const eos3 = (formData[`eos_ora_03_${day}`] || '').trim();

                    const isEmpty = (val) => !val || val === '--:--' || val === '';
                    const isValidTime = (val) => val && val.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

                    const allTimes = [apo1, eos1, apo2, eos2, apo3, eos3];
                    const nonEmptyTimes = allTimes.filter((t) => !isEmpty(t));

                    if (category === 'ΕΡΓ' || category === 'ΤΗΛ') {
                        const shift1Valid = isValidTime(apo1) && isValidTime(eos1);
                        const shift2Valid = isValidTime(apo2) && isValidTime(eos2);
                        const shift3Valid = isValidTime(apo3) && isValidTime(eos3);
                        if (!shift1Valid && !shift2Valid && !shift3Valid) {
                            scheduleErrors.push(
                                `<strong>${dateStr}</strong>: Κατηγορία <strong>${category}</strong> χωρίς ώρες (από-έως)`
                            );
                        }
                    }

                    if (category === 'ΜΕ' || category === 'ΑΝ') {
                        if (nonEmptyTimes.length > 0) {
                            scheduleErrors.push(
                                `<strong>${dateStr}</strong>: Κατηγορία <strong>${category}</strong> ΔΕΝ πρέπει να έχει ώρες (βρέθηκαν ${nonEmptyTimes.length} πεδία με τιμές)`
                            );
                        }
                    }
                });

                if (scheduleErrors.length > 0) {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'error',
                        title: 'Λάθη στο Εβδομαδιαίο Ωράριο',
                        html: `
                            <p>Βρέθηκαν <strong>${scheduleErrors.length}</strong> λάθη στο ωράριο:</p>
                            <ul style="text-align: left; padding-left: 20px; margin-top: 10px;">
                                ${scheduleErrors.map((err) => `<li>${err}</li>`).join('')}
                            </ul>
                            <p class="text-muted" style="margin-top: 15px; font-size: 0.9rem;">
                                Πήγαινε στην καρτέλα <strong>"Ωράριο Εργασίας"</strong> και διόρθωσε τα πεδία.
                            </p>
                        `,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: 'class-error custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup',
                            htmlContainer: 'custom-html-container'
                        }
                    });
                    return;
                }

                console.log('✅ [PRE-VALIDATION] All schedule checks passed');
            } else {
                console.log('⚠️ [PRE-VALIDATION] Skipped (user chose Συνέχεια)');
            }

            // =========================================================================
            // ✅ ΕΡΓΑΝΗ FILES SELECTION
            // =========================================================================

            const result = await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'info',
                title: 'ΕΝΗΜΕΡΩΣΗ ΕΡΓΑΝΗ ΙΙ',
                html: `
                    <div class="display-flex flex-direction-column left-align gap-1rem padding-1rem swal-overflow">
                        <p class="font-weight-600 margin-bottom-0_5rem">Τρόπος Αποθήκευσης:</p>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                   id="storage_temporary"
                                   name="storage_mode"
                                   value="temporary"
                                   class="custom-radio"
                                   ${skipScheduleValidation ? 'disabled' : 'checked'} />
                            <label for="storage_temporary"
                                   class="margin-0 cursor-pointer font-size-rem-1_05 font-weight-600 temp_perm"
                                   style="color: ${skipScheduleValidation ? '#aaaaaa' : '#000000'}">
                                Προσωρινή Αποθήκευση (XML)
                            </label>
                        </div>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                   id="storage_permanent"
                                   name="storage_mode"
                                   value="permanent"
                                   class="custom-radio"
                                   ${skipScheduleValidation ? 'disabled' : ''} />
                            <label for="storage_permanent"
                                   class="margin-0 cursor-pointer font-size-rem-1_05 font-weight-600 temp_perm"
                                   style="color: ${skipScheduleValidation ? '#aaaaaa' : '#184d00'}">
                                <strong>Οριστική Ενημέρωση (REST API)</strong>
                            </label>
                        </div>

                        <hr class="hr-style" />
                        <p class="font-weight-600 margin-bottom-0_5rem">Ενέργεια ΕΡΓΑΝΗ:</p>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                   id="ergani_action_none"
                                   name="ergani_main_action"
                                   value="none"
                                   class="custom-radio"
                                   ${skipScheduleValidation ? 'checked' : ''} />
                            <label for="ergani_action_none"
                                   class="margin-0 cursor-pointer font-size-rem-1_05">
                                Χωρίς ενέργεια ΕΡΓΑΝΗ
                            </label>
                        </div>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                   id="e3_anaggelia_proslhpshs"
                                   name="ergani_main_action"
                                   value="e3_anaggelia_proslhpshs"
                                   class="custom-radio"
                                   ${skipScheduleValidation ? 'disabled' : ''} />
                            <label for="e3_anaggelia_proslhpshs"
                                   class="margin-0 cursor-pointer font-size-rem-1_05"
                                   style="color: ${skipScheduleValidation ? '#aaaaaa' : 'inherit'}">
                                Αναγγελία Πρόσληψης (E3N)
                            </label>
                        </div>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                   id="wto_pshfiakh_organosh_xronoy_ergasias"
                                   name="ergani_main_action"
                                   value="wto"
                                   class="custom-radio"
                                   ${skipScheduleValidation ? 'disabled' : ''} />
                            <label for="wto_pshfiakh_organosh_xronoy_ergasias"
                                   class="margin-0 cursor-pointer font-size-rem-1_05"
                                   style="color: ${skipScheduleValidation ? '#aaaaaa' : 'inherit'}">
                                Ψηφιακή Οργάνωση Χρόνου Εργασίας (WTO)
                            </label>
                        </div>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                   id="ergani_action_both"
                                   name="ergani_main_action"
                                   value="both"
                                   class="custom-radio"
                                   ${skipScheduleValidation ? 'disabled' : 'checked'} />
                            <label for="ergani_action_both"
                                   class="margin-0 cursor-pointer font-size-rem-1_05"
                                   style="color: ${skipScheduleValidation ? '#aaaaaa' : 'inherit'}">
                                Αναγγελία Πρόσληψης (E3N) + WTO
                            </label>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                didOpen: () => {
                    document.querySelectorAll('input[name="storage_mode"]').forEach((radio) => {
                        radio.addEventListener('change', function () {
                            document.querySelectorAll('label.temp_perm').forEach((lbl) => {
                                lbl.style.fontWeight = '400';
                            });
                            const selectedLabel = document.querySelector(`label[for="${this.id}"]`);
                            if (selectedLabel) selectedLabel.style.fontWeight = '700';
                        });
                    });
                },
                preConfirm: () => {
                    const storageModeRadio = document.querySelector(
                        'input[name="storage_mode"]:checked'
                    );
                    const isPermanent = storageModeRadio?.value === 'permanent';

                    const erganiMainActionRadio = document.querySelector(
                        'input[name="ergani_main_action"]:checked'
                    );
                    const erganiMainAction = erganiMainActionRadio?.value || 'none';

                    const e3Enabled =
                        erganiMainAction === 'e3_anaggelia_proslhpshs' ||
                        erganiMainAction === 'both';

                    const wtoEnabled = erganiMainAction === 'wto' || erganiMainAction === 'both';

                    const filesToUpdate = {
                        isPermanent,
                        erganiUploadMethod:
                            isPermanent && (e3Enabled || wtoEnabled) ? 'rest' : 'xml',
                        e3_anaggelia_proslhpshs: e3Enabled,
                        schedules: wtoEnabled,
                        wto_pshfiakh_organosh_xronoy_ergasias: wtoEnabled
                    };

                    console.log('🔍 [FRONTEND] ERGANI selections:', filesToUpdate);

                    return filesToUpdate;
                },
                confirmButtonText: 'Ενημέρωση',
                cancelButtonText: 'Ακύρωση',
                showCancelButton: true,
                customClass: {
                    confirmButton: 'class-info custom-confirm-button custom-swal-button',
                    cancelButton: 'class-secondary custom-cancel-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup',
                    htmlContainer: 'custom-html-container'
                }
            });

            // ✅ Έλεγχος αν ο χρήστης πάτησε "Ακύρωση"
            if (result.isDismissed) {
                return;
            }

            // =========================================================================
            // POST REQUEST
            // =========================================================================

            const payload = {
                formData: formData,
                filesToUpdate: result.value,
                skipContract: skipScheduleValidation // ✅ ΝΕΟ: αν "Συνέχεια", δεν φτιάχνουμε σύμβαση
            };

            if (!skipScheduleValidation) {
                Swal.fire({
                    title: 'Δημιουργία Σύμβασης Εργασίας',
                    html: `
                        <div class="pdf-generation-progress">
                            <div class="progress-spinner">
                                <div class="spinner-border text-success" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>

                            <div class="progress-step-text" id="progress-step-text">
                                Προετοιμασία...
                            </div>

                            <div class="progress-bar-container">
                                <div class="custom-progress">
                                    <div class="custom-progress-bar progress-bar-striped progress-bar-animated"
                                        id="pdf-progress-bar"
                                        role="progressbar"
                                        aria-valuenow="0"
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                        style="width: 0%">
                                        0%
                                    </div>
                                </div>
                            </div>

                            <div class="progress-info-text">
                                <p class="mb-2">Η διαδικασία περιλαμβάνει:</p>
                                <ul class="progress-steps-list">
                                    <li>Αποθήκευση στοιχείων εργαζόμενου</li>
                                    <li>Δημιουργία εγγράφου από template</li>
                                    <li>Μετατροπή σε PDF</li>
                                    <li>Ασφαλή αποθήκευση στο cloud</li>
                                </ul>
                            </div>

                            <div class="progress-time-estimate">
                                <span style="margin-right: 8px;">⏱️</span>
                                <strong>Εκτιμώμενος χρόνος:</strong> 8-10 δευτερόλεπτα
                            </div>
                        </div>
                    `,
                    backdrop: false,
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    customClass: {
                        popup: 'custom-swal-popup',
                        title: 'custom-title'
                    },
                    didOpen: () => {
                        startProgressAnimation();
                    }
                });
            }

            const response = await fetch('/ergazomenoi/ergazomenoi/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            // ============================================================================
            // ✅ SMOOTH PROGRESS COMPLETION (μόνο αν ΔΕΝ είναι skip)
            // ============================================================================

            if (!skipScheduleValidation) {
                await new Promise((resolve) => setTimeout(resolve, 3000));

                const progressBar = document.getElementById('pdf-progress-bar');
                const progressText = document.getElementById('progress-step-text');

                if (progressBar && progressText) {
                    progressBar.style.width = '100%';
                    progressBar.textContent = '100%';
                    progressBar.classList.remove('progress-bar-animated');
                    progressBar.setAttribute('aria-valuenow', 100);
                    progressText.textContent = 'Ολοκλήρωση...';
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                Swal.close();
            }

            // =========================================================================
            // RESPONSE HANDLING
            // =========================================================================

            // 1) Browser auto-followed redirect
            if (response.redirected && response.url) {
                window.location.href = response.url;
                return;
            }

            // 2) 3xx without auto-follow (rare)
            if (response.status >= 300 && response.status < 400) {
                const loc = response.headers.get('Location') || response.headers.get('location');
                if (loc) {
                    const abs = loc.startsWith('http')
                        ? loc
                        : new URL(loc, window.location.origin).toString();
                    window.location.href = abs;
                    return;
                }
                throw new Error(`Redirect ${response.status} χωρίς Location header`);
            }

            // 3) CSRF/Forbidden
            if (response.status === 403) {
                throw new Error('CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.');
            }

            // 4) 204 No Content
            if (response.status === 204) {
                if (window.pdfUploadModule && window.pdfUploadModule.hasPendingUpload()) {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'warning',
                        title: 'Ο εργαζόμενος αποθηκεύτηκε',
                        html: `<p><strong>Αλλά το PDF δεν ανέβηκε!</strong></p>
                            <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                                Ο server επέστρεψε 204 No Content χωρίς ID εργαζόμενου.
                            </p>`,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    }).then(() => (window.location.href = '/ergazomenoi/ergazomenoi'));
                } else {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'success',
                        title: 'Επιτυχής καταχώριση!',
                        timer: 1200,
                        showConfirmButton: false,
                        customClass: {
                            confirmButton: 'class-success custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    }).then(() => (window.location.href = '/ergazomenoi/ergazomenoi'));
                }
                return;
            }

            // 5) ✅ JSON RESPONSE (MAIN SUCCESS PATH)
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                const data = await response.json();
                message = data?.errorMessage || '';

                if (!response.ok || !data?.success) {
                    throw new Error(`HTTP ${response.status} / success=${data?.success}`);
                }

                // =====================================================================
                // ✅ DECLARE XML DATA (ONCE - AT THE TOP)
                // =====================================================================
                const e3XmlData = data?.e3XmlData || null;
                const hasE3Xml = e3XmlData && e3XmlData.success === true;

                const wtoXmlData = data?.wtoXmlData || null;
                const hasWtoXml = wtoXmlData && wtoXmlData.success === true;

                const userWantsE3 = result.value?.e3_anaggelia_proslhpshs === true;
                const userWantsWto =
                    result.value?.wto_pshfiakh_organosh_xronoy_ergasias === true ||
                    result.value?.schedules === true;
                const isRestSubmit =
                    result.value?.isPermanent === true &&
                    result.value?.erganiUploadMethod === 'rest';
                const isE3NRestSubmit = userWantsE3 && isRestSubmit;
                const isWTOWeekRestSubmit = userWantsWto && isRestSubmit;

                // ✅ BUILD HTML STRINGS (ONCE)
                const e3XmlHtml =
                    hasE3Xml && userWantsE3 && !isE3NRestSubmit
                        ? `<p class="text-success mt-3">✅ E3 XML δημιουργήθηκε επιτυχώς!</p>
                    <a href="${e3XmlData.downloadUrl}" 
                        download="${e3XmlData.filename}"
                        class="btn btn-sm btn-outline-primary mt-2">
                        <i class="bi bi-download"></i> Λήψη E3 XML
                    </a>`
                        : '';

                const e3RestPendingHtml = isE3NRestSubmit
                    ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί οριστική υποβολή E3N μέσω REST API. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                    : '';

                const wtoXmlHtml =
                    hasWtoXml && userWantsWto && !isWTOWeekRestSubmit
                        ? `<p class="text-success mt-3">✅ WTO XML δημιουργήθηκε επιτυχώς!</p>
                    <a href="${wtoXmlData.downloadUrl}" 
                        download="${wtoXmlData.filename}"
                        class="btn btn-sm btn-outline-success mt-2">
                        <i class="bi bi-download"></i> Λήψη WTO XML
                    </a>`
                        : '';

                const wtoRestPendingHtml = isWTOWeekRestSubmit
                    ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί οριστική υποβολή WTOWeek μέσω REST API. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                    : '';

                // ✅ CHECK: Did we send PDFs?
                const hadPdfs = window.pdfUploadModule && window.pdfUploadModule.hasPendingUpload();

                // ✅ CHECK: Did backend save the PDFs?
                const pdfResults = data?.pdfResults || [];
                const successfulPdfs = pdfResults.filter((r) => r.success);
                const failedPdfs = pdfResults.filter((r) => !r.success);

                // ✅ Clear in-memory PDFs (no longer needed)
                if (hadPdfs && window.pdfUploadModule.clearAllFiles) {
                    window.pdfUploadModule.clearAllFiles();
                }

                // ✅ Success/Warning Messages
                if (failedPdfs.length === 0) {
                    // ✅ Check: Does response have contract PDF preview?
                    if (data.contractPdf && data.contractPdf.showPreview && data.contractPdf.url) {
                        // ✅ VALIDATION: Check if s3Key exists
                        if (!data.contractPdf.s3Key) {
                            console.error('❌ [FRONTEND] Missing s3Key in backend response!');
                            console.error('   contractPdf:', data.contractPdf);

                            // ✅ Fallback: Show alert without email button
                            await Swal.fire({
                                backdrop: false,
                                icon: 'warning',
                                title: 'PDF Δημιουργήθηκε',
                                html: `
                                    <p>Το PDF δημιουργήθηκε επιτυχώς!</p>
                                    <p class="text-warning">⚠️ Η αποστολή email δεν είναι διαθέσιμη (missing S3 key)</p>
                                `,
                                confirmButtonText: 'OK'
                            }).then(() => {
                                window.location.href =
                                    data.redirectUrl || '/ergazomenoi/ergazomenoi';
                            });

                            return;
                        }

                        // ✅ Get employee name from form data
                        const employeeName =
                            `${formData.eponymoHidden || ''} ${formData.onomaHidden || ''}`.trim() ||
                            'UNKNOWN';

                        // ✅ Get company data from response
                        const companyData = {
                            email: data.companyEmail || null,
                            phone: data.companyPhone || null,
                            name: data.companyName || null,
                            type: data.companyType || 'ΕΠΙΧΕΙΡΗΣΗ'
                        };

                        // =====================================================================
                        // ✅ SHOW MODAL (STEP 1) - User downloads/emails PDF
                        // =====================================================================
                        console.log('📄 Opening PDF modal...');

                        // ✅ Store upload options globally (so modal can access them)
                        window.__erganhUploadOptions = {
                            isPermanent: result.value?.isPermanent === true,
                            erganiUploadMethod: result.value?.erganiUploadMethod || 'xml',
                            e3Enabled: result.value?.e3_anaggelia_proslhpshs === true,
                            wtoEnabled:
                                result.value?.wto_pshfiakh_organosh_xronoy_ergasias === true ||
                                result.value?.schedules === true,
                            wto_pshfiakh_organosh_xronoy_ergasias:
                                result.value?.wto_pshfiakh_organosh_xronoy_ergasias === true ||
                                result.value?.schedules === true
                        };

                        console.log('[MAIN] Stored upload options:', window.__erganhUploadOptions);

                        await showContractPdfModalAndWait(
                            data.contractPdf.url,
                            data.contractPdf.s3Key,
                            data.redirectUrl || '/ergazomenoi/ergazomenoi',
                            employeeName,
                            companyData,
                            e3XmlData,
                            wtoXmlData,
                            data.data?._id,
                            result.value // ✅ Pass filesToUpdate (checkbox state)
                        );

                        // =====================================================================
                        // ✅ AFTER MODAL CLOSES (STEP 2) - Upload to ERGANH happens automatically
                        // (handled inside showContractPdfModalAndWait function)
                        // =====================================================================
                    } else {
                        // =====================================================================
                        // ✅ NO PDF PREVIEW - Show success with XML downloads
                        // =====================================================================
                        await Swal.fire({
                            backdrop: false,
                            allowOutsideClick: false,
                            icon: 'success',
                            title: 'Επιτυχής καταχώριση!',
                            html: `
                                <p>Ο εργαζόμενος αποθηκεύτηκε!</p>
                                ${
                                    successfulPdfs.length > 0
                                        ? `<p class="text-success">✅ ${successfulPdfs.length} PDF αποθηκεύτηκαν επιτυχώς</p>`
                                        : ''
                                }
                                ${e3XmlHtml}
                                ${e3RestPendingHtml}
                                ${wtoRestPendingHtml}
                                ${wtoXmlHtml}
                            `,
                            timer:
                                hasE3Xml || hasWtoXml || isE3NRestSubmit || isWTOWeekRestSubmit
                                    ? null
                                    : 1500,
                            showConfirmButton:
                                hasE3Xml || hasWtoXml || isE3NRestSubmit || isWTOWeekRestSubmit,
                            confirmButtonText: 'OK',
                            customClass: {
                                confirmButton:
                                    'class-success custom-confirm-button custom-swal-button',
                                title: 'custom-title',
                                popup: 'custom-swal-popup'
                            }
                        });

                        // =====================================================================

                        if (isRestSubmit) {
                            const uploadResults = await runRestUploadsAfterEmployeeSave({
                                ergazomenosId: data.data?._id,
                                filesToUpdate: result.value,
                                redirectUrl: data.redirectUrl || '/ergazomenoi/ergazomenoi'
                            });

                            if (
                                uploadResults?.e3Result?.success === false ||
                                uploadResults?.wtoResult?.success === false
                            ) {
                                console.warn(
                                    '[REDIRECT] Skipped because ERGANI REST upload failed.'
                                );
                                return;
                            }

                            window.location.href = data.redirectUrl || '/ergazomenoi/ergazomenoi';
                            return;
                        }

                        // ✅ UPLOAD BOTH XMLs TO ERGANH (SEQUENTIAL)
                        // =====================================================================

                        // ✅ 1. Upload E3 XML (if exists)
                        let e3Result = { success: true }; // Default to success if not uploaded

                        if (
                            e3XmlData?.success &&
                            data.data?._id &&
                            (e3XmlData?.relativePath ||
                                e3XmlData?.s3Url ||
                                e3XmlData?.downloadUrl ||
                                e3XmlData?.s3Key)
                        ) {
                            const e3UrlToSend =
                                e3XmlData?.relativePath ||
                                e3XmlData?.s3Url ||
                                e3XmlData?.downloadUrl ||
                                e3XmlData?.s3Key ||
                                null;

                            if (e3UrlToSend && typeof e3UrlToSend === 'string') {
                                try {
                                    console.log('[E3-UPLOAD] Uploading E3 XML...');
                                    e3Result = await uploadToErganh(data.data._id, e3UrlToSend);
                                    console.log('[E3-UPLOAD] Result:', e3Result);
                                } catch (e) {
                                    console.error('[E3-UPLOAD] ❌ Exception:', e?.message || e);
                                    e3Result = { success: false, error: e?.message };
                                }
                            }
                        }

                        // ✅ 2. Upload WTO XML (if exists) - ALWAYS RUNS
                        let wtoResult = { success: true }; // Default to success if not uploaded

                        if (
                            wtoXmlData?.success &&
                            data.data?._id &&
                            (wtoXmlData?.relativePath ||
                                wtoXmlData?.s3Url ||
                                wtoXmlData?.downloadUrl ||
                                wtoXmlData?.s3Key)
                        ) {
                            const wtoUrlToSend =
                                wtoXmlData?.relativePath ||
                                wtoXmlData?.s3Url ||
                                wtoXmlData?.downloadUrl ||
                                wtoXmlData?.s3Key ||
                                null;

                            if (wtoUrlToSend && typeof wtoUrlToSend === 'string') {
                                try {
                                    console.log('[WTO-UPLOAD] Uploading WTO XML (after E3)...');
                                    wtoResult = await uploadWtoToErganh(
                                        data.data._id,
                                        wtoUrlToSend
                                    );
                                    console.log('[WTO-UPLOAD] Result:', wtoResult);
                                } catch (e) {
                                    console.error('[WTO-UPLOAD] ❌ Exception:', e?.message || e);
                                    wtoResult = { success: false, error: e?.message };
                                }
                            }
                        }

                        // ✅ 3. Final summary (optional - if you want to show combined status)
                        if (!e3Result.success || !wtoResult.success) {
                            console.warn('[ERGANH] Some uploads failed:', {
                                e3: e3Result.success,
                                wto: wtoResult.success
                            });
                        }

                        // ✅ 4. Redirect AFTER BOTH uploads complete
                        console.log(
                            '[REDIRECT] Redirecting to:',
                            data.redirectUrl || '/ergazomenoi/ergazomenoi'
                        );
                        window.location.href = data.redirectUrl || '/ergazomenoi/ergazomenoi';
                    }
                } else {
                    // =====================================================================
                    // ⚠️ SOME PDFs FAILED TO SAVE
                    // =====================================================================
                    const failedTypes = failedPdfs.map((f) => f.documentType).join(', ');

                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'warning',
                        title: 'Ο εργαζόμενος αποθηκεύτηκε',
                        html: `
                            <p><strong>Αλλά ${failedPdfs.length} PDF απέτυχαν!</strong></p>
                            <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                                Αποτυχία: ${failedTypes}
                            </p>
                            <p style="color: #999; font-size: 0.85rem; margin-top: 10px;">
                                Μπορείτε να τα ανεβάσετε αργότερα από την επεξεργασία.
                            </p>
                            ${e3XmlHtml}
                            ${e3RestPendingHtml}
                            ${wtoRestPendingHtml}
                            ${wtoXmlHtml}
                        `,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });

                    if (isRestSubmit) {
                        const uploadResults = await runRestUploadsAfterEmployeeSave({
                            ergazomenosId: data.data?._id,
                            filesToUpdate: result.value,
                            redirectUrl: data.redirectUrl || '/ergazomenoi/ergazomenoi'
                        });

                        if (
                            uploadResults?.e3Result?.success === false ||
                            uploadResults?.wtoResult?.success === false
                        ) {
                            console.warn('[REDIRECT] Skipped because ERGANI REST upload failed.');
                            return;
                        }

                        window.location.href = data.redirectUrl || '/ergazomenoi/ergazomenoi';
                        return;
                    }

                    // =====================================================================
                    // ✅ UPLOAD BOTH XMLs TO ERGANH (SEQUENTIAL)
                    // =====================================================================

                    // ✅ 1. Upload E3 XML (if exists)
                    if (
                        e3XmlData?.success &&
                        data.data?._id &&
                        (e3XmlData?.relativePath ||
                            e3XmlData?.s3Url ||
                            e3XmlData?.downloadUrl ||
                            e3XmlData?.s3Key)
                    ) {
                        const e3UrlToSend =
                            e3XmlData?.relativePath ||
                            e3XmlData?.s3Url ||
                            e3XmlData?.downloadUrl ||
                            e3XmlData?.s3Key ||
                            null;

                        if (e3UrlToSend && typeof e3UrlToSend === 'string') {
                            try {
                                console.log('[E3-UPLOAD] Uploading E3 XML (failed PDFs path)...');
                                await uploadToErganh(data.data._id, e3UrlToSend);
                                console.log('[E3-UPLOAD] ✅ Success');
                            } catch (e) {
                                console.error('[E3-UPLOAD] ❌ Failed:', e?.message || e);
                            }
                        }
                    }

                    // ✅ 2. Upload WTO XML (if exists)
                    if (
                        wtoXmlData?.success &&
                        data.data?._id &&
                        (wtoXmlData?.relativePath ||
                            wtoXmlData?.s3Url ||
                            wtoXmlData?.downloadUrl ||
                            wtoXmlData?.s3Key)
                    ) {
                        const wtoUrlToSend =
                            wtoXmlData?.relativePath ||
                            wtoXmlData?.s3Url ||
                            wtoXmlData?.downloadUrl ||
                            wtoXmlData?.s3Key ||
                            null;

                        if (wtoUrlToSend && typeof wtoUrlToSend === 'string') {
                            try {
                                console.log('[WTO-UPLOAD] Uploading WTO XML (failed PDFs path)...');
                                await uploadWtoToErganh(data.data._id, wtoUrlToSend);
                                console.log('[WTO-UPLOAD] ✅ Success');
                            } catch (e) {
                                console.error('[WTO-UPLOAD] ❌ Failed:', e?.message || e);
                            }
                        }
                    }

                    // ✅ 3. Redirect AFTER both uploads
                    window.location.href = data.redirectUrl || '/ergazomenoi/ergazomenoi';
                }
                return;
            }

            // 6) Other content-type but OK (e.g., HTML)
            if (response.ok) {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: 'success',
                    title: 'Επιτυχής καταχώριση!',
                    timer: 1200,
                    showConfirmButton: false,
                    customClass: {
                        confirmButton: 'class-success custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                }).then(() => (window.location.href = '/ergazomenoi/ergazomenoi'));
                return;
            }

            // 7) HTTP Error
            throw new Error(`HTTP error ${response.status}`);
        } catch (err) {
            console.error('❌ Form submission error:', err);

            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'error',
                title: 'Αποτυχία αποθήκευσης',
                timer: 5200,
                text: String(message || err),
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
        }
    }

    const buttons = document.querySelectorAll('.submitButton');

    buttons.forEach((button) => {
        button.addEventListener('click', handleFormSubmit);
    });

    // ============================================================================
    // ✅ REST API HELPERS (E3N + WTOWeek) FOR ADD EMPLOYEE FLOW
    // ============================================================================

    function escapeHtmlForSwal(value) {
        return String(value ?? '').replace(
            /[<>&"]/g,
            (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]
        );
    }

    function formatErganiErrorForSwal(value) {
        return escapeHtmlForSwal(value || 'Άγνωστο σφάλμα')
            .replace(/\n/g, '<br>')
            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }

    function showE3NRestProgressSwal() {
        Swal.fire({
            title: 'Οριστική Υποβολή Πρόσληψης E3N',
            html: `
                <div class="pdf-generation-progress">
                    <div class="progress-spinner">
                        <div class="spinner-border text-success" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div class="progress-step-text" id="e3n-rest-progress-step-text">
                        Σύνδεση με ΕΡΓΑΝΗ...
                    </div>
                    <div class="progress-bar-container">
                        <div class="custom-progress">
                            <div class="custom-progress-bar progress-bar-striped progress-bar-animated"
                                 id="e3n-rest-progress-bar"
                                 role="progressbar"
                                 aria-valuenow="15"
                                 aria-valuemin="0"
                                 aria-valuemax="100"
                                 style="width: 15%">
                                15%
                            </div>
                        </div>
                    </div>
                    <div class="progress-info-text">
                        <p class="mb-2">Η διαδικασία περιλαμβάνει:</p>
                        <ul class="progress-steps-list">
                            <li>Δημιουργία JSON payload</li>
                            <li>Έλεγχο WebE3N στο trial/production περιβάλλον</li>
                            <li>Οριστική υποβολή στο ΕΡΓΑΝΗ</li>
                            <li>Λήψη πρωτοκόλλου και PDF, όπου διατίθεται</li>
                        </ul>
                    </div>
                </div>
            `,
            backdrop: false,
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-title'
            },
            didOpen: () => {
                const steps = [
                    { percent: 25, text: 'Προετοιμασία JSON payload...', duration: 800 },
                    { percent: 45, text: 'Αυθεντικοποίηση στο ΕΡΓΑΝΗ...', duration: 1200 },
                    { percent: 65, text: 'Υποβολή WebE3N...', duration: 1800 },
                    { percent: 85, text: 'Αναμονή απάντησης από ΕΡΓΑΝΗ...', duration: 2000 },
                    { percent: 95, text: 'Ολοκλήρωση ελέγχου αποτελέσματος...', duration: 1200 }
                ];
                let currentStepIndex = 0;
                function updateProgress() {
                    if (currentStepIndex >= steps.length) return;
                    const step = steps[currentStepIndex];
                    const progressBar = document.getElementById('e3n-rest-progress-bar');
                    const progressText = document.getElementById('e3n-rest-progress-step-text');
                    if (progressBar && progressText) {
                        progressBar.style.width = `${step.percent}%`;
                        progressBar.textContent = `${step.percent}%`;
                        progressBar.setAttribute('aria-valuenow', step.percent);
                        progressText.textContent = step.text;
                    }
                    currentStepIndex++;
                    if (currentStepIndex < steps.length) {
                        setTimeout(updateProgress, step.duration);
                    }
                }
                setTimeout(updateProgress, 350);
            }
        });
    }

    function showWTOWeekRestProgressSwal() {
        Swal.fire({
            title: 'Οριστική Υποβολή WTOWeek',
            html: `
                <div class="pdf-generation-progress">
                    <div class="progress-spinner">
                        <div class="spinner-border text-success" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div class="progress-step-text" id="wtoweek-rest-progress-step-text">
                        Σύνδεση με ΕΡΓΑΝΗ...
                    </div>
                    <div class="progress-bar-container">
                        <div class="custom-progress">
                            <div class="custom-progress-bar progress-bar-striped progress-bar-animated"
                                 id="wtoweek-rest-progress-bar"
                                 role="progressbar"
                                 aria-valuenow="15"
                                 aria-valuemin="0"
                                 aria-valuemax="100"
                                 style="width: 15%">
                                15%
                            </div>
                        </div>
                    </div>
                    <div class="progress-info-text">
                        <p class="mb-2">Η διαδικασία περιλαμβάνει:</p>
                        <ul class="progress-steps-list">
                            <li>Δημιουργία JSON payload WTOWeek</li>
                            <li>Έλεγχο ημερομηνιών και υποκαταστήματος</li>
                            <li>Οριστική υποβολή στο ΕΡΓΑΝΗ</li>
                            <li>Λήψη πρωτοκόλλου και PDF, όπου διατίθεται</li>
                        </ul>
                    </div>
                </div>
            `,
            backdrop: false,
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: {
                popup: 'custom-swal-popup',
                title: 'custom-title'
            },
            didOpen: () => {
                const steps = [
                    { percent: 25, text: 'Προετοιμασία JSON payload WTOWeek...', duration: 800 },
                    { percent: 45, text: 'Αυθεντικοποίηση στο ΕΡΓΑΝΗ...', duration: 1200 },
                    { percent: 65, text: 'Υποβολή WTOWeek...', duration: 1800 },
                    { percent: 85, text: 'Αναμονή απάντησης από ΕΡΓΑΝΗ...', duration: 2000 },
                    { percent: 95, text: 'Ολοκλήρωση ελέγχου αποτελέσματος...', duration: 1200 }
                ];
                let currentStepIndex = 0;
                function updateProgress() {
                    if (currentStepIndex >= steps.length) return;
                    const step = steps[currentStepIndex];
                    const progressBar = document.getElementById('wtoweek-rest-progress-bar');
                    const progressText = document.getElementById('wtoweek-rest-progress-step-text');
                    if (progressBar && progressText) {
                        progressBar.style.width = `${step.percent}%`;
                        progressBar.textContent = `${step.percent}%`;
                        progressBar.setAttribute('aria-valuenow', step.percent);
                        progressText.textContent = step.text;
                    }
                    currentStepIndex++;
                    if (currentStepIndex < steps.length) {
                        setTimeout(updateProgress, step.duration);
                    }
                }
                setTimeout(updateProgress, 350);
            }
        });
    }

    async function showGenericRestResultSwal({
        result,
        titleSuccess,
        titleError,
        successText,
        errorText
    }) {
        if (result?.success === true) {
            const protocol = result?.protocol || null;
            const submitDate = result?.submitDate || null;
            const submissionId = result?.erganhSubmissionId || result?.id || null;

            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'success',
                title: titleSuccess,
                html: `
                    <div style="text-align:left; line-height:1.55;">
                        <p>${successText}</p>
                        ${protocol ? `<p><strong>Πρωτόκολλο:</strong> ${escapeHtmlForSwal(protocol)}</p>` : ''}
                        ${
                            submitDate
                                ? `<p><strong>Ημερομηνία υποβολής:</strong> ${escapeHtmlForSwal(submitDate)}</p>`
                                : ''
                        }
                        ${
                            submissionId
                                ? `<p><strong>ERGANI ID:</strong> ${escapeHtmlForSwal(submissionId)}</p>`
                                : ''
                        }
                        ${
                            result?.pdfSaved === false && result?.pdfSaveError
                                ? `<p class="text-warning">⚠️ Η υποβολή έγινε, αλλά το PDF δεν αποθηκεύτηκε: ${escapeHtmlForSwal(result.pdfSaveError)}</p>`
                                : ''
                        }
                    </div>
                `,
                confirmButtonText: 'OK',
                customClass: {
                    confirmButton: 'class-success custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup',
                    htmlContainer: 'custom-html-container'
                }
            });
            return;
        }

        await Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            icon: 'error',
            title: titleError,
            html: `
                <div style="text-align:left; line-height:1.45;">
                    <p>${errorText}</p>
                    <p class="text-danger" style="font-weight:600;">
                        ${formatErganiErrorForSwal(result?.error || result?.message)}
                    </p>
                </div>
            `,
            confirmButtonText: 'OK',
            customClass: {
                confirmButton: 'class-error custom-confirm-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup',
                htmlContainer: 'custom-html-container'
            }
        });
    }

    async function showE3NRestResultSwal(e3Result) {
        await showGenericRestResultSwal({
            result: e3Result,
            titleSuccess: 'Επιτυχής Οριστική Υποβολή E3N',
            titleError: 'Αποτυχία Οριστικής Υποβολής E3N',
            successText: 'Η πρόσληψη υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ μέσω REST API.',
            errorText: 'Η πρόσληψη δεν υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.'
        });
    }

    async function showWTOWeekRestResultSwal(wtoResult) {
        await showGenericRestResultSwal({
            result: wtoResult,
            titleSuccess: 'Επιτυχής Οριστική Υποβολή WTOWeek',
            titleError: 'Αποτυχία Οριστικής Υποβολής WTOWeek',
            successText: 'Το εβδομαδιαίο πρόγραμμα υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ μέσω REST API.',
            errorText: 'Το εβδομαδιαίο πρόγραμμα δεν υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.'
        });
    }

    async function showErganiSubmittedPdfModal(payload) {
        const pdfUrl = payload?.pdfUrl || payload?.pdfS3Url || payload?.pdf_url || '';
        const protocol = payload?.protocol || '';
        const submitDate = payload?.submitDate || '';
        const title = protocol ? `ΕΡΓΑΝΗ - Πρωτόκολλο ${protocol}` : 'ΕΡΓΑΝΗ - Υποβληθέν PDF';

        if (!pdfUrl) return;

        await Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            width: 1250,
            title,
            html: `
                <div style="display:flex; flex-direction:column; gap:0.55rem; width:100%; height:min(84vh, 820px); box-sizing:border-box;">
                    <div style="display:flex; gap:0.75rem; align-items:center; justify-content:center; flex-wrap:wrap; font-size:0.95rem;">
                        ${protocol ? `<span><strong>Πρωτόκολλο:</strong> ${escapeHtmlForSwal(protocol)}</span>` : ''}
                        ${submitDate ? `<span><strong>Ημ/νία:</strong> ${escapeHtmlForSwal(submitDate)}</span>` : ''}
                    </div>
                    <iframe src="${pdfUrl}"
                            style="width:100%; flex:1 1 auto; min-height:620px; height:72vh; border:1px solid #ccc; border-radius:6px; background:#fff;"
                            title="ΕΡΓΑΝΗ PDF"></iframe>
                    <div style="display:flex; gap:0.75rem; justify-content:center; align-items:center; flex-wrap:wrap; margin-top:0.25rem;">
                        <button type="button" id="erganiPdfOpenBtn" class="btn btn-primary">Άνοιγμα PDF</button>
                        <a href="${pdfUrl}" target="_blank" download class="btn btn-success" style="text-decoration:none;">Αποθήκευση Τοπικά</a>
                        <button type="button" id="erganiPdfPrintBtn" class="btn btn-secondary">Εκτύπωση</button>
                        <button type="button" id="erganiPdfCloseBtn" class="btn btn-secondary">Κλείσιμο</button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            customClass: {
                title: 'custom-title',
                popup: 'custom-swal-popup-wide',
                htmlContainer: 'custom-html-container'
            },
            didOpen: () => {
                const popup = Swal.getPopup();
                const iframe = popup?.querySelector('iframe');
                const htmlContainer = Swal.getHtmlContainer();

                if (popup) {
                    popup.style.setProperty('width', '1250px', 'important');
                    popup.style.setProperty('max-width', '98vw', 'important');
                    popup.style.setProperty('min-width', '900px', 'important');
                    popup.style.setProperty('padding', '1rem', 'important');
                }
                if (htmlContainer) {
                    htmlContainer.style.setProperty('width', '100%', 'important');
                    htmlContainer.style.setProperty('max-width', '100%', 'important');
                    htmlContainer.style.setProperty('margin', '0', 'important');
                }
                if (iframe) {
                    iframe.style.setProperty('width', '100%', 'important');
                    iframe.style.setProperty('height', '72vh', 'important');
                    iframe.style.setProperty('min-height', '620px', 'important');
                }

                const openBtn = document.getElementById('erganiPdfOpenBtn');
                const printBtn = document.getElementById('erganiPdfPrintBtn');
                const closeBtn = document.getElementById('erganiPdfCloseBtn');

                if (openBtn) {
                    openBtn.addEventListener('click', () => {
                        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                    });
                }
                if (printBtn) {
                    printBtn.addEventListener('click', () => {
                        const printWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                        if (!printWindow) return;
                        printWindow.addEventListener('load', () => {
                            try {
                                printWindow.focus();
                                printWindow.print();
                            } catch (e) {
                                console.warn('PDF print failed:', e);
                            }
                        });
                    });
                }
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => Swal.close());
                }
            }
        });
    }

    function getSelectedE3NYpokatasthma() {
        return (
            document.getElementById('ypokatasthma')?.value ||
            document.getElementById('ypokatasthmata')?.value ||
            document.getElementById('ypokatasthmata_stathera')?.value ||
            document.querySelector('[name="ypokatasthma"]')?.value ||
            document.querySelector('[name="ypokatasthmata"]')?.value ||
            document.querySelector('[name="ypokatasthmata_stathera"]')?.value ||
            '0'
        );
    }

    function escapeE3NPreflightHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderE3NPreflightDifferences(differences = []) {
        return `
            <div class="e3n-preflight-list">
                ${differences
                    .map(
                        (item) => `
                            <div class="e3n-preflight-card">
                                <div><strong>Πεδίο:</strong> ${escapeE3NPreflightHtml(item.label)}</div>
                                <div><strong>ΒΔ:</strong> ${escapeE3NPreflightHtml(item.dbDisplay ?? item.dbValue ?? '')}</div>
                                <div><strong>XML:</strong> ${escapeE3NPreflightHtml(item.xmlDisplay ?? item.xmlValue ?? '')}</div>
                                <div><strong>REST JSON:</strong> ${escapeE3NPreflightHtml(item.jsonDisplay ?? item.jsonValue ?? '')}</div>
                            </div>
                        `
                    )
                    .join('')}
            </div>
        `;
    }

    async function showE3NPreSubmitComparisonSwal(comparison) {
        const hasDifferences = comparison?.hasDifferences === true;
        const html = hasDifferences
            ? renderE3NPreflightDifferences(comparison.differences || [])
            : '<p>Δεν βρέθηκαν ασυμφωνίες μεταξύ ΒΔ, XML και REST JSON.</p>';

        const result = await Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            icon: hasDifferences ? 'warning' : 'question',
            title: hasDifferences
                ? 'Βρέθηκαν ασυμφωνίες πριν την Οριστική Υποβολή Ε3'
                : 'Έλεγχος Οριστικής Υποβολής Ε3',
            html,
            showCancelButton: true,
            confirmButtonText: 'Συνέχεια σε Οριστική Υποβολή',
            cancelButtonText: 'Ακύρωση',
            customClass: {
                confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                cancelButton: 'class-secondary custom-cancel-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup',
                htmlContainer: 'custom-html-container'
            },
            didOpen: () => {
                const htmlContainer = Swal.getHtmlContainer();
                const list = htmlContainer?.querySelector('.e3n-preflight-list');
                const cards = htmlContainer?.querySelectorAll('.e3n-preflight-card') || [];

                if (htmlContainer) {
                    htmlContainer.style.setProperty('max-height', '62vh');
                    htmlContainer.style.setProperty('overflow-y', 'auto');
                    htmlContainer.style.setProperty('text-align', 'left');
                    htmlContainer.style.setProperty('overflow-wrap', 'anywhere');
                }
                if (list) {
                    list.style.setProperty('display', 'grid');
                    list.style.setProperty('gap', '0.5rem');
                }
                cards.forEach((card) => {
                    card.style.setProperty('border', '1px solid #dee2e6');
                    card.style.setProperty('border-radius', '6px');
                    card.style.setProperty('padding', '0.5rem 0.75rem');
                    card.style.setProperty('font-size', '0.9rem');
                    card.style.setProperty('background', '#fff');
                });
            }
        });

        if (!result.isConfirmed) {
            await Swal.fire({
                backdrop: false,
                icon: 'info',
                title: 'Ακύρωση',
                text: 'Δεν έγινε οριστική υποβολή στο ΕΡΓΑΝΗ.',
                confirmButtonText: 'OK',
                customClass: {
                    confirmButton: 'class-secondary custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
            return false;
        }

        return true;
    }

    async function runE3NPreSubmitComparison(ergazomenosId, ypokatasthma, csrfToken) {
        const response = await fetch('/ergazomenoi/ergazomenoi/e3n/pre-submit-comparison', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                ergazomenosId,
                ypokatasthma,
                erganiUploadMethod: 'rest'
            })
        });

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : { success: response.ok, message: await response.text() };

        if (!response.ok || data?.success !== true) {
            throw new Error(
                data?.message ||
                    data?.error ||
                    `E3N pre-submit comparison failed with HTTP ${response.status}`
            );
        }

        return data;
    }

    async function submitE3NRestToErganh(ergazomenosId) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const ypokatasthma = getSelectedE3NYpokatasthma();

        const comparison = await runE3NPreSubmitComparison(ergazomenosId, ypokatasthma, csrfToken);
        const canProceed = await showE3NPreSubmitComparisonSwal(comparison);

        if (!canProceed) {
            return {
                success: false,
                cancelled: true,
                message: 'Δεν έγινε οριστική υποβολή στο ΕΡΓΑΝΗ.'
            };
        }

        showE3NRestProgressSwal();

        const response = await fetch('/ergazomenoi/ergazomenoi/submit-e3n-to-erganh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                ergazomenosId,
                ypokatasthma,
                erganiUploadMethod: 'rest'
            })
        });

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : { success: response.ok, message: await response.text() };

        if (!response.ok || data?.success !== true) {
            throw new Error(
                data?.message ||
                    data?.error ||
                    `E3N REST JSON upload failed with HTTP ${response.status}`
            );
        }

        if (data?.pdfUrl || data?.pdfS3Url || data?.pdf_url) {
            Swal.close();
            await showErganiSubmittedPdfModal(data);
        }

        return data;
    }

    async function submitWTOWeekRestToErganh(ergazomenosId) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        const ypokatasthma =
            document.getElementById('ypokatasthma')?.value ||
            document.getElementById('ypokatasthmata')?.value ||
            document.getElementById('ypokatasthmata_stathera')?.value ||
            document.querySelector('[name="ypokatasthma"]')?.value ||
            document.querySelector('[name="ypokatasthmata"]')?.value ||
            document.querySelector('[name="ypokatasthmata_stathera"]')?.value ||
            '0';

        try {
            showWTOWeekRestProgressSwal();

            const response = await fetch('/ergazomenoi/ergazomenoi/submit-wtoweek-to-erganh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({
                    ergazomenosId,
                    ypokatasthma,
                    erganiUploadMethod: 'rest'
                })
            });

            let payload;
            try {
                payload = await response.json();
            } catch {
                payload = { success: false, message: await response.text() };
            }

            Swal.close();

            if (!response.ok || payload?.success !== true) {
                const failedPayload = {
                    ...payload,
                    success: false,
                    error:
                        payload?.error ||
                        payload?.message ||
                        payload?.userMessage ||
                        `HTTP ${response.status}`
                };

                await showWTOWeekRestResultSwal(failedPayload);
                return failedPayload;
            }

            if (payload?.pdfUrl || payload?.pdfS3Url || payload?.pdf_url) {
                await showErganiSubmittedPdfModal(payload);
            }

            await showWTOWeekRestResultSwal(payload);
            return payload;
        } catch (error) {
            Swal.close();
            const failedPayload = {
                success: false,
                error: error?.message || String(error)
            };
            await showWTOWeekRestResultSwal(failedPayload);
            return failedPayload;
        }
    }

    async function runRestUploadsAfterEmployeeSave({
        ergazomenosId,
        filesToUpdate = {},
        redirectUrl = '/ergazomenoi/ergazomenoi'
    }) {
        const userWantsE3 = filesToUpdate?.e3_anaggelia_proslhpshs === true;
        const userWantsWto =
            filesToUpdate?.wto_pshfiakh_organosh_xronoy_ergasias === true ||
            filesToUpdate?.schedules === true;
        const isRestSubmit =
            filesToUpdate?.isPermanent === true && filesToUpdate?.erganiUploadMethod === 'rest';

        let e3Result = { success: true, skipped: true };
        let wtoResult = { success: true, skipped: true };

        if (!isRestSubmit || !ergazomenosId) {
            return { e3Result, wtoResult, skipped: true };
        }

        if (userWantsE3) {
            try {
                console.log('[E3-REST-UPLOAD] Submitting E3N via REST JSON...');
                e3Result = await submitE3NRestToErganh(ergazomenosId);
                if (e3Result?.cancelled) {
                    return { e3Result, wtoResult, skipped: false };
                }
                Swal.close();
                await showE3NRestResultSwal(e3Result);
            } catch (e) {
                Swal.close();
                console.error('[E3-REST-UPLOAD] ❌ Exception:', e?.message || e);
                e3Result = { success: false, error: e?.message || String(e) };
                await showE3NRestResultSwal(e3Result);
            }
        }

        if (userWantsWto) {
            console.log('[WTO-REST-UPLOAD] Submitting WTOWeek via REST JSON...');
            wtoResult = await submitWTOWeekRestToErganh(ergazomenosId);
        }

        return { e3Result, wtoResult, redirectUrl };
    }

    // ============================================================================
    // ✅ PDF CONTRACT PREVIEW MODAL (WITH ERGANH UPLOAD AFTER MANUAL CLOSE)
    // ============================================================================

    async function showContractPdfModalAndWait(
        pdfUrl,
        s3Key,
        redirectUrl,
        employeeName = 'UNKNOWN',
        companyData = {},
        e3XmlData = null,
        wtoXmlData = null,
        ergazomenosId = null,
        filesToUpdate = {} // ✅ New parameter
    ) {
        return new Promise((resolve) => {
            const modal = document.getElementById('pdfPreviewContractModal');
            const iframe = document.getElementById('pdfPreviewIframe');
            const loading = document.getElementById('pdfPreviewLoading');
            const closeBtn = document.getElementById('closePdfPreviewModal');
            const skipBtn = document.getElementById('skipPdfDownload');
            const downloadBtn = document.getElementById('downloadAndContinue');
            const emailBtn = document.getElementById('downloadAndEmail');

            if (!modal || !iframe) {
                console.error('❌ PDF preview modal elements not found!');
                resolve(); // Resolve immediately
                window.location.href = redirectUrl;
                return;
            }

            // ✅ Check if email exists in form
            const emailInput =
                document.getElementById('email') || document.querySelector('input[name="email"]');
            const employeeEmail = emailInput?.value?.trim() || '';

            // ✅ Enable/disable email button based on email presence
            if (emailBtn) {
                if (employeeEmail && employeeEmail.includes('@')) {
                    emailBtn.disabled = false;
                    emailBtn.title = `Αποστολή στο ${employeeEmail}`;
                } else {
                    emailBtn.disabled = true;
                    emailBtn.title = 'Δεν υπάρχει email εργαζόμενου';
                }
            }

            // ✅ Show modal
            modal.classList.remove('hidden');

            if (loading) {
                loading.classList.remove('hidden');
            }

            // ✅ Load PDF
            iframe.src = pdfUrl;

            // ✅ Hide loading spinner when iframe loads
            iframe.onload = () => {
                if (loading) {
                    loading.classList.add('hidden');
                }
            };

            // ✅ Handle error
            iframe.onerror = (error) => {
                console.error('❌ PDF loading error:', error);
                if (loading) {
                    loading.innerHTML = '<p class="text-danger">❌ Αποτυχία φόρτωσης PDF</p>';
                }
            };

            // =====================================================================
            // ✅ CLOSE MODAL HANDLER (WITH SEQUENTIAL XML UPLOADS)
            // =====================================================================
            const closeModal = async () => {
                modal.classList.add('hidden');
                iframe.src = '';

                // =====================================================================
                // ✅ GET UPLOAD OPTIONS (from function parameter)
                // =====================================================================
                const isPermanent = filesToUpdate?.isPermanent === true;
                const e3Enabled = filesToUpdate?.e3_anaggelia_proslhpshs === true;
                const wtoEnabled =
                    filesToUpdate?.wto_pshfiakh_organosh_xronoy_ergasias === true ||
                    filesToUpdate?.schedules === true;

                console.log('[CLOSE-MODAL] Upload options:', {
                    isPermanent,
                    e3Enabled,
                    wtoEnabled,
                    filesToUpdate
                });

                // =====================================================================
                // ✅ CHECK: What XMLs need upload?
                // =====================================================================
                const needsE3Upload = !!(e3Enabled && e3XmlData?.success && ergazomenosId);

                // ✅ CRITICAL: For WTO, check if USER ENABLED schedules checkbox
                // NOT if XML was generated (XML is only generated for isPermanent=true)
                const needsWtoUpload = !!(wtoEnabled && ergazomenosId);

                console.log('[XML-UPLOAD] closeModal checks:', {
                    needsE3Upload,
                    needsWtoUpload,
                    wtoEnabled,
                    isPermanent,
                    e3_s3Key: e3XmlData?.s3Key,
                    wto_s3Key: wtoXmlData?.s3Key,
                    wto_relativePath: wtoXmlData?.relativePath,
                    ergazomenosId
                });

                if (isPermanent && filesToUpdate?.erganiUploadMethod === 'rest') {
                    const uploadResults = await runRestUploadsAfterEmployeeSave({
                        ergazomenosId,
                        filesToUpdate,
                        redirectUrl
                    });

                    if (
                        uploadResults?.e3Result?.success === false ||
                        uploadResults?.wtoResult?.success === false
                    ) {
                        console.warn('[REDIRECT] Skipped because ERGANI REST upload failed.');
                        resolve();
                        return;
                    }

                    resolve();
                    window.location.href = redirectUrl;
                    return;
                }

                // ✅ If neither needs upload → redirect immediately
                if (!needsE3Upload && !needsWtoUpload) {
                    resolve();
                    window.location.href = redirectUrl;
                    return;
                }

                // =====================================================================
                // ✅ UPLOAD E3 XML (if enabled - with isPermanent flag)
                // =====================================================================
                let e3UploadSuccess = false;

                if (needsE3Upload) {
                    const e3UrlToSend =
                        e3XmlData?.relativePath ||
                        e3XmlData?.s3Url ||
                        e3XmlData?.downloadUrl ||
                        null;

                    if (!e3UrlToSend || typeof e3UrlToSend !== 'string') {
                        console.error('[E3-UPLOAD] Missing/invalid s3UrlToSend', e3UrlToSend);

                        await Swal.fire({
                            backdrop: false,
                            icon: 'error',
                            title: 'E3 XML - ΕΡΓΑΝΗ ΙΙ',
                            text: 'Δεν βρέθηκε το path του E3 XML για αποστολή.',
                            confirmButtonText: 'OK',
                            customClass: {
                                confirmButton:
                                    'class-error custom-confirm-button custom-swal-button',
                                title: 'custom-title',
                                popup: 'custom-swal-popup'
                            }
                        });
                    } else {
                        try {
                            const mode = isPermanent ? 'Οριστική' : 'Προσωρινή';
                            console.log(`[E3-UPLOAD] Uploading E3 XML (${mode})...`);

                            // ✅ Pass isPermanent flag to backend
                            // ✅ CRITICAL: This function shows Swal alert - we MUST wait for it!
                            const e3Result = await uploadToErganh(
                                ergazomenosId,
                                e3UrlToSend,
                                isPermanent
                            );

                            console.log('[E3-UPLOAD] ✅ E3 upload function returned:', e3Result);

                            e3UploadSuccess = e3Result?.success === true;
                        } catch (e) {
                            console.error('[E3-UPLOAD] ❌ Failed:', e?.message || e);

                            await Swal.fire({
                                backdrop: false,
                                icon: 'error',
                                title: 'E3 XML - ΕΡΓΑΝΗ ΙΙ',
                                text: 'Αποτυχία αποστολής E3 XML.',
                                confirmButtonText: 'OK',
                                customClass: {
                                    confirmButton:
                                        'class-error custom-confirm-button custom-swal-button',
                                    title: 'custom-title',
                                    popup: 'custom-swal-popup'
                                }
                            });
                        }
                    }
                }

                console.log('[E3-UPLOAD] Completed. Success:', e3UploadSuccess);
                console.log('[NEXT] Checking if WTO upload is needed...');

                // =====================================================================
                // ✅ UPLOAD WTO (CONDITIONAL - based on isPermanent flag)
                // ✅ CRITICAL: This ONLY runs AFTER E3 Swal is closed!
                // =====================================================================
                if (needsWtoUpload) {
                    console.log('[WTO-UPLOAD] Starting WTO upload process...');

                    try {
                        if (isPermanent) {
                            // =====================================================================
                            // ✅ ΟΡΙΣΤΙΚΗ ΕΝΗΜΕΡΩΣΗ → XML Upload (sequential after E3)
                            // =====================================================================
                            console.log('[WTO-UPLOAD] Mode: Οριστική Ενημέρωση (XML upload)');

                            const wtoUrlToSend =
                                wtoXmlData?.relativePath ||
                                wtoXmlData?.s3Url ||
                                wtoXmlData?.downloadUrl ||
                                null;

                            console.log('[WTO-UPLOAD] WTO XML path:', wtoUrlToSend);

                            if (!wtoUrlToSend || typeof wtoUrlToSend !== 'string') {
                                console.error(
                                    '[WTO-UPLOAD] ❌ Missing/invalid XML path',
                                    wtoUrlToSend
                                );

                                await Swal.fire({
                                    backdrop: false,
                                    icon: 'error',
                                    title: 'WTO XML - ΕΡΓΑΝΗ ΙΙ',
                                    text: 'Δεν βρέθηκε το path του WTO XML για αποστολή.',
                                    confirmButtonText: 'OK',
                                    customClass: {
                                        confirmButton:
                                            'class-error custom-confirm-button custom-swal-button',
                                        title: 'custom-title',
                                        popup: 'custom-swal-popup'
                                    }
                                });
                            } else {
                                console.log('[WTO-UPLOAD] Calling uploadWtoToErganh...');

                                // ✅ Call existing XML upload function
                                const wtoResult = await uploadWtoToErganh(
                                    ergazomenosId,
                                    wtoUrlToSend
                                );

                                console.log('[WTO-UPLOAD] WTO upload result:', wtoResult);

                                if (wtoResult?.success) {
                                    console.log('[WTO-UPLOAD] ✅ WTO XML uploaded successfully');
                                } else {
                                    console.warn(
                                        '[WTO-UPLOAD] ⚠️ WTO upload completed with warnings'
                                    );
                                }
                            }
                        } else {
                            // =====================================================================
                            // ✅ ΠΡΟΣΩΡΙΝΗ ΑΠΟΘΗΚΕΥΣΗ → Manual Form Navigation
                            // =====================================================================
                            console.log('[WTO-UPLOAD] Mode: Προσωρινή Αποθήκευση (manual form)');
                            console.log('[WTO-UPLOAD] Calling uploadWtoTemporary...');

                            // ✅ No XML path needed - we navigate the form manually
                            // The uploadWtoTemporary function will:
                            // 1. Navigate to WTO menu
                            // 2. Fill the form fields (date, branch, process type)
                            // 3. Click through tabs
                            // 4. Fill employee details (AFM, Επώνυμο, Όνομα)
                            const wtoTempResult = await uploadWtoTemporary(ergazomenosId, null);

                            console.log('[WTO-UPLOAD] WTO temporary result:', wtoTempResult);

                            if (wtoTempResult?.success !== false) {
                                console.log('[WTO-UPLOAD] ✅ WTO temporary upload completed');
                            } else {
                                console.warn(
                                    '[WTO-UPLOAD] ⚠️ WTO temporary upload completed with warnings'
                                );
                            }
                        }
                    } catch (e) {
                        console.error('[WTO-UPLOAD] ❌ Failed:', e?.message || e);
                        console.error('[WTO-UPLOAD] Error stack:', e?.stack);

                        await Swal.fire({
                            backdrop: false,
                            icon: 'error',
                            title: 'WTO - ΕΡΓΑΝΗ ΙΙ',
                            html: `
                    <p>Αποτυχία αποστολής WTO.</p>
                    <p class="text-muted" style="font-size: 0.9rem; margin-top: 10px;">
                        ${e?.message || 'Unknown error'}
                    </p>
                `,
                            confirmButtonText: 'OK',
                            customClass: {
                                confirmButton:
                                    'class-error custom-confirm-button custom-swal-button',
                                title: 'custom-title',
                                popup: 'custom-swal-popup',
                                htmlContainer: 'custom-html-container'
                            }
                        });
                    }
                } else {
                    console.log('[WTO-UPLOAD] ⏸️ Skipped (not enabled or no employee ID)');
                }

                console.log('[CLOSE-MODAL] All uploads completed. Redirecting...');

                // =====================================================================
                // ✅ REDIRECT (after BOTH uploads complete)
                // =====================================================================
                resolve();
                window.location.href = redirectUrl;
            };

            // =====================================================================
            // ✅ DOWNLOAD HANDLER (OPENS NEW TAB - DOES NOT CLOSE MODAL)
            // =====================================================================
            const downloadAndContinue = () => {
                console.log('📥 Download initiated (modal stays open)');
                window.open(pdfUrl, '_blank');

                // ✅ Show toast notification
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: '✅ Λήψη ξεκίνησε',
                    text: 'Το PDF άνοιξε σε νέα καρτέλα',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });

                // ❌ ΔΕΝ κλείνουμε το modal αυτόματα!
                // Ο χρήστης θα το κλείσει χειροκίνητα όταν τελειώσει
            };

            // =====================================================================
            // ✅ DOWNLOAD + EMAIL HANDLER (DOES NOT AUTO-CLOSE)
            // =====================================================================
            const downloadAndSendEmail = async () => {
                if (!employeeEmail) {
                    await Swal.fire({
                        backdrop: false,
                        icon: 'error',
                        title: 'Σφάλμα',
                        text: 'Δεν βρέθηκε email εργαζόμενου!',
                        confirmButtonText: 'OK'
                    });
                    return;
                }

                // Download PDF
                console.log('📥 Download + Email initiated');
                window.open(pdfUrl, '_blank');

                // Show loading
                emailBtn.disabled = true;
                const originalBtnHtml = emailBtn.innerHTML;
                emailBtn.innerHTML =
                    '<span class="spinner-border spinner-border-sm"></span> Αποστολή...';

                try {
                    // ✅ Send email request
                    const csrfToken =
                        document.querySelector('meta[name="csrf-token"]')?.content || '';

                    // ✅ Get form data for email
                    const fyloInput =
                        document.getElementById('fylo') ||
                        document.querySelector('input[name="fylo"]');
                    const fyloValue = fyloInput?.value === 'true' || fyloInput?.checked === true;

                    const yphkoothtaInput =
                        document.getElementById('yphkoothta_stathera') ||
                        document.querySelector('select[name="yphkoothta_stathera"]');
                    const yphkoothtaValue = yphkoothtaInput?.value || '048';

                    const requestBody = {
                        email: employeeEmail,
                        pdfUrl: s3Key,
                        employeeName: employeeName,
                        fylo: fyloValue,
                        yphkoothta: yphkoothtaValue,
                        companyEmail: companyData?.email || null,
                        companyPhone: companyData?.phone || null,
                        companyName: companyData?.name || null,
                        companyType: companyData?.type || 'ΕΠΙΧΕΙΡΗΣΗ'
                    };

                    const response = await fetch('/api/send-contract-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include',
                        body: JSON.stringify(requestBody)
                    });

                    const data = await response.json();

                    if (response.ok && data.success) {
                        await Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'success',
                            title: `✅ Email στάλθηκε στο ${employeeEmail}`,
                            showConfirmButton: false,
                            timer: 3000,
                            timerProgressBar: true
                        });

                        // ✅ Restore button but keep modal open
                        emailBtn.disabled = false;
                        emailBtn.innerHTML = originalBtnHtml;

                        // ❌ ΔΕΝ κλείνουμε το modal!
                        // Ο χρήστης θα το κλείσει χειροκίνητα
                    } else {
                        throw new Error(data.message || 'Email failed');
                    }
                } catch (error) {
                    console.error('❌ Email error:', error);

                    await Swal.fire({
                        backdrop: false,
                        icon: 'error',
                        title: 'Αποτυχία αποστολής email',
                        text: String(error.message || error),
                        confirmButtonText: 'OK'
                    });

                    // Restore button
                    emailBtn.disabled = false;
                    emailBtn.innerHTML = originalBtnHtml;
                }
            };

            // =====================================================================
            // ✅ EVENT LISTENERS
            // =====================================================================
            if (closeBtn) closeBtn.onclick = closeModal;
            if (skipBtn) skipBtn.onclick = closeModal;
            if (downloadBtn) downloadBtn.onclick = downloadAndContinue;
            if (emailBtn) emailBtn.onclick = downloadAndSendEmail;

            // =====================================================================
            // ✅ ADD E3 XML DOWNLOAD BUTTON (if available)
            // =====================================================================
            if (e3XmlData && e3XmlData.success && e3XmlData.downloadUrl) {
                // Check if already added
                const existingE3Container = modal.querySelector('.e3-xml-download-container');
                if (existingE3Container) {
                    existingE3Container.remove(); // Remove old one
                }

                const e3Container = document.createElement('div');
                e3Container.className = 'e3-xml-download-container mt-3 pt-3 border-top';
                e3Container.innerHTML = `
                    <p class="text-success mb-2">
                        <i class="bi bi-file-earmark-code"></i> Αρχείο E3 XML για ΕΡΓΑΝΗ
                    </p>
                    <a href="${e3XmlData.downloadUrl}" 
                    download="${e3XmlData.filename}"
                    class="btn btn-outline-success btn-sm">
                    <i class="bi bi-download"></i> Λήψη ${e3XmlData.filename}
                    </a>
                `;

                // Find modal body and insert before buttons
                const modalBody =
                    modal.querySelector('.modal-body') ||
                    modal.querySelector('.pdf-preview-container');
                if (modalBody) {
                    modalBody.appendChild(e3Container);
                }
            }

            // =====================================================================
            // ✅ ADD WTO XML DOWNLOAD BUTTON (if available)
            // =====================================================================
            if (wtoXmlData && wtoXmlData.success && wtoXmlData.downloadUrl) {
                // Check if already added
                const existingWtoContainer = modal.querySelector('.wto-xml-download-container');
                if (existingWtoContainer) {
                    existingWtoContainer.remove(); // Remove old one
                }

                const wtoContainer = document.createElement('div');
                wtoContainer.className = 'wto-xml-download-container mt-3 pt-3 border-top';
                wtoContainer.innerHTML = `
                    <p class="text-success mb-2">
                        <i class="bi bi-calendar-week"></i> Αρχείο WTO XML για ΕΡΓΑΝΗ
                    </p>
                    <a href="${wtoXmlData.downloadUrl}" 
                    download="${wtoXmlData.filename}"
                    class="btn btn-outline-success btn-sm">
                    <i class="bi bi-download"></i> Λήψη ${wtoXmlData.filename}
                    </a>
                `;

                // Find modal body and insert after E3 container (if exists)
                const modalBody =
                    modal.querySelector('.modal-body') ||
                    modal.querySelector('.pdf-preview-container');
                if (modalBody) {
                    modalBody.appendChild(wtoContainer);
                }
            }

            // =====================================================================
            // ✅ ESC KEY TO CLOSE
            // =====================================================================
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Upload to ERGANH (PROD S3 + DEV local)
    // Shows smooth progress loader steps via socket.io events (erganh:progress)
    // and hides loader immediately before Swal.
    // ============================================================================
    async function uploadToErganh(ergazomenosId, s3Url, isPermanent = false) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        console.log('[UPLOAD-E3] Options:', { ergazomenosId, isPermanent });

        // ✅ Safety
        if (!s3Url || typeof s3Url !== 'string') {
            throw new Error('uploadToErganh: s3Url must be a string');
        }

        if (erganiUploadInProgress) {
            // ensure loader is not stuck
            if (window.hideLoader) window.hideLoader();

            await Swal.fire({
                icon: 'info',
                title: 'ΕΡΓΑΝΗ',
                text: 'Η υποβολή είναι ήδη σε εξέλιξη. Περίμενε να ολοκληρωθεί.',
                confirmButtonText: 'OK'
            });

            return {
                success: false,
                userMessage: 'Upload already in progress',
                errorDetails: '',
                messages: []
            };
        }

        erganiUploadInProgress = true;

        const escapeHtml = (s) =>
            String(s ?? '').replace(
                /[<>&"]/g,
                (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]
            );

        const redactSecrets = (s) => {
            if (!s) return '';
            let out = String(s);
            out = out.replace(/X-Amz-Signature=[^&\s]+/gi, 'X-Amz-Signature=REDACTED');
            out = out.replace(/X-Amz-Security-Token=[^&\s]+/gi, 'X-Amz-Security-Token=REDACTED');
            out = out.replace(/X-Amz-Credential=[^&\s]+/gi, 'X-Amz-Credential=REDACTED');
            const MAX = 1200;
            if (out.length > MAX)
                out = out.slice(0, MAX) + `\n\n…(truncated, ${out.length - MAX} chars)`;
            return out;
        };

        const buildErrorHtml = ({ userMessage, errorDetails, messages }) => {
            const short = userMessage || 'Η υποβολή απέτυχε.';
            const detailsParts = [
                errorDetails,
                ...(Array.isArray(messages) ? messages : [])
            ].filter(Boolean);
            const details = redactSecrets(detailsParts.join('\n\n'));

            return `
      <div style="text-align:left; line-height:1.4; font-size:14px;">
        <div style="font-weight:600; margin-bottom:10px;">
          ${escapeHtml(short)}
        </div>
        ${
            details
                ? `
          <details style="margin-top:8px;">
            <summary style="cursor:pointer;">Λεπτομέρειες</summary>
            <pre style="
              max-height:220px;
              overflow:auto;
              white-space:pre-wrap;
              overflow-wrap:anywhere;
              word-break:break-word;
              padding:10px 12px;
              border:1px solid rgba(0,0,0,.10);
              border-radius:10px;
              background:#fff;
              font-size:12px;
            ">${escapeHtml(details)}</pre>
          </details>
        `
                : ''
        }
      </div>
    `;
        };

        try {
            // ✅ Start progress bar loader ONLY (NO Swal popup!)
            if (window.applyServerProgress) {
                window.applyServerProgress(0, 'Είσοδος στο ΕΡΓΑΝΗ ΙΙ', 1, 4);
            } else if (window.showLoader) {
                window.showLoader('Είσοδος στο ΕΡΓΑΝΗ ΙΙ');
            }

            const uploadResponse = await fetch('/ergazomenoi/ergazomenoi/upload-e3-to-erganh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({
                    ergazomenosId,
                    s3Url,
                    isPermanent: isPermanent === true // ✅ Pass flag
                })
            });

            let payload;
            try {
                payload = await uploadResponse.json();
            } catch {
                payload = { success: false, userMessage: await uploadResponse.text() };
            }

            // ✅ HTTP errors
            if (!uploadResponse.ok) {
                const userMessage =
                    payload?.userMessage ||
                    payload?.message ||
                    payload?.errorDetails ||
                    payload?.error ||
                    `HTTP ${uploadResponse.status}`;

                if (window.hideLoader) window.hideLoader();

                await Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα',
                    html: buildErrorHtml({
                        userMessage,
                        errorDetails: payload?.errorDetails || payload?.error || '',
                        messages: Array.isArray(payload?.messages) ? payload.messages : []
                    }),
                    width: 700,
                    confirmButtonText: 'OK'
                });

                return {
                    success: false,
                    userMessage,
                    errorDetails: payload?.errorDetails || payload?.error || '',
                    messages: Array.isArray(payload?.messages) ? payload.messages : []
                };
            }

            const userMessage = payload?.userMessage || payload?.message || '';
            const errorDetails = payload?.errorDetails || payload?.error || '';
            const messages = Array.isArray(payload?.messages) ? payload.messages : [];

            // ✅ SUCCESS
            if (payload.success) {
                const userMsg = payload?.userMessage || 'Επιτυχής Προσωρινή Αποθήκευση';

                if (window.hideLoader) window.hideLoader();

                await Swal.fire({
                    icon: 'success',
                    title: 'ΕΡΓΑΝΗ ΙΙ',
                    width: 700,
                    html: `
            <div style="text-align:left;">
              <div style="font-weight:600;margin-bottom:10px;">${escapeHtml(userMsg)}</div>
              ${
                  payload?.protocol
                      ? `<div>Πρωτόκολλο: <b>${escapeHtml(payload.protocol)}</b></div>`
                      : ''
              }
            </div>
          `,
                    confirmButtonText: 'OK'
                });

                return payload;
            }

            // ✅ FAIL
            if (window.hideLoader) window.hideLoader();

            await Swal.fire({
                icon: 'error',
                title: 'Σφάλματα XML - Αποτυχία Υποβολής',
                html: buildErrorHtml({ userMessage, errorDetails, messages }),
                width: 800,
                confirmButtonText: 'OK'
            });

            return payload;
        } finally {
            if (window.hideLoader) window.hideLoader();
            erganiUploadInProgress = false;
        }
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Upload WTO to ERGANH
    // ============================================================================
    async function uploadWtoToErganh(ergazomenosId, s3Url) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        // ✅ Safety
        if (!s3Url || typeof s3Url !== 'string') {
            throw new Error('uploadWtoToErganh: s3Url must be a string');
        }

        if (erganiUploadInProgress) {
            await Swal.fire({
                icon: 'info',
                title: 'ΕΡΓΑΝΗ (WTO)',
                text: 'Η υποβολή είναι ήδη σε εξέλιξη. Περίμενε να ολοκληρωθεί.',
                confirmButtonText: 'OK'
            });

            return {
                success: false,
                userMessage: 'Upload already in progress',
                errorDetails: '',
                messages: []
            };
        }

        erganiUploadInProgress = true;

        const escapeHtml = (s) =>
            String(s ?? '').replace(
                /[<>&"]/g,
                (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]
            );

        const redactSecrets = (s) => {
            if (!s) return '';
            let out = String(s);
            out = out.replace(/X-Amz-Signature=[^&\s]+/gi, 'X-Amz-Signature=REDACTED');
            out = out.replace(/X-Amz-Security-Token=[^&\s]+/gi, 'X-Amz-Security-Token=REDACTED');
            out = out.replace(/X-Amz-Credential=[^&\s]+/gi, 'X-Amz-Credential=REDACTED');
            const MAX = 1200;
            if (out.length > MAX)
                out = out.slice(0, MAX) + `\n\n…(truncated, ${out.length - MAX} chars)`;
            return out;
        };

        const buildErrorHtml = ({ userMessage, errorDetails, messages }) => {
            const short = userMessage || 'Η υποβολή WTO απέτυχε.';
            const detailsParts = [
                errorDetails,
                ...(Array.isArray(messages) ? messages : [])
            ].filter(Boolean);
            const details = redactSecrets(detailsParts.join('\n\n'));

            return `
      <div style="text-align:left; line-height:1.4; font-size:14px;">
        <div style="font-weight:600; margin-bottom:10px;">
          ${escapeHtml(short)}
        </div>
        ${
            details
                ? `
          <details style="margin-top:8px;">
            <summary style="cursor:pointer;">Λεπτομέρειες</summary>
            <pre style="
              max-height:220px;
              overflow:auto;
              white-space:pre-wrap;
              overflow-wrap:anywhere;
              word-break:break-word;
              padding:10px 12px;
              border:1px solid rgba(0,0,0,.10);
              border-radius:10px;
              background:#fff;
              font-size:12px;
            ">${escapeHtml(details)}</pre>
          </details>
        `
                : ''
        }
      </div>
    `;
        };

        try {
            // ✅ Start progress bar loader
            if (window.applyServerProgress) {
                window.applyServerProgress(0, 'Είσοδος στο ΕΡΓΑΝΗ ΙΙ (WTO)', 1, 4);
            } else if (window.showLoader) {
                window.showLoader('Είσοδος στο ΕΡΓΑΝΗ ΙΙ (WTO)');
            }

            const uploadResponse = await fetch('/ergazomenoi/ergazomenoi/upload-wto-to-erganh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ ergazomenosId, s3Url })
            });

            let payload;
            try {
                payload = await uploadResponse.json();
            } catch {
                payload = { success: false, userMessage: await uploadResponse.text() };
            }

            // ✅ HTTP errors
            if (!uploadResponse.ok) {
                const userMessage =
                    payload?.userMessage ||
                    payload?.message ||
                    payload?.errorDetails ||
                    payload?.error ||
                    `HTTP ${uploadResponse.status}`;

                if (window.hideLoader) window.hideLoader();

                await Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα WTO',
                    html: buildErrorHtml({
                        userMessage,
                        errorDetails: payload?.errorDetails || payload?.error || '',
                        messages: Array.isArray(payload?.messages) ? payload.messages : []
                    }),
                    width: 700,
                    confirmButtonText: 'OK'
                });

                return {
                    success: false,
                    userMessage,
                    errorDetails: payload?.errorDetails || payload?.error || '',
                    messages: Array.isArray(payload?.messages) ? payload.messages : []
                };
            }

            const userMessage = payload?.userMessage || payload?.message || '';
            const errorDetails = payload?.errorDetails || payload?.error || '';
            const messages = Array.isArray(payload?.messages) ? payload.messages : [];

            // ✅ SUCCESS
            if (payload.success) {
                const userMsg = payload?.userMessage || 'Επιτυχής Προσωρινή Αποθήκευση WTO';

                if (window.hideLoader) window.hideLoader();

                await Swal.fire({
                    icon: 'success',
                    title: 'ΕΡΓΑΝΗ ΙΙ (WTO)',
                    width: 700,
                    html: `
            <div style="text-align:left;">
              <div style="font-weight:600;margin-bottom:10px;">${escapeHtml(userMsg)}</div>
              ${
                  payload?.protocol
                      ? `<div>Πρωτόκολλο: <b>${escapeHtml(payload.protocol)}</b></div>`
                      : ''
              }
            </div>
          `,
                    confirmButtonText: 'OK'
                });

                return payload;
            }

            // ✅ FAIL
            if (window.hideLoader) window.hideLoader();

            await Swal.fire({
                icon: 'error',
                title: 'Σφάλματα WTO XML - Αποτυχία Υποβολής',
                html: buildErrorHtml({ userMessage, errorDetails, messages }),
                width: 800,
                confirmButtonText: 'OK'
            });

            return payload;
        } finally {
            if (window.hideLoader) window.hideLoader();
            erganiUploadInProgress = false;
        }
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Upload WTO TEMPORARY (Manual Form Navigation)
    // ============================================================================
    async function uploadWtoTemporary(ergazomenosId, _unusedParam = null) {
        // We don't need s3Url for temporary mode (manual form navigation)
        // This function triggers server-side browser automation

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        if (erganiUploadInProgress) {
            await Swal.fire({
                backdrop: false,
                icon: 'info',
                title: 'ΕΡΓΑΝΗ (WTO Προσωρινή)',
                text: 'Η υποβολή είναι ήδη σε εξέλιξη. Περίμενε να ολοκληρωθεί.',
                confirmButtonText: 'OK'
            });

            return {
                success: false,
                userMessage: 'Upload already in progress'
            };
        }

        erganiUploadInProgress = true;

        const escapeHtml = (s) =>
            String(s ?? '').replace(
                /[<>&"]/g,
                (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]
            );

        try {
            // ✅ Start progress bar loader
            if (window.applyServerProgress) {
                window.applyServerProgress(0, 'Είσοδος στο ΕΡΓΑΝΗ ΙΙ (WTO - Προσωρινή)', 1, 12);
            } else if (window.showLoader) {
                window.showLoader('Είσοδος στο ΕΡΓΑΝΗ ΙΙ (WTO - Προσωρινή)');
            }

            console.log('[WTO-TEMP] Calling backend endpoint...');

            // ✅ Call the CORRECT backend endpoint (wtoTemporaryUploader.js)
            const uploadResponse = await fetch(
                '/ergazomenoi/ergazomenoi/upload-wto-temporary-to-erganh',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        ergazomenosId: ergazomenosId
                        // ✅ No s3Url needed - backend will fetch employee data from DB
                    })
                }
            );

            let payload;
            try {
                payload = await uploadResponse.json();
            } catch {
                payload = {
                    success: false,
                    userMessage: await uploadResponse.text()
                };
            }

            console.log('[WTO-TEMP] Backend response:', payload);

            // ✅ Hide loader before showing Swal
            if (window.hideLoader) window.hideLoader();

            // ✅ HTTP errors
            if (!uploadResponse.ok) {
                const userMessage =
                    payload?.userMessage ||
                    payload?.message ||
                    payload?.error ||
                    `HTTP ${uploadResponse.status}`;

                await Swal.fire({
                    backdrop: false,
                    icon: 'error',
                    title: 'WTO (Προσωρινή) - Αποτυχία',
                    html: `
                    <p>${escapeHtml(userMessage)}</p>
                    ${
                        payload?.errorDetails
                            ? `
                        <details style="margin-top: 10px;">
                            <summary style="cursor: pointer;">Λεπτομέρειες</summary>
                            <pre style="max-height: 200px; overflow: auto; padding: 10px; background: #f5f5f5; border-radius: 5px; font-size: 12px;">${escapeHtml(payload.errorDetails)}</pre>
                        </details>
                    `
                            : ''
                    }
                `,
                    confirmButtonText: 'OK',
                    customClass: {
                        confirmButton: 'class-error custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        htmlContainer: 'custom-html-container'
                    }
                });

                return {
                    success: false,
                    userMessage
                };
            }

            // ✅ Check if navigation was successful
            if (payload.success) {
                const userMsg =
                    payload?.userMessage ||
                    'Επιτυχής Προσωρινή Αποθήκευση WTO (φόρμα συμπληρώθηκε)';

                await Swal.fire({
                    backdrop: false,
                    icon: 'success',
                    title: 'ΕΡΓΑΝΗ ΙΙ (WTO - Προσωρινή)',
                    html: `
                    <div style="text-align: left;">
                        <p style="font-weight: 600; margin-bottom: 10px;">${escapeHtml(userMsg)}</p>
                        <p class="text-muted" style="font-size: 0.9rem;">
                            Η φόρμα WTO συμπληρώθηκε αυτόματα. Ολοκλήρωσε την υποβολή στο παράθυρο του ΕΡΓΑΝΗ.
                        </p>
                    </div>
                `,
                    confirmButtonText: 'OK',
                    customClass: {
                        confirmButton: 'class-success custom-confirm-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        htmlContainer: 'custom-html-container'
                    }
                });

                return payload;
            }

            // ✅ Navigation completed but with warnings
            const userMsg = payload?.userMessage || 'Η φόρμα WTO συμπληρώθηκε με προειδοποιήσεις';

            await Swal.fire({
                backdrop: false,
                icon: 'warning',
                title: 'ΕΡΓΑΝΗ ΙΙ (WTO - Προσωρινή)',
                html: `
                <div style="text-align: left;">
                    <p style="font-weight: 600; margin-bottom: 10px;">${escapeHtml(userMsg)}</p>
                    ${
                        payload?.errorDetails
                            ? `
                        <details style="margin-top: 10px;">
                            <summary style="cursor: pointer;">Λεπτομέρειες</summary>
                            <pre style="max-height: 200px; overflow: auto; padding: 10px; background: #f5f5f5; border-radius: 5px; font-size: 12px;">${escapeHtml(payload.errorDetails)}</pre>
                        </details>
                    `
                            : ''
                    }
                </div>
            `,
                confirmButtonText: 'OK',
                customClass: {
                    confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup',
                    htmlContainer: 'custom-html-container'
                }
            });

            return payload;
        } catch (error) {
            console.error('[WTO-TEMP] ❌ Exception:', error);

            if (window.hideLoader) window.hideLoader();

            await Swal.fire({
                backdrop: false,
                icon: 'error',
                title: 'WTO (Προσωρινή) - Σφάλμα',
                text: error?.message || 'Unknown error',
                confirmButtonText: 'OK',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });

            return {
                success: false,
                userMessage: error?.message || 'Unknown error'
            };
        } finally {
            if (window.hideLoader) window.hideLoader();
            erganiUploadInProgress = false;
        }
    }
});
