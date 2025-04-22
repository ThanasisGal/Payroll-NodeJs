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
  const selectedNomosKodikos = document.getElementById("companyNomos").value;
  const selectedDhmosKodikos = document.getElementById("companyDhmos").value;
  const selectedPolhKodikos = document.getElementById("companyPolh").value;

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

async function loadNomikesMorfes() {
  try {
    const response = await fetch("/api/nomikesmorfes");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const nomikesMorfes = await response.json();

    const selectElement = document.getElementById("nomikhmorfh");
    selectElement.innerHTML = ""; // Καθαρίζουμε προηγούμενες επιλογές

    // Δημιουργία και προσθήκη του κενού option
    const emptyOption = document.createElement("option");
    emptyOption.textContent = "";
    emptyOption.value = "";
    selectElement.appendChild(emptyOption);

    nomikesMorfes.forEach((nomikh_morfh) => {
      const option = document.createElement("option");
      option.value = nomikh_morfh.kodikos;
      option.textContent = `${nomikh_morfh.kodikos}` + nineSpaces.slice(`${nomikh_morfh.kodikos.length}`) + `${nomikh_morfh.perigrafh}`;
      if (nomikh_morfh.kodikos === selectElement.getAttribute("data-selected")) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading nomikes morfes:", error);
  }
}

async function loadPararthmataEfka() {
  try {
    const response = await fetch("/api/pararthmataefka");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const pararthmataEfka = await response.json();

    const selectElement = document.getElementById("pararthmaefka");
    selectElement.innerHTML = ""; // Καθαρίζουμε προηγούμενες επιλογές

    // Δημιουργία και προσθήκη του κενού option
    const emptyOption = document.createElement("option");
    emptyOption.textContent = "";
    emptyOption.value = "";
    selectElement.appendChild(emptyOption);

    pararthmataEfka.forEach((pararthma_efka) => {
      const option = document.createElement("option");
      option.value = pararthma_efka.kodikos;
      option.textContent = `${pararthma_efka.kodikos}` + nineSpaces.slice(`${pararthma_efka.kodikos.length}`) + `${pararthma_efka.perigrafh}`;
      if (pararthma_efka.kodikos === selectElement.getAttribute("data-selected")) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading pararthmata efka:", error);
  }
}

async function loadDoyOptions() {
  try {
    // Fetch τα δεδομένα DOY
    const doyResponse = await fetch('/api/doy');
    const doyData = await doyResponse.json();

    // Fetch τα δεδομένα της εταιρείας
    const companyId = document.getElementById("companyId").value;
    const companyResponse = await fetch(`/api/companies/${companyId}`);
    const companyData = await companyResponse.json();

    // Fetch τα δεδομένα του λογιστή
    const logisthsResponse = await fetch(`/api/logisths/${companyData.logisths}`);
    const logisthsData = await logisthsResponse.json();

    fillSelectElement('doy', doyData, companyData.doy_company);
    fillSelectElement('doy_lo', doyData, logisthsData[0].doy);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

async function loadTameiaOptions() {
  try {
    // Fetch τα δεδομένα Tameia
    const tameiaResponse = await fetch('/api/tameia');
    const tameiaData = await tameiaResponse.json();

    // Fetch τα δεδομένα της εταιρείας
    const companyId = document.getElementById("companyId").value;
    const companyResponse = await fetch(`/api/companies/${companyId}`);
    const companyData = await companyResponse.json();

    // Φόρτωση των select elements για κάθε ταμείο
    for (let i = 1; i <= 4; i++) {
      const tameioField = `tameio${i}`; // Δημιουργία του ονόματος του πεδίου για κάθε ταμείο
      const tameioValue = companyData[tameioField]; // Ανάκτηση της τιμής για κάθε ταμείο από τα δεδομένα της εταιρείας
      fillSelectElement(tameioField, tameiaData, tameioValue); // Φόρτωση των δεδομένων ταμείου στο αντίστοιχο select element
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function fillSelectElement(selectId, data, selectedValue) {
  const selectElement = document.getElementById(selectId);
  selectElement.innerHTML = ''; // Καθαρισμός προηγούμενων επιλογών

  // Προσθήκη κενής επιλογής
  // selectElement.add(new Option('', ''));

  data.forEach(item => {
    const option = new Option(`${item.kodikos}` + eightSpaces.slice(`${item.kodikos.length}`) + `${item.perigrafh}`, item.kodikos);
    option.selected = item.kodikos === selectedValue;
    selectElement.add(option);
  });
}

function onDOMLoaded() {
  loadNomikesMorfes();
  loadPararthmataEfka();
  loadDoyOptions();
  loadTameiaOptions();
}

// Καλούμε την συνάρτηση κατά την φόρτωση της σελίδας
document.addEventListener("DOMContentLoaded", onDOMLoaded);
