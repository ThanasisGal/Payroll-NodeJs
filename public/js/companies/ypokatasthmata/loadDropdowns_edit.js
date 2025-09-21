// const twoSpaces = '\u00A0'.repeat(2);
// const threeSpaces = '\u00A0'.repeat(3);
// const fourSpaces = '\u00A0'.repeat(4);
// const fiveSpaces = '\u00A0'.repeat(5);
// const sixSpaces = '\u00A0'.repeat(6);
// const sevenSpaces = '\u00A0'.repeat(7);
// const eightSpaces = '\u00A0'.repeat(8);
// const nineSpaces = '\u00A0'.repeat(9);
// const tenSpaces = '\u00A0'.repeat(10);
// const fifteenSpaces = '\u00A0'.repeat(15);

// document.addEventListener("DOMContentLoaded", function () {
//   const perifereiesSelected = document.getElementById("perifereies");
//   const nomoiSelect = document.getElementById("nomos");
//   const dhmoiSelect = document.getElementById("dhmos");
//   const poleisSelect = document.getElementById("polh");
//   const selectedNomosKodikos = document.getElementById("ypokatasthmataNomos").value;
//   const selectedDhmosKodikos = document.getElementById("ypokatasthmataDhmos").value;
//   const selectedPolhKodikos = document.getElementById("ypokatasthmataPolh").value;

//   async function loadNomoi(perifereiaKodikos) {
//     try {
//       const response = await fetch(`/api/loadNomoi/${perifereiaKodikos}`);
//       if (!response.ok) {
//         throw new Error("Network response was not ok");
//       }
//       const nomoiData = await response.json();
//       nomoiSelect.innerHTML = '<option value=""></option>';
//       nomoiData.forEach((nomoi) => {
//         let option = new Option(nomoi.perigrafh, nomoi.kodikos);
//         if (nomoi.kodikos == selectedNomosKodikos) {
//           option.selected = true;
//         }
//         nomoiSelect.appendChild(option);
//       });
//       if (selectedNomosKodikos) {
//         loadDhmoi(selectedNomosKodikos);
//       }
//     } catch (error) {
//       console.error("Αποτυχία φόρτωσης των νομών:", error);
//     }
//   }

//   async function loadDhmoi(nomosKodikos) {
//     try {
//       const response = await fetch(`/api/loadDhmoi/${nomosKodikos}`);
//       if (!response.ok) {
//         throw new Error("Network response was not ok");
//       }
//       const dhmoiData = await response.json();
//       dhmoiSelect.innerHTML = '<option value=""></option>';
//       dhmoiData.forEach((dhmoi) => {
//         let option = new Option(dhmoi.perigrafh, dhmoi.kodikos);
//         if (dhmoi.kodikos == selectedDhmosKodikos) {
//           option.selected = true;
//         }
//         dhmoiSelect.appendChild(option);
//       });
//       if (selectedDhmosKodikos) {
//         loadPoleis(selectedDhmosKodikos);
//       }
//     } catch (error) {
//       console.error("Αποτυχία φόρτωσης των δήμων:", error);
//     }
//   }

//   async function loadPoleis(dhmosKodikos) {
//     try {
//       const response = await fetch(`/api/loadPoleis/${dhmosKodikos}`);
//       if (!response.ok) {
//         throw new Error("Network response was not ok");
//       }
//       const poleisData = await response.json();
//       poleisSelect.innerHTML = '<option value=""></option>';
//       poleisData.forEach((polis) => {
//         let option = new Option(polis.perigrafh, polis.kodikos);
//         if (polis.kodikos == selectedPolhKodikos) {
//           option.selected = true;
//         }
//         poleisSelect.appendChild(option);
//       });
//     } catch (error) {
//       console.error("Αποτυχία φόρτωσης των πόλεων:", error);
//     }
//   }

//   perifereiesSelected.addEventListener("change", function () {
//     loadNomoi(this.value);
//   });

//   nomoiSelect.addEventListener("change", function () {
//     loadDhmoi(this.value);
//   });

//   dhmoiSelect.addEventListener("change", function () {
//     loadPoleis(this.value);
//   });

//   if (perifereiesSelected.value) {
//     loadNomoi(perifereiesSelected.value);
//   }
// });


