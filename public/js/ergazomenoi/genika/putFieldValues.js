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
                if (input.tagName === 'INPUT') {
                    if (input.type === 'checkbox') {
                        formData[input.name] = input.checked === true;
                    } else if (
                        input.type === 'hidden' &&
                        (input.value === 'true' || input.value === 'false')
                    ) {
                        formData[input.name] = input.value === 'true';
                    } else if (input.type === 'date') {
                        formData[input.name] = input.value === '' ? null : input.value;
                    } else if (input.type === 'time') {
                        formData[input.name] = input.value === '' ? null : input.value;
                    } else if (input.type === 'number') {
                        const parsed = parseFloat(input.value);
                        formData[input.name] = isNaN(parsed) ? 0 : parsed;
                    } else if (input.type === 'file' && input.files.length > 0) {
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
                    } else if (input.hasAttribute('readonly') || input.hasAttribute('disabled')) {
                        if (input.type === 'number') {
                            const parsed = parseFloat(input.value);
                            formData[input.name] = isNaN(parsed) ? 0 : parsed;
                        } else {
                            formData[input.name] = input.value;
                        }
                    } else {
                        formData[input.name] = input.value;
                    }
                } else if (input.tagName === 'TEXTAREA') {
                    formData[input.name] = input.value;
                } else if (input.tagName === 'SELECT') {
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
        // ✅ CONVERT PDFs TO BASE64
        // =========================================================================

        const pdfMappings = {
            arxeio_symbashs: 'arxeio_apodoxhs_oron_atomikhs_symbashs_base64',
            oysiodeis_oroi: 'arxeio_apodoxhs_oysiodon_oron_base64',
            anhlikoi: 'bibliario_anhlikoy_base64',
            allodapoi: 'arxeio_nomimopoihtikon_eggrafon_base64',
            symbash_daneismoy: 'arxeio_symbashs_daneismoy_base64'
        };

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

        if (window.pdfPreviewModule) {
            for (const [documentType, base64Field] of Object.entries(pdfMappings)) {
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

            // ============================================================================
            // ✅ PDF UPLOAD MODAL FILES → formData
            // ============================================================================
            if (
                window.pdfUploadModule &&
                typeof window.pdfUploadModule.getAllFiles === 'function'
            ) {
                const pendingPdfFiles = window.pdfUploadModule.getAllFiles();

                for (const pdfFile of pendingPdfFiles) {
                    if (!pdfFile || !pdfFile.documentType) continue;

                    const base64 = await window.pdfUploadModule.getFileAsBase64(
                        pdfFile.documentType
                    );

                    if (!base64) continue;

                    switch (pdfFile.documentType) {
                        case 'allodapoi':
                            formData.arxeio_nomimopoihtikon_eggrafon_base64 = base64;
                            break;

                        case 'bibliario_anhlikoy':
                            formData.bibliario_anhlikoy_base64 = base64;
                            break;

                        case 'symbash_daneismoy':
                            formData.arxeio_symbashs_daneismoy_base64 = base64;
                            break;

                        case 'arxeio_symbashs':
                            formData.arxeio_apodoxhs_oron_atomikhs_symbashs_base64 = base64;
                            break;

                        case 'oysiodeis_oroi':
                            formData.arxeio_apodoxhs_oysiodon_oron_base64 = base64;
                            break;

                        default:
                            formData[`${pdfFile.documentType}_base64`] = base64;
                            break;
                    }
                }
            }

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const ergazomenoiId = document.getElementById('ergazomenoiId')?.value?.trim() || '';

            // =========================================================================
            // VALIDATION
            // =========================================================================

            const CRITICAL_FIELDS = {
                email: '⚠️ Emai Εργαζόμενου/ης',
                karta_ergasias: '⚠️ Κάρτα Εργασίας',
                evelikth_proselefsh: '⚠️ Ευέλικτη Προσέλευση (λεπτά)',
                systatiko_shmeioma: '⚠️ Τοποθέτηση με Συστατικό Σημείωμα',
                topothethsh_me_programma: '⚠️ Τοποθέτηση με Πρόγραμμα'
            };

            const errors = [];

            const addError = (fieldName, displayName) => {
                const value = formData[fieldName];
                if (isEmpty(value)) {
                    const isCritical = CRITICAL_FIELDS.hasOwnProperty(fieldName);
                    errors.push({
                        text: isCritical ? CRITICAL_FIELDS[fieldName] : displayName,
                        critical: isCritical
                    });
                    return;
                }
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
                    // return;
                }
            }
            // =========================================================================
            // ✅ PRE-VALIDATION: Check WTO schedules
            // =========================================================================

            console.log('🔍 [PRE-VALIDATION] Checking weekly schedule...');

            const days = ['01', '02', '03', '04', '05', '06', '07'];
            const scheduleErrors = [];
            const emptyDays = [];
            const emptyDayIndexes = [];

            days.forEach((day) => {
                const category = (formData[`kathgoria_ergasias_${day}`] || '').trim();
                if (!category) {
                    const label = document.getElementById(`day_label_${day}`);
                    const dateStr = label ? label.textContent.trim() : `Ημέρα ${day}`;
                    emptyDays.push(dateStr);
                    emptyDayIndexes.push(day);
                }
            });

            if (emptyDays.length > 0) {
                const emptyDaysResult = await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: 'warning',
                    title: 'Ελλιπές Εβδομαδιαίο Ωράριο',
                    html: `
                        <p><strong>${emptyDays.length}</strong> ημέρες δεν έχουν Κατηγορία Εργασίας:</p>
                        <ul style="text-align: left; padding-left: 20px; margin-top: 10px;">
                            ${emptyDays.map((date) => `<li><strong>${date}</strong></li>`).join('')}
                        </ul>
                        <p class="text-muted" style="margin-top: 15px; font-size: 0.9rem;">
                            Πήγαινε στην καρτέλα <strong>"Ωράριο Εργασίας"</strong> και συμπλήρωσε την κατηγορία για όλες τις ημέρες (ΕΡΓ, ΤΗΛ, ΑΝ, ΜΕ).
                            <br><br>
                            Αλλιώς, αν <strong>συνεχίσετε στην ενημέρωση</strong>, οι παραπάνω ημέρες θα ενημερωθούν σαν
                            <strong>"ΜΕ - ΜΗ ΕΡΓΑΣΙΑ"</strong>.
                        </p>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Συνέχεια',
                    cancelButtonText: 'Επιστροφή',
                    customClass: {
                        confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                        cancelButton: 'class-secondary custom-cancel-button custom-swal-button',
                        title: 'custom-title',
                        popup: 'custom-swal-popup'
                    }
                });

                if (!emptyDaysResult.isConfirmed) {
                    return;
                }

                emptyDayIndexes.forEach((day) => {
                    const hidden = document.getElementById(`kathgoria_ergasias_stathera_${day}`);
                    const select = document.getElementById(`kathgoria_ergasias_${day}`);

                    if (hidden) {
                        hidden.value = 'ΜΕ';
                        if (hidden.name) formData[hidden.name] = 'ΜΕ';
                    }

                    formData[`kathgoria_ergasias_${day}`] = 'ΜΕ';
                    formData[`kathgoria_ergasias_stathera_${day}`] = 'ΜΕ';
                    formData[`kathgoria_ergasias_sthathera_${day}`] = 'ΜΕ';

                    if (select?.tomselect) {
                        if (!select.tomselect.options['ΜΕ']) {
                            select.tomselect.addOption({
                                value: 'ΜΕ',
                                text: 'ΜΕ  -  ΜΗ ΕΡΓΑΣΙΑ'
                            });
                        }
                        select.tomselect.setValue('ΜΕ', true);
                    } else if (select) {
                        select.value = 'ΜΕ';
                    }
                });
            }

            console.log('✅ [PRE-VALIDATION] All days have categories');

            days.forEach((day) => {
                const category = (formData[`kathgoria_ergasias_${day}`] || '').trim().toUpperCase();
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
                // return;
            }

            console.log('✅ [PRE-VALIDATION] All schedule checks passed');

            // =========================================================================
            // ✅ ΕΡΓΑΝΗ FILES SELECTION
            // =========================================================================

            const apoxorhshVal = document.getElementById('hmeromhnia_apoxorhshs')?.value?.trim();
            const hasApoxorhsh =
                apoxorhshVal && apoxorhshVal !== '' && apoxorhshVal !== 'dd/mm/yyyy';

            let typosMetabolhsData = [];
            try {
                typosMetabolhsData = JSON.parse(
                    document.getElementById('typos_metabolhs_table')?.value || '[]'
                );
            } catch (e) {
                typosMetabolhsData = [];
            }
            const hasMetaboles = typosMetabolhsData.length > 0;

            // -------------------------------------------------------------------------
            // Radio group: Μεταβολές (εμφανίζεται μόνο αν hasMetaboles)
            // -------------------------------------------------------------------------
            const metabolesHtml = hasMetaboles
                ? `
        <hr class="hr-style" />
        <p class="font-weight-600 margin-bottom-0_5rem">Μεταβολές Εργασιακής Σχέσης:</p>

        <!-- ── Checkbox: Ψηφιακή Οργάνωση Χρόνου Εργασίας για Μεταβολές ── -->
        <div class="display-flex align-items-center gap-0_75rem">
            <input type="checkbox"
                id="wto_pshfiakh_organosh_xronoy_ergasias_metaboles"
                name="wto_pshfiakh_organosh_xronoy_ergasias_metaboles"
                value="wto"
                class="custom-checkbox" />
            <label for="wto_pshfiakh_organosh_xronoy_ergasias_metaboles"
                class="margin-0 cursor-pointer font-size-rem-1_05 font-weight-400">
                Ψηφιακή Οργάνωση Χρόνου Εργασίας
            </label>
        </div>

        <div class="display-flex align-items-center gap-0_75rem">
            <input type="radio" id="metaboles_none" name="metaboles_action"
                value="none" class="custom-radio" checked />
            <label for="metaboles_none" class="margin-0 cursor-pointer font-size-rem-1_05">
                Χωρίς Μεταβολή ΕΡΓΑΝΗ
            </label>
        </div>
        <div class="display-flex align-items-center gap-0_75rem">
            <input type="radio" id="e3_metaboles_ergasiakhs_sxeshs" name="metaboles_action"
                value="e3_metaboles_ergasiakhs_sxeshs" class="custom-radio" />
            <label for="e3_metaboles_ergasiakhs_sxeshs" class="margin-0 cursor-pointer font-size-rem-1_05">
                ΜΕΤΑΒΟΛΗ ΣΤΟΙΧΕΙΩΝ ΕΡΓΑΣΙΑΚΗΣ ΣΧΕΣΗΣ
            </label>
        </div>
        <div class="display-flex align-items-center gap-0_75rem">
            <input type="radio" id="e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy"
                name="metaboles_action"
                value="e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy"
                class="custom-radio" />
            <label for="e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy"
                class="margin-0 cursor-pointer font-size-rem-1_05">
                ΜΕΤΑΒΟΛΗ ΣΤΟΙΧΕΙΩΝ ΕΡΓΑΣΙΑΚΗΣ ΣΧΕΣΗΣ - Δανειζόμενου Προσωπικού
            </label>
        </div>
    `
                : '';

            // -------------------------------------------------------------------------
            // Radio group: Λήξεις (εμφανίζεται μόνο αν hasApoxorhsh)
            // -------------------------------------------------------------------------
            const lhxeisHtml = hasApoxorhsh
                ? `
                    <hr class="hr-style" />
                    <p class="font-weight-600 margin-bottom-0_5rem">Τύπος Λήξης Εργασίας:</p>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="lhxh_none" name="lhxh_type"
                            value="none" class="custom-radio" checked />
                        <label for="lhxh_none" class="margin-0 cursor-pointer font-size-rem-1_05">
                            Χωρίς Λήξη ΕΡΓΑΝΗ
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_222_lysh_symbashs_orismenoy_xronoy" name="lhxh_type"
                            value="ma_222" class="custom-radio" />
                        <label for="ma_222_lysh_symbashs_orismenoy_xronoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            Λύση Σύμβασης Ορισμένου Χρόνου (E7N)
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_227_lysh_dokimastikhs_periodoy" name="lhxh_type"
                            value="ma_227" class="custom-radio" />
                        <label for="ma_227_lysh_dokimastikhs_periodoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Αυτοδίκαιη Λύση Δοκιμαστικής Περιόδου
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_217_oikeiothelhs_apoxorhsh" name="lhxh_type"
                            value="ma_217" class="custom-radio" />
                        <label for="ma_217_oikeiothelhs_apoxorhsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Οικειοθελής Αποχώρηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_221_lysh_kataggelia_me_proeidopoihsh" name="lhxh_type"
                            value="ma_221" class="custom-radio" />
                        <label for="ma_221_lysh_kataggelia_me_proeidopoihsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Καταγγελία Σύμβασης με Προειδοποίηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_220_lysh_kataggelia_xoris_proeidopoihsh" name="lhxh_type"
                            value="ma_220" class="custom-radio" />
                        <label for="ma_220_lysh_kataggelia_xoris_proeidopoihsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Καταγγελία Σύμβασης Χωρίς Προειδοποίηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_218_lysh_dhloshs_oxlhshs" name="lhxh_type"
                            value="ma_218" class="custom-radio" />
                        <label for="ma_218_lysh_dhloshs_oxlhshs" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Δήλωση Όχλησης για δυνατότητα Οικειοθελούς Αποχώρησης
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh" name="lhxh_type"
                            value="ma_219" class="custom-radio" />
                        <label for="ma_219_oikeiothelhs_apoxorhsh_meta_apo_oxlhsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Οικειοθελής Αποχώρηση μετά από Όχληση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_223_lysh_ethelousia_exodos" name="lhxh_type"
                            value="ma_223" class="custom-radio" />
                        <label for="ma_223_lysh_ethelousia_exodos" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Εθελούσια Έξοδος
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_229_lhxh_daneismoy" name="lhxh_type"
                            value="ma_229" class="custom-radio" />
                        <label for="ma_229_lhxh_daneismoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Λήξη Δανεισμού από επιχείρηση/Τοποθέτησης από ΕΠΑ
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_226_lhxh_logo_thanatoy" name="lhxh_type"
                            value="ma_226" class="custom-radio" />
                        <label for="ma_226_lhxh_logo_thanatoy" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Λήξη λόγω Θανάτου
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_228_metavivash_se_epixeirish" name="lhxh_type"
                            value="ma_228" class="custom-radio" />
                        <label for="ma_228_metavivash_se_epixeirish" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Μεταβίβαση σε Επιχείρηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh" name="lhxh_type"
                            value="ma_224" class="custom-radio" />
                        <label for="ma_224_syntaxiodothsh_me_oikeiothelh_apoxorhsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Συνταξιοδότηση με Οικειοθελή Αποχώρηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh" name="lhxh_type"
                            value="ma_225" class="custom-radio" />
                        <label for="ma_225_syntaxiodothsh_me_kataggelia_xoris_proeidopoihsh" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Συνταξιοδότηση με Καταγγελία Σύμβασης Χωρίς Προειδοποίηση
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio" id="ma_236_oikeiothelhs_apoxorhsh_logo_15etias" name="lhxh_type"
                            value="ma_236" class="custom-radio" />
                        <label for="ma_236_oikeiothelhs_apoxorhsh_logo_15etias" class="margin-0 cursor-pointer font-size-rem-1_05">
                            ΛΗΞΗ ΕΡΓΑΣΙΑΣ - Οικειοθελής αποχώρηση μισθωτού λόγω συμπλήρωσης δεκαπενταετίας στον ίδιο εργοδότη ή υπέρβασης του ορίου ηλικίας συνταξιοδότησης με τη συγκατάθεση του εργοδότη
                        </label>
                    </div>
                `
                : '';

            // -------------------------------------------------------------------------
            // Radio group: κύρια ενέργεια ΕΡΓΑΝΗ για νέα πρόσληψη (χωρίς μεταβολές/λήξεις)
            // -------------------------------------------------------------------------
            const noErganiUpdates = !hasMetaboles && !hasApoxorhsh;

            const noUpdatesHtml = noErganiUpdates
                ? `
                    <hr class="hr-style" />
                    <p class="font-weight-600 margin-bottom-0_5rem">Ενέργεια ΕΡΓΑΝΗ:</p>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio"
                            id="ergani_action_none"
                            name="ergani_main_action"
                            value="none"
                            class="custom-radio"
                            checked />
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
                            class="custom-radio" />
                        <label for="e3_anaggelia_proslhpshs"
                            class="margin-0 cursor-pointer font-size-rem-1_05">
                            Αναγγελία Πρόσληψης (E3N)
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio"
                            id="wto_pshfiakh_organosh_xronoy_ergasias"
                            name="ergani_main_action"
                            value="wto"
                            class="custom-radio" />
                        <label for="wto_pshfiakh_organosh_xronoy_ergasias"
                            class="margin-0 cursor-pointer font-size-rem-1_05">
                            Ψηφιακή Οργάνωση Χρόνου Εργασίας (WTO)
                        </label>
                    </div>
                    <div class="display-flex align-items-center gap-0_75rem">
                        <input type="radio"
                            id="ergani_action_both"
                            name="ergani_main_action"
                            value="both"
                            class="custom-radio" />
                        <label for="ergani_action_both"
                            class="margin-0 cursor-pointer font-size-rem-1_05">
                            Αναγγελία Πρόσληψης (E3N) + WTO
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
                    <div class="display-flex flex-direction-column left-align gap-1rem padding-1rem swal-overflow">

                        <!-- ── Radio group: Τρόπος Αποθήκευσης ── -->
                        <p class="font-weight-600 margin-bottom-0_5rem">Τρόπος Αποθήκευσης:</p>
                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                id="storage_temporary"
                                name="storage_mode"
                                value="temporary"
                                class="custom-radio"
                                checked />
                            <label for="storage_temporary"
                                class="margin-0 cursor-pointer font-size-rem-1_05 font-weight-600 temp_perm"
                                style="color: #000000">
                                Προσωρινή Αποθήκευση (XML)
                            </label>
                        </div>
                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="radio"
                                id="storage_permanent"
                                name="storage_mode"
                                value="permanent"
                                class="custom-radio"
                                />
                            <label for="storage_permanent"
                                class="margin-0 cursor-pointer font-size-rem-1_05 font-weight-600 temp_perm"
                                style="color: #184d00">
                                <strong>Οριστική Ενημέρωση (REST API)</strong>
                            </label>
                        </div>

                        <!-- ── Checkbox: Δημιουργία Σύμβασης (ανεξάρτητη επιλογή) ── -->
                        <hr class="hr-style" />
                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="checkbox"
                                id="create_contract"
                                name="files"
                                value="create_contract"
                                class="custom-checkbox" />
                            <label for="create_contract"
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
                didOpen: () => {
                    // Προαιρετικό visual feedback κατά την αλλαγή storage mode
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
                    // ── storage mode ──
                    const storageModeRadio = document.querySelector(
                        'input[name="storage_mode"]:checked'
                    );
                    const isPermanent = storageModeRadio?.value === 'permanent';

                    // ── create contract ──
                    const createContract =
                        document.getElementById('create_contract')?.checked ?? false;

                    // ── κύρια ενέργεια ΕΡΓΑΝΗ (μόνο για νέα πρόσληψη) ──
                    const erganiMainActionRadio = document.querySelector(
                        'input[name="ergani_main_action"]:checked'
                    );
                    const erganiMainAction = erganiMainActionRadio?.value || 'none';

                    // ── WTO checkbox για Μεταβολές ──
                    const wtoMetabolesCheckbox = document.getElementById(
                        'wto_pshfiakh_organosh_xronoy_ergasias_metaboles'
                    );
                    const wtoMetabolesChecked = wtoMetabolesCheckbox?.checked === true;

                    const e3AnaggeliaProslhpshs =
                        erganiMainAction === 'e3_anaggelia_proslhpshs' ||
                        erganiMainAction === 'both';

                    const wtoPshfiakhOrganoshXronoy =
                        erganiMainAction === 'wto' ||
                        erganiMainAction === 'both' ||
                        wtoMetabolesChecked;

                    // ── μεταβολές ──
                    const metabolesActionRadio = document.querySelector(
                        'input[name="metaboles_action"]:checked'
                    );
                    const metabolesAction = metabolesActionRadio?.value || 'none';
                    const e3Enabled_1 = metabolesAction === 'e3_metaboles_ergasiakhs_sxeshs';
                    const e3Enabled_2 =
                        metabolesAction ===
                        'e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy';

                    // ── λήξεις ──
                    const lhxhTypeRadio = document.querySelector('input[name="lhxh_type"]:checked');
                    const lhxhType = lhxhTypeRadio?.value || 'none';

                    const erganiUploadMethod =
                        isPermanent &&
                        (lhxhType === 'ma_222' ||
                            lhxhType === 'ma_217' ||
                            lhxhType === 'ma_221' ||
                            lhxhType === 'ma_220' ||
                            e3AnaggeliaProslhpshs ||
                            wtoPshfiakhOrganoshXronoy ||
                            e3Enabled_1 ||
                            e3Enabled_2)
                            ? 'rest'
                            : 'xml';

                    const filesToUpdate = {
                        isPermanent,
                        erganiUploadMethod,
                        create_contract: createContract,
                        e3_anaggelia_proslhpshs: e3AnaggeliaProslhpshs,
                        wto_pshfiakh_organosh_xronoy_ergasias: wtoPshfiakhOrganoshXronoy,
                        e3_metaboles_ergasiakhs_sxeshs: e3Enabled_1,
                        e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy: e3Enabled_2,
                        ma_222: lhxhType === 'ma_222',
                        ma_227: lhxhType === 'ma_227',
                        ma_217: lhxhType === 'ma_217',
                        ma_221: lhxhType === 'ma_221',
                        ma_220: lhxhType === 'ma_220',
                        ma_218: lhxhType === 'ma_218',
                        ma_219: lhxhType === 'ma_219',
                        ma_223: lhxhType === 'ma_223',
                        ma_229: lhxhType === 'ma_229',
                        ma_226: lhxhType === 'ma_226',
                        ma_228: lhxhType === 'ma_228',
                        ma_224: lhxhType === 'ma_224',
                        ma_225: lhxhType === 'ma_225',
                        ma_236: lhxhType === 'ma_236'
                    };

                    console.log('🔍 [FRONTEND] Radio selections:', filesToUpdate);
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

            // -------------------------------------------------------------------------
            // ✅ SAFETY NET για E6N: σε ορισμένες ροές ο /api/ergazomenoi/update
            //    μπορεί να επιστρέψει redirect ή non-json OK πριν προλάβει να τρέξει
            //    η κανονική μεταγενέστερη υποβολή.  Για τα WebE6NMP/WebE6NXP
            //    κρατάμε την οθόνη και εκτελούμε την υποβολή πριν γίνει redirect.
            // -------------------------------------------------------------------------
            const selectedE6NProcessCode =
                result.value?.ma_221 === true ? '221' : result.value?.ma_220 === true ? '220' : '';

            const selectedE6NLabel =
                selectedE6NProcessCode === '221'
                    ? 'E6NMP / Καταγγελία με Προειδοποίηση'
                    : selectedE6NProcessCode === '220'
                      ? 'E6NXP / Καταγγελία Χωρίς Προειδοποίηση'
                      : 'E6N';

            const selectedE6NUploadMethod =
                result.value?.erganiUploadMethod === 'rest' && result.value?.isPermanent === true
                    ? 'rest'
                    : 'xml';

            const shouldRunE6NBeforeRedirect = Boolean(selectedE6NProcessCode);

            const runE6NBeforeRedirectIfNeeded = async (reason = '') => {
                if (!shouldRunE6NBeforeRedirect) {
                    return { success: true, skipped: true };
                }

                const progressTitle =
                    selectedE6NUploadMethod === 'rest'
                        ? `Οριστική υποβολή ${selectedE6NLabel} μέσω REST API`
                        : `Προσωρινή υποβολή ${selectedE6NLabel} XML`;

                console.warn('[E6N-SAFETY-NET] Running E6N before redirect/non-json response:', {
                    reason,
                    ergazomenoiId,
                    selectedE6NProcessCode,
                    selectedE6NUploadMethod
                });

                try {
                    showGenericRestProgressSwal(progressTitle);

                    const e6nResult = await submitE6NRestToErganh(
                        ergazomenoiId,
                        selectedE6NProcessCode,
                        selectedE6NUploadMethod
                    );

                    Swal.close();

                    if (selectedE6NUploadMethod === 'rest') {
                        await showE6NRestResultSwal(e6nResult);
                    } else {
                        await showE6NXmlResultSwal(e6nResult);
                    }

                    return { success: true, ...e6nResult };
                } catch (error) {
                    Swal.close();

                    const failedResult = {
                        success: false,
                        submissionCode: selectedE6NProcessCode === '221' ? 'WebE6NMP' : 'WebE6NXP',
                        uploadMethod: selectedE6NUploadMethod,
                        message: error?.message || String(error),
                        error: error?.message || String(error),
                        userMessage: error?.message || String(error)
                    };

                    console.error('[E6N-SAFETY-NET] E6N upload failed:', failedResult);

                    if (selectedE6NUploadMethod === 'rest') {
                        await showE6NRestResultSwal(failedResult);
                    } else {
                        await showE6NXmlResultSwal(failedResult);
                    }

                    return failedResult;
                }
            };

            console.group('[CONTRACT-DEBUG] BEFORE FETCH');
            console.log('ergazomenoiId:', ergazomenoiId);
            console.log('createContract:', createContract);
            console.log('filesToUpdate:', result.value);
            console.log('employee:', {
                eponymo: formData.eponymoHidden,
                onoma: formData.onomaHidden,
                afm: formData.afm_ergazomenoyHidden,
                amka: formData.amka_ergazomenoyHidden
            });
            console.log('current user context:', {
                pathname: window.location.pathname,
                origin: window.location.origin
            });
            console.log('request payload v:', v);
            console.groupEnd();

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

                setTimeout(updateProgress, 250);
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

            console.group('[CONTRACT-DEBUG] FETCH RESPONSE');
            console.log('response.status:', response.status);
            console.log('response.ok:', response.ok);
            console.log('response.redirected:', response.redirected);
            console.log('response.url:', response.url);
            console.log('content-type:', response.headers.get('content-type'));
            console.log('location header:', response.headers.get('Location'));
            console.groupEnd();

            // ============================================================================
            // ✅ SMOOTH PROGRESS COMPLETION
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
                console.warn('[CONTRACT-DEBUG] Browser auto-followed redirect:', response.url);

                const e6nRedirectResult = await runE6NBeforeRedirectIfNeeded(
                    'browser-auto-followed-redirect'
                );
                if (shouldRunE6NBeforeRedirect && e6nRedirectResult?.success === false) {
                    console.warn('[REDIRECT] Skipped because E6N upload failed before redirect.');
                    return;
                }

                window.location.href = response.url;
                return;
            }

            // 2) 3xx without auto-follow
            if (response.status >= 300 && response.status < 400) {
                const loc = response.headers.get('Location') || response.headers.get('location');
                console.warn('[CONTRACT-DEBUG] Manual redirect branch:', {
                    status: response.status,
                    location: loc
                });
                if (loc) {
                    const e6nManualRedirectResult = await runE6NBeforeRedirectIfNeeded(
                        'manual-redirect-response'
                    );
                    if (shouldRunE6NBeforeRedirect && e6nManualRedirectResult?.success === false) {
                        console.warn(
                            '[REDIRECT] Skipped because E6N upload failed before manual redirect.'
                        );
                        return;
                    }

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
                console.error('[CONTRACT-DEBUG] 403 Forbidden / CSRF blocked');
                throw new Error('CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.');
            }

            // 4) 204 No Content
            if (response.status === 204) {
                console.warn('[CONTRACT-DEBUG] 204 No Content branch hit');
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

                console.group('[CONTRACT-DEBUG] RESPONSE JSON');
                console.log('success:', data?.success);
                console.log('message:', data?.errorMessage || null);
                console.log('redirectUrl:', data?.redirectUrl || null);
                console.log('employeeId from backend:', data?.data?._id || null);
                console.log('contractPdf exists:', !!data?.contractPdf);
                console.log('contractPdf:', data?.contractPdf || null);
                console.log('contractPdf.showPreview:', data?.contractPdf?.showPreview);
                console.log('contractPdf.url:', data?.contractPdf?.url || null);
                console.log('contractPdf.s3Key:', data?.contractPdf?.s3Key || null);
                console.log('pdfResults:', data?.pdfResults || []);
                console.log('e3XmlData:', data?.e3XmlData || null);
                console.log('maXmlData:', data?.maXmlData || null);
                console.log('wtoXmlData:', data?.wtoXmlData || null);
                console.groupEnd();

                if (!response.ok || !data?.success) {
                    console.error('[CONTRACT-DEBUG] JSON response indicates failure', {
                        responseOk: response.ok,
                        success: data?.success,
                        status: response.status,
                        message
                    });
                    throw new Error(`HTTP ${response.status} / success=${data?.success}`);
                }

                // =====================================================================
                // ✅ DECLARE XML DATA (ONCE - AT THE TOP)
                // =====================================================================
                const e3XmlData = data?.e3XmlData || null;
                const hasE3Xml = e3XmlData && e3XmlData.success === true;

                const wtoXmlData = data?.wtoXmlData || null;
                const hasWtoXml = wtoXmlData && wtoXmlData.success === true;

                const maXmlData = data?.maXmlData || null;
                const hasMAXml = maXmlData && maXmlData.success === true;

                const userWantsE3 = result.value?.e3_anaggelia_proslhpshs === true;

                const userWantsMAChange =
                    result.value?.e3_metaboles_ergasiakhs_sxeshs === true ||
                    result.value?.e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy === true;

                const userWantsWto = result.value?.wto_pshfiakh_organosh_xronoy_ergasias === true;

                const isE3NRestSubmit =
                    userWantsE3 === true &&
                    result.value?.isPermanent === true &&
                    result.value?.erganiUploadMethod === 'rest';

                const isE7NRestSubmit =
                    result.value?.ma_222 === true &&
                    result.value?.isPermanent === true &&
                    result.value?.erganiUploadMethod === 'rest';

                const isE5NRestSubmit =
                    result.value?.ma_217 === true &&
                    result.value?.isPermanent === true &&
                    result.value?.erganiUploadMethod === 'rest';

                const isE6NMPRestSubmit =
                    result.value?.ma_221 === true &&
                    result.value?.isPermanent === true &&
                    result.value?.erganiUploadMethod === 'rest';

                const isE6NXPRestSubmit =
                    result.value?.ma_220 === true &&
                    result.value?.isPermanent === true &&
                    result.value?.erganiUploadMethod === 'rest';

                const isE6NRestSubmit = isE6NMPRestSubmit || isE6NXPRestSubmit;

                const isE6NXmlSubmit =
                    (result.value?.ma_221 === true || result.value?.ma_220 === true) &&
                    result.value?.erganiUploadMethod === 'xml';

                const isMARestSubmit =
                    userWantsMAChange === true &&
                    result.value?.isPermanent === true &&
                    result.value?.erganiUploadMethod === 'rest';

                const isWTOWeekRestSubmit =
                    userWantsWto === true && result.value?.isPermanent === true;

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

                const e3RestPendingHtml =
                    userWantsE3 && isE3NRestSubmit
                        ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί οριστική υποβολή E3N μέσω REST API. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                        : '';

                const e7RestPendingHtml = isE7NRestSubmit
                    ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί οριστική υποβολή E7N μέσω REST API. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                    : '';

                const e5RestPendingHtml = isE5NRestSubmit
                    ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί οριστική υποβολή E5N / Οικειοθελούς Αποχώρησης μέσω REST API. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                    : '';

                const e6nRestPendingHtml = isE6NRestSubmit
                    ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί οριστική υποβολή ${isE6NMPRestSubmit ? 'E6NMP / Καταγγελία με Προειδοποίηση' : 'E6NXP / Καταγγελία Χωρίς Προειδοποίηση'} μέσω REST API. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                    : '';

                const e6nXmlPendingHtml = isE6NXmlSubmit
                    ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί προσωρινή υποβολή ${result.value?.ma_221 === true ? 'E6NMP / Καταγγελία με Προειδοποίηση' : 'E6NXP / Καταγγελία Χωρίς Προειδοποίηση'} μέσω XML. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                    : '';

                const maRestPendingHtml = isMARestSubmit
                    ? `<p class="text-success-light mt-3">✅ Έχει επιλεγεί οριστική υποβολή MA μέσω REST API. Η υποβολή θα εκτελεστεί αμέσως μετά την αποθήκευση.</p>`
                    : '';

                const wtoXmlHtml =
                    hasWtoXml && !isWTOWeekRestSubmit
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

                // const maXmlHtml = hasMAXml
                //     ? `<p class="text-success mt-3">✅ MA XML (Μεταβολή) δημιουργήθηκε επιτυχώς!</p>
                //     <a href="${maXmlData.downloadUrl}"
                //         download="${maXmlData.filename}"
                //         class="btn btn-sm btn-outline-warning mt-2">
                //         <i class="bi bi-download"></i> Λήψη MA XML
                //     </a>`
                //     : '';

                const hadPdfs = window.pdfUploadModule && window.pdfUploadModule.hasPendingUpload();

                const pdfResults = data?.pdfResults || [];
                const successfulPdfs = pdfResults.filter((r) => r.success);
                const failedPdfs = pdfResults.filter((r) => !r.success);

                console.group('[CONTRACT-DEBUG] MODAL DECISION INPUTS');
                console.log('failedPdfs.length:', failedPdfs.length);
                console.log('successfulPdfs.length:', successfulPdfs.length);
                console.log('createContract:', createContract);
                console.log('has contractPdf:', !!data.contractPdf);
                console.log('showPreview:', data?.contractPdf?.showPreview);
                console.log('has url:', !!data?.contractPdf?.url);
                console.log('has s3Key:', !!data?.contractPdf?.s3Key);
                console.log('hadPdfs:', hadPdfs);
                console.groupEnd();

                if (hadPdfs && window.pdfUploadModule.clearAllFiles) {
                    window.pdfUploadModule.clearAllFiles();
                }

                const employeeName =
                    `${formData.eponymoHidden || ''} ${formData.onomaHidden || ''}`.trim() ||
                    'UNKNOWN';

                const companyData = {
                    email: data.companyEmail || null,
                    phone: data.companyPhone || null,
                    name: data.companyName || null,
                    type: data.companyType || 'ΕΠΙΧΕΙΡΗΣΗ'
                };

                // ✅ Helper: store __erganhUploadOptions
                const storeErganhUploadOptions = () => {
                    window.__erganhUploadOptions = {
                        isPermanent: result.value?.isPermanent === true,

                        e3_anaggelia_proslhpshs: result.value?.e3_anaggelia_proslhpshs === true,
                        wto_pshfiakh_organosh_xronoy_ergasias:
                            result.value?.wto_pshfiakh_organosh_xronoy_ergasias === true,

                        e3Enabled_1: result.value?.e3_metaboles_ergasiakhs_sxeshs === true,
                        e3Enabled_2:
                            result.value?.e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy ===
                            true,

                        wtoEnabled_222: result.value?.ma_222 === true,
                        wtoEnabled_227: result.value?.ma_227 === true,
                        wtoEnabled_217: result.value?.ma_217 === true,
                        wtoEnabled_221: result.value?.ma_221 === true,
                        wtoEnabled_220: result.value?.ma_220 === true,
                        wtoEnabled_218: result.value?.ma_218 === true,
                        wtoEnabled_219: result.value?.ma_219 === true,
                        wtoEnabled_223: result.value?.ma_223 === true,
                        wtoEnabled_229: result.value?.ma_229 === true,
                        wtoEnabled_226: result.value?.ma_226 === true,
                        wtoEnabled_228: result.value?.ma_228 === true,
                        wtoEnabled_224: result.value?.ma_224 === true,
                        wtoEnabled_225: result.value?.ma_225 === true,
                        wtoEnabled_236: result.value?.ma_236 === true
                    };
                    console.log('[MAIN] Stored upload options:', window.__erganhUploadOptions);
                };

                // ✅ Helper: E3 + WTO uploads
                const runXmlUploads = async () => {
                    let e3Result = { success: true };
                    let maResult = { success: true };
                    let wtoResult = { success: true };

                    if (userWantsE3 && data.data?._id) {
                        if (isE3NRestSubmit) {
                            try {
                                console.log('[E3-REST-UPLOAD] Submitting E3N via REST JSON...');

                                e3Result = await submitE3NRestToErganh(data.data._id);
                                if (e3Result?.cancelled) {
                                    return { e3Result, maResult, wtoResult };
                                }

                                Swal.close();

                                console.log('[E3-REST-UPLOAD] Result:', e3Result);

                                await showE3NRestResultSwal(e3Result);
                            } catch (e) {
                                Swal.close();

                                console.error('[E3-REST-UPLOAD] ❌ Exception:', e?.message || e);

                                e3Result = {
                                    success: false,
                                    error: e?.message || String(e)
                                };

                                await showE3NRestResultSwal(e3Result);
                            }
                        } else if (
                            e3XmlData?.success &&
                            (e3XmlData?.s3Url ||
                                e3XmlData?.downloadUrl ||
                                e3XmlData?.relativePath ||
                                e3XmlData?.s3Key)
                        ) {
                            const e3UrlToSend =
                                e3XmlData?.s3Url ||
                                e3XmlData?.downloadUrl ||
                                e3XmlData?.relativePath ||
                                e3XmlData?.s3Key ||
                                null;

                            if (e3UrlToSend && typeof e3UrlToSend === 'string') {
                                try {
                                    console.log('[E3-UPLOAD] Uploading E3 XML...');
                                    e3Result = await uploadToErganh(
                                        data.data._id,
                                        e3UrlToSend,
                                        false
                                    );
                                    console.log('[E3-UPLOAD] Result:', e3Result);
                                } catch (e) {
                                    console.error('[E3-UPLOAD] ❌ Exception:', e?.message || e);
                                    e3Result = { success: false, error: e?.message };
                                }
                            }
                        }
                    }

                    const userWantsMA =
                        result.value?.e3_metaboles_ergasiakhs_sxeshs === true ||
                        result.value?.e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy ===
                            true ||
                        result.value?.ma_217 === true ||
                        result.value?.ma_222 === true ||
                        result.value?.ma_221 === true ||
                        result.value?.ma_220 === true;

                    if (
                        userWantsMA &&
                        data.data?._id &&
                        (isE7NRestSubmit ||
                            isE5NRestSubmit ||
                            isE6NRestSubmit ||
                            isE6NXmlSubmit ||
                            isMARestSubmit ||
                            (maXmlData?.success &&
                                (maXmlData?.s3Url ||
                                    maXmlData?.downloadUrl ||
                                    maXmlData?.relativePath ||
                                    maXmlData?.s3Key)))
                    ) {
                        const maUrlToSend = isE7NRestSubmit
                            ? 'REST_E7N_NO_XML_REQUIRED'
                            : isE5NRestSubmit
                              ? 'REST_E5N_NO_XML_REQUIRED'
                              : isE6NRestSubmit
                                ? 'REST_E6N_NO_XML_REQUIRED'
                                : isE6NXmlSubmit
                                  ? 'XML_E6N_DIRECT_SUBMIT'
                                  : isMARestSubmit
                                    ? 'REST_MA_NO_XML_REQUIRED'
                                    : maXmlData?.s3Url ||
                                      maXmlData?.downloadUrl ||
                                      maXmlData?.relativePath ||
                                      maXmlData?.s3Key ||
                                      null;
                        if (maUrlToSend) {
                            try {
                                if (isE7NRestSubmit) {
                                    console.log(
                                        '[E7N-REST-UPLOAD] Submitting E7N via REST JSON...'
                                    );
                                    showE7NRestProgressSwal();
                                } else if (isE5NRestSubmit) {
                                    console.log(
                                        '[E5N-REST-UPLOAD] Submitting E5N via REST JSON...'
                                    );
                                    showGenericRestProgressSwal(
                                        'Οριστική υποβολή E5N μέσω REST API'
                                    );
                                } else if (isE6NRestSubmit) {
                                    console.log(
                                        '[E6N-REST-UPLOAD] Submitting E6N via REST JSON...'
                                    );
                                    showGenericRestProgressSwal(
                                        isE6NMPRestSubmit
                                            ? 'Οριστική υποβολή E6NMP μέσω REST API'
                                            : 'Οριστική υποβολή E6NXP μέσω REST API'
                                    );
                                } else if (isE6NXmlSubmit) {
                                    console.log('[E6N-XML-UPLOAD] Submitting E6N XML...');
                                    showGenericRestProgressSwal(
                                        result.value?.ma_221 === true
                                            ? 'Προσωρινή υποβολή E6NMP XML'
                                            : 'Προσωρινή υποβολή E6NXP XML'
                                    );
                                } else if (isMARestSubmit) {
                                    console.log('[MA-REST-UPLOAD] Submitting MA via REST JSON...');
                                    showGenericRestProgressSwal(
                                        'Οριστική υποβολή MA μέσω REST API'
                                    );
                                } else {
                                    console.log('[MA-UPLOAD] Uploading MA XML...');
                                }

                                maResult = await uploadMaToErganh(
                                    data.data._id,
                                    maUrlToSend,
                                    result.value?.isPermanent === true,
                                    maXmlData?.processCode ||
                                        (result.value?.ma_222 === true
                                            ? '222'
                                            : result.value?.ma_217 === true
                                              ? '217'
                                              : result.value?.ma_221 === true
                                                ? '221'
                                                : result.value?.ma_220 === true
                                                  ? '220'
                                                  : undefined),
                                    result.value?.erganiUploadMethod || 'xml'
                                );

                                if (isE7NRestSubmit) {
                                    Swal.close();
                                    console.log('[E7N-REST-UPLOAD] Result:', maResult);
                                    await showE7NRestResultSwal(maResult);
                                } else if (isE5NRestSubmit) {
                                    Swal.close();
                                    console.log('[E5N-REST-UPLOAD] Result:', maResult);
                                    await showE5NRestResultSwal(maResult);
                                } else if (isE6NRestSubmit) {
                                    Swal.close();
                                    console.log('[E6N-REST-UPLOAD] Result:', maResult);
                                    await showE6NRestResultSwal(maResult);
                                } else if (isE6NXmlSubmit) {
                                    Swal.close();
                                    console.log('[E6N-XML-UPLOAD] Result:', maResult);
                                    await showE6NXmlResultSwal(maResult);
                                } else if (isMARestSubmit) {
                                    Swal.close();
                                    console.log('[MA-REST-UPLOAD] Result:', maResult);
                                    await showMARestResultSwal(maResult);
                                } else {
                                    console.log('[MA-UPLOAD] Result:', maResult);
                                }
                            } catch (e) {
                                if (
                                    isE7NRestSubmit ||
                                    isE5NRestSubmit ||
                                    isE6NRestSubmit ||
                                    isE6NXmlSubmit ||
                                    isMARestSubmit
                                ) {
                                    Swal.close();
                                }

                                console.error('[MA-UPLOAD] ❌ Exception:', e?.message || e);

                                maResult = {
                                    success: false,
                                    error: e?.message || String(e)
                                };

                                if (isE7NRestSubmit) {
                                    await showE7NRestResultSwal(maResult);
                                } else if (isE6NRestSubmit) {
                                    await showE6NRestResultSwal(maResult);
                                } else if (isE6NXmlSubmit) {
                                    await showE6NXmlResultSwal(maResult);
                                } else if (isMARestSubmit) {
                                    await showMARestResultSwal(maResult);
                                }
                            }
                        }
                    }

                    if (userWantsWto && data.data?._id) {
                        if (isWTOWeekRestSubmit) {
                            try {
                                console.log(
                                    '[WTO-REST-UPLOAD] Submitting WTOWeek via REST JSON...'
                                );
                                wtoResult = await uploadWtoToErganh(
                                    data.data._id,
                                    'REST_WTOWEEK_NO_XML_REQUIRED'
                                );
                                console.log('[WTO-REST-UPLOAD] Result:', wtoResult);
                            } catch (e) {
                                console.error('[WTO-REST-UPLOAD] ❌ Exception:', e?.message || e);
                                wtoResult = { success: false, error: e?.message || String(e) };
                            }
                        } else if (result.value?.isPermanent === true) {
                            if (
                                wtoXmlData?.success &&
                                (wtoXmlData?.s3Url ||
                                    wtoXmlData?.downloadUrl ||
                                    wtoXmlData?.relativePath)
                            ) {
                                const wtoUrlToSend =
                                    wtoXmlData?.s3Url ||
                                    wtoXmlData?.downloadUrl ||
                                    wtoXmlData?.relativePath ||
                                    null;

                                if (wtoUrlToSend && typeof wtoUrlToSend === 'string') {
                                    try {
                                        console.log('[WTO-UPLOAD] Uploading WTO XML (Οριστική)...');
                                        wtoResult = await uploadWtoToErganh(
                                            data.data._id,
                                            wtoUrlToSend
                                        );
                                        console.log('[WTO-UPLOAD] Result:', wtoResult);
                                    } catch (e) {
                                        console.error(
                                            '[WTO-UPLOAD] ❌ Exception:',
                                            e?.message || e
                                        );
                                        wtoResult = { success: false, error: e?.message };
                                    }
                                }
                            }
                        } else {
                            try {
                                console.log('[WTO-UPLOAD] Uploading WTO Temporary (Προσωρινή)...');
                                wtoResult = await uploadWtoTemporary(data.data._id, null);
                                console.log('[WTO-UPLOAD] Result:', wtoResult);
                            } catch (e) {
                                console.error('[WTO-UPLOAD] ❌ Exception:', e?.message || e);
                                wtoResult = { success: false, error: e?.message };
                            }
                        }
                    }

                    if (!e3Result.success || !maResult.success || !wtoResult.success) {
                        console.warn('[ERGANH] Some uploads failed:', {
                            e3: e3Result.success,
                            ma: maResult.success,
                            wto: wtoResult.success
                        });
                    }

                    return { e3Result, maResult, wtoResult };
                };

                // =====================================================================
                // ✅ SUCCESS/WARNING MESSAGES
                // =====================================================================
                if (failedPdfs.length === 0) {
                    // =====================================================================
                    // ✅ COMMON SUCCESS SWAL (εμφανίζεται σε CASE A, B, C)
                    // =====================================================================
                    const showSuccessSwal = async () => {
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
                ${e7RestPendingHtml}
                ${e5RestPendingHtml}
                ${e6nRestPendingHtml}
                ${e6nXmlPendingHtml}
                ${wtoRestPendingHtml}
                ${wtoXmlHtml}
                `,
                            // ${maXmlHtml}
                            timer:
                                hasE3Xml ||
                                hasWtoXml ||
                                hasMAXml ||
                                isE6NRestSubmit ||
                                isE6NXmlSubmit
                                    ? null
                                    : 1500,
                            showConfirmButton:
                                hasE3Xml ||
                                hasWtoXml ||
                                hasMAXml ||
                                isE6NRestSubmit ||
                                isE6NXmlSubmit,
                            confirmButtonText: 'OK',
                            customClass: {
                                confirmButton:
                                    'class-success custom-confirm-button custom-swal-button',
                                title: 'custom-title',
                                popup: 'custom-swal-popup'
                            }
                        });
                    };

                    // =====================================================================
                    // ✅ CASE A: showPreview = true → swal + modal
                    // =====================================================================
                    if (data.contractPdf && data.contractPdf.showPreview && data.contractPdf.url) {
                        console.log('[CONTRACT-DEBUG] ENTER CASE A: showPreview=true + url');

                        if (!data.contractPdf.s3Key) {
                            console.error('❌ [FRONTEND] Missing s3Key in backend response!');

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

                        await showSuccessSwal();

                        console.log('📄 Opening PDF modal (showPreview=true)...');
                        storeErganhUploadOptions();

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

                        // =====================================================================
                        // ✅ CASE B: createContract=true αλλά showPreview=false → swal + modal
                        // =====================================================================
                    } else if (createContract && data.contractPdf?.url) {
                        console.log(
                            '[CONTRACT-DEBUG] ENTER CASE B: createContract=true + contractPdf.url'
                        );

                        if (!data.contractPdf.s3Key) {
                            console.warn('⚠️ [FRONTEND] Missing s3Key — skipping modal');
                            await showSuccessSwal();

                            const uploadResults = await runXmlUploads();

                            if (
                                uploadResults?.e3Result?.success === false ||
                                uploadResults?.maResult?.success === false ||
                                uploadResults?.wtoResult?.success === false
                            ) {
                                console.warn(
                                    '[REDIRECT] Skipped because ERGANI REST upload failed.'
                                );
                                return;
                            }

                            window.location.href = data.redirectUrl || '/ergazomenoi/ergazomenoi';
                        } else {
                            await showSuccessSwal();

                            console.log(
                                '📄 Opening PDF modal (createContract=true, showPreview=false)...'
                            );
                            storeErganhUploadOptions();

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
                        }
                        return;

                        // =====================================================================
                        // ✅ CASE C: NO PDF → swal + redirect
                        // =====================================================================
                    } else {
                        console.warn('[CONTRACT-DEBUG] ENTER CASE C: NO MODAL PATH', {
                            createContract,
                            contractPdf: data?.contractPdf || null
                        });

                        await showSuccessSwal();

                        const uploadResults = await runXmlUploads();

                        if (
                            uploadResults?.e3Result?.success === false ||
                            uploadResults?.maResult?.success === false ||
                            uploadResults?.wtoResult?.success === false
                        ) {
                            console.warn('[REDIRECT] Skipped because ERGANI REST upload failed.');
                            return;
                        }

                        console.log(
                            '[REDIRECT] Redirecting to:',
                            data.redirectUrl || '/ergazomenoi/ergazomenoi'
                        );
                        window.location.href = data.redirectUrl || '/ergazomenoi/ergazomenoi';
                    }
                }
                return;
            }

            // 6) Other content-type but OK
            if (response.ok) {
                console.warn('[CONTRACT-DEBUG] Non-JSON but OK response branch hit');

                const e6nNonJsonResult = await runE6NBeforeRedirectIfNeeded('non-json-ok-response');
                if (shouldRunE6NBeforeRedirect && e6nNonJsonResult?.success === false) {
                    console.warn(
                        '[REDIRECT] Skipped because E6N upload failed after non-json OK response.'
                    );
                    return;
                }

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
            console.error('[CONTRACT-DEBUG] HTTP error branch hit', response.status);
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

    // ============================================================================
    // ✅ E3N REST JSON PROGRESS / RESULT SWALS
    // ============================================================================
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

    async function showE3NRestResultSwal(e3Result) {
        await showGenericRestResultSwal({
            result: e3Result,
            titleSuccess: 'Επιτυχής Οριστική Υποβολή E3N',
            titleError: 'Αποτυχία Οριστικής Υποβολής E3N',
            successText: 'Η πρόσληψη υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.',
            errorText: 'Η πρόσληψη δεν υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.'
        });
    }

    // ============================================================================
    // ✅ E7N REST JSON PROGRESS / RESULT SWALS
    // ============================================================================
    function showE7NRestProgressSwal() {
        Swal.fire({
            title: 'Οριστική Υποβολή E7N',
            html: `
                <div class="pdf-generation-progress">
                    <div class="progress-spinner">
                        <div class="spinner-border text-success" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div class="progress-step-text" id="e7n-rest-progress-step-text">
                        Σύνδεση με ΕΡΓΑΝΗ...
                    </div>
                    <div class="progress-bar-container">
                        <div class="custom-progress">
                            <div class="custom-progress-bar progress-bar-striped progress-bar-animated"
                                id="e7n-rest-progress-bar"
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
                            <li>Έλεγχο WebE7N στο trial/production περιβάλλον</li>
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
            didOpen: () =>
                animateRestProgress('e7n-rest-progress-bar', 'e7n-rest-progress-step-text')
        });
    }

    async function showE7NRestResultSwal(e7Result) {
        await showGenericRestResultSwal({
            result: e7Result,
            titleSuccess: 'Επιτυχής Οριστική Υποβολή E7N',
            titleError: 'Αποτυχία Οριστικής Υποβολής E7N',
            successText: 'Η λήξη σύμβασης υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.',
            errorText: 'Η λήξη σύμβασης δεν υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.'
        });
    }

    function animateRestProgress(progressBarId, progressTextId) {
        const steps = [
            { percent: 25, text: 'Προετοιμασία JSON payload...', duration: 800 },
            { percent: 45, text: 'Αυθεντικοποίηση στο ΕΡΓΑΝΗ...', duration: 1200 },
            { percent: 65, text: 'Υποβολή REST JSON...', duration: 1800 },
            { percent: 85, text: 'Αναμονή απάντησης από ΕΡΓΑΝΗ...', duration: 2000 },
            { percent: 95, text: 'Ολοκλήρωση ελέγχου αποτελέσματος...', duration: 1200 }
        ];

        let currentStepIndex = 0;

        function updateProgress() {
            if (currentStepIndex >= steps.length) return;

            const step = steps[currentStepIndex];
            const progressBar = document.getElementById(progressBarId);
            const progressText = document.getElementById(progressTextId);

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

    function escapeHtmlForSwal(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatErganiErrorForSwal(value) {
        return escapeHtmlForSwal(value || 'Άγνωστο σφάλμα')
            .replace(/\\n/g, '<br>')
            .replace(/\n/g, '<br>');
    }

    async function showGenericRestResultSwal({
        result,
        titleSuccess,
        titleError,
        successText,
        errorText
    }) {
        const success = result?.success === true;

        if (success) {
            const protocol = result?.protocol || null;
            const submitDate = result?.submitDate || null;
            const pdfUrl = result?.pdfUrl || null;
            const pdfFilename = result?.pdfFilename || null;
            const erganhLogId = result?.erganhLogId || null;

            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'success',
                title: titleSuccess,
                html: `
                    <div class="left-align">
                        <p>${successText}</p>
                        ${
                            protocol
                                ? `<p><strong>Πρωτόκολλο:</strong> <span class="text-success">${protocol}</span></p>`
                                : `<p class="text-warning">⚠️ Δεν επιστράφηκε πρωτόκολλο στην απάντηση.</p>`
                        }
                        ${
                            submitDate
                                ? `<p><strong>Ημερομηνία υποβολής:</strong> ${submitDate}</p>`
                                : ''
                        }
                        ${
                            erganhLogId
                                ? `<p class="text-muted font-size-rem-0_9">Log ID: ${erganhLogId}</p>`
                                : ''
                        }
                    </div>
                `,
                // ${
                //     pdfUrl
                //         ? `<a href="${pdfUrl}" target="_blank"
                //             class="btn mt-3 px-4 py-3 font-weight-700"
                //             style="background-color: #0d6efd; color: #ffffff; border-radius: 0.65rem; min-height: 52px; display: inline-flex; align-items: center; gap: 0.5rem;">
                //             <i class="bi bi-file-earmark-pdf"></i>
                //             Άνοιγμα PDF ${pdfFilename ? `(${pdfFilename})` : ''}
                //         </a>`
                //         : `<p class="text-muted mt-3">Δεν υπάρχει διαθέσιμο PDF για άνοιγμα.</p>`
                // }

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
                <div class="left-align">
                    <p>${errorText}</p>
                    <p class="text-danger"><strong>Σφάλμα:</strong></p>
                    <div style="text-align:left; max-height:260px; overflow:auto; line-height:1.55;">
                        ${formatErganiErrorForSwal(result?.error || result?.message)}
                    </div>
                </div>
            `,
            confirmButtonText: 'Κλείσιμο',
            customClass: {
                confirmButton: 'class-error custom-confirm-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup',
                htmlContainer: 'custom-html-container'
            }
        });
    }

    function showGenericRestProgressSwal(title = 'Οριστική υποβολή μέσω REST API') {
        const safeTitle = title || 'Οριστική υποβολή μέσω REST API';
        const isMA = String(safeTitle).toUpperCase().includes('MA');
        const progressBarId = isMA ? 'ma-rest-progress-bar' : 'generic-rest-progress-bar';
        const progressTextId = isMA
            ? 'ma-rest-progress-step-text'
            : 'generic-rest-progress-step-text';

        Swal.fire({
            title: safeTitle,
            html: `
                <div class="pdf-generation-progress">
                    <div class="progress-spinner">
                        <div class="spinner-border text-success" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div class="progress-step-text" id="${progressTextId}">
                        Σύνδεση με ΕΡΓΑΝΗ...
                    </div>
                    <div class="progress-bar-container">
                        <div class="custom-progress">
                            <div class="custom-progress-bar progress-bar-striped progress-bar-animated"
                                id="${progressBarId}"
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
                            <li>Έλεγχο WebMA στο trial/production περιβάλλον</li>
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
                title: 'custom-title',
                htmlContainer: 'custom-html-container'
            },
            didOpen: () => animateRestProgress(progressBarId, progressTextId)
        });
    }

    async function showMARestResultSwal(result) {
        return showGenericRestResultSwal({
            result,
            titleSuccess: 'MA REST - Επιτυχής Υποβολή',
            titleError: 'MA REST - Αποτυχία Υποβολής',
            successText:
                'Η Μεταβολή Στοιχείων Εργασιακής Σχέσης υποβλήθηκε οριστικά μέσω REST API.',
            errorText: 'Η οριστική υποβολή MA μέσω REST API απέτυχε.'
        });
    }

    async function showE5NRestResultSwal(result) {
        return showGenericRestResultSwal({
            result,
            titleSuccess: 'E5N REST - Επιτυχής Υποβολή',
            titleError: 'E5N REST - Αποτυχία Υποβολής',
            successText: 'Η Οικειοθελής Αποχώρηση υποβλήθηκε οριστικά μέσω REST API.',
            errorText: 'Η οριστική υποβολή E5N μέσω REST API απέτυχε.'
        });
    }

    async function showE6NRestResultSwal(result) {
        const code = result?.submissionCode || result?.submission?.code || 'E6N';
        return showGenericRestResultSwal({
            result,
            titleSuccess: `${code} REST - Επιτυχής Υποβολή`,
            titleError: `${code} REST - Αποτυχία Υποβολής`,
            successText: 'Η Καταγγελία Σύμβασης υποβλήθηκε οριστικά μέσω REST API.',
            errorText: 'Η οριστική υποβολή E6N μέσω REST API απέτυχε.'
        });
    }

    async function showE6NXmlResultSwal(result) {
        const code = result?.submissionCode || 'E6N';
        return Swal.fire({
            icon: result?.success === true ? 'success' : 'error',
            title:
                result?.success === true
                    ? `${code} XML - Επιτυχής Προσωρινή Υποβολή`
                    : `${code} XML - Αποτυχία Υποβολής`,
            html: `
                <p>${result?.message || result?.userMessage || ''}</p>
                ${result?.protocol ? `<p>Πρωτόκολλο: <b>${result.protocol}</b></p>` : ''}
            `,
            confirmButtonText: 'OK',
            customClass: {
                confirmButton: 'class-success custom-confirm-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup'
            }
        });
    }

    // ============================================================================
    // ✅ MA REST JSON UPLOAD
    // ============================================================================
    async function submitMARestToErganh(ergazomenosId) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        const ypokatasthma =
            document.getElementById('ypokatasthma')?.value ||
            document.getElementById('ypokatasthmata')?.value ||
            document.getElementById('ypokatasthmata_stathera')?.value ||
            document.querySelector('[name="ypokatasthma"]')?.value ||
            document.querySelector('[name="ypokatasthmata"]')?.value ||
            document.querySelector('[name="ypokatasthmata_stathera"]')?.value ||
            '0';

        const response = await fetch('/ergazomenoi/ergazomenoi/submit-ma-to-erganh', {
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
                    `MA REST JSON upload failed with HTTP ${response.status}`
            );
        }

        if (data?.pdfUrl || data?.pdfS3Url || data?.pdf_url) {
            Swal.close();
            await showErganiSubmittedPdfModal(data);
        }

        return data;
    }

    // ============================================================================
    // ✅ E5N REST JSON UPLOAD
    // ============================================================================
    async function submitE5NRestToErganh(ergazomenosId) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        const ypokatasthma =
            document.getElementById('ypokatasthma')?.value ||
            document.getElementById('ypokatasthmata')?.value ||
            document.getElementById('ypokatasthmata_stathera')?.value ||
            document.querySelector('[name="ypokatasthma"]')?.value ||
            document.querySelector('[name="ypokatasthmata"]')?.value ||
            document.querySelector('[name="ypokatasthmata_stathera"]')?.value ||
            '0';

        const response = await fetch('/ergazomenoi/ergazomenoi/submit-e5n-to-erganh', {
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
                    `E5N REST JSON upload failed with HTTP ${response.status}`
            );
        }

        if (data?.pdfUrl || data?.pdfS3Url || data?.pdf_url) {
            Swal.close();
            await showErganiSubmittedPdfModal(data);
        }

        return data;
    }

    // ============================================================================
    // ✅ E6N REST JSON UPLOAD
    // ============================================================================
    async function submitE6NRestToErganh(ergazomenosId, processCode, uploadMethod = 'rest') {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        const ypokatasthma =
            document.getElementById('ypokatasthma')?.value ||
            document.getElementById('ypokatasthmata')?.value ||
            document.getElementById('ypokatasthmata_stathera')?.value ||
            document.querySelector('[name="ypokatasthma"]')?.value ||
            document.querySelector('[name="ypokatasthmata"]')?.value ||
            document.querySelector('[name="ypokatasthmata_stathera"]')?.value ||
            '0';

        const normalizedProcessCode = String(processCode || '')
            .trim()
            .toLowerCase();
        const submissionCode =
            normalizedProcessCode === '221' || normalizedProcessCode === 'ma_221'
                ? 'WebE6NMP'
                : 'WebE6NXP';

        const response = await fetch('/ergazomenoi/ergazomenoi/submit-e6n-to-erganh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                ergazomenosId,
                ypokatasthma,
                processCode,
                submissionCode,
                erganiUploadMethod: uploadMethod
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
                    `E6N ${String(uploadMethod).toUpperCase()} upload failed with HTTP ${response.status}`
            );
        }

        if (data?.pdfUrl || data?.pdfS3Url || data?.pdf_url) {
            Swal.close();
            await showErganiSubmittedPdfModal(data);
        }

        return data;
    }

    // ============================================================================
    // ✅ E3N REST JSON UPLOAD
    // ============================================================================
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

        // ------------------------------------------------------------------------
        // ✅ Όπως στο E7N:
        // Πρώτα εμφανίζουμε το υποβληθέν PDF σε iframe με κουμπιά
        // Άνοιγμα / Αποθήκευση / Εκτύπωση / Κλείσιμο.
        // Μετά, όταν κλείσει το PDF modal, επιστρέφουμε στο runXmlUploads()
        // ώστε να εμφανιστεί το τελικό success Swal με πρωτόκολλο.
        // ------------------------------------------------------------------------
        if (data?.pdfUrl || data?.pdfS3Url || data?.pdf_url) {
            Swal.close();
            await showErganiSubmittedPdfModal(data);
        }

        return data;
    }

    const buttons = document.querySelectorAll('.submitButton');
    buttons.forEach((button) => {
        button.addEventListener('click', handleFormSubmit);
    });

    // ============================================================================
    // ✅ PDF CONTRACT PREVIEW MODAL
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
        filesToUpdate = {}
    ) {
        return new Promise((resolve) => {
            const modal = document.getElementById('pdfPreviewContractModal');
            const iframe = document.getElementById('pdfPreviewIframe');
            const loading = document.getElementById('pdfPreviewLoading');
            const closeBtn = document.getElementById('closePdfPreviewModal');
            const skipBtn = document.getElementById('skipPdfDownload');
            const downloadBtn = document.getElementById('downloadAndContinue');
            const emailBtn = document.getElementById('downloadAndEmail');

            console.group('[CONTRACT-DEBUG] SHOW MODAL');
            console.log('pdfUrl:', pdfUrl);
            console.log('s3Key:', s3Key);
            console.log('redirectUrl:', redirectUrl);
            console.log('employeeName:', employeeName);
            console.log('ergazomenosId:', ergazomenosId);
            console.log('filesToUpdate:', filesToUpdate);
            console.log('modal found:', !!modal);
            console.log('iframe found:', !!iframe);
            console.log('loading found:', !!loading);
            console.log('closeBtn found:', !!closeBtn);
            console.log('skipBtn found:', !!skipBtn);
            console.log('downloadBtn found:', !!downloadBtn);
            console.log('emailBtn found:', !!emailBtn);
            console.groupEnd();

            if (!modal || !iframe) {
                console.error('❌ PDF preview modal elements not found!');
                resolve();
                // window.location.href = redirectUrl;
                return;
            }

            const emailInput =
                document.getElementById('email') || document.querySelector('input[name="email"]');
            const employeeEmail = emailInput?.value?.trim() || '';

            if (emailBtn) {
                if (employeeEmail && employeeEmail.includes('@')) {
                    emailBtn.disabled = false;
                    emailBtn.title = `Αποστολή στο ${employeeEmail}`;
                } else {
                    emailBtn.disabled = true;
                    emailBtn.title = 'Δεν υπάρχει email εργαζόμενου';
                }
            }

            modal.classList.remove('hidden');

            if (loading) {
                loading.classList.remove('hidden');
            }

            iframe.src = pdfUrl;

            iframe.onload = () => {
                console.log('[CONTRACT-DEBUG] iframe loaded successfully:', pdfUrl);
                if (loading) {
                    loading.classList.add('hidden');
                }
            };

            iframe.onerror = (error) => {
                console.error('[CONTRACT-DEBUG] iframe load error:', error, 'pdfUrl:', pdfUrl);
                if (loading) {
                    loading.innerHTML = '<p class="text-danger">❌ Αποτυχία φόρτωσης PDF</p>';
                }
            };

            // =====================================================================
            // ✅ CLOSE MODAL HANDLER
            // =====================================================================
            const closeModal = async () => {
                console.log('[CONTRACT-DEBUG] closeModal invoked');
                modal.classList.add('hidden');
                iframe.src = '';

                const isPermanent = filesToUpdate?.isPermanent === true;
                const e3AnaggeliaProslhpshs = filesToUpdate?.e3_anaggelia_proslhpshs === true;
                const e3Enabled_1 = filesToUpdate?.e3_metaboles_ergasiakhs_sxeshs === true;
                const e3Enabled_2 =
                    filesToUpdate?.e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy === true;
                const wtoEnabled_217 = filesToUpdate?.ma_217 === true;

                const needsE3Upload = !!(
                    (e3Enabled_1 || e3AnaggeliaProslhpshs) &&
                    e3XmlData?.success &&
                    ergazomenosId
                );

                const wtoPshfiakhOrganosh =
                    filesToUpdate?.wto_pshfiakh_organosh_xronoy_ergasias === true;
                const needsWtoUpload = !!(wtoPshfiakhOrganosh && ergazomenosId);

                console.group('[CONTRACT-DEBUG] CLOSE MODAL DECISION');
                console.log('isPermanent:', isPermanent);
                console.log('needsE3Upload:', needsE3Upload);
                console.log('needsWtoUpload:', needsWtoUpload);
                console.log('e3Enabled_1:', e3Enabled_1);
                console.log('e3Enabled_2:', e3Enabled_2);
                console.log('e3AnaggeliaProslhpshs:', e3AnaggeliaProslhpshs);
                console.log('wtoEnabled_217:', wtoEnabled_217);
                console.groupEnd();

                if (!needsE3Upload && !needsWtoUpload) {
                    console.log('[CONTRACT-DEBUG] No XML uploads needed after modal close');
                    resolve();
                    window.location.href = redirectUrl;
                    return;
                }

                // ✅ UPLOAD E3
                let e3UploadSuccess = false;

                if (needsE3Upload) {
                    const e3UrlToSend =
                        e3XmlData?.s3Url ||
                        e3XmlData?.downloadUrl ||
                        e3XmlData?.relativePath ||
                        e3XmlData?.s3Key ||
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

                // ✅ UPLOAD WTO
                if (needsWtoUpload) {
                    console.log('[WTO-UPLOAD] Starting WTO upload process...');

                    try {
                        if (isPermanent) {
                            console.log('[WTO-UPLOAD] Mode: Οριστική Ενημέρωση (XML upload)');

                            const wtoUrlToSend =
                                wtoXmlData?.s3Url ||
                                wtoXmlData?.downloadUrl ||
                                wtoXmlData?.relativePath ||
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
                            console.log('[WTO-UPLOAD] Mode: Προσωρινή Αποθήκευση (manual form)');
                            console.log('[WTO-UPLOAD] Calling uploadWtoTemporary...');

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
                resolve();
                window.location.href = redirectUrl;
            };

            // =====================================================================
            // ✅ DOWNLOAD HANDLER
            // =====================================================================
            const downloadAndContinue = () => {
                console.log('📥 Download initiated (modal stays open)');
                window.open(pdfUrl, '_blank');

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
            };

            // =====================================================================
            // ✅ DOWNLOAD + EMAIL HANDLER
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

                console.log('📥 Download + Email initiated');
                window.open(pdfUrl, '_blank');

                emailBtn.disabled = true;
                const originalBtnHtml = emailBtn.innerHTML;
                emailBtn.innerHTML =
                    '<span class="spinner-border spinner-border-sm"></span> Αποστολή...';

                try {
                    const csrfToken =
                        document.querySelector('meta[name="csrf-token"]')?.content || '';

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

                    console.group('[CONTRACT-DEBUG] SEND EMAIL REQUEST');
                    console.log('requestBody:', requestBody);
                    console.groupEnd();

                    const response = await fetch('/api/send-contract-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include',
                        body: JSON.stringify(requestBody)
                    });

                    console.group('[CONTRACT-DEBUG] SEND EMAIL RESPONSE');
                    console.log('status:', response.status);
                    console.log('ok:', response.ok);
                    console.groupEnd();

                    const data = await response.json();

                    console.log('[CONTRACT-DEBUG] SEND EMAIL JSON:', data);

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

                        emailBtn.disabled = false;
                        emailBtn.innerHTML = originalBtnHtml;
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
            // ✅ ADD E3 XML DOWNLOAD BUTTON
            // =====================================================================
            if (e3XmlData && e3XmlData.success && e3XmlData.downloadUrl) {
                const existingE3Container = modal.querySelector('.e3-xml-download-container');
                if (existingE3Container) {
                    existingE3Container.remove();
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

                const modalBody =
                    modal.querySelector('.modal-body') ||
                    modal.querySelector('.pdf-preview-container');
                if (modalBody) {
                    modalBody.appendChild(e3Container);
                }
            }

            // =====================================================================
            // ✅ ADD WTO XML DOWNLOAD BUTTON
            // =====================================================================
            if (wtoXmlData && wtoXmlData.success && wtoXmlData.downloadUrl) {
                const existingWtoContainer = modal.querySelector('.wto-xml-download-container');
                if (existingWtoContainer) {
                    existingWtoContainer.remove();
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
                    console.log('[CONTRACT-DEBUG] ESC pressed -> closing modal');
                    closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Upload to ERGANH
    // ============================================================================
    async function uploadToErganh(ergazomenosId, s3Url, isPermanent = false) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        console.log('[UPLOAD-E3] Options:', { ergazomenosId, isPermanent });

        if (!s3Url || typeof s3Url !== 'string') {
            throw new Error('uploadToErganh: s3Url must be a string');
        }

        if (erganiUploadInProgress) {
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
                    <div style="font-weight:600; margin-bottom:10px;">${escapeHtml(short)}</div>
                    ${
                        details
                            ? `
                        <details style="margin-top:8px;">
                            <summary style="cursor:pointer;">Λεπτομέρειες</summary>
                            <pre style="max-height:220px; overflow:auto; white-space:pre-wrap;
                                        overflow-wrap:anywhere; word-break:break-word;
                                        padding:10px 12px; border:1px solid rgba(0,0,0,.10);
                                        border-radius:10px; background:#fff;
                                        font-size:12px;">${escapeHtml(details)}</pre>
                        </details>
                    `
                            : ''
                    }
                </div>
            `;
        };

        try {
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
                    isPermanent: isPermanent === true
                })
            });

            let payload;
            try {
                payload = await uploadResponse.json();
            } catch {
                payload = { success: false, userMessage: await uploadResponse.text() };
            }

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
    // ✅ WTOWeek REST JSON PROGRESS / RESULT SWALS
    // ============================================================================
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
                            <li>Έλεγχο WTOWeek στο trial/production περιβάλλον</li>
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
                if (typeof animateRestProgress === 'function') {
                    animateRestProgress(
                        'wtoweek-rest-progress-bar',
                        'wtoweek-rest-progress-step-text'
                    );
                    return;
                }

                const steps = [
                    { percent: 25, text: 'Προετοιμασία JSON payload...', duration: 800 },
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

    async function showWTOWeekRestResultSwal(wtoResult) {
        await showGenericRestResultSwal({
            result: wtoResult,
            titleSuccess: 'Επιτυχής Οριστική Υποβολή WTOWeek',
            titleError: 'Αποτυχία Οριστικής Υποβολής WTOWeek',
            successText:
                'Η Οργάνωση Χρόνου Εργασίας - Σταθερό Εβδομαδιαίο υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.',
            errorText:
                'Η Οργάνωση Χρόνου Εργασίας - Σταθερό Εβδομαδιαίο δεν υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ.'
        });
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Upload WTO to ERGANH
    // ============================================================================
    async function uploadWtoToErganh(ergazomenosId, _s3Url = null) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        if (erganiUploadInProgress) {
            await Swal.fire({
                icon: 'info',
                title: 'ΕΡΓΑΝΗ (WTOWeek)',
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

        try {
            showWTOWeekRestProgressSwal();

            const ypokatasthma =
                document.getElementById('ypokatasthma')?.value ||
                document.getElementById('ypokatasthmata')?.value ||
                document.getElementById('ypokatasthmata_stathera')?.value ||
                document.querySelector('[name="ypokatasthma"]')?.value ||
                document.querySelector('[name="ypokatasthmata"]')?.value ||
                document.querySelector('[name="ypokatasthmata_stathera"]')?.value ||
                '0';

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
                payload = {
                    success: false,
                    message: await response.text()
                };
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

            // Όπως στο E7N/E3N:
            // πρώτα PDF iframe modal, μετά τελικό Swal με πρωτόκολλο.
            if (payload?.pdfUrl || payload?.pdfS3Url || payload?.pdf_url) {
                await showErganiSubmittedPdfModal(payload);
            }

            await showWTOWeekRestResultSwal(payload);

            return payload;
        } catch (error) {
            Swal.close();

            const failedPayload = {
                success: false,
                error: error?.message || String(error),
                message: error?.message || String(error)
            };

            await showWTOWeekRestResultSwal(failedPayload);

            return failedPayload;
        } finally {
            if (window.hideLoader) window.hideLoader();
            erganiUploadInProgress = false;
        }
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Upload WTO TEMPORARY
    // ============================================================================
    async function uploadWtoTemporary(ergazomenosId, _unusedParam = null) {
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
            if (window.applyServerProgress) {
                window.applyServerProgress(0, 'Είσοδος στο ΕΡΓΑΝΗ ΙΙ (WTO - Προσωρινή)', 1, 12);
            } else if (window.showLoader) {
                window.showLoader('Είσοδος στο ΕΡΓΑΝΗ ΙΙ (WTO - Προσωρινή)');
            }

            console.log('[WTO-TEMP] Calling backend endpoint...');

            const uploadResponse = await fetch(
                '/ergazomenoi/ergazomenoi/upload-wto-temporary-to-erganh',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    credentials: 'include',
                    body: JSON.stringify({ ergazomenosId })
                }
            );

            let payload;
            try {
                payload = await uploadResponse.json();
            } catch {
                payload = { success: false, userMessage: await uploadResponse.text() };
            }

            console.log('[WTO-TEMP] Backend response:', payload);

            if (window.hideLoader) window.hideLoader();

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
                                <pre style="max-height: 200px; overflow: auto; padding: 10px;
                                            background: #f5f5f5; border-radius: 5px;
                                            font-size: 12px;">${escapeHtml(payload.errorDetails)}</pre>
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

                return { success: false, userMessage };
            }

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
                                Η φόρμα WTO συμπληρώθηκε αυτόματα. Ολοκλήρωσε την υποβολή
                                στο παράθυρο του ΕΡΓΑΝΗ.
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
                                <pre style="max-height: 200px; overflow: auto; padding: 10px;
                                            background: #f5f5f5; border-radius: 5px;
                                            font-size: 12px;">${escapeHtml(payload.errorDetails)}</pre>
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

            return { success: false, userMessage: error?.message || 'Unknown error' };
        } finally {
            if (window.hideLoader) window.hideLoader();
            erganiUploadInProgress = false;
        }
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Εμφάνιση PDF υποβληθέντος ΕΡΓΑΝΗ
    // ============================================================================
    async function showErganiSubmittedPdfModal(payload) {
        const pdfUrl = payload?.pdfUrl || payload?.pdfS3Url || payload?.pdf_url || '';
        const protocol = payload?.protocol || '';
        const submitDate = payload?.submitDate || '';
        const title = protocol ? `ΕΡΓΑΝΗ - Πρωτόκολλο ${protocol}` : 'ΕΡΓΑΝΗ - Υποβληθέν PDF';

        if (!pdfUrl) {
            await Swal.fire({
                icon: 'success',
                title: 'ΕΡΓΑΝΗ ΙΙ - Επιτυχής Υποβολή',
                html: `
                <p>Η υποβολή ολοκληρώθηκε επιτυχώς.</p>
                ${protocol ? `<p><strong>Πρωτόκολλο:</strong> ${protocol}</p>` : ''}
                ${submitDate ? `<p><strong>Ημερομηνία:</strong> ${submitDate}</p>` : ''}
                <p class="text-muted">Δεν επιστράφηκε διαθέσιμο URL PDF για προεπισκόπηση.</p>
            `,
                confirmButtonText: 'OK',
                customClass: {
                    confirmButton: 'class-success custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
            return;
        }

        await Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            width: 1250,
            title,
            html: `
            <div style="
                display:flex;
                flex-direction:column;
                gap:0.55rem;
                width:100%;
                height:min(84vh, 820px);
                box-sizing:border-box;
            ">
                <div style="
                    display:flex;
                    gap:0.75rem;
                    align-items:center;
                    justify-content:center;
                    flex-wrap:wrap;
                    font-size:0.95rem;
                ">
                    ${protocol ? `<span><strong>Πρωτόκολλο:</strong> ${protocol}</span>` : ''}
                    ${submitDate ? `<span><strong>Ημ/νία:</strong> ${submitDate}</span>` : ''}
                </div>

                <iframe
                    src="${pdfUrl}"
                    style="
                        width:100%;
                        flex:1 1 auto;
                        min-height:620px;
                        height:72vh;
                        border:1px solid #ccc;
                        border-radius:6px;
                        background:#fff;
                    "
                    title="ΕΡΓΑΝΗ PDF">
                </iframe>

                <div style="
                    display:flex;
                    gap:0.75rem;
                    justify-content:center;
                    align-items:center;
                    flex-wrap:wrap;
                    margin-top:0.25rem;
                ">
                    <button type="button" id="erganiPdfOpenBtn" class="btn btn-primary">
                        Άνοιγμα PDF
                    </button>

                    <a
                        href="${pdfUrl}"
                        target="_blank"
                        download
                        class="btn btn-success"
                        style="text-decoration:none;"
                    >
                        Αποθήκευση Τοπικά
                    </a>

                    <button type="button" id="erganiPdfPrintBtn" class="btn btn-secondary">
                        Εκτύπωση
                    </button>

                    <button type="button" id="erganiPdfCloseBtn" class="btn btn-secondary">
                        Κλείσιμο
                    </button>
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
                    closeBtn.addEventListener('click', () => {
                        Swal.close();
                    });
                }
            }
        });
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Upload MA to ERGANH (Μεταβολή Στοιχείων)
    // ============================================================================
    async function uploadMaToErganh(
        ergazomenosId,
        s3Url,
        isPermanent = false,
        processCode = null,
        erganiUploadMethod = 'xml'
    ) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const normalizedProcessCode = String(processCode || '')
            .trim()
            .toLowerCase();
        const normalizedUploadMethod = String(erganiUploadMethod || 'xml')
            .trim()
            .toLowerCase();
        const isE7NRestSubmit =
            isPermanent === true &&
            normalizedUploadMethod === 'rest' &&
            (normalizedProcessCode === '222' || normalizedProcessCode === 'ma_222');

        const isE5NRestSubmit =
            isPermanent === true &&
            normalizedUploadMethod === 'rest' &&
            (normalizedProcessCode === '217' || normalizedProcessCode === 'ma_217');

        const isE6NRestSubmit =
            isPermanent === true &&
            normalizedUploadMethod === 'rest' &&
            (normalizedProcessCode === '221' ||
                normalizedProcessCode === 'ma_221' ||
                normalizedProcessCode === '220' ||
                normalizedProcessCode === 'ma_220');

        const isE6NXmlSubmit =
            normalizedUploadMethod === 'xml' &&
            (normalizedProcessCode === '221' ||
                normalizedProcessCode === 'ma_221' ||
                normalizedProcessCode === '220' ||
                normalizedProcessCode === 'ma_220');

        const isMARestSubmit =
            isPermanent === true &&
            normalizedUploadMethod === 'rest' &&
            !isE7NRestSubmit &&
            !isE5NRestSubmit &&
            !isE6NRestSubmit;

        if (isE5NRestSubmit) {
            if (erganiUploadInProgress) {
                if (window.hideLoader) window.hideLoader();
                await Swal.fire({
                    icon: 'info',
                    title: 'ΕΡΓΑΝΗ REST',
                    text: 'Η υποβολή είναι ήδη σε εξέλιξη.',
                    confirmButtonText: 'OK'
                });
                return { success: false, userMessage: 'Upload already in progress' };
            }

            erganiUploadInProgress = true;

            try {
                if (!Swal.isVisible()) {
                    showGenericRestProgressSwal('Οριστική υποβολή E5N μέσω REST API');
                }

                const payload = await submitE5NRestToErganh(ergazomenosId);
                return { success: true, ...payload };
            } catch (error) {
                if (window.hideLoader) window.hideLoader();

                return {
                    success: false,
                    error: error?.message || 'Unknown error',
                    message: error?.message || 'Unknown error',
                    userMessage: error?.message || 'Unknown error'
                };
            } finally {
                if (window.hideLoader) window.hideLoader();
                erganiUploadInProgress = false;
            }
        }

        if (isE6NRestSubmit) {
            if (erganiUploadInProgress) {
                if (window.hideLoader) window.hideLoader();
                await Swal.fire({
                    icon: 'info',
                    title: 'ΕΡΓΑΝΗ REST',
                    text: 'Η υποβολή είναι ήδη σε εξέλιξη.',
                    confirmButtonText: 'OK'
                });
                return { success: false, userMessage: 'Upload already in progress' };
            }

            erganiUploadInProgress = true;

            try {
                if (!Swal.isVisible()) {
                    showGenericRestProgressSwal(
                        normalizedProcessCode === '221' || normalizedProcessCode === 'ma_221'
                            ? 'Οριστική υποβολή E6NMP μέσω REST API'
                            : 'Οριστική υποβολή E6NXP μέσω REST API'
                    );
                }

                const payload = await submitE6NRestToErganh(ergazomenosId, normalizedProcessCode);
                return { success: true, ...payload };
            } catch (error) {
                if (window.hideLoader) window.hideLoader();

                return {
                    success: false,
                    error: error?.message || 'Unknown error',
                    message: error?.message || 'Unknown error',
                    userMessage: error?.message || 'Unknown error'
                };
            } finally {
                if (window.hideLoader) window.hideLoader();
                erganiUploadInProgress = false;
            }
        }

        if (isMARestSubmit) {
            if (erganiUploadInProgress) {
                if (window.hideLoader) window.hideLoader();
                await Swal.fire({
                    icon: 'info',
                    title: 'ΕΡΓΑΝΗ REST',
                    text: 'Η υποβολή είναι ήδη σε εξέλιξη.',
                    confirmButtonText: 'OK'
                });
                return { success: false, userMessage: 'Upload already in progress' };
            }

            erganiUploadInProgress = true;

            try {
                // Το MA REST έχει ήδη δικό του Swal progress bar (ίδιο ύφος με E3N/E7N).
                // Δεν ανοίγουμε το παλιό global loader/applyServerProgress, γιατί εμφανίζει
                // δεύτερο overlay/μικρό progress indicator πάνω από το SweetAlert.
                if (!Swal.isVisible()) {
                    showGenericRestProgressSwal('Οριστική υποβολή MA μέσω REST API');
                }

                const payload = await submitMARestToErganh(ergazomenosId);
                return { success: true, ...payload };
            } catch (error) {
                if (window.hideLoader) window.hideLoader();

                return {
                    success: false,
                    error: error?.message || 'Unknown error',
                    message: error?.message || 'Unknown error',
                    userMessage: error?.message || 'Unknown error'
                };
            } finally {
                if (window.hideLoader) window.hideLoader();
                erganiUploadInProgress = false;
            }
        }

        if (isE7NRestSubmit) {
            if (erganiUploadInProgress) {
                if (window.hideLoader) window.hideLoader();
                await Swal.fire({
                    icon: 'info',
                    title: 'ΕΡΓΑΝΗ REST',
                    text: 'Η υποβολή είναι ήδη σε εξέλιξη.',
                    confirmButtonText: 'OK'
                });
                return { success: false, userMessage: 'Upload already in progress' };
            }

            erganiUploadInProgress = true;

            try {
                if (window.applyServerProgress) {
                    window.applyServerProgress(0, 'Οριστική υποβολή E7N μέσω REST API', 1, 4);
                } else if (window.showLoader) {
                    window.showLoader('Οριστική υποβολή E7N μέσω REST API');
                }

                const uploadResponse = await fetch(
                    '/ergazomenoi/ergazomenoi/submit-e7n-to-erganh',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
                        credentials: 'include',
                        body: JSON.stringify({
                            ergazomenosId,
                            erganiUploadMethod: 'rest'
                        })
                    }
                );

                let payload;
                try {
                    payload = await uploadResponse.json();
                } catch {
                    payload = { success: false, message: await uploadResponse.text() };
                }

                if (window.hideLoader) window.hideLoader();

                if (!uploadResponse.ok || !payload?.success) {
                    // await Swal.fire({
                    //     icon: 'error',
                    //     title: 'E7N REST - ΕΡΓΑΝΗ ΙΙ',
                    //     html: `<p>${payload?.message || payload?.error || `HTTP ${uploadResponse.status}`}</p>`,
                    //     confirmButtonText: 'OK',
                    //     customClass: {
                    //         confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    //         title: 'custom-title',
                    //         popup: 'custom-swal-popup'
                    //     }
                    // });
                    // return { success: false, ...payload };
                    return {
                        success: false,
                        error:
                            payload?.message ||
                            payload?.error ||
                            payload?.userMessage ||
                            `HTTP ${uploadResponse.status}`,
                        message:
                            payload?.message ||
                            payload?.error ||
                            payload?.userMessage ||
                            `HTTP ${uploadResponse.status}`,
                        ...payload
                    };
                }

                await showErganiSubmittedPdfModal(payload);
                return { success: true, ...payload };
            } catch (error) {
                if (window.hideLoader) window.hideLoader();

                return {
                    success: false,
                    error: error?.message || 'Unknown error',
                    message: error?.message || 'Unknown error',
                    userMessage: error?.message || 'Unknown error'
                };
            } finally {
                if (window.hideLoader) window.hideLoader();
                erganiUploadInProgress = false;
            }
        }

        if (isE6NXmlSubmit) {
            if (erganiUploadInProgress) {
                if (window.hideLoader) window.hideLoader();
                await Swal.fire({
                    icon: 'info',
                    title: 'ΕΡΓΑΝΗ XML',
                    text: 'Η υποβολή είναι ήδη σε εξέλιξη.',
                    confirmButtonText: 'OK'
                });
                return { success: false, userMessage: 'Upload already in progress' };
            }

            erganiUploadInProgress = true;

            try {
                if (!Swal.isVisible()) {
                    showGenericRestProgressSwal(
                        normalizedProcessCode === '221' || normalizedProcessCode === 'ma_221'
                            ? 'Προσωρινή υποβολή E6NMP XML'
                            : 'Προσωρινή υποβολή E6NXP XML'
                    );
                }

                const payload = await submitE6NRestToErganh(
                    ergazomenosId,
                    normalizedProcessCode,
                    'xml'
                );
                return { success: true, ...payload };
            } catch (error) {
                if (window.hideLoader) window.hideLoader();

                return {
                    success: false,
                    error: error?.message || 'Unknown error',
                    message: error?.message || 'Unknown error',
                    userMessage: error?.message || 'Unknown error'
                };
            } finally {
                if (window.hideLoader) window.hideLoader();
                erganiUploadInProgress = false;
            }
        }
        if (!s3Url || typeof s3Url !== 'string') {
            throw new Error('uploadMaToErganh: s3Url must be a string');
        }

        if (erganiUploadInProgress) {
            if (window.hideLoader) window.hideLoader();
            await Swal.fire({
                icon: 'info',
                title: 'ΕΡΓΑΝΗ (ΜΑ)',
                text: 'Η υποβολή είναι ήδη σε εξέλιξη.',
                confirmButtonText: 'OK'
            });
            return { success: false, userMessage: 'Upload already in progress' };
        }

        erganiUploadInProgress = true;

        try {
            if (window.applyServerProgress) {
                window.applyServerProgress(0, 'Υποβολή Μεταβολής στο ΕΡΓΑΝΗ ΙΙ', 1, 4);
            } else if (window.showLoader) {
                window.showLoader('Υποβολή Μεταβολής στο ΕΡΓΑΝΗ ΙΙ');
            }

            const uploadResponse = await fetch('/ergazomenoi/ergazomenoi/upload-ma-to-erganh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
                credentials: 'include',
                body: JSON.stringify({
                    ergazomenosId,
                    s3Url,
                    isPermanent: isPermanent === true,
                    processCode
                })
            });

            let payload;
            try {
                payload = await uploadResponse.json();
            } catch {
                payload = { success: false, userMessage: await uploadResponse.text() };
            }

            if (window.hideLoader) window.hideLoader();

            if (!uploadResponse.ok) {
                await Swal.fire({
                    icon: 'error',
                    title: 'ΜΑ XML - ΕΡΓΑΝΗ ΙΙ',
                    text: payload?.userMessage || `HTTP ${uploadResponse.status}`,
                    confirmButtonText: 'OK'
                });
                return { success: false, ...payload };
            }

            if (payload.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'ΕΡΓΑΝΗ ΙΙ - Μεταβολή',
                    html: `<p>${payload?.userMessage || 'Επιτυχής υποβολή Μεταβολής'}</p>
                    ${payload?.protocol ? `<p>Πρωτόκολλο: <b>${payload.protocol}</b></p>` : ''}`,
                    confirmButtonText: 'OK'
                });
            } else {
                await Swal.fire({
                    icon: 'warning',
                    title: 'ΜΑ XML - ΕΡΓΑΝΗ ΙΙ',
                    customClass: {
                        popup: 'ergani-swal-popup',
                        htmlContainer: 'ergani-swal-html'
                    },
                    html: `
    <div class="ergani-swal-content">
      <p>${payload?.userMessage || 'Αποτυχία υποβολής ΜΑ'}</p>
      ${payload?.errorDetails ? `<p class="ergani-swal-details">${payload.errorDetails}</p>` : ''}
    </div>
  `,
                    confirmButtonText: 'OK'
                });
            }

            return payload;
        } catch (err) {
            if (window.hideLoader) window.hideLoader();
            console.error('[MA-UPLOAD] ❌ fetch error:', err);
            await Swal.fire({
                icon: 'error',
                title: 'ΜΑ XML - ΕΡΓΑΝΗ ΙΙ',
                text: err?.message || 'Αποτυχία αποστολής ΜΑ XML.',
                confirmButtonText: 'OK'
            });
            return { success: false, error: err?.message };
        } finally {
            erganiUploadInProgress = false;
        }
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Ακύρωση / Ανάκληση υποβολής E7N από ΕΡΓΑΝΗ
    // ============================================================================
    async function cancelE7NSubmission(erganhLogId, cancelReason = '') {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        const response = await fetch('/ergazomenoi/ergazomenoi/cancel-e7n-submission', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                erganhLogId,
                cancelReason
            })
        });

        const payload = await response.json().catch(async () => ({
            success: false,
            message: await response.text()
        }));

        if (!response.ok || payload?.success === false) {
            throw new Error(
                payload?.message || payload?.error || 'Η ακύρωση της υποβολής ΕΡΓΑΝΗ απέτυχε.'
            );
        }

        return payload;
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Modal επιβεβαίωσης ακύρωσης E7N
    // ============================================================================
    async function confirmAndCancelE7NSubmission(erganhLogId, protocol = '') {
        if (!erganhLogId) {
            await Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: 'Δεν βρέθηκε ID υποβολής ΕΡΓΑΝΗ για ακύρωση.'
            });
            return null;
        }

        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Ακύρωση Υποβολής ΕΡΓΑΝΗ',
            html: `
            <p>Θέλετε σίγουρα να ακυρώσετε την υποβολή;</p>
            ${protocol ? `<p><strong>Πρωτόκολλο:</strong> ${protocol}</p>` : ''}
            <p class="text-danger">
                Η ενέργεια θα σταλεί στο ΕΡΓΑΝΗ και δεν είναι απλή τοπική διαγραφή.
            </p>
        `,
            input: 'textarea',
            inputPlaceholder: 'Προαιρετικός λόγος ακύρωσης για εσωτερική καταγραφή...',
            inputAttributes: {
                maxlength: 500
            },
            showCancelButton: true,
            confirmButtonText: 'Ναι, ακύρωση',
            cancelButtonText: 'Όχι',
            customClass: {
                confirmButton: 'class-danger custom-confirm-button custom-swal-button',
                cancelButton: 'class-secondary custom-cancel-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup'
            }
        });

        if (!confirm.isConfirmed) return null;

        try {
            const result = await cancelE7NSubmission(erganhLogId, confirm.value || '');

            await Swal.fire({
                icon: 'success',
                title: 'Ακύρωση Υποβολής',
                html: `
                <p>${result?.message || 'Η υποβολή ακυρώθηκε επιτυχώς.'}</p>
                ${protocol ? `<p><strong>Πρωτόκολλο:</strong> ${protocol}</p>` : ''}
            `,
                confirmButtonText: 'OK',
                customClass: {
                    confirmButton: 'class-success custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });

            return result;
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Αποτυχία Ακύρωσης',
                html: `
                <p>Το ΕΡΓΑΝΗ απέρριψε ή απέτυχε να εκτελέσει την ακύρωση.</p>
                <p><strong>Μήνυμα:</strong></p>
                <pre style="white-space:pre-wrap;text-align:left;">${error.message}</pre>
            `,
                confirmButtonText: 'OK',
                customClass: {
                    confirmButton: 'class-danger custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });

            return null;
        }
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Φόρτωση Ιστορικού ΕΡΓΑΝΗ
    // ============================================================================
    async function loadErganhHistory(ergazomenosId) {
        const response = await fetch(`/ergazomenoi/ergazomenoi/${ergazomenosId}/erganh-history`, {
            method: 'GET',
            credentials: 'include'
        });

        const payload = await response.json().catch(async () => ({
            success: false,
            message: await response.text()
        }));

        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.message || 'Αποτυχία φόρτωσης ιστορικού ΕΡΓΑΝΗ.');
        }

        return payload.data || [];
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Render πίνακα Ιστορικού ΕΡΓΑΝΗ
    // ============================================================================
    function renderErganhHistoryTable(rows = []) {
        if (!rows.length) {
            return `
            <div class="alert alert-info mt-3">
                Δεν υπάρχουν ακόμα υποβολές ΕΡΓΑΝΗ για τον εργαζόμενο.
            </div>
        `;
        }

        const tr = rows
            .map((row) => {
                const statusBadge =
                    row.documentStatus === 'CANCELLED'
                        ? '<span class="badge bg-danger">CANCELLED</span>'
                        : row.submissionStatus === 'FAILED'
                          ? '<span class="badge bg-warning text-dark">FAILED</span>'
                          : '<span class="badge bg-success">ACTIVE</span>';

                const pdfBtn = row.pdfUrl
                    ? `
                    <button type="button"
                        class="btn btn-sm btn-primary erganh-history-pdf-btn"
                        data-pdf-url="${row.pdfUrl}"
                        data-protocol="${row.protocol || ''}"
                        data-submit-date="${row.submitDate || ''}">
                        PDF
                    </button>
                `
                    : '<span class="text-muted">-</span>';

                const cancelBtn =
                    row.documentStatus === 'ACTIVE' && row.uploadMethod === 'REST'
                        ? `
                        <button type="button"
                            class="btn btn-sm btn-danger erganh-history-cancel-btn"
                            data-erganh-log-id="${row._id}"
                            data-protocol="${row.protocol || ''}">
                            Ακύρωση
                        </button>
                    `
                        : '<span class="text-muted">-</span>';

                return `
                <tr
                    data-upload-method="${row.uploadMethod || ''}"
                    data-document-status="${row.documentStatus || ''}"
                    data-submission-status="${row.submissionStatus || ''}"
                >
                    <td>${row.submitDate || '-'}</td>
                    <td>${row.protocol || '-'}</td>
                    <td>${row.processDescription || row.processCode || '-'}</td>
                    <td>${row.uploadMethod || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>${pdfBtn}</td>
                    <td>${cancelBtn}</td>
                </tr>
            `;
            })
            .join('');

        return `
        <div class="erganh-history-filterbar">
            <div>
                <label for="erganhHistoryMethodFilter"><strong>Μέθοδος:</strong></label>
                <select id="erganhHistoryMethodFilter" class="form-select form-select-sm">
                    <option value="ALL">Όλα</option>
                    <option value="REST">REST</option>
                    <option value="XML">XML</option>
                </select>
            </div>

            <div>
                <label for="erganhHistoryStatusFilter"><strong>Κατάσταση:</strong></label>
                <select id="erganhHistoryStatusFilter" class="form-select form-select-sm">
                    <option value="ALL">Όλα</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="FAILED">FAILED</option>
                </select>
            </div>

            <div class="erganh-history-count">
                <strong>Εγγραφές:</strong>
                <span id="erganhHistoryVisibleCount">${rows.length}</span> / ${rows.length}
            </div>
        </div>

        <div class="erganh-history-wrapper">
            <table class="erganh-history-table">
                <thead>
                    <tr>
                        <th>Ημερομηνία</th>
                        <th>Πρωτόκολλο</th>
                        <th>Τύπος</th>
                        <th>XML / REST</th>
                        <th>Κατάσταση</th>
                        <th>PDF</th>
                        <th>Ακύρωση</th>
                    </tr>
                </thead>
                <tbody>${tr}</tbody>
            </table>
        </div>
    `;
    }

    function applyErganhHistoryFilters() {
        const methodFilter = document.getElementById('erganhHistoryMethodFilter')?.value || 'ALL';
        const statusFilter = document.getElementById('erganhHistoryStatusFilter')?.value || 'ALL';
        const rows = document.querySelectorAll('.erganh-history-table tbody tr');

        let visibleCount = 0;

        rows.forEach((tr) => {
            const method = tr.dataset.uploadMethod || '';
            const documentStatus = tr.dataset.documentStatus || '';
            const submissionStatus = tr.dataset.submissionStatus || '';

            const methodOk = methodFilter === 'ALL' || method === methodFilter;

            const statusOk =
                statusFilter === 'ALL' ||
                documentStatus === statusFilter ||
                submissionStatus === statusFilter;

            const visible = methodOk && statusOk;

            tr.style.display = visible ? '' : 'none';

            if (visible) visibleCount++;
        });

        const countEl = document.getElementById('erganhHistoryVisibleCount');
        if (countEl) countEl.textContent = String(visibleCount);
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Άνοιγμα modal Ιστορικού ΕΡΓΑΝΗ
    // ============================================================================
    async function showErganhHistoryModal(ergazomenosId) {
        try {
            const rows = await loadErganhHistory(ergazomenosId);

            await Swal.fire({
                title: 'Ιστορικό ΕΡΓΑΝΗ',
                width: 'auto',
                html: renderErganhHistoryTable(rows),
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-secondary custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup',
                    htmlContainer: 'custom-html-container'
                },
                didOpen: () => {
                    const popup = Swal.getPopup();
                    const htmlContainer = Swal.getHtmlContainer();

                    if (popup) {
                        popup.style.setProperty('width', 'auto', 'important');
                        popup.style.setProperty('min-width', 'unset', 'important');
                        popup.style.setProperty('max-width', 'fit-content', 'important');
                        popup.style.setProperty('padding', '1.5rem', 'important');
                    }

                    if (htmlContainer) {
                        htmlContainer.style.setProperty('width', 'auto', 'important');
                        htmlContainer.style.setProperty('max-width', '100%', 'important');
                        htmlContainer.style.setProperty('overflow-x', 'auto', 'important');
                    }

                    const methodFilter = document.getElementById('erganhHistoryMethodFilter');
                    const statusFilter = document.getElementById('erganhHistoryStatusFilter');

                    if (methodFilter) {
                        methodFilter.addEventListener('change', applyErganhHistoryFilters);
                    }

                    if (statusFilter) {
                        statusFilter.addEventListener('change', applyErganhHistoryFilters);
                    }

                    applyErganhHistoryFilters();

                    document.querySelectorAll('.erganh-history-pdf-btn').forEach((btn) => {
                        btn.addEventListener('click', async () => {
                            await showErganiSubmittedPdfModal({
                                pdfUrl: btn.dataset.pdfUrl,
                                protocol: btn.dataset.protocol,
                                submitDate: btn.dataset.submitDate
                            });
                        });
                    });

                    document.querySelectorAll('.erganh-history-cancel-btn').forEach((btn) => {
                        btn.addEventListener('click', async () => {
                            const result = await confirmAndCancelE7NSubmission(
                                btn.dataset.erganhLogId,
                                btn.dataset.protocol
                            );

                            if (result) {
                                Swal.close();
                                await showErganhHistoryModal(ergazomenosId);
                            }
                        });
                    });
                }
            });
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Ιστορικό ΕΡΓΑΝΗ',
                text: error.message || 'Αποτυχία φόρτωσης ιστορικού ΕΡΓΑΝΗ.'
            });
        }
    }

    const erganhHistoryBtn = document.getElementById('btnErganhHistory');

    if (erganhHistoryBtn) {
        erganhHistoryBtn.addEventListener('click', async () => {
            const ergazomenoiId = document.getElementById('ergazomenoiId')?.value?.trim();

            if (!ergazomenoiId) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Ιστορικό ΕΡΓΑΝΗ',
                    text: 'Δεν βρέθηκε ID εργαζόμενου.'
                });
                return;
            }

            await showErganhHistoryModal(ergazomenoiId);
        });
    }

    const erganhDashboardBtn = document.getElementById('btnErganhDashboard');

    if (erganhDashboardBtn) {
        erganhDashboardBtn.addEventListener('click', async () => {
            await showErganhDashboardModal('30');
        });
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Φόρτωση Dashboard ΕΡΓΑΝΗ εταιρείας
    // ============================================================================
    async function loadErganhDashboard(period = '30') {
        const response = await fetch(`/ergazomenoi/ergazomenoi/erganh-dashboard?period=${period}`, {
            method: 'GET',
            credentials: 'include'
        });

        const payload = await response.json().catch(async () => ({
            success: false,
            message: await response.text()
        }));

        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.message || 'Αποτυχία φόρτωσης Dashboard ΕΡΓΑΝΗ.');
        }

        return payload;
    }

    // ============================================================================
    // ✅ HELPER FUNCTION: Chart.js loader για Dashboard ΕΡΓΑΝΗ
    // ============================================================================
    async function ensureChartJsLoaded() {
        if (window.Chart) return true;

        return new Promise((resolve, reject) => {
            const existingScript = document.getElementById('chartjs-cdn-script');

            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(true), { once: true });
                existingScript.addEventListener(
                    'error',
                    () => reject(new Error('Αποτυχία φόρτωσης Chart.js.')),
                    { once: true }
                );
                return;
            }

            const script = document.createElement('script');
            script.id = 'chartjs-cdn-script';
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.async = true;

            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('Αποτυχία φόρτωσης Chart.js.'));

            document.head.appendChild(script);
        });
    }

    function destroyErganhDashboardCharts() {
        if (!window.__erganhDashboardCharts) {
            window.__erganhDashboardCharts = {};
            return;
        }

        Object.values(window.__erganhDashboardCharts).forEach((chart) => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });

        window.__erganhDashboardCharts = {};
    }

    function percentOf(value, total) {
        const n = Number(value) || 0;
        const t = Number(total) || 0;

        if (!t) return 0;

        return Math.round((n / t) * 100);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function renderDashboardCard({ cssClass, title, value, subtitle = '' }) {
        return `
            <div class="erganh-dashboard-card ${cssClass}">
                <strong>${escapeHtml(title)}</strong>
                <span>${Number(value) || 0}</span>
                ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}
            </div>
        `;
    }

    function renderErganhDashboard(payload) {
        const totals = payload?.totals || {};
        const byProcess = payload?.byProcess || [];
        const latest = payload?.latest || [];

        const totalCount = Number(totals.total) || 0;
        const activePercent = percentOf(totals.active, totalCount);
        const cancelledPercent = percentOf(totals.cancelled, totalCount);
        const failedPercent = percentOf(totals.failed, totalCount);

        const processRows = byProcess
            .map(
                (r) => `
                <tr>
                    <td>${escapeHtml(r.processCode || '-')}</td>
                    <td>${escapeHtml(r.processDescription || '-')}</td>
                    <td class="text-center">${Number(r.count) || 0}</td>
                    <td class="text-center">${Number(r.rest) || 0}</td>
                    <td class="text-center">${Number(r.xml) || 0}</td>
                    <td class="text-center">${Number(r.active) || 0}</td>
                    <td class="text-center">${Number(r.cancelled) || 0}</td>
                    <td class="text-center">${Number(r.failed) || 0}</td>
                </tr>
            `
            )
            .join('');

        const latestRows = latest
            .map((r) => {
                const pdfButton = r.pdfUrl
                    ? `
                        <button type="button"
                            class="btn btn-sm btn-primary erganh-dashboard-pdf-btn"
                            data-pdf-url="${escapeHtml(r.pdfUrl)}"
                            data-protocol="${escapeHtml(r.protocol || '')}"
                            data-submit-date="${escapeHtml(r.submitDate || '')}"
                            title="Άνοιγμα PDF">
                            <i class="bi bi-file-earmark-pdf"></i>
                        </button>
                    `
                    : '<span class="text-muted">-</span>';

                const protocolCell = r.pdfUrl
                    ? `
                        <button type="button"
                            class="btn btn-link btn-sm p-0 erganh-dashboard-pdf-btn erganh-dashboard-protocol-btn"
                            data-pdf-url="${escapeHtml(r.pdfUrl)}"
                            data-protocol="${escapeHtml(r.protocol || '')}"
                            data-submit-date="${escapeHtml(r.submitDate || '')}">
                            ${escapeHtml(r.protocol || '-')}
                        </button>
                    `
                    : escapeHtml(r.protocol || '-');

                const statusClass =
                    r.documentStatus === 'CANCELLED'
                        ? 'badge bg-danger'
                        : r.submissionStatus === 'FAILED'
                          ? 'badge bg-warning text-dark'
                          : 'badge bg-success';

                return `
                    <tr>
                        <td>${escapeHtml(r.submitDate || '-')}</td>
                        <td>${protocolCell}</td>
                        <td>${escapeHtml(r.employee || '-')}</td>
                        <td>${escapeHtml(r.employeeAfm || '-')}</td>
                        <td>${escapeHtml(r.processDescription || r.processCode || '-')}</td>
                        <td class="text-center">${escapeHtml(r.uploadMethod || '-')}</td>
                        <td class="text-center">
                            <span class="${statusClass}">
                                ${escapeHtml(r.documentStatus || r.submissionStatus || '-')}
                            </span>
                        </td>
                        <td class="text-center">${pdfButton}</td>
                    </tr>
                `;
            })
            .join('');

        return `
                <div class="erganh-dashboard-cards">
                    ${renderDashboardCard({
                        cssClass: 'dashboard-card-total',
                        title: 'Σύνολο',
                        value: totals.total || 0,
                        subtitle: 'Υποβολές'
                    })}

                    ${renderDashboardCard({
                        cssClass: 'dashboard-card-rest',
                        title: 'REST',
                        value: totals.rest || 0,
                        subtitle: `${percentOf(totals.rest, totalCount)}% του συνόλου`
                    })}

                    ${renderDashboardCard({
                        cssClass: 'dashboard-card-xml',
                        title: 'XML',
                        value: totals.xml || 0,
                        subtitle: `${percentOf(totals.xml, totalCount)}% του συνόλου`
                    })}

                    ${renderDashboardCard({
                        cssClass: 'dashboard-card-active',
                        title: 'ACTIVE',
                        value: totals.active || 0,
                        subtitle: `${activePercent}% του συνόλου`
                    })}

                    ${renderDashboardCard({
                        cssClass: 'dashboard-card-cancelled',
                        title: 'CANCELLED',
                        value: totals.cancelled || 0,
                        subtitle: `${cancelledPercent}% του συνόλου`
                    })}

                    ${renderDashboardCard({
                        cssClass: 'dashboard-card-failed',
                        title: 'FAILED',
                        value: totals.failed || 0,
                        subtitle: `${failedPercent}% του συνόλου`
                    })}
                </div>

                <div class="erganh-dashboard-charts">
                    <div class="erganh-dashboard-chart-card">
                        <h6>Υποβολές ανά κατηγορία</h6>
                        <div class="erganh-dashboard-chart-box">
                            <canvas id="erganhTotalsChart"></canvas>
                        </div>
                    </div>

                    <div class="erganh-dashboard-chart-card">
                        <h6>Κατάσταση εγγράφων</h6>
                        <div class="erganh-dashboard-chart-box">
                            <canvas id="erganhStatusChart"></canvas>
                        </div>
                    </div>

                    <div class="erganh-dashboard-chart-card erganh-dashboard-chart-wide">
                        <h6>Υποβολές ανά μήνα και ανά έντυπο ΕΡΓΑΝΗ</h6>
                        <div class="erganh-dashboard-chart-box">
                            <canvas id="erganhProcessChart"></canvas>
                        </div>
                    </div>
                </div>

                <h6 class="mt-3 mb-2">Υποβολές ανά μήνα και ανά έντυπο ΕΡΓΑΝΗ</h6>
                <div class="table-responsive">
                    <table class="erganh-history-table">
                        <thead>
                            <tr>
                                <th>Κωδικός</th>
                                <th>Περιγραφή</th>
                                <th>Σύνολο</th>
                                <th>REST</th>
                                <th>XML</th>
                                <th>ACTIVE</th>
                                <th>CANCELLED</th>
                                <th>FAILED</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${processRows || '<tr><td colspan="8">Δεν υπάρχουν δεδομένα.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <h6 class="mt-3 mb-2">Τελευταίες 20 υποβολές</h6>
                <div class="table-responsive">
                    <table class="erganh-history-table">
                        <thead>
                            <tr>
                                <th>Ημερομηνία</th>
                                <th>Πρωτόκολλο</th>
                                <th>Εργαζόμενος</th>
                                <th>ΑΦΜ</th>
                                <th>Τύπος</th>
                                <th>Μέθοδος</th>
                                <th>Κατάσταση</th>
                                <th>PDF</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${latestRows || '<tr><td colspan="8">Δεν υπάρχουν πρόσφατες υποβολές.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function buildStackedMonthProcessChartData(byMonthProcess = []) {
        const monthMap = new Map();
        const processMap = new Map();

        byMonthProcess.forEach((row) => {
            const monthKey = row.monthKey || '';
            const monthLabel = row.monthLabel || monthKey || '-';
            const processCode = row.processCode || 'UNKNOWN';
            const processDescription = row.processDescription || processCode;
            const count = Number(row.count) || 0;

            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, {
                    monthKey,
                    monthLabel
                });
            }

            monthMap.get(monthKey)[processCode] = count;

            if (!processMap.has(processCode)) {
                processMap.set(processCode, processDescription);
            }
        });

        const months = Array.from(monthMap.values()).sort((a, b) =>
            String(a.monthKey).localeCompare(String(b.monthKey))
        );

        const processes = Array.from(processMap.keys()).sort();

        return {
            labels: months.map((m) => m.monthLabel),
            processes,
            processMap,
            datasets: processes.map((processCode) => ({
                label: processMap.get(processCode) || processCode,
                data: months.map((m) => Number(m[processCode]) || 0)
            }))
        };
    }

    function initErganhDashboardCharts(payload) {
        if (!window.Chart) return;

        destroyErganhDashboardCharts();

        const totals = payload?.totals || {};
        const byProcess = payload?.byProcess || [];

        const totalsCanvas = document.getElementById('erganhTotalsChart');
        const statusCanvas = document.getElementById('erganhStatusChart');
        const processCanvas = document.getElementById('erganhProcessChart');

        if (totalsCanvas) {
            window.__erganhDashboardCharts.totals = new Chart(totalsCanvas, {
                type: 'bar',
                data: {
                    labels: ['REST', 'XML', 'ACTIVE', 'CANCELLED', 'FAILED'],
                    datasets: [
                        {
                            label: 'Υποβολές',
                            data: [
                                Number(totals.rest) || 0,
                                Number(totals.xml) || 0,
                                Number(totals.active) || 0,
                                Number(totals.cancelled) || 0,
                                Number(totals.failed) || 0
                            ],
                            backgroundColor: [
                                '#0d6efd',
                                '#198754',
                                '#20c997',
                                '#dc3545',
                                '#fd7e14'
                            ],
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }

        if (statusCanvas) {
            window.__erganhDashboardCharts.status = new Chart(statusCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['ACTIVE', 'CANCELLED', 'FAILED'],
                    datasets: [
                        {
                            data: [
                                Number(totals.active) || 0,
                                Number(totals.cancelled) || 0,
                                Number(totals.failed) || 0
                            ],
                            backgroundColor: ['#20c997', '#dc3545', '#fd7e14'],
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        if (processCanvas) {
            const stackedData = buildStackedMonthProcessChartData(payload?.byMonthProcess || []);

            window.__erganhDashboardCharts.process = new Chart(processCanvas, {
                type: 'bar',
                data: {
                    labels: stackedData.labels,
                    datasets: stackedData.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                title: (items) => {
                                    return items?.[0]?.label || '';
                                },
                                label: (context) => {
                                    return `${context.dataset.label}: ${context.parsed.y}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }
    }

    async function showErganhDashboardModal(initialPeriod = '30') {
        let currentPeriod = initialPeriod;

        async function refreshDashboardHtml() {
            const payload = await loadErganhDashboard(currentPeriod);

            const container = document.getElementById('erganhDashboardContent');
            if (container) {
                container.innerHTML = renderErganhDashboard(payload);
            }

            initErganhDashboardCharts(payload);

            document.querySelectorAll('.erganh-dashboard-pdf-btn').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    await showErganiSubmittedPdfModal({
                        pdfUrl: btn.dataset.pdfUrl,
                        protocol: btn.dataset.protocol,
                        submitDate: btn.dataset.submitDate
                    });
                });
            });
        }

        await Swal.fire({
            title: 'Dashboard ΕΡΓΑΝΗ Εταιρείας',
            width: 'min(1250px, 96vw)',
            heightAuto: false,
            html: `
                <div class="erganh-history-filterbar">
                    <div>
                        <label for="erganhDashboardPeriod"><strong>Περίοδος:</strong></label>
                        <select id="erganhDashboardPeriod" class="form-select form-select-sm">
                            <option value="30">30 ημέρες</option>
                            <option value="60">60 ημέρες</option>
                            <option value="90">90 ημέρες</option>
                            <option value="year">Ετήσια</option>
                        </select>
                    </div>
                </div>

                <div id="erganhDashboardContent">
                    <div class="text-muted p-3">Φόρτωση...</div>
                </div>
            `,
            confirmButtonText: 'Κλείσιμο',
            customClass: {
                confirmButton: 'class-secondary custom-confirm-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup-wide erganh-dashboard-swal',
                htmlContainer: 'custom-html-container erganh-dashboard-html-container'
            },
            didOpen: async () => {
                const periodSelect = document.getElementById('erganhDashboardPeriod');

                if (periodSelect) {
                    periodSelect.value = currentPeriod;
                    periodSelect.addEventListener('change', async () => {
                        currentPeriod = periodSelect.value;

                        const container = document.getElementById('erganhDashboardContent');
                        if (container) {
                            container.innerHTML = '<div class="text-muted p-3">Φόρτωση...</div>';
                        }

                        await refreshDashboardHtml();
                    });
                }

                await refreshDashboardHtml();
            },
            willClose: () => {
                destroyErganhDashboardCharts();
            }
        });
    }

    let erganhTotalsChart = null;
    let erganhStatusChart = null;
    let erganhProcessChart = null;

    function renderErganhDashboardCharts(payload) {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js δεν έχει φορτωθεί.');
            return;
        }

        const totals = payload?.totals || {};
        const byProcess = payload?.byProcess || [];

        if (erganhTotalsChart) erganhTotalsChart.destroy();
        if (erganhStatusChart) erganhStatusChart.destroy();
        if (erganhProcessChart) erganhProcessChart.destroy();

        const totalsCanvas = document.getElementById('erganhTotalsChart');
        const statusCanvas = document.getElementById('erganhStatusChart');
        const processCanvas = document.getElementById('erganhProcessChart');

        if (totalsCanvas) {
            erganhTotalsChart = new Chart(totalsCanvas, {
                type: 'bar',
                data: {
                    labels: ['REST', 'XML', 'ACTIVE', 'CANCELLED', 'FAILED'],
                    datasets: [
                        {
                            label: 'Υποβολές',
                            data: [
                                Number(totals.rest) || 0,
                                Number(totals.xml) || 0,
                                Number(totals.active) || 0,
                                Number(totals.cancelled) || 0,
                                Number(totals.failed) || 0
                            ]
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        if (statusCanvas) {
            erganhStatusChart = new Chart(statusCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['ACTIVE', 'CANCELLED', 'FAILED'],
                    datasets: [
                        {
                            data: [
                                Number(totals.active) || 0,
                                Number(totals.cancelled) || 0,
                                Number(totals.failed) || 0
                            ]
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        if (processCanvas) {
            erganhProcessChart = new Chart(processCanvas, {
                type: 'bar',
                data: {
                    labels: byProcess.map((r) => r.processCode || 'UNKNOWN'),
                    datasets: [
                        {
                            label: 'Σύνολο',
                            data: byProcess.map((r) => Number(r.count) || 0)
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }

    // ============================================================================
    // ✅ SOCKET.IO - ERGANH REAL-TIME STATUS UPDATES
    // ============================================================================

    if (typeof socket !== 'undefined' && socket) {
        console.log('✅ [ERGANH] Socket.io event listeners initialized');

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
                html: `<p>${data.message || 'Επιτυχής αποστολή!'}</p>${protocolHtml}`,
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
