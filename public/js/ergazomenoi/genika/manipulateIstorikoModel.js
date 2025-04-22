document.addEventListener('DOMContentLoaded', function() {
  const table = document.getElementById('myTable');

  async function fetchData(url, method = 'GET', data = null) {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : null
    };
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
  }

  function formatDate(dateString) {
    if (!dateString) return ""; // Check if the dateString is null or empty
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ""; // Check if the date is invalid
    return date.toLocaleDateString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  async function loadTableData() {
    const data = await fetchData('/ergazomenoi/ergazomenoi/istoriko/' + document.getElementById("kodikosHidden").value);
    const tbody = table.getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; // Καθαρισμός προηγούμενων γραμμών
    data.forEach((item, index) => {
      const row = tbody.insertRow();

      const displayStyle = item.afora_proslhpsh ? 'inline' : 'none';

      row.innerHTML = `
        <td class="col-1">${index + 1}</td>
        <td class="col-1-5"><span style="display: ${displayStyle};">${formatDate(item.hmeromhnia_proslhpshs)}</span></td>
        <td class="col-1-5">${formatDate(item.hmeromhnia_allaghs_symbashs)}</td>
        <td class="col-1-5">${formatDate(item.hmeromhnia_lhxhs_symbashs)}</td>
        <td class="col-1-5">${formatDate(item.hmeromhnia_apoxorhshs)}</td>
        <td class="col-1-5">
          <div class="d-flex justify-content-center align-items-center">

            <button type="button" class="btn rounded-1 buttons-content d-flex justify-content-center align-items-center edit" data-bs-toggle="tooltip" title="Επεξεργασία εγγραφής" data-bs-placement="top">
              <i class="bi bi-pencil-square" style="font-size: 20px;"></i>
            </button>
  
            <button type="button" class="btn rounded-1 buttons-content d-flex justify-content-center align-items-center delete" data-bs-toggle="tooltip" title="Διαγραφή εγγραφής" data-bs-placement="top">
              <i class="bi bi-trash3" style="font-size: 20px;"></i>
            </button>

            <button type="button" class="btn rounded-1 buttons-content d-flex justify-content-center align-items-center cancel aorato" style="display:none;" data-bs-toggle="tooltip" title="Επαναφορά εγγραφής" data-bs-placement="top">
              <i class="bi bi-arrow-counterclockwise" style="font-size: 20px;"></i>
            </button>
          </div>
        </td>`;
      row.dataset.id = item._id; // Store the ID for update operations
      // Set original content for revert operation
      Array.from(row.cells).forEach(cell => {
        if (!cell.querySelector('button')) {
          cell.setAttribute('data-original-content', cell.textContent);
        }
      });
    });
  }

  table.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const row = btn.closest('tr');
    if (btn.classList.contains('edit')) {
      editRow(row);
    } else if (btn.classList.contains('delete')) {
      toggleDelete(row);
    } else if (btn.classList.contains('cancel')) {
      cancelEdit(row);
    }
  });

  function setVisibility(element, visible) {
    element.classList.remove(visible ? 'aorato' : 'orato');
    element.classList.add(visible ? 'orato' : 'aorato');
  }

  function toggleDelete(row) {
    var cells = row.querySelectorAll('td:not(:last-child)');
    const isMarked = row.classList.toggle('marked-delete');
    cells.forEach(cell => {
      cell.style.backgroundColor = isMarked ? 'red' : ''; 
      cell.style.color = isMarked ? 'white' : ''; 
    });

    setVisibility(row.querySelector('.edit'), !isMarked);
    setVisibility(row.querySelector('.delete'), !isMarked);
    setVisibility(row.querySelector('.cancel'), isMarked);
  }

  function editRow(row) {
    const cells = row.querySelectorAll('td:not(:last-child)');
    cells.forEach(cell => {
        cell.contentEditable = true;
        cell.style.backgroundColor = '#ffff99';
    });
    setVisibility(row.querySelector('.edit'), false);
    setVisibility(row.querySelector('.delete'), false);
    setVisibility(row.querySelector('.cancel'), true);
  }

  function cancelEdit(row) {
    const cells = row.querySelectorAll('td:not(:last-child)');

    let cell1TextContent = ''; // Αρχικοποιώ μεταβλητές για τα περιεχόμενα των κελιών
    let cell2TextContent = '';

    cells.forEach((cell, index) => {
      // Ελέγξτε αν το cellIndex είναι 1 ή 2 για να αποθηκεύσετε τα περιεχόμενα
      if (index === 1) {
          cell1TextContent = cell.textContent; // Αποθηκεύστε το περιεχόμενο του κελιού με index 1
      } else if (index === 2) {
          cell2TextContent = cell.textContent; // Αποθηκεύστε το περιεχόμενο του κελιού με index 2
      }

      cell.contentEditable = false;
      cell.style.backgroundColor = '';
      cell.textContent = cell.getAttribute('data-original-content');
      cell.style.color = '';

      // Εφαρμογή ελέγχου για το display
      if (index === 1) {
        // Αν τα περιεχόμενα των κελιών δεν είναι ίσα, κρύψτε οπτικά το κείμενο
        if (cell1TextContent !== cell2TextContent) {
            cell.style.visibility = 'hidden'; // Κάντε το κείμενο αόρατο χωρίς να το διαγράψετε
        } else {
            cell.style.visibility = 'visible'; // Εμφανίστε το κείμενο
        }
      }
    });
    setVisibility(row.querySelector('.edit'), true);
    setVisibility(row.querySelector('.delete'), true);
    setVisibility(row.querySelector('.cancel'), false);
    row.style.backgroundColor = '';
    row.classList.remove('marked-delete');
  }

  function formatToISO(dateStr) {
    if (!dateStr) return null; // Αν η τιμή είναι κενή, επιστρέφει null
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(`${year}-${month}-${day}T00:00:00.000+00:00`).toISOString();
    } else {
      return null; // Αν η τιμή δεν είναι έγκυρη ημερομηνία, επιστρέφει null
    }
  }

document.getElementById('updateBtn').addEventListener('click', async (event) => {
  event.preventDefault();  // Αποτροπή της default ενέργειας

  const updates = Array.from(table.querySelectorAll('tr')).map(row => {
    return {
      _id: row.dataset.id,
      deleted: row.classList.contains('marked-delete'),  // Έλεγχος αν η γραμμή είναι σημειωμένη προς διαγραφή
      data: {
        hmeromhnia_proslhpshs: formatToISO(row.cells[1].textContent),
        hmeromhnia_allaghs_symbashs: formatToISO(row.cells[2].textContent),
        hmeromhnia_lhxhs_symbashs: formatToISO(row.cells[3].textContent),
        hmeromhnia_apoxorhshs: formatToISO(row.cells[4].textContent)
      }
    };
  });

  // Κλήση του API για ενημέρωση και διαγραφή
  await fetchData('/ergazomenoi/ergazomenoi/istoriko/' + document.getElementById("kodikosHidden").value, 'POST', { updates });
  await loadTableData();  // Επαναφόρτωση των δεδομένων χωρίς reload της σελίδας
});

  document.getElementById('cancelBtn').addEventListener('click', function(event) {
    event.preventDefault();  // Αποτρέπει την προεπιλεγμένη συμπεριφορά (π.χ., ανανέωση σελίδας ή υποβολή φόρμας)
    loadTableData();         // Καλεί τη συνάρτηση για να φορτώσει εκ νέου τα δεδομένα από τον server χωρίς reload της σελίδας
  });

  loadTableData();
});
