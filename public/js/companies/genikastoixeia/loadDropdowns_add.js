const fiveSpaces = '\u00A0'.repeat(5);
const sixSpaces = '\u00A0'.repeat(6);
const sevenSpaces = '\u00A0'.repeat(7);
const nineSpaces = '\u00A0'.repeat(9);
const tenSpaces = '\u00A0'.repeat(10);
const fifteenSpaces = '\u00A0'.repeat(15);

document.addEventListener("DOMContentLoaded", function () {
  const perifereiesDropdown = document.getElementById("perifereies");
  const nomosDropdown = document.getElementById("nomos");
  const dhmosDropdown = document.getElementById("dhmos");
  const polhDropdown = document.getElementById("polh");
  const pararthmataEfkaDropdown = document.getElementById("pararthmaefka");
  const allUsersDropdown = document.getElementById("selectedUsers");

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

  const pararthmaEfkaDropdown = document.getElementById("pararthmaefka");

  const addEmptyPararthmaEfkaOption = (dropdown) => {
    const emptyOption = document.createElement("option");
    emptyOption.value = ""; // Κενή τιμή
    emptyOption.textContent = ""; // Κενό κείμενο
    dropdown.appendChild(emptyOption);
  };

  // Λειτουργία για φόρτωση δεδομένων σε dropdown
  const loadPararthmataEfkaDataToDropdown = async (dropdown, data) => {
    dropdown.innerHTML = ""; // Καθαρισμός του dropdown
    addEmptyPararthmaEfkaOption(dropdown); // Προσθήκη κενής επιλογής
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.value + nineSpaces.slice(item.value.length) + item.text;
      option.style.fontFamily = "Verdana, sans-serif;";
      dropdown.appendChild(option);
    });
  };

  // Αίτημα προς τον server για να πάρει τα δεδομένα
  const fetchPararthmataEfkaDropdownData = async () => {
    try {
      const response = await fetch("/api/handlePararthmataEfka");
      const dropdownData = await response.json();
      // Φόρτωση δεδομένων στα dropdowns
      loadPararthmataEfkaDataToDropdown(pararthmaEfkaDropdown, dropdownData.pararthmaefka);
    } catch (error) {
      console.error(error);
    }
  };

  fetchPararthmataEfkaDropdownData();

// const loadPararthmataEfka = async () => {
//     pararthmataEfkaDropdown.innerHTML = '<option value="" selected></option>';
//     try {
//       const response = await fetch("/api/pararthmataEfka");
//       const data = await response.json();

