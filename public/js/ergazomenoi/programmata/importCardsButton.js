document.addEventListener('DOMContentLoaded', async function() {
  // Επιλογή του κουμπιού εισαγωγής
  const importCardsButton = document.getElementById('importCardsButton');
  
  let fromDate = null;
  let toDate = null;

  const selectedTeam = document.getElementById('team').value;
  const selectedCompany = document.getElementById('company_kod').value;
  const selectedKodikos = document.getElementById('kodikosHidden');
  const selectedAfm = document.getElementById('afmHidden');
  const selectedUsername = document.getElementById('username').value;
  const selectedPassword = document.getElementById('password').value;
  const fromDateField = document.getElementById('apo_hmeromhnia');
  const toDateField = document.getElementById('eos_hmeromhnia');
  // const interval = document.getElementById('interval');
  let selectedPararthma = null;
  let selectedInterval = null;

  document.getElementById('ergazomenos').addEventListener('change', function(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const lastFourChars = selectedOption.text.slice(-4).trim(); // Παίρνει τους τελευταίους 4 χαρακτήρες της περιγραφής
    selectedKodikos.value = lastFourChars;
    selectedAfm.value = selectedOption.text.slice(-17, -7).trim();
  });
 
  document.getElementById('ypokatasthmata').addEventListener('change', function(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const valueLength = selectedOption.value.length;
    selectedPararthma = valueLength > 0 ? parseInt(selectedOption.value).toString() : '';
  });
 
  document.getElementById('interval').addEventListener('change', function(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const valueLength = selectedOption.value.length;
   selectedInterval = valueLength > 0 ? parseInt(selectedOption.value).toString() : '';
  });
 
  function updateHref() {
    const requiredFields = document.querySelectorAll('#transferForm [required]');
  
    for (let field of requiredFields) {
      if (!field.value) {  // Αν το πεδίο είναι κενό
        // Βρίσκουμε το label που αντιστοιχεί στο πεδίο χρησιμοποιώντας το for και id
        const label = document.querySelector(`label[for="${field.id}"]`);
        const labelText = label ? label.textContent.trim() : '???'; // Προσθέτουμε ένα fallback μήνυμα αν το label δεν βρεθεί
  
        alert(`Το πεδίο "${labelText}" είναι υποχρεωτικό.`);
        field.focus();  // Κάνουμε focus στο πεδίο
        return false;  // Σταματάμε τον έλεγχο και βγαίνουμε από τη συνάρτηση
      }
    }
  
    fromDate = fromDateField.value;
    toDate = toDateField.value;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear()) {
      alert("Οι ημερομηνίες πρέπει να ανήκουν στον ίδιο μήνα και στο ίδιο έτος");
      toDateField.focus();
      return false
    }

    importCardsButton.href = "/ergazomenoi/programmata/importCards";

    return true;
  }

  importCardsButton.addEventListener("click", async function (event) {
    event.preventDefault(); // Αποτρέπει την προεπιλεγμένη συμπεριφορά του συνδέσμου
    const isValid = updateHref();
    if (!isValid) {
      return;
    }
    const _result = await Swal.fire({
      title: "Είσαι σίγουρος / η;",
      html: `Η δημιουργία και ο έλεγχος των ωραρίων μπορεί να διαρκέσει από λίγα δευτερόλεπτα έως και μερικά λεπτά. </br> Αυτό εξαρτάται από την ταχύτητα που σας παρέχει ο πάροχος Internet.`,
      icon: "info",
      showCancelButton: true,
      focusConfirm: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#3332049a",
      confirmButtonText: "Εισαγωγή",
      cancelButtonText: "Ακύρωση",
      customClass: {
        title: 'custom-title',
        popup: "custom-swal-popup",
        confirmButton: "class-info custom-confirm-button custom-swal-button",
        cancelButton:  "custom-cancel-button custom-swal-button",
      },
      didOpen: () => {
        // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
        Swal.getCancelButton().focus();
      },
    });

    if (_result.isConfirmed) {
      document.querySelector(".loader-container").style.display = "grid";
      try {
        const response = await fetch(importCardsButton.href, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedTeam: selectedTeam,
            selectedCompany: selectedCompany,
            fromDate: fromDateField.value.substring(8, 10)+"/"+fromDateField.value.substring(5, 7)+"/"+fromDateField.value.substring(0, 4),
            toDate: toDateField.value.substring(8, 10)+"/"+toDateField.value.substring(5, 7)+"/"+toDateField.value.substring(0, 4),
            selectedKodikos: selectedKodikos.value,
            selectedAfm: selectedAfm.value,
            selectedUsername: selectedUsername,
            selectedPassword: selectedPassword,
            selectedPararthma: selectedPararthma,
            selectedInterval: selectedInterval
          }),
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        window.open(data.url, '_blank');
        // window.open(data.url, 'newWindow', 'width=800,height=600,left=200,top=200'); 
        document.querySelector(".loader-container").style.display = "none";

        async function deletePDF(pdfUrl) {
          try {
            const response = await fetch('/ergazomenoi/programmata/delete-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ pdfUrl })
            });
        
            const result = await response.json();
          } catch (error) {
            console.error('Σφάλμα κατά τη διαγραφή του PDF:', error);
          }
        }
        
        Swal.fire({
          icon: "success",
          title: "Επιτυχής Εισαγωγή των Ωραρίων",
          timer: 3000,
          confirmButtonText: "Κλείσιμο",
          customClass: {
            title: 'custom-title',
            popup: "custom-swal-popup",
            confirmButton:
              "class-success custom-confirm-button custom-swal-button",
          },
          willClose: () => {
            window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert

            deletePDF(data.url);  // Κλήση της συνάρτησης deletePDF
          },
        });
      } catch (error) {
        document.querySelector(".loader-container").style.display = "none";

        Swal.fire({
          icon: "error",
          title: "Σφάλμα κατά τη Εισαγωγή των Ωραρίων",
          html: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
          timer:5000,
          confirmButtonText: "Κλείσιμο",
          customClass: {
            title: 'custom-title',
            popup: "custom-swal-popup",
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
