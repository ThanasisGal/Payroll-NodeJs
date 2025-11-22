// ypologismos.js
// Πλήρης έκδοση με τις διορθώσεις:
// - Decimal.js (αν είναι διαθέσιμο) για ακριβή στρογγυλοποίηση ROUND_HALF_UP
// - Δυο-φάσεων ροή υπολογισμών: prefetch όλων των στοιχείων, προσδιορισμός max κλιμακίου του '0001',
//   και μετά οι τελικοί υπολογισμοί + συμπλήρωση με το τελευταίο ποσό του ίδιου στοιχείου.

// Ρύθμιση Decimal.js για λογιστικές πράξεις
if (typeof Decimal !== 'undefined') {
	Decimal.set({
		precision: 28,
		rounding: Decimal.ROUND_HALF_UP
	});
}

// Flat buffer για αποθήκευση των γραμμών (χρησιμοποιείται και από dynamicCalculation)
window.dataForUpdate = [];

// Δέντρο για nested UI: Κατηγορία -> Ειδικότητα -> Στοιχείο -> Κλιμάκιο
window.treeData = {};

// Περιγραφές κατηγοριών (γεμίζει από τα APIs)
window.categoryDescriptions = {};

// Περιγραφές ειδικοτήτων (γεμίζει από τα APIs)
window.eidikotitaDescriptions = {};

// Αποθήκευση του μέγιστου αριθμού κλιμακίων από το στοιχείο "0001"
window.maxKlimaKiaFrom0001 = 0;

// ------------------------------
// ΒΟΗΘΗΤΙΚΑ ΓΙΑ ΔΟΜΕΣ ΔΕΔΟΜΕΝΩΝ
// ------------------------------
function collectRow({ uniqueCode, item, result, isxyeiApo, isxyeiEos, pk }) {
	// -------- flat buffer --------
	window.dataForUpdate.push({
		kodikos_symbashs: uniqueCode.substring(0, 4),
		kodikos_kathgorias_symbashs: uniqueCode.substring(4, 8),
		kodikos_eidikothtas_symbashs: uniqueCode.substring(8, 12),
		kodikos_stoixeioy: uniqueCode.substring(12, 16),
		klimakio: uniqueCode.substring(16),
		poso: result,
		isxyei_apo: isxyeiApo,
		isxyei_eos: isxyeiEos,
		pk: pk,
		afora_thn_symbash: uniqueCode.substring(0, 4),
		afora_thn_symbash_kathgoria: uniqueCode.substring(0, 8),
		afora_thn_symbash_kathgoria_eidikothta: uniqueCode.substring(0, 12),
		afora_thn_symbash_kathgoria_eidikothta_stoixeio: uniqueCode.substring(0, 16),
	});

	// -------- nested δέντρο --------
	const katigoria    = uniqueCode.substring(0, 8);
	const eidikotita   = uniqueCode.substring(0, 12);
	const kodStoixeiou = uniqueCode.substring(0, 16);
	const klimakio     = uniqueCode.substring(16);

	const perigrafhStoixeioy = item.perigrafh_stoixeioy ?? item.perigrafh ?? '';
	const katastash = (item.typos_ypologismoy && String(item.typos_ypologismoy).trim() !== '') ? '✔️' : '❌';

	if (!window.treeData[katigoria]) {
		window.treeData[katigoria] = {};
	}
	if (!window.treeData[katigoria][eidikotita]) {
		window.treeData[katigoria][eidikotita] = {};
	}
	if (!window.treeData[katigoria][eidikotita][kodStoixeiou]) {
		window.treeData[katigoria][eidikotita][kodStoixeiou] = {
			perigrafhStoixeioy,
			periods: {},
		};
	}
	const stoixeioNode = window.treeData[katigoria][eidikotita][kodStoixeiou];

	const periodKey = `${isxyeiApo}__${isxyeiEos}`;
	if (!stoixeioNode.periods[periodKey]) {
		stoixeioNode.periods[periodKey] = {
			isxyeiApo,
			isxyeiEos,
			klimakia: [],
		};
	}
	stoixeioNode.periods[periodKey].klimakia.push({
		klimakio,
		poso: result,
		katastash,
	});
}

// ------------------------------
// RENDER NESTED COLLAPSIBLE UI
// ------------------------------