//       data.forEach((pararthmaefka) => {
//         const option = new Option(
//           pararthmaefka.kodikos + fiveSpaces.slice(pararthmaefka.kodikos.length) + pararthmaefka.perigrafh,
//           pararthmaefka.kodikos,
//         );
//         pararthmataEfkaDropdown.appendChild(option);
//       });
//     } catch (error) {
//       console.error(error);
//     }
//   };

  const loadAllUsers = async () => {
    try {
      const response = await fetch("/api/allUser");
      const data = await response.json();
      data.forEach((allusers) => {
        const option = new Option(
          allusers.lastName + " " + allusers.firstName, allusers._id
        );
        allUsersDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Επιλογή DOM elements
  const tameio1Dropdown = document.getElementById("tameio1");
  const tameio2Dropdown = document.getElementById("tameio2");
  const tameio3Dropdown = document.getElementById("tameio3");
  const tameio4Dropdown = document.getElementById("tameio4");

  const addEmptyOption = (dropdown) => {
    const emptyOption = document.createElement("option");
    emptyOption.value = ""; // Κενή τιμή
    emptyOption.textContent = ""; // Κενό κείμενο ή μήνυμα
    dropdown.appendChild(emptyOption);
  };

  // Λειτουργία για φόρτωση δεδομένων σε dropdown
  const loadDataToDropdown = async (dropdown, data) => {
    dropdown.innerHTML = ""; // Καθαρισμός του dropdown
    addEmptyOption(dropdown); // Προσθήκη κενής επιλογής
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.value + sevenSpaces.slice(item.value.length) + item.text;
      dropdown.appendChild(option);
    });
  };

  // Αίτημα προς τον server για να πάρει τα δεδομένα
  const fetchDropdownData = async () => {
    try {
      const response = await fetch("/api/populatetameia");
      const dropdownData = await response.json();
      // Φόρτωση δεδομένων στα dropdowns
      loadDataToDropdown(tameio1Dropdown, dropdownData.tameio1);
      loadDataToDropdown(tameio2Dropdown, dropdownData.tameio2);
      loadDataToDropdown(tameio3Dropdown, dropdownData.tameio3);
      loadDataToDropdown(tameio4Dropdown, dropdownData.tameio4);
    } catch (error) {
      console.error(error);
    }
  };

  // Κλήση της συνάρτησης για να ανακτήσει τα δεδομένα
  fetchDropdownData();

  const doyDropdown = document.getElementById("doy");
  const doy_loDropdown = document.getElementById("doy_lo");

  const addEmptyDoyOption = (dropdown) => {
    const emptyOption = document.createElement("option");
    emptyOption.value = ""; // Κενή τιμή
    emptyOption.textContent = ""; // Κενό κείμενο
    dropdown.appendChild(emptyOption);
  };

  // Λειτουργία για φόρτωση δεδομένων σε dropdown
  const loadDoyDataToDropdown = async (dropdown, data) => {
    dropdown.innerHTML = ""; // Καθαρισμός του dropdown
    addEmptyDoyOption(dropdown); // Προσθήκη κενής επιλογής
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.value + tenSpaces.slice(item.value.length) + item.text;
      option.style.fontFamily = "Verdana, sans-serif;";
      dropdown.appendChild(option);
    });
  };

  // Αίτημα προς τον server για να πάρει τα δεδομένα
  const fetchDoyDropdownData = async () => {
    try {
      const response = await fetch("/api/populatedoy");
      const dropdownData = await response.json();
      // Φόρτωση δεδομένων στα dropdowns
      loadDoyDataToDropdown(doyDropdown, dropdownData.doy);
      loadDoyDataToDropdown(doy_loDropdown, dropdownData.doy_lo);
    } catch (error) {
      console.error(error);
    }
  };

  // Κλήση της συνάρτησης για να ανακτήσει τα δεδομένα
  fetchDoyDropdownData();

  const nomikhmorfhDropdown = document.getElementById("nomikhmorfh");
  const nomikh_morfh_em_ergDropdown = document.getElementById("nomikh_morfh_em_erg");
  const nomikh_morfh_diad_ergDropdown = document.getElementById("nomikh_morfh_diad_erg");

  const addEmptyNomikhMorfhOption = (dropdown) => {
    const emptyOption = document.createElement("option");
    emptyOption.value = ""; // Κενή τιμή
    emptyOption.textContent = ""; // Κενό κείμενο
    dropdown.appendChild(emptyOption);
  };

  // Λειτουργία για φόρτωση δεδομένων σε dropdown
  const loadNomikesMorfesDataToDropdown = async (dropdown, data) => {
    dropdown.innerHTML = ""; // Καθαρισμός του dropdown
    addEmptyNomikhMorfhOption(dropdown); // Προσθήκη κενής επιλογής
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.value + nineSpaces.slice(item.value.length) + item.text;
      option.style.fontFamily = "Verdana, sans-serif;";
      dropdown.appendChild(option);
    });
  };

  // Αίτημα προς τον server για να πάρει τα δεδομένα
  const fetchNomikesMorfesDropdownData = async () => {
    try {
      const response = await fetch("/api/handleNomikesMorfes");
      const dropdownData = await response.json();
      // Φόρτωση δεδομένων στα dropdowns
      loadNomikesMorfesDataToDropdown(nomikhmorfhDropdown, dropdownData.nomikhmorfh);
      loadNomikesMorfesDataToDropdown(nomikh_morfh_em_ergDropdown, dropdownData.nomikh_morfh_em_erg);
      loadNomikesMorfesDataToDropdown(nomikh_morfh_diad_ergDropdown, dropdownData.nomikh_morfh_diad_erg);
    } catch (error) {
      console.error(error);
    }
  };

  // Κλήση της συνάρτησης για να ανακτήσει τα δεδομένα
  fetchNomikesMorfesDropdownData();

  // Load dropdown on page load
  loadPerifereies();
  loadAllUsers();

  const inputDropdownPairs = [
    {
      input: document.getElementById("koddrast1"),
      dropdown: document.getElementById("select_kad1"),
    },
    {
      input: document.getElementById("koddrast2"),
      dropdown: document.getElementById("select_kad2"),
    },
    {
      input: document.getElementById("koddrast3"),
      dropdown: document.getElementById("select_kad3"),
    },
    {
      input: document.getElementById("koddrast4"),
      dropdown: document.getElementById("select_kad4"),
    },
    {
      input: document.getElementById("koddrast5"),
      dropdown: document.getElementById("select_kad5"),
    },
    {
      input: document.getElementById("koddrast6"),
      dropdown: document.getElementById("select_kad6"),
    },
  ];

  inputDropdownPairs.forEach(({ input, dropdown }) => {
    input.addEventListener("input", async () => {
      const searchValue = input.value;

      if (searchValue.length >= 3) {
        try {
          const index = inputDropdownPairs.findIndex(
            (pair) => pair.input === input
          );

          const response = await fetch(
            `/api/populatekad?koddrast${index + 1}=${searchValue}`
          );
          const searchData = await response.json();
          dropdown.innerHTML = "";

          searchData.forEach((result) => {
            const option = document.createElement("option");
            option.value = result.kodikos;
            option.textContent = result.kodikos + fifteenSpaces.slice(result.kodikos.length) + result.perigrafh;
            dropdown.appendChild(option);
          });
        } catch (error) {
          console.error("Σφάλμα:", error);
        }
      } else {
        dropdown.innerHTML = "";
      }
    });
  });

});
