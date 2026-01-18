document.addEventListener("DOMContentLoaded", function () {
  const symbaseisDropdown = document.getElementById("symbash");
  const kathgoriesSymbaseonDropdown = document.getElementById("kathgoria_symbashs");
  const eidikothtesSymbaseonDropdown = document.getElementById("eidikothta_symbashs");
  
  const loadSymbaseis = async () => {
    symbaseisDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/symbaseis");
      const data = await response.json();

      let textToConvert
      data.forEach((symbash) => {
        textToConvert = removeGreekAccentsAndToUpper(symbash.perigrafh);
        const option = new Option(symbash.kodikos.padEnd(10, '\u00A0') + textToConvert, symbash.kodikos);
        symbaseisDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  var kodikosSymbashs, kodikosKathgorias;

  // Change event listener for 'symbaseis' dropdown
  symbaseisDropdown.addEventListener("change", async () => {
    const selectedSymbash = symbaseisDropdown.value;
    kodikosSymbashs = selectedSymbash;
    kathgoriesSymbaseonDropdown.innerHTML = '<option value="" selected></option>';
    kathgoriesSymbaseonDropdown.disabled = true;

    if (selectedSymbash) {
      try {
        const response = await fetch( `/api/kathgoriesSymbaseon/${selectedSymbash}` );
        const data = await response.json();

        data.forEach((kathgoriaSymbashs) => {
          const option = new Option(kathgoriaSymbashs.kodikos.padEnd(10,'\u00A0') + kathgoriaSymbashs.perigrafh, kathgoriaSymbashs.kodikos);
          kathgoriesSymbaseonDropdown.appendChild(option);
        });

        kathgoriesSymbaseonDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Change event listener for 'kathgoriesSymbaseon' dropdown
  kathgoriesSymbaseonDropdown.addEventListener("change", async () => {
    const selectedKathgoria = kathgoriesSymbaseonDropdown.value;
    kodikosKathgorias = selectedKathgoria;
    eidikothtesSymbaseonDropdown.innerHTML = '<option value="" selected></option>';
    eidikothtesSymbaseonDropdown.disabled = true;

    if (selectedKathgoria) {
      try {
        const response = await fetch( `/api/eidikothtesSymbaseon/${kodikosSymbashs}${selectedKathgoria}` );
        const data = await response.json();

        console.log(data)

        data.forEach((eidikothtaSymbashs) => {
          const option = new Option(eidikothtaSymbashs.kodikos.padEnd(10,'\u00A0') + eidikothtaSymbashs.perigrafh, eidikothtaSymbashs.kodikos);
          eidikothtesSymbaseonDropdown.appendChild(option);
        });

        eidikothtesSymbaseonDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Change event listener for 'eidikothtesSymbaseon' dropdown
  eidikothtesSymbaseonDropdown.addEventListener("change", async () => {
    const selectedEidkothta = eidikothtesSymbaseonDropdown.value;
    document.getElementById('kodikosSymbashs').value = kodikosSymbashs;
    document.getElementById('kodikosKathgorias').value = kodikosKathgorias;
    document.getElementById('kodikosEidikothtas').value = selectedEidkothta;
  });

  loadSymbaseis();
});

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
