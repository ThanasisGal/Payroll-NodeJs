document.addEventListener("DOMContentLoaded", function () {
    const selectAllCheckbox = document.getElementById('select-all');
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    const rows = document.querySelectorAll('tbody tr');
    const getStoixeiaBtn = document.getElementById('get-stoixeia-btn');
    const loader = document.querySelector(".loader-container");

    // Λειτουργία Select All
    selectAllCheckbox.addEventListener('change', function() {
        const isChecked = this.checked;
        rowCheckboxes.forEach(function(checkbox, index) {
            checkbox.checked = isChecked;
            toggleRowActive(rows[index], isChecked);
        });
    });

    // Λειτουργία για κάθε checkbox στη σειρά
    rowCheckboxes.forEach(function(checkbox, index) {
        checkbox.addEventListener('change', function() {
            toggleRowActive(rows[index], this.checked);
        });
    });

    // Λειτουργία για εναλλαγή ενεργοποίησης της σειράς όταν κάνεις κλικ σε κελί
    rows.forEach(function(row, index) {
        row.addEventListener('click', function(event) {
            // Αποφεύγουμε το κλικ πάνω στο checkbox
            if (!event.target.classList.contains('row-checkbox')) {
                const checkbox = rowCheckboxes[index];
                checkbox.checked = !checkbox.checked;
                toggleRowActive(row, checkbox.checked);
            }
        });
    });

    // Συνάρτηση για ενεργοποίηση ή απενεργοποίηση της σειράς
    function toggleRowActive(row, isChecked) {
        if (isChecked) {
            row.classList.add('selected-row');
        } else {
            row.classList.remove('selected-row');
        }
    }

    // Συλλέγουμε τους kodikos των επιλεγμένων εργαζομένων και στέλνουμε αίτημα για τα ωράρια
    getStoixeiaBtn.addEventListener('click', async function() {
        const selectedKodikoi = [];
        rows.forEach(function(row) {
            const checkbox = row.querySelector('.row-checkbox');
            if (checkbox.checked) {
                const kodikos = row.getAttribute('data-kod');
                selectedKodikoi.push(kodikos.trim());
            }
        });

        const team = document.getElementById("team").value;
        const companyId = document.getElementById("company_kod").value;

        const ypokatasthma = document.getElementById("ypokatasthmata").value;
        // const username = document.getElementById("username").value;
        // const password = document.getElementById("password").value;

        const _result = await Swal.fire({
            title: "Είσαι σίγουρος / η;",
            html: `Θα γίνει δημιουργία των συμβάσεων για τους επιλεγέντες εργαζόμενους.`,
            icon: "info",
            showCancelButton: true,
            focusConfirm: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#3332049a",
            confirmButtonText: "Ενημέρωση",
            cancelButtonText: " Ακύρωση ",
            customClass: {
                confirmButton: "class-info custom-confirm-button custom-swal-button",
                cancelButton:  "custom-cancel-button-normal custom-swal-button",
                title: 'custom-title',
                popup: "custom-swal-popup",
            },
            allowOutsideClick: false,   // 🚫 Δεν επιτρέπει click εκτός
            allowEscapeKey: false,      // 🚫 Δεν επιτρέπει ESC
            didOpen: () => {
                // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
                Swal.getCancelButton().focus();
            },
        });

        if (_result.isConfirmed) {
            loader.classList.remove("is-hidden");
            loader.classList.add("visible");

            try {
                // Αίτημα στον server για να λάβουμε τα ωράρια
                const response = await fetch('/api/ektyposeis/symbaseis/ergazomenoi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        team: team, 
                        company: companyId, 
                        kodikoi: selectedKodikoi, 
                        // username: username,
                        // password: password,
                        ypokatasthma: ypokatasthma
                    })
                });

                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }

                const data = await response.json();

                if (!data.success && data.checkMessage === "EBUSY") {
                    loader.classList.remove("visible");
                    loader.classList.add("is-hidden");

                    await Swal.fire({
                        icon: 'error',
                        title: 'Υπάρχουν ανοιχτά αρχεία...',
                        text: data.warningMessage,
                        confirmButtonText: 'Κατάλαβα',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        customClass: {
                            confirmButton: "class-error custom-confirm-button custom-swal-button",
                            title: 'custom-title',
                            popup: "custom-swal-popup",
                        }
                    });
                
                    return; // 🔚 Σταματά η εκτέλεση εδώ
                }
                
                loader.classList.remove("visible");
                loader.classList.add("is-hidden");

                Swal.fire({
                    icon: "success",
                    title: "Επιτυχής δημιουργία...",
                    html: data.fileLink,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: 'custom-title',
                        popup: "custom-swal-popup",
                    },
                    allowOutsideClick: false,   // 🚫 Δεν επιτρέπει click εκτός
                    allowEscapeKey: false,      // 🚫 Δεν επιτρέπει ESC
                    willClose: async () => {
                        // Αν υπάρχει προειδοποίηση από τον server
                        if (data.warningMessage) {
                            await Swal.fire({
                                icon: 'warning',
                                title: 'Προσοχή!',
                                text: data.warningMessage,
                                confirmButtonText: 'Κατάλαβα',
                                allowOutsideClick: false,
                                allowEscapeKey: false,
                                customClass: {
                                    confirmButton: "class-warning custom-confirm-button custom-swal-button",
                                    title: 'custom-title',
                                    popup: "custom-swal-popup",
                                }
                            });
                        }
                    
                        // Τελική ανακατεύθυνση
                        window.location.href = data.redirectUrl;
                    }                
                });
            } catch (error) {
                loader.classList.remove("visible");
                loader.classList.add("is-hidden");

                Swal.fire({
                    icon: "error",
                    title: "Σφάλμα κατά τη Ενημέρωση των Ωραρίων",
                    html: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
                    timer:5000,
                    confirmButtonText: "Κλείσιμο",
                    allowOutsideClick: false,   // 🚫 Δεν επιτρέπει click εκτός
                    allowEscapeKey: false,      // 🚫 Δεν επιτρέπει ESC
                    customClass: {
                        confirmButton: "class-normal custom-confirm-button custom-swal-button",
                        title: 'custom-title',
                        popup: "custom-swal-popup",
                    },
                    willClose: () => {
                        window.location.href = "/mainapp"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    },
                });
            }
        }
    });

});
