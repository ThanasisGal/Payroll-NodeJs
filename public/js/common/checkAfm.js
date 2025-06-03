document.addEventListener("DOMContentLoaded", () => {
  const afmMappings = {
    afm: fetchEtaireiaData,
    afm_ta: fetchTexnikosAsfaleiasData,
    afm_ia: fetchIatrosErgasiasData,
    afm_lo: fetchLogisthsData,
    afm_em_erg: fetchEmmesosErgodothsData,
    afm_diad_erg: fetchDiadoxosErgodothsData,
    afm_ergolaboy: blankFunction,
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
            html: `<div>Πληκτρολογείστε τον σωστό ΑΦΜ ή αφήστε το πεδίο κενό...</div>`,
            timer: 2500,
            focusConfirm: true,
            showConfirmButton: true,
            showCancelButton: false,
            customClass: {
              confirmButton: "class-warning custom-confirm-button custom-swal-button",
              title: 'custom-title',
              popup: "custom-swal-popup",
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

async function fetchEtaireiaData(afm) {
  const response = await fetch("/api/afmEtaireias", {
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
      html: `
        Η εταιρεία με ΑΦΜ <strong>${data.afm}<br>
        ("${data.eponymia.trim()} ${data.firstname.trim()}")</strong><br><br>
        είναι ήδη καταχωρημένη.<br>
        Δεν επιτρέπεται η διπλή ως προς το ΑΦΜ καταχώρηση...
      `,
      customClass: {
        confirmButton: 'class-error custom-confirm-button custom-swal-button',
        title: 'custom-title',
        popup: 'custom-swal-popup'
      },
      confirmButtonText: 'Κλείσιμο',
      timer: 4000
    });  
  }
}

async function fetchTexnikosAsfaleiasData(afm) {
  const response = await fetch("/api/texnikosAsfaleias", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ afm_ta: afm }),
  });

  if (response.ok) {
    const data = await response.json();
    if (data) {
      if (data.aa_kod_ta) {
        document.getElementById("kod_ta").value = data.aa_kod_ta;
      }
      if (data.doc) {
        document.getElementById("kod_ta").value = data.doc.kodikos;
        document.getElementById("eponymo_ta").value = data.doc.eponymo;
        document.getElementById("onoma_ta").value = data.doc.onoma;
        document.getElementById("dieythynsh_ta").value = data.doc.dieythynsh;
        document.getElementById("thlefono_ta").value = data.doc.thlefono;
        document.getElementById("ores_ta").value = data.doc.ores;
        document.getElementById("ap_katatheshs_ta").value = data.doc.ap_katatheshs;
        document.getElementById("hmnia_katatheshs_ta").value = window.formatISODate(data.doc.hmnia_katatheshs);    
        document.getElementById("isxyei_eos_ta").value = window.formatISODate(data.doc.isxyei_eos);    
      }
    }
  }
}

async function fetchIatrosErgasiasData(afm) {
  const response = await fetch("/api/iatrosErgasias", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ afm_ia: afm }),
  });

  if (response.ok) {
    const data = await response.json();
    if (data) {
      if (data.aa_kod_ia) {
        document.getElementById("kod_ia").value = data.aa_kod_ia;
      }
      if (data.doc) {
        document.getElementById("kod_ia").value = data.doc.kodikos;
        document.getElementById("eponymo_ia").value = data.doc.eponymo;
        document.getElementById("onoma_ia").value = data.doc.onoma;
        document.getElementById("dieythynsh_ia").value = data.doc.dieythynsh;
        document.getElementById("thlefono_ia").value = data.doc.thlefono;
        document.getElementById("ores_ia").value = data.doc.ores;
        document.getElementById("ap_katatheshs_ia").value = data.doc.ap_katatheshs;
        document.getElementById("hmnia_katatheshs_ia").value = window.formatISODate(data.doc.hmnia_katatheshs);    
        document.getElementById("isxyei_eos_ia").value = window.formatISODate(data.doc.isxyei_eos);    
        document.getElementById("hmnia_Katatheshs_ia").value = data.doc.hmnia_katatheshs;
        document.getElementById("isxyei_eos_ia").value = data.doc.isxyei_eos;
      }
    }
  }
}