document.addEventListener("DOMContentLoaded", function () {
  // --- CSRF setup ---
  let CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || null;

  const ensureCsrfToken = async () => {
    if (CSRF_TOKEN) return;
    const r = await fetch("/api/csrf-token", { credentials: "same-origin" });
    if (!r.ok) throw new Error("CSRF token fetch failed");
    const j = await r.json();
    CSRF_TOKEN = j.csrfToken;
  };

  const apiFetch = (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (CSRF_TOKEN) headers.set("X-CSRF-Token", CSRF_TOKEN);

    return fetch(url, {
      credentials: "same-origin", // στέλνει cookies μόνο στο ίδιο origin
      ...options,
      headers
    });
  };

  // --- Elements ---
  const perifereiesSelected = document.getElementById("perifereies");
  const nomoiSelect = document.getElementById("nomos");
  const dhmoiSelect = document.getElementById("dhmos");
  const poleisSelect = document.getElementById("polh");

  const selectedNomosKodikos = document.getElementById("ypokatasthmataNomos")?.value || "";
  const selectedDhmosKodikos = document.getElementById("ypokatasthmataDhmos")?.value || "";
  const selectedPolhKodikos  = document.getElementById("ypokatasthmataPolh")?.value  || "";

  // Μικρό helper για να καθαρίζουμε <select>
  const resetSelect = (el) => { el.innerHTML = '<option value=""></option>'; };

  async function loadNomoi(perifereiaKodikos) {
    try {
      if (!perifereiaKodikos) { resetSelect(nomoiSelect); resetSelect(dhmoiSelect); resetSelect(poleisSelect); return; }
      await ensureCsrfToken();

      const url = `/api/loadNomoi/${encodeURIComponent(perifereiaKodikos)}`;
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Network response was not ok");

      const nomoiData = await response.json();
      resetSelect(nomoiSelect);
      nomoiData.forEach((nomos) => {
        const option = new Option(nomos.perigrafh, nomos.kodikos);
        if (String(nomos.kodikos) === String(selectedNomosKodikos)) option.selected = true;
        nomoiSelect.appendChild(option);
      });

      // Αν έχεις προεπιλεγμένο νομό, συνέχισε αλυσίδα
      if (selectedNomosKodikos) {
        await loadDhmoi(selectedNomosKodikos);
      } else {
        resetSelect(dhmoiSelect);
        resetSelect(poleisSelect);
      }
    } catch (error) {
      console.error("Αποτυχία φόρτωσης των νομών:", error);
    }
  }

  async function loadDhmoi(nomosKodikos) {
    try {
      if (!nomosKodikos) { resetSelect(dhmoiSelect); resetSelect(poleisSelect); return; }
      await ensureCsrfToken();

      const url = `/api/loadDhmoi/${encodeURIComponent(nomosKodikos)}`;
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Network response was not ok");

      const dhmoiData = await response.json();
      resetSelect(dhmoiSelect);
      dhmoiData.forEach((dhmos) => {
        const option = new Option(dhmos.perigrafh, dhmos.kodikos);
        if (String(dhmos.kodikos) === String(selectedDhmosKodikos)) option.selected = true;
        dhmoiSelect.appendChild(option);
      });

      if (selectedDhmosKodikos) {
        await loadPoleis(selectedDhmosKodikos);
      } else {
        resetSelect(poleisSelect);
      }
    } catch (error) {
      console.error("Αποτυχία φόρτωσης των δήμων:", error);
    }
  }

  async function loadPoleis(dhmosKodikos) {
    try {
      if (!dhmosKodikos) { resetSelect(poleisSelect); return; }
      await ensureCsrfToken();

      const url = `/api/loadPoleis/${encodeURIComponent(dhmosKodikos)}`;
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Network response was not ok");

      const poleisData = await response.json();
      resetSelect(poleisSelect);
      poleisData.forEach((polis) => {
        const option = new Option(polis.perigrafh, polis.kodikos);
        if (String(polis.kodikos) === String(selectedPolhKodikos)) option.selected = true;
        poleisSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Αποτυχία φόρτωσης των πόλεων:", error);
    }
  }

  // --- Events ---
  perifereiesSelected.addEventListener("change", function () {
    loadNomoi(this.value);
  });

  nomoiSelect.addEventListener("change", function () {
    loadDhmoi(this.value);
  });

  dhmoiSelect.addEventListener("change", function () {
    loadPoleis(this.value);
  });

  // --- Αρχικοποίηση (π.χ. όταν έχεις ήδη επιλεγμένη περιφέρεια) ---
  if (perifereiesSelected.value) {
    loadNomoi(perifereiesSelected.value);
  } else {
    // καθάρισε τα υπόλοιπα ώστε να μην δείχνουν παλιές επιλογές
    resetSelect(nomoiSelect);
    resetSelect(dhmoiSelect);
    resetSelect(poleisSelect);
  }
});
