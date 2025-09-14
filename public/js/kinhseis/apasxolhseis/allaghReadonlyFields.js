    document.querySelectorAll("[id^=updateButton]").forEach(button => {
        button.addEventListener("click", function(event) {
            hasRecord = false;
            event.preventDefault(); // Αποτρέπει τη μετάβαση αν είναι <a>
    
            // Εντοπισμός του section/tab στο οποίο ανήκει το πατημένο κουμπί
            document.querySelectorAll("section").forEach(section => {
                const saveButton = section.querySelector("[id^=saveButton]");
                const updateButton = section.querySelector("[id^=updateButton]");
                const undoButton = section.querySelector("[id^=undoButton]");
                const deleteButton = section.querySelector("[id^=deleteButton]");
            
                // Όταν πατιέται το updateButton:
                disableButton_ReadOnly(updateButton); // Απενεργοποίηση updateButton
                enableButton_ReadOnly(undoButton); // Ενεργοποίηση undoButton
                enableButton_ReadOnly(saveButton); // Ενεργοποίηση saveButton
                disableButton_ReadOnly(deleteButton); // Ενεργοποίηση deleteButton
        
                // Ενεργοποίηση των input πεδίων
                toggleReadonlyFields(false);
            });
        });
    });
    
    document.querySelectorAll("[id^=undoButton]").forEach(button => {
        button.addEventListener("click", async function(event) {
            event.preventDefault(); // Αποτρέπει τη μετάβαση αν είναι <a>
    
            // Ενημέρωση όλων των sections
            document.querySelectorAll("section").forEach(section => {
                const updateButton = section.querySelector("[id^=updateButton]");
                const undoButton = section.querySelector("[id^=undoButton]");
                const saveButton = section.querySelector("[id^=saveButton]");
                const deleteButton = section.querySelector("[id^=deleteButton]");
    
                // Όταν πατιέται το undoButton:
                enableButton_ReadOnly(updateButton); // Ενεργοποίηση updateButton
                disableButton_ReadOnly(undoButton); // Απενεργοποίηση undoButton
                disableButton_ReadOnly(saveButton); // Απενεργοποίηση saveButton
                enableButton_ReadOnly(deleteButton); // Ενεργοποίηση deleteButton
            });
    
            // Κάνει όλα τα input fields readonly
            toggleReadonlyFields(true);
    
            // Παίρνουμε τα δεδομένα ΜΟΝΟ από το section "Αποδοχές"
            let apodoxesData = getApodoxesFields();
            if (!apodoxesData) {
                console.error("Δεν βρέθηκαν τα δεδομένα από το section 'Αποδοχές'");
                return;
            }
    
            // Κάνουμε API request με τα δεδομένα από το "Αποδοχές"
            const apasxolhseis_data = await fetch(`/api/kinhseis/getApasxolhseis?team=${apodoxesData.selectedTeam}&company=${apodoxesData.selectedCompany}&employeeKod=${apodoxesData.selectedKodikos}&xrhsh=${apodoxesData.selectedEtos}&periodos=${apodoxesData.selectedPeriodos}&typos_apodoxon=${apodoxesData.selectedTyposApodoxon}&aa_misthodosias=${apodoxesData.selectedAaMisthodosias}`);
    
            const apasxolhseis_result = await apasxolhseis_data.json();
    
            try {
                let module;
                const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'; 
                // Χρησιμοποιούμε dynamic import()
                module = isProduction ? await import('/min.js/kinhseis/fillFieldsKinhseon.min.js') : await import('../ypologismoi/fillFieldsKinhseon.js');
                
                // Αποσυγκέντρωση των συναρτήσεων αφού φορτωθεί το module
                const { 
                    fillFields, 
                    loadKrathseis_Edit,
                    updatePosostaFields_Edit,
                    setValue_Edit,
                    clearRowFields_Edit
                } = module;
                        
                // Καλείται η συνάρτηση του module με το sharedParams
                if (module) {
                    await fillFields(apasxolhseis_result, sharedParams);
                }
    
            } catch (error) {
                console.error(`Σφάλμα κατά τη φόρτωση του module:`, error);
            }
            
            hasRecord = true;
        });
    });

    document.querySelectorAll("[id^=deleteButton]").forEach(button => {
        button.addEventListener("click", async function(event) {
            event.preventDefault(); // Αποτρέπει το default action
    
            // 🔹 Παίρνουμε τα δεδομένα ΜΟΝΟ από το section "Αποδοχές"
            let apodoxesData = getApodoxesFields();
            if (!apodoxesData) {
                console.error("Δεν βρέθηκαν τα δεδομένα από το section 'Αποδοχές'");
                return;
            }
    
            try {
                // 🔹 Κλήση της deleteRecord με το σωστό ID
                let deleteResponse = await deleteRecord(apodoxesData.selectedId);
                
                if (deleteResponse.success) {
                    Swal.fire({
                        icon: "success",
                        title: "Επιτυχής Διαγραφή",
                        text: "Η εγγραφή διαγράφηκε επιτυχώς!",
                        timer: 3000,
                        confirmButtonText: "Κλείσιμο",
                        customClass: {
                            title: 'custom-title',
                            popup: "custom-swal-popup",
                            confirmButton: "class-error custom-confirm-button custom-swal-button",
                            cancelButton: "custom-cancel-button custom-swal-button",
                        },
                        willClose: () => {
                            // 🔹 Μετά τη διαγραφή, ενημερώνουμε όλα τα sections
                            hasRecord = false;
                            applyButtonPermissions(hasRecord);
                        }
                    });
                } else {
                    Swal.fire({
                        icon: "error",
                        title: "Αποτυχία Διαγραφής",
                        text: "Η διαγραφή απέτυχε! Παρακαλώ δοκιμάστε ξανά.",
                        confirmButtonText: "OK",
                        customClass: {
                            title: 'custom-title',
                            popup: "custom-swal-popup",
                            confirmButton: "class-error custom-confirm-button custom-swal-button",
                            cancelButton: "custom-cancel-button custom-swal-button",
                        },
                    });
                }
            } catch (error) {
                console.error("Σφάλμα κατά τη διαγραφή της εγγραφής:", error);
                Swal.fire({
                    icon: "error",
                    title: "Σφάλμα",
                    text: "Προέκυψε σφάλμα κατά τη διαγραφή. Παρακαλώ επικοινωνήστε με τον διαχειριστή.",
                    confirmButtonText: "OK",
                    customClass: {
                        title: 'custom-title',
                        popup: "custom-swal-popup",
                        confirmButton: "class-error custom-confirm-button custom-swal-button",
                        cancelButton: "custom-cancel-button custom-swal-button",
                    },
        
                });
            }
        });
    });
        
    function getApodoxesFields() {
        let apodoxesSection = document.querySelector("[data-section='Αποδοχές']") || document.querySelector(".sel_1_section");
        if (!apodoxesSection) {
            console.warn("Το section 'Αποδοχές' δεν βρέθηκε!");
            return null;
        }
    
        return {
            selectedId: apodoxesSection.querySelector("#idKinhseonHidden") ? apodoxesSection.querySelector("#idKinhseonHidden").value : null,
            selectedTeam: apodoxesSection.querySelector("#team") ? apodoxesSection.querySelector("#team").value : null,
            selectedCompany: apodoxesSection.querySelector("#company_kod") ? apodoxesSection.querySelector("#company_kod").value : null,
            selectedKodikos: apodoxesSection.querySelector("#kodikosHidden") ? apodoxesSection.querySelector("#kodikosHidden").value : null,
            selectedPeriodos: apodoxesSection.querySelector("#periodos") ? apodoxesSection.querySelector("#periodos").value : null,
            selectedTyposApodoxon: apodoxesSection.querySelector("#typosApodoxon") ? apodoxesSection.querySelector("#typosApodoxon").value : null,
            selectedEtos: apodoxesSection.querySelector("#etos") ? apodoxesSection.querySelector("#etos").value : null,
            selectedAaMisthodosias: apodoxesSection.querySelector("#aaMisthodosias") ? apodoxesSection.querySelector("#aaMisthodosias").value : null
        };
    }

    async function deleteRecord(id) {
        let deleteUrl = "/kinhseis/apasxolhseis/delete/" + id;
    
        // 🔹 Επιβεβαίωση διαγραφής με SweetAlert
        const result = await Swal.fire({
            title: "Είστε σίγουροι;",
            html: `<strong>ΠΡΟΣΟΧΗ!!! <br>Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια!</strong> <br><br>Με την διαγραφή της εγγραφής απασχολήσεων <br>θα διαγραφούν (απ΄ όλα τα αρχεία) οι εγγραφές, <br>που αφορούν την συγκεκριμένη εγγραφή.`,
            icon: "warning",
            showCancelButton: true,
            focusConfirm: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Ναι, Διαγραφή!",
            cancelButtonText: "Ακύρωση",
            customClass: {
                title: 'custom-title',
                popup: "custom-swal-popup",
                confirmButton: "class-error custom-confirm-button custom-swal-button",
                cancelButton: "custom-cancel-button custom-swal-button",
            },
            didOpen: () => {
                // 🔹 Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
                Swal.getCancelButton().focus();
            },
        });
    
        // 🔹 Αν ο χρήστης πάτησε "Ακύρωση", απλά επιστρέφουμε και **δεν εμφανίζουμε τίποτα**
        if (result.dismiss === Swal.DismissReason.cancel) {
            return { success: false, cancelled: true }; // Προσθέτουμε το `cancelled: true`
        }
    
        // 🔹 Αν επιβεβαίωσε τη διαγραφή
        if (result.isConfirmed) {
            try {
                const response = await fetch(deleteUrl, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
    
                if (!response.ok) throw new Error("Η διαγραφή απέτυχε!");
    
                return { success: true };
            } catch (error) {
                return { success: false }; // Αν γίνει σφάλμα, θα επιστρέψει false
            }
        }
    
        return { success: false };
    }
            
    async function toggleReadonlyFields(isReadonly) {
        document.querySelectorAll('.alreadyExists').forEach(field => {
           field.readOnly = isReadonly;
        });
    }

    function enableButton_ReadOnly(button) {
        if (button.tagName.toLowerCase() === "button") {
            button.disabled = false;
        } else if (button.tagName.toLowerCase() === "a") {
            button.classList.remove("is-disabled", "disabled-link");
            button.removeAttribute("aria-disabled");
            button.tabIndex = 0; // επιτρέπει focus
        }
    }

    function disableButton_ReadOnly(button) {
        if (button.tagName.toLowerCase() === "button") {
            button.disabled = true;
        } else if (button.tagName.toLowerCase() === "a") {
            button.classList.add("is-disabled", "disabled-link");
            button.setAttribute("aria-disabled", "true");
            button.tabIndex = -1;
        }
    }