/**
 * Δημιουργεί μια "group" γραμμή (Κατηγορία / Ειδικότητα / Στοιχείο / Περίοδος)
 * level = 'category'   ⇒ πράσινο background
 * level = 'eidikotita' ⇒ ελαφρύ γκρι + indent (col-1 / col-11)
 * level = 'stoixeio'   ⇒ ακόμη πιο μέσα (col-2 / col-10)
 */
function createGroupRow(tbody, label, id, level = 'generic') {
	const tr = document.createElement('tr');
	tr.classList.add('group-row');

	if (level === 'category') {
		tr.classList.add('group-row--category');

		// Κατηγορία: ένα απλό td (όπως πριν)
		tr.innerHTML = `
			<td colspan="7" class="fw-bold">
				<span class="chevron">▸</span>
				${label}
			</td>
		`;
	} else if (level === 'eidikotita') {
		tr.classList.add('group-row--eidikotita');

		// Ειδικότητα: "ψεύτικο" 2-στήλο layout με col-1 / col-11
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

		// Στοιχείο: col-2 κενό, col-10 με το κείμενο
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
	} else {
		// Γενική περίπτωση (αν χρειαστεί κάπου αλλού)
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
 * Γραμμή που φιλοξενεί το "child" table (για nested επίπεδο)
 */
function createChildContainerRow(tbody, id) {
	const tr = document.createElement('tr');
	tr.classList.add('collapse-row');
	tr.dataset.rowId = id;
	tr.style.display = 'none'; // ξεκινάει κλειστό

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

// Χτίζει όλο το nested table: Κατηγορία -> Ειδικότητα -> Στοιχείο -> Κλιμάκια
function renderNestedTables(tbody) {
	tbody.innerHTML = '';

	const tree = window.treeData || {};
	const katKeys = Object.keys(tree).sort();

	for (const katigoria of katKeys) {
		const katId = `kat-${katigoria}`;

		const katDescr = (window.categoryDescriptions || {})[katigoria] || '';

		// Όλα σε μία γραμμή: "Κατηγορία Χ" + περιγραφή με μικρότερο font
		const katLabel = katDescr
			? `Κατηγορία ${katigoria.substring(4, 8)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${katDescr}</span>`
			: `Κατηγορία ${katigoria.substring(4, 8)}`;

		// level = 'category' για να πάρει το πράσινο background
		createGroupRow(tbody, katLabel, katId, 'category');
		const katBody = createChildContainerRow(tbody, katId);

		const eidNode = tree[katigoria];
		const eidKeys = Object.keys(eidNode).sort();

		for (const eidikotita of eidKeys) {
			const eidId = `eid-${katigoria}-${eidikotita}`;

			const eidDescr = (window.eidikotitaDescriptions || {})[eidikotita] || '';
			const eidLabel = eidDescr
				? `Ειδικότητα ${eidikotita.substring(8, 12)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${eidDescr}</span>`
				: `Ειδικότητα ${eidikotita.substring(8, 12)}`;

			// level = 'eidikotita' για διαφορετικό styling + indent
			createGroupRow(katBody, eidLabel, eidId, 'eidikotita');
			const eidBody = createChildContainerRow(katBody, eidId);

			const stoixMap = eidNode[eidikotita];
			const stoixKeys = Object.keys(stoixMap).sort();

			for (const kodStoixeiou of stoixKeys) {
				const stoixNode = stoixMap[kodStoixeiou];
				const stoixId   = `stoix-${katigoria}-${eidikotita}-${kodStoixeiou}`;

				const stoixDescr = stoixNode.perigrafhStoixeioy || '';
				const stoixLabel = stoixDescr
					? `Στοιχείο ${kodStoixeiou.substring(12, 16)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${stoixDescr}</span>`
					: `Στοιχείο ${kodStoixeiou.substring(12, 16)}`;

				// level = 'stoixeio' για να πάρει col-2/col-10 layout
				createGroupRow(eidBody, stoixLabel, stoixId, 'stoixeio');
				const stoixBody = createChildContainerRow(eidBody, stoixId);

				// -------- ΧΩΡΙΣ πλέον "Ισχύει από... έως..." επίπεδο --------
				const periodMap  = stoixNode.periods || {};
				const periodKeys = Object.keys(periodMap).sort();

				if (periodKeys.length > 0) {
					// Ένας ενιαίος πίνακας κλιμακίων ανά Στοιχείο
					const headerRow = document.createElement('tr');
					headerRow.innerHTML = `
						<th colspan="7" class="fw-normal p-0">
							<div class="row g-0 align-items-stretch">
								<div class="col-3"></div>
								<div class="col-2 text-center font-weight-700">α/α Κλιμακίου</div>
								<div class="col-2 text-end font-weight-700">Ποσό</div>
								<div class="col-2 text-center font-weight-700">Κατάσταση</div>
								<div class="col-3"></div>
							</div>
						</th>
					`;
					stoixBody.appendChild(headerRow);

					for (const periodKey of periodKeys) {
						const period = periodMap[periodKey];
						const klimakia = period.klimakia || [];
						klimakia.sort((a, b) => Number(a.klimakio) - Number(b.klimakio));

						for (const k of klimakia) {
							const tr = document.createElement('tr');
							tr.classList.add('klimakio-row-ypologismon');

							const posoDisp = (typeof k.poso === 'number' && Number.isFinite(k.poso))
								? k.poso.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
								: '';

							// ✅ ΑΚΡΙΒΩΣ ΙΔΙΟ LAYOUT ΜΕ ΤΗΝ ΚΕΦΑΛΙΔΑ
							tr.innerHTML = `
								<td colspan="7" class="p-0">
									<div class="row g-0 align-items-stretch">
										<div class="col-3"></div>

										<div class="klimakio-content-ypologismon">
											<div class="col-2 klimakio-cell-ypologismon text-center padding-top-rem-0_4">${k.klimakio}</div>
											<div class="col-2 klimakio-cell-ypologismon text-end padding-top-rem-0_4">${posoDisp}</div>
											<div class="col-2 klimakio-cell-ypologismon text-center padding-top-rem-0_4">${k.katastash || ''}</div>
										</div>

										<div class="col-3"></div>
									</div>
								</td>
							`;
							stoixBody.appendChild(tr);
						}
					}
				}
			}
		}
	}
}

// Event delegation για τα collapsible group rows (ΚΑΘΕ επίπεδο)
document.addEventListener('click', function (e) {
	const row = e.target.closest('tr.group-row');
	if (!row) return;

	const targetId = row.dataset.target;
	if (!targetId) return;

	const contentRow = document.querySelector(`tr[data-row-id="${targetId}"]`);
	if (!contentRow) return;

	// σωστό toggle expand/collapse
	const isHidden = contentRow.style.display === 'none';
	contentRow.style.display = isHidden ? '' : 'none';

	const chevron = row.querySelector('.chevron');
	if (chevron) {
		chevron.textContent = isHidden ? '▾' : '▸';
	}
});

// ------------------------------
// MAIN: Υπολογισμός κλιμακίων
// ------------------------------

document.addEventListener("DOMContentLoaded", function () {
	const addBtn = document.getElementById('add-btn');

	// Loader μόνο για αυτή τη σελίδα
	const loader = document.getElementById('ypologismos-loader');

	if (loader) {
		loader.style.display = 'none'; // κρυφό στην αρχή
	}

	if (!addBtn) return;

	addBtn.addEventListener('click', async () => {
		const tbody = document.querySelector('#myTable tbody');
		if (!tbody) return;

		// Καθαρισμός πριν τον νέο υπολογισμό
		tbody.innerHTML = '';
		window.dataForUpdate = [];
		window.treeData = {};
		window.categoryDescriptions = {};
		window.eidikotitaDescriptions = {};
		window.maxKlimaKiaFrom0001 = 0;

		const isxyeiApo = document.getElementById('isxyei_apo').value;
		const isxyeiEos = document.getElementById('isxyei_eos').value;
		const pk 		= document.getElementById('pk').value;

		if (!isxyeiApo || !isxyeiEos) {
			Swal.fire({
				backdrop: false,
				allowOutsideClick: false,
				icon: 'info',
				title: 'Δεν έχει οριστεί περίοδος ισχύος',
				html: 'Παρακαλώ ορίστε τις ημερομηνίες <strong>Από Ημ/νία Έναρξης</strong> και <strong>Έως Ημ/νία Λήξης</strong>',
				showConfirmButton: true,
				confirmButtonText: 'Κλείσιμο',
				customClass: {
					confirmButton: 'class-info custom-confirm-button custom-swal-button',
					title: 'custom-title',
					popup: 'custom-swal-popup',
				},
			}).then(() => { try { symSelect?.focus(); } catch (_) {} });
			return;
		}

		// ---------- ΔΕΙΞΕ LOADER ----------
		if (loader) {
			loader.style.display = 'flex';
			// δώσε ένα tick στον browser να κάνει repaint
			await new Promise(resolve => setTimeout(resolve, 0));
		}

		try {
			const el  = document.getElementById('eidikothta_symbashs_table');
			const raw = (el.value ?? el.textContent ?? '').trim();
			const eidArr = JSON.parse(raw || '[]');

			// 1) Μοναδικές συμβάσεις (0001, 0002 κ.λπ.)
			const symbashSet = new Set(
				eidArr
					.map(row => row.afora_thn_symbash_kathgoria?.slice(0, 4))
					.filter(Boolean)
			);

			// 1β) Μοναδικά symbash_kathgoria (0001 0001, 0001 0003, κ.λπ.)
			const symbashKathgoriaSet = new Set(
				eidArr
					.map(row => row.afora_thn_symbash_kathgoria)
					.filter(Boolean)
			);

			// 2) Κατηγορίες ανά σύμβαση -> γεμίζει categoryDescriptions
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
					let katCode = '';
					let katDescr = '';
					for (const kat of katArr) {
						katCode = symbash + kat.kodikos;
						katDescr =
							kat.perigrafi_kathgorias ??
							kat.perigrafh_kathgorias ??
							kat.perigrafh ??
							'';

						if (katCode && katDescr && !window.categoryDescriptions[katCode]) {
							window.categoryDescriptions[katCode] = katDescr;
						}
					}
				} catch (err) {
					console.error('Error fetching kathgoriesSymbaseon for symbash', symbash, err);
				}
			}

			// 2β) Ειδικότητες ανά symbash_kathgoria -> γεμίζει eidikotitaDescriptions
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

					let eidCode = '';
					let eidDescr = '';
					for (const eid of eidApiArr) {
						eidCode = symKat + eid.kodikos;
						eidDescr =
							eid.perigrafi_eidikothtas ??
							eid.perigrafh_eidikothtas ??
							eid.perigrafh ??
							'';

						if (eidCode && eidDescr && !window.eidikotitaDescriptions[eidCode]) {
							window.eidikotitaDescriptions[eidCode] = eidDescr;
						}
					}
				} catch (err) {
					console.error('Error fetching eidikothtesSymbaseon for symbash_kathgoria', symKat, err);
				}
			}

			// ================================
			// PREFETCH & ΔΥΟ-ΦΑΣΕΙΣ ΥΠΟΛΟΓΙΣΜΟΥ
			// ================================

			// 1) Φτιάχνουμε λίστα για fetch όλων των stoixeiaSymbaseon (με βάση το eidArr)
			const fetchList = [];
			for (const row of eidArr) {
				const kodikosSymbashs    = (row.afora_thn_symbash_kathgoria ?? '').slice(0, 4);
				const kodikosKathgorias  = (row.afora_thn_symbash_kathgoria ?? '').slice(4, 8);
				const kodikosEidikothtas = row.kodikos;
				if (!kodikosEidikothtas) continue;
				const key = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`;
				fetchList.push({ row, key });
			}

			// 2) Εκτελούμε τα fetch (με μικρά pauses για responsiveness)
			const allFetched = [];
			for (let i = 0; i < fetchList.length; i++) {
				if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
				const { row, key } = fetchList[i];
				try {
					const response = await fetch(`/api/stoixeiaSymbaseon/${encodeURIComponent(key)}`, {
						method: 'GET',
						credentials: 'same-origin',
						headers: { 'Accept': 'application/json' }
					});
					if (!response.ok) throw new Error('HTTP ' + response.status);
					const data = await response.json();
					allFetched.push({ row, data });
				} catch (err) {
					console.error('Error fetching stoixeiaSymbaseon for', key, err);
				}
			}

			// 3) Βρίσκουμε το global max κλιμάκιο από το στοιχείο '0001' (σε όλα τα fetched πακέτα)
			window.maxKlimaKiaFrom0001 = 0;
			for (const pack of allFetched) {
				const data = pack.data || [];
				for (const it of data) {
					if (!it) continue;
					if (String(it.kodikos) === '0001') {
						const ak = Number(it.arithmos_klimakion) || 0;
						if (ak > window.maxKlimaKiaFrom0001) window.maxKlimaKiaFrom0001 = ak;
					}
				}
			}

			// 4) Τώρα κάνουμε τους τελικούς υπολογισμούς για κάθε fetched πακέτο
			for (let idx = 0; idx < allFetched.length; idx++) {
				if (idx % 5 === 0) await new Promise(r => setTimeout(r, 0));

				const { row, data } = allFetched[idx];
				if (!data || data.length === 0) continue;

				for (const item of data) {
					if (!item) continue;

					const arithmosKlimakion   = Number(item.arithmos_klimakion) || 0;
					const vhmaYpologismou     = Number(item.vhma_ypologismou) || 1;
					const startKlimakio       = Number(item.ypologismos_apo_klimakio) || 1;
					const kodikosItem        = item.kodikos;

					let lastResultThisItem = 0;

					// Υπολογισμός για τα κλιμάκια που ορίστηκαν
					for (let i = 1; i <= arithmosKlimakion; i += vhmaYpologismou) {

						// κάθε 20 κλιμάκια, ένα μικρό διάλειμμα
						if (i % 20 === 0) {
							await new Promise(r => setTimeout(r, 0));
						}

						const klimakioDisp = String(i).padStart(2, '0');
						const uniqueCode = `${item.afora_thn_symbash_kathgoria_eidikothta}${item.kodikos}${klimakioDisp}`;

						let multiplier = 0;
						let klimakioValue = i;

						// Για κλιμάκια πριν από το "Ξεκινά από το Κλιμάκιο" => μηδενικό
						if (item.ypologismos_apo_klimakio > 1 && i < startKlimakio) {
							multiplier    = 0;
							klimakioValue = 0;

							const resultPre = dynamicCalculation(
								data,
								item,
								item.typos_ypologismoy ?? '',
								multiplier,
								klimakioValue
							);

							lastResultThisItem = resultPre;
							collectRow({ uniqueCode, item, result: resultPre, isxyeiApo, isxyeiEos, pk });
							continue;
						}

						// Κανονικός multiplier
						if (item.ypologismos_apo_klimakio > 1) {
							if (i > arithmosKlimakion) {
								multiplier = Math.floor(
									(arithmosKlimakion - 1) / item.ypologismos_apo_klimakio
								);
							} else {
								multiplier = Math.floor(
									(i - 1) / item.ypologismos_apo_klimakio
								);
							}
						} else {
							multiplier = 1;
						}

						const result = dynamicCalculation(
							data,
							item,
							item.typos_ypologismoy ?? '',
							multiplier,
							klimakioValue
						);

						lastResultThisItem = result;

						collectRow({ uniqueCode, item, result, isxyeiApo, isxyeiEos, pk });
					}

					// ===== ΣΥΜΠΛΗΡΩΣΗ με το ΤΕΛΕΥΤΑΙΟ ΠΟΣΟ ΤΟΥ ΙΔΙΟΥ ΣΤΟΙΧΕΙΟΥ =====
					// Αν το στοιχείο έχει λιγότερα κλιμάκια από το "0001"
					if (window.maxKlimaKiaFrom0001 > 0 && arithmosKlimakion < window.maxKlimaKiaFrom0001) {
						// Ξεκινάμε από το επόμενο κλιμάκιο
						const startFromKlimakio = Math.max(arithmosKlimakion + vhmaYpologismou, 1);

						for (let i = startFromKlimakio; i <= window.maxKlimaKiaFrom0001; i += vhmaYpologismou) {

							// κάθε 20 κλιμάκια, ένα μικρό διάλειμμα
							if (i % 20 === 0) {
								await new Promise(r => setTimeout(r, 0));
							}

							const klimakioDisp = String(i).padStart(2, '0');
							const uniqueCode = `${item.afora_thn_symbash_kathgoria_eidikothta}${item.kodikos}${klimakioDisp}`;

							// Χρησιμοποιούμε το ΤΕΛΕΥΤΑΙΟ ΠΟΣΟ ΤΟΥ ΙΔΙΟΥ ΣΤΟΙΧΕΙΟΥ
							collectRow({ uniqueCode, item, result: lastResultThisItem, isxyeiApo, isxyeiEos, pk });
						}
					}
				}
			}

			// Όταν τελειώσουν όλα, χτίζουμε το nested UI
			renderNestedTables(tbody);
		} catch (error) {
			console.error(error);
		} finally {
			// ---------- ΚΡΥΨΕ LOADER ----------
			if (loader) {
				loader.style.display = 'none';
			}
		}
	});
});

// ------------------------------
// dynamicCalculation - ΜΕ DECIMAL.JS
// ------------------------------

/**
 * Υπολογίζει τον τύπο `expression` με ΑΚΡΙΒΕΙΑ χρησιμοποιώντας Decimal.js
 */
function dynamicCalculation(data, item, expression, multiplier, klimakio) {
	const startKlimakio   = Number(item?.ypologismos_apo_klimakio) || 0;
	const bhmaYpologismou = Number(item?.vhma_ypologismou ?? item?.bhma_ypologismou) || 1;

	let processedExpression = String(expression || '');

	// 1) poso(0002) -> ήδη υπολογισμένο ποσό 0002 για το ίδιο κλιμάκιο
	processedExpression = processedExpression.replace(/poso\((\d{4})\)/gi, (match, code) => {
		const buffer = window.dataForUpdate || [];
		const row = buffer.find(r =>
			r.kodikos_stoixeioy === code &&
			Number(r.klimakio) === Number(klimakio)
		);

		if (row && row.poso != null && !isNaN(row.poso)) {
			return String(row.poso);
		}

		// fallback: βασική τιμή από το data
		const codeItem = data.find(({ kodikos }) => kodikos === code);
		if (!codeItem) return '0';

		const poso    = Number(String(codeItem.poso    ?? '0').replace(',', '.')) || 0;
		const pososto = Number(String(codeItem.pososto ?? '0').replace(',', '.')) || 0;
		const value   = poso || pososto;

		return String(value);
	});

	// 2) 4ψήφιοι κωδικοί -> poso/pososto
	processedExpression = processedExpression.replace(/\b(\d{4})\b/g, (match, code) => {
		const codeItem = data.find(({ kodikos }) => kodikos === code);
		if (!codeItem) return '0';

		const poso    = Number(String(codeItem.poso    ?? '0').replace(',', '.')) || 0;
		const pososto = Number(String(codeItem.pososto ?? '0').replace(',', '.')) || 0;

		let value;
		if (codeItem.poso_pososto === 1) {
			value = poso || pososto;
		} else if (codeItem.poso_pososto === 0) {
			value = pososto || poso;
		} else {
			value = poso || pososto;
		}
		return String(value);
	});

	// 3) multiplier, klimakio, ypologismos_apo_klimakio, bhma_ypologismou
	processedExpression = processedExpression
		.replace(/multiplier/gi, String(multiplier ?? 0))
		.replace(/\bklimakio\b/gi, String(klimakio ?? 0))
		.replace(/ypologismos_apo_klimakio/gi, String(startKlimakio))
		.replace(/bhma_ypologismou|bhma_ypologismoy/gi, String(bhmaYpologismou));

	try {
		// ✅ Αξιολόγησε με math.js
		let result = math.evaluate(processedExpression);

		// ✅ ΑΝ Decimal.js είναι διαθέσιμο, χρησιμοποίησέ το για ακρίβεια
		if (typeof Decimal !== 'undefined') {
			let decimalResult = new Decimal(result.toString());

			if (!decimalResult.isFinite()) return 0;
			if (decimalResult.isNegative()) return 0;

			// ✅ Στρογγυλοποίησε με ROUND_HALF_UP (σωστό για λογιστική)
			let rounded = decimalResult.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
			return Number(rounded);
		} else {
			// Fallback αν δεν υπάρχει Decimal.js
			if (!Number.isFinite(result)) return 0;
			if (result < 0) result = 0;
			return Number(result.toFixed(2));
		}
	} catch (error) {
		console.error('Error evaluating expression:', error, processedExpression);
		return 0;
	}
}