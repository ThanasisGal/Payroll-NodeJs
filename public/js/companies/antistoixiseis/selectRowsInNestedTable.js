// selectRowsInNestedTable.js
document.addEventListener('DOMContentLoaded', () => {
    // Αν το nestingTables.js ελέγχει τα κουμπιά/URLs, εδώ μένει ΜΟΝΟ το delete.
    const table     = document.getElementById('myTable');
    const deleteBtn = document.getElementById('delete-btn');
    if (!table || !deleteBtn) return;

    deleteBtn.addEventListener('click', async (event) => {
        // Guard: αν είναι disabled ή δεν υπάρχει επιλεγμένο nested id, μην κάνεις τίποτα
        if (
            deleteBtn.classList.contains('disabled') ||
            deleteBtn.classList.contains('disabled-link') ||
            deleteBtn.getAttribute('aria-disabled') === 'true' ||
            deleteBtn.href.endsWith('#')
        ) {
            event.preventDefault();
            return;
        }

        event.preventDefault();

        const nestedId = table.dataset.currentNestedId;
        if (!nestedId) return;

        const csrf      = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const deleteUrl = `/companies/antistoixiseis/deleteFromNested/${nestedId}`;

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
            didOpen: () => Swal.getCancelButton().focus(),
        });
        if (!result.isConfirmed) return;

        try {
            const resp = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                'X-CSRF-Token': csrf,
                'Accept': 'application/json'
                },
                credentials: 'same-origin'
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

                location.href = "/companies/antistoixiseis";
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
                location.href = data.redirectUrl || "/companies/antistoixiseis";
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
                location.href = "/companies/antistoixiseis";
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
                    window.location.href = "/companies/antistoixiseis"; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                },
            });
        }
















        //     if (!resp.ok) throw new Error('Network response was not ok');
        //     const data = await resp.json();

        //     await Swal.fire({
        //         icon: 'success',
        //         title: 'Επιτυχής Διαγραφή της Αντιστοίχισης Κ.Π.Κ',
        //         timer: 3000,
        //         customClass: { confirmButton: 'class-success custom-confirm-button custom-swal-button' }
        //     });
        //     window.location.href = data.redirectUrl;
        // } catch (error) {
        //     await Swal.fire({
        //         icon: 'error',
        //         title: 'Σφάλμα κατά τη Διαγραφή των Αντιστοιχίσεων Κ.Π.Κ.',
        //         html: 'Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>',
        //         timer: 4000,
        //         customClass: { confirmButton: 'class-normal custom-confirm-button custom-swal-button' }
        //     });
        //     window.location.href = '/companies/antistoixiseis';
        // }
    });
});
