let selectedRowId = null;
let selectedRowKod = null;

document.addEventListener("DOMContentLoaded", function () {
  var rows = document.querySelectorAll("#myTable tbody tr");
  rows.forEach(function (row) {
    row.addEventListener("click", function () {
      if (this.classList.contains("selected-row")) {
        this.classList.remove("selected-row");
        selectedRowId = null;
        selectedRowKod = null;

        document.getElementById("edit-btn").href = "#";
        document.getElementById("delete-btn").href = "#";
      } else {
        rows.forEach(function (r) {
          r.classList.remove("selected-row");
        });

        this.classList.add("selected-row");
        selectedRowId = row.getAttribute("data-id");
        selectedRowKod = row.getAttribute("data-kod");

        if (selectedRowId) {
          document.getElementById("edit-btn").href = "/ergazomenoi/ergazomenoi/edit/" + selectedRowId;
          document.getElementById("delete-btn").addEventListener("click", async function (event) {
            // event.preventDefault(); // Αποτρέπει την προεπιλεγμένη συμπεριφορά του συνδέσμου

            // Ορίζει το URL για διαγραφή
            var deleteUrl = "/ergazomenoi/ergazomenoi/delete/" + selectedRowId;

            const result = await Swal.fire({
              title: "Είστε σίγουρος / η;",
              text: `ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια! Με την διαγραφή του εργαζόμενου θα διαγραφούν (απ΄ ΌΛΑ τα αρχεία) οι εγγραφές, που αφορούν τον συγκεκριμένο εργαζόμενο.`,
              icon: "error",
              showCancelButton: true,
              focusConfirm: true,
              confirmButtonColor: "#3085d6",
              cancelButtonColor: "#3332049a",
              confirmButtonText: "Διαγραφή",
              cancelButtonText: "Ακύρωση",
              customClass: {
                confirmButton: "class-error custom-confirm-button custom-swal-button",
                cancelButton: "custom-cancel-button custom-swal-button",
                title: 'custom-title',
              },
              didOpen: () => {
                // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
                Swal.getCancelButton().focus();
              },
            });

            if (result.isConfirmed) {
              try {
                const response = await fetch(deleteUrl, {
                  method: "DELETE",
                  headers: {
                    "Content-Type": "application/json",
                  },
                });

                if (!response.ok) {
                  throw new Error("Network response was not ok");
                }

                const data = await response.json();
                Swal.fire({
                  icon: "success",
                  title: "Επιτυχής Διαγραφή του Εργαζόμενου",
                  timer: 3000,
                  confirmButtonText: "Κλείσιμο",
                  customClass: {
                    confirmButton:
                      "class-success custom-confirm-button custom-swal-button",
                      title: 'custom-title',
                  },
                  willClose: () => {
                    window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                  },
                });
              } catch (error) {
                Swal.fire({
                  icon: "success",
                  title: "Σφάλμα κατά τη Διαγραφή του Εργαζόμενου",
                  text: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
                  timer: 3000,
                  confirmButtonText: "Κλείσιμο",
                  customClass: {
                    confirmButton:
                      "class-normal custom-confirm-button custom-swal-button",
                      title: 'custom-title',
                  },
                  willClose: () => {
                    window.location.href = "/ergazomenoi/ergazomenoi"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                  },
                });
              }
            }
          });
        }
      }
    });
  });
});
