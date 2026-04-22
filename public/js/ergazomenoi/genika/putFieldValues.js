// public\js\ergazomenoi\genika\putFieldValues.js

document.addEventListener('DOMContentLoaded', () => {
    const isEmpty = (v) => !String(v ?? '').trim();
    const isEmptyArray = (v) => !Array.isArray(v) || v.length === 0;
    let message = '';
    let erganiUploadInProgress = false;

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

            const ergazomenoiId = document.getElementById('ergazomenoiId')?.value?.trim() || '';

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

                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: 'warning',
                        title: 'ΠΡΟΣΟΧΗ !!!',
                        html: `<p class="error-header">Τα παρακάτω ${errors.length} πεδία είναι υποχρεωτικά για την πρόσληψη:</p>
                        <p class="warning-header">Τα πεδία με το εικονίδιο ⚠️ είναι προειδοποιητικά και μόνο για επανέλεγχο</p>${gridHTML}`,
                        heightAuto: true,
                        confirmButtonText: 'Κλείσιμο',
                        customClass: {
                            confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup',
                            htmlContainer: 'custom-html-container'
                        }
                    });
                    return;
                }
            }

            // =========================================================================
            // ✅ PRE-VALIDATION: Check WTO schedules BEFORE showing ERGANH modal
            // =========================================================================

            console.log('🔍 [PRE-VALIDATION] Checking weekly schedule...');

            const days = ['01', '02', '03', '04', '05', '06', '07'];
            const scheduleErrors = [];

            // =====================================================================
            // ✅ CHECK 1: ALL days must have a category
            // =====================================================================

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
                return; // ❌ Stop submission
            }

            console.log('✅ [PRE-VALIDATION] All days have categories');

            // =====================================================================
            // ✅ CHECK 2: Validate each day's times
            // =====================================================================

            days.forEach((day) => {
                const category = (formData[`kathgoria_ergasias_${day}`] || '').trim().toUpperCase();

                const label = document.getElementById(`day_label_${day}`);
                const dateStr = label ? label.textContent.trim() : `Ημέρα ${day}`;

                // ✅ Get all 6 time fields
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

                // ✅ RULE 1: ΕΡΓ/ΤΗΛ → Must have at least ONE complete shift
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

                // ✅ RULE 2: ΜΕ/ΑΝ → Must NOT have ANY times
                if (category === 'ΜΕ' || category === 'ΑΝ') {
                    if (nonEmptyTimes.length > 0) {
                        scheduleErrors.push(
                            `<strong>${dateStr}</strong>: Κατηγορία <strong>${category}</strong> ΔΕΝ πρέπει να έχει ώρες (βρέθηκαν ${nonEmptyTimes.length} πεδία με τιμές)`
                        );
                    }
                }
            });

            // =====================================================================
            // ✅ Show schedule errors if any
            // =====================================================================

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
                return; // ❌ Stop submission
            }

            console.log('✅ [PRE-VALIDATION] All schedule checks passed');

            // =========================================================================
            // ✅ ΕΡΓΑΝΗ FILES SELECTION (Only shown if validation passes)
            // =========================================================================
            const apoxorhshVal = document.getElementById('hmeromhnia_apoxorhshs')?.value?.trim();
            const hasApoxorhsh =
                apoxorhshVal && apoxorhshVal !== '' && apoxorhshVal !== 'dd/mm/yyyy';

            // ✅ Έλεγχος typos_metabolhs_table
            let typosMetabolhsData = [];
            try {
                typosMetabolhsData = JSON.parse(
                    document.getElementById('typos_metabolhs_table')?.value || '[]'
                );
            } catch (e) {
                typosMetabolhsData = [];
            }
            const hasMetaboles = typosMetabolhsData.length > 0;

            // ✅ HTML Μεταβολές — μόνο αν υπάρχουν τύποι μεταβολών
            const metabolesHtml = hasMetaboles
                ? `
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="e3_metaboles_ergasiakhs_sxeshs" name="files"
                            value="e3_metaboles_ergasiakhs_sxeshs" class="custom-checkbox" />
                        <label for="e3_metaboles_ergasiakhs_sxeshs" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΜΕΤΑΒΟΛΗ ΣΤΟΙΧΕΙΩΝ ΕΡΓΑΣΙΑΚΗΣ ΣΧΕΣΗΣ
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy" name="files"
                            value="e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy" class="custom-checkbox" />
                        <label for="e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΜΕΤΑΒΟΛΗ ΣΤΟΙΧΕΙΩΝ ΕΡΓΑΣΙΑΚΗΣ ΣΧΕΣΗΣ - Δανειζόμενου Προσωπικού
                        </label>
                    </div>
                `
                : '';

            // ✅ HTML για τις Λήξεις — μόνο αν υπάρχει ημερομηνία αποχώρησης
            const lhxeisHtml = hasApoxorhsh
                ? `
                    <hr class="hr-style" />

                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_222_lysh_symbashs_orismenoy_xronoy" name="files"
                            value="ma_222_lysh_symbashs_orismenoy_xronoy" class="custom-checkbox" />
                        <label for="ma_222_lysh_symbashs_orismenoy_xronoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            Λύση Σύμβασης Ορισμένου Χρόνου (E7N)
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_227_lysh_dokimastikhs_periodoy" name="files"
                            value="ma_227_lysh_dokimastikhs_periodoy" class="custom-checkbox" />
                        <label for="ma_227_lysh_dokimastikhs_periodoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Αυτοδίκαιη Λύση Δοκιμαστικής Περιόδου
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_217_oikeiothelhs_apoxorhsh" name="files"
                            value="ma_217_oikeiothelhs_apoxorhsh" class="custom-checkbox" />
                        <label for="ma_217_oikeiothelhs_apoxorhsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Οικειοθελής Αποχώρηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_221_lysh_kataggelia_me_proeidopoihsh" name="files"
                            value="ma_221_lysh_kataggelia_me_proeidopoihsh" class="custom-checkbox" />
                        <label for="ma_221_lysh_kataggelia_me_proeidopoihsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Καταγγελία Σύμβασης με Προειδοποίηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_220_lysh_kataggelia_xoris_proeidopoihsh" name="files"
                            value="ma_220_lysh_kataggelia_xoris_proeidopoihsh" class="custom-checkbox" />
                        <label for="ma_220_lysh_kataggelia_xoris_proeidopoihsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Καταγγελία Σύμβασης Χωρίς Προειδοποίηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_218_lysh_dhloshs_oxlhshs" name="files"
                            value="ma_218_lysh_dhloshs_oxlhshs" class="custom-checkbox" />
                        <label for="ma_218_lysh_dhloshs_oxlhshs" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Δήλωση Όχλησης για δυνατότητα Οικειοθελούς Αποχώρησης
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh" name="files"
                            value="ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh" class="custom-checkbox" />
                        <label for="ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Οικειοθελής Αποχώρηση μετά από Όχληση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_223_lysh_ethelousia_exodos" name="files"
                            value="ma_223_lysh_ethelousia_exodos" class="custom-checkbox" />
                        <label for="ma_223_lysh_ethelousia_exodos" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Εθελούσια Έξοδος
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_229_lhxh_daneismoy" name="files"
                            value="ma_229_lhxh_daneismoy" class="custom-checkbox" />
                        <label for="ma_229_lhxh_daneismoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Λήξη Δανεισμού από επιχείρηση/Τοποθέτησης από ΕΠΑ
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_226_lhxh_logo_thanatoy" name="files"
                            value="ma_226_lhxh_logo_thanatoy" class="custom-checkbox" />
                        <label for="ma_226_lhxh_logo_thanatoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Λήξη λόγω Θανάτου
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_228_metavivash_se_epixeirish" name="files"
                            value="ma_228_metavivash_se_epixeirish" class="custom-checkbox" />
                        <label for="ma_228_metavivash_se_epixeirish" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Μεταβίβαση σε Επιχείρηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh" name="files"
                            value="ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh" class="custom-checkbox" />
                        <label for="ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Συνταξιοδότηση με Οικειοθελή Αποχώρηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh" name="files"
                            value="ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh" class="custom-checkbox" />
                        <label for="ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Συνταξιοδότηση με Καταγγελία Σύμβασης Χωρίς Προειδοποίηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" id="ma_236_oikeiothelhs_apoxorhsh_logo_15etias" name="files"
                            value="ma_236_oikeiothelhs_apoxorhsh_logo_15etias" class="custom-checkbox" />
                        <label for="ma_236_oikeiothelhs_apoxorhsh_logo_15etias" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ- Οικειοθελής αποχώρηση μισθωτού λόγω συμπλήρωσης δεκαπενταετίας στον ίδιο εργοδότη ή υπέρβασης του ορίου ηλικίας συνταξιοδότησης με τη συγκατάθεση του εργοδότη
                        </label>
                    </div>
`
                : '';

            // ✅ Αν δεν υπάρχει ΤΙΠΟΤΑ να ενημερωθεί στο ΕΡΓΑΝΗ ΙΙ
            const noErganiUpdates = !hasMetaboles && !hasApoxorhsh;

            const noUpdatesHtml = noErganiUpdates
                ? `
                    <!-- ✅ E3 CHECKBOX -->
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="checkbox" 
                            id="e3_anaggelia_proslhpshs" 
                            name="files" 
                            value="e3_anaggelia_proslhpshs" 
                            class="custom-checkbox" />
                        <label for="e3_anaggelia_proslhpshs" 
                            class="margin-0 cursor-pointer font-size-rem-1_05">
                            Αναγγελία Πρόσληψης (E3N)
                        </label>
                    </div>
                `
                : '';

            const result = await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'info',
                title: 'ΕΝΗΜΕΡΩΣΗ ΕΡΓΑΝΗ ΙΙ',
                html: `
                    <div class="display-flex flex-direction-column left-align gap-1rem padding-1rem swal-overflow"
                    >
                        <!-- ✅ TOGGLE: Προσωρινή/Οριστική -->
                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="checkbox" 
                                id="temporary_permanent_storage" 
                                name="files" 
                                value="temporary_permanent_storage" 
                                class="custom-checkbox"
                                ${noErganiUpdates ? 'disabled' : ''} />
                            <label for="temporary_permanent_storage" 
                                id="storage_mode_label"
                                class="margin-0 cursor-pointer font-size-rem-1_05 font-weight-600 temp_perm"
                                style="transition: all 0.2s; color: ${noErganiUpdates ? '#aaaaaa' : '#000000'}">
                                Προσωρινή Αποθήκευση
                            </label>
                        </div>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="checkbox" 
                                id="create_contract" 
                                name="files" 
                                value="create_contract" 
                                class="custom-checkbox" />
                            <label for="create_contract" 
                                id="create_contract_label"
                                class="margin-0 cursor-pointer font-size-rem-1_05 font-weight-400">
                                Δημιουργία Σύμβασης
                            </label>
                        </div>

                        ${noUpdatesHtml}
                        ${metabolesHtml}
                        ${lhxeisHtml}
                    </div>
                `,

                focusConfirm: false,

                // ✅ ATTACH EVENT LISTENER AFTER MODAL OPENS (CSP-safe)
                didOpen: () => {
                    const checkbox = document.getElementById('temporary_permanent_storage');
                    const label = document.getElementById('storage_mode_label');

                    if (checkbox && label) {
                        checkbox.addEventListener('change', function () {
                            if (this.checked) {
                                label.innerHTML = '<strong>Οριστική Ενημέρωση</strong>';
                                label.style.color = '#184d00'; // Green
                            } else {
                                label.innerHTML = 'Προσωρινή Αποθήκευση';
                                label.style.color = '#000000';
                            }
                        });
                    }
                },

                preConfirm: () => {
                    const isPermanent =
                        document.getElementById('temporary_permanent_storage')?.checked ?? false;

                    const createContract =
                        document.getElementById('create_contract')?.checked ?? false;

                    const e3AnaggeliaProslhpshs =
                        document.getElementById('e3_anaggelia_proslhpshs')?.checked ?? false;

                    // ✅ Μεταβολές — null safe
                    const e3Enabled_1 =
                        document.getElementById('e3_metaboles_ergasiakhs_sxeshs')?.checked ?? false;
                    const e3Enabled_2 =
                        document.getElementById(
                            'e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy'
                        )?.checked ?? false;

                    // ✅ Λήξεις — null safe
                    const wtoEnabled_222 =
                        document.getElementById('ma_222_lysh_symbashs_orismenoy_xronoy')?.checked ??
                        false;
                    const wtoEnabled_227 =
                        document.getElementById('ma_227_lysh_dokimastikhs_periodoy')?.checked ??
                        false;
                    const wtoEnabled_217 =
                        document.getElementById('ma_217_oikeiothelhs_apoxorhsh')?.checked ?? false;
                    const wtoEnabled_221 =
                        document.getElementById('ma_221_lysh_kataggelia_me_proeidopoihsh')
                            ?.checked ?? false;
                    const wtoEnabled_220 =
                        document.getElementById('ma_220_lysh_kataggelia_xoris_proeidopoihsh')
                            ?.checked ?? false;
                    const wtoEnabled_218 =
                        document.getElementById('ma_218_lysh_dhloshs_oxlhshs')?.checked ?? false;
                    const wtoEnabled_219 =
                        document.getElementById('ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh')
                            ?.checked ?? false;
                    const wtoEnabled_223 =
                        document.getElementById('ma_223_lysh_ethelousia_exodos')?.checked ?? false;
                    const wtoEnabled_229 =
                        document.getElementById('ma_229_lhxh_daneismoy')?.checked ?? false;
                    const wtoEnabled_226 =
                        document.getElementById('ma_226_lhxh_logo_thanatoy')?.checked ?? false;
                    const wtoEnabled_228 =
                        document.getElementById('ma_228_metavivash_se_epixeirish')?.checked ??
                        false;
                    const wtoEnabled_224 =
                        document.getElementById('ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh')
                            ?.checked ?? false;
                    const wtoEnabled_225 =
                        document.getElementById(
                            'ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh'
                        )?.checked ?? false;
                    const wtoEnabled_236 =
                        document.getElementById('ma_236_oikeiothelhs_apoxorhsh_logo_15etias')
                            ?.checked ?? false;

                    const filesToUpdate = {
                        isPermanent,

                        create_contract: createContract,

                        e3_anaggelia_proslhpshs: e3AnaggeliaProslhpshs,

                        e3_metaboles_ergasiakhs_sxeshs: e3Enabled_1,
                        e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy: e3Enabled_2,

                        ma_222: wtoEnabled_222,
                        ma_227: wtoEnabled_227,
                        ma_217: wtoEnabled_217,
                        ma_221: wtoEnabled_221,
                        ma_220: wtoEnabled_220,
                        ma_218: wtoEnabled_218,
                        ma_219: wtoEnabled_219,
                        ma_223: wtoEnabled_223,
                        ma_229: wtoEnabled_229,
                        ma_226: wtoEnabled_226,
                        ma_228: wtoEnabled_228,
                        ma_224: wtoEnabled_224,
                        ma_225: wtoEnabled_225,
                        ma_236: wtoEnabled_236
                    };

                    console.log('🔍 [FRONTEND] Checkboxes:', filesToUpdate);
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

            const v = {
                formData: formData,
                filesToUpdate: result.value
            };

            const createContract = result.value?.create_contract === true;

            if (createContract) {
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

            const response = await fetch('/api/ergazomenoi/update/' + ergazomenoiId, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(v)
            });

            // ============================================================================
            // ✅ SMOOTH PROGRESS COMPLETION — ΜΟΝΟ αν το modal άνοιξε
            // ============================================================================

            if (createContract) {
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

                // ✅ BUILD HTML STRINGS (ONCE)
                const e3XmlHtml = hasE3Xml
                    ? `<p class="text-success mt-3">✅ E3 XML δημιουργήθηκε επιτυχώς!</p>
                    <a href="${e3XmlData.downloadUrl}" 
                        download="${e3XmlData.filename}"
                        class="btn btn-sm btn-outline-primary mt-2">
                        <i class="bi bi-download"></i> Λήψη E3 XML
                    </a>`
                    : '';

                const wtoXmlHtml = hasWtoXml
                    ? `<p class="text-success mt-3">✅ WTO XML δημιουργήθηκε επιτυχώς!</p>
                    <a href="${wtoXmlData.downloadUrl}" 
                        download="${wtoXmlData.filename}"
                        class="btn btn-sm btn-outline-success mt-2">
                        <i class="bi bi-download"></i> Λήψη WTO XML
                    </a>`
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

                            await Swal.fire({
                                backdrop: false,
                                icon: 'warning',
                                title: 'PDF Δημιουργήθηκ��',
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

                        console.log('📄 Opening PDF modal...');

                        window.__erganhUploadOptions = {
                            isPermanent: result.value?.isPermanent || false,
                            e3_anaggelia_proslhpshs: result.value?.e3_anaggelia_proslhpshs || false, // ✅
                            e3Enabled_1: result.value?.e3_metaboles_ergasiakhs_sxeshs !== false,
                            e3Enabled_2:
                                result.value
                                    ?.e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy !==
                                false,
                            wtoEnabled_222:
                                result.value?.ma_222_lysh_symbashs_orismenoy_xronoy !== false,
                            wtoEnabled_227:
                                result.value?.ma_227_lysh_dokimastikhs_periodoy !== false,
                            wtoEnabled_217: result.value?.ma_217_oikeiothelhs_apoxorhsh !== false,
                            wtoEnabled_221:
                                result.value?.ma_221_lysh_kataggelia_me_proeidopoihsh !== false,
                            wtoEnabled_220:
                                result.value?.ma_220_lysh_kataggelia_xoris_proeidopoihsh !== false,
                            wtoEnabled_218: result.value?.ma_218_lysh_dhloshs_oxlhshs !== false,
                            wtoEnabled_219:
                                result.value?.ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh !==
                                false,
                            wtoEnabled_223: result.value?.ma_223_lysh_ethelousia_exodos !== false,
                            wtoEnabled_229: result.value?.ma_229_lhxh_daneismoy !== false,
                            wtoEnabled_226: result.value?.ma_226_lhxh_logo_thanatoy !== false,
                            wtoEnabled_228: result.value?.ma_228_metavivash_se_epixeirish !== false,
                            wtoEnabled_224:
                                result.value?.ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh !==
                                false,
                            wtoEnabled_225:
                                result.value
                                    ?.ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh !==
                                false,
                            wtoEnabled_236:
                                result.value?.ma_236_oikeiothelhs_apoxorhsh_logo_15etias !== false
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
                            result.value
                        );
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
                ${wtoXmlHtml}
            `,
                            timer: hasE3Xml || hasWtoXml ? null : 1500,
                            showConfirmButton: hasE3Xml || hasWtoXml,
                            confirmButtonText: 'OK',
                            customClass: {
                                confirmButton:
                                    'class-success custom-confirm-button custom-swal-button',
                                title: 'custom-title',
                                popup: 'custom-swal-popup'
                            }
                        });

                        // =====================================================================
                        // ✅ UPLOAD E3 XML — με έλεγχο userWantsE3
                        // =====================================================================
                        let e3Result = { success: true };

                        if (
                            userWantsE3 &&
                            e3XmlData?.success &&
                            (e3XmlData?.relativePath ||
                                e3XmlData?.s3Key ||
                                e3XmlData?.downloadUrl) &&
                            data.data?._id
                        ) {
                            const e3UrlToSend =
                                e3XmlData?.s3Url || // ✅ ΠΡΩΤΑ: https://s3.amazonaws.com/...
                                e3XmlData?.downloadUrl || // ✅ ΔΕΥΤΕΡΟ: HTTPS URL
                                e3XmlData?.relativePath || // ✅ ΤΡΙΤΟ: fallback
                                e3XmlData?.s3Key ||
                                null;
                            if (e3UrlToSend && typeof e3UrlToSend === 'string') {
                                try {
                                    console.log('[E3-UPLOAD] Uploading E3 XML...');
                                    e3Result = await uploadToErganh(
                                        data.data._id,
                                        e3UrlToSend,
                                        result.value?.isPermanent === true
                                    );
                                    console.log('[E3-UPLOAD] Result:', e3Result);
                                } catch (e) {
                                    console.error('[E3-UPLOAD] ❌ Exception:', e?.message || e);
                                    e3Result = { success: false, error: e?.message };
                                }
                            }
                        }

                        // =====================================================================
                        // ✅ UPLOAD WTO XML
                        // =====================================================================
                        let wtoResult = { success: true };

                        if (wtoXmlData?.success && wtoXmlData?.s3Url && data.data?._id) {
                            const wtoUrlToSend =
                                wtoXmlData?.relativePath ||
                                wtoXmlData?.s3Url ||
                                wtoXmlData?.downloadUrl ||
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

                        if (!e3Result.success || !wtoResult.success) {
                            console.warn('[ERGANH] Some uploads failed:', {
                                e3: e3Result.success,
                                wto: wtoResult.success
                            });
                        }

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
            ${wtoXmlHtml}
        `,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });

                    // =====================================================================
                    // ✅ UPLOAD E3 XML — με έλεγχο userWantsE3
                    // =====================================================================
                    if (
                        userWantsE3 &&
                        e3XmlData?.success &&
                        (e3XmlData?.relativePath || e3XmlData?.s3Key || e3XmlData?.downloadUrl) &&
                        data.data?._id
                    ) {
                        const e3UrlToSend =
                            e3XmlData?.s3Url || // ✅ ΠΡΩΤΑ: https://s3.amazonaws.com/...
                            e3XmlData?.downloadUrl || // ✅ ΔΕΥΤΕΡΟ: HTTPS URL
                            e3XmlData?.relativePath || // ✅ ΤΡΙΤΟ: fallback
                            e3XmlData?.s3Key ||
                            null;
                        if (e3UrlToSend && typeof e3UrlToSend === 'string') {
                            try {
                                console.log('[E3-UPLOAD] Uploading E3 XML (failed PDFs path)...');
                                await uploadToErganh(
                                    data.data._id,
                                    e3UrlToSend,
                                    result.value?.isPermanent === true
                                );
                                console.log('[E3-UPLOAD] ✅ Success');
                            } catch (e) {
                                console.error('[E3-UPLOAD] ❌ Failed:', e?.message || e);
                            }
                        }
                    }

                    // =====================================================================
                    // ✅ UPLOAD WTO XML
                    // =====================================================================
                    if (wtoXmlData?.success && wtoXmlData?.s3Url && data.data?._id) {
                        const wtoUrlToSend =
                            wtoXmlData?.relativePath ||
                            wtoXmlData?.s3Url ||
                            wtoXmlData?.downloadUrl ||
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

                const e3AnaggeliaProslhpshs = filesToUpdate?.e3_anaggelia_proslhpshs === true;

                const e3Enabled_1 = filesToUpdate?.e3_metaboles_ergasiakhs_sxeshs === true;
                const e3Enabled_2 =
                    filesToUpdate?.e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy === true;
                const wtoEnabled_222 =
                    filesToUpdate?.ma_222_lysh_symbashs_orismenoy_xronoy === true;
                const wtoEnabled_227 = filesToUpdate?.ma_227_lysh_dokimastikhs_periodoy === true;
                const wtoEnabled_217 = filesToUpdate?.ma_217_oikeiothelhs_apoxorhsh === true;
                const wtoEnabled_221 =
                    filesToUpdate?.ma_221_lysh_kataggelia_me_proeidopoihsh === true;
                const wtoEnabled_220 =
                    filesToUpdate?.ma_220_lysh_kataggelia_xoris_proeidopoihsh === true;
                const wtoEnabled_218 = filesToUpdate?.ma_218_lysh_dhloshs_oxlhshs === true;
                const wtoEnabled_219 =
                    filesToUpdate?.ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh === true;
                const wtoEnabled_223 = filesToUpdate?.ma_223_lysh_ethelousia_exodos === true;
                const wtoEnabled_229 = filesToUpdate?.ma_229_lhxh_daneismoy === true;
                const wtoEnabled_226 = filesToUpdate?.ma_226_lhxh_logo_thanatoy === true;
                const wtoEnabled_228 = filesToUpdate?.ma_228_metavivash_se_epixeirish === true;
                const wtoEnabled_224 =
                    filesToUpdate?.ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh === true;
                const wtoEnabled_225 =
                    filesToUpdate?.ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh === true;
                const wtoEnabled_236 =
                    filesToUpdate?.ma_236_oikeiothelhs_apoxorhsh_logo_15etias === true;

                // =====================================================================
                // ✅ CHECK: What XMLs need upload?
                // =====================================================================
                const needsE3Upload = !!(
                    (e3Enabled_1 || e3AnaggeliaProslhpshs) &&
                    e3XmlData?.success &&
                    ergazomenosId
                );

                // ✅ CRITICAL: For WTO, check if USER ENABLED schedules checkbox
                // NOT if XML was generated (XML is only generated for isPermanent=true)
                const needsWtoUpload = !!(wtoEnabled_217 && ergazomenosId);

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
                        e3XmlData?.s3Url || // ✅ ΠΡΩΤΑ: https://s3.amazonaws.com/...
                        e3XmlData?.downloadUrl || // ✅ ΔΕΥΤΕΡΟ: HTTPS URL
                        e3XmlData?.relativePath || // ✅ ΤΡΙΤΟ: fallback
                        e3XmlData?.s3Key ||
                        null;
                    e3XmlData?.relativePath || e3XmlData?.s3Url || e3XmlData?.downloadUrl || null;

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

    // ============================================================================
    // ✅ SOCKET.IO - ERGANH REAL-TIME STATUS UPDATES
    // ============================================================================

    if (typeof socket !== 'undefined' && socket) {
        console.log('✅ [ERGANH] Socket.io event listeners initialized');

        // ================================================================
        // ✅ ERGANH: UPLOAD STARTED
        // ================================================================
        socket.on('erganh:started', function (data) {
            console.log('📡 [ERGANH] Upload started:', data);

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: 'ΕΡΓΑΝΗ ΙΙ',
                text: data.message || 'Έναρξη αποστολής...',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                customClass: {
                    popup: 'swal-toast-popup',
                    title: 'swal-toast-title'
                }
            });
        });

        // ================================================================
        // ✅ ERGANH: PROGRESS UPDATE
        // ================================================================
        socket.on('erganh:progress', function (data) {
            console.log('📡 [ERGANH] Progress:', data);

            const stepIcons = {
                credentials: 'info',
                browser: 'info',
                login: 'info',
                login_success: 'success',
                uploading: 'info',
                processing: 'info'
            };

            const icon = stepIcons[data.step] || 'info';

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: icon,
                title: 'ΕΡΓΑΝΗ ΙΙ',
                text: data.message || 'Σε εξέλιξη...',
                showConfirmButton: false,
                timer: data.step === 'login_success' ? 2000 : 3000,
                timerProgressBar: true,
                customClass: {
                    popup: 'swal-toast-popup',
                    title: 'swal-toast-title'
                }
            });
        });

        // ================================================================
        // ✅ ERGANH: SUCCESS
        // ================================================================
        socket.on('erganh:success', function (data) {
            console.log('📡 [ERGANH] Success:', data);

            const protocolHtml = data.protocol
                ? `<p style="margin-top: 10px; font-size: 0.95rem;">
                 <strong>Πρωτόκολλο:</strong> 
                 <span style="color: #28a745; font-weight: bold;">${data.protocol}</span>
               </p>`
                : '';

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: '✅ ΕΡΓΑΝΗ ΙΙ - Επιτυχία',
                html: `
                <p>${data.message || 'Επιτυχής αποστολή!'}</p>
                ${protocolHtml}
            `,
                showConfirmButton: true,
                confirmButtonText: 'OK',
                timer: 8000,
                timerProgressBar: true,
                customClass: {
                    popup: 'swal-toast-popup swal-toast-success',
                    title: 'swal-toast-title',
                    confirmButton: 'swal-toast-confirm-btn'
                },
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });
        });

        // ================================================================
        // ✅ ERGANH: ERROR
        // ================================================================
        socket.on('erganh:error', function (data) {
            console.error('📡 [ERGANH] Error:', data);

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: '❌ ΕΡΓΑΝΗ ΙΙ - Αποτυχία',
                html: `
                <p>${data.message || 'Η αποστολή απέτυχε'}</p>
                ${
                    data.error
                        ? `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">${data.error}</p>`
                        : ''
                }
            `,
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                timer: 10000,
                timerProgressBar: true,
                customClass: {
                    popup: 'swal-toast-popup swal-toast-error',
                    title: 'swal-toast-title',
                    confirmButton: 'swal-toast-confirm-btn'
                },
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });
        });
    } else {
        console.warn('⚠️  [ERGANH] Socket.io not available - real-time updates disabled');
    }
});
