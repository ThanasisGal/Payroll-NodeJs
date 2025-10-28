// Επιλεγμένη γραμμή (id από data-id)
let selectedRowId = null;

document.addEventListener("DOMContentLoaded", function () {
    const rows      = document.querySelectorAll("#myTable tbody tr");
    const btnEdit   = document.getElementById("edit-btn");
    const btnDelete = document.getElementById("delete-btn");

    // Βάσεις URLs
    const baseEdit   = "/companies/trapezes/edit";
    const baseDelete = "/companies/trapezes/delete"; 

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
            } else {
                this.classList.add("selected-row");
                selectedRowId = this.getAttribute("data-id") || null;
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

                    location.href = "/companies/trapezes";
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
                    location.href = data.redirectUrl || "/companies/trapezes";
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
                    location.href = "/companies/trapezes";
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
                      window.location.href = "/companies/trapezes"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    },
                });
            }
        });
    }

    bindGuardedNav(btnEdit,   baseEdit);

    updateButtons();
});
