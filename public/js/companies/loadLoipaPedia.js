document.addEventListener("DOMContentLoaded", function () {
  // Συνάρτηση για τη μορφοποίηση ημερομηνιών στη μορφή YYYY-MM-DD
  function formatISODate(dateString) {
    const date = new Date(dateString);
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

      // Έλεγχος αν το id αντιστοιχεί σε πεδίο ημερομηνίας και μορφοποίηση
      if (id.includes("hmnia_katatheshs_ta") || id.includes("isxyei_eos_ta") || id.includes("hmnia_katatheshs_ia") || id.includes("isxyei_eos_ia")) {
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
  var kodLoEl = document.getElementById('kod_lo');
  var kodLogisthsValue = kodLoEl ? kodLoEl.value : '';
  if (kodLoEl) {
    var kodLogisthsValue = document.getElementById('kod_lo').value;
  }
    // Έλεγχος αν η τιμή του companyLogisths είναι κενή και ενημέρωση αν ναι
  if (!companyLogisths.value && kodLogisthsValue) {
      companyLogisths.value = kodLogisthsValue;
  }
    // Εκτέλεση της loadDataFromAPI μόνο αν το companyLogisths έχει μια έγκυρη τιμή
  if (companyLogisths.value) {
      loadDataFromAPI(`/api/logisths/${companyLogisths.value}`, formFieldsMappings.Logisths);
  }

});
