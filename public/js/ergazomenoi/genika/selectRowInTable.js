// let selectedRowId = null;
// let selectedRowKod = null;

// document.addEventListener("DOMContentLoaded", function () {
//   var rows = document.querySelectorAll("#myTable tbody tr");
//   rows.forEach(function (row) {
//     row.addEventListener("click", function () {
//       if (this.classList.contains("selected-row")) {
//         this.classList.remove("selected-row");
//         selectedRowId = null;
//         selectedRowKod = null;

//         document.getElementById("edit-btn").href = "#";
//         document.getElementById("delete-btn").href = "#";
//       } else {
//         rows.forEach(function (r) {
//           r.classList.remove("selected-row");
//         });

//         this.classList.add("selected-row");
//         selectedRowId = row.getAttribute("data-id");
//         selectedRowKod = row.getAttribute("data-kod");

//         if (selectedRowId) {
//           document.getElementById("edit-btn").href = "/ergazomenoi/ergazomenoi/edit/" + selectedRowId;
//           document.getElementById("delete-btn").addEventListener("click", async function (event) {
//             // event.preventDefault(); // Αποτρέπει την προεπιλεγμένη συμπεριφορά του συνδέσμου

//             // Ορίζει το URL για διαγραφή
//             var deleteUrl = "/ergazomenoi/ergazomenoi/delete/" + selectedRowId;

//             const result = await Swal.fire({
//               title: "Είστε σίγουρος / η;",
//               text: `ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια! Με την διαγραφή του εργαζόμενου θα διαγραφούν (απ΄ ΌΛΑ τα αρχεία) οι εγγραφές, που αφορούν τον συγκεκριμένο εργαζόμενο.`,
//               icon: "error",
//               showCancelButton: true,
//               focusConfirm: true,
//               confirmButtonColor: "#3085d6",
//               cancelButtonColor: "#3332049a",
//               confirmButtonText: "Διαγραφή",
//               cancelButtonText: "Ακύρωση",
//               customClass: {
//                 confirmButton: "class-error custom-confirm-button custom-swal-button",
//                 cancelButton: "custom-cancel-button custom-swal-button",
//                 title: 'custom-title',
//               },
//               didOpen: () => {
//                 // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
//                 Swal.getCancelButton().focus();
//               },
//             });

//             if (result.isConfirmed) {
//               try {
//                 const response = await fetch(deleteUrl, {
//                   method: "DELETE",
//                   headers: {
//                     "Content-Type": "application/json",
//                   },
//                 });

//                 if (!response.ok) {
//                   throw new Error("Network response was not ok");
//                 }

//                 const data = await response.json();
//                 Swal.fire({
//                   icon: "success",
//                   title: "Επιτυχής Διαγραφή του Εργαζόμενου",
//                   timer: 3000,
//                   confirmButtonText: "Κλείσιμο",
//                   customClass: {
//                     confirmButton:
//                       "class-success custom-confirm-button custom-swal-button",
//                       title: 'custom-title',
//                   },
//                   willClose: () => {
//                     window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
//                   },
//                 });
//               } catch (error) {
//                 Swal.fire({
//                   icon: "success",
//                   title: "Σφάλμα κατά τη Διαγραφή του Εργαζόμενου",
//                   text: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
//                   timer: 3000,
//                   confirmButtonText: "Κλείσιμο",
//                   customClass: {
//                     confirmButton:
//                       "class-normal custom-confirm-button custom-swal-button",
//                       title: 'custom-title',
//                   },
//                   willClose: () => {
//                     window.location.href = "/ergazomenoi/ergazomenoi"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
//                   },
//                 });
//               }
//             }
//           });
//         }
//       }
//     });
//   });
// });

// Επιλεγμένη γραμμή (id από data-id)
let selectedRowId = null;
let selectedRowKod = null;

