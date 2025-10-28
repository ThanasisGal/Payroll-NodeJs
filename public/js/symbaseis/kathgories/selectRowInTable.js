// public/js/symbaseis/kathgories/selectRowInTable.js
let selectedRowId = null;

document.addEventListener("DOMContentLoaded", function () {
    // const tableBody  = document.querySelector("#myTable tbody");
    const table = document.getElementById("kathgories") || document.getElementById("myTable");
    const tableBody = table?.tBodies?.[0];
    if (!tableBody) return; // δεν υπάρχει πίνακας

    const addBtn     = document.getElementById("add-btn");
    const editBtn    = document.getElementById("edit-btn");
    const deleteBtn  = document.getElementById("delete-btn");
    const symHidden  = document.getElementById("symbash_stathera"); 

    const csrf = () =>
        document.querySelector('meta[name="csrf-token"]')?.content || "";

    // ---------------- Helpers ----------------
    function showNoRowSelection() {
        return Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            title: "Καμία επιλογή γραμμής",
            html: `Παρακαλώ επιλέξτε πρώτα μία κατηγορία σύμβασης από τον πίνακα.`,
            icon: "info",
            showConfirmButton: true,
            confirmButtonText: "Κλείσιμο",
            customClass: {
                title: "custom-title",
                popup: "custom-swal-popup",
                confirmButton: "class-info custom-confirm-button custom-swal-button",
            },
        });
    }

    function showNoContract() {
        return Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            title: "Δεν έχει επιλεγεί σύμβαση",
            html: `Παρακαλώ επιλέξτε μία σύμβαση.`,
            icon: "info",
            showConfirmButton: true,
            confirmButtonText: "Κλείσιμο",
            customClass: {
                title: "custom-title",
                popup: "custom-swal-popup",
                confirmButton: "class-info custom-confirm-button custom-swal-button",
            },
        });
    }

    // Πάρε την τρέχουσα επιλεγμένη σύμβαση από το hidden
    const getSelectedContract = () => (symHidden?.value || "").trim();

    // ---------------- Hrefs για κουμπιά ----------------
    function updateEditHref() {
        if (!editBtn) return;
        editBtn.href = selectedRowId
        ? "/symbaseis/kathgories/edit/" + encodeURIComponent(selectedRowId)
        : "#";
    }

    function updateAddHref() {
        if (!addBtn) return;
        const kodikosSymbashs = getSelectedContract();
        addBtn.href = kodikosSymbashs
        ? "/symbaseis/kathgories/add/" + encodeURIComponent(kodikosSymbashs)
        : "#";
    }

    function updateActionHrefs() {
        updateEditHref();
        updateAddHref();
    }

    function clearSelection() {
        selectedRowId = null;
        if (tableBody) {
            tableBody
                .querySelectorAll("tr.selected-row")
                .forEach((tr) => tr.classList.remove("selected-row"));
        }
        updateActionHrefs();
    }

    // ---------------- Επιλογή γραμμής πίνακα ----------------
    if (tableBody) {
        tableBody.addEventListener("click", function (event) {
            const targetRow = event.target.closest("tr");
            if (!targetRow || targetRow.parentNode !== tableBody) return;

            const rowId = targetRow.getAttribute("data-id");
            if (!rowId) return; // αγνόησε γραμμές μηνυμάτων/φόρτωσης

            if (targetRow.classList.contains("selected-row")) {
                targetRow.classList.remove("selected-row");
                selectedRowId = null;
            } else {
                tableBody
                .querySelectorAll("tr")
                .forEach((tr) => tr.classList.remove("selected-row"));
                targetRow.classList.add("selected-row");
                selectedRowId = rowId;
            }
            updateActionHrefs();
        });
    }

    // ---------------- Σύνδεση με το select της σύμβασης ----------------
    const contractSelect = document.querySelector('#symbash');

    // Όταν αλλάζει το select, ενημέρωσε το hidden και το href του Add
    if (contractSelect && symHidden) {
        const syncHiddenAndHref = () => {
            symHidden.value = (contractSelect.value || "").trim();
            updateAddHref();
        };
        contractSelect.addEventListener("change", syncHiddenAndHref);
        contractSelect.addEventListener("input", syncHiddenAndHref);
    }

    // Fallback: όποιο change/input συμβεί στη σελίδα, ξαναϋπολόγισε το href του Add
    document.addEventListener("change", updateAddHref, true);
    document.addEventListener("input", updateAddHref, true);

    // ---------------- Συμπεριφορά κουμπιών ----------------
    // Edit: απαιτεί επιλεγμένη ΓΡΑΜΜΗ
    if (editBtn) {
        editBtn.addEventListener("click", function (e) {
            if (selectedRowId) return; // άσε το default navigation
            e.preventDefault();
            e.stopPropagation();
            showNoRowSelection();
        });
    }

    // Add: απαιτεί επιλεγμένη ΣΥΜΒΑΣΗ (ΔΕΝ απαιτεί γραμμή)
    if (addBtn) {
        addBtn.addEventListener("click", function (e) {
            const id = getSelectedContract();
            if (!id) {
                e.preventDefault();
                e.stopPropagation();
                return showNoContract();
            }

            // Αν είναι <button>, κάνε χειροκίνητη πλοήγηση.
            if (addBtn.tagName.toLowerCase() !== "a") {
                e.preventDefault();
                window.location.href =
                "/symbaseis/kathgories/add/" + encodeURIComponent(id);
            } else {
                // Αν είναι <a>
                addBtn.href =
                "/symbaseis/kathgories/add/" + encodeURIComponent(id);
            }
        });
    }

    // Delete: παραμένει με selectedRowId
    if (deleteBtn) {
        deleteBtn.addEventListener("click", async function (event) {
        event.preventDefault();

        if (!selectedRowId) {
            await showNoRowSelection();
            return;
        }

        const deleteUrl =
            "/symbaseis/kathgories/delete/" + encodeURIComponent(selectedRowId);

        const result = await Swal.fire({
            backdrop: false,
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
            confirmButton:
                "class-warning custom-confirm-button custom-swal-button",
            cancelButton: "custom-cancel-button custom-swal-button",
            },
            didOpen: () => Swal.getCancelButton()?.focus(),
        });
        if (!result.isConfirmed) return;

        try {
            const response = await fetch(deleteUrl, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-Token": csrf(),
            },
            credentials: "same-origin",
            });

            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();

            // Παρουσίαση αποτελεσμάτων
            if (Array.isArray(data.results) && data.results.length > 0) {
                const esc = (s) =>
                    String(s).replace(/[&<>\"']/g, (c) =>
                    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
                    );
                const rows = data.results
                    .map(
                        (r) => `
                        <tr>
                        <td class="ta-l">${esc(r.modelNameInGreek)}</td>
                        <td>Εγγραφές: ${Number(r.deletedCount) || 0}</td>
                        <td class="ta-r"><i class="bi bi-check cgreen"></i></td>
                        </tr>`
                    )
                    .join("");
                const tableHtml = `<table>${rows}</table>`;

                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: "Επιτυχής Διαγραφή της Κατηγορίας Σύμβασης",
                    html: tableHtml,
                    icon: "success",
                    showConfirmButton: true,
                    showCancelButton: false,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                    title: "custom-title",
                    popup: "custom-swal-popup",
                    confirmButton:
                        "class-success custom-confirm-button custom-swal-button",
                    },
                });
            } else {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: "Επιτυχής Διαγραφή της Κατηγορίας Σύμβασης",
                    html: `Δεν υπήρχαν εγγραφές προς διαγραφή στα <br>υπόλοιπα συσχετιζόμενα αρχεία`,
                    icon: "info",
                    showConfirmButton: true,
                    showCancelButton: false,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                    title: "custom-title",
                    popup: "custom-swal-popup",
                    confirmButton:
                        "class-info custom-confirm-button custom-swal-button",
                    },
                });
            }

            // Redirect αν δίνεται, αλλιώς αφαίρεση γραμμής
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                const selected = tableBody?.querySelector("tr.selected-row");
                if (selected) selected.remove();
                clearSelection();
            }
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Σφάλμα κατά τη Διαγραφή της Κατηγορίας Σύμβασης",
                text: error.toString(),
                confirmButtonText: "Κλείσιμο",
                customClass: {
                    confirmButton:
                    "class-error custom-confirm-button custom-swal-button",
                },
            });
        }
        });
    }

    // ---------------- Αρχικοποίηση ----------------
    updateActionHrefs(); // ενημέρωσε hrefs στην εκκίνηση
});
