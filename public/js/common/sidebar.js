document.querySelectorAll('#nav-tree > li > a').forEach(menu => {
  menu.addEventListener('click', function(event) {
    const submenu = this.nextElementSibling;
    const chevron = this.querySelector('.chevron-icon');

    // Αν υπάρχει υπομενού, κάνουμε toggle την εμφάνιση και περιστροφή του chevron
    if (submenu && submenu.classList.contains('submenu')) {
      event.preventDefault(); // Αποτροπή προεπιλεγμένης συμπεριφοράς για τα μενού
      submenu.classList.toggle('active');
      chevron.classList.toggle('rotate-chevron'); // Περιστροφή του εικονιδίου
    }
  });
});

// Για τα nested submenus
document.querySelectorAll('#nav-tree li ul li > a').forEach(menu => {
  menu.addEventListener('click', function(event) {
    const submenu = this.nextElementSibling;
    const chevron = this.querySelector('.chevron-icon');

    // Αν υπάρχει υπομενού, κάνουμε toggle την εμφάνιση και περιστροφή του chevron
    if (submenu && submenu.classList.contains('submenu')) {
      event.preventDefault();
      submenu.classList.toggle('active');
      chevron.classList.toggle('rotate-chevron');
    }
  });
});

// document.addEventListener("DOMContentLoaded", function () {
//   // Επιλέγουμε όλα τα στοιχεία <a> με την κλάση 'menu-item' ή 'submenu-item'
//   var menuItems = document.querySelectorAll("#nav-tree a");

//   // Ορίζουμε την επιθυμητή σταθερή απόσταση
//   var baseHeight = 35; // Υποθέτουμε ότι μια γραμμή κειμένου έχει ύψος περίπου 30-35px
//   var minSpacing = 5;  // Ελάχιστη απόσταση σε pixels
//   var maxSpacing = 5;  // Μέγιστη απόσταση σε pixels

//   // Λειτουργία για υπολογισμό των αποστάσεων
//   function calculateSpacing() {
//     var screenWidth = window.innerWidth;  // Παίρνουμε το πλάτος της οθόνης

//     menuItems.forEach(function (item) {
//       // Παίρνουμε το πραγματικό ύψος του στοιχείου <a> (μόνο για ορατά στοιχεία)
//       if (item.offsetParent !== null) {
//         var height = item.offsetHeight;
//         var lineHeight = parseFloat(window.getComputedStyle(item).lineHeight); // Παίρνουμε το ύψος μιας γραμμής κειμένου

//         // Αν το lineHeight δεν είναι αριθμός (π.χ., "normal"), θέτουμε μια προεπιλογή
//         if (isNaN(lineHeight)) {
//           lineHeight = baseHeight;
//         }

//         // Υπολογίζουμε πόσες γραμμές έχει πραγματικά το κείμενο
//         var lines = Math.ceil(height / lineHeight);

//         // Έλεγχος αν το στοιχείο έχει την κλάση "ajustedGap"
//         var hasAdjustedGap = item.classList.contains("ajustedGap");

//         if (lines > 1 && hasAdjustedGap) {
//           // Περισσότερες από μία γραμμές και έχει την κλάση ajustedGap
//           var additionalSpacing = Math.min((lines - 1) * minSpacing, maxSpacing);

//           // Αν το πλάτος της οθόνης είναι μικρότερο από 1670px
//           if (screenWidth < 1670) {
//             item.style.marginBottom = additionalSpacing + "px"; // Προσθέτουμε 10
//           } else {
//             item.style.marginBottom = additionalSpacing - 15 + "px"; // Αφαιρούμε 10
//           }
//         } else {
//           // Αν δεν αναδιπλώνεται ή δεν έχει την κλάση ajustedGap
//           item.style.marginBottom = minSpacing - 15 + "px"; // Ελάχιστη απόσταση - 15px
//         }
//       }
//     });
//   }



