document.addEventListener('DOMContentLoaded', function() {
  // Προσθήκη event listeners στις κεφαλίδες των στηλών για την ταξινόμηση
  document.querySelectorAll('#myTableHeader th').forEach((th, index) => {
    th.addEventListener('click', function() {
      sortTable(index, this);
    });
  });

  // Η συνάρτηση για την ταξινόμηση του πίνακα
  function sortTable(column, thElement) {
    var table, rows, switching, i, x, y, shouldSwitch, dir = "asc", switchcount = 0;
    table = document.getElementById("myTable");
    switching = true; // Σημαία για έναρξη ταξινόμησης
    resetSortIcons(); // Επαναφορά εικονιδίων ταξινόμησης

    // Έλεγχος αν η στήλη είναι αριθμητική ή όχι
    var isNumericColumn = isNumeric(table.rows[0].cells[column].innerText || table.rows[0].cells[column].textContent);

    while (switching) {
      switching = false;
      rows = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr");

      for (i = 0; i < (rows.length - 1); i++) {
        shouldSwitch = false;
        x = rows[i].getElementsByTagName("TD")[column];
        y = rows[i + 1].getElementsByTagName("TD")[column];

        var xVal = isNumericColumn ? parseFloat(x.innerHTML) : x.innerHTML.toLowerCase();
        var yVal = isNumericColumn ? parseFloat(y.innerHTML) : y.innerHTML.toLowerCase();

        if (dir == "asc") {
          if (xVal > yVal) {
            shouldSwitch = true;
            break;
          }
        } else if (dir == "desc") {
          if (xVal < yVal) {
            shouldSwitch = true;
            break;
          }
        }
      }

      if (shouldSwitch) {
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        switchcount++;
      } else {
        if (switchcount == 0 && dir == "asc") {
          dir = "desc";
          switching = true;
        }
      }
    }

    // Ενημέρωση του εικονιδίου ταξινόμησης
    updateSortIcon(thElement, dir, isNumericColumn);
  }

  // Έλεγχος αν μια τιμή είναι αριθμητική
  function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  // Επαναφορά των εικονιδίων ταξινόμησης στην αρχική κατάσταση
  function resetSortIcons() {
    document.querySelectorAll("#myTableHeader th .sort-icon").forEach(icon => {
      icon.className = 'sort-icon bi';
    });
  }

  // Ενημέρωση της κλάσης του εικονιδίου με βάση την κατεύθυνσης

  function updateSortIcon(th, direction, isNumeric) {
    const icon = th.querySelector(".sort-icon");
    if (!icon) return;
    icon.className = 'sort-icon bi'; // Επαναφέρει τις αρχικές κλάσεις

    // Ενημερώνει την κλάση του εικονιδίου ανάλογα με την κατεύθυνση και τον τύπο της στήλης
    if (direction === 'asc') {
      icon.classList.add(isNumeric ? "bi-sort-numeric-down" : "bi-sort-alpha-down");
    } else {
      icon.classList.add(isNumeric ? "bi-sort-numeric-down-alt" : "bi-sort-alpha-down-alt");
    }
  }
});
