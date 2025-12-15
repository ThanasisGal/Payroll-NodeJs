// routes/dropdowns/ergazomenoi/thematikes_enothtes.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { ThematikesEnothtesModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/thematikh_enothta',
    model: ThematikesEnothtesModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { perigrafh: 1 },

        // ➜ πάντα φιλτράρουμε με βάση την περιφέρεια (αν δόθηκε)
        extraQueryBuilder: (q) => {
            const res = {};
            if (q.kodikos_sysxetishs) res.kodikos_sysxetishs = String(q.kodikos_sysxetishs).trim();
            return res;
        },

        mapItem: (doc) => {
            const kod = String(doc.kodikos || '').trim();
            const per = String(doc.perigrafh || '').trim();
            return {
                value               : kod,
                label               : `${kod} - ${per}`,
                kodikos             : kod,
                perigrafh           : per,
                kodikos_sysxetishs  : String(doc.kodikos_sysxetishs || '').trim()
            };
        },
    }
};
