const nineSpaces = "\u00A0".repeat(9);
const tenSpaces = "\u00A0".repeat(10);

document.addEventListener("DOMContentLoaded", function () {
  // 1) Πάρε token από <meta> (αν υπάρχει)
  let CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || null;

  // 2) Αν δεν υπάρχει meta, ζήτα το από endpoint (βλ. server πιο κάτω)
  const ensureCsrfToken = async () => {
    if (CSRF_TOKEN) return;
    const r = await fetch("/api/csrf-token", { credentials: "same-origin" });
    const j = await r.json();
    CSRF_TOKEN = j.csrfToken;
  };

  // 3) Helper για GET/POST κ.λπ. με headers + cookies
  const apiFetch = (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (CSRF_TOKEN) headers.set("X-CSRF-Token", CSRF_TOKEN);

    return fetch(url, {
      credentials: "same-origin", // στέλνει τα session cookies μόνο στο ίδιο origin
      ...options,
      headers
    });
  };

  const perifereiesDropdown = document.getElementById("perifereies");
  const nomosDropdown = document.getElementById("nomos");
  const dhmosDropdown = document.getElementById("dhmos");
  const polhDropdown = document.getElementById("polh");

  // Load data to the 'perifereies' dropdown from MongoDB
  const loadPerifereies = async () => {
    perifereiesDropdown.innerHTML = '<option value="" selected></option>';
      try {
      await ensureCsrfToken(); // σιγουρεύομαι ότι έχω token πριν τις κλήσεις
      const response = await apiFetch("/api/perifereies");
      const data = await response.json();
      data.forEach((perifereia) => {
        const option = new Option(perifereia.perigrafh, perifereia.kodikos);
        perifereiesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  perifereiesDropdown.addEventListener("change", async () => {
    const selectedPerifereia = perifereiesDropdown.value;
    nomosDropdown.innerHTML = '<option value="" selected></option>';
    nomosDropdown.disabled = true;

    if (selectedPerifereia) {
      try {
        const response = await apiFetch(`/api/nomoi?perifereia=${encodeURIComponent(selectedPerifereia)}`);
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
        const response = await apiFetch(`/api/dhmoi?nomos=${encodeURIComponent(selectedNomos)}`);
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
        const response = await apiFetch(`/api/poleis?dhmos=${encodeURIComponent(selectedDhmos)}`);
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

  loadPerifereies();

});
