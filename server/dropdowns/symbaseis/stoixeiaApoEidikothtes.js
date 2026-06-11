// server/dropdowns/symbaseis/stoixeiaApoEidikothtes.js

const symbaseisModels = require('../../models/symbaseis');
// ΒΕΒΑΙΩΣΟΥ ότι αυτό το όνομα υπάρχει στο models/symbaseis.js
const { StoixeiaSymbaseonModel } = symbaseisModels;

function pad4(v) {
    return String(v ?? '')
        .replace(/\D/g, '')
        .padStart(4, '0');
}

module.exports = {
    model: StoixeiaSymbaseonModel,
    path: '/api/dropdown/symbaseis/stoixeio_symbashs',

    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },

        extraQueryBuilder: (q) => {
            // 1) σύμβαση
            const sym = pad4(q.symbash_stathera || q.symbash || q.afora_thn_symbash || '');

            // 2) κατηγορία
            const kat = pad4(
                q.kathgoria_symbashs_stathera || q.kathgoria_symbashs || q.afora_thn_kathgoria || ''
            );

            // 3) ειδικότητα
            const eid = pad4(
                q.eidikothta_symbashs_stathera ||
                    q.eidikothta_symbashs ||
                    q.afora_thn_eidikothta ||
                    ''
            );

            // αν λείπει οτιδήποτε → άδειο
            if (!sym.trim() || !kat.trim() || !eid.trim()) {
                return { _id: { $exists: false } };
            }

            // τριάδα 4+4+4 = 12
            const symKath = `${sym}${kat}`; // 8 ψηφία
            const symKathEid = `${sym}${kat}${eid}`; // 12 ψηφία

            return { afora_thn_symbash_kathgoria_eidikothta: symKathEid };
        },

        mapItem: (doc) => {
            const kod = String(doc.kodikos ?? '')
                .replace(/\D/g, '')
                .padStart(4, '0');
            const per = String(doc.perigrafh ?? '').trim();
            const label = `${kod} - ${per}`;

            return {
                id: String(doc._id ?? ''),
                value: kod,
                label,
                text: label,
                kodikos: kod,
                perigrafh: per,
                afora_thn_symbash_kathgoria_eidikothta: String(
                    doc.afora_thn_symbash_kathgoria_eidikothta ?? ''
                ).trim()
            };
        }
    }
};
