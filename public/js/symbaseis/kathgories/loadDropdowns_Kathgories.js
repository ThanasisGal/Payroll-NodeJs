document.addEventListener("DOMContentLoaded", function () {
  const symbaseisDropdown = document.getElementById("symbash");
  
  const loadSymbaseis = async () => {
    symbaseisDropdown.innerHTML = '<option value="" selected></option>';
    document.getElementById("add-btn").href = "#";
    document.getElementById("selectedSymbash").value = null;
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

  symbaseisDropdown.addEventListener("change", async () => {
    const myTableBody = document.querySelector("#myTable tbody");
    myTableBody.innerHTML = ''; // Καθαρισμός προηγούμενων κατηγοριών

    const selectedSymbashId = symbaseisDropdown.value;
    document.getElementById("selectedSymbash").value = selectedSymbashId;
    document.getElementById("selected_Symbash").value = selectedSymbashId;
    document.getElementById("add-btn").href = "/symbaseis/kathgories/add/" + selectedSymbashId;

    if (selectedSymbashId) {
      try {
        const response = await fetch(`/api/symbaseis/kathgories/${selectedSymbashId}`, {
          headers: {
            'Accept': 'application/json',
          }
        });
        if (!response.ok) throw new Error("Σφάλμα κατά τη φόρτωση των κατηγοριών συμβάσεων");

        const kathgories = await response.json();
      
        if (kathgories.length === 0) {
          myTableBody.innerHTML = '<tr><td colspan="2" class="records-not-found">Δεν βρέθηκαν εγγραφές.</td></tr>';
        } else {
          if (kathgories && Array.isArray(kathgories.kathgoriesSymbaseon)) { // Ελέγχει αν το kathgories.kathgoriesSymbaseon είναι πίνακας
            kathgories.kathgoriesSymbaseon.forEach(kathgoria => {
              const row = `<tr class="input-content-regular" data-id="${kathgoria._id}">
                            <td class="col-1">${kathgoria.kodikos}</td>
                            <td class="col-11">${kathgoria.perigrafh}</td>
                          </tr>`;
              myTableBody.innerHTML += row;
            });
          } else {
            console.error('Τα δεδομένα δεν είναι στην αναμενόμενη μορφή');
          }
        }
      } catch (error) {
        console.error(error);
        myTableBody.innerHTML = '<tr><td colspan="2" class="records-not-found">Σφάλμα κατά τη φόρτωση.</td></tr>';
      }
    };
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
