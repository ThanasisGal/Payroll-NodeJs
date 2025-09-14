document.addEventListener("DOMContentLoaded", () => {
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

        try {
            await Promise.all(filePromises);
            
            // Εμφάνιση sweetAlert με προσαρμοσμένο HTML για επιλογή των αρχείων προς ενημέρωση
            const result = await Swal.fire({
                title: 'Επιλογή αρχείων για ενημέρωση',
                html: `
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="employees" name="files" value="employees" checked />
                    <label for="employees" id="label-employees" class="ml0_75-fs-0_875vw">
                    Στοιχεία Εργαζόμενων
                    </label><br>
                </div>
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="schedules" name="files" value="schedules" checked />
                    <label for="schedules" id="label-schedules" class="ml0_75-fs-0_875vw">
                    Ωράρια ( ΕΡΓΑΝΗ ΙΙ )
                    </label><br>
                </div>
                <div class="col-8 left-align checkbox-flex-center">
                    <input type="checkbox" class="form-check-input custom-checkbox checkbox-class" id="history" name="files" value="history" checked />
                    <label for="history" id="label-history" class="ml0_75-fs-0_875vw">
                    Ιστορικό Προσλήψεων - Αλλαγών Συμβάσεων
                    </label><br>
                </div>`,
                focusConfirm: false,
                preConfirm: () => {
                const filesToUpdate = {
                    employees: document.getElementById('employees').checked,
                    schedules: document.getElementById('schedules').checked,
                    history: document.getElementById('history').checked
                };
                return filesToUpdate;
                },
                confirmButtonText: 'Ενημέρωση',
                customClass: {
                confirmButton: "class-success custom-confirm-button custom-swal-button",
                title: 'custom-title',
                },
                // showCancelButton: true,
                // cancelButtonText: 'Ακύρωση'
            });
            
            const response = await fetch("/ergazomenoi/ergazomenoi/add", {
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
                if (result.value.employees) {
                    itemsList += `<li><i class="bi bi-check-lg cgreen"></i> Εργαζομένων</li>`;
                }
                if (result.value.schedules) {
                    itemsList += `<li><i class="bi bi-check-lg cgreen"></i> Ωραρίων</li>`;
                }
                if (result.value.history) {
                    itemsList += `<li><i class="bi bi-check-lg cgreen"></i> Ιστορικού Προσλήψεων - Αλλαγών</li>`;
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
                }).then(() => {
                    window.location.href = data.redirectUrl;
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
    }

    const buttons = document.querySelectorAll(".submitButton");

    buttons.forEach((button) => {
        button.addEventListener("click", handleFormSubmit);
    });
});
