/**
  	* emfanish.js
  	* Εμφάνιση κλιμακίων συμβάσεων από MongoDB (χωρίς υπολογισμούς)
  	* Φέρνει: Κατηγορίες → Ειδικότητες → Στοιχεία → Περίοδοι → Κλιμάκια
  	* Κλιμάκια φορτώνονται ανά στοιχείο με παράμετρο (symbash+kathgoria+eidikothta+stoixeio)
  	* Περιλαμβάνει λειτουργία διόρθωσης ποσού με Amendment, Save, Undo
  	* Περιλαμβάνει λειτουργία διαγραφής με Delete, Undo
**/

// Δέντρο για nested UI: Κατηγορία -> Ειδικότητα -> Στοιχείο -> Περίοδος -> Κλιμάκιο
window.treeDataEmfanish = {};

// Περιγραφές κατηγοριών
window.categoryDescriptionsEmfanish = {};

// Περιγραφές ειδικοτήτων
window.eidikotitaDescriptionsEmfanish = {};

// Περιγραφές στοιχείων
window.stoixeiaDescriptionsEmfanish = {};

// Αποθήκευση όλων των κλιμακίων
window.allKlimakiaData = [];

// ============================
// ΒΟΗΘΗΤΙΚΑ ΓΙΑ ΔΟΜΕΣ ΔΕΔΟΜΕΝΩΝ
// ============================

/**
 * Δημιουργεί την nested δομή από τα δεδομένα της MongoDB
 * Χρησιμοποιεί τα περιγραφές που ήδη έχουν φορτωθεί
 */
