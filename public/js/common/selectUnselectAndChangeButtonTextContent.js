    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("select-all").addEventListener("click", function () {
            var selectBox = document.getElementById("selectedUsers");
            var isAllSelected = true;

            // Έλεγχος αν όλες οι επιλογές είναι ήδη επιλεγμένες
            for (var i = 0; i < selectBox.options.length; i++) {
                if (!selectBox.options[i].selected) {
                    isAllSelected = false;
                    break;
                }
            }

            // Επιλογή ή αποεπιλογή όλων των επιλογών
            for (var i = 0; i < selectBox.options.length; i++) {
                selectBox.options[i].selected = !isAllSelected;
            }
            
            // Αλλαγή της επιγραφής και του εικονιδίου του κουμπιού
            if (isAllSelected) {
                this.innerHTML = '<i class="bi bi-check2-all"></i> Επιλογή Όλων';
            } else {
                this.innerHTML = '<i class="bi bi-eraser"></i> Αποεπιλογή Όλων';
            }
        });
    });