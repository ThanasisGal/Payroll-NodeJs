const twoSpaces = '\u00A0'.repeat(2);
const threeSpaces = '\u00A0'.repeat(3);
const fourSpaces = '\u00A0'.repeat(4);
const fiveSpaces = '\u00A0'.repeat(5);
const sixSpaces = '\u00A0'.repeat(6);
const sevenSpaces = '\u00A0'.repeat(7);
const eightSpaces = '\u00A0'.repeat(8);
const nineSpaces = '\u00A0'.repeat(9);
const tenSpaces = '\u00A0'.repeat(10);
const fifteenSpaces = '\u00A0'.repeat(15);

document.addEventListener("DOMContentLoaded", function () {
  const perifereiesSelected = document.getElementById("perifereies");
  const nomoiSelect = document.getElementById("nomos");
  const dhmoiSelect = document.getElementById("dhmos");
  const poleisSelect = document.getElementById("polh");
  const selectedNomosKodikos = document.getElementById("ypokatasthmataNomos").value;
  const selectedDhmosKodikos = document.getElementById("ypokatasthmataDhmos").value;
  const selectedPolhKodikos = document.getElementById("ypokatasthmataPolh").value;

  async function loadNomoi(perifereiaKodikos) {
    try {
      const response = await fetch(`/api/loadNomoi/${perifereiaKodikos}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const nomoiData = await response.json();
      nomoiSelect.innerHTML = '<option value=""></option>';
      nomoiData.forEach((nomoi) => {
        let option = new Option(nomoi.perigrafh, nomoi.kodikos);
        if (nomoi.kodikos == selectedNomosKodikos) {
          option.selected = true;
        }
        nomoiSelect.appendChild(option);
      });
      if (selectedNomosKodikos) {
        loadDhmoi(selectedNomosKodikos);
      }
    } catch (error) {
      console.error("Αποτυχία φόρτωσης των νομών:", error);
    }
  }

  async function loadDhmoi(nomosKodikos) {
    try {
      const response = await fetch(`/api/loadDhmoi/${nomosKodikos}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const dhmoiData = await response.json();
      dhmoiSelect.innerHTML = '<option value=""></option>';
      dhmoiData.forEach((dhmoi) => {
        let option = new Option(dhmoi.perigrafh, dhmoi.kodikos);
        if (dhmoi.kodikos == selectedDhmosKodikos) {
          option.selected = true;
        }
        dhmoiSelect.appendChild(option);
      });
      if (selectedDhmosKodikos) {
        loadPoleis(selectedDhmosKodikos);
      }
    } catch (error) {
      console.error("Αποτυχία φόρτωσης των δήμων:", error);
    }
  }

  async function loadPoleis(dhmosKodikos) {
    try {
      const response = await fetch(`/api/loadPoleis/${dhmosKodikos}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const poleisData = await response.json();
      poleisSelect.innerHTML = '<option value=""></option>';
      poleisData.forEach((polis) => {
        let option = new Option(polis.perigrafh, polis.kodikos);
        if (polis.kodikos == selectedPolhKodikos) {
          option.selected = true;
        }
        poleisSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Αποτυχία φόρτωσης των πόλεων:", error);
    }
  }

  perifereiesSelected.addEventListener("change", function () {
    loadNomoi(this.value);
  });

  nomoiSelect.addEventListener("change", function () {
    loadDhmoi(this.value);
  });

  dhmoiSelect.addEventListener("change", function () {
    loadPoleis(this.value);
  });

  if (perifereiesSelected.value) {
    loadNomoi(perifereiesSelected.value);
  }
});

async function loadPararthmataEfka(selectId) {
  try {
    const response = await fetch("/api/pararthmataefka");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const pararthmataEfka = await response.json();

    // Βρίσκουμε το στοιχείο select με βάση το παρεχόμενο ID
    const selectElement = document.getElementById(selectId);
    selectElement.innerHTML = ""; // Καθαρίζουμε προηγούμενες επιλογές

    // Προσθήκη επιλογών από τα δεδομένα
    pararthmataEfka.forEach((pararthma) => {
      const option = document.createElement("option");
      option.value = pararthma.kodikos;
      option.textContent = `${pararthma.kodikos}` + nineSpaces.slice(`${pararthma.kodikos.length}`) + `${pararthma.perigrafh}`;
      if (pararthma.kodikos === selectElement.getAttribute("data-selected")) {
        option.selected = true;
      }
       selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading pararthmata efka:", error);
  }
}

async function loadSepe() {
  try {
    const response = await fetch("/api/sepe");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const sepeData = await response.json();

    const selectElement = document.getElementById("sepe");
    selectElement.innerHTML = ""; // Καθαρίζουμε προηγούμενες επιλογές

    // Δημιουργία και προσθήκη του κενού option
    const emptyOption = document.createElement("option");
    emptyOption.textContent = "";
    emptyOption.value = "";
    selectElement.appendChild(emptyOption);

    sepeData.forEach((sepe) => {
      const option = document.createElement("option");
      option.value = sepe.kodikos;
      option.textContent = `${sepe.kodikos}` + tenSpaces.slice(`${sepe.kodikos.length}`) + `${sepe.perigrafh}`;
      if (sepe.kodikos === selectElement.getAttribute("data-selected")) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading sepe:", error);
  }
}

async function loadDypa() {
  try {
    const response = await fetch("/api/dypa");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const dypaData = await response.json();

    const selectElement = document.getElementById("dypa");
    selectElement.innerHTML = ""; // Καθαρίζουμε προηγούμενες επιλογές

    // Δημιουργία και προσθήκη του κενού option
    const emptyOption = document.createElement("option");
    emptyOption.textContent = "";
    emptyOption.value = "";
    selectElement.appendChild(emptyOption);

    dypaData.forEach((dypa) => {
      const option = document.createElement("option");
      option.value = dypa.kodikos;
      option.textContent = `${dypa.kodikos}` + tenSpaces.slice(`${dypa.kodikos.length}`) + `${dypa.perigrafh}`;
      if (dypa.kodikos === selectElement.getAttribute("data-selected")) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading dypa:", error);
  }
}

function onDOMLoaded() {
  loadPararthmataEfka("pararthma_efka");
  loadPararthmataEfka("pararthma_efka_ergolaboy");
  loadSepe();
  loadDypa();
}

// Καλώ τις συναρτήσεις κατά την φόρτωση της σελίδας
document.addEventListener("DOMContentLoaded", onDOMLoaded);
