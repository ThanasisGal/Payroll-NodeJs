document.addEventListener("DOMContentLoaded", () => {
    async function handleFormSubmit(event) {
        event.preventDefault();
        event.stopPropagation();

        const formData = {};
        const filePromises = [];
        const sections = document.querySelectorAll(".card-body");

        // --- Συλλογή από input/select/textarea (όπως είχες) ---
        sections.forEach((section) => {
            const inputs = section.querySelectorAll("input, select, textarea");
            inputs.forEach((input) => {
                if (input.tagName === "INPUT") {
                    if (input.type === "checkbox") {
                        formData[input.name] = input.checked;
                    } else if (input.type === "date" && input.value === "") {
                        formData[input.name] = null;
                    } else if (input.type === "file" && input.files.length > 0) {
                        filePromises.push(new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => { formData[input.name] = e.target.result; resolve(); };
                        reader.onerror = reject;
                        reader.readAsDataURL(input.files[0]);
                        }));
                    } else {
                        formData[input.name] = input.value;
                    }
                } else if (input.tagName === "TEXTAREA") {
                    formData[input.name] = input.value;
                } else if (input.tagName === "SELECT") {
                    if (input.multiple) {
                        const selected = Array.from(input.selectedOptions).map(o => o.value);
                        formData[input.name] = selected.length ? selected : [];
                    } else {
                        formData[input.name] = (input.selectedIndex === -1)
                        ? null
                        : input.options[input.selectedIndex].value;
                    }
                }
            });
        });

        try {
            // περιμένουμε τυχόν file reads
            await Promise.all(filePromises);

            // --- ΠΡΟΣΘΗΚΗ: διάβασμα από ΕΠΙΛΕΓΜΕΝΗ nested γραμμή ---
            const selectedNestedRows = document.querySelectorAll(".nested-table .selected-row");
            const mainRowId = window._openMainRowId ?? null;

            if (selectedNestedRows.length > 0) {
                const row = selectedNestedRows[0]; // αν έχεις μόνο μία επιλογή
                const nestedObj = { _id: row.dataset.id, mainRowId };

                row.querySelectorAll("[data-name]").forEach(cell => {
                    const key = cell.dataset.name; // π.χ. "kpk"
                    const val = (cell.dataset.value != null) ? cell.dataset.value : cell.textContent.trim();
                    nestedObj[key] = val;
                });

                formData.nestedSelection = nestedObj;

                // Συμβατότητα με υπάρχον validation: γέμισε top-level αν λείπουν
                const copyIfMissing = (k) => {
                    if (formData[k] == null || formData[k] === "") {
                        formData[k] = nestedObj[k] ?? null;
                    }
                };
                ["kpk","apo_typos_apodoxon","se_typos_apodoxon","kad","eidikothta","epa"].forEach(copyIfMissing);
            } else {
                // Καμία nested επιλογή
                formData.nestedSelection = null;
            }

            const antistoixishId = document.getElementById("antistoixishId").value;
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

            const response = await fetch(`/api/companies/antistoixiseis/update/${antistoixishId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken,          // ✅ για csurf
                },
                credentials: "include",             // ✅ στείλε session cookies
                // redirect: "follow",              // default (μην το αλλάζεις σε manual)
                body: JSON.stringify(formData),
            });

            // 1) αν ο browser ακολούθησε redirect
            if (response.redirected && response.url) {
                window.location.href = response.url;
                return;
            }

            // 2) αν είναι 3xx (σε ορισμένα περιβάλλοντα μπορεί να μείνει ως έχει)
            if (response.status >= 300 && response.status < 400) {
                const loc = response.headers.get("Location") || response.headers.get("location");
                if (loc) {
                    const abs = loc.startsWith("http") ? loc : new URL(loc, window.location.origin).toString();
                    window.location.href = abs;
                    return;
                }
                throw new Error(`Redirect ${response.status} χωρίς Location header`);
            }

            // 3) 403 από CSRF
            if (response.status === 403) {
                throw new Error("CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.");
            }

            // 4) 204 No Content → δικό μας redirect
            if (response.status === 204) {
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής ενημέρωση!",
                    timer: 1200,
                    showConfirmButton: false,
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => window.location.href = `/companies/antistoixiseis/edit/${antistoixishId}`);
                return;
            }

            // 5) JSON απάντηση
            const ct = response.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
                const data = await response.json();
                if (!response.ok || !data?.success) {
                    throw new Error(`HTTP ${response.status} / success=${data?.success}`);
                }
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής ενημέρωση!",
                    timer: 1200,
                    showConfirmButton: false,
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => window.location.href = data.redirectUrl || `/companies/antistoixiseis/edit/${antistoixishId}`);
                return;
            }

            // 6) Άλλος content-type αλλά ok
            if (response.ok) {
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής ενημέρωση!",
                    timer: 1200,
                    showConfirmButton: false,
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => window.location.href = `/companies/antistoixiseis/edit/${antistoixishId}`);
                return;
            }

            // 7) Σφάλμα HTTP
                throw new Error(`HTTP error ${response.status}`);

        } catch (err) {
            await Swal.fire({
                backdrop: false,            // overlay
                allowOutsideClick: false,
                icon: "error",
                title: "Αποτυχία αποθήκευσης",
                timer: 4000,
                text: String(err?.message || err),
                showConfirmButton: true,
                confirmButtonText: "Κλείσιμο",
                customClass: {
                    confirmButton: "class-error custom-confirm-button custom-swal-button",
                    title: "custom-title",
                    popup: "custom-swal-popup",
                },
            });
        }
    };

    // Προσθήκη event listeners σε όλα τα κουμπιά με κλάση submitButton
    const buttons = document.querySelectorAll(".submitButton");

    buttons.forEach((button) => {
        button.addEventListener("click", handleFormSubmit);
    });
});
