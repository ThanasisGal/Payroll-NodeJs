let selectedRowId = null;

document.addEventListener("DOMContentLoaded", function () {
  const tableBody = document.querySelector("#myTable tbody");

  tableBody.addEventListener("click", function (event) {
    // Εντοπίζει το στοιχείο TR που κλικάριστηκε
    let targetRow = event.target.closest("tr");

    // Εάν δεν βρέθηκε TR ή το κλικ έγινε εκτός TR, δεν κάνει τίποτα
    if (!targetRow || targetRow.parentNode !== tableBody) return;

    // Τώρα χειρίζεται το κλικ στο TR
    if (targetRow.classList.contains("selected-row")) {
      targetRow.classList.remove("selected-row");
      selectedRowId = null;
      document.getElementById("edit-btn").href = "#";
    } else {
      // Αφαιρεί την επιλεγμένη κλάση από όλα τα TR και την προσθέτει στο συγκεκριμένο
      tableBody.querySelectorAll("tr").forEach(tr => tr.classList.remove("selected-row"));
      targetRow.classList.add("selected-row");
      selectedRowId = targetRow.getAttribute("data-id");
      document.getElementById("edit-btn").href = "/symbaseis/eidikothtes/edit/" + selectedRowId;
    }
  });

  document.getElementById("delete-btn").addEventListener("click", async function (event) {
    if (!selectedRowId) {
      Swal.fire({
        icon: "error",
        title: "Προσοχή!",
        text: "Παρακαλώ επιλέξτε μια ειδικότητα σύμβασης πρώτα.",
        confirmButtonText: "Ok",
        customClass: {
          confirmButton: "custom-confirm-button custom-swal-button",
        },
      });
      return;
    }
    event.preventDefault();

    var deleteUrl = "/symbaseis/eidikothtes/delete/" + selectedRowId;

    const result = await Swal.fire({
      title: "Είστε σίγουρος/η;",
      html: `ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια! <br> Με την διαγραφή της ειδικότητας σύμβασης θα διαγραφούν, (<strong>απ' όλα τα αρχεία</strong>) οι εγγραφές, που αφορούν την συγκεκριμένη ειδικότητα σύμβασης.`,
      icon: "warning",
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
        
        // Εμφάνιση των αποτελεσμάτων με τη μορφή πίνακα
        if (data.results && data.results.length > 0) {
          const maxLength = Math.max(...data.results.map(r => r.modelNameInGreek.length));
          const tableHtml = `<table>${data.results.map(r => {
            const spaces = '&nbsp;'.repeat(maxLength - r.modelNameInGreek.length + 10);
            return `<tr>
                <td class="ta-l">${r.modelNameInGreek}</td>
                <td>${spaces}Εγγραφές: ${r.deletedCount}</td>
                <td class="ta-r"><i class="bi bi-check cgreen"></i></td>
              </tr>`;
          }).join('')}</table>`;

          Swal.fire({
            icon: "success",
            title: "Επιτυχής Διαγραφή της Ειδικότητας Σύμβασης",
            html: tableHtml,
            confirmButtonText: "Κλείσιμο",
            customClass: {
              confirmButton: "class-success custom-confirm-button custom-swal-button",
            },
          }).then(() => {
            window.location.href = data.redirectUrl;
          });
        } else {
          Swal.fire({
            icon: "info",
            title: "Δεν υπήρχαν εγγραφές προς διαγραφή στα υπόλοιπα συσχετιζόμενα αρχεία.",
            confirmButtonText: "Επιστροφή",
            customClass: {
              confirmButton: "class-info custom-confirm-button custom-swal-button",
            },
          }).then(() => {
            window.location.href = data.redirectUrl;
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Σφάλμα κατά τη Διαγραφή της Ειδικότητας Σύμβασης",
          text: error.toString(),
          confirmButtonText: "Κλείσιμο",
          customClass: {
            confirmButton: "class-error custom-confirm-button custom-swal-button",
          },
        });
      }
    }
  });
});
