document.addEventListener('DOMContentLoaded', async function() {
  // Επιλογή του κουμπιού αντιγραφής
  const copyScheduleButton = document.getElementById('copyScheduleButton');
  
  let fromStartDate = null;
  let fromEndDate = null;
  let toStartDate = null;
  let toEndDate = null;
  let fromSelectedKodikos = null;
  let toSelectedKodikos = null;
  let fromEmployee = null
  let toEmployee = null

  const selectedTeam = document.getElementById('team').value;
  const selectedCompany = document.getElementById('company_kod').value;
  const kodikosHidden = document.getElementById('kodikosHidden');
  const kodikos2Hidden = document.getElementById('kodikos2Hidden');
  const fromStartDateField = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
  const fromEndDateField = document.getElementById('hmeromhnia_allaghs_orarioy_eos');
  const toStartDateField = document.getElementById('hmeromhnia_allaghs_orarioy_apo2');
  const toEndDateField = document.getElementById('hmeromhnia_allaghs_orarioy_eos2');

  document.getElementById('ergazomenos').addEventListener('change', function(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const lastFourChars = selectedOption.text.slice(-4).trim(); // Παίρνει τους τελευταίους 4 χαρακτήρες της περιγραφής
    kodikosHidden.value = lastFourChars;
    fromEmployee = "του εργαζόμενου " + selectedOption.text.substring(0,30).trim() + " " + selectedOption.text.substring(30,39).trim() + " " + selectedOption.text.substring(39,59).trim();
  });
 
  document.getElementById('ergazomenos2').addEventListener('change', function(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const lastFourChars = selectedOption.text.slice(-4).trim(); // Παίρνει τους τελευταίους 4 χαρακτήρες της περιγραφής
    kodikos2Hidden.value = lastFourChars;
    toEmployee = selectedOption.text.substring(0,30).trim() + " " + selectedOption.text.substring(30,39).trim() + " " + selectedOption.text.substring(39,59).trim();
  });
 
  function updateHref() {

    const requiredFields = document.querySelectorAll('#transferForm [required]');
  
    for (let field of requiredFields) {
      if (!field.value) {  // Αν το πεδίο είναι κενό
        // Βρίσκουμε το label που αντιστοιχεί στο πεδίο χρησιμοποιώντας το for και id
        const label = document.querySelector(`label[for="${field.id}"]`);
        const labelText = label ? label.textContent.trim() : 'Το πεδίο'; // Προσθέτουμε ένα fallback μήνυμα αν το label δεν βρεθεί
  
        alert(`Το πεδίο "${labelText}" είναι υποχρεωτικό.`);
        field.focus();  // Κάνουμε focus στο πεδίο
        return false;  // Σταματάμε τον έλεγχο και βγαίνουμε από τη συνάρτηση
      }
    }
  
    fromStartDate = fromStartDateField.value;
    fromEndDate = fromEndDateField.value;
    toStartDate = toStartDateField.value;
    toEndDate = toEndDateField.value;
    fromSelectedKodikos = kodikosHidden.value;
    toSelectedKodikos = kodikos2Hidden.value;

    const daysDiff = Math.ceil((new Date(fromEndDate) - new Date(fromStartDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 6) {
      alert('Το εύρος των ημερομηνιών πρέπει να είναι 7 ημέρες.');
      fromEndDateField.focus();
      return false
    }

    const from = new Date(toStartDate);
    const to = new Date(toEndDate);
    if (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear()) {
      alert("Οι ημερομηνίες πρέπει να ανήκουν στον ίδιο μήνα και στο ίδιο έτος");
      toStartDateField.focus();
      return false
    }

    copyScheduleButton.href = "/ergazomenoi/programmata/copy";

    if (fromSelectedKodikos === toSelectedKodikos) fromEmployee = "του ίδιου εργαζόμενου";

    return true;
  }

  copyScheduleButton.addEventListener("click", async function (event) {
    event.preventDefault(); // Αποτρέπει την προεπιλεγμένη συμπεριφορά του συνδέσμου
    const isValid = updateHref();
    if (!isValid) {
      return;
    }
    const _result = await Swal.fire({
      html: `Θα γίνει αντιγραφή, στον εργαζόμενο  ${toEmployee}, του ωραρίου για την περίοδο από ${toStartDate.substring(8,10)}/${toStartDate.substring(5,7)}/${toStartDate.substring(0,4)} έως ${toEndDate.substring(8,10)}/${toEndDate.substring(5,7)}/${toEndDate.substring(0,4)} από το ωράριο της περιόδου ${fromStartDate.substring(8,10)}/${fromStartDate.substring(5,7)}/${fromStartDate.substring(0,4)} έως ${fromEndDate.substring(8,10)}/${fromEndDate.substring(5,7)}/${fromEndDate.substring(0,4)} ${fromEmployee}.`,
      icon: "info",
      showCancelButton: true,
      focusConfirm: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#3332049a",
      confirmButtonText: "Αντιγραφή",
      cancelButtonText: "Ακύρωση",
      customClass: {
        confirmButton: "class-info custom-confirm-button custom-swal-button",
        cancelButton:  "custom-cancel-button custom-swal-button",
      },
      didOpen: () => {
        // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
        Swal.getCancelButton().focus();
      },
    });

    if (_result.isConfirmed) {
      try {
        const response = await fetch(copyScheduleButton.href, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedTeam: selectedTeam,
            selectedCompany: selectedCompany,
            fromStartDate: fromStartDateField.value,
            fromEndDate: fromEndDateField.value,
            toStartDate: toStartDateField.value,
            toEndDate: toEndDateField.value,
            fromSelectedKodikos: kodikosHidden.value,
            toSelectedKodikos: kodikos2Hidden.value,
          }),
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        Swal.fire({
          icon: "success",
          title: "Επιτυχής Αντιγραφή των Ωραρίων",
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
          title: "Σφάλμα κατά τη Αντιγραφή των Ωραρίων",
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
