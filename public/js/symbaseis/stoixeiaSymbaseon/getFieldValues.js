document.addEventListener("DOMContentLoaded", () => {
	const isEmpty = v => !String(v ?? "").trim();

	// ▼ Helpers & "Επιστροφή"
	const $ = (s) => document.querySelector(s);
	const pad4 = n => String(n).padStart(4, "0");
	const nextKodikosFrom = v => pad4((parseInt(String(v).replace(/\D/g, ""), 10) || 0) + 1);

	// Κουμπί "Επιστροφή" (δεν κάνει submit)
	document.querySelectorAll(".backButton").forEach(btn => {
		btn.addEventListener("click", (e) => {
		e.preventDefault();
		window.location.href = "/symbaseis/stoixeiaSymbaseon";
		});
	});
	// ▲ Helpers & "Επιστροφή"

	async function handleFormSubmit(event) {
		event.preventDefault();
		event.stopPropagation();

		// Προστασία από διπλό κλικ
		const btn = event.currentTarget;
		if (btn && btn.disabled) return;
		if (btn) btn.disabled = true;

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
						formData[input.name] = (input.selectedIndex === -1)
						? null
						: input.options[input.selectedIndex].value;
					}
				}
			});
		});

		try {
			await Promise.all(filePromises);

			const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

			// Client validation
			const errors = [];
			if (isEmpty(formData.perigrafh)) 			errors.push("Περιγραφή");
			if (isEmpty(formData.typos_ypologismoy)) 	errors.push("Τύπος Υπολογισμού");

			if (errors.length) {
				await Swal.fire({
					backdrop: false,
					allowOutsideClick: false,
					icon: "warning",
					title: "Προσοχή!",
					html: `Τα πεδία:<br><strong>${errors.join(", ")}</strong> είναι υποχρεωτικά`,
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

			const response = await fetch("/symbaseis/stoixeiaSymbaseon/add", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-CSRF-Token": csrfToken,           // ✅ για csurf
					"X-Requested-With": "XMLHttpRequest" // δηλώνουμε AJAX
				},
				credentials: "same-origin",            // same-origin cookies μόνο
				redirect: "error",
				referrerPolicy: "same-origin",
				body: JSON.stringify(formData),
			});

			// Σαφής χειρισμός CSRF/Forbidden
			if (response.status === 403) {
				throw new Error("CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.");
			}

			const ct = response.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				throw new Error(`Μη αναμενόμενη απάντηση (${ct || "no content-type"})`);
			}

			const data = await response.json();
			if (!response.ok || !data?.success) {
				throw new Error(data?.message || `HTTP ${response.status}`);
			}

			// Προαιρετική ανανέωση CSRF token αν ο server στείλει νέο
			const newToken = response.headers.get("x-csrf-token");
			if (newToken) {
				const meta = document.querySelector('meta[name="csrf-token"]');
				if (meta) meta.content = newToken;
			}

			// Success toast (χωρίς να επιστρέψει focus στο κουμπί)
			await Swal.fire({
				backdrop: false,
				allowOutsideClick: false,
				icon: "success",
				title: "Επιτυχής καταχώριση!",
				timer: 900,
				showConfirmButton: false,
				returnFocus: false,
				customClass: {
					confirmButton: "class-success custom-confirm-button custom-swal-button",
					title: "custom-title",
					popup: "custom-swal-popup",
				},
			});

			// --- Ready για επόμενη εγγραφή ---
			const aaEl        					= $('[name="aa"]');
			const kodikosEl   					= $('[name="kodikos"]');
			const perigrafhEl 					= $('[name="perigrafh"]');
			const poso_posostoEl				= $('[name="poso_pososto"]');
			const arithmos_klimakionEl			= $('[name="arithmos_klimakion"]');
			const ypologismos_apo_klimakioEl	= $('[name="ypologismos_apo_klimakio"]');
			const bhma_ypologismoyEl			= $('[name="bhma_ypologismoy"]');
			const posoEl						= $('[name="poso"]');
			const posostoEl						= $('[name="pososto"]');
			const typos_ypologismoyEl			= $('[name="typos_ypologismoy"]');
			// Βάλε τα NEXT από server (fallbacks αν λείπουν)
						// if (aaEl) {
						// 	const pad4num = v => String(parseInt(v, 10) || 0).padStart(4, "0");
						// 	const fallbackAa = (parseInt(aaEl.value, 10) || 0) + 1;

						// 	// ΠΑΝΤΑ γράφουμε string "xxxx"
						// 	aaEl.value = (data.nextAa ?? null) !== null
						// 		? pad4num(data.nextAa)     // δέχεται number ή string ("12" ή "0012")
						// 		: pad4num(fallbackAa);
						// }
			if (kodikosEl) {
				const fallbackKod = nextKodikosFrom(kodikosEl.value);
				kodikosEl.value = data.nextKodikos || fallbackKod;
			}

			if (perigrafhEl) {
				perigrafhEl.value = "";
				perigrafhEl.focus();
				perigrafhEl.select?.();
			}

			if (poso_posostoEl) poso_posostoEl.value = "";
			if (arithmos_klimakionEl) arithmos_klimakionEl.value = 35;
			if (ypologismos_apo_klimakioEl) ypologismos_apo_klimakioEl.value = 1;
			if (bhma_ypologismoyEl) bhma_ypologismoyEl.value = 1;
			if (posoEl) posoEl.value = 0;
			if (posostoEl) posostoEl.value = 0;
			if (typos_ypologismoyEl) typos_ypologismoyEl.value = "";

			return; // Μένεις στην ίδια σελίδα

		} catch (err) {
			await Swal.fire({
				backdrop: false,
				allowOutsideClick: false,
				icon: "error",
				title: "Αποτυχία αποθήκευσης",
				text: String(err?.message || err),
				showConfirmButton: true,
				confirmButtonText: "Κλείσιμο",
				customClass: {
					confirmButton: "class-error custom-confirm-button custom-swal-button",
					title: "custom-title",
					popup: "custom-swal-popup",
				},
			});
		} finally {
			if (btn) btn.disabled = false; // επανενεργοποίηση κουμπιού
		}
	}

	// Attach handler στα κουμπιά "Αποθήκευση"
	document.querySelectorAll(".submitButton").forEach((button) => {
		button.addEventListener("click", handleFormSubmit);
	});
});
