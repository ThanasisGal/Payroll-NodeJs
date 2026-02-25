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
                // =====================================================================
                // ✅ INPUT HANDLING
                // =====================================================================
                if (input.tagName === "INPUT") {
                    
                    // ✅ 1. CHECKBOX (πρώτο, γιατί έχει priority)
                    if (input.type === "checkbox") {
                        formData[input.name] = input.checked === true;
                    } 
                    
                    // ✅ 2. HIDDEN BOOLEAN (δεύτερο)
                    else if (input.type === "hidden" && (input.value === "true" || input.value === "false")) {
                        formData[input.name] = input.value === "true";
                    }
                    
                    // ✅ 3. DATE (κενό)
                    else if (input.type === "date") {
                        formData[input.name] = input.value === "" ? null : input.value;
                    } 
                    
                    // ✅ 4. TIME (κενό)
                    else if (input.type === "time") {
                        formData[input.name] = input.value === "" ? null : input.value;
                    } 
                    
                    // ✅ 5. NUMBER
                    else if (input.type === "number") {
                        const parsed = parseFloat(input.value);
                        formData[input.name] = isNaN(parsed) ? 0 : parsed;
                    } 
                    
                    // ✅ 6. FILE
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
                    
                    // ✅ 7. READONLY/DISABLED (τελευταίο fallback)
                    else if (input.hasAttribute("readonly") || input.hasAttribute("disabled")) {
                        // Ειδική περίπτωση: αν είναι number, parse το
                        if (input.type === "number") {
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
                else if (input.tagName === "TEXTAREA") {
                    formData[input.name] = input.value;
                } 
                
                // =====================================================================
                // ✅ SELECT HANDLING
                // =====================================================================
                else if (input.tagName === "SELECT") {
                    if (input.multiple) {
                        const selectedOptions = Array.from(input.selectedOptions).map(option => option.value);
                        formData[input.name] = selectedOptions.length > 0 ? selectedOptions : [];
                    } else {
                        formData[input.name] = input.selectedIndex === -1 ? null : input.options[input.selectedIndex].value;
                    }
                }
            });
        });

        // =========================================================================
        // ✅ CONVERT PDFs TO BASE64 (using pdfUploadModule - PRIMARY SOURCE)
        // =========================================================================

        // Map document types to form field names
        const pdfMappings = {
            'arxeio_symbashs': 'arxeio_apodoxhs_oron_atomikhs_symbashs_base64',
            'oysiodeis_oroi': 'arxeio_apodoxhs_oysiodon_oron_base64',
            'anhlikoi': 'bibliario_anhlikoy_base64',
            'allodapoi': 'arxeio_nomimopoihtikon_eggrafon_base64',
            'symbash_daneismoy': 'arxeio_symbashs_daneismoy_base64'
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
                        const base64Data = await window.pdfPreviewModule.getFileAsBase64(documentType);
                        
                        if (base64Data) {
                            formData[base64Field] = base64Data;
                        }
                    } catch (error) {
                        console.error(`❌ Failed to convert ${documentType} from preview module:`, error);
                    }
                }
            }
        }

        // console.log("📦 Συλλεγμένα δεδομένα φόρμας:", formData);

        try {
            await Promise.all(filePromises);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

            // =========================================================================
            // VALIDATION
            // =========================================================================
            
            // Ορισμός critical fields
            const CRITICAL_FIELDS = {
                'email': '⚠️ Emai Εργαζόμενου/ης',
                'karta_ergasias': '⚠️ Κάρτα Εργασίας',
                'evelikth_proselefsh': '⚠️ Ευέλικτη Προσέλευση (λεπτά)',
                'systatiko_shmeioma': '⚠️ Τοποθέτηση με Συστατικό Σημείωμα',
                'topothethsh_me_programma': '⚠️ Τοποθέτηση με Πρόγραμμα',
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
                        return `<div class="${cssClass}"><strong>${index + 1}</strong>.${error.text}</div>`;
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
                    // return;
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
                    
                    // ✅ DEBUG: Log checkbox values
                    console.log('🔍 [FRONTEND] Checkboxes:', {
                        e3_checkbox_element: document.getElementById('e3_anaggelia_proslhpshs'),
                        e3_checked: document.getElementById('e3_anaggelia_proslhpshs')?.checked,
                        filesToUpdate: filesToUpdate
                    });
                    
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

            // ============================================================================
            // ✅ SHOW PROGRESS BAR MODAL
            // ============================================================================

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
                    // ✅ Start progress simulation
                    startProgressAnimation();
                }
            });

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
                setTimeout(updateProgress, 500);
            }

            const response = await fetch("/ergazomenoi/ergazomenoi/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            // ============================================================================
            // ✅ SMOOTH PROGRESS COMPLETION
            // ============================================================================

            // Calculate minimum wait time (sum of all animation durations: ~9.6s)
            const minimumAnimationTime = 800 + 1500 + 2000 + 3000 + 1500 + 800 + 500; // ~10.1 seconds

            // Wait minimum 3 seconds so user can see the progress animation
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Smoothly transition to 100%
            const progressBar = document.getElementById('pdf-progress-bar');
            const progressText = document.getElementById('progress-step-text');

            if (progressBar && progressText) {
                // Force 100% completion
                progressBar.style.width = '100%';
                progressBar.textContent = '100%';
                progressBar.classList.remove('progress-bar-animated');
                progressBar.setAttribute('aria-valuenow', 100);
                progressText.textContent = 'Ολοκλήρωση...';
                
                // Show completion message for 1 second
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // Close progress modal smoothly
            Swal.close();

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
                
                // ✅ CHECK: Did we send PDFs?
                const hadPdfs = window.pdfUploadModule && window.pdfUploadModule.hasPendingUpload();
                
                // ✅ CHECK: Did backend save the PDFs?
                const pdfResults = data?.pdfResults || [];
                const successfulPdfs = pdfResults.filter(r => r.success);
                const failedPdfs = pdfResults.filter(r => !r.success);
                
                // ✅ CHECK: Was E3 XML generated?
                const e3XmlData = data?.e3XmlData || null;
                const hasE3Xml = e3XmlData && e3XmlData.success === true;
                
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
                                window.location.href = data.redirectUrl || "/ergazomenoi/ergazomenoi";
                            });
                            
                            return;
                        }
                        
                        // ✅ Get employee name from form data
                        const employeeName = `${formData.eponymoHidden || ''} ${formData.onomaHidden || ''}`.trim() || 'UNKNOWN';

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
                        
                        await showContractPdfModalAndWait(
                            data.contractPdf.url, 
                            data.contractPdf.s3Key,
                            data.redirectUrl || "/ergazomenoi/ergazomenoi",
                            employeeName,
                            companyData,
                            e3XmlData,
                            data.data?._id  // ✅ Pass ergazomenos ID for ERGANH upload
                        );
                        
                        // =====================================================================
                        // ✅ AFTER MODAL CLOSES (STEP 2) - Upload to ERGANH happens automatically
                        // (handled inside showContractPdfModalAndWait function)
                        // =====================================================================
                        
                    } else {
                        // =====================================================================
                        // ✅ NO PDF PREVIEW - Show success with E3 XML download
                        // =====================================================================
                        const e3XmlHtml = hasE3Xml 
                            ? `<p class="text-success mt-3">✅ E3 XML δημιουργήθηκε επιτυχώς!</p>
                            <a href="${e3XmlData.downloadUrl}" 
                                download="${e3XmlData.filename}"
                                class="btn btn-sm btn-outline-primary mt-2">
                                <i class="bi bi-download"></i> Λήψη E3 XML
                            </a>`
                            : '';
                        
                        await Swal.fire({
                            backdrop: false,
                            allowOutsideClick: false,
                            icon: "success",
                            title: "Επιτυχής καταχώριση!",
                            html: `
                                <p>Ο εργαζόμενος αποθηκεύτηκε!</p>
                                ${successfulPdfs.length > 0 
                                    ? `<p class="text-success">✅ ${successfulPdfs.length} PDF αποθηκεύτηκαν επιτυχώς</p>` 
                                    : ''}
                                ${e3XmlHtml}
                            `,
                            timer: hasE3Xml ? null : 1500,
                            showConfirmButton: hasE3Xml,
                            confirmButtonText: 'OK',
                            customClass: {
                                confirmButton: "class-success custom-confirm-button custom-swal-button",
                                title: "custom-title",
                                popup: "custom-swal-popup",
                            },
                        });
                        
                        // ✅ UPLOAD TO ERGANH (if E3 XML exists) - then redirect
                        if (e3XmlData?.success && e3XmlData?.s3Url && data.data?._id) {
                            await uploadToErganh(data.data._id, e3XmlData.s3Url);
                        }
                        
                        window.location.href = data.redirectUrl || "/ergazomenoi/ergazomenoi";
                    }
                } else {
                    // =====================================================================
                    // ⚠️ SOME PDFs FAILED TO SAVE
                    // =====================================================================
                    const failedTypes = failedPdfs.map(f => f.documentType).join(', ');

                    const e3XmlHtml = hasE3Xml 
                        ? `<p class="text-success mt-3">✅ E3 XML δημιουργήθηκε επιτυχώς!</p>
                        <a href="${e3XmlData.downloadUrl}" 
                            download="${e3XmlData.filename}"
                            class="btn btn-sm btn-outline-primary mt-2">
                            <i class="bi bi-download"></i> Λήψη E3 XML
                        </a>`
                        : '';
                
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
                            ${e3XmlHtml}
                        `,
                        confirmButtonText: 'OK',
                        customClass: {
                            confirmButton: "class-warning custom-confirm-button custom-swal-button",
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        },
                    });
                    
                    // ✅ UPLOAD TO ERGANH (if E3 XML exists) - then redirect
                    if (e3XmlData?.success && e3XmlData?.s3Url && data.data?._id) {
                        await uploadToErganh(data.data._id, e3XmlData.s3Url);
                    }
                    
                    window.location.href = data.redirectUrl || "/ergazomenoi/ergazomenoi";
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

    // ============================================================================
    // ✅ PDF CONTRACT PREVIEW MODAL (WITH ERGANH UPLOAD AFTER MANUAL CLOSE)
    // ============================================================================

    async function showContractPdfModalAndWait(pdfUrl, s3Key, redirectUrl, employeeName = 'UNKNOWN', companyData = {}, e3XmlData = null, ergazomenosId = null) {
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
            const emailInput = document.getElementById('email') || document.querySelector('input[name="email"]');
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
            
            const closeModal = async () => {
                modal.classList.add('hidden');
                iframe.src = '';

                const needsUpload = !!(e3XmlData?.success && ergazomenosId);

                console.log('[E3PATH] closeModal', {
                    success: e3XmlData?.success,
                    s3Key: e3XmlData?.s3Key,
                    relativePath: e3XmlData?.relativePath,
                    ergazomenosId
                });

                // Αν δεν υπάρχει κάτι για upload -> redirect κατευθείαν
                if (!needsUpload) {
                    resolve();
                    window.location.href = redirectUrl;
                    return;
                }

                // ✅ Στέλνουμε στο backend ΜΟΝΟ string path/url
                const s3UrlToSend =
                    e3XmlData?.relativePath ||
                    e3XmlData?.s3Url ||
                    e3XmlData?.downloadUrl ||
                    null;

                if (!s3UrlToSend || typeof s3UrlToSend !== 'string') {
                    console.error('[E3PATH] Missing/invalid s3UrlToSend', s3UrlToSend);
                        await Swal.fire({
                        icon: 'error',
                        title: 'ΕΡΓΑΝΗ ΙΙ',
                        text: 'Δεν βρέθηκε το path του XML για αποστολή.',
                        confirmButtonText: 'OK'
                    });
                    resolve();
                    window.location.href = redirectUrl;
                    return;
                }

                try {
                    // ✅ Loader (blocking endpoint)
                    Swal.fire({
                        title: 'ΕΡΓΑΝΗ ΙΙ',
                        text: 'Γίνεται αποστολή... Παρακαλώ περιμένετε.',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didOpen: () => Swal.showLoading()
                    });

                    // ✅ Αυτό θα δείξει success/error Swal μέσα στη συνάρτηση
                    await uploadToErganh(ergazomenosId, s3UrlToSend);

                    // ✅ redirect ΜΟΝΟ αφού τελειώσει και πατηθεί OK στο Swal
                    resolve();
                    window.location.href = redirectUrl;
                } catch (e) {
                    console.error('[E3PATH] uploadToErganh failed', e?.message || e);

                    await Swal.fire({
                        icon: 'error',
                        title: 'ΕΡΓΑΝΗ ΙΙ',
                        text: 'Αποτυχία αποστολής (σφάλμα εφαρμογής).',
                        confirmButtonText: 'OK'
                    });

                    resolve();
                    window.location.href = redirectUrl;
                }
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
                emailBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Αποστολή...';
                
                try {
                    // ✅ Send email request
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
                    
                    // ✅ Get form data for email
                    const fyloInput = document.getElementById('fylo') || document.querySelector('input[name="fylo"]');
                    const fyloValue = fyloInput?.value === 'true' || fyloInput?.checked === true;

                    const yphkoothtaInput = document.getElementById('yphkoothta_stathera') || document.querySelector('select[name="yphkoothta_stathera"]');
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
            if (downloadBtn) downloadBtn.onclick = downloadAndContinue;  // ✅ CHANGED!
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
                const modalBody = modal.querySelector('.modal-body') || modal.querySelector('.pdf-preview-container');
                if (modalBody) {
                    modalBody.appendChild(e3Container);
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
    // ============================================================================
    async function uploadToErganh(ergazomenosId, s3Url) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

        // ✅ Safety
        if (!s3Url || typeof s3Url !== 'string') {
            throw new Error('uploadToErganh: s3Url must be a string');
        }

        const uploadResponse = await fetch('/ergazomenoi/ergazomenoi/upload-e3-to-erganh', {
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
            payload = { success: false, message: await uploadResponse.text() };
        }

        // ✅ HTTP errors
        if (!uploadResponse.ok) {
            await Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: payload?.message || `HTTP ${uploadResponse.status}`,
                confirmButtonText: 'OK'
            });
            throw new Error(payload?.message || `HTTP ${uploadResponse.status}`);
        }

        // ✅ SUCCESS
        if (payload.success) {
            const protoHtml = payload.protocol
            ? `<div style="margin-top:8px;">Πρωτόκολλο: <b>${payload.protocol}</b></div>`
            : '';

            // ✅ Κλείνουμε το loading και δείχνουμε success — ΠΕΡΙΜΕΝΟΥΜΕ OK
            await Swal.fire({
                icon: 'success',
                title: 'ΕΡΓΑΝΗ ΙΙ',
                html: `Η υποβολή ολοκληρώθηκε.${protoHtml}`,
                confirmButtonText: 'OK'
            });

            return payload;
        }

        // ✅ FAIL (show messages)
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const extra = payload.error ? [payload.error] : [];
        const serverMessage = payload.message ? [payload.message] : [];
        const all = [...serverMessage, ...messages, ...extra].filter(Boolean);

        const escapeHtml = (s) =>
            String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

        const html = all.length
            ? `<div style="text-align:left;white-space:pre-wrap;max-height:360px;overflow:auto;">${all.map(escapeHtml).join('\n\n')}</div>`
            : 'Η υποβολή απέτυχε χωρίς συγκεκριμένο μήνυμα.';

        // ✅ Κλείνουμε το loading και δείχνουμε error — ΠΕΡΙΜΕΝΟΥΜΕ OK
        await Swal.fire({
            icon: 'error',
            title: 'Σφάλματα XML / Υποβολής',
            html,
            width: 820,
            confirmButtonText: 'OK'
        });

        return payload;
    }

    // ============================================================================
    // ✅ SOCKET.IO - ERGANH REAL-TIME STATUS UPDATES
    // ============================================================================
    
    if (typeof socket !== 'undefined' && socket) {
        console.log('✅ [ERGANH] Socket.io event listeners initialized');
        
        // ================================================================
        // ✅ ERGANH: UPLOAD STARTED
        // ================================================================
        socket.on('erganh:started', function(data) {
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
        socket.on('erganh:progress', function(data) {
            console.log('📡 [ERGANH] Progress:', data);
            
            // Define icons per step
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
        socket.on('erganh:success', function(data) {
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
                    // Pause timer on hover
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });
        });
        
        // ================================================================
        // ✅ ERGANH: ERROR
        // ================================================================
        socket.on('erganh:error', function(data) {
            console.error('📡 [ERGANH] Error:', data);
            
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: '❌ ΕΡΓΑΝΗ ΙΙ - Αποτυχία',
                html: `
                    <p>${data.message || 'Η αποστολή απέτυχε'}</p>
                    ${data.error ? `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">${data.error}</p>` : ''}
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