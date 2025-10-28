// /public/js/symbaseis/eidikothtes/selectRowInTable.js
let selectedRowId = null;

document.addEventListener("DOMContentLoaded", function () {
	// ---------------- Πίνακας ----------------
	const table = document.getElementById("eidikothtes") || document.getElementById("myTable");
	const tableBody = table?.tBodies?.[0];
	if (!tableBody) return; // δεν υπάρχει πίνακας

	// ---------------- Κουμπιά ----------------
	const addBtn    = document.getElementById("add-btn");
	const editBtn   = document.getElementById("edit-btn");
	const deleteBtn = document.getElementById("delete-btn");

	// ---------------- Selects / Hidden ----------------
	const symSelect  = document.getElementById("symbash");
	const katSelect  = document.getElementById("kathgoria_symbashs");

	const symHidden  = document.getElementById("symbash_stathera");
	const katHidden  = document.getElementById("kathgoria_symbashs_stathera");

	// ---------------- Helpers ----------------
	const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || "";

	const to4 = (v) => {
		const d = String(v ?? "").replace(/\D/g, "");
		if (!d) return "";
		const n = parseInt(d, 10);
		return Number.isFinite(n) ? String(n).padStart(4, "0") : d.slice(-4).padStart(4, "0");
	};

	const showNoRowSelection = () =>
		Swal.fire({
			backdrop: false,
			allowOutsideClick: false,
			title: "Καμία επιλογή γραμμής",
			html: `Παρακαλώ επιλέξτε πρώτα μία <b>ειδικότητα</b> από τον πίνακα.`,
			icon: "info",
			showConfirmButton: true,
			confirmButtonText: "Κλείσιμο",
			customClass: {
				title: "custom-title",
				popup: "custom-swal-popup",
				confirmButton: "class-info custom-confirm-button custom-swal-button",
			},
		});

	const showNoContract = () =>
		Swal.fire({
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

	const showNoCategory = () =>
		Swal.fire({
			backdrop: false,
			allowOutsideClick: false,
			title: "Δεν έχει επιλεγεί κατηγορία",
			html: `Παρακαλώ επιλέξτε μία κατηγορία σύμβασης.`,
			icon: "info",
			showConfirmButton: true,
			confirmButtonText: "Κλείσιμο",
			customClass: {
				title: "custom-title",
				popup: "custom-swal-popup",
				confirmButton: "class-info custom-confirm-button custom-swal-button",
			},
		});

	const getSelectedSym = () => (symHidden?.value || symSelect?.value || "").trim();
	const getSelectedKat = () => (katHidden?.value || katSelect?.value || "").trim();

	// 8-ψηφιο composite για Ειδικότητες: sym(4)+kat(4)
	const getCompositeSymKat = () => {
		const s = to4(getSelectedSym());
		const k = to4(getSelectedKat());
		return s && k ? `${s}${k}` : "";
	};

	// ---------------- Hrefs για κουμπιά ----------------
	function updateEditHref() {
		if (!editBtn) return;
		editBtn.href = selectedRowId
		? "/symbaseis/eidikothtes/edit/" + encodeURIComponent(selectedRowId)
		: "#";
	}

	function updateAddHref() {
		if (!addBtn) return;
		const combo8 = getCompositeSymKat();
		addBtn.href = combo8
		? "/symbaseis/eidikothtes/add/" + encodeURIComponent(combo8)
		: "#";
	}

	function updateActionHrefs() {
		updateEditHref();
		updateAddHref();
	}

	function clearSelection() {
		selectedRowId = null;
		if (tableBody) {
			tableBody.querySelectorAll("tr.selected-row").forEach((tr) => tr.classList.remove("selected-row"));
		}
		updateActionHrefs();
	}

	// ---------------- Επιλογή γραμμής πίνακα ----------------
	tableBody.addEventListener("click", function (event) {
		const targetRow = event.target.closest("tr");
		if (!targetRow || targetRow.parentNode !== tableBody) return;

		const rowId = targetRow.getAttribute("data-id");
		if (!rowId) return; // αγνόησε γραμμές μηνυμάτων/φόρτωσης

		if (targetRow.classList.contains("selected-row")) {
			targetRow.classList.remove("selected-row");
			selectedRowId = null;
		} else {
			tableBody.querySelectorAll("tr").forEach((tr) => tr.classList.remove("selected-row"));
			targetRow.classList.add("selected-row");
			selectedRowId = rowId;
		}
		updateActionHrefs();
	});

	// ---------------- Συγχρονισμός hidden & hrefs ----------------
	const syncSymHiddenAndHref = () => {
		if (symHidden) symHidden.value = (symSelect?.value || "").trim();
		updateAddHref();
	};
	const syncKatHiddenAndHref = () => {
		if (katHidden) katHidden.value = (katSelect?.value || "").trim();
		updateAddHref();
	};

	if (symSelect && symHidden) {
		symSelect.addEventListener("change", syncSymHiddenAndHref);
		symSelect.addEventListener("input", syncSymHiddenAndHref);
	}
	if (katSelect && katHidden) {
		katSelect.addEventListener("change", syncKatHiddenAndHref);
		katSelect.addEventListener("input", syncKatHiddenAndHref);
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

	// Add: απαιτεί ΣΥΜΒΑΣΗ ΚΑΙ ΚΑΤΗΓΟΡΙΑ (ΔΕΝ απαιτεί γραμμή)
	if (addBtn) {
		addBtn.addEventListener("click", function (e) {
			const s = getSelectedSym();
			const k = getSelectedKat();

			if (!s) {
				e.preventDefault();
				e.stopPropagation();
				return showNoContract();
			}
			if (!k) {
				e.preventDefault();
				e.stopPropagation();
				return showNoCategory();
			}

			const combo8 = getCompositeSymKat();

			// Αν είναι <button>, κάνε χειροκίνητη πλοήγηση.
			if (addBtn.tagName.toLowerCase() !== "a") {
				e.preventDefault();
				window.location.href = "/symbaseis/eidikothtes/add/" + encodeURIComponent(combo8);
			} else {
				// Αν είναι <a>
				addBtn.href = "/symbaseis/eidikothtes/add/" + encodeURIComponent(combo8);
			}
		});
	}

	// Delete: απαιτεί επιλεγμένη ΓΡΑΜΜΗ
	if (deleteBtn) {
		deleteBtn.addEventListener("click", async function (event) {
			event.preventDefault();

			if (!selectedRowId) {
				await showNoRowSelection();
				return;
			}

			const deleteUrl = "/symbaseis/eidikothtes/delete/" + encodeURIComponent(selectedRowId);

			const result = 
				await Swal.fire({
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
						confirmButton: "class-warning custom-confirm-button custom-swal-button",
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
					title: "Επιτυχής Διαγραφή της Ειδικότητας",
					html: tableHtml,
					icon: "success",
					showConfirmButton: true,
					showCancelButton: false,
					confirmButtonText: "Κλείσιμο",
					customClass: {
					title: "custom-title",
					popup: "custom-swal-popup",
					confirmButton: "class-success custom-confirm-button custom-swal-button",
					},
				});
				} else {
				await Swal.fire({
					backdrop: false,
					allowOutsideClick: false,
					title: "Επιτυχής Διαγραφή της Ειδικότητας",
					html: `Δεν υπήρχαν εγγραφές προς διαγραφή στα <br>υπόλοιπα συσχετιζόμενα αρχεία`,
					icon: "info",
					showConfirmButton: true,
					showCancelButton: false,
					confirmButtonText: "Κλείσιμο",
					customClass: {
					title: "custom-title",
					popup: "custom-swal-popup",
					confirmButton: "class-info custom-confirm-button custom-swal-button",
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
				await Swal.fire({
					backdrop: false,
					allowOutsideClick: false,
					title: "Σφάλμα κατά τη Διαγραφή της Ειδικότητας",
					text: error.toString(),
					icon: "error",
					showConfirmButton: true,
					showCancelButton: false,
					confirmButtonText: "Κλείσιμο",
					customClass: {
						title: "custom-title",
						popup: "custom-swal-popup",
						confirmButton: "class-error custom-confirm-button custom-swal-button",
					},
				});
			}
		});
	}

	// ---------------- Αρχικοποίηση ----------------
	updateActionHrefs();
});
