document.addEventListener("DOMContentLoaded", function () {
  let currentSelectedId = null; // Κρατά το ID της επιλεγμένης γραμμής

  document.querySelector(".card-body.p-0.overflow-auto.flex-grow-1").addEventListener("click", function (event) {
    if (!event.target.closest(".collapse")) return;

    let targetRow = event.target.closest("tr[data-id]");
    if (!targetRow) return;

    if (targetRow.closest(".collapse.show")) {
    const isSelected = targetRow.classList.contains("selected-row");
    document.querySelectorAll(".collapse.show .selected-row").forEach(row => row.classList.remove("selected-row"));

    if (!isSelected) {
      targetRow.classList.add("selected-row");
      currentSelectedId = targetRow.dataset.id;
      document.getElementById("add-btn").href = `/companies/antistoixiseis/addFromNested/${currentSelectedId}`;
      document.getElementById("edit-btn").href = `/companies/antistoixiseis/edit/${currentSelectedId}`;
    } else {
      currentSelectedId = null;
      document.getElementById("add-btn").href = "#";
      document.getElementById("edit-btn").href = "#";
      document.getElementById("delete-btn").href = "#";
    }
  }
});

  document.getElementById("delete-btn").addEventListener("click", async function (event) {
    event.preventDefault();
    if (!currentSelectedId) {
      return;
    }
    console.log(currentSelectedId);
    const deleteUrl = `/companies/antistoixiseis/deleteFromNested/${currentSelectedId}`;

    const result = await Swal.fire({
      title: "Είστε σίγουρος/η;",
      text: "ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια!",
      icon: "error",
      showCancelButton: true,
      focusConfirm: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#3332049a",
      confirmButtonText: "Διαγραφή",
      cancelButtonText: "Ακύρωση",
      customClass: {
        confirmButton:
          "class-error custom-confirm-button custom-swal-button",
        cancelButton: "custom-cancel-button custom-swal-button",
      },
      didOpen: () => {
        // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
        Swal.getCancelButton().focus();
      },
});

    if (result.isConfirmed) {
      try {
        const response = await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();
        Swal.fire({
          icon: "success",
          title: "Επιτυχής Διαγραφή της Αντιστοίχισης Κ.Π.Κ",
          timer: 3000,
          confirmButtonText: "Κλείσιμο",
          customClass: {
            confirmButton:
              "class-success custom-confirm-button custom-swal-button",
          },
          willClose: () => {
            window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
          },
        });
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Σφάλμα κατά τη Διαγραφή των Αντιστοιχίσεων Κ.Π.Κ.",
          text: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
          timer: 4000,
          confirmButtonText: "Κλείσιμο",
          customClass: {
            confirmButton:
              "class-normal custom-confirm-button custom-swal-button",
          },
          willClose: () => {
            window.location.href = "/companies/antistoixiseis"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
          },
        });
      }
    }
  });
});
