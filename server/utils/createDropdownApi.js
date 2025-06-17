function createDropdownApi(model, options = {}) {
    const {
        searchFields = ['kodikos', 'perigrafh'],
        extraQueryBuilder = () => ({}),
        mapItem = (item, pad = 11) => ({
            value: item.kodikos,
            kodikos: item.kodikos,
            perigrafh: item.perigrafh,
            label: `${(item.kodikos?.trim() || '').padEnd(pad, '\u00A0')} - ${item.perigrafh}`,
        }),
        baseUrl = '',
    } = options;

    return async (req, res) => {
        const padLength = parseInt(req.query.padLength) || 11;
        try {
            const { search = '', page = 1 } = req.query;
            if (req.query.value) {
                const rec = await model.findOne({ kodikos: req.query.value }).lean();
                return res.json({
                    items: rec ? [ mapItem(rec, padLength) ] : []
                });
            }
            const limit = 50;
            const skip = (parseInt(page) - 1) * limit;

            const regex = new RegExp(search, 'i');
            const extraQuery = extraQueryBuilder(req.query);

            // Ερώτημα
            const searchQuery = search
                ? { $or: searchFields.map(field => ({ [field]: regex })) }
                : {};

            const finalQuery = { ...extraQuery, ...searchQuery };

            // const isKadModel = model.collection.collectionName === 'kads';

            // Εύρεση + απόλυτη ταξινόμηση
            const results = await model
                .find(finalQuery)
                // .collation({ locale: 'el', numericOrdering: true })  // πολύ σημαντικό
                // .sort(isKadModel ? { kodikosSort: 1 } : { kodikos: 1 })
                .sort({ kodikos: 1 })
                .skip(skip)
                .limit(limit);

            const count = await model.countDocuments(finalQuery);
            const hasMore = skip + results.length < count;

            const items = results.map(item => mapItem(item, padLength));

            let nextPage = null;
            if (hasMore) {
                const urlBase = baseUrl || req.originalUrl.split('?')[0];
                const url = new URL(urlBase, `${req.protocol}://${req.get('host')}`);
                url.searchParams.set('page', parseInt(page) + 1);
                nextPage = url.toString();
            }

            res.json({
                items,
                hasMore,
                nextPage,
                totalCount: count
            });

        } catch (error) {
            console.error('Σφάλμα στο createDropdownApi:', error);
            res.status(500).send('Σφάλμα κατά την ανάκτηση δεδομένων.');
        }
    };
}

module.exports = {
    createDropdownApi,
};



// function createDropdownApi(model, options = {}) {
//   const {
//     codeField        = 'kodikos',
//     searchFields     = null,
//     extraQueryBuilder = () => ({}),
//     mapItem          = null,
//     baseUrl          = '',
//   } = options;

//   const _searchFields = searchFields || [codeField, 'perigrafh'];

// const _mapItem = mapItem || ((item, pad = 11) => {
//   const code   = item[codeField];
//   const label  = `${(code || '')
//                     .toString()
//                     .padEnd(pad, '\u00A0')} - ${item.perigrafh}`;

//   /* ➜ Επιστρέφουμε Ο,ΤΙ χρειάζεται το front-end */
//   return {
//     value     : code,                // γι’ αυτό κάνει   setValue(code)
//     kodikos   : code,                // το template “ξέρει” αυτό το όνομα
//     perigrafh : item.perigrafh,
//     index     : parseInt(code.replace(/\D/g, ''), 10) || 0, // sortField
//     label,                           // labelField = "label"
//   };
// });
//   return async (req, res) => {
//     const padLength = parseInt(req.query.padLength) || 11;
//     try {
//       const { search = '', page = 1, value } = req.query;

//       /* ---------- PRE-SELECT ---------- */
//         if (value) {
//             // const rec = await model.findOne({ [codeField]: value }).lean();
//             let rec = await model.findOne({ [codeField]: value }).lean();

//             // fallback: αφαίρεσε μη ψηφία (τελείες, παύλες κ.λπ.)
//             if (!rec) {
//                 const numeric = value.replace(/\D/g, '');
//                 if (numeric) {
//                     rec = await model.findOne({ [codeField]: numeric }).lean();
//                 }
//             }

//             return res.json({ items: rec ? [_mapItem(rec, padLength)] : [] });
//         }

//       /* ---------- LIVE SEARCH ---------- */
//       const limit     = 50;
//       const skip      = (parseInt(page) - 1) * limit;
//       const regex     = new RegExp(search, 'i');
//       const extra     = extraQueryBuilder(req.query);

//       const searchQ   = search
//         ? { $or: _searchFields.map(f => ({ [f]: regex })) }
//         : {};

//       const query = { ...extra, ...searchQ };

//       const results = await model
//         .find(query)
//         .sort({ [codeField]: 1 })
//         .skip(skip)
//         .limit(limit)
//         .lean();

//       const count   = await model.countDocuments(query);
//       const hasMore = skip + results.length < count;
//       const items   = results.map(item => _mapItem(item, padLength));

//       /* ---------- nextPage link -------- */
//       let nextPage = null;
//       if (hasMore) {
//         const urlBase = baseUrl || req.originalUrl.split('?')[0];
//         const url     = new URL(urlBase, `${req.protocol}://${req.get('host')}`);
//         url.searchParams.set('page', parseInt(page) + 1);
//         nextPage = url.toString();
//       }

//       res.json({ items, hasMore, nextPage, totalCount: count });
//     } catch (err) {
//       console.error('Σφάλμα στο createDropdownApi:', err);
//       res.status(500).send('Σφάλμα κατά την ανάκτηση δεδομένων.');
//     }
//   };
// }

// module.exports = { createDropdownApi };
