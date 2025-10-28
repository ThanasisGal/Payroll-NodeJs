// routes/dropdowns/ergazomenoi/nomoi.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { NomoiModel } = statheraArxeiaModel;

module.exports = {
	path: '/api/dropdown/ergazomenoi/nomos',
	model: NomoiModel,
	options: {
		searchFields: ['kodikos', 'perigrafh'],
		sort: { perigrafh: 1 },  // ταξινόμηση κατά περιγραφή

		// ➜ πάντα φιλτράρουμε με βάση την περιφέρεια (αν δόθηκε)
		extraQueryBuilder: (q) => {
		const res = {};
		if (q.perifereia) res.perifereia = String(q.perifereia).trim();
		return res;
		},

		mapItem: (doc) => {
			const kod = String(doc.kodikos || '').trim();
			const per = String(doc.perigrafh || '').trim();
			return {
				value     : kod,
				label     : `${kod} - ${per}`,
				kodikos   : kod,
				perigrafh : per,
				perifereia: String(doc.perifereia || '').trim()
			};
		},
	}
};
