document.addEventListener("DOMContentLoaded", () => {
    const ergazomenoiDropdown = document.getElementById("ergazomenos_kin");
    const nextButton = document.getElementById("nextButton");
    const loaderContainer = document.querySelector(".loader-container");
    async function handleFormSubmit(event) {
        const formData = {};
        const filePromises = [];
        const sections = document.querySelectorAll(".card-body");

        sections.forEach((section) => {
            const inputs = section.querySelectorAll("input, select, textarea");
            inputs.forEach((input) => {
                if (input.tagName === "INPUT" && input.hasAttribute("readonly")) {
                    formData[input.name] = input.value;  // Προσθήκη τιμής από readonly input
                } else if (input.tagName === "INPUT") {
                    if (input.type === "checkbox") {
                        formData[input.name] = input.checked;
                    } else if (input.type === "date" && input.value === "") {
                        formData[input.name] = null;
                    } else if (input.type === "time" && input.value === "") {
                        formData[input.name] = null;
                    } else if (input.type === "number" && input.value === "") {
                        formData[input.name] = 0;
                    } else if (input.type === "file" && input.files.length > 0) {
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
                    } else {
                        formData[input.name] = input.value;
                    }
                } else if (input.tagName === "TEXTAREA") {
                    formData[input.name] = input.value;
                } else if (input.tagName === "SELECT") {
                    if (input.multiple) {
                        const selectedOptions = Array.from(input.selectedOptions).map(option => option.value);
                        formData[input.name] = selectedOptions.length > 0 ? selectedOptions : [];
                    } else {
                        formData[input.name] = input.selectedIndex === -1 ? null : input.options[input.selectedIndex].value;
                    }
                }
            });
        });

        console.log(formData);
        try {
            await Promise.all(filePromises);
            
            // Εμφάνιση sweetAlert με προσαρμοσμένο HTML για επιλογή των αρχείων προς ενημέρωση
            const result = await Swal.fire({
                title: 'Επιλογή αρχείων για ενημέρωση',
                html: `
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="enhmeroshApasxolhseon" name="files" value=" enhmeroshApasxolhseon" checked />
                    <label for=" enhmeroshApasxolhseon" id="label-enhmeroshApasxolhseon" style="margin-left: 0.75rem; font-size: 0.875vw;">
                    ${tenSpaces}Απασχολήσεων
                    </label><br>
                </div>
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="enhmeroshApd" name="files" value="enhmeroshApd" checked />
                    <label for="enhmeroshApd" id="label-enhmeroshApd" style="margin-left: 0.75rem; font-size: 0.875vw;">
                    ${tenSpaces}Α.Π.Δ.
                    </label><br>
                </div>
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="enhmeroshAstheneion" name="files" value="enhmeroshAstheneion" checked />
                    <label for="enhmeroshAstheneion" id="label-enhmeroshAstheneion" style="margin-left: 0.75rem; font-size: 0.875vw;">
                    ${tenSpaces}Ασθενειών
                    </label><br>
                </div>
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="enhmeroshAdeion" name="files" value="enhmeroshAdeion" checked />
                    <label for="enhmeroshAdeion" id="label-enhmeroshAdeion" style="margin-left: 0.75rem; font-size: 0.875vw;">
                    ${tenSpaces}Αδειών
                    </label><br>
                </div>
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="enhmeroshLogistikonArthron" name="files" value="enhmeroshLogistikonArthron" checked />
                    <label for="enhmeroshLogistikonArthron" id="label-enhmeroshLogistikonArthron" style="margin-left: 0.75rem; font-size: 0.875vw;">
                    ${tenSpaces}Λογιστικών Άρθρων
                    </label><br>
                </div>
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="enhmeroshForon" name="files" value="enhmeroshForon" checked />
                    <label for="enhmeroshForon" id="label-enhmeroshForon" style="margin-left: 0.75rem; font-size: 0.875vw;">
                    ${tenSpaces}Μηνιαίων Περιοδικών Παρακράτησης Φόρων
                    </label><br>
                </div>`,
                focusConfirm: false,
                preConfirm: () => {
                const filesToUpdate = {
                    enhmeroshApasxolhseon: document.getElementById('enhmeroshApasxolhseon').checked,
                    enhmeroshApd: document.getElementById('enhmeroshApd').checked,
                    enhmeroshAstheneion: document.getElementById('enhmeroshAstheneion').checked,
                    enhmeroshAdeion: document.getElementById('enhmeroshAdeion').checked,
                    enhmeroshLogistikonArthron: document.getElementById('enhmeroshLogistikonArthron').checked,
                    enhmeroshForon: document.getElementById('enhmeroshForon').checked
                };
                return filesToUpdate;
                },
                confirmButtonText: 'Ενημέρωση',
                cancelButtonText: 'Ακύρωση',
                customClass: {
                    confirmButton: "class-success custom-confirm-button custom-swal-button",
                    title: 'custom-title',
                    popup: "wide-popup",
                    showCancelButton: true,
                    cancelButton: "class-secondary custom-cancel-button custom-swal-button",
                },
            });
            
            if (!result.value) return;
            
            const response = await fetch("/kinhseis/apasxolhseis/add", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ formData, filesToUpdate: result.value }),
            });
        
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        
            const data = await response.json();
            if (data.success) {
                let itemsList = `<ul>`;
                if (result.value. enhmeroshApasxolhseon) {
                    itemsList += `<li><i class="bi bi-check-lg" style="color: green"></i> ${tenSpaces}Απασχολήσεων</li>`;
                }
                if (result.value.enhmeroshApd) {
                    itemsList += `<li><i class="bi bi-check-lg" style="color: green"></i> ${tenSpaces}Α.Π.Δ.</li>`;
                }
                if (result.value.enhmeroshAstheneion) {
                    itemsList += `<li><i class="bi bi-check-lg" style="color: green"></i> ${tenSpaces}Ασθενειών</li>`;
                }
                if (result.value.enhmeroshAdeion) {
                    itemsList += `<li><i class="bi bi-check-lg" style="color: green"></i> ${tenSpaces}Αδειών</li>`;
                }
                if (result.value.enhmeroshLogistikonArthron) {
                    itemsList += `<li><i class="bi bi-check-lg" style="color: green"></i> ${tenSpaces}Λογιστικών Άρθρών</li>`;
                }
                if (result.value.enhmeroshForon) {
                    itemsList += `<li><i class="bi bi-check-lg" style="color: green"></i> ${tenSpaces}Μηνιαίων Περιοδικών Παρακράτησης Φόρων</li>`;
                }
                itemsList += `</ul>`;
            
                Swal.fire({
                    icon: "success",
                    title: "Επιτυχής ενημέρωση των αρχείων:",
                    html: itemsList,
                    timer: 1500,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        title: 'custom-title',
                        popup: "custom-swal-popup",
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                    },
                // }).then(() => {
                //     window.location.href = data.redirectUrl;
                });
            } else {
                await Swal.fire({
                    icon: "error",
                    title: "Προσοχή",
                    html: data.errorMessage,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: 'custom-title',
                    },
                });
            }
        } catch (error) {
            console.error("Σφάλμα:", error);
            Swal.fire('Σφάλμα', 'Σφάλμα κατά τη διαδικασία ενημέρωσης: ' + error.message, 'error');
        }
        event.preventDefault(); // Προλαμβάνει την προεπιλεγμένη συμπεριφορά του submit

        navigateDropdown(1); // Πηγαίνει στην επόμενη εγγραφή

    }

    const buttons = document.querySelectorAll(".submitButton");

    buttons.forEach((button) => {
        button.addEventListener("click", handleFormSubmit);
    });
    
      // Συνάρτηση για πλοήγηση στο dropdown
      function navigateDropdown(direction) {
        const options = ergazomenoiDropdown.options;
        const totalOptions = options.length;
        let currentIndex = ergazomenoiDropdown.selectedIndex;
    
        // Προσδιορισμός του πρώτου έγκυρου index (παράκαμψη κενής επιλογής αν υπάρχει)
        const firstIndex = options[0].value === '' ? 1 : 0;
    
        if (currentIndex === -1) {
          currentIndex = firstIndex - direction;
        }
    
        // Υπολογισμός του νέου index
        let newIndex = currentIndex + direction;
    
        // Έλεγχος ορίων
        if (newIndex < firstIndex) {
          newIndex = firstIndex;
        } else if (newIndex >= totalOptions) {
          newIndex = totalOptions - 1;
        }
    
        // Ενημέρωση της επιλογής στο dropdown
        ergazomenoiDropdown.selectedIndex = newIndex;
        document.getElementById("ergazomenos_Hidden").value = ergazomenoiDropdown.value; // Ενημερώνουμε το hidden field με την προεπιλεγμένη τιμή.
        updateLabelsFromHidden("ergazomenos_Hidden", [ 'ergazomenosLabel_Krathseis', 'ergazomenosLabel_Foroi', 'ergazomenosLabel_Astheneia', 'ergazomenosLabel_Adeies' ]);
    
        // Ενεργοποίηση του event 'change'
        const event = new Event('change', { bubbles: true });
        ergazomenoiDropdown.dispatchEvent(event);
    
        // Ενημέρωση της κατάστασης των κουμπιών
        updateButtonStates();
      }
    
      // Συνάρτηση για ενημέρωση της κατάστασης των κουμπιών
      function updateButtonStates() {
        const options = ergazomenoiDropdown.options;
        const currentIndex = ergazomenoiDropdown.selectedIndex;
    
        const firstIndex = options[0].value === '' ? 1 : 0;
        const lastIndex = options.length - 1;
    
        prevButton.disabled = currentIndex <= firstIndex;
        nextButton.disabled = currentIndex >= lastIndex;
      }
    
    
});
