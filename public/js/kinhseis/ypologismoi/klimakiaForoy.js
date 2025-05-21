// // Ορισμός των global arrays
// export let _KLIMAKA_FOROY = Array.from(Array(8), () => new Array(6));
// export let _AA_FOROLOGIKHS_KLIMAKAS = 8;
// export let _EKPTOSH_FOROY = [];
// export let _APODOXES_PRO_EKPTOSHS_FOROY = Array.from(Array(2), () => new Array(11));
// export let _APODOXES_PRO_EKPTOSHS_FOROY_PIN0 = Array.from(Array(11), () => new Array(9));
// export let _APODOXES_PRO_EKPTOSHS_FOROY_PIN1 = Array.from(Array(11), () => new Array(9));

// // Συνάρτηση που θα εκτελείται όταν φορτώνει το DOM
// export async function initializeKlimakiaForoy() {
//     document.addEventListener('sharedParamsReady', async function () {
//         const sharedParams = window.sharedParams;
//         _AA_FOROLOGIKHS_KLIMAKAS = parseFloat(sharedParams.genikesParametroi[27].timh);
//         await fetchData(); // Μία κλήση στον server
//     });
// }

// // Συνάρτηση λήψης δεδομένων
// export async function fetchData() {
//     try {
//         const response = await fetch(`/api/kinhseis/getKlimakiaForoy?xrhsh=${sharedParams._XRHSH}`, {
//             method: 'GET',
//             headers: { 'Content-Type': 'application/json' },
//         });

//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const klimakia = await response.json();

//         klimakia.forEach((item, i) => {
//             if (i < 8) { 
//                 _KLIMAKA_FOROY[i][0] = item.xrhsh;
//                 _KLIMAKA_FOROY[i][1] = item.apo_poso;
//                 _KLIMAKA_FOROY[i][2] = item.eos_poso;
//                 _KLIMAKA_FOROY[i][3] = item.syntelesths_foroy;
//                 _KLIMAKA_FOROY[i][4] = item.syntelesths_meioshs_ekptoshs;
//                 _KLIMAKA_FOROY[i][5] = item.syntelesths_eisforas_allhleggyhs;
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching klimakiaForoy:', error);
//         return Array.from(Array(8), () => new Array(5).fill(null));  // Επιστροφή κενών δεδομένων σε περίπτωση σφάλματος
//     }
// }

// // Συνάρτηση λήψης εκπτώσεων φόρου
// export async function fetchEkptoshForoy() {
//     try {
//         const response = await fetch(`/api/kinhseis/getEkptoshForoy`, {
//             method: 'GET',
//             headers: { 'Content-Type': 'application/json' },
//         });

//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const ekptosh = await response.json();

//         ekptosh.forEach((item, i) => {
//             _EKPTOSH_FOROY[i] = item.aa_teknon;
//             _EKPTOSH_FOROY[i] = item.posoEkptoshs;
//         });

//     } catch (error) {
//         console.error('Error fetching ekptoshForoy:', error);
//         return Array(10).fill(null);  // Δημιουργεί πίνακα με 10 θέσεις, όλες γεμάτες με null    }
//     }
// }

// // Συνάρτηση λήψης εισοδήματος πριν την έκπτωση φόρου
// export async function fetchEisodhmaProForoyMeioshs() {
//     try {
//         const response = await fetch(`/api/kinhseis/getEisodhmaProForoyMeioshs?xrhsh=${sharedParams._XRHSH}`, {
//             method: 'GET',
//             headers: { 'Content-Type': 'application/json' },
//         });

//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const data = await response.json();

//         const len = data.length;
//         const l1 = Math.floor(len / 2);

//         for (let k = 0; k < 2; k++) { 
//             if (k === 0) {
//                 for (let i = 0; i < l1; i++) {  
//                     _APODOXES_PRO_EKPTOSHS_FOROY[k][i] = data[i];
//                 }
//             } else {
//                 const i1 = l1;
//                 for (let i = i1; i < len; i++) {  
//                     const i3 = i - i1;
//                     _APODOXES_PRO_EKPTOSHS_FOROY[k][i3] = data[i];
//                 }
//             }
//         }
//     } catch (error) {
//         console.error('Error fetching eisodhmaProForoyMeioshs:', error);
//     }
// }



