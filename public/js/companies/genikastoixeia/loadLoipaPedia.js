document.addEventListener("DOMContentLoaded", function () {
  // Συνάρτηση για τη μορφοποίηση ημερομηνιών στη μορφή YYYY-MM-DD
  function formatISODate(dateString) {
    if (!dateString) {
      // Ελέγχει αν η τιμή είναι null, undefined, ή κενή συμβολοσειρά και επιστρέφει κενή συμβολοσειρά
      return "";
    }
  
    const date = new Date(dateString);
    // Ελέγχει αν η ημερομηνία είναι έγκυρη πριν τη μορφοποίηση
    if (isNaN(date.getTime())) {
      return "";
    }
  
    return new Intl.DateTimeFormat('en-CA').format(date); // Μορφή YYYY-MM-DD
  }

  // Ασύγχρονη συνάρτηση για τη φόρτωση δεδομένων από το API και συμπλήρωση της φόρμας
  async function loadDataFromAPI(apiPath, formFields) {
    try {
      const response = await fetch(apiPath);
      const data = await response.json();
      if (data && data.length > 0) {
        fillFormFields(data[0], formFields);
      }
    } catch (error) {
      console.error(`Error loading data from ${apiPath}:`, error);
    }
  }

  // Συνάρτηση για τη συμπλήρωση των πεδίων της φόρμας με τα ανακτηθέντα δεδομένα
  function fillFormFields(data, formFields) {
    formFields.forEach((field) => {
      const { id, key } = field;
      let value = data[key];

      // Έλεγχος αν το id αντιστοιχεί σε πεδίο ημερομηνίας και κάνει μορφοποίηση
      if (id.includes("hmnia_katatheshs_ta") || 
          id.includes("isxyei_eos_ta") || 
          id.includes("hmnia_katatheshs_ia") || 
          id.includes("isxyei_eos_ia") ||
          id.includes("daneismos_epa_apo_em_erg") || 
          id.includes("daneismos_epa_eos_em_erg")) {
        value = formatISODate(data[key]);
      }

      const element = document.getElementById(id);
      if (element) {
        element.value = value;
      }
    });
  }

  // Ορισμοί των πεδίων φόρμας για κάθε κατηγορία
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
      { id: "isxyei_eos_ta", key: "isxyei_eos" },
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
      { id: "isxyei_eos_ia", key: "isxyei_eos" },
    ],
    Logisths: [
      { id: "afm_lo", key: "afm" },
      { id: "eponymo_lo", key: "eponymo" },
      { id: "onoma_lo", key: "onoma" },
      { id: "dieythynsh_lo", key: "dieythynsh" },
      { id: "thlefono_lo", key: "thlefono" },
      { id: "arithmos_adeias_lo", key: "arithmos_adeias" },
      { id: "kathgoria_adeias_lo", key: "kathgoria_adeias" },
    ],
    EmmesosErgodoths: [
      { id: "afm_em_erg", key: "afm" },
      { id: "eponymo_em_erg", key: "eponymo" },
      { id: "onoma_em_erg", key: "onoma" },
      { id: "dieythynsh_em_erg", key: "dieythynsh" },
      { id: "thlefono_em_erg", key: "thlefono" },
      { id: "titlos_em_erg", key: "titlos" },
      { id: "nomikh_morfh_em_erg", key: "nomikhMorfh" },
      { id: "drasthriothta_em_erg", key: "drasthriothta" },
      { id: "email_em_erg", key: "email" },
      { id: "daneismos_epa_apo_em_erg", key: "daneismosApo" },
      { id: "daneismos_epa_eos_em_erg", key: "daneismosEos" },
    ],
    DiadoxosErgodoths: [
      { id: "afm_diad_erg", key: "afm" },
      { id: "eponymo_diad_erg", key: "eponymo" },
      { id: "onoma_diad_erg", key: "onoma" },
      { id: "dieythynsh_diad_erg", key: "dieythynsh" },
      { id: "thlefono_diad_erg", key: "thlefono" },
      { id: "titlos_diad_erg", key: "titlos" },
      { id: "nomikh_morfh_diad_erg", key: "nomikhMorfh" },
      { id: "drasthriothta_diad_erg", key: "drasthriothta" },
      { id: "email_diad_erg", key: "email" },
    ],
  };

  // Κλήση της loadDataFromAPI για κάθε κατηγορία με τα αντίστοιχα πεδία αφου πρώτα ελέγξω την τιμή των hidden πεδίων companyTexnikos, companyIatros, companyLogisths

  var companyTexnikos = document.getElementById('companyTexnikos');
  var kodTexnikosValue = document.getElementById('kod_ta').value;
  // Έλεγχος αν η τιμή του companyTexnikos είναι κενή και ενημέρωση αν ναι
  if (!companyTexnikos.value && kodTexnikosValue) {
    companyTexnikos.value = kodTexnikosValue;
  }
  // Εκτέλεση της loadDataFromAPI μόνο αν το companyTexnikos έχει μια έγκυρη τιμή
  if (companyTexnikos.value) {
    loadDataFromAPI(`/api/texnikosAsfaleias/${companyTexnikos.value}`, formFieldsMappings.TexnikosAsfaleias);
  }
  
  var companyIatros = document.getElementById('companyIatros');
  var kodIatrosValue = document.getElementById('kod_ia').value;
    // Έλεγχος αν η τιμή του companyIatros είναι κενή και ενημέρωση αν ναι
  if (!companyIatros.value && kodIatrosValue) {
      companyIatros.value = kodIatrosValue;
  }
    // Εκτέλεση της loadDataFromAPI μόνο αν το companyIatros έχει μια έγκυρη τιμή
  if (companyIatros.value) {
      loadDataFromAPI(`/api/iatrosErgasias/${companyIatros.value}`, formFieldsMappings.IatrosErgasias);
  }

  var companyLogisths = document.getElementById('companyLogisths');
  // var kodLoEl = document.getElementById('kod_lo');
  // var kodLogisthsValue = kodLoEl ? kodLoEl.value : '';
  // if (kodLoEl) {
  var kodLogisthsValue = document.getElementById('kod_lo').value;
  // }

  // Έλεγχος αν η τιμή του companyLogisths είναι κενή και ενημέρωση αν ναι
  if (!companyLogisths.value && kodLogisthsValue) {
      companyLogisths.value = kodLogisthsValue;
  }
    // Εκτέλεση της loadDataFromAPI μόνο αν το companyLogisths έχει μια έγκυρη τιμή
  if (companyLogisths.value) {
      loadDataFromAPI(`/api/logisths/${companyLogisths.value}`, formFieldsMappings.Logisths);
  }

  var companyEmmesosErgodoths = document.getElementById('companyEmmesosErgodoths');
  var kodEmmesosErgodothsValue = document.getElementById('kod_em_erg').value;
    // Έλεγχος αν η τιμή του companyEmmesosErgodoths είναι κενή και ενημέρωση αν ναι
  if (!companyEmmesosErgodoths.value && kodEmmesosErgodothsValue) {
      companyEmmesosErgodoths.value = kodEmmesosErgodothsValue;
  }
    // Εκτέλεση της loadDataFromAPI μόνο αν το companyEmmesosErgodoths έχει μια έγκυρη τιμή
  if (companyEmmesosErgodoths.value) {
      loadDataFromAPI(`/api/emmesosErgodoths/${companyEmmesosErgodoths.value}`, formFieldsMappings.EmmesosErgodoths);
  }

  var companyDiadoxosErgodoths = document.getElementById('companyDiadoxosErgodoths');
  var kodDiadoxosErgodothsValue = document.getElementById('kod_diad_erg').value;
    // Έλεγχος αν η τιμή του companyDiadoxosErgodoths είναι κενή και ενημέρωση αν ναι
  if (!companyDiadoxosErgodoths.value && kodDiadoxosErgodothsValue) {
      companyDiadoxosErgodoths.value = kodDiadoxosErgodothsValue;
  }
    // Εκτέλεση της loadDataFromAPI μόνο αν το companyDiadoxosErgodoths έχει μια έγκυρη τιμή
  if (companyDiadoxosErgodoths.value) {
      loadDataFromAPI(`/api/diadoxosErgodoths/${companyDiadoxosErgodoths.value}`, formFieldsMappings.DiadoxosErgodoths);
  }
});