document.addEventListener("DOMContentLoaded", function () {
    const rows      = document.querySelectorAll("#myTable tbody tr");
    const btnEdit   = document.getElementById("edit-btn");
    const btnDelete = document.getElementById("delete-btn");

    // Βάσεις URLs
    const baseEdit   = "/ergazomenoi/ergazomenoi/edit";
    const baseDelete = "/ergazomenoi/ergazomenoi/delete"; 

    // Αν λείπει data-allowed θεωρούμε επιτρεπτό
    const isAllowed = (el) =>
        !el || el.dataset.allowed === undefined || el.dataset.allowed === "1";

    // Ενημέρωση hrefs με βάση την επιλογή & δικαιώματα
    const updateButtons = () => {
        if (btnEdit) {
            btnEdit.href =
                selectedRowId && isAllowed(btnEdit) ? `${baseEdit}/${selectedRowId}` : "#";
        }
        if (btnDelete) {
            btnDelete.href =
                selectedRowId && isAllowed(btnDelete) ? `${baseDelete}/${selectedRowId}` : "#";
        }
    };

    const bindGuardedNav = (btn, basePath) => {
        if (!btn) return;
            btn.addEventListener("click", async (e) => {
            if (!isAllowed(btn)) return;

            if (!selectedRowId) {
                e.preventDefault();
                e.stopPropagation();
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    title: "Καμία επιλογή",
                    html: `Παρακαλώ επιλέξτε πρώτα μία τράπεζα από τον πίνακα.`,
                    icon: "info",
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    backdrop: false,
                    allowOutsideClick: false,
                    customClass: {
                        title: "custom-title",
                        popup: "custom-swal-popup",
                        confirmButton: "class-info custom-confirm-button custom-swal-button",
                    },
                });
                return;
            }

            if (basePath) {
                e.preventDefault();
                location.href = `${basePath}/${selectedRowId}`;
            }
        });
    };
 
    // Επιλογή/αποεπιλογή γραμμών (μία ενεργή)
    rows.forEach((row) => {
        row.addEventListener("click", function () {
            const wasSelected = this.classList.contains("selected-row");
            rows.forEach((r) => r.classList.remove("selected-row"));
            if (wasSelected) {
                selectedRowId = null;
                selectedRowKod = null;
            } else {
                this.classList.add("selected-row");
                selectedRowId = this.getAttribute("data-id") || null;
                selectedRowKod = row.getAttribute("data-kod") || null;
            }
            updateButtons();
        });
    });

    // Ένας και μόνο handler για DELETE (CSP/CSRF-safe)
    if (btnDelete) {
        btnDelete.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!isAllowed(btnDelete)) return;

            if (!selectedRowId) {
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    title: "Καμία επιλογή",
                    html: `Παρακαλώ επιλέξτε πρώτα μία τράπεζα από τον πίνακα.`,
                    icon: "info",
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    backdrop: false,
                    allowOutsideClick: false,
                    customClass: {
                        title: "custom-title",
                        popup: "custom-swal-popup",
                        confirmButton: "class-info custom-confirm-button custom-swal-button",
                    }
                });
                return;
            }

            const result = await Swal.fire({
                backdrop: false,            // overlay
                allowOutsideClick: false,
                title: "Είστε σίγουρος/η;",
                html: `ΠΡΟΣΟΧΗ!<br>Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια.`,
                icon: "warning",
                showConfirmButton: true,
                showCancelButton: true,
                focusCancel: true,
                confirmButtonText: "Διαγραφή",
                cancelButtonText: "Ακύρωση",
                customClass: {
                title: "custom-title",
                popup: "custom-swal-popup",
                confirmButton: "class-warning custom-confirm-button custom-swal-button",
                cancelButton: "custom-cancel-button custom-swal-button",
                },
                didOpen: () => Swal.getCancelButton()?.focus(),
            });
            if (!result.isConfirmed) return;

            // URL από το href (έχει ήδη .../${selectedRowId})
            const url  = btnDelete.href;
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";

            try {
                const resp = await fetch(url, {
                    method: "DELETE",
                    headers: {
                        "CSRF-Token": csrf,                 // ✅ για csurf
                        "Content-Type": "application/json"
                    },
                    credentials: "include",                 // ✅ στείλε session cookies
                });

                // auto-follow redirect
                if (resp.redirected && resp.url) {
                    await Swal.fire({
                        backdrop: false,            // overlay
                        allowOutsideClick: false,
                        title: "Επιτυχής διαγραφή",
                        icon: "success",
                        timer: 1200,
                        showConfirmButton: false,
                        customClass: {
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        }
                    });
                    location.href = resp.url;
                    return;
                }

                // version 3xx χωρίς auto-follow
                if (resp.status >= 300 && resp.status < 400) {
                const loc = resp.headers.get("Location") || resp.headers.get("location");
                if (loc) {
                    await Swal.fire({
                        backdrop: false,            // overlay
                        allowOutsideClick: false,
                        title: "Επιτυχής διαγραφή",
                        timer: 1200,
                        icon: "success",
                        showConfirmButton: false,
                        customClass: {
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        }
                    });
                    location.href = loc.startsWith("http") ? loc : new URL(loc, location.origin).toString();
                    return;
                }
                    throw new Error(`Redirect ${resp.status} χωρίς Location header`);
                }

                // CSRF/Forbidden
                if (resp.status === 403) {
                    const t = await resp.text().catch(() => "");
                    throw new Error("CSRF/Forbidden (403). " + t.slice(0, 120));
                }

                // 204 No Content
                if (resp.status === 204) {
                    await Swal.fire({
                        backdrop: false,            // overlay
                        allowOutsideClick: false,
                        title: "Επιτυχής διαγραφή",
                        timer: 1200,
                        icon: "success",
                        showConfirmButton: false,
                        customClass: {
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        }
                    });

                    location.href = "/ergazomenoi/ergazomenoi";
                    return;
                }

                // JSON απάντηση
                const ct = resp.headers.get("content-type") || "";
                if (ct.includes("application/json")) {
                    const data = await resp.json();
                    if (!resp.ok || data?.success === false) {
                        throw new Error(`HTTP ${resp.status} / success=${data?.success}`);
                    }
                    await Swal.fire({
                        backdrop: false,            // overlay
                        allowOutsideClick: false,
                        title: "Επιτυχής διαγραφή",
                        timer: 1200,
                        icon: "success",
                        showConfirmButton: false,
                        customClass: {
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        }
                    });
                    location.href = data.redirectUrl || "/ergazomenoi/ergazomenoi";
                    return;
                }

                // Άλλος content-type αλλά OK (π.χ. HTML)
                if (resp.ok) {
                    await Swal.fire({
                        backdrop: false,            // overlay
                        allowOutsideClick: false,
                        title: "Επιτυχής διαγραφή",
                        timer: 1200,
                        icon: "success",
                        showConfirmButton: false,
                        customClass: {
                            title: "custom-title",
                            popup: "custom-swal-popup",
                        }
                    });
                    location.href = "/ergazomenoi/ergazomenoi";
                    return;
                }

                throw new Error(`HTTP error ${resp.status}`);

            } catch (error) {
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "error",
                    title: "Σφάλμα κατά τη διαγραφή",
                    html: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>«Επικοινωνία»</strong>.<br><small>${String(error?.message || error)}</small>`,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        title: "custom-title",
                        popup: "custom-swal-popup",
                        confirmButton: "class-normal custom-confirm-button custom-swal-button",
                    },
                    willClose: () => {
                      window.location.href = "/ergazomenoi/ergazomenoi"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    },
                });
            }
        });
    }

    bindGuardedNav(btnEdit,   baseEdit);

    updateButtons();
});
