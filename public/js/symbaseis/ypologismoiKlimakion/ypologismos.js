window.dataForUpdate = []; // Δημιουργία της global μεταβλητής για αποθήκευση των δεδομένων

function pushAndAppendRow({ uniqueCode, item, result, isxyeiApo, isxyeiEos, tbody }) {
	window.dataForUpdate.push({
		kodikos_symbashs: uniqueCode.substring(0, 4),
		kodikos_kathgorias_symbashs: uniqueCode.substring(4, 8),
		kodikos_eidikothtas_symbashs: uniqueCode.substring(8, 12),
		kodikos_stoixeioy: uniqueCode.substring(12, 16),
		klimakio: uniqueCode.substring(16),
		poso: result,
		isxyei_apo: isxyeiApo,
		isxyei_eos: isxyeiEos,
		afora_thn_symbash: uniqueCode.substring(0, 4),
		afora_thn_symbash_kathgoria: uniqueCode.substring(0, 8),
		afora_thn_symbash_kathgoria_eidikothta: uniqueCode.substring(0, 12),
		afora_thn_symbash_kathgoria_eidikothta_stoixeio: uniqueCode.substring(0, 16),
	});

	const katigoria    = uniqueCode.substring(4, 8);
	const eidikotita   = uniqueCode.substring(8, 12);
	const kodStoixeiou = uniqueCode.substring(12, 16);
	const klimakioDisp = uniqueCode.substring(16);
	const perigrafhStoixeioy = item.perigrafh_stoixeioy ?? item.perigrafh ?? '';
	const posoDisp = (typeof result === 'number' && Number.isFinite(result))
		? result.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		: '';
	const katastash = (item.typos_ypologismoy && String(item.typos_ypologismoy).trim() !== '') ? '✔️' : '❌';

	const tr = document.createElement('tr');
	tr.innerHTML = `
		<td class="col-1 text-center text-nowrap">${katigoria}</td>
		<td class="col-1 text-center text-nowrap">${eidikotita}</td>
		<td class="col-1 text-center text-nowrap">${kodStoixeiou}</td>
		<td class="col-6">${perigrafhStoixeioy}</td>
		<td class="col-1 text-center">${klimakioDisp}</td>
		<td class="col-1 text-end">${posoDisp}</td>
		<td class="col-1 text-center">${katastash}</td>
	`;
	tbody.appendChild(tr);
}

