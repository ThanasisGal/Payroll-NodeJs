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
  // const nomikh_morfhSelect = document.getElementById("nomikh_morfh");
  // const typos_taytothtasSelect = document.getElementById("typos_taytothtas");
  // const idiothtaSelect = document.getElementById("idiothta");
  // const doySelect = document.getElementById("doy");

  const selectedNomosKodikos = document.getElementById("nomimosEkprosoposNomos").value;
  const selectedDhmosKodikos = document.getElementById("nomimosEkprosoposDhmos").value;
  const selectedPolhKodikos = document.getElementById("nomimosEkprosoposPolh").value;
  // const selectedNomikhMorfhKodikos = document.getElementById("nomimosEkprosoposNomikhMorfh").value;
  // const selectedTyposTaytothtasKodikos = document.getElementById("nomimosEkprosoposTyposTaytothtas").value;
  // const selectedIdiothtaKodikos = document.getElementById("nomimosEkprosoposIdiothta").value;
  // const selectedDoyKodikos = document.getElementById("nomimosEkprosoposDoy").value;

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



function onDOMLoaded() {}

// Καλώ τις συναρτήσεις κατά την φόρτωση της σελίδας
document.addEventListener("DOMContentLoaded", onDOMLoaded);
