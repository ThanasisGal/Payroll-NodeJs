// let selectedRowId = null;

// document.addEventListener("DOMContentLoaded", function () {
//   var rows = document.querySelectorAll("#myTable tbody tr");
//   rows.forEach(function (row) {
//     row.addEventListener("click", function () {
//       if (this.classList.contains("selected-row")) {
//         this.classList.remove("selected-row");
//         selectedRowId = null;

//         document.getElementById("select-btn").href = "#";
//         document.getElementById("edit-btn").href = "#";
//         document.getElementById("delete-btn").href = "#";
//       } else {
//         rows.forEach(function (r) {
//           r.classList.remove("selected-row");
//         });

//         this.classList.add("selected-row");
//         selectedRowId = row.getAttribute("data-id");

//         if (selectedRowId) {
//           document.getElementById("select-btn").href =
//             "/companies/genikastoixeia/select/" + selectedRowId;
//           document.getElementById("edit-btn").href =
//             "/companies/genikastoixeia/edit/" + selectedRowId;
//           document
//             .getElementById("delete-btn")
//             .addEventListener("click", async function (event) {
//               // event.preventDefault(); // Αποτρέπει την προεπιλεγμένη συμπεριφορά του συνδέσμου

//               // Ορίζει το URL για διαγραφή
//               let deleteUrl = "/companies/genikastoixeia/delete/" + selectedRowId;

//               const result = await Swal.fire({
//                 title: "Είστε σίγουρος / η;",
//                 text: `ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια! Με την διαγραφή της εταιρείας θα διαγραφούν (απ΄ όλα τα αρχεία) οι εγγραφές, που αφορούν την συγκεκριμένη εταιρεία.`,
//                 icon: "error",
//                 showCancelButton: true,
//                 focusConfirm: true,
//                 confirmButtonColor: "#3085d6",
//                 cancelButtonColor: "#3332049a",
//                 confirmButtonText: "Διαγραφή",
//                 cancelButtonText: "Ακύρωση",
//                 customClass: {
//                   confirmButton:
//                     "class-error custom-confirm-button custom-swal-button",
//                   cancelButton: "custom-cancel-button custom-swal-button",
//                 },
//                 didOpen: () => {
//                   // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
//                   Swal.getCancelButton().focus();
//                 },
//               });

//               if (result.isConfirmed) {
//                 try {
//                   const response = await fetch(deleteUrl, {
//                     method: "DELETE",
//                     headers: {
//                       "Content-Type": "application/json",
//                     },
//                   });

//                   if (!response.ok) {
//                     throw new Error("Network response was not ok");
//                   }

//                   const data = await response.json();
//                   Swal.fire({
//                     icon: "success",
//                     title: "Επιτυχής Διαγραφή της Εταιρείας",
//                     timer: 3000,
//                     confirmButtonText: "Κλείσιμο",
//                     customClass: {
//                       confirmButton:
//                         "class-success custom-confirm-button custom-swal-button",
//                     },
//                     willClose: () => {
//                       window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
//                     },
//                   });
//                 } catch (error) {
//                   Swal.fire({
//                     icon: "success",
//                     title: "Σφάλμα κατά τη Διαγραφή της Εταιρείας",
//                     text: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
//                     timer: 3000,
//                     confirmButtonText: "Κλείσιμο",
//                     customClass: {
//                       confirmButton:
//                         "class-normal custom-confirm-button custom-swal-button",
//                     },
//                     willClose: () => {
//                       window.location.href = "/companies/genikastoixeia"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
//                     },
//                   });
//                 }
//               }
//             });
//         }
//       }
//     });
//   });
// });