document.addEventListener("DOMContentLoaded", async function () {
  	document.getElementById('add-btn').addEventListener('click', async () => {
		// καθάρισε τον πίνακα και το buffer πριν ξεκινήσεις
		const tbody = document.querySelector('#myTable tbody');
		tbody.innerHTML = '';
		window.dataForUpdate.length = 0;

		const isxyeiApo = document.getElementById('isxyei_apo').value;
		const isxyeiEos = document.getElementById('isxyei_eos').value;

		// Αν κάποιο από τα δύο πεδία είναι κενό, εμφανίστε μήνυμα και επιστρέψτε
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
	
		const el = document.getElementById('eidikothta_symbashs_table');
		const raw = (el.value ?? el.textContent ?? '').trim();   // παίρνουμε το κείμενο
		const eidArr = JSON.parse(raw);                          // ΤΩΡΑ είναι array

		console.log('isArray?', Array.isArray(eidArr), 'length:', eidArr.length);

		for (const row of eidArr) {
  			const kodikosSymbashs    = row.afora_thn_symbash_kathgoria.slice(0, 4);
  			const kodikosKathgorias  = row.afora_thn_symbash_kathgoria.slice(4, 8);
  			const kodikosEidikothtas = row.kodikos;
			const key = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`;
			
			if (kodikosEidikothtas) {
				try {
					const response = await fetch(`/api/stoixeiaSymbaseon/${encodeURIComponent(key)}`, {
						method: 'GET',
						credentials: 'same-origin',          // στέλνει τα cookies CSRF/Session
						headers: { 'Accept': 'application/json' }
					});
					if (!response.ok) throw new Error('HTTP ' + response.status);
					const data = await response.json();
					console.log(data);

					// Για κάθε "στοιχείο σύμβασης" (item) που γύρισε το API
					for (const item of data) {
						if (!item) continue;

						const arithmosKlimakion   = Number(item.arithmos_klimakion) || 0;
						const vhmaYpologismou     = Number(item.vhma_ypologismou) || 1;
						const startKlimakio       = Number(item.ypologismos_apo_klimakio) || 1;

						for (let i = 1; i <= arithmosKlimakion; i += vhmaYpologismou) {
							const klimakioDisp = String(i).padStart(2, '0');
							const uniqueCode = `${item.afora_thn_symbash_kathgoria_eidikothta}${item.kodikos}${klimakioDisp}`;

							let multiplier = 0;
							let klimakioValue = i; // default: το τρέχον κλιμάκιο

							// Για κλιμάκια πριν από το startKlimakio => μηδενική αξία
							if (item.ypologismos_apo_klimakio > 1 && i < startKlimakio) {
								multiplier    = 0;
								klimakioValue = 0;

								const result = dynamicCalculation(
									data,
									item,
									item.typos_ypologismoy ?? '',
									multiplier,
									klimakioValue
								);

								pushAndAppendRow({
									uniqueCode,
									item,
									result,
									isxyeiApo,
									isxyeiEos,
									tbody
								});

								continue; // επόμενο κλιμάκιο
							}

							// Κανονικός υπολογισμός multiplier (όπως πριν)
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

							// push + εμφάνιση γραμμής
							pushAndAppendRow({
								uniqueCode,
								item,
								result,
								isxyeiApo,
								isxyeiEos,
								tbody
							});
						}
					}
				} catch (error) {
					console.error(error);
				}
			}
		}
	});
});

/**
 * Υπολογίζει τον τύπο `expression` αντικαθιστώντας:
 * - κάθε 4ψήφιο κωδικό (π.χ. 0001, 0002) με poso / pososto
 * - τη λέξη multiplier με την τιμή του multiplier
 * - τη λέξη klimakio με την τιμή του τρέχοντος κλιμακίου
 * - τη λέξη ypologismos_apo_klimakio με item.ypologismos_apo_klimakio
 * - τη λέξη bhma_ypologismou / bhma_ypologismoy με item.vhma_ypologismou
 *
 * Παράδειγμα τύπου:
 *   0002 * (klimakio - (ypologismos_apo_klimakio - bhma_ypologismou))
 */
function dynamicCalculation(data, item, expression, multiplier, klimakio) {
	const startKlimakio   = Number(item?.ypologismos_apo_klimakio) || 0;
	const bhmaYpologismou = Number(item?.vhma_ypologismou ?? item?.bhma_ypologismou) || 1;

	let processedExpression = String(expression || '');

	// 1) poso(0002) -> ήδη υπολογισμένο ποσό 0002 για το ίδιο κλιμάκιο
	processedExpression = processedExpression.replace(/poso\((\d{4})\)/gi, (match, code) => {
		// ψάχνουμε πρώτα στο buffer που γεμίζεις με pushAndAppendRow
		const buffer = window.dataForUpdate || [];
		const row = buffer.find(r =>
			r.kodikos_stoixeioy === code &&
			Number(r.klimakio) === Number(klimakio)
		);

		if (row && row.poso != null && !isNaN(row.poso)) {
			return String(row.poso);      // αυτό είναι ουσιαστικά το posoDisp
		}

		// fallback: αν για κάποιο λόγο δεν έχει υπολογιστεί ακόμη, πάρε τη βασική τιμή
		const codeItem = data.find(({ kodikos }) => kodikos === code);
		if (!codeItem) return '0';

		const poso    = Number(String(codeItem.poso    ?? '0').replace(',', '.')) || 0;
		const pososto = Number(String(codeItem.pososto ?? '0').replace(',', '.')) || 0;
		const value   = poso || pososto;

		return String(value);
	});

	// 2) 4ψήφιοι κωδικοί -> βασικές τιμές (ποσό / ποσοστό)
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
		let result = math.evaluate(processedExpression);

		if (!Number.isFinite(result)) return 0;

		// Αν προκύψει αρνητικό, το μηδενίζουμε
		if (result < 0) result = 0;

		return Number(result.toFixed(2));
	} catch (error) {
		console.error('Error evaluating expression:', error, processedExpression);
		return 0;
	}
}
