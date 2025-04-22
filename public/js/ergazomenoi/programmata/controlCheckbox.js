document.addEventListener("DOMContentLoaded", function () {

  let fromDate = null;
  let toDate = null;

  const selectAllCheckbox = document.getElementById('select-all');
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');
  const rows = document.querySelectorAll('tbody tr');
  const getOrariaBtn = document.getElementById('get-oraria-btn');
  const fromDateField = document.getElementById('apo_hmeromhnia');
  const toDateField = document.getElementById('eos_hmeromhnia');

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
  getOrariaBtn.addEventListener('click', async function() {
    const selectedKodikoi = [];
    rows.forEach(function(row) {
      const checkbox = row.querySelector('.row-checkbox');
      // const kodikosCell = row.querySelector('.kodikos');
      if (checkbox.checked) {
        const kodikos = row.getAttribute('data-kod');
        selectedKodikoi.push(kodikos.trim());
        }
    });

    const team = document.getElementById("team").value;
    const companyId = document.getElementById("company_kod").value;

    fromDate = fromDateField.value;
    toDate = toDateField.value;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear()) {
      alert("Οι ημερομηνίες πρέπει να ανήκουν στον ίδιο μήνα και στο ίδιο έτος");
      toDateField.focus();
      return false
    }

    const fdate = new Date(fromDateField.value + 'T00:00:00.000Z');
    const tdate = new Date(toDateField.value + 'T00:00:00.000Z');

    const ypokatasthma = document.getElementById("ypokatasthmata").value;
    const diadikasia = document.getElementById("diadikasia").value;
    const filetype = document.getElementById("fileType").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // Μετατροπή της ημερομηνίας σε μορφή ISO (με το Z που σημαίνει UTC)
    fromDate = fdate.toISOString();
    toDate = tdate.toISOString();
      
    let textDiadikasias;

    switch (diadikasia) {
      case "195":
        textDiadikasias = "(Ψηφιακή Οργάνωση Χρόνου - Άδειες)"
        break;
      case "196":
        textDiadikasias = "(Ψηφιακή Οργάνωση Χρόνου - Άδειες ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ)"
        break;
      case "196":
        textDiadikasias = "(Ψηφιακή Οργάνωση Χρόνου - Μεταβαλλομενο / Τροποποιούμενο ανά Ημέρα)"
        break;
      case "207":
        textDiadikasias = "(Ψηφιακή Οργάνωση Χρόνου - Μεταβαλλομενο / Τροποποιούμενο ανά Ημέρα ΑΠΟΛΟΓΙΣΤΙΚΟ)"
        break;
      case "192":
        textDiadikasias = "(Ψηφιακή Οργάνωση Χρόνου - Μεταβαλλομενο / Τροποποιούμενο ανά Ημέρα ΟΔΗΓΟΙ)"
        break;
      case "182":
        textDiadikasias = "(Ψηφιακή Οργάνωση Χρόνου - Σταθερό Εβδομαδιαίο)"
        break;
    }
    const _result = await Swal.fire({
      title: "Είσαι σίγουρος / η;",
      html: `Θα γίνει ενημέρωση του ΕΡΓΑΝΗ ${textDiadikasias}`,
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
      },
      didOpen: () => {
        // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
        Swal.getCancelButton().focus();
      },
    });

    if (_result.isConfirmed) {
      document.querySelector(".loader-container").style.display = "grid";
      try {
        // Αίτημα στον server για να λάβουμε τα ωράρια
        const response = await fetch('/api/ergazomenoi/programmata/getOraria', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            team: team, 
            company: companyId, 
            kodikoi: selectedKodikoi, 
            apoHmeromhnia: fromDate, 
            eosHmeromhnia: toDate,
            diadikasia: diadikasia,
            filetype: filetype,
            username: username,
            password: password,
            ypokatasthma: ypokatasthma
          })
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();

        document.querySelector(".loader-container").style.display = "none";

        if (data.checkMessage === "ok") {
          Swal.fire({
              icon: "success",
              title: "Επιτυχής Ενημέρωση των Ωραρίων",
              html: data.message,
              timer: 5000,
              confirmButtonText: "Κλείσιμο",
              customClass: {
                confirmButton: "class-success custom-confirm-button custom-swal-button",
                title: 'custom-title'
              },
              willClose: () => {
                window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
              }
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Το ΟΠΣ ΕΡΓΑΝΗ λέει:",
            html: data.message,
            confirmButtonText: "Κλείσιμο",
            customClass: {
              confirmButton: "class-error custom-confirm-button custom-swal-button",
              title: 'custom-title'
            },
            willClose: () => {
              window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
            }
          });
        }

      } catch (error) {
        document.querySelector(".loader-container").style.display = "none";

        Swal.fire({
          icon: "error",
          title: "Σφάλμα κατά τη Ενημέρωση των Ωραρίων",
          html: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
          timer:5000,
          confirmButtonText: "Κλείσιμο",
          customClass: {
            confirmButton: "class-normal custom-confirm-button custom-swal-button",
            title: 'custom-title'
          },
          willClose: () => {
            window.location.href = "/mainapp"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
          },
        });
      }
    }
  });

});
