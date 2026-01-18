document.addEventListener('DOMContentLoaded', async function() {
  // Επιλογή του κουμπιού διαγραφής
  const deleteButton = document.getElementById('deleteButton');
  
  const selectedTeam = document.getElementById('team').value;
  const selectedCompany = document.getElementById('company_kod').value;
  const kodikosHidden = document.getElementById('kodikosHidden');
  const startDateField = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
  const endDateField = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

  document.getElementById('ergazomenos').addEventListener('change', function(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const lastFourChars = selectedOption.text.slice(-4).trim(); // Παίρνει τους τελευταίους 4 χαρακτήρες της περιγραφής
    kodikosHidden.value = lastFourChars;
    updateHref();
  });
 
  startDateField.addEventListener('blur', updateHref);
  endDateField.addEventListener('blur', updateHref);

  // Συνάρτηση για ενημέρωση του href
  function updateHref() {
    const startDate = startDateField.value;
    const endDate = endDateField.value;
    const selectedKodikos = kodikosHidden.value;
    // const selectedKodikos = document.getElementById('kodikosHidden').value;

    deleteButton.href = `/ergazomenoi/programmata/delete/${selectedTeam}/${selectedCompany}/${selectedKodikos}/${startDate}/${endDate}`;
  }

  deleteButton.addEventListener("click", async function (event) {
      event.preventDefault(); // Αποτρέπει την προεπιλεγμένη συμπεριφορά του συνδέσμου
      
      const _result = await Swal.fire({
      title: "Είστε σίγουρος / η;",
      text: `ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια! `,
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

    if (_result.isConfirmed) {
      try {
        const response = await fetch(deleteButton.href, {
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
          title: "Επιτυχής Διαγραφή των Ωραρίων του Εργαζόμενου",
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
          icon: "success",
          title: "Σφάλμα κατά τη Διαγραφή των Ωραρίων",
          text: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
          timer: 3000,
          confirmButtonText: "Κλείσιμο",
          customClass: {
            confirmButton:
              "class-normal custom-confirm-button custom-swal-button",
          },
          willClose: () => {
            window.location.href = "/mainapp"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
          },
        });
      }
    }
  });


});
