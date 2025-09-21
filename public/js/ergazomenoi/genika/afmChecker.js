document.addEventListener("DOMContentLoaded", () => {
  const afmMappings = {
    afm: fetchErgazomenoiData,
    afm_antikatastath: blankFunction,
  };

  Object.keys(afmMappings).forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) { // Έλεγχος αν το στοιχείο υπάρχει πριν προσθέσει τον event listener
      field.addEventListener("blur", async function () {
        const value = this.value;

        if (value !== "" && !isValidAfm(value)) {
          Swal.fire({
            icon: "warning",
            title: "Λάθος ΑΦΜ...",
            text: "Πληκτρολογείστε τον σωστό ΑΦΜ ή αφήστε το πεδίο κενό....",
            timer: 2000,
            focusConfirm: true,
            showConfirmButton: false,
            showCancelButton: false,
            customClass: {
              confirmButton: 'class-warning',
              title: 'custom-title',
            }
          });
          field.value = "";
          field.focus();
          return;
        }

        const fetchDataFunction = afmMappings[fieldId];

        try {
          await fetchDataFunction(value);
        } catch (error) {
          console.error("Σφάλμα:", error);
        }
      });
    }
  });
});

function isValidAfm(value) {
  const cd = value.substr(8, 1);
  let tot = 0;
  const div = [256, 128, 64, 32, 16, 8, 4, 2];
  for (let i = 0; i < 8; i++) {
    tot += div[i] * parseInt(value.substr(i, 1));
  }
  let rem = Math.ceil(tot % 11);
  return (rem === 10 ? 0 : rem) == cd;
}

async function fetchErgazomenoiData(afm) {
  const response = await fetch("/api/afmErgazomenoy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ afm: afm }),
  });

  if (!response.ok) {
    throw new Error("Σφάλμα κατά την αποστολή αιτήματος");
  }

  const data = await response.json();

  if (data) {
    Swal.fire({
      icon: "error",
      title: "Προσοχή...",
      text: `Ο εργαζόμενος με ΑΦΜ ${data.afm} ( "${data.eponymo} ${data.onoma}" ) είναι ήδη καταχωρημένος. Δεν επιτρέπεται η διπλή ως προς το ΑΦΜ καταχώρηση...`,
      timer: 3000,
      confirmButtonText: 'Κλείσιμο',
      customClass: {
        confirmButton: 'class-error custom-confirm-button custom-swal-button',
        title: 'custom-title',
      }
    });
  }
}

async function blankFunction(afm) {}
