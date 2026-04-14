// // routes/dropdowns/ergazomenoi/epaEfka.js
// const statheraArxeiaModel = require('../../models/stathera_arxeia');
// const { EidikesPeriptoseisEfkaModel } = statheraArxeiaModel;

// const toInt = (v, def) => {
//   const n = Number((v ?? '').toString().trim());
//   return Number.isFinite(n) ? n : def;
// };
// const escRe = (s) => (s ?? '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// const handler = async (req, res) => {
//   try {
//     // Remote search & pagination (Tom Select)
//     const search = (req.query.search || '').trim();
//     const page   = Math.max(1, toInt(req.query.page, 1));
//     // Μεγάλο cap για να μπορείς να φέρεις «όλες» με ένα call
//     const limitQ = toInt(req.query.limit, 1000);
//     const limit  = Math.min(Math.max(1, limitQ), 5000);
//     const skip   = (page - 1) * limit;

//     const pipeline = [];

//     // Search σε kodikos/perigrafh (case-insensitive)
//     if (search) {
//       const re = new RegExp(escRe(search), 'i');
//       pipeline.push({
//         $match: {
//           $or: [
//             { kodikos:   { $regex: re } },
//             { perigrafh: { $regex: re } },
//           ]
//         }
//       });
//     }

//     // Προσθέτουμε numeric κωδικό για σωστή σειρά (01,02,05,...)
//     pipeline.push(
//       { $addFields: { codeNum: { $toInt: '$kodikos' } } },
//       { $sort: { codeNum: 1, kodikos: 1 } }
//     );

//     // Σύνολο για pagination
//     const countRes = await EidikesPeriptoseisEfkaModel.aggregate([
//       ...pipeline,
//       { $count: 'total' }
//     ]).exec();
//     const total = countRes?.[0]?.total ?? 0;

//     // Σελίδα
//     const rows = await EidikesPeriptoseisEfkaModel.aggregate([
//       ...pipeline,
//       { $skip: skip },
//       { $limit: limit },
//       { $project: {
//           _id: 0,
//           kodikos: 1,
//           perigrafh: { $ifNull: ['$perigrafh', ''] }
//       } }
//     ]).exec();

//     // Map σε Tom Select items
//     const items = rows.map(doc => {
//       const code = (doc.kodikos ?? '').toString().trim();
//       const per  = (doc.perigrafh ?? '').toString().trim();
//       return {
//         value: code,
//         label: `${code} - ${per}`,
//         kodikos: code,
//         perigrafh: per
//       };
//     });

//     return res.json({
//       items,
//       total,
//       page,
//       hasMore: skip + items.length < total
//     });
//   } catch (err) {
//     console.error('epa_efka handler error:', err);
//     return res.status(500).json({ items: [], total: 0, page: 1, hasMore: false });
//   }
// };

// module.exports = { path: '/api/dropdown/ergazomenoi/epa_efka', handler };

// routes/dropdowns/ergazomenoi/epaEfka.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { EidikesPeriptoseisEfkaModel } = statheraArxeiaModel;

const toInt = (v, def) => {
    const n = Number((v ?? '').toString().trim());
    return Number.isFinite(n) ? n : def;
};
const escRe = (s) => (s ?? '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const handler = async (req, res) => {
    try {
        // ---------- Preselect by ?value= ----------
        if (req.query.value) {
            const value = String(req.query.value).trim();
            const row = await EidikesPeriptoseisEfkaModel.findOne(
                { kodikos: value },
                { _id: 0, kodikos: 1, perigrafh: 1 }
            )
                .lean()
                .exec();
            if (!row) return res.json({ items: [], total: 0, page: 1, hasMore: false });
            const kodikos = (row.kodikos ?? '').toString().trim();
            const perigrafh = (row.perigrafh ?? '').toString().trim();
            return res.json({
                items: [{ value: kodikos, label: `${kodikos} - ${perigrafh}`, kodikos, perigrafh }],
                total: 1,
                page: 1,
                hasMore: false
            });
        }

        // Remote search & pagination (Tom Select)
        const search = (req.query.search || '').trim();
        const page = Math.max(1, toInt(req.query.page, 1));
        // Μεγάλο cap για να μπορείς να φέρεις «όλες» με ένα call
        const limitQ = toInt(req.query.limit, 1000);
        const limit = Math.min(Math.max(1, limitQ), 5000);
        const skip = (page - 1) * limit;

        const pipeline = [];

        // Search σε kodikos/perigrafh (case-insensitive)
        if (search) {
            const re = new RegExp(escRe(search), 'i');
            pipeline.push({
                $match: {
                    $or: [{ kodikos: { $regex: re } }, { perigrafh: { $regex: re } }]
                }
            });
        }

        // Προσθέτουμε numeric κωδικό για σωστή σειρά (01,02,05,...)
        pipeline.push(
            { $addFields: { codeNum: { $toInt: '$kodikos' } } },
            { $sort: { codeNum: 1, kodikos: 1 } }
        );

        // Σύνολο για pagination
        const countRes = await EidikesPeriptoseisEfkaModel.aggregate([
            ...pipeline,
            { $count: 'total' }
        ]).exec();
        const total = countRes?.[0]?.total ?? 0;

        // Σελίδα
        const rows = await EidikesPeriptoseisEfkaModel.aggregate([
            ...pipeline,
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    _id: 0,
                    kodikos: 1,
                    perigrafh: { $ifNull: ['$perigrafh', ''] }
                }
            }
        ]).exec();

        // Map σε Tom Select items
        const items = rows.map((doc) => {
            const code = (doc.kodikos ?? '').toString().trim();
            const per = (doc.perigrafh ?? '').toString().trim();
            return {
                value: code,
                label: `${code} - ${per}`,
                kodikos: code,
                perigrafh: per
            };
        });

        return res.json({
            items,
            total,
            page,
            hasMore: skip + items.length < total
        });
    } catch (err) {
        console.error('epa_efka handler error:', err);
        return res.status(500).json({ items: [], total: 0, page: 1, hasMore: false });
    }
};

module.exports = { path: '/api/dropdown/ergazomenoi/epa_efka', handler };