document.addEventListener("DOMContentLoaded", function () {
  // Επιλέγουμε όλα τα στοιχεία <a> με την κλάση 'menu-item' ή 'submenu-item'
  var menuItems = document.querySelectorAll("#nav-tree a");

  // Ορίζουμε την επιθυμητή σταθερή απόσταση
  var baseHeight = 35; // Υποθέτουμε ότι μια γραμμή κειμένου έχει ύψος περίπου 30-35px
  var minSpacing = 5;  // Ελάχιστη απόσταση σε pixels
  var maxSpacing = 5;  // Μέγιστη απόσταση σε pixels

  // Λειτουργία για υπολογισμό των αποστάσεων και αναδίπλωσης κειμένου
  function calculateSpacing() {
    var screenWidth = window.innerWidth;  // Παίρνουμε το πλάτος της οθόνης

    menuItems.forEach(function (item) {
      // Παίρνουμε το πραγματικό ύψος του στοιχείου <a> (μόνο για ορατά στοιχεία)
      if (item.offsetParent !== null) {
        var height = item.offsetHeight;
        // var lineHeight = height - 18;
        var lineHeight = parseFloat(window.getComputedStyle(item).lineHeight); // Παίρνουμε το ύψος μιας γραμμής κειμένου

        // Αν το lineHeight δεν είναι αριθμός (π.χ., "normal"), θέτουμε μια προεπιλογή
        // if (isNaN(lineHeight)) {
          lineHeight = baseHeight;
        // }

        // Υπολογίζουμε πόσες γραμμές έχει πραγματικά το κείμενο
        var lines = Math.ceil(height / lineHeight);

        // Έλεγχος αν το στοιχείο έχει την κλάση "ajustedGap"
        var hasAdjustedGap = item.classList.contains("ajustedGap");

        if (lines > 1 && hasAdjustedGap) {
          // Περισσότερες από μία γραμμές και έχει την κλάση ajustedGap
          var additionalSpacing = Math.min((lines - 1) * minSpacing, maxSpacing);

          // Αν το πλάτος της οθόνης είναι μικρότερο από 1670px
          if (screenWidth < 1670) {
            item.style.marginBottom = additionalSpacing -30 + "px"; // Προσθέτουμε 10
          } else {
            item.style.marginBottom = additionalSpacing - 30 + "px"; // Αφαιρούμε 10
          }
        } else {
          // Αν δεν αναδιπλώνεται ή δεν έχει την κλάση ajustedGap
          item.style.marginBottom = -10 + "px"; // Ελάχιστη απόσταση - 15px
        }

        // ** Προσθήκη κώδικα για padding-bottom ανάλογα με το αν το κείμενο αναδιπλώνεται **
        const linkLineHeight = 35;
        // const linkLineHeight = parseInt(window.getComputedStyle(item).lineHeight);
        const linkLines = item.scrollHeight / linkLineHeight;

        if (linkLines > 1) {
          // Αν το κείμενο αναδιπλώνεται
          item.style.paddingBottom = '40px';
          item.setAttribute('data-multiline', 'true');
        } 
        // else {
          // Αν το κείμενο δεν αναδιπλώνεται
          // item.style.paddingBottom = '10px';
          // item.setAttribute('data-multiline', 'false');
        // }
      }
    });
  }
  // Υπολογισμός αποστάσεων όταν φορτώνει η σελίδα
  calculateSpacing();

  // Παρακολούθηση για το resize του παραθύρου (σε περίπτωση αλλαγής μεγέθους)
  window.addEventListener("resize", function () {
    calculateSpacing(); // Καλούμε ξανά την calculateSpacing όταν αλλάζει το μέγεθος της οθόνης
  });

  // Παρακολούθηση για click events στα menu και submenus
  menuItems.forEach(function (item) {
    item.addEventListener("click", function () {
      // Μικρή καθυστέρηση για να προλάβει το submenu να γίνει expanded/collapsed
      setTimeout(calculateSpacing, 300); // Καθυστέρηση 300ms για να ολοκληρωθεί το expand/collapse
    });
  });
});

