const fiveSpaces = "\u00A0".repeat(5);
const sevenSpaces = "\u00A0".repeat(7);
const nineSpaces = "\u00A0".repeat(9);
const tenSpaces = "\u00A0".repeat(10);

document.addEventListener("DOMContentLoaded", function () {
  const perifereiesDropdown = document.getElementById("perifereies");
  const nomosDropdown = document.getElementById("nomos");
  const dhmosDropdown = document.getElementById("dhmos");
  const polhDropdown = document.getElementById("polh");
  const doyDropdown = document.getElementById("doy");
  const nomikesMorfesDropdown = document.getElementById("nomikh_morfh");
  const idiothtesDropdown = document.getElementById("idiothta");
  const typoiTaytothtonDropdown = document.getElementById("typos_taytothtas");

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

  const loadNomikesMorfes = async () => {
    nomikesMorfesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/nomikesmorfes");
      const data = await response.json();
      data.forEach((nomikesmorfes) => {
        const option = new Option(
          nomikesmorfes.kodikos + fiveSpaces.slice(nomikesmorfes.kodikos.length) + nomikesmorfes.perigrafh,
          nomikesmorfes.kodikos
        );
        nomikesMorfesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadDoy = async () => {
    doyDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/doy");
      const data = await response.json();
      data.forEach((doy) => {
        const option = new Option(
          doy.kodikos + sevenSpaces.slice(doy.kodikos.length) + doy.perigrafh,
          doy.kodikos
        );
        doyDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadIdiothtes = async () => {
    idiothtesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/idiothtes");
      const data = await response.json();
      data.forEach((idiothta) => {
        const option = new Option(
          idiothta.kodikos + tenSpaces.slice(idiothta.kodikos.length) + idiothta.perigrafh,
          idiothta.kodikos
        );
        idiothtesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadtypoiTaytothton = async () => {
    typoiTaytothtonDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/typoiTaytothton");
      const data = await response.json();
      data.forEach((typosTaytothtas) => {
        const option = new Option(
          typosTaytothtas.kodikos + tenSpaces.slice(typosTaytothtas.kodikos.length) + typosTaytothtas.perigrafh,
          typosTaytothtas.kodikos
        );
        typoiTaytothtonDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  loadPerifereies();
  loadNomikesMorfes();
  loadDoy();
  loadIdiothtes();
  loadtypoiTaytothton();

});
