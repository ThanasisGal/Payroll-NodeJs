const nineSpaces = "\u00A0".repeat(9);
const tenSpaces = "\u00A0".repeat(10);

document.addEventListener("DOMContentLoaded", function () {
  const perifereiesDropdown = document.getElementById("perifereies");
  const nomosDropdown = document.getElementById("nomos");
  const dhmosDropdown = document.getElementById("dhmos");
  const polhDropdown = document.getElementById("polh");

  // Load data to the 'perifereies' dropdown from MongoDB
  const loadPerifereies = async () => {
    perifereiesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/perifereies");
      const data = await response.json();
      data.forEach((perifereia) => {
        const option = new Option(perifereia.perigrafh, perifereia.kodikos);
        perifereiesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Change event listener for 'perifereies' dropdown
  perifereiesDropdown.addEventListener("change", async () => {
    const selectedPerifereia = perifereiesDropdown.value;
    nomosDropdown.innerHTML = '<option value="" selected></option>';
    nomosDropdown.disabled = true;

    if (selectedPerifereia) {
      try {
        const response = await fetch(
          `/api/nomoi?perifereia=${selectedPerifereia}`
        );
        const data = await response.json();

        data.forEach((nomos) => {
          const option = new Option(nomos.perigrafh, nomos.kodikos);
          nomosDropdown.appendChild(option);
        });

        nomosDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Change event listener for 'nomos' dropdown
  nomosDropdown.addEventListener("change", async () => {
    const selectedNomos = nomosDropdown.value;
    dhmosDropdown.innerHTML = '<option value="" selected></option>';
    dhmosDropdown.disabled = true;

    if (selectedNomos) {
      try {
        const response = await fetch(`/api/dhmoi?nomos=${selectedNomos}`);
        const data = await response.json();

        data.forEach((dhmos) => {
          const option = new Option(dhmos.perigrafh, dhmos.kodikos);
          dhmosDropdown.appendChild(option);
        });

        dhmosDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Change event listener for 'dhmos' dropdown
  dhmosDropdown.addEventListener("change", async () => {
    const selectedDhmos = dhmosDropdown.value;
    polhDropdown.innerHTML = '<option value="" selected></option>';
    polhDropdown.disabled = true;

    if (selectedDhmos) {
      try {
        const response = await fetch(`/api/poleis?dhmos=${selectedDhmos}`);
        const data = await response.json();

        data.forEach((poleis) => {
          const option = new Option(poleis.perigrafh, poleis.kodikos);
          polhDropdown.appendChild(option);
        });

        polhDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
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
        option.textContent =
          `${pararthma.kodikos}` +
          nineSpaces.slice(`${pararthma.kodikos.length}`) +
          `${pararthma.perigrafh}`;
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
        option.textContent =
          `${sepe.kodikos}` +
          tenSpaces.slice(`${sepe.kodikos.length}`) +
          `${sepe.perigrafh}`;
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
        option.textContent =
          `${dypa.kodikos}` +
          tenSpaces.slice(`${dypa.kodikos.length}`) +
          `${dypa.perigrafh}`;
        selectElement.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading dypa:", error);
    }
  }
  
  loadPerifereies();
  loadPararthmataEfka("pararthma_efka");
  loadPararthmataEfka("pararthma_efka_ergolaboy");
  loadSepe();
  loadDypa();

});
