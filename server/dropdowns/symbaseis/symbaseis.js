// // routes/dropdowns/symbaseis/symbaseis.js
// const symbaseisModel = require('../../models/symbaseis');
// const { SymbaseisModel } = symbaseisModel;

// module.exports = {
//   // το καλώ ήδη έτσι στο EJS
//   path: '/api/dropdown/symbaseis/symbash',
//   model: SymbaseisModel,
//   options: {
//     pk: 'kodikos',                          // όπως στα άλλα dropdown σου
//     searchFields: ['kodikos', 'perigrafh'],
//     sort: { kodikos: 1 },

//     // 👇 εδώ είναι το βασικό:
//     // όταν ο TomSelect κάνει ?value=0004 ή ?symbash=0004 ή ?symbash_stathera=0004
//     // φέρ’ του ΜΟΝΟ αυτή τη σύμβαση
//     extraQueryBuilder: (q) => {
//       const v =
//         (q.value || q.symbash || q.symbash_stathera || '').trim();
//       if (!v) return {};
//       return { kodikos: v };                // προσαρμόσ’ το αν το πεδίο σου λέγεται αλλιώς
//     },

//     // 👇 και εδώ του δίνουμε αυτό που θέλει ο TomSelect
//     mapItem: (doc) => {
//       const kod = String(doc.kodikos ?? '')
//         .replace(/\D/g, '')
//         .padStart(4, '0');

//       const label = `${kod} - ${doc.perigrafh ?? ''}`;

//       return {
//         id: String(doc._id ?? kod),
//         value: kod,
//         label,
//         text: label,
//         kodikos: kod,
//         perigrafh: doc.perigrafh ?? '',
//       };
//     },
//   },
// };

// server/dropdowns/symbaseis/symbaseisDropdown.js
const symbaseisModels = require('../../models/symbaseis');
const { SymbaseisModel } = symbaseisModels;

module.exports = {
    path: '/api/dropdown/symbaseis/symbash',
    model: SymbaseisModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },

        // Χωρίς φίλτρο - φορτώνει ΟΛΕΣ τις συμβάσεις
        extraQueryBuilder: (_q) => ({}),

        mapItem: (doc) => {
            const kod = String(doc.kodikos || '')
                .trim()
                .padStart(4, '0');
            const per = String(doc.perigrafh || '').trim();
            const lbl = `${kod} - ${per}`;
            return {
                value: kod,
                label: lbl,
                text: lbl,
                kodikos: kod,
                perigrafh: per,
                id: String(doc._id || '')
            };
        }
    }
};
