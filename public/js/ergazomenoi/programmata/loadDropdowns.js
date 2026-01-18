const threeSpaces = '\u00A0'.repeat(3);
const fiveSpaces = '\u00A0'.repeat(5);
const sixSpaces = '\u00A0'.repeat(6);
const sevenSpaces = '\u00A0'.repeat(7);
const nineSpaces = '\u00A0'.repeat(9);
const tenSpaces = '\u00A0'.repeat(10);
const fifteenSpaces = '\u00A0'.repeat(15);

let selectedTeam = null;
let selectedCompany = null;

document.addEventListener("DOMContentLoaded", function () {
  const ergazomenoiDropdown = document.getElementById("ergazomenos");
  const ergazomenoi2Dropdown = document.getElementById("ergazomenos2");
  
  selectedTeam = document.getElementById("team").value
  selectedCompany = document.getElementById("company_kod").value

  const loadErgazomenoi = async () => {
    ergazomenoiDropdown.innerHTML = '';
    ergazomenoi2Dropdown.innerHTML = '';
    const emptyOption = new Option('', '');
    ergazomenoiDropdown.appendChild(emptyOption);
    ergazomenoi2Dropdown.appendChild(emptyOption.cloneNode(true));

    try {
      const response = await fetch(`/api/getAllErgazomenoi/${selectedTeam}/${selectedCompany}`);
      const data = await response.json();
      data.forEach((data) => {

        let txtContent = data.eponymo.substring(0, 30).padEnd(30, '\u00A0') + threeSpaces + 
                         data.patronymo.substring(0, 3).padEnd(3, '\u00A0') + threeSpaces + 
                         data.onoma.substring(0, 20).padEnd(20, '\u00A0') + threeSpaces + 
                         data.afm.substring(0, 10).padEnd(10, '\u00A0') + threeSpaces + 
                         data.kodikos.substring(0, 4).padEnd(4, '\u00A0');

        const option = new Option(txtContent, data._id);
        const option2 = option.cloneNode(true); // Κλωνοποίηση για το δεύτερο dropdown
        ergazomenoiDropdown.appendChild(option);
        ergazomenoi2Dropdown.appendChild(option2);
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Change event listener for 'ergazomenos' dropdown
  ergazomenoiDropdown.addEventListener("change", async () => {
    const selectedErgazomenos = ergazomenoiDropdown.value;
    document.getElementById("idHidden").value = selectedErgazomenos;

    const selectedOption = ergazomenoiDropdown.options[ergazomenoiDropdown.selectedIndex];
    if (selectedOption.value) {
      const txtContent = selectedOption.text;
      const lastFourChars = txtContent.slice(-4);
      document.getElementById("kodikosHidden").value = lastFourChars;
      document.getElementById("afmHidden").value = txtContent.slice(-17, -7);
      try {
        let selectedKodikos = document.getElementById("kodikosHidden").value;
        const response = await fetch(`/api/getErgazomeno/${selectedTeam}/${selectedCompany}/${selectedKodikos}`);
        const data = await response.json();
        document.getElementById("hmeromhnia_proslhpshs_hidden").value = data.hmeromhnia_proslhpshs.slice(0, 10);
        document.getElementById("eidikh_kathgoria_ergazomenoy").value = data.eidikh_kathgoria_ergazomenoy;
      } catch (error) {
        console.error(error);
      }
    } else {
      document.getElementById("kodikosHidden").value = '';
      document.getElementById("afmHidden").value = '';
    }
  });
  
  // Change event listener for 'ergazomenos2' dropdown
  ergazomenoi2Dropdown.addEventListener("change", async () => {
    const selectedOption = ergazomenoi2Dropdown.options[ergazomenoi2Dropdown.selectedIndex];
    if (selectedOption.value) {
      const txtContent = selectedOption.text;
      const lastFourChars = txtContent.slice(-4);
      document.getElementById("kodikos2Hidden").value = lastFourChars;
      try {
        let selectedKodikos = document.getElementById("kodikos2Hidden").value;
        const response = await fetch(`/api/getErgazomeno/${selectedTeam}/${selectedCompany}/${selectedKodikos}`);
        const data = await response.json();
        document.getElementById("hmeromhnia_proslhpshs_hidden2").value = data.hmeromhnia_proslhpshs.slice(0, 10);
        document.getElementById("eidikh_kathgoria_ergazomenoy2").value = data.eidikh_kathgoria_ergazomenoy;
      } catch (error) {
        console.error(error);
      }
    } else {
      document.getElementById("kodikos2Hidden").value = '';
    }
  });

  loadErgazomenoi();

})

function removeGreekAccentsAndToUpper(text) {
  const mapping = {
      'ά': 'Α', 'έ': 'Ε', 'ή': 'Η', 'ί': 'Ι', 'ό': 'Ο', 'ύ': 'Υ', 'ώ': 'Ω',
      'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
      'ϊ': 'Ι', 'ΐ': 'Ι', 'ϋ': 'Υ', 'ΰ': 'Υ', 'Ϊ': 'Ι', 'Ϋ': 'Υ'
  };

  return text.split('').map(function(char) {
      return mapping[char] || char;
  }).join('').toUpperCase();
}
