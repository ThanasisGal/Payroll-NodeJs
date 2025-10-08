document.addEventListener("DOMContentLoaded", () => {
    const isEmpty = v => !String(v ?? "").trim();
  
    async function handleFormSubmit(event) {
        event.preventDefault();
        event.stopPropagation();

        const formData = {};
        const filePromises = [];
        const sections = document.querySelectorAll(".card-body");

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
                        formData[input.name] = (input.selectedIndex === -1) ? null : input.options[input.selectedIndex].value;
                    }
                }
            });
        });

        try {
            await Promise.all(filePromises);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

            const errors = [];
            if (isEmpty(formData.eponymia)) errors.push("Επώνυμο / μία");
            if (isEmpty(formData.afm)) errors.push("ΑΦΜ");
            if (isEmpty(formData.idiothtaEkprosopoy)) errors.push("Ιδιότητα");

            if (errors.length) {
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "warning",
                    title: "Προσοχή!",
                    html: `Τα πεδία:<br><strong>${errors.join(", ")}</strong> είναι υποχρεωτικά`,
                    confirmButtonText: "Κλείσιμο",
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-warning custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                });
                return;
            }
            const response = await fetch("/companies/nomimoi_ekprosopoi/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken,   // ✅ για csurf
                },
                credentials: "include",      // ✅ στείλε session cookies
                body: JSON.stringify(formData),
            });

            // 1) αν ο browser ακολούθησε redirect
            if (response.redirected && response.url) {
                window.location.href = response.url;
                return;
            }

            // 2) 3xx χωρίς auto-follow (σπάνιο)
            if (response.status >= 300 && response.status < 400) {
                const loc = response.headers.get("Location") || response.headers.get("location");
                if (loc) {
                const abs = loc.startsWith("http") ? loc : new URL(loc, window.location.origin).toString();
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
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής καταχώριση!",
                    timer: 1200,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => window.location.href = "/companies/nomimoi_ekprosopoi");
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
                    title: "Επιτυχής καταχώριση!",
                    timer: 1200,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => {
                    window.location.href = data.redirectUrl || "/companies/nomimoi_ekprosopoi";
                });
                return;
            }

            // 6) Άλλος content-type αλλά OK (π.χ. HTML)
            if (response.ok) {
                await Swal.fire({
                    backdrop: false,            // overlay
                    allowOutsideClick: false,
                    icon: "success",
                    title: "Επιτυχής καταχώριση!",
                    timer: 1200,
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-success custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                }).then(() => window.location.href = "/companies/nomimoi_ekprosopoi");
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

    const buttons = document.querySelectorAll(".submitButton");

    buttons.forEach((button) => {
        button.addEventListener("click", handleFormSubmit);
    });
});
