// routes/dropdowns/symbaseis/kathgoriesSymbaseon.js
const symbaseisModels = require('../../models/symbaseis');
const { KathgoriesSymbaseonModel } = symbaseisModels;

// Εξάγουμε ΜΟΝΟ options (όπως κάνεις και στα υπόλοιπα dropdowns)
module.exports = {
    options: {
        pk: 'kodikos',
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },

        // Παίρνουμε τιμή από query (?symbash_stathera=...) και φιλτράρουμε
        extraQueryBuilder: (q) => {
        const v =
            (q.symbash_stathera || q.afora_thn_symbash || q.symbash || '').trim();
        if (!v) return {};
        return { afora_thn_symbash: v };
        },

        mapItem: (doc) => {
            const kod = String(doc.kodikos ?? '').replace(/\D/g, '').padStart(4, '0');
            const label = `${kod} - ${doc.perigrafh ?? ''}`;
            return {
                id: String(doc._id),   // χρήσιμο για data-id στα <tr>
                value: kod,            // αυτό διαβάζει ο Tom Select
                text: label,           // ασφαλές label
                label,                 // αν ο init διαβάζει 'label'
                kodikos: kod,
                perigrafh: doc.perigrafh ?? ''
            };
        },
    },
};
