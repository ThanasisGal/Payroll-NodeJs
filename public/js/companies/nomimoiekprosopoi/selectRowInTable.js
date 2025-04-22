let selectedRowId = null;

document.addEventListener("DOMContentLoaded", function () {
  var rows = document.querySelectorAll("#myTable tbody tr");
  rows.forEach(function (row) {
    row.addEventListener("click", function () {
      if (this.classList.contains("selected-row")) {
        this.classList.remove("selected-row");
        selectedRowId = null;

        document.getElementById("edit-btn").href = "#";
        document.getElementById("delete-btn").href = "#";
      } else {
        rows.forEach(function (r) {
          r.classList.remove("selected-row");
        });

        this.classList.add("selected-row");
        selectedRowId = row.getAttribute("data-id");

        if (selectedRowId) {
          document.getElementById("edit-btn").href = "/companies/nomimoi_ekprosopoi/edit/" + selectedRowId;
          document
            .getElementById("delete-btn")
            .addEventListener("click", async function (event) {
              event.preventDefault(); // Αποτρέπει την προεπιλεγμένη συμπεριφορά του συνδέσμου

              // Ορίζει το URL για διαγραφή
              var deleteUrl = "/companies/nomimoi_ekprosopoi/delete/" + selectedRowId;

              const result = await Swal.fire({
                title: "Είστε σίγουρος / η;",
                text: "ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια!",
                icon: "error",
                showCancelButton: true,
                focusConfirm: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#3332049a",
                confirmButtonText: "Διαγραφή",
                cancelButtonText: "Ακύρωση",
                customClass: {
                  confirmButton:
                    "class-error custom-confirm-button custom-swal-button",
                  cancelButton: "custom-cancel-button custom-swal-button",
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
                    title: "Επιτυχής Διαγραφή του Νόμιμου Εκπρόσωπου",
                    timer: 3000,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                      confirmButton:
                        "class-success custom-confirm-button custom-swal-button",
                    },
                    willClose: () => {
                      window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    },
                  });
                } catch (error) {
                  Swal.fire({
                    icon: "error",
                    title: "Σφάλμα κατά τη Διαγραφή του Νόμιμου Εκπρόσωπου",
                    text: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
                    timer: 3000,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                      confirmButton:
                        "class-normal custom-confirm-button custom-swal-button",
                    },
                    willClose: () => {
                      window.location.href = "/companies/nomimoi_ekprosopoi"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    },
                  });
                }
              }
            }
          );
        }
      }
    });
  });
});
