export async function handleCalcs001(sharedParams) {
	switch(sharedParams.ergazomenoi.xarakthrismos_ergazomenon) {
		case true:    // ΥΠΑΛΛΗΛΟΣ
			switch(sharedParams.ergazomenoi.typos_ergazomenon) {
				case "Μ":    // ΜΙΣΘΩΤΟΣ
					switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
						case "0":    // ΠΛΗΡΗΣ
							const synoloHmeronAstheneias = parseFloat(document.getElementById("geniko_synolo_hmeron_astheneias").value);
							const hmeresErgasiasParsed = parseFloat(document.getElementById("hmeresErgasiasMeionApoysies").value) || 0;
							const pragmatikoHmeromisthioParsed = parseFloat(pragmatikoHmeromisthio.value) || 0;
							const hmeresApoysiasParsed = parseFloat(hmeresApoysias.value) || 0;
							let pragmatikoHmeromisthioAstheneias = parseFloat(document.getElementById("pragmatikoHmeromisthioAstheneias").value) || 0;
							const synoloProsayxhseon = parseFloat(document.getElementById("synoloProsayxhseon").value) || 0;
							const apodoxesAstheneiasParsed = parseFloat(document.getElementById("geniko_synolo_astheneias").value) || 0;
							const pragmatikoOromisthioParsed = parseFloat(pragmatikoOromisthio.value) || 0;
							const oresApoysiasParsed = parseFloat(oresApoysias.value) || 0;
							
							const misthosApodoxes = ((hmeresErgasiasParsed + synoloHmeronAstheneias) * pragmatikoHmeromisthioParsed);
							const kostosOronApoysias = oresApoysiasParsed * pragmatikoOromisthioParsed;
							document.getElementById("synoloMiktonApodoxon_Hidden").value = misthosApodoxes - kostosOronApoysias;

							// pragmatikoHmeromisthioAstheneias = parseFloat((parseFloat(misthosApodoxes - synoloProsayxhseon - kostosOronApoysias) +
							pragmatikoHmeromisthioAstheneias = parseFloat((parseFloat(misthosApodoxes - kostosOronApoysias) +
								(parseFloat(document.getElementById("axiaArgion").value || 0) + 
								parseFloat(document.getElementById("axiaNyxtas").value || 0) + 
								parseFloat(document.getElementById("axiaYperergasias").value || 0) + 
								parseFloat(document.getElementById("axiaYperergasiasNyxtas").value || 0) + 
								parseFloat(document.getElementById("axiaYperergasiasArgion").value || 0) + 
								parseFloat(document.getElementById("axiaYperergasiasArgionNyxtas").value || 0))) / (hmeresErgasiasParsed + synoloHmeronAstheneias)).toFixed(2);
							
							document.getElementById("pragmatikoHmeromisthioAstheneias").value = parseFloat(document.getElementById("hmeresAsfalishs").value) === 0 ? parseFloat(pragmatikoHmeromisthioAstheneias) : (parseFloat(parseFloat(pragmatikoHmeromisthioAstheneias)) || 0).toFixed(4);

							synoloMiktonApodoxon.value = (misthosApodoxes - kostosOronApoysias + synoloProsayxhseon).toFixed(2);
							if (synoloMiktonApodoxon.value <= 0) synoloMiktonApodoxon.value = 0;
							document.getElementById("synoloMiktonApodoxon").value = synoloMiktonApodoxon.value - apodoxesAstheneiasParsed;
							break;
						case "1":    // ΜΕΡΙΚΗ
							break;
						case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
							break;
					}
					break;
				case "Η":    // ΗΜΕΡΟΜΙΣΘΙΟΣ
					switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
						case "0":    // ΠΛΗΡΗΣ
							break;
						case "1":    // ΜΕΡΙΚΗ
							break;
						case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
							break;
					}
					break;
				case "Ω":    // ΩΜΕΡΟΜΙΣΘΙΟΣ
					switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
						case "0":    // ΠΛΗΡΗΣ
							break;
						case "1":    // ΜΕΡΙΚΗ
							break;
							case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
						break;
					}
					break;
			}
			break;
		case false:   // ΕΡΓΑΤΗΣ
			switch(sharedParams.ergazomenoi.typos_ergazomenon) {
				case "Μ":    // ΜΙΣΘΩΤΟΣ
					switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
						case "0":    // ΠΛΗΡΗΣ
							break;
						case "1":    // ΜΕΡΙΚΗ
							break;
						case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
							break;
					}
					break;
				case "Η":    // ΗΜΕΡΟΜΙΣΘΙΟΣ
					switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
						case "0":    // ΠΛΗΡΗΣ
							break;
						case "1":    // ΜΕΡΙΚΗ
							break;
						case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
							break;
					}
					break;
				case "Ω":    // ΩΜΕΡΟΜΙΣΘΙΟΣ
					switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
						case "0":    // ΠΛΗΡΗΣ
							break;
						case "1":    // ΜΕΡΙΚΗ
							break;
						case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
							break;
					}
					break;
			}
			break;
	}
}
