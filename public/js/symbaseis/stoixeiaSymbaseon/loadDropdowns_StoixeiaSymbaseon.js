document.addEventListener("DOMContentLoaded", function () {
  const symbaseisDropdown = document.getElementById("symbash");
  const kathgoriesSymbaseonDropdown = document.getElementById("kathgoria_symbashs");
  const eidikothtesSymbaseonDropdown = document.getElementById("eidikothta_symbashs");

  // Φόρτωση συμβάσεων
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

  var kodikosSymbashs, kodikosKathgorias;

  // Event listeners για την αλλαγή στα dropdowns
  symbaseisDropdown.addEventListener("change", async () => {
    const selectedSymbash = symbaseisDropdown.value;
    kodikosSymbashs = selectedSymbash;
    kathgoriesSymbaseonDropdown.innerHTML = '<option value="" selected></option>';
    kathgoriesSymbaseonDropdown.disabled = true;

    if (selectedSymbash) {
      try {
        const response = await fetch(`/api/kathgoriesSymbaseon/${selectedSymbash}`);
        const data = await response.json();

        data.forEach((kathgoriaSymbashs) => {
          const option = new Option(kathgoriaSymbashs.kodikos.padEnd(10, '\u00A0') + kathgoriaSymbashs.perigrafh, kathgoriaSymbashs.kodikos);
          kathgoriesSymbaseonDropdown.appendChild(option);
        });

        kathgoriesSymbaseonDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  kathgoriesSymbaseonDropdown.addEventListener("change", async () => {
    const selectedKathgoria = kathgoriesSymbaseonDropdown.value;
    kodikosKathgorias = selectedKathgoria;
    eidikothtesSymbaseonDropdown.innerHTML = '<option value="" selected></option>';
    eidikothtesSymbaseonDropdown.disabled = true;

    if (selectedKathgoria) {
      try {
        const response = await fetch(`/api/eidikothtesSymbaseon/${kodikosSymbashs}${selectedKathgoria}`);
        const data = await response.json();

        data.forEach((eidikothtaSymbashs) => {
          const option = new Option(eidikothtaSymbashs.kodikos.padEnd(10, '\u00A0') + eidikothtaSymbashs.perigrafh, eidikothtaSymbashs.kodikos);
          eidikothtesSymbaseonDropdown.appendChild(option);
        });

        eidikothtesSymbaseonDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  eidikothtesSymbaseonDropdown.addEventListener("change", async () => {
    const selectedEidikothtaId = eidikothtesSymbaseonDropdown.value;
    document.getElementById("selectedSymbash").value = kodikosSymbashs;
    document.getElementById("selected_Symbash").value = kodikosSymbashs;
    document.getElementById("selectedKathgoria").value = kodikosKathgorias;
    document.getElementById("selected_Kathgoria").value = kodikosKathgorias;
    document.getElementById("selectedEidikothta").value = selectedEidikothtaId;
    document.getElementById("selected_Eidikothta").value = selectedEidikothtaId;
    document.getElementById("add-btn").href = `/symbaseis/stoixeiaSymbaseon/add/${kodikosSymbashs}${kodikosKathgorias}${ selectedEidikothtaId}`;

    loadPageData(1);  // Καλεί την loadPageData για να φορτώσει την πρώτη σελίδα των στοιχείων
  });

  // Αρχική κλήση για τη φόρτωση των συμβάσεων
  loadSymbaseis();
  
  // Ενημέρωση και φόρτωση του pagination και του πίνακα
  async function loadPageData(page) {
    const selectedSymbash = document.getElementById("symbash").value;
    const selectedKathgoria = document.getElementById("kathgoria_symbashs").value;
    const selectedEidikothta = document.getElementById("eidikothta_symbashs").value;
    
    try {
      const response = await fetch(`/api/symbaseis/stoixeiaSymbaseon/${selectedSymbash}${selectedKathgoria}${selectedEidikothta}?page=${page}`);
      const responseData = await response.json();
      console.log(responseData);
      updateTable(responseData.stoixeia);
      updatePagination(page, responseData.pages);
    } catch (error) {
      console.error('Error loading page data:', error);
    }
  }

  function updateTable(data) {
    const myTableBody = document.querySelector("#myTable tbody");
    myTableBody.innerHTML = '';

    data.forEach(item => {
      const row = `<tr data-id="${item._id}">
        <td>${item.kodikos}</td>
        <td>${item.perigrafh}</td>
      </tr>`;
      myTableBody.innerHTML += row;
    });
  }

  function updatePagination(current, pages) {
    const paginationContainer = document.getElementById('paginationContainer');
    paginationContainer.innerHTML = '';

    if (current > 1) {
      paginationContainer.innerHTML += `<li class="page-item"><a class="page-link pagination-link" href="#" data-page="1" aria-label="First"><i class="bi bi-chevron-bar-left"></i></a></li>`;
      paginationContainer.innerHTML += `<li class="page-item"><a class="page-link pagination-link" href="#" data-page="${current - 1}" aria-label="Previous"><i class="bi bi-chevron-left"></i></a></li>`;
    }

    paginationContainer.innerHTML += `<li class="page-item active"><a class="page-link" href="#">${current}</a></li>`;

    let upTo = Math.min(current + 2, pages);
    for (let i = current + 1; i <= upTo; i++) {
      paginationContainer.innerHTML += `<li class="page-item"><a class="page-link pagination-link" href="#" data-page="${i}">${i}</a></li>`;
    }
    if (upTo < pages) {
      paginationContainer.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      paginationContainer.innerHTML += `<li class="page-item"><a class="page-link pagination-link" href="#" data-page="${pages}">${pages}</a></li>`;
    }

    if (current < pages) {
      paginationContainer.innerHTML += `<li class="page-item"><a class="page-link pagination-link" href="#" data-page="${current + 1}" aria-label="Next"><i class="bi bi-chevron-right"></i></a></li>`;
      paginationContainer.innerHTML += `<li class="page-item"><a class="page-link pagination-link" href="#" data-page="${pages}" aria-label="Last"><i class="bi bi-chevron-bar-right"></i></a></li>`;
    }

    addPaginationEventListeners(); // Προσθήκη event listeners στα links
  }

  function addPaginationEventListeners() {
    document.querySelectorAll('.pagination-link').forEach(link => {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        const page = parseInt(this.getAttribute('data-page'));
        loadPageData(page);
      });
    });
  }

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
});
