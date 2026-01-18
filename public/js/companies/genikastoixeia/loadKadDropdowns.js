document.addEventListener("DOMContentLoaded", async () => {
  const company = await fetchCompanyData(); // Φορτώνουμε τα δεδομένα της εταιρείας

  const kadFields = ["kad1", "kad2", "kad3", "kad4", "kad5", "kad6"];

  kadFields.forEach(async (field, index) => {
    try {
      const kadValue = company[field]; // Παίρνουμε την τιμή από το company model
      let prefix = "";
      if (kadValue != null) {
        prefix = kadValue.substring(0, 4); // Τα 4 πρώτα γράμματα
      }

      if (prefix === "") {
        return; // Με την εντολή return, διακόπτεται η εκτέλεση του τρέχοντος iteration της forEach και προχωρά στο επόμενο
      }
    
      const response = await fetch(`/api/getKadForEditForm?prefix=${prefix}`);
      const kadData = await response.json();

      const dropdown = document.getElementById(`select_${field}`);
      dropdown.innerHTML = ""; // Καθαρίζουμε προηγούμενες επιλογές

      kadData.forEach((kad) => {
        const option = document.createElement("option");
        option.value = kad.kodikos;
        option.textContent = kad.kodikos + fifteenSpaces.slice(kad.kodikos.length) + kad.perigrafh;
        option.selected = kad.kodikos === kadValue; // Επιλέγουμε αν ισχύει
        dropdown.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading KadModel data:", error);
    }
  });

  attachInputEventHandlers();
});

async function fetchCompanyData() {
  try {
    const companyId = document.getElementById("companyId").value;
    const response = await fetch(`/api/getKads/${companyId}`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Could not fetch company data:", error);
    return null;
  }
}

function attachInputEventHandlers() {
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
          console.error("Error fetching data:", error);
        }
      } else {
        dropdown.innerHTML = "";
      }
    });
  });
}