async function fetchLogisthsData(afm) {
  const response = await fetch("/api/logisths", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ afm_lo: afm }),
  });

  if (response.ok) {
    const data = await response.json();
    if (data) {
      if (data.aa_kod_lo) {
        document.getElementById("kod_lo").value = data.aa_kod_lo;
      }
      if (data.doc) {
        document.getElementById("kod_lo").value = data.doc.kodikos;
        document.getElementById("eponymo_lo").value = data.doc.eponymo;
        document.getElementById("onoma_lo").value = data.doc.onoma;
        document.getElementById("dieythynsh_lo").value = data.doc.diethynsh;
        document.getElementById("thlefono_lo").value = data.doc.thlefono;
        document.getElementById("doy_lo").value = data.doc.doy;
        document.getElementById("arithmos_adeias_lo").value = data.doc.arithmos_adeias;
        document.getElementById("kathgoria_adeias_lo").value = data.doc.kathgoria_adeias;
      }
    }
  }
}

async function fetchEmmesosErgodothsData(afm) {
  const response = await fetch("/api/emmesosErgodoths", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ afm_em_erg: afm }),
  });

  if (response.ok) {
    const data = await response.json();
    if (data) {
      if (data.aa_kod_em_erg) {
        document.getElementById("kod_em_erg").value = data.aa_kod_em_erg;
      }

      if (data.doc) {
        // Ελεγχος επειδή τα πεδία daneismosApo και daneismosEos προστέθηκαν στην βάση εκ των υστέρων
        const daneismosApoElement = document.getElementById("daneismos_epa_apo_em_erg");
        if (data.doc.daneismosApo !== undefined && data.doc.daneismosApo !== null) {
          daneismosApoElement.value = data.doc.daneismosApo;
        } else {
          daneismosApoElement.value = "";
        }

        const daneismosEosElement = document.getElementById("daneismos_epa_eos_em_erg");
        if (data.doc.daneismosEos !== undefined && data.doc.daneismosEos !== null) {
          daneismosEosElement.value = data.doc.daneismosEos;
        } else {
          daneismosEosElement.value = "";
        }
  
        document.getElementById("kod_em_erg").value = data.doc.kodikos;
        document.getElementById("eponymo_em_erg").value = data.doc.eponymo;
        document.getElementById("onoma_em_erg").value = data.doc.onoma;
        document.getElementById("dieythynsh_em_erg").value = data.doc.dieythynsh;
        document.getElementById("thlefono_em_erg").value = data.doc.thlefono;
        document.getElementById("titlos_em_erg").value = data.doc.titlos;
        document.getElementById("nomikh_morfh_em_erg").value = data.doc.nomikhMorfh;
        document.getElementById("drasthriothta_em_erg").value = data.doc.drasthriothta;
        document.getElementById("email_em_erg").value = data.doc.email;
        document.getElementById("daneismos_epa_apo_em_erg").value = daneismosApoElement.value;
        document.getElementById("daneismos_epa_eos_em_erg").value = daneismosEosElement.value;
      }
    }
  }
}

async function fetchDiadoxosErgodothsData(afm) {
  const response = await fetch("/api/diadoxosErgodoths", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ afm_diad_erg: afm }),
  });

  if (response.ok) {
    const data = await response.json();
    if (data) {
      if (data.aa_kod_diad_erg) {
        document.getElementById("kod_diad_erg").value = data.aa_kod_diad_erg;
      }
      if (data.doc) {
        document.getElementById("kod_diad_erg").value = data.doc.kodikos;
        document.getElementById("eponymo_diad_erg").value = data.doc.eponymo;
        document.getElementById("onoma_diad_erg").value = data.doc.onoma;
        document.getElementById("dieythynsh_diad_erg").value = data.doc.dieythynsh;
        document.getElementById("thlefono_diad_erg").value = data.doc.thlefono;
        document.getElementById("titlos_diad_erg").value = data.doc.titlos;
        document.getElementById("nomikh_morfh_diad_erg").value = data.doc.nomikhMorfh;
        document.getElementById("drasthriothta_diad_erg").value = data.doc.drasthriothta;
        document.getElementById("email_diad_erg").value = data.doc.email;
      }
    }
  }
}

async function blankFunction(afm) {}
