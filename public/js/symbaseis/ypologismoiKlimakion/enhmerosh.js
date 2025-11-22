// document.addEventListener("DOMContentLoaded", async function () {
// 	document.getElementById('edit-btn').addEventListener('click', async function() {
// 		try {
// 			const response = await fetch('/api/enhmeroshKlimakion', {
// 				method: 'POST',
// 				headers: {
// 					'Content-Type': 'application/json',
// 				},
// 				body: JSON.stringify(window.dataForUpdate),
// 			});
		
// 			const data = await response.json();
// 			if (data.success) {
//                 await Swal.fire({
//                     backdrop: false,            // overlay
//                     allowOutsideClick: false,
//                     icon: "success",
//                     title: "Επιτυχής ενημέρωση!",
//                     timer: 1200,
//                     showConfirmButton: true,
//                     confirmButtonText: "Κλείσιμο",
//                     customClass: {
//                         confirmButton: "class-success custom-confirm-button custom-swal-button",
//                         title: "custom-title",
//                         popup: "custom-swal-popup",
//                     },
//                 }).then(() => window.location.href = data.redirectUrl);
// 			}
// 	    } catch (error) {
// 			console.error('Error:', error);
// 	    }
//   	});
// });


document.addEventListener("DOMContentLoaded", () => {
    const editBtn = document.getElementById("edit-btn");
    if (!editBtn) return;

    // Παίρνουμε CSRF token από <meta name="csrf-token" ...>
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

    async function handleEditClick(event) {
        event.preventDefault();
        event.stopPropagation();

        try {
            const response = await fetch("/api/enhmeroshKlimakion", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken,        // ✅ για csurf
                },
                credentials: "include",            // ✅ στέλνει session cookies
                body: JSON.stringify(window.dataForUpdate ?? {}),
            });

            // 1) Αν ο browser ακολούθησε redirect αυτόματα
            if (response.redirected && response.url) {
                window.location.href = response.url;
                return;
            }

            // 2) 3xx χωρίς auto-follow (σπάνιο αλλά το καλύπτουμε)
            if (response.status >= 300 && response.status < 400) {
                const loc = response.headers.get("Location") || response.headers.get("location");
                if (loc) {
                    const abs = loc.startsWith("http")
                        ? loc
                        : new URL(loc, window.location.origin).toString();
                    window.location.href = abs;
                    return;
                }
                throw new Error(`Redirect ${response.status} χωρίς Location header`);
            }

            // 3) CSRF/Forbidden
            if (response.status === 403) {
                throw new Error("CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.");
            }

            // 4) 204 No Content → δικό μας redirect
            if (response.status === 204) {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής ενημέρωση!",
                    timer: 1200,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => {
                    window.location.href = "/symbaseis/ypologismosKlimakion";
                });
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
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής ενημέρωση!",
                    timer: 1200,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => {
                    window.location.href = data.redirectUrl || "/symbaseis/ypologismosKlimakion";
                });

                return;
            }

            // 6) Άλλος content-type αλλά OK (π.χ. HTML)
            if (response.ok) {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής ενημέρωση!",
                    timer: 1200,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => {
                    window.location.href = "/symbaseis/ypologismosKlimakion";
                });
                return;
            }

            // 7) Σφάλμα HTTP
            throw new Error(`HTTP error ${response.status}`);

        } catch (err) {
            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: "error",
                title: "Αποτυχία ενημέρωσης κλιμακίων",
                timer: 1200,
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
    }

    editBtn.addEventListener("click", handleEditClick);
});