// === Internal "state" object ===
const STATE = {
  KLIMAKA_FOROY: Array.from(Array(8), () => new Array(6)),
  AA_FOROLOGIKHS_KLIMAKAS: 8,
  EKPTOSH_FOROY: [],
  APODOXES_PRO_EKPTOSHS_FOROY: Array.from(Array(2), () => new Array(11)),
  APODOXES_PRO_EKPTOSHS_FOROY_PIN0: Array.from(Array(11), () => new Array(9)),
  APODOXES_PRO_EKPTOSHS_FOROY_PIN1: Array.from(Array(11), () => new Array(9)),
};

// === Getters για όσα χρειάζεσαι έξω ===
export function getKlimakaForoy() {
  return STATE.KLIMAKA_FOROY;
}

export function getEkptoshForoy() {
  return STATE.EKPTOSH_FOROY;
}

export function getApodoxesProEkptoshsForoy() {
  return STATE.APODOXES_PRO_EKPTOSHS_FOROY;
}

export function getAAForologikhsKlimakas() {
  return STATE.AA_FOROLOGIKHS_KLIMAKAS;
}

// === Συνάρτηση εκκίνησης (π.χ. με το sharedParamsReady) ===
export async function initializeKlimakiaForoy() {
  document.addEventListener("sharedParamsReady", async function () {
    const sharedParams = window.sharedParams;
    STATE.AA_FOROLOGIKHS_KLIMAKAS = parseFloat(sharedParams.genikesParametroi[27].timh);
    await fetchData(); // φόρτωση κλιμακίων
  });
}

// === Φόρτωση Κλιμακίων ===
export async function fetchData() {
  try {
    const sharedParams = window.sharedParams;

    const response = await fetch(`/api/kinhseis/getKlimakiaForoy?xrhsh=${sharedParams._XRHSH}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const klimakia = await response.json();

    klimakia.forEach((item, i) => {
      if (i < 8) {
        STATE.KLIMAKA_FOROY[i][0] = item.xrhsh;
        STATE.KLIMAKA_FOROY[i][1] = item.apo_poso;
        STATE.KLIMAKA_FOROY[i][2] = item.eos_poso;
        STATE.KLIMAKA_FOROY[i][3] = item.syntelesths_foroy;
        STATE.KLIMAKA_FOROY[i][4] = item.syntelesths_meioshs_ekptoshs;
        STATE.KLIMAKA_FOROY[i][5] = item.syntelesths_eisforas_allhleggyhs;
      }
    });
  } catch (error) {
    console.error("Error fetching klimakiaForoy:", error);
  }
}

// === Φόρτωση Εκπτώσεων ===
export async function fetchEkptoshForoy() {
  try {
    const response = await fetch(`/api/kinhseis/getEkptoshForoy`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    STATE.EKPTOSH_FOROY = data.map((item) => ({
      aa_teknon: item.aa_teknon,
      posoEkptoshs: item.posoEkptoshs,
    }));
  } catch (error) {
    console.error("Error fetching ekptoshForoy:", error);
    STATE.EKPTOSH_FOROY = Array(10).fill(null);
  }
}

// === Φόρτωση αποδοχών ===
export async function fetchEisodhmaProForoyMeioshs() {
  try {
    const sharedParams = window.sharedParams;

    const response = await fetch(`/api/kinhseis/getEisodhmaProForoyMeioshs?xrhsh=${sharedParams._XRHSH}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    const len = data.length;
    const l1 = Math.floor(len / 2);

    for (let k = 0; k < 2; k++) {
      if (k === 0) {
        for (let i = 0; i < l1; i++) {
          STATE.APODOXES_PRO_EKPTOSHS_FOROY[k][i] = data[i];
        }
      } else {
        const i1 = l1;
        for (let i = i1; i < len; i++) {
          const i3 = i - i1;
          STATE.APODOXES_PRO_EKPTOSHS_FOROY[k][i3] = data[i];
        }
      }
    }
  } catch (error) {
    console.error("Error fetching eisodhmaProForoyMeioshs:", error);
  }
}