function buildTreeFromData(klimakiaData, stoixeiaMap) {
	window.treeDataEmfanish = {};

	for (const record of klimakiaData) {
		const kodikosSymbashs = record.kodikos_symbashs || '';
		const kodikosKathgorias = record.kodikos_kathgorias_symbashs || '';
		const kodikosEidikothtas = record.kodikos_eidikothtas_symbashs || '';
		const kodikosStoxeiou = record.kodikos_stoixeioy || '';
		const klimakio = record.klimakio || '';
		const poso = record.poso || 0;

		// Κλειδί κατηγορίας: π.χ. "00010001"
		const katigoria = kodikosSymbashs + kodikosKathgorias;
		// Κλειδί ειδικότητας: π.χ. "000100010001"
		const eidikotita = katigoria + kodikosEidikothtas;
		// Κλειδί στοιχείου: π.χ. "0001000100010001"
		const kodStoixeiou = eidikotita + kodikosStoxeiou;

		// Ημερομηνίες
		const isxyeiApo = record.isxyei_apo || new Date().toISOString();
		const isxyeiEos = record.isxyei_eos || new Date().toISOString();
		const periodKey = `${isxyeiApo}__${isxyeiEos}`;

		// Πράξη κατάθεσης
		const praxh_katatheshs = record.praxh_katatheshs || '';

		// Περιγραφή στοιχείου από τα δεδομένα
		let perigrafhStoixeioy = record.perigrafh_stoixeioy || record.perigrafh || '';

		// Αν υπάρχει στο stoixeiaMap, πάρε την περιγραφή από εκεί
		const stoixeiaKey = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`;
		if (stoixeiaMap && stoixeiaMap[stoixeiaKey]) {
			const stoixeiaArray = stoixeiaMap[stoixeiaKey];
			const matchingStoixeio = stoixeiaArray.find(s => s.kodikos === kodikosStoxeiou);
			if (matchingStoixeio) {
				perigrafhStoixeioy = matchingStoixeio.perigrafh_stoixeioy || 
									 matchingStoixeio.perigrafh ||
									 matchingStoixeio.perigrafh_stoixeioy_symbashs ||
									 perigrafhStoixeioy;
			}
		}

		// Δημιουργία δομής
		if (!window.treeDataEmfanish[katigoria]) {
			window.treeDataEmfanish[katigoria] = {};
		}
		if (!window.treeDataEmfanish[katigoria][eidikotita]) {
			window.treeDataEmfanish[katigoria][eidikotita] = {};
		}
		if (!window.treeDataEmfanish[katigoria][eidikotita][kodStoixeiou]) {
			window.treeDataEmfanish[katigoria][eidikotita][kodStoixeiou] = {
				perigrafhStoixeioy,
				periods: {},
			};
		}

		const stoixeioNode = window.treeDataEmfanish[katigoria][eidikotita][kodStoixeiou];

		if (!stoixeioNode.periods[periodKey]) {
			stoixeioNode.periods[periodKey] = {
				isxyeiApo,
				isxyeiEos,
				praxh_katatheshs,
				klimakia: [],
			};
		}

		stoixeioNode.periods[periodKey].klimakia.push({
			klimakio,
			poso,
		});
	}
}

// ============================
// ΔΗΜΙΟΥΡΓΙΑ GROUP ROWS
// ============================

/**
 * Δημιουργεί μια "group" γραμμή
 */
function createGroupRowEmfanish(tbody, label, id, level = 'generic', isHtml = false) {
	const tr = document.createElement('tr');
	tr.classList.add('group-row');

	if (level === 'category') {
		tr.classList.add('group-row--category');
		tr.innerHTML = `
			<td colspan="7" class="fw-bold">
				<span class="chevron">▸</span>
				${label}
			</td>
		`;
	} else if (level === 'eidikotita') {
		tr.classList.add('group-row--eidikotita');
		tr.innerHTML = `
			<td colspan="7" class="fw-bold p-0">
				<div class="row g-0 align-items-stretch eidikotita-row-wrapper">
					<div class="col-1"></div>
					<div class="col-11 eidikotita-cell">
						<span class="chevron">▸</span>
						${label}
					</div>
				</div>
			</td>
		`;
	} else if (level === 'stoixeio') {
		tr.classList.add('group-row--stoixeio');
		tr.innerHTML = `
			<td colspan="7" class="fw-bold p-0">
				<div class="row g-0 align-items-stretch stoixeio-row-wrapper">
					<div class="col-2"></div>
					<div class="col-10 stoixeio-cell">
						<span class="chevron">▸</span>
						${label}
					</div>
				</div>
			</td>
		`;
	} else if (level === 'period') {
		tr.classList.add('group-row--period');
		tr.innerHTML = `
			<td colspan="7" class="fw-bold p-0">
				<div class="row g-0 align-items-stretch period-row-wrapper">
					<div class="col-3"></div>
					<div class="col-9 period-cell">
						<span class="chevron">▸</span>
						${label}
					</div>
				</div>
			</td>
		`;
	} else {
		tr.innerHTML = `
			<td colspan="7" class="fw-bold">
				<span class="chevron">▸</span>
				${label}
			</td>
		`;
	}

	tr.dataset.target = id;
	tbody.appendChild(tr);
}

/**
 * Γραμμή που φιλοξενεί το "child" table
 */
function createChildContainerRowEmfanish(tbody, id) {
	const tr = document.createElement('tr');
	tr.classList.add('collapse-row');
	tr.dataset.rowId = id;
	tr.style.display = 'none';

	tr.innerHTML = `
		<td colspan="7">
			<table class="table table-sm mb-0">
				<tbody></tbody>
			</table>
		</td>
	`;
	tbody.appendChild(tr);
	return tr.querySelector('tbody');
}

// ============================
// HELPER: Μορφοποίηση ημερομηνίας
// ============================

/**
 * Μορφοποιεί την ημερομηνία σε ελληνικό format
 */
function formatDateGR(dateString) {
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString('el-GR', { 
			year: 'numeric', 
			month: '2-digit', 
			day: '2-digit' 
		});
	} catch (e) {
		return dateString;
	}
}

// ============================
// HELPER: Κεντρικό Swal
// ============================

/**
 * Εμφανίζει SweetAlert με παραμέτρους
 * @param {string} icon - success, error, warning, info
 * @param {string} title - Τίτλος
 * @param {string} html - Περιεχόμενο
 * @param {number} timer - Timer σε ms (0 = χωρίς timer)
 */
function showSwal(icon = 'info', title = '', html = '', timer = 0) {
	// Χρώμα κλάσης ανάλογα με το icon
	const classMap = {
		'success': 'class-success',
		'error': 'class-error',
		'warning': 'class-warning',
		'info': 'class-info'
	};

	const buttonClass = classMap[icon] || 'class-info';

	const config = {
		backdrop: false,
		allowOutsideClick: false,
		icon: icon,
		title: title,
		html: html,
		showConfirmButton: true,
		confirmButtonText: 'Κλείσιμο',
		customClass: {
			confirmButton: `${buttonClass} custom-confirm-button custom-swal-button`,
			title: 'custom-title',
			popup: 'custom-swal-popup',
		},
	};

	// Αν υπάρχει timer, το προσθέτουμε
	if (timer > 0) {
		config.timer = timer;
	}

	return Swal.fire(config);
}

// ============================
// RENDER NESTED TABLES
// ============================

function renderNestedTablesEmfanish(tbody) {
	tbody.innerHTML = '';

	const tree = window.treeDataEmfanish || {};
	const katKeys = Object.keys(tree).sort();

	for (const katigoria of katKeys) {
		const katId = `kat-${katigoria}`;
		const katDescr = (window.categoryDescriptionsEmfanish || {})[katigoria] || '';

		const katLabel = katDescr
			? `Κατηγορία ${katigoria.substring(4, 8)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${katDescr}</span>`
			: `Κατηγορία ${katigoria.substring(4, 8)}`;

		createGroupRowEmfanish(tbody, katLabel, katId, 'category');
		const katBody = createChildContainerRowEmfanish(tbody, katId);

		const eidNode = tree[katigoria];
		const eidKeys = Object.keys(eidNode).sort();

		for (const eidikotita of eidKeys) {
			const eidId = `eid-${katigoria}-${eidikotita}`;
			const eidDescr = (window.eidikotitaDescriptionsEmfanish || {})[eidikotita] || '';
			const eidLabel = eidDescr
				? `Ειδικότητα ${eidikotita.substring(8, 12)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${eidDescr}</span>`
				: `Ειδικότητα ${eidikotita.substring(8, 12)}`;

			createGroupRowEmfanish(katBody, eidLabel, eidId, 'eidikotita');
			const eidBody = createChildContainerRowEmfanish(katBody, eidId);

			const stoixMap = eidNode[eidikotita];
			const stoixKeys = Object.keys(stoixMap).sort();

			for (const kodStoixeiou of stoixKeys) {
				const stoixNode = stoixMap[kodStoixeiou];
				const stoixId = `stoix-${katigoria}-${eidikotita}-${kodStoixeiou}`;
				const stoixDescr = stoixNode.perigrafhStoixeioy || '';
				const stoixLabel = stoixDescr
					? `Στοιχείο ${kodStoixeiou.substring(12, 16)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${stoixDescr}</span>`
					: `Στοιχείο ${kodStoixeiou.substring(12, 16)}`;

				createGroupRowEmfanish(eidBody, stoixLabel, stoixId, 'stoixeio');
				const stoixBody = createChildContainerRowEmfanish(eidBody, stoixId);

				// -------- ΝΕΟ ΕΠΙΠΕΔΟ: ΠΕΡΙΟΔΟΙ --------
				const periodMap = stoixNode.periods || {};
				const periodKeys = Object.keys(periodMap).sort();

				for (const periodKey of periodKeys) {
					const period = periodMap[periodKey];
					const periodId = `period-${katigoria}-${eidikotita}-${kodStoixeiou}-${periodKey}`;

					const periodFromDate = formatDateGR(period.isxyeiApo);
					const periodToDate = formatDateGR(period.isxyeiEos);
					// const periodLabel = `<span class="fw-bold">Περίοδος:</span> <span class="font-size-vw-0_72 font-weight-500 ms-2">${periodFromDate} → ${periodToDate}</span>`;
					const periodLabel = `<span class="fw-bold">Περίοδος:</span> <span class="font-size-vw-0_75 font-weight-600 ms-2">${periodFromDate} → ${periodToDate}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="font-size-vw-0_72 font-weight-400">ΠΚ :</span> <span class="font-size-vw-0_72 font-weight-400 ms-2">${period.praxh_katatheshs}</span>`;

					createGroupRowEmfanish(stoixBody, periodLabel, periodId, 'period');
					const periodBody = createChildContainerRowEmfanish(stoixBody, periodId);

					// -------- ΚΛΙΜΑΚΙΑ ΑΥΤΗΣ ΤΗΣ ΠΕΡΙΟΔΟΥ --------
					const klimakia = period.klimakia || [];

					// Κεφαλίδα πίνακα κλιμακίων
					const headerRow = document.createElement('tr');
					headerRow.innerHTML = `
						<th colspan="7" class="fw-normal p-0">
							<div class="row g-0 align-items-center style_04">
								<div class="col-4"></div>
								<div class="col-915 text-center font-weight-700 font-size-vw-0_875 color2C3E50">α/α Κλιμακίου</div>
								<div class="col-920 text-end font-weight-700 font-size-vw-0_875 color2C3E50 margin-left--1rem">Ποσό</div>
								<div class="col-925 text-center font-weight-700 font-size-vw-0_875 color2C3E50 margin-left-1rem">Ενέργειες</div>
							</div>
						</th>
					`;
					periodBody.appendChild(headerRow);

					// Ταξινόμηση κλιμακίων
					klimakia.sort((a, b) => {
						const aNum = Number(a.klimakio) || 0;
						const bNum = Number(b.klimakio) || 0;
						return aNum - bNum;
					});

					for (const k of klimakia) {
						const tr = document.createElement('tr');
						tr.classList.add('klimakio-row');

						const posoDisp = (typeof k.poso === 'number' && Number.isFinite(k.poso))
							? k.poso.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
							: '0,00';

						// Δημιουργούμε το HTML
						tr.innerHTML = `
							<td colspan="7" class="p-0 style_01" style="border-bottom: 1px solid #E8E8E8; height: 40px;">
								<div class="row g-0 align-items-center klimakio-row-wrapper style_02" style="height: 100%; padding: 0 8px;">

									<!-- COL-4: SPACER - ΔΕΝ θα αλλάζει χρώμα -->
									<div class="col-4 klimakio-spacer bg-white"></div>

									<!-- COL-915: ΚΛΙΜΑΚΙΟ -->
									<div class="col-915 text-center klimakio-colored font-size-vw-0_875 font-weight-400 color2C3E50 line-height-40px">
										${k.klimakio.padStart(2, '0')}
									</div>

									<!-- COL-2: ΠΟΣΟ -->
									<div class="col-2 text-end klimakio-colored font-size-vw-0_875 font-weight-400 color2C3E50 line-height-40px padding-right-12px">
										${posoDisp}
									</div>

									<!-- COL-925: ΚΟΥΜΠΙΑ -->
									<div class="col-925 text-center klimakio-hover klimakio-colored style_03">
										<a 
											href="#"
											role="button"
											class="amendment-button button-style-1 color3498DB"
											data-bs-toggle="tooltip" 
											data-bs-title="Διόρθωση Ποσού"
											data-bs-placement="bottom"
											data-tooltip-max-width="15vw"
											data-allowed="1">
											<i class="bi bi-pencil-square font-size-vw-0_875" ></i>
										</a>

										<a 
											href="#"
											role="button"
											class="delete-button button-style-1 colorE74C3C"
											data-bs-toggle="tooltip" 
											data-bs-title="Διαγραφή Γραμμής"
											data-bs-placement="bottom"
											data-tooltip-max-width="15vw"
											data-allowed="1">
											<i class="bi bi-trash3 font-size-vw-0_875"></i>
										</a>

										<a 
											href="#"
											role="button"
											class="save-button button-style-1 color27AE60"
											data-bs-toggle="tooltip" 
											data-bs-title="Αποθήκευση Αλλαγών"
											data-bs-placement="bottom"
											data-tooltip-max-width="15vw"
											data-allowed="1">
											<i class="bi bi-floppy font-size-vw-0_875"></i>
										</a>

										<a 
											href="#"
											role="button"
											class="undo-button button-style-1 colorF39C12"
											data-bs-toggle="tooltip" 
											data-bs-title="Αναίρεση"
											data-bs-placement="bottom"
											data-tooltip-max-width="15vw"
											data-allowed="1">
											<i class="bi bi-arrow-counterclockwise font-size-vw-0_875"></i>
										</a>
									</div>
								</div>
							</td>
						`;
						periodBody.appendChild(tr);
					}

				}
			}
		}
	}
}

// ============================
// EVENT DELEGATION (Collapsible)
// ============================

document.addEventListener('click', function (e) {
	const row = e.target.closest('tr.group-row');
	if (!row) return;

	const targetId = row.dataset.target;
	if (!targetId) return;

	const contentRow = document.querySelector(`tr[data-row-id="${targetId}"]`);
	if (!contentRow) return;

	const isHidden = contentRow.style.display === 'none';
	contentRow.style.display = isHidden ? '' : 'none';

	const chevron = row.querySelector('.chevron');
	if (chevron) {
		chevron.textContent = isHidden ? '▾' : '▸';
	}
});

// ============================
// ΔΙΟΡΘΩΣΗ ΠΟΣΟΥ - AMENDMENT
// ============================

/**
 * Κάνει το ποσό editable όταν πατηθεί το κουμπί amendment
 */
document.addEventListener('click', function (e) {
	const amendmentBtn = e.target.closest('.amendment-button');
	if (!amendmentBtn) return;

	e.preventDefault();

	// Εάν δεν έχει την άδεια
	if (amendmentBtn.dataset.allowed !== '1') {
		showSwal('warning', 'Δεν έχετε άδεια', 'Δεν έχετε δικαιώματα διόρθωσης');
		return;
	}

	// Βρίσκουμε το κελί του ποσού σε αυτή την γραμμή
	const klimakioRow = amendmentBtn.closest('.klimakio-row');
	if (!klimakioRow) return;

	// Το col που περιέχει το ποσό (col-2 text-end)
	const posoDiv = klimakioRow.querySelector('.row.g-0 > .col-2.text-end');
	if (!posoDiv) return;

	// Αν είναι ήδη σε edit mode, δεν κάνουμε τίποτα
	if (posoDiv.querySelector('input')) {
		return;
	}

	// Παίρνουμε την τρέχουσα τιμή του ποσού (καθαρίζουμε το κόμμα)
	const currentPoso = posoDiv.textContent.trim();
	const numericPoso = currentPoso.replace('.', '').replace(',', '.');

	// ===== ΑΠΟΘΗΚΕΥΣΗ ΤΗΣ ΤΡΕΧΟΥΣΑΣ ΤΙΜΗΣ =====
	// Εάν δεν έχει ήδη αποθηκευτεί (πρώτη διόρθωση)
	if (!klimakioRow.dataset.savedPoso) {
		klimakioRow.dataset.savedPoso = numericPoso;
	}

	// Δημιουργούμε input field
	const input = document.createElement('input');
	input.type = 'number';
	input.className = 'form-control form-control-sm amendment-input';
	input.value = numericPoso;
	input.step = '0.01';
	input.min = '0';
	input.style.textAlign = 'right';

	// Αποθηκεύουμε τη γραμμή
	klimakioRow.dataset.isEditing = 'true';

	// Αντικαθιστούμε το περιεχόμενο του div με το input
	posoDiv.innerHTML = '';
	posoDiv.appendChild(input);

	// Focus στο input
	input.focus();
	input.select();

	// Κρύβουμε τα άλλα κουμπιά (όχι το undo)
	const deleteBtn = klimakioRow.querySelector('.delete-button');
	const amendmentBtn2 = klimakioRow.querySelector('.amendment-button');

	if (deleteBtn) deleteBtn.style.display = 'none';
	if (amendmentBtn2) amendmentBtn2.style.display = 'none';

	// Αποθηκεύουμε την παλιά τιμή για αναίρεση
	klimakioRow.dataset.oldPoso = numericPoso;

	// Ενεργοποιούμε το save button
	const saveBtn = klimakioRow.querySelector('.save-button');
	if (saveBtn) {
		saveBtn.classList.add('visible');
	}

	// Εμφανίζουμε το undo button
	const undoBtn = klimakioRow.querySelector('.undo-button');
	if (undoBtn) {
		undoBtn.style.display = 'inline-flex';
	}
});

/**
 * Αποθήκευση του ποσού
 */
document.addEventListener('click', function (e) {
	const saveBtn = e.target.closest('.save-button');
	if (!saveBtn) return;

	e.preventDefault();

	// Εάν δεν έχει την άδεια
	if (saveBtn.dataset.allowed !== '1') {
		showSwal('warning', 'Δεν έχετε άδεια', 'Δεν έχετε δικαιώματα αποθήκευσης');
		return;
	}

	const klimakioRow = saveBtn.closest('.klimakio-row');
	if (!klimakioRow) return;

	// Βρίσκουμε το input
	const input = klimakioRow.querySelector('.amendment-input');
	if (!input) {
		showSwal('info', 'Δεν υπάρχει αλλαγή', 'Δεν βρέθηκε edit field');
		return;
	}

	const newPoso = parseFloat(input.value);

	// Validation
	if (isNaN(newPoso) || newPoso < 0) {
		showSwal('error', 'Σφάλμα', 'Παρακαλώ εισάγετε έγκυρο ποσό (≥ 0)');
		input.focus();
		return;
	}

	// Μορφοποιούμε το νέο ποσό
	const formattedPoso = newPoso.toLocaleString('el-GR', { 
		minimumFractionDigits: 2, 
		maximumFractionDigits: 2 
	});

	// Αντικαθιστούμε το input με το νέο κείμενο
	const posoDiv = klimakioRow.querySelector('.row.g-0 > .col-2.text-end');
	if (posoDiv) {
		posoDiv.innerHTML = formattedPoso;
	}

	// ===== ΑΠΟΘΗΚΕΥΣΗ ΤΗΣ ΝΕΑΣ ΤΙΜΗΣ =====
	klimakioRow.dataset.newPoso = newPoso;

	klimakioRow.dataset.isEditing = 'false';
	klimakioRow.dataset.isSaved = 'true'; // Marker για αποθηκευμένη αλλαγή

	// Κρύβουμε τα κουμπιά διόρθωσης και διαγραφής
	const deleteBtn = klimakioRow.querySelector('.delete-button');
	const amendmentBtn = klimakioRow.querySelector('.amendment-button');

	if (deleteBtn) deleteBtn.style.display = 'none';
	if (amendmentBtn) amendmentBtn.style.display = 'none';

	// Κρύβουμε το save button
	if (saveBtn) saveBtn.classList.remove('visible');

	// Εμφανίζουμε ΜΟΝΟ το undo button
	const undoBtn = klimakioRow.querySelector('.undo-button');
	if (undoBtn) undoBtn.style.display = 'inline-flex';

	showSwal('success', 'Επιτυχής αποθήκευση', `Το ποσό ενημερώθηκε σε <strong>${formattedPoso}</strong>`, 1000);
});

// ============================
// ΔΙΑΓΡΑΦΗ - DELETE
// ============================

/**
 * Διαγραφή κλιμακίου - κόκκινη γραμμή
*/
document.addEventListener('click', function (e) {
	const deleteBtn = e.target.closest('.delete-button');
	if (!deleteBtn) return;

	e.preventDefault();

	// Εάν δεν έχει την άδεια
	if (deleteBtn.dataset.allowed !== '1') {
		showSwal('warning', 'Δεν έχετε άδεια', 'Δεν έχετε δικαιώματα διαγραφής');
		return;
	}

	const klimakioRow = deleteBtn.closest('.klimakio-row');
	if (!klimakioRow) return;

	// Ελέγχουμε αν είναι ήδη σε "deleted" mode
	if (klimakioRow.dataset.isDeleted === 'true') {
		showSwal('info', 'Ήδη σημειωμένη για διαγραφή', 'Αυτή η γραμμή είναι ήδη σημειωμένη για διαγραφή. Πατήστε Αναίρεση για να την επαναφέρετε.');
		return;
	}

	// ===== ΑΠΟΘΗΚΕΥΣΗ ΤΗΣ ΟΛΟΚΛΗΡΗΣ ΓΡΑΜΜΗΣ =====
	// Αποθηκεύουμε το κλιμάκιο και το ποσό
	const klimakioText = klimakioRow.querySelector('.col-915')?.textContent.trim() || '';
	const posoText = klimakioRow.querySelector('.row.g-0 > .col-2.text-end')?.textContent.trim() || '';

	klimakioRow.dataset.deletedKlimakio = klimakioText;
	klimakioRow.dataset.deletedPoso = posoText;

	klimakioRow.dataset.isDeleted = 'true';
	klimakioRow.dataset.deletionMarked = 'true'; // Marker για αναίρεση

	// ===== Κρύβουμε τα κουμπιά διόρθωσης, διαγραφής και αποθήκευσης =====
	const amendmentBtn = klimakioRow.querySelector('.amendment-button');
	const saveBtn = klimakioRow.querySelector('.save-button');

	if (amendmentBtn) amendmentBtn.style.display = 'none';
	if (deleteBtn) deleteBtn.style.display = 'none';
	if (saveBtn) saveBtn.classList.remove('visible');

	// ===== Εμφανίζουμε ΜΟΝΟ το Undo =====
	const undoBtn = klimakioRow.querySelector('.undo-button');
	if (undoBtn) undoBtn.style.display = 'inline-flex';

	showSwal('warning', 'Σημειωμένη για διαγραφή', 'Η γραμμή σημειώθηκε για διαγραφή. Η αναίρεση είναι διαθέσιμη.');
});

/**
 * Αναίρεση αλλαγών - Δουλεύει για διαγραφή, edit και save
 */
document.addEventListener('click', function (e) {
	const undoBtn = e.target.closest('.undo-button');
	if (!undoBtn) return;

	e.preventDefault();

	const klimakioRow = undoBtn.closest('.klimakio-row');
	if (!klimakioRow) return;

	// ===== ΠΕΡΙΠΤΩΣΗ: Διαγραφή (isDeleted = true) =====
	if (klimakioRow.dataset.isDeleted === 'true' && klimakioRow.dataset.deletionMarked === 'true') {
		klimakioRow.dataset.isDeleted = 'false';
		klimakioRow.dataset.deletionMarked = 'false';

		// Επαναφορά του Amendment κουμπιού
		const amendmentBtn = klimakioRow.querySelector('.amendment-button');
		const deleteBtn = klimakioRow.querySelector('.delete-button');
		const saveBtn = klimakioRow.querySelector('.save-button');

		if (amendmentBtn) amendmentBtn.style.display = 'inline-flex';
		if (deleteBtn) deleteBtn.style.display = 'inline-flex';
		if (saveBtn) saveBtn.classList.remove('visible');

		showSwal('info', 'Αναίρεση διαγραφής', 'Η γραμμή επαναφέρθηκε και δεν θα διαγραφεί.');
		return;
	}

	// ===== ΠΕΡΙΠΤΩΣΗ: Διόρθωση ποσού (input field υπάρχει) =====
	const input = klimakioRow.querySelector('.amendment-input');

	if (input) {
		const oldPoso = klimakioRow.dataset.oldPoso || '0,00';
		const formattedOldPoso = parseFloat(oldPoso).toLocaleString('el-GR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});

		const posoDiv = klimakioRow.querySelector('.row.g-0 > .col-2.text-end');
		if (posoDiv) {
			posoDiv.innerHTML = formattedOldPoso;
		}

		klimakioRow.dataset.isEditing = 'false';

		const deleteBtn = klimakioRow.querySelector('.delete-button');
		const saveBtn = klimakioRow.querySelector('.save-button');
		const amendmentBtn = klimakioRow.querySelector('.amendment-button');

		if (deleteBtn) deleteBtn.style.display = 'inline-flex';
		if (saveBtn) saveBtn.classList.remove('visible');
		if (amendmentBtn) amendmentBtn.style.display = 'inline-flex';

		showSwal('info', 'Αναίρεση', 'Η αλλαγή ακυρώθηκε');
	} else if (klimakioRow.dataset.isSaved === 'true') {
		// ===== ΠΕΡΙΠΤΩΣΗ: Αποθηκευμένη αλλαγή ποσού =====
		const savedPoso = klimakioRow.dataset.savedPoso || '0,00';
		const formattedSavedPoso = parseFloat(savedPoso).toLocaleString('el-GR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});

		const posoDiv = klimakioRow.querySelector('.row.g-0 > .col-2.text-end');
		if (posoDiv) {
			posoDiv.innerHTML = formattedSavedPoso;
		}

		klimakioRow.dataset.isSaved = 'false';
		klimakioRow.dataset.newPoso = '';

		const deleteBtn = klimakioRow.querySelector('.delete-button');
		const saveBtn = klimakioRow.querySelector('.save-button');
		const amendmentBtn = klimakioRow.querySelector('.amendment-button');

		if (deleteBtn) deleteBtn.style.display = 'inline-flex';
		if (saveBtn) saveBtn.classList.remove('visible');
		if (amendmentBtn) amendmentBtn.style.display = 'inline-flex';

		showSwal('info', 'Αναίρεση αποθήκευσης', `Η τιμή επαναφέρθηκε σε <strong>${formattedSavedPoso}</strong>`);
	} else {
		showSwal('info', 'Δεν υπάρχει αλλαγή', 'Δεν υπάρχουν αλλαγές για αναίρεση');
	}
});

// ============================
// ΣΥΛΛΟΓΗ ΔΕΔΟΜΕΝΩΝ ΓΙΑ ΑΠΟΘΗΚΕΥΣΗ
// ============================

/**
 * Συλλέγει όλες τις αλλαγές (saved & deleted) από τον πίνακα
 * @returns {Object} - { updated: [], deleted: [] }
 */
function collectChangesFromTable() {
	const changes = {
		updated: [],    // Κλιμάκια με αλλαγμένα ποσά
		deleted: [],    // Κλιμάκια για διαγραφή
	};

	// Βρίσκουμε όλες τις γραμμές κλιμακίων που έχουν αλλαγές
	const klimakioRows = document.querySelectorAll('.klimakio-row');

	for (const row of klimakioRows) {
		// ===== ΠΕΡΙΠΤΩΣΗ 1: Αποθηκευμένη αλλαγή ποσού (κίτρινη) =====
		if (row.dataset.isSaved === 'true') {
			const klimakio = row.querySelector('.col-915')?.textContent.trim() || '';
			const newPoso = row.dataset.newPoso || 0;
			const oldPoso = row.dataset.savedPoso || 0;

			changes.updated.push({
				klimakio: klimakio,
				oldPoso: parseFloat(oldPoso),
				newPoso: parseFloat(newPoso),
				status: 'updated',
				timestamp: new Date().toISOString(),
			});
		}

		// ===== ΠΕΡΙΠΤΩΣΗ 2: Σημειωμένη για διαγραφή (κόκκινη) =====
		if (row.dataset.isDeleted === 'true' && row.dataset.deletionMarked === 'true') {
			const klimakio = row.dataset.deletedKlimakio || '';
			const poso = row.dataset.deletedPoso || '';

			changes.deleted.push({
				klimakio: klimakio,
				poso: poso,
				status: 'deleted',
				timestamp: new Date().toISOString(),
			});
		}
	}

	return changes;
}

/**
 * Εμφανίζει στο console τις αλλαγές (για debug)
 */
window.showChanges = function() {
	const changes = collectChangesFromTable();
	console.log('📊 Αλλαγές για αποθήκευση:', changes);
	return changes;
};

// ============================
// MAIN: ΕΜΦΑΝΙΣΗ ΔΕΔΟΜΕΝΩΝ
// ============================

document.addEventListener('DOMContentLoaded', function () {
	const addBtn = document.getElementById('add-btn');
	const loader = document.getElementById('ypologismos-loader');

	if (loader) {
		loader.style.display = 'none';
	}

	if (!addBtn) return;

	addBtn.addEventListener('click', async () => {
		const tbody = document.querySelector('#myTable tbody');
		if (!tbody) return;

		// Καθαρισμός
		tbody.innerHTML = '';
		window.treeDataEmfanish = {};
		window.categoryDescriptionsEmfanish = {};
		window.eidikotitaDescriptionsEmfanish = {};
		window.stoixeiaDescriptionsEmfanish = {};
		window.allKlimakiaData = [];

		// Εμφάνιση loader
		if (loader) {
			loader.style.display = 'flex';
			await new Promise(resolve => setTimeout(resolve, 0));
		}

		try {
			// 1) Παίρνουμε τα επιλεγμένα δεδομένα
			const el = document.getElementById('eidikothta_symbashs_table');
			const raw = (el.value ?? el.textContent ?? '').trim();
			const eidArr = JSON.parse(raw);

			if (!eidArr || eidArr.length === 0) {
				showSwal('info', 'Δεν έχουν επιλεγεί ειδικότητες', 'Παρακαλώ επιλέξτε τουλάχιστον μία ειδικότητα');
				return;
			}

			// 2) Μοναδικές συμβάσεις και κατηγορίες
			const symbashSet = new Set(
				eidArr
					.map(row => row.afora_thn_symbash_kathgoria?.slice(0, 4))
					.filter(Boolean)
			);

			const symbashKathgoriaSet = new Set(
				eidArr
					.map(row => row.afora_thn_symbash_kathgoria)
					.filter(Boolean)
			);

			// 3) Φέρνουμε περιγραφές κατηγοριών
			let symbashIndex = 0;
			for (const symbash of symbashSet) {
				if (symbashIndex++ % 3 === 0) {
					await new Promise(r => setTimeout(r, 0));
				}

				try {
					const resp = await fetch(`/api/kathgoriesSymbaseon/${encodeURIComponent(symbash)}`, {
						method: 'GET',
						credentials: 'same-origin',
						headers: { 'Accept': 'application/json' }
					});
					if (!resp.ok) throw new Error('HTTP ' + resp.status);

					const katArr = await resp.json();
					for (const kat of katArr) {
						const katCode = symbash + kat.kodikos;
						const katDescr =
							kat.perigrafi_kathgorias ??
							kat.perigrafh_kathgorias ??
							kat.perigrafh ??
							'';

						if (katCode && katDescr) {
							window.categoryDescriptionsEmfanish[katCode] = katDescr;
						}
					}
				} catch (err) {
					console.error('Error fetching kathgoriesSymbaseon', err);
				}
			}

			// 4) Φέρνουμε περιγραφές ειδικοτήτων
			let symKatIndex = 0;
			for (const symKat of symbashKathgoriaSet) {
				if (symKatIndex++ % 3 === 0) {
					await new Promise(r => setTimeout(r, 0));
				}

				try {
					const resp = await fetch(`/api/eidikothtesSymbaseon/${encodeURIComponent(symKat)}`, {
						method: 'GET',
						credentials: 'same-origin',
						headers: { 'Accept': 'application/json' }
					});
					if (!resp.ok) throw new Error('HTTP ' + resp.status);

					const eidApiArr = await resp.json();
					for (const eid of eidApiArr) {
						const eidCode = symKat + eid.kodikos;
						const eidDescr =
							eid.perigrafi_eidikothtas ??
							eid.perigrafh_eidikothtas ??
							eid.perigrafh ??
							'';

						if (eidCode && eidDescr) {
							window.eidikotitaDescriptionsEmfanish[eidCode] = eidDescr;
						}
					}
				} catch (err) {
					console.error('Error fetching eidikothtesSymbaseon', err);
				}
			}

			// 5) Φέρνουμε τα στοιχεία από το API
			const stoixeiaMap = {};
			let rowIndex = 0;
			
			for (const row of eidArr) {
				if (rowIndex++ % 5 === 0) {
					await new Promise(r => setTimeout(r, 0));
				}

				const kodikosSymbashs    = row.afora_thn_symbash_kathgoria.slice(0, 4);
				const kodikosKathgorias  = row.afora_thn_symbash_kathgoria.slice(4, 8);
				const kodikosEidikothtas = row.kodikos;
				const key = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`;

				if (!kodikosEidikothtas) continue;

				try {
					const response = await fetch(`/api/stoixeiaSymbaseon/${encodeURIComponent(key)}`, {
						method: 'GET',
						credentials: 'same-origin',
						headers: { 'Accept': 'application/json' }
					});
					if (!response.ok) throw new Error('HTTP ' + response.status);
					
					const stoixeiaData = await response.json();
					stoixeiaMap[key] = stoixeiaData;
					
				} catch (error) {
					console.error('Error fetching stoixeiaSymbaseon for key:', key, error);
					stoixeiaMap[key] = [];
				}
			}

			// 6) Φέρνουμε τα κλιμάκια από το API ΑΝΑ ΣΤΟΙΧΕΙΟ
			window.allKlimakiaData = [];
			
			for (const row of eidArr) {
				await new Promise(r => setTimeout(r, 0));

				const kodikosSymbashs    = row.afora_thn_symbash_kathgoria.slice(0, 4);
				const kodikosKathgorias  = row.afora_thn_symbash_kathgoria.slice(4, 8);
				const kodikosEidikothtas = row.kodikos;
				
				if (!kodikosEidikothtas) continue;

				const stoixeiaKey = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`;
				const stoixeiaDataForThisRow = stoixeiaMap[stoixeiaKey] || [];

				for (const stoixeio of stoixeiaDataForThisRow) {
					const kodikosStoxeiou = stoixeio.kodikos;
					const klimakiaKey = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}${kodikosStoxeiou}`;

					try {
						const response = await fetch(`/api/klimakiaSymbaseon/${encodeURIComponent(klimakiaKey)}`, {
							method: 'GET',
							credentials: 'same-origin',
							headers: { 'Accept': 'application/json' }
						});
						if (!response.ok) throw new Error('HTTP ' + response.status);

						const klimakiaDataForThisItem = await response.json();
						
						if (Array.isArray(klimakiaDataForThisItem)) {
							window.allKlimakiaData = window.allKlimakiaData.concat(klimakiaDataForThisItem);
						}

					} catch (error) {
						console.error('Error fetching klimakiaSymbaseon for key:', klimakiaKey, error);
					}
				}
			}

			if (window.allKlimakiaData.length === 0) {
				showSwal('warning', 'Προσοχή', 'Δεν βρέθηκαν κλιμάκια για τα επιλεγμένα στοιχεία');
				return;
			}

			// 7) Φτιάχνουμε την δομή δεδομένων
			buildTreeFromData(window.allKlimakiaData, stoixeiaMap);

			// 8) Render
			renderNestedTablesEmfanish(tbody);

		} catch (error) {
			console.error('Error:', error);
			showSwal('error', 'Σφάλμα', 'Παρουσιάστηκε σφάλμα κατά την εμφάνιση των δεδομένων');
		} finally {
			if (loader) {
				loader.style.display = 'none';
			}
		}
	});
});
