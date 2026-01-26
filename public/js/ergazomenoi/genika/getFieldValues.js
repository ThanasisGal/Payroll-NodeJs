// public\js\ergazomenoi\genika\getFieldValues.js

document.addEventListener("DOMContentLoaded", () => {
    const isEmpty = v => !String(v ?? "").trim();
    const isEmptyArray = v => !Array.isArray(v) || v.length === 0;
    let message = "";

    async function handleFormSubmit(event) {
        event.preventDefault();
        event.stopPropagation();

        const formData = {};
        const filePromises = [];
        const sections = document.querySelectorAll(".card-body");

        // =========================================================================
        // COLLECT FORM DATA
        // =========================================================================
        
        sections.forEach((section) => {
            const inputs = section.querySelectorAll("input, select, textarea");
            inputs.forEach((input) => {
                // Έλεγχος για INPUT
                if (input.tagName === "INPUT") {
                    // Readonly ή Disabled inputs
                    if (input.hasAttribute("readonly") || input.hasAttribute("disabled")) {
                        formData[input.name] = input.value;
                    } 
                    // Checkbox
                    else if (input.type === "checkbox") {
                        formData[input.name] = input.checked;
                    } 
                    // Date (κενό)
                    else if (input.type === "date" && input.value === "") {
                        formData[input.name] = null;
                    } 
                    // Time (κενό)
                    else if (input.type === "time" && input.value === "") {
                        formData[input.name] = null;
                    } 
                    // Number (κενό)
                    else if (input.type === "number" && input.value === "") {
                        formData[input.name] = 0;
                    } 
                    // File upload
                    else if (input.type === "file" && input.files.length > 0) {
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
                    // Κανονικό input
                    else {
                        formData[input.name] = input.value;
                    }
                } 
                // Έλεγχος για TEXTAREA
                else if (input.tagName === "TEXTAREA") {
                    // Disabled ή readonly textarea
                    if (input.hasAttribute("readonly") || input.hasAttribute("disabled")) {
                        formData[input.name] = input.value;
                    } else {
                        formData[input.name] = input.value;
                    }
                } 
                // Έλεγχος για SELECT
                else if (input.tagName === "SELECT") {
                    // Disabled select
                    if (input.hasAttribute("disabled")) {
                        if (input.multiple) {
                            const selectedOptions = Array.from(input.selectedOptions).map(option => option.value);
                            formData[input.name] = selectedOptions.length > 0 ? selectedOptions : [];
                        } else {
                            formData[input.name] = input.selectedIndex === -1 ? null : input.options[input.selectedIndex].value;
                        }
                    } 
                    // Κανονικό select
                    else {
                        if (input.multiple) {
                            const selectedOptions = Array.from(input.selectedOptions).map(option => option.value);
                            formData[input.name] = selectedOptions.length > 0 ? selectedOptions : [];
                        } else {
                            formData[input.name] = input.selectedIndex === -1 ? null : input.options[input.selectedIndex].value;
                        }
                    }
                }
            });
        });

        // =========================================================================
        // ✅ NEW: CONVERT PDFs TO BASE64 (on-demand)
        // =========================================================================
        
        if (window.pdfUploadModule && window.pdfUploadModule.hasPendingUpload()) {
            console.log('📎 Converting PDFs to base64 for upload...');
            
            const pdfMappings = {
                'arxeio_symbashs': 'arxeio_apodoxhs_oron_atomikhs_symbashs_base64',
                'oysiodeis_oroi': 'arxeio_apodoxhs_oysiodon_oron_base64',
                'anhlikoi': 'bibliario_anhlikoy_base64',
                'allodapoi': 'arxeio_nomimopoihtikon_eggrafon_base64'
            };
            
            const allFiles = window.pdfUploadModule.getAllFiles();
            
            for (const fileInfo of allFiles) {
                const base64Field = pdfMappings[fileInfo.documentType];
                if (base64Field) {
                    try {
                        const base64Data = await window.pdfUploadModule.getFileAsBase64(fileInfo.documentType);
                        if (base64Data) {
                            formData[base64Field] = base64Data;
                            console.log(`✅ Added ${fileInfo.documentType} to formData (${(base64Data.length / 1024).toFixed(2)}KB)`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to convert ${fileInfo.documentType}:`, error);
                    }
                }
            }
        }

        console.log("📦 Συλλεγμένα δεδομένα φόρμας:", formData);

        try {
            await Promise.all(filePromises);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

            // =========================================================================
            // VALIDATION
            // =========================================================================
            
            // Ορισμός critical fields
            const CRITICAL_FIELDS = {
                'karta_ergasias': '⚠️ Κάρτα Εργασίας',
                'evelikth_proselefsh': '⚠️ Ευέλικτη Προσέλευση (λεπτά)',
                'systatiko_shmeioma': '⚠️ Τοποθέτηση με Συστατικό Σημείωμα',
                'topothethsh_me_programma': '⚠️ Τοποθέτηση με Πρόγραμμα',
            };

            const errors = [];

            // Helper function
            const addError = (fieldName, displayName) => {
                if (isEmpty(formData[fieldName])) {
                    const isCritical = CRITICAL_FIELDS.hasOwnProperty(fieldName);
                    errors.push({
                        text: isCritical ? CRITICAL_FIELDS[fieldName] : displayName,
                        critical: isCritical
                    });
                }
            };

            // Έλεγχοι
            addError('eponymoHidden', 'Επώνυμο');
            addError('onomaHidden', 'Όνομα');
            addError('afmHidden', 'ΑΦΜ');
            addError('amkaHidden', 'ΑΜΚΑ');
            addError('patronymo', 'Πατρώνυμο');
            addError('mhtronymo', 'Μητρώνυμο');
            addError('doy_stathera', 'Δ.Ο.Υ.');
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
            addError('ora_apoxorhshs_proths_foras', 'Ώρα Αποχώρησης από την Εργασία (κατά την 1η ημέρα πρόσληψης)');
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
                    if (formData.evelikth_proselefsh === "0" || formData.evelikth_proselefsh === 0 || isEmpty(formData.evelikth_proselefsh)) {
                        addError('evelikth_proselefsh', 'Ευέλικτη Προσέλευση (λεπτά)');
                    }
                }
            }

            if (errors.length) {
                const hasNonCriticalErrors = errors.some(error => !error.critical);
                
                if (hasNonCriticalErrors) {
                    const errorItems = errors.map((error, index) => {
                        const cssClass = error.critical ? 'error-item error-critical' : 'error-item';
                        return `<div class="${cssClass}"><strong>${index + 1}</strong>. ${error.text}</div>`;
                    }).join('');
                    
                    const gridHTML = `
                        <div class="error-grid-container">
                            <div class="error-grid">${errorItems}</div>
                        </div>
                    `;

                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: "warning",
                        title: "ΠΡΟΣΟΧΗ !!!",
                        html: `<p class="error-header">Τα παρακάτω ${errors.length} πεδία είναι υποχρεωτικά για την πρόσληψη:</p>
                        <p class="warning-header">Τα πεδία με το εικονίδιο ⚠️ είναι προειδοποιητικά και μόνο για επανέλεγχο</p>${gridHTML}`,
                        heightAuto: true,
                        confirmButtonText: "Κλείσιμο",
                        customClass: {
                            confirmButton: "class-warning custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                            htmlContainer: "custom-html-container",
                        },
                    });
                }
            }

            // =========================================================================
            // ΕΡΓΑΝΗ FILES SELECTION
            // =========================================================================
            
            const result = await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'info',
                title: 'ΑΜΕΣΗ ΕΝΗΜΕΡΩΣΗ ΕΡΓΑΝΗ ΙΙ',
                html: `
                    <div class="display-flex flex-direction-column left-align gap-1rem padding-1rem">
                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="checkbox" id="e3_anaggelia_proslhpshs" name="files" value="e3_anaggelia_proslhpshs" checked 
                                class="custom-checkbox" />
                            <label for="e3_anaggelia_proslhpshs" class="margin-0 cursor-pointer font-size-rem-1_05">
                                Αναγγελία Πρόσληψης
                            </label>
                        </div>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="checkbox" id="schedules" name="files" value="schedules" checked 
                                class="custom-checkbox" />
                            <label for="schedules" class="margin-0 cursor-pointer font-size-rem-1_05">
                                Δήλωση Μεταβολής Στοιχείων Εργασιακής Σχέσης
                            </label>
                        </div>

                        <div class="display-flex align-items-center gap-0_75rem">
                            <input type="checkbox" id="history" name="files" value="history" checked 
                                class="custom-checkbox" />
                            <label for="history" class="margin-0 cursor-pointer font-size-rem-1_05">
                                Ψηφιακό Οργάνωση Χρόνου Εργασίας
                            </label>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                preConfirm: () => {
                    const filesToUpdate = {
                        e3_anaggelia_proslhpshs: document.getElementById('e3_anaggelia_proslhpshs').checked,
                        schedules: document.getElementById('schedules').checked,
                        history: document.getElementById('history').checked
                    };
                    return filesToUpdate;
                },
                confirmButtonText: 'Ενημέρωση',
                cancelButtonText: 'Ακύρωση',
                showCancelButton: true,
                customClass: {
                    confirmButton: "class-info custom-confirm-button custom-swal-button",
                    cancelButton: "class-secondary custom-cancel-button custom-swal-button",
                    title: 'custom-title',
                    popup: "custom-swal-popup",
                    htmlContainer: 'custom-html-container',
                },
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
                filesToUpdate: result.value
            };

            console.log('🚀 Sending POST request...');
            
            const response = await fetch("/ergazomenoi/ergazomenoi/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });

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
                const loc = response.headers.get("Location") || response.headers.get("location");
                if (loc) {
                    const abs = loc.startsWith("http") ? loc : new URL(loc, window.location.origin).toString();
                    window.location.href = abs;
                    return;
                }
                throw new Error(`Redirect ${response.status} χωρίς Location header`);
            }

            // 3) CSRF/Forbidden
            if (response.status === 403) {
                throw new Error("CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.");
            }

            // 4) 204 No Content
            if (response.status === 204) {
                if (window.pdfUploadModule && window.pdfUploadModule.hasPendingUpload()) {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: "warning",
                        title: "Ο εργαζόμενος αποθηκεύτηκε",
                        html: `<p><strong>Αλλά το PDF δεν ανέβηκε!</strong></p>
                            <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                                Ο server επέστρεψε 204 No Content χωρίς ID εργαζόμενου.
                            </p>`,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: "class-warning custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        },
                    }).then(() => window.location.href = "/ergazomenoi/ergazomenoi");
                } else {
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: "success",
                        title: "Επιτυχής καταχώριση!",
                        timer: 1200,
                        showConfirmButton: false,
                        customClass: {
                            confirmButton: "class-success custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        },
                    }).then(() => window.location.href = "/ergazomenoi/ergazomenoi");
                }
                return;
            }

            // 5) ✅ JSON RESPONSE (MAIN SUCCESS PATH)
            const ct = response.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
                const data = await response.json();
                message = data?.errorMessage || "";
                
                if (!response.ok || !data?.success) {
                    throw new Error(`HTTP ${response.status} / success=${data?.success}`);
                }
                
                console.log('✅ Server response:', data);
                
                // ✅ CHECK: Did we send PDFs?
                const hadPdfs = window.pdfUploadModule && window.pdfUploadModule.hasPendingUpload();
                
                // ✅ CHECK: Did backend save the PDFs?
                const pdfResults = data?.pdfResults || [];
                const successfulPdfs = pdfResults.filter(r => r.success);
                const failedPdfs = pdfResults.filter(r => !r.success);
                
                console.log(`📊 PDF Results: ${successfulPdfs.length} success, ${failedPdfs.length} failed`);
                
                // ✅ Clear in-memory PDFs (no longer needed)
                if (hadPdfs && window.pdfUploadModule.clearAllFiles) {
                    window.pdfUploadModule.clearAllFiles();
                    console.log('🗑️ Cleared in-memory PDFs');
                }
                
                // ✅ Success/Warning Messages
                if (failedPdfs.length === 0) {
                    // ✅ ALL PDFs saved successfully (or no PDFs at all)
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: "success",
                        title: "Επιτυχής καταχώριση!",
                        html: successfulPdfs.length > 0
                            ? `<p>Ο εργαζόμενος αποθηκεύτηκε!</p><p class="text-success">✅ ${successfulPdfs.length} PDF αποθηκεύτηκαν επιτυχώς</p>`
                            : "<p>Ο εργαζόμενος αποθηκεύτηκε επιτυχώς!</p>",
                        timer: 1500,
                        showConfirmButton: false,
                        customClass: {
                            confirmButton: "class-success custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        },
                    }).then(() => {
                        window.location.href = data.redirectUrl || "/ergazomenoi/ergazomenoi";
                    });
                } else {
                    // ⚠️ Some PDFs failed to save
                    const failedTypes = failedPdfs.map(f => f.documentType).join(', ');
                    
                    await Swal.fire({
                        backdrop: false,
                        allowOutsideClick: false,
                        icon: "warning",
                        title: "Ο εργαζόμενος αποθηκεύτηκε",
                        html: `
                            <p><strong>Αλλά ${failedPdfs.length} PDF απέτυχαν!</strong></p>
                            <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                                Αποτυχία: ${failedTypes}
                            </p>
                            <p style="color: #999; font-size: 0.85rem; margin-top: 10px;">
                                Μπορείτε να τα ανεβάσετε αργότερα από την επεξεργασία.
                            </p>
                        `,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: "class-warning custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        },
                    }).then(() => {
                        window.location.href = data.redirectUrl || "/ergazomenoi/ergazomenoi";
                    });
                }
                
                return;
            }

            // 6) Other content-type but OK (e.g., HTML)
            if (response.ok) {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής καταχώριση!",
                    timer: 1200,
                    showConfirmButton: false,
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => window.location.href = "/ergazomenoi/ergazomenoi");
                return;
            }

            // 7) HTTP Error
            throw new Error(`HTTP error ${response.status}`);

        } catch (err) {
            console.error('❌ Form submission error:', err);
            
            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: "error",
                title: "Αποτυχία αποθήκευσης",
                timer: 5200,
                text: String(message || err),
                showConfirmButton: true,
                confirmButtonText: "Κλείσιμο",
                customClass: {
                    confirmButton: "class-error custom-confirm-button custom-swal-button",
                    title: "custom-title",
                    popup: "custom-swal-popup",
                },
            });
        }
    }

    const buttons = document.querySelectorAll(".submitButton");

    buttons.forEach((button) => {
        button.addEventListener("click", handleFormSubmit);
    });
    
    console.log('✅ Form submission handler initialized');
});