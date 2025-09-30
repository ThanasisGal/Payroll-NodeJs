document.addEventListener("DOMContentLoaded", function () {
  // === helpers ===
  function formatISODate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA").format(date); // YYYY-MM-DD
  }

  // πάρε CSRF από το meta
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

  // κοινές επιλογές fetch (ίδιο origin)
  const baseFetchOpts = {
    credentials: "same-origin",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {}
  };

  async function safeFetchJson(url) {
    const res = await fetch(url, baseFetchOpts);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    // Προστασία σε πιθανό άδειο σώμα
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function loadDataFromAPI(apiPath, formFields) {
    try {
      const data = await safeFetchJson(apiPath);
      if (data && (Array.isArray(data) ? data.length > 0 : true)) {
        const record = Array.isArray(data) ? data[0] : data;
        fillFormFields(record, formFields);
      }
    } catch (error) {
      console.error(`Error loading data from ${apiPath}:`, error);
    }
  }

  function fillFormFields(data, formFields) {
    formFields.forEach(({ id, key }) => {
      let value = data?.[key] ?? "";

      // αν το πεδίο είναι ημερομηνία → format
      if (
        id.includes("hmnia_katatheshs_ta") ||
        id.includes("isxyei_eos_ta") ||
        id.includes("hmnia_katatheshs_ia") ||
        id.includes("isxyei_eos_ia") ||
        id.includes("daneismos_epa_apo_em_erg") ||
        id.includes("daneismos_epa_eos_em_erg")
      ) {
        value = formatISODate(value);
      }

      const el = document.getElementById(id);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  // === mapping ===
  const formFieldsMappings = {
    TexnikosAsfaleias: [
      { id: "afm_ta", key: "afm" },
      { id: "eponymo_ta", key: "eponymo" },
      { id: "onoma_ta", key: "onoma" },
      { id: "dieythynsh_ta", key: "dieythynsh" },
      { id: "thlefono_ta", key: "thlefono" },
      { id: "ores_ta", key: "ores" },
      { id: "ap_katatheshs_ta", key: "ap_katatheshs" },
      { id: "hmnia_katatheshs_ta", key: "hmnia_katatheshs" },
      { id: "isxyei_eos_ta", key: "isxyei_eos" }
    ],
    IatrosErgasias: [
      { id: "afm_ia", key: "afm" },
      { id: "eponymo_ia", key: "eponymo" },
      { id: "onoma_ia", key: "onoma" },
      { id: "dieythynsh_ia", key: "dieythynsh" },
      { id: "thlefono_ia", key: "thlefono" },
      { id: "ores_ia", key: "ores" },
      { id: "ap_katatheshs_ia", key: "ap_katatheshs" },
      { id: "hmnia_katatheshs_ia", key: "hmnia_katatheshs" },
      { id: "isxyei_eos_ia", key: "isxyei_eos" }
    ],
    Logisths: [
      { id: "afm_lo", key: "afm" },
      { id: "eponymo_lo", key: "eponymo" },
      { id: "onoma_lo", key: "onoma" },
      { id: "dieythynsh_lo", key: "dieythynsh" },
      { id: "thlefono_lo", key: "thlefono" },
      { id: "arithmos_adeias_lo", key: "arithmos_adeias" },
      { id: "kathgoria_adeias_lo", key: "kathgoria_adeias" }
    ],
    EmmesosErgodoths: [
      { id: "afm_em_erg", key: "afm" },
      { id: "eponymo_em_erg", key: "eponymo" },
      { id: "onoma_em_erg", key: "onoma" },
      { id: "dieythynsh_em_erg", key: "dieythynsh" },
      { id: "thlefono_em_erg", key: "thlefono" },
      { id: "titlos_em_erg", key: "titlos" },
      { id: "drasthriothta_em_erg", key: "drasthriothta" },
      { id: "email_em_erg", key: "email" },
      { id: "daneismos_epa_apo_em_erg", key: "daneismosApo" },
      { id: "daneismos_epa_eos_em_erg", key: "daneismosEos" }
    ],
    DiadoxosErgodoths: [
      { id: "afm_diad_erg", key: "afm" },
      { id: "eponymo_diad_erg", key: "eponymo" },
      { id: "onoma_diad_erg", key: "onoma" },
      { id: "dieythynsh_diad_erg", key: "dieythynsh" },
      { id: "thlefono_diad_erg", key: "thlefono" },
      { id: "titlos_diad_erg", key: "titlos" },
      { id: "drasthriothta_diad_erg", key: "drasthriothta" },
      { id: "email_diad_erg", key: "email" }
    ]
  };

  // === ανάγνωση hidden & κλήσεις API ===
  function getVal(id) { return document.getElementById(id)?.value || ""; }

  const companyTexnikos = document.getElementById("companyTexnikos");
  const kodTexnikosValue = getVal("kod_ta");
  if (!companyTexnikos.value && kodTexnikosValue) companyTexnikos.value = kodTexnikosValue;
  if (companyTexnikos.value) {
    loadDataFromAPI(`/api/texnikosAsfaleias/${encodeURIComponent(companyTexnikos.value)}`, formFieldsMappings.TexnikosAsfaleias);
  }

  const companyIatros = document.getElementById("companyIatros");
  const kodIatrosValue = getVal("kod_ia");
  if (!companyIatros.value && kodIatrosValue) companyIatros.value = kodIatrosValue;
  if (companyIatros.value) {
    loadDataFromAPI(`/api/iatrosErgasias/${encodeURIComponent(companyIatros.value)}`, formFieldsMappings.IatrosErgasias);
  }

  const companyLogisths = document.getElementById("companyLogisths");
  const kodLogisthsValue = getVal("kod_lo");
  if (!companyLogisths.value && kodLogisthsValue) companyLogisths.value = kodLogisthsValue;
  if (companyLogisths.value) {
    loadDataFromAPI(`/api/logisths/${encodeURIComponent(companyLogisths.value)}`, formFieldsMappings.Logisths);
  }

  const companyEmmesosErgodoths = document.getElementById("companyEmmesosErgodoths");
  const kodEmmesosErgodothsValue = getVal("kod_em_erg");
  if (!companyEmmesosErgodoths.value && kodEmmesosErgodothsValue) companyEmmesosErgodoths.value = kodEmmesosErgodothsValue;
  if (companyEmmesosErgodoths.value) {
    loadDataFromAPI(`/api/emmesosErgodoths/${encodeURIComponent(companyEmmesosErgodoths.value)}`, formFieldsMappings.EmmesosErgodoths);
  }

  const companyDiadoxosErgodoths = document.getElementById("companyDiadoxosErgodoths");
  const kodDiadoxosErgodothsValue = getVal("kod_diad_erg");
  if (!companyDiadoxosErgodoths.value && kodDiadoxosErgodothsValue) companyDiadoxosErgodoths.value = kodDiadoxosErgodothsValue;
  if (companyDiadoxosErgodoths.value) {
    loadDataFromAPI(`/api/diadoxosErgodoths/${encodeURIComponent(companyDiadoxosErgodoths.value)}`, formFieldsMappings.DiadoxosErgodoths);
  }
});
